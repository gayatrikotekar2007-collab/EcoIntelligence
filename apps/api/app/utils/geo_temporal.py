"""
Geospatial Temporal Trajectories Utilities (Phase 7B).

Provides deterministic geospatial distance, bearing, location resolution,
and spatial consistency classification across multi-temporal evidence captures.

Evidence-First Protocol:
Geospatial temporal analysis measures distance and spatial consistency between
recorded evidence coordinates. It does not establish environmental improvement,
degradation, pollution sources, or remediation success.
"""

from __future__ import annotations

import math
from typing import Optional, Tuple, TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.core import Evidence, Investigation


def calculate_haversine_distance(
    lat1: float, lon1: float, lat2: float, lon2: float
) -> float:
    """
    Calculate the great-circle distance between two points on the Earth's surface
    using the Haversine formula with the WGS84 mean earth radius (6,371,008.8 meters).

    Returns distance in meters rounded to 2 decimal places.
    """
    r_earth = 6371008.8  # WGS84 mean earth radius in meters

    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    # Ensure numerical stability
    a = min(1.0, max(0.0, a))
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))

    return round(r_earth * c, 2)


def calculate_bearing(
    lat1: float, lon1: float, lat2: float, lon2: float
) -> Optional[float]:
    """
    Calculate the initial compass bearing (forward azimuth) from point 1 to point 2.
    Returns bearing in degrees from true North [0.0, 360.0), or None if points are identical.
    """
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_lambda = math.radians(lon2 - lon1)

    y = math.sin(delta_lambda) * math.cos(phi2)
    x = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(
        delta_lambda
    )

    if abs(x) < 1e-12 and abs(y) < 1e-12:
        return 0.0

    bearing_rad = math.atan2(y, x)
    bearing_deg = (math.degrees(bearing_rad) + 360.0) % 360.0
    return round(bearing_deg, 1)


def resolve_evidence_location(
    ev: Evidence, investigation: Optional[Investigation] = None
) -> dict:
    """
    Determine the location of an evidence artifact, explicitly distinguishing the source:
    1. "GPS" - Evidence-specific GPS (hardware/device capture or EXIF)
    2. "USER_SUPPLIED" - User-supplied evidence coordinates
    3. "INVESTIGATION" - Investigation-level location (fallback if evidence has no specific coordinates)
    4. "UNAVAILABLE" - Unknown / unavailable location

    Does NOT fabricate coordinates or silently assume evidence was captured at investigation location.
    """
    meta = ev.parsed_metadata
    loc_meta = meta.get("location") if isinstance(meta.get("location"), dict) else {}

    # 1. Evidence has direct Location record
    if ev.location is not None and ev.location.latitude is not None and ev.location.longitude is not None:
        source_raw = (
            loc_meta.get("source")
            or meta.get("location_source")
            or ev.location.location_type
            or "USER_SUPPLIED"
        )
        norm_source = "GPS" if str(source_raw).upper() in ("GPS", "EVIDENCE_GPS") else "USER_SUPPLIED"
        return {
            "latitude": round(float(ev.location.latitude), 6),
            "longitude": round(float(ev.location.longitude), 6),
            "location_accuracy": (
                round(float(ev.location.accuracy_meters), 2)
                if ev.location.accuracy_meters is not None
                else None
            ),
            "location_source": norm_source,
        }

    # 2. Evidence parsed_metadata contains location dictionary
    if (
        "latitude" in loc_meta
        and "longitude" in loc_meta
        and loc_meta["latitude"] is not None
        and loc_meta["longitude"] is not None
    ):
        source_raw = loc_meta.get("source") or meta.get("location_source") or "USER_SUPPLIED"
        norm_source = "GPS" if str(source_raw).upper() in ("GPS", "EVIDENCE_GPS") else "USER_SUPPLIED"
        raw_acc = loc_meta.get("accuracy_meters") if loc_meta.get("accuracy_meters") is not None else loc_meta.get("accuracy")
        acc = round(float(raw_acc), 2) if raw_acc is not None else None
        return {
            "latitude": round(float(loc_meta["latitude"]), 6),
            "longitude": round(float(loc_meta["longitude"]), 6),
            "location_accuracy": acc,
            "location_source": norm_source,
        }

    # 3. Evidence linked to Observation with location
    if (
        ev.observation
        and ev.observation.location
        and ev.observation.location.latitude is not None
        and ev.observation.location.longitude is not None
    ):
        return {
            "latitude": round(float(ev.observation.location.latitude), 6),
            "longitude": round(float(ev.observation.location.longitude), 6),
            "location_accuracy": (
                round(float(ev.observation.location.accuracy_meters), 2)
                if ev.observation.location.accuracy_meters is not None
                else None
            ),
            "location_source": "USER_SUPPLIED",
        }

    # 4. Investigation-level location fallback (explicitly marked as INVESTIGATION)
    inv = investigation or ev.investigation
    if (
        inv is not None
        and inv.location is not None
        and inv.location.latitude is not None
        and inv.location.longitude is not None
    ):
        return {
            "latitude": round(float(inv.location.latitude), 6),
            "longitude": round(float(inv.location.longitude), 6),
            "location_accuracy": (
                round(float(inv.location.accuracy_meters), 2)
                if inv.location.accuracy_meters is not None
                else None
            ),
            "location_source": "INVESTIGATION",
        }

    # 5. Unknown / Unavailable location
    return {
        "latitude": None,
        "longitude": None,
        "location_accuracy": None,
        "location_source": "UNAVAILABLE",
    }


def classify_spatial_consistency(
    dist_meters: Optional[float],
    acc_before: Optional[float],
    acc_after: Optional[float],
    source_before: str,
    source_after: str,
) -> Tuple[str, str]:
    """
    Deterministically classify spatial consistency between consecutive evidence captures.

    States:
    - SAME_LOCATION: Captures are within physical location uncertainty radius.
    - NEARBY: Captures are within 100 meters, adjacent vicinity.
    - DISTANT: Captures are separated by >100 meters (substantially different locations).
    - UNKNOWN: Location data is unavailable or insufficient for one or both captures.
    """
    if (
        dist_meters is None
        or source_before == "UNAVAILABLE"
        or source_after == "UNAVAILABLE"
    ):
        return (
            "UNKNOWN",
            "Spatial consistency: UNKNOWN. Location data is insufficient to determine whether the captures represent the same physical site.",
        )

    # Combined location uncertainty
    acc_sum = (acc_before or 0.0) + (acc_after or 0.0)
    uncertainty_threshold = (
        max(acc_sum, 10.0)
        if (acc_before is not None or acc_after is not None)
        else 15.0
    )

    if dist_meters <= uncertainty_threshold:
        return (
            "SAME_LOCATION",
            f"Spatial consistency: HIGH (SAME_LOCATION). Separation of {dist_meters:.1f} m is within location uncertainty (±{uncertainty_threshold:.1f} m). Captures are geographically consistent for temporal comparison.",
        )
    elif dist_meters <= 100.0:
        return (
            "NEARBY",
            f"Spatial consistency: MODERATE (NEARBY). Separation of {dist_meters:.1f} m indicates adjacent vicinity. Small viewpoint or position differences may influence visual pixel variance.",
        )
    else:
        return (
            "DISTANT",
            f"Spatial consistency: LOW (DISTANT). Captures were taken at substantially different locations ({dist_meters:.1f} m apart). Visual differences should not be interpreted as temporal change at the same site.",
        )
