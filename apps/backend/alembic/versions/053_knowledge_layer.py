"""053_knowledge_layer

Revision ID: 053_knowledge_layer
Revises: 53d0819075f5
Create Date: 2026-09-24 00:00:00.000000

PYQ Knowledge Layer: concept/entity masters with aliases, question links, relationships,
and a nullable questions.knowledge_tags_raw column. Purely additive — existing questions
and the Subject/Topic/Subtopic taxonomy are untouched. Enum-like columns are VARCHAR.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '053_knowledge_layer'
down_revision: Union[str, None] = '53d0819075f5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _pk() -> sa.Column:
    return sa.Column('id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'), primary_key=True, autoincrement=True)


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = insp.get_table_names()

    if 'questions' in tables:
        existing = {c['name'] for c in insp.get_columns('questions')}
        if 'knowledge_tags_raw' not in existing:
            with op.batch_alter_table('questions') as batch_op:
                # JSONB on Postgres like the other questions.*_json columns (PortableJSON)
                batch_op.add_column(
                    sa.Column('knowledge_tags_raw', sa.JSON().with_variant(postgresql.JSONB(), 'postgresql'), nullable=True)
                )

    if 'knowledge_concepts' not in tables:
        op.create_table(
            'knowledge_concepts',
            _pk(),
            sa.Column('canonical_name', sa.String(255), nullable=False),
            sa.Column('normalized_key', sa.String(255), nullable=False),
            sa.Column('status', sa.String(20), nullable=False, server_default='PENDING_REVIEW'),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index('ix_knowledge_concepts_normalized_key', 'knowledge_concepts', ['normalized_key'], unique=True)
        op.create_index('ix_knowledge_concepts_status', 'knowledge_concepts', ['status'])

    if 'knowledge_entities' not in tables:
        op.create_table(
            'knowledge_entities',
            _pk(),
            sa.Column('canonical_name', sa.String(255), nullable=False),
            sa.Column('normalized_key', sa.String(255), nullable=False),
            sa.Column('entity_type', sa.String(40), nullable=False, server_default='OTHER'),
            sa.Column(
                'parent_entity_id', sa.BigInteger(),
                sa.ForeignKey('knowledge_entities.id', ondelete='SET NULL'), nullable=True,
            ),
            sa.Column('status', sa.String(20), nullable=False, server_default='PENDING_REVIEW'),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index('ix_knowledge_entities_normalized_key', 'knowledge_entities', ['normalized_key'], unique=True)
        op.create_index('ix_knowledge_entities_entity_type', 'knowledge_entities', ['entity_type'])
        op.create_index('ix_knowledge_entities_parent_entity_id', 'knowledge_entities', ['parent_entity_id'])
        op.create_index('ix_knowledge_entities_status', 'knowledge_entities', ['status'])

    if 'knowledge_aliases' not in tables:
        op.create_table(
            'knowledge_aliases',
            _pk(),
            sa.Column('normalized_alias', sa.String(255), nullable=False),
            sa.Column('alias_text', sa.String(255), nullable=False),
            sa.Column('node_kind', sa.String(10), nullable=False),
            sa.Column('node_id', sa.BigInteger(), nullable=False),
        )
        op.create_index('ix_knowledge_aliases_normalized_alias', 'knowledge_aliases', ['normalized_alias'], unique=True)
        op.create_index('ix_k_alias_node', 'knowledge_aliases', ['node_kind', 'node_id'])

    if 'question_concepts' not in tables:
        op.create_table(
            'question_concepts',
            _pk(),
            sa.Column('question_id', sa.BigInteger(), sa.ForeignKey('questions.id', ondelete='CASCADE'), nullable=False),
            sa.Column(
                'concept_id', sa.BigInteger(), sa.ForeignKey('knowledge_concepts.id', ondelete='CASCADE'), nullable=False
            ),
            sa.Column('weight', sa.Float(), nullable=False, server_default='1.0'),
            sa.Column('source', sa.String(20), nullable=False, server_default='AUTHORED'),
        )
        op.create_index('ix_qc_question_concept', 'question_concepts', ['question_id', 'concept_id'], unique=True)
        op.create_index('ix_question_concepts_question_id', 'question_concepts', ['question_id'])
        op.create_index('ix_question_concepts_concept_id', 'question_concepts', ['concept_id'])

    if 'question_entities' not in tables:
        op.create_table(
            'question_entities',
            _pk(),
            sa.Column('question_id', sa.BigInteger(), sa.ForeignKey('questions.id', ondelete='CASCADE'), nullable=False),
            sa.Column(
                'entity_id', sa.BigInteger(), sa.ForeignKey('knowledge_entities.id', ondelete='CASCADE'), nullable=False
            ),
            sa.Column('relevance', sa.Float(), nullable=False, server_default='1.0'),
            sa.Column('source', sa.String(20), nullable=False, server_default='AUTHORED'),
        )
        op.create_index('ix_qe_question_entity', 'question_entities', ['question_id', 'entity_id'], unique=True)
        op.create_index('ix_question_entities_question_id', 'question_entities', ['question_id'])
        op.create_index('ix_question_entities_entity_id', 'question_entities', ['entity_id'])

    if 'knowledge_relationships' not in tables:
        op.create_table(
            'knowledge_relationships',
            _pk(),
            sa.Column('source_kind', sa.String(10), nullable=False),
            sa.Column('source_id', sa.BigInteger(), nullable=False),
            sa.Column('relation_type', sa.String(40), nullable=False),
            sa.Column('target_kind', sa.String(10), nullable=False),
            sa.Column('target_id', sa.BigInteger(), nullable=False),
            sa.Column('confidence', sa.Float(), nullable=False, server_default='1.0'),
            sa.Column(
                'source_question_id', sa.BigInteger(),
                sa.ForeignKey('questions.id', ondelete='SET NULL'), nullable=True,
            ),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index(
            'ix_kr_edge', 'knowledge_relationships',
            ['source_kind', 'source_id', 'relation_type', 'target_kind', 'target_id'], unique=True,
        )
        op.create_index('ix_kr_source', 'knowledge_relationships', ['source_kind', 'source_id'])
        op.create_index('ix_kr_target', 'knowledge_relationships', ['target_kind', 'target_id'])

    if 'question_relationships' not in tables:
        op.create_table(
            'question_relationships',
            _pk(),
            sa.Column('question_id', sa.BigInteger(), sa.ForeignKey('questions.id', ondelete='CASCADE'), nullable=False),
            sa.Column(
                'relationship_id', sa.BigInteger(),
                sa.ForeignKey('knowledge_relationships.id', ondelete='CASCADE'), nullable=False,
            ),
        )
        op.create_index(
            'ix_qr_question_relationship', 'question_relationships', ['question_id', 'relationship_id'], unique=True
        )
        op.create_index('ix_question_relationships_question_id', 'question_relationships', ['question_id'])
        op.create_index('ix_question_relationships_relationship_id', 'question_relationships', ['relationship_id'])


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = insp.get_table_names()
    for table in (
        'question_relationships', 'knowledge_relationships', 'question_entities', 'question_concepts',
        'knowledge_aliases', 'knowledge_entities', 'knowledge_concepts',
    ):
        if table in tables:
            op.drop_table(table)
    if 'questions' in tables:
        existing = {c['name'] for c in insp.get_columns('questions')}
        if 'knowledge_tags_raw' in existing:
            with op.batch_alter_table('questions') as batch_op:
                batch_op.drop_column('knowledge_tags_raw')
