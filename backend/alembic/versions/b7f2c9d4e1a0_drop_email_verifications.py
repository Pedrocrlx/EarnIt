"""drop email_verifications (verification codes are now stateless)

Revision ID: b7f2c9d4e1a0
Revises: 3138ec56d59a
Create Date: 2026-06-11

Verification codes moved to a stateless service layer (app/services/verification.py):
each code is an HMAC derived from the user's id, the code purpose, and the user's
updated_at anchor — so there is no longer any row to persist.
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b7f2c9d4e1a0"
down_revision: Union[str, Sequence[str], None] = "3138ec56d59a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_index(op.f("ix_email_verifications_user_id"), table_name="email_verifications")
    op.drop_index(op.f("ix_email_verifications_id"), table_name="email_verifications")
    op.drop_table("email_verifications")


def downgrade() -> None:
    """Downgrade schema."""
    op.create_table(
        "email_verifications",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("purpose", sa.String(length=30), nullable=False),
        sa.Column("code_hash", sa.String(length=255), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_email_verifications_id"), "email_verifications", ["id"], unique=False)
    op.create_index(
        op.f("ix_email_verifications_user_id"), "email_verifications", ["user_id"], unique=False
    )
