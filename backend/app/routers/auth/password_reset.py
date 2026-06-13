from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.dependencies.auth import get_password_reset_user
from app.models.models import User
from app.routers.auth._shared import clear_password_reset_cookie, set_password_reset_cookie
from app.schemas.auth import ForgotPasswordRequest, ResetPasswordRequest, ResetPasswordVerifyRequest
from app.security.hashing import hash_secret
from app.services.verification import core, password_reset

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
        raise HTTPException(status_code=400, detail="Invalid or expired code.")

    set_password_reset_cookie(response, user.id)
    return {"status": "success", "message": "Code verified. You can now set a new password."}


@router.post("/reset-password")
async def reset_password(
    body: ResetPasswordRequest,
    response: Response,
    current_user: User = Depends(get_password_reset_user),
    session: AsyncSession = Depends(get_session),
):
    current_user.password_hash = await hash_secret(body.new_password)
    current_user.updated_at = core.now()
    await session.commit()

    clear_password_reset_cookie(response)
    return {"status": "success", "message": "Password has been reset."}
