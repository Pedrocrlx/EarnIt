"""Goal service — the request → approval → redeem lifecycle.

A child requests a goal; the parent approves it with a point value or rejects it;
once the child's balance reaches the value the parent redeems it, spending the
points via a wallet ``debit``. Every function re-checks that the child (and goal)
belongs to the requesting parent — a goal under another parent's child is
indistinguishable from one that does not exist (404). Reuses the wallet balance
and child-ownership guards from the task services.
"""

import logging
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.auth import User
from src.models.goals import Goal
from src.models.tasks import WalletTransaction
from src.schemas.goals import GoalApproveRequest, GoalRequestCreate
from src.services.tasks._shared import get_child_or_404
from src.services.tasks.wallet import get_balance

logger = logging.getLogger(__name__)


async def create_goal_request(
    child_id: UUID, body: GoalRequestCreate, user: User, session: AsyncSession
) -> Goal:
    """Record a child's goal request (404 if the child isn't the parent's)."""
    await get_child_or_404(child_id, user, session)
    goal = Goal(child_id=child_id, name=body.name)
    session.add(goal)
    await session.commit()
    logger.info("Goal requested: goal_id=%s child_id=%s", goal.id, child_id)
    return goal


async def list_goals(
    child_id: UUID, user: User, session: AsyncSession, status: str | None = None
) -> list[Goal]:
    """Return the child's goals, newest first, optionally filtered by status."""
    await get_child_or_404(child_id, user, session)
    query = select(Goal).where(Goal.child_id == child_id)
    if status is not None:
        query = query.where(Goal.status == status)
    query = query.order_by(Goal.created_at.desc())
    result = await session.execute(query)
    return list(result.scalars().all())


async def get_goal_or_404(
    goal_id: UUID, child_id: UUID, user: User, session: AsyncSession
) -> Goal:
    """Return the goal if it belongs to the parent's child, else raise 404."""
    await get_child_or_404(child_id, user, session)
    goal = await session.get(Goal, goal_id)
    if goal is None or goal.child_id != child_id:
        raise HTTPException(status_code=404, detail="Goal not found")
    return goal


async def approve_goal(
    goal: Goal, body: GoalApproveRequest, session: AsyncSession
) -> Goal:
    """Approve a requested goal and set its target amount (409 if not requested)."""
    if goal.status != "requested":
        raise HTTPException(status_code=409, detail="Goal is not pending approval")
    goal.status = "approved"
    goal.target_amount = body.target_amount
    await session.commit()
    logger.info("Goal approved: goal_id=%s target=%s", goal.id, goal.target_amount)
    return goal


async def reject_goal(goal: Goal, session: AsyncSession) -> Goal:
    """Reject a requested goal (409 if not requested). Kept, hidden from the child."""
    if goal.status != "requested":
        raise HTTPException(status_code=409, detail="Goal is not pending approval")
    goal.status = "rejected"
    await session.commit()
    logger.info("Goal rejected: goal_id=%s", goal.id)
    return goal


async def redeem_goal(goal: Goal, user: User, session: AsyncSession) -> Goal:
    """Redeem an approved goal, spending the points via a wallet ``debit``.

    Raises 409 unless the goal is ``approved``, and 409 if the child's balance is
    below the target. Writes the first ``debit`` in the ledger and marks the goal
    ``redeemed`` (terminal).
    """
    if goal.status != "approved":
        raise HTTPException(status_code=409, detail="Goal is not approved")
    balance = await get_balance(goal.child_id, user, session)
    if balance < goal.target_amount:
        raise HTTPException(status_code=409, detail="Insufficient balance to redeem")
    session.add(
        WalletTransaction(
            child_id=goal.child_id,
            amount=goal.target_amount,
            transaction_type="debit",
            description=f"Goal: {goal.name}",
        )
    )
    goal.status = "redeemed"
    await session.commit()
    logger.info("Goal redeemed: goal_id=%s amount=%s", goal.id, goal.target_amount)
    return goal
