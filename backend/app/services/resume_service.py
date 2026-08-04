"""Resume upload + analysis orchestration.

Uploads are stored on disk (data/uploads) and metadata/text/analysis in the
database. Analysis runs through the provider chain (ai_provider) and always
returns a schema-valid `AnalysisResponse` — from Gemini, Ollama, or the
deterministic fallback, whichever is available.
"""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config.settings import settings
from app.models.resume import Resume
from app.schemas.resume import AnalysisResponse
from app.services import ai_provider
from app.services.pdf_parser import PdfParseError, extract_text
from app.utils.files import ensure_dir

MAX_UPLOAD_BYTES = 10 * 1024 * 1024


class ResumeNotFoundError(Exception):
    pass


class UploadRejectedError(Exception):
    pass


class ResumeService:
    def register_upload(
        self, db: Session, *, file_name: str, file_bytes: bytes, user_id: str
    ) -> Resume:
        if not file_bytes:
            raise UploadRejectedError("Empty file")
        if len(file_bytes) > MAX_UPLOAD_BYTES:
            raise UploadRejectedError("File exceeds the 10MB limit")

        resume_id = str(uuid4())
        upload_dir = ensure_dir(Path(settings.upload_dir))
        path = upload_dir / f"{resume_id}.pdf"
        path.write_bytes(file_bytes)

        resume = Resume(
            id=resume_id,
            user_id=user_id,
            file_name=file_name,
            file_path=str(path),
            status="uploaded",
        )
        db.add(resume)
        db.commit()
        db.refresh(resume)
        return resume

    # --- Ownership-scoped access. Every lookup is filtered by user_id, so a
    # caller can only ever see their own resumes — another user's id 404s
    # exactly like a nonexistent one (no existence disclosure).

    def get_owned_or_none(self, db: Session, resume_id: str, user_id: str) -> Resume | None:
        return db.scalar(
            select(Resume).where(Resume.id == resume_id, Resume.user_id == user_id)
        )

    def get_owned(self, db: Session, resume_id: str, user_id: str) -> Resume:
        resume = self.get_owned_or_none(db, resume_id, user_id)
        if resume is None:
            raise ResumeNotFoundError(resume_id)
        return resume

    def list_owned(self, db: Session, user_id: str) -> list[Resume]:
        stmt = (
            select(Resume)
            .where(Resume.user_id == user_id)
            .order_by(Resume.created_at.desc())
        )
        return list(db.scalars(stmt))

    def delete_owned(self, db: Session, resume_id: str, user_id: str) -> None:
        resume = self.get_owned(db, resume_id, user_id)
        # Best-effort cleanup of the stored PDF; the DB row is the source of truth.
        try:
            Path(resume.file_path).unlink(missing_ok=True)
        except OSError:
            pass
        db.delete(resume)
        db.commit()

    async def analyze(self, db: Session, resume_id: str, user_id: str) -> AnalysisResponse:
        resume = self.get_owned(db, resume_id, user_id)

        # Re-analysis is cheap to re-run and keeps output fresh; only reuse the
        # stored result if a previous analysis exists AND text extraction worked.
        if resume.status == "analyzed" and resume.analysis:
            return AnalysisResponse.model_validate(resume.analysis)

        try:
            text = resume.text or extract_text(resume.file_path)
        except PdfParseError as exc:
            resume.status = "error"
            db.commit()
            raise UploadRejectedError(str(exc)) from exc

        analysis = await ai_provider.analyze_resume(resume.id, resume.file_name, text)

        resume.text = text
        resume.analysis = analysis.model_dump(mode="json")
        resume.ats_score = analysis.ats_score
        resume.status = "analyzed"
        resume.analyzed_at = datetime.now(timezone.utc)
        db.commit()
        return analysis


resume_service = ResumeService()
