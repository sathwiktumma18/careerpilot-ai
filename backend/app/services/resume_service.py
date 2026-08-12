"""Resume upload + analysis orchestration, with version history.

A "resume" is a logical group (Resume) that owns an ordered history of
snapshots (ResumeVersion). Every upload creates a new version; `current_version`
is the one the UI and features use by default. Uploads are stored on disk
(data/uploads, one file per version) and metadata/text/analysis live in the
version rows. Analysis runs through the provider chain (ai_provider) and always
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
from app.models.version import ResumeVersion
from app.schemas.resume import AnalysisResponse
from app.services import ai_provider
from app.services.pdf_parser import PdfParseError, extract_text
from app.utils.files import ensure_dir

MAX_UPLOAD_BYTES = 10 * 1024 * 1024


class ResumeNotFoundError(Exception):
    pass


class ResumeVersionNotFoundError(Exception):
    pass


class UploadRejectedError(Exception):
    pass


class ResumeService:
    # --- Uploads --------------------------------------------------------------

    def _save_pdf(self, file_bytes: bytes) -> Path:
        """Write an upload to disk; one file per version so versions never
        clobber each other. Returns the stored path."""
        version_id = str(uuid4())
        upload_dir = ensure_dir(Path(settings.upload_dir))
        path = upload_dir / f"{version_id}.pdf"
        path.write_bytes(file_bytes)
        return path

    @staticmethod
    def _check_upload(file_bytes: bytes) -> None:
        if not file_bytes:
            raise UploadRejectedError("Empty file")
        if len(file_bytes) > MAX_UPLOAD_BYTES:
            raise UploadRejectedError("File exceeds the 10MB limit")

    def register_upload(
        self, db: Session, *, file_name: str, file_bytes: bytes, user_id: str
    ) -> Resume:
        """First upload: creates the resume group + its version 1."""
        self._check_upload(file_bytes)
        path = self._save_pdf(file_bytes)

        resume = Resume(
            id=str(uuid4()),
            user_id=user_id,
            title=file_name,
        )
        version = ResumeVersion(
            resume=resume,
            version_no=1,
            file_name=file_name,
            file_path=str(path),
            status="uploaded",
        )
        resume.current_version = version  # sets current_version_id
        db.add(resume)
        db.commit()
        db.refresh(resume)
        return resume

    def add_version(
        self, db: Session, *, resume_id: str, user_id: str, file_name: str, file_bytes: bytes
    ) -> ResumeVersion:
        """Upload a new snapshot of an existing group; bumps current_version."""
        resume = self.get_owned(db, resume_id, user_id)
        self._check_upload(file_bytes)
        path = self._save_pdf(file_bytes)

        next_no = max((v.version_no for v in resume.versions), default=0) + 1
        version = ResumeVersion(
            resume_id=resume.id,
            version_no=next_no,
            file_name=file_name,
            file_path=str(path),
            status="uploaded",
        )
        resume.current_version = version
        db.add(version)
        db.commit()
        db.refresh(version)
        return version

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

    def get_owned_version(
        self, db: Session, resume_id: str, user_id: str, version_no: int
    ) -> ResumeVersion:
        resume = self.get_owned(db, resume_id, user_id)
        version = next(
            (v for v in resume.versions if v.version_no == version_no), None
        )
        if version is None:
            raise ResumeVersionNotFoundError(resume_id, version_no)
        return version

    def delete_owned(self, db: Session, resume_id: str, user_id: str) -> None:
        resume = self.get_owned(db, resume_id, user_id)
        # Best-effort cleanup of the stored PDFs; the DB rows are the source of truth.
        for version in resume.versions:
            try:
                Path(version.file_path).unlink(missing_ok=True)
            except OSError:
                pass
        # ORM cascade removes the versions (cascade="all, delete-orphan").
        db.delete(resume)
        db.commit()

    # --- Analytics ------------------------------------------------------------

    def record_view(self, db: Session, resume: Resume) -> None:
        resume.view_count += 1
        resume.last_viewed_at = datetime.now(timezone.utc)
        db.commit()

    # --- Analysis -------------------------------------------------------------

    async def analyze(
        self,
        db: Session,
        resume_id: str,
        user_id: str,
        version_no: int | None = None,
        *,
        job_description: str | None = None,
        target_role: str | None = None,
    ) -> AnalysisResponse:
        resume = self.get_owned(db, resume_id, user_id)
        version = self._resolve_version(resume, version_no)
        jd_mode = bool(job_description or target_role)

        # Re-analysis is cheap to re-run and keeps output fresh; only reuse the
        # stored result if a previous analysis exists AND text extraction worked.
        # JD-specific analyses are always recomputed — they score THIS posting,
        # so caching a previous JD result would be stale.
        if not jd_mode and version.status == "analyzed" and version.analysis:
            return AnalysisResponse.model_validate(version.analysis)

        try:
            text = version.text or extract_text(version.file_path)
        except PdfParseError as exc:
            version.status = "error"
            db.commit()
            raise UploadRejectedError(str(exc)) from exc

        analysis = await ai_provider.analyze_resume(
            version.id,
            version.file_name,
            text,
            job_description=job_description,
            target_role=target_role,
        )

        # JD analyses are transient: they never overwrite the stored general
        # baseline, so a later plain "Analyze" returns the stable benchmark.
        if jd_mode:
            analysis.analysis_mode = "jd"
            analysis.target_role = target_role or job_description or "job"
            self._record_seeker_activity(db, resume, user_id, analysis)
            return analysis

        version.text = text
        version.analysis = analysis.model_dump(mode="json")
        version.ats_score = analysis.ats_score
        version.status = "analyzed"
        version.analyzed_at = datetime.now(timezone.utc)
        db.commit()
        self._record_seeker_activity(db, resume, user_id, analysis)
        return analysis

    @staticmethod
    def _record_seeker_activity(
        db: Session, resume: Resume, user_id: str, analysis: AnalysisResponse
    ) -> None:
        """Surface this seeker in the recruiter candidate pool. Imported here
        (not at module top) to avoid a circular import chain:
        resume_service → seeker_service → portfolio_service → resume_service.
        """
        from app.services.seeker_service import record_activity, role_from_analysis

        record_activity(
            db,
            user_id=user_id,
            activity_type="resume_analyzed",
            role=role_from_analysis(analysis.model_dump(mode="json")),
            detail=resume.title,
        )

    def _resolve_version(self, resume: Resume, version_no: int | None) -> ResumeVersion:
        """The version to analyze: explicitly requested one, else the current."""
        if version_no is None:
            if resume.current_version is None:
                raise ResumeVersionNotFoundError(resume.id, "current")
            return resume.current_version
        version = next((v for v in resume.versions if v.version_no == version_no), None)
        if version is None:
            raise ResumeVersionNotFoundError(resume.id, version_no)
        return version


resume_service = ResumeService()
