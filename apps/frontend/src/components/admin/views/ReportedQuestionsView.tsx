import { useCallback, useEffect, useState } from 'react';
import { Flag, RefreshCw, Pencil, XCircle, EyeOff, Trash2, CheckCircle, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import {
  fetchReportedQuestions,
  rejectReports,
  resolveReports,
  unpublishReportedQuestion,
  reasonLabel,
} from '../../../services/questionReportService';
import type { ReportedQuestion } from '../../../services/questionReportService';
import { deleteAdminQuestion } from '../../../services/adminService';
import { cleanExamTitle } from '../../../utils/formatEnum';
import { useBreakpoint } from '../../../hooks/useBreakpoint';

type StatusTab = 'OPEN' | 'RESOLVED' | 'REJECTED' | 'ALL';
const TABS: { id: StatusTab; label: string }[] = [
  { id: 'OPEN', label: 'Open' },
  { id: 'RESOLVED', label: 'Resolved' },
  { id: 'REJECTED', label: 'Rejected' },
  { id: 'ALL', label: 'All' },
];

interface ReportedQuestionsViewProps {
  onNavigate?: (view: string, extraData?: any) => void;
  onChanged?: () => void;
}

const formatWhen = (iso?: string | null) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
};

export function ReportedQuestionsView({ onNavigate, onChanged }: ReportedQuestionsViewProps) {
  const { isMobile } = useBreakpoint();
  const [tab, setTab] = useState<StatusTab>('OPEN');
  const [items, setItems] = useState<ReportedQuestion[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [toast, setToast] = useState<{ text: string; isError: boolean } | null>(null);
  const limit = 10;

  const showToast = (text: string, isError = false) => {
    setToast({ text, isError });
    setTimeout(() => setToast(null), 4000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchReportedQuestions(tab, page, limit);
      setItems(data.items);
      setTotal(data.total);
    } catch (err: any) {
      showToast(err.message || 'Could not load reported questions.', true);
    } finally {
      setLoading(false);
    }
  }, [tab, page]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (q: ReportedQuestion, action: () => Promise<unknown>, success: string) => {
    setBusyId(q.question_id);
    try {
      await action();
      showToast(success);
      onChanged?.();
      await load();
    } catch (err: any) {
      showToast(err.message || 'Action failed.', true);
    } finally {
      setBusyId(null);
    }
  };

  const openEditor = (q: ReportedQuestion) => {
    if (!onNavigate || !q.exam_id) return;
    onNavigate('review', {
      id: q.exam_id,
      name: q.exam_name,
      targetQuestionNumber: q.question_number,
      targetQuestionId: q.question_id,
      _navTimestamp: Date.now(),
    });
  };

  const toggle = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 800, color: 'var(--deep-navy)', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Flag size={isMobile ? 20 : 24} color="var(--primary-red)" />
            Reported Questions
          </h1>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Problems students reported on published questions. Edit a question, reject the report, unpublish it or delete it.
          </p>
        </div>
        <button type="button" onClick={load} style={btn(false)}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {toast && (
        <div
          role="status"
          style={{
            marginBottom: 14,
            padding: '10px 14px',
            borderRadius: 'var(--radius)',
            fontSize: 13,
            fontWeight: 600,
            background: toast.isError ? '#fef2f2' : '#f0fdf4',
            border: `1px solid ${toast.isError ? '#fecaca' : '#bbf7d0'}`,
            color: toast.isError ? '#b91c1c' : '#15803d',
          }}
        >
          {toast.text}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              setPage(1);
            }}
            style={{
              padding: '7px 14px',
              fontSize: 13,
              fontWeight: 700,
              borderRadius: 'var(--radius)',
              cursor: 'pointer',
              border: `1px solid ${tab === t.id ? 'var(--deep-navy)' : 'var(--border-color)'}`,
              background: tab === t.id ? 'var(--deep-navy)' : 'var(--bg-card)',
              color: tab === t.id ? '#fff' : 'var(--deep-navy)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && items.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
          <Loader2 size={22} className="animate-spin" style={{ margin: '0 auto 8px' }} />
          Loading reports…
        </div>
      ) : items.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', color: 'var(--text-muted)' }}>
          {tab === 'OPEN' ? 'No open reports. Nothing needs attention.' : 'No reports in this list.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {items.map((q) => {
            const isOpen = q.reports.some((r) => r.status === 'OPEN');
            const busy = busyId === q.question_id;
            const isExpanded = expanded.has(q.question_id);
            return (
              <div key={q.question_id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', padding: isMobile ? 14 : 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-muted)' }}>
                    {cleanExamTitle(q.exam_name) || 'Exam'} · Q{q.question_number ?? q.question_id}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span style={chip(q.question_status === 'PUBLISHED' ? '#15803d' : '#b91c1c', q.question_status === 'PUBLISHED' ? '#dcfce7' : '#fee2e2')}>
                      {q.question_status === 'PUBLISHED' ? 'Published' : q.question_status === 'REJECTED' ? 'Unpublished' : q.question_status || 'Unknown'}
                    </span>
                    <span style={chip('#92400e', '#fef3c7')}>
                      {q.report_count} report{q.report_count === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>

                <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--deep-navy)', lineHeight: 1.5, marginBottom: 10, overflowWrap: 'anywhere' }}>
                  {q.question_text || '(question text unavailable)'}
                </div>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                  {Object.entries(q.reasons).map(([reason, n]) => (
                    <span key={reason} style={chip('#334155', '#f1f5f9')}>
                      {reasonLabel(reason)} · {n}
                    </span>
                  ))}
                </div>

                <button type="button" onClick={() => toggle(q.question_id)} style={{ ...linkBtn, marginBottom: isExpanded ? 10 : 0 }}>
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  {isExpanded ? 'Hide' : 'Show'} what students said
                </button>

                {isExpanded && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 4 }}>
                    {q.reports.map((r) => (
                      <div key={r.id} style={{ padding: '10px 12px', background: 'var(--bg-subtle, #f8fafc)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', fontSize: 13 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', fontWeight: 700, color: 'var(--deep-navy)' }}>
                          <span>
                            {r.reporter_name} <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}>· {reasonLabel(r.reason)}</span>
                          </span>
                          <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}>{formatWhen(r.created_at)}</span>
                        </div>
                        {r.description && <div style={{ marginTop: 4, color: '#334155', overflowWrap: 'anywhere' }}>{r.description}</div>}
                        {r.status !== 'OPEN' && (
                          <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                            {r.status === 'RESOLVED' ? 'Resolved' : 'Rejected'}
                            {r.admin_note ? ` — ${r.admin_note}` : ''}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border-color)' }}>
                  <button type="button" disabled={busy || !onNavigate || !q.exam_id} onClick={() => openEditor(q)} style={btn(false)}>
                    <Pencil size={14} /> Edit question
                  </button>
                  {isOpen && (
                    <>
                      <button type="button" disabled={busy} onClick={() => run(q, () => resolveReports(q.question_id), 'Reports marked as resolved.')} style={btn(false)}>
                        <CheckCircle size={14} /> Mark resolved
                      </button>
                      <button type="button" disabled={busy} onClick={() => run(q, () => rejectReports(q.question_id), 'Reports rejected. The question stays published.')} style={btn(false)}>
                        <XCircle size={14} /> Reject report
                      </button>
                    </>
                  )}
                  {q.question_status === 'PUBLISHED' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (!window.confirm('Unpublish this question? Students will no longer see it until you fix and re-verify it.')) return;
                        run(q, () => unpublishReportedQuestion(q.question_id), 'Question unpublished.');
                      }}
                      style={btn(false)}
                    >
                      <EyeOff size={14} /> Unpublish
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      if (!window.confirm('Permanently delete this question? This cannot be undone.')) return;
                      run(q, () => deleteAdminQuestion(q.question_id), 'Question deleted.');
                    }}
                    style={btn(true)}
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 18 }}>
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} style={btn(false)}>
            Previous
          </button>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Page {page} of {totalPages}
          </span>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} style={btn(false)}>
            Next
          </button>
        </div>
      )}
    </div>
  );
}

const btn = (danger: boolean): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 14px',
  fontSize: 13,
  fontWeight: 700,
  borderRadius: 'var(--radius)',
  cursor: 'pointer',
  border: `1px solid ${danger ? '#fecaca' : 'var(--border-color)'}`,
  background: danger ? '#fef2f2' : 'var(--bg-card)',
  color: danger ? '#b91c1c' : 'var(--deep-navy)',
});

const linkBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  background: 'none',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  fontSize: 12.5,
  fontWeight: 700,
  color: 'var(--primary-red)',
};

const chip = (color: string, bg: string): React.CSSProperties => ({
  fontSize: 11.5,
  fontWeight: 700,
  padding: '3px 9px',
  borderRadius: 'var(--radius)',
  color,
  background: bg,
});
