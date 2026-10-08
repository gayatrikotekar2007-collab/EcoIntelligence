from datetime import datetime, timezone
import json
from pathlib import Path
from typing import List, Optional
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse, Response
from sqlalchemy.orm import Session, joinedload

from app.config import get_settings
from app.database import get_db
from app.models.core import (
    Evidence,
    EvidenceSourceType,
    Investigation,
    Location,
    Observation,
    ObservationSeverity,
    TimelineEntry,
    User,
    VerificationState,
)
from app.schemas.image_analysis import (
    AdjacentComparison,
    CompareEvidenceRequest,
    EvidenceLocationRead,
    ImageAnalysisResult,
    TemporalSequenceItem,
    TemporalSequenceRequest,
    TemporalSequenceResponse,
)
from app.schemas.investigation import (
    EvidenceGap,
    EvidenceGapsResponse,
    EvidenceRead,
    EvidenceUpdate,
)
from app.security import get_current_user
from app.services.image_analysis import (
    ImageAnalysisService,
    get_image_analysis_service,
)
from app.storage import get_storage
from app.utils.file_validation import (
    extract_image_dimensions,
    validate_file_content,
)
from app.utils.geo_temporal import (
    calculate_bearing,
    calculate_haversine_distance,
    classify_spatial_consistency,
    resolve_evidence_location,
)

settings = get_settings()
storage = get_storage()

router = APIRouter(tags=["evidence"])


def to_evidence_read(ev: Evidence, investigation: Optional[Investigation] = None) -> EvidenceRead:
    meta = ev.parsed_metadata
    obs_desc = None
    if ev.observation:
        obs_desc = ev.observation.description[:80]

    loc_info = resolve_evidence_location(ev, investigation or ev.investigation)

    return EvidenceRead(
        id=ev.id,
        investigation_id=ev.investigation_id,
        observation_id=ev.observation_id,
        evidence_type=ev.evidence_type,
        file_name=ev.file_name,
        original_filename=ev.original_filename,
        mime_type=ev.mime_type,
        storage_key=ev.storage_key,
        file_size_bytes=ev.file_size_bytes,
        captured_at=ev.captured_at,
        uploaded_at=ev.uploaded_at,
        source_type=ev.source_type,
        description=ev.description,
        verification_state=ev.verification_state,
        metadata=meta,
        observation_description=obs_desc,
        location_id=ev.location_id,
        latitude=loc_info["latitude"],
        longitude=loc_info["longitude"],
        location_accuracy=loc_info["location_accuracy"],
        location_source=loc_info["location_source"],
    )


