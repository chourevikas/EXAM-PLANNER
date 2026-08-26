import uuid
from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class PriorityEnum(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class ActivityTypeEnum(str, Enum):
    CONCEPT_REVISION = "CONCEPT_REVISION"
    TARGETED_MCQ_PRACTICE = "TARGETED_MCQ_PRACTICE"
    ERROR_LOG_AUDIT = "ERROR_LOG_AUDIT"
    FLASHCARD_SPACED_REVIEW = "FLASHCARD_SPACED_REVIEW"
    PACING_DRILL = "PACING_DRILL"


class ActionableStudyTask(BaseModel):
    task_id: str = Field(..., description="Unique slug like 'task_econ_repo_01'")
    title: str = Field(..., description="Action-oriented title e.g. 'Targeted Revision: Monetary Policy Transmission'")
    subject: str = Field(..., description="Subject name e.g. 'Economy'")
    topic: str = Field(..., description="Topic name e.g. 'Monetary Policy'")
    subtopic: Optional[str] = Field(None, description="Subtopic name if applicable")
    activity_type: ActivityTypeEnum = Field(default=ActivityTypeEnum.CONCEPT_REVISION, description="Type of study activity")
    priority: PriorityEnum = Field(default=PriorityEnum.HIGH, description="Urgency of task based on accuracy & score deficit")
    allocated_time_minutes: int = Field(default=45, description="Recommended study duration in minutes e.g. 30, 45, 60")
    due_in_days: int = Field(default=2, description="Target completion timeframe in days from test date (1-7)")
    reasoning: str = Field(..., description="Data-grounded explanation citing candidate's exam metrics")
    action_checklist: List[str] = Field(default_factory=list, description="Concrete 3-4 bullet steps for execution")
    linked_question_numbers: List[int] = Field(default_factory=list, description="Question numbers from test linked to this task")
    is_added_to_plan: bool = Field(default=False, description="Whether student has scheduled this task into their study planner")


class CognitiveDiagnosticInsight(BaseModel):
    executive_summary: str = Field(
        ...,
        description="Comprehensive 3-4 sentence diagnostic overview highlighting score, benchmark gap, and primary driver of results."
    )
    benchmark_verdict: str = Field(
        ...,
        description="Clear qualification verdict e.g. 'Qualifying Cutoff Benchmark Cleared (+4.2 Marks)' or 'Below Prelims Cutoff (-6.0 Marks) - Focus on Economy & Pacing'."
    )
    tactical_strengths: List[str] = Field(
        default_factory=list,
        description="2-4 specific conceptual and tactical strengths observed in the pre-calculated metrics."
    )
    critical_vulnerabilities: List[str] = Field(
        default_factory=list,
        description="2-4 root-cause vulnerabilities (e.g. overthinking bottlenecks, second-guess penalty, cognitive traps, concept gaps)."
    )
    pacing_and_unattempted_diagnosis: str = Field(
        ...,
        description="Detailed analysis of pacing efficiency, overthinking time sinks, and behavioral breakdown of unattempted questions (time-starved vs hesitated/abandoned vs strategic skip)."
    )
    distractor_trap_critique: str = Field(
        ...,
        description="Critique of option elimination behavior, susceptibility to high-closeness/inverse distractors, and answer revision switches."
    )

    # 11 Dedicated Plain-English Metric Insights (Zero Jargon)
    score_and_accuracy_insight: str = Field(
        default="",
        description="Plain-English explanation of the student's net score, positive marks earned vs negative penalty lost, and overall accuracy."
    )
    knowledge_depth_insight: str = Field(
        default="",
        description="Plain-English assessment of student's syllabus knowledge depth and mastery across easy vs high-difficulty questions."
    )
    guessing_and_confidence_insight: str = Field(
        default="",
        description="Plain-English analysis of student's guessing risk, distinguishing disciplined 50:50 choices from rushed blind guesses."
    )
    pacing_and_time_insight: str = Field(
        default="",
        description="Plain-English assessment of student's average speed, pacing balance, and time management across the paper."
    )
    elimination_skill_insight: str = Field(
        default="",
        description="Plain-English assessment of student's ability to prune incorrect options and convert multi-option choices into marks."
    )
    stamina_and_consistency_insight: str = Field(
        default="",
        description="Plain-English assessment of student's cognitive endurance, stamina drop in later stages, and fatigue resilience."
    )
    decision_confidence_insight: str = Field(
        default="",
        description="Plain-English critique of answer revision behavior, calculating whether changing answers gained marks or created second-guessing penalties."
    )
    exam_readiness_insight: str = Field(
        default="",
        description="Plain-English holistic synthesis of overall competitive exam preparedness relative to qualification benchmarks."
    )
    thinking_levels_insight: str = Field(
        default="",
        description="Plain-English breakdown of cognitive skills: fact recall vs conceptual analysis vs critical evaluation mastery."
    )
    trap_resistance_insight: str = Field(
        default="",
        description="Plain-English critique of trap resistance: avoiding subtle distractors, inverted facts, and near-miss choices."
    )
    memory_retention_insight: str = Field(
        default="",
        description="Plain-English assessment of concept memory retention, highlighting topics due for spaced revision."
    )

    study_plan_tasks: List[ActionableStudyTask] = Field(
        default_factory=list,
        description="Exactly 4 concrete, prioritized, time-allocated study tasks recommended for injection into the aspirant's study calendar."
    )
    closing_mentorship_advice: str = Field(
        ...,
        description="Empowering, expert mentor closing advice highlighting top strategic priorities for the upcoming study cycle."
    )


class BulkAddTasksRequest(BaseModel):
    attempt_id: uuid.UUID
    tasks: List[ActionableStudyTask]


class BulkAddTasksResponse(BaseModel):
    status: str = "SUCCESS"
    scheduled_tasks_count: int
    task_ids: List[str]
    message: str
