import React, { useEffect, useState } from 'react';
import { RevisionPlanData, addRevisionPlan, fetchRevisionPlan } from '../../../services/plannerService';
import { Notice, btn, card, h2, sub } from './plannerUi';

const band = (a: number): [string, string] => (a >= 75 ? ['Strong', '#16A34A'] : a >= 55 ? ['Average', '#D97706'] : ['Weak', '#DC2626']);

/** Revision plan (Pro): subject strength and repeated mistakes from tests, and a 7-day plan to add. */
export function RevisionPlan({ pro, onChanged, onUpgrade }: { pro: boolean; onChanged: () => void; onUpgrade: () => void }) {
  const [data, setData] = useState<RevisionPlanData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!pro) return;
    fetchRevisionPlan().then(setData).catch((e) => setError(e.message));
  }, [pro]);

  if (!pro) {
    return (
      <section style={card}>
        <h2 style={h2}>Revision plan</h2>
        <p style={sub}>Study plan → Tests → Analysis → Revision. A 7-day revision plan built from your test results: your weakest subjects and the questions you keep getting wrong.</p>
        <Notice kind="info">The revision plan is part of Pro.</Notice>
        <div style={{ marginTop: 12 }}><button type="button" style={btn(true)} onClick={onUpgrade}>Upgrade to Pro</button></div>
      </section>
    );
  }

  const add = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await addRevisionPlan();
      setAdded(`Added ${r.added} tasks to your planner, starting tomorrow.`);
      onChanged();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={card}>
      <h2 style={h2}>Revision plan</h2>
      <p style={sub}>Study plan → Tests → Analysis → Revision. This plan is built from your test results.</p>
      {error && <div style={{ marginBottom: 10 }}><Notice kind="error">{error}</Notice></div>}
      {!data && !error && <p style={sub}>Loading…</p>}
      {data && (
        <>
          <Notice kind={data.sample ? 'warn' : 'info'}>
            {data.sample
              ? 'Sample analysis shown. Take a test or practise a few questions, and this page will use your real results.'
              : 'Based on your test and practice results.'}
          </Notice>

          <h3 style={{ fontSize: 15, fontWeight: 800, margin: '16px 0 8px', color: 'var(--text-primary)' }}>Subject strength</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.subjects.map((s) => {
              const [name, color] = band(s.accuracy);
              return (
                <div key={s.name} style={{ display: 'grid', gridTemplateColumns: 'minmax(90px, 150px) 1fr 44px 70px', gap: 10, alignItems: 'center', fontSize: 13 }}>
                  <b style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</b>
                  <div style={{ height: 8, borderRadius: 999, backgroundColor: 'var(--bg-subtle)', overflow: 'hidden' }}>
                    <div style={{ width: `${s.accuracy}%`, height: '100%', backgroundColor: color }} />
                  </div>
                  <span style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{s.accuracy}%</span>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color, textAlign: 'center' }}>{name}</span>
                </div>
              );
            })}
          </div>

          {data.mistakes.length > 0 && (
            <>
              <h3 style={{ fontSize: 15, fontWeight: 800, margin: '16px 0 8px', color: 'var(--text-primary)' }}>Repeated mistakes</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.mistakes.map((m) => (
                  <div key={m.question_id} style={{ padding: '8px 12px', borderRadius: 'var(--radius)', backgroundColor: 'var(--bg-subtle)', fontSize: 13 }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{m.question}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{m.subject || 'General'} · wrong {m.wrong} time{m.wrong === 1 ? '' : 's'}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          <h3 style={{ fontSize: 15, fontWeight: 800, margin: '16px 0 8px', color: 'var(--text-primary)' }}>Your 7-day revision plan</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.plan.map((items, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '56px 1fr', gap: 10, fontSize: 13, padding: '6px 0', borderTop: i ? '1px solid var(--border-default)' : 'none' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>Day {i + 1}</span>
                <div style={{ color: 'var(--text-primary)' }}>
                  {items.map((t) => <div key={t.title}>{t.title} <small style={{ color: 'var(--text-muted)' }}>· {t.minutes} min</small></div>)}
                </div>
              </div>
            ))}
          </div>
          {added && <div style={{ marginTop: 12 }}><Notice kind="ok">{added}</Notice></div>}
          <div style={{ marginTop: 14 }}>
            <button type="button" style={{ ...btn(true), opacity: busy || added ? 0.6 : 1 }} disabled={busy || !!added} onClick={add}>
              {added ? 'Added to your planner' : 'Add to my planner'}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
