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

      {/* Full-Height Slide-out Drawer Panel (Admin Sidebar Theme) */}
      <aside
        style={{
          position: 'fixed',
          top: 0,
          bottom: 0,
          left: 0,
          height: '100vh',
          zIndex: 210,
          width: 300,
          background: 'linear-gradient(180deg, var(--ink-black) 0%, var(--deep-navy) 100%)',
          color: '#FFFFFF',
          boxShadow: '8px 0 32px rgba(15, 23, 42, 0.45)',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          animation: 'slideInLeft 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          fontFamily: "'IBM Plex Sans', -apple-system, system-ui, sans-serif",
          overflow: 'hidden',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        {/* Drawer Header & Close Trigger (Admin Dark Blue Theme) */}
        <div
          style={{
            padding: '22px 20px 18px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 'var(--radius)',
                backgroundColor: 'var(--primary-red)',
                color: 'var(--bg-card)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 10px rgba(var(--primary-red-rgb), 0.4)',
              }}
            >
              <Layers size={18} />
            </div>
            <div>
              {/* Sidebar Section Label: IBM Plex Sans 12px / 500, letter spacing */}
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  color: 'var(--bg-card)',
                  letterSpacing: '0.08em',
                  display: 'block',
                  fontFamily: "'IBM Plex Sans', sans-serif",
                }}
              >
                EXAM SECTIONS
              </span>
              <span style={{ fontSize: 11.5, color: 'rgba(255, 255, 255, 0.65)', fontWeight: 400, fontFamily: "'IBM Plex Sans', sans-serif" }}>
                {total} Questions Loaded
              </span>
            </div>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.75)',
                cursor: 'pointer',
                padding: 6,
                borderRadius: 'var(--radius)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.color = 'var(--bg-card)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'rgba(255, 255, 255, 0.75)';
              }}
              title="Close Drawer"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Scrollable Main Content */}
        <div style={{ flex: 1, padding: '20px 16px', overflowY: 'auto' }}>
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
                    padding: '10px 14px',
                    borderRadius: 'var(--radius)',
                    border: 'none',
                    borderLeft: isSecActive ? '3px solid var(--primary-red)' : '3px solid transparent',
                    background: isSecActive ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                    color: isSecActive ? 'var(--bg-card)' : 'rgba(255, 255, 255, 0.65)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                    fontFamily: "'IBM Plex Sans', sans-serif",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSecActive) {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                      e.currentTarget.style.color = 'var(--bg-card)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSecActive) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = 'rgba(255, 255, 255, 0.65)';
                    }
                  }}
                >
                  {/* Navigation item: IBM Plex Sans 14.5px / 500; Active navigation item: 14.5px / 600 */}
                  <span style={{ fontSize: 14.5, fontWeight: isSecActive ? 600 : 500, lineHeight: 1.35, fontFamily: "'IBM Plex Sans', sans-serif" }}>
                    {sec.label}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      color: isSecActive ? 'var(--primary-red)' : 'rgba(255, 255, 255, 0.5)',
                      fontWeight: isSecActive ? 600 : 400,
                      fontVariantNumeric: 'tabular-nums',
                      backgroundColor: isSecActive ? 'rgba(var(--primary-red-rgb), 0.3)' : 'rgba(255, 255, 255, 0.06)',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius)',
                      fontFamily: "'IBM Plex Sans', sans-serif",
                    }}
                  >
                    {secAnswered} / {secTotal}
                  </span>
                </button>
              );
            })}
          </div>

          <div style={{ height: 1, backgroundColor: 'rgba(255, 255, 255, 0.1)', marginBottom: 20 }} />

          {/* Section label: IBM Plex Sans 11.5px / 500, subtle letter spacing */}
          <div
            style={{
              fontSize: 11.5,
              fontWeight: 500,
              textTransform: 'uppercase',
              color: 'rgba(255, 255, 255, 0.55)',
              letterSpacing: '0.08em',
              marginBottom: 14,
              fontFamily: "'IBM Plex Sans', sans-serif",
            }}
          >
            LIVE PROGRESS OVERVIEW
          </div>

          {/* Metric Pill Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 14px',
                borderRadius: 'var(--radius)',
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: 'var(--radius)', backgroundColor: '#3A8B53' }} />
                <span style={{ color: '#A7F3D0', fontWeight: 600 }}>ANSWERED</span>
              </div>
              <span style={{ color: '#34D399', fontWeight: 800, fontVariantNumeric: 'tabular-nums', fontSize: 14 }}>
                {answeredCount}
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 14px',
                borderRadius: 'var(--radius)',
                backgroundColor: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: 'var(--radius)', backgroundColor: '#F2B623' }} />
                <span style={{ color: '#FDE68A', fontWeight: 600 }}>REVIEW</span>
              </div>
              <span style={{ color: '#FBBF24', fontWeight: 800, fontVariantNumeric: 'tabular-nums', fontSize: 14 }}>
                {markedCount}
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 14px',
                borderRadius: 'var(--radius)',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: 'var(--radius)', backgroundColor: 'var(--text-disabled)' }} />
                <span style={{ color: 'var(--border-color)', fontWeight: 600 }}>UNANSWERED</span>
              </div>
              <span style={{ color: 'var(--text-disabled)', fontWeight: 800, fontVariantNumeric: 'tabular-nums', fontSize: 14 }}>
                {unattemptedCount}
              </span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
