"""Logout: drop the access_token cookie for an authenticated session.

Counterpart to login.py — see app/dependencies/auth.py for the session guard.
"""

import logging

from fastapi import APIRouter, Depends, Response

from src.dependencies.auth import get_current_user
from src.models.auth import User

logger = logging.getLogger(__name__)

router = APIRouter(tags=["auth/session"])


@router.post("/logout", summary="Log out")
async def logout(response: Response, current_user: User = Depends(get_current_user)):
    """End the current session.

    Expires the `access_token` cookie (sets `Max-Age=0`), immediately invalidating
    the session on the client. Requires an active authenticated session — returns 401
    if no valid token is present.
    """
    # get_current_user already enforces a valid, active session (401/403 otherwise),
    # so by this point we just need to drop the cookie. delete_cookie sets Max-Age=0,
    # which tells the browser to discard it immediately.
    response.delete_cookie(key="access_token", path="/")
    logger.info("Logout: user_id=%s", current_user.id)
    return {"status": "success", "message": "Logged out successfully."}
