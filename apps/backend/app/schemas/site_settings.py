from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator

ALLOWED_THEMES = {"crimson", "ocean", "forest", "royal"}


class ThemeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    theme_name: str
    updated_at: datetime


class ThemeUpdatePayload(BaseModel):
    theme_name: str

    @field_validator("theme_name")
    @classmethod
    def validate_theme_name(cls, value: str) -> str:
        if value not in ALLOWED_THEMES:
            raise ValueError(
                f"theme_name must be one of {sorted(ALLOWED_THEMES)}"
            )
        return value
