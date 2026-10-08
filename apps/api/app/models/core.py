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
