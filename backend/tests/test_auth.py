"""Auth — registration, login, token verification, and password hashing.

Endpoints under test are /api/auth/register, /api/auth/login, /api/auth/me.
Passwords must never be stored in plaintext (bcrypt), and tokens must be
stateless JWTs that authenticate /me.

The test DB is shared across the whole run, so every test registers its own
user (unique email) instead of relying on a clean slate.
"""
import uuid

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.services import auth_service

PASSWORD = "hunter2-secure"


@pytest.fixture()
def client():
    with TestClient(create_app()) as c:
        yield c


def _unique_email() -> str:
    return f"user-{uuid.uuid4().hex[:10]}@example.com"


def _register(client: TestClient, **overrides) -> dict:
    email = overrides.pop("email", _unique_email())
    payload = {"name": "Jane Doe", "email": email, "password": PASSWORD, **overrides}
    resp = client.post("/api/auth/register", json=payload)
    assert resp.status_code == 201, resp.text
    return resp.json()


def _login(client: TestClient, email: str, **overrides) -> dict:
    """Login with the shared test password unless overridden."""
    payload = {"email": email, "password": PASSWORD, **overrides}
    resp = client.post("/api/auth/login", json=payload)
    assert resp.status_code == 200, resp.text
    return resp.json()


def test_register_returns_token_and_user(client):
    body = _register(client)
    assert body["access_token"]
    assert body["token_type"] == "bearer"
    assert body["user"]["email"]
    assert body["user"]["name"] == "Jane Doe"
    assert body["user"]["id"]
    # The token is a signed JWT that verifies to this user's id.
    assert auth_service.decode_token(body["access_token"]) == body["user"]["id"]


def test_register_normalizes_email_lowercase(client):
    body = _register(client, email="MixedCase@Example.com")
    assert body["user"]["email"] == "mixedcase@example.com"


def test_register_duplicate_email_conflicts(client):
    email = _unique_email()
    _register(client, email=email)
    resp = client.post(
        "/api/auth/register",
        json={"name": "Jane Doe", "email": email, "password": PASSWORD},
    )
    assert resp.status_code == 409
    assert "already exists" in resp.json()["detail"].lower()


def test_register_rejects_invalid_email(client):
    resp = client.post(
        "/api/auth/register",
        json={"name": "Jane Doe", "email": "not-an-email", "password": PASSWORD},
    )
    assert resp.status_code == 422


def test_register_rejects_short_password(client):
    resp = client.post(
        "/api/auth/register",
        json={"name": "Jane Doe", "email": _unique_email(), "password": "short"},
    )
    assert resp.status_code == 422


def test_login_returns_token_for_valid_credentials(client):
    email = _unique_email()
    _register(client, email=email)
    body = _login(client, email=email)
    assert body["access_token"]
    assert body["user"]["email"] == email


def test_login_wrong_password_is_401(client):
    email = _unique_email()
    _register(client, email=email)
    resp = client.post(
        "/api/auth/login", json={"email": email, "password": "wrong-password"}
    )
    assert resp.status_code == 401


def test_login_unknown_email_is_401(client):
    resp = client.post(
        "/api/auth/login",
        json={"email": "nobody@example.com", "password": "whatever-123"},
    )
    assert resp.status_code == 401


def test_me_returns_authenticated_user(client):
    body = _register(client)
    resp = client.get(
        "/api/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"}
    )
    assert resp.status_code == 200
    assert resp.json() == body["user"]


def test_me_without_token_is_401(client):
    assert client.get("/api/auth/me").status_code == 401


def test_me_with_garbage_token_is_401(client):
    resp = client.get("/api/auth/me", headers={"Authorization": "Bearer not.a.jwt"})
    assert resp.status_code == 401


def test_me_with_expired_token_is_401(client, monkeypatch):
    """A token minted with a negative lifetime is refused, not silently accepted."""
    from app.database.session import SessionLocal

    monkeypatch.setattr(auth_service.settings, "access_token_expire_minutes", -1)
    db = SessionLocal()
    try:
        user = auth_service.register_user(
            db, name="Jane Doe", email=_unique_email(), password=PASSWORD
        )
    finally:
        db.close()
    token = auth_service.create_access_token(user.id)
    assert auth_service.decode_token(token) is None
    resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 401


def test_password_is_stored_hashed_not_plaintext(client):
    from app.database.session import SessionLocal
    from app.models.user import User

    email = _unique_email()
    _register(client, email=email)
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).one()
    finally:
        db.close()
    # bcrypt hashes start with $2b$ and never equal the plaintext password.
    assert user.password_hash != PASSWORD
    assert user.password_hash.startswith("$2b$")
    assert auth_service.verify_password(PASSWORD, user.password_hash)


def test_tokens_are_distinct_per_user(client):
    """Tokens for different users differ (and each decodes to its own sub)."""
    alice = _unique_email()
    bob = _unique_email()
    alice_token = _register(client, email=alice)["access_token"]
    bob_token = _register(client, email=bob)["access_token"]
    assert alice_token != bob_token
    assert auth_service.decode_token(alice_token) != auth_service.decode_token(bob_token)
