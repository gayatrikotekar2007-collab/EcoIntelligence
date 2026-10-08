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

VALID_PDF_BYTES = (
    b"%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n"
    b"2 0 obj\n<<\n/Type /Pages\n/Kids []\n/Count 0\n>>\nendobj\n"
    b"xref\n0 3\n0000000000 65535 f\n0000000009 00000 n\n0000000054 00000 n\n"
    b"trailer\n<<\n/Size 3\n/Root 1 0 R\n>>\nstartxref\n101\n%%EOF\n"
)


def random_email() -> str:
    return f"evidence_tester_{uuid.uuid4().hex[:10]}@ecointelligence.org"


def register_user(display_name="Evidence Investigator"):
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
            "description": "Suspected effluent release near wetlands canal.",
            "severity": "high",
        },
    )
    assert res.status_code == 201
    return res.json()["id"]


def test_1_authenticated_user_can_upload_evidence():
    token, _, _ = register_user("Field Agent 1")
    headers = {"Authorization": f"Bearer {token}"}
    inv_id = create_investigation(token)

    files = {"file": ("water_sample.png", io.BytesIO(VALID_PNG_BYTES), "image/png")}
    data = {
        "source_type": "observed",
        "description": "Direct photographic observation of water coloration at outflow point.",
        "verification_state": "verified",
    }

    res = client.post(
        f"/api/v1/investigations/{inv_id}/evidence",
        headers=headers,
        files=files,
        data=data,
    )
    assert res.status_code == 201
    body = res.json()
    assert body["investigation_id"] == inv_id
    assert body["mime_type"] == "image/png"
    assert body["evidence_type"] == "image"
    assert body["source_type"] == "observed"
    assert body["original_filename"] == "water_sample.png"
    assert body["description"] == "Direct photographic observation of water coloration at outflow point."
    assert body["verification_state"] == "verified"
    assert body["file_size_bytes"] == len(VALID_PNG_BYTES)
    assert "id" in body


def test_2_user_can_list_evidence_for_own_investigation():
    token, _, _ = register_user("Field Agent 2")
    headers = {"Authorization": f"Bearer {token}"}
    inv_id = create_investigation(token)

    # Upload two items
    files1 = {"file": ("sample_photo.png", io.BytesIO(VALID_PNG_BYTES), "image/png")}
    data1 = {"source_type": "observed", "description": "Photo 1"}
    r1 = client.post(f"/api/v1/investigations/{inv_id}/evidence", headers=headers, files=files1, data=data1)
    assert r1.status_code == 201

    files2 = {"file": ("lab_report.pdf", io.BytesIO(VALID_PDF_BYTES), "application/pdf")}
    data2 = {"source_type": "external_source", "description": "Independent laboratory analysis"}
    r2 = client.post(f"/api/v1/investigations/{inv_id}/evidence", headers=headers, files=files2, data=data2)
    assert r2.status_code == 201

    # List evidence
    res = client.get(f"/api/v1/investigations/{inv_id}/evidence", headers=headers)
    assert res.status_code == 200
    evidence_list = res.json()
    assert len(evidence_list) == 2
    filenames = [e["original_filename"] for e in evidence_list]
    assert "sample_photo.png" in filenames
    assert "lab_report.pdf" in filenames


def test_3_user_can_retrieve_own_evidence():
    token, _, _ = register_user("Field Agent 3")
    headers = {"Authorization": f"Bearer {token}"}
    inv_id = create_investigation(token)

    files = {"file": ("sample.png", io.BytesIO(VALID_PNG_BYTES), "image/png")}
    r_up = client.post(f"/api/v1/investigations/{inv_id}/evidence", headers=headers, files=files, data={"source_type": "observed"})
    assert r_up.status_code == 201
    ev_id = r_up.json()["id"]

    # Retrieve metadata
    res = client.get(f"/api/v1/evidence/{ev_id}", headers=headers)
    assert res.status_code == 200
    assert res.json()["id"] == ev_id
    assert res.json()["original_filename"] == "sample.png"

    # Download file content
    dl_res = client.get(f"/api/v1/evidence/{ev_id}/download", headers=headers)
    assert dl_res.status_code == 200
    assert dl_res.content == VALID_PNG_BYTES
    assert "attachment" in dl_res.headers.get("Content-Disposition", "")


def test_4_user_cannot_access_another_users_evidence():
    user1_tok, _, _ = register_user("User 1 Owner")
    user2_tok, _, _ = register_user("User 2 Intruder")
    inv_id = create_investigation(user1_tok)

    # User 1 uploads evidence
    files = {"file": ("secret.png", io.BytesIO(VALID_PNG_BYTES), "image/png")}
    r_up = client.post(
        f"/api/v1/investigations/{inv_id}/evidence",
        headers={"Authorization": f"Bearer {user1_tok}"},
        files=files,
        data={"source_type": "observed"},
    )
    assert r_up.status_code == 201
    ev_id = r_up.json()["id"]

    # User 2 tries to list User 1's investigation evidence -> 403 or 404
    u2_headers = {"Authorization": f"Bearer {user2_tok}"}
    r_list = client.get(f"/api/v1/investigations/{inv_id}/evidence", headers=u2_headers)
    assert r_list.status_code in (403, 404)

    # User 2 tries to get User 1's evidence -> 403 or 404
    r_get = client.get(f"/api/v1/evidence/{ev_id}", headers=u2_headers)
    assert r_get.status_code in (403, 404)

    # User 2 tries to download User 1's evidence -> 403 or 404
    r_dl = client.get(f"/api/v1/evidence/{ev_id}/download", headers=u2_headers)
    assert r_dl.status_code in (403, 404)


def test_5_user_cannot_modify_another_users_evidence():
    user1_tok, _, _ = register_user("User 1 Mod Owner")
    user2_tok, _, _ = register_user("User 2 Mod Attacker")
    inv_id = create_investigation(user1_tok)

    files = {"file": ("data.png", io.BytesIO(VALID_PNG_BYTES), "image/png")}
    r_up = client.post(
        f"/api/v1/investigations/{inv_id}/evidence",
        headers={"Authorization": f"Bearer {user1_tok}"},
        files=files,
        data={"source_type": "observed"},
    )
    ev_id = r_up.json()["id"]

    # User 2 tries to PATCH -> 403 or 404
    u2_headers = {"Authorization": f"Bearer {user2_tok}"}
    r_patch = client.patch(
        f"/api/v1/evidence/{ev_id}",
        headers=u2_headers,
        json={"description": "Hacked description", "verification_state": "verified"},
    )
    assert r_patch.status_code in (403, 404)


