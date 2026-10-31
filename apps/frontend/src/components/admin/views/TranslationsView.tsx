import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Languages, RefreshCw, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useBreakpoint } from '../../../hooks/useBreakpoint';
import {
  CoverageCounts,
  CoverageKind,
  ExamCoverage,
  TranslationCoverage,
  fetchTranslationCoverage,
  translateAllMissing,
  translateExam,
} from '../../../services/translationCoverageService';

const card: React.CSSProperties = {
  backgroundColor: 'var(--bg-card)',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius)',
};

const KINDS: { kind: CoverageKind; label: string; short: string }[] = [
  { kind: 'questions', label: 'Questions', short: 'Q' },
  { kind: 'options', label: 'Options', short: 'Opt' },
  { kind: 'explanations', label: 'Explanations', short: 'Expl' },
  { kind: 'analyses', label: 'Option analyses', short: 'Anl' },
];

/** What a language's count is measured against: every question/option, or what exists in English. */
function denominator(kind: CoverageKind, questions: number, options: number, english: CoverageCounts): number {
  if (kind === 'questions') return questions;
  if (kind === 'options') return options;
  return english[kind];
}

function pct(done: number, total: number): number | null {
  if (!total) return null;
  return Math.min(100, Math.round((done * 100) / total));
}

function barColor(p: number | null): string {
  if (p === null) return 'var(--border-default)';
  if (p >= 100) return '#059669';
  if (p >= 50) return '#D97706';
  return '#DC2626';
}

function Bar({ label, done, total }: { label: string; done: number; total: number }) {
  const p = pct(done, total);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
        <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{label}</span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
          {total ? `${done.toLocaleString()} / ${total.toLocaleString()}` : 'Nothing to translate'}
        </span>
      </div>
      <div style={{ height: 8, borderRadius: 999, backgroundColor: 'var(--bg-subtle)', overflow: 'hidden' }}>
        <div style={{ width: `${p ?? 0}%`, height: '100%', backgroundColor: barColor(p) }} />
      </div>
    </div>
  );
}

function RunStatus({ exam }: { exam: ExamCoverage }) {
  const run = exam.translation_run;
  if (run && (run.status === 'RUNNING' || run.status === 'PENDING')) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#2563EB', fontWeight: 700, fontSize: 13 }}>
        <Loader2 size={14} className="animate-spin" /> Translating {Math.round(run.progress_percent)}%
      </span>
    );
  }
  if (exam.missing === 0) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#059669', fontWeight: 700, fontSize: 13 }}>
        <CheckCircle2 size={14} /> Complete
      </span>
    );
  }
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ color: '#B45309', fontWeight: 700, fontSize: 13 }}>{exam.missing.toLocaleString()} missing</span>
      {run?.status === 'FAILED' && (
        <span title={run.error || ''} style={{ color: '#DC2626', fontSize: 12 }}>Last run failed</span>
      )}
    </span>
  );
}

