"""Task CRUD service — create, fetch, list, update, and delete tasks.

The write paths re-check child/task ownership (via ``_shared`` and
``get_task_or_404``) so a parent can only act on their own records. Deleting a
task is a hard delete that first snapshots the task's title onto its submissions
so their completion history survives (their ``task_id`` is then nulled).
"""

import logging
from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.auth import User
from src.models.tasks import Task, TaskSubmission
from src.schemas.tasks import TaskCreateRequest, TaskUpdateRequest
from src.services.tasks._shared import get_child_or_404

logger = logging.getLogger(__name__)


async def create_task(
    body: TaskCreateRequest, user: User, session: AsyncSession
) -> Task:
    """Create a task for one of the parent's children (404 if not theirs)."""
    await get_child_or_404(body.child_id, user, session)
    task = Task(
        user_id=user.id,
        child_id=body.child_id,
        title=body.title,
        description=body.description,
        task_type=body.task_type,
        reward_amount=body.reward_amount,
        expires_at=body.expires_at,
    )
    session.add(task)
    await session.commit()
    logger.info(
        "Task created: task_id=%s user_id=%s type=%s", task.id, user.id, task.task_type
    )
    return task


async def get_task_or_404(task_id: UUID, user: User, session: AsyncSession) -> Task:
    """Return the task if it belongs to ``user``, else raise 404."""
    task = await session.get(Task, task_id)
    if task is None or task.user_id != user.id:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


async def list_tasks(
    user: User,
    session: AsyncSession,
    child_id: UUID | None = None,
    task_type: str | None = None,
) -> list[Task]:
    """List the parent's tasks, optionally filtered by child/type.

    Each provided filter narrows the result; omitted filters match all values.
    """
    query = select(Task).where(Task.user_id == user.id)
    if child_id is not None:
        query = query.where(Task.child_id == child_id)
    if task_type is not None:
        query = query.where(Task.task_type == task_type)
    result = await session.execute(query)
    return list(result.scalars().all())


async def update_task(
    task: Task, body: TaskUpdateRequest, session: AsyncSession
) -> Task:
    """Apply a partial update — only the fields *present in the request* change.

    Uses ``exclude_unset`` so an explicit ``null`` clears a field (description,
    expires_at) while an omitted field is left as-is. ``reward_amount`` must match
    the task's type (duty = 0, extra > 0).
    """
    data = body.model_dump(exclude_unset=True)

    if "reward_amount" in data:
        reward = data["reward_amount"]
        if task.task_type == "duty" and reward != 0:
            raise HTTPException(
                status_code=422, detail="Duty tasks must have reward_amount of 0"
            )
        if task.task_type == "extra_task" and reward <= 0:
            raise HTTPException(
                status_code=422,
                detail="Extra tasks must have reward_amount greater than 0",
            )
        task.reward_amount = reward

    if "title" in data and data["title"] is not None:
        task.title = data["title"]
    if "description" in data:
        task.description = data["description"]
    if "expires_at" in data:
        task.expires_at = data["expires_at"]

    task.updated_at = datetime.now(UTC)
    await session.commit()
    logger.info("Task updated: task_id=%s", task.id)
    return task


async def delete_task(task: Task, session: AsyncSession) -> None:
    """Hard-delete a task, preserving its submissions as orphaned history.

    First snapshot the task's title onto its submissions and null their
    ``task_id`` (done explicitly so it holds regardless of DB-level FK
    enforcement; the ``ON DELETE SET NULL`` FK is the backstop). The task row is
    then deleted with nothing referencing it, so the completion history survives
    and still shows which (now-removed) task it belonged to.
    """
    await session.execute(
        update(TaskSubmission)
        .where(TaskSubmission.task_id == task.id)
        .values(task_title=task.title, task_id=None)
    )
    await session.delete(task)
    await session.commit()
    logger.info("Task deleted: task_id=%s", task.id)
