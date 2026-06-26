"""tasks hard delete: drop tasks.is_active, snapshot title on submissions

Drops the task soft-delete flag and lets tasks be hard-deleted while keeping
their submissions: ``task_submissions.task_id`` becomes nullable with an
``ON DELETE SET NULL`` FK, and a ``task_title`` snapshot column preserves the
deleted task's name on its orphaned submissions.

Revision ID: f3a9c1d2e4b5
Revises: e2d7a4c9f1b6
Create Date: 2026-06-25 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f3a9c1d2e4b5"
down_revision: str | Sequence[str] | None = "e2d7a4c9f1b6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_FK = "task_submissions_task_id_fkey"


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_column("tasks", "is_active")

    op.add_column(
        "task_submissions",
        sa.Column("task_title", sa.String(length=150), nullable=True),
    )
    # Recreate the task_id FK so deleting a task nulls the link (keeping the row)
    # instead of cascade-deleting the submission.
    op.drop_constraint(_FK, "task_submissions", type_="foreignkey")
    op.alter_column(
        "task_submissions", "task_id", existing_type=sa.Uuid(), nullable=True
    )
    op.create_foreign_key(
        _FK,
        "task_submissions",
        "tasks",
        ["task_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Orphaned submissions (task_id NULL) can't be restored to a real task; drop
    # them so the NOT NULL + CASCADE FK can be re-established.
    op.execute("DELETE FROM task_submissions WHERE task_id IS NULL")
    op.drop_constraint(_FK, "task_submissions", type_="foreignkey")
    op.alter_column(
        "task_submissions", "task_id", existing_type=sa.Uuid(), nullable=False
    )
    op.create_foreign_key(
        _FK,
        "task_submissions",
        "tasks",
        ["task_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.drop_column("task_submissions", "task_title")

    op.add_column(
        "tasks",
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.alter_column("tasks", "is_active", server_default=None)