def test_6_user_cannot_delete_another_users_evidence():
    user1_tok, _, _ = register_user("User 1 Del Owner")
    user2_tok, _, _ = register_user("User 2 Del Attacker")
    inv_id = create_investigation(user1_tok)

    files = {"file": ("data.png", io.BytesIO(VALID_PNG_BYTES), "image/png")}
    r_up = client.post(
        f"/api/v1/investigations/{inv_id}/evidence",
        headers={"Authorization": f"Bearer {user1_tok}"},
        files=files,
        data={"source_type": "observed"},
    )
    ev_id = r_up.json()["id"]

    # User 2 tries to DELETE -> 403 or 404
    u2_headers = {"Authorization": f"Bearer {user2_tok}"}
    r_del = client.delete(f"/api/v1/evidence/{ev_id}", headers=u2_headers)
    assert r_del.status_code in (403, 404)

    # User 1 can still access it
    r_chk = client.get(f"/api/v1/evidence/{ev_id}", headers={"Authorization": f"Bearer {user1_tok}"})
    assert r_chk.status_code == 200


def test_7_invalid_file_type_is_rejected():
    token, _, _ = register_user("File Filter Tester")
    headers = {"Authorization": f"Bearer {token}"}
    inv_id = create_investigation(token)

    # 1. Disallowed extension
    files_exe = {"file": ("malware.exe", io.BytesIO(b"MZ\x90\x00\x03\x00\x00\x00"), "application/x-dosexec")}
    r_exe = client.post(f"/api/v1/investigations/{inv_id}/evidence", headers=headers, files=files_exe)
    assert r_exe.status_code == 422
    assert "Unsupported file extension" in r_exe.json()["detail"]

    # 2. Fake PNG with text content (magic bytes mismatch)
    files_fake = {"file": ("corrupt.png", io.BytesIO(b"This is just plain text masquerading as PNG"), "image/png")}
    r_fake = client.post(f"/api/v1/investigations/{inv_id}/evidence", headers=headers, files=files_fake)
    assert r_fake.status_code == 422
    assert "File signature does not match" in r_fake.json()["detail"]


def test_8_oversized_file_is_rejected():
    token, _, _ = register_user("Oversize Tester")
    headers = {"Authorization": f"Bearer {token}"}
    inv_id = create_investigation(token)

    # Generate oversized payload > 10MB
    oversized = b"\x89PNG\r\n\x1a\n" + b"0" * (10 * 1024 * 1024 + 100)
    files = {"file": ("huge.png", io.BytesIO(oversized), "image/png")}
    r_big = client.post(f"/api/v1/investigations/{inv_id}/evidence", headers=headers, files=files)
    assert r_big.status_code in (413, 422)


def test_9_evidence_is_linked_to_investigation():
    token, _, _ = register_user("Link Inv Tester")
    headers = {"Authorization": f"Bearer {token}"}
    inv_id = create_investigation(token)

    files = {"file": ("soil_core.png", io.BytesIO(VALID_PNG_BYTES), "image/png")}
    r_up = client.post(
        f"/api/v1/investigations/{inv_id}/evidence",
        headers=headers,
        files=files,
        data={"source_type": "observed", "description": "Soil sample core from 2m depth"},
    )
    assert r_up.status_code == 201
    ev_id = r_up.json()["id"]

    # Check investigation detail view
    r_inv = client.get(f"/api/v1/investigations/{inv_id}", headers=headers)
    assert r_inv.status_code == 200
    inv_data = r_inv.json()
    assert "evidence" in inv_data
    evidence_ids = [e["id"] for e in inv_data["evidence"]]
    assert ev_id in evidence_ids


def test_10_evidence_can_be_linked_to_observation():
    token, _, _ = register_user("Obs Link Tester")
    headers = {"Authorization": f"Bearer {token}"}
    inv_id = create_investigation(token)

    # 1. Create an observation with required category & description
    r_obs = client.post(
        f"/api/v1/investigations/{inv_id}/observations",
        headers=headers,
        json={
            "category": "water_pollution",
            "description": "Milky white liquid entering the stream.",
            "observed_at": "2026-09-26T12:00:00Z",
        },
    )
    assert r_obs.status_code == 201
    obs_id = r_obs.json()["id"]

    # 2. Upload evidence directly linked to observation
    files = {"file": ("plume.png", io.BytesIO(VALID_PNG_BYTES), "image/png")}
    r_up = client.post(
        f"/api/v1/investigations/{inv_id}/evidence",
        headers=headers,
        files=files,
        data={
            "observation_id": obs_id,
            "source_type": "observed",
            "description": "Photograph of visible plume matching observation",
        },
    )
    assert r_up.status_code == 201
    ev_id = r_up.json()["id"]
    assert r_up.json()["observation_id"] == obs_id

    # 3. Check investigation detail to ensure observation shows linked evidence
    r_inv = client.get(f"/api/v1/investigations/{inv_id}", headers=headers)
    assert r_inv.status_code == 200
    obs_list = r_inv.json()["observations"]
    matching_obs = next((o for o in obs_list if o["id"] == obs_id), None)
    assert matching_obs is not None
    assert matching_obs.get("evidence_count") == 1
    assert ev_id in matching_obs.get("evidence_ids", [])


def test_11_evidence_appears_in_timeline():
    token, _, _ = register_user("Timeline Add Tester")
    headers = {"Authorization": f"Bearer {token}"}
    inv_id = create_investigation(token)

    files = {"file": ("field_record.png", io.BytesIO(VALID_PNG_BYTES), "image/png")}
    r_up = client.post(
        f"/api/v1/investigations/{inv_id}/evidence",
        headers=headers,
        files=files,
        data={"source_type": "observed", "description": "Field sensor reading snapshot"},
    )
    assert r_up.status_code == 201

    # Check timeline entries
    r_tl = client.get(f"/api/v1/investigations/{inv_id}/timeline", headers=headers)
    assert r_tl.status_code == 200
    tl = r_tl.json()
    added_entry = next((e for e in tl if e["event_type"] == "evidence_added"), None)
    assert added_entry is not None
    assert "field_record.png" in added_entry["description"]
    assert "observed" in added_entry["description"]


