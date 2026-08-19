import React from 'react';
import { X, Layers } from 'lucide-react';
import { QuestionPaletteItem, ResponseSummary } from '../../types/exam';

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
  isOpen?: boolean;
  onClose?: () => void;
  sections?: Section[];
  activeSectionId?: string;
  palette?: QuestionPaletteItem[];
  totalQuestions?: number;
  currentQIndex?: number;
  responseSummary?: ResponseSummary;
  onSelectSection?: (sectionId: string, startQNum?: number) => void;
  onSelectQuestion?: (questionIndex: number) => void;
  questions?: Question[];
  selectedOptions?: Record<number, string>;
  markedForReview?: Record<number, boolean>;
}

export function ExamSectionSidebar({
  isOpen = false,
  onClose,
  sections = [],
  activeSectionId,
  palette = [],
  totalQuestions = 10,
  currentQIndex = 0,
  responseSummary,
  onSelectSection,
  onSelectQuestion,
  questions = [],
  selectedOptions = {},
  markedForReview = {},
}: ExamSectionSidebarProps) {
  // Compute Live Counts from Palette
  const total = palette.length > 0 ? palette.length : (responseSummary?.total || totalQuestions || 10);

  const answeredCount =
    palette.length > 0
      ? palette.filter(
        (p) => p.question_status === 'ANSWERED' || p.question_status === 'ANSWERED_AND_MARKED'
      ).length
      : (responseSummary?.answered_count ?? Object.keys(selectedOptions).length);

  const markedCount =
    palette.length > 0
      ? palette.filter(
        (p) => p.question_status === 'MARKED_FOR_REVIEW' || p.question_status === 'ANSWERED_AND_MARKED'
      ).length
      : (responseSummary?.marked_for_review_count ?? Object.values(markedForReview).filter(Boolean).length);

  const unattemptedCount = Math.max(0, total - answeredCount);

  // Default sections if not customized
  const effectiveSections: Section[] =
    sections.length > 0
      ? sections
      : [{ id: 'all', label: 'All Subjects', total, startQuestionNumber: 1, endQuestionNumber: total }];

  if (!isOpen) return null;

  return (
    <>
      {/* Dimmed Overlay Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 200,
          backgroundColor: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(3px)',
          transition: 'opacity 0.2s ease-out',
        }}
      />

      {/* Full-Height Slide-out Drawer Panel */}
      <aside
        style={{
          position: 'fixed',
          top: 0,
          bottom: 0,
          left: 0,
          height: '100vh',
          zIndex: 210,
          width: 280,
          backgroundColor: '#FFFFFF',
          borderRight: '1px solid #E2E8F0',
          boxShadow: '4px 0 24px rgba(15, 23, 42, 0.18)',
          display: 'flex',
          flexDirection: 'column',
          padding: '20px 16px',
          boxSizing: 'border-box',
          animation: 'slideInLeft 0.22s ease-out forwards',
        }}
      >
        {/* Drawer Header & Close Trigger */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
            paddingBottom: 10,
            borderBottom: '1px solid #E2E8F0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Layers size={16} color="#2563EB" />
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                textTransform: 'uppercase',
                color: '#0F172A',
                letterSpacing: '0.08em',
              }}
            >
              EXAM SECTIONS
            </span>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: '#64748B',
                cursor: 'pointer',
                padding: 4,
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#F1F5F9';
                e.currentTarget.style.color = '#0F172A';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#64748B';
              }}
              title="Close Drawer"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Sections List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 24 }}>
          {effectiveSections.map((sec, idx) => {
            const isSecActive = activeSectionId === sec.id || (!activeSectionId && idx === 0);
            const secTotal = sec.total || total;
            let secAnswered = answeredCount;

            if (sec.startQuestionNumber && sec.endQuestionNumber && palette.length > 0) {
              secAnswered = palette.filter((p) => {
                const inRange =
                  p.question_number >= sec.startQuestionNumber! &&
                  p.question_number <= sec.endQuestionNumber!;
                const isAns =
                  p.question_status === 'ANSWERED' || p.question_status === 'ANSWERED_AND_MARKED';
                return inRange && isAns;
              }).length;
            }

            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => {
                  if (onSelectSection) {
                    onSelectSection(sec.id, sec.startQuestionNumber);
                  } else if (onSelectQuestion && sec.startQuestionNumber) {
                    onSelectQuestion(sec.startQuestionNumber - 1);
                  }
                  if (onClose) onClose();
                }}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 12px',
                  borderRadius: 6,
                  border: 'none',
                  borderLeft: isSecActive ? '3px solid #2563EB' : '3px solid transparent',
                  backgroundColor: isSecActive ? '#EFF6FF' : 'transparent',
                  color: isSecActive ? '#2563EB' : '#0F172A',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isSecActive) e.currentTarget.style.backgroundColor = '#F8FAFC';
                }}
                onMouseLeave={(e) => {
                  if (!isSecActive) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <span style={{ fontSize: 13, fontWeight: isSecActive ? 700 : 500, lineHeight: 1.3 }}>
                  {sec.label}
                </span>
                <span
                  style={{
                    fontSize: 11.5,
                    color: isSecActive ? '#2563EB' : '#64748B',
                    fontWeight: 600,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {secAnswered} / {secTotal}
                </span>
              </button>
            );
          })}
        </div>

        <div style={{ height: 1, backgroundColor: '#E2E8F0', marginBottom: 20 }} />

        {/* YOUR PROGRESS Header */}
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            color: '#64748B',
            letterSpacing: '0.08em',
            marginBottom: 14,
            paddingBottom: 6,
            borderBottom: '1px solid #E2E8F0',
          }}
        >
          YOUR PROGRESS
        </div>

        {/* Metric Rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#059669' }} />
              <span style={{ color: '#475569', fontWeight: 500 }}>ANSWERED</span>
            </div>
            <span style={{ color: '#059669', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {answeredCount}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#D97706' }} />
              <span style={{ color: '#475569', fontWeight: 500 }}>REVIEW</span>
            </div>
            <span style={{ color: '#D97706', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {markedCount}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#94A3B8' }} />
              <span style={{ color: '#475569', fontWeight: 500 }}>UNANSWERED</span>
            </div>
            <span style={{ color: '#64748B', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {unattemptedCount}
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}
