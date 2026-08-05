import { useState, useEffect, useRef, type CSSProperties } from 'react'
import {
  Bookmark,
  Clock,
  Calculator,
  Trash2,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  ChevronRight,
  GraduationCap,
  Filter,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type QState = 'not-visited' | 'answered' | 'marked' | 'answered-marked' | 'not-answered' | 'current'

interface Section {
  id: string
  label: string
  total: number
  answered: number
  icon: React.ElementType
  iconColor: string
  tintBg: string
}

interface Question {
  id: number
  sectionId: string
  difficulty: 'Easy' | 'Medium' | 'Hard'
  text: string
  options: { label: string; text: string }[]
}

// ─── Static Data ──────────────────────────────────────────────────────────────

const SECTIONS: Section[] = [
  {
    id: 'gs', label: 'General Studies', total: 33, answered: 20,
    icon: GraduationCap, iconColor: 'var(--accent-primary)', tintBg: 'var(--accent-bg)',
  },
  {
    id: 'polity', label: 'Polity', total: 25, answered: 15,
    icon: ({ size, style }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={style}>
        <path d="M3 22h18M6 18v-7M10 18v-7M14 18v-7M18 18v-7M12 2L2 7h20L12 2z"/>
      </svg>
    ),
    iconColor: 'var(--success-icon)', tintBg: 'var(--success-bg)',
  },
  {
    id: 'economy', label: 'Economy', total: 20, answered: 8,
    icon: ({ size, style }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={style}>
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>
      </svg>
    ),
    iconColor: 'var(--warning-text)', tintBg: 'var(--warning-bg)',
  },
  {
    id: 'history', label: 'History', total: 18, answered: 5,
    icon: ({ size, style }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={style}>
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
    iconColor: 'var(--pink-primary)', tintBg: 'var(--pink-bg)',
  },
  {
    id: 'geography', label: 'Geography', total: 22, answered: 3,
    icon: ({ size, style }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={style}>
        <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
      </svg>
    ),
    iconColor: 'var(--info-primary)', tintBg: 'var(--info-bg)',
  },
]

const QUESTIONS: Question[] = [
  {
    id: 1, sectionId: 'gs', difficulty: 'Medium',
    text: 'Which of the following Fundamental Duties was added by the 42nd Constitutional Amendment Act, 1976?',
    options: [
      { label: 'A', text: 'To abide by the Constitution and respect its ideals and institutions, the National Flag and the National Anthem' },
      { label: 'B', text: 'To develop the scientific temper, humanism and the spirit of inquiry and reform' },
      { label: 'C', text: 'To safeguard public property and to abjure violence' },
      { label: 'D', text: 'To value and preserve the rich heritage of our composite culture' },
    ],
  },
  {
    id: 2, sectionId: 'polity', difficulty: 'Hard',
    text: 'The concept of "Basic Structure" of the Constitution was propounded by the Supreme Court in which landmark case?',
    options: [
      { label: 'A', text: 'A.K. Gopalan v. State of Madras (1950)' },
      { label: 'B', text: 'Golaknath v. State of Punjab (1967)' },
      { label: 'C', text: 'Kesavananda Bharati v. State of Kerala (1973)' },
      { label: 'D', text: 'Minerva Mills v. Union of India (1980)' },
    ],
  },
  {
    id: 3, sectionId: 'economy', difficulty: 'Easy',
    text: 'Which body is responsible for the formulation of monetary policy in India to maintain price stability?',
    options: [
      { label: 'A', text: 'Ministry of Finance, Government of India' },
      { label: 'B', text: 'Monetary Policy Committee (MPC) of the Reserve Bank of India' },
      { label: 'C', text: 'NITI Aayog Planning Commission' },
      { label: 'D', text: 'Securities and Exchange Board of India (SEBI)' },
    ],
  },
]

const TOTAL_QUESTIONS = 33

// ─── Helper ───────────────────────────────────────────────────────────────────

function fmt(secs: number) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':')
}

function useHover() {
  const [h, setH] = useState(false)
  return { hovered: h, onMouseEnter: () => setH(true), onMouseLeave: () => setH(false) }
}

