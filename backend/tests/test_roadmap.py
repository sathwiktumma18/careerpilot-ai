"""Career Roadmap — endpoint, gap detection, and deterministic fallback tests.

conftest forces the no-key path, so generation always uses the template.
"""
import asyncio

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.services.roadmap_service import _detect_category, _gap_skills, _resolve_role, generate_roadmap

from tests.fixtures import resume_pdf_bytes


@pytest.fixture()
def client():
    with TestClient(create_app()) as c:
        yield c


@pytest.fixture()
def analyzed_resume(client, auth):
    """Upload + analyze a real resume for a fresh owner; return {id, headers, user_id}."""
    user = auth()
    data = client.post(
        "/api/resumes",
        files={"file": ("jane_doe.pdf", resume_pdf_bytes(), "application/pdf")},
        headers=user["headers"],
    ).json()
    resp = client.post(f"/api/resumes/{data['id']}/analyze", headers=user["headers"])
    assert resp.status_code == 200, resp.text
    return {"id": data["id"], "headers": user["headers"], "user_id": user["user_id"]}


def _run(coro):
    return asyncio.run(coro)


def _milestones(plan):
    return [m for phase in plan.phases for m in phase.milestones]


def test_roadmap_endpoint_generic(client, auth):
    resp = client.post(
        "/api/roadmap",
        json={"target_role": "Frontend Engineer", "horizon": 8},
        headers=auth()["headers"],
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["generated_by"] == "template"
    assert body["target_role"] == "Frontend Engineer"
    assert body["horizon"] == 8
    assert body["summary"]
    assert body["target_skills"]
    assert body["phases"]
    # Exactly one milestone per week, numbered 1..horizon.
    weeks = sorted(m["week"] for p in body["phases"] for m in p["milestones"])
    assert weeks == list(range(1, 9))
    for p in body["phases"]:
        assert p["week_start"] <= p["week_end"]
        assert all(p["week_start"] <= m["week"] <= p["week_end"] for m in p["milestones"])


def test_roadmap_with_analyzed_resume(client, analyzed_resume):
    resp = client.post(
        "/api/roadmap",
        json={
            "resume_id": analyzed_resume["id"],
            "target_role": "Full Stack Engineer",
            "horizon": 12,
        },
        headers=analyzed_resume["headers"],
    )
    assert resp.status_code == 200, resp.text
    assert len(_milestones_from_body(resp.json())) == 12


def _milestones_from_body(body):
    return [m for p in body["phases"] for m in p["milestones"]]


def test_roadmap_detects_role_gaps(client, analyzed_resume):
    """A frontend resume heading to DevOps must target devops skills."""
    resp = client.post(
        "/api/roadmap",
        json={
            "resume_id": analyzed_resume["id"],
            "target_role": "DevOps Engineer",
            "horizon": 12,
        },
        headers=analyzed_resume["headers"],
    )
    assert resp.status_code == 200, resp.text
    target = resp.json()["target_skills"]
    assert "Kubernetes" in target
    # Everything proposed belongs to the devops track (nothing already known).
    devops_track = {"Linux", "Docker", "Kubernetes", "CI/CD", "Terraform", "Observability"}
    assert set(target) <= devops_track


def test_roadmap_other_users_resume_does_not_leak(client, auth, analyzed_resume):
    """Another user's resume id behaves like 'no resume' — no skill leak, no 404."""
    other = auth()
    resp = client.post(
        "/api/roadmap",
        json={"resume_id": analyzed_resume["id"], "target_role": "DevOps Engineer"},
        headers=other["headers"],
    )
    assert resp.status_code == 200
    body = resp.json()
    # The generic (no-resume) devops plan, not Jane's skills.
    assert "Kubernetes" in body["target_skills"]


def test_roadmap_validates_horizon(client, auth):
    headers = auth()["headers"]
    assert client.post("/api/roadmap", json={"horizon": 3}, headers=headers).status_code == 422
    assert client.post("/api/roadmap", json={"horizon": 25}, headers=headers).status_code == 422


def test_roadmap_endpoint_requires_auth(client):
    assert client.post("/api/roadmap", json={"horizon": 6}).status_code == 401


def test_roadmap_unknown_resume_ok(client, analyzed_resume):
    resp = client.post(
        "/api/roadmap",
        json={"resume_id": "does-not-exist", "horizon": 6},
        headers=analyzed_resume["headers"],
    )
    assert resp.status_code == 200
    assert resp.json()["generated_by"] == "template"


def test_roadmap_fallback_is_deterministic(analyzed_resume):
    from app.database.session import SessionLocal

    db = SessionLocal()
    try:
        a = _run(generate_roadmap(
            db,
            resume_id=analyzed_resume["id"],
            user_id=analyzed_resume["user_id"],
            target_role="Backend Engineer",
            horizon=12,
        ))
        b = _run(generate_roadmap(
            db,
            resume_id=analyzed_resume["id"],
            user_id=analyzed_resume["user_id"],
            target_role="Backend Engineer",
            horizon=12,
        ))
    finally:
        db.close()
    titles_a = [m.title for m in _milestones(a)]
    titles_b = [m.title for m in _milestones(b)]
    assert titles_a == titles_b


def test_roadmap_gap_skills_skip_known():
    """Skills the resume already has are not re-proposed."""
    gaps = _gap_skills("Backend Engineer", ["Python", "SQL"])
    assert "Docker" in gaps
    assert "SQL" not in gaps
    assert "PostgreSQL" not in gaps  # canonicalized to SQL


def test_roadmap_detect_category():
    assert _detect_category("Senior Full Stack Engineer") == "full stack"
    assert _detect_category("Backend Engineer") == "backend"
    assert _detect_category("Platform Engineer") == "platform"
    assert _detect_category("ML Engineer") == "ml"
    assert _detect_category("Unrelated Role") is None


# --------------------------------------------------------------------------- #
# Phase E — typo tolerance
# --------------------------------------------------------------------------- #

def test_resolve_role_corrects_misspellings():
    """A typo'd role maps onto the closest canonical track."""
    assert _resolve_role("Frntend Engineer") == ("Frontend Engineer", "frontend")
    assert _resolve_role("Bckend Devloper")[1] == "backend"
    assert _resolve_role("Full Stak Developer")[1] == "full stack"
    # A typo that keeps the track keyword still routes to the right track.
    assert _detect_category("Data Scienstist") == "data"
    assert _detect_category("Devops Enginner") == "devops"


def test_resolve_role_keeps_known_tracks_untouched():
    """Already-recognizable roles need no correction (no canonical phrase back)."""
    assert _resolve_role("Frontend Engineer") == (None, None)
    assert _resolve_role("Senior Full Stack Engineer") == (None, None)
    assert _resolve_role("ML Engineer") == (None, None)


def test_resolve_role_rejects_gibberish():
    assert _resolve_role("xyzzy plugh") == (None, None)
    assert _resolve_role("") == (None, None)


def test_typo_roadmap_uses_corrected_track(client, auth):
    """A misspelled role still plans for the right skills and reports the fix."""
    resp = client.post(
        "/api/roadmap",
        json={"target_role": "Frntend Engineer", "horizon": 8},
        headers=auth()["headers"],
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["target_role"] == "Frontend Engineer"
    assert body["typed_role"] == "Frntend Engineer"
    assert "React" in body["target_skills"]


def test_correct_role_has_no_typed_note(client, auth):
    resp = client.post(
        "/api/roadmap",
        json={"target_role": "Backend Engineer", "horizon": 8},
        headers=auth()["headers"],
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["typed_role"] is None
