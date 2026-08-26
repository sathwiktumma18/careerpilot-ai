"""Account settings (Phase F): profile persistence + avatar upload + portfolios.

The profile is the 1:1 editable identity for BOTH roles. Job-seeker portfolios
layer profile identity over resume data; recruiter portfolios are built entirely
from the profile row. Avatar serving is public (no auth) so `<img>` works.
"""
import uuid

import pytest
from fastapi.testclient import TestClient

from app.main import create_app

from tests.fixtures import resume_pdf_bytes


@pytest.fixture()
def client():
    with TestClient(create_app()) as c:
        yield c


def _register(client: TestClient, role="job_seeker", name="Jane Doe") -> dict:
    email = f"prof-{uuid.uuid4().hex[:10]}@example.com"
    resp = client.post(
        "/api/auth/register",
        json={"name": name, "email": email, "password": "hunter2-secure", "role": role},
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    return {
        "user_id": body["user"]["id"],
        "email": email,
        "token": body["access_token"],
        "headers": {"Authorization": f"Bearer {body['access_token']}"},
    }


# --------------------------------------------------------------------------- #
# Profile read/write
# --------------------------------------------------------------------------- #

def test_profile_requires_auth(client):
    assert client.get("/api/profile").status_code == 401
    assert client.patch("/api/profile", json={"headline": "x"}).status_code == 401


def test_profile_starts_empty_no_demo_data(client):
    acc = _register(client)
    resp = client.get("/api/profile", headers=acc["headers"])
    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == "Jane Doe"
    assert body["email"] == acc["email"]
    assert body["role"] == "job_seeker"
    assert body["headline"] is None
    assert body["location"] is None
    assert body["bio"] is None
    assert body["linkedin_url"] is None
    assert body["company"] is None
    assert body["avatar_url"] is None


def test_profile_patch_persists_fields(client):
    acc = _register(client)
    resp = client.patch(
        "/api/profile",
        json={
            "name": "Jane D. Smith",
            "headline": "Frontend Engineer @ Acme",
            "location": "Bengaluru",
            "bio": "Building delightful web apps.",
            "years_experience": 4,
            "linkedin_url": "https://linkedin.com/in/janed",
            "github_url": "https://github.com/janed",
            "portfolio_url": "https://janed.dev",
        },
        headers=acc["headers"],
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["name"] == "Jane D. Smith"
    assert body["headline"] == "Frontend Engineer @ Acme"
    assert body["bio"] == "Building delightful web apps."
    assert body["linkedin_url"] == "https://linkedin.com/in/janed"

    # GET reflects the same values.
    got = client.get("/api/profile", headers=acc["headers"]).json()
    assert got["name"] == "Jane D. Smith"
    assert got["headline"] == "Frontend Engineer @ Acme"
    assert got["github_url"] == "https://github.com/janed"
    assert got["years_experience"] == 4


def test_profile_patch_is_partial(client):
    """PATCHing one field must not clobber the others."""
    acc = _register(client)
    client.patch(
        "/api/profile",
        json={"headline": "Senior Engineer", "location": "Hyderabad"},
        headers=acc["headers"],
    )
    client.patch("/api/profile", json={"headline": "Staff Engineer"}, headers=acc["headers"])
    got = client.get("/api/profile", headers=acc["headers"]).json()
    assert got["headline"] == "Staff Engineer"
    assert got["location"] == "Hyderabad"  # untouched by the second PATCH


def test_profile_rejects_bad_values(client):
    acc = _register(client)
    # 400 from pydantic for negative experience.
    assert client.patch(
        "/api/profile", json={"years_experience": -1}, headers=acc["headers"]
    ).status_code == 422
    assert client.patch(
        "/api/profile", json={"headline": "x" * 500}, headers=acc["headers"]
    ).status_code == 422


# --------------------------------------------------------------------------- #
# Avatar upload + public serving
# --------------------------------------------------------------------------- #

def test_avatar_upload_and_public_serve(client):
    acc = _register(client)
    up = client.post(
        "/api/profile/avatar",
        files={"file": ("me.png", b"\x89PNG\r\n\x1a\nfakepng", "image/png")},
        headers=acc["headers"],
    )
    assert up.status_code == 200, up.text
    body = up.json()
    assert body["avatar_url"] == f"/api/public/avatar/{acc['user_id']}"

    # Public serving needs NO auth — this is what lets <img> tags work.
    img = client.get(body["avatar_url"])
    assert img.status_code == 200
    assert img.headers["content-type"].startswith("image/png")

    # Avatar URL appears on the profile too.
    prof = client.get("/api/profile", headers=acc["headers"]).json()
    assert prof["avatar_url"] == body["avatar_url"]


def test_avatar_rejects_non_image(client):
    acc = _register(client)
    resp = client.post(
        "/api/profile/avatar",
        files={"file": ("evil.pdf", b"%PDF-not-an-image", "application/pdf")},
        headers=acc["headers"],
    )
    assert resp.status_code == 400


def test_avatar_rejects_oversized(client):
    acc = _register(client)
    big = b"x" * (5 * 1024 * 1024 + 1)
    resp = client.post(
        "/api/profile/avatar",
        files={"file": ("big.png", big, "image/png")},
        headers=acc["headers"],
    )
    assert resp.status_code == 413


def test_public_avatar_unknown_user_404(client):
    assert client.get("/api/public/avatar/does-not-exist").status_code == 404


# --------------------------------------------------------------------------- #
# Recruiter portfolio (built from the profile row)
# --------------------------------------------------------------------------- #

def test_recruiter_portfolio_from_profile(client):
    rec = _register(client, role="recruiter", name="Rita Recruiter")
    client.patch(
        "/api/profile",
        json={
            "company": "HireHive",
            "company_role": "Talent Lead",
            "location": "Mumbai",
            "bio": "I match great engineers with great teams.",
            "linkedin_url": "https://linkedin.com/in/rita",
        },
        headers=rec["headers"],
    )
    slug = rec["email"].split("@")[0]
    resp = client.get(f"/api/public/portfolio/{slug}")  # no auth — public
    assert resp.status_code == 200
    body = resp.json()
    assert body["is_recruiter"] is True
    assert body["company"] == "HireHive"
    assert body["company_role"] == "Talent Lead"
    assert body["location"] == "Mumbai"
    assert body["summary"] == "I match great engineers with great teams."
    assert body["linkedin_url"] == "https://linkedin.com/in/rita"
    assert body["ats_score"] is None
    assert body["skills"] == []
    assert body["resume_file_name"] == ""


def test_recruiter_portfolio_headline_falls_back_to_company_role(client):
    rec = _register(client, role="recruiter", name="Rita")
    client.patch(
        "/api/profile",
        json={"company": "Acme", "company_role": "Head of Talent"},
        headers=rec["headers"],
    )
    slug = rec["email"].split("@")[0]
    body = client.get(f"/api/public/portfolio/{slug}").json()
    assert body["headline"] == "Head of Talent at Acme"


def test_seeker_portfolio_carries_profile_identity(client):
    acc = _register(client)
    client.patch(
        "/api/profile",
        json={
            "headline": "React Specialist",
            "location": "Pune",
            "linkedin_url": "https://linkedin.com/in/jane",
        },
        headers=acc["headers"],
    )
    # Upload a resume so the seeker portfolio has real ATS data.
    up = client.post(
        "/api/resumes",
        files={"file": ("jane.pdf", resume_pdf_bytes(), "application/pdf")},
        headers=acc["headers"],
    )
    assert up.status_code == 201
    client.post(f"/api/resumes/{up.json()['id']}/analyze", headers=acc["headers"])

    slug = acc["email"].split("@")[0]
    body = client.get(f"/api/public/portfolio/{slug}").json()
    assert body["is_recruiter"] is False
    assert body["headline"] == "React Specialist"  # profile wins over analysis
    assert body["location"] == "Pune"
    assert body["linkedin_url"] == "https://linkedin.com/in/jane"
    assert body["ats_score"] is not None
    assert body["skills"]
