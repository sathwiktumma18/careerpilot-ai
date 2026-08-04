from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.schemas.roadmap import RoadmapRequest, RoadmapResponse
from app.services.roadmap_service import generate_roadmap

router = APIRouter(prefix="/api", tags=["roadmap"])


@router.post("/roadmap", response_model=RoadmapResponse)
async def generate_roadmap_endpoint(
    payload: RoadmapRequest, db: Session = Depends(get_db)
) -> RoadmapResponse:
    return await generate_roadmap(
        db,
        resume_id=payload.resume_id,
        target_role=payload.target_role,
        horizon=payload.horizon,
    )