@router.post(
    "/investigations/{investigation_id}/evidence",
    response_model=EvidenceRead,
    status_code=status.HTTP_201_CREATED,
)
async def upload_evidence(
    investigation_id: int,
    file: UploadFile = File(...),
    source_type: str = Form("observed"),
    description: Optional[str] = Form(None),
    observation_id: Optional[int] = Form(None),
    captured_at: Optional[datetime] = Form(None),
    verification_state: str = Form("needs_verification"),
    location_latitude: Optional[float] = Form(None),
    location_longitude: Optional[float] = Form(None),
    location_accuracy: Optional[float] = Form(None),
    location_accuracy_meters: Optional[float] = Form(None),
    location_source: Optional[str] = Form(None),
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

    normalized_source = source_type.lower().strip()
    valid_sources = {s.value for s in EvidenceSourceType}
    if normalized_source not in valid_sources:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid source type '{source_type}'. Allowed: {sorted(valid_sources)}",
        )

    normalized_verification = verification_state.lower().strip()
    valid_verification = {v.value for v in VerificationState}
    if normalized_verification not in valid_verification:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid verification state '{verification_state}'. Allowed: {sorted(valid_verification)}",
        )

    if observation_id is not None:
        obs = (
            db.query(Observation)
            .filter(
                Observation.id == observation_id,
                Observation.investigation_id == investigation_id,
            )
            .first()
        )
        if not obs:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Observation #{observation_id} does not belong to this investigation.",
            )

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Uploaded file is empty (0 bytes).",
        )

    if len(content) > settings.max_upload_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum allowed size of {settings.max_upload_size_bytes // (1024 * 1024)} MB.",
        )

    try:
        sanitized_name, detected_mime, evidence_type = validate_file_content(
            content=content,
            filename=file.filename or "evidence",
            declared_mime=file.content_type,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )

    ext = Path(sanitized_name).suffix.lower()
    unique_filename = f"{uuid.uuid4().hex}{ext}"
    storage_key = f"evidence/{investigation_id}/{unique_filename}"

    storage.save_file(content, storage_key)

    dims = extract_image_dimensions(content, detected_mime) if evidence_type == "image" else {}
    metadata_dict = {
        "original_filename": file.filename or sanitized_name,
        "description": description.strip() if description else None,
        "verification_state": normalized_verification,
        **dims,
    }

    evidence_location_id: Optional[int] = None
    if location_latitude is not None and location_longitude is not None:
        acc = location_accuracy if location_accuracy is not None else location_accuracy_meters
        norm_loc_src = "GPS" if str(location_source).upper() in ("GPS", "EVIDENCE_GPS") else (location_source or "USER_SUPPLIED")
        point_wkt = f"SRID=4326;POINT({location_longitude} {location_latitude})"
        loc = Location(
            latitude=location_latitude,
            longitude=location_longitude,
            geometry=point_wkt,
            accuracy_meters=acc,
            location_type=norm_loc_src.lower(),
        )
        db.add(loc)
        db.flush()
        evidence_location_id = loc.id
        metadata_dict["location"] = {
            "latitude": location_latitude,
            "longitude": location_longitude,
            "accuracy_meters": acc,
            "source": norm_loc_src,
        }

    now = datetime.now(timezone.utc)
    evidence = Evidence(
        investigation_id=investigation_id,
        observation_id=observation_id,
        location_id=evidence_location_id,
        evidence_type=evidence_type,
        file_name=sanitized_name,
        mime_type=detected_mime,
        storage_key=storage_key,
        file_size_bytes=len(content),
        captured_at=captured_at,
        uploaded_at=now,
        source_type=normalized_source,
        metadata_json=json.dumps(metadata_dict),
    )
    db.add(evidence)
    db.flush()

    timeline_desc = f"Attached {evidence_type} '{sanitized_name}' ({normalized_source})."
    if description:
        timeline_desc += f" Note: {description[:60]}"
    timeline = TimelineEntry(
        investigation_id=investigation_id,
        event_type="evidence_added",
        title="Evidence Attached",
        description=timeline_desc,
        event_timestamp=now,
    )
    db.add(timeline)

    db.commit()
    db.refresh(evidence)
    return to_evidence_read(evidence, investigation)


@router.get(
    "/investigations/{investigation_id}/evidence",
    response_model=List[EvidenceRead],
)
async def list_investigation_evidence(
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

    evidence_items = (
        db.query(Evidence)
        .options(joinedload(Evidence.observation))
        .filter(Evidence.investigation_id == investigation_id)
        .order_by(Evidence.uploaded_at.desc())
        .all()
    )
    return [to_evidence_read(ev) for ev in evidence_items]


@router.get(
    "/evidence/{evidence_id}",
    response_model=EvidenceRead,
)
async def get_evidence(
    evidence_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    evidence = (
        db.query(Evidence)
        .options(joinedload(Evidence.investigation), joinedload(Evidence.observation))
        .filter(Evidence.id == evidence_id)
        .first()
    )
    if not evidence:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evidence not found.",
        )

    if evidence.investigation.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this evidence.",
        )

    return to_evidence_read(evidence)


@router.get("/evidence/{evidence_id}/file")
@router.get("/evidence/{evidence_id}/download")
async def download_evidence_file(
    evidence_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    evidence = (
        db.query(Evidence)
        .options(joinedload(Evidence.investigation))
        .filter(Evidence.id == evidence_id)
        .first()
    )
    if not evidence:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evidence not found.",
        )

    if evidence.investigation.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view or download this file.",
        )

    file_path = storage.get_file_path(evidence.storage_key)
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Stored file was not found on disk.",
        )

    return FileResponse(
        path=file_path,
        media_type=evidence.mime_type,
        filename=evidence.original_filename,
    )


