"""Profile schemas — bodies and responses for family/child management."""

from datetime import date

from pydantic import BaseModel, Field


class ChildCreateRequest(BaseModel):
    """Body for ``POST /profiles/children`` — a new child profile."""

    name: str = Field(min_length=1, max_length=100)
    birth_date: date | None = None
    avatar_url: str | None = None


class UpdateFamilyNameRequest(BaseModel):
    """Body for ``PATCH /profiles/family-name`` — the family display name."""

    family_name: str = Field(min_length=1, max_length=150)


class UpdateFamilyNameResponse(BaseModel):
    """Response echoing the saved family name after an update."""

    status: str
    family_name: str
