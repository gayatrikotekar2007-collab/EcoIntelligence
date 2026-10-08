"""
Tests for Phase 7B — Geospatial Temporal Trajectories.

Verifies:
1. Temporal sequence returns evidence coordinates and sources
2. Missing evidence coordinates handled gracefully (UNAVAILABLE)
3. Distance calculation is geospatially accurate (Haversine/geodesic)
4. Same-location classification (e.g. 8.4m within uncertainty)
5. Nearby classification (e.g. ~45m adjacent vicinity)
6. Distant classification (e.g. 487m low spatial consistency with warning)
7. Unknown classification when coordinates are unavailable
8. Location accuracy included in sequence items and adjacent comparisons
9. Cross-user access rejected (403 Forbidden)
10. Cross-investigation evidence rejected (404 Not Found)
11. Temporal sequence remains strictly chronological
12. Evidence-first guardrails and language preserved
13. GET evidence location endpoint functions and enforces ownership
"""

from datetime import datetime, timezone, timedelta
import io
import math
import uuid
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.utils.geo_temporal import (
    calculate_haversine_distance,
    calculate_bearing,
    classify_spatial_consistency,
)

client = TestClient(app)


def make_test_image(width=100, height=100, color=(100, 150, 200), draw_box=None):
    from PIL import Image, ImageDraw
    img = Image.new("RGB", (width, height), color=color)
    if draw_box:
        draw = ImageDraw.Draw(img)
        draw.rectangle(draw_box, fill=(255, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def random_email() -> str:
    return f"geo_tester_{uuid.uuid4().hex[:10]}@ecointelligence.org"


def register_user(display_name="Trajectory Investigator"):
    email = random_email()
    password = "TestPassword1234!"
    res = client.post(
        "/api/v1/auth/register",
        json={"email": email, "display_name": display_name, "password": password},
    )
    assert res.status_code == 201
    token = res.json()["access_token"]
    user_id = res.json()["user"]["id"]
    return token, user_id, email


def create_investigation(token, title="Geospatial Trajectory Study", with_location=False):
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "title": title,
        "category": "wetland_monitoring",
        "description": "Trajectory evaluation over marshland test area.",
        "severity": "moderate",
    }
    if with_location:
        payload["location_latitude"] = 45.500000
        payload["location_longitude"] = -73.567000
        payload["location_accuracy_meters"] = 10.0
    res = client.post(
        "/api/v1/investigations",
        headers=headers,
        json=payload,
    )
    assert res.status_code == 201
    return res.json()["id"]


def upload_img_with_coords(
    token, inv_id, filename="capture.png", captured_at=None,
    lat=None, lon=None, accuracy=None, loc_source=None
):
    headers = {"Authorization": f"Bearer {token}"}
    data = {
        "source_type": "observed",
        "description": f"Capture for {filename}",
    }
    if captured_at:
        data["captured_at"] = captured_at.isoformat()
    if lat is not None:
        data["location_latitude"] = str(lat)
    if lon is not None:
        data["location_longitude"] = str(lon)
    if accuracy is not None:
        data["location_accuracy"] = str(accuracy)
    if loc_source is not None:
        data["location_source"] = loc_source

    img_bytes = make_test_image(100, 100, color=(50, 75, 100))
    files = {
        "file": (filename, io.BytesIO(img_bytes), "image/png"),
    }
    res = client.post(
        f"/api/v1/investigations/{inv_id}/evidence",
        headers=headers,
        data=data,
        files=files,
    )
    assert res.status_code == 201, res.text
    return res.json()["id"]


# =========================================================================
# TEST 1: Distance calculation unit tests (Geospatial correctness)
# =========================================================================
def test_geo_distance_calculation_haversine():
    # Test identical coordinates return 0.0 distance
    d0 = calculate_haversine_distance(45.500000, -73.567000, 45.500000, -73.567000)
    assert d0 == 0.0

    # 1 degree of latitude is approximately 111,139 meters
    d_1deg = calculate_haversine_distance(45.0, 0.0, 46.0, 0.0)
    assert 111000 < d_1deg < 112000

    # Small displacement: ~8.4 meters
    # At latitude 45.5 deg, 1 second of latitude (~0.000075 deg) is ~8.34 meters
    lat1 = 45.500000
    lon1 = -73.567000
    lat2 = 45.500075
    lon2 = -73.567000
    d_small = calculate_haversine_distance(lat1, lon1, lat2, lon2)
    assert 8.0 <= d_small <= 9.0

    # Bearing calculation
    b = calculate_bearing(lat1, lon1, lat2, lon2)
    assert b is not None
    # Directly north is 0 degrees
    assert 355.0 <= b or b <= 5.0


# =========================================================================
# TEST 2: Temporal sequence returns evidence coordinates and sources
# =========================================================================
def test_temporal_sequence_returns_evidence_coordinates():
    token, _, _ = register_user("Geo Agent Coords")
    inv_id = create_investigation(token, "Coords Investigation")

    t0 = datetime(2026, 1, 10, 10, 0, tzinfo=timezone.utc)
    id1 = upload_img_with_coords(token, inv_id, "t1.png", t0, lat=45.5001, lon=-73.5671, accuracy=5.0, loc_source="GPS")
    id2 = upload_img_with_coords(token, inv_id, "t2.png", t0 + timedelta(days=1), lat=45.5002, lon=-73.5672, accuracy=6.0, loc_source="USER_SUPPLIED")
    id3 = upload_img_with_coords(token, inv_id, "t3.png", t0 + timedelta(days=2), lat=45.5003, lon=-73.5673, accuracy=7.0, loc_source="GPS")

    headers = {"Authorization": f"Bearer {token}"}
    res = client.post(
        f"/api/v1/investigations/{inv_id}/evidence/temporal-sequence",
        headers=headers,
        json={"evidence_ids": [id1, id2, id3]},
    )
    assert res.status_code == 200
    data = res.json()
    seq = data["sequence"]
    assert len(seq) == 3

    assert seq[0]["evidence_id"] == id1
    assert seq[0]["latitude"] == 45.5001
    assert seq[0]["longitude"] == -73.5671
    assert seq[0]["location_source"] == "GPS"
    assert seq[0]["location_accuracy"] == 5.0

    assert seq[1]["evidence_id"] == id2
    assert seq[1]["location_source"] == "USER_SUPPLIED"
    assert seq[1]["location_accuracy"] == 6.0

    assert seq[2]["evidence_id"] == id3
    assert seq[2]["location_source"] == "GPS"


# =========================================================================
# TEST 3: Missing evidence coordinates handled correctly (UNAVAILABLE)
# =========================================================================
def test_missing_evidence_coordinates_handled_correctly():
    token, _, _ = register_user("No Coords Agent")
    inv_id = create_investigation(token, "No Location Investigation", with_location=False)

    t0 = datetime(2026, 2, 1, 12, 0, tzinfo=timezone.utc)
    id1 = upload_img_with_coords(token, inv_id, "n1.png", t0)
    id2 = upload_img_with_coords(token, inv_id, "n2.png", t0 + timedelta(hours=1))
    id3 = upload_img_with_coords(token, inv_id, "n3.png", t0 + timedelta(hours=2))

    headers = {"Authorization": f"Bearer {token}"}
    res = client.post(
        f"/api/v1/investigations/{inv_id}/evidence/temporal-sequence",
        headers=headers,
        json={"evidence_ids": [id1, id2, id3]},
    )
    assert res.status_code == 200
    data = res.json()
    for item in data["sequence"]:
        assert item["latitude"] is None
        assert item["longitude"] is None
        assert item["location_accuracy"] is None
        assert item["location_source"] == "UNAVAILABLE"

    # All comparisons should be UNKNOWN consistency
    for comp in data["comparisons"]:
        assert comp["distance_meters"] is None
        assert comp["spatial_consistency"] == "UNKNOWN"
        assert "Spatial consistency: UNKNOWN" in comp["spatial_consistency_message"]


# =========================================================================
# TEST 4: Investigation location fallback when evidence coordinates absent
# =========================================================================
def test_investigation_location_fallback_explicitly_marked():
    token, _, _ = register_user("Fallback Agent")
    inv_id = create_investigation(token, "Investigation Location Fallback", with_location=True)

    t0 = datetime(2026, 3, 1, 12, 0, tzinfo=timezone.utc)
    id1 = upload_img_with_coords(token, inv_id, "f1.png", t0)
    id2 = upload_img_with_coords(token, inv_id, "f2.png", t0 + timedelta(hours=1))
    id3 = upload_img_with_coords(token, inv_id, "f3.png", t0 + timedelta(hours=2))

    headers = {"Authorization": f"Bearer {token}"}
    res = client.post(
        f"/api/v1/investigations/{inv_id}/evidence/temporal-sequence",
        headers=headers,
        json={"evidence_ids": [id1, id2, id3]},
    )
    assert res.status_code == 200
    data = res.json()
    for item in data["sequence"]:
        assert item["latitude"] == 45.500000
        assert item["longitude"] == -73.567000
        assert item["location_accuracy"] == 10.0
        assert item["location_source"] == "INVESTIGATION"


# =========================================================================
# TEST 5: Spatial consistency - SAME_LOCATION
# =========================================================================
def test_same_location_classification():
    # 8.4m displacement with ±12m combined uncertainty -> SAME_LOCATION
    state, msg = classify_spatial_consistency(
        dist_meters=8.4,
        acc_before=5.0,
        acc_after=7.0,
        source_before="GPS",
        source_after="GPS",
    )
    assert state == "SAME_LOCATION"
    assert "SAME_LOCATION" in msg
    assert "8.4 m" in msg

    # End-to-end integration test
    token, _, _ = register_user("Same Loc Agent")
    inv_id = create_investigation(token, "Same Loc Study")

    t0 = datetime(2026, 4, 1, 10, 0, tzinfo=timezone.utc)
    # Small offset: ~8.4m
    id1 = upload_img_with_coords(token, inv_id, "s1.png", t0, lat=45.500000, lon=-73.567000, accuracy=5.0, loc_source="GPS")
    id2 = upload_img_with_coords(token, inv_id, "s2.png", t0 + timedelta(days=1), lat=45.500075, lon=-73.567000, accuracy=7.0, loc_source="GPS")
    id3 = upload_img_with_coords(token, inv_id, "s3.png", t0 + timedelta(days=2), lat=45.500090, lon=-73.567000, accuracy=6.0, loc_source="GPS")

    headers = {"Authorization": f"Bearer {token}"}
    res = client.post(
        f"/api/v1/investigations/{inv_id}/evidence/temporal-sequence",
        headers=headers,
        json={"evidence_ids": [id1, id2, id3]},
    )
    assert res.status_code == 200
    comps = res.json()["comparisons"]
    assert comps[0]["spatial_consistency"] == "SAME_LOCATION"
    assert comps[0]["distance_meters"] is not None
    assert comps[0]["accuracy_before_meters"] == 5.0
    assert comps[0]["accuracy_after_meters"] == 7.0


# =========================================================================
# TEST 6: Spatial consistency - NEARBY
# =========================================================================
def test_nearby_classification():
    # 45m displacement with ±10m uncertainty -> NEARBY
    state, msg = classify_spatial_consistency(
        dist_meters=45.0,
        acc_before=5.0,
        acc_after=5.0,
        source_before="GPS",
        source_after="GPS",
    )
    assert state == "NEARBY"
    assert "NEARBY" in msg
    assert "45.0 m" in msg

    # End-to-end integration test
    token, _, _ = register_user("Nearby Agent")
    inv_id = create_investigation(token, "Nearby Study")

    t0 = datetime(2026, 4, 10, 10, 0, tzinfo=timezone.utc)
    # ~0.0004 deg lat displacement is ~44.5 meters
    id1 = upload_img_with_coords(token, inv_id, "nb1.png", t0, lat=45.500000, lon=-73.567000, accuracy=4.0, loc_source="GPS")
    id2 = upload_img_with_coords(token, inv_id, "nb2.png", t0 + timedelta(days=1), lat=45.500400, lon=-73.567000, accuracy=4.0, loc_source="GPS")
    id3 = upload_img_with_coords(token, inv_id, "nb3.png", t0 + timedelta(days=2), lat=45.500750, lon=-73.567000, accuracy=4.0, loc_source="GPS")

    headers = {"Authorization": f"Bearer {token}"}
    res = client.post(
        f"/api/v1/investigations/{inv_id}/evidence/temporal-sequence",
        headers=headers,
        json={"evidence_ids": [id1, id2, id3]},
    )
    assert res.status_code == 200
    comps = res.json()["comparisons"]
    assert comps[0]["spatial_consistency"] == "NEARBY"


# =========================================================================
# TEST 7: Spatial consistency - DISTANT (Low spatial consistency warning)
# =========================================================================
def test_distant_classification_and_warning():
    # 487m displacement -> DISTANT
    state, msg = classify_spatial_consistency(
        dist_meters=487.0,
        acc_before=5.0,
        acc_after=5.0,
        source_before="GPS",
        source_after="GPS",
    )
    assert state == "DISTANT"
    assert "LOW" in msg
    assert "substantially different locations" in msg

    # End-to-end integration test
    token, _, _ = register_user("Distant Agent")
    inv_id = create_investigation(token, "Distant Study")

    t0 = datetime(2026, 5, 1, 10, 0, tzinfo=timezone.utc)
    # 0.0045 deg lat displacement is ~500 meters
    id1 = upload_img_with_coords(token, inv_id, "d1.png", t0, lat=45.500000, lon=-73.567000, accuracy=5.0, loc_source="GPS")
    id2 = upload_img_with_coords(token, inv_id, "d2.png", t0 + timedelta(days=1), lat=45.504500, lon=-73.567000, accuracy=5.0, loc_source="GPS")
    id3 = upload_img_with_coords(token, inv_id, "d3.png", t0 + timedelta(days=2), lat=45.509000, lon=-73.567000, accuracy=5.0, loc_source="GPS")

    headers = {"Authorization": f"Bearer {token}"}
    res = client.post(
        f"/api/v1/investigations/{inv_id}/evidence/temporal-sequence",
        headers=headers,
        json={"evidence_ids": [id1, id2, id3]},
    )
    assert res.status_code == 200
    comps = res.json()["comparisons"]
    assert comps[0]["spatial_consistency"] == "DISTANT"
    assert comps[0]["distance_meters"] > 400.0

    # Verify Step 9 warning presence in warnings list
    found_warning = any(
        "substantially different locations" in w for w in comps[0]["warnings"]
    )
    assert found_warning, "Expected Step 9 distant location warning in comparison warnings."


# =========================================================================
# TEST 8: Spatial consistency - UNKNOWN
# =========================================================================
def test_unknown_classification():
    state, msg = classify_spatial_consistency(
        dist_meters=None,
        acc_before=None,
        acc_after=None,
        source_before="UNAVAILABLE",
        source_after="UNAVAILABLE",
    )
    assert state == "UNKNOWN"
    assert "insufficient to determine" in msg


# =========================================================================
# TEST 9: Cross-user access rejected (403 Forbidden)
# =========================================================================
def test_cross_user_access_rejected():
    token_owner, _, _ = register_user("Geo Owner")
    token_other, _, _ = register_user("Geo Intruder")
    inv_id = create_investigation(token_owner, "Private Geo Inv")

    t0 = datetime(2026, 6, 1, 10, 0, tzinfo=timezone.utc)
    id1 = upload_img_with_coords(token_owner, inv_id, "o1.png", t0, lat=45.5, lon=-73.5)
    id2 = upload_img_with_coords(token_owner, inv_id, "o2.png", t0 + timedelta(hours=1), lat=45.5001, lon=-73.5)
    id3 = upload_img_with_coords(token_owner, inv_id, "o3.png", t0 + timedelta(hours=2), lat=45.5002, lon=-73.5)

    headers_other = {"Authorization": f"Bearer {token_other}"}

    # 1. Temporal sequence forbidden
    res = client.post(
        f"/api/v1/investigations/{inv_id}/evidence/temporal-sequence",
        headers=headers_other,
        json={"evidence_ids": [id1, id2, id3]},
    )
    assert res.status_code == 403

    # 2. Evidence location endpoint forbidden
    res_loc = client.get(
        f"/api/v1/investigations/{inv_id}/evidence/{id1}/location",
        headers=headers_other,
    )
    assert res_loc.status_code == 403


# =========================================================================
# TEST 10: Cross-investigation evidence rejected (404 Not Found)
# =========================================================================
def test_cross_investigation_evidence_rejected():
    token, _, _ = register_user("Cross Inv Agent")
    inv1 = create_investigation(token, "Inv 1")
    inv2 = create_investigation(token, "Inv 2")

    t0 = datetime(2026, 7, 1, 10, 0, tzinfo=timezone.utc)
    id1 = upload_img_with_coords(token, inv1, "inv1_a.png", t0, lat=45.5, lon=-73.5)
    id2 = upload_img_with_coords(token, inv1, "inv1_b.png", t0 + timedelta(hours=1), lat=45.5001, lon=-73.5)
    id3_other = upload_img_with_coords(token, inv2, "inv2_c.png", t0 + timedelta(hours=2), lat=45.5002, lon=-73.5)

    headers = {"Authorization": f"Bearer {token}"}
    res = client.post(
        f"/api/v1/investigations/{inv1}/evidence/temporal-sequence",
        headers=headers,
        json={"evidence_ids": [id1, id2, id3_other]},
    )
    assert res.status_code == 404
    assert str(id3_other) in res.json()["detail"]


# =========================================================================
# TEST 11: Temporal sequence remains strictly chronological
# =========================================================================
def test_temporal_sequence_remains_chronological_with_geo():
    token, _, _ = register_user("Chrono Geo Agent")
    inv_id = create_investigation(token, "Chrono Geo Study")

    t1 = datetime(2026, 8, 1, 10, 0, tzinfo=timezone.utc)
    t2 = datetime(2026, 8, 15, 10, 0, tzinfo=timezone.utc)
    t3 = datetime(2026, 8, 30, 10, 0, tzinfo=timezone.utc)

    id_current = upload_img_with_coords(token, inv_id, "current.png", t3, lat=45.5003, lon=-73.5673)
    id_baseline = upload_img_with_coords(token, inv_id, "baseline.png", t1, lat=45.5001, lon=-73.5671)
    id_inter = upload_img_with_coords(token, inv_id, "intermediate.png", t2, lat=45.5002, lon=-73.5672)

    headers = {"Authorization": f"Bearer {token}"}
    # Pass out of order: [current, baseline, intermediate]
    res = client.post(
        f"/api/v1/investigations/{inv_id}/evidence/temporal-sequence",
        headers=headers,
        json={"evidence_ids": [id_current, id_baseline, id_inter]},
    )
    assert res.status_code == 200
    seq = res.json()["sequence"]
    assert seq[0]["evidence_id"] == id_baseline
    assert seq[0]["role"] == "BASELINE"
    assert seq[1]["evidence_id"] == id_inter
    assert seq[1]["role"] == "INTERMEDIATE"
    assert seq[2]["evidence_id"] == id_current
    assert seq[2]["role"] == "CURRENT"


# =========================================================================
# TEST 12: Evidence-first language and limitations preserved
# =========================================================================
def test_evidence_first_language_preserved():
    token, _, _ = register_user("Guardrail Agent")
    inv_id = create_investigation(token, "Guardrail Study")

    t0 = datetime(2026, 9, 1, 10, 0, tzinfo=timezone.utc)
    id1 = upload_img_with_coords(token, inv_id, "g1.png", t0, lat=45.5001, lon=-73.5671)
    id2 = upload_img_with_coords(token, inv_id, "g2.png", t0 + timedelta(hours=1), lat=45.5002, lon=-73.5672)
    id3 = upload_img_with_coords(token, inv_id, "g3.png", t0 + timedelta(hours=2), lat=45.5003, lon=-73.5673)

    headers = {"Authorization": f"Bearer {token}"}
    res = client.post(
        f"/api/v1/investigations/{inv_id}/evidence/temporal-sequence",
        headers=headers,
        json={"evidence_ids": [id1, id2, id3]},
    )
    assert res.status_code == 200
    data = res.json()

    # Limitations must not claim environmental causes
    limits = data["limitations"]
    assert len(limits) >= 3
    assert any("do not establish environmental improvement or degradation" in l for l in limits)
    assert any("Ground-truth verification" in l for l in limits)


# =========================================================================
# TEST 13: GET /evidence/{id}/location endpoint
# =========================================================================
def test_get_evidence_location_endpoint():
    token, _, _ = register_user("Location Endpoint Agent")
    inv_id = create_investigation(token, "Location Endpoint Study")

    t0 = datetime(2026, 9, 15, 10, 0, tzinfo=timezone.utc)
    ev_id = upload_img_with_coords(
        token, inv_id, "loc_endpoint.png", t0,
        lat=45.501234, lon=-73.567890, accuracy=4.5, loc_source="GPS"
    )

    headers = {"Authorization": f"Bearer {token}"}
    res = client.get(
        f"/api/v1/investigations/{inv_id}/evidence/{ev_id}/location",
        headers=headers,
    )
    assert res.status_code == 200
    loc_data = res.json()
    assert loc_data["evidence_id"] == ev_id
    assert loc_data["investigation_id"] == inv_id
    assert loc_data["latitude"] == 45.501234
    assert loc_data["longitude"] == -73.567890
    assert loc_data["location_accuracy"] == 4.5
    assert loc_data["location_source"] == "GPS"
