"""Resolves raw concept/entity names to canonical Knowledge Layer nodes.

Every name goes through `knowledge_aliases` (whose normalized key is unique across concepts
and entities), so spelling variants always land on one node. Unknown names create a new node
in PENDING_REVIEW, with the entity type inferred from its shape, and constitutional
sub-provisions are attached to their parent ("Article 15(4)" -> "Article 15").
"""
import re
from dataclasses import dataclass
from typing import Dict, Optional, Tuple

from sqlalchemy.exc import IntegrityError
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.models.knowledge import KnowledgeAlias, KnowledgeConcept, KnowledgeEntity
from app.knowledge.normalize import (
    canonical_provision_name,
    clean_display_name,
    normalize_key,
    provision_parent,
)
from app.knowledge.vocabulary import (
    ENTITY_TYPES,
    NODE_CONCEPT,
    NODE_ENTITY,
    STATUS_ACTIVE,
    STATUS_PENDING_REVIEW,
)

_ACT_SHAPE = re.compile(r"\bacts?\b.*\b(1[6-9]\d{2}|20\d{2})\b", re.IGNORECASE)
_CASE_SHAPE = re.compile(r"\s(?:v|vs|versus)\.?\s", re.IGNORECASE)
_SCHEDULE_OR_AMENDMENT = re.compile(r"\b(schedule|amendment)\b", re.IGNORECASE)
MAX_NAME_LENGTH = 255


@dataclass(frozen=True)
class NodeRef:
    kind: str  # CONCEPT | ENTITY
    id: int
    name: str
    parent_id: Optional[int] = None


def infer_entity_type(name: str) -> Optional[str]:
    """Entity type from the shape of a name, or None when nothing marks it as an entity."""
    if canonical_provision_name(name):
        return "CONSTITUTION_ARTICLE"
    if _ACT_SHAPE.search(name):
        return "ACT"
    if _CASE_SHAPE.search(name):
        return "CASE"
    if _SCHEDULE_OR_AMENDMENT.search(name):
        return "OTHER"
    return None


