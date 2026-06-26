"""Goal domain model — a child's wishlist item and its approval lifecycle.

A child profile requests a goal (a free-text wish); the parent rejects it or
approves it with a point value. Once the child's wallet balance reaches that
value the parent redeems it, spending the points via a wallet ``debit``. Identity
models live in ``src.models.auth``; the wallet ledger lives in ``src.models.tasks``.
"""

from datetime import UTC, datetime
from uuid import UUID, uuid4

import sqlalchemy as sa
from sqlalchemy import DateTime
from sqlmodel import Field, SQLModel


class Goal(SQLModel, table=True):
    """A goal a child wishes for, moving through request → approval → redeem.

    ``status`` walks ``requested`` (child asked) → ``approved`` (parent set a
    ``target_amount`` value) **or** ``rejected`` (kept but hidden from the child),
    and from ``approved`` → ``redeemed`` (terminal; paid via a wallet ``debit``).
    A child may hold many goals — there is no uniqueness on ``child_id``.
    """

    __tablename__: str = "goals"

    id: UUID = Field(
        default_factory=uuid4, primary_key=True, index=True, nullable=False
    )
    # CASCADE: goals are removed when the child profile is deleted
    child_id: UUID = Field(
        foreign_key="children.id", index=True, nullable=False, ondelete="CASCADE"
    )
    name: str = Field(max_length=120, nullable=False)  # the child's request text
    # requested | approved | rejected | redeemed
    status: str = Field(max_length=20, default="requested", nullable=False)
    # NULL until the parent approves and sets the amount the child must "pay"
    target_amount: int | None = Field(default=None, sa_type=sa.Integer, nullable=True)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        nullable=False,
        sa_type=DateTime(timezone=True),
    )
