from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.user import User
from app.schemas.job_match import JobLite, JobMatchRequest, JobMatchResponse
from app.services.auth_service import get_current_user
from app.services.job_match_service import JobMatchError, list_jobs, match_resume
from app.services.resume_service import ResumeNotFoundError
from app.services.seeker_service import record_activity

router = APIRouter(prefix="/api", tags=["job-match"])


@router.post("/match", response_model=JobMatchResponse)
async def match_endpoint(
    payload: JobMatchRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> JobMatchResponse:
    try:
        data = await match_resume(
            db,
            payload.resume_id,
            user_id=user.id,
            job_description=payload.job_description,
            remote_only=payload.remote_only,
            locations=payload.locations,
            limit=payload.limit,
        )
    except ResumeNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Resume not found") from exc
    except JobMatchError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    # Recruiter pool: this seeker is actively hunting — record it (role =
    # their resume's headline role for now; a dedicated target role field is
    # added with the JD-based analysis phase).
    record_activity(
        db,
        user_id=user.id,
        activity_type="job_searched",
        role=data.get("resume_title") or "Job search",
        detail="Job match",
    )
    return JobMatchResponse.model_validate(data)


@router.get("/jobs", response_model=list[JobLite])
async def jobs_endpoint(user: User = Depends(get_current_user)) -> list[JobLite]:
    return [JobLite.model_validate(j) for j in list_jobs()]
