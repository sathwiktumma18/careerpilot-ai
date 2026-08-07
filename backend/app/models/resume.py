"""Resume — a logical resume group.

A resume is the stable anchor the UI and API key on. Its actual file + analysis
live in `ResumeVersion` rows (`versions`), and `current_version` is the one the
frontend shows / the features use by default. Uploading a new version keeps the
group id stable and just points `current_version` at the newest snapshot.
"""
from datetime import datetime, timezone
from typing import TYPE_CHECKING
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base

if TYPE_CHECKING:
    from app.models.version import ResumeVersion


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Resume(Base):
    __tablename__ = "resumes"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    # Nullable for historical rows; always set for new uploads.
    user_id: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    title: Mapped[str] = mapped_column(String, default="")
    current_version_id: Mapped[str | None] = mapped_column(
        ForeignKey("resume_versions.id"), nullable=True
    )
    # Analytics: detail views.
    view_count: Mapped[int] = mapped_column(Integer, default=0)
    last_viewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    versions: Mapped[list["ResumeVersion"]] = relationship(
        back_populates="resume",
        cascade="all, delete-orphan",
        order_by="ResumeVersion.version_no",
        lazy="selectin",
        # Disambiguate: Resume also points at resume_versions via
        # current_version_id; the one-to-many uses the versions' resume_id.
        foreign_keys="ResumeVersion.resume_id",
    )
    current_version: Mapped["ResumeVersion | None"] = relationship(
        foreign_keys=[current_version_id],
        lazy="selectin",
        # Resume ↔ current_version is a circular FK (each side points at the
        # other); post_update breaks the insert-order cycle by setting
        # current_version_id in a follow-up UPDATE instead of the same INSERT.
        post_update=True,
    )
