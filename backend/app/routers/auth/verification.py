"""Registration, step 2: redeem the account_verification code (and resend it).

Requires the pending_verification_token cookie issued by POST /auth/register
(see register.py) — enforced by the get_pending_verification_user dependency
(scope='verify'). On success, the pending cookie is swapped for a full
access_token session.
"""

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Response
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.dependencies.auth import get_pending_verification_user
from app.models.models import User
from app.routers.auth._shared import clear_pending_cookie, set_access_cookie
from app.schemas.auth import VerifyCodeRequest
from app.services.accounts import cancel_limbo_purge
from app.services.verification import account, core

router = APIRouter()


@router.post("/verify")
async def verify_account(
    body: VerifyCodeRequest,
    response: Response,
    current_user: User = Depends(get_pending_verification_user),
    session: AsyncSession = Depends(get_session),
):
    # Already-verified check comes first so the client gets a clear signal.
    if current_user.email_verified_at is not None:
        raise HTTPException(status_code=409, detail="Account already verified.")

    now = core.now()
    # Expiry is checked before the code itself so an expired window returns 410,
    # not a generic 400 — the client can then prompt a resend.
    if not account.is_window_open(current_user, now):
        raise HTTPException(status_code=410, detail="Verification code has expired.")

    if not account.verify(current_user, body.code):
        raise HTTPException(status_code=400, detail="Invalid verification code.")

    # Stamping email_verified_at + bumping updated_at also moves the anchor, so the
    # just-used code can never be replayed.
    current_user.email_verified_at = now
    current_user.updated_at = now
    await session.commit()

    # Account is verified — defuse its limbo purge now rather than leaving the task
    # asleep until its deadline just to no-op.
    cancel_limbo_purge(current_user.id)

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


@router.post("/verify/resend")
async def resend_verification(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_pending_verification_user),
    session: AsyncSession = Depends(get_session),
):
    now = core.now()

    # Anti-spam: a fresh code can only be issued once the current window has closed.
    if account.is_window_open(current_user, now):
        return JSONResponse(
            status_code=429,
            content={
                "status": "error",
                "message": (
                    "A verification code is still active. Please wait before requesting another."
                ),
                "retry_after_seconds": account.seconds_until_resend(current_user, now),
            },
        )

    # Rotate the anchor synchronously (it's the source of truth), then email the
    # new code off the critical path.
    expires_at = await account.rotate(current_user, session)
    background_tasks.add_task(account.send_current_code, current_user)
    return {
        "status": "success",
        "message": "A new verification code has been sent.",
        "expires_at": expires_at,
    }
