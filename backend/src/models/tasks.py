"""Task domain models — tasks, their submissions, and wallet transactions.

Models the chore economy: a ``Task`` (recurring ``duty`` or one-off
``extra_task``) is assigned to a child, each completion is a ``TaskSubmission``
moving through pending/approved/rejected, and an approved rewarded task credits
the child via a ``WalletTransaction``. Identity models live in
``src.models.auth``.
"""

from datetime import UTC, date, datetime
from decimal import Decimal
from uuid import UUID, uuid4

import sqlalchemy as sa
from sqlalchemy import DateTime, UniqueConstraint
from sqlmodel import Field, SQLModel


class Task(SQLModel, table=True):
    """A chore assigned to a child by a parent.

    ``task_type`` is either ``"duty"`` (recurring daily chore, zero reward, a
    slot generated each midnight) or ``"extra_task"`` (one-off with a positive
    point reward). Deactivation is a soft delete via
    ``is_active`` so existing submissions stay intact.
    """

    __tablename__: str = "tasks"

    id: UUID = Field(
        default_factory=uuid4, primary_key=True, index=True, nullable=False
    )
    user_id: UUID = Field(
        foreign_key="users.id", index=True, nullable=False, ondelete="CASCADE"
    )
    child_id: UUID = Field(
        foreign_key="children.id", index=True, nullable=False, ondelete="CASCADE"
    )
    title: str = Field(max_length=150, nullable=False)
    description: str | None = Field(default=None, nullable=True)
    task_type: str = Field(max_length=20, nullable=False)  # "duty" | "extra_task"
    # Reward in **points** (duties = 0, extra_tasks > 0). Whole numbers stored in the
    # existing Numeric column; the API exposes them as `reward_points`. Euros are the
    # frontend's job, via the parent's `User.point_value_eur` rate.
    reward_amount: Decimal = Field(
        default=Decimal("0.00"), sa_type=sa.Numeric(10, 2), nullable=False
    )
    expires_at: datetime | None = Field(
        default=None, nullable=True, sa_type=DateTime(timezone=True)
    )
    is_active: bool = Field(default=True, nullable=False)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        nullable=False,
        sa_type=DateTime(timezone=True),
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        nullable=False,
        sa_type=DateTime(timezone=True),
    )


class TaskSubmission(SQLModel, table=True):
    """A single completion of a task, pending parent review.

    For duties, one row per ``(task_id, scheduled_date)`` is created daily — the
    unique constraint enforces one slot per day. Extra tasks create a row on
    submission. ``status`` walks pending → approved/rejected; a rejected one can
    be reset back to pending (resubmit).
    """

    __tablename__: str = "task_submissions"
    __table_args__ = (
        UniqueConstraint(
            "task_id", "scheduled_date", name="uq_task_submissions_task_date"
        ),
    )

    id: UUID = Field(
        default_factory=uuid4, primary_key=True, index=True, nullable=False
    )
    task_id: UUID = Field(
        foreign_key="tasks.id", index=True, nullable=False, ondelete="CASCADE"
    )
    child_id: UUID = Field(
        foreign_key="children.id", index=True, nullable=False, ondelete="CASCADE"
    )
    scheduled_date: date | None = Field(default=None, nullable=True)
    submitted_at: datetime | None = Field(
        default=None, nullable=True, sa_type=DateTime(timezone=True)
    )
    status: str = Field(max_length=20, default="pending", nullable=False)
    reviewed_at: datetime | None = Field(
        default=None, nullable=True, sa_type=DateTime(timezone=True)
    )
    rejection_note: str | None = Field(default=None, nullable=True)


class WalletTransaction(SQLModel, table=True):
    """A ledger entry against a child's wallet balance.

    A ``credit`` is written when a rewarded submission is approved (linked via
    ``task_submission_id``); the balance is the running sum of credits minus
    debits. Deleting a submission sets ``task_submission_id`` to null but keeps
    the ledger row, so history is never lost.
    """

    __tablename__: str = "wallet_transactions"

    id: UUID = Field(
        default_factory=uuid4, primary_key=True, index=True, nullable=False
    )
    child_id: UUID = Field(
        foreign_key="children.id", index=True, nullable=False, ondelete="CASCADE"
    )
    task_submission_id: UUID | None = Field(
        default=None,
        foreign_key="task_submissions.id",
        nullable=True,
        ondelete="SET NULL",
    )
    # Ledger entry in **points** (whole numbers); API exposes it as `amount_points`.
    amount: Decimal = Field(sa_type=sa.Numeric(10, 2), nullable=False)
    transaction_type: str = Field(max_length=20, nullable=False)  # "credit" | "debit"
    description: str | None = Field(default=None, nullable=True)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        nullable=False,
        sa_type=DateTime(timezone=True),
    )
