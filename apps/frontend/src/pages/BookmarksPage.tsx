import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { StudentLayout } from '../components/student/StudentLayout';
import { listBookmarks, removeBookmark, BookmarkItem } from '../services/bookmarkService';
import { formatEnum } from '../utils/formatEnum';
import { Search, Bookmark, Trash2, Filter, AlertCircle, RefreshCw } from 'lucide-react';
import { useBreakpoint } from '../hooks/useBreakpoint';

interface BookmarkCardProps {
  bookmark: BookmarkItem;
  onRemove: (questionId: string) => void;
  isRemoving: boolean;
  isMobile: boolean;
}

// ==================== BASE MODULE STYLES ====================

const BADGE_EASY_STYLE: React.CSSProperties = { color: '#059669', background: '#ECFDF5', border: '1px solid #A7F3D0' };
const BADGE_HARD_STYLE: React.CSSProperties = { color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA' };
const BADGE_DEFAULT_STYLE: React.CSSProperties = { color: '#D97706', background: '#FFFBEB', border: '1px solid #FDE68A' };

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
      <div style={CARD_HEADER_STYLE}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span
            style={{
              ...BADGE_BASE_STYLE,
              ...badgeStyle,
            }}
          >
            {formatEnum(bookmark.difficulty)}
          </span>
          {bookmark.created_at && (
            <span style={{ fontSize: 11.5, color: 'var(--text-disabled)' }}>
              {new Date(bookmark.created_at).toLocaleDateString(undefined, {
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
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#FEF2F2')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <Trash2 size={15} />
          <span>{isRemoving ? 'Removing...' : 'Remove'}</span>
        </button>
      </div>
      <div
        style={{
          fontSize: isMobile ? 14 : 15,
          color: '#1E293B',
          lineHeight: 1.6,
          wordBreak: 'break-word',
        }}
        dangerouslySetInnerHTML={{ __html: bookmark.question_text }}
      />
    </div>
  );
});

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

export function BookmarksPage(): React.ReactElement {
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('ALL');

  const { isMobile } = useBreakpoint();

  const fetchBookmarksData = useCallback(async (signal?: AbortSignal, forceRefresh = false) => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const res = await listBookmarks({ forceRefresh, signal });
      if (!signal?.aborted) {
        setBookmarks(res);
      }
    } catch (err: any) {
      if (err?.name === 'AbortError' || signal?.aborted) return;
      console.error('Failed to load bookmarks:', err);
      setErrorMessage('Failed to load bookmarks. Please try again.');
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchBookmarksData(controller.signal);

    return () => {
      controller.abort();
    };
  }, [fetchBookmarksData]);

  // Optimistic removal with rollback
  const handleRemove = useCallback(
    async (questionId: string) => {
      setRemovingId(questionId);
      const previousBookmarks = [...bookmarks];

      // Optimistic update
      setBookmarks((prev) => prev.filter((b) => b.question_id !== questionId));

      try {
        await removeBookmark(questionId);
      } catch (err) {
        console.error('Failed to remove bookmark:', err);
        // Rollback state on error
        setBookmarks(previousBookmarks);
        alert('Failed to remove bookmark. Please try again.');
      } finally {
        setRemovingId(null);
      }
    },
    [bookmarks],
  );

  // Memoized filtered bookmarks
  const filteredBookmarks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return bookmarks.filter((b) => {
      const matchesDifficulty =
        difficultyFilter === 'ALL' || b.difficulty?.toUpperCase() === difficultyFilter;
      const matchesQuery =
        !query ||
        b.question_text?.toLowerCase().includes(query) ||
        b.difficulty?.toLowerCase().includes(query);
      return matchesDifficulty && matchesQuery;
    });
  }, [bookmarks, searchQuery, difficultyFilter]);

  const pageContainerStyle: React.CSSProperties = {
    padding: isMobile ? '16px 0' : '24px 0', // the student layout already provides the side padding
    maxWidth: 960,
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
      <div data-page-align="left" style={pageContainerStyle}>
        {/* Header */}
        <div style={headerWrapperStyle}>
          <div>
            <h1 style={titleStyle}>
              <Bookmark size={22} color="#334EAC" />
              Bookmarked Questions
            </h1>
            <p style={SUBTITLE_STYLE}>
              Review and practice questions you saved for later revision.
            </p>
          </div>
          <button
            type="button"
            onClick={() => fetchBookmarksData(undefined, true)}
            disabled={loading}
            style={refreshBtnStyle}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Search and Filters */}
        {bookmarks.length > 0 && (
          <div style={filterRowStyle}>
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
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <BookmarkSkeleton />
            <BookmarkSkeleton />
            <BookmarkSkeleton />
          </div>
        ) : bookmarks.length === 0 ? (
          <div style={EMPTY_CONTAINER_STYLE}>
            <Bookmark size={40} color="var(--text-disabled)" style={{ marginBottom: 12, opacity: 0.7 }} />
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1E293B', margin: '0 0 6px 0' }}>
              No bookmarked questions yet
            </h3>
            <p style={{ fontSize: 14, margin: 0, color: 'var(--text-muted)' }}>
              Start practicing exam questions and bookmark tricky questions to review them here!
            </p>
          </div>
        ) : filteredBookmarks.length === 0 ? (
          <div style={NO_MATCH_CONTAINER_STYLE}>
            No bookmarks match your search or filter criteria.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filteredBookmarks.map((b) => (
              <BookmarkCard
                key={b.bookmark_id}
                bookmark={b}
                onRemove={handleRemove}
                isRemoving={removingId === b.question_id}
                isMobile={isMobile}
              />
            ))}
          </div>
        )}
      </div>
    </StudentLayout>
  );
}
