"""Forgot password, step 3: set a new password.

Requires the password_reset_token cookie issued by
POST /auth/forgot-password/verify (see forgot_password.py) — enforced by the
get_password_reset_user dependency (scope='password_reset').
"""

from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.dependencies.auth import get_password_reset_user
from app.models.models import User
from app.routers.auth._shared import clear_password_reset_cookie
from app.schemas.auth import ResetPasswordRequest
from app.security.hashing import hash_secret
from app.services.verification import core

router = APIRouter()


@router.post("/reset-password")
async def reset_password(
    body: ResetPasswordRequest,
    response: Response,
    current_user: User = Depends(get_password_reset_user),
    session: AsyncSession = Depends(get_session),
):
    current_user.password_hash = await hash_secret(body.new_password)
    # Bumping updated_at moves the verification-code anchor, so the just-used
    # password_reset code can never be replayed.
    current_user.updated_at = core.now()
    await session.commit()

    clear_password_reset_cookie(response)
    return {"status": "success", "message": "Password has been reset."}
