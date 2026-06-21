from collections.abc import AsyncGenerator

import asyncpg
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlmodel import SQLModel

import src.database as app_database
import src.models.auth
import src.models.goals  # registers the goals table with SQLModel.metadata
import src.models.tasks  # noqa: F401 — registers task tables with SQLModel.metadata
import src.services.tasks.submissions as app_tasks_submissions
from src.config import settings
from src.database import get_session

# ---------------------------------------------------------------------------
# Shared test data & helpers
#
# Imported across test modules as `from tests.conftest import ...` (works
# because tests/__init__.py makes `tests` a package). Centralized here so the
# example account and the register/verify/cookie boilerplate aren't
# duplicated per feature test file.
# ---------------------------------------------------------------------------

# The example parent account used across test modules to exercise
# register -> verify -> (login/pin/profile/...) flows.
VALID_USER = {
    "email": "user@example.com",
    "password": "Password123!",
    "family_name": "Silva",
}

_REGISTER_URL = "/api/v1/auth/register"
_VERIFY_URL = "/api/v1/auth/verify"


def extract_cookie(response, name: str) -> str | None:
    """Read a cookie from a response, falling back to parsing Set-Cookie directly
    (some flows issue multiple Set-Cookie headers that httpx's jar doesn't expose)."""
    return response.cookies.get(name) or next(
        (
            part.split("=", 1)[1].split(";")[0]
            for part in response.headers.get("set-cookie", "").split(",")
            if f"{name}=" in part
        ),
        None,
    )


async def register_and_verify(client: AsyncClient, mock_mail, **overrides) -> str:
    """Register + verify an account, returning its access_token cookie value.

    Defaults to VALID_USER; pass field overrides (e.g. email="other@example.com")
    to register an independent account.
    """
    payload = {**VALID_USER, **overrides}
    reg = await client.post(_REGISTER_URL, json=payload)
    pending_token = extract_cookie(reg, "pending_verification_token")
    code = mock_mail[-1].template_body["code"]
    verify_res = await client.post(
        _VERIFY_URL,
        json={"code": code},
        cookies={"pending_verification_token": pending_token},
    )
    return extract_cookie(verify_res, "access_token")


# Fixtures


@pytest_asyncio.fixture(scope="session")
async def db_engine():
    # Run against a dedicated "<db>_test" database, never the dev database — the
    # teardown below does `drop_all`, which would otherwise wipe the dev schema
    # (leaving alembic_version stuck at head with no tables, breaking `make up-ba`).
    test_db_name = f"{settings.POSTGRES_DB}_test"

    # CREATE DATABASE can't run inside a transaction, so use a raw asyncpg
    # connection to the default database to create it if it doesn't exist yet.
    conn = await asyncpg.connect(
        user=settings.POSTGRES_USER,
        password=settings.POSTGRES_PASSWORD,
        host=settings.POSTGRES_HOST,
        port=settings.POSTGRES_PORT,
        database=settings.POSTGRES_DB,
    )
    try:
        await conn.execute(f'CREATE DATABASE "{test_db_name}"')
    except asyncpg.DuplicateDatabaseError:
        pass
    finally:
        await conn.close()

    test_url = settings.database_url.rsplit("/", 1)[0] + f"/{test_db_name}"
    engine = create_async_engine(test_url, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)

    # src.services.tasks.submissions imported AsyncSessionLocal (bound to the dev
    # database) by name for its daily maintenance loop — repoint that reference and
    # the db module attribute at the test database for the test session, so the loop
    # sees the same data as the rest of the test fixtures.
    test_session_factory = async_sessionmaker(engine, expire_on_commit=False)
    original_database_factory = app_database.AsyncSessionLocal
    original_submissions_factory = app_tasks_submissions.AsyncSessionLocal
    app_database.AsyncSessionLocal = test_session_factory
    app_tasks_submissions.AsyncSessionLocal = test_session_factory

    yield engine

    app_database.AsyncSessionLocal = original_database_factory
    app_tasks_submissions.AsyncSessionLocal = original_submissions_factory
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(db_engine) -> AsyncGenerator[AsyncSession]:
    session_factory = async_sessionmaker(db_engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session
        await session.execute(text("DELETE FROM children"))
        await session.execute(text("DELETE FROM users"))
        await session.commit()


@pytest.fixture(autouse=True, scope="session")
def _force_auth_on():
    """Keep DISABLE_AUTH off during tests, regardless of config.py or .env."""
    original = settings.DISABLE_AUTH
    settings.DISABLE_AUTH = False
    yield
    settings.DISABLE_AUTH = original


@pytest.fixture
def mock_mail(monkeypatch):
    """Patches mail.send_message; returns list of captured MessageSchema objects."""
    captured = []

    async def _fake_send(message, template_name=None):
        captured.append(message)

    monkeypatch.setattr("src.mail.mail.send_message", _fake_send)
    return captured


@pytest_asyncio.fixture
async def client(db_engine) -> AsyncGenerator[AsyncClient]:
    """HTTP test client wired to the FastAPI app with the test DB session override."""
    from main import app  # imported here to avoid circular issues at module load

    session_factory = async_sessionmaker(db_engine, expire_on_commit=False)

    async def override_get_session():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_session] = override_get_session

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac

    app.dependency_overrides.clear()

    async with session_factory() as s:
        await s.execute(text("DELETE FROM children"))
        await s.execute(text("DELETE FROM users"))
        await s.commit()
