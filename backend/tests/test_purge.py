from datetime import UTC, datetime, timedelta
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.models.auth import Child, User
from src.services import accounts


def _now() -> datetime:
    return datetime.now(UTC)


def _make_user(*, verified: bool = False, created_hours_ago: float = 0) -> User:
    return User(
        id=uuid4(),
        email=f"test-{uuid4()}@example.com",
        password_hash="hash",
        email_verified_at=_now() if verified else None,
        created_at=_now() - timedelta(hours=created_hours_ago),
        updated_at=_now(),
    )


# Limbo purge — periodic sweep (app/services/accounts.purge_expired_limbo_accounts)
# One DELETE removes every account still unverified past ACCOUNT_LIMBO_PURGE_HOURS;
# verified accounts and not-yet-expired ones are left alone.

async def test_purge_deletes_unverified_past_window(db_session: AsyncSession):
    user = _make_user(
        verified=False, created_hours_ago=settings.ACCOUNT_LIMBO_PURGE_HOURS + 1
    )
    db_session.add(user)
    await db_session.commit()

    deleted = await accounts.purge_expired_limbo_accounts(db_session)

    assert deleted == 1
    db_session.expunge_all()  # bulk DELETE bypasses the identity map; force a re-read
    assert await db_session.get(User, user.id) is None


async def test_purge_keeps_verified_past_window(db_session: AsyncSession):
    user = _make_user(
        verified=True, created_hours_ago=settings.ACCOUNT_LIMBO_PURGE_HOURS + 1
    )
    db_session.add(user)
    await db_session.commit()

    deleted = await accounts.purge_expired_limbo_accounts(db_session)

    assert deleted == 0
    assert await db_session.get(User, user.id) is not None


async def test_purge_keeps_unverified_within_window(db_session: AsyncSession):
    user = _make_user(verified=False, created_hours_ago=0)
    db_session.add(user)
    await db_session.commit()

    deleted = await accounts.purge_expired_limbo_accounts(db_session)

    assert deleted == 0
    assert await db_session.get(User, user.id) is not None


async def test_purge_cascades_to_children(db_session: AsyncSession):
    user = _make_user(
        verified=False, created_hours_ago=settings.ACCOUNT_LIMBO_PURGE_HOURS + 1
    )
    child = Child(user_id=user.id, name="Kid")
    db_session.add_all([user, child])
    await db_session.commit()
    child_id = child.id

    await accounts.purge_expired_limbo_accounts(db_session)

    db_session.expunge_all()  # bulk DELETE bypasses the identity map; force a re-read
    assert await db_session.get(Child, child_id) is None
