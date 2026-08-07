"""PortfolioAI routes.

`GET /api/public/portfolio/{slug}` is deliberately **unauthenticated** — that's
the whole point of a shareable page. `GET /api/portfolio/me` is the logged-in
manager endpoint that hands the app its public path.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.user import User
from app.schemas.portfolio import MyPortfolioResponse, PublicPortfolioResponse
from app.services.auth_service import get_current_user
from app.services.portfolio_service import (
    build_public_portfolio,
    derive_slug,
    get_user_by_slug,
)

router = APIRouter(prefix="/api", tags=["portfolio"])


@router.get("/public/portfolio/{slug}", response_model=PublicPortfolioResponse)
async def get_public_portfolio(
    slug: str,
    db: Session = Depends(get_db),
) -> PublicPortfolioResponse:
    user = get_user_by_slug(db, slug)
    if user is None:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    return build_public_portfolio(db, user)


@router.get("/portfolio/me", response_model=MyPortfolioResponse)
async def get_my_portfolio(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> MyPortfolioResponse:
    slug = derive_slug(db, user)
    return MyPortfolioResponse(slug=slug, path=f"/p/{slug}")
