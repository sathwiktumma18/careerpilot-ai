from fastapi import APIRouter

from app.schemas.profile import ProfileResponse

router = APIRouter(prefix="", tags=["profile"])


@router.get("/profile", response_model=ProfileResponse)
async def get_profile() -> ProfileResponse:
    return ProfileResponse(name="Alex Morgan", email="alex.morgan@example.com", plan="Pro")
