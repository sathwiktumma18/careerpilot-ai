"""Account settings — the real, backend-persisted profile for both roles.

`GET/PATCH /api/profile` and `POST /api/profile/avatar` are authenticated and
back the Account settings page. `GET /api/public/avatar/{user_id}` is
deliberately **unauthenticated** (like the public portfolio) so `<img>` tags in
messages, candidate lists, and portfolios can render a photo without a token.
"""
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config.settings import settings
from app.database.session import get_db
from app.models.profile import Profile
from app.models.user import User
from app.schemas.profile import ProfileResponse, ProfileUpdate
from app.services.auth_service import get_current_user
from app.services.profile_service import apply_update, set_avatar, to_response

router = APIRouter(prefix="/api", tags=["profile"])


class AvatarUploadResponse(BaseModel):
    avatar_url: str | None = None


# content_type → file extension. Only raster images browsers can render as an
# `<img>` avatar; SVGs are rejected (they can smuggle scripts on the public page).
_IMAGE_EXTS = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
}

_AVATAR_MEDIA = {
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "webp": "image/webp",
    "gif": "image/gif",
}


@router.get("/profile", response_model=ProfileResponse)
async def get_profile(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ProfileResponse:
    return to_response(db, user)


@router.patch("/profile", response_model=ProfileResponse)
async def update_profile(
    update: ProfileUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ProfileResponse:
    return apply_update(db, user, update)


@router.post("/profile/avatar", response_model=AvatarUploadResponse)
async def upload_avatar(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AvatarUploadResponse:
    ext = _IMAGE_EXTS.get((file.content_type or "").lower())
    if ext is None:
        raise HTTPException(
            status_code=400,
            detail="Only PNG, JPEG, WebP or GIF images are supported",
        )
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(data) > settings.avatar_max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"Image too large — max {settings.avatar_max_bytes // (1024 * 1024)} MB",
        )

    avatar_dir = Path(settings.avatar_dir)
    avatar_dir.mkdir(parents=True, exist_ok=True)

    # Remove the previous photo (whichever extension it was).
    profile = db.get(Profile, user.id)
    if profile and profile.avatar_path:
        (avatar_dir / profile.avatar_path).unlink(missing_ok=True)

    file_name = f"{user.id}.{ext}"
    (avatar_dir / file_name).write_bytes(data)
    url = set_avatar(db, user, file_name)
    return AvatarUploadResponse(avatar_url=url)


@router.get("/public/avatar/{user_id}")
async def public_avatar(user_id: str, db: Session = Depends(get_db)) -> FileResponse:
    profile = db.get(Profile, user_id)
    if profile is None or not profile.avatar_path:
        raise HTTPException(status_code=404, detail="No avatar")
    path = Path(settings.avatar_dir) / profile.avatar_path
    if not path.is_file():
        raise HTTPException(status_code=404, detail="No avatar")
    media_type = _AVATAR_MEDIA.get(path.suffix.lstrip(".").lower(), "application/octet-stream")
    return FileResponse(
        path,
        media_type=media_type,
        headers={"Cache-Control": "public, max-age=3600"},
    )
