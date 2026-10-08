from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.core import Investigation, Location, Observation, TimelineEntry, User
from app.schemas.investigation import (
    InvestigationCreate,
    InvestigationDetailRead,
    InvestigationRead,
    InvestigationUpdate,
    ObservationCreate,
    ObservationRead,
    ObservationUpdate,
    TimelineEntryRead,
    EvidenceRead,
)
from app.security import get_current_user

router = APIRouter(tags=["investigations"])


@router.post("", response_model=InvestigationRead, status_code=status.HTTP_201_CREATED)
async def create_investigation(
    payload: InvestigationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    location = None
    if payload.location_latitude is not None and payload.location_longitude is not None:
        point_wkt = f"SRID=4326;POINT({payload.location_longitude} {payload.location_latitude})"
        location = Location(
            latitude=payload.location_latitude,
            longitude=payload.location_longitude,
            location_type=payload.location_type,
            accuracy_meters=payload.location_accuracy_meters,
            geometry=point_wkt,
        )
        db.add(location)
        db.flush()

    now = datetime.now(timezone.utc)
    investigation = Investigation(
        title=payload.title,
        description=payload.description,
        status=payload.status,
        category=payload.category,
        investigation_date=payload.investigation_date or now,
        owner_id=current_user.id,
        location_id=location.id if location else None,
    )
    db.add(investigation)
    db.flush()

    # Initial Observation if provided
    initial_obs = None
    if payload.initial_observation and payload.initial_observation.strip():
        initial_obs = Observation(
            investigation_id=investigation.id,
            location_id=location.id if location else None,
            category=payload.category,
            description=payload.initial_observation.strip(),
            severity=payload.initial_severity or "moderate",
            source_type=payload.initial_source_type or "observed",
            confidence=80.0,
            observed_at=now,
        )
        db.add(initial_obs)

    # Initial Timeline Entry
    timeline = TimelineEntry(
        investigation_id=investigation.id,
        event_type="investigation_created",
        title="Investigation Created",
        description=f"Investigation '{investigation.title}' initialized by investigator.",
        event_timestamp=now,
    )
    db.add(timeline)

    db.commit()
    db.refresh(investigation)

    obs_count = 1 if initial_obs else 0
    read_obj = InvestigationRead.model_validate(investigation)
    read_obj.observations_count = obs_count
    return read_obj


@router.get("", response_model=List[InvestigationRead])
async def list_investigations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    investigations = (
        db.query(Investigation)
        .options(joinedload(Investigation.location), joinedload(Investigation.observations))
        .filter(Investigation.owner_id == current_user.id)
        .order_by(Investigation.created_at.desc())
        .all()
    )

    results: List[InvestigationRead] = []
    for inv in investigations:
        read_obj = InvestigationRead.model_validate(inv)
        read_obj.observations_count = len(inv.observations) if inv.observations else 0
        results.append(read_obj)

    return results


@router.get("/{investigation_id}", response_model=InvestigationDetailRead)
async def get_investigation(
    investigation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    investigation = (
        db.query(Investigation)
        .options(
            joinedload(Investigation.location),
            joinedload(Investigation.observations).joinedload(Observation.location),
            joinedload(Investigation.timeline_entries),
            joinedload(Investigation.evidence),
        )
        .filter(
            Investigation.id == investigation_id,
            Investigation.owner_id == current_user.id,
        )
        .first()
    )
    if not investigation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Investigation not found.",
        )

    read_detail = InvestigationDetailRead.model_validate(investigation)
    read_detail.observations_count = len(investigation.observations) if investigation.observations else 0
    # Sort observations descending by observed_at
    read_detail.observations.sort(key=lambda o: o.observed_at, reverse=True)
    # Sort timeline entries descending by event_timestamp
    read_detail.timeline_entries.sort(key=lambda t: t.event_timestamp, reverse=True)
    # Populate evidence and evidence linkages
    if investigation.evidence:
        read_detail.evidence = [EvidenceRead.model_validate(ev) for ev in investigation.evidence]
        read_detail.evidence.sort(key=lambda e: e.uploaded_at, reverse=True)
        obs_evidence_map = {}
        for ev in investigation.evidence:
            if ev.observation_id:
                obs_evidence_map.setdefault(ev.observation_id, []).append(ev.id)
        for obs in read_detail.observations:
            ev_ids = obs_evidence_map.get(obs.id, [])
            obs.evidence_count = len(ev_ids)
            obs.evidence_ids = ev_ids
    else:
        read_detail.evidence = []
    return read_detail


@router.patch("/{investigation_id}", response_model=InvestigationRead)
async def patch_investigation(
    investigation_id: int,
    payload: InvestigationUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    investigation = (
        db.query(Investigation)
        .options(joinedload(Investigation.location), joinedload(Investigation.observations))
        .filter(
            Investigation.id == investigation_id,
            Investigation.owner_id == current_user.id,
        )
        .first()
    )
    if not investigation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Investigation not found.",
        )

    now = datetime.now(timezone.utc)
    old_status = investigation.status
    for field, value in payload.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(investigation, field, value)

    if payload.status is not None and payload.status != old_status:
        db.add(
            TimelineEntry(
                investigation_id=investigation.id,
                event_type="status_changed",
                title=f"Status Updated to {payload.status.value.replace('_', ' ').title()}",
                description=f"Status changed from {old_status.value} to {payload.status.value}.",
                event_timestamp=now,
            )
        )

    investigation.updated_at = now
    db.commit()
    db.refresh(investigation)

    read_obj = InvestigationRead.model_validate(investigation)
    read_obj.observations_count = len(investigation.observations) if investigation.observations else 0
    return read_obj


# ==========================================
# OBSERVATIONS ENDPOINTS
# ==========================================


@router.post(
    "/{investigation_id}/observations",
    response_model=ObservationRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_observation(
    investigation_id: int,
    payload: ObservationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    investigation = (
        db.query(Investigation)
        .filter(
            Investigation.id == investigation_id,
            Investigation.owner_id == current_user.id,
        )
        .first()
    )
    if not investigation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Investigation not found.",
        )

    now = datetime.now(timezone.utc)
    location = None
    if payload.location_latitude is not None and payload.location_longitude is not None:
        point_wkt = f"SRID=4326;POINT({payload.location_longitude} {payload.location_latitude})"
        location = Location(
            latitude=payload.location_latitude,
            longitude=payload.location_longitude,
            location_type=payload.location_type,
            accuracy_meters=payload.location_accuracy_meters,
            geometry=point_wkt,
        )
        db.add(location)
        db.flush()

    observation = Observation(
        investigation_id=investigation.id,
        location_id=location.id if location else investigation.location_id,
        category=payload.category,
        description=payload.description,
        severity=payload.severity,
        source_type=payload.source_type,
        confidence=payload.confidence,
        observed_at=payload.observed_at or now,
    )
    db.add(observation)
    db.flush()

    # Timeline entry
    timeline = TimelineEntry(
        investigation_id=investigation.id,
        event_type="observation_added",
        title="Observation Recorded",
        description=f"Recorded {observation.severity.value} observation: {observation.description[:80]}",
        event_timestamp=now,
    )
    db.add(timeline)

    db.commit()
    db.refresh(observation)
    return observation


@router.get(
    "/{investigation_id}/observations",
    response_model=List[ObservationRead],
)
async def list_observations(
    investigation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    investigation = (
        db.query(Investigation)
        .filter(
            Investigation.id == investigation_id,
            Investigation.owner_id == current_user.id,
        )
        .first()
    )
    if not investigation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Investigation not found.",
        )

    observations = (
        db.query(Observation)
        .options(joinedload(Observation.location))
        .filter(Observation.investigation_id == investigation_id)
        .order_by(Observation.observed_at.desc())
        .all()
    )
    return observations


@router.get(
    "/{investigation_id}/timeline",
    response_model=List[TimelineEntryRead],
)
async def get_investigation_timeline(
    investigation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    investigation = (
        db.query(Investigation)
        .filter(
            Investigation.id == investigation_id,
            Investigation.owner_id == current_user.id,
        )
        .first()
    )
    if not investigation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Investigation not found.",
        )

    timeline_entries = (
        db.query(TimelineEntry)
        .filter(TimelineEntry.investigation_id == investigation_id)
        .order_by(TimelineEntry.event_timestamp.desc())
        .all()
    )
    return timeline_entries


@router.patch(
    "/{investigation_id}/observations/{observation_id}",
    response_model=ObservationRead,
)
async def update_observation(
    investigation_id: int,
    observation_id: int,
    payload: ObservationUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    investigation = (
        db.query(Investigation)
        .filter(
            Investigation.id == investigation_id,
            Investigation.owner_id == current_user.id,
        )
        .first()
    )
    if not investigation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Investigation not found.",
        )

    observation = (
        db.query(Observation)
        .options(joinedload(Observation.location))
        .filter(
            Observation.id == observation_id,
            Observation.investigation_id == investigation_id,
        )
        .first()
    )
    if not observation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Observation not found.",
        )

    now = datetime.now(timezone.utc)
    for field, value in payload.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(observation, field, value)

    observation.updated_at = now

    timeline = TimelineEntry(
        investigation_id=investigation.id,
        event_type="observation_updated",
        title="Observation Updated",
        description=f"Observation in '{observation.category}' updated.",
        event_timestamp=now,
    )
    db.add(timeline)

    db.commit()
    db.refresh(observation)
    return observation


@router.delete(
    "/{investigation_id}/observations/{observation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_observation(
    investigation_id: int,
    observation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    investigation = (
        db.query(Investigation)
        .filter(
            Investigation.id == investigation_id,
            Investigation.owner_id == current_user.id,
        )
        .first()
    )
    if not investigation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Investigation not found.",
        )

    observation = (
        db.query(Observation)
        .filter(
            Observation.id == observation_id,
            Observation.investigation_id == investigation_id,
        )
        .first()
    )
    if not observation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Observation not found.",
        )

    category = observation.category
    db.delete(observation)

    now = datetime.now(timezone.utc)
    timeline = TimelineEntry(
        investigation_id=investigation.id,
        event_type="observation_deleted",
        title="Observation Deleted",
        description=f"Observation in category '{category}' was removed.",
        event_timestamp=now,
    )
    db.add(timeline)

    db.commit()
    return None
