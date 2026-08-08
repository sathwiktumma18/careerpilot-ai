from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.user import User
from app.schemas.auth import (
    AuthResponse,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    RegisterRequest,
    ResetPasswordRequest,
    UserOut,
)
from app.services.auth_service import (
    EmailTakenError,
    InvalidCredentialsError,
    InvalidResetTokenError,
    authenticate_user,
    get_current_user,
    issue_password_reset,
    register_user,
    reset_password as reset_user_password,
    to_auth_response,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=AuthResponse, status_code=201)
def register(
    payload: RegisterRequest, db: Session = Depends(get_db)
) -> AuthResponse:
    try:
        user = register_user(
            db,
            name=payload.name,
            email=payload.email,
            password=payload.password,
            role=payload.role,
        )
    except EmailTakenError:
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    return to_auth_response(user)


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> AuthResponse:
    try:
        user = authenticate_user(db, email=payload.email, password=payload.password)
    except InvalidCredentialsError:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return to_auth_response(user)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> UserOut:
    return UserOut(id=user.id, email=user.email, name=user.name, role=user.role)


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
def forgot_password(
    payload: ForgotPasswordRequest, db: Session = Depends(get_db)
) -> ForgotPasswordResponse:
    # Always 200. The token is surfaced in the response (demo reset flow); for a
    # production deploy you'd email it instead.
    token = issue_password_reset(db, email=payload.email)
    return ForgotPasswordResponse(reset_token=token)


@router.post("/reset-password", response_model=dict[str, str])
def reset_password(
    payload: ResetPasswordRequest, db: Session = Depends(get_db)
) -> dict[str, str]:
    try:
        reset_user_password(
            db, email=payload.email, token=payload.token, new_password=payload.new_password
        )
    except InvalidResetTokenError:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    return {"detail": "Password reset successful"}