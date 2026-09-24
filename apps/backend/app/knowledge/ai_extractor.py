"""AI extraction of Knowledge Layer tags for questions that are not tagged by hand.

The LLM reads a batch of questions (stem, options, correct answer, solution, taxonomy) and returns
the same shape as authored PDF tags: concepts, entities (with a type) and relationships. Output is
constrained by a Pydantic schema (entity types and relations are the controlled vocabularies), then
cleaned here before it is stored, so the rest of the pipeline never sees free-form model output.

The model is told which canonical names already exist so it reuses them ("Article 15", not
"Art. 15 of the Constitution"); anything new still goes through KnowledgeResolver and lands as
PENDING_REVIEW for curation.

The same call fills in missing syllabus tags (Subject > Microtheme > Nano Theme) for questions the
PDF left untagged, choosing from the syllabus names already used by other papers where possible.
Authored levels are never changed.
"""
import hashlib
import json
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Literal, Optional

from pydantic import BaseModel, Field

from app.config.logger import setup_logger
from app.knowledge.normalize import clean_display_name, normalize_key
from app.knowledge.vocabulary import ENTITY_TYPES, RELATION_TYPES

logger = setup_logger("KnowledgeAIExtractor")

# Bump when the prompt or schema changes: stored AI tags from an older version get re-extracted.
# v1: concepts / entities / relationships. v2: + missing Subject / Microtheme / Nano Theme.
PROMPT_VERSION = "kl-ai-v2"

# Syllabus levels as the PDFs name them (Microtheme = Topic, Nano Theme = Subtopic in the DB)
SYLLABUS_LEVELS = ("subject", "microtheme", "nano_theme")

MAX_CONCEPTS = 5
MAX_ENTITIES = 8
MAX_RELATIONSHIPS = 6
MAX_NAME_LENGTH = 120
MAX_VOCABULARY_NAMES = 400  # per kind, sent to the model as naming hints
MAX_SYLLABUS_LINES = 500  # "Subject > Microtheme > Nano Theme" lines sent when a batch needs them

EntityType = Literal[tuple(sorted(ENTITY_TYPES))]  # type: ignore[valid-type]
RelationType = Literal[tuple(sorted(RELATION_TYPES))]  # type: ignore[valid-type]


class AIEntity(BaseModel):
    name: str = Field(description="Canonical full name, e.g. 'Article 15(4)', 'Government of India Act, 1935'")
    type: EntityType = Field(description="Entity type from the allowed list")


class AIRelationship(BaseModel):
    source: str = Field(description="A concept or entity name listed for this question")
    relation: RelationType
    target: str = Field(description="A concept or entity name listed for this question")


class AISyllabus(BaseModel):
    subject: str = Field(description="e.g. 'Polity'")
    microtheme: str = Field(description="e.g. 'Fundamental Rights'")
    nano_theme: str = Field(description="e.g. 'Right to Equality'")


class AIQuestionKnowledge(BaseModel):
    question_id: int
    syllabus: Optional[AISyllabus] = Field(
        default=None, description="Only for questions with syllabus_missing; keep syllabus_known levels unchanged"
    )
    concepts: List[str] = Field(default_factory=list, description=f"At most {MAX_CONCEPTS} concepts")
    entities: List[AIEntity] = Field(default_factory=list, description=f"At most {MAX_ENTITIES} entities")
    relationships: List[AIRelationship] = Field(
        default_factory=list, description=f"At most {MAX_RELATIONSHIPS} relationships"
    )


class AIKnowledgeBatch(BaseModel):
    questions: List[AIQuestionKnowledge]


SYSTEM_PROMPT = f"""You tag previous-year exam questions (UPSC and state PSC) for a knowledge graph that links similar questions.

For EACH question, using its stem, options, correct answer and solution, return:

1. concepts (at most {MAX_CONCEPTS}): the abstract ideas or themes the question actually tests.
   Short noun phrases, e.g. "Right to Equality", "Reservation", "Judicial Review", "Dyarchy".
   Not named things (those are entities) and not the subject name alone ("Polity", "History").
2. entities (at most {MAX_ENTITIES}): specific named things central to the question or its answer:
   constitutional articles, acts, cases, persons, organizations, events, movements, books,
   institutions, places, committees, schemes, administrative units.
   - Use the full canonical name: "Article 15(4)" not "Art. 15(4)" or "Clause 4 of Article 15";
     "Government of India Act, 1935" not "GOI Act"; a person's full commonly used name.
   - Include an entity the question implies even when not written literally (a question about the
     provision that prohibits untouchability -> "Article 17").
   - Do not list every name that appears in a wrong option; only what the question is about and
     the correct answer.
3. relationships (at most {MAX_RELATIONSHIPS}): factual links between the concepts/entities you listed
   for that same question, using only the allowed relation types, e.g.
   "Article 15(4)" provides_for "Reservation"; "Article 15" part_of "Right to Equality".
   Both ends must be names from that question's concepts or entities.
4. syllabus: ONLY for questions that have "syllabus_missing". Return subject, microtheme and
   nano_theme, copying any level given in "syllabus_known" exactly. Pick the best-fitting line from
   "existing_syllabus" whenever one fits (copy its names exactly); only create a new, short,
   standard name for a level when nothing listed fits. Microtheme is a broad area within the
   subject ("Fundamental Rights"); Nano Theme is the narrow theme within it ("Right to Equality").
   For questions without "syllabus_missing", leave syllabus empty.

Naming rules:
- When a name in the provided existing vocabulary means the same thing, copy it exactly.
- Otherwise create a clear, standard English name. Never invent facts that are not supported by the
  question, answer or solution, or by well-established knowledge directly about them.
- If a question has nothing meaningful to tag, return empty lists for it.

Return one entry per question, with its question_id unchanged.
"""


