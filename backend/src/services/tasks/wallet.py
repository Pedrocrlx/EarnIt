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
    await get_child_or_404(child_id, user, session)
    result = await session.execute(
        select(WalletTransaction)
        .where(WalletTransaction.child_id == child_id)
        .order_by(WalletTransaction.created_at.desc())
    )
    return list(result.scalars().all())
