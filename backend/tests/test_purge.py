import asyncio
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

import src.db.database as app_database
from src.core.config import settings
from src.models.auth import User
from src.services import accounts


def _now() -> datetime:
    return datetime.now(UTC)


async def _fetch(user_id) -> User | None:
    # The purge task commits via its own session; read back through a fresh one so
    # we see the committed state rather than db_session's identity-map snapshot.
    # Looked up via the module attribute (not imported by name) so this respects
    # conftest's test-database AsyncSessionLocal override.
    async with app_database.AsyncSessionLocal() as session:
        return await session.get(User, user_id)


def _make_user(*, verified: bool = False, created_hours_ago: float = 0) -> User:
    return User(
        id=uuid4(),
        email=f"test-{uuid4()}@example.com",
        password_hash="hash",
        email_verified_at=_now() if verified else None,
        created_at=_now() - timedelta(hours=created_hours_ago),
        updated_at=_now(),
    )


async def _add(session: AsyncSession, *objects) -> None:
    for obj in objects:
        session.add(obj)
    await session.commit()


# ---------------------------------------------------------------------------
# Limbo purge — durable background "promise" (app/services/accounts.py)
#
# Each registration arms a task that deletes the account once its window elapses,
# unless verification defuses it. The deadline is derived from users.created_at,
# so the work is restart-safe (re-armed on startup).
# ---------------------------------------------------------------------------


async def test_discard_removes_unverified_account(db_session: AsyncSession):
    user = _make_user(verified=False)
    await _add(db_session, user)

    deleted = await accounts._discard_if_unverified(db_session, user.id)

    assert deleted is True
    assert await db_session.get(User, user.id) is None


async def test_discard_keeps_verified_account_defused(db_session: AsyncSession):
    # Verification stamped email_verified_at before the task fired → no-op.
    user = _make_user(verified=True)
    await _add(db_session, user)

    deleted = await accounts._discard_if_unverified(db_session, user.id)

    assert deleted is False
    assert await db_session.get(User, user.id) is not None


async def test_discard_missing_account_is_noop(db_session: AsyncSession):
    deleted = await accounts._discard_if_unverified(db_session, uuid4())
    assert deleted is False


async def test_purge_task_deletes_account_past_deadline(db_session: AsyncSession):
    # created_hours_ago > window → deadline already in the past →
    # no sleep, immediate delete.
    user = _make_user(
        verified=False, created_hours_ago=settings.ACCOUNT_LIMBO_PURGE_HOURS + 1
    )
    await _add(db_session, user)

    await accounts._purge_after_limbo(
        user.id, accounts._limbo_deadline(user.created_at)
    )

    assert await _fetch(user.id) is None


async def test_purge_task_skips_verified_account_past_deadline(
    db_session: AsyncSession,
):
    user = _make_user(
        verified=True, created_hours_ago=settings.ACCOUNT_LIMBO_PURGE_HOURS + 1
    )
    await _add(db_session, user)

    await accounts._purge_after_limbo(
        user.id, accounts._limbo_deadline(user.created_at)
    )

    assert await _fetch(user.id) is not None


async def test_rearm_pending_purges_schedules_limbo_accounts_only(
    db_session: AsyncSession,
):
    # Past its deadline already, so the rearmed task fires (and deletes) immediately.
    limbo_user = _make_user(
        verified=False, created_hours_ago=settings.ACCOUNT_LIMBO_PURGE_HOURS + 1
    )
    verified_user = _make_user(
        verified=True, created_hours_ago=settings.ACCOUNT_LIMBO_PURGE_HOURS + 1
    )
    await _add(db_session, limbo_user, verified_user)

    await accounts.rearm_pending_purges()
    assert limbo_user.id in accounts._pending
    await asyncio.gather(*accounts._pending.values(), return_exceptions=True)

    assert await _fetch(limbo_user.id) is None
    assert await _fetch(verified_user.id) is not None
