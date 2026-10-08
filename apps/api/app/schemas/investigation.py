from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, AliasChoices

from app.models.core import (
    EvidenceSourceType,
    InvestigationStatus,
    ObservationSeverity,
    ObservationSourceType,
    VerificationState,
)


class LocationRead(BaseModel):
    id: int
    latitude: float
    longitude: float
    accuracy_meters: Optional[float] = None
    location_type: str = "point"
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InvestigationBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    status: InvestigationStatus = InvestigationStatus.DRAFT
    category: str = Field(default="general", max_length=100)
    investigation_date: Optional[datetime] = None


class InvestigationCreate(InvestigationBase):
    location_latitude: Optional[float] = None
    location_longitude: Optional[float] = None
    location_accuracy_meters: Optional[float] = None
    location_type: str = "point"
    initial_observation: Optional[str] = None
    initial_severity: Optional[ObservationSeverity] = None
    initial_source_type: Optional[ObservationSourceType] = None


class InvestigationUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    status: Optional[InvestigationStatus] = None
    category: Optional[str] = Field(default=None, max_length=100)
    investigation_date: Optional[datetime] = None


class EvidenceRead(BaseModel):
    id: int
    investigation_id: int
    observation_id: Optional[int] = None
    evidence_type: str
    file_name: str
    original_filename: str
    mime_type: str
    storage_key: str
    file_size_bytes: int
    captured_at: Optional[datetime] = None
    uploaded_at: datetime
    source_type: str
    description: Optional[str] = None
    verification_state: str = "needs_verification"
    metadata: Optional[dict] = Field(
        default_factory=dict,
        validation_alias=AliasChoices("parsed_metadata", "metadata"),
        serialization_alias="metadata",
    )
    observation_description: Optional[str] = None
    location_id: Optional[int] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_accuracy: Optional[float] = None
    location_source: str = "UNAVAILABLE"

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class EvidenceUpdate(BaseModel):
    description: Optional[str] = None
    observation_id: Optional[int] = None
    source_type: Optional[str] = None
    verification_state: Optional[str] = None
    captured_at: Optional[datetime] = None
    location_latitude: Optional[float] = None
    location_longitude: Optional[float] = None
    location_accuracy_meters: Optional[float] = None
    location_source: Optional[str] = None


class ObservationBase(BaseModel):
    category: str = Field(..., min_length=1, max_length=100)
    description: str = Field(..., min_length=1)
    severity: ObservationSeverity = ObservationSeverity.MODERATE
    source_type: ObservationSourceType = ObservationSourceType.OBSERVED
    confidence: float = Field(default=0.0, ge=0.0, le=100.0)
    observed_at: Optional[datetime] = None


class ObservationCreate(ObservationBase):
    location_latitude: Optional[float] = None
    location_longitude: Optional[float] = None
    location_accuracy_meters: Optional[float] = None
    location_type: str = "point"


class ObservationUpdate(BaseModel):
    category: Optional[str] = Field(default=None, min_length=1, max_length=100)
    description: Optional[str] = Field(default=None, min_length=1)
    severity: Optional[ObservationSeverity] = None
    source_type: Optional[ObservationSourceType] = None
    confidence: Optional[float] = Field(default=None, ge=0.0, le=100.0)
    observed_at: Optional[datetime] = None


class ObservationRead(ObservationBase):
    id: int
    investigation_id: int
    location_id: Optional[int] = None
    location: Optional[LocationRead] = None
    observed_at: datetime
    created_at: datetime
    updated_at: datetime
    evidence_count: int = 0
    evidence_ids: List[int] = []

    model_config = ConfigDict(from_attributes=True)


class TimelineEntryRead(BaseModel):
    id: int
    investigation_id: int
    event_type: str
    title: str
    description: Optional[str] = None
    event_timestamp: datetime
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InvestigationRead(InvestigationBase):
    id: int
    owner_id: int
    location_id: Optional[int] = None
    location: Optional[LocationRead] = None
    observations_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InvestigationDetailRead(InvestigationRead):
    observations: List[ObservationRead] = []
    timeline_entries: List[TimelineEntryRead] = []
    evidence: List[EvidenceRead] = []


class GeoJSONGeometry(BaseModel):
    type: str = "Point"
    coordinates: List[float]  # [longitude, latitude]


class GeoJSONFeatureProperties(BaseModel):
    id: int
    title: str
    category: str
    status: str
    severity: Optional[str] = None
    source_type: Optional[str] = None
    created_at: datetime
    observation_count: int = 0
    accuracy_meters: Optional[float] = None
    location_type: str = "point"
    description: Optional[str] = None


class GeoJSONFeature(BaseModel):
    type: str = "Feature"
    geometry: GeoJSONGeometry
    properties: GeoJSONFeatureProperties


class GeoJSONFeatureCollection(BaseModel):
    type: str = "FeatureCollection"
    features: List[GeoJSONFeature]


class EvidenceGap(BaseModel):
    gap_type: str
    title: str
    description: str
    severity: str  # "high", "medium", "low"
    target_type: str  # "investigation", "observation", "evidence"
    target_id: Optional[int] = None
    recommendation: str


class EvidenceGapsResponse(BaseModel):
    investigation_id: int
    total_gaps: int
    gaps: List[EvidenceGap]