# Hash of the exact prompt + output schema, stored with every result for auditing. A test pins it to
# PROMPT_VERSION, so editing either without bumping the version fails CI instead of silently mixing
# results from different prompts.
PROMPT_FINGERPRINT = hashlib.sha256(
    (SYSTEM_PROMPT + json.dumps(AIKnowledgeBatch.model_json_schema(), sort_keys=True)).encode("utf-8")
).hexdigest()[:12]


@dataclass
class QuestionTexts:
    question_id: int
    stem: str
    options: List[str] = field(default_factory=list)
    answer: str = ""
    solution: str = ""
    subject: Optional[str] = None
    topic: Optional[str] = None
    subtopic: Optional[str] = None
    # Set when the PDF left syllabus levels untagged: the authored levels, and the ones AI must fill
    syllabus_known: Dict[str, str] = field(default_factory=dict)
    syllabus_missing: List[str] = field(default_factory=list)

    def input_hash(self) -> str:
        """Changes when the input the model saw changes, so stored AI tags can be reused otherwise."""
        payload = json.dumps(
            [self.stem, self.options, self.answer, self.solution, self.syllabus_known, self.syllabus_missing],
            ensure_ascii=False, sort_keys=True,
        )
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    def to_prompt(self) -> Dict[str, Any]:
        item: Dict[str, Any] = {"question_id": self.question_id, "question": self.stem.strip()}
        if self.options:
            item["options"] = [o.strip() for o in self.options]
        if self.answer:
            item["correct_answer"] = self.answer.strip()
        if self.solution:
            item["solution"] = self.solution.strip()[:4000]
        if self.syllabus_missing:
            item["syllabus_known"] = self.syllabus_known
            item["syllabus_missing"] = self.syllabus_missing
        else:
            taxonomy = [t for t in (self.subject, self.topic, self.subtopic) if t]
            if taxonomy:
                item["syllabus"] = " > ".join(taxonomy)
        return item


@dataclass
class Vocabulary:
    concepts: List[str] = field(default_factory=list)
    entities: List[str] = field(default_factory=list)
    syllabus: List[str] = field(default_factory=list)  # "Subject > Microtheme > Nano Theme"


def _clean_name(raw: Any) -> Optional[str]:
    if not isinstance(raw, str):
        return None
    name = clean_display_name(raw)
    if not name or len(name) > MAX_NAME_LENGTH or not normalize_key(name):
        return None
    return name


def clean_ai_syllabus(
    syllabus: Optional[AISyllabus], known: Dict[str, str], missing: List[str]
) -> Optional[Dict[str, str]]:
    """Missing levels from the model plus the authored ones, or None if the answer is unusable.

    Authored levels always win over what the model returned. A missing Nano Theme falls back to the
    Microtheme, the same fallback the upload pipeline uses.
    """
    if not missing or syllabus is None:
        return None
    result: Dict[str, str] = {}
    for level in SYLLABUS_LEVELS:
        value = known.get(level) if level not in missing else _clean_name(getattr(syllabus, level, None))
        if not value and level == "nano_theme":
            value = result.get("microtheme")
        if not value:
            return None
        result[level] = value
    return result


