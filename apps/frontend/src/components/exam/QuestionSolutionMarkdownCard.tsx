import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  CheckCircle2,
  XCircle,
  Lightbulb,
  BookOpen,
  Target,
  AlertTriangle,
  Award,
  Loader2,
  BrainCircuit,
  Layers,
  FileCheck2,
  BookmarkCheck,
} from 'lucide-react';
import { formatEnum } from '../../utils/formatEnum';

export interface DistractorItem {
  option_id?: number | string;
  label?: string;
  text?: string;
  closeness_score?: number;
  is_correct?: boolean;
  classification?: string;
  distractor_analysis?: string;
}

export interface QuestionSolutionData {
  question_id?: number | string;
  question_number?: number;
  correct_option_id?: number | string;
  correct_option_label?: string;
  difficulty?: string;
  blooms_level?: string;
  cognitive_skill?: string;
  primary_concept_tag?: string;
  subject?: string;
  topic?: string;
  subtopic?: string;
  concepts?: Array<{
    subject?: string;
    topic?: string;
    subtopic?: string;
    concept_name?: string;
    relevance_weight?: number;
    is_primary?: boolean;
  }>;
  explanation?: {
    core_concept?: string;
    detailed_solution?: string;
    detailed_text?: string;
    text?: string;
    reverse_logic?: string;
    common_traps?: string[];
    traps?: string[];
    key_takeaways?: string[];
    key_takeaway?: string;
    points_to_remember?: string[];
  };
  distractor_scores?: Record<string, DistractorItem> | DistractorItem[];
  presigned_url?: string;
  source?: string;
}

interface QuestionSolutionMarkdownCardProps {
  isUserCorrect?: boolean;
  selectedOptionLabel?: string;
  solution: QuestionSolutionData;
  isLoading?: boolean;
  options?: Array<{
    option_id?: number | string;
    id?: number | string;
    label?: string;
    option_label?: string;
    text?: string;
    option_text?: string;
    is_correct?: boolean;
    distractor_analysis?: string;
    analysis?: string;
    closeness_score?: number;
    classification?: string;
  }>;
}

function extractOptionAnalysisFromText(text: string, label: string): string | null {
  if (!text) return null;
  const cleanLabel = label.replace(/[\(\)\.\s]/g, '').toUpperCase();
  const patterns = [
    new RegExp(`(?:Option\\s*\\(?${cleanLabel}\\)?|\\(?${cleanLabel}\\)|\\*\\*Option\\s*\\(?${cleanLabel}\\)?\\*\\*)\\s*[:\\-\\—–]\\s*([^\\n]+(?:\\n(?!\\s*(?:Option\\s*\\(?[A-D]\\)?|\\(?[A-D]\\)|\\*\\*Option|Statement\\s*\\d|\\d+\\.))[^\\n]+)*)`, 'i'),
    new RegExp(`(?:Option\\s*\\(?${cleanLabel}\\)?|\\(?${cleanLabel}\\))\\s+(is\\s+[^\\n]+(?:\\n(?!\\s*(?:Option\\s*\\(?[A-D]\\)?|\\(?[A-D]\\)))[^\\n]+)*)`, 'i'),
    new RegExp(`(?:Statement|Pair)\\s*${cleanLabel === 'A' ? '1' : cleanLabel === 'B' ? '2' : cleanLabel === 'C' ? '3' : '4'}\\s*[:\\-\\—–]\\s*([^\\n]+(?:\\n(?!\\s*(?:Statement|Pair|Option|\\(?[A-D]\\)))[^\\n]+)*)`, 'i'),
  ];

  for (const regex of patterns) {
    const match = text.match(regex);
    if (match && match[1] && match[1].trim().length > 10) {
      return match[1].trim();
    }
  }
  return null;
}

