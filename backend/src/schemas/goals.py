"""Goal schemas — request/response models for the goals endpoints.

A child requests a goal (``GoalRequestCreate``); the parent approves it with a
point value (``GoalApproveRequest``). ``GoalResponse`` is a plain serialisation of
the ``Goal`` row, and ``GoalListResponse`` wraps the list with the child's current
balance so the frontend can derive whether each approved goal is within reach.
"""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field


class GoalRequestCreate(BaseModel):
    """Body for ``POST /children/{child_id}/goals`` — the child's wish text."""

    name: str = Field(min_length=1, max_length=120)

    model_config = {"json_schema_extra": {"example": {"name": "Ir ao parque aquático"}}}


class GoalApproveRequest(BaseModel):
    """Body for approve — the point value the parent sets on the goal."""

    target_points: int = Field(gt=0)

    model_config = {"json_schema_extra": {"example": {"target_points": 500}}}


class GoalResponse(BaseModel):
    """Serialised ``Goal`` returned by the goal endpoints."""

    id: UUID
    child_id: UUID
    name: str
    status: str  # requested | approved | rejected | redeemed
    target_points: int | None  # null until approved
    created_at: datetime

    model_config = {"from_attributes": True}


class GoalListResponse(BaseModel):
    """A child's goals plus the balance needed to judge "within reach".

    The frontend derives each approved goal's "reached" state itself:
    ``balance_points >= goal.target_points``. € is the frontend's concern — multiply
    points by ``point_value_eur``.
    """

    child_id: UUID
    balance_points: int
    point_value_eur: Decimal
    goals: list[GoalResponse]
