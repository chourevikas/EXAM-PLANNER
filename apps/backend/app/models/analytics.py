import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
import enum
from app.database import Base

class TestType(str, enum.Enum):
    MOCK = "MOCK"
    PYQ = "PYQ"
    PRACTICE = "PRACTICE"

class TestSubmission(Base):
    __tablename__ = "test_submissions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    test_id = Column(String(255), nullable=False, index=True)
    test_type = Column(Enum(TestType), nullable=False)
    
    score = Column(Float, default=0.0)
    total_questions = Column(Integer, default=0)
    attempted = Column(Integer, default=0)
    correct = Column(Integer, default=0)
    incorrect = Column(Integer, default=0)
    time_taken_seconds = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", backref="test_submissions")
    analysis = relationship("TestAnalysis", back_populates="submission", uselist=False, cascade="all, delete-orphan")


class TestAnalysis(Base):
    __tablename__ = "test_analysis"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    submission_id = Column(String(36), ForeignKey("test_submissions.id", ondelete="CASCADE"), nullable=False, unique=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Psychometric & Behavior Analysis
    decision_accuracy_direct_hits_percent = Column(Float, default=0.0)
    decision_accuracy_partial_percent = Column(Float, default=0.0)
    
    behavior_question_jumping_count = Column(Integer, default=0)
    behavior_option_hesitation_avg_seconds = Column(Float, default=0.0)
    behavior_avg_time_per_question_seconds = Column(Float, default=0.0)
    
    predicted_rank_percentile = Column(Float, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    submission = relationship("TestSubmission", back_populates="analysis")
    user = relationship("User", backref="test_analyses")