export function QuestionSolutionMarkdownCard({
  isUserCorrect,
  selectedOptionLabel,
  solution,
  isLoading = false,
  options = [],
}: QuestionSolutionMarkdownCardProps) {
  if (isLoading) {
    return (
      <div
        style={{
          marginTop: 20,
          padding: '24px',
          borderRadius: 0,
          backgroundColor: '#F8FAFC',
          border: '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          color: '#64748B',
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}
      >
        <Loader2 size={18} className="animate-spin text-blue-600" />
        <span style={{ fontSize: 14, fontWeight: 600 }}>Loading Comprehensive Solution & Distractor Analysis...</span>
      </div>
    );
  }

  const correctLabel = (solution.correct_option_label || 'A').replace(/[\(\)\.\s]/g, '').toUpperCase();
  const difficulty = solution.difficulty || 'MEDIUM';

  const explObj = typeof solution.explanation === 'object' && solution.explanation !== null ? solution.explanation : null;
  const detailedMarkdown =
    explObj?.detailed_solution ||
    explObj?.detailed_text ||
    explObj?.text ||
    (typeof solution.explanation === 'string' ? solution.explanation : 'Detailed explanation is available.');

  // Extract all takeaways and points to remember safely
  const keyTakeaways: string[] = Array.isArray(explObj?.key_takeaways)
    ? explObj.key_takeaways
    : Array.isArray(explObj?.points_to_remember)
    ? explObj.points_to_remember
    : explObj?.key_takeaway
    ? [explObj.key_takeaway]
    : [];

  // Combined option-by-option reasoning, written by the admin as one block.
  // Falls back to the per-option distractor list below only when a question
  // hasn't been re-saved through the new Reverse Logic Box yet.
  const reverseLogic = (explObj?.reverse_logic || '').trim();

  // Extract common traps
  const commonTraps: string[] = Array.isArray(explObj?.common_traps)
    ? explObj.common_traps
    : Array.isArray(explObj?.traps)
    ? explObj.traps
    : [];

  // Normalize distractors into an array
  let rawDistractors: DistractorItem[] = Array.isArray(solution.distractor_scores)
    ? solution.distractor_scores
    : solution.distractor_scores && typeof solution.distractor_scores === 'object'
    ? Object.values(solution.distractor_scores)
    : [];

  // If distractor_scores was empty or missing items, build from options prop
  if (rawDistractors.length === 0 && options && options.length > 0) {
    rawDistractors = options.map((opt, idx) => ({
      option_id: opt.option_id || opt.id,
      label: opt.option_label || opt.label || String.fromCharCode(65 + idx),
      text: opt.text || opt.option_text,
      is_correct: opt.is_correct,
      closeness_score: opt.closeness_score ?? (opt.is_correct ? 1.0 : 0.0),
      classification: opt.classification || (opt.is_correct ? 'Correct Key' : 'Distractor'),
      distractor_analysis: opt.distractor_analysis || opt.analysis || '',
    }));
  }

  // Enrich each distractor item with matching option data & extracted analysis
  const distractorsList: DistractorItem[] = rawDistractors.map((item, idx) => {
    const itemLabel = (item.label || String.fromCharCode(65 + idx)).replace(/[\(\)\.\s]/g, '').toUpperCase();
    const matchedOpt = (options || []).find((opt, oIdx) => {
      const optId = String(opt.option_id ?? opt.id ?? '');
      const oLbl = (opt.option_label || opt.label || String.fromCharCode(65 + oIdx)).replace(/[\(\)\.\s]/g, '').toUpperCase();
      return (item.option_id && optId && optId === String(item.option_id)) || oLbl === itemLabel;
    });

    const isOptionCorrect = Boolean(
      item.is_correct ||
      matchedOpt?.is_correct ||
      itemLabel === correctLabel
    );
    const optText = item.text || matchedOpt?.text || matchedOpt?.option_text || '';

    let analysis = item.distractor_analysis || (item as any).analysis || matchedOpt?.distractor_analysis || (matchedOpt as any)?.analysis || '';

    // If analysis is still missing, try extracting from detailed markdown
    if (!analysis && detailedMarkdown) {
      const extracted = extractOptionAnalysisFromText(detailedMarkdown, itemLabel);
      if (extracted) {
        analysis = extracted;
      }
    }

    // Contextual fallback if still empty — use actual option text to make it meaningful
    if (!analysis) {
      if (isOptionCorrect) {
        analysis = explObj?.core_concept
          ? `✓ This is the correct answer. ${explObj.core_concept}`
          : optText
          ? `✓ "${optText}" — This is the correct answer.`
          : `✓ This option is correct.`;
      } else {
        const trapHint = commonTraps.length > 0 ? ` Common trap: ${commonTraps[0]}` : '';
        analysis = optText
          ? `✗ "${optText}" — This option is incorrect.${trapHint}`
          : `✗ This option is incorrect.${trapHint}`;
      }
    }

    return {
      ...item,
      label: itemLabel,
      text: optText,
      is_correct: isOptionCorrect,
      distractor_analysis: analysis,
      classification: isOptionCorrect
        ? 'Correct Key'
        : item.classification || `Distractor (${item.closeness_score ?? 0})`,
    };
  });

  return (
    <div
      style={{
        marginTop: 20,
        borderRadius: 0,
        border: '1px solid #E2E8F0',
        backgroundColor: '#FFFFFF',
        boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.06)',
        overflow: 'visible',
        fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {/* Header Banner with Accuracy & Badges */}
      <div
        style={{
          padding: '16px 20px',
          backgroundColor: isUserCorrect ? '#F0FDF4' : isUserCorrect === false ? '#FEF2F2' : '#F8FAFC',
          borderBottom: `1px solid ${isUserCorrect ? '#DCFCE7' : isUserCorrect === false ? '#FEE2E2' : '#E2E8F0'}`,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isUserCorrect === true ? (
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 0,
                backgroundColor: '#DCFCE7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#16A34A',
              }}
            >
              <CheckCircle2 size={20} />
            </div>
          ) : isUserCorrect === false ? (
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 0,
                backgroundColor: '#FEE2E2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#DC2626',
              }}
            >
              <XCircle size={20} />
            </div>
          ) : (
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 0,
                backgroundColor: '#E0E7FF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#4F46E5',
              }}
            >
              <Lightbulb size={20} />
            </div>
          )}

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: isUserCorrect ? '#15803D' : isUserCorrect === false ? '#B91C1C' : 'var(--deep-navy)',
                }}
              >
                Option ({correctLabel}) is Correct
              </span>
              {selectedOptionLabel && selectedOptionLabel !== correctLabel && (
                <span style={{ fontSize: 13, fontWeight: 600, color: '#DC2626' }}>
                  (Your selection: Option {selectedOptionLabel})
                </span>
              )}
            </div>
            <span style={{ fontSize: 12, color: '#64748B' }}>
              Comprehensive Solution & Distractor Evaluation
            </span>
          </div>
        </div>

        {/* Cognitive & Taxonomy Badges */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
          <span
            style={{
              padding: '4px 10px',
              borderRadius: 0,
              fontSize: 11,
              fontWeight: 700,
              backgroundColor:
                difficulty === 'EASY' ? '#ECFDF5' : difficulty === 'HARD' ? '#FEF2F2' : '#FFFBEB',
              color:
                difficulty === 'EASY' ? '#3A8B53' : difficulty === 'HARD' ? '#DC2626' : '#F2B623',
              border: `1px solid ${
                difficulty === 'EASY' ? '#A7F3D0' : difficulty === 'HARD' ? '#FECACA' : '#FDE68A'
              }`,
            }}
          >
            {formatEnum(difficulty)} Tier
          </span>
          {solution.topic && (
            <span
              style={{
                padding: '4px 10px',
                borderRadius: 0,
                fontSize: 11,
                fontWeight: 600,
                backgroundColor: '#F1F5F9',
                color: '#475569',
                border: '1px solid #E2E8F0',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Layers size={12} />
              {formatEnum(solution.topic)}
            </span>
          )}
        </div>
      </div>

      {/* Main Solution Body - Unified Comprehensive Sections */}
      <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Section 2: Detailed Explanation & Reference (Markdown + Option Breakdown, unified) */}
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 14,
              fontWeight: 700,
              color: 'var(--deep-navy)',
              marginBottom: 10,
            }}
          >
            <BookOpen size={16} style={{ color: 'var(--primary-red)' }} />
            Detailed Explanation & Reference
          </div>
          <div
            style={{
              borderRadius: 0,
              border: '1px solid #F1F5F9',
              backgroundColor: '#FAFAFA',
              overflow: 'hidden',
            }}
          >
            <div
              className="prose prose-slate max-w-none text-slate-800"
              style={{
                fontSize: 14,
                lineHeight: 1.7,
                color: 'var(--deep-navy)',
                padding: '16px 18px',
              }}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {detailedMarkdown}
              </ReactMarkdown>
            </div>

            {reverseLogic ? (
              <div
                style={{
                  borderTop: '1px solid #E2E8F0',
                  padding: '4px 18px 16px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#64748B',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    padding: '10px 0 8px',
                  }}
                >
                  <Target size={13} style={{ color: 'var(--primary-red)' }} />
                  Option-by-Option Reasoning
                </div>
                <div className="prose prose-slate max-w-none text-slate-800" style={{ fontSize: 13.5, lineHeight: 1.6, color: '#334155' }}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{reverseLogic}</ReactMarkdown>
                </div>
              </div>
            ) : distractorsList.length > 0 && (
              <div
                style={{
                  borderTop: '1px solid #E2E8F0',
                  padding: '4px 18px 6px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#64748B',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    padding: '10px 0 8px',
                  }}
                >
                  <Target size={13} style={{ color: 'var(--primary-red)' }} />
                  Option-by-Option Analysis
                </div>
                {distractorsList.map((item, idx) => {
                  const isOptionCorrect = item.is_correct || item.label === correctLabel;
                  return (
                    <div
                      key={idx}
                      style={{
                        padding: '10px 0',
                        borderTop: idx === 0 ? 'none' : '1px solid #F1F5F9',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: 4,
                          gap: 8,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 13.5,
                            fontWeight: 700,
                            color: isOptionCorrect ? '#16A34A' : '#334155',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          {isOptionCorrect ? (
                            <CheckCircle2 size={16} style={{ color: '#16A34A' }} />
                          ) : (
                            <span
                              style={{
                                width: 20,
                                height: 20,
                                borderRadius: 0,
                                backgroundColor: '#E2E8F0',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 11,
                                fontWeight: 700,
                                color: '#475569',
                              }}
                            >
                              {item.label || String.fromCharCode(65 + idx)}
                            </span>
                          )}
                          Option ({item.label || String.fromCharCode(65 + idx)})
                          {item.text && (
                            <span style={{ fontWeight: 500, color: '#475569' }}>
                              — {item.text}
                            </span>
                          )}
                        </span>

                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 0,
                            backgroundColor: isOptionCorrect ? '#DCFCE7' : '#F1F5F9',
                            color: isOptionCorrect ? '#15803D' : '#64748B',
                            flexShrink: 0,
                          }}
                        >
                          {isOptionCorrect
                            ? 'Correct Key'
                            : item.classification || `Distractor (${item.closeness_score ?? 0})`}
                        </span>
                      </div>

                      {item.distractor_analysis ? (
                        <p style={{ margin: 0, fontSize: 13, color: '#334155', lineHeight: 1.5 }}>
                          {item.distractor_analysis}
                        </p>
                      ) : (
                        <p style={{ margin: 0, fontSize: 13, color: '#64748B', fontStyle: 'italic' }}>
                          {isOptionCorrect
                            ? item.text ? `✓ "${item.text}" — This is the correct answer.` : '✓ This option is correct.'
                            : item.text ? `✗ "${item.text}" — This option is incorrect.` : '✗ This option is incorrect.'}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Section 4: Common Traps to Avoid */}
        {commonTraps.length > 0 && (
          <div
            style={{
              padding: '16px 18px',
              borderRadius: 0,
              backgroundColor: '#FFFBEB',
              border: '1px solid #FDE68A',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 14,
                fontWeight: 700,
                color: '#92400E',
                marginBottom: 8,
              }}
            >
              <AlertTriangle size={17} style={{ color: '#F2B623' }} />
              Common Exam Traps & Pitfalls
            </div>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13.5, color: '#78350F', lineHeight: 1.6 }}>
              {commonTraps.map((trap, idx) => (
                <li key={idx} style={{ marginBottom: 4 }}>
                  {trap}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div
        style={{
          padding: '12px 20px',
          backgroundColor: '#F8FAFC',
          borderTop: '1px solid #F1F5F9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 12,
          color: '#94A3B8',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <FileCheck2 size={14} />
          Cognitive Skill: {solution.cognitive_skill || 'Analytical & Conceptual Reasoning'}
        </span>
      </div>
    </div>
  );
}
