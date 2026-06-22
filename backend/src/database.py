"""Database configuration and session management."""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from src.config import settings

engine = create_async_engine(
    settings.database_url,
    echo=False,
    # Validate a pooled connection before handing it out — cloud Postgres and
    # Docker restarts silently drop idle connections, which otherwise surface as
    # a "server closed the connection unexpectedly" on the next request.
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_session() -> AsyncGenerator[AsyncSession]:
    """Yield a request-scoped async DB session as a FastAPI dependency.

    The session is opened per request and the ``async with`` block guarantees
    it is closed (and any open transaction rolled back) once the request ends,
    even if the handler raises.
    """
    async with AsyncSessionLocal() as session:
        yield session
