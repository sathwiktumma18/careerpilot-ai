from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from sqlalchemy import JSON, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database.session import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Resume(Base):
    __tablename__ = "resumes"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    # Nullable for now — wired to a real User when auth lands (Phase 3).
    user_id: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    file_name: Mapped[str] = mapped_column(String)
    file_path: Mapped[str] = mapped_column(String, default="")
    status: Mapped[str] = mapped_column(String, default="uploaded")  # uploaded | analyzed | error
    ats_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Extracted resume text (kept so analysis can be re-run without re-parsing).
    text: Mapped[str | None] = mapped_column(String, nullable=True)
    # The full AnalysisResponse payload as JSON.
    analysis: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    analyzed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
