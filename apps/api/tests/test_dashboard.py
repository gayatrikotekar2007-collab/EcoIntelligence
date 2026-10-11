import io
import uuid
import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

VALID_PNG_BYTES = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4"
    b"\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
)


def random_email() -> str:
    return f"dash_tester_{uuid.uuid4().hex[:10]}@ecointelligence.org"


def register_user(display_name="Dashboard User"):
    email = random_email()
    password = "DashPassword123!"
    res = client.post(
        "/api/v1/auth/register",
        json={"email": email, "display_name": display_name, "password": password},
    )
    assert res.status_code == 201
    token = res.json()["access_token"]
    user_id = res.json()["user"]["id"]
    return token, user_id, email


def test_dashboard_stats_unauthenticated():
    res = client.get("/api/v1/dashboard/stats")
    assert res.status_code in (401, 403)


def test_dashboard_stats_fresh_user_zero_counts():
    token, _, _ = register_user()
    headers = {"Authorization": f"Bearer {token}"}
    res = client.get("/api/v1/dashboard/stats", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["active_investigations_count"] == 0
    assert data["total_investigations_count"] == 0
    assert data["evidence_count"] == 0
    assert data["observations_count"] == 0
    assert data["pending_actions_count"] == 0


def test_dashboard_stats_accurate_aggregation():
    token, _, _ = register_user("Primary Investigator")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create 3 investigations: 1 active, 1 draft, 1 completed
    res_inv1 = client.post(
        "/api/v1/investigations",
        headers=headers,
        json={"title": "Active Case", "category": "water_pollution", "status": "active"},
    )
    inv1_id = res_inv1.json()["id"]

    res_inv2 = client.post(
        "/api/v1/investigations",
        headers=headers,
        json={"title": "Draft Case", "category": "air_quality", "status": "draft"},
    )
    inv2_id = res_inv2.json()["id"]

    res_inv3 = client.post(
        "/api/v1/investigations",
        headers=headers,
        json={"title": "Completed Case", "category": "soil_contamination", "status": "completed"},
    )
    inv3_id = res_inv3.json()["id"]

    # 2. Add observations
    # 2 in inv1, 1 in inv2 => total 3
    client.post(
        f"/api/v1/investigations/{inv1_id}/observations",
        headers=headers,
        json={"category": "water_pollution", "description": "High turbidity", "severity": "high"},
    )
    client.post(
        f"/api/v1/investigations/{inv1_id}/observations",
        headers=headers,
        json={"category": "water_pollution", "description": "Chemical smell", "severity": "moderate"},
    )
    client.post(
        f"/api/v1/investigations/{inv2_id}/observations",
        headers=headers,
        json={"category": "air_quality", "description": "Particulate haze", "severity": "low"},
    )

    # 3. Add evidence
    # 1 in inv1, 1 in inv2 => total 2
    files1 = {"file": ("test1.png", io.BytesIO(VALID_PNG_BYTES), "image/png")}
    client.post(
        f"/api/v1/investigations/{inv1_id}/evidence",
        headers=headers,
        files=files1,
        data={"source_type": "observed", "description": "Photo of site 1"},
    )
    files2 = {"file": ("test2.png", io.BytesIO(VALID_PNG_BYTES), "image/png")}
    client.post(
        f"/api/v1/investigations/{inv2_id}/evidence",
        headers=headers,
        files=files2,
        data={"source_type": "observed", "description": "Photo of site 2"},
    )

    # 4. Add actions:
    # Action 1: PLANNED (pending)
    client.post(
        f"/api/v1/investigations/{inv1_id}/actions",
        headers=headers,
        json={"title": "Action Planned", "priority": "HIGH"},
    )
    # Action 2: IN_PROGRESS (pending)
    act2 = client.post(
        f"/api/v1/investigations/{inv1_id}/actions",
        headers=headers,
        json={"title": "Action In Progress", "priority": "MEDIUM"},
    ).json()["id"]
    client.patch(
        f"/api/v1/investigations/{inv1_id}/actions/{act2}",
        headers=headers,
        json={"status": "IN_PROGRESS"},
    )
    # Action 3: VERIFICATION_PENDING (pending)
    act3 = client.post(
        f"/api/v1/investigations/{inv1_id}/actions",
        headers=headers,
        json={"title": "Action Verif Pending", "priority": "MEDIUM"},
    ).json()["id"]
    client.patch(
        f"/api/v1/investigations/{inv1_id}/actions/{act3}",
        headers=headers,
        json={"status": "VERIFICATION_PENDING"},
    )
    # Action 4: COMPLETED (not pending)
    act4 = client.post(
        f"/api/v1/investigations/{inv1_id}/actions",
        headers=headers,
        json={"title": "Action Completed", "priority": "LOW"},
    ).json()["id"]
    client.patch(
        f"/api/v1/investigations/{inv1_id}/actions/{act4}",
        headers=headers,
        json={"status": "COMPLETED"},
    )
    # Action 5: CANCELLED (not pending)
    act5 = client.post(
        f"/api/v1/investigations/{inv1_id}/actions",
        headers=headers,
        json={"title": "Action Cancelled", "priority": "LOW"},
    ).json()["id"]
    client.patch(
        f"/api/v1/investigations/{inv1_id}/actions/{act5}",
        headers=headers,
        json={"status": "CANCELLED"},
    )

    # Fetch stats
    res_stats = client.get("/api/v1/dashboard/stats", headers=headers)
    assert res_stats.status_code == 200
    stats = res_stats.json()

    assert stats["active_investigations_count"] == 2  # active + draft
    assert stats["total_investigations_count"] == 3
    assert stats["observations_count"] == 3
    assert stats["evidence_count"] == 2
    assert stats["pending_actions_count"] == 3  # PLANNED + IN_PROGRESS + VERIFICATION_PENDING


def test_dashboard_stats_user_isolation():
    token_a, _, _ = register_user("User A")
    token_b, _, _ = register_user("User B")
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # User B creates 1 investigation, 1 obs, 1 ev, 1 action
    inv_b = client.post(
        "/api/v1/investigations",
        headers=headers_b,
        json={"title": "User B Case", "status": "active"},
    ).json()["id"]

    client.post(
        f"/api/v1/investigations/{inv_b}/observations",
        headers=headers_b,
        json={"category": "air_quality", "description": "B obs"},
    )

    client.post(
        f"/api/v1/investigations/{inv_b}/evidence",
        headers=headers_b,
        files={"file": ("b.png", io.BytesIO(VALID_PNG_BYTES), "image/png")},
        data={"source_type": "observed"},
    )

    client.post(
        f"/api/v1/investigations/{inv_b}/actions",
        headers=headers_b,
        json={"title": "B action"},
    )

    # User A stats must still be strictly 0
    res_a = client.get("/api/v1/dashboard/stats", headers=headers_a)
    assert res_a.status_code == 200
    data_a = res_a.json()
    assert data_a["active_investigations_count"] == 0
    assert data_a["total_investigations_count"] == 0
    assert data_a["observations_count"] == 0
    assert data_a["evidence_count"] == 0
    assert data_a["pending_actions_count"] == 0

    # User B stats must reflect their records
    res_b = client.get("/api/v1/dashboard/stats", headers=headers_b)
    assert res_b.status_code == 200
    data_b = res_b.json()
    assert data_b["active_investigations_count"] == 1
    assert data_b["observations_count"] == 1
    assert data_b["evidence_count"] == 1
    assert data_b["pending_actions_count"] == 1
