import { useMemo, useState } from 'react';
import { Search, Upload, Sliders, ClipboardCheck, BookOpen, Flag, Users, Award, Globe, Bell, MessageSquareQuote, BarChart2, Palette } from 'lucide-react';
import { canAccessView } from '../../constants/adminAccess';

interface Section {
  id: string;
  label: string;
  keywords: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
}

const SECTIONS: Section[] = [
  { id: 'upload', label: 'Upload & Exam Pipeline', keywords: 'upload paper pdf pipeline extraction exam', icon: Upload },
  { id: 'exam-types', label: 'Exam Types', keywords: 'exam types blueprint syllabus', icon: Sliders },
  { id: 'review', label: 'Question & Solution QA', keywords: 'review qa question solution verify approve edit', icon: ClipboardCheck },
  { id: 'questions', label: 'Question Bank Catalog', keywords: 'question bank catalog subject topic', icon: BookOpen },
  { id: 'reported-questions', label: 'Reported Questions', keywords: 'reported reports flagged issues problems', icon: Flag },
  { id: 'users', label: 'Users', keywords: 'users candidates students accounts subscription', icon: Users },
  { id: 'teacher-rewards', label: 'Teacher Rewards', keywords: 'teacher rewards points', icon: Award },
  { id: 'current-affairs', label: 'Current Affairs', keywords: 'current affairs news', icon: Globe },
  { id: 'notifications', label: 'Notifications', keywords: 'notifications broadcast announcement', icon: Bell },
  { id: 'testimonials', label: 'Testimonial Approvals', keywords: 'testimonials stories approve reviews', icon: MessageSquareQuote },
  { id: 'analytics', label: 'Reports & Analytics', keywords: 'analytics reports statistics', icon: BarChart2 },
  { id: 'theme', label: 'Theme', keywords: 'theme colours colors appearance', icon: Palette },
];

interface AdminQuickSearchProps {
  permissions?: string[] | null;
  onNavigate: (view: string) => void;
}

/** Jump-to search for admin sections. Lives on the dashboard only. */
export function AdminQuickSearch({ permissions, onNavigate }: AdminQuickSearchProps) {
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return SECTIONS.filter((s) => canAccessView(permissions, s.id)).filter(
      (s) => s.label.toLowerCase().includes(q) || s.keywords.includes(q)
    );
  }, [query, permissions]);

  const go = (id: string) => {
    onNavigate(id);
    setQuery('');
  };

  return (
    <div style={{ position: 'relative', marginBottom: 20 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 14px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius)',
        }}
      >
        <Search size={16} color="var(--text-muted)" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && results[0]) go(results[0].id);
            if (e.key === 'Escape') setQuery('');
          }}
          placeholder="Search the admin panel — e.g. upload, users, reported…"
          aria-label="Search admin sections"
          style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: 'var(--deep-navy)' }}
        />
      </div>

      {query.trim().length > 0 && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 30,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius)',
            boxShadow: '0 12px 28px rgba(15, 23, 42, 0.14)',
            padding: 4,
          }}
        >
          {results.length === 0 ? (
            <div style={{ padding: '10px 12px', fontSize: 13, color: 'var(--text-muted)' }}>No matching sections</div>
          ) : (
            results.map((r) => {
              const Icon = r.icon;
              return (
                <button
                  key={r.id}
                  type="button"
                  role="option"
                  onClick={() => go(r.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    width: '100%',
                    padding: '9px 12px',
                    border: 'none',
                    background: 'transparent',
                    borderRadius: 'var(--radius)',
                    cursor: 'pointer',
                    fontSize: 13.5,
                    color: 'var(--deep-navy)',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(var(--primary-red-rgb), 0.08)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <Icon size={15} color="var(--primary-red)" />
                  {r.label}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
