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
def analyzed_resume(client):
    """Upload + analyze a real resume (deterministic fallback) and return its id."""
    data = client.post(
        "/api/resumes",
        files={"file": ("jane_doe.pdf", resume_pdf_bytes(), "application/pdf")},
    ).json()
    resp = client.post(f"/api/resumes/{data['id']}/analyze")
    assert resp.status_code == 200, resp.text
    return data["id"]


def test_match_normalizes_llm_skill_names(client, analyzed_resume):
    """An LLM's 'PostgreSQL' should count toward the corpus's canonical 'SQL'."""
    # Patch the stored analysis so detected skills use free-form names.
    from app.database.session import SessionLocal
    from app.models.resume import Resume

    db = SessionLocal()
    resume = db.get(Resume, analyzed_resume)
    # Assign a NEW dict — in-place mutation isn't tracked by SQLAlchemy's JSON column.
    resume.analysis = {
        **resume.analysis,
        "detected_skills": [
            {"name": "PostgreSQL", "level": 90},
            {"name": "Kafka", "level": 80},
        ],
    }
    db.commit()
    db.close()

    resp = client.post("/api/match", json={"resume_id": analyzed_resume, "limit": 30})
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


def test_match_requires_analyzed_resume(client):
    data = client.post(
        "/api/resumes",
        files={"file": ("jane_doe.pdf", resume_pdf_bytes(), "application/pdf")},
    ).json()
    resp = client.post("/api/match", json={"resume_id": data["id"]})
    assert resp.status_code == 422
    assert "Analyze this resume first" in resp.json()["detail"]


def test_match_unknown_resume_404(client):
    resp = client.post("/api/match", json={"resume_id": "does-not-exist"})
    assert resp.status_code == 404


def test_match_returns_ranked_results(client, analyzed_resume):
    resp = client.post(
        "/api/match",
        json={"resume_id": analyzed_resume, "limit": 5},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["resume_id"] == analyzed_resume
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
        json={"resume_id": analyzed_resume, "job_description": jd, "limit": 3},
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
        json={"resume_id": analyzed_resume, "remote_only": True, "limit": 30},
    )
    assert resp.status_code == 200
    assert all(r["remote"] for r in resp.json()["results"])


def test_jobs_browse_endpoint(client):
    resp = client.get("/api/jobs")
    assert resp.status_code == 200
    jobs = resp.json()
    assert len(jobs) >= 15
    assert all({"job_id", "title", "company", "category", "skills_count"} <= set(j) for j in jobs)


def test_service_unknown_resume_raises_not_found(client, analyzed_resume):
    """The service guard runs before any matching logic."""
    with pytest.raises(ResumeNotFoundError):
        import asyncio
        from app.database.session import SessionLocal

        db = SessionLocal()
        try:
            from app.services.job_match_service import match_resume

            asyncio.run(match_resume(db, "missing"))
        finally:
            db.close()
