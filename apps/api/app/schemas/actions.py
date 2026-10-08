from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.core import (
    ActionPriority,
    ActionRelationshipType,
    ActionStatus,
    ComparisonOperator,
    CriterionResult,
    MeasurementType,
    VerificationStatus,
)
from app.schemas.investigation import EvidenceRead, ObservationRead


# ------------------------------------------------------------
# Action Criteria Schemas
# ------------------------------------------------------------

class ActionCriterionBase(BaseModel):
    description: str = Field(..., min_length=1)
    measurement_type: str = Field(default=MeasurementType.OBSERVATION.value)
    target_value: Optional[float] = None
    target_unit: Optional[str] = None
    comparison_operator: Optional[str] = None

    @field_validator("description")
    @classmethod
    def validate_description(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Criterion description cannot be empty.")
        return v.strip()

    @field_validator("measurement_type", mode="before")
    @classmethod
    def normalize_measurement_type(cls, v):
        if isinstance(v, str):
            v_upper = v.upper()
            valid = {m.value for m in MeasurementType}
            if v_upper not in valid:
                raise ValueError(f"Invalid measurement type: {v}. Must be one of {valid}")
            return v_upper
        return v

    @field_validator("comparison_operator", mode="before")
    @classmethod
    def normalize_comparison_operator(cls, v):
        if v is not None and isinstance(v, str):
            v_upper = v.upper()
            valid = {o.value for o in ComparisonOperator}
            if v_upper not in valid:
                raise ValueError(f"Invalid comparison operator: {v}. Must be one of {valid}")
            return v_upper
        return v


class ActionCriterionCreate(ActionCriterionBase):
    pass


class ActionCriterionUpdate(BaseModel):
    description: Optional[str] = Field(default=None, min_length=1)
    measurement_type: Optional[str] = None
    target_value: Optional[float] = None
    target_unit: Optional[str] = None
    comparison_operator: Optional[str] = None

    @field_validator("description")
    @classmethod
    def validate_description(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            if not v.strip():
                raise ValueError("Criterion description cannot be empty.")
            return v.strip()
        return v

    @field_validator("measurement_type", mode="before")
    @classmethod
    def normalize_measurement_type(cls, v):
        if v is not None and isinstance(v, str):
            v_upper = v.upper()
            valid = {m.value for m in MeasurementType}
            if v_upper not in valid:
                raise ValueError(f"Invalid measurement type: {v}. Must be one of {valid}")
            return v_upper
        return v

    @field_validator("comparison_operator", mode="before")
    @classmethod
    def normalize_comparison_operator(cls, v):
        if v is not None and isinstance(v, str):
            v_upper = v.upper()
            valid = {o.value for o in ComparisonOperator}
            if v_upper not in valid:
                raise ValueError(f"Invalid comparison operator: {v}. Must be one of {valid}")
            return v_upper
        return v


class ActionCriterionRead(ActionCriterionBase):
    id: int
    action_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ------------------------------------------------------------
# Action Evidence Link Schemas
# ------------------------------------------------------------

class ActionEvidenceCreate(BaseModel):
    evidence_id: int
    relationship_type: str = Field(default=ActionRelationshipType.BEFORE_ACTION.value)
    note: Optional[str] = None

    @field_validator("relationship_type", mode="before")
    @classmethod
    def normalize_relationship_type(cls, v):
        if isinstance(v, str):
            v_upper = v.upper()
            valid = {r.value for r in ActionRelationshipType}
            if v_upper not in valid:
                raise ValueError(f"Invalid relationship type: {v}. Must be one of {valid}")
            return v_upper
        return v


class ActionEvidenceRead(BaseModel):
    id: int
    action_id: int
    evidence_id: int
    relationship_type: str
    note: Optional[str] = None
    created_at: datetime
    evidence: Optional[EvidenceRead] = None

    model_config = ConfigDict(from_attributes=True)


# ------------------------------------------------------------
# Action Observation Link Schemas
# ------------------------------------------------------------

class ActionObservationCreate(BaseModel):
    observation_id: int
    relationship_type: str = Field(default=ActionRelationshipType.BEFORE_ACTION.value)
    note: Optional[str] = None

    @field_validator("relationship_type", mode="before")
    @classmethod
    def normalize_relationship_type(cls, v):
        if isinstance(v, str):
            v_upper = v.upper()
            valid = {r.value for r in ActionRelationshipType}
            if v_upper not in valid:
                raise ValueError(f"Invalid relationship type: {v}. Must be one of {valid}")
            return v_upper
        return v


class ActionObservationRead(BaseModel):
    id: int
    action_id: int
    observation_id: int
    relationship_type: str
    note: Optional[str] = None
    created_at: datetime
    observation: Optional[ObservationRead] = None

    model_config = ConfigDict(from_attributes=True)


# ------------------------------------------------------------
# Verification Result Schemas
# ------------------------------------------------------------

class CriterionResultInput(BaseModel):
    criterion_id: int
    result: Optional[str] = None
    observed_value: Optional[float] = None
    observed_unit: Optional[str] = None
    note: Optional[str] = None

    @field_validator("result", mode="before")
    @classmethod
    def normalize_result(cls, v):
        if v is not None and isinstance(v, str):
            v_upper = v.upper()
            valid = {r.value for r in CriterionResult}
            if v_upper not in valid:
                raise ValueError(f"Invalid criterion result: {v}. Must be one of {valid}")
            return v_upper
        return v


class ActionVerifyRequest(BaseModel):
    summary: Optional[str] = None
    status: Optional[str] = None
    uncertainty_notes: Optional[str] = None
    criterion_results: List[CriterionResultInput] = Field(default_factory=list)

    @field_validator("status", mode="before")
    @classmethod
    def normalize_status(cls, v):
        if v is not None and isinstance(v, str):
            v_upper = v.upper()
            valid = {s.value for s in VerificationStatus}
            if v_upper not in valid:
                raise ValueError(f"Invalid verification status: {v}. Must be one of {valid}")
            return v_upper
        return v


class ActionVerificationResultRead(BaseModel):
    id: int
    verification_id: int
    criterion_id: int
    result: str
    observed_value: Optional[float] = None
    observed_unit: Optional[str] = None
    note: Optional[str] = None
    evaluation_mode: str
    criterion: Optional[ActionCriterionRead] = None

    model_config = ConfigDict(from_attributes=True)


class ActionVerificationRead(BaseModel):
    id: int
    action_id: int
    status: str
    summary: Optional[str] = None
    verified_by: int
    verified_at: datetime
    uncertainty_notes: Optional[str] = None
    verifier_name: Optional[str] = None
    criterion_results: List[ActionVerificationResultRead] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


# ------------------------------------------------------------
# Action Plan Schemas
# ------------------------------------------------------------

class ActionBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    rationale: Optional[str] = None
    hypothesis_id: Optional[int] = None
    priority: str = Field(default=ActionPriority.MEDIUM.value)
    responsible_person: Optional[str] = None
    planned_start_date: Optional[datetime] = None
    target_date: Optional[datetime] = None

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Action title cannot be empty.")
        return v.strip()

    @field_validator("priority", mode="before")
    @classmethod
    def normalize_priority(cls, v):
        if isinstance(v, str):
            v_upper = v.upper()
            valid = {p.value for p in ActionPriority}
            if v_upper not in valid:
                raise ValueError(f"Invalid priority: {v}. Must be one of {valid}")
            return v_upper
        return v


class ActionCreate(ActionBase):
    pass


class ActionUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    rationale: Optional[str] = None
    hypothesis_id: Optional[int] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    responsible_person: Optional[str] = None
    planned_start_date: Optional[datetime] = None
    target_date: Optional[datetime] = None

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            if not v.strip():
                raise ValueError("Action title cannot be empty.")
            return v.strip()
        return v

    @field_validator("status", mode="before")
    @classmethod
    def normalize_status(cls, v):
        if v is not None and isinstance(v, str):
            v_upper = v.upper()
            valid = {s.value for s in ActionStatus}
            if v_upper not in valid:
                raise ValueError(f"Invalid status: {v}. Must be one of {valid}")
            return v_upper
        return v

    @field_validator("priority", mode="before")
    @classmethod
    def normalize_priority(cls, v):
        if v is not None and isinstance(v, str):
            v_upper = v.upper()
            valid = {p.value for p in ActionPriority}
            if v_upper not in valid:
                raise ValueError(f"Invalid priority: {v}. Must be one of {valid}")
            return v_upper
        return v


class ActionRead(BaseModel):
    id: int
    investigation_id: int
    hypothesis_id: Optional[int] = None
    title: str
    description: Optional[str] = None
    rationale: Optional[str] = None
    status: str
    priority: str
    responsible_person: Optional[str] = None
    planned_start_date: Optional[datetime] = None
    target_date: Optional[datetime] = None
    created_by: int
    created_at: datetime
    updated_at: datetime

    criteria_count: int = 0
    evidence_count: int = 0
    observation_count: int = 0
    latest_verification_status: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ActionDetailRead(ActionRead):
    criteria: List[ActionCriterionRead] = Field(default_factory=list)
    evidence_links: List[ActionEvidenceRead] = Field(default_factory=list)
    observation_links: List[ActionObservationRead] = Field(default_factory=list)
    verifications: List[ActionVerificationRead] = Field(default_factory=list)
    hypothesis_title: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