def test_12_deleting_evidence_updates_timeline_appropriately():
    token, _, _ = register_user("Timeline Del Tester")
    headers = {"Authorization": f"Bearer {token}"}
    inv_id = create_investigation(token)

    # 1. Upload evidence
    files = {"file": ("temporary_notes.pdf", io.BytesIO(VALID_PDF_BYTES), "application/pdf")}
    r_up = client.post(
        f"/api/v1/investigations/{inv_id}/evidence",
        headers=headers,
        files=files,
        data={"source_type": "user_reported", "description": "Initial witness report draft"},
    )
    assert r_up.status_code == 201
    ev_id = r_up.json()["id"]

    # 2. Delete evidence
    r_del = client.delete(f"/api/v1/evidence/{ev_id}", headers=headers)
    assert r_del.status_code == 204

    # 3. Verify evidence record is gone
    r_chk = client.get(f"/api/v1/evidence/{ev_id}", headers=headers)
    assert r_chk.status_code in (403, 404)

    # 4. Verify timeline has evidence_deleted entry
    r_tl = client.get(f"/api/v1/investigations/{inv_id}/timeline", headers=headers)
    assert r_tl.status_code == 200
    tl = r_tl.json()
    del_entry = next((e for e in tl if e["event_type"] == "evidence_deleted"), None)
    assert del_entry is not None
    assert "temporary_notes.pdf" in del_entry["description"]


def test_13_evidence_gaps_detection():
    token, _, _ = register_user("Gaps Tester")
    headers = {"Authorization": f"Bearer {token}"}
    inv_id = create_investigation(token)

    # 1. Initially: No coordinates & Zero evidence attached
    r_gaps = client.get(f"/api/v1/investigations/{inv_id}/evidence-gaps", headers=headers)
    assert r_gaps.status_code == 200
    gaps_data = r_gaps.json()
    gap_types = [g["gap_type"] for g in gaps_data["gaps"]]
    assert "missing_coordinates" in gap_types
    assert "no_evidence" in gap_types

    # 2. Add an observation without evidence
    r_obs = client.post(
        f"/api/v1/investigations/{inv_id}/observations",
        headers=headers,
        json={
            "category": "vegetation_loss",
            "description": "Severe canopy dieback along riverbank.",
            "severity": "high",
        },
    )
    assert r_obs.status_code == 201
    obs_id = r_obs.json()["id"]

    # Check gaps again -> should flag unsupported_observation
    r_gaps2 = client.get(f"/api/v1/investigations/{inv_id}/evidence-gaps", headers=headers)
    assert r_gaps2.status_code == 200
    gap_types2 = [g["gap_type"] for g in r_gaps2.json()["gaps"]]
    assert "unsupported_observation" in gap_types2

    # 3. Upload evidence supporting the observation
    files = {"file": ("canopy_photo.png", io.BytesIO(VALID_PNG_BYTES), "image/png")}
    r_up = client.post(
        f"/api/v1/investigations/{inv_id}/evidence",
        headers=headers,
        files=files,
        data={
            "observation_id": obs_id,
            "source_type": "observed",
            "description": "High-resolution canopy dieback photograph",
            "verification_state": "verified",
        },
    )
    assert r_up.status_code == 201

    # Check gaps again -> no_evidence and unsupported_observation should be resolved
    r_gaps3 = client.get(f"/api/v1/investigations/{inv_id}/evidence-gaps", headers=headers)
    assert r_gaps3.status_code == 200
    gap_types3 = [g["gap_type"] for g in r_gaps3.json()["gaps"]]
    assert "no_evidence" not in gap_types3
    assert "unsupported_observation" not in gap_types3


def test_14_evidence_gaps_ownership_isolation():
    user1_tok, _, _ = register_user("Gaps Owner")
    user2_tok, _, _ = register_user("Gaps Intruder")
    inv_id = create_investigation(user1_tok)

    # User 2 tries to access User 1's evidence gaps -> 404
    u2_headers = {"Authorization": f"Bearer {user2_tok}"}
    r = client.get(f"/api/v1/investigations/{inv_id}/evidence-gaps", headers=u2_headers)
    assert r.status_code in (403, 404)


