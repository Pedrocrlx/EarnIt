"""Child-facing endpoints — the kid's task list, submissions, and wallet.

Routes under ``/api/v1/children/{child_id}`` let a child view their assigned
tasks, submit a completion (duty or extra task), resubmit a rejected one, and
read their wallet balance and history. Every route is scoped to the
authenticated parent and 404s if the child does not belong to them.
"""

import logging
from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_session
from src.dependencies import get_current_user
from src.models.auth import User
from src.models.tasks import Task, TaskSubmission
from src.schemas.tasks import (
    ChildTaskResponse,
    SubmissionResponse,
    WalletBalanceResponse,
    WalletTransactionResponse,
)
from src.services.submission_proofs import read_proof_upload
from src.services.tasks import (
    get_balance,
    get_transaction_history,
    resubmit_task,
    submit_task,
)
from src.services.tasks._shared import get_child_or_404

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/children")

# Child Task View


@router.get(
    "/{child_id}/tasks",
    response_model=list[ChildTaskResponse],
    tags=["children/tasks"],
    summary="List tasks for a child",
)
async def list_child_tasks(
    child_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[ChildTaskResponse]:
    """Return all tasks assigned to the specified child.

    Duties include today's submission slot (status `pending`, `approved`, or
    `rejected`) or `null` if the daily slot has not been generated yet. Extra tasks
    include the most recent submission. Returns 404 if the child does not belong to
    the authenticated parent.
    """
    await get_child_or_404(child_id, current_user, session)
    today = datetime.now(UTC).date()

    # task_type ordering puts "duty" before "extra_task" (the historical order).
    tasks = (
        (
            await session.execute(
                select(Task).where(Task.child_id == child_id).order_by(Task.task_type)
            )
        )
        .scalars()
        .all()
    )

    items: list[ChildTaskResponse] = []
    for task in tasks:
        # Duties show today's slot; extra tasks show their most recent submission.
        if task.task_type == "duty":
            query = select(TaskSubmission).where(
                TaskSubmission.task_id == task.id,
                TaskSubmission.scheduled_date == today,
            )
        else:
            query = (
                select(TaskSubmission)
                .where(
                    TaskSubmission.task_id == task.id,
                    TaskSubmission.status.in_(["pending", "approved", "rejected"]),
                )
                .order_by(TaskSubmission.submitted_at.desc())
                .limit(1)
            )
        sub = (await session.execute(query)).scalar_one_or_none()
        items.append(
            ChildTaskResponse(
                id=task.id,
                title=task.title,
                description=task.description,
                task_type=task.task_type,
                reward_amount=int(task.reward_amount),
                expires_at=task.expires_at,
                submission=SubmissionResponse.model_validate(sub) if sub else None,
            )
        )

    return items


@router.post(
    "/{child_id}/tasks/{task_id}/submit",
    status_code=201,
    response_model=SubmissionResponse,
    tags=["children/tasks"],
    summary="Submit a task completion",
)
async def submit_task_endpoint(
    child_id: UUID,
    task_id: UUID,
    proof: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SubmissionResponse:
    """Record that a child has completed a task.

    For duties, submits today's slot and sets its status to `pending`. Returns 409
    if the slot has already been submitted today. For extra tasks, creates a new
    submission in `pending` state; returns 409 if a pending or approved submission
    already exists. The parent can then approve or reject via the submissions endpoints.
    """
    proof_data, proof_suffix = await read_proof_upload(proof)
    sub = await submit_task(
        task_id,
        child_id,
        proof_data,
        proof_suffix,
        current_user,
        session,
    )
    return SubmissionResponse.model_validate(sub)


@router.patch(
    "/{child_id}/submissions/{submission_id}",
    response_model=SubmissionResponse,
    tags=["children/tasks"],
    summary="Resubmit a rejected task",
)
async def resubmit_task_endpoint(
    child_id: UUID,
    submission_id: UUID,
    proof: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SubmissionResponse:
    """Reset a rejected submission back to `pending` for parent review.

    Only submissions in `rejected` state can be resubmitted — returns 409 otherwise.
    Clears the `rejection_note` and `reviewed_at` fields, and updates `submitted_at`
    to now.
    """
    proof_data, proof_suffix = await read_proof_upload(proof)
    sub = await resubmit_task(
        submission_id,
        child_id,
        proof_data,
        proof_suffix,
        current_user,
        session,
    )
    return SubmissionResponse.model_validate(sub)


@router.get(
    "/{child_id}/wallet",
    response_model=WalletBalanceResponse,
    tags=["children/wallet"],
    summary="Get wallet balance and history",
)
async def get_wallet(
    child_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> WalletBalanceResponse:
    """Return the child's balance and history — **in points** — plus the family rate.

    Balance is the running sum of credits − debits over `wallet_transactions`,
    counted in points. Converting points → € (using `point_value_eur`) is the
    frontend's job; the child only ever sees points. History is newest-first.
    Returns 404 if the child does not belong to the authenticated parent.
    """
    balance = await get_balance(child_id, current_user, session)
    transactions = await get_transaction_history(child_id, current_user, session)
    return WalletBalanceResponse(
        child_id=child_id,
        balance_points=int(balance),
        point_value_eur=current_user.point_value_eur,
        transactions=[
            WalletTransactionResponse.model_validate(t) for t in transactions
        ],
    )
