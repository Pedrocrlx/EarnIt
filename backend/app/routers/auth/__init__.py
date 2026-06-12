from fastapi import APIRouter

from app.routers.auth import login, logout, register, verification

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])
router.include_router(register.router)
router.include_router(verification.router)
router.include_router(login.router)
router.include_router(logout.router)