@router.patch(
    "/evidence/{evidence_id}",
    response_model=EvidenceRead,
)
async def update_evidence(
    evidence_id: int,
    payload: EvidenceUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    evidence = (
        db.query(Evidence)
        .options(joinedload(Evidence.investigation), joinedload(Evidence.observation))
        .filter(Evidence.id == evidence_id)
        .first()
    )
    if not evidence:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evidence not found.",
        )

    if evidence.investigation.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to modify this evidence.",
        )

    meta = evidence.parsed_metadata

    if payload.description is not None:
        meta["description"] = payload.description.strip() if payload.description else None

    if payload.verification_state is not None:
        v_state = payload.verification_state.lower().strip()
        valid_v = {v.value for v in VerificationState}
        if v_state not in valid_v:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid verification state '{payload.verification_state}'. Allowed: {sorted(valid_v)}",
            )
        meta["verification_state"] = v_state

    if payload.source_type is not None:
        s_type = payload.source_type.lower().strip()
        valid_s = {s.value for s in EvidenceSourceType}
        if s_type not in valid_s:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid source type '{payload.source_type}'. Allowed: {sorted(valid_s)}",
            )
        evidence.source_type = s_type

    if payload.observation_id is not None:
        if payload.observation_id > 0:
            obs = (
                db.query(Observation)
                .filter(
                    Observation.id == payload.observation_id,
                    Observation.investigation_id == evidence.investigation_id,
                )
                .first()
            )
            if not obs:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Observation #{payload.observation_id} does not belong to this investigation.",
                )
            evidence.observation_id = payload.observation_id
        else:
            evidence.observation_id = None
    elif "observation_id" in payload.model_dump(exclude_unset=True) and payload.observation_id is None:
        evidence.observation_id = None

    if payload.captured_at is not None:
        evidence.captured_at = payload.captured_at

    if payload.location_latitude is not None and payload.location_longitude is not None:
        acc = payload.location_accuracy_meters
        norm_src = "GPS" if payload.location_source and str(payload.location_source).upper() in ("GPS", "EVIDENCE_GPS") else (payload.location_source or "USER_SUPPLIED")
        point_wkt = f"SRID=4326;POINT({payload.location_longitude} {payload.location_latitude})"
        if evidence.location_id:
            loc = db.query(Location).filter(Location.id == evidence.location_id).first()
            if loc:
                loc.latitude = payload.location_latitude
                loc.longitude = payload.location_longitude
                loc.accuracy_meters = acc
                loc.location_type = norm_src.lower()
                loc.geometry = point_wkt
        else:
            loc = Location(
                latitude=payload.location_latitude,
                longitude=payload.location_longitude,
                geometry=point_wkt,
                accuracy_meters=acc,
                location_type=norm_src.lower(),
            )
            db.add(loc)
            db.flush()
            evidence.location_id = loc.id

        meta["location"] = {
            "latitude": payload.location_latitude,
            "longitude": payload.location_longitude,
            "accuracy_meters": acc,
            "source": norm_src,
        }

    evidence.metadata_json = json.dumps(meta)

    now = datetime.now(timezone.utc)
    timeline = TimelineEntry(
        investigation_id=evidence.investigation_id,
        event_type="evidence_updated",
        title="Evidence Updated",
        description=f"Evidence '{evidence.file_name}' metadata was updated.",
        event_timestamp=now,
    )
    db.add(timeline)

    db.commit()
    db.refresh(evidence)
    return to_evidence_read(evidence)


