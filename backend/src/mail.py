"""Email transport — the shared FastMail client and its SMTP configuration.

Exposes a single ``mail`` instance used by every email-sending code path
(account verification, password reset, PIN reset). Templates live in
``src/email/`` and are rendered with Jinja2 by fastapi-mail.
"""

from pathlib import Path

from fastapi_mail import (
    ConnectionConfig,
    FastMail,
)

from src.config import Settings, settings

# HTML templates live in src/email/ and are rendered by Jinja2 inside fastapi-mail.
_TEMPLATE_FOLDER = Path(__file__).parent / "email"


def create_mail_client(config: Settings) -> FastMail:
    """Build the shared SMTP transport for Mailpit or an authenticated relay."""
    return FastMail(
        ConnectionConfig(
            MAIL_FROM=config.MAIL_FROM,
            MAIL_SERVER=config.MAIL_SERVER,
            MAIL_PORT=config.MAIL_PORT,
            MAIL_USERNAME=config.MAIL_USERNAME,
            MAIL_PASSWORD=config.MAIL_PASSWORD,
            MAIL_STARTTLS=config.MAIL_STARTTLS,
            MAIL_SSL_TLS=config.MAIL_SSL_TLS,
            USE_CREDENTIALS=config.MAIL_USE_CREDENTIALS,
            VALIDATE_CERTS=config.MAIL_VALIDATE_CERTS,
            TEMPLATE_FOLDER=_TEMPLATE_FOLDER,
        )
    )


mail = create_mail_client(settings)
