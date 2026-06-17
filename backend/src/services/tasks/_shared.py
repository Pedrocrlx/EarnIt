"""Shared task-service guards — ownership lookups used across submodules.

Both helpers enforce the same rule: a parent may only touch their own children
and submissions. They deliberately return 404 (not 403) for resources owned by
someone else, so the API never reveals that another user's record exists.
"""

from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.auth import Child, User
from src.models.tasks import TaskSubmission


async def get_child_or_404(child_id: UUID, user: User, session: AsyncSession) -> Child:
    """Return the child if it belongs to ``user``, else raise 404."""
    child = await session.get(Child, child_id)
    if child is None or child.user_id != user.id:
        raise HTTPException(status_code=404, detail="Child not found")
    return child


async def get_submission_or_404(
    submission_id: UUID, user: User, session: AsyncSession
) -> TaskSubmission:
    """Return the submission if its child belongs to ``user``, else raise 404.

    Resolves the submission and then its child, so a submission under another
    parent's child is indistinguishable from one that does not exist.
    """
    submission = await session.get(TaskSubmission, submission_id)
    if submission is None:
        raise HTTPException(status_code=404, detail="Submission not found")
    child = await session.get(Child, submission.child_id)
    if child is None or child.user_id != user.id:
        raise HTTPException(status_code=404, detail="Submission not found")
    return submission
