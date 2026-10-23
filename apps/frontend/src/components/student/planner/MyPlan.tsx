import React, { useEffect, useState } from 'react';
import {
  PlanOverview, PlannerTask, catchUp, clearPlan, fetchOverview, fetchPlanTasks, fetchTasksBetween, sharePlan,
} from '../../../services/plannerService';
import { downloadPlanIcs, downloadPlanPdf } from '../../../utils/planExport';
import { CountRows, Notice, ProTag, btn, card, fmt, h2, sub } from './plannerUi';

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "My plan": summary, progress by subject, the list of plan days, and clear / catch up / export / share. */
export function MyPlan({ version, pro, onChanged, onOpenDay, onUpgrade }: {
  version: number;
  pro: boolean;
  onChanged: () => void;
  onOpenDay: (date: string) => void;
  onUpgrade: () => void;
}) {
  const [ov, setOv] = useState<PlanOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [popup, setPopup] = useState<{ date: string; tasks: PlannerTask[] } | null>(null);

  useEffect(() => {
    fetchOverview().then((o) => { setOv(o); if (o.auto_catchup) setMsg(o.auto_catchup); }).catch((e) => setError(e.message));
  }, [version]);

  const act = async (fn: () => Promise<string | void>) => {
    setError(null);
    setMsg(null);
    try {
      const m = await fn();
      if (m) setMsg(m);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const examLabel = ov?.plan?.exam_label || 'Study plan';
  const exportWith = (kind: 'pdf' | 'ics') => act(async () => {
    const tasks = await fetchPlanTasks();
    if (kind === 'pdf') downloadPlanPdf(tasks, examLabel);
    else downloadPlanIcs(tasks);
    return kind === 'ics' ? 'Calendar file downloaded. Open it to add all days to your calendar.' : undefined;
  });

  const share = () => act(async () => {
    const { token } = await sharePlan();
    const link = `${window.location.origin}/study-planner?plan=${token}`;
    setShareLink(link);
    try {
      if (navigator.share) { await navigator.share({ title: 'My study plan', text: `My ${examLabel} study plan on ExamPlanner`, url: link }); return; }
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
    }
    try { await navigator.clipboard.writeText(link); return 'Plan link copied.'; } catch { return 'Copy the link below.'; }
  });

  const openPopup = async (date: string) => {
    try {
      const tasks = (await fetchTasksBetween(date, date)).filter((t) => t.planned);
      setPopup({ date, tasks });
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (!ov) return <section style={card}>{error ? <Notice kind="error">{error}</Notice> : <p style={sub}>Loading your plan…</p>}</section>;

  return (
    <section style={card}>
      <h2 style={h2}>My plan</h2>
      <p style={sub}>Your full schedule and progress. Tap a day to see its tasks.</p>
      {msg && <div style={{ marginBottom: 10 }}><Notice kind="ok">{msg}</Notice></div>}
      {error && <div style={{ marginBottom: 10 }}><Notice kind="error">{error}</Notice></div>}

      {!ov.day_list.length ? (
        <p style={{ fontSize: 13.5, color: 'var(--text-muted)', margin: 0 }}>No plan yet. Use "Set up your study plan" above to generate one. It will show up here.</p>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            {[ov.plan?.exam_label, plural(ov.topics, 'topic'), plural(ov.days, 'day'), `${ov.done} done`,
              ov.end_date && `Ends ${fmt(ov.end_date, { month: 'short', day: 'numeric' })}`].filter(Boolean).map((x) => (
              <span key={String(x)} style={{ fontSize: 12.5, fontWeight: 700, padding: '4px 10px', borderRadius: 999, backgroundColor: 'var(--bg-subtle)', color: 'var(--text-secondary)' }}>{x}</span>
            ))}
          </div>
          <CountRows rows={ov.subjects} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 6, marginTop: 14, maxHeight: 260, overflowY: 'auto' }}>
            {ov.day_list.map((d) => (
              <button key={d.date} type="button" onClick={() => openPopup(d.date)}
                style={{ textAlign: 'left', padding: '8px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border-default)', cursor: 'pointer',
                  backgroundColor: d.total && d.done === d.total ? '#ECFDF5' : 'var(--bg-card)', color: 'var(--text-primary)' }}>
                <div style={{ fontSize: 12.5, fontWeight: 700 }}>{fmt(d.date, { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{d.done}/{d.total} done</div>
              </button>
            ))}
          </div>
        </>
      )}

      {shareLink && (
        <input readOnly value={shareLink} onFocus={(e) => e.target.select()} aria-label="Plan link"
          style={{ width: '100%', marginTop: 12, padding: '8px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border-default)', fontSize: 13, boxSizing: 'border-box', backgroundColor: 'var(--bg-subtle)', color: 'var(--text-primary)' }} />
      )}

      {ov.day_list.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="button" style={btn()} onClick={() => window.confirm('Remove all pending plan topics and auto revisions? Completed tasks and your own tasks stay.')
            && act(async () => { const r = await clearPlan(); onChanged(); return `Plan cleared (${plural(r.removed, 'task')} removed).`; })}>Clear plan</button>
          {ov.missed > 0 && (
            <button type="button" style={btn()} onClick={() => act(async () => { const r = await catchUp(); onChanged(); return `Moved ${plural(r.moved, 'missed topic')} into the next few days.`; })}>
              Catch up ({ov.missed} missed)
            </button>
          )}
          <button type="button" style={btn()} onClick={() => (pro ? exportWith('ics') : onUpgrade())}>Add to calendar{!pro && <ProTag />}</button>
          <button type="button" style={btn()} onClick={() => (pro ? share() : onUpgrade())}>Share link{!pro && <ProTag />}</button>
          <button type="button" style={btn(true)} onClick={() => (pro ? exportWith('pdf') : onUpgrade())}>Download PDF{!pro && <ProTag />}</button>
        </div>
      )}

      {popup && (
        <div role="dialog" aria-modal="true" aria-label={`Tasks on ${popup.date}`} onClick={(e) => e.target === e.currentTarget && setPopup(null)}
          onKeyDown={(e) => e.key === 'Escape' && setPopup(null)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ ...card, width: '100%', maxWidth: 440, maxHeight: '80vh', overflowY: 'auto' }}>
            <h3 style={{ ...h2, fontSize: 16 }}>{fmt(popup.date, { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: '10px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {!popup.tasks.length && <li style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>No tasks planned.</li>}
              {popup.tasks.map((t) => (
                <li key={t.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13.5, color: 'var(--text-primary)', textDecoration: t.done ? 'line-through' : 'none', opacity: t.done ? 0.65 : 1 }}>
                  <span>{t.title}</span><small style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{t.minutes} min</small>
                </li>
              ))}
            </ul>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" style={btn()} onClick={() => setPopup(null)} autoFocus>Close</button>
              <button type="button" style={btn(true)} onClick={() => { onOpenDay(popup.date); setPopup(null); }}>Open this day</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
