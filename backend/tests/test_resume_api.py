import pytest
from fastapi.testclient import TestClient

from app.main import create_app

from tests.fixtures import resume_pdf_bytes


@pytest.fixture()
def client():
    # Enter the context manager so the lifespan hook creates tables.
    with TestClient(create_app()) as c:
        yield c


def _upload(client: TestClient) -> dict:
    resp = client.post(
        "/api/resumes",
        files={"file": ("jane_doe.pdf", resume_pdf_bytes(), "application/pdf")},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def test_health(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_upload_accepts_pdf_and_analyzes_end_to_end(client):
    data = _upload(client)
    assert data["file_name"] == "jane_doe.pdf"
    assert data["id"]

    # Analyze — falls back to the deterministic analyzer in tests.
    resp = client.post(f"/api/resumes/{data['id']}/analyze")
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


def test_rejects_non_pdf(client):
    resp = client.post(
        "/api/resumes",
        files={"file": ("notes.txt", b"not a pdf", "text/plain")},
    )
    assert resp.status_code == 400


def test_list_and_detail_after_analysis(client):
    data = _upload(client)
    client.post(f"/api/resumes/{data['id']}/analyze")

    listing = client.get("/api/resumes").json()
    assert any(item["id"] == data["id"] for item in listing)
    item = next(i for i in listing if i["id"] == data["id"])
    assert item["status"] == "analyzed"
    assert item["ats_score"] is not None

    detail = client.get(f"/api/resumes/{data['id']}").json()
    assert detail["analysis"] is not None
    assert detail["analysis"]["ats_score"] == item["ats_score"]


def test_analyze_missing_resume_returns_404(client):
    resp = client.post("/api/resumes/nope/analyze")
    assert resp.status_code == 404


def test_delete_removes_resume(client):
    data = _upload(client)
    resp = client.delete(f"/api/resumes/{data['id']}")
    assert resp.status_code == 204
    assert client.get(f"/api/resumes/{data['id']}").status_code == 404
