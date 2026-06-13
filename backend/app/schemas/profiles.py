from datetime import date

from pydantic import BaseModel, Field


class ChildCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    birth_date: date | None = None
    avatar_url: str | None = None