@router.delete(
    "/evidence/{evidence_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_evidence(
    evidence_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    evidence = (
        db.query(Evidence)
        .options(joinedload(Evidence.investigation))
        .filter(Evidence.id == evidence_id)
        .first()
    )
    if not evidence:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evidence not found.",
        )

    if evidence.investigation.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete this evidence.",
        )

    file_name = evidence.file_name
    investigation_id = evidence.investigation_id
    storage_key = evidence.storage_key

    db.delete(evidence)

    now = datetime.now(timezone.utc)
    timeline = TimelineEntry(
        investigation_id=investigation_id,
        event_type="evidence_deleted",
        title="Evidence Removed",
        description=f"Evidence '{file_name}' was removed from the investigation.",
        event_timestamp=now,
    )
    db.add(timeline)

    db.commit()
    storage.delete_file(storage_key)
    return None


@router.get(
    "/investigations/{investigation_id}/evidence-gaps",
    response_model=EvidenceGapsResponse,
)
async def get_evidence_gaps(
    investigation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    investigation = (
        db.query(Investigation)
        .options(
            joinedload(Investigation.location),
            joinedload(Investigation.observations).joinedload(Observation.location),
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

    gaps: List[EvidenceGap] = []
    now = datetime.now(timezone.utc)

    # Rule 1: No geographic coordinates
    has_coords = (
        investigation.location is not None
        and investigation.location.latitude is not None
        and investigation.location.longitude is not None
    )
    if not has_coords:
        gaps.append(
            EvidenceGap(
                gap_type="missing_coordinates",
                title="No Geographic Coordinates Attached",
                description="The investigation lacks anchored spatial coordinates, preventing PostGIS GIS mapping and geospatial verification.",
                severity="medium",
                target_type="investigation",
                target_id=investigation.id,
                recommendation="Attach GPS coordinates or pinpoint a location on the GIS map.",
            )
        )

    # Rule 2: Zero evidence artifacts attached
    evidence_list = investigation.evidence or []
    if len(evidence_list) == 0:
        gaps.append(
            EvidenceGap(
                gap_type="no_evidence",
                title="Zero Evidence Artifacts Attached",
                description="This investigation has no primary source material (photographs, documents, or sensor recordings) attached to substantiate findings.",
                severity="high",
                target_type="investigation",
                target_id=investigation.id,
                recommendation="Upload photographic or documentary evidence to substantiate observed environmental conditions.",
            )
        )

    # Rule 3: Observation without attached evidence
    observations_list = investigation.observations or []
    for obs in observations_list:
        linked_evs = [ev for ev in evidence_list if ev.observation_id == obs.id]
        if len(linked_evs) == 0:
            is_critical = obs.severity in (
                ObservationSeverity.HIGH,
                ObservationSeverity.CRITICAL,
            )
            gaps.append(
                EvidenceGap(
                    gap_type="unsupported_observation",
                    title=f"Observation #{obs.id} Lacks Supporting Evidence",
                    description=f"Observation '{obs.category}' ({obs.severity.value} severity) does not have any attached evidence artifacts.",
                    severity="high" if is_critical else "medium",
                    target_type="observation",
                    target_id=obs.id,
                    recommendation=f"Attach field photographs or documents directly supporting Observation #{obs.id}.",
                )
            )

    # Rule 4: Outdated evidence (stale > 30 days)
    if len(evidence_list) > 0:
        # Determine latest evidence date
        newest_ev = max(
            evidence_list,
            key=lambda e: e.captured_at or e.uploaded_at or datetime.min.replace(tzinfo=timezone.utc),
        )
        newest_date = newest_ev.captured_at or newest_ev.uploaded_at
        if newest_date:
            # ensure newest_date has timezone
            if newest_date.tzinfo is None:
                newest_date = newest_date.replace(tzinfo=timezone.utc)
            delta_days = (now - newest_date).days
            if delta_days > 30:
                gaps.append(
                    EvidenceGap(
                        gap_type="outdated_evidence",
                        title="Evidence Is Over 30 Days Old",
                        description=f"Latest evidence artifact '{newest_ev.file_name}' was recorded {delta_days} days ago. Environmental conditions may have evolved.",
                        severity="low",
                        target_type="investigation",
                        target_id=investigation.id,
                        recommendation="Capture fresh follow-up field observations or imagery to verify ongoing conditions.",
                    )
                )

    # Rule 5: High/Critical severity observation lacks verified evidence
    for obs in observations_list:
        if obs.severity in (ObservationSeverity.HIGH, ObservationSeverity.CRITICAL):
            linked_evs = [ev for ev in evidence_list if ev.observation_id == obs.id]
            if linked_evs and not any(ev.verification_state == "verified" for ev in linked_evs):
                gaps.append(
                    EvidenceGap(
                        gap_type="unverified_high_severity",
                        title=f"High Severity Observation #{obs.id} Needs Verified Evidence",
                        description=f"Observation #{obs.id} is flagged with '{obs.severity.value}' severity, but attached evidence has not yet been verified.",
                        severity="high",
                        target_type="observation",
                        target_id=obs.id,
                        recommendation="Perform independent field cross-check or acquire laboratory confirmation for this observation.",
                    )
                )

    # Rule 6: Missing objective physical measurement / photograph
    if len(evidence_list) > 0:
        all_user_reported = all(
            ev.source_type == EvidenceSourceType.USER_REPORTED.value for ev in evidence_list
        )
        has_image = any(ev.evidence_type == "image" for ev in evidence_list)
        if all_user_reported and not has_image:
            gaps.append(
                EvidenceGap(
                    gap_type="missing_physical_evidence",
                    title="All Evidence Is User Reported",
                    description="Current evidence consists exclusively of unverified witness reports without direct photographic or documented sensor confirmation.",
                    severity="medium",
                    target_type="investigation",
                    target_id=investigation.id,
                    recommendation="Obtain direct photographic evidence or official sensor data to substantiate eyewitness accounts.",
                )
            )

    return EvidenceGapsResponse(
        investigation_id=investigation_id,
        total_gaps=len(gaps),
        gaps=gaps,
    )


@router.post(
    "/investigations/{investigation_id}/evidence/compare",
    response_model=ImageAnalysisResult,
)
async def compare_evidence(
    investigation_id: int,
    request: CompareEvidenceRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    service: ImageAnalysisService = Depends(get_image_analysis_service),
):
    investigation = (
        db.query(Investigation)
        .filter(Investigation.id == investigation_id)
        .first()
    )
    if not investigation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Investigation not found.",
        )

    if investigation.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this investigation.",
        )

    if request.before_evidence_id == request.after_evidence_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot compare an evidence artifact with itself. Provide two distinct evidence records.",
        )

    before_ev = (
        db.query(Evidence)
        .filter(
            Evidence.id == request.before_evidence_id,
            Evidence.investigation_id == investigation_id,
        )
        .first()
    )
    if not before_ev:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Evidence #{request.before_evidence_id} not found in this investigation.",
        )

    after_ev = (
        db.query(Evidence)
        .filter(
            Evidence.id == request.after_evidence_id,
            Evidence.investigation_id == investigation_id,
        )
        .first()
    )
    if not after_ev:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Evidence #{request.after_evidence_id} not found in this investigation.",
        )

    if before_ev.evidence_type != "image" or after_ev.evidence_type != "image":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Both evidence records must be images to perform visual change analysis.",
        )

    before_path = storage.get_file_path(before_ev.storage_key)
    after_path = storage.get_file_path(after_ev.storage_key)

    if not before_path.exists() or not after_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evidence file content not found in storage.",
        )

    before_bytes = before_path.read_bytes()
    after_bytes = after_path.read_bytes()

    try:
        result = service.compare_images(
            investigation_id=investigation_id,
            before_id=before_ev.id,
            before_bytes=before_bytes,
            after_id=after_ev.id,
            after_bytes=after_bytes,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Image analysis failed: {str(e)}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error during image analysis: {str(e)}",
        )

    # Persist analysis metadata in after_ev metadata_json
    meta = after_ev.parsed_metadata
    meta["visual_comparison"] = {
        "compared_to_evidence_id": before_ev.id,
        "similarity": result.similarity,
        "changed_pixel_percentage": result.changed_pixel_percentage,
        "alignment_status": result.alignment_status,
        "analyzed_at": result.analyzed_at.isoformat(),
        "difference_region": result.difference_region.model_dump() if result.difference_region else None,
        "analysis_dimensions": result.analysis_dimensions.model_dump() if result.analysis_dimensions else None,
        "warnings": result.warnings,
        "limitations": result.limitations,
    }
    after_ev.metadata_json = json.dumps(meta)

    # Persist a timeline event for auditability and reproduction
    timeline = TimelineEntry(
        investigation_id=investigation_id,
        event_type="evidence_compared",
        title="Visual Change Analysis",
        description=f"Deterministic image comparison executed between Evidence #{before_ev.id} and #{after_ev.id}. Detected pixel change: {result.changed_pixel_percentage}%. Alignment: {result.alignment_status}.",
        event_timestamp=result.analyzed_at,
    )
    db.add(timeline)
    db.commit()

    return result


