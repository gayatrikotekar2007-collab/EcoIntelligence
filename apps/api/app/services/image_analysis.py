from abc import ABC, abstractmethod
from datetime import datetime, timezone
import io
from typing import List, Optional, Tuple

from PIL import Image, ImageChops

from app.schemas.image_analysis import (
    BoundingRegion,
    ImageAnalysisResult,
    ImageDimensions,
)

SUPPORTED_FORMATS = {"JPEG", "PNG", "WEBP"}


class ImageAnalysisService(ABC):
    @abstractmethod
    def compare_images(
        self,
        investigation_id: int,
        before_id: int,
        before_bytes: bytes,
        after_id: int,
        after_bytes: bytes,
    ) -> ImageAnalysisResult:
        """Deterministically compare two evidence images and produce visual change metrics."""
        pass

    @abstractmethod
    def generate_difference_heatmap(
        self,
        before_bytes: bytes,
        after_bytes: bytes,
        before_id: int = 0,
        after_id: int = 0,
    ) -> bytes:
        """Generate a deterministic derived difference heatmap image as PNG bytes."""
        pass


class DeterministicImageAnalysisService(ImageAnalysisService):
    def validate_and_open(self, content: bytes, identifier: str) -> Image.Image:
        if not content or len(content) == 0:
            raise ValueError(f"Image artifact '{identifier}' is empty (0 bytes).")

        try:
            bio = io.BytesIO(content)
            img = Image.open(bio)
            # Verify image format and integrity
            fmt = img.format
            if fmt not in SUPPORTED_FORMATS:
                raise ValueError(
                    f"Unsupported image format '{fmt}' in artifact '{identifier}'. Supported formats: {sorted(SUPPORTED_FORMATS)}"
                )
            # Fully load and verify pixels to catch truncated or corrupted images
            img.load()
        except Exception as e:
            if isinstance(e, ValueError):
                raise
            raise ValueError(f"Corrupted or unreadable image file in artifact '{identifier}': {str(e)}")

        # Return a copy converted to RGB to ensure consistent color space
        return img.convert("RGB")

    def align_images(
        self,
        img_before: Image.Image,
        img_after: Image.Image,
    ) -> Tuple[Image.Image, Image.Image, str, List[str]]:
        warnings: List[str] = []
        w_b, h_b = img_before.size
        w_a, h_a = img_after.size

        if w_b <= 0 or h_b <= 0 or w_a <= 0 or h_a <= 0:
            raise ValueError("Image dimensions must be greater than zero.")

        aspect_before = w_b / h_b
        aspect_after = w_a / h_a
        aspect_divergence = abs(aspect_before - aspect_after) / max(aspect_before, aspect_after)

        alignment_status = "ALIGNED"

        # Check aspect ratio divergence (> 15% difference indicates different framing or cropping)
        if aspect_divergence > 0.15:
            alignment_status = "ALIGNMENT_UNCERTAIN"
            warnings.append(
                f"Significant aspect ratio divergence ({aspect_divergence * 100:.1f}%) detected between image pair. Alignment is uncertain."
            )
        elif (w_b, h_b) != (w_a, h_a):
            alignment_status = "ALIGNED_RESCALED"
            warnings.append(
                f"Image dimensions differ ({w_b}x{h_b} vs {w_a}x{h_a}). Rescaled to common resolution for analysis."
            )

        # Normalize dimensions for pixel-by-pixel comparison:
        # Standardize target width and height to max 1024 to bound memory and CPU,
        # using before image dimensions as primary reference.
        target_w = min(w_b, 1024)
        target_h = int(target_w / aspect_before) if aspect_before > 0 else min(h_b, 1024)

        if img_before.size != (target_w, target_h):
            norm_before = img_before.resize((target_w, target_h), Image.Resampling.BILINEAR)
        else:
            norm_before = img_before.copy()

        norm_after = img_after.resize((target_w, target_h), Image.Resampling.BILINEAR)

        # Conservative sub-pixel / translation alignment search (±4 pixels in x and y)
        best_diff_sum = None
        best_offset = (0, 0)

        # Test small translation offsets to minimize camera shake error
        for dy in (-4, 0, 4):
            for dx in (-4, 0, 4):
                shifted_after = ImageChops.offset(norm_after, dx, dy)
                diff = ImageChops.difference(norm_before, shifted_after)
                # Compute fast sample difference sum
                stat = sum(diff.convert("L").tobytes())
                if best_diff_sum is None or stat < best_diff_sum:
                    best_diff_sum = stat
                    best_offset = (dx, dy)

        if best_offset != (0, 0) and alignment_status == "ALIGNED":
            norm_after = ImageChops.offset(norm_after, best_offset[0], best_offset[1])
            warnings.append(f"Compensated for slight camera shift ({best_offset[0]}px, {best_offset[1]}px).")

        return norm_before, norm_after, alignment_status, warnings

    def compute_difference(
        self,
        norm_before: Image.Image,
        norm_after: Image.Image,
    ) -> Tuple[float, float, Optional[BoundingRegion]]:
        diff_img = ImageChops.difference(norm_before, norm_after)
        # Convert difference to grayscale (perceptual luminance delta)
        diff_gray = diff_img.convert("L")
        pixels = diff_gray.tobytes()
        total_pixels = len(pixels)

        if total_pixels == 0:
            return 1.0, 0.0, None

        # Perceptual noise threshold: values <= 25 (out of 255, approx 10%) are considered sensor/lighting noise
        NOISE_THRESHOLD = 25
        changed_pixels_count = 0
        min_x = norm_before.width
        min_y = norm_before.height
        max_x = -1
        max_y = -1

        sum_abs_diff = 0
        w = norm_before.width

        for idx, val in enumerate(pixels):
            sum_abs_diff += val
            if val > NOISE_THRESHOLD:
                changed_pixels_count += 1
                x = idx % w
                y = idx // w
                if x < min_x:
                    min_x = x
                if x > max_x:
                    max_x = x
                if y < min_y:
                    min_y = y
                if y > max_y:
                    max_y = y

        changed_pixel_percentage = round((changed_pixels_count / total_pixels) * 100.0, 2)
        # Similarity: 1.0 minus average normalized pixel delta
        mean_diff = sum_abs_diff / (total_pixels * 255.0)
        similarity = round(max(0.0, min(1.0, 1.0 - mean_diff)), 4)

        bounding_region = None
        if changed_pixels_count > 0 and max_x >= min_x and max_y >= min_y:
            bounding_region = BoundingRegion(
                x=int(min_x),
                y=int(min_y),
                width=int(max_x - min_x + 1),
                height=int(max_y - min_y + 1),
            )

        return similarity, changed_pixel_percentage, bounding_region

    def compare_images(
        self,
        investigation_id: int,
        before_id: int,
        before_bytes: bytes,
        after_id: int,
        after_bytes: bytes,
    ) -> ImageAnalysisResult:
        # Step 3: Validate and load images
        img_before = self.validate_and_open(before_bytes, f"Before #{before_id}")
        img_after = self.validate_and_open(after_bytes, f"After #{after_id}")

        orig_dims_before = ImageDimensions(width=img_before.width, height=img_before.height)
        orig_dims_after = ImageDimensions(width=img_after.width, height=img_after.height)

        # Step 4 & 5: Preprocessing and alignment
        norm_before, norm_after, alignment_status, warnings = self.align_images(img_before, img_after)

        # Step 6: Difference computation
        similarity, changed_pixel_percentage, bounding_region = self.compute_difference(norm_before, norm_after)

        now = datetime.now(timezone.utc)

        return ImageAnalysisResult(
            status="ANALYZED",
            investigation_id=investigation_id,
            before_evidence_id=before_id,
            after_evidence_id=after_id,
            similarity=similarity,
            changed_pixel_percentage=changed_pixel_percentage,
            alignment_status=alignment_status,
            before_dimensions=orig_dims_before,
            after_dimensions=orig_dims_after,
            analysis_dimensions=ImageDimensions(width=norm_before.width, height=norm_before.height),
            difference_region=bounding_region,
            analyzed_at=now,
            warnings=warnings,
        )

    def generate_difference_heatmap(
        self,
        before_bytes: bytes,
        after_bytes: bytes,
        before_id: int = 0,
        after_id: int = 0,
    ) -> bytes:
        img_before = self.validate_and_open(before_bytes, f"Before #{before_id}")
        img_after = self.validate_and_open(after_bytes, f"After #{after_id}")

        norm_before, norm_after, _, _ = self.align_images(img_before, img_after)
        diff_img = ImageChops.difference(norm_before, norm_after)
        diff_gray = diff_img.convert("L")

        # Deterministic scientific colormap for visual difference intensity:
        # 0..25 (baseline / noise threshold): deep dark slate (15, 23, 42) -> (30, 41, 59)
        # 26..90 (mild difference): slate -> cyan / azure (14, 165, 233)
        # 91..170 (moderate difference): cyan -> amber / gold (234, 179, 8)
        # 171..255 (high difference): gold -> vivid orange (249, 115, 22) -> crimson (225, 29, 72)
        palette = []
        for i in range(256):
            if i <= 25:
                t = i / 25.0
                r = int(15 + 15 * t)
                g = int(23 + 18 * t)
                b = int(42 + 17 * t)
            elif i <= 90:
                t = (i - 25) / 65.0
                r = int(30 - 16 * t)
                g = int(41 + 124 * t)
                b = int(59 + 174 * t)
            elif i <= 170:
                t = (i - 90) / 80.0
                r = int(14 + 220 * t)
                g = int(165 + 14 * t)
                b = int(233 - 225 * t)
            else:
                t = (i - 170) / 85.0
                r = int(234 - 9 * t)
                g = int(179 - 150 * t)
                b = int(8 + 64 * t)
            palette.extend([r, g, b])

        heatmap_img = diff_gray.copy()
        heatmap_img.putpalette(palette)
        heatmap_rgb = heatmap_img.convert("RGB")

        bio = io.BytesIO()
        heatmap_rgb.save(bio, format="PNG", optimize=True)
        return bio.getvalue()


_service_instance: Optional[ImageAnalysisService] = None


def get_image_analysis_service() -> ImageAnalysisService:
    global _service_instance
    if _service_instance is None:
        _service_instance = DeterministicImageAnalysisService()
    return _service_instance
