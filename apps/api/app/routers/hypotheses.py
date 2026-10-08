from __future__ import annotations

from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.core import (
    Evidence,
    Hypothesis,
    HypothesisConfidence,
    HypothesisEvidence,
    HypothesisObservation,
    HypothesisRelationshipType,
    HypothesisStatus,
    Investigation,
    MissingEvidence,
    Observation,
    RequirementPriority,
    RequirementStatus,
    TimelineEntry,
    User,
)
from app.schemas.hypothesis import (
    ComparisonSummaryRead,
    EvidenceMatrixRowRead,
    HypothesisCompareRequest,
    HypothesisComparisonResponse,
    HypothesisCreate,
    HypothesisDetailRead,
    HypothesisEvidenceCreate,
    HypothesisEvidenceRead,
    HypothesisObservationCreate,
    HypothesisObservationRead,
    HypothesisRead,
    HypothesisUpdate,
    MatrixCellRead,
    MissingEvidenceCreate,
    MissingEvidenceRead,
    MissingEvidenceUpdate,
    ObservationMatrixRowRead,
)
from app.schemas.investigation import EvidenceRead, ObservationRead
from app.security import get_current_user

router = APIRouter(tags=["hypotheses"])


def _verify_investigation_access(
    investigation_id: int, current_user: User, db: Session
) -> Investigation:
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
    return investigation


def _verify_hypothesis_access(
    investigation_id: int, hypothesis_id: int, current_user: User, db: Session
) -> tuple[Investigation, Hypothesis]:
    investigation = _verify_investigation_access(investigation_id, current_user, db)
    hypothesis = (
        db.query(Hypothesis)
        .filter(
            Hypothesis.id == hypothesis_id,
            Hypothesis.investigation_id == investigation_id,
        )
        .first()
    )
    if not hypothesis:
        exists_elsewhere = db.query(Hypothesis).filter(Hypothesis.id == hypothesis_id).first()
        if exists_elsewhere:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Hypothesis does not belong to this investigation.",
            )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Hypothesis not found.",
        )
    return investigation, hypothesis


def _calculate_hypothesis_counts(h: Hypothesis, read_obj: HypothesisRead | HypothesisDetailRead):
    evidence_links = h.evidence_links or []
    obs_links = h.observation_links or []
    missing_items = h.missing_evidence or []

    read_obj.supporting_evidence_count = sum(
        1 for e in evidence_links if e.relationship_type == HypothesisRelationshipType.SUPPORTS.value
    )
    read_obj.contradicting_evidence_count = sum(
        1 for e in evidence_links if e.relationship_type == HypothesisRelationshipType.CONTRADICTS.value
    )
    read_obj.context_evidence_count = sum(
        1 for e in evidence_links if e.relationship_type == HypothesisRelationshipType.CONTEXT.value
    )

    read_obj.supporting_observation_count = sum(
        1 for o in obs_links if o.relationship_type == HypothesisRelationshipType.SUPPORTS.value
    )
    read_obj.contradicting_observation_count = sum(
        1 for o in obs_links if o.relationship_type == HypothesisRelationshipType.CONTRADICTS.value
    )
    read_obj.context_observation_count = sum(
        1 for o in obs_links if o.relationship_type == HypothesisRelationshipType.CONTEXT.value
    )

    read_obj.missing_evidence_count = sum(
        1 for m in missing_items if m.status == RequirementStatus.OPEN.value
    )
    read_obj.resolved_missing_evidence_count = sum(
        1 for m in missing_items if m.status != RequirementStatus.OPEN.value
    )


