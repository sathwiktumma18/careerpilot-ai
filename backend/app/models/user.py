from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import DateTime, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database.session import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# Account roles. Job seekers get the full product; recruiters get a candidate
# dashboard, their own portfolio, and messaging — no resume/interview/roadmap.
ROLE_JOB_SEEKER = "job_seeker"
ROLE_RECRUITER = "recruiter"
ROLES = (ROLE_JOB_SEEKER, ROLE_RECRUITER)


class User(Base):
    __tablename__ = "users"
    # Social sign-in matches on (provider, provider_sub); password users have
    # both NULL. NULLs don't collide in a unique index, so password-only
    # accounts are unaffected. (A unique index, not a constraint, because
    # SQLite can't ALTER-ADD constraints in migrations.)
    __table_args__ = (
        Index("ix_users_oauth", "oauth_provider", "oauth_provider_sub", unique=True),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    email: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    # "job_seeker" | "recruiter" — see ROLE_* constants above.
    role: Mapped[str] = mapped_column(String, default=ROLE_JOB_SEEKER, nullable=False)
    # bcrypt hash — never store plaintext passwords. Social accounts get a random
    # hash so password login always fails for them (they sign in via OAuth only).
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    # Password-reset: hash of a one-time reset token and when it expires. We store
    # the hash (not the raw token) so a DB leak can't be replayed to reset accounts.
    reset_token_hash: Mapped[str | None] = mapped_column(String, nullable=True)
    reset_token_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # OAuth: provider ("google" | "github") + its stable user id. NULL for
    # email/password accounts.
    oauth_provider: Mapped[str | None] = mapped_column(String, nullable=True)
    oauth_provider_sub: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
