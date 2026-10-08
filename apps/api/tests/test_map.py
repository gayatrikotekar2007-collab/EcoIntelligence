import uuid
import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def random_email() -> str:
    return f"geo_tester_{uuid.uuid4().hex[:10]}@ecointelligence.org"


def register_user(display_name="Map Investigator"):
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


def test_map_investigations_unauthorized():
    # 6 & 7: map endpoint requires authentication
    res = client.get("/api/v1/map/investigations")
    assert res.status_code == 401
    assert res.json()["detail"] == "Not authenticated"


def test_map_investigations_empty():
    token, _, _ = register_user("Empty Map User")
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/api/v1/map/investigations", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["type"] == "FeatureCollection"
    assert data["features"] == []


def test_map_investigations_with_and_without_coordinates():
    token, user_id, _ = register_user("GIS Specialist")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create an investigation WITH location
    res1 = client.post(
        "/api/v1/investigations",
        headers=headers,
        json={
            "title": "Mangrove Degradation Zone",
            "category": "vegetation_loss",
            "description": "Dieback observed near southern estuary.",
            "location_latitude": 13.0827,
            "location_longitude": 80.2707,
            "location_accuracy_meters": 5.0,
            "location_type": "point",
            "initial_observation": "Leaves show necrosis and salinization signs.",
            "initial_severity": "high",
            "initial_source_type": "observed",
        },
    )
    assert res1.status_code == 201
    inv_with_loc_id = res1.json()["id"]

    # 2. Create an investigation WITHOUT location
    res2 = client.post(
        "/api/v1/investigations",
        headers=headers,
        json={
            "title": "Unanchored Air Quality Inquiry",
            "category": "air_quality",
            "description": "General assessment pending field pin.",
        },
    )
    assert res2.status_code == 201

    # 3. Retrieve map investigations
    map_res = client.get("/api/v1/map/investigations", headers=headers)
    assert map_res.status_code == 200
    geo = map_res.json()

    # 5. Valid GeoJSON structure
    assert geo["type"] == "FeatureCollection"
    assert isinstance(geo["features"], list)
    # 4. Only the investigation with coordinates is returned
    assert len(geo["features"]) == 1

    feature = geo["features"][0]
    assert feature["type"] == "Feature"
    assert feature["geometry"]["type"] == "Point"
    # GeoJSON coordinates are [longitude, latitude]
    assert feature["geometry"]["coordinates"] == [80.2707, 13.0827]
    assert feature["properties"]["id"] == inv_with_loc_id
    assert feature["properties"]["title"] == "Mangrove Degradation Zone"
    assert feature["properties"]["category"] == "vegetation_loss"
    assert feature["properties"]["severity"] == "high"
    assert feature["properties"]["source_type"] == "observed"
    assert feature["properties"]["accuracy_meters"] == 5.0


def test_map_investigations_ownership_isolation():
    # User A creates mapped investigation
    token_a, user_a_id, _ = register_user("User Alpha")
    headers_a = {"Authorization": f"Bearer {token_a}"}

    res_a = client.post(
        "/api/v1/investigations",
        headers=headers_a,
        json={
            "title": "Private Creek Contamination",
            "category": "water_pollution",
            "location_latitude": 37.7749,
            "location_longitude": -122.4194,
        },
    )
    assert res_a.status_code == 201
    id_a = res_a.json()["id"]

    # User B checks their map
    token_b, _, _ = register_user("User Beta")
    headers_b = {"Authorization": f"Bearer {token_b}"}

    map_b = client.get("/api/v1/map/investigations", headers=headers_b)
    assert map_b.status_code == 200
    b_features = map_b.json()["features"]
    # 3. Another user's private investigation does NOT appear
    b_ids = [f["properties"]["id"] for f in b_features]
    assert id_a not in b_ids


def test_observation_crud_and_timeline():
    token, user_id, _ = register_user("Field Observer")
    headers = {"Authorization": f"Bearer {token}"}

    # Create investigation
    inv_res = client.post(
        "/api/v1/investigations",
        headers=headers,
        json={"title": "Wetland Survey", "category": "water_pollution"},
    )
    assert inv_res.status_code == 201
    inv_id = inv_res.json()["id"]

    # 1. Add observation
    obs_res = client.post(
        f"/api/v1/investigations/{inv_id}/observations",
        headers=headers,
        json={
            "category": "water_pollution",
            "description": "Turbidity exceeds nominal baseline.",
            "severity": "high",
            "source_type": "observed",
            "confidence": 90.0,
            "location_latitude": 12.5,
            "location_longitude": 77.8,
        },
    )
    assert obs_res.status_code == 201
    obs_data = obs_res.json()
    assert obs_data["description"] == "Turbidity exceeds nominal baseline."
    obs_id = obs_data["id"]

    # 2. List observations
    list_obs = client.get(
        f"/api/v1/investigations/{inv_id}/observations",
        headers=headers,
    )
    assert list_obs.status_code == 200
    assert len(list_obs.json()) == 1

    # 3. Update observation
    patch_obs = client.patch(
        f"/api/v1/investigations/{inv_id}/observations/{obs_id}",
        headers=headers,
        json={"confidence": 95.0, "severity": "critical"},
    )
    assert patch_obs.status_code == 200
    assert patch_obs.json()["severity"] == "critical"
    assert patch_obs.json()["confidence"] == 95.0

    # 4. Check timeline
    time_res = client.get(
        f"/api/v1/investigations/{inv_id}/timeline",
        headers=headers,
    )
    assert time_res.status_code == 200
    events = [e["event_type"] for e in time_res.json()]
    assert "investigation_created" in events
    assert "observation_added" in events
    assert "observation_updated" in events

    # 5. Delete observation
    del_res = client.delete(
        f"/api/v1/investigations/{inv_id}/observations/{obs_id}",
        headers=headers,
    )
    assert del_res.status_code == 204

    # Verify deleted
    list_obs2 = client.get(
        f"/api/v1/investigations/{inv_id}/observations",
        headers=headers,
    )
    assert len(list_obs2.json()) == 0
