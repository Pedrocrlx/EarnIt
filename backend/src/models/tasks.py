from datetime import UTC, date, datetime
from decimal import Decimal
from uuid import UUID, uuid4

import sqlalchemy as sa
from sqlalchemy import DateTime, UniqueConstraint
from sqlmodel import Field, SQLModel


class Task(SQLModel, table=True):
    __tablename__: str = "tasks"

    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True, nullable=False)
    user_id: UUID = Field(foreign_key="users.id", index=True, nullable=False, ondelete="CASCADE")
    child_id: UUID = Field(foreign_key="children.id", index=True, nullable=False, ondelete="CASCADE")
    title: str = Field(max_length=150, nullable=False)
    description: str | None = Field(default=None, nullable=True)
    task_type: str = Field(max_length=20, nullable=False)  # "duty" | "extra_task"
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
    __tablename__: str = "task_submissions"
    __table_args__ = (
        UniqueConstraint("task_id", "scheduled_date", name="uq_task_submissions_task_date"),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True, nullable=False)
    task_id: UUID = Field(foreign_key="tasks.id", index=True, nullable=False, ondelete="CASCADE")
    child_id: UUID = Field(foreign_key="children.id", index=True, nullable=False, ondelete="CASCADE")
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
    __tablename__: str = "wallet_transactions"

    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True, nullable=False)
    child_id: UUID = Field(foreign_key="children.id", index=True, nullable=False, ondelete="CASCADE")
    task_submission_id: UUID | None = Field(
        default=None,
        foreign_key="task_submissions.id",
        nullable=True,
        ondelete="SET NULL",
    )
    amount: Decimal = Field(sa_type=sa.Numeric(10, 2), nullable=False)
    transaction_type: str = Field(max_length=20, nullable=False)  # "credit" | "debit"
    description: str | None = Field(default=None, nullable=True)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        nullable=False,
        sa_type=DateTime(timezone=True),
    )
