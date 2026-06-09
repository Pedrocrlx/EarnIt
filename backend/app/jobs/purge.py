from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.models import EmailVerification, User


async def run_purge(session: AsyncSession) -> None:
    now = datetime.now(timezone.utc)
    limbo_cutoff = now - timedelta(hours=settings.ACCOUNT_LIMBO_PURGE_HOURS)

    # Delete expired, unredeemed verification codes across all purposes.
    # Consumed codes (consumed_at IS NOT NULL) are retained as an audit trail.
    # Codes belonging to purged users are removed automatically via CASCADE.
    await session.execute(
        delete(EmailVerification).where(
            and_(
                EmailVerification.expires_at < now,
                EmailVerification.consumed_at.is_(None),
            )
        )
    )

    # Hard-delete unverified accounts past the limbo window.
    # CASCADE on children.user_id and email_verifications.user_id removes all
    # owned rows automatically — no manual child/code cleanup required here.
    await session.execute(
        delete(User).where(
            and_(
                User.email_verified_at.is_(None),
                User.created_at < limbo_cutoff,
            )
        )
    )

    await session.commit()


async def scheduled_purge() -> None:
    from app.database import AsyncSessionLocal

    async with AsyncSessionLocal() as session:
        await run_purge(session)
