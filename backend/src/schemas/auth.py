"""Auth request schemas — validated bodies for the /auth/* endpoints.

Covers registration, login, email verification, password reset, and the
parental PIN (set + reset). Password and PIN fields are validated against the
strength/format rules in ``settings`` via the shared helpers below, so a bad
value is rejected with 422 before any handler runs.
"""

import re

from pydantic import BaseModel, EmailStr, field_validator

from src.core.config import settings


def _validate_password_strength(v: str) -> str:
    """Enforce the password policy, listing every unmet rule at once.

    Checks minimum length plus the presence of an upper-case letter, a
    lower-case letter, a digit, and a special character. Raises ``ValueError``
    (surfaced by Pydantic as 422) naming all missing requirements together, so
    the user fixes them in one pass rather than one error at a time.
    """
    errors = []
    if len(v) < settings.PASSWORD_MIN_LENGTH:
        errors.append(f"at least {settings.PASSWORD_MIN_LENGTH} characters")
    if not re.search(r"[A-Z]", v):
        errors.append("one uppercase letter")
    if not re.search(r"[a-z]", v):
        errors.append("one lowercase letter")
    if not re.search(r"\d", v):
        errors.append("one digit")
    if not re.search(f"[{settings.PASSWORD_SPECIAL_CHARS}]", v):
        errors.append("one special character")
    if errors:
        raise ValueError("Password must contain: " + ", ".join(errors))
    return v


class RegisterRequest(BaseModel):
    """Body for ``POST /register`` — new account credentials."""

    email: EmailStr
    password: str
    family_name: str | None = None

    model_config = {
        "json_schema_extra": {
            "example": {
                "email": "maria.silva@example.com",
                "password": "SecurePass123!",
                "family_name": "Família Silva",
            }
        }
    }

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        return _validate_password_strength(v)


class LoginRequest(BaseModel):
    """Body for ``POST /login`` — email and password to exchange for a session."""

    email: EmailStr
    password: str

    model_config = {
        "json_schema_extra": {
            "example": {
                "email": "maria.silva@example.com",
                "password": "SecurePass123!",
            }
        }
    }


class VerifyCodeRequest(BaseModel):
    """Body for ``POST /verify`` — the emailed account-verification code."""

    code: str

    model_config = {"json_schema_extra": {"example": {"code": "482910"}}}


class ForgotPasswordRequest(BaseModel):
    """Body for ``POST /forgot-password`` — email to send a reset code to."""

    email: EmailStr

    model_config = {
        "json_schema_extra": {"example": {"email": "maria.silva@example.com"}}
    }


class ResetPasswordRequest(BaseModel):
    """Body for ``POST /reset-password`` — code plus the new password to set."""

    email: EmailStr
    code: str
    new_password: str

    model_config = {
        "json_schema_extra": {
            "example": {
                "email": "maria.silva@example.com",
                "code": "293847",
                "new_password": "NewSecurePass456!",
            }
        }
    }

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v: str) -> str:
        return _validate_password_strength(v)


def _validate_pin_format(v: str) -> str:
    """Require the PIN to be exactly ``PARENT_PIN_LENGTH`` digits (0–9)."""
    pattern = r"\d{" + str(settings.PARENT_PIN_LENGTH) + r"}"
    if not re.fullmatch(pattern, v):
        raise ValueError(f"PIN must be exactly {settings.PARENT_PIN_LENGTH} digits (0–9)")
    return v


class PinRequest(BaseModel):
    """Body for setting or verifying the parental PIN (``/pin``, ``/verify-pin``)."""

    pin: str

    model_config = {"json_schema_extra": {"example": {"pin": "1234"}}}

    @field_validator("pin")
    @classmethod
    def validate_pin(cls, v: str) -> str:
        return _validate_pin_format(v)


class ResetPinRequest(BaseModel):
    """Body for ``POST /reset-pin`` — reset code plus the new PIN to set."""

    code: str
    new_pin: str

    model_config = {
        "json_schema_extra": {"example": {"code": "748291", "new_pin": "5678"}}
    }

    @field_validator("new_pin")
    @classmethod
    def validate_new_pin(cls, v: str) -> str:
        return _validate_pin_format(v)
