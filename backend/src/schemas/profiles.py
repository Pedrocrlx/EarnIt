from datetime import date

from pydantic import BaseModel, Field


class ChildCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    birth_date: date | None = None
    avatar_url: str | None = None

    model_config = {
        "json_schema_extra": {
            "example": {
                "name": "João Silva",
                "birth_date": "2016-03-15",
                "avatar_url": "https://example.com/avatars/joao.png",
            }
        }
    }
