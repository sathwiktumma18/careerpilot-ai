"""Authentication: password hashing, JWT issuance/verification, and the
`get_current_user` dependency that guards protected routes.

Passwords are hashed with bcrypt (never stored in plaintext) and sessions are
stateless JWTs (HS256) signed with `settings.jwt_secret`.
"""
import hashlib
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config.settings import settings
from app.database.session import get_db
from app.models.user import ROLE_RECRUITER, User
from app.schemas.auth import AuthResponse, UserOut


class EmailTakenError(Exception):
    pass


class InvalidCredentialsError(Exception):
    pass


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False


def create_access_token(user_id: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_expire_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> str | None:
    """Return the user id encoded in a token, or None if invalid/expired."""
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        return payload.get("sub")
    except jwt.PyJWTError:
        return None


def register_user(
    db: Session, *, name: str, email: str, password: str, role: str = "job_seeker"
) -> User:
    email = email.lower()
    if db.scalar(select(User).where(User.email == email)):
        raise EmailTakenError(email)
    user = User(
        email=email,
        name=name.strip(),
        password_hash=hash_password(password),
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, *, email: str, password: str) -> User:
    user = db.scalar(select(User).where(User.email == email.lower()))
    if user is None or not verify_password(password, user.password_hash):
        raise InvalidCredentialsError()
    return user


def to_auth_response(user: User) -> AuthResponse:
    return AuthResponse(
        access_token=create_access_token(user.id),
        user=UserOut(id=user.id, email=user.email, name=user.name, role=user.role),
    )


# How long a password-reset token stays valid.
RESET_TOKEN_EXPIRE_MINUTES = 30


class InvalidResetTokenError(Exception):
    pass


def _hash_reset_token(token: str) -> str:
    """Store only the hash — a leaked DB can't be replayed to reset accounts."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def issue_password_reset(db: Session, *, email: str) -> str | None:
    """Mint a one-time reset token, returning the raw token (surfaced once).

    Returns None when no user exists — the route still answers 200 so callers
    can't tell valid accounts from invalid ones (no account enumeration).
    """
    user = db.scalar(select(User).where(User.email == email.lower()))
    if user is None:
        return None
    token = secrets.token_urlsafe(32)
    user.reset_token_hash = _hash_reset_token(token)
    user.reset_token_expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=RESET_TOKEN_EXPIRE_MINUTES
    )
    db.commit()
    return token


def reset_password(db: Session, *, email: str, token: str, new_password: str) -> None:
    """Set a new password if the reset token matches and hasn't expired.

    Raises InvalidResetTokenError on any failure (unknown email, bad token, or
    expired token) — routes surface one generic 400 so the cases are
    indistinguishable from the outside.
    """
    user = db.scalar(select(User).where(User.email == email.lower()))
    if user is None or user.reset_token_hash is None or user.reset_token_expires_at is None:
        raise InvalidResetTokenError()
    if not secrets.compare_digest(user.reset_token_hash, _hash_reset_token(token)):
        raise InvalidResetTokenError()
    # SQLite stores DateTime(timezone=True) without the tz offset, so the stored
    # value can come back naive even though Postgres returns it aware. Normalize
    # to UTC before comparing against the aware "now".
    expires_at = user.reset_token_expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) > expires_at:
        raise InvalidResetTokenError()
    user.password_hash = hash_password(new_password)
    user.reset_token_hash = None
    user.reset_token_expires_at = None
    db.commit()


_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    """FastAPI dependency: resolves the authenticated user or raises 401."""
    if credentials is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = decode_token(credentials.credentials)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def get_current_recruiter(user: User = Depends(get_current_user)) -> User:
    """Dependency for recruiter-only routes (candidate dashboard, etc.)."""
    if user.role != ROLE_RECRUITER:
        raise HTTPException(status_code=403, detail="Recruiter access required")
    return user
