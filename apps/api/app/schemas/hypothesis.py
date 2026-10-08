from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.core import (
    HypothesisConfidence,
    HypothesisRelationshipType,
    HypothesisStatus,
    RequirementPriority,
    RequirementStatus,
)
from app.schemas.investigation import EvidenceRead, ObservationRead, TimelineEntryRead


class MissingEvidenceCreate(BaseModel):
    description: str = Field(..., min_length=1)
    priority: RequirementPriority = RequirementPriority.MEDIUM
    status: RequirementStatus = RequirementStatus.OPEN

    @field_validator("description")
    @classmethod
    def validate_description(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Requirement description cannot be empty.")
        return v.strip()

    @field_validator("priority", mode="before")
    @classmethod
    def normalize_priority(cls, v):
        if isinstance(v, str):
            v_upper = v.upper()
            return RequirementPriority(v_upper)
        return v

    @field_validator("status", mode="before")
    @classmethod
    def normalize_status(cls, v):
        if isinstance(v, str):
            v_upper = v.upper()
            return RequirementStatus(v_upper)
        return v


class MissingEvidenceUpdate(BaseModel):
    description: Optional[str] = Field(default=None, min_length=1)
    priority: Optional[RequirementPriority] = None
    status: Optional[RequirementStatus] = None

    @field_validator("description")
    @classmethod
    def validate_description(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            if not v.strip():
                raise ValueError("Requirement description cannot be empty.")
            return v.strip()
        return v

    @field_validator("priority", mode="before")
    @classmethod
    def normalize_priority(cls, v):
        if isinstance(v, str):
            return RequirementPriority(v.upper())
        return v

    @field_validator("status", mode="before")
    @classmethod
    def normalize_status(cls, v):
        if isinstance(v, str):
            return RequirementStatus(v.upper())
        return v


class MissingEvidenceRead(BaseModel):
    id: int
    hypothesis_id: int
    description: str
    priority: RequirementPriority
    status: RequirementStatus
    created_by: Optional[int] = None
    created_at: datetime
    resolved_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class HypothesisEvidenceCreate(BaseModel):
    evidence_id: int
    relationship_type: HypothesisRelationshipType
    note: Optional[str] = None

    @field_validator("relationship_type", mode="before")
    @classmethod
    def normalize_rel_type(cls, v):
        if isinstance(v, str):
            return HypothesisRelationshipType(v.upper())
        return v


class HypothesisEvidenceRead(BaseModel):
    id: int
    hypothesis_id: int
    evidence_id: int
    relationship_type: HypothesisRelationshipType
    note: Optional[str] = None
    created_by: Optional[int] = None
    created_at: datetime
    evidence: Optional[EvidenceRead] = None

    model_config = ConfigDict(from_attributes=True)


class HypothesisObservationCreate(BaseModel):
    observation_id: int
    relationship_type: HypothesisRelationshipType
    note: Optional[str] = None

    @field_validator("relationship_type", mode="before")
    @classmethod
    def normalize_rel_type(cls, v):
        if isinstance(v, str):
            return HypothesisRelationshipType(v.upper())
        return v


class HypothesisObservationRead(BaseModel):
    id: int
    hypothesis_id: int
    observation_id: int
    relationship_type: HypothesisRelationshipType
    note: Optional[str] = None
    created_by: Optional[int] = None
    created_at: datetime
    observation: Optional[ObservationRead] = None

    model_config = ConfigDict(from_attributes=True)


class HypothesisBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    reasoning: Optional[str] = None
    status: HypothesisStatus = HypothesisStatus.OPEN
    confidence: HypothesisConfidence = HypothesisConfidence.LOW

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Hypothesis title cannot be empty.")
        return v.strip()

    @field_validator("status", mode="before")
    @classmethod
    def normalize_status(cls, v):
        if isinstance(v, str):
            return HypothesisStatus(v.upper())
        return v

    @field_validator("confidence", mode="before")
    @classmethod
    def normalize_confidence(cls, v):
        if isinstance(v, str):
            return HypothesisConfidence(v.upper())
        return v


class HypothesisCreate(HypothesisBase):
    pass


class HypothesisUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    reasoning: Optional[str] = None
    status: Optional[HypothesisStatus] = None
    confidence: Optional[HypothesisConfidence] = None

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            if not v.strip():
                raise ValueError("Hypothesis title cannot be empty.")
            return v.strip()
        return v

    @field_validator("status", mode="before")
    @classmethod
    def normalize_status(cls, v):
        if isinstance(v, str):
            return HypothesisStatus(v.upper())
        return v

    @field_validator("confidence", mode="before")
    @classmethod
    def normalize_confidence(cls, v):
        if isinstance(v, str):
            return HypothesisConfidence(v.upper())
        return v


class HypothesisRead(HypothesisBase):
    id: int
    investigation_id: int
    created_by: int
    created_at: datetime
    updated_at: datetime

    supporting_evidence_count: int = 0
    contradicting_evidence_count: int = 0
    context_evidence_count: int = 0

    supporting_observation_count: int = 0
    contradicting_observation_count: int = 0
    context_observation_count: int = 0

    missing_evidence_count: int = 0
    resolved_missing_evidence_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class HypothesisDetailRead(HypothesisRead):
    evidence_links: List[HypothesisEvidenceRead] = []
    observation_links: List[HypothesisObservationRead] = []
    missing_evidence: List[MissingEvidenceRead] = []
    timeline_entries: List[TimelineEntryRead] = []

    model_config = ConfigDict(from_attributes=True)
