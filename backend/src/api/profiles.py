"""Child profiles & family view: create/deactivate children, view the family summary.

All three routes require a full access_token session (see
app/dependencies/auth.py). Creating a child re-checks the onboarding trigger
(app/services/accounts.maybe_complete_onboarding) — this may be the second of
its two conditions (PIN set in app/routers/auth/pin.py + >=1 child) to become
true.
"""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.db.database import get_session
from src.dependencies.auth import get_current_user
from src.models.auth import Child, User
from src.schemas.profiles import (
    ChildCreateRequest,
    UpdateFamilyNameRequest,
    UpdateFamilyNameResponse,
)
from src.services.accounts import maybe_complete_onboarding

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/profiles")


@router.patch("/family-name")
async def update_family_name(
    body: UpdateFamilyNameRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> UpdateFamilyNameResponse:
    current_user.family_name = body.family_name
    await session.commit()
    logger.info("Family name updated: user_id=%s", current_user.id)
    await maybe_complete_onboarding(current_user, session)
    return UpdateFamilyNameResponse(status="success", family_name=body.family_name)


@router.post("/children", status_code=201, tags=["profiles/children"])
async def create_child(
    body: ChildCreateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    count = await session.scalar(select(func.count()).where(Child.user_id == current_user.id))
    if count >= settings.MAX_CHILDREN_PER_USER:
        logger.info("Child profile creation blocked: cap reached (user_id=%s)", current_user.id)
        raise HTTPException(
            status_code=409,
            detail={
                "error": "children_cap_reached",
                "message": "Maximum number of child profiles reached.",
            },
        )

    child = Child(
        user_id=current_user.id,
        name=body.name,
        birth_date=body.birth_date,
        avatar_url=body.avatar_url,
    )
    session.add(child)
    await session.commit()

    await maybe_complete_onboarding(current_user, session)

    logger.info("Child profile created: user_id=%s, child_id=%s", current_user.id, child.id)
    return {
        "id": child.id,
        "user_id": child.user_id,
        "name": child.name,
        "birth_date": child.birth_date,
        "avatar_url": child.avatar_url,
        "is_active": child.is_active,
    }


@router.patch("/children/{child_id}", tags=["profiles/children"])
async def deactivate_child(
    child_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    child = await session.get(Child, child_id)
    if child is None or child.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Child profile not found.")

    if not child.is_active:
        raise HTTPException(status_code=409, detail="Child profile is already inactive.")

    child.is_active = False
    await session.commit()

    logger.info("Child profile deactivated: user_id=%s, child_id=%s", current_user.id, child.id)
    return {
        "status": "success",
        "message": "Child profile deactivated.",
        "id": child.id,
        "is_active": child.is_active,
    }


@router.get("/family", tags=["profiles/family"])
async def get_family(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(Child).where(Child.user_id == current_user.id))
    children = result.scalars().all()

    return {
        "id": current_user.id,
        "family_name": current_user.family_name,
        "onboarding_completed": current_user.onboarding_completed,
        "children": [
            {
                "id": child.id,
                "name": child.name,
                "birth_date": child.birth_date,
                "avatar_url": child.avatar_url,
                "is_active": child.is_active,
            }
            for child in children
        ],
    }
