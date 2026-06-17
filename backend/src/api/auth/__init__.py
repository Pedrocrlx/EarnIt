from fastapi import APIRouter

from src.api.auth import (
    forgot_password,
    login,
    logout,
    pin,
    pin_reset,
    register,
    reset_password,
    verification,
)

router = APIRouter(prefix="/api/v1/auth")
router.include_router(register.router)
router.include_router(verification.router)
router.include_router(login.router)
router.include_router(logout.router)
router.include_router(forgot_password.router)
router.include_router(reset_password.router)
router.include_router(pin.router)
router.include_router(pin_reset.router)