// ─── Header ───────────────────────────────────────────────────────────────────

function Header({ timeLeft }: { timeLeft: number }) {
  const danger = timeLeft < 300
  const hReport = useHover()
  const hSubmit = useHover()

  return (
    <header style={{
      height: 72,
      backgroundColor: 'var(--bg-card)',
      borderBottom: '1px solid var(--border-default)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 32px',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      flexShrink: 0,
    }}>
      {/* Left */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-dark) 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px var(--shadow-color-accent, rgba(91,92,235,0.3))',
        }}>
          <GraduationCap size={18} style={{ color: 'var(--text-inverse)' }} />
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-disabled)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            ExamPlanner
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginTop: 1 }}>
            Full Length Test – UPSC Prelims
          </div>
        </div>
        <div style={{ width: 1, height: 28, backgroundColor: 'var(--border-default)', margin: '0 4px' }} />
        <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>
          General Studies · Paper I
        </div>
      </div>

      {/* Right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Report Issue */}
        <button
          {...hReport}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            height: 40, padding: '0 16px',
            borderRadius: 14, border: `1px solid ${hReport.hovered ? 'var(--accent-primary)' : 'var(--border-default)'}`,
            backgroundColor: hReport.hovered ? 'var(--accent-bg)' : 'var(--bg-card)',
            color: hReport.hovered ? 'var(--accent-primary)' : 'var(--text-muted)',
            fontSize: 14, fontWeight: 500, cursor: 'pointer',
            transition: 'all 150ms ease',
          }}>
          <AlertCircle size={14} />
          Report Issue
        </button>

        {/* Timer */}
        <div
          role="timer"
          aria-live="polite"
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            height: 44, padding: '0 16px', borderRadius: 14,
            backgroundColor: danger ? 'var(--danger-bg)' : 'var(--accent-bg)',
            border: `1px solid ${danger ? 'var(--danger-border)' : '#C7D2FE'}`,
            transition: 'all 300ms ease',
          }}>
          <Clock size={16} style={{ color: danger ? 'var(--danger-primary)' : 'var(--accent-primary)', flexShrink: 0 }} />
          <div>
            <div style={{
              fontSize: 16, fontWeight: 700,
              color: danger ? 'var(--danger-text)' : 'var(--text-primary)',
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1,
            }}>
              {fmt(timeLeft)}
            </div>
            <div style={{ fontSize: 11, color: danger ? 'var(--danger-primary)' : 'var(--text-muted)', marginTop: 2, lineHeight: 1 }}>
              Time Left
            </div>
          </div>
        </div>

        {/* Submit */}
        <button
          {...hSubmit}
          style={{
            height: 44, padding: '0 24px', borderRadius: 14,
            background: hSubmit.hovered
              ? 'linear-gradient(135deg, var(--accent-hover) 0%, var(--accent-darker) 100%)'
              : 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-gradient-end) 100%)',
            color: 'var(--bg-card)', fontSize: 15, fontWeight: 600,
            border: 'none', cursor: 'pointer',
            boxShadow: '0 4px 12px var(--shadow-color-accent, rgba(91,92,235,0.35))',
            transform: hSubmit.hovered ? 'translateY(-2px)' : 'translateY(0)',
            transition: 'all 150ms ease',
            letterSpacing: '0.01em',
          }}>
          Submit Test
        </button>
      </div>
    </header>
  )
}

// ─── Left Sidebar ─────────────────────────────────────────────────────────────

