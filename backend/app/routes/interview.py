from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.user import User
from app.schemas.interview import (
    InterviewFeedbackRequest,
    InterviewFeedbackResponse,
    InterviewStartRequest,
    InterviewStartResponse,
)
from app.services.auth_service import get_current_user
from app.services.interview_service import score_answer, start_session

router = APIRouter(prefix="/api/interview", tags=["interview"])


@router.post("/sessions", response_model=InterviewStartResponse)
async def start_session_endpoint(
    payload: InterviewStartRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> InterviewStartResponse:
    return await start_session(
        db,
        role=payload.role,
        difficulty=payload.difficulty,
        count=payload.count,
        resume_id=payload.resume_id,
        user_id=user.id,
    )


@router.post("/feedback", response_model=InterviewFeedbackResponse)
async def feedback_endpoint(
    payload: InterviewFeedbackRequest, user: User = Depends(get_current_user)
) -> InterviewFeedbackResponse:
    feedback = await score_answer(payload.session_id, payload.question_id, payload.answer)
    feedback.question_id = payload.question_id
    return feedback
