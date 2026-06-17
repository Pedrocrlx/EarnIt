"""Submission service — the submit/review lifecycle and reward crediting.

Covers a child submitting a task, a parent approving/rejecting (single or
batch), and resubmitting a rejected one. Approving a rewarded extra task writes
a wallet credit. Also owns the background job that, each midnight, generates a
fresh submission slot for every active duty so it's ready to be completed.
"""

import asyncio
import logging
from datetime import UTC, date, datetime, time, timedelta
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.database import AsyncSessionLocal
from src.models.auth import Child, User
from src.models.tasks import Task, TaskSubmission, WalletTransaction
from src.services.tasks._shared import get_child_or_404, get_submission_or_404

_slot_task: asyncio.Task | None = None

logger = logging.getLogger(__name__)


async def submit_task(
    task_id: UUID, child_id: UUID, user: User, session: AsyncSession
) -> TaskSubmission:
    """Record a child's completion of a task.

    Duties stamp today's pre-generated slot (409 if already submitted today);
    extra tasks create a new pending submission (409 if one is already pending
    or approved). The local import of ``get_task_or_404`` avoids a circular
    import between this module and ``crud``.
    """
    from src.services.tasks.crud import get_task_or_404

    task = await get_task_or_404(task_id, user, session)
    if task.child_id != child_id:
        raise HTTPException(status_code=404, detail="Task not found")
    await get_child_or_404(child_id, user, session)

    now = datetime.now(UTC)

    if task.task_type == "duty":
        result = await session.execute(
            select(TaskSubmission).where(
                TaskSubmission.task_id == task_id,
                TaskSubmission.scheduled_date == now.date(),
            )
        )
        slot = result.scalar_one_or_none()
        if slot is None:
            raise HTTPException(status_code=404, detail="No duty slot found for today")
        if slot.submitted_at is not None:
            raise HTTPException(status_code=409, detail="Duty already submitted for today")
        slot.submitted_at = now
        await session.commit()
        logger.info("Duty submitted: submission_id=%s", slot.id)
        return slot
    else:
        result = await session.execute(
            select(TaskSubmission).where(
                TaskSubmission.task_id == task_id,
                TaskSubmission.status.in_(["pending", "approved"]),
            )
        )
        if result.scalar_one_or_none() is not None:
            raise HTTPException(status_code=409, detail="Task already has a pending or approved submission")
        submission = TaskSubmission(
            task_id=task_id,
            child_id=child_id,
            submitted_at=now,
            status="pending",
        )
        session.add(submission)
        await session.commit()
        logger.info("Extra task submitted: submission_id=%s", submission.id)
        return submission


async def resubmit_task(
    submission_id: UUID, child_id: UUID, user: User, session: AsyncSession
) -> TaskSubmission:
    """Reset a rejected submission back to pending for another review.

    Clears the rejection note and review timestamp and re-stamps
    ``submitted_at``. Raises 409 unless the submission is currently rejected.
    """
    await get_child_or_404(child_id, user, session)
    submission = await session.get(TaskSubmission, submission_id)
    if submission is None or submission.child_id != child_id:
        raise HTTPException(status_code=404, detail="Submission not found")
    if submission.status != "rejected":
        raise HTTPException(status_code=409, detail="Only rejected submissions can be resubmitted")
    submission.status = "pending"
    submission.submitted_at = datetime.now(UTC)
    submission.rejection_note = None
    submission.reviewed_at = None
    await session.commit()
    logger.info("Submission resubmitted: submission_id=%s", submission.id)
    return submission


async def approve_submission(
    submission_id: UUID, user: User, session: AsyncSession
) -> TaskSubmission:
    """Approve one pending submission, crediting the wallet if rewarded.

    A rewarded extra task writes a ``credit`` wallet transaction; duties (zero
    reward) just flip status. Raises 409 unless the submission is pending.
    """
    submission = await get_submission_or_404(submission_id, user, session)
    if submission.status != "pending":
        raise HTTPException(status_code=409, detail="Submission is not pending")
    task = await session.get(Task, submission.task_id)
    now = datetime.now(UTC)
    submission.status = "approved"
    submission.reviewed_at = now
    if task and task.task_type == "extra_task" and task.reward_amount > 0:
        session.add(
            WalletTransaction(
                child_id=submission.child_id,
                task_submission_id=submission.id,
                amount=task.reward_amount,
                transaction_type="credit",
                description=f"Approved: {task.title}",
            )
        )
    await session.commit()
    logger.info("Submission approved: submission_id=%s", submission.id)
    return submission


async def reject_submission(
    submission_id: UUID, rejection_note: str | None, user: User, session: AsyncSession
) -> TaskSubmission:
    """Reject one pending submission, attaching an optional note for the child.

    Raises 409 unless the submission is pending. No wallet entry is written; the
    child may later resubmit via ``resubmit_task``.
    """
    submission = await get_submission_or_404(submission_id, user, session)
    if submission.status != "pending":
        raise HTTPException(status_code=409, detail="Submission is not pending")
    submission.status = "rejected"
    submission.reviewed_at = datetime.now(UTC)
    submission.rejection_note = rejection_note
    await session.commit()
    logger.info("Submission rejected: submission_id=%s", submission.id)
    return submission


