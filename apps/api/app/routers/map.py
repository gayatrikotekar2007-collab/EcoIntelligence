from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.core import Investigation, User
from app.schemas.investigation import (
    GeoJSONFeature,
    GeoJSONFeatureCollection,
    GeoJSONFeatureProperties,
    GeoJSONGeometry,
)
from app.security import get_current_user

router = APIRouter(tags=["map"])


@router.get("/map/investigations", response_model=GeoJSONFeatureCollection)
async def get_map_investigations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns investigation locations as GeoJSON FeatureCollection.
    Only returns investigations belonging to the authenticated user.
    """
    investigations = (
        db.query(Investigation)
        .options(
            joinedload(Investigation.location),
            joinedload(Investigation.observations),
        )
        .filter(
            Investigation.owner_id == current_user.id,
            Investigation.location_id.isnot(None),
        )
        .order_by(Investigation.created_at.desc())
        .all()
    )

    features: List[GeoJSONFeature] = []
    for inv in investigations:
        if not inv.location:
            continue
        if inv.location.longitude is None or inv.location.latitude is None:
            continue

        # Sort observations to get latest observation metadata if available
        obs_count = len(inv.observations) if inv.observations else 0
        severity = None
        source_type = None
        if inv.observations:
            sorted_obs = sorted(inv.observations, key=lambda o: o.observed_at, reverse=True)
            severity = sorted_obs[0].severity.value if sorted_obs[0].severity else None
            source_type = sorted_obs[0].source_type.value if sorted_obs[0].source_type else None

        feature = GeoJSONFeature(
            type="Feature",
            geometry=GeoJSONGeometry(
                type="Point",
                coordinates=[inv.location.longitude, inv.location.latitude],
            ),
            properties=GeoJSONFeatureProperties(
                id=inv.id,
                title=inv.title,
                category=inv.category,
                status=inv.status.value,
                severity=severity,
                source_type=source_type,
                created_at=inv.created_at,
                observation_count=obs_count,
                accuracy_meters=inv.location.accuracy_meters,
                location_type=inv.location.location_type,
                description=inv.description,
            ),
        )
        features.append(feature)

    return GeoJSONFeatureCollection(
        type="FeatureCollection",
        features=features,
    )