class KnowledgeResolver:
    """Per-session resolver with an in-memory alias cache."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self._cache: Dict[str, NodeRef] = {}

    async def lookup(self, name: str) -> Optional[NodeRef]:
        key = normalize_key(name)
        if not key:
            return None
        if key in self._cache:
            return self._cache[key]
        alias = (await self.session.exec(select(KnowledgeAlias).where(KnowledgeAlias.normalized_alias == key))).first()
        if not alias:
            return None
        node = await self.load(alias.node_kind, alias.node_id)
        if node:
            self._cache[key] = node
        return node

    async def resolve(
        self,
        name: str,
        preferred_kind: Optional[str] = None,
        entity_type: Optional[str] = None,
        status: str = STATUS_PENDING_REVIEW,
        create: bool = True,
    ) -> Optional[NodeRef]:
        """Existing node for `name` (any kind), else a new one of `preferred_kind` / inferred kind."""
        display = clean_display_name(canonical_provision_name(name) or name)[:MAX_NAME_LENGTH]
        if not normalize_key(display):
            return None
        existing = await self.lookup(display)
        if existing or not create:
            return existing

        inferred_type = infer_entity_type(display)
        kind = preferred_kind or (NODE_ENTITY if inferred_type else NODE_CONCEPT)
        if kind == NODE_ENTITY:
            parent = None
            parent_name = provision_parent(display)
            if parent_name:
                parent = await self.resolve(parent_name, NODE_ENTITY, "CONSTITUTION_ARTICLE", status)
            etype = entity_type if entity_type in ENTITY_TYPES else (inferred_type or "OTHER")
            row = KnowledgeEntity(
                canonical_name=display,
                normalized_key=normalize_key(display),
                entity_type=etype,
                parent_entity_id=parent.id if parent and parent.kind == NODE_ENTITY else None,
                status=status,
            )
        else:
            row = KnowledgeConcept(canonical_name=display, normalized_key=normalize_key(display), status=status)
        return await self._insert_node(row, kind, display)

    async def add_alias(self, node: NodeRef, alias_text: str) -> Tuple[bool, Optional[NodeRef]]:
        """Registers an alias. Returns (added, conflicting_node) — an alias never points at two nodes."""
        key = normalize_key(alias_text)
        if not key:
            return False, None
        current = await self.lookup(alias_text)
        if current:
            return False, (None if current == node else current)
        try:
            async with self.session.begin_nested():
                self.session.add(
                    KnowledgeAlias(
                        normalized_alias=key, alias_text=clean_display_name(alias_text)[:MAX_NAME_LENGTH],
                        node_kind=node.kind, node_id=node.id,
                    )
                )
            self._cache[key] = node
            return True, None
        except IntegrityError:
            winner = await self.lookup(alias_text)
            return False, (None if winner == node else winner)

    async def _insert_node(self, row, kind: str, display: str) -> Optional[NodeRef]:
        key = normalize_key(display)
        try:
            async with self.session.begin_nested():
                self.session.add(row)
                await self.session.flush()
                self.session.add(KnowledgeAlias(normalized_alias=key, alias_text=display, node_kind=kind, node_id=row.id))
        except IntegrityError:
            # Another enrichment created the same name concurrently; use theirs
            self._cache.pop(key, None)
            return await self.lookup(display)
        node = NodeRef(kind, row.id, row.canonical_name, getattr(row, "parent_entity_id", None))
        self._cache[key] = node
        return node

    async def load(self, kind: str, node_id: int) -> Optional[NodeRef]:
        if kind == NODE_ENTITY:
            row = await self.session.get(KnowledgeEntity, node_id)
            return NodeRef(NODE_ENTITY, row.id, row.canonical_name, row.parent_entity_id) if row else None
        row = await self.session.get(KnowledgeConcept, node_id)
        return NodeRef(NODE_CONCEPT, row.id, row.canonical_name) if row else None


async def seed_masters(session: AsyncSession, entities: list[dict], concepts: list[dict]) -> dict:
    """Idempotently loads curated concepts/entities (ACTIVE) with their aliases and parents."""
    resolver = KnowledgeResolver(session)
    stats = {"entities": 0, "concepts": 0, "aliases": 0, "conflicts": []}

    async def _activate(node: NodeRef, entity_type: Optional[str] = None):
        model = KnowledgeEntity if node.kind == NODE_ENTITY else KnowledgeConcept
        row = await session.get(model, node.id)
        row.status = STATUS_ACTIVE
        if entity_type and node.kind == NODE_ENTITY and entity_type in ENTITY_TYPES:
            row.entity_type = entity_type
        session.add(row)

    for item in concepts:
        node = await resolver.resolve(item["name"], NODE_CONCEPT, status=STATUS_ACTIVE)
        if not node:
            continue
        await _activate(node)
        stats["concepts"] += 1
        for alias in item.get("aliases", []):
            added, conflict = await resolver.add_alias(node, alias)
            stats["aliases"] += added
            if conflict:
                stats["conflicts"].append(f"{alias!r}: {node.name} vs {conflict.name}")

    for item in entities:
        node = await resolver.resolve(item["name"], NODE_ENTITY, item.get("type"), status=STATUS_ACTIVE)
        if not node:
            continue
        await _activate(node, item.get("type"))
        if item.get("parent") and node.kind == NODE_ENTITY:
            parent = await resolver.resolve(item["parent"], NODE_ENTITY, status=STATUS_ACTIVE)
            if parent and parent.kind == NODE_ENTITY:
                row = await session.get(KnowledgeEntity, node.id)
                row.parent_entity_id = parent.id
                session.add(row)
        stats["entities"] += 1
        for alias in item.get("aliases", []):
            added, conflict = await resolver.add_alias(node, alias)
            stats["aliases"] += added
            if conflict:
                stats["conflicts"].append(f"{alias!r}: {node.name} vs {conflict.name}")

    await session.commit()
    return stats
