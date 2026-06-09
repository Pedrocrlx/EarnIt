from pathlib import Path

from fastapi_mail import ConnectionConfig, FastMail

from app.config import settings

# HTML templates live in app/templates/email/ and are rendered by Jinja2 inside fastapi-mail.
_TEMPLATE_FOLDER = Path(__file__).parent / "templates" / "email"

# Shared FastMail instance used by all email-sending code paths.
# Mailpit (dev) acts as a no-auth SMTP sink on port 1025; production would
# swap in real SMTP credentials via environment variables.
_config = ConnectionConfig(
    MAIL_FROM=settings.MAIL_FROM,
    MAIL_SERVER=settings.MAIL_SERVER,
    MAIL_PORT=settings.MAIL_PORT,
    MAIL_USERNAME=settings.MAIL_USERNAME,
    MAIL_PASSWORD=settings.MAIL_PASSWORD,
    MAIL_STARTTLS=False,
    MAIL_SSL_TLS=False,
    USE_CREDENTIALS=False,
    VALIDATE_CERTS=False,
    TEMPLATE_FOLDER=_TEMPLATE_FOLDER,
)

mail = FastMail(_config)
