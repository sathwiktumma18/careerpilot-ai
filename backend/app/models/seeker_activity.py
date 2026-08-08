"""SeekerActivity — a job seeker's product actions, surfaced to recruiters.

The recruiter candidate pool is built from these rows: every time a job seeker
analyzes a resume or runs a job match, we record a lightweight activity event.
A seeker appears in a recruiter's candidate list once they have at least one
activity, and the "searched role" values become the "Job roles they searched"
the recruiter sees on the candidate.
"""
from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database.session import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class SeekerActivity(Base):
    __tablename__ = "seeker_activities"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    # "resume_analyzed" | "job_searched"
    activity_type: Mapped[str] = mapped_column(String, nullable=False)
    # The role label this activity implies: the resume's headline role for an
    # analysis, or the role the seeker is hunting for a search.
    role: Mapped[str] = mapped_column(String, default="")
    # Optional extra context (e.g. the resume file name).
    detail: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
