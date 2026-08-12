import pytest
from fastapi.testclient import TestClient

from app.main import create_app

from tests.fixtures import resume_pdf_bytes


@pytest.fixture()
def client():
    # Enter the context manager so the lifespan hook creates tables.
    with TestClient(create_app()) as c:
        yield c


def _upload(client: TestClient, headers: dict) -> dict:
    resp = client.post(
        "/api/resumes",
        files={"file": ("jane_doe.pdf", resume_pdf_bytes(), "application/pdf")},
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def test_health(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_upload_accepts_pdf_and_analyzes_end_to_end(client, auth):
    headers = auth()["headers"]
    data = _upload(client, headers)
    assert data["file_name"] == "jane_doe.pdf"
    assert data["id"]

    # Analyze — falls back to the deterministic analyzer in tests.
    resp = client.post(f"/api/resumes/{data['id']}/analyze", headers=headers)
    assert resp.status_code == 200, resp.text
    analysis = resp.json()
    assert analysis["ats_score"] >= 25
    assert len(analysis["detected_skills"]) >= 3
    assert analysis["candidate"]["email"] == "jane.doe@gmail.com"
    # Full frontend contract is present.
    for key in (
        "id", "file_name", "uploaded_at", "ats_score", "candidate", "summary",
        "score_breakdown", "detected_skills", "missing_skills", "suggestions",
        "recommended_roles", "keyword_trend", "skills_radar",
    ):
        assert key in analysis


def test_rejects_non_pdf(client, auth):
    resp = client.post(
        "/api/resumes",
        files={"file": ("notes.txt", b"not a pdf", "text/plain")},
        headers=auth()["headers"],
    )
    assert resp.status_code == 400


def test_list_and_detail_after_analysis(client, auth):
    headers = auth()["headers"]
    data = _upload(client, headers)
    client.post(f"/api/resumes/{data['id']}/analyze", headers=headers)

    listing = client.get("/api/resumes", headers=headers).json()
    assert any(item["id"] == data["id"] for item in listing)
    item = next(i for i in listing if i["id"] == data["id"])
    assert item["status"] == "analyzed"
    assert item["ats_score"] is not None

    detail = client.get(f"/api/resumes/{data['id']}", headers=headers).json()
    assert detail["analysis"] is not None
    assert detail["analysis"]["ats_score"] == item["ats_score"]


def test_analyze_missing_resume_returns_404(client, auth):
    resp = client.post("/api/resumes/nope/analyze", headers=auth()["headers"])
    assert resp.status_code == 404


# --- JD-specific analysis (Phase B) -----------------------------------------


def _analyze_jd(client, headers, resume_id, *, body):
    resp = client.post(f"/api/resumes/{resume_id}/analyze", headers=headers, json=body)
    assert resp.status_code == 200, resp.text
    return resp.json()


def test_analyze_with_job_description_returns_jd_mode(client, auth):
    headers = auth()["headers"]
    resume_id = _upload(client, headers)["id"]
    analysis = _analyze_jd(
        client,
        headers,
        resume_id,
        body={
            "job_description": (
                "Senior Full-Stack Engineer. We need React, TypeScript and "
                "Node.js on the frontend and Python/PostgreSQL on the backend, "
                "containerized with Docker on AWS."
            ),
            "target_role": "Full Stack Engineer",
        },
    )
    assert analysis["analysis_mode"] == "jd"
    assert analysis["target_role"] == "Full Stack Engineer"
    assert analysis["ats_score"] >= 25
    labels = [b["label"] for b in analysis["score_breakdown"]]
    assert "Job Match" in labels
    # The JD's required skills are the fit basis; the sample resume has most of
    # them, so the job-match score should be well above zero.
    job_match = next(b["score"] for b in analysis["score_breakdown"] if b["label"] == "Job Match")
    assert job_match > 40


def test_analyze_with_target_role_only_is_jd_mode(client, auth):
    headers = auth()["headers"]
    resume_id = _upload(client, headers)["id"]
    analysis = _analyze_jd(client, headers, resume_id, body={"target_role": "Data Engineer"})
    assert analysis["analysis_mode"] == "jd"
    assert analysis["target_role"] == "Data Engineer"
    assert "Job Match" in [b["label"] for b in analysis["score_breakdown"]]


def test_jd_analysis_is_transient_keeps_general_baseline(client, auth):
    headers = auth()["headers"]
    resume_id = _upload(client, headers)["id"]

    plain = client.post(f"/api/resumes/{resume_id}/analyze", headers=headers).json()
    assert plain["analysis_mode"] == "general"

    jd = _analyze_jd(
        client, headers, resume_id, body={"job_description": "A role needing Vue, Angular and Rust."}
    )
    assert jd["analysis_mode"] == "jd"
    assert jd["ats_score"] <= plain["ats_score"]  # resume lacks the JD's skills

    # Stored analysis is untouched: a plain re-analysis still returns "general".
    again = client.post(f"/api/resumes/{resume_id}/analyze", headers=headers).json()
    assert again["analysis_mode"] == "general"
    assert again["ats_score"] == plain["ats_score"]


def test_jd_fit_penalizes_missing_skills(client, auth):
    headers = auth()["headers"]
    resume_id = _upload(client, headers)["id"]

    good = _analyze_jd(
        client,
        headers,
        resume_id,
        body={"job_description": "Requires React, TypeScript, Node.js and GraphQL.", "target_role": "Frontend Engineer"},
    )
    bad = _analyze_jd(
        client,
        headers,
        resume_id,
        body={"job_description": "Requires Vue, Angular, Rust and Terraform.", "target_role": "Frontend Engineer"},
    )
    good_fit = next(b["score"] for b in good["score_breakdown"] if b["label"] == "Job Match")
    bad_fit = next(b["score"] for b in bad["score_breakdown"] if b["label"] == "Job Match")
    assert good_fit > bad_fit


def test_delete_removes_resume(client, auth):
    headers = auth()["headers"]
    data = _upload(client, headers)
    resp = client.delete(f"/api/resumes/{data['id']}", headers=headers)
    assert resp.status_code == 204
    assert client.get(f"/api/resumes/{data['id']}", headers=headers).status_code == 404


def test_resume_endpoints_require_auth(client):
    assert client.get("/api/resumes").status_code == 401
    assert client.get("/api/resumes/some-id").status_code == 401
    assert client.post("/api/resumes/some-id/analyze").status_code == 401
    assert client.delete("/api/resumes/some-id").status_code == 401
    assert client.post(
        "/api/resumes",
        files={"file": ("jane_doe.pdf", resume_pdf_bytes(), "application/pdf")},
    ).status_code == 401


def test_resumes_are_isolated_to_their_owner(client, auth):
    owner = auth()
    other = auth()
    data = _upload(client, owner["headers"])

    # The other user gets 404 — indistinguishable from the resume not existing,
    # so an owner's data can't be probed or enumerated.
    assert client.get(f"/api/resumes/{data['id']}", headers=other["headers"]).status_code == 404
    assert client.post(
        f"/api/resumes/{data['id']}/analyze", headers=other["headers"]
    ).status_code == 404
    assert client.delete(f"/api/resumes/{data['id']}", headers=other["headers"]).status_code == 404

    # Listing only surfaces the caller's own resumes.
    listing = client.get("/api/resumes", headers=other["headers"]).json()
    assert all(item["id"] != data["id"] for item in listing)

    # The owner still has full access.
    assert client.get(f"/api/resumes/{data['id']}", headers=owner["headers"]).status_code == 200