@router.get(
    "/investigations/{investigation_id}/evidence/compare/difference-map",
)
async def get_difference_map(
    investigation_id: int,
    before_evidence_id: int,
    after_evidence_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    service: ImageAnalysisService = Depends(get_image_analysis_service),
):
    investigation = (
        db.query(Investigation)
        .filter(Investigation.id == investigation_id)
        .first()
    )
    if not investigation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Investigation not found.",
        )

    if investigation.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this investigation.",
        )

    if before_evidence_id == after_evidence_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot generate difference map for an evidence artifact with itself. Provide two distinct evidence records.",
        )

    before_ev = (
        db.query(Evidence)
        .filter(
            Evidence.id == before_evidence_id,
            Evidence.investigation_id == investigation_id,
        )
        .first()
    )
    if not before_ev:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Evidence #{before_evidence_id} not found in this investigation.",
        )

    after_ev = (
        db.query(Evidence)
        .filter(
            Evidence.id == after_evidence_id,
            Evidence.investigation_id == investigation_id,
        )
        .first()
    )
    if not after_ev:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Evidence #{after_evidence_id} not found in this investigation.",
        )

    if before_ev.evidence_type != "image" or after_ev.evidence_type != "image":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Both evidence records must be images to generate a visual difference map.",
        )

    before_path = storage.get_file_path(before_ev.storage_key)
    after_path = storage.get_file_path(after_ev.storage_key)

    if not before_path.exists() or not after_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evidence file content not found in storage.",
        )

    before_bytes = before_path.read_bytes()
    after_bytes = after_path.read_bytes()

    try:
        heatmap_bytes = service.generate_difference_heatmap(
            before_bytes=before_bytes,
            after_bytes=after_bytes,
            before_id=before_ev.id,
            after_id=after_ev.id,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Visual difference heatmap generation failed: {str(e)}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error during heatmap generation: {str(e)}",
        )

    return Response(
        content=heatmap_bytes,
        media_type="image/png",
        headers={
            "Content-Disposition": f'inline; filename="diff_{before_ev.id}_{after_ev.id}.png"',
            "Cache-Control": "private, no-cache",
        },
    )


