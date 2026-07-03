from fastapi import APIRouter, UploadFile, File, HTTPException

from app.schemas.resume import AnalysisResponse, UploadResponse
from app.services.resume_service import resume_service

router = APIRouter(prefix="", tags=["resume"])


@router.post("/upload", response_model=UploadResponse)
async def upload_resume(file: UploadFile = File(...)) -> UploadResponse:
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF uploads are supported")
    result = await resume_service.register_upload(file.filename or "resume.pdf")
    return UploadResponse(**result)


@router.post("/analyze", response_model=AnalysisResponse)
async def analyze_resume(resume_id: str) -> AnalysisResponse:
    return await resume_service.analyze(resume_id)
