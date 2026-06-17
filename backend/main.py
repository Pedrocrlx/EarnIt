import logging
from contextlib import asynccontextmanager
from datetime import UTC, datetime

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from src.api.routes import api_router
from src.core.config import settings
from src.db.database import AsyncSessionLocal
from src.logging_config import configure_logging
from src.models.auth import User
from src.security.hashing import hash_secret
from src.services import accounts
from src.services.tasks import start_daily_slot_job, stop_daily_slot_job

configure_logging()
logger = logging.getLogger(__name__)

_DEV_USER_EMAIL = "dev@earnit.local"


async def _seed_dev_user() -> None:
    async with AsyncSessionLocal() as session:
        exists = await session.scalar(select(User).where(User.email == _DEV_USER_EMAIL))
        if exists:
            return
        user = User(
            email=_DEV_USER_EMAIL,
            family_name="Dev Family",
            password_hash=await hash_secret("dev-no-login"),
            is_active=True,
            email_verified_at=datetime.now(UTC),
            onboarding_completed=True,
        )
        session.add(user)
        await session.commit()
        logger.warning("DISABLE_AUTH: seeded dev user %s (id=%s)", _DEV_USER_EMAIL, user.id)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("EarnIt API starting up")
    if settings.DISABLE_AUTH:
        logger.warning("DISABLE_AUTH=true — JWT auth is OFF; all requests run as %s", _DEV_USER_EMAIL)
        await _seed_dev_user()
    # Reconstruct a limbo-purge task for every still-unverified account, so pending
    # purges survive a restart (their deadline is derived from users.created_at).
    await accounts.rearm_pending_purges()
    await start_daily_slot_job()
    yield
    await accounts.cancel_pending_purges()
    await stop_daily_slot_job()
    logger.info("EarnIt API shutting down")


app = FastAPI(
    lifespan=lifespan,
    swagger_ui_parameters={"persistAuthorization": True},
    openapi_tags=[
        {"name": "auth/basic",        "description": "Session management — register, login, logout"},
        {"name": "auth/validations",  "description": "Code and PIN checks — email verify, forgot-password/verify, verify-pin"},
        {"name": "auth/resets",       "description": "Password and PIN recovery — set, forgot, reset"},
        {"name": "profiles/family",   "description": "Family summary — parent profile and children list"},
        {"name": "profiles/children", "description": "Child profile management — create and deactivate"},
        {"name": "tasks/management",  "description": "Task CRUD — parent creates and manages tasks"},
        {"name": "tasks/submissions", "description": "Submission review — parent approves or rejects"},
        {"name": "children/tasks",    "description": "Child task view — list tasks and submit completions"},
        {"name": "children/wallet",   "description": "Child wallet — balance and transaction history"},
        {"name": "system",            "description": "Health check"},
    ],
)


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


app.include_router(api_router)

# Allow the frontend dev servers and any origins listed in settings to send
# credentialed requests (cookies).
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
