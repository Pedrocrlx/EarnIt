"""Dev fixtures — seed a ready-to-use parent and child for local runs.

When ``DISABLE_AUTH`` is on, ``get_current_user`` returns this seeded dev user
instead of decoding a token, so the API is usable without logging in. Run as a
module (``python -m src.dev.seed``) to seed manually, or it runs on startup.
NEVER enable this path in production.
"""

import asyncio
import logging
from datetime import UTC, date, datetime
from uuid import UUID

from sqlalchemy import select

from src.db.database import AsyncSessionLocal
from src.models.auth import Child, User
from src.security.hashing import hash_secret

logger = logging.getLogger(__name__)

DEV_USER_EMAIL = "dev@earnit.local"
DEV_CHILD_ID = UUID("00000000-0000-0000-0000-000000000001")


async def seed_dev_fixtures() -> None:
    """Idempotent: creates dev@earnit.local + dev child if they don't exist."""
    async with AsyncSessionLocal() as session:
        user = await session.scalar(select(User).where(User.email == DEV_USER_EMAIL))
        if user is None:
            user = User(
                email=DEV_USER_EMAIL,
                family_name="Dev Family",
                password_hash=await hash_secret("dev-no-login"),
                is_active=True,
                email_verified_at=datetime.now(UTC),
                onboarding_completed=True,
            )
            session.add(user)
            await session.flush()
            logger.warning(
                "DISABLE_AUTH: seeded dev user %s (id=%s)", DEV_USER_EMAIL, user.id
            )

        child = await session.get(Child, DEV_CHILD_ID)
        if child is None:
            child = Child(
                id=DEV_CHILD_ID,
                user_id=user.id,
                name="Criança Dev",
                birth_date=date(2015, 6, 15),
                is_active=True,
            )
            session.add(child)
            logger.warning(
                "DISABLE_AUTH: seeded dev child '%s' (child_id=%s)",
                child.name,
                child.id,
            )

        await session.commit()


if __name__ == "__main__":
    import src.models.auth
    import src.models.tasks  # noqa: F401

    asyncio.run(seed_dev_fixtures())
