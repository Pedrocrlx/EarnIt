"""Account lifecycle — limbo purge (periodic sweep) and onboarding completion.

An unverified ("limbo") account may exist for at most ``ACCOUNT_LIMBO_PURGE_HOURS``.
A periodic sweep deletes every account still unverified past that window in one
query; it rides the daily maintenance loop (see ``src.services.tasks.submissions``),
so there are no per-account timers, no in-memory registry, and nothing to re-arm
on restart — the next sweep cleans up whatever is overdue.
"""

import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.models.auth import Child, User

logger = logging.getLogger(__name__)


async def purge_expired_limbo_accounts(session: AsyncSession) -> int:
    """Delete accounts still unverified past the limbo window; return the count.

    The DB-level ``ON DELETE CASCADE`` removes any owned children. Idempotent —
    it only matches rows whose deadline has already passed.
    """
    cutoff = datetime.now(UTC) - timedelta(hours=settings.ACCOUNT_LIMBO_PURGE_HOURS)
    result = await session.execute(
        delete(User).where(User.email_verified_at.is_(None), User.created_at < cutoff)
    )
    await session.commit()
    if result.rowcount:
        logger.info("Purged %d expired limbo account(s)", result.rowcount)
    return result.rowcount


async def maybe_complete_onboarding(user: User, session: AsyncSession) -> None:
    """Flip ``onboarding_completed`` once the parent PIN is set and ≥1 child exists.

    One-way: never reverts once set.
    """
    if (
        user.onboarding_completed
        or user.parent_pin_hash is None
        or not user.family_name
    ):
        return
    count = await session.scalar(select(func.count()).where(Child.user_id == user.id))
    if count >= 1:
        user.onboarding_completed = True
        await session.commit()
        logger.info("Onboarding completed: user_id=%s", user.id)
