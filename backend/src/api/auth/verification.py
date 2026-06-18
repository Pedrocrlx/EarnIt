"""Registration, step 2: redeem the account_verification code (and resend it).

Requires the pending_verification_token cookie issued by POST /auth/register
(see register.py) — enforced by the get_pending_verification_user dependency
(scope='verify'). On success, the pending cookie is swapped for a full
access_token session.
"""

import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Response
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.auth._shared import clear_pending_cookie, set_access_cookie
from src.db.database import get_session
from src.dependencies.auth import get_pending_verification_user
from src.models.auth import User
from src.schemas.auth import VerifyCodeRequest
from src.services.verification import core, flows

logger = logging.getLogger(__name__)

router = APIRouter(tags=["auth/verification"])


@router.post("/verify", summary="Verify email address")
async def verify_account(
    body: VerifyCodeRequest,
    response: Response,
    current_user: User = Depends(get_pending_verification_user),
    session: AsyncSession = Depends(get_session),
):
    """Redeem the email verification code sent by `/register`.

    Requires the `pending_verification_token` cookie. On success, swaps it for a
    full `access_token` session cookie (the account no longer matches the limbo-purge
    sweep). Returns 410 if the code window has expired — call `/verify/resend` to get
    a fresh code. Returns 400 for an incorrect code.
    """
    # Already-verified check comes first so the client gets a clear signal.
    if current_user.email_verified_at is not None:
        raise HTTPException(status_code=409, detail="Account already verified.")

    now = core.now()
    # Expiry is checked before the code itself so an expired window returns 410,
    # not a generic 400 — the client can then prompt a resend.
    if not flows.is_window_open(current_user, now):
        logger.info(
            "Account verification failed: code expired (user_id=%s)", current_user.id
        )
        raise HTTPException(status_code=410, detail="Verification code has expired.")

    if not flows.verify(current_user, core.PURPOSE_ACCOUNT, body.code):
        logger.warning(
            "Account verification failed: invalid code (user_id=%s)", current_user.id
        )
        raise HTTPException(status_code=400, detail="Invalid verification code.")

    # Stamping email_verified_at + bumping updated_at also moves the anchor, so the
    # just-used code can never be replayed.
    current_user.email_verified_at = now
    current_user.updated_at = now
    await session.commit()

    # Now verified, the account no longer matches the limbo-purge sweep — no
    # explicit defuse needed.
    logger.info("Account verified: user_id=%s", current_user.id)

    clear_pending_cookie(response)
    set_access_cookie(response, current_user.id)

    return {
        "status": "success",
        "message": "Account verified successfully.",
        "user": {
            "id": current_user.id,
            "email": current_user.email,
            "family_name": current_user.family_name,
            "email_verified_at": now,
            "onboarding_completed": current_user.onboarding_completed,
        },
    }


@router.post("/verify/resend", summary="Resend verification code")
async def resend_verification(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_pending_verification_user),
    session: AsyncSession = Depends(get_session),
):
    """Issue a new email verification code.

    Requires the `pending_verification_token` cookie. Rate-limited: can only be called
    once the previous code window has expired. Returns 429 with `retry_after_seconds`
    if a valid code is still active. Rotates the code anchor so the old code is
    immediately invalidated.
    """
    now = core.now()

    # Anti-spam: a fresh code can only be issued once the current window has closed.
    if flows.is_window_open(current_user, now):
        logger.info("Verification resend rate-limited: user_id=%s", current_user.id)
        return JSONResponse(
            status_code=429,
            content={
                "status": "error",
                "message": (
                    "A verification code is still active. "
                    "Please wait before requesting another."
                ),
                "retry_after_seconds": flows.seconds_until_resend(current_user, now),
            },
        )

    # Rotate the anchor synchronously (it's the source of truth), then email the
    # new code off the critical path.
    expires_at = await flows.rotate(current_user, session)
    background_tasks.add_task(flows.send_code, current_user, core.PURPOSE_ACCOUNT)
    logger.info("Verification code resent: user_id=%s", current_user.id)
    return {
        "status": "success",
        "message": "A new verification code has been sent.",
        "expires_at": expires_at,
    }
