import re

from pydantic import BaseModel, EmailStr, field_validator

from src.core.config import settings


def _validate_password_strength(v: str) -> str:
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
    code: str

    model_config = {"json_schema_extra": {"example": {"code": "482910"}}}


class ForgotPasswordRequest(BaseModel):
    email: EmailStr

    model_config = {
        "json_schema_extra": {"example": {"email": "maria.silva@example.com"}}
    }


class ResetPasswordVerifyRequest(BaseModel):
    email: EmailStr
    code: str

    model_config = {
        "json_schema_extra": {
            "example": {
                "email": "maria.silva@example.com",
                "code": "293847",
            }
        }
    }


class ResetPasswordRequest(BaseModel):
    new_password: str

    model_config = {
        "json_schema_extra": {"example": {"new_password": "NewSecurePass456!"}}
    }

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v: str) -> str:
        return _validate_password_strength(v)


def _validate_pin_format(v: str) -> str:
    pattern = r"\d{" + str(settings.PARENT_PIN_LENGTH) + r"}"
    if not re.fullmatch(pattern, v):
        raise ValueError(f"PIN must be exactly {settings.PARENT_PIN_LENGTH} digits (0–9)")
    return v


class PinRequest(BaseModel):
    pin: str

    model_config = {"json_schema_extra": {"example": {"pin": "1234"}}}

    @field_validator("pin")
    @classmethod
    def validate_pin(cls, v: str) -> str:
        return _validate_pin_format(v)


class ResetPinRequest(BaseModel):
    code: str
    new_pin: str

    model_config = {
        "json_schema_extra": {"example": {"code": "748291", "new_pin": "5678"}}
    }

    @field_validator("new_pin")
    @classmethod
    def validate_new_pin(cls, v: str) -> str:
        return _validate_pin_format(v)
