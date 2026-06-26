from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.database import get_session
from src.dependencies.auth import get_current_user
from src.models.auth import User
from src.schemas.settings import SettingsResponse, SettingsUpdateRequest
from src.services.settings import get_or_create_settings, update_settings

router = APIRouter(prefix="/api/v1/settings")


@router.get("", response_model=SettingsResponse, tags=["settings"])
async def get_settings_endpoint(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SettingsResponse:
    settings = await get_or_create_settings(current_user, session)
    return SettingsResponse(points_per_euro=settings.points_per_euro)


@router.patch("", response_model=SettingsResponse, tags=["settings"])
async def update_settings_endpoint(
    body: SettingsUpdateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SettingsResponse:
    settings = await update_settings(current_user, body, session)
    return SettingsResponse(points_per_euro=settings.points_per_euro)
