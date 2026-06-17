"""Task schemas — request/response models for tasks, submissions, wallet.

Defines the validated bodies the parent and child endpoints accept and the
shapes they return. The create-task validator encodes the core business rule:
duties carry no reward, extra tasks must reward more than zero.
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


# ---------------------------------------------------------------------------
# Task schemas (tasks 4)
# ---------------------------------------------------------------------------


class TaskCreateRequest(BaseModel):
    """Body for ``POST /tasks`` — a new duty or extra task for a child."""

    child_id: UUID
    title: str = Field(min_length=1, max_length=150)
    description: str | None = None
    task_type: Literal["duty", "extra_task"]
    reward_amount: Decimal = Field(default=Decimal("0.00"), ge=0)
    expires_at: datetime | None = None

    model_config = {
        "json_schema_extra": {
            "example": {
                "child_id": "00000000-0000-0000-0000-000000000001",
                "title": "Lavar a loiça",
                "description": "Lavar e arrumar a loiça do jantar",
                "task_type": "extra_task",
                "reward_amount": "1.50",
                "expires_at": None,
            }
        }
    }

    @model_validator(mode="after")
    def check_reward_rules(self) -> "TaskCreateRequest":
        """Tie reward to task type: duties pay 0, extra tasks pay > 0."""
        if self.task_type == "duty" and self.reward_amount != Decimal("0.00"):
            raise ValueError("Duty tasks must have reward_amount of 0")
        if self.task_type == "extra_task" and self.reward_amount <= 0:
            raise ValueError("Extra tasks must have reward_amount greater than 0")
        return self


class TaskUpdateRequest(BaseModel):
    """Body for ``PATCH /tasks/{id}`` — all fields optional (partial update)."""

    title: str | None = Field(default=None, min_length=1, max_length=150)
    description: str | None = None
    expires_at: datetime | None = None
    is_active: bool | None = None

    model_config = {
        "json_schema_extra": {
            "example": {
                "title": "Arrumar o quarto",
                "description": "Arrumar antes do almoço",
                "is_active": True,
            }
        }
    }


class TaskResponse(BaseModel):
    """Serialised ``Task`` returned by the task endpoints."""

    id: UUID
    user_id: UUID
    child_id: UUID
    title: str
    description: str | None
    task_type: str
    reward_amount: Decimal
    expires_at: datetime | None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Submission schemas (task 5)
# ---------------------------------------------------------------------------


class RejectRequest(BaseModel):
    """Body for rejecting a submission — an optional note for the child."""

    rejection_note: str | None = None

    model_config = {
        "json_schema_extra": {
            "example": {"rejection_note": "A foto não está clara, tenta outra vez!"}
        }
    }


class SubmissionResponse(BaseModel):
    """Serialised ``TaskSubmission`` returned by the submission endpoints."""

    id: UUID
    task_id: UUID
    child_id: UUID
    scheduled_date: date | None
    submitted_at: datetime | None
    status: str
    reviewed_at: datetime | None
    rejection_note: str | None

    model_config = {"from_attributes": True}


class BatchApproveRequest(BaseModel):
    """Body for approve-all — optionally scope to a single child."""

    child_id: UUID | None = None

    model_config = {
        "json_schema_extra": {
            "example": {"child_id": "00000000-0000-0000-0000-000000000001"}
        }
    }


class BatchApproveResponse(BaseModel):
    """Response for approve-all — count of submissions approved."""

    approved: int


# ---------------------------------------------------------------------------
# Child task list (used by GET /children/{child_id}/tasks)
# ---------------------------------------------------------------------------


class ChildTaskResponse(BaseModel):
    """A task as the child sees it, with its current submission attached."""

    id: UUID
    title: str
    description: str | None
    task_type: str
    reward_amount: Decimal
    expires_at: datetime | None
    submission: SubmissionResponse | None  # today's slot for duties; latest for extra_tasks

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Wallet schemas (task 6)
# ---------------------------------------------------------------------------


class WalletTransactionResponse(BaseModel):
    """Serialised ``WalletTransaction`` — one ledger entry."""

    id: UUID
    child_id: UUID
    task_submission_id: UUID | None
    amount: Decimal
    transaction_type: str
    description: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class WalletBalanceResponse(BaseModel):
    """A child's wallet — current balance plus full transaction history."""

    child_id: UUID
    balance: Decimal
    transactions: list[WalletTransactionResponse]
