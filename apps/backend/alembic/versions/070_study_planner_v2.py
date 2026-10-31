"""070_study_planner_v2

Revision ID: 070_study_planner_v2
Revises: 069_reminders_and_question_search
Create Date: 2026-10-23 00:00:00.000000

Study Planner v2. Each exam type gets study syllabi (UPSC: Prelims, Mains, optionals; MPSC: Prelims), each a
subject -> topic -> subtopic tree that admins edit under Exam Types. Seeded from the client's planner
(app/planner/seed/syllabus.json) under the exam types that exist; the rest can be imported later. Planner subtopics
are linked to the same-named question-bank subtopic of their exam type. Per student: syllabus coverage, the
generated plan, share links and planner settings. study_tasks gains plan_id, planner_subtopic_id and block;
existing rows keep them empty.
"""
import json
from pathlib import Path
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '070_study_planner_v2'
down_revision: Union[str, None] = '069_reminders_and_question_search'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SEED = Path(__file__).resolve().parents[2] / "app" / "planner" / "seed" / "syllabus.json"
JSON = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")
TS = sa.DateTime(timezone=True)
NOW = sa.text("CURRENT_TIMESTAMP")


def _pk():
    return sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True)


def _exam_type_id(bind, code: str):
    """The exam type for a seed code: that exact code, else one starting with it (e.g. mpscpre); active first."""
    return bind.execute(sa.text(
        "SELECT id FROM exam_types WHERE LOWER(type) LIKE :p ORDER BY (LOWER(type) = :c) DESC, is_active DESC, id LIMIT 1"
    ), {"p": f"{code}%", "c": code}).scalar()


def _seed() -> None:
    exams_t = sa.table("planner_exams", sa.column("id", sa.BigInteger), sa.column("exam_type_id", sa.BigInteger),
                       sa.column("stage", sa.String), sa.column("name", sa.String),
                       sa.column("answer_writing", sa.Boolean), sa.column("sort_order", sa.Integer),
                       sa.column("is_active", sa.Boolean))
    subj_t = sa.table("planner_subjects", sa.column("id", sa.BigInteger), sa.column("exam_id", sa.BigInteger),
                      sa.column("name", sa.String), sa.column("sort_order", sa.Integer))
    top_t = sa.table("planner_topics", sa.column("id", sa.BigInteger), sa.column("subject_id", sa.BigInteger),
                     sa.column("name", sa.String), sa.column("sort_order", sa.Integer))
    st_t = sa.table("planner_subtopics", sa.column("topic_id", sa.BigInteger), sa.column("name", sa.String),
                    sa.column("sort_order", sa.Integer))
    bind = op.get_bind()
    data = json.loads(SEED.read_text(encoding="utf-8"))
    order: dict = {}
    for syl in data["syllabi"]:
        type_id = _exam_type_id(bind, syl["exam_type"])
        if type_id is None:
            print(f"070: no '{syl['exam_type']}' exam type, so its {syl['name']} syllabus wasn't seeded (import it later)")
            continue
        order[type_id] = order.get(type_id, -1) + 1
        exam_id = bind.execute(exams_t.insert().values(
            exam_type_id=type_id, stage=syl["stage"], name=syl["name"], answer_writing=syl["answer_writing"],
            sort_order=order[type_id], is_active=True).returning(exams_t.c.id)).scalar_one()
        for si, subject in enumerate(syl["subjects"]):
            subject_id = bind.execute(subj_t.insert().values(exam_id=exam_id, name=subject["name"], sort_order=si)
                                      .returning(subj_t.c.id)).scalar_one()
            for ti, topic in enumerate(subject["topics"]):
                topic_id = bind.execute(top_t.insert().values(subject_id=subject_id, name=topic["name"], sort_order=ti)
                                        .returning(top_t.c.id)).scalar_one()
                bind.execute(st_t.insert(), [{"topic_id": topic_id, "name": n, "sort_order": i}
                                             for i, n in enumerate(topic["subtopics"])])
    # Link to the same-named question-bank subtopic in the syllabus's own exam type; admins fix the rest under
    # Exam Types (each paper has its own copy of the syllabus: pick the copy with the most published questions)
    op.execute(
        "UPDATE planner_subtopics SET bank_subtopic_id = ("
        " SELECT s.id FROM subtopics s"
        " JOIN topics t ON t.id = s.topic_id JOIN subjects sj ON sj.id = t.subject_id"
        " JOIN syllabus_versions v ON v.id = sj.version_id JOIN exams e ON e.id = v.exam_id"
        " LEFT JOIN questions q ON q.subtopic_id = s.id AND q.status = 'PUBLISHED'"
        " WHERE LOWER(s.name) = LOWER(planner_subtopics.name) AND e.exam_type_id = ("
        "   SELECT pe.exam_type_id FROM planner_topics pt JOIN planner_subjects ps ON ps.id = pt.subject_id"
        "   JOIN planner_exams pe ON pe.id = ps.exam_id WHERE pt.id = planner_subtopics.topic_id)"
        " GROUP BY s.id ORDER BY COUNT(q.id) DESC, s.id LIMIT 1)"
    )


