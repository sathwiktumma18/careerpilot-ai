from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.resume import Resume
from app.models.user import User
from app.schemas.resume import (
    AnalysisResponse,
    ResumeDetail,
    ResumeListItem,
    UploadResponse,
)
from app.services.auth_service import get_current_user
from app.services.resume_service import (
    ResumeNotFoundError,
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
    return UploadResponse(id=resume.id, file_name=resume.file_name)


@router.post("/{resume_id}/analyze", response_model=AnalysisResponse)
async def analyze_resume(
    resume_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AnalysisResponse:
    try:
        return await resume_service.analyze(db, resume_id, user.id)
    except ResumeNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Resume not found") from exc
    except UploadRejectedError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("", response_model=list[ResumeListItem])
async def list_resumes(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[ResumeListItem]:
    resumes = resume_service.list_owned(db, user.id)
    return [
        ResumeListItem(
            id=r.id,
            file_name=r.file_name,
            status=r.status,
            ats_score=r.ats_score,
            created_at=r.created_at.isoformat(),
        )
        for r in resumes
    ]


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


def _to_detail(resume: Resume) -> ResumeDetail:
    return ResumeDetail(
        id=resume.id,
        file_name=resume.file_name,
        status=resume.status,
        ats_score=resume.ats_score,
        created_at=resume.created_at.isoformat(),
        analysis=AnalysisResponse.model_validate(resume.analysis)
        if resume.analysis
        else None,
    )
