import { ChevronDown } from 'lucide-react';
import { QuestionOut } from '../../types/exam';
import { QuestionSolutionData, QuestionSolutionMarkdownCard } from './QuestionSolutionMarkdownCard';

interface RecommendedQuestionCardProps {
  question: QuestionOut;
  index: number;
  isExpanded: boolean;
  selectedOptionId?: number | string;
  onToggleExpand: () => void;
  onSelectOption: (optionId: number | string) => void;
  solution: QuestionSolutionData | null;
  isSolutionLoading: boolean;
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
}: RecommendedQuestionCardProps) {
  const selectedOption = (rec.options as any[])?.find((o: any) => o.option_id === answeredOptId);

  return (
    <div
      style={{
        backgroundColor: isExpanded ? '#FFFFFF' : '#F8FAFC',
        border: '1px solid',
        borderColor: isExpanded ? '#CBD5E1' : '#E2E8F0',
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
            e.currentTarget.style.backgroundColor = '#FFFFFF';
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
              backgroundColor: '#F1F5F9',
              color: '#334155',
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
            const text = d === 'EASY' ? '#047857' : d === 'HARD' ? '#B91C1C' : '#B45309';
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
              backgroundColor: '#F8FAFC',
              color: '#64748B',
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
              color: '#94A3B8',
            }}
          />
        </div>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: '#172033',
            lineHeight: 1.35,
          }}
        >
          {rec.text
            ? isExpanded
              ? rec.text
              : rec.text.length > 70
                ? `${rec.text.substring(0, 70)}...`
                : rec.text
            : `Practice Question ${idx + 1}`}
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
            {(rec.options as any[])?.map((opt: any) => {
              const isSelected = answeredOptId === opt.option_id;
              const isCorrect = opt.is_correct;
              const isWrongSelected = isSelected && !isCorrect;
              const showResult = !!answeredOptId;

              let borderStyle = isSelected ? '1px solid #94A3B8' : '1px solid #E2E8F0';
              let bgStyle = '#FFFFFF';

              if (showResult) {
                if (isCorrect) {
                  borderStyle = '1px solid #3A8B53';
                  bgStyle = '#ECFDF5';
                } else if (isWrongSelected) {
                  borderStyle = '1px solid #EF4444';
                  bgStyle = '#FEF2F2';
                }
              }

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
                    color: '#334155',
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
                      backgroundColor: isSelected ? '#1E3A8A' : '#FFF',
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
                      color: showResult && isCorrect ? '#047857' : '#475569',
                    }}
                  >
                    {opt.option_label}.
                  </span>
                  <span style={{ lineHeight: 1.35, flex: 1 }}>{opt.text}</span>
                </button>
              );
            })}
          </div>

          {answeredOptId != null && (
            <div style={{ marginTop: 10 }}>
              <QuestionSolutionMarkdownCard
                solution={solution ?? {}}
                isLoading={isSolutionLoading}
                isUserCorrect={selectedOption ? !!selectedOption.is_correct : undefined}
                selectedOptionLabel={selectedOption?.option_label}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
