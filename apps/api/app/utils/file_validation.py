from pathlib import Path
import re
import struct
from typing import Dict, Optional, Tuple

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".pdf"}

ALLOWED_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
}

EXTENSION_TO_MIME = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
}


def sanitize_filename(filename: str) -> str:
    name = Path(filename).name
    name = re.sub(r'[^a-zA-Z0-9_\-\. ]', '_', name).strip()
    return name or "evidence_file"


def validate_file_content(content: bytes, filename: str, declared_mime: Optional[str] = None) -> Tuple[str, str, str]:
    if not content:
        raise ValueError("File is empty (0 bytes).")

    sanitized = sanitize_filename(filename)
    ext = Path(sanitized).suffix.lower()

    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(f"Unsupported file extension '{ext}'. Allowed extensions: {sorted(ALLOWED_EXTENSIONS)}")

    detected_mime = None
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        detected_mime = "image/png"
    elif content.startswith(b"\xff\xd8\xff"):
        detected_mime = "image/jpeg"
    elif content.startswith(b"%PDF"):
        detected_mime = "application/pdf"
    elif content.startswith(b"RIFF") and len(content) >= 12 and content[8:12] == b"WEBP":
        detected_mime = "image/webp"

    expected_mime = EXTENSION_TO_MIME.get(ext)

    if detected_mime is None:
        raise ValueError("Invalid file format. File signature does not match any supported format (JPG, PNG, WEBP, PDF).")

    if detected_mime != expected_mime:
        raise ValueError(f"File extension '{ext}' does not match detected file type '{detected_mime}'.")

    evidence_type = "document" if detected_mime == "application/pdf" else "image"
    return sanitized, detected_mime, evidence_type


def extract_image_dimensions(content: bytes, mime_type: str) -> Dict[str, int]:
    try:
        if mime_type == "image/png" and len(content) >= 24:
            w, h = struct.unpack(">II", content[16:24])
            return {"width": int(w), "height": int(h)}

        elif mime_type == "image/jpeg":
            idx = 2
            while idx < len(content) - 8:
                if content[idx] == 0xFF:
                    marker = content[idx + 1]
                    if marker in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
                        h, w = struct.unpack(">HH", content[idx + 5 : idx + 9])
                        return {"width": int(w), "height": int(h)}
                    elif marker in (0xD8, 0xD9):
                        idx += 2
                    else:
                        length = struct.unpack(">H", content[idx + 2 : idx + 4])[0]
                        idx += 2 + length
                else:
                    idx += 1

        elif mime_type == "image/webp" and len(content) >= 30:
            if content[12:16] == b"VP8 " and len(content) >= 30:
                w = (content[26] | (content[27] << 8)) & 0x3FFF
                h = (content[28] | (content[29] << 8)) & 0x3FFF
                return {"width": int(w), "height": int(h)}
            elif content[12:16] == b"VP8L" and len(content) >= 25:
                b1, b2, b3, b4 = content[21:25]
                w = 1 + (((b2 & 0x3F) << 8) | b1)
                h = 1 + (((b4 & 0xF) << 10) | (b3 << 2) | ((b2 & 0xC0) >> 6))
                return {"width": int(w), "height": int(h)}
            elif content[12:16] == b"VP8X" and len(content) >= 30:
                w = 1 + (content[24] | (content[25] << 8) | (content[26] << 16))
                h = 1 + (content[27] | (content[28] << 8) | (content[29] << 16))
                return {"width": int(w), "height": int(h)}
    except Exception:
        pass
    return {}
