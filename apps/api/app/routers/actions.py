from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.core import (
    ActionCriterion,
    ActionEvidence,
    ActionObservation,
    ActionPlan,
    ActionStatus,
    ActionVerification,
    ActionVerificationResult,
    Evidence,
    Hypothesis,
    Investigation,
    Observation,
    TimelineEntry,
    User,
)
from app.schemas.actions import (
    ActionCreate,
    ActionCriterionCreate,
    ActionCriterionRead,
    ActionCriterionUpdate,
    ActionDetailRead,
    ActionEvidenceCreate,
    ActionEvidenceRead,
    ActionObservationCreate,
    ActionObservationRead,
    ActionRead,
    ActionUpdate,
    ActionVerificationRead,
    ActionVerificationResultRead,
    ActionVerifyRequest,
)
from app.schemas.investigation import EvidenceRead, ObservationRead
from app.security import get_current_user
from app.utils.action_verification import (
    derive_verification_status,
    determine_criterion_result,
)

router = APIRouter(tags=["actions"])


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


def _verify_action_access(
    investigation_id: int, action_id: int, current_user: User, db: Session
) -> tuple[Investigation, ActionPlan]:
    investigation = _verify_investigation_access(investigation_id, current_user, db)
    action = (
        db.query(ActionPlan)
        .filter(
            ActionPlan.id == action_id,
            ActionPlan.investigation_id == investigation_id,
        )
        .first()
    )
    if not action:
        exists_elsewhere = db.query(ActionPlan).filter(ActionPlan.id == action_id).first()
        if exists_elsewhere:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Action does not belong to this investigation.",
            )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Action not found.",
        )
    return investigation, action


def _populate_action_read_fields(action: ActionPlan, read_obj: ActionRead | ActionDetailRead, db: Session):
    read_obj.criteria_count = len(action.criteria or [])
    read_obj.evidence_count = len(action.evidence_links or [])
    read_obj.observation_count = len(action.observation_links or [])

    if action.verifications:
        # Sort by verified_at descending
        sorted_verifs = sorted(action.verifications, key=lambda v: v.verified_at, reverse=True)
        read_obj.latest_verification_status = sorted_verifs[0].status
    else:
        read_obj.latest_verification_status = None


def _build_action_detail_read(action: ActionPlan, db: Session) -> ActionDetailRead:
    res = ActionDetailRead.model_validate(action)
    _populate_action_read_fields(action, res, db)

    if action.hypothesis_id:
        hypo = db.query(Hypothesis).filter(Hypothesis.id == action.hypothesis_id).first()
        if hypo:
            res.hypothesis_title = hypo.title

    # Populate verifier names on verifications
    for v_read in res.verifications:
        v_model = next((v for v in action.verifications if v.id == v_read.id), None)
        if v_model and v_model.verifier:
            v_read.verifier_name = v_model.verifier.display_name

    return res


# ------------------------------------------------------------
# Action CRUD Endpoints
# ------------------------------------------------------------

@router.post(
    "/{investigation_id}/actions",
    response_model=ActionDetailRead,
    status_code=status.HTTP_201_CREATED,
)
def create_action(
    investigation_id: int,
    payload: ActionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    investigation = _verify_investigation_access(investigation_id, current_user, db)

    # Validate linked hypothesis if provided
    if payload.hypothesis_id is not None:
        hypothesis = (
            db.query(Hypothesis)
            .filter(
                Hypothesis.id == payload.hypothesis_id,
                Hypothesis.investigation_id == investigation_id,
            )
            .first()
        )
        if not hypothesis:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Hypothesis does not belong to this investigation.",
            )

    now = datetime.now(timezone.utc)
    action = ActionPlan(
        investigation_id=investigation_id,
        hypothesis_id=payload.hypothesis_id,
        title=payload.title,
        description=payload.description,
        rationale=payload.rationale,
        status=ActionStatus.PLANNED.value,
        priority=payload.priority,
        responsible_person=payload.responsible_person,
        planned_start_date=payload.planned_start_date,
        target_date=payload.target_date,
        created_by=current_user.id,
        created_at=now,
        updated_at=now,
    )
    db.add(action)
    db.flush()

    timeline = TimelineEntry(
        investigation_id=investigation.id,
        event_type="action_created",
        title="Action Plan Created",
        description=f"Action plan '{action.title}' created by investigator.",
        event_timestamp=now,
    )
    db.add(timeline)
    db.commit()
    db.refresh(action)

    return _build_action_detail_read(action, db)


