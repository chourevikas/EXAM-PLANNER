from app.db.models.enums import (
    UserRole,
    UserStatus,
    QuestionStatus,
    QuestionSourceType,
    ExamStatus,
    DifficultyLevel,
    LanguageCode,
    TestType,
    AttemptStatus,
    AttemptMode,
    QuestionResponseStatus,
    BloomsLevel,
    MemoryType,
    AssetType,
)
from app.db.models.types import PortableJSON, DateTimeTZ
from app.db.models.user import (
    User,
    SubscriptionTier,
    StudentProfile,
    AdminProfile,
    AdminApprovalLog,
    AdminActionLog,
    RefreshToken,
    QuestionBookmark,
)
from app.db.models.exam_type import ExamType
from app.db.models.question_report import QuestionReport
from app.db.models.hierarchy import Exam, SyllabusVersion, Subject, Topic, Subtopic
from app.db.models.passage import Passage, PassageTranslation
from app.db.models.question import (
    Question,
    QuestionTranslation,
    QuestionOption,
    OptionTranslation,
    QuestionAsset,
)
from app.db.models.question_option_reasoning import QuestionOptionReasoning
from app.db.models.metadata import QuestionMetadata
from app.db.models.telemetry import (
    Test,
    TestQuestion,
    UserTestAttempt,
    UserQuestionResponse,
    QuestionSwitchLog,
    UserConceptRetention,
)
from app.db.models.analytics import (
    ExamAttempt,
    ExamQuestionResponse,
    UserMemoryState,
    UserSkillProfile,
    UserTaxonomyMastery,
    ExamQuestionReport,
    ExamAttemptReport,
    UserSkillProgressionReport,
    PracticeAnswer,
)
from app.db.models.review import HumanReviewTask
from app.db.models.subscription import (
    BillingInterval,
    SubscriptionStatus,
    SubscriptionSource,
    PlatformFeature,
    SubscriptionPlan,
    PlanFeatureLink,
    UserSubscription,
)
from app.db.models.discount import (
    DiscountType,
    DiscountOffer,
    DiscountRedemption,
    DiscountPlanLink,
)
from app.db.models.subscription_audit import (
    SubscriptionAuditAction,
    SubscriptionAuditLog,
)
from app.db.models.explanation import QuestionExplanation
from app.db.models.pipeline_run import PipelineRun
from app.db.models.hierarchy_link import QuestionHierarchyLink
from app.db.models.answer_key import (
    SetMatchStatus,
    MappingStatus,
    AnswerKeyBatch,
    AnswerKeyMapping,
)
from app.db.models.gamification import Badge, UserBadge, XPLog, LeaderboardSnapshot
from app.db.models.study_plan import StudyTask, StudyActivity
from app.db.models.notification import Notification
from app.db.models.roles import Permission, Role, RolePermission, RoleAssignmentLog
from app.db.models.teacher import TeacherProfile, ReviewPointsLog, TeacherReward

__all__ = [
    "UserRole",
    "UserStatus",
    "QuestionStatus",
    "QuestionSourceType",
    "DifficultyLevel",
    "LanguageCode",
    "TestType",
    "AttemptStatus",
    "AttemptMode",
    "QuestionResponseStatus",
    "BloomsLevel",
    "MemoryType",
    "AssetType",
    "PortableJSON",
    "User",
    "SubscriptionTier",
    "StudentProfile",
    "AdminProfile",
    "AdminApprovalLog",
    "RefreshToken",
    "QuestionBookmark",
    "Exam",
    "SyllabusVersion",
    "Subject",
    "Topic",
    "Subtopic",
    "Passage",
    "PassageTranslation",
    "Question",
    "QuestionTranslation",
    "QuestionOption",
    "OptionTranslation",
    "QuestionAsset",
    "QuestionMetadata",
    "QuestionExplanation",
    "PipelineRun",
    "QuestionHierarchyLink",
    "Test",
    "TestQuestion",
    "UserTestAttempt",
    "UserQuestionResponse",
    "QuestionSwitchLog",
    "UserConceptRetention",
    "ExamAttempt",
    "ExamQuestionResponse",
    "UserMemoryState",
    "UserSkillProfile",
    "UserTaxonomyMastery",
    "ExamQuestionReport",
    "ExamAttemptReport",
    "UserSkillProgressionReport",
    "PracticeAnswer",
    "HumanReviewTask",
    "BillingInterval",
    "SubscriptionStatus",
    "SubscriptionSource",
    "PlatformFeature",
    "SubscriptionPlan",
    "PlanFeatureLink",
    "UserSubscription",
    "DiscountType",
    "DiscountOffer",
    "DiscountRedemption",
    "DiscountPlanLink",
    "SubscriptionAuditAction",
    "SubscriptionAuditLog",
    "SetMatchStatus",
    "MappingStatus",
    "AnswerKeyBatch",
    "AnswerKeyMapping",
    "Badge",
    "UserBadge",
    "XPLog",
    "LeaderboardSnapshot",
    "StudyTask",
    "StudyActivity",
    "ExamStatus",
    "Notification",
    "Permission",
    "Role",
    "RolePermission",
    "RoleAssignmentLog",
    "TeacherProfile",
    "ReviewPointsLog",
    "TeacherReward",
]

from app.db.models.testimonial import Testimonial, TestimonialStatus
from app.db.models.current_affairs import CurrentAffair
from app.db.models.teacher import RedemptionRequest
from app.db.models.enums import RedemptionStatus
from app.db.models.challenge import (
    Challenge,
    ChallengeVisibility,
    ChallengeStatus,
    ChallengeAttemptStatus,
    ChallengeInviteStatus,
    ChallengeQuestion,
    ChallengeInvite,
    ChallengeAttempt,
    ChallengeResponse,
)

__all__.extend([
    "Challenge",
    "ChallengeVisibility",
    "ChallengeStatus",
    "ChallengeAttemptStatus",
    "ChallengeInviteStatus",
    "ChallengeQuestion",
    "ChallengeInvite",
    "ChallengeAttempt",
    "ChallengeResponse",
])

__all__.extend(["ExamType", "Testimonial", "TestimonialStatus", "CurrentAffair", "RedemptionRequest", "RedemptionStatus"])

from app.db.models.site_settings import SiteSettings

__all__.extend(["SiteSettings"])


from app.db.models.knowledge import (
    KnowledgeConcept,
    KnowledgeEntity,
    KnowledgeAlias,
    QuestionConcept,
    QuestionEntity,
    KnowledgeRelationship,
    QuestionRelationship,
)

__all__.extend([
    "KnowledgeConcept",
    "KnowledgeEntity",
    "KnowledgeAlias",
    "QuestionConcept",
    "QuestionEntity",
    "KnowledgeRelationship",
    "QuestionRelationship",
])

from app.db.models.llm_usage import LlmUsageEvent

__all__.extend(["LlmUsageEvent"])

from app.db.models.planner import (
    PlannerExam,
    PlannerSubject,
    PlannerTopic,
    PlannerSubtopic,
    UserSyllabusCoverage,
    StudyPlan,
    StudyPlanShare,
    PlannerSettings,
)

__all__.extend([
    "PlannerExam",
    "PlannerSubject",
    "PlannerTopic",
    "PlannerSubtopic",
    "UserSyllabusCoverage",
    "StudyPlan",
    "StudyPlanShare",
    "PlannerSettings",
])
