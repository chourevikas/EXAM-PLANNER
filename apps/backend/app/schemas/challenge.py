import enum
from datetime import datetime
from typing import Optional, List, Dict
from pydantic import BaseModel
from app.db.models.enums import DifficultyLevel
from app.db.models.challenge import ChallengeVisibility, ChallengeStatus, ChallengeAttemptStatus


class ChallengeDuration(str, enum.Enum):
    """How long the challenge stays open for new attempts after creation."""
    ONE_DAY = "ONE_DAY"
    THREE_DAYS = "THREE_DAYS"
    ONE_WEEK = "ONE_WEEK"
    TWO_WEEKS = "TWO_WEEKS"
    ONE_MONTH = "ONE_MONTH"
    NO_LIMIT = "NO_LIMIT"


class CreateChallengeRequest(BaseModel):
    title: str
    description: Optional[str] = None
    question_count: int = 10
    difficulty: Optional[DifficultyLevel] = None
    subject_name: Optional[str] = None  # legacy single subject; prefer subject_names
    subject_names: List[str] = []
    exam_type_id: Optional[int] = None  # legacy single exam; prefer exam_type_ids
    exam_type_ids: List[int] = []
    years: List[int] = []
    time_limit_minutes: int = 15
    visibility: ChallengeVisibility = ChallengeVisibility.INVITE_ONLY
    duration: ChallengeDuration = ChallengeDuration.ONE_WEEK


class ChallengeSummary(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    question_count: int
    time_limit_minutes: int
    visibility: ChallengeVisibility
    status: ChallengeStatus
    share_token: str
    creator_id: int
    creator_name: Optional[str] = None
    created_at: datetime
    expires_at: Optional[datetime] = None
    attempt_count: int = 0
    my_best_score: Optional[float] = None
    subject_name: Optional[str] = None
    subject_names: List[str] = []
    difficulty: Optional[DifficultyLevel] = None
    exam_name: Optional[str] = None
    years: List[int] = []
    # A user gets one attempt per challenge: has_attempted means it is already submitted.
    has_attempted: bool = False
    has_in_progress: bool = False


class ChallengeExamOption(BaseModel):
    id: int
    name: str
    years: List[int]
    # subject name -> years in which this exam has published questions for it
    subject_years: Dict[str, List[int]] = {}


class ChallengeOptions(BaseModel):
    exams: List[ChallengeExamOption]
    years: List[int]
    # Same shape as ChallengeExamOption.subject_years, across every exam
    subject_years: Dict[str, List[int]] = {}


class ChallengePublicPreview(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    question_count: int
    time_limit_minutes: int
    creator_name: Optional[str] = None
    share_token: str
    expires_at: Optional[datetime] = None
    is_expired: bool = False


class InviteUserRequest(BaseModel):
    email: str


class ChallengeQuestionOption(BaseModel):
    option_id: int
    option_label: str
    text: str


class ChallengeQuestionOut(BaseModel):
    question_id: int
    order_index: int
    text: str
    options: List[ChallengeQuestionOption]


class StartChallengeAttemptResponse(BaseModel):
    attempt_id: int
    challenge_id: int
    questions: List[ChallengeQuestionOut]
    time_limit_minutes: int


class SaveChallengeResponseRequest(BaseModel):
    question_id: int
    selected_option_id: Optional[int] = None
    time_spent_seconds: float = 0.0


class SubmitChallengeAttemptResponse(BaseModel):
    attempt_id: int
    total_score: float
    total_correct: int
    total_incorrect: int
    total_unattempted: int
    time_spent_seconds: float


class LeaderboardEntry(BaseModel):
    user_id: int
    user_name: str
    total_score: float
    total_correct: int
    time_spent_seconds: float
    submitted_at: Optional[datetime] = None
    is_current_user: bool = False


class UserLookupResult(BaseModel):
    id: int
    full_name: str
    email: str
