import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { StudentLayout } from '../components/student/StudentLayout';
import { listBookmarks, removeBookmark, BookmarkItem } from '../services/bookmarkService';
import { formatEnum } from '../utils/formatEnum';
import { Search, Bookmark, Trash2, Filter, AlertCircle, RefreshCw } from 'lucide-react';

interface BookmarkCardProps {
  bookmark: BookmarkItem;
  onRemove: (questionId: string) => void;
  isRemoving: boolean;
}

// ==================== STATIC MODULE STYLES (Zero GC churn) ====================

const BADGE_EASY_STYLE: React.CSSProperties = { color: '#059669', background: '#ECFDF5', border: '1px solid #A7F3D0' };
const BADGE_HARD_STYLE: React.CSSProperties = { color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA' };
const BADGE_DEFAULT_STYLE: React.CSSProperties = { color: '#D97706', background: '#FFFBEB', border: '1px solid #FDE68A' };

const CARD_BASE_STYLE: React.CSSProperties = {
  padding: 20,
  border: '1px solid #E2E8F0',
  borderRadius: 12,
  background: '#FFFFFF',
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
  transition: 'transform 0.15s ease, box-shadow 0.15s ease, opacity 0.2s ease',
};

const CARD_HEADER_STYLE: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 14,
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
  gap: 6,
  background: 'transparent',
  border: 'none',
  color: '#EF4444',
  fontSize: 13,
  fontWeight: 600,
  padding: '4px 8px',
  borderRadius: 6,
  transition: 'background-color 0.15s ease',
};

const QUESTION_TEXT_STYLE: React.CSSProperties = {
  fontSize: 15,
  color: '#1E293B',
  lineHeight: 1.6,
  wordBreak: 'break-word',
};

const SKELETON_WRAPPER_STYLE: React.CSSProperties = {
  padding: 20,
  border: '1px solid #E2E8F0',
  borderRadius: 12,
  background: '#FFFFFF',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
};

const PAGE_CONTAINER_STYLE: React.CSSProperties = {
  padding: '24px 16px',
  maxWidth: 960,
  margin: '0 auto',
  width: '100%',
};

const HEADER_WRAPPER_STYLE: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 24,
  flexWrap: 'wrap',
  gap: 12,
};

const TITLE_STYLE: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 800,
  color: '#0F172A',
  letterSpacing: '-0.02em',
  margin: 0,
  display: 'flex',
  alignItems: 'center',
  gap: 10,
};

const SUBTITLE_STYLE: React.CSSProperties = {
  margin: '4px 0 0 0',
  fontSize: 14,
  color: '#64748B',
};

const REFRESH_BTN_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  background: '#F8FAFC',
  border: '1px solid #E2E8F0',
  padding: '8px 14px',
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 600,
  color: '#334EAC',
  transition: 'background-color 0.15s ease',
};

const FILTER_ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  gap: 12,
  marginBottom: 20,
  flexWrap: 'wrap',
};

const SEARCH_BOX_STYLE: React.CSSProperties = {
  flex: 1,
  minWidth: 240,
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
};

const SEARCH_INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px 9px 36px',
  borderRadius: 8,
  border: '1px solid #E2E8F0',
  fontSize: 14,
  outline: 'none',
  background: '#FFFFFF',
  color: '#1E293B',
};

const FILTER_SELECT_STYLE: React.CSSProperties = {
  padding: '9px 12px',
  borderRadius: 8,
  border: '1px solid #E2E8F0',
  fontSize: 13,
  fontWeight: 600,
  background: '#FFFFFF',
  color: '#1E293B',
  cursor: 'pointer',
  outline: 'none',
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
  background: '#FFFFFF',
  border: '1px dashed #CBD5E1',
  borderRadius: 12,
  color: '#64748B',
};

const NO_MATCH_CONTAINER_STYLE: React.CSSProperties = {
  padding: '36px 20px',
  textAlign: 'center',
  background: '#F8FAFC',
  borderRadius: 10,
  color: '#64748B',
  fontSize: 14,
};

const BookmarkCard = React.memo(function BookmarkCard({
  bookmark,
  onRemove,
  isRemoving,
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
        opacity: isRemoving ? 0.4 : 1,
        pointerEvents: isRemoving ? 'none' : 'auto',
      }}
    >
      <div style={CARD_HEADER_STYLE}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              ...BADGE_BASE_STYLE,
              ...badgeStyle,
            }}
          >
            {formatEnum(bookmark.difficulty)}
          </span>
          {bookmark.created_at && (
            <span style={{ fontSize: 12, color: '#94A3B8' }}>
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
        style={QUESTION_TEXT_STYLE}
        dangerouslySetInnerHTML={{ __html: bookmark.question_text }}
      />
    </div>
  );
});

function BookmarkSkeleton() {
  return (
    <div style={SKELETON_WRAPPER_STYLE}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ width: 80, height: 22, background: '#E2E8F0', borderRadius: 4 }} />
        <div style={{ width: 60, height: 18, background: '#E2E8F0', borderRadius: 4 }} />
      </div>
      <div style={{ width: '100%', height: 16, background: '#F1F5F9', borderRadius: 4 }} />
      <div style={{ width: '80%', height: 16, background: '#F1F5F9', borderRadius: 4 }} />
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

  return (
    <StudentLayout pageTitle="Bookmarked Questions">
      <div style={PAGE_CONTAINER_STYLE}>
        {/* Header */}
        <div style={HEADER_WRAPPER_STYLE}>
          <div>
            <h1 style={TITLE_STYLE}>
              <Bookmark size={24} color="#334EAC" />
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
            style={{
              ...REFRESH_BTN_STYLE,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Search and Filters */}
        {bookmarks.length > 0 && (
          <div style={FILTER_ROW_STYLE}>
            <div style={SEARCH_BOX_STYLE}>
              <Search
                size={16}
                color="#94A3B8"
                style={{ position: 'absolute', left: 12, pointerEvents: 'none' }}
              />
              <input
                type="text"
                placeholder="Search bookmarks by keyword..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={SEARCH_INPUT_STYLE}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Filter size={16} color="#64748B" />
              <select
                value={difficultyFilter}
                onChange={(e) => setDifficultyFilter(e.target.value)}
                style={FILTER_SELECT_STYLE}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <BookmarkSkeleton />
            <BookmarkSkeleton />
            <BookmarkSkeleton />
          </div>
        ) : bookmarks.length === 0 ? (
          <div style={EMPTY_CONTAINER_STYLE}>
            <Bookmark size={40} color="#94A3B8" style={{ marginBottom: 12, opacity: 0.7 }} />
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1E293B', margin: '0 0 6px 0' }}>
              No bookmarked questions yet
            </h3>
            <p style={{ fontSize: 14, margin: 0, color: '#64748B' }}>
              Start practicing exam questions and bookmark tricky questions to review them here!
            </p>
          </div>
        ) : filteredBookmarks.length === 0 ? (
          <div style={NO_MATCH_CONTAINER_STYLE}>
            No bookmarks match your search or filter criteria.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {filteredBookmarks.map((b) => (
              <BookmarkCard
                key={b.bookmark_id}
                bookmark={b}
                onRemove={handleRemove}
                isRemoving={removingId === b.question_id}
              />
            ))}
          </div>
        )}
      </div>
    </StudentLayout>
  );
}
