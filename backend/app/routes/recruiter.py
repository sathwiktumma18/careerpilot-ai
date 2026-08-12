"""Recruiter-facing endpoints: the candidate pool and the recruiter directory.

`GET /api/recruiter/candidates` and the detail endpoint are recruiter-only
(403 for job seekers). `GET /api/recruiters` is any-logged-in-user — it powers
the "Recruiters" page job seekers use to find people to message.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.user import User
from app.schemas.recruiter import CandidateDetail, CandidateSummary, RecruiterLite
from app.services.auth_service import get_current_recruiter, get_current_user
from app.services.seeker_service import get_candidate, list_candidates, list_recruiters

router = APIRouter(prefix="/api", tags=["recruiter"])


@router.get("/recruiter/candidates", response_model=list[CandidateSummary])
def candidates(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_recruiter),
) -> list[CandidateSummary]:
    return [CandidateSummary(**c) for c in list_candidates(db)]


@router.get("/recruiter/candidates/{user_id}", response_model=CandidateDetail)
def candidate_detail(
    user_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_recruiter),
) -> CandidateDetail:
    detail = get_candidate(db, user_id, recruiter_id=user.id)
    if detail is None:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return CandidateDetail(**detail)


@router.get("/recruiters", response_model=list[RecruiterLite])
def recruiter_directory(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[RecruiterLite]:
    return [RecruiterLite(**r) for r in list_recruiters(db)]
