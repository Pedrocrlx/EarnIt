"""Dev fixtures — seed a ready-to-use parent, child, and goals for local runs.

When ``DISABLE_AUTH`` is on, ``get_current_user`` returns this seeded dev user
instead of decoding a token, so the API is usable without logging in. Run as a
module (``python -m src.dev.fixtures``) to seed manually, or it runs on startup.
NEVER enable this path in production.

Fixed UUIDs (no copy-pasting random ids into Swagger): the dev child, two
`requested` goals (approve one, reject the other), an `approved` goal (redeem it),
and a wallet credit so the balance covers the redeem.
"""

import asyncio
import logging
from datetime import UTC, date, datetime
from uuid import UUID

from sqlalchemy import select

from src.database import AsyncSessionLocal
from src.models.auth import Child, User
from src.models.goals import Goal
from src.models.tasks import WalletTransaction
from src.security.hashing import hash_secret

logger = logging.getLogger(__name__)

DEV_USER_EMAIL = "dev@earnit.local"
DEV_CHILD_ID = UUID("00000000-0000-0000-0000-000000000001")
DEV_GOAL_REQUESTED_ID = UUID("00000000-0000-0000-0000-000000000002")  # approve it
DEV_GOAL_APPROVED_ID = UUID("00000000-0000-0000-0000-000000000003")  # redeem it
DEV_CREDIT_ID = UUID("00000000-0000-0000-0000-000000000004")
DEV_GOAL_REJECT_ID = UUID("00000000-0000-0000-0000-000000000005")  # reject it


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

        # Goals + a balance so the goal endpoints are exercisable in Swagger with
        # fixed ids: approve/reject the `requested` one; redeem the `approved` one
        # (target 100) against the 500-point credit.
        if await session.get(WalletTransaction, DEV_CREDIT_ID) is None:
            session.add(
                WalletTransaction(
                    id=DEV_CREDIT_ID,
                    child_id=DEV_CHILD_ID,
                    amount=500,
                    transaction_type="credit",
                    description="Dev seed balance",
                )
            )
        if await session.get(Goal, DEV_GOAL_REQUESTED_ID) is None:
            session.add(
                Goal(
                    id=DEV_GOAL_REQUESTED_ID,
                    child_id=DEV_CHILD_ID,
                    name="Ir ao parque (pendente)",
                )
            )
        if await session.get(Goal, DEV_GOAL_REJECT_ID) is None:
            session.add(
                Goal(
                    id=DEV_GOAL_REJECT_ID,
                    child_id=DEV_CHILD_ID,
                    name="Comprar doces (a recusar)",
                )
            )
        if await session.get(Goal, DEV_GOAL_APPROVED_ID) is None:
            session.add(
                Goal(
                    id=DEV_GOAL_APPROVED_ID,
                    child_id=DEV_CHILD_ID,
                    name="Bicicleta nova (aprovada)",
                    status="approved",
                    target_amount=100,
                )
            )

        await session.commit()


if __name__ == "__main__":
    # The top-level `from src.models...` imports already register every table.
    asyncio.run(seed_dev_fixtures())
