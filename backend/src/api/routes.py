from fastapi import APIRouter

# Import sub-routers for modularity
from src.api.auth import router as auth_router
from src.api.profiles import router as profiles_router

# Central API Router
api_router = APIRouter()


# Health check - system endpoint
@api_router.get("/health", tags=["system"])
async def health_check():
    return {"status": "ok"}


# Include sub-routers for authentication and profile management
api_router.include_router(auth_router)
api_router.include_router(profiles_router)
