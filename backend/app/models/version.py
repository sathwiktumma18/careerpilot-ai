"""ResumeVersion — one snapshot of a resume (its file + analysis at a point in time).

A logical `Resume` owns many versions; each version is what used to be the
whole `Resume` row (file, status, ATS, text, analysis). `version_no` starts at
1 and increments on each new upload. See app/models/resume.py.
"""
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ResumeVersion(Base):
    __tablename__ = "resume_versions"
    __table_args__ = (
        UniqueConstraint("resume_id", "version_no", name="uq_resume_versions_group_no"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    resume_id: Mapped[str] = mapped_column(
        ForeignKey("resumes.id", ondelete="CASCADE"), index=True, nullable=False
    )
    version_no: Mapped[int] = mapped_column(Integer, nullable=False)
    file_name: Mapped[str] = mapped_column(String, nullable=False)
    file_path: Mapped[str] = mapped_column(String, default="")
    status: Mapped[str] = mapped_column(String, default="uploaded")  # uploaded | analyzed | error
    ats_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Extracted text (kept so analysis can be re-run without re-parsing).
    text: Mapped[str | None] = mapped_column(String, nullable=True)
    # The full AnalysisResponse payload as JSON.
    analysis: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    analyzed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    resume: Mapped["Resume"] = relationship(
        back_populates="versions",
        # Disambiguate: Resume also points at us via current_version_id; this
        # many-to-one uses our own resume_id.
        foreign_keys=[resume_id],
    )
