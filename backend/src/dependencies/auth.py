from uuid import UUID

import jwt
from fastapi import Cookie, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.database import get_session
from src.models.auth import User
from src.security.tokens import decode_token


def _extract_user_id(payload: dict) -> UUID:
    sub = payload.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Invalid token")
    try:
        return UUID(sub)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid token") from None


async def get_current_user(
    access_token: str | None = Cookie(default=None),
    session: AsyncSession = Depends(get_session),
) -> User:
    """FastAPI dependency for routes that require a full authenticated session.

    Decodes the access_token cookie, validates scope == "full", then confirms
    the users row still exists (401 if purged) and is_active is true (403 if disabled).
    """
    if access_token is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = decode_token(access_token)
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
    pending_verification_token: str | None = Cookie(default=None),
    session: AsyncSession = Depends(get_session),
) -> User:
    """FastAPI dependency for the verify and resend routes (scope == "verify" only)."""
    if pending_verification_token is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = decode_token(pending_verification_token)
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
    password_reset_token: str | None = Cookie(default=None),
    session: AsyncSession = Depends(get_session),
) -> User:
    """FastAPI dependency for the reset-password route (scope == "password_reset" only)."""
    if password_reset_token is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = decode_token(password_reset_token)
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token") from None
    if payload.get("scope") != "password_reset":
        raise HTTPException(status_code=401, detail="Invalid token scope")
    user_id = _extract_user_id(payload)
    user = await session.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=401)
    return user
