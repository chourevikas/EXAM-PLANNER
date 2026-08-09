import React from 'react';
import { useTheme } from '../../hooks/useTheme';

export interface Section {
  id: string;
  label: string;
  total: number;
}

export interface Question {
  id: number;
  sectionId: string;
  sectionName: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  text: string;
  textHindi?: string;
  options: { label: string; text: string; textHindi?: string }[];
}

interface ExamSectionSidebarProps {
  sections: Section[];
  activeSectionId: string;
  questions: Question[];
  selectedOptions: Record<number, string>;
  markedForReview: Record<number, boolean>;
  onSelectSection: (sectionId: string) => void;
}

export function ExamSectionSidebar({
  sections,
  activeSectionId,
  questions,
  selectedOptions,
  markedForReview,
  onSelectSection,
}: ExamSectionSidebarProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const totalQs = questions.length;
  const answeredCount = Object.keys(selectedOptions).length;
  const markedCount = Object.values(markedForReview).filter(Boolean).length;
  const unattemptedCount = totalQs - answeredCount;

  return (
    <aside
      style={{
        width: 240,
        backgroundColor: isDark ? '#0f1e3c' : '#ffffff',
        borderRight: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'}`,
        display: 'flex',
        flexDirection: 'column',
        padding: 16,
        boxSizing: 'border-box',
        flexShrink: 0,
        transition: 'background-color 0.2s, border-color 0.2s'
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          color: isDark ? 'rgba(255, 255, 255, 0.45)' : '#64748b',
          letterSpacing: '0.08em',
          marginBottom: 14,
          fontFamily: 'var(--font-mono)'
        }}
      >
        Sections & Subjects
      </div>

      {/* Section Buttons List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, overflowY: 'auto' }}>
        {sections.map((sec) => {
          const isSecActive = activeSectionId === sec.id;
          const answeredInSec = questions.filter(
            (q) => q.sectionId === sec.id && selectedOptions[q.id - 1] !== undefined
          ).length;
          const pct = Math.round((answeredInSec / sec.total) * 100);

          return (
            <button
              key={sec.id}
              onClick={() => onSelectSection(sec.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                padding: '12px 14px',
                borderRadius: 12,
                border: isSecActive
                  ? '1px solid #3b82f6'
                  : `1px solid ${isDark ? 'rgba(255, 255, 255, 0.06)' : '#e2e8f0'}`,
                backgroundColor: isSecActive
                  ? (isDark ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff')
                  : (isDark ? 'rgba(255, 255, 255, 0.03)' : '#f8fafc'),
                color: isDark ? '#ffffff' : '#0f172a',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: isSecActive ? 700 : 600 }}>{sec.label}</span>
                <span
                  style={{
                    fontSize: 11,
                    color: isDark ? 'rgba(255, 255, 255, 0.5)' : '#64748b',
                    fontFamily: 'var(--font-mono)'
                  }}
                >
                  {answeredInSec}/{sec.total}
                </span>
              </div>

              {/* Subject Progress Bar */}
              <div
                style={{
                  height: 4,
                  width: '100%',
                  borderRadius: 2,
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#cbd5e1',
                  overflow: 'hidden'
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${pct}%`,
                    backgroundColor: '#2563eb',
                    transition: 'width 0.3s'
                  }}
                />
              </div>
            </button>
          );
        })}
      </div>

      {/* Progress Summary Box */}
      <div
        style={{
          marginTop: 'auto',
          padding: 14,
          borderRadius: 12,
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#f8fafc',
          border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 8
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: isDark ? '#ffffff' : '#0f172a' }}>
          Overall Progress
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
          <span style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : '#64748b' }}>Answered:</span>
          <span style={{ color: '#10b981', fontWeight: 700 }}>{answeredCount}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
          <span style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : '#64748b' }}>Review Marked:</span>
          <span style={{ color: '#f59e0b', fontWeight: 700 }}>{markedCount}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
          <span style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : '#64748b' }}>Unanswered:</span>
          <span style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : '#334155', fontWeight: 700 }}>
            {unattemptedCount}
          </span>
        </div>
      </div>
    </aside>
  );
}
