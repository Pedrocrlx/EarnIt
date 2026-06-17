"""Task CRUD service — create, fetch, list, update, and soft-delete tasks.

The write paths re-check child/task ownership (via ``_shared`` and
``get_task_or_404``) so a parent can only act on their own records. Deletes are
soft (``is_active = False``) to keep submission history intact.
"""

import logging
from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.auth import User
from src.models.tasks import Task
from src.schemas.tasks import TaskCreateRequest, TaskUpdateRequest
from src.services.tasks._shared import get_child_or_404

logger = logging.getLogger(__name__)


async def create_task(body: TaskCreateRequest, user: User, session: AsyncSession) -> Task:
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
    logger.info("Task created: task_id=%s user_id=%s type=%s", task.id, user.id, task.task_type)
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
    is_active: bool | None = None,
) -> list[Task]:
    """List the parent's tasks, optionally filtered by child/type/active.

    Each provided filter narrows the result; omitted filters match all values.
    """
    query = select(Task).where(Task.user_id == user.id)
    if child_id is not None:
        query = query.where(Task.child_id == child_id)
    if task_type is not None:
        query = query.where(Task.task_type == task_type)
    if is_active is not None:
        query = query.where(Task.is_active == is_active)
    result = await session.execute(query)
    return list(result.scalars().all())


async def update_task(task: Task, body: TaskUpdateRequest, session: AsyncSession) -> Task:
    """Apply a partial update — only the fields present in ``body`` change."""
    if body.title is not None:
        task.title = body.title
    if body.description is not None:
        task.description = body.description
    if body.expires_at is not None:
        task.expires_at = body.expires_at
    if body.is_active is not None:
        task.is_active = body.is_active
    task.updated_at = datetime.now(UTC)
    await session.commit()
    logger.info("Task updated: task_id=%s", task.id)
    return task


async def soft_delete_task(task: Task, session: AsyncSession) -> Task:
    """Deactivate a task (``is_active = False``); history is preserved."""
    task.is_active = False
    task.updated_at = datetime.now(UTC)
    await session.commit()
    logger.info("Task soft-deleted: task_id=%s", task.id)
    return task
