"""Application settings — read from the environment (and ``.env``), with defaults.

Each setting is read from a matching environment variable. Secrets and the
database connection are *required* (`_require` raises at import if missing, so the
app fails to boot rather than running half-configured); everything else falls back
to a sensible default and can be overridden via the environment or ``.env``.
``load_dotenv()`` populates ``os.environ`` from ``.env`` for local dev and tests;
in Docker/CI the variables come from the environment directly.
"""

import json
import os

from dotenv import load_dotenv

load_dotenv()


def _require(key: str) -> str:
    """Return a required env var, or raise so the app refuses to start without it."""
    value = os.environ.get(key)
    if not value:
        raise RuntimeError(f"Required environment variable {key} is not set")
    return value


def _str(key: str, default: str) -> str:
    return os.environ.get(key, default)


def _int(key: str, default: int) -> int:
    return int(os.environ.get(key, default))


def _bool(key: str, default: bool) -> bool:
    raw = os.environ.get(key)
    if raw is None:
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


def _csv(key: str, default: list[str]) -> list[str]:
    """Parse a list setting: a JSON array (e.g. ``["a","b"]``) or plain ``a,b``."""
    raw = os.environ.get(key)
    if not raw:
        return default
    raw = raw.strip()
    if raw.startswith("["):
        return json.loads(raw)
    return [item.strip() for item in raw.split(",")]


class Settings:
    """Typed application settings. A plain (mutable) instance so tests can override
    individual fields; grouped by concern below."""

    def __init__(self) -> None:
        # Database
        self.POSTGRES_USER = _require("POSTGRES_USER")
        self.POSTGRES_PASSWORD = _require("POSTGRES_PASSWORD")
        self.POSTGRES_DB = _require("POSTGRES_DB")
        self.POSTGRES_HOST = _str("POSTGRES_HOST", "localhost")
        self.POSTGRES_PORT = _int("POSTGRES_PORT", 5432)

        # CORS
        self.CORS_ORIGINS = _csv(
            "CORS_ORIGINS", ["http://localhost:3000", "http://localhost:5173"]
        )

        # JWT
        self.SECRET_KEY = _require("SECRET_KEY")

        # Email (Mailpit in Docker; override MAIL_SERVER=localhost for local dev)
        self.MAIL_FROM = _str("MAIL_FROM", "noreply@earnit.app")
        self.MAIL_SERVER = _str("MAIL_SERVER", "mailpit")
        self.MAIL_PORT = _int("MAIL_PORT", 1025)
        self.MAIL_USERNAME = _str("MAIL_USERNAME", "")
        self.MAIL_PASSWORD = _str("MAIL_PASSWORD", "")

        # Password
        self.PASSWORD_MIN_LENGTH = _int("PASSWORD_MIN_LENGTH", 12)
        self.PASSWORD_SPECIAL_CHARS = _str(
            "PASSWORD_SPECIAL_CHARS", "!@#$%^&*()_+\\-=\\[\\]{};':\"\\\\|,.<>\\/?"
        )

        # Email Verification — codes are stateless; one global lifetime applies to
        # account verification, password reset, and PIN reset alike.
        self.VERIFICATION_CODE_CHARSET = _str(
            "VERIFICATION_CODE_CHARSET", "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
        )
        self.VERIFICATION_CODE_LENGTH = _int("VERIFICATION_CODE_LENGTH", 6)
        self.VERIFICATION_CODE_EXPIRY_MINUTES = _int(
            "VERIFICATION_CODE_EXPIRY_MINUTES", 10
        )
        self.ACCOUNT_LIMBO_PURGE_HOURS = _int("ACCOUNT_LIMBO_PURGE_HOURS", 24)

        # Session Lifetimes
        self.ACCESS_TOKEN_EXPIRE_MINUTES = _int(
            "ACCESS_TOKEN_EXPIRE_MINUTES", 60 * 24 * 30
        )
        self.PENDING_VERIFICATION_TOKEN_EXPIRE_MINUTES = _int(
            "PENDING_VERIFICATION_TOKEN_EXPIRE_MINUTES", 60 * 24
        )

        # Profiles
        self.MAX_CHILDREN_PER_USER = _int("MAX_CHILDREN_PER_USER", 10)
        self.AVATAR_UPLOAD_DIR = _str("AVATAR_UPLOAD_DIR", "/app/uploads/avatars")
        self.AVATAR_MAX_BYTES = _int("AVATAR_MAX_BYTES", 5 * 1024 * 1024)
        self.SUBMISSION_PROOF_UPLOAD_DIR = _str(
            "SUBMISSION_PROOF_UPLOAD_DIR", "/app/uploads/submission-proofs"
        )
        self.SUBMISSION_PROOF_MAX_BYTES = _int(
            "SUBMISSION_PROOF_MAX_BYTES", 5 * 1024 * 1024
        )

        # Parental PIN
        self.PARENT_PIN_LENGTH = _int("PARENT_PIN_LENGTH", 4)

        # Logging
        self.LOG_LEVEL = _str("LOG_LEVEL", "INFO")

        # Dev — disables JWT auth and returns a seeded dev user on every request.
        # NEVER enable in production.
        self.DISABLE_AUTH = _bool("DISABLE_AUTH", False)

    @property
    def database_url(self) -> str:
        """Build the asyncpg SQLAlchemy DSN from the POSTGRES_* settings."""
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )


settings = Settings()
