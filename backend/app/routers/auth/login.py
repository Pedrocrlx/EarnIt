"""Login: exchange email/password for a full access_token session.

Designed to resist user-enumeration via response content or timing — see the
inline comments on _DUMMY_PASSWORD_HASH and the is_active/email_verified_at
ordering below. Logout lives in logout.py.
"""

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models.models import User
from app.routers.auth._shared import set_access_cookie, set_pending_cookie
from app.schemas.auth import LoginRequest
from app.security.hashing import verify_secret
from app.services.verification import account

router = APIRouter()

# A throwaway hash with the same bcrypt cost as a real one. When the email isn't
# registered we still run one verify against this, so the response time doesn't
# reveal whether the account exists (no user-enumeration timing oracle).
_DUMMY_PASSWORD_HASH = bcrypt.hashpw(b"timing-equalizer", bcrypt.gensalt()).decode()


@router.post("/login")
async def login(
    body: LoginRequest, response: Response, session: AsyncSession = Depends(get_session)
):
    # Look up the account by email. If it doesn't exist, fall through to the same
    # 401 as a wrong password — never reveal whether an email is registered.
    result = await session.execute(select(User).where(User.email == str(body.email)))
    user = result.scalar_one_or_none()

    # Always run exactly one bcrypt verify — against the real hash, or a dummy of
    # equal cost when the email is unknown — so timing can't distinguish the two.
    password_hash = user.password_hash if user is not None else _DUMMY_PASSWORD_HASH
    password_ok = await verify_secret(body.password, password_hash)
    if user is None or not password_ok:
        raise HTTPException(status_code=401, detail="Invalid login credentials.")

    # is_active is checked before email_verified_at — a disabled-and-unverified
    # account always reports account_disabled, never account_unverified.
    if not user.is_active:
        raise HTTPException(
            status_code=403,
            detail={"error": "account_disabled", "message": "This account has been disabled."},
        )

    if user.email_verified_at is None:
        # Credentials are correct, but the account is still in "limbo": deny the full
        # session and instead send the client back through the verification flow with
        # a fresh pending_verification_token (the old one may have expired).
        expires_at = await account.ensure_active(user, session)
        unverified_response = JSONResponse(
            status_code=403,
            content={
                "error": "account_unverified",
                "message": "Please verify your account before continuing.",
                "verification": {"expires_at": expires_at.isoformat()},
            },
        )
        set_pending_cookie(unverified_response, user.id)
        return unverified_response

    # Active, verified account with correct credentials — issue the full session cookie.
    set_access_cookie(response, user.id)
    return {"status": "success", "message": "Authentication successful."}
