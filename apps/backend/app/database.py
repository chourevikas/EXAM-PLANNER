from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import settings

# For SQLite compatibility
connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
  settings.DATABASE_URL,
  connect_args=connect_args,
  echo=False,
  pool_pre_ping=True,  # Proactively check connection liveness to handle AWS RDS idle timeouts instantly
  pool_recycle=300,    # Recycle connections every 5 minutes to prevent stale sockets
  pool_size=10,
  max_overflow=20,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
  db = SessionLocal()
  try:
    yield db
  finally:
    db.close()