function SectionRow({ section, active, onClick }: {
  section: Section
  active: boolean
  onClick: () => void
}) {
  const { hovered, ...hoverProps } = useHover()
  const Icon = section.icon
  const pct = (section.answered / section.total) * 100

  return (
    <button
      onClick={onClick}
      {...hoverProps}
      style={{
        width: '100%', display: 'flex', alignItems: 'center',
        gap: 12, padding: '10px 12px', borderRadius: 14,
        border: 'none', cursor: 'pointer', textAlign: 'left',
        backgroundColor: active ? 'var(--accent-bg)' : hovered ? 'var(--bg-hover)' : 'transparent',
        transition: 'all 150ms ease', position: 'relative', overflow: 'hidden',
      }}>
      {/* Active accent bar */}
      {active && (
        <div style={{
          position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
          width: 3, height: 28, borderRadius: '0 2px 2px 0',
          backgroundColor: 'var(--accent-primary)',
        }} />
      )}

      {/* Icon chip */}
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        backgroundColor: active ? 'var(--accent-primary)' : section.tintBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 150ms ease',
      }}>
        <Icon
          size={17}
          style={{ color: active ? 'var(--bg-card)' : section.iconColor }}
        />
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: active ? 600 : 500,
          color: active ? 'var(--accent-primary)' : 'var(--text-primary)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          marginBottom: 3,
        }}>
          {section.label}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ height: 3, borderRadius: 999, flex: 1, backgroundColor: 'var(--bg-subtle)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${pct}%`,
              backgroundColor: active ? 'var(--accent-primary)' : section.iconColor,
              borderRadius: 999, opacity: 0.6,
            }} />
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-disabled)', fontWeight: 500, flexShrink: 0 }}>
            {section.answered}/{section.total}
          </span>
        </div>
      </div>

      {/* Chevron */}
      {(active || hovered) && (
        <ChevronRight size={15} style={{ color: 'var(--text-disabled)', flexShrink: 0 }} />
      )}
    </button>
  )
}

