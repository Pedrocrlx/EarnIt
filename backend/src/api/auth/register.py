"""Registration: create a parent account in limbo and start email verification.

A new user starts with email_verified_at = NULL ("limbo") and a durable purge
task that deletes the row after ACCOUNT_LIMBO_PURGE_HOURS unless verified —
see verification.py for the next step and app/services/accounts.py for the
purge task itself.
"""

import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Response
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.auth._shared import set_pending_cookie
from src.db.database import get_session
from src.models.auth import User
from src.schemas.auth import RegisterRequest
from src.security.hashing import hash_secret
from src.services.accounts import schedule_limbo_purge
from src.services.verification import core, flows

logger = logging.getLogger(__name__)

router = APIRouter(tags=["auth/session"])


@router.post("/register", status_code=201, summary="Register a parent account")
async def register(
    body: RegisterRequest,
    response: Response,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_session),
):
    """Create a new parent account.

    The account starts unverified — a one-time 8-character code is emailed and must
    be redeemed via `POST /verify` before the account can be used. The account is
    automatically deleted if not verified within the configured window
    (`ACCOUNT_LIMBO_PURGE_HOURS`). Returns a `pending_verification_token` cookie
    required by the `/verify` and `/verify/resend` endpoints.
    """
    password_hash = await hash_secret(body.password)
    user = User(
        email=str(body.email),
        password_hash=password_hash,
        family_name=body.family_name,
    )
    session.add(user)
    try:
        # flush (not commit) so a duplicate email surfaces as a clean 409 here.
        await session.flush()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(
            status_code=409, detail="Email already registered."
        ) from None
    await session.commit()

    # The account flow derives the code from user.updated_at (its "anchor"); the
    # email is dispatched after the response so SMTP latency stays off the signup
    # path. Nothing is stored — /verify recomputes and compares.
    background_tasks.add_task(flows.send_code, user, core.PURPOSE_ACCOUNT)
    set_pending_cookie(response, user.id)

    # Arm the durable limbo purge: a background task deletes this account once its
    # window elapses, unless verification defuses it first. Re-armed on restart
    # from users.created_at (see app/services/accounts.py).
    schedule_limbo_purge(user)

    logger.info("New account registered: user_id=%s", user.id)

    return {
        "status": "pending_verification",
        "message": "Account created. Check your email for a verification code.",
        "user": {
            "id": user.id,
            "email": user.email,
            "family_name": user.family_name,
            "email_verified_at": user.email_verified_at,
            "onboarding_completed": user.onboarding_completed,
        },
        "verification": {"expires_at": flows.expires_at(user)},
    }
