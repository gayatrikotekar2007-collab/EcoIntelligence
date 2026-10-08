from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from geoalchemy2 import Geometry
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Enum as SAEnum,
    Float,
    ForeignKey,
    Integer,
    Index,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class UserRole(str, Enum):
    USER = "user"
    ANALYST = "analyst"
    MODERATOR = "moderator"
    ADMIN = "admin"


class InvestigationStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    UNDER_REVIEW = "under_review"
    COMPLETED = "completed"
    RESOLVED = "resolved"
    ARCHIVED = "archived"


class ObservationSourceType(str, Enum):
    OBSERVED = "observed"
    USER_REPORTED = "user_reported"
    ESTIMATED = "estimated"
    INFERRED = "inferred"
    SIMULATED = "simulated"


class EvidenceSourceType(str, Enum):
    OBSERVED = "observed"
    USER_REPORTED = "user_reported"
    EXTERNAL_SOURCE = "external_source"
    INFERRED = "inferred"
    ESTIMATED = "estimated"


class VerificationState(str, Enum):
    NEEDS_VERIFICATION = "needs_verification"
    VERIFIED = "verified"
    DISPUTED = "disputed"


class ObservationSeverity(str, Enum):
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"
    CRITICAL = "critical"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    password_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    auth_provider: Mapped[str] = mapped_column(String(50), nullable=False, default="local")
    auth_provider_user_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    role: Mapped[UserRole] = mapped_column(SAEnum(UserRole), nullable=False, default=UserRole.USER)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    investigations: Mapped[list["Investigation"]] = relationship(back_populates="owner")
    hypotheses: Mapped[list["Hypothesis"]] = relationship(back_populates="creator")


class Location(Base):
    __tablename__ = "locations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    latitude: Mapped[float] = mapped_column(nullable=False)
    longitude: Mapped[float] = mapped_column(nullable=False)
    geometry: Mapped[Optional[object]] = mapped_column(
        Geometry(geometry_type="POINT", srid=4326), nullable=True
    )
    accuracy_meters: Mapped[Optional[float]] = mapped_column(nullable=True)
    location_type: Mapped[str] = mapped_column(String(50), nullable=False, default="point")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    investigations: Mapped[list["Investigation"]] = relationship(back_populates="location")
    observations: Mapped[list["Observation"]] = relationship(back_populates="location")
    environmental_events: Mapped[list["EnvironmentalEvent"]] = relationship(back_populates="location")
    evidence: Mapped[list["Evidence"]] = relationship(back_populates="location")

    __table_args__ = (
        CheckConstraint("latitude BETWEEN -90 AND 90", name="ck_locations_latitude_range"),
        CheckConstraint("longitude BETWEEN -180 AND 180", name="ck_locations_longitude_range"),
        CheckConstraint("accuracy_meters IS NULL OR accuracy_meters >= 0", name="ck_locations_accuracy_non_negative"),
    )


class Investigation(Base):
    __tablename__ = "investigations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[InvestigationStatus] = mapped_column(
        SAEnum(InvestigationStatus), nullable=False, default=InvestigationStatus.DRAFT
    )
    category: Mapped[str] = mapped_column(String(100), nullable=False, default="general")
    location_id: Mapped[Optional[int]] = mapped_column(ForeignKey("locations.id", ondelete="SET NULL"), nullable=True)
    investigation_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    owner: Mapped[User] = relationship(back_populates="investigations")
    location: Mapped[Optional[Location]] = relationship(back_populates="investigations")
    observations: Mapped[list["Observation"]] = relationship(back_populates="investigation", cascade="save-update, merge")
    evidence: Mapped[list["Evidence"]] = relationship(back_populates="investigation", cascade="save-update, merge")
    timeline_entries: Mapped[list["TimelineEntry"]] = relationship(back_populates="investigation", cascade="save-update, merge")
    hypotheses: Mapped[list["Hypothesis"]] = relationship(back_populates="investigation", cascade="save-update, merge")
    actions: Mapped[list["ActionPlan"]] = relationship(back_populates="investigation", cascade="save-update, merge")

    __table_args__ = (
        Index("ix_investigations_owner_status_created", "owner_id", "status", "created_at"),
    )