/** Admin: how much of each exam is translated into Hindi and Marathi, and running the translation. */
export function TranslationsView() {
  const { isMobile } = useBreakpoint();
  const [data, setData] = useState<TranslationCoverage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [onlyIncomplete, setOnlyIncomplete] = useState(false);
  const [starting, setStarting] = useState<number | 'all' | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      setData(await fetchTranslationCoverage());
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const running = useMemo(
    () => (data?.exams || []).some((e) => e.translation_run && ['RUNNING', 'PENDING'].includes(e.translation_run.status)),
    [data],
  );

  // While something is translating, keep the numbers moving
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => load(true), 5000);
    return () => clearInterval(t);
  }, [running, load]);

  const start = async (target: number | 'all') => {
    setStarting(target);
    setNotice(null);
    setError(null);
    try {
      if (target === 'all') await translateAllMissing();
      else await translateExam(target);
      setNotice(
        target === 'all'
          ? 'Translating everything that is missing. This runs in the background and can take a while.'
          : 'Translation started. The numbers update as it runs.',
      );
      setTimeout(() => load(true), 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setStarting(null);
    }
  };

  const others = (data?.languages || []).filter((l) => l.code !== 'en');
  const exams = (data?.exams || []).filter((e) => !onlyIncomplete || e.missing > 0);
  const english = data?.totals.by_language.en;

  const cell = (exam: ExamCoverage, code: string) => {
    const counts = exam.by_language[code];
    const en = exam.by_language.en;
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: 14, rowGap: 2, fontSize: 12.5 }}>
        {KINDS.map(({ kind, short, label }) => {
          const p = pct(counts[kind], denominator(kind, exam.questions, exam.options, en));
          return (
            <span key={kind} title={label} style={{ whiteSpace: 'nowrap' }}>
              <span style={{ color: 'var(--text-muted)' }}>{short} </span>
              <span style={{ fontWeight: 700, color: p === null ? 'var(--text-muted)' : barColor(p) }}>{p === null ? '—' : `${p}%`}</span>
            </span>
          );
        })}
      </div>
    );
  };

  const translateButton = (exam: ExamCoverage) => {
    const busy = starting === exam.exam_id || (exam.translation_run && ['RUNNING', 'PENDING'].includes(exam.translation_run.status));
    return (
      <button
        type="button"
        disabled={!!busy || exam.missing === 0}
        onClick={() => start(exam.exam_id)}
        aria-label={`Translate ${exam.name}`}
        style={{
          padding: '7px 12px',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border-default)',
          backgroundColor: 'var(--bg-card)',
          color: 'var(--text-primary)',
          fontWeight: 700,
          fontSize: 13,
          cursor: busy || exam.missing === 0 ? 'not-allowed' : 'pointer',
          opacity: busy || exam.missing === 0 ? 0.5 : 1,
          whiteSpace: 'nowrap',
        }}
      >
        Translate missing
      </button>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ ...card, padding: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Languages size={20} color="#2563EB" /> Translations
          </h2>
          <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text-muted)' }}>
            How much of each paper is in Hindi and Marathi. New papers are translated after upload, and a nightly job fills any gaps.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => load()}
            aria-label="Refresh"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 14px', borderRadius: 'var(--radius)', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', fontWeight: 700, cursor: 'pointer' }}
          >
            <RefreshCw size={15} /> Refresh
          </button>
          <button
            type="button"
            disabled={!data || data.totals.missing === 0 || running || starting !== null}
            onClick={() => start('all')}
            style={{
              padding: '10px 16px',
              borderRadius: 'var(--radius)',
              border: 'none',
              backgroundColor: 'var(--primary-red)',
              color: '#fff',
              fontWeight: 700,
              cursor: 'pointer',
              opacity: !data || data.totals.missing === 0 || running || starting !== null ? 0.5 : 1,
            }}
          >
            {starting === 'all' ? 'Starting…' : 'Translate all missing'}
          </button>
        </div>
      </div>

      {notice && (
        <div role="status" style={{ ...card, padding: '10px 14px', borderColor: '#A7F3D0', backgroundColor: '#ECFDF5', color: '#047857', fontSize: 13.5 }}>
          {notice}
        </div>
      )}
      {error && (
        <div role="alert" style={{ ...card, padding: '10px 14px', borderColor: '#FECACA', backgroundColor: '#FEF2F2', color: '#B91C1C', fontSize: 13.5, display: 'flex', gap: 8, alignItems: 'center' }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {loading && !data ? (
        <div style={{ ...card, padding: 24, color: 'var(--text-muted)' }}>Loading coverage…</div>
      ) : data && english ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : `repeat(${Math.max(1, others.length)}, 1fr)`, gap: 16 }}>
            {others.map((lang) => {
              const counts = data.totals.by_language[lang.code];
              return (
                <section key={lang.code} aria-label={`${lang.name} coverage`} data-lang={lang.code} style={{ ...card, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
                    {lang.native_name} <span style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: 13 }}>{lang.name}</span>
                  </h3>
                  {KINDS.map(({ kind, label }) => (
                    <Bar key={kind} label={label} done={counts[kind]} total={denominator(kind, data.totals.questions, data.totals.options, english)} />
                  ))}
                </section>
              );
            })}
          </div>
          <p style={{ margin: '-4px 0 0', fontSize: 12.5, color: 'var(--text-muted)' }}>
            Explanations and option analyses are counted against how many exist in English. A Hindi or Marathi text that is still the English wording counts as not translated; numbers and formulas that stay the same count as translated.
          </p>

          <div style={{ ...card, padding: isMobile ? 12 : 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>By paper ({exams.length})</h3>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13.5, cursor: 'pointer' }}>
                <input type="checkbox" checked={onlyIncomplete} onChange={(e) => setOnlyIncomplete(e.target.checked)} />
                Only papers with something missing
              </label>
            </div>
            {exams.length === 0 ? (
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 14 }}>Every paper is fully translated.</p>
            ) : isMobile ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {exams.map((exam) => (
                  <div key={exam.exam_id} data-exam={exam.exam_id} style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, overflowWrap: 'anywhere' }}>{exam.name}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{exam.questions} questions · {exam.options} options</div>
                    {others.map((lang) => (
                      <div key={lang.code}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 2 }}>{lang.native_name}</div>
                        {cell(exam, lang.code)}
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <RunStatus exam={exam} />
                      {translateButton(exam)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', minWidth: 0, borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: 12.5 }}>
                      <th style={{ padding: '8px 10px' }}>Paper</th>
                      <th style={{ padding: '8px 10px' }}>Questions</th>
                      {others.map((lang) => (
                        <th key={lang.code} style={{ padding: '8px 10px' }}>{lang.native_name} ({lang.name})</th>
                      ))}
                      <th style={{ padding: '8px 10px' }}>Status</th>
                      <th style={{ padding: '8px 10px' }} />
                    </tr>
                  </thead>
                  <tbody>
                    {exams.map((exam) => (
                      <tr key={exam.exam_id} data-exam={exam.exam_id} style={{ borderTop: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '10px', fontWeight: 600, maxWidth: 260 }}>
                          <div style={{ overflowWrap: 'anywhere' }}>{exam.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>{exam.code}</div>
                        </td>
                        <td style={{ padding: '10px' }}>{exam.questions}</td>
                        {others.map((lang) => (
                          <td key={lang.code} style={{ padding: '10px' }}>{cell(exam, lang.code)}</td>
                        ))}
                        <td style={{ padding: '10px' }}><RunStatus exam={exam} /></td>
                        <td style={{ padding: '10px', textAlign: 'right' }}>{translateButton(exam)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
              Q = questions, Opt = options, Expl = explanations, Anl = option analyses. — means there is nothing in English to translate.
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}
