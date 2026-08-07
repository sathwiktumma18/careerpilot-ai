from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.config.settings import settings
from app.database.session import get_db
from app.services import oauth_service
from app.services.oauth_service import (
    OAuthEmailTakenError,
    OAuthNotConfiguredError,
    OAuthProviderError,
    OAuthStateError,
    build_authorize_url,
    exchange_and_login,
)

router = APIRouter(prefix="/api/auth/oauth", tags=["auth"])

# Where the browser lands after the provider redirects back. Derived from the
# first CORS origin so prod just reconfigures CORS.
FRONTEND_ORIGIN = settings.cors_origins[0]


@router.get("/{provider}/authorize")
async def oauth_authorize(provider: str) -> dict[str, str]:
    """URL to send the user to. 501 when the provider isn't configured."""
    try:
        url = build_authorize_url(provider)
    except OAuthNotConfiguredError:
        raise HTTPException(
            status_code=501,
            detail=f"{provider} sign-in is not configured on this server",
        )
    except OAuthStateError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"url": url, "available": "true"}


@router.get("/{provider}/callback")
async def oauth_callback(
    provider: str,
    code: str = Query(default=""),
    state: str = Query(default=""),
    error: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> RedirectResponse:
    """Provider → this endpoint → browser to the frontend with a session token."""
    if error:
        return _redirect(error="access_denied")
    if not code or not state:
        return _redirect(error="invalid_state")
    try:
        auth = exchange_and_login(db, provider=provider, code=code, state=state)
    except OAuthStateError:
        return _redirect(error="invalid_state")
    except OAuthProviderError:
        return _redirect(error="provider")
    except OAuthEmailTakenError:
        return _redirect(error="email_taken")
    return _redirect(token=auth.access_token)


def _redirect(*, token: str | None = None, error: str | None = None) -> RedirectResponse:
    if token:
        url = f"{FRONTEND_ORIGIN}/auth/oauth/callback?token={token}"
    else:
        url = f"{FRONTEND_ORIGIN}/auth/oauth/callback?error={error}"
    return RedirectResponse(url=url, status_code=302)
