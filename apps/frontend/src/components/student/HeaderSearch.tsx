import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, FileQuestion, Search, Target, Trophy, X } from 'lucide-react';

interface SearchItem {
  id: string;
  title: string;
  type: string;
  url: string;
}

interface SearchResults {
  questions: SearchItem[];
  pyqs: SearchItem[];
  mocks: SearchItem[];
  topics: SearchItem[];
}

const GROUPS: { key: keyof SearchResults; label: string; icon: React.ReactNode; tint: string; color: string }[] = [
  { key: 'questions', label: 'Questions', icon: <FileQuestion size={14} />, tint: 'var(--primary-red-bg)', color: 'var(--primary-red)' },
  { key: 'pyqs', label: 'Previous year papers', icon: <Target size={14} />, tint: '#FEF3C7', color: '#B45309' },
  { key: 'mocks', label: 'Practice tests', icon: <Trophy size={14} />, tint: '#EEF2FF', color: '#4F46E5' },
  { key: 'topics', label: 'Syllabus & topics', icon: <BookOpen size={14} />, tint: '#F0FDF4', color: '#16A34A' },
];

const MIN_QUESTION_QUERY = 3;

/**
 * Header search: question text (full-text, any stored language), papers and syllabus topics.
 * Inline on desktop (⌘K / Ctrl+K focuses it); a search icon that opens a bar under the header on phones.
 */
export function HeaderSearch({ compact = false }: { compact?: boolean }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [searching, setSearching] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced search
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        if (!res.ok) throw new Error(`Search failed (${res.status})`);
        const data = await res.json();
        setResults({
          questions: data.questions || [],
          pyqs: data.pyqs || [],
          mocks: data.mocks || [],
          topics: data.topics || [],
        });
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        // Show nothing rather than made-up matches when search is unavailable
        setResults({ questions: [], pyqs: [], mocks: [], topics: [] });
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // ⌘K / Ctrl+K focuses the search, Escape closes it, a click outside closes the results
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
        if (compact) {
          setExpanded(true);
          setTimeout(() => inputRef.current?.focus(), 50); // the phone bar renders first
        } else {
          inputRef.current?.focus();
        }
      } else if (e.key === 'Escape') {
        setOpen(false);
        setExpanded(false);
        inputRef.current?.blur();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setExpanded(false);
      }
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [compact]);

  const close = () => {
    setQuery('');
    setResults(null);
    setOpen(false);
    setExpanded(false);
  };

  const isEmpty = results && GROUPS.every((g) => results[g.key].length === 0);
  const showDropdown = open && query.trim().length > 0;

  const input = (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
      <span style={{ position: 'absolute', left: 12, display: 'flex', pointerEvents: 'none', color: 'rgba(255,255,255,0.5)' }}>
        <Search size={15} />
      </span>
      <input
        ref={inputRef}
        type="search"
        aria-label="Search questions, papers and topics"
        placeholder="Search questions, papers, topics…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        style={{
          width: '100%', height: 38, paddingLeft: 36, paddingRight: compact ? 12 : 44,
          borderRadius: 'var(--radius)', border: '1px solid rgba(255,255,255,0.14)',
          backgroundColor: 'rgba(0,0,0,0.25)', color: '#fff', fontSize: compact ? 16 : 13, // 16px on phones stops iOS zooming into the field
          outline: 'none', boxSizing: 'border-box',
        }}
      />
      {!compact && !query && (
        <span style={{ position: 'absolute', right: 10, fontSize: 10.5, fontWeight: 600, color: 'rgba(255,255,255,0.45)', backgroundColor: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.1)', pointerEvents: 'none' }}>
          ⌘K
        </span>
      )}
    </div>
  );

  const dropdown = showDropdown && (
    <div
      role="listbox"
      data-testid="header-search-results"
      style={{
        position: 'absolute', top: compact ? 'calc(100% + 4px)' : 46, left: 0, right: 0,
        backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius)', border: '1px solid #E2E8F0',
        boxShadow: '0 12px 32px rgba(15,23,42,0.14)', padding: 10, zIndex: 210, maxHeight: '70vh', overflowY: 'auto',
      }}
    >
      {searching && !results ? (
        <div style={{ padding: 14, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Searching…</div>
      ) : isEmpty ? (
        <div style={{ padding: 14, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          Nothing found for "{query.trim()}".
          {query.trim().length < MIN_QUESTION_QUERY && <div style={{ marginTop: 4 }}>Type at least {MIN_QUESTION_QUERY} letters to search question text.</div>}
        </div>
      ) : results ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {GROUPS.filter((g) => results[g.key].length > 0).map((g) => (
            <div key={g.key}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', margin: '0 0 6px 6px' }}>{g.label}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {results[g.key].map((item) => (
                  <Link
                    key={`${g.key}-${item.id}`}
                    to={item.url}
                    onClick={close}
                    role="option"
                    style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 10px', borderRadius: 6, textDecoration: 'none', backgroundColor: 'var(--bg-subtle)', minHeight: 44 }}
                  >
                    <span style={{ width: 26, height: 26, borderRadius: 6, backgroundColor: g.tint, color: g.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {g.icon}
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 13, color: '#172033', fontWeight: 500, lineHeight: 1.4, overflowWrap: 'anywhere' }}>{item.title}</span>
                      {g.key === 'questions' && item.type && (
                        <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{item.type}</span>
                      )}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );

  if (compact) {
    return (
      <div ref={rootRef} style={{ display: 'flex', alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => {
            setExpanded((v) => !v);
            setOpen(true);
            setTimeout(() => inputRef.current?.focus(), 50);
          }}
          className="touch-target"
          aria-label={expanded ? 'Close search' : 'Search'}
          style={{ background: 'transparent', border: 'none', color: 'var(--bg-card)', cursor: 'pointer', padding: 8, display: 'flex' }}
        >
          {expanded ? <X size={19} /> : <Search size={19} />}
        </button>
        {expanded && (
          <div style={{ position: 'fixed', top: 'var(--header-height, 60px)', left: 0, right: 0, padding: '8px 16px', backgroundColor: '#172033', zIndex: 205, boxShadow: '0 8px 16px rgba(0,0,0,0.2)' }}>
            <div style={{ position: 'relative' }}>
              {input}
              {dropdown}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={rootRef} style={{ position: 'relative', flex: '1 1 auto', maxWidth: 440, margin: '0 16px', minWidth: 0 }}>
      {input}
      {dropdown}
    </div>
  );
}
