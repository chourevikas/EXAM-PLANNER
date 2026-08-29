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
  Sparkles,
  BrainCircuit,
  Layers,
  FileCheck2,
  BookmarkCheck,
  ExternalLink,
} from 'lucide-react';

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
}

export function QuestionSolutionMarkdownCard({
  isUserCorrect,
  selectedOptionLabel,
  solution,
  isLoading = false,
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
        <Sparkles size={18} className="animate-spin text-blue-600" />
        <span style={{ fontSize: 14, fontWeight: 600 }}>Loading Comprehensive Solution & Distractor Analysis...</span>
      </div>
    );
  }

  const correctLabel = solution.correct_option_label || 'A';
  const bloomsLevel = solution.blooms_level || 'ANALYZE';
  const difficulty = solution.difficulty || 'MEDIUM';

  const explObj = typeof solution.explanation === 'object' && solution.explanation !== null ? solution.explanation : null;
  const coreConcept = explObj?.core_concept;
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

  // Extract common traps
  const commonTraps: string[] = Array.isArray(explObj?.common_traps)
    ? explObj.common_traps
    : Array.isArray(explObj?.traps)
    ? explObj.traps
    : [];

  // Normalize distractors into an array
  const distractorsList: DistractorItem[] = Array.isArray(solution.distractor_scores)
    ? solution.distractor_scores
    : solution.distractor_scores && typeof solution.distractor_scores === 'object'
    ? Object.values(solution.distractor_scores)
    : [];

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
                  color: isUserCorrect ? '#15803D' : isUserCorrect === false ? '#B91C1C' : '#172033',
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
              backgroundColor: '#F8FAFC',
              color: '#E31B23',
              border: '1px solid #BFDBFE',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <BrainCircuit size={12} />
            Bloom's: {bloomsLevel}
          </span>
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
            {difficulty} Tier
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
              {solution.topic}
            </span>
          )}
        </div>
      </div>

      {/* Main Solution Body - Unified Comprehensive Sections */}
      <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Section 1: Core Concept Callout */}
        {coreConcept && (
          <div
            style={{
              padding: '14px 18px',
              borderRadius: 0,
              backgroundColor: '#F8FAFC',
              border: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
            }}
          >
            <Lightbulb size={20} style={{ color: '#E31B23', flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong style={{ fontSize: 13, color: '#A4161A', display: 'block', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Core Conceptual Principle:
              </strong>
              <span style={{ fontSize: 13.5, color: '#1E3A8A', lineHeight: 1.55 }}>{coreConcept}</span>
            </div>
          </div>
        )}

        {/* Section 2: Step-by-Step Detailed Solution (Markdown) */}
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 14,
              fontWeight: 700,
              color: '#172033',
              marginBottom: 10,
            }}
          >
            <BookOpen size={16} style={{ color: '#E31B23' }} />
            Detailed Explanation & Reference
          </div>
          <div
            className="prose prose-slate max-w-none text-slate-800"
            style={{
              fontSize: 14,
              lineHeight: 1.7,
              color: '#172033',
              backgroundColor: '#FAFAFA',
              padding: '16px 18px',
              borderRadius: 0,
              border: '1px solid #F1F5F9',
            }}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {detailedMarkdown}
            </ReactMarkdown>
          </div>
        </div>

        {/* Section 3: Option-by-Option Distractor Analysis */}
        {distractorsList.length > 0 && (
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 14,
                fontWeight: 700,
                color: '#172033',
                marginBottom: 10,
              }}
            >
              <Target size={16} style={{ color: '#E31B23' }} />
              Option & Distractor Breakdown ({distractorsList.length} Options)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {distractorsList.map((item, idx) => {
                const isOptionCorrect = item.is_correct || item.label === correctLabel;
                return (
                  <div
                    key={idx}
                    style={{
                      padding: '12px 16px',
                      borderRadius: 0,
                      backgroundColor: isOptionCorrect ? '#F0FDF4' : '#F8FAFC',
                      border: `1px solid ${isOptionCorrect ? '#BBF7D0' : '#E2E8F0'}`,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 6,
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
                          ? 'Correctly reflects standard constitutional provisions and syllabus references.'
                          : 'Incorrect option formulated as a plausible distractor based on standard conceptual traps.'}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Section 4: Key Takeaways & Points to Remember */}
        {keyTakeaways.length > 0 && (
          <div
            style={{
              padding: '16px 18px',
              borderRadius: 0,
              backgroundColor: '#F0F9FF',
              border: '1px solid #BAE6FD',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 14,
                fontWeight: 700,
                color: '#0369A1',
                marginBottom: 8,
              }}
            >
              <Award size={17} style={{ color: '#0284C7' }} />
              Key Takeaways & Points to Remember
            </div>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13.5, color: '#0C4A6E', lineHeight: 1.6 }}>
              {keyTakeaways.map((takeaway, idx) => (
                <li key={idx} style={{ marginBottom: 4 }}>
                  {takeaway}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Section 5: Common Traps to Avoid */}
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
        {solution.presigned_url ? (
          <a
            href={solution.presigned_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#E31B23',
              fontSize: 11,
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              textDecoration: 'none',
            }}
          >
            <ExternalLink size={12} />
            S3 Verified JSON Artifact
          </a>
        ) : (
          <span>Verified Solution Artifact</span>
        )}
      </div>
    </div>
  );
}
