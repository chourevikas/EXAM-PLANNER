import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { StudentLayout } from '../components/student/StudentLayout';
import { listBookmarks, removeBookmark, getBookmarkSolution, BookmarkItem } from '../services/bookmarkService';
import { formatEnum } from '../utils/formatEnum';
import { Search, Bookmark, Trash2, Filter, AlertCircle, RefreshCw, ChevronDown, ChevronLeft, ChevronRight, CheckCircle2, PlayCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  QuestionSolutionMarkdownCard,
  QuestionSolutionData,
  DistractorItem,
} from '../components/exam/QuestionSolutionMarkdownCard';
import { useBreakpoint } from '../hooks/useBreakpoint';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface BookmarkCardProps {
  bookmark: BookmarkItem;
  onRemove: (questionId: string) => void;
  isRemoving: boolean;
  isMobile: boolean;
  isExpanded: boolean;
  onToggle: (questionId: string) => void;
}

// ==================== BASE MODULE STYLES ====================

const BADGE_EASY_STYLE: React.CSSProperties = { color: '#059669', background: '#ECFDF5', border: '1px solid #A7F3D0' };
const BADGE_HARD_STYLE: React.CSSProperties = { color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA' };
const BADGE_DEFAULT_STYLE: React.CSSProperties = { color: '#D97706', background: '#FFFBEB', border: '1px solid #FDE68A' };
const EXAM_TAG_STYLE: React.CSSProperties = { color: '#7E22CE', background: '#F3E8FF', border: '1px solid #E9D5FF' };

const CARD_BASE_STYLE: React.CSSProperties = {
  border: '1px solid #E2E8F0',
  borderRadius: 12,
  background: 'var(--bg-card)',
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
  transition: 'transform 0.15s ease, box-shadow 0.15s ease, opacity 0.2s ease',
};

const CARD_HEADER_STYLE: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 14,
  flexWrap: 'wrap',
  gap: 8,
};

const BADGE_BASE_STYLE: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  padding: '4px 10px',
  borderRadius: 6,
  letterSpacing: '0.02em',
};

const DELETE_BTN_BASE_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  background: 'transparent',
  border: 'none',
  color: 'var(--primary-red)',
  fontSize: 13,
  fontWeight: 600,
  padding: '6px 10px',
  minHeight: 40,
  borderRadius: 6,
  transition: 'background-color 0.15s ease',
};

const SKELETON_WRAPPER_STYLE: React.CSSProperties = {
  padding: 20,
  border: '1px solid #E2E8F0',
  borderRadius: 12,
  background: 'var(--bg-card)',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
};

const TITLE_BASE_STYLE: React.CSSProperties = {
  fontWeight: 800,
  color: 'var(--deep-navy)',
  letterSpacing: '-0.02em',
  margin: 0,
  display: 'flex',
  alignItems: 'center',
  gap: 10,
};

const SUBTITLE_STYLE: React.CSSProperties = {
  margin: '4px 0 0 0',
  fontSize: 14,
  color: 'var(--text-muted)',
};

const ERROR_ALERT_STYLE: React.CSSProperties = {
  padding: '12px 16px',
  background: '#FEF2F2',
  border: '1px solid #FECACA',
  borderRadius: 8,
  color: '#DC2626',
  fontSize: 14,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginBottom: 16,
};

const EMPTY_CONTAINER_STYLE: React.CSSProperties = {
  padding: '48px 24px',
  textAlign: 'center',
  background: 'var(--bg-card)',
  border: '1px dashed #CBD5E1',
  borderRadius: 12,
  color: 'var(--text-muted)',
};

const NO_MATCH_CONTAINER_STYLE: React.CSSProperties = {
  padding: '36px 20px',
  textAlign: 'center',
  background: 'var(--bg-subtle)',
  borderRadius: 10,
  color: 'var(--text-muted)',
  fontSize: 14,
};

