"""Application entry point — builds and wires the FastAPI app.

Owns the cross-cutting setup that every request relies on: the lifespan hooks
(dev seeding, re-arming limbo purges, the daily duty-slot job), global
exception handlers that normalise error bodies, the OpenAPI tag descriptions,
CORS, and mounting the versioned API router. Run with ``uvicorn main:app``.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError

from src.api.routes import api_router
from src.core.config import settings
from src.dev.seed import DEV_USER_EMAIL, seed_dev_fixtures
from src.services.tasks import start_daily_maintenance, stop_daily_maintenance

# Never log secrets (codes, passwords, PINs, hashes, JWTs); log the non-enumerable
# user_id, not the email. Every module gets its logger via getLogger(__name__).
logging.basicConfig(
    level=settings.LOG_LEVEL,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run startup and shutdown work around the app's serving lifetime.

    On startup: optionally seed the dev user and start the daily maintenance loop
    (duty-slot generation + limbo-account purge). On shutdown (after ``yield``):
    cancel that loop so the process exits cleanly.
    """
    logger.info("EarnIt API starting up")
    if settings.DISABLE_AUTH:
        logger.warning(
            "DISABLE_AUTH=true — JWT auth is OFF; all requests run as %s",
            DEV_USER_EMAIL,
        )
        await seed_dev_fixtures()
    await start_daily_maintenance()
    yield
    await stop_daily_maintenance()
    logger.info("EarnIt API shutting down")


app = FastAPI(
    lifespan=lifespan,
    swagger_ui_parameters={"persistAuthorization": True},
    openapi_tags=[
        {
            "name": "auth/session",
            "description": "Session management — register, login, logout",
        },
        {
            "name": "auth/verification",
            "description": "Email verification — confirm and resend the account code",
        },
        {
            "name": "auth/pin",
            "description": "Parental PIN — set, update, and verify the dashboard PIN",
        },
        {
            "name": "auth/recovery",
            "description": (
                "Account recovery — reset forgotten password or PIN by email"
            ),
        },
        {
            "name": "profiles/family",
            "description": "Family summary — parent profile and children list",
        },
        {
            "name": "profiles/children",
            "description": "Child profile management — create and deactivate",
        },
        {
            "name": "tasks/management",
            "description": "Task CRUD — parent creates and manages tasks",
        },
        {
            "name": "tasks/submissions",
            "description": "Submission review — parent approves or rejects",
        },
        {
            "name": "children/tasks",
            "description": "Child task view — list tasks and submit completions",
        },
        {
            "name": "children/wallet",
            "description": "Child wallet — balance and transaction history",
        },
        {"name": "system", "description": "Health check"},
    ],
)


# Catch any unhandled database uniqueness failures and return a clean 409.
# Routes that want a more specific message catch IntegrityError themselves first.
@app.exception_handler(IntegrityError)
async def integrity_error_handler(
    request: Request, exc: IntegrityError
) -> JSONResponse:
    """Turn an uncaught DB uniqueness violation into a clean 409 response."""
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
    """Serialise HTTPException, preserving dict details as the top-level body."""
    content = exc.detail if isinstance(exc.detail, dict) else {"detail": exc.detail}
    return JSONResponse(
        status_code=exc.status_code, content=content, headers=exc.headers
    )


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
