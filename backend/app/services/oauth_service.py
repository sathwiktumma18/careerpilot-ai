"""Social sign-in: Google + GitHub, self-contained authorization-code flow.

Hand-rolled with `httpx` (no new dependency). The authorize step returns a URL
with `state` = a short-lived JWT signed with `settings.jwt_secret` that embeds
the PKCE `code_verifier` (Google) — stateless, no server-side session table.
The callback exchanges the code, fetches the profile, and finds-or-creates a
User keyed on (oauth_provider, oauth_provider_sub).

When no credentials are configured the authorize endpoint answers 501 and the
frontend keeps the buttons in "coming soon" mode — the rest of the app is
unaffected.
"""
from __future__ import annotations

import base64
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import httpx
import jwt

from app.config.settings import settings
from app.models.user import User
from app.services.auth_service import (
    EmailTakenError,
    register_user,
    to_auth_response,
)

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"
GITHUB_AUTH_URL = "https://github.com/login/oauth/authorize"
GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"
GITHUB_USER_URL = "https://api.github.com/user"

PROVIDERS = {"google", "github"}


class OAuthNotConfiguredError(Exception):
    """Provider credentials are absent — authorize should answer 501."""


class OAuthStateError(Exception):
    """Missing/expired/tampered state, or provider mismatch."""


class OAuthProviderError(Exception):
    """The provider's token exchange or profile fetch failed."""


class OAuthEmailTakenError(Exception):
    """The social email already belongs to a password account."""


# --- PKCE (Google requires a verifier on confidential clients; harmless for GH) -

def _code_verifier() -> str:
    return secrets.token_urlsafe(48)


def _code_challenge(verifier: str) -> str:
    digest = hashlib.sha256(verifier.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")


def _mint_state(provider: str, code_verifier: str) -> str:
    payload = {
        "p": provider,
        "cv": code_verifier,
        "exp": datetime.now(timezone.utc)
        + timedelta(minutes=settings.oauth_state_expire_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def _decode_state(state: str) -> tuple[str, str] | None:
    """Return (provider, code_verifier) or None on any failure."""
    try:
        payload = jwt.decode(state, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError:
        return None
    provider = payload.get("p")
    verifier = payload.get("cv")
    if not provider or verifier is None:
        return None
    return provider, verifier


def _redirect_uri(provider: str) -> str:
    return f"{settings.oauth_redirect_base_url}/api/auth/oauth/{provider}/callback"


def _client_creds(provider: str) -> tuple[str, str]:
    if provider == "google":
        cid, secret = settings.google_oauth_client_id, settings.google_oauth_client_secret
    else:
        cid, secret = settings.github_oauth_client_id, settings.github_oauth_client_secret
    if not cid or not secret:
        raise OAuthNotConfiguredError(provider)
    return cid, secret


def build_authorize_url(provider: str) -> str:
    """The provider URL the user is redirected to. Raises OAuthNotConfiguredError."""
    if provider not in PROVIDERS:
        raise OAuthStateError(f"Unsupported provider: {provider}")
    cid, _ = _client_creds(provider)
    verifier = _code_verifier()
    state = _mint_state(provider, verifier)

    if provider == "google":
        params = {
            "client_id": cid,
            "redirect_uri": _redirect_uri("google"),
            "response_type": "code",
            "scope": "openid email profile",
            "state": state,
            "code_challenge": _code_challenge(verifier),
            "code_challenge_method": "S256",
            "access_type": "online",
            "prompt": "select_account",
        }
        return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"

    params = {
        "client_id": cid,
        "redirect_uri": _redirect_uri("github"),
        "scope": "read:user user:email",
        "state": state,
    }
    return f"{GITHUB_AUTH_URL}?{urlencode(params)}"


# --- Exchange + login ---------------------------------------------------------

def _exchange_code(provider: str, code: str, code_verifier: str) -> str:
    """Return the access token from the provider's token endpoint."""
    _, secret = _client_creds(provider)
    headers = {"Accept": "application/json"}
    if provider == "google":
        data = {
            "client_id": settings.google_oauth_client_id,
            "client_secret": secret,
            "code": code,
            "code_verifier": code_verifier,
            "grant_type": "authorization_code",
            "redirect_uri": _redirect_uri("google"),
        }
        url = GOOGLE_TOKEN_URL
    else:
        data = {
            "client_id": settings.github_oauth_client_id,
            "client_secret": secret,
            "code": code,
            "redirect_uri": _redirect_uri("github"),
        }
        url = GITHUB_TOKEN_URL

    with httpx.Client(timeout=30) as client:
        resp = client.post(url, data=data, headers=headers)
    if resp.status_code >= 400:
        raise OAuthProviderError(f"{provider} token exchange failed: {resp.status_code}")
    token = resp.json().get("access_token")
    if not token:
        raise OAuthProviderError(f"{provider} returned no access_token")
    return token


def _fetch_profile(provider: str, access_token: str) -> dict:
    """Return {sub, email, name} for the authenticated provider user."""
    headers = {"Authorization": f"Bearer {access_token}", "Accept": "application/json"}
    with httpx.Client(timeout=30) as client:
        if provider == "google":
            resp = client.get(GOOGLE_USERINFO_URL, headers=headers)
        else:
            resp = client.get(GITHUB_USER_URL, headers=headers)
    if resp.status_code >= 400:
        raise OAuthProviderError(f"{provider} profile fetch failed: {resp.status_code}")
    data = resp.json()
    if provider == "google":
        sub = data.get("sub")
        email = (data.get("email") or "").lower()
        name = data.get("name") or email.split("@")[0] or "Google User"
        if not sub:
            raise OAuthProviderError("google profile missing sub")
        return {"sub": str(sub), "email": email, "name": name}
    # GitHub: id is numeric, email can be null (private profile) — fall back to
    # the login handle so the account always has a name.
    gh_id = data.get("id")
    if gh_id is None:
        raise OAuthProviderError("github profile missing id")
    email = (data.get("email") or "").lower()
    name = data.get("name") or data.get("login") or "GitHub User"
    return {"sub": str(gh_id), "email": email, "name": name}


def _find_or_create_user(db, provider: str, profile: dict):
    """Existing social user → their account; email collision → raise; else create."""
    existing = db.query(User).filter_by(
        oauth_provider=provider, oauth_provider_sub=profile["sub"]
    ).first()
    if existing:
        return existing
    if profile["email"] and db.query(User).filter_by(email=profile["email"]).first():
        raise OAuthEmailTakenError(profile["email"])
    # No password: a random hash means password login always fails for social
    # accounts (they authenticate through OAuth only).
    try:
        return register_user(
            db,
            name=profile["name"],
            email=profile["email"] or f"{provider}-{profile['sub']}@local.invalid",
            password=secrets.token_urlsafe(32),
        )
    except EmailTakenError as exc:  # lost a race with a concurrent signup
        raise OAuthEmailTakenError(profile["email"]) from exc


def exchange_and_login(db, *, provider: str, code: str, state: str):
    """Exchange the auth code for a session. Returns an AuthResponse.

    Raises OAuthStateError (bad/expired state), OAuthProviderError (provider
    rejected the code), or OAuthEmailTakenError (email already used with a
    password account).
    """
    decoded = _decode_state(state)
    if decoded is None or decoded[0] != provider:
        raise OAuthStateError("Invalid or expired OAuth state")
    _state_provider, code_verifier = decoded

    token = _exchange_code(provider, code, code_verifier)
    profile = _fetch_profile(provider, token)
    user = _find_or_create_user(db, provider, profile)
    return to_auth_response(user)
