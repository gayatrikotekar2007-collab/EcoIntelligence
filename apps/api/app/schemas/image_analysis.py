from datetime import datetime, timezone
from typing import List, Optional
from pydantic import BaseModel, Field


class BoundingRegion(BaseModel):
    x: int
    y: int
    width: int
    height: int


class ImageDimensions(BaseModel):
    width: int
    height: int


class CompareEvidenceRequest(BaseModel):
    before_evidence_id: int
    after_evidence_id: int


class ImageAnalysisResult(BaseModel):
    status: str = "ANALYZED"
    investigation_id: int
    before_evidence_id: int
    after_evidence_id: int
    similarity: float = Field(..., ge=0.0, le=1.0)
    changed_pixel_percentage: float = Field(..., ge=0.0, le=100.0)
    alignment_status: str  # "ALIGNED", "ALIGNED_RESCALED", "ALIGNMENT_UNCERTAIN"
    before_dimensions: ImageDimensions
    after_dimensions: ImageDimensions
    analysis_dimensions: Optional[ImageDimensions] = None
    difference_region: Optional[BoundingRegion] = None
    analyzed_at: datetime
    warnings: List[str] = Field(default_factory=list)
    limitations: List[str] = Field(
        default_factory=lambda: [
            "Visual pixel differences do not establish environmental improvement or degradation.",
            "Lighting, shadow variations, and seasonal changes may account for detected visual differences.",
            "Ground-truth field verification is required to interpret physical environmental causes.",
        ]
    )


class TemporalSequenceRequest(BaseModel):
    evidence_ids: List[int]


class TemporalSequenceItem(BaseModel):
    evidence_id: int
    sequence_index: int
    captured_at: Optional[datetime] = None
    uploaded_at: Optional[datetime] = None
    original_filename: Optional[str] = None
    role: str  # "BASELINE", "INTERMEDIATE", "CURRENT"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_source: str = "UNAVAILABLE"
    location_accuracy: Optional[float] = None


class AdjacentComparison(BaseModel):
    before_evidence_id: int
    after_evidence_id: int
    before_captured_at: Optional[datetime] = None
    after_captured_at: Optional[datetime] = None
    similarity: float = Field(..., ge=0.0, le=1.0)
    changed_pixel_percentage: float = Field(..., ge=0.0, le=100.0)
    alignment_status: str
    difference_region: Optional[BoundingRegion] = None
    distance_meters: Optional[float] = None
    bearing_degrees: Optional[float] = None
    accuracy_before_meters: Optional[float] = None
    accuracy_after_meters: Optional[float] = None
    spatial_consistency: str = "UNKNOWN"
    spatial_consistency_message: Optional[str] = None
    warnings: List[str] = Field(default_factory=list)
    limitations: List[str] = Field(default_factory=list)


class EvidenceLocationRead(BaseModel):
    evidence_id: int
    investigation_id: int
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_accuracy: Optional[float] = None
    location_source: str = "UNAVAILABLE"


class TemporalSequenceResponse(BaseModel):
    status: str = "ANALYZED"
    investigation_id: int
    sequence_id: str
    sequence: List[TemporalSequenceItem]
    comparisons: List[AdjacentComparison]
    limitations: List[str] = Field(
        default_factory=lambda: [
            "Visual differences represent image-level observations only.",
            "Visual pixel differences do not establish environmental improvement or degradation.",
            "Lighting, shadows, seasonal conditions, perspective, and camera differences may affect measurements.",
            "Visual change does not establish environmental improvement or degradation.",
            "Ground-truth verification is required to interpret physical environmental causes.",
        ]
    )


