import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi_mail import MessageSchema, MessageType
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_session
from app.logging_config import configure_logging
from app.mail import mail
from app.routers import auth as auth_router
from app.routers import profiles as profiles_router
from app.services import accounts

configure_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("EarnIt API starting up")
    # Reconstruct a limbo-purge task for every still-unverified account, so pending
    # purges survive a restart (their deadline is derived from users.created_at).
    await accounts.rearm_pending_purges()
    yield
    await accounts.cancel_pending_purges()
    logger.info("EarnIt API shutting down")


app = FastAPI(lifespan=lifespan)


# Catch any unhandled database uniqueness failures and return a clean 409.
# Routes that want a more specific message catch IntegrityError themselves first.
@app.exception_handler(IntegrityError)
async def integrity_error_handler(request: Request, exc: IntegrityError) -> JSONResponse:
    return JSONResponse(status_code=409, content={"detail": "Resource already exists."})


# This overrides FastAPI's default HTTPException handler, which always wraps `detail`
# as {"detail": ...}. Routes that raise structured errors — e.g.
# HTTPException(403, detail={"error": "account_disabled", "message": "..."}) — need
# {"error": ..., "message": ...} at the top level to match the spec, so:
#   - dict detail  -> used as-is for the response body (no "detail" wrapper)
#   - string detail -> kept as {"detail": "..."} for backwards compatibility
# If a 403/409/etc. response body looks "double-nested" or missing fields during
# debugging, check whether this handler is firing as expected.
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    content = exc.detail if isinstance(exc.detail, dict) else {"detail": exc.detail}
    return JSONResponse(status_code=exc.status_code, content=content, headers=exc.headers)


app.include_router(auth_router.router)
app.include_router(profiles_router.router)

# Allow the frontend dev servers and any origins listed in settings to send
# credentialed requests (cookies).
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/healthz")
async def health_check(session: AsyncSession = Depends(get_session)):
    # Real readiness probe: confirm the DB round-trips, so orchestrators detect a
    # dead database instead of a process that is merely "up".
    try:
        await session.execute(text("SELECT 1"))
    except Exception:
        return JSONResponse(status_code=503, content={"status": "degraded"})
    return {"status": "ok"}


@app.post("/test-email")
async def send_test_email():
    """Dev endpoint: fires a test email through Mailpit SMTP to confirm the mail pipeline.

    Open http://localhost:8025 in a browser to see the captured message.
    """
    message = MessageSchema(
        subject="EarnIt – Mailpit Test",
        recipients=["test@example.com"],
        body="<h1>Mail pipeline OK</h1><p>fastapi-mail → Mailpit is working.</p>",
        subtype=MessageType.html,
    )
    await mail.send_message(message)
    return {"status": "success", "message": "Test email sent via SMTP → Mailpit."}
