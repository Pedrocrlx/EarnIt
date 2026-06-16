from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.auth import Child, User
from src.models.tasks import TaskSubmission


async def get_child_or_404(child_id: UUID, user: User, session: AsyncSession) -> Child:
    child = await session.get(Child, child_id)
    if child is None or child.user_id != user.id:
        raise HTTPException(status_code=404, detail="Child not found")
    return child


async def get_submission_or_404(
    submission_id: UUID, user: User, session: AsyncSession
) -> TaskSubmission:
    submission = await session.get(TaskSubmission, submission_id)
    if submission is None:
        raise HTTPException(status_code=404, detail="Submission not found")
    child = await session.get(Child, submission.child_id)
    if child is None or child.user_id != user.id:
        raise HTTPException(status_code=404, detail="Submission not found")
    return submission