function LeftSidebar({ activeSection, onSectionChange }: {
  activeSection: string
  onSectionChange: (id: string) => void
}) {
  const hCalc = useHover()

  return (
    <aside style={{
      width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column',
      gap: 0, height: 'calc(100vh - 72px)', position: 'sticky', top: 72,
    }}>
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        backgroundColor: 'var(--bg-card)', borderRadius: 24,
        border: '1px solid var(--border-default)',
        boxShadow: '0 8px 30px var(--shadow-color-base, rgba(15,23,42,0.05))',
        overflow: 'hidden',
      }}>
        {/* Top: Sections */}
        <div style={{ padding: '20px 12px 16px' }}>
          <div style={{
            fontSize: 11, fontWeight: 600, color: 'var(--text-disabled)',
            letterSpacing: '0.08em', textTransform: 'uppercase',
            padding: '0 8px', marginBottom: 12,
          }}>
            Sections
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {SECTIONS.map((s) => (
              <SectionRow
                key={s.id}
                section={s}
                active={activeSection === s.id}
                onClick={() => onSectionChange(s.id)}
              />
            ))}
          </div>
        </div>

        {/* Bottom: Summary + Calculator */}
        <div style={{ borderTop: '1px solid var(--bg-subtle)', padding: 16 }}>
          {/* Mini stats */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            gap: 8, marginBottom: 12,
          }}>
            {[
              { label: 'Answered', value: 51, color: 'var(--success-primary)', bg: 'var(--success-bg)' },
              { label: 'Remaining', value: 67, color: 'var(--text-disabled)', bg: 'var(--bg-subtle)' },
            ].map((stat) => (
              <div key={stat.label} style={{
                padding: '10px 12px', borderRadius: 12,
                backgroundColor: stat.bg, textAlign: 'center',
              }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Calculator */}
          <button
            {...hCalc}
            style={{
              width: '100%', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 8,
              height: 44, borderRadius: 14,
              border: `1px solid ${hCalc.hovered ? 'var(--accent-primary)' : 'var(--border-default)'}`,
              backgroundColor: hCalc.hovered ? 'var(--accent-bg)' : 'var(--bg-card)',
              color: hCalc.hovered ? 'var(--accent-primary)' : 'var(--text-muted)',
              fontSize: 14, fontWeight: 500, cursor: 'pointer',
              transition: 'all 150ms ease',
            }}>
            <Calculator size={16} />
            Calculator
          </button>
        </div>
      </div>
    </aside>
  )
}

// ─── Option Card ──────────────────────────────────────────────────────────────

function OptionCard({ label, text, selected, onSelect }: {
  label: string; text: string; selected: boolean; onSelect: () => void
}) {
  const { hovered, ...hoverProps } = useHover()
  const [pressed, setPressed] = useState(false)

  return (
    <button
      onClick={onSelect}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseEnter={hoverProps.onMouseEnter}
      onMouseLeave={(e) => {
        setPressed(false)
        hoverProps.onMouseLeave?.()
      }}
      style={{
        width: '100%', display: 'flex', alignItems: 'center',
        gap: 16, padding: '18px 24px', minHeight: 88,
        borderRadius: 18, cursor: 'pointer', textAlign: 'left',
        border: selected
          ? '2px solid var(--accent-primary)'
          : hovered
          ? '1.5px solid var(--accent-border)'
          : '1.5px solid var(--border-default)',
        backgroundColor: selected
          ? 'var(--accent-bg)'
          : hovered
          ? 'var(--bg-hover-accent)'
          : 'var(--bg-card)',
        boxShadow: selected
          ? '0 0 0 4px var(--shadow-color-accent, rgba(91,92,235,0.08))'
          : hovered
          ? '0 4px 16px var(--shadow-color-base, rgba(15,23,42,0.06))'
          : '0 1px 3px var(--shadow-color-base, rgba(15,23,42,0.03))',
        transform: pressed ? 'scale(0.99)' : hovered && !selected ? 'translateY(-1px)' : 'none',
        transition: 'all 150ms ease-out',
        outline: 'none',
      }}>
      {/* Letter Badge */}
      <div style={{
        width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
        backgroundColor: selected ? 'var(--accent-primary)' : hovered ? 'var(--accent-bg)' : 'var(--bg-subtle)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 150ms ease',
      }}>
        <span style={{
          fontSize: 15, fontWeight: 700,
          color: selected ? 'var(--bg-card)' : hovered ? 'var(--accent-primary)' : 'var(--text-secondary)',
          transition: 'all 150ms ease',
        }}>
          {label}
        </span>
      </div>

      {/* Text */}
      <span style={{
        flex: 1, fontSize: 16, lineHeight: 1.55,
        color: selected ? 'var(--text-accent-dark)' : 'var(--text-secondary)',
        fontWeight: selected ? 500 : 400,
        transition: 'color 150ms ease',
      }}>
        {text}
      </span>

      {/* Radio */}
      <div style={{
        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
        border: `2px solid ${selected ? 'var(--accent-primary)' : hovered ? 'var(--accent-border-hover)' : 'var(--border-disabled)'}`,
        backgroundColor: selected ? 'var(--accent-primary)' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 150ms ease',
      }}>
        {selected && (
          <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--bg-card)' }} />
        )}
      </div>
    </button>
  )
}

// ─── Question Card ────────────────────────────────────────────────────────────

const DIFFICULTY_STYLES = {
  Easy: { bg: 'var(--success-bg)', text: 'var(--success-text)' },
  Medium: { bg: 'var(--warning-bg)', text: '#B45309' },
  Hard: { bg: 'var(--danger-bg-alt)', text: 'var(--danger-text)' },
}

