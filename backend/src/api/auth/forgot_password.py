"""Forgot password, steps 1-2: request a reset code by email, then redeem it.

Anti-enumeration is the load-bearing constraint here — every response is
identical regardless of whether the email is registered, active, or not, so
the client can never tell which case it hit. Uses the stateless
verification-code primitive with purpose='password_reset'
(see app/services/verification/password_reset.py). Step 3 (set the new
password) lives in reset_password.py.
"""

import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.auth._shared import set_password_reset_cookie
from src.db.database import get_session
from src.models.auth import User
from src.schemas.auth import ForgotPasswordRequest, ResetPasswordVerifyRequest
from src.services.verification import core, password_reset

logger = logging.getLogger(__name__)

router = APIRouter()

_GENERIC_REQUEST_RESPONSE = {
    "status": "success",
    "message": "If that email is registered, a password reset code has been sent.",
}


@router.post("/forgot-password")
async def forgot_password(
    body: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(User).where(User.email == str(body.email)))
    user = result.scalar_one_or_none()

    # Same response regardless of whether the email is registered, active, or not —
    # never reveal account existence to the caller.
    if user is not None and user.is_active:
        await password_reset.rotate(user, session)
        background_tasks.add_task(password_reset.send_current_code, user)
        logger.info("Password reset requested: user_id=%s", user.id)

    return _GENERIC_REQUEST_RESPONSE


@router.post("/forgot-password/verify")
async def forgot_password_verify(
    body: ResetPasswordVerifyRequest,
    response: Response,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(User).where(User.email == str(body.email)))
    user = result.scalar_one_or_none()

    # Every failure case (unknown email, expired window, wrong code) collapses to the
    # same 400 — distinct outcomes here would leak account existence.
    if (
        user is None
        or not password_reset.is_window_open(user, core.now())
        or not password_reset.verify(user, body.code)
    ):
        logger.warning(
            "Password reset verify failed: user_id=%s", user.id if user is not None else "unknown"
        )
        raise HTTPException(status_code=400, detail="Invalid or expired code.")

    set_password_reset_cookie(response, user.id)
    logger.info("Password reset code verified: user_id=%s", user.id)
    return {"status": "success", "message": "Code verified. You can now set a new password."}
