from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


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


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
