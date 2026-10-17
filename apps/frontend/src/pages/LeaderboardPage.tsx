import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, Minus, AlertCircle } from 'lucide-react';
import { StudentLayout } from '../components/student/StudentLayout';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { fetchLeaderboard, LeaderboardEntry, LeaderboardResponse } from '../services/leaderboardService';

const PAGE_SIZE = 25;

const card: React.CSSProperties = {
  backgroundColor: 'var(--bg-card)',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius)',
  padding: 20,
};

function RankChange({ change }: { change: number | null }) {
  if (change == null) return <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>New</span>;
  if (change === 0) return <Minus size={14} color="var(--text-muted)" aria-label="No change" />;
  const up = change > 0;
  return (
    <span
      aria-label={`${Math.abs(change)} ${Math.abs(change) === 1 ? 'place' : 'places'} ${up ? 'up' : 'down'} since yesterday`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 2, color: up ? '#059669' : '#DC2626', fontSize: 12.5, fontWeight: 700 }}
    >
      {up ? <ArrowUp size={13} aria-hidden="true" /> : <ArrowDown size={13} aria-hidden="true" />}
      {Math.abs(change)}
    </span>
  );
}

export function LeaderboardPage(): React.ReactElement {
  const { isMobile } = useBreakpoint();
  const [scope, setScope] = useState<'national' | 'state'>('national');
  const [exam, setExam] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Leaderboard - ExamPlanner';
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetchLeaderboard({ scope, exam, page, pageSize: PAGE_SIZE, signal: controller.signal })
      .then((res) => {
        setData(res);
        if (!exam && res.exam) setExam(res.exam);
      })
      .catch((err) => {
        if (err?.name !== 'AbortError') setError('Could not load the leaderboard. Please try again.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [scope, exam, page]);

  const totalPages = Math.max(1, Math.ceil((data?.total || 0) / PAGE_SIZE));
  const updated = data?.snapshot_date
    ? new Date(`${data.snapshot_date}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  const tab = (value: 'national' | 'state', label: string) => (
    <button
      type="button"
      onClick={() => { setScope(value); setPage(1); }}
      aria-pressed={scope === value}
      style={{
        padding: '9px 16px',
        borderRadius: 'var(--radius)',
        border: 'none',
        fontWeight: 700,
        fontSize: 13.5,
        cursor: 'pointer',
        backgroundColor: scope === value ? 'var(--primary-red)' : 'var(--bg-hover)',
        color: scope === value ? '#fff' : 'var(--text-muted)',
      }}
    >
      {label}
    </button>
  );

  const row = (r: LeaderboardEntry, highlight: boolean) => (
    <tr key={`${r.rank}-${r.name}`} style={{ backgroundColor: highlight ? 'rgba(var(--primary-red-rgb), 0.06)' : undefined, borderTop: '1px solid var(--border-color)' }}>
      <td style={{ padding: '10px 12px', fontWeight: 800, color: r.rank <= 3 ? '#B45309' : 'var(--text-primary)', width: 56 }}>#{r.rank}</td>
      <td style={{ padding: '10px 12px', fontWeight: highlight ? 800 : 600, color: 'var(--text-primary)', wordBreak: 'break-word' }}>
        {r.name}
        {highlight && <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, color: 'var(--primary-red)' }}>(you)</span>}
        {isMobile && (
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 500 }}>
            {[scope === 'national' ? r.state : null, `${r.correct_answers.toLocaleString()} correct`].filter(Boolean).join(' · ')}
          </div>
        )}
      </td>
      {!isMobile && scope === 'national' && <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{r.state || '—'}</td>}
      {!isMobile && <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-secondary)' }}>{r.correct_answers.toLocaleString()}</td>}
      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>{r.xp.toLocaleString()}</td>
      <td style={{ padding: '10px 12px', textAlign: 'center', width: 64 }}><RankChange change={r.rank_change} /></td>
    </tr>
  );

  return (
    <StudentLayout pageTitle="Leaderboard">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: isMobile ? '16px 0' : '24px 0' }}>
        <section style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: isMobile ? 22 : 26, fontWeight: 800, margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Trophy size={24} color="#D97706" /> Leaderboard
            </h1>
            <p style={{ fontSize: 13.5, color: 'var(--text-muted)', margin: 0 }}>
              Ranked by XP (10 per correct answer, 50 per test, 20 per active day), then correct answers.
              {updated && <> Updated daily · last update {updated}.</>}
            </p>
          </div>
          {data && data.exams.length > 1 && (
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>
              Exam
              <select
                value={exam || ''}
                onChange={(e) => { setExam(e.target.value); setPage(1); }}
                style={{ padding: '9px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-subtle)', color: 'var(--text-primary)', fontSize: 14 }}
              >
                {data.exams.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </label>
          )}
        </section>

        {data && (data.profile_incomplete.state || data.profile_incomplete.username) && (
          <div role="note" style={{ ...card, padding: '12px 16px', borderColor: '#FDE68A', backgroundColor: '#FFFBEB', fontSize: 13.5, color: 'var(--text-secondary)' }}>
            {data.profile_incomplete.state && 'Add your state to appear in your state ranking. '}
            {data.profile_incomplete.username && 'Pick a username, or choose to show your real name. '}
            <Link to="/profile?tab=exam" style={{ color: 'var(--primary-red)', fontWeight: 700 }}>Update your profile</Link>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {tab('national', 'National')}
          {tab('state', data?.state ? data.state : 'My state')}
        </div>

        {data?.me && (
          <section style={{ ...card, display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center', borderColor: 'rgba(var(--primary-red-rgb), 0.3)' }}>
            <div>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)', fontWeight: 600 }}>Your rank</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--primary-red)' }}>#{data.me.rank} <span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 600 }}>of {data.total.toLocaleString()}</span></div>
            </div>
            <div><div style={{ fontSize: 12.5, color: 'var(--text-muted)', fontWeight: 600 }}>XP</div><div style={{ fontSize: 20, fontWeight: 800 }}>{data.me.xp.toLocaleString()}</div></div>
            <div><div style={{ fontSize: 12.5, color: 'var(--text-muted)', fontWeight: 600 }}>Correct answers</div><div style={{ fontSize: 20, fontWeight: 800 }}>{data.me.correct_answers.toLocaleString()}</div></div>
            <div><div style={{ fontSize: 12.5, color: 'var(--text-muted)', fontWeight: 600 }}>Since yesterday</div><div style={{ fontSize: 16, marginTop: 4 }}><RankChange change={data.me.rank_change} /></div></div>
          </section>
        )}

        {error && (
          <div role="alert" style={{ ...card, display: 'flex', gap: 8, alignItems: 'center', color: '#DC2626', borderColor: '#FECACA', backgroundColor: '#FEF2F2' }}>
            <AlertCircle size={18} /> {error}
          </div>
        )}

        <section style={{ ...card, padding: 0, overflow: 'hidden', opacity: loading ? 0.6 : 1 }} aria-busy={loading}>
          {!loading && data && data.rows.length === 0 ? (
            <p style={{ padding: 24, margin: 0, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
              {scope === 'state' && !data.state
                ? 'Add your state in your profile to see your state ranking.'
                : 'No one is ranked here yet. Answer a question correctly to get on the board.'}
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              {/* minWidth 0: this table is already compact on phones, so skip the global 560px scroll-table rule */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, minWidth: 0 }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-subtle)', color: 'var(--text-muted)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    <th style={{ padding: '10px 12px', textAlign: 'left' }}>Rank</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left' }}>Student</th>
                    {!isMobile && scope === 'national' && <th style={{ padding: '10px 12px', textAlign: 'left' }}>State</th>}
                    {!isMobile && <th style={{ padding: '10px 12px', textAlign: 'right' }}>Correct</th>}
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>XP</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }} aria-label="Change since yesterday">±</th>
                  </tr>
                </thead>
                <tbody>{(data?.rows || []).map((r) => row(r, r.is_me))}</tbody>
              </table>
            </div>
          )}
        </section>

        {data && data.total > PAGE_SIZE && (
          <nav aria-label="Leaderboard pages" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, fontSize: 13, color: 'var(--text-muted)' }}>
            <span>Page {page} of {totalPages}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)} style={pageBtn(page <= 1 || loading)}><ChevronLeft size={14} /> Previous</button>
              <button type="button" disabled={page >= totalPages || loading} onClick={() => setPage(page + 1)} style={pageBtn(page >= totalPages || loading)}>Next <ChevronRight size={14} /></button>
            </div>
          </nav>
        )}
      </div>
    </StudentLayout>
  );
}

const pageBtn = (disabled: boolean): React.CSSProperties => ({
  height: 36,
  padding: '0 12px',
  borderRadius: 8,
  border: '1px solid var(--border-default)',
  backgroundColor: disabled ? 'var(--bg-subtle)' : 'var(--bg-card)',
  color: disabled ? 'var(--text-muted)' : 'var(--text-primary)',
  fontWeight: 600,
  cursor: disabled ? 'not-allowed' : 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  opacity: disabled ? 0.6 : 1,
});
