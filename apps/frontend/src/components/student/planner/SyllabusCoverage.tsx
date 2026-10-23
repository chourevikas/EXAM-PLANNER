import React, { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { PlannerExam, SyllabusData, fetchSyllabus, savePlannerSettings, setCoverage } from '../../../services/plannerService';
import { Bar, Chip, Notice, btn, card, h2, input, sub } from './plannerUi';

/** Syllabus coverage: the exam's full syllabus, subtopics ticked off as the student covers them. */
export function SyllabusCoverage({ exams, version, initialExam, onChanged }: {
  exams: PlannerExam[];
  version: number;
  initialExam?: string | null;
  onChanged: () => void;
}) {
  const [exam, setExam] = useState(initialExam && exams.some((e) => e.code === initialExam) ? initialExam : exams[0]?.code);
  const [data, setData] = useState<SyllabusData | null>(null);
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const [target, setTarget] = useState<number | ''>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!exam) return;
    fetchSyllabus(exam).then((d) => { setData(d); setTarget(d.weekly_target); }).catch((e) => setError(e.message));
  }, [exam, version]);

  const toggle = async (id: number, covered: boolean) => {
    // Optimistic: flip the tick and the counts, then save
    setData((d) => {
      if (!d) return d;
      const delta = covered ? 1 : -1;
      return {
        ...d,
        done: d.done + delta,
        percent: d.total ? Math.round(((d.done + delta) * 100) / d.total) : 0,
        week_done: Math.max(0, d.week_done + delta),
        subjects: d.subjects.map((s) => {
          const has = s.topics.some((t) => t.subtopics.some((st) => st.id === id));
          return !has ? s : {
            ...s,
            done: s.done + delta,
            topics: s.topics.map((t) => ({ ...t, subtopics: t.subtopics.map((st) => (st.id === id ? { ...st, covered } : st)) })),
          };
        }),
      };
    });
    try {
      await setCoverage(id, covered);
      onChanged();
    } catch (e: any) {
      setError(e.message);
      fetchSyllabus(exam!).then(setData).catch(() => {});
    }
  };

  const saveTarget = async () => {
    const t = Math.max(1, Number(target) || 5);
    try {
      await savePlannerSettings({ weekly_target: t });
      setData((d) => (d ? { ...d, weekly_target: t } : d));
      setTarget(t);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const mains = exams.filter((e) => e.group === 'main');
  const optionals = exams.filter((e) => e.group === 'optional');

  return (
    <section style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <h2 style={h2}>Syllabus coverage</h2>
        <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent-primary)' }}>{data?.percent ?? 0}%</span>
      </div>
      <p style={sub}>Full syllabus, subject and topic-wise. Tick a subtopic off once you've covered it. Finishing a plan topic ticks it for you.</p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {mains.map((e) => <Chip key={e.code} on={exam === e.code} onClick={() => { setExam(e.code); setOpen({}); }}>{e.label}</Chip>)}
        {optionals.length > 0 && (
          <select aria-label="Optional subject" value={optionals.some((o) => o.code === exam) ? exam : ''}
            onChange={(e) => { if (e.target.value) { setExam(e.target.value); setOpen({}); } }} style={{ ...input, padding: '5px 8px', fontSize: 13 }}>
            <option value="">Optional subject…</option>
            {optionals.map((o) => <option key={o.code} value={o.code}>{o.label.replace(/^Optional:\s*/, '')}</option>)}
          </select>
        )}
      </div>

      {error && <div style={{ marginBottom: 10 }}><Notice kind="error">{error}</Notice></div>}
      {data && (
        <>
          <div style={{ display: 'flex', marginBottom: 12 }}><Bar done={data.done} total={data.total} /></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 13.5, color: 'var(--text-primary)', marginBottom: 14 }}>
            <span>Weekly target</span>
            <input type="number" min={1} value={target} aria-label="Weekly target (topics)" onChange={(e) => setTarget(e.target.value === '' ? '' : Number(e.target.value))}
              style={{ ...input, width: 64, padding: '5px 8px' }} />
            <span>topics covered</span>
            <button type="button" style={{ ...btn(), padding: '5px 12px', fontSize: 12.5 }} onClick={saveTarget}>Save target</button>
            <span style={{ fontWeight: 700, color: data.week_done >= data.weekly_target ? '#047857' : 'var(--text-muted)' }}>
              {data.week_done} of {data.weekly_target} covered this week
            </span>
          </div>

          {!data.subjects.length && <p style={{ ...sub, margin: 0 }}>No syllabus added yet for {data.exam.label}.</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.subjects.map((s) => (
              <div key={s.id} style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius)' }}>
                <button type="button" aria-expanded={!!open[s.id]} onClick={() => setOpen((o) => ({ ...o, [s.id]: !o[s.id] }))}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-primary)', textAlign: 'left' }}>
                  <ChevronRight size={16} style={{ transform: open[s.id] ? 'rotate(90deg)' : undefined, transition: 'transform .15s', flexShrink: 0 }} />
                  <span style={{ flex: 1, fontWeight: 700, fontSize: 14 }}>{s.name}</span>
                  <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{s.done}/{s.total}</span>
                </button>
                {open[s.id] && (
                  <div style={{ padding: '0 14px 12px 36px' }}>
                    {s.topics.map((t) => (
                      <div key={t.id} style={{ marginTop: 8 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>{t.name}</div>
                        {t.subtopics.map((st) => (
                          <label key={st.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '3px 0', fontSize: 13.5, cursor: 'pointer',
                            color: st.covered ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: st.covered ? 'line-through' : 'none' }}>
                            <input type="checkbox" checked={st.covered} onChange={(e) => toggle(st.id, e.target.checked)} style={{ width: 15, height: 15, accentColor: 'var(--accent-primary)' }} />
                            {st.name}
                          </label>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
