from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.types import JSON

# Portable JSON type: Uses PostgreSQL native JSONB when running on PostgreSQL,
# and falls back to standard JSON / string storage on SQLite/MySQL.
PortableJSON = JSON().with_variant(JSONB, "postgresql")