class Observation(Base):
    __tablename__ = "observations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    investigation_id: Mapped[int] = mapped_column(ForeignKey("investigations.id", ondelete="CASCADE"), nullable=False, index=True)
    location_id: Mapped[Optional[int]] = mapped_column(ForeignKey("locations.id", ondelete="SET NULL"), nullable=True)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[ObservationSeverity] = mapped_column(SAEnum(ObservationSeverity), nullable=False, default=ObservationSeverity.MODERATE)
    source_type: Mapped[ObservationSourceType] = mapped_column(
        SAEnum(ObservationSourceType), nullable=False, default=ObservationSourceType.OBSERVED
    )
    confidence: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    investigation: Mapped[Investigation] = relationship(back_populates="observations")
    location: Mapped[Optional[Location]] = relationship(back_populates="observations")
    evidence: Mapped[list["Evidence"]] = relationship(back_populates="observation", cascade="save-update, merge")
    hypothesis_links: Mapped[list["HypothesisObservation"]] = relationship(back_populates="observation", cascade="save-update, merge")
    action_links: Mapped[list["ActionObservation"]] = relationship(back_populates="observation", cascade="save-update, merge")

    __table_args__ = (
        CheckConstraint("confidence BETWEEN 0 AND 100", name="ck_observations_confidence_range"),
    )