async def batch_approve(
    user: User, session: AsyncSession, child_id: UUID | None = None
) -> int:
    """Approve every pending submission for the parent (or one child).

    Crediting follows the same rule as single approval — rewarded extra tasks
    write a wallet credit. Returns the number of submissions approved.
    """
    children_q = select(Child.id).where(Child.user_id == user.id)
    if child_id is not None:
        children_q = children_q.where(Child.id == child_id)
    child_ids = list((await session.execute(children_q)).scalars().all())
    if not child_ids:
        return 0

    result = await session.execute(
        select(TaskSubmission).where(
            TaskSubmission.child_id.in_(child_ids),
            TaskSubmission.status == "pending",
            TaskSubmission.submitted_at.is_not(None),
        )
    )
    submissions = result.scalars().all()

    now = datetime.now(UTC)
    count = 0
    for sub in submissions:
        task = await session.get(Task, sub.task_id)
        sub.status = "approved"
        sub.reviewed_at = now
        if task and task.task_type == "extra_task" and task.reward_amount > 0:
            session.add(
                WalletTransaction(
                    child_id=sub.child_id,
                    task_submission_id=sub.id,
                    amount=task.reward_amount,
                    transaction_type="credit",
                    description=f"Approved: {task.title}",
                )
            )
        count += 1

    await session.commit()
    logger.info("Batch approved %d submission(s) for user_id=%s", count, user.id)
    return count


async def list_submissions(
    user: User,
    session: AsyncSession,
    child_id: UUID | None = None,
    status: str | None = None,
) -> list[TaskSubmission]:
    """List submissions across the parent's children, optionally filtered.

    Scopes to one child via ``child_id`` and/or one ``status`` when provided.
    """
    children_q = select(Child.id).where(Child.user_id == user.id)
    if child_id is not None:
        children_q = children_q.where(Child.id == child_id)
    child_ids = list((await session.execute(children_q)).scalars().all())

    query = select(TaskSubmission).where(TaskSubmission.child_id.in_(child_ids))
    if status is not None:
        query = query.where(TaskSubmission.status == status)
    result = await session.execute(query)
    return list(result.scalars().all())


# ---------------------------------------------------------------------------
# Daily duty slot generation (tasks 15 & 16)
# ---------------------------------------------------------------------------


async def generate_daily_duty_slots(session: AsyncSession) -> int:
    """Insert a pending submission slot for every active duty task that lacks one today.

    Safe to call multiple times — the unique constraint on (task_id, scheduled_date)
    is the DB-level guard; the pre-check here avoids unnecessary writes.
    """
    today = datetime.now(UTC).date()
    duties = (
        await session.execute(
            select(Task).where(Task.task_type == "duty", Task.is_active.is_(True))
        )
    ).scalars().all()

    count = 0
    for duty in duties:
        existing = (
            await session.execute(
                select(TaskSubmission).where(
                    TaskSubmission.task_id == duty.id,
                    TaskSubmission.scheduled_date == today,
                )
            )
        ).scalar_one_or_none()
        if existing is None:
            session.add(
                TaskSubmission(
                    task_id=duty.id,
                    child_id=duty.child_id,
                    scheduled_date=today,
                    status="pending",
                )
            )
            count += 1

    if count:
        await session.commit()
        logger.info("Generated %d duty slot(s) for %s", count, today)
    return count


def _seconds_until_next_midnight() -> float:
    """Seconds from now until the next UTC midnight (the loop's sleep)."""
    now = datetime.now(UTC)
    next_midnight = datetime.combine(now.date() + timedelta(days=1), time.min, tzinfo=UTC)
    return (next_midnight - now).total_seconds()


async def _daily_slot_loop() -> None:
    """Sleep until each midnight, then generate that day's duty slots forever."""
    while True:
        await asyncio.sleep(_seconds_until_next_midnight())
        async with AsyncSessionLocal() as session:
            await generate_daily_duty_slots(session)


async def start_daily_slot_job() -> None:
    """Startup hook: create today's slots immediately, then repeat each midnight."""
    global _slot_task
    async with AsyncSessionLocal() as session:
        await generate_daily_duty_slots(session)
    _slot_task = asyncio.create_task(_daily_slot_loop())
    _slot_task.add_done_callback(lambda _: logger.info("Daily slot loop exited"))


async def stop_daily_slot_job() -> None:
    """Cancel the midnight loop (shutdown / test teardown)."""
    global _slot_task
    if _slot_task is not None:
        _slot_task.cancel()
        await asyncio.gather(_slot_task, return_exceptions=True)
        _slot_task = None
