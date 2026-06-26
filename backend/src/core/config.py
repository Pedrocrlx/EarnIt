from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str
    POSTGRES_DB: str
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:5173"]

    # JWT
    SECRET_KEY: str

    # Email (Mailpit in Docker; override MAIL_SERVER=localhost for local dev)
    MAIL_FROM: str = "noreply@earnit.app"
    MAIL_SERVER: str = "mailpit"
    MAIL_PORT: int = 1025
    MAIL_USERNAME: str = ""
    MAIL_PASSWORD: str = ""

    # --- Password ---
    PASSWORD_MIN_LENGTH: int = 12
    PASSWORD_SPECIAL_CHARS: str = "!@#$%^&*()_+\\-=\\[\\]{};':\"\\\\|,.<>\\/?"

    # --- Email Verification ---
    VERIFICATION_CODE_CHARSET: str = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    VERIFICATION_CODE_LENGTH: int = 6
    # Codes are stateless (see app/services/verification.py); one global lifetime
    # applies to account verification, password reset, and PIN reset alike.
    VERIFICATION_CODE_EXPIRY_MINUTES: int = 10
    ACCOUNT_LIMBO_PURGE_HOURS: int = 24

    # --- Session Lifetimes ---
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 30
    PENDING_VERIFICATION_TOKEN_EXPIRE_MINUTES: int = 60 * 24

    # --- Profiles ---
    MAX_CHILDREN_PER_USER: int = 10
    MIN_CHILDREN_FOR_ONBOARDING: int = 1

    # --- Parental PIN ---
    PARENT_PIN_LENGTH: int = 4

    # --- Logging ---
    LOG_LEVEL: str = "INFO"

    # --- Dev ---
    # Disables JWT auth and returns a seeded dev user on every request.
    # NEVER enable in production.
    DISABLE_AUTH: bool = True


settings = Settings()
