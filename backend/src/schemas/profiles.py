"""Profile schemas — bodies and responses for family/child management."""

from datetime import date
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator


class ChildCreateRequest(BaseModel):
    """Body for ``POST /profiles/children`` — a new child profile."""

    name: str = Field(min_length=1, max_length=100)
    birth_date: date | None = None
    avatar_url: str | None = None


class ChildUpdateRequest(BaseModel):
    """Body for updating editable child-profile details."""

    birth_date: date | None

    @field_validator("birth_date")
    @classmethod
    def birth_date_cannot_be_in_the_future(cls, value: date | None) -> date | None:
        if value is not None and value > date.today():
            raise ValueError("Birth date cannot be in the future.")
        return value


class UpdateFamilyNameRequest(BaseModel):
    """Body for ``PATCH /profiles/family-name`` — the family display name."""

    family_name: str = Field(min_length=1, max_length=150)


class UpdateFamilyNameResponse(BaseModel):
    """Response echoing the saved family name after an update."""

    status: str
    family_name: str


class SetPointValueRequest(BaseModel):
    """Body for ``PATCH /profiles/point-value`` — the family's €-per-point rate."""

    point_value_eur: Decimal = Field(gt=0, le=1000, max_digits=10, decimal_places=4)

    model_config = {"json_schema_extra": {"example": {"point_value_eur": "0.015"}}}


class SetPointValueResponse(BaseModel):
    """Response echoing the saved exchange rate."""

    status: str
    point_value_eur: Decimal


class PointValueResponse(BaseModel):
    """The family's current points→€ rate — what one point is worth in euros."""

    point_value_eur: Decimal