def make_test_image(width=100, height=100, color=(100, 150, 200), draw_box=None):
    from PIL import Image, ImageDraw
    img = Image.new("RGB", (width, height), color=color)
    if draw_box:
        draw = ImageDraw.Draw(img)
        draw.rectangle(draw_box, fill=(255, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_15_compare_evidence_success():
    token, _, _ = register_user("Comparison Agent 1")
    headers = {"Authorization": f"Bearer {token}"}
    inv_id = create_investigation(token)

    # Upload before image (uniform color)
    img_before_bytes = make_test_image(120, 120, color=(100, 150, 200))
    r_before = client.post(
        f"/api/v1/investigations/{inv_id}/evidence",
        headers=headers,
        files={"file": ("before.png", io.BytesIO(img_before_bytes), "image/png")},
        data={"source_type": "observed", "description": "Baseline water condition"},
    )
    assert r_before.status_code == 201
    before_id = r_before.json()["id"]

    # Upload after image (with red rectangle in the center)
    img_after_bytes = make_test_image(120, 120, color=(100, 150, 200), draw_box=(30, 30, 80, 80))
    r_after = client.post(
        f"/api/v1/investigations/{inv_id}/evidence",
        headers=headers,
        files={"file": ("after.png", io.BytesIO(img_after_bytes), "image/png")},
        data={"source_type": "observed", "description": "Follow-up condition showing discoloration"},
    )
    assert r_after.status_code == 201
    after_id = r_after.json()["id"]

    # Execute compare
    res = client.post(
        f"/api/v1/investigations/{inv_id}/evidence/compare",
        headers=headers,
        json={"before_evidence_id": before_id, "after_evidence_id": after_id},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ANALYZED"
    assert body["investigation_id"] == inv_id
    assert body["before_evidence_id"] == before_id
    assert body["after_evidence_id"] == after_id
    assert 0.0 <= body["similarity"] <= 1.0
    assert body["changed_pixel_percentage"] > 0.0
    assert body["alignment_status"] in ("ALIGNED", "ALIGNED_RESCALED")
    assert body["difference_region"] is not None
    assert body["difference_region"]["width"] > 0
    assert body["difference_region"]["height"] > 0
    assert len(body["limitations"]) > 0


def test_16_compare_evidence_rejects_non_image():
    token, _, _ = register_user("Comparison Agent 2")
    headers = {"Authorization": f"Bearer {token}"}
    inv_id = create_investigation(token)

    # 1 Image, 1 PDF
    img_bytes = make_test_image(80, 80)
    r1 = client.post(
        f"/api/v1/investigations/{inv_id}/evidence",
        headers=headers,
        files={"file": ("photo.png", io.BytesIO(img_bytes), "image/png")},
        data={"source_type": "observed"},
    )
    r2 = client.post(
        f"/api/v1/investigations/{inv_id}/evidence",
        headers=headers,
        files={"file": ("report.pdf", io.BytesIO(VALID_PDF_BYTES), "application/pdf")},
        data={"source_type": "external_source"},
    )
    assert r1.status_code == 201
    assert r2.status_code == 201

    res = client.post(
        f"/api/v1/investigations/{inv_id}/evidence/compare",
        headers=headers,
        json={"before_evidence_id": r1.json()["id"], "after_evidence_id": r2.json()["id"]},
    )
    assert res.status_code == 400
    assert "Both evidence records must be images" in res.json()["detail"]


def test_17_compare_evidence_rejects_missing_and_identical():
    token, _, _ = register_user("Comparison Agent 3")
    headers = {"Authorization": f"Bearer {token}"}
    inv_id = create_investigation(token)

    img_bytes = make_test_image(80, 80)
    r = client.post(
        f"/api/v1/investigations/{inv_id}/evidence",
        headers=headers,
        files={"file": ("photo.png", io.BytesIO(img_bytes), "image/png")},
        data={"source_type": "observed"},
    )
    ev_id = r.json()["id"]

    # Reject identical IDs
    res_same = client.post(
        f"/api/v1/investigations/{inv_id}/evidence/compare",
        headers=headers,
        json={"before_evidence_id": ev_id, "after_evidence_id": ev_id},
    )
    assert res_same.status_code == 400
    assert "Cannot compare an evidence artifact with itself" in res_same.json()["detail"]

    # Reject missing evidence
    res_missing = client.post(
        f"/api/v1/investigations/{inv_id}/evidence/compare",
        headers=headers,
        json={"before_evidence_id": ev_id, "after_evidence_id": 999999},
    )
    assert res_missing.status_code == 404
    assert "not found in this investigation" in res_missing.json()["detail"]


def test_18_compare_evidence_rejects_cross_investigation():
    token, _, _ = register_user("Comparison Agent 4")
    headers = {"Authorization": f"Bearer {token}"}
    inv1 = create_investigation(token, "Inv 1")
    inv2 = create_investigation(token, "Inv 2")

    img1 = make_test_image(80, 80)
    img2 = make_test_image(80, 80)
    r1 = client.post(
        f"/api/v1/investigations/{inv1}/evidence",
        headers=headers,
        files={"file": ("p1.png", io.BytesIO(img1), "image/png")},
        data={"source_type": "observed"},
    )
    r2 = client.post(
        f"/api/v1/investigations/{inv2}/evidence",
        headers=headers,
        files={"file": ("p2.png", io.BytesIO(img2), "image/png")},
        data={"source_type": "observed"},
    )

    # Attempt to compare p1 (inv1) and p2 (inv2) inside inv1 endpoint
    res = client.post(
        f"/api/v1/investigations/{inv1}/evidence/compare",
        headers=headers,
        json={"before_evidence_id": r1.json()["id"], "after_evidence_id": r2.json()["id"]},
    )
    assert res.status_code == 404
    assert "not found in this investigation" in res.json()["detail"]


def test_19_compare_evidence_rejects_unauthorized_user():
    user1_tok, _, _ = register_user("Comparison Owner")
    user2_tok, _, _ = register_user("Comparison Intruder")
    inv_id = create_investigation(user1_tok)

    u1_headers = {"Authorization": f"Bearer {user1_tok}"}
    img1 = make_test_image(80, 80)
    img2 = make_test_image(80, 80)
    r1 = client.post(
        f"/api/v1/investigations/{inv_id}/evidence",
        headers=u1_headers,
        files={"file": ("p1.png", io.BytesIO(img1), "image/png")},
        data={"source_type": "observed"},
    )
    r2 = client.post(
        f"/api/v1/investigations/{inv_id}/evidence",
        headers=u1_headers,
        files={"file": ("p2.png", io.BytesIO(img2), "image/png")},
        data={"source_type": "observed"},
    )

    # User 2 attempts compare on User 1's investigation
    u2_headers = {"Authorization": f"Bearer {user2_tok}"}
    res = client.post(
        f"/api/v1/investigations/{inv_id}/evidence/compare",
        headers=u2_headers,
        json={"before_evidence_id": r1.json()["id"], "after_evidence_id": r2.json()["id"]},
    )
    assert res.status_code == 403


def test_20_compare_evidence_handles_corrupted_image():
    token, _, _ = register_user("Comparison Corrupt Agent")
    headers = {"Authorization": f"Bearer {token}"}
    inv_id = create_investigation(token)

    # Valid before image
    img1 = make_test_image(80, 80)
    r1 = client.post(
        f"/api/v1/investigations/{inv_id}/evidence",
        headers=headers,
        files={"file": ("valid.png", io.BytesIO(img1), "image/png")},
        data={"source_type": "observed"},
    )
    assert r1.status_code == 201

    # Corrupted image bytes starting with valid PNG magic header so upload passes
    corrupted_bytes = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
    r2 = client.post(
        f"/api/v1/investigations/{inv_id}/evidence",
        headers=headers,
        files={"file": ("corrupt.png", io.BytesIO(corrupted_bytes), "image/png")},
        data={"source_type": "observed"},
    )
    assert r2.status_code == 201

    res = client.post(
        f"/api/v1/investigations/{inv_id}/evidence/compare",
        headers=headers,
        json={"before_evidence_id": r1.json()["id"], "after_evidence_id": r2.json()["id"]},
    )
    assert res.status_code == 400
    assert "Corrupted or unreadable image file" in res.json()["detail"]


def test_21_compare_evidence_handles_alignment_uncertainty():
    token, _, _ = register_user("Comparison Alignment Agent")
    headers = {"Authorization": f"Bearer {token}"}
    inv_id = create_investigation(token)

    # Image A: 100x100 (aspect ratio 1.0)
    img_square = make_test_image(100, 100)
    # Image B: 100x250 (aspect ratio 0.4, divergence > 15%)
    img_tall = make_test_image(100, 250)

    r1 = client.post(
        f"/api/v1/investigations/{inv_id}/evidence",
        headers=headers,
        files={"file": ("square.png", io.BytesIO(img_square), "image/png")},
        data={"source_type": "observed"},
    )
    r2 = client.post(
        f"/api/v1/investigations/{inv_id}/evidence",
        headers=headers,
        files={"file": ("tall.png", io.BytesIO(img_tall), "image/png")},
        data={"source_type": "observed"},
    )

    res = client.post(
        f"/api/v1/investigations/{inv_id}/evidence/compare",
        headers=headers,
        json={"before_evidence_id": r1.json()["id"], "after_evidence_id": r2.json()["id"]},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["alignment_status"] == "ALIGNMENT_UNCERTAIN"
    assert any("aspect ratio divergence" in w for w in body["warnings"])


def test_22_compare_evidence_strict_evidence_first_no_conclusions():
    token, _, _ = register_user("Comparison Evidence First Agent")
    headers = {"Authorization": f"Bearer {token}"}
    inv_id = create_investigation(token)

    img1 = make_test_image(100, 100, color=(50, 50, 50))
    img2 = make_test_image(100, 100, color=(150, 150, 150))

    r1 = client.post(
        f"/api/v1/investigations/{inv_id}/evidence",
        headers=headers,
        files={"file": ("baseline.png", io.BytesIO(img1), "image/png")},
        data={"source_type": "observed"},
    )
    r2 = client.post(
        f"/api/v1/investigations/{inv_id}/evidence",
        headers=headers,
        files={"file": ("after.png", io.BytesIO(img2), "image/png")},
        data={"source_type": "observed"},
    )

    res = client.post(
        f"/api/v1/investigations/{inv_id}/evidence/compare",
        headers=headers,
        json={"before_evidence_id": r1.json()["id"], "after_evidence_id": r2.json()["id"]},
    )
    assert res.status_code == 200
    body = res.json()

    # Verify no autonomous conclusions are made in status, warnings, or result body
    forbidden_terms = [
        "pollution decreased",
        "pollution increased",
        "condition improved",
        "condition worsened",
        "water improved",
        "water degraded",
        "environmental recovery confirmed",
        "environmental disaster confirmed",
    ]
    warnings_text = " ".join(body.get("warnings", [])).lower()
    for term in forbidden_terms:
        assert term not in warnings_text
        assert term not in body["status"].lower()

    # Verify mandatory limitations contain the explicit scientific disclaimer
    disclaimer_found = any(
        "do not establish environmental improvement or degradation" in lim.lower()
        for lim in body["limitations"]
    )
    assert disclaimer_found is True


def test_23_compare_evidence_persists_metadata_and_timeline():
    token, _, _ = register_user("Comparison Persistence Agent")
    headers = {"Authorization": f"Bearer {token}"}
    inv_id = create_investigation(token)

    img1 = make_test_image(100, 100, color=(30, 40, 50))
    img2 = make_test_image(100, 100, color=(30, 40, 50), draw_box=(10, 10, 40, 40))

    r1 = client.post(
        f"/api/v1/investigations/{inv_id}/evidence",
        headers=headers,
        files={"file": ("p1.png", io.BytesIO(img1), "image/png")},
        data={"source_type": "observed"},
    )
    r2 = client.post(
        f"/api/v1/investigations/{inv_id}/evidence",
        headers=headers,
        files={"file": ("p2.png", io.BytesIO(img2), "image/png")},
        data={"source_type": "observed"},
    )
    before_id = r1.json()["id"]
    after_id = r2.json()["id"]

    res = client.post(
        f"/api/v1/investigations/{inv_id}/evidence/compare",
        headers=headers,
        json={"before_evidence_id": before_id, "after_evidence_id": after_id},
    )
    assert res.status_code == 200

    # Verify metadata in after_evidence
    ev_res = client.get(f"/api/v1/evidence/{after_id}", headers=headers)
    assert ev_res.status_code == 200
    meta = ev_res.json()["metadata"]
    assert "visual_comparison" in meta
    vc = meta["visual_comparison"]
    assert vc["compared_to_evidence_id"] == before_id
    assert "similarity" in vc
    assert "changed_pixel_percentage" in vc
    assert "alignment_status" in vc

    # Verify timeline event
    tl_res = client.get(f"/api/v1/investigations/{inv_id}/timeline", headers=headers)
    assert tl_res.status_code == 200
    events = tl_res.json()
    compare_events = [e for e in events if e["event_type"] == "evidence_compared"]
    assert len(compare_events) >= 1
    assert "Deterministic image comparison executed" in compare_events[0]["description"]


def test_24_get_difference_map_generates_valid_png():
    token, _, _ = register_user("Diff Map Agent")
    headers = {"Authorization": f"Bearer {token}"}
    inv_id = create_investigation(token)

    img1 = make_test_image(120, 120, color=(50, 70, 90))
    img2 = make_test_image(120, 120, color=(50, 70, 90), draw_box=(20, 20, 60, 60))

    r1 = client.post(
        f"/api/v1/investigations/{inv_id}/evidence",
        headers=headers,
        files={"file": ("before.png", io.BytesIO(img1), "image/png")},
        data={"source_type": "observed"},
    )
    r2 = client.post(
        f"/api/v1/investigations/{inv_id}/evidence",
        headers=headers,
        files={"file": ("after.png", io.BytesIO(img2), "image/png")},
        data={"source_type": "observed"},
    )
    before_id = r1.json()["id"]
    after_id = r2.json()["id"]

    res = client.get(
        f"/api/v1/investigations/{inv_id}/evidence/compare/difference-map?before_evidence_id={before_id}&after_evidence_id={after_id}",
        headers=headers,
    )
    assert res.status_code == 200
    assert res.headers["content-type"] == "image/png"
    assert res.content.startswith(b"\x89PNG")
    assert f"diff_{before_id}_{after_id}.png" in res.headers.get("content-disposition", "")


def test_25_get_difference_map_enforces_auth_and_ownership():
    token1, _, _ = register_user("Owner User")
    token2, _, _ = register_user("Unauthorized User")
    headers1 = {"Authorization": f"Bearer {token1}"}
    headers2 = {"Authorization": f"Bearer {token2}"}
    inv_id = create_investigation(token1)

    img1 = make_test_image(80, 80)
    img2 = make_test_image(80, 80)
    r1 = client.post(
        f"/api/v1/investigations/{inv_id}/evidence",
        headers=headers1,
        files={"file": ("b.png", io.BytesIO(img1), "image/png")},
        data={"source_type": "observed"},
    )
    r2 = client.post(
        f"/api/v1/investigations/{inv_id}/evidence",
        headers=headers1,
        files={"file": ("a.png", io.BytesIO(img2), "image/png")},
        data={"source_type": "observed"},
    )
    b_id = r1.json()["id"]
    a_id = r2.json()["id"]

    # 1. Unauthenticated request (no token) -> 401
    res_no_auth = client.get(
        f"/api/v1/investigations/{inv_id}/evidence/compare/difference-map?before_evidence_id={b_id}&after_evidence_id={a_id}"
    )
    assert res_no_auth.status_code == 401

    # 2. Unauthorized request (token from another user) -> 403
    res_unauth = client.get(
        f"/api/v1/investigations/{inv_id}/evidence/compare/difference-map?before_evidence_id={b_id}&after_evidence_id={a_id}",
        headers=headers2,
    )
    assert res_unauth.status_code == 403


def test_26_get_difference_map_rejects_same_id_or_non_image():
    token, _, _ = register_user("Validation Agent")
    headers = {"Authorization": f"Bearer {token}"}
    inv_id = create_investigation(token)

    img = make_test_image(80, 80)
    r_img = client.post(
        f"/api/v1/investigations/{inv_id}/evidence",
        headers=headers,
        files={"file": ("img.png", io.BytesIO(img), "image/png")},
        data={"source_type": "observed"},
    )
    r_doc = client.post(
        f"/api/v1/investigations/{inv_id}/evidence",
        headers=headers,
        files={"file": ("report.pdf", io.BytesIO(VALID_PDF_BYTES), "application/pdf")},
        data={"source_type": "observed"},
    )
    img_id = r_img.json()["id"]
    doc_id = r_doc.json()["id"]

    # Same id comparison rejected
    res_same = client.get(
        f"/api/v1/investigations/{inv_id}/evidence/compare/difference-map?before_evidence_id={img_id}&after_evidence_id={img_id}",
        headers=headers,
    )
    assert res_same.status_code == 400
    assert "itself" in res_same.json()["detail"].lower()

    # Document comparison rejected
    res_doc = client.get(
        f"/api/v1/investigations/{inv_id}/evidence/compare/difference-map?before_evidence_id={img_id}&after_evidence_id={doc_id}",
        headers=headers,
    )
    assert res_doc.status_code == 400
    assert "images" in res_doc.json()["detail"].lower()


def test_27_get_difference_map_not_found_for_missing_evidence():
    token, _, _ = register_user("NotFound Agent")
    headers = {"Authorization": f"Bearer {token}"}
    inv_id = create_investigation(token)

    img = make_test_image(80, 80)
    r1 = client.post(
        f"/api/v1/investigations/{inv_id}/evidence",
        headers=headers,
        files={"file": ("img.png", io.BytesIO(img), "image/png")},
        data={"source_type": "observed"},
    )
    img_id = r1.json()["id"]

    res_missing = client.get(
        f"/api/v1/investigations/{inv_id}/evidence/compare/difference-map?before_evidence_id={img_id}&after_evidence_id=999999",
        headers=headers,
    )
    assert res_missing.status_code == 404


def test_28_temporal_sequence_success():
    token, _, _ = register_user("Temporal Agent 1")
    headers = {"Authorization": f"Bearer {token}"}
    inv_id = create_investigation(token)

    img1 = make_test_image(100, 100, color=(40, 60, 80))
    img2 = make_test_image(100, 100, color=(40, 60, 80), draw_box=(15, 15, 45, 45))
    img3 = make_test_image(100, 100, color=(40, 60, 80), draw_box=(15, 15, 75, 75))

    r1 = client.post(
        f"/api/v1/investigations/{inv_id}/evidence",
        headers=headers,
        files={"file": ("img1.png", io.BytesIO(img1), "image/png")},
        data={"source_type": "observed", "captured_at": "2026-01-10T10:00:00Z"},
    )
    r2 = client.post(
        f"/api/v1/investigations/{inv_id}/evidence",
        headers=headers,
        files={"file": ("img2.png", io.BytesIO(img2), "image/png")},
        data={"source_type": "observed", "captured_at": "2026-02-10T10:00:00Z"},
    )
    r3 = client.post(
        f"/api/v1/investigations/{inv_id}/evidence",
        headers=headers,
        files={"file": ("img3.png", io.BytesIO(img3), "image/png")},
        data={"source_type": "observed", "captured_at": "2026-03-10T10:00:00Z"},
    )

    ids = [r1.json()["id"], r2.json()["id"], r3.json()["id"]]

    res = client.post(
        f"/api/v1/investigations/{inv_id}/evidence/temporal-sequence",
        headers=headers,
        json={"evidence_ids": ids},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ANALYZED"
    assert data["investigation_id"] == inv_id
    assert len(data["sequence"]) == 3
    assert data["sequence"][0]["role"] == "BASELINE"
    assert data["sequence"][1]["role"] == "INTERMEDIATE"
    assert data["sequence"][2]["role"] == "CURRENT"
    assert len(data["comparisons"]) == 2
    assert len(data["limitations"]) >= 1


def test_29_temporal_sequence_requires_minimum_images():
    token, _, _ = register_user("Temporal Min Agent")
    headers = {"Authorization": f"Bearer {token}"}
    inv_id = create_investigation(token)

    img1 = make_test_image(80, 80)
    img2 = make_test_image(80, 80)
    r1 = client.post(
        f"/api/v1/investigations/{inv_id}/evidence",
        headers=headers,
        files={"file": ("1.png", io.BytesIO(img1), "image/png")},
        data={"source_type": "observed"},
    )
    r2 = client.post(
        f"/api/v1/investigations/{inv_id}/evidence",
        headers=headers,
        files={"file": ("2.png", io.BytesIO(img2), "image/png")},
        data={"source_type": "observed"},
    )

    res = client.post(
        f"/api/v1/investigations/{inv_id}/evidence/temporal-sequence",
        headers=headers,
        json={"evidence_ids": [r1.json()["id"], r2.json()["id"]]},
    )
    assert res.status_code == 400
    assert "minimum of 3" in res.json()["detail"].lower()


def test_30_temporal_sequence_rejects_non_image():
    token, _, _ = register_user("Temporal NonImage Agent")
    headers = {"Authorization": f"Bearer {token}"}
    inv_id = create_investigation(token)

    img1 = make_test_image(80, 80)
    img2 = make_test_image(80, 80)
    r1 = client.post(
        f"/api/v1/investigations/{inv_id}/evidence",
        headers=headers,
        files={"file": ("1.png", io.BytesIO(img1), "image/png")},
        data={"source_type": "observed"},
    )
    r2 = client.post(
        f"/api/v1/investigations/{inv_id}/evidence",
        headers=headers,
        files={"file": ("2.png", io.BytesIO(img2), "image/png")},
        data={"source_type": "observed"},
    )
    r_pdf = client.post(
        f"/api/v1/investigations/{inv_id}/evidence",
        headers=headers,
        files={"file": ("report.pdf", io.BytesIO(VALID_PDF_BYTES), "application/pdf")},
        data={"source_type": "observed"},
    )

    ids = [r1.json()["id"], r2.json()["id"], r_pdf.json()["id"]]
    res = client.post(
        f"/api/v1/investigations/{inv_id}/evidence/temporal-sequence",
        headers=headers,
        json={"evidence_ids": ids},
    )
    assert res.status_code == 400
    assert "must be images" in res.json()["detail"].lower()


def test_31_temporal_sequence_rejects_cross_investigation():
    token, _, _ = register_user("Temporal Cross Agent")
    headers = {"Authorization": f"Bearer {token}"}
    inv1 = create_investigation(token, "Inv 1")
    inv2 = create_investigation(token, "Inv 2")

    img = make_test_image(80, 80)
    r1 = client.post(
        f"/api/v1/investigations/{inv1}/evidence",
        headers=headers,
        files={"file": ("1.png", io.BytesIO(img), "image/png")},
        data={"source_type": "observed"},
    )
    r2 = client.post(
        f"/api/v1/investigations/{inv1}/evidence",
        headers=headers,
        files={"file": ("2.png", io.BytesIO(img), "image/png")},
        data={"source_type": "observed"},
    )
    r3_inv2 = client.post(
        f"/api/v1/investigations/{inv2}/evidence",
        headers=headers,
        files={"file": ("3.png", io.BytesIO(img), "image/png")},
        data={"source_type": "observed"},
    )

    ids = [r1.json()["id"], r2.json()["id"], r3_inv2.json()["id"]]
    res = client.post(
        f"/api/v1/investigations/{inv1}/evidence/temporal-sequence",
        headers=headers,
        json={"evidence_ids": ids},
    )
    assert res.status_code == 404
    assert "not found in this investigation" in res.json()["detail"].lower()


def test_32_temporal_sequence_rejects_duplicate_ids():
    token, _, _ = register_user("Temporal Duplicate Agent")
    headers = {"Authorization": f"Bearer {token}"}
    inv_id = create_investigation(token)

    img = make_test_image(80, 80)
    r1 = client.post(
        f"/api/v1/investigations/{inv_id}/evidence",
        headers=headers,
        files={"file": ("1.png", io.BytesIO(img), "image/png")},
        data={"source_type": "observed"},
    )
    r2 = client.post(
        f"/api/v1/investigations/{inv_id}/evidence",
        headers=headers,
        files={"file": ("2.png", io.BytesIO(img), "image/png")},
        data={"source_type": "observed"},
    )

    ids = [r1.json()["id"], r2.json()["id"], r1.json()["id"]]
    res = client.post(
        f"/api/v1/investigations/{inv_id}/evidence/temporal-sequence",
        headers=headers,
        json={"evidence_ids": ids},
    )
    assert res.status_code == 400
    assert "duplicate" in res.json()["detail"].lower()


def test_33_temporal_sequence_enforces_ownership():
    token_owner, _, _ = register_user("Temporal Owner")
    token_other, _, _ = register_user("Temporal Other")
    headers_owner = {"Authorization": f"Bearer {token_owner}"}
    headers_other = {"Authorization": f"Bearer {token_other}"}
    inv_id = create_investigation(token_owner)

    img = make_test_image(80, 80)
    r1 = client.post(
        f"/api/v1/investigations/{inv_id}/evidence",
        headers=headers_owner,
        files={"file": ("1.png", io.BytesIO(img), "image/png")},
        data={"source_type": "observed"},
    )
    r2 = client.post(
        f"/api/v1/investigations/{inv_id}/evidence",
        headers=headers_owner,
        files={"file": ("2.png", io.BytesIO(img), "image/png")},
        data={"source_type": "observed"},
    )
    r3 = client.post(
        f"/api/v1/investigations/{inv_id}/evidence",
        headers=headers_owner,
        files={"file": ("3.png", io.BytesIO(img), "image/png")},
        data={"source_type": "observed"},
    )
    ids = [r1.json()["id"], r2.json()["id"], r3.json()["id"]]

    # Unauthenticated -> 401
    res_no_auth = client.post(
        f"/api/v1/investigations/{inv_id}/evidence/temporal-sequence",
        json={"evidence_ids": ids},
    )
    assert res_no_auth.status_code == 401

    # Unauthorized other user -> 403
    res_forbidden = client.post(
        f"/api/v1/investigations/{inv_id}/evidence/temporal-sequence",
        headers=headers_other,
        json={"evidence_ids": ids},
    )
    assert res_forbidden.status_code == 403


def test_34_temporal_sequence_orders_chronologically():
    token, _, _ = register_user("Temporal Chrono Agent")
    headers = {"Authorization": f"Bearer {token}"}
    inv_id = create_investigation(token)

    img = make_test_image(80, 80)
    r_jan = client.post(
        f"/api/v1/investigations/{inv_id}/evidence",
        headers=headers,
        files={"file": ("jan.png", io.BytesIO(img), "image/png")},
        data={"source_type": "observed", "captured_at": "2026-01-01T00:00:00Z"},
    )
    r_feb = client.post(
        f"/api/v1/investigations/{inv_id}/evidence",
        headers=headers,
        files={"file": ("feb.png", io.BytesIO(img), "image/png")},
        data={"source_type": "observed", "captured_at": "2026-02-01T00:00:00Z"},
    )
    r_mar = client.post(
        f"/api/v1/investigations/{inv_id}/evidence",
        headers=headers,
        files={"file": ("mar.png", io.BytesIO(img), "image/png")},
        data={"source_type": "observed", "captured_at": "2026-03-01T00:00:00Z"},
    )

    jan_id = r_jan.json()["id"]
    feb_id = r_feb.json()["id"]
    mar_id = r_mar.json()["id"]

    # Provide in scrambled order: March, January, February
    res = client.post(
        f"/api/v1/investigations/{inv_id}/evidence/temporal-sequence",
        headers=headers,
        json={"evidence_ids": [mar_id, jan_id, feb_id]},
    )
    assert res.status_code == 200
    seq = res.json()["sequence"]
    # Chronological sort places January first, February second, March third
    assert seq[0]["evidence_id"] == jan_id
    assert seq[0]["role"] == "BASELINE"
    assert seq[1]["evidence_id"] == feb_id
    assert seq[1]["role"] == "INTERMEDIATE"
    assert seq[2]["evidence_id"] == mar_id
    assert seq[2]["role"] == "CURRENT"


def test_35_temporal_sequence_computes_adjacent_comparisons():
    token, _, _ = register_user("Temporal Adjacent Agent")
    headers = {"Authorization": f"Bearer {token}"}
    inv_id = create_investigation(token)

    img1 = make_test_image(100, 100, color=(10, 20, 30))
    img2 = make_test_image(100, 100, color=(10, 20, 30), draw_box=(10, 10, 30, 30))
    img3 = make_test_image(100, 100, color=(10, 20, 30), draw_box=(10, 10, 60, 60))

    r1 = client.post(
        f"/api/v1/investigations/{inv_id}/evidence",
        headers=headers,
        files={"file": ("1.png", io.BytesIO(img1), "image/png")},
        data={"source_type": "observed", "captured_at": "2026-01-01T00:00:00Z"},
    )
    r2 = client.post(
        f"/api/v1/investigations/{inv_id}/evidence",
        headers=headers,
        files={"file": ("2.png", io.BytesIO(img2), "image/png")},
        data={"source_type": "observed", "captured_at": "2026-02-01T00:00:00Z"},
    )
    r3 = client.post(
        f"/api/v1/investigations/{inv_id}/evidence",
        headers=headers,
        files={"file": ("3.png", io.BytesIO(img3), "image/png")},
        data={"source_type": "observed", "captured_at": "2026-03-01T00:00:00Z"},
    )

    ids = [r1.json()["id"], r2.json()["id"], r3.json()["id"]]
    res = client.post(
        f"/api/v1/investigations/{inv_id}/evidence/temporal-sequence",
        headers=headers,
        json={"evidence_ids": ids},
    )
    assert res.status_code == 200
    comparisons = res.json()["comparisons"]
    assert len(comparisons) == 2

    # First comparison: 1 -> 2
    assert comparisons[0]["before_evidence_id"] == ids[0]
    assert comparisons[0]["after_evidence_id"] == ids[1]
    assert 0.0 <= comparisons[0]["similarity"] <= 1.0
    assert 0.0 <= comparisons[0]["changed_pixel_percentage"] <= 100.0

    # Second comparison: 2 -> 3
    assert comparisons[1]["before_evidence_id"] == ids[1]
    assert comparisons[1]["after_evidence_id"] == ids[2]
    assert 0.0 <= comparisons[1]["similarity"] <= 1.0
    assert 0.0 <= comparisons[1]["changed_pixel_percentage"] <= 100.0


def test_36_temporal_sequence_persists_metadata():
    token, _, _ = register_user("Temporal Meta Agent")
    headers = {"Authorization": f"Bearer {token}"}
    inv_id = create_investigation(token)

    img = make_test_image(80, 80)
    r1 = client.post(
        f"/api/v1/investigations/{inv_id}/evidence",
        headers=headers,
        files={"file": ("1.png", io.BytesIO(img), "image/png")},
        data={"source_type": "observed", "captured_at": "2026-01-01T00:00:00Z"},
    )
    r2 = client.post(
        f"/api/v1/investigations/{inv_id}/evidence",
        headers=headers,
        files={"file": ("2.png", io.BytesIO(img), "image/png")},
        data={"source_type": "observed", "captured_at": "2026-02-01T00:00:00Z"},
    )
    r3 = client.post(
        f"/api/v1/investigations/{inv_id}/evidence",
        headers=headers,
        files={"file": ("3.png", io.BytesIO(img), "image/png")},
        data={"source_type": "observed", "captured_at": "2026-03-01T00:00:00Z"},
    )
    ids = [r1.json()["id"], r2.json()["id"], r3.json()["id"]]

    res = client.post(
        f"/api/v1/investigations/{inv_id}/evidence/temporal-sequence",
        headers=headers,
        json={"evidence_ids": ids},
    )
    assert res.status_code == 200
    seq_id = res.json()["sequence_id"]

    # Verify metadata persisted on evidence artifacts
    for idx, eid in enumerate(ids):
        ev_res = client.get(f"/api/v1/evidence/{eid}", headers=headers)
        assert ev_res.status_code == 200
        meta = ev_res.json()["metadata"]
        assert "temporal_analysis" in meta
        t_meta = meta["temporal_analysis"]
        assert t_meta["sequence_id"] == seq_id
        assert t_meta["sequence_index"] == idx
        assert t_meta["total_in_sequence"] == 3


def test_37_temporal_sequence_creates_timeline_entry():
    token, _, _ = register_user("Temporal Timeline Agent")
    headers = {"Authorization": f"Bearer {token}"}
    inv_id = create_investigation(token)

    img = make_test_image(80, 80)
    r1 = client.post(
        f"/api/v1/investigations/{inv_id}/evidence",
        headers=headers,
        files={"file": ("1.png", io.BytesIO(img), "image/png")},
        data={"source_type": "observed"},
    )
    r2 = client.post(
        f"/api/v1/investigations/{inv_id}/evidence",
        headers=headers,
        files={"file": ("2.png", io.BytesIO(img), "image/png")},
        data={"source_type": "observed"},
    )
    r3 = client.post(
        f"/api/v1/investigations/{inv_id}/evidence",
        headers=headers,
        files={"file": ("3.png", io.BytesIO(img), "image/png")},
        data={"source_type": "observed"},
    )
    ids = [r1.json()["id"], r2.json()["id"], r3.json()["id"]]

    res = client.post(
        f"/api/v1/investigations/{inv_id}/evidence/temporal-sequence",
        headers=headers,
        json={"evidence_ids": ids},
    )
    assert res.status_code == 200

    # Verify timeline entry
    tl_res = client.get(f"/api/v1/investigations/{inv_id}/timeline", headers=headers)
    assert tl_res.status_code == 200
    events = tl_res.json()
    temporal_events = [e for e in events if e["event_type"] == "temporal_sequence_analyzed"]
    assert len(temporal_events) >= 1
    assert "Multi-Temporal Visual Sequence" in temporal_events[0]["title"]
    assert "Baseline #" in temporal_events[0]["description"]


def test_38_temporal_sequence_preserves_evidence_first_guardrails():
    token, _, _ = register_user("Temporal Guardrails Agent")
    headers = {"Authorization": f"Bearer {token}"}
    inv_id = create_investigation(token)

    img1 = make_test_image(80, 80, color=(30, 30, 30))
    img2 = make_test_image(80, 80, color=(120, 120, 120))
    img3 = make_test_image(80, 80, color=(220, 220, 220))

    r1 = client.post(
        f"/api/v1/investigations/{inv_id}/evidence",
        headers=headers,
        files={"file": ("1.png", io.BytesIO(img1), "image/png")},
        data={"source_type": "observed"},
    )
    r2 = client.post(
        f"/api/v1/investigations/{inv_id}/evidence",
        headers=headers,
        files={"file": ("2.png", io.BytesIO(img2), "image/png")},
        data={"source_type": "observed"},
    )
    r3 = client.post(
        f"/api/v1/investigations/{inv_id}/evidence",
        headers=headers,
        files={"file": ("3.png", io.BytesIO(img3), "image/png")},
        data={"source_type": "observed"},
    )

    ids = [r1.json()["id"], r2.json()["id"], r3.json()["id"]]
    res = client.post(
        f"/api/v1/investigations/{inv_id}/evidence/temporal-sequence",
        headers=headers,
        json={"evidence_ids": ids},
    )
    assert res.status_code == 200
    body = res.json()

    # Guardrails: no autonomous conclusions
    forbidden_terms = [
        "pollution decreased",
        "pollution increased",
        "condition improved",
        "condition worsened",
        "environmental recovery confirmed",
        "environmental disaster confirmed",
    ]
    response_text = str(body).lower()
    for term in forbidden_terms:
        assert term not in response_text

    # Mandatory limitations disclaimer present
    disclaimer_found = any(
        "do not establish environmental improvement or degradation" in lim.lower()
        for lim in body["limitations"]
    )
    assert disclaimer_found is True



