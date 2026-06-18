"""Auth router package — mounts every /api/v1/auth/* endpoint.

Each auth concern lives in its own module (register, verification, login,
logout, password recovery, PIN, PIN recovery); this file wires them onto a
single shared ``/api/v1/auth`` router for the top-level API to include.
"""

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
