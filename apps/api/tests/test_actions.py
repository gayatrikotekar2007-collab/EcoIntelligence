"""
Tests for Phase 8C — Remediation & Action Verification.

Covers:
1. Create action plan (full fields, investigator rationale)
2. List action plans with filters & computed counts
3. Retrieve action plan detail
4. Update action plan (fields & status change)
5. Delete action plan & verify cascade
6. Unauthenticated request rejected (401)
7. Cross-user access rejected (403)
8. Action in another investigation rejected (404)
9. Hypothesis from another investigation rejected (400)
10. Valid hypothesis in same investigation successfully linked
11. Add verification criterion (numeric & observation types)
12. List verification criteria
13. Update criterion & reject cross-action criterion modification
14. Delete criterion
15. Link evidence & retrieve action evidence
16. Duplicate evidence link rejected (400)
17. Cross-investigation evidence rejected (400)
18. Unlink evidence
19. Link observation & retrieve action observations
20. Duplicate observation link rejected (400)
21. Cross-investigation observation rejected (400)
22. Unlink observation
23. Deterministic numeric verification: PASS (observed <= target) => VERIFIED
24. Deterministic numeric verification: FAIL (observed > target) => NOT_VERIFIED
25. Mixed criteria verification => PARTIALLY_VERIFIED
26. Inconclusive assessment verification
27. Investigator-recorded evaluation for qualitative criteria
28. Evaluation mode tracking (numeric_comparison vs investigator_recorded)
29. Verification updates Action status
30. Criterion from another action rejected during verification (400)
31. Timeline events recorded with neutral language
"""

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
    return f"action_tester_{uuid.uuid4().hex[:10]}@ecointelligence.org"


def register_user(display_name="Remediation Investigator"):
    email = random_email()
    password = "ActionPassword123!"
    res = client.post(
        "/api/v1/auth/register",
        json={"email": email, "display_name": display_name, "password": password},
    )
    assert res.status_code == 201
    token = res.json()["access_token"]
    user_id = res.json()["user"]["id"]
    return token, user_id, email


def create_investigation(token, title="Creek Runoff Remediation Study"):
    headers = {"Authorization": f"Bearer {token}"}
    res = client.post(
        "/api/v1/investigations",
        headers=headers,
        json={
            "title": title,
            "category": "water_contamination",
            "description": "Investigating high runoff sediment load and downstream turbidity.",
            "severity": "high",
        },
    )
    assert res.status_code == 201
    return res.json()["id"]


def create_hypothesis(token, inv_id, title="Uncontrolled construction site runoff"):
    headers = {"Authorization": f"Bearer {token}"}
    res = client.post(
        f"/api/v1/investigations/{inv_id}/hypotheses",
        headers=headers,
        json={
            "title": title,
            "description": "Sediment runoff from adjacent grading is entering storm canal.",
            "status": "OPEN",
            "confidence": "MEDIUM",
        },
    )
    assert res.status_code == 201
    return res.json()["id"]


def upload_evidence(token, inv_id, filename="culvert_runoff.png"):
    headers = {"Authorization": f"Bearer {token}"}
    files = {"file": (filename, io.BytesIO(VALID_PNG_BYTES), "image/png")}
    data = {
        "source_type": "observed",
        "description": "Field photographic capture of culvert discharge.",
        "verification_state": "verified",
    }
    res = client.post(
        f"/api/v1/investigations/{inv_id}/evidence",
        headers=headers,
        files=files,
        data=data,
    )
    assert res.status_code == 201
    return res.json()["id"]


def create_observation(token, inv_id, desc="Turbidity elevated above background at outlet."):
    headers = {"Authorization": f"Bearer {token}"}
    res = client.post(
        f"/api/v1/investigations/{inv_id}/observations",
        headers=headers,
        json={
            "category": "water_pollution",
            "description": desc,
            "severity": "high",
            "source_type": "observed",
            "confidence": 90,
        },
    )
    assert res.status_code == 201
    return res.json()["id"]


