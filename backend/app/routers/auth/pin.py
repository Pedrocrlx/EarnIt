from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.dependencies.auth import get_current_user
from app.models.models import User
from app.schemas.auth import PinRequest, ResetPinRequest
from app.security.hashing import hash_secret, verify_secret
from app.services.accounts import maybe_complete_onboarding
from app.services.verification import core, pin_reset

router = APIRouter()


@router.post("/pin")
async def set_pin(
    body: PinRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    current_user.parent_pin_hash = await hash_secret(body.pin)
    current_user.pin_set_at = core.now()
    await session.commit()

    await maybe_complete_onboarding(current_user, session)

    return {"status": "success", "message": "Parental security PIN established."}


@router.post("/verify-pin")
async def verify_pin(
    body: PinRequest,
    current_user: User = Depends(get_current_user),
):
    if current_user.parent_pin_hash is None:
        raise HTTPException(status_code=428, detail="Parental PIN has not been set.")

    if not await verify_secret(body.pin, current_user.parent_pin_hash):
        raise HTTPException(status_code=401, detail="Incorrect PIN.")

    return {"status": "success", "authenticated": True}


@router.post("/forgot-pin")
async def forgot_pin(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    now = core.now()

    # Anti-spam: a fresh code can only be issued once the current window has closed.
    if pin_reset.is_window_open(current_user, now):
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

    expires_at = await pin_reset.rotate(current_user, session)
    background_tasks.add_task(pin_reset.send_current_code, current_user)
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
        raise HTTPException(status_code=410, detail="PIN reset code has expired.")

    if not pin_reset.verify(current_user, body.code):
        raise HTTPException(status_code=400, detail="Invalid PIN reset code.")

    current_user.parent_pin_hash = await hash_secret(body.new_pin)
    current_user.pin_set_at = now
    current_user.updated_at = now
    await session.commit()

    await maybe_complete_onboarding(current_user, session)

    return {"status": "success", "message": "PIN has been reset."}
