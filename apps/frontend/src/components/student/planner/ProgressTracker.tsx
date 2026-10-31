import React, { useEffect, useState } from 'react';
import { TrackerData, fetchTracker, savePlannerSettings } from '../../../services/plannerService';
import { Bar, Chip, CountRows, Notice, RichText, card, fmt, h2, input, parseKey, smallBtn, todayKey, dateKey } from './plannerUi';

/** Progress tracker: week or month stats, a month calendar, the daily goal, subjects and this week's tips. */
export function ProgressTracker({ version, onOpenDay }: { version: number; onOpenDay: (date: string) => void }) {
  const [range, setRange] = useState<'week' | 'month'>('week');
  const [anchor, setAnchor] = useState(todayKey());
  const [data, setData] = useState<TrackerData | null>(null);
  const [goal, setGoal] = useState<number | ''>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTracker(range, anchor).then((d) => { setData(d); setGoal(d.daily_goal); }).catch((e) => setError(e.message));
  }, [range, anchor, version]);

  const stepMonth = (dir: number) => {
    const d = parseKey(anchor);
    setAnchor(dateKey(new Date(d.getFullYear(), d.getMonth() + dir, 1)));
  };

  const saveGoal = async () => {
    const g = Math.max(1, Math.min(30, Number(goal) || 3));
    try {
      await savePlannerSettings({ daily_goal: g });
      setData((d) => (d ? { ...d, daily_goal: g } : d));
      setGoal(g);
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (!data) return <section style={card}>{error ? <Notice kind="error">{error}</Notice> : 'Loading progress…'}</section>;
  const goalMet = data.today_done >= data.daily_goal;
  const lead = (parseKey(data.start).getDay() + 6) % 7;
  const today = todayKey();
  const label = range === 'week'
    ? `${fmt(data.start, { month: 'short', day: 'numeric' })} – ${fmt(data.end, { month: 'short', day: 'numeric' })}`
    : fmt(data.start, { month: 'long', year: 'numeric' });

  return (
    <section style={card}>
      <h2 style={h2}>Progress tracker</h2>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', margin: '10px 0 14px' }}>
        <Chip on={range === 'week'} onClick={() => { setRange('week'); setAnchor(todayKey()); }}>Week</Chip>
        <Chip on={range === 'month'} onClick={() => { setRange('month'); setAnchor(todayKey()); }}>Month</Chip>
        <span style={{ flex: 1 }} />
        {range === 'month' && <button type="button" style={smallBtn} aria-label="Previous month" onClick={() => stepMonth(-1)}>←</button>}
        <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>{label}</span>
        {range === 'month' && <button type="button" style={smallBtn} aria-label="Next month" onClick={() => stepMonth(1)}>→</button>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10, marginBottom: 14 }}>
        {[[`${data.percent}%`, 'completed'], [`${data.done}/${data.total}`, 'tasks'], [`${data.hours}h`, 'studied'], [String(data.streak), 'day streak']].map(([v, l]) => (
          <div key={l} style={{ padding: '12px 14px', borderRadius: 'var(--radius)', backgroundColor: l === 'day streak' && data.streak >= 3 ? '#FFF7E6' : 'var(--bg-subtle)' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>{v}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{l}</div>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '0 0 12px' }}>
        {data.focus_minutes ? `Focus timer logged: ${Math.floor(data.focus_minutes / 60)}h ${data.focus_minutes % 60}m` : 'Focus timer: no sessions logged in this range.'}
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 13.5, color: 'var(--text-primary)' }}>
        <span>Daily goal</span>
        <input type="number" min={1} max={30} value={goal} aria-label="Daily goal (tasks)" onChange={(e) => setGoal(e.target.value === '' ? '' : Number(e.target.value))}
          onBlur={saveGoal} onKeyDown={(e) => e.key === 'Enter' && saveGoal()} style={{ ...input, width: 64, padding: '5px 8px' }} />
        <span>tasks</span>
        <span style={{ fontWeight: 700, color: goalMet ? '#047857' : 'var(--text-muted)' }}>{goalMet ? 'Goal met today' : `Today ${data.today_done}/${data.daily_goal}`}</span>
      </div>
      <div style={{ display: 'flex', margin: '8px 0 16px' }}>
        <Bar done={Math.min(data.today_done, data.daily_goal)} total={data.daily_goal} color={goalMet ? '#16A34A' : 'var(--accent-primary)'} />
      </div>

      {range === 'month' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4, marginBottom: 16 }}>
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((x, i) => <div key={i} style={{ fontSize: 11, textAlign: 'center', color: 'var(--text-muted)', fontWeight: 700 }}>{x}</div>)}
          {Array.from({ length: lead }, (_, i) => <div key={`x${i}`} />)}
          {data.calendar.map((c) => {
            const bg = !c.total ? 'var(--bg-card)' : c.done === c.total ? '#DCFCE7' : c.done ? '#FEF9C3' : c.date < today ? '#FEE2E2' : 'var(--bg-subtle)';
            return (
              <button key={c.date} type="button" onClick={() => onOpenDay(c.date)} aria-label={`${fmt(c.date, { month: 'long', day: 'numeric' })}: ${c.done} of ${c.total} done`}
                style={{ padding: '6px 2px', borderRadius: 6, border: `1px solid ${c.date === today ? 'var(--accent-primary)' : 'var(--border-default)'}`, backgroundColor: bg, cursor: 'pointer', color: 'var(--text-primary)', minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{parseKey(c.date).getDate()}</div>
                <small style={{ fontSize: 10, color: 'var(--text-muted)' }}>{c.total ? `${c.done}/${c.total}` : ''}</small>
              </button>
            );
          })}
        </div>
      )}

      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', margin: '4px 0 8px' }}>By subject</div>
      <CountRows rows={data.subjects} />

      <h3 style={{ fontSize: 15, fontWeight: 800, margin: '18px 0 8px', color: 'var(--text-primary)' }}>Is hafte ke tips</h3>
      <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13.5, color: 'var(--text-primary)' }}>
        {data.tips.map((t) => <li key={t}><RichText text={t} /></li>)}
      </ul>
    </section>
  );
}
