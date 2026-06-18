"""Account lifecycle — limbo purge as self-disarming background "promises".

An unverified ("limbo") account may exist for at most ``ACCOUNT_LIMBO_PURGE_HOURS``.
Rather than a periodic scheduler, each registration arms a background task that
sleeps until *that account's* deadline and then deletes it — unless the account
was verified in the meantime, which "defuses" the purge (the fire-time re-check
sees ``email_verified_at`` set and does nothing).

Durability: the task holds no irreplaceable state. Each deadline is derived from
``users.created_at`` (persisted), so on startup :func:`rearm_pending_purges`
reconstructs a task for every still-unverified account — pending purges survive a
restart. Accounts already past their deadline are deleted on the next tick.
"""

import asyncio
import logging
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.db.database import AsyncSessionLocal
from src.models.auth import Child, User

logger = logging.getLogger(__name__)

# Strong references to in-flight tasks, keyed by user id. asyncio keeps only weak
# refs, so without this a task can be garbage-collected mid-sleep. Keying by user
# lets verification cancel a specific account's purge. Entries cleared on done.
_pending: dict[UUID, asyncio.Task] = {}


def _limbo_deadline(created_at: datetime) -> datetime:
    return created_at + timedelta(hours=settings.ACCOUNT_LIMBO_PURGE_HOURS)


async def _discard_if_unverified(session: AsyncSession, user_id: UUID) -> bool:
    """Delete the account iff it still exists and is unverified.

    Returns True if deleted, False if it was already gone or had been verified
    (i.e. the purge was defused). CASCADE removes any owned children rows.
    """
    user = await session.get(User, user_id)
    if user is None or user.email_verified_at is not None:
        return False
    await session.delete(user)
    await session.commit()
    logger.info("Limbo account purged: user_id=%s", user_id)
    return True


async def _purge_after_limbo(user_id: UUID, deadline: datetime) -> None:
    remaining = (deadline - datetime.now(UTC)).total_seconds()
    if remaining > 0:
        await asyncio.sleep(remaining)
    async with AsyncSessionLocal() as session:
        await _discard_if_unverified(session, user_id)


def schedule_limbo_purge(user: User) -> None:
    """Arm the background purge for a freshly-registered (or re-armed) account."""
    task = asyncio.create_task(
        _purge_after_limbo(user.id, _limbo_deadline(user.created_at))
    )
    _pending[user.id] = task
    task.add_done_callback(lambda _t, uid=user.id: _pending.pop(uid, None))


def cancel_limbo_purge(user_id: UUID) -> None:
    """Defuse a verified account's purge immediately, instead of leaving the task
    asleep until its deadline only to no-op. The fire-time check in
    ``_discard_if_unverified`` remains the durable backstop for tasks that were
    re-armed in another worker process (where this registry is empty)."""
    task = _pending.pop(user_id, None)
    if task is not None:
        task.cancel()


async def rearm_pending_purges() -> None:
    """Startup hook: reconstruct a purge task for every still-unverified account so
    pending promises survive a restart. Accounts already past their deadline are
    deleted on the next tick (remaining <= 0 → no sleep)."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(User).where(User.email_verified_at.is_(None))
        )
        limbo_users = result.scalars().all()
    for user in limbo_users:
        schedule_limbo_purge(user)
    if limbo_users:
        logger.info("Re-armed %d pending limbo purge(s)", len(limbo_users))


async def cancel_pending_purges() -> None:
    """Cancel all in-flight purge tasks (shutdown / test teardown)."""
    tasks = list(_pending.values())
    for task in tasks:
        task.cancel()
    await asyncio.gather(*tasks, return_exceptions=True)
    _pending.clear()


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
    if count >= settings.MIN_CHILDREN_FOR_ONBOARDING:
        user.onboarding_completed = True
        await session.commit()
        logger.info("Onboarding completed: user_id=%s", user.id)
