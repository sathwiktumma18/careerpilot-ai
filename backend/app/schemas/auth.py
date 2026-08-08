from typing import Literal

from pydantic import BaseModel, EmailStr, Field

Role = Literal["job_seeker", "recruiter"]


class RegisterRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: Role = "job_seeker"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ForgotPasswordResponse(BaseModel):
    # Present when the email belongs to a real account; None otherwise. The
    # endpoint answers 200 in both cases so callers can't enumerate accounts.
    reset_token: str | None = None


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    token: str
    new_password: str = Field(min_length=8, max_length=128)


class UserOut(BaseModel):
    id: str
    email: EmailStr
    name: str
    role: Role = "job_seeker"


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
