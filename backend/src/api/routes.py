from fastapi import APIRouter

from src.api.auth import router as auth_router
from src.api.children import router as children_router
from src.api.profiles import router as profiles_router
from src.api.tasks import router as tasks_router

api_router = APIRouter()


@api_router.get("/health", tags=["system"])
async def health_check():
    return {"status": "ok"}


api_router.include_router(auth_router)
api_router.include_router(profiles_router)
api_router.include_router(tasks_router)
api_router.include_router(children_router)
