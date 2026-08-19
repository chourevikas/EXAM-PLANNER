import React from 'react';
import { useTheme } from '../../hooks/useTheme';
import { QuestionPaletteItem, ResponseSummary } from '../../types/exam';
import { CheckCircle2, Bookmark, HelpCircle, Layers, BarChart2 } from 'lucide-react';

export interface Section {
  id: string;
  label: string;
  total?: number;
  startQuestionNumber?: number;
  endQuestionNumber?: number;
}

export interface Question {
  id: number;
  sectionId?: string;
  sectionName?: string;
  difficulty?: 'Easy' | 'Medium' | 'Hard';
  text?: string;
  textHindi?: string;
  options?: { label: string; text: string; textHindi?: string }[];
}

interface ExamSectionSidebarProps {
  sections?: Section[];
  activeSectionId?: string;
  palette?: QuestionPaletteItem[];
  totalQuestions?: number;
  currentQIndex?: number;
  responseSummary?: ResponseSummary;
  onSelectSection?: (sectionId: string, startQNum?: number) => void;
  onSelectQuestion?: (questionIndex: number) => void;
  // Deprecated props kept for safety
  questions?: Question[];
  selectedOptions?: Record<number, string>;
  markedForReview?: Record<number, boolean>;
}

export function ExamSectionSidebar({
  sections = [],
  activeSectionId,
  palette = [],
  totalQuestions = 100,
  currentQIndex = 0,
  responseSummary,
  onSelectSection,
  onSelectQuestion,
  questions = [],
  selectedOptions = {},
  markedForReview = {},
}: ExamSectionSidebarProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // 1. Compute Live Counts from Palette
  const total = palette.length > 0 ? palette.length : (responseSummary?.total || totalQuestions || 100);
  
  const answeredCount = palette.length > 0
    ? palette.filter((p) => p.question_status === 'ANSWERED' || p.question_status === 'ANSWERED_AND_MARKED').length
    : (responseSummary?.answered_count ?? Object.keys(selectedOptions).length);

  const markedCount = palette.length > 0
    ? palette.filter((p) => p.question_status === 'MARKED_FOR_REVIEW' || p.question_status === 'ANSWERED_AND_MARKED').length
    : (responseSummary?.marked_for_review_count ?? Object.values(markedForReview).filter(Boolean).length);

  const unattemptedCount = Math.max(0, total - answeredCount);
  const completionPct = total > 0 ? Math.round((answeredCount / total) * 100) : 0;

  // 2. Default sections if not customized
  const effectiveSections: Section[] = sections.length > 0 ? sections : [
    { id: 'all', label: 'All Questions', total, startQuestionNumber: 1, endQuestionNumber: total },
  ];

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
        height: '100%',
        transition: 'background-color 0.2s, border-color 0.2s',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          color: isDark ? 'rgba(255, 255, 255, 0.5)' : '#64748b',
          letterSpacing: '0.08em',
          marginBottom: 14,
          fontFamily: 'var(--font-mono, monospace)',
        }}
      >
        <Layers size={14} color="#3b82f6" />
        <span>Sections & Overview</span>
      </div>

      {/* Sections List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, overflowY: 'auto' }}>
        {effectiveSections.map((sec, idx) => {
          const isSecActive = activeSectionId === sec.id || (!activeSectionId && idx === 0);
          
          // Compute per-section stats if range is defined
          const secTotal = sec.total || total;
          let secAnswered = answeredCount;
          
          if (sec.startQuestionNumber && sec.endQuestionNumber && palette.length > 0) {
            secAnswered = palette.filter((p) => {
              const inRange = p.question_number >= sec.startQuestionNumber! && p.question_number <= sec.endQuestionNumber!;
              const isAns = p.question_status === 'ANSWERED' || p.question_status === 'ANSWERED_AND_MARKED';
              return inRange && isAns;
            }).length;
          }

          const secPct = secTotal > 0 ? Math.round((secAnswered / secTotal) * 100) : 0;

          return (
            <button
              key={sec.id}
              onClick={() => {
                if (onSelectSection) {
                  onSelectSection(sec.id, sec.startQuestionNumber);
                } else if (onSelectQuestion && sec.startQuestionNumber) {
                  onSelectQuestion(sec.startQuestionNumber - 1);
                }
              }}
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
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: isSecActive ? 700 : 600 }}>{sec.label}</span>
                <span
                  style={{
                    fontSize: 11,
                    color: isDark ? 'rgba(255, 255, 255, 0.6)' : '#64748b',
                    fontFamily: 'var(--font-mono, monospace)',
                    fontWeight: 700,
                  }}
                >
                  {secAnswered}/{secTotal}
                </span>
              </div>

              {/* Progress Bar */}
              <div
                style={{
                  height: 4,
                  width: '100%',
                  borderRadius: 2,
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#cbd5e1',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${secPct}%`,
                    backgroundColor: '#2563eb',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
            </button>
          );
        })}
      </div>

      {/* Progress Summary Box (Live Counts) */}
      <div
        style={{
          marginTop: 'auto',
          padding: 14,
          borderRadius: 12,
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#f8fafc',
          border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: isDark ? '#ffffff' : '#0f172a' }}>
            <BarChart2 size={14} color="#3b82f6" />
            <span>Overall Progress</span>
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#3b82f6', fontFamily: 'var(--font-mono, monospace)' }}>
            {completionPct}%
          </span>
        </div>

        {/* Global Progress Bar */}
        <div
          style={{
            height: 6,
            width: '100%',
            borderRadius: 3,
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#e2e8f0',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${completionPct}%`,
              backgroundColor: '#10b981',
              transition: 'width 0.3s ease',
            }}
          />
        </div>

        {/* Answered */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: isDark ? 'rgba(255, 255, 255, 0.7)' : '#64748b' }}>
            <CheckCircle2 size={13} color="#10b981" />
            <span>Answered:</span>
          </div>
          <span style={{ color: '#10b981', fontWeight: 800, fontFamily: 'var(--font-mono, monospace)' }}>
            {answeredCount}
          </span>
        </div>

        {/* Marked for Review */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: isDark ? 'rgba(255, 255, 255, 0.7)' : '#64748b' }}>
            <Bookmark size={13} color="#f59e0b" />
            <span>Review Marked:</span>
          </div>
          <span style={{ color: '#f59e0b', fontWeight: 800, fontFamily: 'var(--font-mono, monospace)' }}>
            {markedCount}
          </span>
        </div>

        {/* Unanswered */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: isDark ? 'rgba(255, 255, 255, 0.7)' : '#64748b' }}>
            <HelpCircle size={13} color={isDark ? 'rgba(255, 255, 255, 0.4)' : '#94a3b8'} />
            <span>Unanswered:</span>
          </div>
          <span style={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : '#334155', fontWeight: 800, fontFamily: 'var(--font-mono, monospace)' }}>
            {unattemptedCount}
          </span>
        </div>
      </div>
    </aside>
  );
}