def clean_ai_knowledge(item: AIQuestionKnowledge, texts: Optional[QuestionTexts] = None) -> Dict[str, Any]:
    """Validates one question's model output into the stored tag shape.

    Drops empty/over-long names, duplicates (by normalized key), names listed as both concept and
    entity (entity wins), relationships whose ends were not listed for this question, and self-loops;
    enforces the per-kind caps. Syllabus is kept only when `texts` says levels were missing.
    """
    entities: List[str] = []
    entity_types: Dict[str, str] = {}
    seen: set = set()
    for ent in item.entities:
        name = _clean_name(ent.name)
        if name and normalize_key(name) not in seen:
            seen.add(normalize_key(name))
            entities.append(name)
            entity_types[name] = ent.type if ent.type in ENTITY_TYPES else "OTHER"
        if len(entities) >= MAX_ENTITIES:
            break

    concepts: List[str] = []
    for raw in item.concepts:
        name = _clean_name(raw)
        if name and normalize_key(name) not in seen:
            seen.add(normalize_key(name))
            concepts.append(name)
        if len(concepts) >= MAX_CONCEPTS:
            break

    names_by_key = {normalize_key(n): n for n in [*entities, *concepts]}
    relationships: List[Dict[str, str]] = []
    edges: set = set()
    for rel in item.relationships:
        src = names_by_key.get(normalize_key(rel.source or ""))
        tgt = names_by_key.get(normalize_key(rel.target or ""))
        if not src or not tgt or src == tgt or rel.relation not in RELATION_TYPES:
            continue
        if (src, rel.relation, tgt) in edges:
            continue
        edges.add((src, rel.relation, tgt))
        relationships.append({"source": src, "relation": rel.relation, "target": tgt})
        if len(relationships) >= MAX_RELATIONSHIPS:
            break

    cleaned: Dict[str, Any] = {
        "concepts": concepts, "entities": entities, "entity_types": entity_types, "relationships": relationships,
    }
    if texts is not None and texts.syllabus_missing:
        cleaned["syllabus"] = clean_ai_syllabus(item.syllabus, texts.syllabus_known, texts.syllabus_missing)
        cleaned["syllabus_filled"] = list(texts.syllabus_missing)
    return cleaned


class KnowledgeAIExtractor:
    """Batched LLM extraction. `chat_model_factory` returns a LangChain chat model (injectable for tests)."""

    def __init__(self, chat_model_factory: Callable[[], Any], batch_size: int = 8, model_name: str = "llm"):
        self._chat_model_factory = chat_model_factory
        self._structured = None
        self.batch_size = max(1, batch_size)
        self.model_name = model_name

    @classmethod
    def from_settings(cls) -> Optional["KnowledgeAIExtractor"]:
        """The configured extractor, or None when AI extraction is switched off."""
        from app.config.settings import get_settings

        settings = get_settings()
        if not settings.KNOWLEDGE_AI_ENABLED:
            return None

        def _factory():
            from app.llm.factory import get_vision_llm

            return get_vision_llm(
                timeout=settings.KNOWLEDGE_LLM_TIMEOUT_SECONDS,
                max_retries=settings.KNOWLEDGE_LLM_MAX_RETRIES,
                rate_limit_rps=settings.KNOWLEDGE_LLM_RATE_LIMIT_RPS,
            )

        return cls(_factory, batch_size=settings.KNOWLEDGE_AI_BATCH_SIZE, model_name=settings.GEMINI_MODEL_NAME)

    def _model(self):
        if self._structured is None:
            self._structured = self._chat_model_factory().with_structured_output(AIKnowledgeBatch)
        return self._structured

    async def extract_batch(self, items: List[QuestionTexts], vocabulary: Vocabulary) -> Dict[int, Dict[str, Any]]:
        """Cleaned tags per question_id for one batch. Raises on provider errors (the caller decides)."""
        if not items:
            return {}
        payload: Dict[str, Any] = {"questions": [i.to_prompt() for i in items]}
        if vocabulary.entities or vocabulary.concepts:
            payload["existing_vocabulary"] = {
                "entities": vocabulary.entities[:MAX_VOCABULARY_NAMES],
                "concepts": vocabulary.concepts[:MAX_VOCABULARY_NAMES],
            }
        if vocabulary.syllabus and any(i.syllabus_missing for i in items):
            payload["existing_syllabus"] = vocabulary.syllabus[:MAX_SYLLABUS_LINES]
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": "Tag these questions:\n\n" + json.dumps(payload, ensure_ascii=False, indent=1)},
        ]
        res = await self._model().ainvoke(messages)
        batch = res if isinstance(res, AIKnowledgeBatch) else AIKnowledgeBatch.model_validate(res)

        wanted = {i.question_id: i for i in items}
        cleaned: Dict[int, Dict[str, Any]] = {}
        for q in batch.questions:
            if q.question_id in wanted and q.question_id not in cleaned:
                cleaned[q.question_id] = clean_ai_knowledge(q, wanted[q.question_id])
        missing = wanted - cleaned.keys()
        if missing:
            logger.warning(f"[KNOWLEDGE-AI] Model returned no entry for questions {sorted(missing)}")
        return cleaned
