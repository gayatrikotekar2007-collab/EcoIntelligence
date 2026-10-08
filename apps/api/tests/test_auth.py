import uuid
import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def random_email() -> str:
    return f"investigator_{uuid.uuid4().hex[:10]}@ecointelligence.org"


def test_user_registration_success():
    email = random_email()
    payload = {
        "email": email,
        "display_name": "Dr. Sarah Lin",
        "password": "SecurePassword123!",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert "user" in data
    user = data["user"]
    assert user["email"] == email.lower()
    assert user["display_name"] == "Dr. Sarah Lin"
    assert user["role"] == "user"
    assert user["is_active"] is True
    assert "password" not in user
    assert "password_hash" not in user


def test_duplicate_email_rejection():
    email = random_email()
    payload = {
        "email": email,
        "display_name": "First User",
        "password": "Password123!",
    }
    res1 = client.post("/api/v1/auth/register", json=payload)
    assert res1.status_code == 201

    # Attempt duplicate with different case
    dup_payload = {
        "email": email.upper(),
        "display_name": "Second User",
        "password": "Password123!",
    }
    res2 = client.post("/api/v1/auth/register", json=dup_payload)
    assert res2.status_code == 400
    data = res2.json()
    assert data["detail"] == "An account with this email already exists."


def test_user_login_success():
    email = random_email()
    password = "StrongAuthPassword99!"
    reg_payload = {
        "email": email,
        "display_name": "Alex Vance",
        "password": password,
    }
    res_reg = client.post("/api/v1/auth/register", json=reg_payload)
    assert res_reg.status_code == 201

    login_payload = {
        "email": email,
        "password": password,
    }
    res_login = client.post("/api/v1/auth/login", json=login_payload)
    assert res_login.status_code == 200
    data = res_login.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == email.lower()
    assert "password_hash" not in data["user"]


def test_invalid_password_rejection():
    email = random_email()
    password = "CorrectPassword123!"
    reg_payload = {
        "email": email,
        "display_name": "Test Investigator",
        "password": password,
    }
    res_reg = client.post("/api/v1/auth/register", json=reg_payload)
    assert res_reg.status_code == 201

    # Wrong password
    res_wrong = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "WrongPassword999!"},
    )
    assert res_wrong.status_code == 401
    assert res_wrong.json()["detail"] == "Email or password is incorrect."

    # Non-existent user
    res_nonexistent = client.post(
        "/api/v1/auth/login",
        json={"email": random_email(), "password": "SomePassword123!"},
    )
    assert res_nonexistent.status_code == 401
    assert res_nonexistent.json()["detail"] == "Email or password is incorrect."


def test_current_user_endpoint():
    email = random_email()
    password = "UserMeSecret123!"
    reg_res = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "display_name": "Elena Rostova",
            "password": password,
        },
    )
    token = reg_res.json()["access_token"]

    # Request /users/me with token
    headers = {"Authorization": f"Bearer {token}"}
    me_res = client.get("/api/v1/users/me", headers=headers)
    assert me_res.status_code == 200
    user_data = me_res.json()
    assert user_data["email"] == email.lower()
    assert user_data["display_name"] == "Elena Rostova"
    assert "password_hash" not in user_data


def test_protected_endpoints_without_auth():
    # /users/me without auth
    res_me = client.get("/api/v1/users/me")
    assert res_me.status_code == 401
    assert res_me.json()["detail"] == "Not authenticated"

    # /investigations without auth
    res_inv = client.get("/api/v1/investigations")
    assert res_inv.status_code == 401
    assert res_inv.json()["detail"] == "Not authenticated"


def test_protected_investigation_endpoint_with_auth_and_isolation():
    # User A
    email_a = random_email()
    reg_a = client.post(
        "/api/v1/auth/register",
        json={"email": email_a, "display_name": "User A", "password": "PasswordA123!"},
    )
    token_a = reg_a.json()["access_token"]
    user_a_id = reg_a.json()["user"]["id"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # User B
    email_b = random_email()
    reg_b = client.post(
        "/api/v1/auth/register",
        json={"email": email_b, "display_name": "User B", "password": "PasswordB123!"},
    )
    token_b = reg_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # User A creates an investigation
    create_res = client.post(
        "/api/v1/investigations",
        headers=headers_a,
        json={
            "title": "Industrial Runoff in River Alpha",
            "description": "Visible discoloration and chemical odor observed near discharge canal.",
            "category": "water_pollution",
        },
    )
    assert create_res.status_code == 201
    inv_a = create_res.json()
    assert inv_a["owner_id"] == user_a_id
    assert inv_a["title"] == "Industrial Runoff in River Alpha"
    inv_id = inv_a["id"]

    # User A lists investigations -> sees it
    list_a = client.get("/api/v1/investigations", headers=headers_a)
    assert list_a.status_code == 200
    ids_a = [inv["id"] for inv in list_a.json()]
    assert inv_id in ids_a

    # User B lists investigations -> does NOT see User A's investigation
    list_b = client.get("/api/v1/investigations", headers=headers_b)
    assert list_b.status_code == 200
    ids_b = [inv["id"] for inv in list_b.json()]
    assert inv_id not in ids_b

    # User B attempts to access User A's investigation by ID -> 404
    get_b = client.get(f"/api/v1/investigations/{inv_id}", headers=headers_b)
    assert get_b.status_code == 404


def test_logout_endpoint():
    res = client.post("/api/v1/auth/logout")
    assert res.status_code == 200
    assert res.json()["message"] == "Logged out successfully"
