from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


# ---------------------------------------------------------------------------
# Task schemas (tasks 4)
# ---------------------------------------------------------------------------


class TaskCreateRequest(BaseModel):
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
        if self.task_type == "duty" and self.reward_amount != Decimal("0.00"):
            raise ValueError("Duty tasks must have reward_amount of 0")
        if self.task_type == "extra_task" and self.reward_amount <= 0:
            raise ValueError("Extra tasks must have reward_amount greater than 0")
        return self


class TaskUpdateRequest(BaseModel):
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
    rejection_note: str | None = None

    model_config = {
        "json_schema_extra": {
            "example": {"rejection_note": "A foto não está clara, tenta outra vez!"}
        }
    }


class SubmissionResponse(BaseModel):
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
    child_id: UUID | None = None

    model_config = {
        "json_schema_extra": {
            "example": {"child_id": "00000000-0000-0000-0000-000000000001"}
        }
    }


class BatchApproveResponse(BaseModel):
    approved: int


# ---------------------------------------------------------------------------
# Child task list (used by GET /children/{child_id}/tasks)
# ---------------------------------------------------------------------------


class ChildTaskResponse(BaseModel):
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
    id: UUID
    child_id: UUID
    task_submission_id: UUID | None
    amount: Decimal
    transaction_type: str
    description: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class WalletBalanceResponse(BaseModel):
    child_id: UUID
    balance: Decimal
    transactions: list[WalletTransactionResponse]
