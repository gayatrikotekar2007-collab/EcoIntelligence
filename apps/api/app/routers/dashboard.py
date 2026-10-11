from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.core import (
    ActionPlan,
    Evidence,
    Investigation,
    InvestigationStatus,
    Observation,
    User,
)
from app.schemas.investigation import DashboardStats
from app.security import get_current_user

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=DashboardStats)
def get_dashboard_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Authenticated dashboard statistics endpoint.
    Aggregates counts strictly belonging to current user's authorized investigations:
    - Active investigations count (status: active, draft)
    - Total investigations count
    - Evidence collected count
    - Observations recorded count
    - Actions pending count (status: PLANNED, IN_PROGRESS, VERIFICATION_PENDING)
    """
    # Active investigations: owned by current user with active/draft status
    active_inv_count = (
        db.query(func.count(Investigation.id))
        .filter(
            Investigation.owner_id == current_user.id,
            Investigation.status.in_([InvestigationStatus.ACTIVE, InvestigationStatus.DRAFT]),
        )
        .scalar()
        or 0
    )

    total_inv_count = (
        db.query(func.count(Investigation.id))
        .filter(Investigation.owner_id == current_user.id)
        .scalar()
        or 0
    )

    # Evidence artifacts belonging to current user's authorized investigations
    evidence_count = (
        db.query(func.count(Evidence.id))
        .join(Investigation, Evidence.investigation_id == Investigation.id)
        .filter(Investigation.owner_id == current_user.id)
        .scalar()
        or 0
    )

    # Observations belonging to current user's authorized investigations
    observations_count = (
        db.query(func.count(Observation.id))
        .join(Investigation, Observation.investigation_id == Investigation.id)
        .filter(Investigation.owner_id == current_user.id)
        .scalar()
        or 0
    )

    # Pending actions: action plans belonging to current user's authorized investigations
    # where status is PLANNED, IN_PROGRESS, or VERIFICATION_PENDING
    pending_actions_count = (
        db.query(func.count(ActionPlan.id))
        .join(Investigation, ActionPlan.investigation_id == Investigation.id)
        .filter(
            Investigation.owner_id == current_user.id,
            ActionPlan.status.in_(["PLANNED", "IN_PROGRESS", "VERIFICATION_PENDING"]),
        )
        .scalar()
        or 0
    )

    return DashboardStats(
        active_investigations_count=active_inv_count,
        total_investigations_count=total_inv_count,
        evidence_count=evidence_count,
        observations_count=observations_count,
        pending_actions_count=pending_actions_count,
    )