@router.get(
    "/{investigation_id}/actions",
    response_model=List[ActionRead],
)
def list_actions(
    investigation_id: int,
    status_filter: Optional[str] = Query(None, alias="status"),
    priority_filter: Optional[str] = Query(None, alias="priority"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _verify_investigation_access(investigation_id, current_user, db)

    query = (
        db.query(ActionPlan)
        .filter(ActionPlan.investigation_id == investigation_id)
        .options(
            joinedload(ActionPlan.criteria),
            joinedload(ActionPlan.evidence_links),
            joinedload(ActionPlan.observation_links),
            joinedload(ActionPlan.verifications),
        )
    )

    if status_filter:
        query = query.filter(ActionPlan.status == status_filter.upper())
    if priority_filter:
        query = query.filter(ActionPlan.priority == priority_filter.upper())

    actions = query.order_by(ActionPlan.created_at.desc()).all()

    result = []
    for action in actions:
        read_obj = ActionRead.model_validate(action)
        _populate_action_read_fields(action, read_obj, db)
        result.append(read_obj)

    return result


@router.get(
    "/{investigation_id}/actions/{action_id}",
    response_model=ActionDetailRead,
)
def get_action_detail(
    investigation_id: int,
    action_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _, action = _verify_action_access(investigation_id, action_id, current_user, db)
    return _build_action_detail_read(action, db)


@router.patch(
    "/{investigation_id}/actions/{action_id}",
    response_model=ActionDetailRead,
)
def update_action(
    investigation_id: int,
    action_id: int,
    payload: ActionUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    investigation, action = _verify_action_access(investigation_id, action_id, current_user, db)

    if payload.hypothesis_id is not None:
        hypothesis = (
            db.query(Hypothesis)
            .filter(
                Hypothesis.id == payload.hypothesis_id,
                Hypothesis.investigation_id == investigation_id,
            )
            .first()
        )
        if not hypothesis:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Hypothesis does not belong to this investigation.",
            )
        action.hypothesis_id = payload.hypothesis_id

    now = datetime.now(timezone.utc)
    old_status = action.status
    status_changed = False

    if payload.title is not None:
        action.title = payload.title
    if payload.description is not None:
        action.description = payload.description
    if payload.rationale is not None:
        action.rationale = payload.rationale
    if payload.status is not None:
        if action.status != payload.status:
            action.status = payload.status
            status_changed = True
    if payload.priority is not None:
        action.priority = payload.priority
    if payload.responsible_person is not None:
        action.responsible_person = payload.responsible_person
    if payload.planned_start_date is not None:
        action.planned_start_date = payload.planned_start_date
    if payload.target_date is not None:
        action.target_date = payload.target_date

    action.updated_at = now

    if status_changed:
        timeline = TimelineEntry(
            investigation_id=investigation.id,
            event_type="action_status_changed",
            title="Action Status Changed",
            description=f"Action '{action.title}' status changed from {old_status} to {action.status}.",
            event_timestamp=now,
        )
        db.add(timeline)
    else:
        timeline = TimelineEntry(
            investigation_id=investigation.id,
            event_type="action_updated",
            title="Action Updated",
            description=f"Action plan '{action.title}' details updated.",
            event_timestamp=now,
        )
        db.add(timeline)

    db.commit()
    db.refresh(action)
    return _build_action_detail_read(action, db)


@router.delete(
    "/{investigation_id}/actions/{action_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_action(
    investigation_id: int,
    action_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    investigation, action = _verify_action_access(investigation_id, action_id, current_user, db)
    action_title = action.title

    now = datetime.now(timezone.utc)
    timeline = TimelineEntry(
        investigation_id=investigation.id,
        event_type="action_deleted",
        title="Action Deleted",
        description=f"Action plan '{action_title}' deleted from investigation.",
        event_timestamp=now,
    )
    db.add(timeline)
    db.delete(action)
    db.commit()


# ------------------------------------------------------------
# Action Criteria Endpoints
# ------------------------------------------------------------

@router.post(
    "/{investigation_id}/actions/{action_id}/criteria",
    response_model=ActionCriterionRead,
    status_code=status.HTTP_201_CREATED,
)
def add_criterion(
    investigation_id: int,
    action_id: int,
    payload: ActionCriterionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    investigation, action = _verify_action_access(investigation_id, action_id, current_user, db)

    now = datetime.now(timezone.utc)
    criterion = ActionCriterion(
        action_id=action.id,
        description=payload.description,
        measurement_type=payload.measurement_type,
        target_value=payload.target_value,
        target_unit=payload.target_unit,
        comparison_operator=payload.comparison_operator,
        created_at=now,
    )
    db.add(criterion)
    db.flush()

    timeline = TimelineEntry(
        investigation_id=investigation.id,
        event_type="criterion_added",
        title="Action Criterion Added",
        description=f"Verification criterion added to action '{action.title}': {criterion.description[:80]}",
        event_timestamp=now,
    )
    db.add(timeline)
    db.commit()
    db.refresh(criterion)

    return ActionCriterionRead.model_validate(criterion)


@router.get(
    "/{investigation_id}/actions/{action_id}/criteria",
    response_model=List[ActionCriterionRead],
)
def list_criteria(
    investigation_id: int,
    action_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _, action = _verify_action_access(investigation_id, action_id, current_user, db)
    criteria = (
        db.query(ActionCriterion)
        .filter(ActionCriterion.action_id == action.id)
        .order_by(ActionCriterion.created_at.asc())
        .all()
    )
    return [ActionCriterionRead.model_validate(c) for c in criteria]


@router.patch(
    "/{investigation_id}/actions/{action_id}/criteria/{criterion_id}",
    response_model=ActionCriterionRead,
)
def update_criterion(
    investigation_id: int,
    action_id: int,
    criterion_id: int,
    payload: ActionCriterionUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    investigation, action = _verify_action_access(investigation_id, action_id, current_user, db)

    criterion = (
        db.query(ActionCriterion)
        .filter(
            ActionCriterion.id == criterion_id,
            ActionCriterion.action_id == action.id,
        )
        .first()
    )
    if not criterion:
        exists_elsewhere = db.query(ActionCriterion).filter(ActionCriterion.id == criterion_id).first()
        if exists_elsewhere:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Criterion does not belong to this action.",
            )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Criterion not found.",
        )

    if payload.description is not None:
        criterion.description = payload.description
    if payload.measurement_type is not None:
        criterion.measurement_type = payload.measurement_type
    if payload.target_value is not None:
        criterion.target_value = payload.target_value
    if payload.target_unit is not None:
        criterion.target_unit = payload.target_unit
    if payload.comparison_operator is not None:
        criterion.comparison_operator = payload.comparison_operator

    now = datetime.now(timezone.utc)
    timeline = TimelineEntry(
        investigation_id=investigation.id,
        event_type="criterion_updated",
        title="Action Criterion Updated",
        description=f"Verification criterion updated for action '{action.title}'.",
        event_timestamp=now,
    )
    db.add(timeline)
    db.commit()
    db.refresh(criterion)

    return ActionCriterionRead.model_validate(criterion)


@router.delete(
    "/{investigation_id}/actions/{action_id}/criteria/{criterion_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_criterion(
    investigation_id: int,
    action_id: int,
    criterion_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    investigation, action = _verify_action_access(investigation_id, action_id, current_user, db)

    criterion = (
        db.query(ActionCriterion)
        .filter(
            ActionCriterion.id == criterion_id,
            ActionCriterion.action_id == action.id,
        )
        .first()
    )
    if not criterion:
        exists_elsewhere = db.query(ActionCriterion).filter(ActionCriterion.id == criterion_id).first()
        if exists_elsewhere:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Criterion does not belong to this action.",
            )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Criterion not found.",
        )

    now = datetime.now(timezone.utc)
    timeline = TimelineEntry(
        investigation_id=investigation.id,
        event_type="criterion_deleted",
        title="Action Criterion Deleted",
        description=f"Verification criterion removed from action '{action.title}'.",
        event_timestamp=now,
    )
    db.add(timeline)
    db.delete(criterion)
    db.commit()


# ------------------------------------------------------------
# Action Evidence Linking Endpoints
# ------------------------------------------------------------

@router.post(
    "/{investigation_id}/actions/{action_id}/evidence",
    response_model=ActionEvidenceRead,
    status_code=status.HTTP_201_CREATED,
)
def link_evidence(
    investigation_id: int,
    action_id: int,
    payload: ActionEvidenceCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    investigation, action = _verify_action_access(investigation_id, action_id, current_user, db)

    evidence = (
        db.query(Evidence)
        .filter(Evidence.id == payload.evidence_id)
        .first()
    )
    if not evidence:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evidence not found.",
        )
    if evidence.investigation_id != investigation_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Evidence does not belong to this investigation.",
        )

    # Check for duplicate link
    existing = (
        db.query(ActionEvidence)
        .filter(
            ActionEvidence.action_id == action.id,
            ActionEvidence.evidence_id == payload.evidence_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Evidence is already linked to this action.",
        )

    now = datetime.now(timezone.utc)
    link = ActionEvidence(
        action_id=action.id,
        evidence_id=payload.evidence_id,
        relationship_type=payload.relationship_type,
        note=payload.note,
        created_at=now,
    )
    db.add(link)
    db.flush()

    timeline = TimelineEntry(
        investigation_id=investigation.id,
        event_type="action_evidence_linked",
        title="Action Evidence Linked",
        description=f"Evidence #{evidence.id} linked to action '{action.title}' with relationship '{link.relationship_type}'.",
        event_timestamp=now,
    )
    db.add(timeline)
    db.commit()
    db.refresh(link)

    res = ActionEvidenceRead.model_validate(link)
    res.evidence = EvidenceRead.model_validate(evidence)
    return res


@router.delete(
    "/{investigation_id}/actions/{action_id}/evidence/{evidence_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def unlink_evidence(
    investigation_id: int,
    action_id: int,
    evidence_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    investigation, action = _verify_action_access(investigation_id, action_id, current_user, db)

    link = (
        db.query(ActionEvidence)
        .filter(
            ActionEvidence.action_id == action.id,
            ActionEvidence.evidence_id == evidence_id,
        )
        .first()
    )
    if not link:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evidence link not found for this action.",
        )

    now = datetime.now(timezone.utc)
    timeline = TimelineEntry(
        investigation_id=investigation.id,
        event_type="action_evidence_unlinked",
        title="Action Evidence Unlinked",
        description=f"Evidence #{evidence_id} unlinked from action '{action.title}'.",
        event_timestamp=now,
    )
    db.add(timeline)
    db.delete(link)
    db.commit()


@router.get(
    "/{investigation_id}/actions/{action_id}/evidence",
    response_model=List[ActionEvidenceRead],
)
def list_action_evidence(
    investigation_id: int,
    action_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _, action = _verify_action_access(investigation_id, action_id, current_user, db)
    links = (
        db.query(ActionEvidence)
        .filter(ActionEvidence.action_id == action.id)
        .options(joinedload(ActionEvidence.evidence))
        .order_by(ActionEvidence.created_at.asc())
        .all()
    )
    result = []
    for link in links:
        read_obj = ActionEvidenceRead.model_validate(link)
        if link.evidence:
            read_obj.evidence = EvidenceRead.model_validate(link.evidence)
        result.append(read_obj)
    return result


# ------------------------------------------------------------
# Action Observation Linking Endpoints
# ------------------------------------------------------------

@router.post(
    "/{investigation_id}/actions/{action_id}/observations",
    response_model=ActionObservationRead,
    status_code=status.HTTP_201_CREATED,
)
def link_observation(
    investigation_id: int,
    action_id: int,
    payload: ActionObservationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    investigation, action = _verify_action_access(investigation_id, action_id, current_user, db)

    observation = (
        db.query(Observation)
        .filter(Observation.id == payload.observation_id)
        .first()
    )
    if not observation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Observation not found.",
        )
    if observation.investigation_id != investigation_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Observation does not belong to this investigation.",
        )

    # Check for duplicate link
    existing = (
        db.query(ActionObservation)
        .filter(
            ActionObservation.action_id == action.id,
            ActionObservation.observation_id == payload.observation_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Observation is already linked to this action.",
        )

    now = datetime.now(timezone.utc)
    link = ActionObservation(
        action_id=action.id,
        observation_id=payload.observation_id,
        relationship_type=payload.relationship_type,
        note=payload.note,
        created_at=now,
    )
    db.add(link)
    db.flush()

    timeline = TimelineEntry(
        investigation_id=investigation.id,
        event_type="action_observation_linked",
        title="Action Observation Linked",
        description=f"Observation #{observation.id} linked to action '{action.title}' with relationship '{link.relationship_type}'.",
        event_timestamp=now,
    )
    db.add(timeline)
    db.commit()
    db.refresh(link)

    res = ActionObservationRead.model_validate(link)
    res.observation = ObservationRead.model_validate(observation)
    return res


@router.delete(
    "/{investigation_id}/actions/{action_id}/observations/{observation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def unlink_observation(
    investigation_id: int,
    action_id: int,
    observation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    investigation, action = _verify_action_access(investigation_id, action_id, current_user, db)

    link = (
        db.query(ActionObservation)
        .filter(
            ActionObservation.action_id == action.id,
            ActionObservation.observation_id == observation_id,
        )
        .first()
    )
    if not link:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Observation link not found for this action.",
        )

    now = datetime.now(timezone.utc)
    timeline = TimelineEntry(
        investigation_id=investigation.id,
        event_type="action_observation_unlinked",
        title="Action Observation Unlinked",
        description=f"Observation #{observation_id} unlinked from action '{action.title}'.",
        event_timestamp=now,
    )
    db.add(timeline)
    db.delete(link)
    db.commit()


@router.get(
    "/{investigation_id}/actions/{action_id}/observations",
    response_model=List[ActionObservationRead],
)
def list_action_observations(
    investigation_id: int,
    action_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _, action = _verify_action_access(investigation_id, action_id, current_user, db)
    links = (
        db.query(ActionObservation)
        .filter(ActionObservation.action_id == action.id)
        .options(joinedload(ActionObservation.observation))
        .order_by(ActionObservation.created_at.asc())
        .all()
    )
    result = []
    for link in links:
        read_obj = ActionObservationRead.model_validate(link)
        if link.observation:
            read_obj.observation = ObservationRead.model_validate(link.observation)
        result.append(read_obj)
    return result


# ------------------------------------------------------------
# Action Verification Endpoints
# ------------------------------------------------------------

@router.post(
    "/{investigation_id}/actions/{action_id}/verify",
    response_model=ActionVerificationRead,
    status_code=status.HTTP_201_CREATED,
)
def record_verification(
    investigation_id: int,
    action_id: int,
    payload: ActionVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    investigation, action = _verify_action_access(investigation_id, action_id, current_user, db)

    # 1. Fetch and validate all criteria for this action
    action_criteria_map = {c.id: c for c in action.criteria}

    # Validate each criterion result
    criterion_evaluations: list[dict] = []
    result_values_for_derivation: list[str] = []

    for item in payload.criterion_results:
        criterion = action_criteria_map.get(item.criterion_id)
        if not criterion:
            exists_elsewhere = db.query(ActionCriterion).filter(ActionCriterion.id == item.criterion_id).first()
            if exists_elsewhere:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Criterion does not belong to this action.",
                )
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Criterion with ID {item.criterion_id} not found.",
            )

        res_str, eval_mode = determine_criterion_result(
            criterion,
            item.observed_value,
            item.result,
        )

        criterion_evaluations.append({
            "criterion": criterion,
            "result": res_str,
            "observed_value": item.observed_value,
            "observed_unit": item.observed_unit or criterion.target_unit,
            "note": item.note,
            "evaluation_mode": eval_mode,
        })
        result_values_for_derivation.append(res_str)

    # 2. Derive or apply summary verification status
    final_status = derive_verification_status(
        result_values_for_derivation,
        payload.status,
    )

    now = datetime.now(timezone.utc)
    verification = ActionVerification(
        action_id=action.id,
        status=final_status,
        summary=payload.summary,
        verified_by=current_user.id,
        verified_at=now,
        uncertainty_notes=payload.uncertainty_notes,
    )
    db.add(verification)
    db.flush()

    for item_eval in criterion_evaluations:
        crit_res = ActionVerificationResult(
            verification_id=verification.id,
            criterion_id=item_eval["criterion"].id,
            result=item_eval["result"],
            observed_value=item_eval["observed_value"],
            observed_unit=item_eval["observed_unit"],
            note=item_eval["note"],
            evaluation_mode=item_eval["evaluation_mode"],
        )
        db.add(crit_res)

    # 3. Update action status to match verification status
    action.status = final_status
    action.updated_at = now

    # 4. Factual, neutral timeline event
    timeline = TimelineEntry(
        investigation_id=investigation.id,
        event_type="action_verification_recorded",
        title="Action Verification Recorded",
        description=f"Verification recorded for action '{action.title}' with status {final_status}. Evidence-first criterion assessment completed.",
        event_timestamp=now,
    )
    db.add(timeline)
    db.commit()
    db.refresh(verification)

    # Read response
    res = ActionVerificationRead.model_validate(verification)
    res.verifier_name = current_user.display_name
    for r_obj in res.criterion_results:
        crit_model = action_criteria_map.get(r_obj.criterion_id)
        if crit_model:
            r_obj.criterion = ActionCriterionRead.model_validate(crit_model)

    return res


@router.get(
    "/{investigation_id}/actions/{action_id}/verifications",
    response_model=List[ActionVerificationRead],
)
def list_verifications(
    investigation_id: int,
    action_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _, action = _verify_action_access(investigation_id, action_id, current_user, db)

    verifications = (
        db.query(ActionVerification)
        .filter(ActionVerification.action_id == action.id)
        .options(
            joinedload(ActionVerification.verifier),
            joinedload(ActionVerification.criterion_results).joinedload(ActionVerificationResult.criterion),
        )
        .order_by(ActionVerification.verified_at.desc())
        .all()
    )

    result = []
    for v in verifications:
        read_obj = ActionVerificationRead.model_validate(v)
        if v.verifier:
            read_obj.verifier_name = v.verifier.display_name
        result.append(read_obj)

    return result