# ----------------------------------------------------------------------
# 1. Action CRUD Tests
# ----------------------------------------------------------------------

def test_1_create_action_plan_success():
    token, _, _ = register_user()
    inv_id = create_investigation(token)
    hypo_id = create_hypothesis(token, inv_id)

    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "title": "Install Sediment Silt Fencing",
        "description": "Erect geotextile silt barriers along eastern grading perimeter.",
        "rationale": "Direct sediment pathway observed leading into storm drain during heavy rain.",
        "hypothesis_id": hypo_id,
        "priority": "HIGH",
        "responsible_person": "Stormwater Control Team",
        "planned_start_date": "2026-10-15T08:00:00Z",
        "target_date": "2026-10-20T17:00:00Z",
    }
    res = client.post(f"/api/v1/investigations/{inv_id}/actions", headers=headers, json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["title"] == "Install Sediment Silt Fencing"
    assert data["rationale"] == payload["rationale"]
    assert data["status"] == "PLANNED"
    assert data["priority"] == "HIGH"
    assert data["hypothesis_id"] == hypo_id
    assert data["hypothesis_title"] == "Uncontrolled construction site runoff"
    assert data["responsible_person"] == "Stormwater Control Team"
    assert data["criteria_count"] == 0
    assert data["evidence_count"] == 0
    assert data["observation_count"] == 0


def test_2_list_actions_with_filters_and_counts():
    token, _, _ = register_user()
    inv_id = create_investigation(token)
    headers = {"Authorization": f"Bearer {token}"}

    client.post(
        f"/api/v1/investigations/{inv_id}/actions",
        headers=headers,
        json={"title": "Action High Priority", "priority": "HIGH", "rationale": "High urgency rationale"},
    )
    client.post(
        f"/api/v1/investigations/{inv_id}/actions",
        headers=headers,
        json={"title": "Action Low Priority", "priority": "LOW", "rationale": "Routine check rationale"},
    )

    # List all
    res = client.get(f"/api/v1/investigations/{inv_id}/actions", headers=headers)
    assert res.status_code == 200
    assert len(res.json()) == 2

    # Filter priority HIGH
    res_high = client.get(f"/api/v1/investigations/{inv_id}/actions?priority=HIGH", headers=headers)
    assert res_high.status_code == 200
    assert len(res_high.json()) == 1
    assert res_high.json()[0]["title"] == "Action High Priority"


def test_3_get_action_detail():
    token, _, _ = register_user()
    inv_id = create_investigation(token)
    headers = {"Authorization": f"Bearer {token}"}

    res_create = client.post(
        f"/api/v1/investigations/{inv_id}/actions",
        headers=headers,
        json={"title": "Detail Test Action", "rationale": "Test rationale"},
    )
    action_id = res_create.json()["id"]

    res_get = client.get(f"/api/v1/investigations/{inv_id}/actions/{action_id}", headers=headers)
    assert res_get.status_code == 200
    data = res_get.json()
    assert data["id"] == action_id
    assert data["title"] == "Detail Test Action"
    assert "criteria" in data
    assert "evidence_links" in data
    assert "observation_links" in data
    assert "verifications" in data


def test_4_update_action_plan():
    token, _, _ = register_user()
    inv_id = create_investigation(token)
    headers = {"Authorization": f"Bearer {token}"}

    res_create = client.post(
        f"/api/v1/investigations/{inv_id}/actions",
        headers=headers,
        json={"title": "Action to Update", "priority": "LOW"},
    )
    action_id = res_create.json()["id"]

    res_patch = client.patch(
        f"/api/v1/investigations/{inv_id}/actions/{action_id}",
        headers=headers,
        json={
            "title": "Action Updated Title",
            "priority": "HIGH",
            "status": "IN_PROGRESS",
            "responsible_person": "Officer Martinez",
        },
    )
    assert res_patch.status_code == 200
    updated = res_patch.json()
    assert updated["title"] == "Action Updated Title"
    assert updated["priority"] == "HIGH"
    assert updated["status"] == "IN_PROGRESS"
    assert updated["responsible_person"] == "Officer Martinez"


def test_5_delete_action_plan_cascade():
    token, _, _ = register_user()
    inv_id = create_investigation(token)
    headers = {"Authorization": f"Bearer {token}"}

    res_create = client.post(
        f"/api/v1/investigations/{inv_id}/actions",
        headers=headers,
        json={"title": "Action to Delete"},
    )
    action_id = res_create.json()["id"]

    # Add a criterion
    client.post(
        f"/api/v1/investigations/{inv_id}/actions/{action_id}/criteria",
        headers=headers,
        json={"description": "Criterion before deletion", "measurement_type": "OBSERVATION"},
    )

    # Delete action
    res_del = client.delete(f"/api/v1/investigations/{inv_id}/actions/{action_id}", headers=headers)
    assert res_del.status_code == 204

    # Verify action is gone
    res_check = client.get(f"/api/v1/investigations/{inv_id}/actions/{action_id}", headers=headers)
    assert res_check.status_code == 404


# ----------------------------------------------------------------------
# 2. Security & Cross-Investigation Protections
# ----------------------------------------------------------------------

def test_6_unauthenticated_request_rejected():
    res = client.get("/api/v1/investigations/1/actions")
    assert res.status_code in (401, 403)


def test_7_cross_user_access_rejected():
    token_owner, _, _ = register_user("Owner User")
    token_attacker, _, _ = register_user("Attacker User")
    inv_id = create_investigation(token_owner)

    headers_attacker = {"Authorization": f"Bearer {token_attacker}"}
    res = client.get(f"/api/v1/investigations/{inv_id}/actions", headers=headers_attacker)
    assert res.status_code == 403


def test_8_action_in_wrong_investigation_rejected():
    token, _, _ = register_user()
    inv_1 = create_investigation(token, "Investigation 1")
    inv_2 = create_investigation(token, "Investigation 2")
    headers = {"Authorization": f"Bearer {token}"}

    res = client.post(
        f"/api/v1/investigations/{inv_1}/actions",
        headers=headers,
        json={"title": "Action in Inv 1"},
    )
    action_id = res.json()["id"]

    # Attempt to access action_id under inv_2
    res_wrong = client.get(f"/api/v1/investigations/{inv_2}/actions/{action_id}", headers=headers)
    assert res_wrong.status_code == 404


def test_9_hypothesis_from_another_investigation_rejected():
    token, _, _ = register_user()
    inv_1 = create_investigation(token, "Investigation 1")
    inv_2 = create_investigation(token, "Investigation 2")
    hypo_in_2 = create_hypothesis(token, inv_2, "Hypothesis belonging to Inv 2")
    headers = {"Authorization": f"Bearer {token}"}

    # Attempt to create action in Inv 1 linking hypothesis from Inv 2
    res = client.post(
        f"/api/v1/investigations/{inv_1}/actions",
        headers=headers,
        json={"title": "Action Cross Hypo", "hypothesis_id": hypo_in_2},
    )
    assert res.status_code == 400
    assert "Hypothesis does not belong to this investigation" in res.json()["detail"]


# ----------------------------------------------------------------------
# 3. Criteria CRUD Tests
# ----------------------------------------------------------------------

def test_10_criteria_crud_and_cross_action_rejection():
    token, _, _ = register_user()
    inv_id = create_investigation(token)
    headers = {"Authorization": f"Bearer {token}"}

    res_action_1 = client.post(f"/api/v1/investigations/{inv_id}/actions", headers=headers, json={"title": "Action 1"})
    act_1_id = res_action_1.json()["id"]
    res_action_2 = client.post(f"/api/v1/investigations/{inv_id}/actions", headers=headers, json={"title": "Action 2"})
    act_2_id = res_action_2.json()["id"]

    # Add numeric criterion
    crit_payload = {
        "description": "Recorded turbidity should be below threshold",
        "measurement_type": "NUMERIC",
        "target_value": 10.0,
        "target_unit": "NTU",
        "comparison_operator": "LTE",
    }
    res_crit = client.post(
        f"/api/v1/investigations/{inv_id}/actions/{act_1_id}/criteria",
        headers=headers,
        json=crit_payload,
    )
    assert res_crit.status_code == 201
    crit_id = res_crit.json()["id"]
    assert res_crit.json()["target_value"] == 10.0
    assert res_crit.json()["comparison_operator"] == "LTE"

    # List criteria
    res_list = client.get(f"/api/v1/investigations/{inv_id}/actions/{act_1_id}/criteria", headers=headers)
    assert res_list.status_code == 200
    assert len(res_list.json()) == 1

    # Cross-action criterion modification rejected
    res_cross = client.patch(
        f"/api/v1/investigations/{inv_id}/actions/{act_2_id}/criteria/{crit_id}",
        headers=headers,
        json={"target_value": 5.0},
    )
    assert res_cross.status_code == 404

    # Update criterion
    res_update = client.patch(
        f"/api/v1/investigations/{inv_id}/actions/{act_1_id}/criteria/{crit_id}",
        headers=headers,
        json={"target_value": 8.0},
    )
    assert res_update.status_code == 200
    assert res_update.json()["target_value"] == 8.0

    # Delete criterion
    res_del = client.delete(
        f"/api/v1/investigations/{inv_id}/actions/{act_1_id}/criteria/{crit_id}",
        headers=headers,
    )
    assert res_del.status_code == 204


# ----------------------------------------------------------------------
# 4. Evidence Linking & Protections
# ----------------------------------------------------------------------

def test_11_evidence_linking_and_duplicate_prevention():
    token, _, _ = register_user()
    inv_1 = create_investigation(token, "Inv 1")
    inv_2 = create_investigation(token, "Inv 2")
    headers = {"Authorization": f"Bearer {token}"}

    res_act = client.post(f"/api/v1/investigations/{inv_1}/actions", headers=headers, json={"title": "Action Evidence Test"})
    act_id = res_act.json()["id"]

    ev_1 = upload_evidence(token, inv_1, "evidence_1.png")
    ev_2 = upload_evidence(token, inv_2, "evidence_2.png")

    # Cross-investigation evidence rejected
    res_cross = client.post(
        f"/api/v1/investigations/{inv_1}/actions/{act_id}/evidence",
        headers=headers,
        json={"evidence_id": ev_2, "relationship_type": "BEFORE_ACTION"},
    )
    assert res_cross.status_code == 400

    # Link valid evidence
    res_link = client.post(
        f"/api/v1/investigations/{inv_1}/actions/{act_id}/evidence",
        headers=headers,
        json={"evidence_id": ev_1, "relationship_type": "BEFORE_ACTION", "note": "Pre-remediation condition"},
    )
    assert res_link.status_code == 201
    assert res_link.json()["relationship_type"] == "BEFORE_ACTION"
    assert res_link.json()["evidence"]["id"] == ev_1

    # Duplicate link rejected
    res_dup = client.post(
        f"/api/v1/investigations/{inv_1}/actions/{act_id}/evidence",
        headers=headers,
        json={"evidence_id": ev_1, "relationship_type": "AFTER_ACTION"},
    )
    assert res_dup.status_code == 400

    # List action evidence
    res_list = client.get(f"/api/v1/investigations/{inv_1}/actions/{act_id}/evidence", headers=headers)
    assert res_list.status_code == 200
    assert len(res_list.json()) == 1

    # Unlink evidence
    res_unlink = client.delete(f"/api/v1/investigations/{inv_1}/actions/{act_id}/evidence/{ev_1}", headers=headers)
    assert res_unlink.status_code == 204


# ----------------------------------------------------------------------
# 5. Observation Linking & Protections
# ----------------------------------------------------------------------

def test_12_observation_linking_and_duplicate_prevention():
    token, _, _ = register_user()
    inv_1 = create_investigation(token, "Inv 1")
    inv_2 = create_investigation(token, "Inv 2")
    headers = {"Authorization": f"Bearer {token}"}

    res_act = client.post(f"/api/v1/investigations/{inv_1}/actions", headers=headers, json={"title": "Action Observation Test"})
    act_id = res_act.json()["id"]

    obs_1 = create_observation(token, inv_1, "Observation 1 in Inv 1")
    obs_2 = create_observation(token, inv_2, "Observation 2 in Inv 2")

    # Cross-investigation observation rejected
    res_cross = client.post(
        f"/api/v1/investigations/{inv_1}/actions/{act_id}/observations",
        headers=headers,
        json={"observation_id": obs_2, "relationship_type": "AFTER_ACTION"},
    )
    assert res_cross.status_code == 400

    # Link observation
    res_link = client.post(
        f"/api/v1/investigations/{inv_1}/actions/{act_id}/observations",
        headers=headers,
        json={"observation_id": obs_1, "relationship_type": "AFTER_ACTION", "note": "Post-action field review"},
    )
    assert res_link.status_code == 201
    assert res_link.json()["relationship_type"] == "AFTER_ACTION"
    assert res_link.json()["observation"]["id"] == obs_1

    # Duplicate link rejected
    res_dup = client.post(
        f"/api/v1/investigations/{inv_1}/actions/{act_id}/observations",
        headers=headers,
        json={"observation_id": obs_1, "relationship_type": "VERIFICATION"},
    )
    assert res_dup.status_code == 400

    # List observations
    res_list = client.get(f"/api/v1/investigations/{inv_1}/actions/{act_id}/observations", headers=headers)
    assert res_list.status_code == 200
    assert len(res_list.json()) == 1

    # Unlink observation
    res_unlink = client.delete(f"/api/v1/investigations/{inv_1}/actions/{act_id}/observations/{obs_1}", headers=headers)
    assert res_unlink.status_code == 204


# ----------------------------------------------------------------------
# 6. Deterministic Verification Tests
# ----------------------------------------------------------------------

def test_13_deterministic_verification_all_pass():
    token, _, _ = register_user()
    inv_id = create_investigation(token)
    headers = {"Authorization": f"Bearer {token}"}

    res_act = client.post(f"/api/v1/investigations/{inv_id}/actions", headers=headers, json={"title": "Silt Barrier Verification"})
    act_id = res_act.json()["id"]

    # Target: Turbidity LTE 10.0 NTU
    res_c1 = client.post(
        f"/api/v1/investigations/{inv_id}/actions/{act_id}/criteria",
        headers=headers,
        json={
            "description": "Discharge turbidity LTE 10 NTU",
            "measurement_type": "NUMERIC",
            "target_value": 10.0,
            "target_unit": "NTU",
            "comparison_operator": "LTE",
        },
    )
    c1_id = res_c1.json()["id"]

    # Verify with observed_value = 8.0 (8.0 <= 10.0 -> PASS)
    verify_payload = {
        "summary": "Post-remediation water quality samples met the documented criteria.",
        "uncertainty_notes": "Observations conducted after single minor rainfall event.",
        "criterion_results": [
            {
                "criterion_id": c1_id,
                "observed_value": 8.0,
                "observed_unit": "NTU",
                "note": "Field probe sensor read 8.0 NTU.",
            }
        ],
    }
    res_ver = client.post(f"/api/v1/investigations/{inv_id}/actions/{act_id}/verify", headers=headers, json=verify_payload)
    assert res_ver.status_code == 201
    v_data = res_ver.json()
    assert v_data["status"] == "VERIFIED"
    assert len(v_data["criterion_results"]) == 1
    c_res = v_data["criterion_results"][0]
    assert c_res["result"] == "PASS"
    assert c_res["evaluation_mode"] == "numeric_comparison"
    assert c_res["observed_value"] == 8.0

    # Action status should be updated to VERIFIED
    res_act_after = client.get(f"/api/v1/investigations/{inv_id}/actions/{act_id}", headers=headers)
    assert res_act_after.json()["status"] == "VERIFIED"
    assert res_act_after.json()["latest_verification_status"] == "VERIFIED"


def test_14_deterministic_verification_fail():
    token, _, _ = register_user()
    inv_id = create_investigation(token)
    headers = {"Authorization": f"Bearer {token}"}

    res_act = client.post(f"/api/v1/investigations/{inv_id}/actions", headers=headers, json={"title": "Action Fail Test"})
    act_id = res_act.json()["id"]

    # Target: Turbidity LTE 10.0 NTU
    res_c1 = client.post(
        f"/api/v1/investigations/{inv_id}/actions/{act_id}/criteria",
        headers=headers,
        json={
            "description": "Discharge turbidity LTE 10 NTU",
            "measurement_type": "NUMERIC",
            "target_value": 10.0,
            "target_unit": "NTU",
            "comparison_operator": "LTE",
        },
    )
    c1_id = res_c1.json()["id"]

    # Observed 14.5 NTU (14.5 <= 10.0 -> FAIL)
    verify_payload = {
        "summary": "Turbidity exceeded documented criteria.",
        "criterion_results": [
            {
                "criterion_id": c1_id,
                "observed_value": 14.5,
                "observed_unit": "NTU",
            }
        ],
    }
    res_ver = client.post(f"/api/v1/investigations/{inv_id}/actions/{act_id}/verify", headers=headers, json=verify_payload)
    assert res_ver.status_code == 201
    v_data = res_ver.json()
    assert v_data["status"] == "NOT_VERIFIED"
    assert v_data["criterion_results"][0]["result"] == "FAIL"
    assert v_data["criterion_results"][0]["evaluation_mode"] == "numeric_comparison"


def test_15_deterministic_verification_partial_mix():
    token, _, _ = register_user()
    inv_id = create_investigation(token)
    headers = {"Authorization": f"Bearer {token}"}

    res_act = client.post(f"/api/v1/investigations/{inv_id}/actions", headers=headers, json={"title": "Action Partial Mix"})
    act_id = res_act.json()["id"]

    # C1: Turbidity LTE 10
    c1 = client.post(
        f"/api/v1/investigations/{inv_id}/actions/{act_id}/criteria",
        headers=headers,
        json={"description": "Turbidity LTE 10", "measurement_type": "NUMERIC", "target_value": 10.0, "comparison_operator": "LTE"},
    ).json()["id"]

    # C2: Dissolved Oxygen GTE 6.0 mg/L
    c2 = client.post(
        f"/api/v1/investigations/{inv_id}/actions/{act_id}/criteria",
        headers=headers,
        json={"description": "DO GTE 6.0", "measurement_type": "NUMERIC", "target_value": 6.0, "comparison_operator": "GTE"},
    ).json()["id"]

    # Turbidity = 8.0 (PASS), DO = 4.5 (FAIL) -> PARTIALLY_VERIFIED
    verify_payload = {
        "summary": "Turbidity criteria met, but dissolved oxygen was below target.",
        "criterion_results": [
            {"criterion_id": c1, "observed_value": 8.0},
            {"criterion_id": c2, "observed_value": 4.5},
        ],
    }
    res_ver = client.post(f"/api/v1/investigations/{inv_id}/actions/{act_id}/verify", headers=headers, json=verify_payload)
    assert res_ver.status_code == 201
    assert res_ver.json()["status"] == "PARTIALLY_VERIFIED"


def test_16_qualitative_investigator_recorded_evaluation():
    token, _, _ = register_user()
    inv_id = create_investigation(token)
    headers = {"Authorization": f"Bearer {token}"}

    res_act = client.post(f"/api/v1/investigations/{inv_id}/actions", headers=headers, json={"title": "Debris Clearing Action"})
    act_id = res_act.json()["id"]

    c1 = client.post(
        f"/api/v1/investigations/{inv_id}/actions/{act_id}/criteria",
        headers=headers,
        json={"description": "Visible waste accumulation should no longer be present", "measurement_type": "OBSERVATION"},
    ).json()["id"]

    # Investigator records PASS manually
    verify_payload = {
        "summary": "Visual field inspection confirmed debris removed from intake grating.",
        "uncertainty_notes": "Inspection limited to accessible surface area.",
        "criterion_results": [
            {
                "criterion_id": c1,
                "result": "PASS",
                "note": "Investigator observed clean channel bed with no visible trash.",
            }
        ],
    }
    res_ver = client.post(f"/api/v1/investigations/{inv_id}/actions/{act_id}/verify", headers=headers, json=verify_payload)
    assert res_ver.status_code == 201
    v_data = res_ver.json()
    assert v_data["status"] == "VERIFIED"
    assert v_data["criterion_results"][0]["result"] == "PASS"
    assert v_data["criterion_results"][0]["evaluation_mode"] == "investigator_recorded"


def test_17_cross_action_criterion_in_verification_rejected():
    token, _, _ = register_user()
    inv_id = create_investigation(token)
    headers = {"Authorization": f"Bearer {token}"}

    act_1 = client.post(f"/api/v1/investigations/{inv_id}/actions", headers=headers, json={"title": "Action 1"}).json()["id"]
    act_2 = client.post(f"/api/v1/investigations/{inv_id}/actions", headers=headers, json={"title": "Action 2"}).json()["id"]

    crit_in_2 = client.post(
        f"/api/v1/investigations/{inv_id}/actions/{act_2}/criteria",
        headers=headers,
        json={"description": "Criterion in Act 2", "measurement_type": "OBSERVATION"},
    ).json()["id"]

    # Attempt to verify Act 1 with crit_in_2
    res_bad = client.post(
        f"/api/v1/investigations/{inv_id}/actions/{act_1}/verify",
        headers=headers,
        json={"criterion_results": [{"criterion_id": crit_in_2, "result": "PASS"}]},
    )
    assert res_bad.status_code == 400
    assert "Criterion does not belong to this action" in res_bad.json()["detail"]


# ----------------------------------------------------------------------
# 7. Timeline Integration & Neutral Language
# ----------------------------------------------------------------------

def test_18_timeline_events_recorded_and_neutral():
    token, _, _ = register_user()
    inv_id = create_investigation(token)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create action
    res_act = client.post(
        f"/api/v1/investigations/{inv_id}/actions",
        headers=headers,
        json={"title": "Riprap Installation", "rationale": "Mitigate bank scour"},
    )
    act_id = res_act.json()["id"]

    # 2. Add criterion
    res_crit = client.post(
        f"/api/v1/investigations/{inv_id}/actions/{act_id}/criteria",
        headers=headers,
        json={"description": "Bank erosion rate stable", "measurement_type": "OBSERVATION"},
    )
    crit_id = res_crit.json()["id"]

    # 3. Record verification
    client.post(
        f"/api/v1/investigations/{inv_id}/actions/{act_id}/verify",
        headers=headers,
        json={
            "summary": "Documented erosion control criteria verified by visual transect.",
            "criterion_results": [{"criterion_id": crit_id, "result": "PASS"}],
        },
    )

    # 4. Check timeline entries
    res_tl = client.get(f"/api/v1/investigations/{inv_id}/timeline", headers=headers)
    assert res_tl.status_code == 200
    entries = res_tl.json()

    event_types = [e["event_type"] for e in entries]
    assert "action_created" in event_types
    assert "criterion_added" in event_types
    assert "action_verification_recorded" in event_types

    # Verify neutral language: no forbidden words like "solve", "proven", "cause" in system generated descriptions
    forbidden_terms = ["solved the problem", "caused the improvement", "proven improvement", "ai recommends"]
    for e in entries:
        desc_lower = (e["description"] or "").lower()
        for forbidden in forbidden_terms:
            assert forbidden not in desc_lower, f"Forbidden non-neutral term '{forbidden}' in timeline: {e['description']}"


def test_19_inconclusive_verification():
    token, _, _ = register_user()
    inv_id = create_investigation(token)
    headers = {"Authorization": f"Bearer {token}"}

    act_id = client.post(
        f"/api/v1/investigations/{inv_id}/actions",
        headers=headers,
        json={"title": "Action Inconclusive Test"},
    ).json()["id"]

    crit_id = client.post(
        f"/api/v1/investigations/{inv_id}/actions/{act_id}/criteria",
        headers=headers,
        json={"description": "Aquatic macroinvertebrate index", "measurement_type": "OBSERVATION"},
    ).json()["id"]

    # Mark as INCONCLUSIVE
    res_ver = client.post(
        f"/api/v1/investigations/{inv_id}/actions/{act_id}/verify",
        headers=headers,
        json={
            "summary": "Sample collection disrupted by seasonal flooding; outcome could not be determined.",
            "criterion_results": [{"criterion_id": crit_id, "result": "INCONCLUSIVE"}],
        },
    )
    assert res_ver.status_code == 201
    assert res_ver.json()["status"] == "INCONCLUSIVE"


def test_20_investigator_explicit_override_status():
    token, _, _ = register_user()
    inv_id = create_investigation(token)
    headers = {"Authorization": f"Bearer {token}"}

    act_id = client.post(
        f"/api/v1/investigations/{inv_id}/actions",
        headers=headers,
        json={"title": "Action Override Test"},
    ).json()["id"]

    crit_id = client.post(
        f"/api/v1/investigations/{inv_id}/actions/{act_id}/criteria",
        headers=headers,
        json={"description": "Field visual check", "measurement_type": "OBSERVATION"},
    ).json()["id"]

    # Even though criterion is PASS, investigator explicitly marks PARTIALLY_VERIFIED due to external confounders
    res_ver = client.post(
        f"/api/v1/investigations/{inv_id}/actions/{act_id}/verify",
        headers=headers,
        json={
            "status": "PARTIALLY_VERIFIED",
            "summary": "Field criteria observed, but verification limited to upper stream reach.",
            "uncertainty_notes": "Confounding seasonal factors present.",
            "criterion_results": [{"criterion_id": crit_id, "result": "PASS"}],
        },
    )
    assert res_ver.status_code == 201
    assert res_ver.json()["status"] == "PARTIALLY_VERIFIED"


def test_21_invalid_operator_rejected():
    token, _, _ = register_user()
    inv_id = create_investigation(token)
    headers = {"Authorization": f"Bearer {token}"}

    act_id = client.post(
        f"/api/v1/investigations/{inv_id}/actions",
        headers=headers,
        json={"title": "Action Operator Test"},
    ).json()["id"]

    res_crit = client.post(
        f"/api/v1/investigations/{inv_id}/actions/{act_id}/criteria",
        headers=headers,
        json={
            "description": "Criterion with invalid operator",
            "measurement_type": "NUMERIC",
            "target_value": 10.0,
            "comparison_operator": "INVALID_OP",
        },
    )
    assert res_crit.status_code == 422


def test_22_empty_action_title_rejected():
    token, _, _ = register_user()
    inv_id = create_investigation(token)
    headers = {"Authorization": f"Bearer {token}"}

    res = client.post(
        f"/api/v1/investigations/{inv_id}/actions",
        headers=headers,
        json={"title": "   ", "rationale": "Empty title test"},
    )
    assert res.status_code == 422
