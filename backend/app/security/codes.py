import secrets

from app.config import settings


def generate_verification_code() -> str:
    """Return a cryptographically random code drawn from VERIFICATION_CODE_CHARSET."""
    return "".join(
        secrets.choice(settings.VERIFICATION_CODE_CHARSET)
        for _ in range(settings.VERIFICATION_CODE_LENGTH)
    )
