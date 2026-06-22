"""add users.point_value_eur (points→€ rate)

Revision ID: c4e1a0b7f2d9
Revises: 13fa8854eaea
Create Date: 2026-06-21 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c4e1a0b7f2d9"
down_revision: str | Sequence[str] | None = "13fa8854eaea"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add the per-parent points→€ exchange rate. Additive only — existing rows get
    the default 0.01; nothing else is touched. (Rewards/balances reuse the existing
    Numeric reward_amount/amount columns to hold whole-number points.)"""
    op.add_column(
        "users",
        sa.Column(
            "point_value_eur",
            sa.Numeric(precision=10, scale=4),
            nullable=False,
            server_default="0.01",
        ),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("users", "point_value_eur")
