import { useState } from 'react';
import { ChevronDown, Lightbulb, X } from 'lucide-react';
import { QuestionOut } from '../../types/exam';
import { QuestionSolutionData, QuestionSolutionMarkdownCard } from './QuestionSolutionMarkdownCard';
import { getQuestionText, getOptionText } from './ExamQuestionCard';

interface RecommendedQuestionCardProps {
  question: QuestionOut;
  index: number;
  isExpanded: boolean;
  selectedOptionId?: number | string;
  onToggleExpand: () => void;
  onSelectOption: (optionId: number | string) => void;
  solution: QuestionSolutionData | null;
  isSolutionLoading: boolean;
  language?: string;
}

export function RecommendedQuestionCard({
  question: rec,
  index: idx,
  isExpanded,
  selectedOptionId: answeredOptId,
  onToggleExpand,
  onSelectOption,
  solution,
  isSolutionLoading,
  language,
}: RecommendedQuestionCardProps) {
  const selectedOption = (rec.options as any[])?.find((o: any) => o.option_id === answeredOptId);
  const [showSolutionModal, setShowSolutionModal] = useState(false);

  return (
    <>
      {/* Solution Modal Popup */}
      {showSolutionModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowSolutionModal(false); }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 640,
              maxHeight: '85vh',
              overflowY: 'auto',
              background: 'var(--bg-card)',
              border: '1px solid #E2E8F0',
              borderRadius: 8,
              padding: 24,
              boxShadow: '0 20px 48px rgba(15, 23, 42, 0.2)',
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ flex: 1, paddingRight: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                  <Lightbulb size={16} color="var(--primary-red)" />
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--deep-navy)' }}>Solution &amp; Explanation</span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.45, margin: 0 }}>
                  {(() => {
                    const displayQuestionText = getQuestionText(rec, language || 'en');
                    return displayQuestionText
                      ? displayQuestionText.length > 150
                        ? `${displayQuestionText.substring(0, 150)}...`
                        : displayQuestionText
                      : `Practice Question ${idx + 1}`;
                  })()}
                </p>
              </div>
              <button
                onClick={() => setShowSolutionModal(false)}
                style={{
                  background: 'transparent',
                  border: '1px solid #E2E8F0',
                  borderRadius: 6,
                  cursor: 'pointer',
                  padding: 6,
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
                title="Close"
              >
                <X size={16} />
              </button>
            </div>
            <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 16 }}>
              <QuestionSolutionMarkdownCard
                solution={solution ?? {}}
                isLoading={isSolutionLoading}
                isUserCorrect={selectedOption ? !!selectedOption.is_correct : undefined}
                selectedOptionLabel={selectedOption?.option_label}
              />
            </div>
          </div>
        </div>
      )}

      <div
        style={{
          backgroundColor: isExpanded ? 'var(--bg-card)' : 'var(--bg-subtle)',
          border: '1px solid',
          borderColor: isExpanded ? 'var(--border-color)' : 'var(--border-color)',
          borderRadius: 6,
          transition: 'all 0.15s ease',
          boxShadow: isExpanded ? '0 4px 12px rgba(15, 23, 42, 0.05)' : 'none',
          overflow: 'hidden',
        }}
      >
        <div
          onClick={onToggleExpand}
          style={{ cursor: 'pointer', padding: '10px 12px' }}
          onMouseEnter={(e) => {
            if (!isExpanded) {
              e.currentTarget.style.backgroundColor = 'var(--bg-card)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(15, 23, 42, 0.04)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isExpanded) {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.boxShadow = 'none';
            }
          }}
        >
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 4,
              marginBottom: 6,
            }}
          >
            <span
              style={{
                fontSize: 9.5,
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: 3,
                backgroundColor: 'var(--bg-hover)',
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
              }}
            >
              {rec.topic_name || rec.subject || rec.section_code || 'General Studies'}
            </span>
            {rec.subtopic_name && (
              <span
                style={{
                  fontSize: 9.5,
                  fontWeight: 600,
                  padding: '2px 6px',
                  borderRadius: 3,
                  backgroundColor: '#EEF2FF',
                  color: '#4338CA',
                }}
              >
                {rec.subtopic_name}
              </span>
            )}
            {(() => {
              const d = (rec.difficulty || 'MEDIUM').toUpperCase();
              const bg = d === 'EASY' ? '#ECFDF5' : d === 'HARD' ? '#FEF2F2' : '#FFFBEB';
              const text = d === 'EASY' ? '#047857' : d === 'HARD' ? '#B91C1C' : 'var(--status-warning)';
              const border = d === 'EASY' ? '#A7F3D0' : d === 'HARD' ? '#FECACA' : '#FDE68A';
              return (
                <span
                  style={{
                    fontSize: 9.5,
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 3,
                    backgroundColor: bg,
                    color: text,
                    border: `1px solid ${border}`,
                  }}
                >
                  {d}
                </span>
              );
            })()}
            <span
              style={{
                fontSize: 9.5,
                fontWeight: 600,
                padding: '2px 6px',
                borderRadius: 3,
                backgroundColor: 'var(--bg-subtle)',
                color: 'var(--text-muted)',
                border: '1px solid #E2E8F0',
              }}
            >
              ⏱️ {rec.expected_time_seconds || 60}s
            </span>
            {Boolean((rec as any).exam_name || (rec as any).source_year) && (
              <span
                style={{
                  fontSize: 9.5,
                  fontWeight: 600,
                  padding: '2px 6px',
                  borderRadius: 3,
                  backgroundColor: '#F3E8FF',
                  color: '#7E22CE',
                }}
              >
                {(rec as any).exam_name || 'UPSC'}{' '}
                {(rec as any).source_year ? `• ${(rec as any).source_year}` : ''}
              </span>
            )}
            <ChevronDown
              size={14}
              style={{
                marginLeft: 'auto',
                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: '0.2s',
                color: 'var(--text-disabled)',
              }}
            />
          </div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--deep-navy)',
              lineHeight: 1.35,
            }}
          >
            {(() => {
              const displayQuestionText = getQuestionText(rec, language || 'en');
              return displayQuestionText
                ? isExpanded
                  ? displayQuestionText
                  : displayQuestionText.length > 70
                    ? `${displayQuestionText.substring(0, 70)}...`
                    : displayQuestionText
                : `Practice Question ${idx + 1}`;
            })()}
          </div>
        </div>

        {/* Inline Options Dropdown */}
        {isExpanded && (
          <div style={{ padding: '0 12px 12px 12px', borderTop: '1px solid #F1F5F9' }}>
            <div
              style={{
                marginTop: 10,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              {(rec.options as any[])?.map((opt: any, optIdx: number) => {
                const isSelected = answeredOptId === opt.option_id;
                const isCorrect = opt.is_correct;
                const isWrongSelected = isSelected && !isCorrect;
                const showResult = !!answeredOptId;

                let borderStyle = isSelected ? '1px solid #94A3B8' : '1px solid #E2E8F0';
                let bgStyle = 'var(--bg-card)';

                if (showResult) {
                  if (isCorrect) {
                    borderStyle = '1px solid #3A8B53';
                    bgStyle = '#ECFDF5';
                  } else if (isWrongSelected) {
                    borderStyle = '1px solid #EF4444';
                    bgStyle = '#FEF2F2';
                  }
                }

                const optDisplayText = getOptionText(opt, language || 'en', optIdx, rec);

                return (
                  <button
                    key={opt.option_id}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!answeredOptId) {
                        onSelectOption(opt.option_id);
                      }
                    }}
                    style={{
                      textAlign: 'left',
                      padding: '8px 10px',
                      border: borderStyle,
                      backgroundColor: bgStyle,
                      borderRadius: 4,
                      fontSize: 11.5,
                      color: 'var(--text-secondary)',
                      cursor: answeredOptId ? 'default' : 'pointer',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 6,
                      width: '100%',
                    }}
                  >
                    <div
                      style={{
                        width: 14,
                        height: 14,
                        flexShrink: 0,
                        marginTop: 2,
                        borderRadius: '50%',
                        border: '1px solid #CBD5E1',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: isSelected ? 'var(--primary-red)' : '#FFF',
                      }}
                    >
                      {isSelected && (
                        <div
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            backgroundColor: '#FFF',
                          }}
                        />
                      )}
                    </div>
                    <span
                      style={{
                        fontWeight: 800,
                        color: showResult && isCorrect ? '#047857' : 'var(--text-secondary)',
                      }}
                    >
                      {opt.option_label}.
                    </span>
                    <span style={{ lineHeight: 1.35, flex: 1 }}>{optDisplayText}</span>
                  </button>
                );
              })}
            </div>

            {answeredOptId != null && (
              <div style={{ marginTop: 10 }}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSolutionModal(true);
                  }}
                  style={{
                    padding: '7px 14px',
                    borderRadius: 4,
                    border: '1px solid #CBD5E1',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-secondary)',
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Lightbulb size={13} color="var(--text-muted)" />
                  <span>View Explanation</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
