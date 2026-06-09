from datetime import date, datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import DateTime
from sqlmodel import Field, Relationship, SQLModel


class User(SQLModel, table=True):
    __tablename__: str = "users"

    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True, nullable=False)
    email: str = Field(max_length=320, unique=True, index=True, nullable=False)
    password_hash: str = Field(max_length=255, nullable=False)
    parent_pin_hash: str | None = Field(default=None, max_length=255, nullable=True)
    pin_set_at: datetime | None = Field(
        default=None, nullable=True, sa_type=DateTime(timezone=True)
    )
    family_name: str | None = Field(default=None, max_length=150, nullable=True)
    is_active: bool = Field(default=True, nullable=False)
    onboarding_completed: bool = Field(default=False, nullable=False)
    # null while in "limbo"; stamped on code redemption — login refused until set
    email_verified_at: datetime | None = Field(
        default=None, nullable=True, sa_type=DateTime(timezone=True)
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        nullable=False,
        sa_type=DateTime(timezone=True),
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        nullable=False,
        sa_type=DateTime(timezone=True),
    )

    children: list["Child"] = Relationship(back_populates="user")
    # 1-to-N issued code history — enables expiry checks, resend cooldowns, and audit trails
    verification_codes: list["EmailVerification"] = Relationship(back_populates="user")


class Child(SQLModel, table=True):
    __tablename__: str = "children"

    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True, nullable=False)
    # CASCADE: child rows are removed when the parent user is deleted
    user_id: UUID = Field(foreign_key="users.id", index=True, nullable=False, ondelete="CASCADE")
    name: str = Field(max_length=100, nullable=False)
    birth_date: date | None = Field(default=None, nullable=True)
    avatar_url: str | None = Field(default=None, nullable=True)
    is_active: bool = Field(default=True, nullable=False)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        nullable=False,
        sa_type=DateTime(timezone=True),
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        nullable=False,
        sa_type=DateTime(timezone=True),
    )

    user: User = Relationship(back_populates="children")


# one row per issued verification code; backs account verification, password reset, and PIN reset
class EmailVerification(SQLModel, table=True):
    __tablename__: str = "email_verifications"

    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True, nullable=False)
    # CASCADE: verification rows are removed when the parent user is deleted
    user_id: UUID = Field(foreign_key="users.id", index=True, nullable=False, ondelete="CASCADE")
    purpose: str = Field(
        max_length=30, nullable=False
    )  # 'account_verification' | 'password_reset' | 'pin_reset'
    code_hash: str = Field(
        max_length=255, nullable=False
    )  # salted hash only — plaintext exists solely in the outbound email
    # serves as both the entry deadline and the earliest moment a resend becomes eligible
    expires_at: datetime = Field(nullable=False, sa_type=DateTime(timezone=True))
    # stamped on successful redemption; prevents the same code from being replayed
    consumed_at: datetime | None = Field(
        default=None, nullable=True, sa_type=DateTime(timezone=True)
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        nullable=False,
        sa_type=DateTime(timezone=True),
    )

    user: User = Relationship(back_populates="verification_codes")