@router.post(
    "/investigations/{investigation_id}/evidence/temporal-sequence",
    response_model=TemporalSequenceResponse,
)
async def analyze_temporal_sequence(
    investigation_id: int,
    payload: TemporalSequenceRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    service: ImageAnalysisService = Depends(get_image_analysis_service),
):
    investigation = (
        db.query(Investigation)
        .options(joinedload(Investigation.location))
        .filter(Investigation.id == investigation_id)
        .first()
    )
    if not investigation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Investigation not found.",
        )

    if investigation.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this investigation.",
        )

    if not payload.evidence_ids or len(payload.evidence_ids) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Multi-temporal evidence sequence requires a minimum of 3 evidence artifacts.",
        )

    if len(set(payload.evidence_ids)) != len(payload.evidence_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Duplicate evidence IDs detected. All artifacts in a temporal sequence must be distinct.",
        )

    evidence_records = (
        db.query(Evidence)
        .options(
            joinedload(Evidence.location),
            joinedload(Evidence.observation).joinedload(Observation.location),
        )
        .filter(
            Evidence.id.in_(payload.evidence_ids),
            Evidence.investigation_id == investigation_id,
        )
        .all()
    )

    if len(evidence_records) != len(payload.evidence_ids):
        found_ids = {ev.id for ev in evidence_records}
        missing = [eid for eid in payload.evidence_ids if eid not in found_ids]
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Evidence artifact(s) {missing} not found in this investigation.",
        )

    for ev in evidence_records:
        if ev.evidence_type != "image":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Evidence #{ev.id} ('{ev.file_name}') is not an image ({ev.evidence_type}). All artifacts in temporal sequence must be images.",
            )

    # Sort evidence chronologically using captured_at when available, otherwise uploaded_at
    def sort_key(ev: Evidence):
        dt = ev.captured_at or ev.uploaded_at or datetime.min.replace(tzinfo=timezone.utc)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return (dt, ev.id)

    ordered_evidence = sorted(evidence_records, key=sort_key)
    sequence_id = uuid.uuid4().hex[:12]
    now = datetime.now(timezone.utc)

    # Build sequence items with assigned roles and explicit geospatial metadata
    sequence_items: List[TemporalSequenceItem] = []
    total_items = len(ordered_evidence)
    for idx, ev in enumerate(ordered_evidence):
        if idx == 0:
            role = "BASELINE"
        elif idx == total_items - 1:
            role = "CURRENT"
        else:
            role = "INTERMEDIATE"

        loc_info = resolve_evidence_location(ev, investigation)

        sequence_items.append(
            TemporalSequenceItem(
                evidence_id=ev.id,
                sequence_index=idx,
                captured_at=ev.captured_at,
                uploaded_at=ev.uploaded_at,
                original_filename=ev.original_filename,
                role=role,
                latitude=loc_info["latitude"],
                longitude=loc_info["longitude"],
                location_source=loc_info["location_source"],
                location_accuracy=loc_info["location_accuracy"],
            )
        )

    # Compute adjacent comparisons: sequence[0] -> sequence[1], sequence[1] -> sequence[2], ...
    comparisons: List[AdjacentComparison] = []
    for i in range(total_items - 1):
        before_ev = ordered_evidence[i]
        after_ev = ordered_evidence[i + 1]
        before_item = sequence_items[i]
        after_item = sequence_items[i + 1]

        before_path = storage.get_file_path(before_ev.storage_key)
        after_path = storage.get_file_path(after_ev.storage_key)

        if not before_path.exists() or not after_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Stored file for evidence #{before_ev.id} or #{after_ev.id} not found on disk.",
            )

        before_bytes = before_path.read_bytes()
        after_bytes = after_path.read_bytes()

        try:
            pair_result = service.compare_images(
                investigation_id=investigation_id,
                before_id=before_ev.id,
                before_bytes=before_bytes,
                after_id=after_ev.id,
                after_bytes=after_bytes,
            )
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Temporal comparison between #{before_ev.id} and #{after_ev.id} failed: {str(e)}",
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Unexpected error during temporal comparison: {str(e)}",
            )

        # Geospatial distance and bearing calculation
        if (
            before_item.latitude is not None
            and before_item.longitude is not None
            and after_item.latitude is not None
            and after_item.longitude is not None
        ):
            dist_m = calculate_haversine_distance(
                before_item.latitude,
                before_item.longitude,
                after_item.latitude,
                after_item.longitude,
            )
            bearing_deg = calculate_bearing(
                before_item.latitude,
                before_item.longitude,
                after_item.latitude,
                after_item.longitude,
            )
        else:
            dist_m = None
            bearing_deg = None

        consistency, consistency_msg = classify_spatial_consistency(
            dist_m,
            before_item.location_accuracy,
            after_item.location_accuracy,
            before_item.location_source,
            after_item.location_source,
        )

        pair_warnings = list(pair_result.warnings)
        if consistency == "DISTANT":
            pair_warnings.append(
                "Spatial consistency: LOW. These captures were taken at substantially different locations. Visual differences should not be interpreted as temporal change at the same site."
            )
        elif consistency == "UNKNOWN":
            pair_warnings.append(
                "Spatial consistency: UNKNOWN. Location data is insufficient to determine whether the captures represent the same physical site."
            )

        comparisons.append(
            AdjacentComparison(
                before_evidence_id=before_ev.id,
                after_evidence_id=after_ev.id,
                before_captured_at=before_ev.captured_at or before_ev.uploaded_at,
                after_captured_at=after_ev.captured_at or after_ev.uploaded_at,
                similarity=pair_result.similarity,
                changed_pixel_percentage=pair_result.changed_pixel_percentage,
                alignment_status=pair_result.alignment_status,
                difference_region=pair_result.difference_region,
                distance_meters=dist_m,
                bearing_degrees=bearing_deg,
                accuracy_before_meters=before_item.location_accuracy,
                accuracy_after_meters=after_item.location_accuracy,
                spatial_consistency=consistency,
                spatial_consistency_message=consistency_msg,
                warnings=pair_warnings,
                limitations=pair_result.limitations,
            )
        )

    # Persist temporal analysis metadata in each participating evidence artifact
    for idx, ev in enumerate(ordered_evidence):
        meta = ev.parsed_metadata
        seq_item = sequence_items[idx]
        meta["temporal_analysis"] = {
            "sequence_id": sequence_id,
            "sequence_index": idx,
            "role": seq_item.role,
            "total_in_sequence": total_items,
            "analyzed_at": now.isoformat(),
            "location_source": seq_item.location_source,
            "latitude": seq_item.latitude,
            "longitude": seq_item.longitude,
            "location_accuracy": seq_item.location_accuracy,
        }
        ev.metadata_json = json.dumps(meta)

    # Persist timeline entry
    seq_str = " \u2192 ".join(f"#{e.id}" for e in ordered_evidence)
    valid_distances = [c.distance_meters for c in comparisons if c.distance_meters is not None]
    geo_summary = f" Total trajectory span: {sum(valid_distances):.1f} m." if valid_distances else ""
    timeline = TimelineEntry(
        investigation_id=investigation_id,
        event_type="temporal_sequence_analyzed",
        title="Multi-Temporal Visual Sequence",
        description=f"Multi-temporal visual sequence analyzed across {total_items} evidence artifacts ({seq_str}). Baseline #{ordered_evidence[0].id} to Current #{ordered_evidence[-1].id}.{geo_summary}",
        event_timestamp=now,
    )
    db.add(timeline)
    db.commit()

    return TemporalSequenceResponse(
        status="ANALYZED",
        investigation_id=investigation_id,
        sequence_id=sequence_id,
        sequence=sequence_items,
        comparisons=comparisons,
    )


@router.get(
    "/investigations/{investigation_id}/evidence/{evidence_id}/location",
    response_model=EvidenceLocationRead,
)
async def get_evidence_location(
    investigation_id: int,
    evidence_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    investigation = (
        db.query(Investigation)
        .options(joinedload(Investigation.location))
        .filter(Investigation.id == investigation_id)
        .first()
    )
    if not investigation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Investigation not found.",
        )

    if investigation.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this investigation.",
        )

    evidence = (
        db.query(Evidence)
        .options(
            joinedload(Evidence.location),
            joinedload(Evidence.observation).joinedload(Observation.location),
        )
        .filter(
            Evidence.id == evidence_id,
            Evidence.investigation_id == investigation_id,
        )
        .first()
    )
    if not evidence:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Evidence #{evidence_id} not found in this investigation.",
        )

    loc = resolve_evidence_location(evidence, investigation)
    return EvidenceLocationRead(
        evidence_id=evidence.id,
        investigation_id=investigation_id,
        latitude=loc["latitude"],
        longitude=loc["longitude"],
        location_accuracy=loc["location_accuracy"],
        location_source=loc["location_source"],
    )

