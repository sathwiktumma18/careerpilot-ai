from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class ProfileUpdate(BaseModel):
    """Editable account fields. Every field optional — PATCH semantics.

    `name` lives on `users`; the rest live on the 1:1 `profiles` row. `email`
    is deliberately absent: it's the login identity and the OAuth match key.
    `avatar: "clear"` removes the profile photo (deletes the stored file).
    """

    avatar: Literal["clear"] | None = None
    name: str | None = Field(default=None, min_length=1, max_length=80)
    headline: str | None = Field(default=None, max_length=120)
    location: str | None = Field(default=None, max_length=80)
    bio: str | None = Field(default=None, max_length=400)
    years_experience: int | None = Field(default=None, ge=0, le=60)
    linkedin_url: str | None = Field(default=None, max_length=300)
    github_url: str | None = Field(default=None, max_length=300)
    portfolio_url: str | None = Field(default=None, max_length=300)
    # Recruiter-only identity (feeds the recruiter portfolio).
    company: str | None = Field(default=None, max_length=120)
    company_role: str | None = Field(default=None, max_length=120)


class ProfileResponse(BaseModel):
    user_id: str
    name: str
    email: EmailStr
    role: str
    plan: str = "Free"  # backend has no billing model yet — every user is Free
    avatar_url: str | None = None
    headline: str | None = None
    location: str | None = None
    bio: str | None = None
    years_experience: int | None = None
    linkedin_url: str | None = None
    github_url: str | None = None
    portfolio_url: str | None = None
    company: str | None = None
    company_role: str | None = None
