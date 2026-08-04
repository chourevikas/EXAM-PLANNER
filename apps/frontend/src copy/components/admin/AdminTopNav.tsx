import React from 'react';
import { Search, Bell, Upload, Settings, ChevronRight } from 'lucide-react';

interface TopNavProps {
  activeView: string;
  onNavigate: (id: string) => void;
}

const breadcrumbMap: Record<string, string[]> = {
  dashboard: ['Platform', 'Dashboard'],
  upload: ['Platform', 'Question Bank', 'Upload Paper'],
  questions: ['Platform', 'Question Bank'],
  'ai-queue': ['Platform', 'AI Processing Queue'],
  review: ['Platform', 'Question Review'],
  'mock-tests': ['Platform', 'Mock Tests'],
  resources: ['Platform', 'Learning Resources'],
  users: ['Platform', 'Users'],
  analytics: ['Platform', 'Reports & Analytics'],
  subscriptions: ['Platform', 'Subscriptions'],
};

export function AdminTopNav({ activeView, onNavigate }: TopNavProps) {
  const crumbs = breadcrumbMap[activeView] ?? ['Platform'];

  return (
    <header
      style={{
        height: 56,
        background: 'var(--bg-card, #fff)',
        borderBottom: '1px solid var(--border-color, #e2e8f0)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
        gap: 16,
        position: 'sticky',
        top: 0,
        zIndex: 30,
      }}
    >
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
        {crumbs.map((crumb, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {i > 0 && <ChevronRight size={12} color="var(--text-muted, #94a3b8)" />}
            <span
              style={{
                fontSize: 13,
                color: i === crumbs.length - 1 ? 'var(--text-main, #0f172a)' : 'var(--text-muted, #94a3b8)',
                fontWeight: i === crumbs.length - 1 ? 500 : 400,
                fontFamily: 'var(--font-body)',
              }}
            >
              {crumb}
            </span>
          </span>
        ))}
      </div>

      {/* Search */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'var(--bg-secondary, #f1f5f9)',
          borderRadius: 8,
          padding: '6px 12px',
          width: 240,
        }}
      >
        <Search size={14} color="var(--text-muted, #94a3b8)" />
        <input
          placeholder="Search questions, papers…"
          style={{
            border: 'none',
            background: 'transparent',
            outline: 'none',
            fontSize: 13,
            color: 'var(--text-main, #334155)',
            fontFamily: 'var(--font-body)',
            width: '100%',
          }}
        />
        <span
          style={{
            fontSize: 11,
            color: 'var(--text-muted, #cbd5e1)',
            fontFamily: 'var(--font-mono)',
            background: 'var(--border-color, #e2e8f0)',
            borderRadius: 4,
            padding: '1px 5px',
          }}
        >
          ⌘K
        </span>
      </div>

      {/* Actions */}
      <button
        onClick={() => onNavigate('upload')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: '#2563eb',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          padding: '7px 14px',
          fontSize: 13,
          fontFamily: 'var(--font-body)',
          fontWeight: 500,
          cursor: 'pointer',
          transition: 'background 0.12s ease',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = '#1d4ed8')}
        onMouseLeave={(e) => (e.currentTarget.style.background = '#2563eb')}
      >
        <Upload size={13} />
        Quick Upload
      </button>

      <div style={{ position: 'relative' }}>
        <button
          style={{
            width: 34,
            height: 34,
            borderRadius: 8,
            border: '1px solid var(--border-color, #e2e8f0)',
            background: 'var(--bg-card, #fff)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--text-muted, #64748b)',
          }}
        >
          <Bell size={15} />
        </button>
        <span
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: '#ef4444',
            border: '1.5px solid #fff',
          }}
        />
      </div>

      <button
        onClick={() => onNavigate('analytics')}
        style={{
          width: 34,
          height: 34,
          borderRadius: 8,
          border: '1px solid var(--border-color, #e2e8f0)',
          background: 'var(--bg-card, #fff)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: 'var(--text-muted, #64748b)',
        }}
      >
        <Settings size={15} />
      </button>

      {/* Avatar */}
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: 12,
          fontWeight: 600,
          fontFamily: 'var(--font-display)',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        SA
      </div>
    </header>
  );
}
