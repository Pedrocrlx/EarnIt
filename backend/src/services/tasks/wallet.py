"""Wallet service — read-only views over a child's transaction ledger.

The balance is computed on demand as the sum of credits minus debits rather
than stored, so it can never drift from the ledger. Both functions re-check
that the child belongs to the requesting parent before reading anything.
"""

import logging
from decimal import Decimal
from uuid import UUID

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.auth import User
from src.models.tasks import WalletTransaction
from src.services.tasks._shared import get_child_or_404

logger = logging.getLogger(__name__)


async def get_balance(child_id: UUID, user: User, session: AsyncSession) -> Decimal:
    """Sum the child's ledger (credits minus debits); 0.00 if empty."""
    await get_child_or_404(child_id, user, session)
    result = await session.execute(
        select(
            func.coalesce(
                func.sum(
                    case(
                        (WalletTransaction.transaction_type == "credit", WalletTransaction.amount),
                        else_=-WalletTransaction.amount,
                    )
                ),
                Decimal("0.00"),
            )
        ).where(WalletTransaction.child_id == child_id)
    )
    return result.scalar_one()


async def get_transaction_history(
    child_id: UUID, user: User, session: AsyncSession
) -> list[WalletTransaction]:
    """Return the child's wallet transactions, newest first."""
    await get_child_or_404(child_id, user, session)
    result = await session.execute(
        select(WalletTransaction)
        .where(WalletTransaction.child_id == child_id)
        .order_by(WalletTransaction.created_at.desc())
    )
    return list(result.scalars().all())
