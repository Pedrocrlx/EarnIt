"""Forgot password, step 1: request a reset code by email.

Anti-enumeration is the load-bearing constraint here — every response is
identical regardless of whether the email is registered, active, or not, so
the client can never tell which case it hit. Uses the stateless
verification-code primitive with purpose='password_reset'
(see app/services/verification/password_reset.py). Step 2 (validate code +
set new password) lives in reset_password.py.
"""

import logging

from fastapi import APIRouter, BackgroundTasks, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.database import get_session
from src.models.auth import User
from src.schemas.auth import ForgotPasswordRequest
from src.services.verification import core, password_reset

logger = logging.getLogger(__name__)

router = APIRouter(tags=["auth/recovery"])

_GENERIC_REQUEST_RESPONSE = {
    "status": "success",
    "message": "If that email is registered, a password reset code has been sent.",
}


@router.post("/forgot-password", summary="Request a password reset code")
async def forgot_password(
    body: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_session),
):
    """Send a password reset code to the supplied email address.

    Always returns the same success response regardless of whether the email is
    registered or the account is active — never reveals account existence. The code
    is sent in the background to keep response time constant. Continue with
    `POST /reset-password` to validate the code and set a new password.
    """
    result = await session.execute(select(User).where(User.email == str(body.email)))
    user = result.scalar_one_or_none()

    if user is not None and user.is_active:
        now = core.now()
        if password_reset.is_window_open(user, now):
            logger.info("Password reset rate-limited: user_id=%s", user.id)
            return JSONResponse(
                status_code=429,
                content={
                    "status": "error",
                    "message": (
                        "A password reset code is still active. "
                        "Please wait before requesting another."
                    ),
                    "retry_after_seconds": password_reset.seconds_until_resend(
                        user, now
                    ),
                },
            )
        await password_reset.rotate(user, session)
        background_tasks.add_task(password_reset.send_current_code, user)
        logger.info("Password reset requested: user_id=%s", user.id)

    return _GENERIC_REQUEST_RESPONSE