function QuestionCard({
  questionNum, totalQuestions, question, selectedOption, bookmarked, fadeIn,
  onOptionSelect, onBookmark, onClear, onMarkReview, onNext, onPrev, hasPrev,
}: {
  questionNum: number; totalQuestions: number; question: Question
  selectedOption: string | null; bookmarked: boolean; fadeIn: boolean
  onOptionSelect: (l: string) => void; onBookmark: () => void
  onClear: () => void; onMarkReview: () => void; onNext: () => void
  onPrev: () => void; hasPrev: boolean
}) {
  const hBookmark = useHover()
  const hClear = useHover()
  const hReview = useHover()
  const hNext = useHover()
  const hPrev = useHover()
  const diff = DIFFICULTY_STYLES[question.difficulty]
  const section = SECTIONS.find((s) => s.id === question.sectionId)

  return (
    <div style={{
      flex: 1, backgroundColor: 'var(--bg-card)', borderRadius: 24,
      border: '1px solid var(--border-default)',
      boxShadow: '0 8px 30px var(--shadow-color-base, rgba(15,23,42,0.05))',
      display: 'flex', flexDirection: 'column',
      opacity: fadeIn ? 1 : 0,
      transform: fadeIn ? 'translateY(0)' : 'translateY(6px)',
      transition: 'opacity 200ms ease, transform 200ms ease',
    }}>
      {/* Meta bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '24px 32px 0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-disabled)' }}>
            Question {questionNum} of {totalQuestions}
          </span>
          <span style={{ width: 3, height: 3, borderRadius: '50%', backgroundColor: 'var(--border-disabled)', display: 'inline-block' }} />
          {/* Section chip */}
          <span style={{
            fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 999,
            backgroundColor: section?.tintBg ?? 'var(--accent-bg)',
            color: section?.iconColor ?? 'var(--accent-primary)',
          }}>
            {section?.label ?? 'General Studies'}
          </span>
          {/* Difficulty chip */}
          <span style={{
            fontSize: 12, fontWeight: 600, padding: '4px 10px',
            borderRadius: 999, backgroundColor: diff.bg, color: diff.text,
          }}>
            {question.difficulty}
          </span>
        </div>

        {/* Bookmark */}
        <button
          onClick={onBookmark}
          {...hBookmark}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 12, border: 'none',
            backgroundColor: bookmarked ? '#FEF9C3' : hBookmark.hovered ? 'var(--bg-hover)' : 'transparent',
            color: bookmarked ? 'var(--warning-text)' : 'var(--text-disabled)',
            fontSize: 13, fontWeight: 500, cursor: 'pointer',
            transition: 'all 150ms ease',
          }}>
          <Bookmark
            size={16}
            fill={bookmarked ? 'var(--warning-primary)' : 'none'}
            style={{ color: bookmarked ? 'var(--warning-text)' : hBookmark.hovered ? 'var(--text-muted)' : 'var(--text-disabled)' }}
          />
          {bookmarked ? 'Bookmarked' : 'Bookmark'}
        </button>
      </div>

      {/* Question text */}
      <div style={{ padding: '20px 32px 0' }}>
        <p style={{
          fontSize: 22, fontWeight: 600, color: 'var(--text-primary)',
          lineHeight: 1.5, margin: 0,
        }}>
          {question.text}
        </p>
      </div>

      {/* Options */}
      <div style={{
        padding: '28px 32px', flex: 1,
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        {question.options.map((opt) => (
          <OptionCard
            key={opt.label}
            label={opt.label}
            text={opt.text}
            selected={selectedOption === opt.label}
            onSelect={() => onOptionSelect(opt.label)}
          />
        ))}
      </div>

      {/* Footer Actions */}
      <div style={{
        padding: '16px 32px 24px',
        borderTop: '1px solid var(--bg-subtle)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      }}>
        {/* Prev */}
        <button
          {...hPrev}
          onClick={onPrev}
          disabled={!hasPrev}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '0', background: 'none', border: 'none',
            color: hasPrev ? (hPrev.hovered ? 'var(--text-secondary)' : 'var(--text-muted)') : 'var(--border-disabled)',
            fontSize: 14, fontWeight: 500, cursor: hasPrev ? 'pointer' : 'not-allowed',
            transition: 'color 150ms ease',
            textDecoration: hasPrev && hPrev.hovered ? 'underline' : 'none',
          }}>
          <ArrowLeft size={15} />
          Previous
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Clear */}
          <button
            {...hClear}
            onClick={onClear}
            disabled={!selectedOption}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              height: 48, padding: '0 20px', borderRadius: 14,
              border: `1px solid ${hClear.hovered && selectedOption ? 'var(--danger-primary)' : 'var(--border-default)'}`,
              backgroundColor: hClear.hovered && selectedOption ? 'var(--danger-bg)' : 'var(--bg-card)',
              color: !selectedOption ? 'var(--border-disabled)' : hClear.hovered ? 'var(--danger-primary)' : 'var(--text-secondary)',
              fontSize: 14, fontWeight: 500, cursor: selectedOption ? 'pointer' : 'not-allowed',
              transition: 'all 150ms ease',
            }}>
            <Trash2 size={15} />
            Clear
          </button>

          {/* Mark for Review */}
          <button
            {...hReview}
            onClick={onMarkReview}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              height: 48, padding: '0 20px', borderRadius: 14,
              border: `1px solid ${hReview.hovered ? 'var(--warning-primary)' : 'var(--border-default)'}`,
              backgroundColor: hReview.hovered ? 'var(--warning-bg-alt)' : 'var(--bg-card)',
              color: hReview.hovered ? 'var(--warning-text)' : 'var(--text-secondary)',
              fontSize: 14, fontWeight: 500, cursor: 'pointer',
              transition: 'all 150ms ease',
            }}>
            <Bookmark size={15} style={{ color: 'var(--warning-primary)' }} />
            Mark for Review & Next
          </button>

          {/* Save & Next */}
          <button
            {...hNext}
            onClick={onNext}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              height: 48, padding: '0 28px', borderRadius: 14, border: 'none',
              background: hNext.hovered
                ? 'linear-gradient(135deg, var(--accent-hover) 0%, var(--accent-darker) 100%)'
                : 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-gradient-end) 100%)',
              color: 'var(--bg-card)', fontSize: 15, fontWeight: 600,
              cursor: 'pointer',
              boxShadow: hNext.hovered
                ? '0 6px 20px var(--shadow-color-accent, rgba(91,92,235,0.45))'
                : '0 4px 12px var(--shadow-color-accent, rgba(91,92,235,0.35))',
              transform: hNext.hovered ? 'translateY(-2px)' : 'translateY(0)',
              transition: 'all 150ms ease',
              letterSpacing: '0.01em',
            }}>
            Save & Next
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Question Navigator Cell ──────────────────────────────────────────────────

