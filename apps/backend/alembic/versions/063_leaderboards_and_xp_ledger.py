"""063_leaderboards_and_xp_ledger

Revision ID: 063_leaderboards_and_xp_ledger
Revises: 062_free_plan_daily_usage
Create Date: 2026-10-17 00:00:00.000000

Leaderboards (national and state, per target exam, recalculated daily) and a real XP ledger.
- student_profiles: state, username (unique), leaderboard_display (USERNAME | NAME).
- xp_logs.ref_key + unique (user_id, ref_key): makes each award idempotent.
- leaderboard_snapshots: one row per student per day.
- Backfill (Postgres): XP the students' history earns under the client's values
  (correct answer +10, test completed +50, active day +20), keyed exactly like live awards so a
  re-evaluation can't add it twice; then student_profiles.total_xp/level = their ledger total.
  Before this, total_xp was largely "questions attempted x 10" written back by /auth/me.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '063_leaderboards_and_xp_ledger'
down_revision: Union[str, None] = '062_free_plan_daily_usage'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DONE = "('SUBMITTED', 'EVALUATED')"
IST_DAY = "(COALESCE(a.submitted_at, a.created_at) AT TIME ZONE 'Asia/Kolkata')::date"


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    prof_cols = {c['name'] for c in insp.get_columns('student_profiles')}
    if 'state' not in prof_cols:
        op.add_column('student_profiles', sa.Column('state', sa.String(64), nullable=True))
    if 'username' not in prof_cols:
        op.add_column('student_profiles', sa.Column('username', sa.String(20), nullable=True))
        op.create_index('ix_student_profiles_username', 'student_profiles', ['username'], unique=True)
    if 'leaderboard_display' not in prof_cols:
        op.add_column('student_profiles', sa.Column('leaderboard_display', sa.String(10), nullable=False, server_default='USERNAME'))

    xp_cols = {c['name'] for c in insp.get_columns('xp_logs')}
    if 'ref_key' not in xp_cols:
        op.add_column('xp_logs', sa.Column('ref_key', sa.String(100), nullable=True))
        op.create_index('ux_xp_logs_user_ref', 'xp_logs', ['user_id', 'ref_key'], unique=True)

    if not insp.has_table('leaderboard_snapshots'):
        op.create_table(
            'leaderboard_snapshots',
            sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
            sa.Column('snapshot_date', sa.Date(), nullable=False),
            sa.Column('user_id', sa.BigInteger(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
            sa.Column('exam', sa.String(100), nullable=False),
            sa.Column('state', sa.String(64), nullable=True),
            sa.Column('xp', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('correct_answers', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('rank_national', sa.Integer(), nullable=False),
            sa.Column('rank_state', sa.Integer(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )
        op.create_index('ix_leaderboard_national', 'leaderboard_snapshots', ['snapshot_date', 'exam', 'rank_national'])
        op.create_index('ix_leaderboard_state', 'leaderboard_snapshots', ['snapshot_date', 'exam', 'state', 'rank_state'])
        op.create_index('ux_leaderboard_user_day', 'leaderboard_snapshots', ['snapshot_date', 'user_id'], unique=True)

    if bind.dialect.name != 'postgresql':
        return

    students = "JOIN users u ON u.id = a.user_id AND u.role = 'STUDENT'"
    # Test completed +50
    op.execute(f"""
        INSERT INTO xp_logs (user_id, amount, source, description, ref_key, created_at)
        SELECT a.user_id, 50, 'TEST_COMPLETED', 'Backfill: test completed', 'attempt:' || a.id,
               COALESCE(a.submitted_at, a.created_at)
        FROM exam_attempts a {students}
        WHERE a.status::text IN {DONE}
        ON CONFLICT DO NOTHING
    """)
    # Correct answers +10 each
    op.execute(f"""
        INSERT INTO xp_logs (user_id, amount, source, description, ref_key, created_at)
        SELECT a.user_id, 10 * a.total_correct, 'CORRECT_ANSWERS', 'Backfill: ' || a.total_correct || ' correct',
               'attempt-correct:' || a.id, COALESCE(a.submitted_at, a.created_at)
        FROM exam_attempts a {students}
        WHERE a.status::text IN {DONE} AND a.total_correct > 0
        ON CONFLICT DO NOTHING
    """)
    # Active day +20 (days before today; today's is awarded live)
    op.execute(f"""
        INSERT INTO xp_logs (user_id, amount, source, description, ref_key, created_at)
        SELECT d.user_id, 20, 'STREAK_DAY', 'Backfill: active day', 'day:' || d.day, d.day
        FROM (
            SELECT DISTINCT a.user_id, {IST_DAY} AS day
            FROM exam_attempts a {students}
            WHERE a.status::text IN {DONE}
        ) d
        WHERE d.day < (now() AT TIME ZONE 'Asia/Kolkata')::date
        ON CONFLICT DO NOTHING
    """)
    op.execute("""
        UPDATE student_profiles p
        SET total_xp = COALESCE(x.total, 0),
            level = COALESCE(x.total, 0) / 500 + 1
        FROM (SELECT p2.user_id, (SELECT SUM(amount) FROM xp_logs l WHERE l.user_id = p2.user_id) AS total
              FROM student_profiles p2) x
        WHERE x.user_id = p.user_id
    """)


def downgrade() -> None:
    op.drop_index('ux_leaderboard_user_day', table_name='leaderboard_snapshots')
    op.drop_index('ix_leaderboard_state', table_name='leaderboard_snapshots')
    op.drop_index('ix_leaderboard_national', table_name='leaderboard_snapshots')
    op.drop_table('leaderboard_snapshots')
    op.drop_index('ux_xp_logs_user_ref', table_name='xp_logs')
    op.drop_column('xp_logs', 'ref_key')
    op.drop_column('student_profiles', 'leaderboard_display')
    op.drop_index('ix_student_profiles_username', table_name='student_profiles')
    op.drop_column('student_profiles', 'username')
    op.drop_column('student_profiles', 'state')
