from datetime import datetime, timedelta, timezone
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.jobs.purge import run_purge
from app.models.models import EmailVerification, User


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _make_user(*, verified: bool = False, created_hours_ago: float = 0) -> User:
    return User(
        id=uuid4(),
        email=f"test-{uuid4()}@example.com",
        password_hash="hash",
        email_verified_at=_now() if verified else None,
        created_at=_now() - timedelta(hours=created_hours_ago),
        updated_at=_now(),
    )


def _make_code(
    user_id,
    *,
    expired: bool = False,
    consumed: bool = False,
    minutes_ago: float = 0,
) -> EmailVerification:
    expiry_offset = -1 if expired else settings.VERIFICATION_CODE_EXPIRY_ACCOUNT_MINUTES
    return EmailVerification(
        id=uuid4(),
        user_id=user_id,
        purpose="account_verification",
        code_hash="hash",
        expires_at=_now() + timedelta(minutes=expiry_offset),
        consumed_at=_now() - timedelta(minutes=minutes_ago) if consumed else None,
        created_at=_now() - timedelta(minutes=minutes_ago),
    )


async def _add(session: AsyncSession, *objects) -> None:
    for obj in objects:
        session.add(obj)
    await session.commit()


# ---------------------------------------------------------------------------
# Limbo user sweep
# ---------------------------------------------------------------------------


async def test_purge_deletes_unverified_users_past_window(db_session: AsyncSession):
    stale = _make_user(verified=False, created_hours_ago=settings.ACCOUNT_LIMBO_PURGE_HOURS + 1)
    await _add(db_session, stale)

    await run_purge(db_session)

    result = await db_session.get(User, stale.id)
    assert result is None


async def test_purge_keeps_unverified_users_within_window(db_session: AsyncSession):
    fresh = _make_user(verified=False, created_hours_ago=settings.ACCOUNT_LIMBO_PURGE_HOURS - 1)
    await _add(db_session, fresh)

    await run_purge(db_session)

    result = await db_session.get(User, fresh.id)
    assert result is not None


async def test_purge_keeps_verified_users_regardless_of_age(db_session: AsyncSession):
    old_verified = _make_user(
        verified=True, created_hours_ago=settings.ACCOUNT_LIMBO_PURGE_HOURS + 48
    )
    await _add(db_session, old_verified)

    await run_purge(db_session)

    result = await db_session.get(User, old_verified.id)
    assert result is not None


# ---------------------------------------------------------------------------
# Orphaned verification code sweep
# ---------------------------------------------------------------------------


async def test_purge_deletes_expired_unconsumed_codes(db_session: AsyncSession):
    user = _make_user(verified=True)
    await _add(db_session, user)

    stale_code = _make_code(user.id, expired=True, consumed=False)
    await _add(db_session, stale_code)

    await run_purge(db_session)

    result = await db_session.get(EmailVerification, stale_code.id)
    assert result is None


async def test_purge_keeps_live_unconsumed_codes(db_session: AsyncSession):
    user = _make_user(verified=True)
    await _add(db_session, user)

    live_code = _make_code(user.id, expired=False, consumed=False)
    await _add(db_session, live_code)

    await run_purge(db_session)

    result = await db_session.get(EmailVerification, live_code.id)
    assert result is not None


async def test_purge_keeps_consumed_codes_as_audit_trail(db_session: AsyncSession):
    user = _make_user(verified=True)
    await _add(db_session, user)

    consumed_code = _make_code(user.id, expired=True, consumed=True, minutes_ago=30)
    await _add(db_session, consumed_code)

    await run_purge(db_session)

    result = await db_session.get(EmailVerification, consumed_code.id)
    assert result is not None


async def test_purge_cascades_codes_when_limbo_user_deleted(db_session: AsyncSession):
    stale_user = _make_user(
        verified=False, created_hours_ago=settings.ACCOUNT_LIMBO_PURGE_HOURS + 1
    )
    await _add(db_session, stale_user)

    code = _make_code(stale_user.id, expired=False)
    await _add(db_session, code)

    # Capture IDs before expiry — accessing attributes on expired ORM objects
    # outside an async context triggers MissingGreenlet.
    stale_user_id = stale_user.id
    code_id = code.id

    await run_purge(db_session)
    # PostgreSQL CASCADE removes the code at the DB level; SQLAlchemy's identity
    # map doesn't track that — expire_all forces a fresh DB read on next access.
    db_session.expire_all()

    assert await db_session.get(User, stale_user_id) is None
    assert await db_session.get(EmailVerification, code_id) is None
