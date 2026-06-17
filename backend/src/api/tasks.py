"""Parent-facing task endpoints — task CRUD and submission review.

Routes under ``/api/v1/tasks`` let a parent create, list, update, and
soft-delete tasks, then review the submissions their children make (list,
approve, reject, and batch-approve). All routes require an authenticated
parent session and operate only on that parent's own tasks/children.
"""

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


@router.post("", status_code=201, response_model=TaskResponse, tags=["tasks/management"], summary="Create a task")
async def create_task_endpoint(
    body: TaskCreateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> TaskResponse:
    """Assign a new task to a child.

    Two task types are supported:
    - `duty` — recurring daily chore with zero reward. A submission slot is generated
      automatically each midnight by the background job.
    - `extra_task` — one-off task requiring a positive `reward_amount` in euros
      (1 point = €0.01). The child submits once and the parent approves or rejects.

    Returns 404 if `child_id` does not belong to the authenticated parent.
    """
    task = await create_task(body, current_user, session)
    return TaskResponse.model_validate(task)


@router.get("", response_model=list[TaskResponse], tags=["tasks/management"], summary="List tasks")
async def list_tasks_endpoint(
    child_id: UUID | None = None,
    task_type: str | None = None,
    is_active: bool | None = None,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[TaskResponse]:
    """Return all tasks owned by the authenticated parent.

    Filter by `child_id`, `task_type` (`duty` or `extra_task`), or `is_active`.
    Omitting a filter returns all values for that field.
    """
    tasks = await list_tasks(current_user, session, child_id=child_id, task_type=task_type, is_active=is_active)
    return [TaskResponse.model_validate(t) for t in tasks]


@router.patch("/{task_id}", response_model=TaskResponse, tags=["tasks/management"], summary="Update a task")
async def update_task_endpoint(
    task_id: UUID,
    body: TaskUpdateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> TaskResponse:
    """Update a task's title, description, expiry, or active state.

    Only the owning parent can update a task. Returns 404 if the task is not found
    or does not belong to the current user. All fields are optional — omit fields
    that should not change.
    """
    task = await get_task_or_404(task_id, current_user, session)
    task = await update_task(task, body, session)
    return TaskResponse.model_validate(task)


@router.delete("/{task_id}", response_model=TaskResponse, tags=["tasks/management"], summary="Deactivate a task")
async def delete_task_endpoint(
    task_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> TaskResponse:
    """Soft-delete a task by setting `is_active = false`.

    Existing submissions are preserved and visible in submission history. No new duty
    slots will be generated for an inactive task. Returns the updated task object.
    """
    task = await get_task_or_404(task_id, current_user, session)
    task = await soft_delete_task(task, session)
    return TaskResponse.model_validate(task)


# ---------------------------------------------------------------------------
# Submission review (tasks 21-24)
# NOTE: approve-all MUST be registered before /{id}/approve to avoid FastAPI
# matching the literal string "approve-all" as a UUID path parameter.
# ---------------------------------------------------------------------------


@router.get("/submissions", response_model=list[SubmissionResponse], tags=["tasks/submissions"], summary="List submissions")
async def list_submissions_endpoint(
    child_id: UUID | None = None,
    status: str | None = None,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[SubmissionResponse]:
    """Return all task submissions across the parent's children.

    Filter by `child_id` or `status` (`pending`, `approved`, `rejected`). Includes
    today's duty slots and all extra_task submissions. Omitting a filter returns all
    values for that field.
    """
    subs = await list_submissions(current_user, session, child_id=child_id, status=status)
    return [SubmissionResponse.model_validate(s) for s in subs]


@router.post("/submissions/approve-all", response_model=BatchApproveResponse, tags=["tasks/submissions"], summary="Batch approve pending submissions")
async def batch_approve_endpoint(
    body: BatchApproveRequest = BatchApproveRequest(),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> BatchApproveResponse:
    """Approve all pending submissions in one call.

    Optionally scope to a single child by passing `child_id` in the request body.
    Each approval creates a wallet transaction crediting the child's balance for tasks
    with `reward_amount > 0`. Returns `{ "approved": N }` with the count of records
    updated.
    """
    count = await batch_approve(current_user, session, child_id=body.child_id)
    return BatchApproveResponse(approved=count)


@router.post("/submissions/{submission_id}/approve", response_model=SubmissionResponse, tags=["tasks/submissions"], summary="Approve a submission")
async def approve_submission_endpoint(
    submission_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SubmissionResponse:
    """Mark a single pending submission as approved.

    If the task has `reward_amount > 0`, a wallet transaction is created and the
    child's balance increases accordingly. Returns 409 if the submission is not in
    `pending` state.
    """
    sub = await approve_submission(submission_id, current_user, session)
    return SubmissionResponse.model_validate(sub)


@router.post("/submissions/{submission_id}/reject", response_model=SubmissionResponse, tags=["tasks/submissions"], summary="Reject a submission")
async def reject_submission_endpoint(
    submission_id: UUID,
    body: RejectRequest = RejectRequest(),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SubmissionResponse:
    """Mark a pending submission as rejected.

    An optional `rejection_note` can be included for the child to read. After
    rejection the child may resubmit via
    `PATCH /children/{child_id}/submissions/{submission_id}`. Returns 409 if the
    submission is not in `pending` state.
    """
    sub = await reject_submission(submission_id, body.rejection_note, current_user, session)
    return SubmissionResponse.model_validate(sub)
