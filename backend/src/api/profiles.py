"""Child profiles & family view: create/deactivate children, view the family summary.

All three routes require a full access_token session (see
app/dependencies.py). Creating a child re-checks the onboarding trigger
(app/services/accounts.maybe_complete_onboarding) — this may be the second of
its two conditions (PIN set in app/routers/auth/pin.py + >=1 child) to become
true.
"""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.database import get_session
from src.dependencies import get_current_user
from src.models.auth import Child, User
from src.schemas.profiles import (
    ChildCreateRequest,
    UpdateFamilyNameRequest,
    UpdateFamilyNameResponse,
)
from src.services.accounts import maybe_complete_onboarding

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/profiles")


@router.patch(
    "/family-name", tags=["profiles/family"], summary="Set the family display name"
)
async def update_family_name(
    body: UpdateFamilyNameRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> UpdateFamilyNameResponse:
    """Update the parent's family display name.

    Part of the onboarding flow. May mark onboarding as complete if a PIN and at
    least one child profile are already set.
    """
    current_user.family_name = body.family_name
    await session.commit()
    logger.info("Family name updated: user_id=%s", current_user.id)
    await maybe_complete_onboarding(current_user, session)
    return UpdateFamilyNameResponse(status="success", family_name=body.family_name)


@router.post(
    "/children",
    status_code=201,
    tags=["profiles/children"],
    summary="Add a child profile",
)
async def create_child(
    body: ChildCreateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Create a child profile linked to the authenticated parent.

    Each parent can have up to `MAX_CHILDREN_PER_USER` active children (default 10);
    returns 409 (`children_cap_reached`) if the limit is hit. The returned `id` is
    the `child_id` used by task, submission, and wallet endpoints. May complete
    onboarding if the parental PIN is already set.
    """
    count = await session.scalar(
        select(func.count()).where(Child.user_id == current_user.id)
    )
    if count >= settings.MAX_CHILDREN_PER_USER:
        logger.info(
            "Child profile creation blocked: cap reached (user_id=%s)", current_user.id
        )
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

    logger.info(
        "Child profile created: user_id=%s, child_id=%s", current_user.id, child.id
    )
    return {
        "id": child.id,
        "user_id": child.user_id,
        "name": child.name,
        "birth_date": child.birth_date,
        "avatar_url": child.avatar_url,
        "is_active": child.is_active,
    }


@router.patch(
    "/children/{child_id}",
    tags=["profiles/children"],
    summary="Deactivate a child profile",
)
async def deactivate_child(
    child_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Soft-delete a child profile by setting `is_active = false`.

    Tasks and submission history are preserved. No new duty slots will be generated
    for an inactive child. Returns 404 if the child does not belong to the current
    user, 409 if the profile is already inactive.
    """
    child = await session.get(Child, child_id)
    if child is None or child.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Child profile not found.")

    if not child.is_active:
        raise HTTPException(
            status_code=409, detail="Child profile is already inactive."
        )

    child.is_active = False
    await session.commit()

    logger.info(
        "Child profile deactivated: user_id=%s, child_id=%s", current_user.id, child.id
    )
    return {
        "status": "success",
        "message": "Child profile deactivated.",
        "id": child.id,
        "is_active": child.is_active,
    }


@router.get("/family", tags=["profiles/family"], summary="Get family summary")
async def get_family(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Return the authenticated parent's profile with all their child profiles.

    Includes both active and inactive children. Use the child `id` values returned
    here as the `child_id` path parameter for task, submission, and wallet endpoints.
    """
    result = await session.execute(
        select(Child).where(Child.user_id == current_user.id)
    )
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
