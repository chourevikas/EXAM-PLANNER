from pydantic import BaseModel, Field, model_validator
from app.schemas.syllabus_literals import SYLLABUS_HIERARCHY


class OptionAnalysis(BaseModel):
    option_key: str = Field(description="Option identifier: 'A', 'B', 'C', or 'D'")
    is_correct: bool = Field(
        description="True if this is the correct answer, False otherwise"
    )
    closeness_score: float = Field(
        default=0.0,
        description="Plausibility score from 0.0 to 1.0 (1.0 for correct answer; 0.6-0.9 for strong distractors, 0.1-0.3 for weak distractors)",
    )
    explanation: str = Field(
        description="If correct: clear reasoning why it's right. If incorrect: exact conceptual error or trap that makes it wrong."
    )


class MultiConceptItemSchema(BaseModel):
    subject: str = Field(
        description="Subject name from syllabus e.g. History, Economy, Geography"
    )
    topic: str = Field(description="Topic name e.g. Ancient History, Money and Banking")
    subtopic: str | None = Field(
        default=None,
        description="Granular subtopic name e.g. Pre Historic Times, Inflation",
    )
    is_primary: bool = Field(
        default=False,
        description="Set True for the primary subject/topic/subtopic category",
    )
    relevance_weight: float = Field(
        default=1.0, description="Relevance score (0.0 to 1.0) of concept in question"
    )
    concept_name: str | None = Field(
        default=None, description="Specific concept label e.g. Monetary Expansion"
    )

    @model_validator(mode="after")
    def validate_and_auto_repair_hierarchy(self) -> "MultiConceptItemSchema":
        try:
            from app.pipeline.taxonomy_resolver import get_taxonomy_resolver

            resolver = get_taxonomy_resolver()
            val_tax, _ = resolver.resolve_hierarchy(
                raw_subject=str(self.subject) if self.subject else None,
                raw_topic=str(self.topic) if self.topic else None,
                raw_subtopic=str(self.subtopic) if self.subtopic else None,
            )
            self.subject = val_tax.subject
            self.topic = val_tax.topic
            self.subtopic = val_tax.subtopic
        except Exception:
            # Safe canonical fallback so concept validation never crashes
            if not self.subject or self.subject not in SYLLABUS_HIERARCHY:
                self.subject = "General Science"
            valid_topics = list(SYLLABUS_HIERARCHY.get(self.subject, {}).keys())
            if not self.topic or self.topic not in valid_topics:
                self.topic = valid_topics[0] if valid_topics else "General Concepts"
            if self.subtopic:
                valid_subtopics = SYLLABUS_HIERARCHY.get(self.subject, {}).get(
                    self.topic, []
                )
                if self.subtopic not in valid_subtopics:
                    self.subtopic = valid_subtopics[0] if valid_subtopics else None
        return self


class QuestionExplanationSchema(BaseModel):
    core_concept: str = Field(
        description="The primary formula, theorem, or rule being tested in 1 sentence."
    )
    detailed_solution: str = Field(
        description="Step-by-step proof, calculation, or logical derivation of the answer."
    )
    options_breakdown: list[OptionAnalysis] = Field(
        description="Exact analysis for all choices e.g. A, B, C, D."
    )
    common_traps: list[str] | None = Field(
        default=[],
        description="Common misconceptions or calculation pitfalls students fall into for this question.",
    )
    key_takeaways: list[str] = Field(
        description="1-2 high-yield bullet points for quick revision before exams."
    )
    subject: str = Field(
        description="Primary subject category e.g., History, Economy, Geography"
    )
    topic: str = Field(
        description="Primary topic e.g., Ancient History, Money and Banking"
    )
    subtopic: str | None = Field(
        default=None, description="Primary granular subtopic e.g., Pre Historic Times"
    )
    concepts: list[MultiConceptItemSchema] = Field(
        default_factory=list,
        description="Complete list of all subjects, topics, and subtopics involved in this interdisciplinary question",
    )
    difficulty: str = Field(
        description="Difficulty level e.g., 'Easy', 'Medium', or 'Hard'"
    )
    blooms_level: str | None = Field(
        default="ANALYZE",
        description="Bloom's taxonomy cognitive level: REMEMBER, UNDERSTAND, APPLY, ANALYZE, EVALUATE",
    )
    cognitive_skill: str | None = Field(
        default="Conceptual Reasoning",
        description="Core cognitive skill required e.g., Data Interpretation, Statement Elimination, Spatial Reasoning",
    )
    irt_discrimination_a: float | None = Field(
        default=1.5,
        description="3PL Item Response Theory Discrimination coefficient (0.5 to 2.5)",
    )
    irt_difficulty_b: float | None = Field(
        default=0.0,
        description="3PL Item Response Theory Difficulty parameter (-3.0 to +3.0)",
    )
    irt_pseudo_guessing_c: float | None = Field(
        default=0.18,
        description="3PL Pseudo-guessing parameter derived from distractor plausibility (0.05 to 0.25)",
    )

    @model_validator(mode="after")
    def validate_and_auto_repair_hierarchy(self) -> "QuestionExplanationSchema":
        try:
            from app.pipeline.taxonomy_resolver import get_taxonomy_resolver

            resolver = get_taxonomy_resolver()
            context_hint = f"{self.core_concept or ''} {self.detailed_solution or ''}"
            val_tax, _ = resolver.resolve_hierarchy(
                raw_subject=str(self.subject) if self.subject else None,
                raw_topic=str(self.topic) if self.topic else None,
                raw_subtopic=str(self.subtopic) if self.subtopic else None,
                context_hint=context_hint,
            )
            self.subject = val_tax.subject
            self.topic = val_tax.topic
            self.subtopic = val_tax.subtopic
        except Exception:
            # Safe canonical fallback so individual question explanations never crash
            if not self.subject or self.subject not in SYLLABUS_HIERARCHY:
                self.subject = "General Science"
            valid_topics = list(SYLLABUS_HIERARCHY.get(self.subject, {}).keys())
            if not self.topic or self.topic not in valid_topics:
                self.topic = valid_topics[0] if valid_topics else "General Concepts"
            if self.subtopic:
                valid_subtopics = SYLLABUS_HIERARCHY.get(self.subject, {}).get(
                    self.topic, []
                )
                if self.subtopic not in valid_subtopics:
                    self.subtopic = valid_subtopics[0] if valid_subtopics else None
        return self
