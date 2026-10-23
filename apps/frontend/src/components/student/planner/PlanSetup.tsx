import React, { useEffect, useMemo, useState } from 'react';
import {
  PlanRequest, PlannerExam, PlannerSettings, estimatePlan, fetchSyllabus, generatePlan,
} from '../../../services/plannerService';
import { Check, Chip, Notice, ProTag, WEEKDAYS, btn, card, h2, input, label, sub, todayKey } from './plannerUi';

const DAY_PRESETS = [7, 15, 30, 60, 90];

const DEFAULTS: PlanRequest = {
  exam: 'prelims', days: 30, exam_date: null, subjects: null, subject_days: {}, hours: 4, mock: 0, rest: null,
  tail: true, mix: 1, ca: true, pyq: true, custom_title: '', weak_first: false, auto_catch: true,
};

/** "Set up your study plan": pick an exam and days, optionally fine-tune, then generate. */
export function PlanSetup({ exams, settings, onGenerated, onUpgrade }: {
  exams: PlannerExam[];
  settings: PlannerSettings;
  onGenerated: (message: string, warning: string | null) => void;
  onUpgrade: () => void;
}) {
  const [form, setForm] = useState<PlanRequest>(() => {
    const p = { ...DEFAULTS, ...(settings.prefs || {}) } as PlanRequest;
    if (!exams.some((e) => e.code === p.exam)) p.exam = exams[0]?.code || 'prelims';
    if (!settings.pro) p.days = Math.min(p.days, settings.free_max_days);
    return p;
  });
  const [subjects, setSubjects] = useState<{ name: string; pending: number }[]>([]);
  const [estimate, setEstimate] = useState<{ text: string; warning: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const pro = settings.pro;

  const mains = exams.filter((e) => e.group === 'main');
  const optionals = exams.filter((e) => e.group === 'optional');
  const isOptional = optionals.some((e) => e.code === form.exam);
  const set = <K extends keyof PlanRequest>(k: K, v: PlanRequest[K]) => setForm((f) => ({ ...f, [k]: v }));

  // Subjects of the chosen exam; a new exam starts with all of them selected
  useEffect(() => {
    let live = true;
    fetchSyllabus(form.exam).then((s) => {
      if (!live) return;
      const list = s.subjects.map((x) => ({ name: x.name, pending: x.total - x.done }));
      setSubjects(list);
      setForm((f) => {
        const keep = f.subjects?.filter((n) => list.some((x) => x.name === n));
        return { ...f, subjects: keep && keep.length ? keep : list.map((x) => x.name) };
      });
    }).catch((e) => live && setError(e.message));
    return () => { live = false; };
  }, [form.exam]);

  const request = useMemo<PlanRequest>(() => ({
    ...form,
    exam_date: form.exam_date || null,
    subject_days: pro ? Object.fromEntries(Object.entries(form.subject_days || {}).filter(([k, v]) => v > 0 && form.subjects?.includes(k))) : {},
    weak_first: pro && form.weak_first,
  }), [form, pro]);

  // Live estimate, debounced
  useEffect(() => {
    if (!request.subjects || !request.days) return;
    const id = window.setTimeout(() => {
      estimatePlan(request).then((e) => setEstimate(e)).catch((e) => setEstimate({ text: e.message, warning: null }));
    }, 300);
    return () => window.clearTimeout(id);
  }, [request]);

  const examDateChanged = (v: string) => {
    set('exam_date', v || null);
    if (!v) return;
    const left = Math.round((new Date(`${v}T00:00:00`).getTime() - new Date(`${todayKey()}T00:00:00`).getTime()) / 86400000);
    if (left >= 1) set('days', Math.min(pro ? 365 : settings.free_max_days, left));
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await generatePlan(request);
      onGenerated(res.message, res.warning);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const daysOk = pro || form.days <= settings.free_max_days;
  const noSubjects = !form.subjects?.length;

  return (
    <section style={card}>
      <h2 style={h2}>Set up your study plan</h2>
      <p style={sub}>Choose your exam and number of days, then tap Generate plan. Topics you've already covered are left out.</p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        {mains.map((e) => <Chip key={e.code} on={form.exam === e.code} onClick={() => set('exam', e.code)}>{e.label}</Chip>)}
        {optionals.length > 0 && <Chip on={isOptional} onClick={() => !isOptional && set('exam', optionals[0].code)}>Optional subject</Chip>}
      </div>
      {isOptional && (
        <select aria-label="Optional subject" style={{ ...input, marginBottom: 10 }} value={form.exam} onChange={(e) => set('exam', e.target.value)}>
          {optionals.map((e) => <option key={e.code} value={e.code}>{e.label.replace(/^Optional:\s*/, '')}</option>)}
        </select>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', margin: '6px 0 10px' }}>
        <label htmlFor="planDays" style={label}>Plan for</label>
        <input id="planDays" type="number" min={1} max={pro ? 365 : settings.free_max_days} inputMode="numeric" value={form.days || ''}
          onChange={(e) => set('days', Math.max(0, Math.min(365, parseInt(e.target.value, 10) || 0)))} style={{ ...input, width: 80 }} />
        <span style={label}>days</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {DAY_PRESETS.map((d) => (
            <Chip key={d} on={form.days === d} disabled={!pro && d > settings.free_max_days} onClick={() => set('days', d)}>{d}</Chip>
          ))}
        </div>
      </div>
      {!pro && (
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '0 0 10px' }}>
          Free plan: up to {settings.free_max_days} days. <button type="button" onClick={onUpgrade} style={{ border: 'none', background: 'none', padding: 0, color: 'var(--accent-primary)', fontWeight: 700, cursor: 'pointer', fontSize: 12.5 }}>Upgrade to Pro</button> for longer plans.
        </p>
      )}

      {estimate && <div style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 8px' }}>{estimate.text}</div>}
      {estimate?.warning && <div style={{ marginBottom: 10 }}><Notice kind="warn">{estimate.warning}</Notice></div>}

      <button type="button" onClick={() => setMore((m) => !m)} aria-expanded={more}
        style={{ border: 'none', background: 'none', padding: '4px 0', color: 'var(--accent-primary)', fontWeight: 700, cursor: 'pointer', fontSize: 13.5 }}>
        {more ? '▾' : '▸'} Add subjects, days, etc.
      </button>

      {more && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 10, paddingTop: 12, borderTop: '1px dashed var(--border-default)' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <label htmlFor="examDate" style={label}>Exam date (optional, sets the days)</label>
            <input id="examDate" type="date" min={todayKey()} value={form.exam_date || ''} onChange={(e) => examDateChanged(e.target.value)} style={input} />
          </div>

          <div>
            <div style={{ ...label, marginBottom: 6 }}>Subjects to include</div>
            {!subjects.length && <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: 0 }}>No subjects in this exam yet.</p>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 8 }}>
              {subjects.map((s) => {
                const on = !!form.subjects?.includes(s.name);
                return (
                  <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                    <Check on={on} onChange={(v) => set('subjects', v ? [...(form.subjects || []), s.name] : (form.subjects || []).filter((n) => n !== s.name))}>
                      {s.name} <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>({s.pending})</span>
                    </Check>
                    <input type="number" min={1} max={365} placeholder="days" disabled={!pro || !on} aria-label={`Days for ${s.name}`}
                      value={form.subject_days?.[s.name] || ''} style={{ ...input, width: 70, padding: '5px 8px', fontSize: 13 }}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        const next = { ...(form.subject_days || {}) };
                        if (v > 0) next[s.name] = Math.min(365, v); else delete next[s.name];
                        set('subject_days', next);
                      }} />
                  </div>
                );
              })}
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '6px 0 0' }}>
              Optional: days to give a subject. Leave blank and days are split by number of topics.{!pro && <ProTag />}
            </p>
          </div>

          <Check on={pro && form.weak_first} disabled={!pro} onChange={(v) => set('weak_first', v)}>
            Study my weak topics first (from Practice){!pro && <ProTag />}
          </Check>

          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <label style={label}>Study hours per day{' '}
              <input type="number" min={1} max={14} step={0.5} inputMode="decimal" value={form.hours}
                onChange={(e) => set('hours', Math.max(1, Math.min(14, parseFloat(e.target.value) || 1)))} style={{ ...input, width: 76, marginLeft: 6 }} />
            </label>
            <label style={label}>Weekly mock day{' '}
              <select value={form.mock ?? ''} onChange={(e) => set('mock', e.target.value === '' ? null : Number(e.target.value))} style={{ ...input, marginLeft: 6 }}>
                <option value="">None</option>
                {WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
              </select>
            </label>
            <label style={label}>Rest day{' '}
              <select value={form.rest ?? ''} onChange={(e) => set('rest', e.target.value === '' ? null : Number(e.target.value))} style={{ ...input, marginLeft: 6 }}>
                <option value="">None</option>
                {WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
              </select>
            </label>
          </div>

          <Check on={form.tail} onChange={(v) => set('tail', v)}>Keep the last ~12% of days for full revision (plans of 14+ days)</Check>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={label}>Subjects per day</span>
            {[1, 2, 3].map((m) => <Chip key={m} on={form.mix === m} onClick={() => set('mix', m)}>{m === 1 ? 'One by one' : `${m} mixed`}</Chip>)}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={label}>Daily blocks (added every study day)</div>
            <Check on={form.ca} onChange={(v) => set('ca', v)}>Current affairs, 30 min</Check>
            <Check on={form.pyq} onChange={(v) => set('pyq', v)}>10 PYQs on today's topics, 20 min</Check>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13.5, flexWrap: 'wrap' }}>
              Your own daily task
              <input type="text" maxLength={60} placeholder="e.g. Revise notes (optional)" value={form.custom_title}
                onChange={(e) => set('custom_title', e.target.value)} style={{ ...input, flex: 1, minWidth: 180 }} />
            </label>
            <Check on={form.auto_catch} onChange={(v) => set('auto_catch', v)}>Auto catch-up: shift missed topics forward every day</Check>
          </div>
        </div>
      )}

      {error && <div style={{ marginTop: 12 }}><Notice kind="error">{error}</Notice></div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
        <button type="button" style={{ ...btn(true), opacity: busy || noSubjects || !daysOk || !form.days ? 0.6 : 1 }}
          disabled={busy || noSubjects || !daysOk || !form.days} onClick={submit}>
          {busy ? 'Generating…' : 'Generate plan'}
        </button>
      </div>
    </section>
  );
}
