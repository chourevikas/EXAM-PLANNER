from typing import Any, cast
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.types import JSON, DateTime, BigInteger, Integer

# Portable JSON type: Uses PostgreSQL native JSONB when running on PostgreSQL,
# and falls back to standard JSON / string storage on SQLite/MySQL.
PortableJSON = cast(Any, JSON().with_variant(JSONB, "postgresql"))

# Timezone-Aware DateTime type for PostgreSQL TIMESTAMPTZ & SQLite compatibility
DateTimeTZ = cast(Any, DateTime(timezone=True))

# Portable BigInteger type: Uses PostgreSQL native BIGINT (64-bit) when running on PostgreSQL,
# and falls back to standard Integer on SQLite.
BigIntPK = cast(Any, BigInteger().with_variant(Integer, "sqlite"))


