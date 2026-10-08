"""
Tests for Phase 8A — Root-Cause Hypothesis Workspace.

Covers:
1. Create hypothesis
2. List hypotheses
3. Retrieve hypothesis
4. Update hypothesis
5. Delete hypothesis
6. Invalid status rejected
7. Invalid confidence rejected
8. Evidence can be linked
9. Evidence can be unlinked
10. Observation can be linked
11. Cross-investigation evidence rejected
12. Cross-user access rejected
13. Duplicate evidence relationship rejected
14. Missing evidence requirement creation
15. Missing evidence requirement resolution
16. Hypothesis status update recorded
17. Timeline event created
18. Evidence-first language preserved
19. Empty title rejected
20. Unauthorized hypothesis access rejected
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
    return f"hypothesis_tester_{uuid.uuid4().hex[:10]}@ecointelligence.org"


def register_user(display_name="Hypothesis Investigator"):
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


def create_investigation(token, title="Industrial Effluent Investigation"):
    headers = {"Authorization": f"Bearer {token}"}
    res = client.post(
        "/api/v1/investigations",
        headers=headers,
        json={
            "title": title,
            "category": "water_contamination",
            "description": "Investigating high turbidity and contaminant spikes downstream.",
            "severity": "high",
        },
    )
    assert res.status_code == 201
    return res.json()["id"]


def upload_evidence(token, inv_id, filename="water_sample.png"):
    headers = {"Authorization": f"Bearer {token}"}
    files = {"file": (filename, io.BytesIO(VALID_PNG_BYTES), "image/png")}
    data = {
        "source_type": "observed",
        "description": "Field photographic capture of effluent outflow pipe.",
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


def create_observation(token, inv_id, desc="Strong sulfur chemical odor near north canal discharge."):
    headers = {"Authorization": f"Bearer {token}"}
    res = client.post(
        f"/api/v1/investigations/{inv_id}/observations",
        headers=headers,
        json={
            "category": "water_pollution",
            "description": desc,
            "severity": "high",
            "source_type": "observed",
            "confidence": 85.0,
        },
    )
    assert res.status_code == 201
    return res.json()["id"]


# ============================================================================
# 1. CREATE HYPOTHESIS
# ============================================================================
def test_1_create_hypothesis():
    token, _, _ = register_user()
    inv_id = create_investigation(token)
    headers = {"Authorization": f"Bearer {token}"}

    res = client.post(
        f"/api/v1/investigations/{inv_id}/hypotheses",
        headers=headers,
        json={
            "title": "Unpermitted Night-Time Industrial Discharge",
            "description": "Facility may be dumping chemical byproducts through secondary outlet during low-visibility hours.",
            "reasoning": "Turbidity and odor spikes coincide with night shift cycles.",
            "status": "OPEN",
            "confidence": "MEDIUM",
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert data["title"] == "Unpermitted Night-Time Industrial Discharge"
    assert data["status"] == "OPEN"
    assert data["confidence"] == "MEDIUM"
    assert data["investigation_id"] == inv_id
    assert "id" in data
    assert data["supporting_evidence_count"] == 0
    assert data["contradicting_evidence_count"] == 0
    assert data["missing_evidence_count"] == 0


# ============================================================================
# 2. LIST HYPOTHESES
# ============================================================================
def test_2_list_hypotheses():
    token, _, _ = register_user()
    inv_id = create_investigation(token)
    headers = {"Authorization": f"Bearer {token}"}

    # Create 2 hypotheses
    client.post(
        f"/api/v1/investigations/{inv_id}/hypotheses",
        headers=headers,
        json={"title": "Hypothesis A: Municipal Sewer Overflow", "confidence": "LOW"},
    )
    client.post(
        f"/api/v1/investigations/{inv_id}/hypotheses",
        headers=headers,
        json={"title": "Hypothesis B: Agricultural Pesticide Runoff", "confidence": "HIGH"},
    )

    res = client.get(f"/api/v1/investigations/{inv_id}/hypotheses", headers=headers)
    assert res.status_code == 200
    items = res.json()
    assert len(items) == 2
    titles = [h["title"] for h in items]
    assert "Hypothesis A: Municipal Sewer Overflow" in titles
    assert "Hypothesis B: Agricultural Pesticide Runoff" in titles


# ============================================================================
# 3. RETRIEVE HYPOTHESIS
# ============================================================================
def test_3_retrieve_hypothesis():
    token, _, _ = register_user()
    inv_id = create_investigation(token)
    headers = {"Authorization": f"Bearer {token}"}

    create_res = client.post(
        f"/api/v1/investigations/{inv_id}/hypotheses",
        headers=headers,
        json={
            "title": "Subsurface Pipeline Fracture",
            "description": "Corrosion in buried fuel line leaking into local aquifer.",
            "confidence": "LOW",
        },
    )
    hyp_id = create_res.json()["id"]

    res = client.get(
        f"/api/v1/investigations/{inv_id}/hypotheses/{hyp_id}",
        headers=headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == hyp_id
    assert data["title"] == "Subsurface Pipeline Fracture"
    assert "evidence_links" in data
    assert "observation_links" in data
    assert "missing_evidence" in data
    assert "timeline_entries" in data


# ============================================================================
# 4. UPDATE HYPOTHESIS
# ============================================================================
def test_4_update_hypothesis():
    token, _, _ = register_user()
    inv_id = create_investigation(token)
    headers = {"Authorization": f"Bearer {token}"}

    create_res = client.post(
        f"/api/v1/investigations/{inv_id}/hypotheses",
        headers=headers,
        json={"title": "Original Title", "status": "OPEN", "confidence": "LOW"},
    )
    hyp_id = create_res.json()["id"]

    res = client.patch(
        f"/api/v1/investigations/{inv_id}/hypotheses/{hyp_id}",
        headers=headers,
        json={
            "title": "Updated Title After Site Visit",
            "reasoning": "Site visit revealed fresh tanker wheel tracks near outflow ditch.",
            "confidence": "HIGH",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["title"] == "Updated Title After Site Visit"
    assert data["confidence"] == "HIGH"
    assert "fresh tanker wheel tracks" in data["reasoning"]


# ============================================================================
# 5. DELETE HYPOTHESIS
# ============================================================================
def test_5_delete_hypothesis():
    token, _, _ = register_user()
    inv_id = create_investigation(token)
    headers = {"Authorization": f"Bearer {token}"}

    create_res = client.post(
        f"/api/v1/investigations/{inv_id}/hypotheses",
        headers=headers,
        json={"title": "To Be Deleted"},
    )
    hyp_id = create_res.json()["id"]

    del_res = client.delete(
        f"/api/v1/investigations/{inv_id}/hypotheses/{hyp_id}",
        headers=headers,
    )
    assert del_res.status_code == 204

    # Verify 404 on get
    get_res = client.get(
        f"/api/v1/investigations/{inv_id}/hypotheses/{hyp_id}",
        headers=headers,
    )
    assert get_res.status_code == 404


# ============================================================================
# 6. INVALID STATUS REJECTED
# ============================================================================
def test_6_invalid_status_rejected():
    token, _, _ = register_user()
    inv_id = create_investigation(token)
    headers = {"Authorization": f"Bearer {token}"}

    res = client.post(
        f"/api/v1/investigations/{inv_id}/hypotheses",
        headers=headers,
        json={"title": "Test Invalid Status", "status": "PROVEN_BEYOND_DOUBT"},
    )
    assert res.status_code == 422


# ============================================================================
# 7. INVALID CONFIDENCE REJECTED
# ============================================================================
def test_7_invalid_confidence_rejected():
    token, _, _ = register_user()
    inv_id = create_investigation(token)
    headers = {"Authorization": f"Bearer {token}"}

    res = client.post(
        f"/api/v1/investigations/{inv_id}/hypotheses",
        headers=headers,
        json={"title": "Test Invalid Confidence", "confidence": "CERTAIN_99_PERCENT"},
    )
    assert res.status_code == 422


# ============================================================================
# 8. EVIDENCE CAN BE LINKED
# ============================================================================
def test_8_evidence_can_be_linked():
    token, _, _ = register_user()
    inv_id = create_investigation(token)
    ev_id = upload_evidence(token, inv_id, "outflow_sample.png")
    headers = {"Authorization": f"Bearer {token}"}

    create_hyp = client.post(
        f"/api/v1/investigations/{inv_id}/hypotheses",
        headers=headers,
        json={"title": "Drainage Pipe Backflow"},
    )
    hyp_id = create_hyp.json()["id"]

    link_res = client.post(
        f"/api/v1/investigations/{inv_id}/hypotheses/{hyp_id}/evidence",
        headers=headers,
        json={
            "evidence_id": ev_id,
            "relationship_type": "SUPPORTS",
            "note": "Discoloration plume in image originates directly from the outflow mouth.",
        },
    )
    assert link_res.status_code == 201
    link_data = link_res.json()
    assert link_data["evidence_id"] == ev_id
    assert link_data["relationship_type"] == "SUPPORTS"
    assert link_data["evidence"]["id"] == ev_id

    # Verify counts in hypothesis detail
    detail = client.get(f"/api/v1/investigations/{inv_id}/hypotheses/{hyp_id}", headers=headers).json()
    assert detail["supporting_evidence_count"] == 1
    assert detail["contradicting_evidence_count"] == 0


# ============================================================================
# 9. EVIDENCE CAN BE UNLINKED
# ============================================================================
def test_9_evidence_can_be_unlinked():
    token, _, _ = register_user()
    inv_id = create_investigation(token)
    ev_id = upload_evidence(token, inv_id)
    headers = {"Authorization": f"Bearer {token}"}

    create_hyp = client.post(
        f"/api/v1/investigations/{inv_id}/hypotheses",
        headers=headers,
        json={"title": "Temporary Link Hypothesis"},
    )
    hyp_id = create_hyp.json()["id"]

    client.post(
        f"/api/v1/investigations/{inv_id}/hypotheses/{hyp_id}/evidence",
        headers=headers,
        json={"evidence_id": ev_id, "relationship_type": "CONTEXT"},
    )

    unlink_res = client.delete(
        f"/api/v1/investigations/{inv_id}/hypotheses/{hyp_id}/evidence/{ev_id}",
        headers=headers,
    )
    assert unlink_res.status_code == 204

    # Verify removed
    detail = client.get(f"/api/v1/investigations/{inv_id}/hypotheses/{hyp_id}", headers=headers).json()
    assert len(detail["evidence_links"]) == 0
    assert detail["context_evidence_count"] == 0


# ============================================================================
# 10. OBSERVATION CAN BE LINKED
# ============================================================================
def test_10_observation_can_be_linked():
    token, _, _ = register_user()
    inv_id = create_investigation(token)
    obs_id = create_observation(token, inv_id, "Fish mortality observed along 200m riverbank.")
    headers = {"Authorization": f"Bearer {token}"}

    create_hyp = client.post(
        f"/api/v1/investigations/{inv_id}/hypotheses",
        headers=headers,
        json={"title": "Acute Toxicity Shock"},
    )
    hyp_id = create_hyp.json()["id"]

    link_res = client.post(
        f"/api/v1/investigations/{inv_id}/hypotheses/{hyp_id}/observations",
        headers=headers,
        json={
            "observation_id": obs_id,
            "relationship_type": "SUPPORTS",
            "note": "Rapid mortality indicates concentrated toxic slug rather than chronic low-level seepage.",
        },
    )
    assert link_res.status_code == 201
    data = link_res.json()
    assert data["observation_id"] == obs_id
    assert data["relationship_type"] == "SUPPORTS"
    assert data["observation"]["id"] == obs_id

    detail = client.get(f"/api/v1/investigations/{inv_id}/hypotheses/{hyp_id}", headers=headers).json()
    assert detail["supporting_observation_count"] == 1


# ============================================================================
# 11. CROSS-INVESTIGATION EVIDENCE REJECTED
# ============================================================================
def test_11_cross_investigation_evidence_rejected():
    token, _, _ = register_user()
    inv1_id = create_investigation(token, "Investigation Alpha")
    inv2_id = create_investigation(token, "Investigation Beta")

    ev_inv2 = upload_evidence(token, inv2_id, "beta_evidence.png")

    headers = {"Authorization": f"Bearer {token}"}
    create_hyp = client.post(
        f"/api/v1/investigations/{inv1_id}/hypotheses",
        headers=headers,
        json={"title": "Inv 1 Hypothesis"},
    )
    hyp_id = create_hyp.json()["id"]

    # Attempt to link inv2 evidence to inv1 hypothesis
    res = client.post(
        f"/api/v1/investigations/{inv1_id}/hypotheses/{hyp_id}/evidence",
        headers=headers,
        json={"evidence_id": ev_inv2, "relationship_type": "SUPPORTS"},
    )
    assert res.status_code in (400, 404)
    assert "does not belong to this investigation" in res.json()["detail"].lower() or "not found" in res.json()["detail"].lower()


# ============================================================================
# 12. CROSS-USER ACCESS REJECTED
# ============================================================================
def test_12_cross_user_access_rejected():
    token_owner, _, _ = register_user("Investigator Owner")
    token_intruder, _, _ = register_user("Investigator Intruder")

    inv_id = create_investigation(token_owner, "Owner Secret Case")
    headers_owner = {"Authorization": f"Bearer {token_owner}"}
    create_res = client.post(
        f"/api/v1/investigations/{inv_id}/hypotheses",
        headers=headers_owner,
        json={"title": "Confidential Hypothesis"},
    )
    hyp_id = create_res.json()["id"]

    headers_intruder = {"Authorization": f"Bearer {token_intruder}"}

    # Intruder tries to list hypotheses
    res_list = client.get(
        f"/api/v1/investigations/{inv_id}/hypotheses",
        headers=headers_intruder,
    )
    assert res_list.status_code == 403

    # Intruder tries to get hypothesis
    res_get = client.get(
        f"/api/v1/investigations/{inv_id}/hypotheses/{hyp_id}",
        headers=headers_intruder,
    )
    assert res_get.status_code == 403

    # Intruder tries to update hypothesis
    res_patch = client.patch(
        f"/api/v1/investigations/{inv_id}/hypotheses/{hyp_id}",
        headers=headers_intruder,
        json={"title": "Hacked Title"},
    )
    assert res_patch.status_code == 403

    # Intruder tries to delete hypothesis
    res_del = client.delete(
        f"/api/v1/investigations/{inv_id}/hypotheses/{hyp_id}",
        headers=headers_intruder,
    )
    assert res_del.status_code == 403


# ============================================================================
# 13. DUPLICATE EVIDENCE RELATIONSHIP REJECTED
# ============================================================================
def test_13_duplicate_evidence_relationship_rejected():
    token, _, _ = register_user()
    inv_id = create_investigation(token)
    ev_id = upload_evidence(token, inv_id)
    headers = {"Authorization": f"Bearer {token}"}

    create_hyp = client.post(
        f"/api/v1/investigations/{inv_id}/hypotheses",
        headers=headers,
        json={"title": "Duplicate Link Test"},
    )
    hyp_id = create_hyp.json()["id"]

    r1 = client.post(
        f"/api/v1/investigations/{inv_id}/hypotheses/{hyp_id}/evidence",
        headers=headers,
        json={"evidence_id": ev_id, "relationship_type": "SUPPORTS"},
    )
    assert r1.status_code == 201

    r2 = client.post(
        f"/api/v1/investigations/{inv_id}/hypotheses/{hyp_id}/evidence",
        headers=headers,
        json={"evidence_id": ev_id, "relationship_type": "CONTRADICTS"},
    )
    assert r2.status_code in (400, 409)
    assert "already linked" in r2.json()["detail"].lower()


# ============================================================================
# 14. MISSING EVIDENCE REQUIREMENT CREATION
# ============================================================================
def test_14_missing_evidence_requirement_creation():
    token, _, _ = register_user()
    inv_id = create_investigation(token)
    headers = {"Authorization": f"Bearer {token}"}

    create_hyp = client.post(
        f"/api/v1/investigations/{inv_id}/hypotheses",
        headers=headers,
        json={"title": "Industrial Leachate Leak"},
    )
    hyp_id = create_hyp.json()["id"]

    req_res = client.post(
        f"/api/v1/investigations/{inv_id}/hypotheses/{hyp_id}/missing-evidence",
        headers=headers,
        json={
            "description": "Need upstream water sample to establish clean background baseline.",
            "priority": "HIGH",
            "status": "OPEN",
        },
    )
    assert req_res.status_code == 201
    req = req_res.json()
    assert req["hypothesis_id"] == hyp_id
    assert req["priority"] == "HIGH"
    assert req["status"] == "OPEN"
    assert "upstream water sample" in req["description"]

    # Verify count
    detail = client.get(f"/api/v1/investigations/{inv_id}/hypotheses/{hyp_id}", headers=headers).json()
    assert detail["missing_evidence_count"] == 1
    assert detail["resolved_missing_evidence_count"] == 0


# ============================================================================
# 15. MISSING EVIDENCE REQUIREMENT RESOLUTION
# ============================================================================
def test_15_missing_evidence_requirement_resolution():
    token, _, _ = register_user()
    inv_id = create_investigation(token)
    headers = {"Authorization": f"Bearer {token}"}

    create_hyp = client.post(
        f"/api/v1/investigations/{inv_id}/hypotheses",
        headers=headers,
        json={"title": "Requirement Resolution Test"},
    )
    hyp_id = create_hyp.json()["id"]

    req_res = client.post(
        f"/api/v1/investigations/{inv_id}/hypotheses/{hyp_id}/missing-evidence",
        headers=headers,
        json={"description": "Need photograph of culvert gate.", "priority": "MEDIUM"},
    )
    req_id = req_res.json()["id"]

    # Mark as collected
    patch_res = client.patch(
        f"/api/v1/investigations/{inv_id}/hypotheses/{hyp_id}/missing-evidence/{req_id}",
        headers=headers,
        json={"status": "COLLECTED"},
    )
    assert patch_res.status_code == 200
    patched = patch_res.json()
    assert patched["status"] == "COLLECTED"
    assert patched["resolved_at"] is not None

    detail = client.get(f"/api/v1/investigations/{inv_id}/hypotheses/{hyp_id}", headers=headers).json()
    assert detail["missing_evidence_count"] == 0
    assert detail["resolved_missing_evidence_count"] == 1


# ============================================================================
# 16. HYPOTHESIS STATUS UPDATE RECORDED
# ============================================================================
def test_16_hypothesis_status_update_recorded():
    token, _, _ = register_user()
    inv_id = create_investigation(token)
    headers = {"Authorization": f"Bearer {token}"}

    create_hyp = client.post(
        f"/api/v1/investigations/{inv_id}/hypotheses",
        headers=headers,
        json={"title": "Status Workflow Hypothesis", "status": "OPEN"},
    )
    hyp_id = create_hyp.json()["id"]

    # Move to UNDER_REVIEW
    r1 = client.patch(
        f"/api/v1/investigations/{inv_id}/hypotheses/{hyp_id}",
        headers=headers,
        json={"status": "UNDER_REVIEW"},
    )
    assert r1.status_code == 200
    assert r1.json()["status"] == "UNDER_REVIEW"

    # Move to SUPPORTED
    r2 = client.patch(
        f"/api/v1/investigations/{inv_id}/hypotheses/{hyp_id}",
        headers=headers,
        json={"status": "SUPPORTED"},
    )
    assert r2.status_code == 200
    assert r2.json()["status"] == "SUPPORTED"


# ============================================================================
# 17. TIMELINE EVENT CREATED
# ============================================================================
def test_17_timeline_event_created():
    token, _, _ = register_user()
    inv_id = create_investigation(token)
    headers = {"Authorization": f"Bearer {token}"}

    create_hyp = client.post(
        f"/api/v1/investigations/{inv_id}/hypotheses",
        headers=headers,
        json={"title": "Audited Root Cause Hypothesis"},
    )
    hyp_id = create_hyp.json()["id"]

    # Verify timeline entry on investigation
    timeline_res = client.get(
        f"/api/v1/investigations/{inv_id}/timeline",
        headers=headers,
    )
    assert timeline_res.status_code == 200
    timeline = timeline_res.json()
    event_types = [t["event_type"] for t in timeline]
    assert "hypothesis_created" in event_types

    # Link evidence and check timeline
    ev_id = upload_evidence(token, inv_id)
    client.post(
        f"/api/v1/investigations/{inv_id}/hypotheses/{hyp_id}/evidence",
        headers=headers,
        json={"evidence_id": ev_id, "relationship_type": "SUPPORTS"},
    )
    timeline_after = client.get(
        f"/api/v1/investigations/{inv_id}/timeline",
        headers=headers,
    ).json()
    event_types_after = [t["event_type"] for t in timeline_after]
    assert "evidence_linked_to_hypothesis" in event_types_after


# ============================================================================
# 18. EVIDENCE-FIRST LANGUAGE PRESERVED
# ============================================================================
def test_18_evidence_first_language_preserved():
    token, _, _ = register_user()
    inv_id = create_investigation(token)
    headers = {"Authorization": f"Bearer {token}"}

    create_hyp = client.post(
        f"/api/v1/investigations/{inv_id}/hypotheses",
        headers=headers,
        json={
            "title": "Possible Silt Settling Pond Breach",
            "reasoning": "Observed water plume is consistent with embankment overflow.",
            "status": "OPEN",
            "confidence": "MEDIUM",
        },
    )
    hyp_id = create_hyp.json()["id"]

    ev_id = upload_evidence(token, inv_id)
    client.post(
        f"/api/v1/investigations/{inv_id}/hypotheses/{hyp_id}/evidence",
        headers=headers,
        json={"evidence_id": ev_id, "relationship_type": "SUPPORTS"},
    )

    detail = client.get(f"/api/v1/investigations/{inv_id}/hypotheses/{hyp_id}", headers=headers).json()
    # Check that status remains OPEN or whatever investigator sets (no automatic "SUPPORTED" or "PROVEN")
    assert detail["status"] == "OPEN"
    # Check relationship type is explicit SUPPORTS
    assert detail["evidence_links"][0]["relationship_type"] == "SUPPORTS"


# ============================================================================
# 19. EMPTY TITLE REJECTED
# ============================================================================
def test_19_empty_title_rejected():
    token, _, _ = register_user()
    inv_id = create_investigation(token)
    headers = {"Authorization": f"Bearer {token}"}

    # Whitespace title
    res_blank = client.post(
        f"/api/v1/investigations/{inv_id}/hypotheses",
        headers=headers,
        json={"title": "   ", "description": "No title provided."},
    )
    assert res_blank.status_code in (400, 422)

    # Empty string
    res_empty = client.post(
        f"/api/v1/investigations/{inv_id}/hypotheses",
        headers=headers,
        json={"title": "", "description": "Empty title."},
    )
    assert res_empty.status_code in (400, 422)


# ============================================================================
# 20. UNAUTHORIZED HYPOTHESIS ACCESS REJECTED
# ============================================================================
def test_20_unauthorized_hypothesis_access_rejected():
    token, _, _ = register_user()
    inv_id = create_investigation(token)
    headers = {"Authorization": f"Bearer {token}"}

    create_hyp = client.post(
        f"/api/v1/investigations/{inv_id}/hypotheses",
        headers=headers,
        json={"title": "Protected Case Hypothesis"},
    )
    hyp_id = create_hyp.json()["id"]

    # Unauthenticated list
    res_noauth_list = client.get(f"/api/v1/investigations/{inv_id}/hypotheses")
    assert res_noauth_list.status_code == 401

    # Unauthenticated get
    res_noauth_get = client.get(f"/api/v1/investigations/{inv_id}/hypotheses/{hyp_id}")
    assert res_noauth_get.status_code == 401

    # Unauthenticated post
    res_noauth_post = client.post(
        f"/api/v1/investigations/{inv_id}/hypotheses",
        json={"title": "Unauthenticated Post"},
    )
    assert res_noauth_post.status_code == 401