const BookmarkCard = React.memo(function BookmarkCard({
  bookmark,
  onRemove,
  isRemoving,
  isMobile,
  isExpanded,
  onToggle,
}: BookmarkCardProps) {
  const badgeStyle = useMemo(() => {
    switch (bookmark.difficulty?.toUpperCase()) {
      case 'EASY':
        return BADGE_EASY_STYLE;
      case 'HARD':
        return BADGE_HARD_STYLE;
      default:
        return BADGE_DEFAULT_STYLE;
    }
  }, [bookmark.difficulty]);

  return (
    <div
      style={{
        ...CARD_BASE_STYLE,
        padding: isMobile ? 14 : 20,
        opacity: isRemoving ? 0.4 : 1,
        pointerEvents: isRemoving ? 'none' : 'auto',
      }}
    >
      {/* Tags wrap among themselves; Remove stays on the top row (icon-only on phones). */}
      <div style={{ ...CARD_HEADER_STYLE, flexWrap: 'nowrap', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
          <span
            style={{
              ...BADGE_BASE_STYLE,
              ...badgeStyle,
            }}
          >
            {formatEnum(bookmark.difficulty)}
          </span>
          {(bookmark.exam_name || bookmark.source_year) && (
            <span style={{ ...BADGE_BASE_STYLE, ...EXAM_TAG_STYLE }} title={bookmark.exam_full_name || undefined}>
              {[bookmark.exam_name, bookmark.source_year].filter(Boolean).join(' • ')}
            </span>
          )}
          {bookmark.created_at && (
            <span style={{ fontSize: 11.5, color: 'var(--text-disabled)' }}>
              Saved {new Date(bookmark.created_at).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => onRemove(bookmark.question_id)}
          disabled={isRemoving}
          aria-label="Remove bookmark"
          style={{
            ...DELETE_BTN_BASE_STYLE,
            cursor: isRemoving ? 'not-allowed' : 'pointer',
            flexShrink: 0,
            marginTop: -6,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#FEF2F2')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <Trash2 size={15} />
          {!isMobile && <span>{isRemoving ? 'Removing...' : 'Remove'}</span>}
        </button>
      </div>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        onClick={() => onToggle(bookmark.question_id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle(bookmark.question_id);
          }
        }}
        style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}
      >
        <div
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: isMobile ? 14 : 15,
            color: '#1E293B',
            lineHeight: 1.6,
            wordBreak: 'break-word',
          }}
        >
          {/* Markdown like the exam screens; raw HTML in question text is not rendered (prevents script injection). */}
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{bookmark.question_text || ''}</ReactMarkdown>
        </div>
        <ChevronDown
          size={18}
          aria-hidden="true"
          style={{
            flexShrink: 0,
            marginTop: 3,
            color: 'var(--text-muted)',
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
          }}
        />
      </div>
      {!isExpanded && (
        <button type="button" onClick={() => onToggle(bookmark.question_id)} style={SHOW_DETAILS_BTN_STYLE}>
          Show options &amp; explanation
        </button>
      )}
      {isExpanded && <BookmarkDetails questionId={bookmark.question_id} />}
    </div>
  );
});

const SHOW_DETAILS_BTN_STYLE: React.CSSProperties = {
  marginTop: 8,
  padding: 0,
  background: 'transparent',
  border: 'none',
  color: 'var(--accent-primary)',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

const cleanLabel = (label: unknown) => String(label ?? '').replace(/[().\s]/g, '').toUpperCase();

function BookmarkDetails({ questionId }: { questionId: string }) {
  const [solution, setSolution] = useState<QuestionSolutionData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    getBookmarkSolution(questionId)
      .then((data) => !cancelled && setSolution(data))
      .catch((err) => {
        console.error('Failed to load bookmark details:', err);
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [questionId]);

  if (failed) {
    return (
      <div style={{ ...ERROR_ALERT_STYLE, marginTop: 14, marginBottom: 0 }}>
        <AlertCircle size={18} />
        <span>Couldn't load the options and explanation. Please try again.</span>
      </div>
    );
  }
  if (!solution) return <QuestionSolutionMarkdownCard solution={{}} isLoading />;

  const options: DistractorItem[] = Array.isArray(solution.distractor_scores)
    ? solution.distractor_scores
    : Object.values(solution.distractor_scores ?? {});
  const correctLabel = cleanLabel(solution.correct_option_label);
  const isCorrect = (opt: DistractorItem) =>
    solution.correct_option_id != null
      ? String(opt.option_id) === String(solution.correct_option_id)
      : !!correctLabel && cleanLabel(opt.label) === correctLabel;

  return (
    <div style={{ marginTop: 14, borderTop: '1px solid var(--border-color)', paddingTop: 14 }}>
      {options.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {options.map((opt, idx) => {
            const correct = isCorrect(opt);
            return (
              <div
                key={String(opt.option_id ?? idx)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: `1px solid ${correct ? '#3A8B53' : '#E2E8F0'}`,
                  background: correct ? '#ECFDF5' : 'var(--bg-card)',
                  fontSize: 14,
                  color: '#1E293B',
                  lineHeight: 1.5,
                }}
              >
                <span style={{ fontWeight: 800, color: correct ? '#047857' : 'var(--text-secondary)' }}>
                  {opt.label || String.fromCharCode(65 + idx)}.
                </span>
                <div style={{ flex: 1, minWidth: 0, wordBreak: 'break-word' }}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{opt.text || ''}</ReactMarkdown>
                </div>
                {correct && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      flexShrink: 0,
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#047857',
                    }}
                  >
                    <CheckCircle2 size={14} /> Correct
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
      <QuestionSolutionMarkdownCard solution={solution} />
    </div>
  );
}

function BookmarkSkeleton() {
  return (
    <div style={SKELETON_WRAPPER_STYLE}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ width: 80, height: 22, background: 'var(--border-color)', borderRadius: 4 }} />
        <div style={{ width: 60, height: 18, background: 'var(--border-color)', borderRadius: 4 }} />
      </div>
      <div style={{ width: '100%', height: 16, background: 'var(--bg-hover)', borderRadius: 4 }} />
      <div style={{ width: '80%', height: 16, background: 'var(--bg-hover)', borderRadius: 4 }} />
    </div>
  );
}

const PAGE_SIZE = 10;

const pageBtnStyle = (disabled: boolean): React.CSSProperties => ({
  height: 36,
  padding: '0 12px',
  borderRadius: 8,
  border: '1px solid var(--border-default)',
  backgroundColor: disabled ? 'var(--bg-subtle)' : 'var(--bg-card)',
  color: disabled ? 'var(--text-muted)' : 'var(--text-primary)',
  fontWeight: 600,
  fontSize: 13,
  cursor: disabled ? 'not-allowed' : 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  opacity: disabled ? 0.6 : 1,
});

export function BookmarksPage(): React.ReactElement {
  const navigate = useNavigate();
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const listTopRef = useRef<HTMLDivElement>(null);

  const handleToggle = useCallback((questionId: string) => {
    setExpandedId((prev) => (prev === questionId ? null : questionId));
  }, []);

  const { isMobile } = useBreakpoint();

  // Search runs on the server, so wait for the student to stop typing.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // A new search or filter starts again from the first page.
  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, difficultyFilter]);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        setLoading(true);
        setErrorMessage(null);
        const res = await listBookmarks({
          skip: (page - 1) * PAGE_SIZE,
          limit: PAGE_SIZE,
          q: debouncedQuery,
          difficulty: difficultyFilter === 'ALL' ? undefined : difficultyFilter,
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        // The last bookmark on a later page was removed elsewhere: step back to a page that has some.
        if (res.items.length === 0 && res.total > 0 && page > 1) {
          setPage(Math.ceil(res.total / PAGE_SIZE));
          return;
        }
        setBookmarks(res.items);
        setTotal(res.total);
      } catch (err: any) {
        if (err?.name === 'AbortError' || controller.signal.aborted) return;
        console.error('Failed to load bookmarks:', err);
        setErrorMessage('Failed to load bookmarks. Please try again.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [page, debouncedQuery, difficultyFilter, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  const goToPage = useCallback((next: number) => {
    setExpandedId(null);
    setPage(next);
    listTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // Optimistic removal with rollback; the page is then re-fetched so the next bookmark moves up into it.
  const handleRemove = useCallback(
    async (questionId: string) => {
      setRemovingId(questionId);
      const previousBookmarks = bookmarks;
      setBookmarks((prev) => prev.filter((b) => b.question_id !== questionId));
      setTotal((t) => Math.max(0, t - 1));

      try {
        await removeBookmark(questionId);
        if (previousBookmarks.length === 1 && page > 1) setPage(page - 1);
        else reload();
      } catch (err) {
        console.error('Failed to remove bookmark:', err);
        setBookmarks(previousBookmarks);
        setTotal((t) => t + 1);
        alert('Failed to remove bookmark. Please try again.');
      } finally {
        setRemovingId(null);
      }
    },
    [bookmarks, page, reload],
  );

  const hasFilters = debouncedQuery !== '' || difficultyFilter !== 'ALL';
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const firstShown = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastShown = Math.min(page * PAGE_SIZE, total);

  const pageContainerStyle: React.CSSProperties = {
    padding: isMobile ? '16px 0' : '24px 0', // the student layout already provides the side padding
    margin: 0,
    width: '100%',
    boxSizing: 'border-box',
  };

  const headerWrapperStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: isMobile ? 'stretch' : 'center',
    flexDirection: isMobile ? 'column' : 'row',
    marginBottom: isMobile ? 16 : 24,
    gap: 12,
  };

  const titleStyle: React.CSSProperties = {
    ...TITLE_BASE_STYLE,
    fontSize: isMobile ? 20 : 24,
  };

  const refreshBtnStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    background: 'var(--bg-subtle)',
    border: '1px solid #E2E8F0',
    padding: '8px 14px',
    minHeight: 44,
    width: isMobile ? '100%' : 'auto',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    color: '#334EAC',
    cursor: loading ? 'not-allowed' : 'pointer',
    transition: 'background-color 0.15s ease',
  };

  const filterRowStyle: React.CSSProperties = {
    display: 'flex',
    gap: 10,
    marginBottom: isMobile ? 16 : 20,
    flexDirection: isMobile ? 'column' : 'row',
  };

  const searchInputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px 10px 36px',
    minHeight: 44,
    borderRadius: 8,
    border: '1px solid #E2E8F0',
    fontSize: 14,
    outline: 'none',
    background: 'var(--bg-card)',
    color: '#1E293B',
    boxSizing: 'border-box',
  };

  const filterSelectStyle: React.CSSProperties = {
    padding: '10px 12px',
    minHeight: 44,
    width: isMobile ? '100%' : 'auto',
    borderRadius: 8,
    border: '1px solid #E2E8F0',
    fontSize: 13,
    fontWeight: 600,
    background: 'var(--bg-card)',
    color: '#1E293B',
    cursor: 'pointer',
    outline: 'none',
    boxSizing: 'border-box',
  };

  return (
    <StudentLayout pageTitle="Bookmarked Questions">
      <div style={pageContainerStyle}>
        {/* Header Hero Banner */}
        <section style={{
          marginBottom: 32, padding: 32, borderRadius: 'var(--radius)',
          backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)',
          boxShadow: 'var(--shadow-color-base)',
          backgroundImage: 'linear-gradient(135deg, rgba(91,92,235,0.08) 0%, rgba(34,197,94,0.06) 100%)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20
        }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', backgroundColor: 'var(--accent-bg)', borderRadius: 'var(--radius)', marginBottom: 10, border: '1px solid var(--accent-border)' }}>
              <Bookmark size={14} />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase' }}>Revision Materials</span>
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px 0' }}>Bookmarked Questions</h1>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>Review and practice questions you saved for later revision.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexDirection: isMobile ? 'column' : 'row' }}>
            {total > 0 && (
              <button
                type="button"
                onClick={() => navigate('/practice-exam?source=bookmarks')}
                style={{ ...refreshBtnStyle, background: 'var(--primary-red)', border: 'none', color: '#fff', cursor: 'pointer' }}
              >
                <PlayCircle size={14} />
                <span>Practise these</span>
              </button>
            )}
            <button
              type="button"
              onClick={reload}
              disabled={loading}
              style={refreshBtnStyle}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </section>

        {/* Search and Filters */}
        {(total > 0 || hasFilters || searchQuery !== '') && (
          <div ref={listTopRef} style={{ ...filterRowStyle, scrollMarginTop: 80 }}>
            <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search
                size={16}
                color="var(--text-disabled)"
                style={{ position: 'absolute', left: 12, pointerEvents: 'none' }}
              />
              <input
                type="text"
                placeholder="Search bookmarks by keyword..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={searchInputStyle}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: isMobile ? '100%' : 'auto' }}>
              <Filter size={16} color="var(--text-muted)" style={{ display: isMobile ? 'none' : 'block' }} />
              <select
                value={difficultyFilter}
                onChange={(e) => setDifficultyFilter(e.target.value)}
                style={filterSelectStyle}
              >
                <option value="ALL">All Difficulties</option>
                <option value="EASY">Easy</option>
                <option value="MEDIUM">Medium</option>
                <option value="HARD">Hard</option>
              </select>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div style={ERROR_ALERT_STYLE}>
            <AlertCircle size={18} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Content Section */}
        {loading && bookmarks.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <BookmarkSkeleton />
            <BookmarkSkeleton />
            <BookmarkSkeleton />
          </div>
        ) : total === 0 && !hasFilters ? (
          <div style={EMPTY_CONTAINER_STYLE}>
            <Bookmark size={40} color="var(--text-disabled)" style={{ marginBottom: 12, opacity: 0.7 }} />
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1E293B', margin: '0 0 6px 0' }}>
              No bookmarked questions yet
            </h3>
            <p style={{ fontSize: 14, margin: 0, color: 'var(--text-muted)' }}>
              Start practicing exam questions and bookmark tricky questions to review them here!
            </p>
          </div>
        ) : total === 0 ? (
          <div style={NO_MATCH_CONTAINER_STYLE}>
            No bookmarks match your search or filter criteria.
          </div>
        ) : (
          <>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                opacity: loading ? 0.6 : 1,
                transition: 'opacity 0.15s ease',
              }}
              aria-busy={loading}
            >
              {bookmarks.map((b) => (
                <BookmarkCard
                  key={b.bookmark_id}
                  bookmark={b}
                  onRemove={handleRemove}
                  isRemoving={removingId === b.question_id}
                  isMobile={isMobile}
                  isExpanded={expandedId === b.question_id}
                  onToggle={handleToggle}
                />
              ))}
            </div>

            <nav
              aria-label="Bookmarks pages"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 10,
                marginTop: 16,
                fontSize: 13,
                color: 'var(--text-muted)',
              }}
            >
              <span>
                Showing <strong>{firstShown}–{lastShown}</strong> of <strong>{total}</strong>
              </span>
              {totalPages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    type="button"
                    disabled={page <= 1 || loading}
                    onClick={() => goToPage(page - 1)}
                    style={pageBtnStyle(page <= 1 || loading)}
                  >
                    <ChevronLeft size={14} /> Previous
                  </button>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)', padding: '0 4px' }}>
                    Page {page} of {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={page >= totalPages || loading}
                    onClick={() => goToPage(page + 1)}
                    style={pageBtnStyle(page >= totalPages || loading)}
                  >
                    Next <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </nav>
          </>
        )}
      </div>
    </StudentLayout>
  );
}
