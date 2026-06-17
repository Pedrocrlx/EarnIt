import logging
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.database import get_session
from src.dependencies.auth import get_current_user
from src.models.auth import User
from src.schemas.tasks import (
    BatchApproveRequest,
    BatchApproveResponse,
    RejectRequest,
    SubmissionResponse,
    TaskCreateRequest,
    TaskResponse,
    TaskUpdateRequest,
)
from src.services.tasks import (
    approve_submission,
    batch_approve,
    create_task,
    get_task_or_404,
    list_submissions,
    list_tasks,
    reject_submission,
    soft_delete_task,
    update_task,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/tasks")


# ---------------------------------------------------------------------------
# Task CRUD (tasks 17-20)
# ---------------------------------------------------------------------------


@router.post("", status_code=201, response_model=TaskResponse, tags=["tasks/management"])
async def create_task_endpoint(
    body: TaskCreateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> TaskResponse:
    task = await create_task(body, current_user, session)
    return TaskResponse.model_validate(task)


@router.get("", response_model=list[TaskResponse], tags=["tasks/management"])
async def list_tasks_endpoint(
    child_id: UUID | None = None,
    task_type: str | None = None,
    is_active: bool | None = None,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[TaskResponse]:
    tasks = await list_tasks(current_user, session, child_id=child_id, task_type=task_type, is_active=is_active)
    return [TaskResponse.model_validate(t) for t in tasks]


@router.patch("/{task_id}", response_model=TaskResponse, tags=["tasks/management"])
async def update_task_endpoint(
    task_id: UUID,
    body: TaskUpdateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> TaskResponse:
    task = await get_task_or_404(task_id, current_user, session)
    task = await update_task(task, body, session)
    return TaskResponse.model_validate(task)


@router.delete("/{task_id}", response_model=TaskResponse, tags=["tasks/management"])
async def delete_task_endpoint(
    task_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> TaskResponse:
    task = await get_task_or_404(task_id, current_user, session)
    task = await soft_delete_task(task, session)
    return TaskResponse.model_validate(task)


# ---------------------------------------------------------------------------
# Submission review (tasks 21-24)
# NOTE: approve-all MUST be registered before /{id}/approve to avoid FastAPI
# matching the literal string "approve-all" as a UUID path parameter.
# ---------------------------------------------------------------------------


@router.get("/submissions", response_model=list[SubmissionResponse], tags=["tasks/submissions"])
async def list_submissions_endpoint(
    child_id: UUID | None = None,
    status: str | None = None,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[SubmissionResponse]:
    subs = await list_submissions(current_user, session, child_id=child_id, status=status)
    return [SubmissionResponse.model_validate(s) for s in subs]


@router.post("/submissions/approve-all", response_model=BatchApproveResponse, tags=["tasks/submissions"])
async def batch_approve_endpoint(
    body: BatchApproveRequest = BatchApproveRequest(),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> BatchApproveResponse:
    count = await batch_approve(current_user, session, child_id=body.child_id)
    return BatchApproveResponse(approved=count)


@router.post("/submissions/{submission_id}/approve", response_model=SubmissionResponse, tags=["tasks/submissions"])
async def approve_submission_endpoint(
    submission_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SubmissionResponse:
    sub = await approve_submission(submission_id, current_user, session)
    return SubmissionResponse.model_validate(sub)


@router.post("/submissions/{submission_id}/reject", response_model=SubmissionResponse, tags=["tasks/submissions"])
async def reject_submission_endpoint(
    submission_id: UUID,
    body: RejectRequest = RejectRequest(),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SubmissionResponse:
    sub = await reject_submission(submission_id, body.rejection_note, current_user, session)
    return SubmissionResponse.model_validate(sub)
