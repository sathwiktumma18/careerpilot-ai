from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.schemas.job_match import JobLite, JobMatchRequest, JobMatchResponse
from app.services.job_match_service import JobMatchError, list_jobs, match_resume
from app.services.resume_service import ResumeNotFoundError

router = APIRouter(prefix="/api", tags=["job-match"])


@router.post("/match", response_model=JobMatchResponse)
async def match_endpoint(
    payload: JobMatchRequest, db: Session = Depends(get_db)
) -> JobMatchResponse:
    try:
        data = await match_resume(
            db,
            payload.resume_id,
            job_description=payload.job_description,
            remote_only=payload.remote_only,
            locations=payload.locations,
            limit=payload.limit,
        )
    except ResumeNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Resume not found") from exc
    except JobMatchError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return JobMatchResponse.model_validate(data)


@router.get("/jobs", response_model=list[JobLite])
async def jobs_endpoint() -> list[JobLite]:
    return [JobLite.model_validate(j) for j in list_jobs()]
