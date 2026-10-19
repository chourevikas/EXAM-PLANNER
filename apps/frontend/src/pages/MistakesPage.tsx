import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, Crown, NotebookPen, PlayCircle, RefreshCw, RotateCcw } from 'lucide-react';
import { StudentLayout } from '../components/student/StudentLayout';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { guardedFetch } from '../utils/apiGuard';

interface MistakeItem {
  question_id: string;
  question_text: string;
  subject: string | null;
  difficulty: string;
  exam_name: string | null;
  source_year: number | null;
  wrong_count: number;
  answer_count: number;
  last_wrong_at: string | null;
  fixed: boolean;
}

interface MistakesResponse {
  items: MistakeItem[];
  total: number;
  counts: { open: number; frequent: number };
  subjects: string[];
  frequent_min_wrong: number;
}

type View = 'all' | 'frequent';
const PAGE_SIZE = 20;

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

const DIFFICULTY_STYLE: Record<string, React.CSSProperties> = {
  EASY: { color: '#059669', background: '#ECFDF5', border: '1px solid #A7F3D0' },
  HARD: { color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA' },
  MEDIUM: { color: '#D97706', background: '#FFFBEB', border: '1px solid #FDE68A' },
};

const pillStyle: React.CSSProperties = {
  fontSize: 11.5, fontWeight: 700, padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap',
};

export function MistakesPage() {
  const navigate = useNavigate();
  const { isMobile } = useBreakpoint();
  const [view, setView] = useState<View>('all');
  const [subject, setSubject] = useState('');
  const [includeFixed, setIncludeFixed] = useState(false);
  const [data, setData] = useState<MistakesResponse | null>(null);
  const [items, setItems] = useState<MistakeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (skip: number): Promise<MistakesResponse | null> => {
      const token = localStorage.getItem('access_token');
      const params = new URLSearchParams({ view, skip: String(skip), limit: String(PAGE_SIZE) });
      if (subject) params.set('subject', subject);
      if (includeFixed) params.set('include_fixed', 'true');
      const res = await guardedFetch(`/api/v1/users/me/mistakes?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.status === 403) {
        setLocked(true);
        return null;
      }
      if (!res.ok) throw new Error(`Could not load your mistakes (${res.status})`);
      return res.json();
    },
    [view, subject, includeFixed],
  );

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await fetchPage(0);
      if (page) {
        setData(page);
        setItems(page.items);
      }
    } catch (err: any) {
      setError(err?.message || 'Could not load your mistakes.');
    } finally {
      setLoading(false);
    }
  }, [fetchPage]);

  useEffect(() => {
    reload();
  }, [reload]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const page = await fetchPage(items.length);
      if (page) setItems((prev) => [...prev, ...page.items]);
    } catch (err: any) {
      setError(err?.message || 'Could not load more.');
    } finally {
      setLoadingMore(false);
    }
  };

  const practiseUrl = `/practice-exam?source=mistakes${view === 'frequent' ? '&view=frequent' : ''}`;
  const openCount = view === 'frequent' ? data?.counts.frequent ?? 0 : data?.counts.open ?? 0;
  const minWrong = data?.frequent_min_wrong ?? 2;

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 14px', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 700, cursor: 'pointer',
    border: `1px solid ${active ? 'var(--primary-red)' : 'var(--border-default)'}`,
    backgroundColor: active ? 'var(--primary-red-bg)' : 'var(--bg-card)',
    color: active ? 'var(--primary-red)' : 'var(--text-secondary)', minHeight: 40,
  });

  return (
    <StudentLayout pageTitle="Mistake Notebook">
      <div style={{ maxWidth: 1100, margin: '0 auto', width: '100%' }}>
        <section
          style={{
            marginBottom: 24, padding: isMobile ? 20 : 28, borderRadius: 'var(--radius)',
            backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-color-base)',
            backgroundImage: 'linear-gradient(135deg, rgba(227,27,35,0.07) 0%, rgba(242,182,35,0.07) 100%)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16,
          }}
        >
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', backgroundColor: 'var(--primary-red-bg)', borderRadius: 'var(--radius)', marginBottom: 10, border: '1px solid var(--primary-red-border)' }}>
              <NotebookPen size={14} color="var(--primary-red)" />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary-red)', textTransform: 'uppercase' }}>Revision</span>
            </div>
            <h1 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px 0' }}>Mistake Notebook</h1>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0, maxWidth: 560 }}>
              Every question you answered wrong in tests and practice. Get one right and it leaves the list.
            </p>
          </div>
          {!locked && (
            <div style={{ display: 'flex', gap: 8, flexDirection: isMobile ? 'column' : 'row', width: isMobile ? '100%' : undefined }}>
              {openCount > 0 && (
                <button
                  type="button"
                  onClick={() => navigate(practiseUrl)}
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 16px', borderRadius: 'var(--radius)', background: 'var(--primary-red)', border: 'none', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', minHeight: 40 }}
                >
                  <PlayCircle size={15} />
                  Practise {openCount} {view === 'frequent' ? 'frequently missed' : ''} {openCount === 1 ? 'question' : 'questions'}
                </button>
              )}
              <button
                type="button"
                onClick={reload}
                disabled={loading}
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 16px', borderRadius: 'var(--radius)', background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 13, cursor: 'pointer', minHeight: 40 }}
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>
          )}
        </section>

        {locked ? (
          <div
            data-testid="mistakes-locked"
            style={{ padding: isMobile ? 24 : 40, borderRadius: 'var(--radius)', backgroundColor: 'var(--bg-card)', border: '1px solid #F2B623', textAlign: 'center', boxShadow: 'var(--shadow-color-base)' }}
          >
            <Crown size={32} color="#F2B623" />
            <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: '12px 0 8px' }}>The mistake notebook is part of Pro</h2>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 auto 20px', maxWidth: 440, lineHeight: 1.5 }}>
              See every question you've got wrong, the ones you keep missing, and practise just those until they stick.
            </p>
            <Link to="/billing" style={{ display: 'inline-block', padding: '12px 24px', backgroundColor: 'var(--accent-primary)', color: '#fff', borderRadius: 'var(--radius)', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
              Upgrade to Pro
            </Link>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
              <button type="button" onClick={() => setView('all')} style={tabStyle(view === 'all')}>
                All mistakes{data ? ` (${data.counts.open})` : ''}
              </button>
              <button type="button" onClick={() => setView('frequent')} style={tabStyle(view === 'frequent')}>
                Missed {minWrong}+ times{data ? ` (${data.counts.frequent})` : ''}
              </button>
              <select
                aria-label="Filter by subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                style={{ height: 40, padding: '0 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, marginLeft: isMobile ? 0 : 'auto', flex: isMobile ? '1 1 100%' : undefined }}
              >
                <option value="">All subjects</option>
                {(data?.subjects || []).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer', minHeight: 40 }}>
                <input type="checkbox" checked={includeFixed} onChange={(e) => setIncludeFixed(e.target.checked)} />
                Show fixed ones
              </label>
            </div>

            {error && (
              <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 'var(--radius)', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', fontSize: 13, marginBottom: 16 }}>
                <AlertCircle size={16} /> {error}
              </div>
            )}

            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>Loading your mistakes…</div>
            ) : items.length === 0 ? (
              <div style={{ padding: isMobile ? 24 : 40, textAlign: 'center', borderRadius: 'var(--radius)', backgroundColor: 'var(--bg-card)', border: '1px dashed var(--border-default)' }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px' }}>
                  {view === 'frequent' ? `No question missed ${minWrong}+ times` : 'No mistakes here'}
                </h2>
                <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>
                  {subject ? 'Try another subject, or ' : ''}take a test or practise: questions you get wrong will appear here.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {items.map((m) => (
                  <article
                    key={m.question_id}
                    data-testid="mistake-item"
                    style={{ padding: isMobile ? 14 : 18, borderRadius: 12, backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)', borderLeft: `3px solid ${m.fixed ? '#10B981' : 'var(--primary-red)'}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
                  >
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ ...pillStyle, color: '#fff', background: m.fixed ? '#10B981' : 'var(--primary-red)' }}>
                        {m.fixed ? 'Fixed' : `Missed ${m.wrong_count}×`}
                      </span>
                      {(m.exam_name || m.source_year) && (
                        <span style={{ ...pillStyle, color: '#7E22CE', background: '#F3E8FF', border: '1px solid #E9D5FF' }}>
                          {[m.exam_name, m.source_year].filter(Boolean).join(' ')}
                        </span>
                      )}
                      {m.subject && <span style={{ ...pillStyle, color: 'var(--text-secondary)', background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}>{m.subject}</span>}
                      <span style={{ ...pillStyle, ...(DIFFICULTY_STYLE[m.difficulty] || DIFFICULTY_STYLE.MEDIUM) }}>{m.difficulty}</span>
                    </div>
                    <p style={{ fontSize: 14.5, lineHeight: 1.5, color: 'var(--text-primary)', margin: '0 0 10px', whiteSpace: 'pre-line', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word' }}>
                      {m.question_text}
                    </p>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', fontSize: 12.5, color: 'var(--text-muted)' }}>
                      <span>Wrong {m.wrong_count} of {m.answer_count} {m.answer_count === 1 ? 'attempt' : 'attempts'}</span>
                      {m.last_wrong_at && <span>Last wrong {formatDate(m.last_wrong_at)}</span>}
                    </div>
                  </article>
                ))}
                {data && items.length < data.total && (
                  <button
                    type="button"
                    onClick={loadMore}
                    disabled={loadingMore}
                    style={{ alignSelf: 'center', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 18px', borderRadius: 'var(--radius)', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-card)', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 13, cursor: 'pointer', minHeight: 40 }}
                  >
                    <RotateCcw size={14} /> {loadingMore ? 'Loading…' : `Show more (${data.total - items.length} left)`}
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </StudentLayout>
  );
}
