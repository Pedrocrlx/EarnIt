import re

from pydantic import BaseModel, EmailStr, field_validator

from app.config import settings


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    family_name: str | None = None

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
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


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class VerifyCodeRequest(BaseModel):
    code: str


class PinRequest(BaseModel):
    pin: str

    @field_validator("pin")
    @classmethod
    def validate_pin(cls, v: str) -> str:
        pattern = r"\d{" + str(settings.PARENT_PIN_LENGTH) + r"}"
        if not re.fullmatch(pattern, v):
            raise ValueError(f"PIN must be exactly {settings.PARENT_PIN_LENGTH} digits (0–9)")
        return v
