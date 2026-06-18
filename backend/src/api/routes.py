"""Top-level API router — aggregates every feature router under one app.

Mounts the auth, profiles, tasks, and children routers (each carrying its own
``/api/v1/...`` prefix) and exposes the unauthenticated ``/health`` probe.
``main.py`` includes the resulting ``api_router`` into the FastAPI app.
"""

from fastapi import APIRouter

from src.api.auth import router as auth_router
from src.api.children import router as children_router
from src.api.profiles import router as profiles_router
from src.api.tasks import router as tasks_router

api_router = APIRouter()


@api_router.get("/health", tags=["system"])
async def health_check():
    """Liveness probe — returns 200 so load balancers know the app is up."""
    return {"status": "ok"}


api_router.include_router(auth_router)
api_router.include_router(profiles_router)
api_router.include_router(tasks_router)
api_router.include_router(children_router)
