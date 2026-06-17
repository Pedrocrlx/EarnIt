"""Parental PIN gate: set/update the PIN and verify it for the parent-dashboard switch.

The PIN is a UX-layer lock, not a privilege escalation — both endpoints require
an already-authenticated `access_token` session (see app/dependencies/auth.py).
Forgot/reset-PIN (email-based recovery) lives in pin_reset.py, not here.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.database import get_session
from src.dependencies.auth import get_current_user
from src.models.auth import User
from src.schemas.auth import PinRequest
from src.security.hashing import hash_secret, verify_secret
from src.services.accounts import maybe_complete_onboarding
from src.services.verification import core

logger = logging.getLogger(__name__)

router = APIRouter(tags=["auth/pin"])


@router.post("/pin", summary="Set or update the parental PIN")
async def set_pin(
    body: PinRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Create or replace the 4-digit parental PIN.

    Also serves as the PIN-update endpoint — no separate "change PIN" route exists.
    The PIN is used as a UX-layer gate for the parent dashboard (verified via
    `POST /verify-pin`). May complete the onboarding flow if ≥1 child profile already
    exists. Requires an active authenticated session.
    """
    # Upsert: this is also how the PIN is changed later, not just set during onboarding.
    current_user.parent_pin_hash = await hash_secret(body.pin)
    current_user.pin_set_at = core.now()
    await session.commit()

    # Re-check the onboarding trigger — this may be the second of the two
    # conditions (PIN + >=1 child) to become true.
    await maybe_complete_onboarding(current_user, session)

    logger.info("Parental PIN set: user_id=%s", current_user.id)
    return {"status": "success", "message": "Parental security PIN established."}


@router.post("/verify-pin", tags=["auth/pin"], summary="Verify the parental PIN")
async def verify_pin(
    body: PinRequest,
    current_user: User = Depends(get_current_user),
):
    """Confirm the parent's 4-digit PIN.

    Returns 200 if correct — the frontend uses this as a gate to render the parent
    dashboard. No new token or elevated scope is issued; access is controlled purely
    on the client side after a successful response. Returns 428 if no PIN has been
    set yet, 401 if the PIN is wrong.
    """
    if current_user.parent_pin_hash is None:
        raise HTTPException(status_code=428, detail="Parental PIN has not been set.")

    if not await verify_secret(body.pin, current_user.parent_pin_hash):
        logger.warning("PIN verification failed: user_id=%s", current_user.id)
        raise HTTPException(status_code=401, detail="Incorrect PIN.")

    # No new cookie/scope is issued — a 200 here is purely a green light for the
    # frontend to render the parent dashboard (see AGENTS.md §3, Dashboard Switching).
    logger.info("PIN verification successful: user_id=%s", current_user.id)
    return {"status": "success", "authenticated": True}
