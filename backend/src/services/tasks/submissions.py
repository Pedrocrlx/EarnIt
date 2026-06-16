import logging
from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.auth import Child, User
from src.models.tasks import Task, TaskSubmission, WalletTransaction
from src.services.tasks._shared import get_child_or_404, get_submission_or_404

logger = logging.getLogger(__name__)


async def submit_task(
    task_id: UUID, child_id: UUID, user: User, session: AsyncSession
) -> TaskSubmission:
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
    children_q = select(Child.id).where(Child.user_id == user.id)
    if child_id is not None:
        children_q = children_q.where(Child.id == child_id)
    child_ids = list((await session.execute(children_q)).scalars().all())

    query = select(TaskSubmission).where(TaskSubmission.child_id.in_(child_ids))
    if status is not None:
        query = query.where(TaskSubmission.status == status)
    result = await session.execute(query)
    return list(result.scalars().all())
