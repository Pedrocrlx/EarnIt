"""Goal endpoints — a child's wishlist and the parent's approval/redeem flow.

Routes under ``/api/v1/children/{child_id}/goals`` cover the whole lifecycle: a
child requests a goal, the parent approves it with a point value or rejects it,
and the parent redeems it once the balance is reached (spending points via a
wallet debit). Like the rest of the app there are no child logins — every route
is scoped to the authenticated parent and 404s if the child isn't theirs; the
frontend's PIN gate decides which actions are offered in child vs parent mode.
"""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_session
from src.dependencies import get_current_user
from src.models.auth import User
from src.schemas.goals import (
    GoalApproveRequest,
    GoalListResponse,
    GoalRequestCreate,
    GoalResponse,
)
from src.services.goals import (
    approve_goal,
    create_goal_request,
    get_goal_or_404,
    list_goals,
    redeem_goal,
    reject_goal,
)
from src.services.tasks import get_balance

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/children")


@router.post(
    "/{child_id}/goals",
    status_code=201,
    response_model=GoalResponse,
    tags=["goals"],
    summary="Request a goal",
)
async def request_goal_endpoint(
    child_id: UUID,
    body: GoalRequestCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> GoalResponse:
    """Record a child's goal request — a free-text wish, e.g. "go to the park".

    The goal starts in `requested` (pending) with no value; the parent later
    approves it with a point target or rejects it. Returns 404 if the child does
    not belong to the authenticated parent.
    """
    goal = await create_goal_request(child_id, body, current_user, session)
    return GoalResponse.model_validate(goal)


@router.get(
    "/{child_id}/goals",
    response_model=GoalListResponse,
    tags=["goals"],
    summary="List a child's goals",
)
async def list_goals_endpoint(
    child_id: UUID,
    status: str | None = None,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> GoalListResponse:
    """Return the child's goals (newest first) plus their current balance.

    Filter by `status` (`requested`, `approved`, `rejected`, `redeemed`). The
    frontend hides `rejected` goals in child mode and derives each approved goal's
    "reached" state from `balance_points >= target_points`. Returns 404 if the
    child does not belong to the authenticated parent.
    """
    goals = await list_goals(child_id, current_user, session, status=status)
    balance = await get_balance(child_id, current_user, session)
    return GoalListResponse(
        child_id=child_id,
        balance_points=int(balance),
        point_value_eur=current_user.point_value_eur,
        goals=[GoalResponse.model_validate(g) for g in goals],
    )


@router.post(
    "/{child_id}/goals/{goal_id}/approve",
    response_model=GoalResponse,
    tags=["goals/review"],
    summary="Approve a goal and set its value",
)
async def approve_goal_endpoint(
    child_id: UUID,
    goal_id: UUID,
    body: GoalApproveRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> GoalResponse:
    """Approve a requested goal and set its point value (the child must "pay").

    Returns 409 if the goal is not in `requested` state. Returns 404 if the goal or
    child does not belong to the authenticated parent.
    """
    goal = await get_goal_or_404(goal_id, child_id, current_user, session)
    goal = await approve_goal(goal, body, session)
    return GoalResponse.model_validate(goal)


@router.post(
    "/{child_id}/goals/{goal_id}/reject",
    response_model=GoalResponse,
    tags=["goals/review"],
    summary="Reject a goal request",
)
async def reject_goal_endpoint(
    child_id: UUID,
    goal_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> GoalResponse:
    """Reject a requested goal — kept as `rejected`, hidden from the child view.

    Returns 409 if the goal is not in `requested` state. Returns 404 if the goal or
    child does not belong to the authenticated parent.
    """
    goal = await get_goal_or_404(goal_id, child_id, current_user, session)
    goal = await reject_goal(goal, session)
    return GoalResponse.model_validate(goal)


@router.post(
    "/{child_id}/goals/{goal_id}/redeem",
    response_model=GoalResponse,
    tags=["goals/redeem"],
    summary="Redeem an approved goal",
)
async def redeem_goal_endpoint(
    child_id: UUID,
    goal_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> GoalResponse:
    """Redeem an approved goal once the child can afford it, spending the points.

    Writes a wallet `debit` of `target_points` and marks the goal `redeemed`.
    Returns 409 if the goal is not `approved` or the balance is below target.
    Returns 404 if the goal or child does not belong to the authenticated parent.
    """
    goal = await get_goal_or_404(goal_id, child_id, current_user, session)
    goal = await redeem_goal(goal, current_user, session)
    return GoalResponse.model_validate(goal)
