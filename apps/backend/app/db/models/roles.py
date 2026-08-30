from datetime import datetime, timezone
from typing import Optional, List, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship
from app.db.models.enums import UserRole
from app.db.models.types import DateTimeTZ

if TYPE_CHECKING:
    from app.db.models.user import User


class Permission(SQLModel, table=True):
    __tablename__ = "permissions"

    id: Optional[int] = Field(default=None, primary_key=True)
    key: str = Field(unique=True, index=True, max_length=100)
    label: str = Field(max_length=255)
    description: Optional[str] = Field(default=None)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )

    role_links: List["RolePermission"] = Relationship(back_populates="permission")


class Role(SQLModel, table=True):
    __tablename__ = "roles"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(unique=True, index=True, max_length=100)
    slug: str = Field(unique=True, index=True, max_length=100)
    base_role_type: UserRole = Field(default=UserRole.ADMIN)
    is_system: bool = Field(default=False)
    description: Optional[str] = Field(default=None)
    created_by_id: Optional[int] = Field(
        default=None, foreign_key="users.id", ondelete="SET NULL"
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )

    permission_links: List["RolePermission"] = Relationship(
        back_populates="role", sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )


class RolePermission(SQLModel, table=True):
    __tablename__ = "role_permissions"

    role_id: int = Field(foreign_key="roles.id", ondelete="CASCADE", primary_key=True)
    permission_id: int = Field(
        foreign_key="permissions.id", ondelete="CASCADE", primary_key=True
    )
    granted_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )

    role: Optional[Role] = Relationship(back_populates="permission_links")
    permission: Optional[Permission] = Relationship(back_populates="role_links")


class RoleAssignmentLog(SQLModel, table=True):
    __tablename__ = "role_assignment_logs"

    id: Optional[int] = Field(default=None, primary_key=True)
    target_user_id: int = Field(
        foreign_key="users.id", ondelete="CASCADE", index=True
    )
    changed_by_admin_id: Optional[int] = Field(
        default=None, foreign_key="users.id", ondelete="SET NULL"
    )
    previous_role: Optional[UserRole] = Field(default=None)
    previous_custom_role_id: Optional[int] = Field(default=None)
    new_role: UserRole
    new_custom_role_id: Optional[int] = Field(default=None)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_type=DateTimeTZ,
    )
