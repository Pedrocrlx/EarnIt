import logging
from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.database import get_session
from src.dependencies.auth import get_current_user
from src.models.auth import User
from src.models.tasks import Task, TaskSubmission
from src.schemas.tasks import (
    ChildTaskResponse,
    SubmissionResponse,
    WalletBalanceResponse,
    WalletTransactionResponse,
)
from src.services.tasks import get_balance, get_transaction_history, resubmit_task, submit_task
from src.services.tasks._shared import get_child_or_404

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/children")


# ---------------------------------------------------------------------------
# Child task view (tasks 25-28)
# ---------------------------------------------------------------------------


@router.get("/{child_id}/tasks", response_model=list[ChildTaskResponse], tags=["children/tasks"])
async def list_child_tasks(
    child_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[ChildTaskResponse]:
    await get_child_or_404(child_id, current_user, session)
    today = datetime.now(UTC).date()

    duties = (
        await session.execute(
            select(Task).where(
                Task.child_id == child_id,
                Task.task_type == "duty",
                Task.is_active.is_(True),
            )
        )
    ).scalars().all()

    extra_tasks = (
        await session.execute(
            select(Task).where(
                Task.child_id == child_id,
                Task.task_type == "extra_task",
                Task.is_active.is_(True),
            )
        )
    ).scalars().all()

    items: list[ChildTaskResponse] = []

    for task in duties:
        slot = (
            await session.execute(
                select(TaskSubmission).where(
                    TaskSubmission.task_id == task.id,
                    TaskSubmission.scheduled_date == today,
                )
            )
        ).scalar_one_or_none()
        items.append(
            ChildTaskResponse(
                id=task.id,
                title=task.title,
                description=task.description,
                task_type=task.task_type,
                reward_amount=task.reward_amount,
                expires_at=task.expires_at,
                submission=SubmissionResponse.model_validate(slot) if slot else None,
            )
        )

    for task in extra_tasks:
        sub = (
            await session.execute(
                select(TaskSubmission)
                .where(
                    TaskSubmission.task_id == task.id,
                    TaskSubmission.status.in_(["pending", "approved", "rejected"]),
                )
                .order_by(TaskSubmission.submitted_at.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        items.append(
            ChildTaskResponse(
                id=task.id,
                title=task.title,
                description=task.description,
                task_type=task.task_type,
                reward_amount=task.reward_amount,
                expires_at=task.expires_at,
                submission=SubmissionResponse.model_validate(sub) if sub else None,
            )
        )

    return items


@router.post("/{child_id}/tasks/{task_id}/submit", status_code=201, response_model=SubmissionResponse, tags=["children/tasks"])
async def submit_task_endpoint(
    child_id: UUID,
    task_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SubmissionResponse:
    sub = await submit_task(task_id, child_id, current_user, session)
    return SubmissionResponse.model_validate(sub)


@router.patch("/{child_id}/submissions/{submission_id}", response_model=SubmissionResponse, tags=["children/tasks"])
async def resubmit_task_endpoint(
    child_id: UUID,
    submission_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SubmissionResponse:
    sub = await resubmit_task(submission_id, child_id, current_user, session)
    return SubmissionResponse.model_validate(sub)


@router.get("/{child_id}/wallet", response_model=WalletBalanceResponse, tags=["children/wallet"])
async def get_wallet(
    child_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> WalletBalanceResponse:
    balance = await get_balance(child_id, current_user, session)
    transactions = await get_transaction_history(child_id, current_user, session)
    return WalletBalanceResponse(
        child_id=child_id,
        balance=balance,
        transactions=[WalletTransactionResponse.model_validate(t) for t in transactions],
    )
