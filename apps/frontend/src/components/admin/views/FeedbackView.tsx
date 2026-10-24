import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageSquareWarning, RefreshCw, CheckCircle, XCircle, RotateCcw, Image as ImageIcon, Loader2 } from 'lucide-react';
import {
  fetchFeedback,
  fetchFeedbackScreenshot,
  resolveFeedback,
  dismissFeedback,
  reopenFeedback,
  categoryLabel,
} from '../../../services/feedbackService';
import type { FeedbackItem, FeedbackStatus } from '../../../services/feedbackService';
import { useBreakpoint } from '../../../hooks/useBreakpoint';

type StatusTab = FeedbackStatus | 'ALL';
const TABS: { id: StatusTab; label: string }[] = [
  { id: 'OPEN', label: 'Open' },
  { id: 'RESOLVED', label: 'Resolved' },
  { id: 'DISMISSED', label: 'Dismissed' },
  { id: 'ALL', label: 'All' },
];

const CATEGORY_CHIP: Record<string, [string, string]> = {
  BUG: ['#b91c1c', '#fee2e2'],
  CONTENT: ['#92400e', '#fef3c7'],
  IDEA: ['#1d4ed8', '#dbeafe'],
  OTHER: ['#334155', '#f1f5f9'],
};

interface FeedbackViewProps {
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

/** "Chrome 129 on Android" from a user-agent string; good enough to spot a device-specific bug. */
const shortAgent = (ua?: string | null) => {
  if (!ua) return '';
  const browser = /Edg\/(\d+)/.exec(ua)
    ? `Edge ${/Edg\/(\d+)/.exec(ua)![1]}`
    : /Chrome\/(\d+)/.exec(ua)
      ? `Chrome ${/Chrome\/(\d+)/.exec(ua)![1]}`
      : /Firefox\/(\d+)/.exec(ua)
        ? `Firefox ${/Firefox\/(\d+)/.exec(ua)![1]}`
        : /Safari\//.test(ua)
          ? 'Safari'
          : 'Browser';
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return os ? `${browser} on ${os}` : browser;
};

export function FeedbackView({ onChanged }: FeedbackViewProps) {
  const { isMobile } = useBreakpoint();
  const [tab, setTab] = useState<StatusTab>('OPEN');
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [screenshots, setScreenshots] = useState<Record<number, string>>({});
  const [toast, setToast] = useState<{ text: string; isError: boolean } | null>(null);
  const limit = 10;

  const showToast = (text: string, isError = false) => {
    setToast({ text, isError });
    setTimeout(() => setToast(null), 4000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchFeedback(tab, page, limit);
      setItems(data.items);
      setTotal(data.total);
    } catch (err: any) {
      showToast(err.message || 'Could not load feedback.', true);
    } finally {
      setLoading(false);
    }
  }, [tab, page]);

  useEffect(() => {
    load();
  }, [load]);

  // Free the screenshot object URLs when leaving the screen.
  const objectUrls = useRef<string[]>([]);
  useEffect(() => () => objectUrls.current.forEach((url) => URL.revokeObjectURL(url)), []);

  const run = async (item: FeedbackItem, action: () => Promise<unknown>, success: string) => {
    setBusyId(item.id);
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

  const showScreenshot = async (item: FeedbackItem) => {
    if (screenshots[item.id]) return;
    try {
      const url = await fetchFeedbackScreenshot(item.id);
      objectUrls.current.push(url);
      setScreenshots((prev) => ({ ...prev, [item.id]: url }));
    } catch (err: any) {
      showToast(err.message || 'Could not load the screenshot.', true);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 800, color: 'var(--deep-navy)', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <MessageSquareWarning size={isMobile ? 20 : 24} color="var(--primary-red)" />
            Feedback
          </h1>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Problems and suggestions students sent with "Report a problem". Mark each one resolved or dismissed.
          </p>
        </div>
        <button type="button" onClick={load} style={btn}>
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
          Loading feedback…
        </div>
      ) : items.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', color: 'var(--text-muted)' }}>
          {tab === 'OPEN' ? 'No open feedback. Nothing needs attention.' : 'No feedback in this list.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {items.map((item) => {
            const busy = busyId === item.id;
            const [chipColor, chipBg] = CATEGORY_CHIP[item.category] || CATEGORY_CHIP.OTHER;
            return (
              <div key={item.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', padding: isMobile ? 14 : 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-muted)', overflowWrap: 'anywhere' }}>
                    #{item.id} · {item.user.name || 'Student'}
                    {item.user.email ? ` · ${item.user.email}` : ''} · {formatWhen(item.created_at)}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span style={chip(chipColor, chipBg)}>{categoryLabel(item.category)}</span>
                    {item.status !== 'OPEN' && (
                      <span style={chip(item.status === 'RESOLVED' ? '#15803d' : '#475569', item.status === 'RESOLVED' ? '#dcfce7' : '#e2e8f0')}>
                        {item.status === 'RESOLVED' ? 'Resolved' : 'Dismissed'}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ fontSize: 14.5, color: 'var(--deep-navy)', lineHeight: 1.55, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', marginBottom: 10 }}>
                  {item.message}
                </div>

                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12.5, color: 'var(--text-muted)' }}>
                  {item.page_url && (
                    <span style={{ overflowWrap: 'anywhere' }}>
                      Page: <code style={{ fontSize: 12 }}>{item.page_url}</code>
                    </span>
                  )}
                  {item.user_agent && <span title={item.user_agent}>{shortAgent(item.user_agent)}</span>}
                </div>

                {item.has_screenshot && (
                  <div style={{ marginTop: 10 }}>
                    {screenshots[item.id] ? (
                      <a href={screenshots[item.id]} target="_blank" rel="noreferrer">
                        <img
                          src={screenshots[item.id]}
                          alt={`Screenshot sent with feedback #${item.id}`}
                          style={{ maxWidth: '100%', maxHeight: 360, borderRadius: 'var(--radius)', border: '1px solid var(--border-color)', display: 'block' }}
                        />
                      </a>
                    ) : (
                      <button type="button" onClick={() => showScreenshot(item)} style={linkBtn}>
                        <ImageIcon size={14} /> Show screenshot
                      </button>
                    )}
                  </div>
                )}

                {item.status !== 'OPEN' && item.admin_note && (
                  <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--text-muted)' }}>Note: {item.admin_note}</div>
                )}

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border-color)' }}>
                  {item.status === 'OPEN' ? (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          const note = window.prompt('Optional note (what was done):');
                          if (note === null) return;
                          run(item, () => resolveFeedback(item.id, note), 'Marked as resolved.');
                        }}
                        style={btn}
                      >
                        <CheckCircle size={14} /> Mark resolved
                      </button>
                      <button type="button" disabled={busy} onClick={() => run(item, () => dismissFeedback(item.id), 'Dismissed.')} style={btn}>
                        <XCircle size={14} /> Dismiss
                      </button>
                    </>
                  ) : (
                    <button type="button" disabled={busy} onClick={() => run(item, () => reopenFeedback(item.id), 'Reopened.')} style={btn}>
                      <RotateCcw size={14} /> Reopen
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 18 }}>
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} style={btn}>
            Previous
          </button>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Page {page} of {totalPages}
          </span>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} style={btn}>
            Next
          </button>
        </div>
      )}
    </div>
  );
}

const btn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 14px',
  fontSize: 13,
  fontWeight: 700,
  borderRadius: 'var(--radius)',
  cursor: 'pointer',
  border: '1px solid var(--border-color)',
  background: 'var(--bg-card)',
  color: 'var(--deep-navy)',
};

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
