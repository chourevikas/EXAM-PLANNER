import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
  PROJECT_NAME: str = "Exam Planner AI API"
  API_V1_STR: str = "/api/v1"
  
  # Security
  SECRET_KEY: str = "secret-key-change-in-production-1234567890"
  ALGORITHM: str = "HS256"
  ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
  REFRESH_TOKEN_EXPIRE_DAYS: int = 7
  
  # Database
  DATABASE_URL: str = "postgresql://postgres:root@localhost:5432/exam_db"

  # AWS S3 Storage Config
  AWS_ACCESS_KEY_ID: str = ""
  AWS_SECRET_ACCESS_KEY: str = ""
  AWS_REGION: str = "ap-southeast-2"
  AWS_S3_BUCKET_NAME: str = "exam-paper-storage"

  class Config:
    env_file = ".env"
    extra = "allow"

settings = Settings()
