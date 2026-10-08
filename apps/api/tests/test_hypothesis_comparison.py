"""
Tests for Phase 8B — Comparative Hypothesis Evaluation & Matrix Analysis.

Covers:
1. Compare two hypotheses
2. Compare three hypotheses
3. Fewer than two hypotheses rejected
4. Duplicate hypothesis IDs rejected
5. Cross-investigation hypothesis rejected
6. Cross-user access rejected
7. Common evidence identified
8. Different relationships identified
9. SUPPORTS vs CONTRADICTS marked potentially discriminating
10. SUPPORTS vs SUPPORTS not marked discriminating
11. NOT_LINKED is not treated as CONTRADICTS
12. Missing evidence requirements included
13. Observation comparison works
14. Evidence-first language preserved
15. No automatic ranking
16. No probability score generated
17. Deleted / invalid hypothesis handled safely
18. Evidence remains traceable to original record
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
    return f"compare_tester_{uuid.uuid4().hex[:10]}@ecointelligence.org"


def register_user(display_name="Comparison Investigator"):
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


def create_investigation(token, title="Chemical Runoff Investigation"):
    headers = {"Authorization": f"Bearer {token}"}
    res = client.post(
        "/api/v1/investigations",
        headers=headers,
        json={
            "title": title,
            "category": "water_contamination",
            "description": "Comparative root-cause evaluation investigation.",
            "severity": "high",
        },
    )
    assert res.status_code == 201
    return res.json()["id"]


def upload_evidence(token, inv_id, filename="outflow_sample.png"):
    headers = {"Authorization": f"Bearer {token}"}
    files = {"file": (filename, io.BytesIO(VALID_PNG_BYTES), "image/png")}
    data = {
        "source_type": "observed",
        "description": f"Field evidence {filename}.",
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


def create_observation(token, inv_id, desc="Observed visual discoloration at ditch outlet."):
    headers = {"Authorization": f"Bearer {token}"}
    res = client.post(
        f"/api/v1/investigations/{inv_id}/observations",
        headers=headers,
        json={
            "category": "water_pollution",
            "description": desc,
            "severity": "high",
            "source_type": "observed",
            "confidence": 90.0,
        },
    )
    assert res.status_code == 201
    return res.json()["id"]


def create_hypothesis(token, inv_id, title, confidence="MEDIUM", reasoning=None):
    headers = {"Authorization": f"Bearer {token}"}
    res = client.post(
        f"/api/v1/investigations/{inv_id}/hypotheses",
        headers=headers,
        json={
            "title": title,
            "confidence": confidence,
            "reasoning": reasoning or f"Reasoning for {title}",
            "status": "OPEN",
        },
    )
    assert res.status_code == 201
    return res.json()["id"]


def link_evidence(token, inv_id, hyp_id, ev_id, rel_type="SUPPORTS", note=None):
    headers = {"Authorization": f"Bearer {token}"}
    res = client.post(
        f"/api/v1/investigations/{inv_id}/hypotheses/{hyp_id}/evidence",
        headers=headers,
        json={"evidence_id": ev_id, "relationship_type": rel_type, "note": note},
    )
    assert res.status_code == 201
    return res.json()


def link_observation(token, inv_id, hyp_id, obs_id, rel_type="SUPPORTS", note=None):
    headers = {"Authorization": f"Bearer {token}"}
    res = client.post(
        f"/api/v1/investigations/{inv_id}/hypotheses/{hyp_id}/observations",
        headers=headers,
        json={"observation_id": obs_id, "relationship_type": rel_type, "note": note},
    )
    assert res.status_code == 201
    return res.json()


def add_missing_evidence(token, inv_id, hyp_id, description, priority="HIGH"):
    headers = {"Authorization": f"Bearer {token}"}
    res = client.post(
        f"/api/v1/investigations/{inv_id}/hypotheses/{hyp_id}/missing-evidence",
        headers=headers,
        json={"description": description, "priority": priority, "status": "OPEN"},
    )
    assert res.status_code == 201
    return res.json()


# ============================================================================
# 1. COMPARE TWO HYPOTHESES
# ============================================================================
def test_1_compare_two_hypotheses():
    token, _, _ = register_user()
    inv_id = create_investigation(token)
    headers = {"Authorization": f"Bearer {token}"}

    h1_id = create_hypothesis(token, inv_id, "H1: Unpermitted Chemical Discharge")
    h2_id = create_hypothesis(token, inv_id, "H2: Stormwater Sediment Flushing")

    ev1_id = upload_evidence(token, inv_id, "turbidity_test.png")
    link_evidence(token, inv_id, h1_id, ev1_id, "SUPPORTS", "Turbidity spike fits chemical slug.")
    link_evidence(token, inv_id, h2_id, ev1_id, "CONTRADICTS", "No rain occurred prior to spike.")

    res = client.post(
        f"/api/v1/investigations/{inv_id}/hypotheses/compare",
        headers=headers,
        json={"hypothesis_ids": [h1_id, h2_id]},
    )
    assert res.status_code == 200
    data = res.json()

    assert data["investigation_id"] == inv_id
    assert len(data["hypotheses"]) == 2
    assert len(data["evidence_matrix"]) == 1

    row = data["evidence_matrix"][0]
    assert row["evidence_id"] == ev1_id
    assert len(row["cells"]) == 2

    # Check cell for H1 and H2
    cell_h1 = next(c for c in row["cells"] if c["hypothesis_id"] == h1_id)
    cell_h2 = next(c for c in row["cells"] if c["hypothesis_id"] == h2_id)
    assert cell_h1["relationship_type"] == "SUPPORTS"
    assert cell_h1["is_linked"] is True
    assert cell_h2["relationship_type"] == "CONTRADICTS"
    assert cell_h2["is_linked"] is True

    # Summary
    summary = data["summary"]
    assert summary["selected_hypotheses_count"] == 2
    assert summary["total_evidence_referenced"] == 1
    assert summary["common_evidence_count"] == 1
    assert summary["discriminating_evidence_count"] == 1
    assert summary["contradicting_evidence_count"] == 1


# ============================================================================
# 2. COMPARE THREE HYPOTHESES
# ============================================================================
def test_2_compare_three_hypotheses():
    token, _, _ = register_user()
    inv_id = create_investigation(token)
    headers = {"Authorization": f"Bearer {token}"}

    h1_id = create_hypothesis(token, inv_id, "H1: Industrial Pipe Breach")
    h2_id = create_hypothesis(token, inv_id, "H2: Agricultural Runoff")
    h3_id = create_hypothesis(token, inv_id, "H3: Upstream Reservoir Release")

    ev1_id = upload_evidence(token, inv_id, "water_sample.png")
    ev2_id = upload_evidence(token, inv_id, "satellite_infrared.png")
    ev3_id = upload_evidence(token, inv_id, "drain_gauge.png")

    # EV1: linked to all three
    link_evidence(token, inv_id, h1_id, ev1_id, "SUPPORTS")
    link_evidence(token, inv_id, h2_id, ev1_id, "CONTRADICTS")
    link_evidence(token, inv_id, h3_id, ev1_id, "CONTEXT")

    # EV2: linked to H1 and H3
    link_evidence(token, inv_id, h1_id, ev2_id, "SUPPORTS")
    link_evidence(token, inv_id, h3_id, ev2_id, "SUPPORTS")

    # EV3: linked only to H2
    link_evidence(token, inv_id, h2_id, ev3_id, "SUPPORTS")

    res = client.post(
        f"/api/v1/investigations/{inv_id}/hypotheses/compare",
        headers=headers,
        json={"hypothesis_ids": [h1_id, h2_id, h3_id]},
    )
    assert res.status_code == 200
    data = res.json()

    assert len(data["hypotheses"]) == 3
    assert len(data["evidence_matrix"]) == 3

    # Check EV2 cell for H2 is NOT_LINKED
    row_ev2 = next(r for r in data["evidence_matrix"] if r["evidence_id"] == ev2_id)
    cell_ev2_h2 = next(c for c in row_ev2["cells"] if c["hypothesis_id"] == h2_id)
    assert cell_ev2_h2["relationship_type"] == "NOT_LINKED"
    assert cell_ev2_h2["is_linked"] is False

    # EV1 is discriminating
    row_ev1 = next(r for r in data["evidence_matrix"] if r["evidence_id"] == ev1_id)
    assert row_ev1["is_discriminating"] is True

    # EV2 has SAME relationship between linked hypotheses (H1 SUPPORTS, H3 SUPPORTS)
    assert row_ev2["is_discriminating"] is False
    assert row_ev2["is_common"] is True
    assert row_ev2["relationship_classification"] == "SAME"

    # EV3 is single association
    row_ev3 = next(r for r in data["evidence_matrix"] if r["evidence_id"] == ev3_id)
    assert row_ev3["is_common"] is False
    assert row_ev3["relationship_classification"] == "SINGLE_ASSOCIATION"


# ============================================================================
# 3. FEWER THAN TWO HYPOTHESES REJECTED
# ============================================================================
def test_3_fewer_than_two_hypotheses_rejected():
    token, _, _ = register_user()
    inv_id = create_investigation(token)
    headers = {"Authorization": f"Bearer {token}"}

    h1_id = create_hypothesis(token, inv_id, "H1: Solitary Hypothesis")

    # 0 hypotheses
    res_zero = client.post(
        f"/api/v1/investigations/{inv_id}/hypotheses/compare",
        headers=headers,
        json={"hypothesis_ids": []},
    )
    assert res_zero.status_code in (400, 422)

    # 1 hypothesis
    res_one = client.post(
        f"/api/v1/investigations/{inv_id}/hypotheses/compare",
        headers=headers,
        json={"hypothesis_ids": [h1_id]},
    )
    assert res_one.status_code in (400, 422)


# ============================================================================
# 4. DUPLICATE HYPOTHESIS IDS REJECTED
# ============================================================================
def test_4_duplicate_hypothesis_ids_rejected():
    token, _, _ = register_user()
    inv_id = create_investigation(token)
    headers = {"Authorization": f"Bearer {token}"}

    h1_id = create_hypothesis(token, inv_id, "H1: First Hypothesis")

    res = client.post(
        f"/api/v1/investigations/{inv_id}/hypotheses/compare",
        headers=headers,
        json={"hypothesis_ids": [h1_id, h1_id]},
    )
    assert res.status_code in (400, 422)


# ============================================================================
# 5. CROSS-INVESTIGATION HYPOTHESIS REJECTED
# ============================================================================
def test_5_cross_investigation_hypothesis_rejected():
    token, _, _ = register_user()
    inv1_id = create_investigation(token, "Investigation Alpha")
    inv2_id = create_investigation(token, "Investigation Beta")
    headers = {"Authorization": f"Bearer {token}"}

    h1_id = create_hypothesis(token, inv1_id, "H1 in Alpha")
    h2_id = create_hypothesis(token, inv2_id, "H2 in Beta")

    # Attempt to compare in inv1 using H2 from inv2
    res = client.post(
        f"/api/v1/investigations/{inv1_id}/hypotheses/compare",
        headers=headers,
        json={"hypothesis_ids": [h1_id, h2_id]},
    )
    assert res.status_code in (400, 404)


# ============================================================================
# 6. CROSS-USER ACCESS REJECTED
# ============================================================================
def test_6_cross_user_access_rejected():
    token_a, _, _ = register_user("Investigator A")
    token_b, _, _ = register_user("Investigator B")

    inv_a = create_investigation(token_a, "Case A")
    inv_b = create_investigation(token_b, "Case B")

    h1_a = create_hypothesis(token_a, inv_a, "H1 Case A")
    h2_a = create_hypothesis(token_a, inv_a, "H2 Case A")

    # User B tries to compare in User A's investigation
    res = client.post(
        f"/api/v1/investigations/{inv_a}/hypotheses/compare",
        headers={"Authorization": f"Bearer {token_b}"},
        json={"hypothesis_ids": [h1_a, h2_a]},
    )
    assert res.status_code == 403

    # User B tries to pass User A's hypothesis into User B's investigation
    h1_b = create_hypothesis(token_b, inv_b, "H1 Case B")
    res_inject = client.post(
        f"/api/v1/investigations/{inv_b}/hypotheses/compare",
        headers={"Authorization": f"Bearer {token_b}"},
        json={"hypothesis_ids": [h1_b, h1_a]},
    )
    assert res_inject.status_code in (400, 404)


# ============================================================================
# 7. COMMON EVIDENCE IDENTIFIED
# ============================================================================
def test_7_common_evidence_identified():
    token, _, _ = register_user()
    inv_id = create_investigation(token)
    headers = {"Authorization": f"Bearer {token}"}

    h1_id = create_hypothesis(token, inv_id, "H1")
    h2_id = create_hypothesis(token, inv_id, "H2")

    ev_common = upload_evidence(token, inv_id, "common_doc.png")
    ev_single = upload_evidence(token, inv_id, "single_doc.png")

    link_evidence(token, inv_id, h1_id, ev_common, "SUPPORTS")
    link_evidence(token, inv_id, h2_id, ev_common, "SUPPORTS")
    link_evidence(token, inv_id, h1_id, ev_single, "SUPPORTS")

    res = client.post(
        f"/api/v1/investigations/{inv_id}/hypotheses/compare",
        headers=headers,
        json={"hypothesis_ids": [h1_id, h2_id]},
    )
    assert res.status_code == 200
    data = res.json()

    common_ids = [e["evidence_id"] for e in data["common_evidence"]]
    assert ev_common in common_ids
    assert ev_single not in common_ids


# ============================================================================
# 8. DIFFERENT RELATIONSHIPS IDENTIFIED
# ============================================================================
def test_8_different_relationships_identified():
    token, _, _ = register_user()
    inv_id = create_investigation(token)
    headers = {"Authorization": f"Bearer {token}"}

    h1_id = create_hypothesis(token, inv_id, "H1")
    h2_id = create_hypothesis(token, inv_id, "H2")

    ev_diff = upload_evidence(token, inv_id, "different_rel.png")
    link_evidence(token, inv_id, h1_id, ev_diff, "SUPPORTS")
    link_evidence(token, inv_id, h2_id, ev_diff, "CONTEXT")

    res = client.post(
        f"/api/v1/investigations/{inv_id}/hypotheses/compare",
        headers=headers,
        json={"hypothesis_ids": [h1_id, h2_id]},
    )
    assert res.status_code == 200
    row = res.json()["evidence_matrix"][0]
    assert row["relationship_classification"] == "DIFFERENT"
    assert row["is_discriminating"] is True


# ============================================================================
# 9. SUPPORTS VS CONTRADICTS MARKED POTENTIALLY DISCRIMINATING
# ============================================================================
def test_9_supports_vs_contradicts_marked_potentially_discriminating():
    token, _, _ = register_user()
    inv_id = create_investigation(token)
    headers = {"Authorization": f"Bearer {token}"}

    h1_id = create_hypothesis(token, inv_id, "H1")
    h2_id = create_hypothesis(token, inv_id, "H2")

    ev_id = upload_evidence(token, inv_id, "discriminating_sample.png")
    link_evidence(token, inv_id, h1_id, ev_id, "SUPPORTS")
    link_evidence(token, inv_id, h2_id, ev_id, "CONTRADICTS")

    res = client.post(
        f"/api/v1/investigations/{inv_id}/hypotheses/compare",
        headers=headers,
        json={"hypothesis_ids": [h1_id, h2_id]},
    )
    assert res.status_code == 200
    data = res.json()

    row = data["evidence_matrix"][0]
    assert row["is_discriminating"] is True
    assert row["has_contradiction"] is True
    assert len(data["discriminating_evidence"]) == 1
    assert len(data["contradicting_evidence"]) == 1


# ============================================================================
# 10. SUPPORTS VS SUPPORTS NOT MARKED DISCRIMINATING
# ============================================================================
def test_10_supports_vs_supports_not_marked_discriminating():
    token, _, _ = register_user()
    inv_id = create_investigation(token)
    headers = {"Authorization": f"Bearer {token}"}

    h1_id = create_hypothesis(token, inv_id, "H1")
    h2_id = create_hypothesis(token, inv_id, "H2")

    ev_id = upload_evidence(token, inv_id, "concordant.png")
    link_evidence(token, inv_id, h1_id, ev_id, "SUPPORTS")
    link_evidence(token, inv_id, h2_id, ev_id, "SUPPORTS")

    res = client.post(
        f"/api/v1/investigations/{inv_id}/hypotheses/compare",
        headers=headers,
        json={"hypothesis_ids": [h1_id, h2_id]},
    )
    assert res.status_code == 200
    data = res.json()

    row = data["evidence_matrix"][0]
    assert row["is_discriminating"] is False
    assert row["has_contradiction"] is False
    assert len(data["discriminating_evidence"]) == 0


# ============================================================================
# 11. NOT_LINKED IS NOT TREATED AS CONTRADICTS
# ============================================================================
def test_11_not_linked_is_not_treated_as_contradicts():
    token, _, _ = register_user()
    inv_id = create_investigation(token)
    headers = {"Authorization": f"Bearer {token}"}

    h1_id = create_hypothesis(token, inv_id, "H1")
    h2_id = create_hypothesis(token, inv_id, "H2")

    ev_id = upload_evidence(token, inv_id, "only_h1.png")
    link_evidence(token, inv_id, h1_id, ev_id, "SUPPORTS")

    res = client.post(
        f"/api/v1/investigations/{inv_id}/hypotheses/compare",
        headers=headers,
        json={"hypothesis_ids": [h1_id, h2_id]},
    )
    assert res.status_code == 200
    data = res.json()

    row = data["evidence_matrix"][0]
    cell_h2 = next(c for c in row["cells"] if c["hypothesis_id"] == h2_id)
    assert cell_h2["relationship_type"] == "NOT_LINKED"
    assert cell_h2["is_linked"] is False

    # Absence of linkage is NOT contradiction and NOT discriminating
    assert row["has_contradiction"] is False
    assert row["is_discriminating"] is False
    assert len(data["contradicting_evidence"]) == 0


# ============================================================================
# 12. MISSING EVIDENCE REQUIREMENTS INCLUDED
# ============================================================================
def test_12_missing_evidence_requirements_included():
    token, _, _ = register_user()
    inv_id = create_investigation(token)
    headers = {"Authorization": f"Bearer {token}"}

    h1_id = create_hypothesis(token, inv_id, "H1")
    h2_id = create_hypothesis(token, inv_id, "H2")

    add_missing_evidence(token, inv_id, h1_id, "Need upstream water baseline sample.", "HIGH")
    add_missing_evidence(token, inv_id, h2_id, "Need weather station rainfall telemetry.", "MEDIUM")

    res = client.post(
        f"/api/v1/investigations/{inv_id}/hypotheses/compare",
        headers=headers,
        json={"hypothesis_ids": [h1_id, h2_id]},
    )
    assert res.status_code == 200
    data = res.json()

    assert len(data["missing_requirements"]) == 2
    assert data["summary"]["unresolved_requirements_count"] == 2
    descriptions = [r["description"] for r in data["missing_requirements"]]
    assert "Need upstream water baseline sample." in descriptions
    assert "Need weather station rainfall telemetry." in descriptions


# ============================================================================
# 13. OBSERVATION COMPARISON WORKS
# ============================================================================
def test_13_observation_comparison_works():
    token, _, _ = register_user()
    inv_id = create_investigation(token)
    headers = {"Authorization": f"Bearer {token}"}

    h1_id = create_hypothesis(token, inv_id, "H1")
    h2_id = create_hypothesis(token, inv_id, "H2")

    obs_id = create_observation(token, inv_id, "Pungent chemical odor detected at downstream weir.")
    link_observation(token, inv_id, h1_id, obs_id, "SUPPORTS")
    link_observation(token, inv_id, h2_id, obs_id, "CONTRADICTS")

    res = client.post(
        f"/api/v1/investigations/{inv_id}/hypotheses/compare",
        headers=headers,
        json={"hypothesis_ids": [h1_id, h2_id]},
    )
    assert res.status_code == 200
    data = res.json()

    assert len(data["observation_matrix"]) == 1
    obs_row = data["observation_matrix"][0]
    assert obs_row["observation_id"] == obs_id
    assert obs_row["is_discriminating"] is True
    assert obs_row["has_contradiction"] is True
    assert obs_row["relationship_classification"] == "DIFFERENT"


# ============================================================================
# 14. EVIDENCE-FIRST LANGUAGE PRESERVED
# ============================================================================
def test_14_evidence_first_language_preserved():
    token, _, _ = register_user()
    inv_id = create_investigation(token)
    headers = {"Authorization": f"Bearer {token}"}

    h1_id = create_hypothesis(token, inv_id, "H1")
    h2_id = create_hypothesis(token, inv_id, "H2")

    res = client.post(
        f"/api/v1/investigations/{inv_id}/hypotheses/compare",
        headers=headers,
        json={"hypothesis_ids": [h1_id, h2_id]},
    )
    assert res.status_code == 200
    data = res.json()

    # Verify no prohibited automated verdict words exist in response keys or values
    data_str = str(data).lower()
    assert "most likely cause" not in data_str
    assert "winner" not in data_str
    assert "probability" not in data_str
    assert "root cause identified" not in data_str
    assert "hypothesis proven" not in data_str


# ============================================================================
# 15. NO AUTOMATIC RANKING
# ============================================================================
def test_15_no_automatic_ranking():
    token, _, _ = register_user()
    inv_id = create_investigation(token)
    headers = {"Authorization": f"Bearer {token}"}

    # H1 has 1 supporting evidence, H2 has 4 supporting evidence
    h1_id = create_hypothesis(token, inv_id, "Hypothesis 1")
    h2_id = create_hypothesis(token, inv_id, "Hypothesis 2")

    for i in range(4):
        ev = upload_evidence(token, inv_id, f"support_ev_{i}.png")
        link_evidence(token, inv_id, h2_id, ev, "SUPPORTS")
        if i == 0:
            link_evidence(token, inv_id, h1_id, ev, "SUPPORTS")

    res = client.post(
        f"/api/v1/investigations/{inv_id}/hypotheses/compare",
        headers=headers,
        json={"hypothesis_ids": [h1_id, h2_id]},
    )
    assert res.status_code == 200
    data = res.json()

    # The order remains the requested order [h1_id, h2_id]
    assert data["hypotheses"][0]["id"] == h1_id
    assert data["hypotheses"][1]["id"] == h2_id
    # No "rank" or "score" attribute added
    assert "rank" not in data["hypotheses"][0]
    assert "score" not in data["hypotheses"][0]


# ============================================================================
# 16. NO PROBABILITY SCORE GENERATED
# ============================================================================
def test_16_no_probability_score_generated():
    token, _, _ = register_user()
    inv_id = create_investigation(token)
    headers = {"Authorization": f"Bearer {token}"}

    h1_id = create_hypothesis(token, inv_id, "H1", confidence="LOW")
    h2_id = create_hypothesis(token, inv_id, "H2", confidence="HIGH")

    res = client.post(
        f"/api/v1/investigations/{inv_id}/hypotheses/compare",
        headers=headers,
        json={"hypothesis_ids": [h1_id, h2_id]},
    )
    assert res.status_code == 200
    data = res.json()

    for h in data["hypotheses"]:
        # Only human-assigned confidence enums exist
        assert h["confidence"] in ("LOW", "MEDIUM", "HIGH")
        assert "probability" not in h
        assert "confidence_score" not in h


# ============================================================================
# 17. DELETED / INVALID HYPOTHESIS HANDLED SAFELY
# ============================================================================
def test_17_deleted_invalid_hypothesis_handled_safely():
    token, _, _ = register_user()
    inv_id = create_investigation(token)
    headers = {"Authorization": f"Bearer {token}"}

    h1_id = create_hypothesis(token, inv_id, "H1")
    h2_id = create_hypothesis(token, inv_id, "H2")

    # Delete H2
    del_res = client.delete(
        f"/api/v1/investigations/{inv_id}/hypotheses/{h2_id}",
        headers=headers,
    )
    assert del_res.status_code == 204

    # Compare with deleted H2
    res_deleted = client.post(
        f"/api/v1/investigations/{inv_id}/hypotheses/compare",
        headers=headers,
        json={"hypothesis_ids": [h1_id, h2_id]},
    )
    assert res_deleted.status_code == 404

    # Compare with non-existent ID 999999
    res_nonexistent = client.post(
        f"/api/v1/investigations/{inv_id}/hypotheses/compare",
        headers=headers,
        json={"hypothesis_ids": [h1_id, 999999]},
    )
    assert res_nonexistent.status_code == 404


# ============================================================================
# 18. EVIDENCE REMAINS TRACEABLE TO ORIGINAL RECORD
# ============================================================================
def test_18_evidence_remains_traceable_to_original_record():
    token, _, _ = register_user()
    inv_id = create_investigation(token)
    headers = {"Authorization": f"Bearer {token}"}

    h1_id = create_hypothesis(token, inv_id, "H1")
    h2_id = create_hypothesis(token, inv_id, "H2")

    ev_id = upload_evidence(token, inv_id, "original_field_photo.png")
    link_evidence(token, inv_id, h1_id, ev_id, "SUPPORTS", "Corresponds to drain entry.")

    res = client.post(
        f"/api/v1/investigations/{inv_id}/hypotheses/compare",
        headers=headers,
        json={"hypothesis_ids": [h1_id, h2_id]},
    )
    assert res.status_code == 200
    data = res.json()

    matrix_ev = data["evidence_matrix"][0]
    assert matrix_ev["evidence_id"] == ev_id
    assert matrix_ev["original_filename"] == "original_field_photo.png"
    assert matrix_ev["evidence_type"] == "image"
    assert matrix_ev["mime_type"] == "image/png"
