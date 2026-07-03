from pydantic import BaseModel, EmailStr


class ProfileResponse(BaseModel):
    name: str
    email: EmailStr
    plan: str