function NavCell({ num, state, onClick }: {
  num: number; state: QState; onClick: () => void
}) {
  const { hovered, ...hoverProps } = useHover()

  const styleMap: Record<QState, { bg: string; color: string; border: string }> = {
    current:         { bg: 'var(--accent-primary)', color: 'var(--bg-card)', border: 'var(--accent-primary)' },
    answered:        { bg: 'var(--bg-card)', color: 'var(--text-primary)', border: 'var(--border-default)' },
    'answered-marked': { bg: 'var(--warning-bg-alt)', color: 'var(--warning-text-dark)', border: 'var(--warning-border)' },
    marked:          { bg: 'var(--warning-bg-alt)', color: 'var(--warning-text-dark)', border: 'var(--warning-border)' },
    'not-answered':  { bg: 'var(--danger-bg)', color: 'var(--danger-text-dark)', border: 'var(--danger-border-alt)' },
    'not-visited':   { bg: 'var(--bg-card)', color: 'var(--text-disabled)', border: 'var(--border-default)' },
  }

  const s = styleMap[state]
  const showGreenDot = state === 'answered' || state === 'answered-marked'

  return (
    <button
      onClick={onClick}
      {...hoverProps}
      style={{
        position: 'relative',
        width: 48, height: 48, borderRadius: 12,
        border: `1.5px solid ${s.border}`,
        backgroundColor: s.bg, color: s.color,
        fontSize: 13, fontWeight: 600,
        cursor: 'pointer',
        transform: state !== 'current' && hovered ? 'translateY(-1px)' : 'none',
        boxShadow: state === 'current'
          ? '0 4px 12px var(--shadow-color-accent, rgba(91,92,235,0.3))'
          : hovered
          ? '0 4px 10px var(--shadow-color-base, rgba(15,23,42,0.08))'
          : '0 1px 2px var(--shadow-color-base, rgba(15,23,42,0.04))',
        transition: 'all 150ms ease',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
      {String(num).padStart(2, '0')}
      {/* Green dot for answered */}
      {showGreenDot && (
        <div style={{
          position: 'absolute', top: 4, right: 4,
          width: 7, height: 7, borderRadius: '50%',
          backgroundColor: 'var(--success-primary)',
          border: '1.5px solid var(--bg-card)',
        }} />
      )}
    </button>
  )
}

// ─── Right Sidebar ────────────────────────────────────────────────────────────

function buildInitialStates(current: number): QState[] {
  const states: QState[] = []
  for (let i = 1; i <= TOTAL_QUESTIONS; i++) {
    if (i === current) states.push('current')
    else if (i < 13) states.push('answered')
    else if (i === 13) states.push('marked')
    else if (i === 17) states.push('not-answered')
    else if (i < current) states.push('answered')
    else states.push('not-visited')
  }
  return states
}

function RightSidebar({ currentQ, answers, marked, onSelect }: {
  currentQ: number
  answers: Record<number, string | null>
  marked: Record<number, boolean>
  onSelect: (n: number) => void
}) {
  const legend = [
    { color: 'var(--success-primary)', bg: 'var(--success-bg)', label: 'Answered' },
    { color: 'var(--danger-primary)', bg: 'var(--danger-bg-alt)', label: 'Not Answered' },
    { color: 'var(--accent-primary)', bg: 'var(--accent-primary)', label: 'Current' },
    { color: 'var(--warning-primary)', bg: 'var(--warning-bg)', label: 'Marked for Review' },
    { color: 'var(--border-disabled)', bg: 'var(--bg-subtle)', label: 'Not Visited' },
  ]

  function getState(n: number): QState {
    if (n === currentQ) return 'current'
    const isAnswered = !!answers[n]
    const isMarked = !!marked[n]
    if (isAnswered && isMarked) return 'answered-marked'
    if (isAnswered) return 'answered'
    if (isMarked) return 'marked'
    const base = buildInitialStates(currentQ)
    return base[n - 1] ?? 'not-visited'
  }

  const answeredCount = Array.from({ length: TOTAL_QUESTIONS }, (_, i) => i + 1)
    .filter((n) => getState(n) === 'answered' || getState(n) === 'answered-marked').length
  const markedCount = Array.from({ length: TOTAL_QUESTIONS }, (_, i) => i + 1)
    .filter((n) => getState(n) === 'marked' || getState(n) === 'answered-marked').length
  const notVisited = Array.from({ length: TOTAL_QUESTIONS }, (_, i) => i + 1)
    .filter((n) => getState(n) === 'not-visited').length

  return (
    <aside style={{
      width: 300, flexShrink: 0, backgroundColor: 'var(--bg-card)',
      borderRadius: 24, border: '1px solid var(--border-default)',
      boxShadow: '0 8px 30px var(--shadow-color-base, rgba(15,23,42,0.05))',
      display: 'flex', flexDirection: 'column',
      height: 'calc(100vh - 72px)', position: 'sticky', top: 72,
      overflow: 'hidden',
    }}>
      {/* Stats strip */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: '1px solid var(--bg-subtle)' }}>
        {[
          { label: 'Answered', value: answeredCount, color: 'var(--success-primary)' },
          { label: 'Flagged', value: markedCount, color: 'var(--warning-primary)' },
          { label: 'Pending', value: notVisited, color: 'var(--text-disabled)' },
        ].map((stat, i) => (
          <div key={stat.label} style={{
            padding: '14px 8px', textAlign: 'center',
            borderRight: i < 2 ? '1px solid var(--bg-subtle)' : 'none',
          }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: stat.color, lineHeight: 1 }}>{stat.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-disabled)', marginTop: 4 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 20px 12px',
      }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-disabled)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Questions
        </span>
        <button style={{
          width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border-default)',
          backgroundColor: 'var(--bg-card)', cursor: 'pointer', display: 'flex',
          alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)',
        }}>
          <Filter size={13} />
        </button>
      </div>

      {/* Grid */}
      <div style={{
        padding: '0 20px', overflowY: 'auto', flex: 1,
        display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8,
        alignContent: 'start', paddingBottom: 16,
      }}>
        {Array.from({ length: TOTAL_QUESTIONS }, (_, i) => i + 1).map((n) => (
          <NavCell key={n} num={n} state={getState(n)} onClick={() => onSelect(n)} />
        ))}
      </div>

      {/* Legend */}
      <div style={{
        borderTop: '1px solid var(--bg-subtle)', padding: '16px 20px 20px',
        backgroundColor: 'var(--bg-card-alt)',
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-disabled)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
          Legend
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {legend.map((item) => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 14, height: 14, borderRadius: 4,
                backgroundColor: item.bg,
                border: `1.5px solid ${item.color}`,
                flexShrink: 0,
              }} />
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────

export function ExamEnginePage() {
  const [timeLeft, setTimeLeft] = useState(8142)
  const [activeSection, setActiveSection] = useState('gs')
  const [questionIdx, setQuestionIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<number, string | null>>({})
  const [bookmarked, setBookmarked] = useState<Record<number, boolean>>({})
  const [markedForReview, setMarkedForReview] = useState<Record<number, boolean>>({})
  const [fadeIn, setFadeIn] = useState(true)
  const prevIdx = useRef(questionIdx)

  useEffect(() => {
    const id = setInterval(() => setTimeLeft((t) => Math.max(0, t - 1)), 1000)
    return () => clearInterval(id)
  }, [])

  function navigate(newIdx: number) {
    if (newIdx < 0 || newIdx >= QUESTIONS.length) return
    setFadeIn(false)
    setTimeout(() => {
      setQuestionIdx(newIdx)
      prevIdx.current = newIdx
      setFadeIn(true)
    }, 120)
  }

  const q = QUESTIONS[questionIdx]
  const qNum = questionIdx + 17 // simulate Q18 onwards
  const selected = answers[questionIdx] ?? null

  function handleAnswer(label: string) {
    setAnswers((prev) => ({ ...prev, [questionIdx]: label }))
  }
  function handleClear() {
    setAnswers((prev) => ({ ...prev, [questionIdx]: null }))
  }
  function handleBookmark() {
    setBookmarked((prev) => ({ ...prev, [questionIdx]: !prev[questionIdx] }))
  }
  function handleMarkReview() {
    setMarkedForReview((prev) => ({ ...prev, [questionIdx]: !prev[questionIdx] }))
    navigate(Math.min(QUESTIONS.length - 1, questionIdx + 1))
  }
  function handleNext() {
    navigate(Math.min(QUESTIONS.length - 1, questionIdx + 1))
  }
  function handlePrev() {
    navigate(Math.max(0, questionIdx - 1))
  }
  function handleNavSelect(n: number) {
    const targetIdx = n - 17
    if (targetIdx >= 0 && targetIdx < QUESTIONS.length) navigate(targetIdx)
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-page)', display: 'flex', flexDirection: 'column' }}>
      <Header timeLeft={timeLeft} />
      <main style={{
        flex: 1, display: 'flex', gap: 20, padding: '20px 28px',
        maxWidth: 1440, margin: '0 auto', width: '100%',
        boxSizing: 'border-box', alignItems: 'flex-start',
      }}>
        <LeftSidebar activeSection={activeSection} onSectionChange={setActiveSection} />
        <QuestionCard
          questionNum={qNum}
          totalQuestions={33}
          question={q}
          selectedOption={selected}
          bookmarked={bookmarked[questionIdx] ?? false}
          fadeIn={fadeIn}
          onOptionSelect={handleAnswer}
          onBookmark={handleBookmark}
          onClear={handleClear}
          onMarkReview={handleMarkReview}
          onNext={handleNext}
          onPrev={handlePrev}
          hasPrev={questionIdx > 0}
        />
        <RightSidebar
          currentQ={qNum}
          answers={Object.fromEntries(
            Object.entries(answers).map(([k, v]) => [Number(k) + 17, v])
          )}
          marked={Object.fromEntries(
            Object.entries(markedForReview).map(([k, v]) => [Number(k) + 17, v])
          )}
          onSelect={handleNavSelect}
        />
      </main>
    </div>
  )
}
