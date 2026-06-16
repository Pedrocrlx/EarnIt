"""Logout: drop the access_token cookie for an authenticated session.

Counterpart to login.py — see app/dependencies/auth.py for the session guard.
"""

import logging

from fastapi import APIRouter, Depends, Response

from src.dependencies.auth import get_current_user
from src.models.auth import User

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/logout")
async def logout(response: Response, current_user: User = Depends(get_current_user)):
    # get_current_user already enforces a valid, active session (401/403 otherwise),
    # so by this point we just need to drop the cookie. delete_cookie sets Max-Age=0,
    # which tells the browser to discard it immediately.
    response.delete_cookie(key="access_token", path="/")
    logger.info("Logout: user_id=%s", current_user.id)
    return {"status": "success", "message": "Logged out successfully."}
