"""Social sign-in (Google + GitHub) via the OAuth routes.

Network calls are monkeypatched — we exercise the authorize URL building, the
state-JWT validation, find-or-create user logic, and the callback redirects.
"""

from urllib.parse import parse_qs, urlparse

import pytest
from fastapi.testclient import TestClient

from app.config.settings import settings
from app.main import create_app
from app.services import oauth_service


@pytest.fixture()
def client():
    with TestClient(create_app()) as c:
        yield c


@pytest.fixture()
def creds(monkeypatch):
    monkeypatch.setattr(settings, "google_oauth_client_id", "gid")
    monkeypatch.setattr(settings, "google_oauth_client_secret", "gsec")
    monkeypatch.setattr(settings, "github_oauth_client_id", "ghid")
    monkeypatch.setattr(settings, "github_oauth_client_secret", "ghsec")


def test_authorize_returns_501_without_credentials(client):
    for provider in ("google", "github"):
        r = client.get(f"/api/auth/oauth/{provider}/authorize")
        assert r.status_code == 501
        assert r.json()["detail"]


def test_authorize_builds_url_with_state(client, creds):
    for provider in ("google", "github"):
        r = client.get(f"/api/auth/oauth/{provider}/authorize")
        assert r.status_code == 200, r.text
        url = r.json()["url"]
        parsed = urlparse(url)
        params = parse_qs(parsed.query)
        assert "state" in params
        # The callback URI points at our backend callback endpoint.
        assert f"/api/auth/oauth/{provider}/callback" in params["redirect_uri"][0]
        # Google is PKCE — the authorize URL must carry a code_challenge.
        if provider == "google":
            assert "code_challenge" in params
            assert params["code_challenge_method"] == ["S256"]


def test_unknown_provider_is_400(client, creds):
    r = client.get("/api/auth/oauth/nope/authorize")
    assert r.status_code == 400


def test_callback_creates_social_user_and_redirects_with_token(client, creds, monkeypatch):
    state = oauth_service._mint_state("google", "verifier-123")
    monkeypatch.setattr(oauth_service, "_exchange_code", lambda *a, **k: "access-token")
    monkeypatch.setattr(
        oauth_service,
        "_fetch_profile",
        lambda *a, **k: {"sub": "goog-1", "email": "soc@example.com", "name": "Soc User"},
    )

    r = client.get(
        f"/api/auth/oauth/google/callback?code=abc&state={state}",
        follow_redirects=False,
    )
    assert r.status_code == 302
    loc = r.headers["location"]
    assert "/auth/oauth/callback?token=" in loc

    token = loc.split("token=")[1]
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["email"] == "soc@example.com"

    # Social accounts have no usable password — password login must fail.
    login = client.post(
        "/api/auth/login", json={"email": "soc@example.com", "password": "whatever"}
    )
    assert login.status_code == 401


def test_callback_email_taken_redirects_with_error(client, creds, monkeypatch):
    # A password account already owns the email.
    email = "taken@example.com"
    client.post(
        "/api/auth/register",
        json={"name": "Owner", "email": email, "password": "hunter2-secure"},
    )

    state = oauth_service._mint_state("github", "verifier-123")
    monkeypatch.setattr(oauth_service, "_exchange_code", lambda *a, **k: "access-token")
    monkeypatch.setattr(
        oauth_service,
        "_fetch_profile",
        lambda *a, **k: {"sub": "gh-1", "email": email, "name": "Gh User"},
    )

    r = client.get(
        f"/api/auth/oauth/github/callback?code=abc&state={state}",
        follow_redirects=False,
    )
    assert r.status_code == 302
    assert "error=email_taken" in r.headers["location"]
    # No token is handed out, and the existing password account still works.
    assert "token=" not in r.headers["location"]
    assert client.post(
        "/api/auth/login", json={"email": email, "password": "hunter2-secure"}
    ).status_code == 200


def test_callback_rejects_forged_state(client, creds):
    r = client.get(
        "/api/auth/oauth/google/callback?code=abc&state=not-a-real-state",
        follow_redirects=False,
    )
    assert r.status_code == 302
    assert "error=invalid_state" in r.headers["location"]


def test_callback_state_provider_mismatch(client, creds):
    # State minted for google but used on the github callback.
    state = oauth_service._mint_state("google", "verifier-123")
    r = client.get(
        f"/api/auth/oauth/github/callback?code=abc&state={state}",
        follow_redirects=False,
    )
    assert "error=invalid_state" in r.headers["location"]


def test_callback_provider_error_redirects(client, creds, monkeypatch):
    state = oauth_service._mint_state("google", "verifier-123")

    def _boom(*a, **k):
        raise oauth_service.OAuthProviderError("provider rejected the code")

    monkeypatch.setattr(oauth_service, "_exchange_code", _boom)
    r = client.get(
        f"/api/auth/oauth/google/callback?code=abc&state={state}",
        follow_redirects=False,
    )
    assert "error=provider" in r.headers["location"]


def test_callback_surfaces_denial_from_provider(client, creds):
    r = client.get(
        "/api/auth/oauth/google/callback?error=access_denied",
        follow_redirects=False,
    )
    assert "error=access_denied" in r.headers["location"]