def upgrade() -> None:
    tables = set(sa.inspect(op.get_bind()).get_table_names())

    if "planner_exams" not in tables:
        op.create_table(
            "planner_exams", _pk(),
            sa.Column("exam_type_id", sa.BigInteger(), sa.ForeignKey("exam_types.id", ondelete="RESTRICT"),
                      nullable=False, index=True),
            sa.Column("stage", sa.String(20), nullable=False, server_default="prelims"),
            sa.Column("name", sa.String(120), nullable=False),
            sa.Column("answer_writing", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("created_at", TS, nullable=False, server_default=NOW),
            sa.UniqueConstraint("exam_type_id", "stage", "name", name="uq_planner_exams_type_stage_name"),
        )
        op.create_index("ix_planner_exams_type_order", "planner_exams", ["exam_type_id", "sort_order"])
        op.create_table(
            "planner_subjects", _pk(),
            sa.Column("exam_id", sa.BigInteger(), sa.ForeignKey("planner_exams.id", ondelete="CASCADE"),
                      nullable=False, index=True),
            sa.Column("name", sa.String(200), nullable=False),
            sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        )
        op.create_index("ix_planner_subjects_exam_order", "planner_subjects", ["exam_id", "sort_order"])
        op.create_table(
            "planner_topics", _pk(),
            sa.Column("subject_id", sa.BigInteger(), sa.ForeignKey("planner_subjects.id", ondelete="CASCADE"),
                      nullable=False, index=True),
            sa.Column("name", sa.String(200), nullable=False),
            sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        )
        op.create_index("ix_planner_topics_subject_order", "planner_topics", ["subject_id", "sort_order"])
        op.create_table(
            "planner_subtopics", _pk(),
            sa.Column("topic_id", sa.BigInteger(), sa.ForeignKey("planner_topics.id", ondelete="CASCADE"),
                      nullable=False, index=True),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("bank_subtopic_id", sa.BigInteger(), sa.ForeignKey("subtopics.id", ondelete="SET NULL"),
                      nullable=True, index=True),
        )
        op.create_index("ix_planner_subtopics_topic_order", "planner_subtopics", ["topic_id", "sort_order"])
        _seed()

    if "user_syllabus_coverage" not in tables:
        op.create_table(
            "user_syllabus_coverage",
            sa.Column("user_id", sa.BigInteger(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
            sa.Column("planner_subtopic_id", sa.BigInteger(),
                      sa.ForeignKey("planner_subtopics.id", ondelete="CASCADE"), primary_key=True),
            sa.Column("covered_at", TS, nullable=False, server_default=NOW, index=True),
        )

    if "study_plans" not in tables:
        op.create_table(
            "study_plans", _pk(),
            sa.Column("user_id", sa.BigInteger(), sa.ForeignKey("users.id", ondelete="CASCADE"),
                      nullable=False, index=True),
            sa.Column("planner_exam_id", sa.BigInteger(), sa.ForeignKey("planner_exams.id", ondelete="SET NULL"),
                      nullable=True),
            sa.Column("start_date", sa.Date(), nullable=False),
            sa.Column("days", sa.Integer(), nullable=False),
            sa.Column("options", JSON, nullable=True),
            sa.Column("last_auto_catchup", sa.Date(), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("created_at", TS, nullable=False, server_default=NOW),
        )
        op.create_index("ix_study_plans_user_active", "study_plans", ["user_id", "is_active"])

    if "study_plan_shares" not in tables:
        op.create_table(
            "study_plan_shares",
            sa.Column("token", sa.String(32), primary_key=True),
            sa.Column("user_id", sa.BigInteger(), sa.ForeignKey("users.id", ondelete="CASCADE"),
                      nullable=False, index=True),
            sa.Column("payload", JSON, nullable=True),
            sa.Column("created_at", TS, nullable=False, server_default=NOW),
        )

    if "planner_settings" not in tables:
        op.create_table(
            "planner_settings", _pk(),
            sa.Column("user_id", sa.BigInteger(), sa.ForeignKey("users.id", ondelete="CASCADE"),
                      nullable=False, index=True),
            sa.Column("daily_goal_topics", sa.Integer(), nullable=False, server_default="3"),
            sa.Column("weekly_coverage_target", sa.Integer(), nullable=False, server_default="5"),
            sa.Column("prefs", JSON, nullable=True),
            sa.UniqueConstraint("user_id", name="uq_planner_settings_user"),
        )

    existing = {c["name"] for c in sa.inspect(op.get_bind()).get_columns("study_tasks")}
    if "plan_id" not in existing:
        op.add_column("study_tasks", sa.Column("plan_id", sa.BigInteger(), nullable=True))
        op.create_foreign_key("fk_study_tasks_plan_id", "study_tasks", "study_plans", ["plan_id"], ["id"],
                              ondelete="SET NULL")
        op.create_index("ix_study_tasks_plan_id", "study_tasks", ["plan_id"])
    if "planner_subtopic_id" not in existing:
        op.add_column("study_tasks", sa.Column("planner_subtopic_id", sa.BigInteger(), nullable=True))
        op.create_foreign_key("fk_study_tasks_planner_subtopic_id", "study_tasks", "planner_subtopics",
                              ["planner_subtopic_id"], ["id"], ondelete="SET NULL")
    if "block" not in existing:
        op.add_column("study_tasks", sa.Column("block", sa.String(20), nullable=True))


def downgrade() -> None:
    op.drop_column("study_tasks", "block")
    op.drop_constraint("fk_study_tasks_planner_subtopic_id", "study_tasks", type_="foreignkey")
    op.drop_column("study_tasks", "planner_subtopic_id")
    op.drop_index("ix_study_tasks_plan_id", table_name="study_tasks")
    op.drop_constraint("fk_study_tasks_plan_id", "study_tasks", type_="foreignkey")
    op.drop_column("study_tasks", "plan_id")
    for table in ("planner_settings", "study_plan_shares", "study_plans", "user_syllabus_coverage",
                  "planner_subtopics", "planner_topics", "planner_subjects", "planner_exams"):
        op.drop_table(table)
