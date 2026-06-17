"""Forgot password, step 3: set a new password.

Requires the password_reset_token cookie issued by
POST /auth/forgot-password/verify (see forgot_password.py) — enforced by the
get_password_reset_user dependency (scope='password_reset').
"""

import logging

from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.auth._shared import clear_password_reset_cookie
from src.db.database import get_session
from src.dependencies.auth import get_password_reset_user
from src.models.auth import User
from src.schemas.auth import ResetPasswordRequest
from src.security.hashing import hash_secret
from src.services.verification import core

logger = logging.getLogger(__name__)

router = APIRouter(tags=["auth/resets"])


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
    logger.info("Password reset completed: user_id=%s", current_user.id)
    return {"status": "success", "message": "Password has been reset."}
