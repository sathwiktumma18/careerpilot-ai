"""PortfolioAI: slug derivation, /portfolio/me, and the public page.

The public page is intentionally unauthenticated — these tests confirm it
works with no token, carries real stored data, and 404s on unknown slugs.
Analysis comes from the deterministic fallback (conftest blocks live LLMs).
"""

import uuid

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.models.user import User
from app.services.portfolio_service import slugify

from tests.fixtures import resume_pdf_bytes


@pytest.fixture()
def client():
    with TestClient(create_app()) as c:
        yield c


def _register(client: TestClient, name="Jane Doe", email=None, password="hunter2-secure") -> dict:
    if email is None:
        email = f"jane-{uuid.uuid4().hex[:10]}@example.com"
    resp = client.post(
        "/api/auth/register",
        json={"name": name, "email": email, "password": password},
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    return {
        "user_id": body["user"]["id"],
        "email": email,
        "token": body["access_token"],
        "headers": {"Authorization": f"Bearer {body['access_token']}"},
    }


def _analyzed_resume(client: TestClient, headers: dict) -> str:
    up = client.post(
        "/api/resumes",
        files={"file": ("jane_doe.pdf", resume_pdf_bytes(), "application/pdf")},
        headers=headers,
    )
    assert up.status_code == 201, up.text
    resp = client.post(f"/api/resumes/{up.json()['id']}/analyze", headers=headers)
    assert resp.status_code == 200, resp.text
    return up.json()["id"]


def test_slug_uses_email_local_part():
    user = User(email="Sathwik.Reddy@Gmail.com", name="Sathwik Reddy", password_hash="x")
    assert slugify(user) == "sathwik-reddy"


def test_slug_falls_back_to_name():
    user = User(email="a1@x.com", name="Dr. Jane Doe", password_hash="x")
    assert slugify(user) == "a1"  # local-part wins when it's a real slug
    user2 = User(email="", name="Dr. Jane Doe", password_hash="x")
    assert slugify(user2) == "dr-jane-doe"


def test_me_returns_slug_and_path(client):
    acc = _register(client, email="me.user@example.com")
    resp = client.get("/api/portfolio/me", headers=acc["headers"])
    assert resp.status_code == 200
    body = resp.json()
    assert body["slug"] == "me-user"
    assert body["path"] == "/p/me-user"


def test_me_requires_auth(client):
    assert client.get("/api/portfolio/me").status_code == 401


def test_public_portfolio_no_token_and_real_data(client):
    acc = _register(client, name="Jane Doe", email="jane.doe@example.com")
    _analyzed_resume(client, acc["headers"])

    resp = client.get("/api/public/portfolio/jane-doe")  # deliberately NO auth header
    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == "Jane Doe"
    assert body["email"] == "jane.doe@example.com"
    assert body["slug"] == "jane-doe"
    assert body["ats_score"] is not None
    assert body["resume_file_name"] == "jane_doe.pdf"
    assert len(body["ats_history"]) >= 1
    assert body["ats_history"][0]["version_no"] == 1
    assert isinstance(body["skills"], list)
    assert isinstance(body["score_breakdown"], list)
    assert isinstance(body["recommended_roles"], list)


def test_public_portfolio_unknown_slug_404(client):
    assert client.get("/api/public/portfolio/no-such-user").status_code == 404


def test_slug_collision_gets_numeric_suffix(client):
    a = _register(client, email="shared@example.com")
    b = _register(client, email="shared@other.com")
    ma = client.get("/api/portfolio/me", headers=a["headers"]).json()
    mb = client.get("/api/portfolio/me", headers=b["headers"]).json()
    assert ma["slug"] == "shared"
    assert mb["slug"] == "shared-2"


def test_portfolio_without_resume_still_returns_page(client):
    acc = _register(client, email="empty@example.com")
    resp = client.get("/api/public/portfolio/empty")
    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == "Jane Doe"
    assert body["ats_score"] is None
    assert body["skills"] == []
    assert body["ats_history"] == []
