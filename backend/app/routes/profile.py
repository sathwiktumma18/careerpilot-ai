from fastapi import APIRouter, Depends

from app.models.user import User
from app.schemas.profile import ProfileResponse
from app.services.auth_service import get_current_user

router = APIRouter(prefix="", tags=["profile"])


@router.get("/profile", response_model=ProfileResponse)
async def get_profile(user: User = Depends(get_current_user)) -> ProfileResponse:
    # Backend has no plan/billing model yet — every authenticated user is Free.
    return ProfileResponse(name=user.name, email=user.email, plan="Free")
