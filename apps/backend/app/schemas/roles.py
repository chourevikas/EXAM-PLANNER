from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, field_validator
from app.db.models.user import UserRole

CUSTOM_ROLE_ALLOWED_BASE_TYPES = (UserRole.ADMIN, UserRole.TEACHER)


class PermissionOut(BaseModel):
    id: int
    key: str
    label: str
    description: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class RoleOut(BaseModel):
    id: int
    name: str
    slug: str
    base_role_type: UserRole
    is_system: bool
    description: Optional[str] = None
    permission_keys: List[str] = []
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RoleCreatePayload(BaseModel):
    name: str
    base_role_type: UserRole
    description: Optional[str] = None
    permission_keys: List[str] = []

    @field_validator("base_role_type")
    @classmethod
    def validate_base_role_type(cls, value: UserRole) -> UserRole:
        if value not in CUSTOM_ROLE_ALLOWED_BASE_TYPES:
            raise ValueError(
                "Custom roles may only be based on ADMIN or TEACHER — "
                "SUPER_ADMIN-level access cannot be granted via a custom role."
            )
        return value


class RoleUpdatePayload(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    permission_keys: Optional[List[str]] = None


class UserRoleAssignmentPayload(BaseModel):
    role_id: int
