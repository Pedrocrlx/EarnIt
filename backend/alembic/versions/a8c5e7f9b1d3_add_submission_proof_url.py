"""add submission proof url

Revision ID: a8c5e7f9b1d3
Revises: f3a9c1d2e4b5
Create Date: 2026-06-25
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "a8c5e7f9b1d3"
down_revision: str | Sequence[str] | None = "f3a9c1d2e4b5"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "task_submissions",
        sa.Column("proof_url", sa.String(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("task_submissions", "proof_url")
