from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.database import get_session
from src.models.auth import User
from src.security.tokens import decode_token

# auto_error=False: don't raise when no Bearer header is present — we fall back
# to the cookie instead so browser clients keep working unchanged. The side
# effect of declaring this here is that FastAPI auto-generates the bearerAuth
# security scheme in the OpenAPI spec, surfacing the "Authorize" button in
# Swagger UI so the API is fully testable without a browser.
_bearer = HTTPBearer(auto_error=False)


def _extract_user_id(payload: dict) -> UUID:
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
    """
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


async def get_password_reset_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    session: AsyncSession = Depends(get_session),
) -> User:
    """FastAPI dependency for the reset-password route (scope == "password_reset" only)."""
    token = credentials.credentials if credentials else request.cookies.get("password_reset_token")
    if token is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = decode_token(token)
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token") from None
    if payload.get("scope") != "password_reset":
        raise HTTPException(status_code=401, detail="Invalid token scope")
    user_id = _extract_user_id(payload)
    user = await session.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=401)
    return user
