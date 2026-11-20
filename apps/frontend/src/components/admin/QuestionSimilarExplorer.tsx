import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Layers,
  Award,
  BookOpen,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Filter,
} from 'lucide-react';
import { guardedFetch } from '../../utils/apiGuard';

interface QuestionOption {
  option_id?: string | number;
  option_label: string;
  option_text?: string;
  text?: string;
  is_correct?: boolean;
}

interface SimilarQuestionItem {
  question_id: number;
  tier: string;
  similarity_score?: number;
  match_reasons?: string[];
  raw_score?: number;
  question?: {
    question_id: number;
    question_text?: string;
    text?: string;
    exam_name?: string;
    source_year?: number;
    subject_name?: string;
    topic_name?: string;
    subtopic_name?: string;
    difficulty?: string;
    options?: QuestionOption[];
    explanation?: {
      core_concept?: string;
      detailed_solution?: string;
      reverse_logic?: string;
    };
  };
}

interface QuestionSimilarExplorerProps {
  questionId: number | string | null | undefined;
  className?: string;
  style?: React.CSSProperties;
}

export function QuestionSimilarExplorer({
  questionId,
  style,
}: QuestionSimilarExplorerProps) {
  const [loading, setLoading] = useState<boolean>(false);
  const [results, setResults] = useState<SimilarQuestionItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedQId, setExpandedQId] = useState<number | null>(null);
  const [otherYearsOnly, setOtherYearsOnly] = useState<boolean>(false);
  const [limit, setLimit] = useState<number>(5);
  const [showSolutionId, setShowSolutionId] = useState<number | null>(null);
  const [solutions, setSolutions] = useState<Record<number, any>>({});
  const [loadingSolution, setLoadingSolution] = useState<boolean>(false);

  const fetchSimilar = useCallback(async () => {
    if (!questionId) {
      setResults([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        limit: String(limit),
        include_question: 'true',
        other_years_only: String(otherYearsOnly),
      });
      const res = await guardedFetch(`/api/v1/questions/${questionId}/similar?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Failed to load similar questions: HTTP ${res.status}`);
      }
      const data = await res.json();
      setResults(data.results || []);
    } catch (err: any) {
      setError(err.message || 'Error fetching similar questions');
    } finally {
      setLoading(false);
    }
  }, [questionId, limit, otherYearsOnly]);

  useEffect(() => {
    fetchSimilar();
  }, [fetchSimilar]);

  const loadSolution = async (qId: number) => {
    if (solutions[qId]) {
      setShowSolutionId((prev) => (prev === qId ? null : qId));
      return;
    }
    setLoadingSolution(true);
    try {
      const res = await fetch(`/api/v1/questions/${qId}/solution`);
      if (res.ok) {
        const data = await res.json();
        setSolutions((prev) => ({ ...prev, [qId]: data }));
        setShowSolutionId(qId);
      }
    } catch (err) {
      console.warn('Failed to load solution for Q#', qId, err);
    } finally {
      setLoadingSolution(false);
    }
  };

  // Retrieval channels of the hybrid search (backend: HybridSimilarityService); weights are RRF defaults
  const CHANNEL_BADGES: Record<string, { label: string; bg: string; fg: string; border: string }> = {
    q_dense: { label: 'Q-Dense (30%)', bg: '#F3E8FF', fg: '#7E22CE', border: '#E9D5FF' },
    q_bm25: { label: 'Q-BM25 (25%)', bg: '#EFF6FF', fg: '#1D4ED8', border: '#BFDBFE' },
    expl_dense: { label: 'Solution-Dense (25%)', bg: '#ECFDF5', fg: '#047857', border: '#A7F3D0' },
    ans_bm25: { label: 'Ans-BM25 (10%)', bg: '#FFFBEB', fg: '#B45309', border: '#FDE68A' },
    ans_in_question_bm25: { label: 'Ans→Q-BM25 (10%)', bg: '#FFF1F2', fg: '#BE123C', border: '#FECDD3' },
  };

  const renderChannelBadge = (reason: string) => {
    const badge = CHANNEL_BADGES[reason.replace(/^Matched via\s+/, '').trim()];

    if (badge) {
      return (
        <span
          key={reason}
          style={{
            fontSize: 10,
            fontWeight: 700,
            padding: '2px 7px',
            borderRadius: 4,
            backgroundColor: badge.bg,
            color: badge.fg,
            border: `1px solid ${badge.border}`,
          }}
        >
          {badge.label}
        </span>
      );
    }
    return (
      <span
        key={reason}
        style={{
          fontSize: 10,
          fontWeight: 600,
          padding: '2px 6px',
          borderRadius: 4,
          backgroundColor: '#F1F5F9',
          color: '#475569',
        }}
      >
        {reason}
      </span>
    );
  };

  if (!questionId) return null;

  return (
    <div
      style={{
        marginTop: 20,
        backgroundColor: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: 8,
        padding: 18,
        boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
        ...style,
      }}
    >
      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          paddingBottom: 14,
          borderBottom: '1px solid #F1F5F9',
          marginBottom: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              backgroundColor: '#EFF6FF',
              color: '#2563EB',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Sparkles size={18} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>
                Similar Questions (4-Channel Hybrid AI Search)
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  backgroundColor: '#F1F5F9',
                  color: '#475569',
                  padding: '2px 8px',
                  borderRadius: 12,
                }}
              >
                {results.length} found
              </span>
            </div>
            <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 2 }}>
              Ranked via Gemini 3072 Dense + PostgreSQL Lexical tsvector + Jina v3.5 Reranker
            </div>
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Toggle other_years_only */}
          <button
            type="button"
            onClick={() => setOtherYearsOnly((prev) => !prev)}
            style={{
              padding: '5px 10px',
              fontSize: 11.5,
              fontWeight: 600,
              borderRadius: 5,
              border: '1px solid',
              borderColor: otherYearsOnly ? '#2563EB' : '#CBD5E1',
              backgroundColor: otherYearsOnly ? '#EFF6FF' : '#FFFFFF',
              color: otherYearsOnly ? '#1D4ED8' : '#475569',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
            }}
            title="Filter to show only questions from other years / other papers"
          >
            <Filter size={12} />
            {otherYearsOnly ? 'Other Years Only' : 'All Years'}
          </button>

          {/* Limit selector */}
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            style={{
              padding: '4px 8px',
              fontSize: 11.5,
              fontWeight: 600,
              borderRadius: 5,
              border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              color: '#334155',
              cursor: 'pointer',
            }}
          >
            <option value={3}>Top 3</option>
            <option value={5}>Top 5</option>
            <option value={10}>Top 10</option>
          </select>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={fetchSimilar}
            disabled={loading}
            style={{
              padding: '5px 12px',
              fontSize: 11.5,
              fontWeight: 600,
              borderRadius: 5,
              border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              color: '#334155',
              cursor: loading ? 'default' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Searching...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div
          style={{
            padding: '10px 14px',
            backgroundColor: '#FEF2F2',
            border: '1px solid #FCA5A5',
            borderRadius: 6,
            color: '#B91C1C',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 12,
          }}
        >
          <AlertCircle size={15} />
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && results.length === 0 && (
        <div style={{ padding: '30px 20px', textAlign: 'center', color: '#64748B', fontSize: 13 }}>
          <RefreshCw size={20} className="animate-spin" style={{ margin: '0 auto 8px', display: 'block' }} />
          Computing 4-channel vector search &amp; Jina reranking...
        </div>
      )}

      {/* Empty state */}
      {!loading && results.length === 0 && !error && (
        <div style={{ padding: '24px 16px', textAlign: 'center', color: '#64748B', fontSize: 13 }}>
          No similar questions found for Question #{questionId}. Ensure the question is vectorized in the database.
        </div>
      )}

      {/* Results List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {results.map((item, idx) => {
          const q = item.question;
          const isExpanded = expandedQId === item.question_id;
          const score = item.similarity_score ?? 75;
          const options = q?.options || [];

          return (
            <div
              key={item.question_id}
              style={{
                border: '1px solid #E2E8F0',
                borderRadius: 7,
                backgroundColor: isExpanded ? '#FFFFFF' : '#F8FAFC',
                padding: 14,
                transition: 'all 0.15s ease',
              }}
            >
              {/* Card top bar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 12,
                  marginBottom: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                  {/* Rank Badge */}
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      padding: '2px 7px',
                      borderRadius: 4,
                      backgroundColor: '#1E293B',
                      color: '#FFFFFF',
                    }}
                  >
                    #{idx + 1}
                  </span>

                  {/* Similarity Score Badge */}
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: 4,
                      backgroundColor: score >= 90 ? '#EFF6FF' : '#F0FDF4',
                      color: score >= 90 ? '#1D4ED8' : '#15803D',
                      border: `1px solid ${score >= 90 ? '#BFDBFE' : '#BBF7D0'}`,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    🎯 {score}% Match
                  </span>

                  {/* Channel Badges */}
                  {(item.match_reasons || []).map((r) => renderChannelBadge(r))}

                  {/* Exam & Year */}
                  {(q?.exam_name || q?.source_year) && (
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 600,
                        padding: '2px 6px',
                        borderRadius: 4,
                        backgroundColor: '#F3E8FF',
                        color: '#6B21A8',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                      }}
                    >
                      <Calendar size={11} />
                      {q?.exam_name || 'UPSC'} {q?.source_year ? `(${q.source_year})` : ''}
                    </span>
                  )}

                  {/* Subject / Topic */}
                  {q?.subject_name && (
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 600,
                        padding: '2px 6px',
                        borderRadius: 4,
                        backgroundColor: '#F1F5F9',
                        color: '#475569',
                      }}
                    >
                      {q.subject_name} {q.topic_name ? `• ${q.topic_name}` : ''}
                    </span>
                  )}
                </div>

                {/* Expand / Details Toggle */}
                <button
                  type="button"
                  onClick={() => setExpandedQId((prev) => (prev === item.question_id ? null : item.question_id))}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    color: '#64748B',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    fontSize: 11.5,
                    fontWeight: 600,
                  }}
                >
                  {isExpanded ? (
                    <>
                      Less <ChevronUp size={14} />
                    </>
                  ) : (
                    <>
                      Details <ChevronDown size={14} />
                    </>
                  )}
                </button>
              </div>

              {/* Question Text */}
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#1E293B',
                  lineHeight: 1.5,
                  marginBottom: 8,
                }}
              >
                {q?.question_text || q?.text || `Question #${item.question_id}`}
              </div>

              {/* Options list (visible when expanded or if 4 options) */}
              {options.length > 0 && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                    gap: 6,
                    marginTop: 8,
                  }}
                >
                  {options.map((opt) => {
                    const isCorrect = Boolean(opt.is_correct);
                    return (
                      <div
                        key={opt.option_label}
                        style={{
                          fontSize: 12,
                          padding: '6px 10px',
                          borderRadius: 5,
                          backgroundColor: isCorrect ? '#ECFDF5' : '#FFFFFF',
                          border: `1px solid ${isCorrect ? '#86EFAC' : '#E2E8F0'}`,
                          color: isCorrect ? '#166534' : '#334155',
                          fontWeight: isCorrect ? 700 : 400,
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 6,
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 800,
                            color: isCorrect ? '#15803D' : '#64748B',
                            minWidth: 16,
                          }}
                        >
                          ({opt.option_label})
                        </span>
                        <span>{opt.option_text || opt.text}</span>
                        {isCorrect && (
                          <CheckCircle2 size={13} color="#16A34A" style={{ marginLeft: 'auto', flexShrink: 0 }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Solution & Reverse Logic Section (When Expanded) */}
              {isExpanded && (
                <div
                  style={{
                    marginTop: 12,
                    paddingTop: 12,
                    borderTop: '1px dashed #CBD5E1',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => loadSolution(item.question_id)}
                    style={{
                      padding: '4px 10px',
                      fontSize: 11.5,
                      fontWeight: 600,
                      borderRadius: 4,
                      border: '1px solid #CBD5E1',
                      backgroundColor: '#FFFFFF',
                      color: '#2563EB',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                    }}
                  >
                    <BookOpen size={13} />
                    {showSolutionId === item.question_id ? 'Hide Solution' : 'View Full Solution & Reverse Logic'}
                  </button>

                  {showSolutionId === item.question_id && (
                    <div
                      style={{
                        marginTop: 10,
                        padding: 12,
                        backgroundColor: '#F8FAFC',
                        borderRadius: 6,
                        border: '1px solid #E2E8F0',
                        fontSize: 12,
                        lineHeight: 1.55,
                        color: '#334155',
                      }}
                    >
                      {loadingSolution ? (
                        <div>Loading solution...</div>
                      ) : (
                        <>
                          {solutions[item.question_id]?.core_concept && (
                            <div style={{ marginBottom: 8 }}>
                              <strong>Core Concept:</strong> {solutions[item.question_id].core_concept}
                            </div>
                          )}
                          {solutions[item.question_id]?.detailed_solution && (
                            <div style={{ marginBottom: 8, whiteSpace: 'pre-wrap' }}>
                              <strong>Detailed Solution:</strong>
                              <br />
                              {solutions[item.question_id].detailed_solution}
                            </div>
                          )}
                          {solutions[item.question_id]?.reverse_logic && (
                            <div style={{ marginTop: 8, padding: 8, backgroundColor: '#EFF6FF', borderRadius: 4 }}>
                              <strong style={{ color: '#1D4ED8' }}>Reverse Logic Analysis:</strong>
                              <div style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>
                                {solutions[item.question_id].reverse_logic}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

