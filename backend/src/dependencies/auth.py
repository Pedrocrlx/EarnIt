"""Auth dependencies — resolve the current user from a JWT for each request.

Provides two FastAPI dependencies: ``get_current_user`` (full session, used by
all protected routes) and ``get_pending_verification_user`` (the limited
verify/resend scope). Both accept the token from a Bearer header or the
matching HttpOnly cookie, and translate any failure into the right 401/403.
"""

from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.db.database import get_session
from src.dev.seed import DEV_USER_EMAIL
from src.models.auth import User
from src.security.tokens import decode_token

# auto_error=False: don't raise when no Bearer header is present — we fall back
# to the cookie instead so browser clients keep working unchanged. The side
# effect of declaring this here is that FastAPI auto-generates the bearerAuth
# security scheme in the OpenAPI spec, surfacing the "Authorize" button in
# Swagger UI so the API is fully testable without a browser.
_bearer = HTTPBearer(auto_error=False)


def _extract_user_id(payload: dict) -> UUID:
    """Pull the ``sub`` claim from a decoded token and parse it as a UUID.

    Raises 401 if the claim is missing or not a valid UUID — both indicate a
    malformed or tampered token rather than a merely expired one.
    """
    sub = payload.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Invalid token")
    try:
        return UUID(sub)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid token") from None


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    session: AsyncSession = Depends(get_session),
) -> User:
    """FastAPI dependency for routes that require a full authenticated session.

    Accepts the token from either:
    - Authorization: Bearer <token> header (Swagger / API clients)
    - access_token HttpOnly cookie (browser clients)

    Decodes the token, validates scope == "full", then confirms the users row
    still exists (401 if purged) and is_active is true (403 if disabled).

    When DISABLE_AUTH=true (dev only), skips all token checks and returns the
    seeded dev user directly.
    """
    if settings.DISABLE_AUTH:
        user = await session.scalar(select(User).where(User.email == DEV_USER_EMAIL))
        if user is None:
            raise HTTPException(status_code=500, detail="Dev user not seeded — restart with DISABLE_AUTH=true")
        return user

    token = credentials.credentials if credentials else request.cookies.get("access_token")
    if token is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = decode_token(token)
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token") from None
    if payload.get("scope") != "full":
        raise HTTPException(status_code=401, detail="Invalid token scope")
    user_id = _extract_user_id(payload)
    user = await session.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=401)
    if not user.is_active:
        raise HTTPException(
            status_code=403,
            detail={"error": "account_disabled", "message": "This account has been disabled."},
        )
    return user


async def get_pending_verification_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    session: AsyncSession = Depends(get_session),
) -> User:
    """FastAPI dependency for the verify and resend routes (scope == "verify" only)."""
    token = credentials.credentials if credentials else request.cookies.get("pending_verification_token")
    if token is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = decode_token(token)
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token") from None
    if payload.get("scope") != "verify":
        raise HTTPException(status_code=401, detail="Invalid token scope")
    user_id = _extract_user_id(payload)
    user = await session.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=401)
    return user