@router.post(
    "/{investigation_id}/hypotheses",
    response_model=HypothesisRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_hypothesis(
    investigation_id: int,
    payload: HypothesisCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    investigation = _verify_investigation_access(investigation_id, current_user, db)

    clean_title = payload.title.strip() if payload.title else ""
    if not clean_title:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Hypothesis title cannot be empty.",
        )

    now = datetime.now(timezone.utc)
    hypothesis = Hypothesis(
        investigation_id=investigation.id,
        title=clean_title,
        description=payload.description.strip() if payload.description else None,
        reasoning=payload.reasoning.strip() if payload.reasoning else None,
        status=payload.status.value if payload.status else HypothesisStatus.OPEN.value,
        confidence=payload.confidence.value if payload.confidence else HypothesisConfidence.LOW.value,
        created_by=current_user.id,
        created_at=now,
        updated_at=now,
    )
    db.add(hypothesis)
    db.flush()

    timeline = TimelineEntry(
        investigation_id=investigation.id,
        event_type="hypothesis_created",
        title="Hypothesis Created",
        description=f"Hypothesis '{hypothesis.title}' created by investigator.",
        event_timestamp=now,
    )
    db.add(timeline)
    db.commit()
    db.refresh(hypothesis)

    res = HypothesisRead.model_validate(hypothesis)
    _calculate_hypothesis_counts(hypothesis, res)
    return res


@router.get(
    "/{investigation_id}/hypotheses",
    response_model=List[HypothesisRead],
)
async def list_hypotheses(
    investigation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _verify_investigation_access(investigation_id, current_user, db)

    hypotheses = (
        db.query(Hypothesis)
        .options(
            joinedload(Hypothesis.evidence_links),
            joinedload(Hypothesis.observation_links),
            joinedload(Hypothesis.missing_evidence),
        )
        .filter(Hypothesis.investigation_id == investigation_id)
        .order_by(Hypothesis.created_at.desc())
        .all()
    )

    results: List[HypothesisRead] = []
    for h in hypotheses:
        read_obj = HypothesisRead.model_validate(h)
        _calculate_hypothesis_counts(h, read_obj)
        results.append(read_obj)

    return results


@router.get(
    "/{investigation_id}/hypotheses/{hypothesis_id}",
    response_model=HypothesisDetailRead,
)
async def get_hypothesis(
    investigation_id: int,
    hypothesis_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _verify_investigation_access(investigation_id, current_user, db)

    hypothesis = (
        db.query(Hypothesis)
        .options(
            joinedload(Hypothesis.evidence_links).joinedload(HypothesisEvidence.evidence),
            joinedload(Hypothesis.observation_links).joinedload(HypothesisObservation.observation),
            joinedload(Hypothesis.missing_evidence),
        )
        .filter(
            Hypothesis.id == hypothesis_id,
            Hypothesis.investigation_id == investigation_id,
        )
        .first()
    )
    if not hypothesis:
        exists_elsewhere = db.query(Hypothesis).filter(Hypothesis.id == hypothesis_id).first()
        if exists_elsewhere:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Hypothesis does not belong to this investigation.",
            )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Hypothesis not found.",
        )

    res = HypothesisDetailRead.model_validate(hypothesis)
    _calculate_hypothesis_counts(hypothesis, res)

    # Sort evidence links, observation links, missing evidence
    res.evidence_links.sort(key=lambda e: e.created_at, reverse=True)
    res.observation_links.sort(key=lambda o: o.created_at, reverse=True)
    res.missing_evidence.sort(key=lambda m: m.created_at, reverse=True)

    # Fetch relevant timeline entries
    timeline_entries = (
        db.query(TimelineEntry)
        .filter(
            TimelineEntry.investigation_id == investigation_id,
            TimelineEntry.description.like(f"%'{hypothesis.title}'%"),
        )
        .order_by(TimelineEntry.event_timestamp.desc())
        .all()
    )
    res.timeline_entries = timeline_entries
    return res


@router.patch(
    "/{investigation_id}/hypotheses/{hypothesis_id}",
    response_model=HypothesisDetailRead,
)
async def update_hypothesis(
    investigation_id: int,
    hypothesis_id: int,
    payload: HypothesisUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    investigation, hypothesis = _verify_hypothesis_access(
        investigation_id, hypothesis_id, current_user, db
    )

    now = datetime.now(timezone.utc)
    old_status = hypothesis.status

    if payload.title is not None:
        clean_title = payload.title.strip()
        if not clean_title:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Hypothesis title cannot be empty.",
            )
        hypothesis.title = clean_title

    if payload.description is not None:
        hypothesis.description = payload.description.strip() if payload.description else None

    if payload.reasoning is not None:
        hypothesis.reasoning = payload.reasoning.strip() if payload.reasoning else None

    if payload.confidence is not None:
        hypothesis.confidence = payload.confidence.value

    status_changed = False
    if payload.status is not None and payload.status.value != old_status:
        hypothesis.status = payload.status.value
        status_changed = True
        db.add(
            TimelineEntry(
                investigation_id=investigation.id,
                event_type="hypothesis_status_changed",
                title=f"Hypothesis Status: {payload.status.value}",
                description=f"Hypothesis '{hypothesis.title}' status changed from {old_status} to {payload.status.value}.",
                event_timestamp=now,
            )
        )
    elif payload.title is not None or payload.description is not None or payload.reasoning is not None or payload.confidence is not None:
        db.add(
            TimelineEntry(
                investigation_id=investigation.id,
                event_type="hypothesis_updated",
                title="Hypothesis Updated",
                description=f"Hypothesis '{hypothesis.title}' details updated.",
                event_timestamp=now,
            )
        )

    hypothesis.updated_at = now
    db.commit()
    db.refresh(hypothesis)

    res = HypothesisDetailRead.model_validate(hypothesis)
    _calculate_hypothesis_counts(hypothesis, res)
    return res


@router.delete(
    "/{investigation_id}/hypotheses/{hypothesis_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_hypothesis(
    investigation_id: int,
    hypothesis_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    investigation, hypothesis = _verify_hypothesis_access(
        investigation_id, hypothesis_id, current_user, db
    )

    title = hypothesis.title
    db.delete(hypothesis)

    now = datetime.now(timezone.utc)
    db.add(
        TimelineEntry(
            investigation_id=investigation.id,
            event_type="hypothesis_deleted",
            title="Hypothesis Deleted",
            description=f"Hypothesis '{title}' was removed.",
            event_timestamp=now,
        )
    )
    db.commit()
    return None


# ============================================================================
# EVIDENCE RELATIONSHIPS
# ============================================================================


@router.post(
    "/{investigation_id}/hypotheses/{hypothesis_id}/evidence",
    response_model=HypothesisEvidenceRead,
    status_code=status.HTTP_201_CREATED,
)
async def link_evidence_to_hypothesis(
    investigation_id: int,
    hypothesis_id: int,
    payload: HypothesisEvidenceCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    investigation, hypothesis = _verify_hypothesis_access(
        investigation_id, hypothesis_id, current_user, db
    )

    evidence = db.query(Evidence).filter(Evidence.id == payload.evidence_id).first()
    if not evidence:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Evidence {payload.evidence_id} not found.",
        )
    if evidence.investigation_id != investigation_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Evidence {payload.evidence_id} does not belong to this investigation.",
        )

    existing = (
        db.query(HypothesisEvidence)
        .filter(
            HypothesisEvidence.hypothesis_id == hypothesis.id,
            HypothesisEvidence.evidence_id == evidence.id,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Evidence is already linked to this hypothesis.",
        )

    now = datetime.now(timezone.utc)
    link = HypothesisEvidence(
        hypothesis_id=hypothesis.id,
        evidence_id=evidence.id,
        relationship_type=payload.relationship_type.value,
        note=payload.note.strip() if payload.note else None,
        created_by=current_user.id,
        created_at=now,
    )
    db.add(link)
    db.flush()

    hypothesis.updated_at = now
    db.add(
        TimelineEntry(
            investigation_id=investigation.id,
            event_type="evidence_linked_to_hypothesis",
            title="Evidence Linked to Hypothesis",
            description=f"Evidence E{evidence.id} ('{evidence.original_filename}') was linked as {payload.relationship_type.value} for hypothesis '{hypothesis.title}'.",
            event_timestamp=now,
        )
    )
    db.commit()
    db.refresh(link)

    res = HypothesisEvidenceRead.model_validate(link)
    res.evidence = EvidenceRead.model_validate(evidence)
    return res


@router.delete(
    "/{investigation_id}/hypotheses/{hypothesis_id}/evidence/{evidence_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def unlink_evidence_from_hypothesis(
    investigation_id: int,
    hypothesis_id: int,
    evidence_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    investigation, hypothesis = _verify_hypothesis_access(
        investigation_id, hypothesis_id, current_user, db
    )

    link = (
        db.query(HypothesisEvidence)
        .filter(
            HypothesisEvidence.hypothesis_id == hypothesis.id,
            HypothesisEvidence.evidence_id == evidence_id,
        )
        .first()
    )
    if not link:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evidence relationship not found.",
        )

    db.delete(link)
    now = datetime.now(timezone.utc)
    hypothesis.updated_at = now
    db.add(
        TimelineEntry(
            investigation_id=investigation.id,
            event_type="evidence_unlinked_from_hypothesis",
            title="Evidence Unlinked from Hypothesis",
            description=f"Evidence E{evidence_id} unlinked from hypothesis '{hypothesis.title}'.",
            event_timestamp=now,
        )
    )
    db.commit()
    return None


# ============================================================================
# OBSERVATION RELATIONSHIPS
# ============================================================================


@router.post(
    "/{investigation_id}/hypotheses/{hypothesis_id}/observations",
    response_model=HypothesisObservationRead,
    status_code=status.HTTP_201_CREATED,
)
async def link_observation_to_hypothesis(
    investigation_id: int,
    hypothesis_id: int,
    payload: HypothesisObservationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    investigation, hypothesis = _verify_hypothesis_access(
        investigation_id, hypothesis_id, current_user, db
    )

    obs = db.query(Observation).filter(Observation.id == payload.observation_id).first()
    if not obs:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Observation {payload.observation_id} not found.",
        )
    if obs.investigation_id != investigation_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Observation {payload.observation_id} does not belong to this investigation.",
        )

    existing = (
        db.query(HypothesisObservation)
        .filter(
            HypothesisObservation.hypothesis_id == hypothesis.id,
            HypothesisObservation.observation_id == obs.id,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Observation is already linked to this hypothesis.",
        )

    now = datetime.now(timezone.utc)
    link = HypothesisObservation(
        hypothesis_id=hypothesis.id,
        observation_id=obs.id,
        relationship_type=payload.relationship_type.value,
        note=payload.note.strip() if payload.note else None,
        created_by=current_user.id,
        created_at=now,
    )
    db.add(link)
    db.flush()

    hypothesis.updated_at = now
    db.add(
        TimelineEntry(
            investigation_id=investigation.id,
            event_type="observation_linked_to_hypothesis",
            title="Observation Linked to Hypothesis",
            description=f"Observation O{obs.id} ('{obs.category}') was linked as {payload.relationship_type.value} for hypothesis '{hypothesis.title}'.",
            event_timestamp=now,
        )
    )
    db.commit()
    db.refresh(link)

    res = HypothesisObservationRead.model_validate(link)
    res.observation = ObservationRead.model_validate(obs)
    return res


@router.delete(
    "/{investigation_id}/hypotheses/{hypothesis_id}/observations/{observation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def unlink_observation_from_hypothesis(
    investigation_id: int,
    hypothesis_id: int,
    observation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    investigation, hypothesis = _verify_hypothesis_access(
        investigation_id, hypothesis_id, current_user, db
    )

    link = (
        db.query(HypothesisObservation)
        .filter(
            HypothesisObservation.hypothesis_id == hypothesis.id,
            HypothesisObservation.observation_id == observation_id,
        )
        .first()
    )
    if not link:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Observation relationship not found.",
        )

    db.delete(link)
    now = datetime.now(timezone.utc)
    hypothesis.updated_at = now
    db.add(
        TimelineEntry(
            investigation_id=investigation.id,
            event_type="observation_unlinked_from_hypothesis",
            title="Observation Unlinked from Hypothesis",
            description=f"Observation O{observation_id} unlinked from hypothesis '{hypothesis.title}'.",
            event_timestamp=now,
        )
    )
    db.commit()
    return None


# ============================================================================
# MISSING EVIDENCE REQUIREMENTS
# ============================================================================


@router.post(
    "/{investigation_id}/hypotheses/{hypothesis_id}/missing-evidence",
    response_model=MissingEvidenceRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_missing_evidence_requirement(
    investigation_id: int,
    hypothesis_id: int,
    payload: MissingEvidenceCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    investigation, hypothesis = _verify_hypothesis_access(
        investigation_id, hypothesis_id, current_user, db
    )

    clean_desc = payload.description.strip() if payload.description else ""
    if not clean_desc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Requirement description cannot be empty.",
        )

    now = datetime.now(timezone.utc)
    req = MissingEvidence(
        hypothesis_id=hypothesis.id,
        description=clean_desc,
        priority=payload.priority.value if payload.priority else RequirementPriority.MEDIUM.value,
        status=payload.status.value if payload.status else RequirementStatus.OPEN.value,
        created_by=current_user.id,
        created_at=now,
        resolved_at=now if payload.status and payload.status != RequirementStatus.OPEN else None,
    )
    db.add(req)
    db.flush()

    hypothesis.updated_at = now
    db.add(
        TimelineEntry(
            investigation_id=investigation.id,
            event_type="missing_evidence_added",
            title="Missing Evidence Requirement Added",
            description=f"Information requirement added for hypothesis '{hypothesis.title}': {req.description[:80]}.",
            event_timestamp=now,
        )
    )
    db.commit()
    db.refresh(req)
    return req


@router.patch(
    "/{investigation_id}/hypotheses/{hypothesis_id}/missing-evidence/{requirement_id}",
    response_model=MissingEvidenceRead,
)
async def update_missing_evidence_requirement(
    investigation_id: int,
    hypothesis_id: int,
    requirement_id: int,
    payload: MissingEvidenceUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    investigation, hypothesis = _verify_hypothesis_access(
        investigation_id, hypothesis_id, current_user, db
    )

    req = (
        db.query(MissingEvidence)
        .filter(
            MissingEvidence.id == requirement_id,
            MissingEvidence.hypothesis_id == hypothesis.id,
        )
        .first()
    )
    if not req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Missing evidence requirement not found.",
        )

    now = datetime.now(timezone.utc)
    old_status = req.status

    if payload.description is not None:
        clean_desc = payload.description.strip()
        if not clean_desc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Requirement description cannot be empty.",
            )
        req.description = clean_desc

    if payload.priority is not None:
        req.priority = payload.priority.value

    if payload.status is not None:
        req.status = payload.status.value
        if payload.status != RequirementStatus.OPEN:
            req.resolved_at = now
            db.add(
                TimelineEntry(
                    investigation_id=investigation.id,
                    event_type="missing_evidence_resolved",
                    title=f"Missing Evidence Requirement {payload.status.value.replace('_', ' ').title()}",
                    description=f"Requirement '{req.description[:60]}' marked as {payload.status.value}.",
                    event_timestamp=now,
                )
            )
        else:
            req.resolved_at = None

    hypothesis.updated_at = now
    db.commit()
    db.refresh(req)
    return req


@router.delete(
    "/{investigation_id}/hypotheses/{hypothesis_id}/missing-evidence/{requirement_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_missing_evidence_requirement(
    investigation_id: int,
    hypothesis_id: int,
    requirement_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _verify_hypothesis_access(investigation_id, hypothesis_id, current_user, db)

    req = (
        db.query(MissingEvidence)
        .filter(
            MissingEvidence.id == requirement_id,
            MissingEvidence.hypothesis_id == hypothesis_id,
        )
        .first()
    )
    if not req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Missing evidence requirement not found.",
        )

    db.delete(req)
    db.commit()
    return None


# ============================================================================
# PHASE 8B — COMPARATIVE HYPOTHESIS EVALUATION & MATRIX ANALYSIS
# ============================================================================


@router.post(
    "/{investigation_id}/hypotheses/compare",
    response_model=HypothesisComparisonResponse,
)
async def compare_hypotheses(
    investigation_id: int,
    payload: HypothesisCompareRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Deterministic comparative evaluation across multiple competing hypotheses.
    Constructs an evidence and observation comparison matrix from explicit
    investigator relationships, identifies discriminating and common evidence,
    and collates missing information requirements.
    Does NOT assert automated ranking or causal probability.
    """
    _verify_investigation_access(investigation_id, current_user, db)

    # 1. Validate minimum two hypotheses
    if len(payload.hypothesis_ids) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least two hypotheses are required for comparison.",
        )

    # 2. Validate no duplicate IDs
    if len(payload.hypothesis_ids) != len(set(payload.hypothesis_ids)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Duplicate hypothesis IDs are not permitted.",
        )

    # 3. Retrieve requested hypotheses
    hypotheses_records = (
        db.query(Hypothesis)
        .options(
            joinedload(Hypothesis.evidence_links).joinedload(HypothesisEvidence.evidence),
            joinedload(Hypothesis.observation_links).joinedload(HypothesisObservation.observation),
            joinedload(Hypothesis.missing_evidence),
        )
        .filter(Hypothesis.id.in_(payload.hypothesis_ids))
        .all()
    )

    found_map = {h.id: h for h in hypotheses_records}

    # 4. Verify presence and investigation ownership for every ID
    for hid in payload.hypothesis_ids:
        if hid not in found_map:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Hypothesis {hid} not found.",
            )
        h = found_map[hid]
        if h.investigation_id != investigation_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Hypothesis {hid} does not belong to this investigation.",
            )

    # Preserve requested order
    ordered_hypotheses = [found_map[hid] for hid in payload.hypothesis_ids]

    # Calculate hypothesis counts for each hypothesis
    hypotheses_read_list: List[HypothesisRead] = []
    for h in ordered_hypotheses:
        read_obj = HypothesisRead.model_validate(h)
        _calculate_hypothesis_counts(h, read_obj)
        hypotheses_read_list.append(read_obj)

    # --- EVIDENCE MATRIX ---
    ev_links_map = {}
    ev_ids_set = set()
    for h in ordered_hypotheses:
        for link in h.evidence_links or []:
            ev_links_map[(link.evidence_id, h.id)] = link
            ev_ids_set.add(link.evidence_id)

    evidence_items = (
        db.query(Evidence)
        .filter(Evidence.id.in_(ev_ids_set))
        .all()
        if ev_ids_set
        else []
    )
    ev_items_map = {e.id: e for e in evidence_items}

    evidence_matrix: List[EvidenceMatrixRowRead] = []
    for ev_id in sorted(ev_ids_set):
        ev = ev_items_map.get(ev_id)
        if not ev:
            continue
        ev_read = EvidenceRead.model_validate(ev)

        cells: List[MatrixCellRead] = []
        for h in ordered_hypotheses:
            link = ev_links_map.get((ev_id, h.id))
            if link:
                cells.append(
                    MatrixCellRead(
                        hypothesis_id=h.id,
                        relationship_type=link.relationship_type,
                        is_linked=True,
                        note=link.note,
                    )
                )
            else:
                cells.append(
                    MatrixCellRead(
                        hypothesis_id=h.id,
                        relationship_type="NOT_LINKED",
                        is_linked=False,
                        note=None,
                    )
                )

        linked_cells = [c for c in cells if c.is_linked]
        linked_count = len(linked_cells)
        is_common = linked_count >= 2
        explicit_rels = {c.relationship_type for c in linked_cells}
        is_discriminating = len(explicit_rels) > 1
        has_contradiction = HypothesisRelationshipType.CONTRADICTS.value in explicit_rels

        if is_discriminating:
            rel_classification = "DIFFERENT"
        elif is_common:
            rel_classification = "SAME"
        else:
            rel_classification = "SINGLE_ASSOCIATION"

        evidence_matrix.append(
            EvidenceMatrixRowRead(
                evidence_id=ev_read.id,
                original_filename=ev_read.original_filename,
                evidence_type=ev_read.evidence_type,
                mime_type=ev_read.mime_type,
                description=ev_read.description,
                captured_at=ev_read.captured_at,
                location_id=ev_read.location_id,
                latitude=ev_read.latitude,
                longitude=ev_read.longitude,
                cells=cells,
                is_common=is_common,
                is_discriminating=is_discriminating,
                relationship_classification=rel_classification,
                has_contradiction=has_contradiction,
            )
        )

    # --- OBSERVATION MATRIX ---
    obs_links_map = {}
    obs_ids_set = set()
    for h in ordered_hypotheses:
        for link in h.observation_links or []:
            obs_links_map[(link.observation_id, h.id)] = link
            obs_ids_set.add(link.observation_id)

    observation_items = (
        db.query(Observation)
        .filter(Observation.id.in_(obs_ids_set))
        .all()
        if obs_ids_set
        else []
    )
    obs_items_map = {o.id: o for o in observation_items}

    observation_matrix: List[ObservationMatrixRowRead] = []
    for obs_id in sorted(obs_ids_set):
        obs = obs_items_map.get(obs_id)
        if not obs:
            continue
        obs_read = ObservationRead.model_validate(obs)

        cells = []
        for h in ordered_hypotheses:
            link = obs_links_map.get((obs_id, h.id))
            if link:
                cells.append(
                    MatrixCellRead(
                        hypothesis_id=h.id,
                        relationship_type=link.relationship_type,
                        is_linked=True,
                        note=link.note,
                    )
                )
            else:
                cells.append(
                    MatrixCellRead(
                        hypothesis_id=h.id,
                        relationship_type="NOT_LINKED",
                        is_linked=False,
                        note=None,
                    )
                )

        linked_cells = [c for c in cells if c.is_linked]
        linked_count = len(linked_cells)
        is_common = linked_count >= 2
        explicit_rels = {c.relationship_type for c in linked_cells}
        is_discriminating = len(explicit_rels) > 1
        has_contradiction = HypothesisRelationshipType.CONTRADICTS.value in explicit_rels

        if is_discriminating:
            rel_classification = "DIFFERENT"
        elif is_common:
            rel_classification = "SAME"
        else:
            rel_classification = "SINGLE_ASSOCIATION"

        observation_matrix.append(
            ObservationMatrixRowRead(
                observation_id=obs_read.id,
                category=obs_read.category,
                description=obs_read.description,
                severity=obs_read.severity.value if hasattr(obs_read.severity, "value") else str(obs_read.severity),
                created_at=obs_read.created_at,
                cells=cells,
                is_common=is_common,
                is_discriminating=is_discriminating,
                relationship_classification=rel_classification,
                has_contradiction=has_contradiction,
            )
        )

    # --- FILTERED SUBSETS ---
    common_evidence = [r for r in evidence_matrix if r.is_common]
    discriminating_evidence = [r for r in evidence_matrix if r.is_discriminating]
    contradicting_evidence = [r for r in evidence_matrix if r.has_contradiction]

    # --- MISSING REQUIREMENTS ---
    missing_requirements: List[MissingEvidenceRead] = []
    for h in ordered_hypotheses:
        for req in h.missing_evidence or []:
            missing_requirements.append(MissingEvidenceRead.model_validate(req))

    priority_order = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
    missing_requirements.sort(
        key=lambda r: (
            0 if r.status == RequirementStatus.OPEN.value else 1,
            priority_order.get(r.priority.value if hasattr(r.priority, "value") else str(r.priority), 1),
            r.created_at,
        )
    )

    unresolved_requirements_count = sum(
        1 for r in missing_requirements if r.status == RequirementStatus.OPEN.value
    )

    # --- COMPARISON SUMMARY (COUNTS ONLY, NO AUTOMATED RANKING OR CAUSAL PROBABILITY) ---
    summary = ComparisonSummaryRead(
        selected_hypotheses_count=len(ordered_hypotheses),
        total_evidence_referenced=len(evidence_matrix),
        common_evidence_count=len(common_evidence),
        discriminating_evidence_count=len(discriminating_evidence),
        contradicting_evidence_count=len(contradicting_evidence),
        total_observations_referenced=len(observation_matrix),
        common_observations_count=sum(1 for r in observation_matrix if r.is_common),
        discriminating_observations_count=sum(1 for r in observation_matrix if r.is_discriminating),
        unresolved_requirements_count=unresolved_requirements_count,
    )

    return HypothesisComparisonResponse(
        investigation_id=investigation_id,
        hypotheses=hypotheses_read_list,
        evidence_matrix=evidence_matrix,
        observation_matrix=observation_matrix,
        common_evidence=common_evidence,
        discriminating_evidence=discriminating_evidence,
        contradicting_evidence=contradicting_evidence,
        missing_requirements=missing_requirements,
        summary=summary,
    )

