import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.services.job_match_service import JobMatchError, _skills_in_text, match_resume
from app.services.resume_service import ResumeNotFoundError

from tests.fixtures import resume_pdf_bytes


@pytest.fixture()
def client():
    with TestClient(create_app()) as c:
        yield c


@pytest.fixture()
def analyzed_resume(client, auth):
    """Upload + analyze a real resume for a fresh owner; return {id, headers}."""
    user = auth()
    data = client.post(
        "/api/resumes",
        files={"file": ("jane_doe.pdf", resume_pdf_bytes(), "application/pdf")},
        headers=user["headers"],
    ).json()
    resp = client.post(f"/api/resumes/{data['id']}/analyze", headers=user["headers"])
    assert resp.status_code == 200, resp.text
    return {"id": data["id"], "headers": user["headers"]}


def test_match_normalizes_llm_skill_names(client, analyzed_resume):
    """An LLM's 'PostgreSQL' should count toward the corpus's canonical 'SQL'."""
    # Patch the stored analysis so detected skills use free-form names.
    from app.database.session import SessionLocal
    from app.models.resume import Resume

    db = SessionLocal()
    resume = db.get(Resume, analyzed_resume["id"])
    cv = resume.current_version
    # Assign a NEW dict — in-place mutation isn't tracked by SQLAlchemy's JSON column.
    cv.analysis = {
        **cv.analysis,
        "detected_skills": [
            {"name": "PostgreSQL", "level": 90},
            {"name": "Kafka", "level": 80},
        ],
    }
    db.commit()
    db.close()

    resp = client.post(
        "/api/match",
        json={"resume_id": analyzed_resume["id"], "limit": 30},
        headers=analyzed_resume["headers"],
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    # Raw names are shown to the user…
    assert "PostgreSQL" in body["detected_skills"]
    # …but PostgreSQL counts toward the corpus's canonical "SQL": every job
    # requiring SQL now lists it as matched instead of missing.
    notion = next(r for r in body["results"] if r["company"] == "Notion")
    assert "SQL" in notion["matched_skills"]
    assert "PostgreSQL" not in notion["matched_skills"]
    assert "PostgreSQL" not in notion["missing_skills"]


def test_skills_in_text_detects_catalog_names():
    found = _skills_in_text("We need a React + TypeScript engineer who knows Kubernetes and Postgres.")
    assert "React" in found
    assert "TypeScript" in found
    assert "Kubernetes" in found
    assert "SQL" in found  # "Postgres" is an alias of SQL


def test_match_requires_analyzed_resume(client, auth):
    headers = auth()["headers"]
    data = client.post(
        "/api/resumes",
        files={"file": ("jane_doe.pdf", resume_pdf_bytes(), "application/pdf")},
        headers=headers,
    ).json()
    resp = client.post("/api/match", json={"resume_id": data["id"]}, headers=headers)
    assert resp.status_code == 422
    assert "Analyze this resume first" in resp.json()["detail"]


def test_match_unknown_resume_404(client, auth):
    resp = client.post(
        "/api/match", json={"resume_id": "does-not-exist"}, headers=auth()["headers"]
    )
    assert resp.status_code == 404


def test_match_returns_ranked_results(client, analyzed_resume):
    resp = client.post(
        "/api/match",
        json={"resume_id": analyzed_resume["id"], "limit": 5},
        headers=analyzed_resume["headers"],
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["resume_id"] == analyzed_resume["id"]
    assert body["method"] == "tfidf"  # tests force the no-key path
    assert body["detected_skills"]  # Jane Doe's skills
    assert body["results"]
    assert len(body["results"]) <= 5
    # Sorted best-first.
    scores = [r["match_score"] for r in body["results"]]
    assert scores == sorted(scores, reverse=True)
    for result in body["results"]:
        assert 0 <= result["match_score"] <= 100
        assert result["source"] == "corpus"
        assert result["matched_skills"] or result["missing_skills"]
        assert result["salary_min"] is not None or result["salary_max"] is not None


def test_match_supports_pasted_job_description(client, analyzed_resume):
    jd = (
        "We are hiring a Senior Frontend Engineer. You will build React and "
        "TypeScript interfaces with Tailwind CSS, review a11y, and ship fast. "
        "Experience with GraphQL and design systems is a plus."
    )
    resp = client.post(
        "/api/match",
        json={"resume_id": analyzed_resume["id"], "job_description": jd, "limit": 3},
        headers=analyzed_resume["headers"],
    )
    assert resp.status_code == 200, resp.text
    results = resp.json()["results"]
    # The pasted JD is scored first (highest priority) when it fits.
    paste = next(r for r in results if r["source"] == "paste")
    assert "React" in paste["matched_skills"]  # Jane's resume has React
    assert paste["title"] == "Your pasted job description"
    assert paste["salary_min"] is None  # no advertised salary


def test_match_remote_filter(client, analyzed_resume):
    resp = client.post(
        "/api/match",
        json={"resume_id": analyzed_resume["id"], "remote_only": True, "limit": 30},
        headers=analyzed_resume["headers"],
    )
    assert resp.status_code == 200
    assert all(r["remote"] for r in resp.json()["results"])


def test_jobs_browse_endpoint(client, auth):
    resp = client.get("/api/jobs", headers=auth()["headers"])
    assert resp.status_code == 200
    jobs = resp.json()
    assert len(jobs) >= 15
    assert all({"job_id", "title", "company", "category", "skills_count"} <= set(j) for j in jobs)


def test_match_endpoints_require_auth(client):
    assert client.post("/api/match", json={"resume_id": "x"}).status_code == 401
    assert client.get("/api/jobs").status_code == 401


def test_match_cannot_use_another_users_resume(client, auth, analyzed_resume):
    """A different user matching against this resume id gets 404, not its skills."""
    other = auth()
    resp = client.post(
        "/api/match", json={"resume_id": analyzed_resume["id"]}, headers=other["headers"]
    )
    assert resp.status_code == 404


def test_service_unknown_resume_raises_not_found(auth):
    """The service guard runs before any matching logic."""
    import asyncio
    from app.database.session import SessionLocal

    db = SessionLocal()
    try:
        with pytest.raises(ResumeNotFoundError):
            asyncio.run(match_resume(db, "missing", user_id=auth()["user_id"]))
    finally:
        db.close()
