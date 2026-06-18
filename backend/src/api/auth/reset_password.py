"""Forgot password, step 2: validate the reset code and set a new password.

Accepts { email, code, new_password } in a single call — the caller submits
the code they received by email alongside the new password on the same screen.
All failure cases (unknown email, expired window, wrong code) collapse to the
same generic 400 to prevent leaking account existence.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.database import get_session
from src.models.auth import User
from src.schemas.auth import ResetPasswordRequest
from src.security.hashing import hash_secret
from src.services.verification import core, flows

logger = logging.getLogger(__name__)

router = APIRouter(tags=["auth/recovery"])

_INVALID = "Invalid or expired code."


@router.post("/reset-password", summary="Set a new password")
async def reset_password(
    body: ResetPasswordRequest,
    session: AsyncSession = Depends(get_session),
):
    """Validate the password reset code and set a new password.

    Submit `email`, `code` (received by email after `POST /forgot-password`), and
    `new_password` together. All failure cases (unknown email, expired code, wrong
    code) return a generic 400 to prevent revealing account existence. The code is
    invalidated on success (anchor rotation prevents replay).
    """
    result = await session.execute(select(User).where(User.email == str(body.email)))
    user = result.scalar_one_or_none()

    # Every failure case collapses to the same 400 — distinct errors would leak
    # whether an account exists or whether a code was ever issued.
    now = core.now()
    if (
        user is None
        or not user.is_active
        or not flows.is_window_open(user, now)
        or not flows.verify(user, core.PURPOSE_PASSWORD_RESET, body.code)
    ):
        logger.warning(
            "Password reset failed: user_id=%s",
            user.id if user is not None else "unknown",
        )
        raise HTTPException(status_code=400, detail=_INVALID)

    # Bumping updated_at moves the anchor, so the just-used code can never be replayed.
    user.password_hash = await hash_secret(body.new_password)
    user.updated_at = now
    await session.commit()

    logger.info("Password reset completed: user_id=%s", user.id)
    return {"status": "success", "message": "Password has been reset."}
