"""Forgot/reset parental PIN — email-based recovery for the PIN set in pin.py.

Reuses the stateless verification-code primitive with purpose='pin_reset'
(see app/services/verification/pin_reset.py). Unlike /auth/forgot-password,
the caller already holds a full access_token session, so there's no
anti-enumeration concern — failures are reported directly (429/410/400)
instead of being collapsed into a generic response.
"""

import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.database import get_session
from src.dependencies.auth import get_current_user
from src.models.auth import User
from src.schemas.auth import ResetPinRequest
from src.security.hashing import hash_secret
from src.services.accounts import maybe_complete_onboarding
from src.services.verification import core, pin_reset

logger = logging.getLogger(__name__)

router = APIRouter(tags=["auth/resets"])


@router.post("/forgot-pin")
async def forgot_pin(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    now = core.now()

    # Anti-spam: a fresh code can only be issued once the current window has closed.
    if pin_reset.is_window_open(current_user, now):
        logger.info("PIN reset rate-limited: user_id=%s", current_user.id)
        return JSONResponse(
            status_code=429,
            content={
                "status": "error",
                "message": (
                    "A PIN reset code is still active. Please wait before requesting another."
                ),
                "retry_after_seconds": pin_reset.seconds_until_resend(current_user, now),
            },
        )

    # Rotate the anchor synchronously (it's the source of truth), then email the
    # new code off the critical path.
    expires_at = await pin_reset.rotate(current_user, session)
    background_tasks.add_task(pin_reset.send_current_code, current_user)
    logger.info("PIN reset code requested: user_id=%s", current_user.id)
    return {
        "status": "success",
        "message": "A PIN reset code has been sent.",
        "expires_at": expires_at,
    }


@router.post("/reset-pin")
async def reset_pin(
    body: ResetPinRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    now = core.now()
    if not pin_reset.is_window_open(current_user, now):
        logger.info("PIN reset failed: code expired (user_id=%s)", current_user.id)
        raise HTTPException(status_code=410, detail="PIN reset code has expired.")

    if not pin_reset.verify(current_user, body.code):
        logger.warning("PIN reset failed: invalid code (user_id=%s)", current_user.id)
        raise HTTPException(status_code=400, detail="Invalid PIN reset code.")

    # Bumping updated_at moves the anchor, so the just-used code can never be replayed.
    current_user.parent_pin_hash = await hash_secret(body.new_pin)
    current_user.pin_set_at = now
    current_user.updated_at = now
    await session.commit()

    await maybe_complete_onboarding(current_user, session)

    logger.info("PIN reset completed: user_id=%s", current_user.id)
    return {"status": "success", "message": "PIN has been reset."}
