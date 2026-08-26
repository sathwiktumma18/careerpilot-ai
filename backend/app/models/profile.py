"""User profile — the editable public identity for BOTH roles.

One row per user (1:1). Job seekers fill headline/location/bio/social links and
their public portfolio derives from resume data; recruiters set company + role
and their portfolio is built entirely from this row. `avatar_path` is the stored
photo (git-ignored data dir), exposed publicly via `/api/public/avatar/{user_id}`.
"""
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database.session import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Profile(Base):
    __tablename__ = "profiles"

    user_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    # Photo file name (relative to settings.avatar_dir), e.g. "u123.png".
    avatar_path: Mapped[str | None] = mapped_column(String(300), nullable=True)
    headline: Mapped[str | None] = mapped_column(String(120), nullable=True)
    location: Mapped[str | None] = mapped_column(String(80), nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    years_experience: Mapped[int | None] = mapped_column(Integer, nullable=True)
    linkedin_url: Mapped[str | None] = mapped_column(String(300), nullable=True)
    github_url: Mapped[str | None] = mapped_column(String(300), nullable=True)
    portfolio_url: Mapped[str | None] = mapped_column(String(300), nullable=True)
    # Recruiter-only identity (their public portfolio is built from this).
    company: Mapped[str | None] = mapped_column(String(120), nullable=True)
    company_role: Mapped[str | None] = mapped_column(String(120), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
