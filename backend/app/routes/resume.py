from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.resume import Resume
from app.models.user import User
from app.schemas.resume import (
    AnalysisResponse,
    ResumeDetail,
    ResumeListItem,
    UploadResponse,
    VersionInfo,
    VersionResponse,
)
from app.services.auth_service import get_current_user
from app.services.resume_service import (
    ResumeNotFoundError,
    ResumeVersionNotFoundError,
    ResumeService,
    UploadRejectedError,
    resume_service,
)

router = APIRouter(prefix="/api/resumes", tags=["resume"])


@router.post("", response_model=UploadResponse, status_code=201)
async def upload_resume(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> UploadResponse:
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF uploads are supported")
    data = await file.read()
    try:
        resume = resume_service.register_upload(
            db,
            file_name=file.filename or "resume.pdf",
            file_bytes=data,
            user_id=user.id,
        )
    except UploadRejectedError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return UploadResponse(id=resume.id, file_name=resume.title)


@router.post("/{resume_id}/versions", response_model=VersionResponse, status_code=201)
async def upload_version(
    resume_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> VersionResponse:
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF uploads are supported")
    data = await file.read()
    try:
        version = resume_service.add_version(
            db,
            resume_id=resume_id,
            user_id=user.id,
            file_name=file.filename or "resume.pdf",
            file_bytes=data,
        )
    except ResumeNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Resume not found") from exc
    except UploadRejectedError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return VersionResponse(
        id=version.id, version_no=version.version_no,
        file_name=version.file_name, status=version.status,
    )


@router.post("/{resume_id}/analyze", response_model=AnalysisResponse)
async def analyze_resume(
    resume_id: str,
    version: int | None = Query(default=None, description="Analyze this version (default: current)"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AnalysisResponse:
    try:
        return await resume_service.analyze(db, resume_id, user.id, version_no=version)
    except ResumeNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Resume not found") from exc
    except ResumeVersionNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Version not found") from exc
    except UploadRejectedError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("", response_model=list[ResumeListItem])
async def list_resumes(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[ResumeListItem]:
    resumes = resume_service.list_owned(db, user.id)
    return [_to_list_item(r) for r in resumes]


@router.get("/{resume_id}", response_model=ResumeDetail)
async def get_resume(
    resume_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ResumeDetail:
    try:
        resume = resume_service.get_owned(db, resume_id, user.id)
    except ResumeNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Resume not found") from exc
    # A detail view counts as a view (lightweight analytics; no event infra).
    resume_service.record_view(db, resume)
    return _to_detail(resume)


@router.delete("/{resume_id}", status_code=204)
async def delete_resume(
    resume_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    try:
        resume_service.delete_owned(db, resume_id, user.id)
    except ResumeNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Resume not found") from exc


def _to_list_item(resume: Resume) -> ResumeListItem:
    cv = resume.current_version
    first = resume.versions[0] if resume.versions else None
    return ResumeListItem(
        id=resume.id,
        title=resume.title or (cv.file_name if cv else ""),
        file_name=cv.file_name if cv else "",
        status=cv.status if cv else "uploaded",
        ats_score=cv.ats_score if cv else None,
        created_at=resume.created_at.isoformat(),
        version_count=len(resume.versions),
        view_count=resume.view_count,
        last_viewed_at=resume.last_viewed_at.isoformat() if resume.last_viewed_at else None,
        first_ats=first.ats_score if first else None,
    )


def _to_detail(resume: Resume) -> ResumeDetail:
    cv = resume.current_version
    return ResumeDetail(
        **_to_list_item(resume).model_dump(),
        current_version_no=cv.version_no if cv else 1,
        versions=[_to_version_info(v) for v in resume.versions],
        analysis=AnalysisResponse.model_validate(cv.analysis)
        if cv and cv.analysis
        else None,
    )


def _to_version_info(version) -> VersionInfo:
    return VersionInfo(
        version_no=version.version_no,
        file_name=version.file_name,
        status=version.status,
        ats_score=version.ats_score,
        created_at=version.created_at.isoformat(),
        analyzed_at=version.analyzed_at.isoformat() if version.analyzed_at else None,
    )
