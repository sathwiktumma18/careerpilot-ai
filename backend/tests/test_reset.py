"""Password reset — lightweight token flow.

Covers /api/auth/forgot-password and /api/auth/reset-password: token issuance,
no account enumeration, password change via a valid token, and rejection of
wrong / expired / unknown tokens.
"""
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.database.session import SessionLocal
from app.main import create_app
from app.models.user import User

PASSWORD = "hunter2-secure"
NEW_PASSWORD = "brand-new-pass"


@pytest.fixture()
def client():
    with TestClient(create_app()) as c:
        yield c


def _email() -> str:
    return f"reset-{uuid.uuid4().hex[:10]}@example.com"


def _register(client: TestClient, email: str) -> str:
    resp = client.post(
        "/api/auth/register",
        json={"name": "Jane Doe", "email": email, "password": PASSWORD},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["user"]["email"]


def _forgot(client: TestClient, email: str) -> dict:
    resp = client.post("/api/auth/forgot-password", json={"email": email})
    assert resp.status_code == 200, resp.text
    return resp.json()


def _login(client: TestClient, email: str, password: str):
    return client.post("/api/auth/login", json={"email": email, "password": password})


def test_forgot_returns_token_for_existing_user(client):
    email = _register(client, _email())
    body = _forgot(client, email)
    assert body["reset_token"]
    assert len(body["reset_token"]) > 20


def test_forgot_unknown_email_returns_200_no_token(client):
    # Never registered — must still be 200 with a null token (no enumeration).
    body = _forgot(client, _email())
    assert body["reset_token"] is None


def test_reset_password_sets_new_password(client):
    email = _register(client, _email())
    token = _forgot(client, email)["reset_token"]

    resp = client.post(
        "/api/auth/reset-password",
        json={"email": email, "token": token, "new_password": NEW_PASSWORD},
    )
    assert resp.status_code == 200, resp.text

    # New password works, old one is rejected.
    assert _login(client, email, NEW_PASSWORD).status_code == 200
    assert _login(client, email, PASSWORD).status_code == 401


def test_reset_wrong_token_returns_400(client):
    email = _register(client, _email())
    _forgot(client, email)
    resp = client.post(
        "/api/auth/reset-password",
        json={"email": email, "token": "definitely-not-right", "new_password": NEW_PASSWORD},
    )
    assert resp.status_code == 400


def test_reset_unknown_email_returns_400(client):
    resp = client.post(
        "/api/auth/reset-password",
        json={"email": "nobody@example.com", "token": "x", "new_password": NEW_PASSWORD},
    )
    assert resp.status_code == 400


def test_reset_expired_token_returns_400(client):
    email = _register(client, _email())
    token = _forgot(client, email)["reset_token"]
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == email))
        user.reset_token_expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
        db.commit()

    resp = client.post(
        "/api/auth/reset-password",
        json={"email": email, "token": token, "new_password": NEW_PASSWORD},
    )
    assert resp.status_code == 400