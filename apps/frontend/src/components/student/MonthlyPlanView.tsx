import { useEffect, useState } from 'react';
import { fetchMonthlySchedule, generateMonthlyStudyPlan, type MonthlyScheduleResponse } from '../../services/studyPlannerService';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function monthKey(offset: number): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function hours(minutes: number): string {
  if (!minutes) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h${m ? ` ${m}m` : ''}` : `${m}m`;
}

/** A calendar month of the study plan, built from the student's own results. */
export function MonthlyPlanView({ onGenerated }: { onGenerated?: () => void }) {
  const [month, setMonth] = useState(() => monthKey(0));
  const [data, setData] = useState<MonthlyScheduleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>('');

  const load = async (key: string) => {
    setLoading(true);
    try {
      const res = await fetchMonthlySchedule(key);
      setData(res);
      setSelected(prev => (prev && prev.startsWith(key) ? prev : (res.days.find(d => d.is_today) || res.days[0]).date));
    } catch {
      setMessage("Couldn't load the month. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(month); }, [month]);

  const generate = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await generateMonthlyStudyPlan(month);
      setMessage(`Planned ${res.task_count} tasks for ${monthLabel(month)} from your results.`);
      await load(month);
      onGenerated?.();
    } catch (e: any) {
      setMessage(e?.message || "Couldn't build the month plan.");
    } finally {
      setBusy(false);
    }
  };

  const days = data?.days || [];
  const planned = days.reduce((n, d) => n + d.total_tasks_count, 0);
  const done = days.reduce((n, d) => n + d.completed_tasks_count, 0);
  const lead = days.length ? (new Date(days[0].date + 'T00:00:00').getDay() + 6) % 7 : 0; // Monday first
  const selectedDay = days.find(d => d.date === selected);
  const today = days.find(d => d.is_today)?.date || '';

  return (
    <div data-testid="month-plan" style={{ backgroundColor: 'var(--bg-card)', padding: 'clamp(14px, 3vw, 28px)', borderRadius: 'var(--radius)', border: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Month plan</h3>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2, maxWidth: 560 }}>
            Built from your results: revision when questions fall due, your weakest topics, new topics with the most PYQs, and a test every Sunday. The last week is for revision and full papers.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select
            aria-label="Month"
            value={month}
            onChange={e => { setMessage(null); setMonth(e.target.value); }}
            style={{ padding: '8px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border-default)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 13 }}
          >
            {[0, 1].map(o => <option key={o} value={monthKey(o)}>{monthLabel(monthKey(o))}</option>)}
          </select>
          <button
            data-testid="generate-month"
            onClick={generate}
            disabled={busy}
            style={{ padding: '8px 14px', borderRadius: 'var(--radius)', border: 'none', background: 'var(--accent-primary)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.7 : 1 }}
          >
            {busy ? 'Planning…' : planned ? 'Rebuild month plan' : 'Build month plan'}
          </button>
        </div>
      </div>

      {message && <div role="status" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{message}</div>}

      {loading ? (
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading…</div>
      ) : (
        <>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {planned ? <><strong>{done}</strong> of <strong>{planned}</strong> tasks done in {monthLabel(month)}</> : `Nothing planned for ${monthLabel(month)} yet.`}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4 }}>
            {WEEKDAYS.map(w => (
              <div key={w} style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textAlign: 'center', paddingBottom: 4 }}>{w}</div>
            ))}
            {Array.from({ length: lead }).map((_, i) => <div key={`pad-${i}`} />)}
            {days.map(d => {
              const isSel = d.date === selected;
              const past = today && d.date < today;
              const allDone = d.total_tasks_count > 0 && d.completed_tasks_count === d.total_tasks_count;
              const hasTest = d.tasks.some(t => t.activity_type === 'MOCK_TEST');
              return (
                <button
                  key={d.date}
                  data-date={d.date}
                  onClick={() => setSelected(d.date)}
                  aria-pressed={isSel}
                  aria-label={`${d.date}: ${d.total_tasks_count} tasks, ${d.completed_tasks_count} done`}
                  style={{
                    minHeight: 64, padding: '6px 6px', borderRadius: 8, textAlign: 'left', cursor: 'pointer', minWidth: 0,
                    border: isSel ? '2px solid var(--accent-primary)' : d.is_today ? '2px solid var(--accent-border)' : '1px solid var(--border-default)',
                    background: allDone ? 'var(--status-success-bg)' : 'var(--bg-card)',
                    opacity: past && !allDone ? 0.6 : 1,
                    display: 'flex', flexDirection: 'column', gap: 2,
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)' }}>{Number(d.date.slice(8))}</span>
                  {d.total_tasks_count > 0 && (
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {d.completed_tasks_count}/{d.total_tasks_count} · {hours(d.allocated_minutes)}
                    </span>
                  )}
                  {hasTest && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-primary)' }}>Test</span>}
                </button>
              );
            })}
          </div>

          {selectedDay && (
            <div data-testid="month-day-tasks" style={{ borderTop: '1px solid var(--border-default)', paddingTop: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 10 }}>
                {new Date(selectedDay.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
                {selectedDay.allocated_minutes ? <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}> · {hours(selectedDay.allocated_minutes)}</span> : null}
              </div>
              {selectedDay.tasks.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No tasks this day.</div>
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {selectedDay.tasks.map(t => (
                    <li key={t.id} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', textDecoration: t.is_completed ? 'line-through' : 'none' }}>{t.title}</div>
                        {t.description && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t.description}</div>}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {t.is_completed ? 'Done' : hours(t.allocated_time_minutes || 30)}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
