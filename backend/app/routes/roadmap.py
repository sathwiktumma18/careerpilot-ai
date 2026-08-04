from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.user import User
from app.schemas.roadmap import RoadmapRequest, RoadmapResponse
from app.services.auth_service import get_current_user
from app.services.roadmap_service import generate_roadmap

router = APIRouter(prefix="/api", tags=["roadmap"])


@router.post("/roadmap", response_model=RoadmapResponse)
async def generate_roadmap_endpoint(
    payload: RoadmapRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> RoadmapResponse:
    return await generate_roadmap(
        db,
        resume_id=payload.resume_id,
        target_role=payload.target_role,
        horizon=payload.horizon,
        user_id=user.id,
    )