class Evidence(Base):
    __tablename__ = "evidence"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    investigation_id: Mapped[int] = mapped_column(ForeignKey("investigations.id", ondelete="CASCADE"), nullable=False, index=True)
    observation_id: Mapped[Optional[int]] = mapped_column(ForeignKey("observations.id", ondelete="SET NULL"), nullable=True, index=True)
    location_id: Mapped[Optional[int]] = mapped_column(ForeignKey("locations.id", ondelete="SET NULL"), nullable=True, index=True)
    evidence_type: Mapped[str] = mapped_column(String(100), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(120), nullable=False)
    storage_key: Mapped[str] = mapped_column(String(500), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    captured_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    source_type: Mapped[str] = mapped_column(String(50), nullable=False, default="user_upload")
    metadata_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    investigation: Mapped[Investigation] = relationship(back_populates="evidence")
    observation: Mapped[Optional[Observation]] = relationship(back_populates="evidence")
    location: Mapped[Optional[Location]] = relationship(back_populates="evidence")
    hypothesis_links: Mapped[list["HypothesisEvidence"]] = relationship(back_populates="evidence", cascade="save-update, merge")
    action_links: Mapped[list["ActionEvidence"]] = relationship(back_populates="evidence", cascade="save-update, merge")

    @property
    def parsed_metadata(self) -> dict:
        import json
        if not self.metadata_json:
            return {}
        try:
            return json.loads(self.metadata_json)
        except Exception:
            return {}

    @property
    def description(self) -> Optional[str]:
        return self.parsed_metadata.get("description")

    @property
    def original_filename(self) -> str:
        return self.parsed_metadata.get("original_filename") or self.file_name

    @property
    def verification_state(self) -> str:
        return self.parsed_metadata.get("verification_state", "needs_verification")


    __table_args__ = (
        CheckConstraint("file_size_bytes >= 0", name="ck_evidence_file_size_non_negative"),
    )


class TimelineEntry(Base):
    __tablename__ = "timeline_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    investigation_id: Mapped[int] = mapped_column(ForeignKey("investigations.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    event_timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    investigation: Mapped[Investigation] = relationship(back_populates="timeline_entries")


class EnvironmentalEvent(Base):
    __tablename__ = "environmental_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    location_id: Mapped[int] = mapped_column(ForeignKey("locations.id", ondelete="CASCADE"), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    source_type: Mapped[str] = mapped_column(String(50), nullable=False, default="user_reported")
    event_timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    location: Mapped[Location] = relationship(back_populates="environmental_events")

    __table_args__ = (
        CheckConstraint("confidence BETWEEN 0 AND 100", name="ck_environmental_events_confidence_range"),
    )


class HypothesisStatus(str, Enum):
    OPEN = "OPEN"
    UNDER_REVIEW = "UNDER_REVIEW"
    SUPPORTED = "SUPPORTED"
    WEAKENED = "WEAKENED"
    REJECTED = "REJECTED"
    UNRESOLVED = "UNRESOLVED"


class HypothesisConfidence(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class HypothesisRelationshipType(str, Enum):
    SUPPORTS = "SUPPORTS"
    CONTRADICTS = "CONTRADICTS"
    CONTEXT = "CONTEXT"


class RequirementPriority(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class RequirementStatus(str, Enum):
    OPEN = "OPEN"
    COLLECTED = "COLLECTED"
    NOT_AVAILABLE = "NOT_AVAILABLE"
    CANCELLED = "CANCELLED"


class Hypothesis(Base):
    __tablename__ = "hypotheses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    investigation_id: Mapped[int] = mapped_column(ForeignKey("investigations.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default=HypothesisStatus.OPEN.value, index=True)
    confidence: Mapped[str] = mapped_column(String(50), nullable=False, default=HypothesisConfidence.LOW.value)
    reasoning: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    investigation: Mapped[Investigation] = relationship(back_populates="hypotheses")
    creator: Mapped[User] = relationship(back_populates="hypotheses")
    evidence_links: Mapped[list["HypothesisEvidence"]] = relationship(back_populates="hypothesis", cascade="all, delete-orphan")
    observation_links: Mapped[list["HypothesisObservation"]] = relationship(back_populates="hypothesis", cascade="all, delete-orphan")
    missing_evidence: Mapped[list["MissingEvidence"]] = relationship(back_populates="hypothesis", cascade="all, delete-orphan")
    actions: Mapped[list["ActionPlan"]] = relationship(back_populates="hypothesis")

    __table_args__ = (
        Index("ix_hypotheses_investigation_created", "investigation_id", "created_at"),
    )


class HypothesisEvidence(Base):
    __tablename__ = "hypothesis_evidence"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    hypothesis_id: Mapped[int] = mapped_column(ForeignKey("hypotheses.id", ondelete="CASCADE"), nullable=False, index=True)
    evidence_id: Mapped[int] = mapped_column(ForeignKey("evidence.id", ondelete="CASCADE"), nullable=False, index=True)
    relationship_type: Mapped[str] = mapped_column(String(50), nullable=False)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    hypothesis: Mapped[Hypothesis] = relationship(back_populates="evidence_links")
    evidence: Mapped[Evidence] = relationship(back_populates="hypothesis_links")

    __table_args__ = (
        UniqueConstraint("hypothesis_id", "evidence_id", name="uq_hypothesis_evidence"),
    )


class HypothesisObservation(Base):
    __tablename__ = "hypothesis_observations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    hypothesis_id: Mapped[int] = mapped_column(ForeignKey("hypotheses.id", ondelete="CASCADE"), nullable=False, index=True)
    observation_id: Mapped[int] = mapped_column(ForeignKey("observations.id", ondelete="CASCADE"), nullable=False, index=True)
    relationship_type: Mapped[str] = mapped_column(String(50), nullable=False)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    hypothesis: Mapped[Hypothesis] = relationship(back_populates="observation_links")
    observation: Mapped[Observation] = relationship(back_populates="hypothesis_links")

    __table_args__ = (
        UniqueConstraint("hypothesis_id", "observation_id", name="uq_hypothesis_observation"),
    )


class MissingEvidence(Base):
    __tablename__ = "missing_evidence"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    hypothesis_id: Mapped[int] = mapped_column(ForeignKey("hypotheses.id", ondelete="CASCADE"), nullable=False, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    priority: Mapped[str] = mapped_column(String(50), nullable=False, default=RequirementPriority.MEDIUM.value)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default=RequirementStatus.OPEN.value)
    created_by: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    hypothesis: Mapped[Hypothesis] = relationship(back_populates="missing_evidence")


class ActionStatus(str, Enum):
    PLANNED = "PLANNED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    VERIFICATION_PENDING = "VERIFICATION_PENDING"
    VERIFIED = "VERIFIED"
    PARTIALLY_VERIFIED = "PARTIALLY_VERIFIED"
    NOT_VERIFIED = "NOT_VERIFIED"


class ActionPriority(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class MeasurementType(str, Enum):
    OBSERVATION = "OBSERVATION"
    NUMERIC = "NUMERIC"
    BOOLEAN = "BOOLEAN"
    TEXT = "TEXT"


class ComparisonOperator(str, Enum):
    LT = "LT"
    LTE = "LTE"
    EQ = "EQ"
    GTE = "GTE"
    GT = "GT"


class ActionRelationshipType(str, Enum):
    BEFORE_ACTION = "BEFORE_ACTION"
    DURING_ACTION = "DURING_ACTION"
    AFTER_ACTION = "AFTER_ACTION"
    VERIFICATION = "VERIFICATION"


class VerificationStatus(str, Enum):
    PENDING = "PENDING"
    VERIFIED = "VERIFIED"
    PARTIALLY_VERIFIED = "PARTIALLY_VERIFIED"
    NOT_VERIFIED = "NOT_VERIFIED"
    INCONCLUSIVE = "INCONCLUSIVE"


class CriterionResult(str, Enum):
    PASS = "PASS"
    FAIL = "FAIL"
    NOT_ASSESSED = "NOT_ASSESSED"
    INCONCLUSIVE = "INCONCLUSIVE"


class ActionPlan(Base):
    __tablename__ = "action_plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    investigation_id: Mapped[int] = mapped_column(ForeignKey("investigations.id", ondelete="CASCADE"), nullable=False, index=True)
    hypothesis_id: Mapped[Optional[int]] = mapped_column(ForeignKey("hypotheses.id", ondelete="SET NULL"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    rationale: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default=ActionStatus.PLANNED.value, index=True)
    priority: Mapped[str] = mapped_column(String(50), nullable=False, default=ActionPriority.MEDIUM.value)
    responsible_person: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    planned_start_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    target_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    investigation: Mapped[Investigation] = relationship(back_populates="actions")
    hypothesis: Mapped[Optional[Hypothesis]] = relationship(back_populates="actions")
    creator: Mapped[User] = relationship()
    criteria: Mapped[list["ActionCriterion"]] = relationship(back_populates="action", cascade="all, delete-orphan")
    evidence_links: Mapped[list["ActionEvidence"]] = relationship(back_populates="action", cascade="all, delete-orphan")
    observation_links: Mapped[list["ActionObservation"]] = relationship(back_populates="action", cascade="all, delete-orphan")
    verifications: Mapped[list["ActionVerification"]] = relationship(back_populates="action", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_action_plans_investigation_created", "investigation_id", "created_at"),
    )


class ActionCriterion(Base):
    __tablename__ = "action_criteria"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    action_id: Mapped[int] = mapped_column(ForeignKey("action_plans.id", ondelete="CASCADE"), nullable=False, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    measurement_type: Mapped[str] = mapped_column(String(50), nullable=False, default=MeasurementType.OBSERVATION.value)
    target_value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    target_unit: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    comparison_operator: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    action: Mapped[ActionPlan] = relationship(back_populates="criteria")


class ActionEvidence(Base):
    __tablename__ = "action_evidence"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    action_id: Mapped[int] = mapped_column(ForeignKey("action_plans.id", ondelete="CASCADE"), nullable=False, index=True)
    evidence_id: Mapped[int] = mapped_column(ForeignKey("evidence.id", ondelete="CASCADE"), nullable=False, index=True)
    relationship_type: Mapped[str] = mapped_column(String(50), nullable=False, default=ActionRelationshipType.BEFORE_ACTION.value)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    action: Mapped[ActionPlan] = relationship(back_populates="evidence_links")
    evidence: Mapped[Evidence] = relationship(back_populates="action_links")

    __table_args__ = (
        UniqueConstraint("action_id", "evidence_id", name="uq_action_evidence"),
    )


class ActionObservation(Base):
    __tablename__ = "action_observations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    action_id: Mapped[int] = mapped_column(ForeignKey("action_plans.id", ondelete="CASCADE"), nullable=False, index=True)
    observation_id: Mapped[int] = mapped_column(ForeignKey("observations.id", ondelete="CASCADE"), nullable=False, index=True)
    relationship_type: Mapped[str] = mapped_column(String(50), nullable=False, default=ActionRelationshipType.BEFORE_ACTION.value)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    action: Mapped[ActionPlan] = relationship(back_populates="observation_links")
    observation: Mapped[Observation] = relationship(back_populates="action_links")

    __table_args__ = (
        UniqueConstraint("action_id", "observation_id", name="uq_action_observation"),
    )


class ActionVerification(Base):
    __tablename__ = "action_verifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    action_id: Mapped[int] = mapped_column(ForeignKey("action_plans.id", ondelete="CASCADE"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default=VerificationStatus.PENDING.value)
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    verified_by: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    verified_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    uncertainty_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    action: Mapped[ActionPlan] = relationship(back_populates="verifications")
    verifier: Mapped[User] = relationship()
    criterion_results: Mapped[list["ActionVerificationResult"]] = relationship(back_populates="verification", cascade="all, delete-orphan")


class ActionVerificationResult(Base):
    __tablename__ = "action_verification_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    verification_id: Mapped[int] = mapped_column(ForeignKey("action_verifications.id", ondelete="CASCADE"), nullable=False, index=True)
    criterion_id: Mapped[int] = mapped_column(ForeignKey("action_criteria.id", ondelete="CASCADE"), nullable=False, index=True)
    result: Mapped[str] = mapped_column(String(50), nullable=False, default=CriterionResult.NOT_ASSESSED.value)
    observed_value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    observed_unit: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    evaluation_mode: Mapped[str] = mapped_column(String(50), nullable=False, default="investigator_recorded")

    verification: Mapped[ActionVerification] = relationship(back_populates="criterion_results")
    criterion: Mapped[ActionCriterion] = relationship()

    __table_args__ = (
        UniqueConstraint("verification_id", "criterion_id", name="uq_verification_criterion"),
    )
