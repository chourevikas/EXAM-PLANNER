import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export interface AdminQuestionOption {
  option_id?: string | number;
  option_label: string;
  display_order?: number;
  is_correct: boolean;
  option_text: string;
  distractor_analysis?: string | null;
  why_tempting?: string | null;
  whats_actually_true?: string | null;
}

export interface AdminQuestionHierarchyItem {
  subject_name?: string;
  topic_name?: string;
  subtopic_name?: string;
  concept_name?: string;
  is_primary?: boolean;
  relevance_percentage?: number;
  relevance_weight?: number;
}

export interface AdminQuestionPublicationData {
  id?: string | number;
  question_number_in_paper?: number;
  question_number?: number;
  question_text: string;
  passage_text?: string | null;
  difficulty?: string;
  marks?: number;
  negative_marks?: number;
  subject_name?: string;
  topic_name?: string;
  subtopic_name?: string;
  concept_name?: string;
  hierarchy?: AdminQuestionHierarchyItem[];
  options: AdminQuestionOption[];
  explanation?: {
    detailed_solution?: string | null;
    core_concept?: string | null;
    common_traps?: string[];
    key_takeaways?: string[];
  } | null;
}

interface AdminQuestionPublicationCardProps {
  question: AdminQuestionPublicationData;
  questionNumber?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Normalizes option label (e.g. '(a)' -> 'A', 'b' -> 'B').
 */
function formatOptionKey(label?: string): string {
  if (!label) return '';
  const cleaned = label.trim().replace(/^[\(\[\s]+/, '').replace(/[\)\]\.\:\s]+$/, '').trim().toUpperCase();
  return cleaned || label.trim();
}

/**
 * Strips redundant leading option label prefixes from the option text.
 */
function cleanOptionText(text?: string, label?: string): string {
  if (!text) return '';
  let cleaned = text.trim();
  if (label) {
    const rawLabel = label.trim().replace(/^[\(\[\s]+/, '').replace(/[\)\]\.\:\s]+$/, '').trim();
    if (rawLabel) {
      const escaped = rawLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const prefixRegex = new RegExp(`^(?:\\(${escaped}\\)|\\b${escaped}[\\.\\):\\-]\\s*|\\(${escaped.toLowerCase()}\\)|\\b${escaped.toLowerCase()}[\\.\\):\\-]\\s*)`, 'i');
      cleaned = cleaned.replace(prefixRegex, '').trim();
    }
  }
  return cleaned || text;
}

/**
 * Parses solution markdown or multi-paragraph text into clean bullet points.
 */
function parseSolutionBullets(solutionText?: string | null): string[] {
  if (!solutionText || !solutionText.trim()) return [];

  const rawLines = solutionText.split(/\r?\n/);
  const bullets: string[] = [];
  let currentBullet = '';

  for (const line of rawLines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (currentBullet) {
        bullets.push(currentBullet.trim());
        currentBullet = '';
      }
      continue;
    }

    // Check if line starts with a bullet character (•, *, -, +, ■, etc.)
    const bulletMatch = trimmed.match(/^([•\*\-\+\▪\■\◦\●\·]|(?:\d+\.))\s+(.*)$/);
    if (bulletMatch) {
      if (currentBullet) {
        bullets.push(currentBullet.trim());
      }
      currentBullet = bulletMatch[2];
    } else {
      if (currentBullet) {
        currentBullet += ' ' + trimmed;
      } else {
        currentBullet = trimmed;
      }
    }
  }

  if (currentBullet) {
    bullets.push(currentBullet.trim());
  }

  return bullets.length > 0 ? bullets : [solutionText.trim()];
}

/**
 * Parses distractor analysis string into tempting and true components.
 */
