from fastapi import APIRouter, Depends, Response

from app.dependencies.auth import get_current_user
from app.models.models import User

router = APIRouter()


@router.post("/logout")
async def logout(response: Response, current_user: User = Depends(get_current_user)):
    # get_current_user already enforces a valid, active session (401/403 otherwise),
    # so by this point we just need to drop the cookie. delete_cookie sets Max-Age=0,
    # which tells the browser to discard it immediately.
    response.delete_cookie(key="access_token", path="/")
    return {"status": "success", "message": "Logged out successfully."}
