import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check as CheckIcon, Pause, Play, Plus, Square, Trash2, X } from 'lucide-react';
import { completeStudyTask, deleteStudyTask } from '../../../services/studyPlannerService';
import { PlannerTask, fetchTasksBetween, logFocus, reopenTask, skipTask } from '../../../services/plannerService';
import { Notice, SubjectTag, addDays, card, fmt, h2, mondayOf, smallBtn, todayKey } from './plannerUi';

const FOCUS_SECONDS = 25 * 60;

interface Timer { task: PlannerTask; left: number; elapsed: number; running: boolean; last: number }

/** "Aaj": the week strip, the selected day's tasks and the 25-minute focus timer. */
export function PlannerToday({ version, onChanged, onAddTask, focusDate }: {
  version: number;
  onChanged: () => void;
  onAddTask: () => void;
  /** A day picked elsewhere (My plan, the month calendar) to open here. */
  focusDate?: string | null;
}) {
  const navigate = useNavigate();
  const [selected, setSelected] = useState(focusDate || todayKey());
  useEffect(() => { if (focusDate) setSelected(focusDate); }, [focusDate]);
  const [tasks, setTasks] = useState<PlannerTask[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [timer, setTimer] = useState<Timer | null>(null);
  const timerRef = useRef<Timer | null>(null);
  timerRef.current = timer;
  const week = mondayOf(selected);
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));

  const load = useCallback(async () => {
    try {
      setTasks(await fetchTasksBetween(week, addDays(week, 6)));
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  }, [week]);

  useEffect(() => { load(); }, [load, version]);

  // Tick the focus timer once a second while it runs
  useEffect(() => {
    if (!timer?.running) return;
    const id = window.setInterval(() => {
      const t = timerRef.current;
      if (!t || !t.running) return;
      const now = Date.now();
      const dt = (now - t.last) / 1000;
      const left = t.left - dt;
      if (left > 0) {
        setTimer({ ...t, left, elapsed: t.elapsed + dt, last: now });
        return;
      }
      const done = { ...t, left: 0, elapsed: 0, running: false, last: now };
      timerRef.current = done;
      setTimer(done);
      const mins = Math.round((t.elapsed + dt) / 60);
      if (mins > 0) logFocus(mins, t.task.id).then(onChanged).catch(() => {});
      try { navigator.vibrate?.([200, 100, 200]); } catch { /* not supported */ }
      setMsg('Session complete. Take a 5 minute break.');
    }, 1000);
    return () => window.clearInterval(id);
  }, [timer?.running, onChanged]);

  const flushFocus = async (t: Timer | null) => {
    if (!t) return;
    const elapsed = t.elapsed + (t.running ? (Date.now() - t.last) / 1000 : 0);
    const mins = Math.round(elapsed / 60);
    if (mins > 0) await logFocus(mins, t.task.id).catch(() => {});
  };

  const run = async (fn: () => Promise<unknown>, after?: string) => {
    setError(null);
    try {
      await fn();
      if (after) setMsg(after);
      await load();
      onChanged();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const toggle = (t: PlannerTask) => run(() => (t.done ? reopenTask(t.id) : completeStudyTask(String(t.id))),
    !t.done && t.planner_subtopic_id && !t.block ? 'Done. Marked covered, and revisions are lined up for +1, +3, +7 and +21 days.' : undefined);

  const startTimer = async (t: PlannerTask) => {
    await flushFocus(timerRef.current);
    setMsg(null);
    setTimer({ task: t, left: FOCUS_SECONDS, elapsed: 0, running: true, last: Date.now() });
  };

  const stopTimer = async (markDone: boolean) => {
    const t = timerRef.current;
    setTimer(null);
    await flushFocus(t);
    if (markDone && t && !t.task.done) await run(() => completeStudyTask(String(t.task.id)));
    else onChanged();
  };

  const practice = (t: PlannerTask) => {
    if (!t.practice) return;
    const q = new URLSearchParams({ exam: t.practice.exam || 'All Exams' });
    (['subject', 'topic', 'subtopic'] as const).forEach((k) => { const v = t.practice?.[k]; if (v) q.set(k, v); });
    navigate(`/practice-exam?${q.toString()}`);
  };

  const dayTasks = tasks.filter((t) => t.date === selected);
  const today = todayKey();
  const mmss = (s: number) => `${String(Math.floor(Math.max(0, s) / 60)).padStart(2, '0')}:${String(Math.round(Math.max(0, s)) % 60).padStart(2, '0')}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" style={smallBtn} onClick={() => setSelected(addDays(selected, -7))} aria-label="Previous week">← Prev</button>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', minWidth: 120, textAlign: 'center' }}>
          {fmt(week, { month: 'short', day: 'numeric' })} – {fmt(addDays(week, 6), { month: 'short', day: 'numeric' })}
        </span>
        <button type="button" style={smallBtn} onClick={() => setSelected(today)}>Today</button>
        <button type="button" style={smallBtn} onClick={() => setSelected(addDays(selected, 7))} aria-label="Next week">Next →</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6 }}>
        {days.map((d) => {
          const list = tasks.filter((t) => t.date === d);
          const done = list.filter((t) => t.done).length;
          const sel = d === selected;
          return (
            <button key={d} type="button" onClick={() => setSelected(d)} aria-pressed={sel}
              style={{
                padding: '8px 2px', borderRadius: 'var(--radius)', cursor: 'pointer', textAlign: 'center',
                border: `1px solid ${sel ? 'var(--accent-primary)' : d === today ? 'var(--accent-border)' : 'var(--border-default)'}`,
                backgroundColor: sel ? 'var(--accent-bg)' : 'var(--bg-card)', color: 'var(--text-primary)', minWidth: 0,
              }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{fmt(d, { weekday: 'short' })}</div>
              <div style={{ fontSize: 17, fontWeight: 800 }}>{fmt(d, { day: 'numeric' })}</div>
              <div style={{ fontSize: 10.5, color: done && done === list.length ? '#047857' : 'var(--text-muted)', minHeight: 14 }}>{list.length ? `${done}/${list.length}` : ''}</div>
            </button>
          );
        })}
      </div>

      {timer && (
        <div style={{ ...card, padding: 14, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', borderColor: 'var(--accent-border)', position: 'sticky', top: 70, zIndex: 5 }}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Focus session</div>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{timer.task.title}</div>
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: 'var(--accent-primary)' }} aria-live="polite">{mmss(timer.left)}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" style={smallBtn} onClick={() => setTimer((t) => t && (t.left <= 0
              ? { ...t, left: FOCUS_SECONDS, running: true, last: Date.now() }
              : t.running ? { ...t, running: false, elapsed: t.elapsed + (Date.now() - t.last) / 1000, left: t.left - (Date.now() - t.last) / 1000 } : { ...t, running: true, last: Date.now() }))}>
              {timer.running ? <><Pause size={12} /> Pause</> : <><Play size={12} /> {timer.left > 0 ? 'Resume' : 'Restart'}</>}
            </button>
            <button type="button" style={smallBtn} onClick={() => stopTimer(true)}><CheckIcon size={12} /> Mark done</button>
            <button type="button" style={smallBtn} onClick={() => stopTimer(false)}><Square size={12} /> Stop</button>
          </div>
        </div>
      )}

      <section style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <h2 style={{ ...h2, margin: 0 }}>{fmt(selected, { weekday: 'long', month: 'long', day: 'numeric' })}</h2>
          <button type="button" style={smallBtn} onClick={onAddTask}><Plus size={12} /> Add task</button>
        </div>
        {msg && <div style={{ marginBottom: 10 }}><Notice kind="ok">{msg}</Notice></div>}
        {error && <div style={{ marginBottom: 10 }}><Notice kind="error">{error}</Notice></div>}
        {!dayTasks.length && <p style={{ fontSize: 13.5, color: 'var(--text-muted)', margin: 0 }}>No tasks for this day yet. Generate a plan in the Plan tab, or add a task.</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {dayTasks.map((t) => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border-default)', backgroundColor: t.done ? 'var(--bg-subtle)' : 'var(--bg-card)', flexWrap: 'wrap' }}>
              <button type="button" aria-pressed={t.done} aria-label={t.done ? `Mark "${t.title}" not done` : `Mark "${t.title}" done`} onClick={() => toggle(t)}
                style={{ width: 24, height: 24, borderRadius: 6, flexShrink: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  border: `2px solid ${t.done ? '#16A34A' : 'var(--border-default)'}`, backgroundColor: t.done ? '#16A34A' : 'transparent', color: '#fff' }}>
                {t.done && <CheckIcon size={14} />}
              </button>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', textDecoration: t.done ? 'line-through' : 'none', opacity: t.done ? 0.7 : 1 }}>{t.title}</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-muted)' }}>
                  <SubjectTag subject={t.subject} />
                  <span>{t.minutes} min</span>
                  {t.planned && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-primary)' }}>Plan</span>}
                </div>
              </div>
              {!t.done && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {t.practice && <button type="button" style={smallBtn} onClick={() => practice(t)} title="Practise PYQs on this topic">Practice</button>}
                  <button type="button" style={smallBtn} onClick={() => startTimer(t)} title="Start a 25 min focus timer">Start</button>
                  <button type="button" style={smallBtn} onClick={() => run(() => skipTask(t.id), 'Moved to the next day.')} title="Move to next day">Skip →</button>
                </div>
              )}
              <button type="button" aria-label={`Delete "${t.title}"`} onClick={() => window.confirm('Remove this task?') && run(() => deleteStudyTask(String(t.id)))}
                style={{ ...smallBtn, border: 'none', padding: 4, color: 'var(--text-muted)' }}>
                {t.planned ? <X size={15} /> : <Trash2 size={15} />}
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
