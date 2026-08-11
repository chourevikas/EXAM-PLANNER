import enum


class UserRole(str, enum.Enum):
    STUDENT = "STUDENT"
    ADMIN = "ADMIN"
    SUPER_ADMIN = "SUPER_ADMIN"


class UserStatus(str, enum.Enum):
    PENDING = "PENDING"
    ACTIVE = "ACTIVE"
    SUSPENDED = "SUSPENDED"
    DELETED = "DELETED"
    REJECTED = "REJECTED"


class QuestionStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    REVIEW = "REVIEW"
    PENDING_HUMAN_REVIEW = "PENDING_HUMAN_REVIEW"
    PUBLISHED = "PUBLISHED"
    ARCHIVED = "ARCHIVED"
    REJECTED = "REJECTED"


class QuestionSourceType(str, enum.Enum):
    PYQ = "PYQ"
    STATIC_MOCK = "STATIC_MOCK"

class DifficultyLevel(str, enum.Enum):
    EASY = "EASY"
    MEDIUM = "MEDIUM"
    HARD = "HARD"


class LanguageCode(str, enum.Enum):
    ENGLISH = "ENGLISH"
    HINDI = "HINDI"
    MARATHI = "MARATHI"
    TAMIL = "TAMIL"
    BILINGUAL = "BILINGUAL"


class TestType(str, enum.Enum):
    FULL_LENGTH = "FULL_LENGTH"
    SUBJECT_MOCK = "SUBJECT_MOCK"
    AI_ADAPTIVE = "AI_ADAPTIVE"
    REVISION_FLASHTEST = "REVISION_FLASHTEST"


class AttemptStatus(str, enum.Enum):
    IN_PROGRESS = "IN_PROGRESS"
    SUBMITTED = "SUBMITTED"
    EVALUATED = "EVALUATED"
    ABANDONED = "ABANDONED"


class BloomsLevel(str, enum.Enum):
    REMEMBER = "REMEMBER"
    UNDERSTAND = "UNDERSTAND"
    APPLY = "APPLY"
    ANALYZE = "ANALYZE"
    EVALUATE = "EVALUATE"


class MemoryType(str, enum.Enum):
    PASSAGE = "PASSAGE"
    CASE_STUDY = "CASE_STUDY"
    SHARED_TABLE = "SHARED_TABLE"
    GENERAL_INSTRUCTION = "GENERAL_INSTRUCTION"


class AssetType(str, enum.Enum):
    DIAGRAM = "DIAGRAM"
    FIGURE = "FIGURE"
    MAP = "MAP"
    TABLE_IMAGE = "TABLE_IMAGE"

class StudyActivityType(str, enum.Enum):
    REVISION = "REVISION"
    NEW_TOPIC = "NEW_TOPIC"
    ANSWER_WRITING = "ANSWER_WRITING"
    PYQ = "PYQ"
    MOCK_TEST = "MOCK_TEST"
    CURRENT_AFFAIRS = "CURRENT_AFFAIRS"
    OTHER = "OTHER"

class ActivitySource(str, enum.Enum):
    PLANNED = "PLANNED"
    UNPLANNED = "UNPLANNED"