function parseDistractorText(opt: AdminQuestionOption): { whyTempting: string; whatsTrue: string; rawText: string } {
  const directWhy = (opt.why_tempting || '').trim();
  const directTrue = (opt.whats_actually_true || '').trim();
  if (directWhy || directTrue) {
    return { whyTempting: directWhy, whatsTrue: directTrue, rawText: '' };
  }

  const raw = (opt.distractor_analysis || '').trim();
  if (!raw) {
    return { whyTempting: '', whatsTrue: '', rawText: '' };
  }

  // Check for "Why it seems tempting ... What's actually true ..." patterns
  const match = raw.match(
    /(?:Why\s+it\s+seems\s+tempting|Why\s+tempting)\s*[-–—:]\s*(.*?)(?=(?:What(?:'s|\s+is)\s+actually\s+true|What\s+is\s+true|Actually\s+true)\s*[-–—:]|$)/is
  );
  const matchTrue = raw.match(
    /(?:What(?:'s|\s+is)\s+actually\s+true|What\s+is\s+true|Actually\s+true)\s*[-–—:]\s*(.*)$/is
  );

  if (match && matchTrue) {
    return {
      whyTempting: match[1].trim(),
      whatsTrue: matchTrue[1].trim(),
      rawText: '',
    };
  }

  return { whyTempting: '', whatsTrue: '', rawText: raw };
}

export function AdminQuestionPublicationCard({
  question,
  questionNumber,
  className,
  style,
}: AdminQuestionPublicationCardProps) {
  const qNum = questionNumber ?? question.question_number_in_paper ?? question.question_number ?? 1;

  // Taxonomy resolution
  const primHier = question.hierarchy?.find((h) => h.is_primary) || question.hierarchy?.[0];
  const subject = question.subject_name || primHier?.subject_name || 'General Studies';
  const microtheme = question.topic_name || primHier?.topic_name || 'General Concepts';
  const nanoTheme =
    question.subtopic_name ||
    question.concept_name ||
    primHier?.concept_name ||
    primHier?.subtopic_name ||
    'Core Theme';

  // Format difficulty nicely (e.g. MODERATE -> Moderate)
  const rawDiff = question.difficulty || 'Moderate';
  const formattedDiff = rawDiff.charAt(0).toUpperCase() + rawDiff.slice(1).toLowerCase();

  // Find correct option
  const correctOption = question.options.find((opt) => opt.is_correct);
  const incorrectOptions = question.options.filter((opt) => !opt.is_correct);

  // Solution bullets
  const solutionBullets = parseSolutionBullets(question.explanation?.detailed_solution);

  // Check if any distractor analysis or reverse logic exists
  const hasAnyReverseLogic = incorrectOptions.some(
    (opt) =>
      Boolean(opt.why_tempting) ||
      Boolean(opt.whats_actually_true) ||
      Boolean(opt.distractor_analysis && opt.distractor_analysis.trim())
  );

  return (
    <div
      className={className}
      style={{
        backgroundColor: '#FFFFFF',
        fontFamily: "'Segoe UI', Roboto, -apple-system, BlinkMacSystemFont, 'Plus Jakarta Sans', sans-serif",
        color: '#111827',
        fontSize: '14.5px',
        lineHeight: 1.6,
        padding: '24px 28px',
        border: '1px solid #E5E7EB',
        borderRadius: 0,
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        ...style,
      }}
    >
      {/* 1. TOP HIGHLIGHT TAG BANNER (Authentic warm yellow background strip) */}
      <div
        style={{
          backgroundColor: '#FEF9C3',
          padding: '8px 14px',
          marginBottom: '18px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'baseline',
          gap: '8px 12px',
          fontSize: '14px',
          fontWeight: 700,
          border: '1px solid #FEF08A',
        }}
      >
        <span style={{ color: '#1E3A8A' }}>Q{qNum}.</span>

        <span style={{ color: '#9A3412' }}>
          [Subject: {subject}]
        </span>

        <span style={{ color: '#7E22CE' }}>
          [Microtheme: {microtheme}]
        </span>

        <span style={{ color: '#047857' }}>
          [Nano Theme: {nanoTheme}]
        </span>

        <span style={{ color: '#854D0E' }}>
          [Difficulty: {formattedDiff}]
        </span>
      </div>

      {/* 2. PASSAGE CONTEXT (If present) */}
      {question.passage_text && question.passage_text.trim() && (
        <div
          style={{
            backgroundColor: '#F8FAFC',
            borderLeft: '4px solid #94A3B8',
            padding: '12px 18px',
            marginBottom: '16px',
            fontSize: '14px',
            color: '#334155',
            lineHeight: 1.65,
            fontStyle: 'italic',
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#64748B', marginBottom: '4px', fontStyle: 'normal' }}>
            Reference Context / Passage
          </div>
          {question.passage_text}
        </div>
      )}

      {/* 3. QUESTION STEM */}
      <div
        style={{
          fontSize: '15.5px',
          fontWeight: 700,
          color: '#0F172A',
          lineHeight: 1.55,
          marginBottom: '14px',
        }}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {question.question_text}
        </ReactMarkdown>
      </div>

      {/* 4. OPTIONS LIST (Indented with bold labels) */}
      <div
        style={{
          paddingLeft: 'clamp(8px, 3vw, 28px)',
          marginBottom: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}
      >
        {question.options.map((opt) => (
          <div
            key={opt.option_label}
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: '10px',
              fontSize: '14.5px',
              color: '#0F172A',
            }}
          >
            <span
              style={{
                fontWeight: 700,
                minWidth: '28px',
                color: '#0F172A',
              }}
            >
              ({formatOptionKey(opt.option_label)})
            </span>
            <span style={{ flex: 1, fontWeight: 500 }}>
              {cleanOptionText(opt.option_text, opt.option_label) || '(Empty Option)'}
            </span>
          </div>
        ))}
      </div>

      {/* 5. ANSWER LINE (Bold Green) */}
      <div
        style={{
          fontSize: '15px',
          fontWeight: 700,
          color: '#15803D',
          marginBottom: '16px',
        }}
      >
        Answer: ({formatOptionKey(correctOption?.option_label) || '?'}) {cleanOptionText(correctOption?.option_text, correctOption?.option_label)}
      </div>

      {/* 6. SOLUTION SECTION */}
      <div style={{ marginBottom: '22px' }}>
        <div
          style={{
            fontSize: '15px',
            fontWeight: 700,
            color: '#1E3A8A',
            marginBottom: '10px',
          }}
        >
          Solution:
        </div>

        {solutionBullets.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {solutionBullets.map((bullet, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: '10px',
                  fontSize: '14px',
                  lineHeight: 1.65,
                  color: '#1E293B',
                }}
              >
                <span style={{ color: '#0F172A', fontWeight: 700, fontSize: '15px', userSelect: 'none' }}>•</span>
                <div style={{ flex: 1 }}>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({ node, ...props }) => <span {...props} />,
                      strong: ({ node, ...props }) => <strong style={{ fontWeight: 700, color: '#0F172A' }} {...props} />,
                    }}
                  >
                    {bullet}
                  </ReactMarkdown>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: '13.5px', fontStyle: 'italic', color: '#64748B' }}>
            No detailed solution recorded yet. Click &apos;Edit Question&apos; to add one.
          </div>
        )}
      </div>

      {/* 7. REVERSE LOGIC BOX (Light Blue Callout Box) */}
      <div
        style={{
          backgroundColor: '#EEF2FF',
          border: '1px solid #C7D2FE',
          padding: '18px 22px',
          borderRadius: 0,
        }}
      >
        <div
          style={{
            fontSize: '14.5px',
            fontWeight: 700,
            color: '#1E3A8A',
            marginBottom: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>■</span>
          <span>Reverse Logic Box — Why the other options are wrong</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {incorrectOptions.map((opt) => {
            const parsed = parseDistractorText(opt);
            const hasReasoning = Boolean(parsed.whyTempting || parsed.whatsTrue || parsed.rawText);

            return (
              <div
                key={opt.option_label}
                style={{
                  fontSize: '13.5px',
                  lineHeight: 1.65,
                  color: '#1E293B',
                }}
              >
                <span style={{ fontWeight: 700, color: '#0F172A' }}>
                  Option ({formatOptionKey(opt.option_label)}):{' '}
                </span>

                {parsed.whyTempting || parsed.whatsTrue ? (
                  <>
                    {parsed.whyTempting && (
                      <>
                        <span style={{ fontStyle: 'italic', color: '#1E293B' }}>Why it seems tempting</span>
                        {' — '}
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            p: ({ node, ...props }) => <span {...props} />,
                            strong: ({ node, ...props }) => <strong style={{ fontWeight: 700, color: '#0F172A' }} {...props} />,
                          }}
                        >
                          {parsed.whyTempting}
                        </ReactMarkdown>
                        {parsed.whatsTrue ? ' ' : ''}
                      </>
                    )}
                    {parsed.whatsTrue && (
                      <>
                        <span style={{ fontStyle: 'italic', color: '#1E293B' }}>What&apos;s actually true</span>
                        {' — '}
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            p: ({ node, ...props }) => <span {...props} />,
                            strong: ({ node, ...props }) => <strong style={{ fontWeight: 700, color: '#0F172A' }} {...props} />,
                          }}
                        >
                          {parsed.whatsTrue}
                        </ReactMarkdown>
                      </>
                    )}
                  </>
                ) : parsed.rawText ? (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({ node, ...props }) => <span {...props} />,
                      strong: ({ node, ...props }) => <strong style={{ fontWeight: 700, color: '#0F172A' }} {...props} />,
                    }}
                  >
                    {parsed.rawText}
                  </ReactMarkdown>
                ) : (
                  <span style={{ fontStyle: 'italic', color: '#94A3B8' }}>
                    No distractor analysis specified for this option. Click &apos;Edit Question&apos; to add one.
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
