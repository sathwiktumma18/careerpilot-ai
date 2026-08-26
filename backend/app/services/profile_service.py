"""Profile persistence — the 1:1 `profiles` row behind Account settings.

Both roles use the same row: seekers fill headline/location/bio/socials and
their public portfolio derives from resume data; recruiters set company + role
and their portfolio is built entirely from here. Row is created lazily on first
read so accounts created before this feature simply work.
"""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy.orm import Session

from app.config.settings import settings
from app.models.profile import Profile
from app.models.user import User
from app.schemas.profile import ProfileResponse, ProfileUpdate


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def get_or_create_profile(db: Session, user: User) -> Profile:
    profile = db.get(Profile, user.id)
    if profile is None:
        profile = Profile(user_id=user.id)
        db.add(profile)
        db.flush()  # assigned on commit by callers that persist
    return profile


def avatar_url(user_id: str, avatar_path: str | None) -> str | None:
    if not avatar_path:
        return None
    return f"/api/public/avatar/{user_id}"


def to_response(db: Session, user: User) -> ProfileResponse:
    profile = get_or_create_profile(db, user)
    return ProfileResponse(
        user_id=user.id,
        name=user.name,
        email=user.email,
        role=user.role,
        avatar_url=avatar_url(user.id, profile.avatar_path),
        headline=_clean(profile.headline),
        location=_clean(profile.location),
        bio=_clean(profile.bio),
        years_experience=profile.years_experience,
        linkedin_url=_clean(profile.linkedin_url),
        github_url=_clean(profile.github_url),
        portfolio_url=_clean(profile.portfolio_url),
        company=_clean(profile.company),
        company_role=_clean(profile.company_role),
    )


def apply_update(db: Session, user: User, update: ProfileUpdate) -> ProfileResponse:
    """Persist PATCHed fields. `name` updates `users`; everything else the row."""
    changed = False
    if update.avatar == "clear":
        profile = get_or_create_profile(db, user)
        if profile.avatar_path:
            (Path(settings.avatar_dir) / profile.avatar_path).unlink(missing_ok=True)
            profile.avatar_path = None
            changed = True

    if update.name is not None and update.name.strip() and update.name != user.name:
        user.name = update.name.strip()
        changed = True

    profile = get_or_create_profile(db, user)
    for field in (
        "headline",
        "location",
        "bio",
        "years_experience",
        "linkedin_url",
        "github_url",
        "portfolio_url",
        "company",
        "company_role",
    ):
        value = getattr(update, field)
        if value is None:
            continue  # PATCH semantics — omitted fields stay untouched
        normalized = value.strip() if isinstance(value, str) else value
        if getattr(profile, field) != normalized:
            setattr(profile, field, normalized or None)
            changed = True

    if changed:
        profile.updated_at = _utcnow()
        db.commit()
        db.refresh(user)
    return to_response(db, user)


def set_avatar(db: Session, user: User, avatar_path: str | None) -> str | None:
    profile = get_or_create_profile(db, user)
    profile.avatar_path = avatar_path
    profile.updated_at = _utcnow()
    db.commit()
    return avatar_url(user.id, profile.avatar_path)


def _clean(value: str | None) -> str | None:
    if value is None:
        return None
    return value.strip() or None
