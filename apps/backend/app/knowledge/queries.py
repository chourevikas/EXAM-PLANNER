"""Read-side helpers for a question's Knowledge Layer data."""
from sqlalchemy.orm import aliased
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.models.knowledge import (
    KnowledgeConcept,
    KnowledgeEntity,
    KnowledgeRelationship,
    QuestionConcept,
    QuestionEntity,
    QuestionRelationship,
)
from app.knowledge.vocabulary import NODE_ENTITY


async def load_question_knowledge(session: AsyncSession, question_id: int) -> dict:
    concepts = [
        {"id": c.id, "name": c.canonical_name, "weight": round(link.weight, 2), "source": link.source, "status": c.status}
        for link, c in (await session.exec(
            select(QuestionConcept, KnowledgeConcept)
            .join(KnowledgeConcept, KnowledgeConcept.id == QuestionConcept.concept_id)
            .where(QuestionConcept.question_id == question_id)
            .order_by(col(QuestionConcept.weight).desc(), KnowledgeConcept.canonical_name)
        )).all()
    ]

    parent = aliased(KnowledgeEntity)
    entities = [
        {
            "id": e.id, "name": e.canonical_name, "entity_type": e.entity_type, "parent_name": parent_name,
            "relevance": round(link.relevance, 2), "source": link.source, "status": e.status,
        }
        for link, e, parent_name in (await session.exec(
            select(QuestionEntity, KnowledgeEntity, parent.canonical_name)
            .join(KnowledgeEntity, KnowledgeEntity.id == QuestionEntity.entity_id)
            .join(parent, parent.id == KnowledgeEntity.parent_entity_id, isouter=True)
            .where(QuestionEntity.question_id == question_id)
            .order_by(col(QuestionEntity.relevance).desc(), KnowledgeEntity.canonical_name)
        )).all()
    ]

    edges = (await session.exec(
        select(KnowledgeRelationship)
        .join(QuestionRelationship, QuestionRelationship.relationship_id == KnowledgeRelationship.id)
        .where(QuestionRelationship.question_id == question_id)
        .order_by(KnowledgeRelationship.id)
    )).all()
    names = {}
    for kind, model in ((NODE_ENTITY, KnowledgeEntity), ("CONCEPT", KnowledgeConcept)):
        ids = {e.source_id for e in edges if e.source_kind == kind} | {e.target_id for e in edges if e.target_kind == kind}
        if ids:
            for nid, name in (await session.exec(select(model.id, model.canonical_name).where(col(model.id).in_(ids)))).all():
                names[(kind, nid)] = name
    relationships = [
        {
            "source": names.get((e.source_kind, e.source_id), "?"),
            "relation": e.relation_type,
            "target": names.get((e.target_kind, e.target_id), "?"),
        }
        for e in edges
    ]
    return {"question_id": question_id, "concepts": concepts, "entities": entities, "relationships": relationships}
