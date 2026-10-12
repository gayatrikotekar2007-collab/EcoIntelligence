import uuid
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.core import InvestigationStatus

client = TestClient(app)


def random_email() -> str:
    return f"inv_tester_{uuid.uuid4().hex[:10]}@ecointelligence.org"


def register_user(display_name="Investigation User"):
    email = random_email()
    password = "InvPassword123!"
    res = client.post(
        "/api/v1/auth/register",
        json={"email": email, "display_name": display_name, "password": password},
    )
    assert res.status_code == 201
    token = res.json()["access_token"]
    user_id = res.json()["user"]["id"]
    return token, user_id, email


def create_investigation(token: str, title: str, status: str = "active"):
    headers = {"Authorization": f"Bearer {token}"}
    res = client.post(
        "/api/v1/investigations",
        headers=headers,
        json={
            "title": title,
            "category": "water_pollution",
            "status": status,
            "description": f"Investigation with status {status}",
        },
    )
    assert res.status_code == 201
    return res.json()


def test_list_investigations_unauthenticated():
    res = client.get("/api/v1/investigations")
    assert res.status_code in (401, 403)


def test_list_investigations_backward_compatibility():
    token, _, _ = register_user()
    headers = {"Authorization": f"Bearer {token}"}

    inv1 = create_investigation(token, "Active Case", status="active")
    inv2 = create_investigation(token, "Draft Case", status="draft")
    inv3 = create_investigation(token, "Archived Case", status="archived")

    # Call with no query parameter (existing behavior)
    res = client.get("/api/v1/investigations", headers=headers)
    assert res.status_code == 200
    ids = [item["id"] for item in res.json()]
    assert inv1["id"] in ids
    assert inv2["id"] in ids
    assert inv3["id"] in ids
    assert len(res.json()) == 3


def test_list_investigations_filter_archived():
    token, _, _ = register_user()
    headers = {"Authorization": f"Bearer {token}"}

    inv_active = create_investigation(token, "Active River Site", status="active")
    inv_archived = create_investigation(token, "Historic 2024 Waste Case", status="archived")

    # Filter with ?status=archived
    res = client.get("/api/v1/investigations?status=archived", headers=headers)
    assert res.status_code == 200
    archived_list = res.json()
    assert len(archived_list) == 1
    assert archived_list[0]["id"] == inv_archived["id"]
    assert archived_list[0]["status"] == "archived"

    # Filter with ?status=active
    res_active = client.get("/api/v1/investigations?status=active", headers=headers)
    assert res_active.status_code == 200
    active_list = res_active.json()
    assert len(active_list) == 1
    assert active_list[0]["id"] == inv_active["id"]
    assert active_list[0]["status"] == "active"

    # Filter with ?status=completed (none exist yet)
    res_completed = client.get("/api/v1/investigations?status=completed", headers=headers)
    assert res_completed.status_code == 200
    assert len(res_completed.json()) == 0


def test_list_investigations_status_filter_user_isolation():
    token_a, _, _ = register_user("User A")
    token_b, _, _ = register_user("User B")

    create_investigation(token_a, "User A Active Case", status="active")
    create_investigation(token_a, "User A Archived Case", status="archived")
    inv_b_active = create_investigation(token_b, "User B Active Case", status="active")
    inv_b_archived = create_investigation(token_b, "User B Archived Case", status="archived")

    headers_b = {"Authorization": f"Bearer {token_b}"}

    # Filter with ?status=archived
    res = client.get("/api/v1/investigations?status=archived", headers=headers_b)
    assert res.status_code == 200
    assert len(res.json()) == 1
    assert res.json()[0]["id"] == inv_b_archived["id"]
    assert res.json()[0]["title"] == "User B Archived Case"

    # Filter with ?status=active
    res = client.get("/api/v1/investigations?status=active", headers=headers_b)
    assert res.status_code == 200
    assert len(res.json()) == 1
    assert res.json()[0]["id"] == inv_b_active["id"]
    assert res.json()[0]["title"] == "User B Active Case"

    # Filter with ?status=all
    res = client.get("/api/v1/investigations?status=all", headers=headers_b)
    assert res.status_code == 200
    b_ids = [item["id"] for item in res.json()]
    assert set(b_ids) == {inv_b_active["id"], inv_b_archived["id"]}

    # Omitted status
    res = client.get("/api/v1/investigations", headers=headers_b)
    assert res.status_code == 200
    b_ids = [item["id"] for item in res.json()]
    assert set(b_ids) == {inv_b_active["id"], inv_b_archived["id"]}


def test_list_investigations_invalid_status_returns_422():
    token, _, _ = register_user()
    headers = {"Authorization": f"Bearer {token}"}

    # Unrecognized status string
    res = client.get("/api/v1/investigations?status=invalid_val", headers=headers)
    assert res.status_code == 422
    err_body = res.json()
    assert "detail" in err_body
    assert "Invalid investigation status 'invalid_val'" in err_body["detail"]

    # Another unrecognized status
    res2 = client.get("/api/v1/investigations?status=unknown_status_123", headers=headers)
    assert res2.status_code == 422
    assert "Invalid investigation status 'unknown_status_123'" in res2.json()["detail"]


def test_list_investigations_all_sentinel():
    token, _, _ = register_user()
    headers = {"Authorization": f"Bearer {token}"}

    inv1 = create_investigation(token, "Case Alpha", status="active")
    inv2 = create_investigation(token, "Case Beta", status="draft")
    inv3 = create_investigation(token, "Case Gamma", status="archived")

    # Lowercase 'all'
    res_lower = client.get("/api/v1/investigations?status=all", headers=headers)
    assert res_lower.status_code == 200
    ids_lower = [i["id"] for i in res_lower.json()]
    assert set(ids_lower) == {inv1["id"], inv2["id"], inv3["id"]}

    # Uppercase 'ALL'
    res_upper = client.get("/api/v1/investigations?status=ALL", headers=headers)
    assert res_upper.status_code == 200
    ids_upper = [i["id"] for i in res_upper.json()]
    assert set(ids_upper) == {inv1["id"], inv2["id"], inv3["id"]}


def test_list_investigations_every_supported_status():
    token, _, _ = register_user()
    headers = {"Authorization": f"Bearer {token}"}

    created_by_status = {}
    for st in InvestigationStatus:
        inv = create_investigation(token, f"Case for {st.value}", status=st.value)
        created_by_status[st.value] = inv["id"]

    for st in InvestigationStatus:
        res = client.get(f"/api/v1/investigations?status={st.value}", headers=headers)
        assert res.status_code == 200
        items = res.json()
        assert len(items) == 1
        assert items[0]["id"] == created_by_status[st.value]
        assert items[0]["status"] == st.value
