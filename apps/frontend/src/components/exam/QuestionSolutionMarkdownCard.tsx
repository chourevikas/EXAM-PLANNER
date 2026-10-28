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
import { useExamText, ExamTextKey } from '../../i18n/examText';

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
  question_type_tag?: string;
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

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractOptionAnalysisFromText(text: string, label: string): string | null {
  if (!text || !label) return null;
  try {
    const cleanLabel = label.replace(/[\(\)\.\s]/g, '').toUpperCase();
    const labelMap: Record<string, string> = {
      A: '(?:A|ए|अ)',
      B: '(?:B|बी|ब)',
      C: '(?:C|सी|स)',
      D: '(?:D|डी|द)',
    };
    const lblRe = labelMap[cleanLabel] || escapeRegExp(cleanLabel);
    const allRe = '(?:[A-D]|ए|बी|सी|डी|अ|ब|स|द)';

    // 1. Look for explicit Option (X) block, stopping before any next Option (Y) or end of string
    const optRegex = new RegExp(
      `(?:(?:^|\\n|\\s|\\.|—|–|-)(?:(?:Option|विकल्प|पर्याय)\\s*\\(?${lblRe}\\)?|\\(${lblRe}\\)|\\*\\*(?:Option|विकल्प|पर्याय)\\s*\\(?${lblRe}\\)?\\*\\*)\\s*[:\\-\\—–]?\\s*)([\\s\\S]*?)(?=(?:(?:^|\\n|\\s{2,}|\\.\\s+|—\\s*|–\\s*|;\\s*)(?:(?:Option|विकल्प|पर्याय)\\s*\\(?${allRe}\\)?|\\(${allRe}\\)\\s*[:\\-\\—–]|\\*\\*(?:Option|विकल्प|पर्याय)\\s*\\(?${allRe}\\)?\\*\\*))|$)`,
      'i'
    );
    const match = text.match(optRegex);
    if (match && match[1] && match[1].trim().length > 10) {
      let val = match[1].trim();
      val = val.replace(new RegExp(`^(?:(?:Option|विकल्प|पर्याय)\\s*\\(?${lblRe}\\)?|\\(?${lblRe}\\)|\\*\\*(?:Option|विकल्प|पर्याय)\\s*\\(?${lblRe}\\)?\\*\\*)\\s*[:\\-\\—–]?\\s*`, 'i'), '').trim();
      return val;
    }

    // 2. Statement or Pair 1/2/3/4
    const numLabel = cleanLabel === 'A' ? '1' : cleanLabel === 'B' ? '2' : cleanLabel === 'C' ? '3' : '4';
    const stmtRegex = new RegExp(
      `(?:Statement|Pair)\\s*${numLabel}\\s*[:\\-\\—–]\\s*([\\s\\S]*?)(?=(?:(?:^|\\n|\\s{2,}|\\.\\s*)(?:Statement|Pair|Option|\\(?[A-D]\\))|$))`,
      'i'
    );
    const stmtMatch = text.match(stmtRegex);
    if (stmtMatch && stmtMatch[1] && stmtMatch[1].trim().length > 10) {
      return stmtMatch[1].trim();
    }

    return null;
  } catch (err) {
    console.warn('extractOptionAnalysisFromText failed:', err);
    return null;
  }
}

/**
 * Cleans an option's individual analysis/summary text so it doesn't leak or duplicate
 * other options' descriptions (e.g. Reverse Logic Box or subsequent Option B/C/D breakdowns).
 */
export function cleanOptionAnalysisText(text: string, isCorrect: boolean, currentLabel?: string): string {
  if (!text) return '';
  try {
    let cleaned = text.trim();

    // 1. For the correct option: cut off at Reverse Logic Box header or "Why the other options are wrong"
    // so it does NOT duplicate the other options' reasoning. (Distractors keep their tempting/true text).
    if (isCorrect) {
      const rlMatch = cleaned.search(/(?:[◆■•·*#-]*\s*(?:Reverse\s+Logic(?:\s+Box)?|Why\s+(?:the\s+)?other\s+options\s+are\s+wrong|Why\s+other\s+options\s+are\s+incorrect|Incorrect\s+options?|Other\s+options?|Distractor\s+analysis|रिवर्स\s+लॉजिक|रिव्हर्स\s+लॉजिक)|\b(?:Option|विकल्प|पर्याय)\s*\(?(?:[B-D]|बी|सी|डी|ब|स|द)\)?\s*[:\-\—–])/i);
      if (rlMatch !== -1) {
        cleaned = cleaned.slice(0, rlMatch).trim();
      }
    }

    // 2. Cut off before any subsequent/other option breakdowns (e.g. "Option (C):" when inside Option B)
    const curr = (currentLabel || '').replace(/[\(\)\.\s]/g, '').toUpperCase();
    const otherOptPattern = /(?:^|\n|\s{2,}|\.\s+|;\s*|—\s*|–\s*)(?:(?:Option|विकल्प|पर्याय)\s*\(?([A-D]|ए|बी|सी|डी|अ|ब|स|द)\)?|\(([A-D]|ए|बी|सी|डी|अ|ब|स|द)\))\s*[:\-\—–]/gi;
    let match: RegExpExecArray | null;
    while ((match = otherOptPattern.exec(cleaned)) !== null) {
      const matchedLetter = (match[1] || match[2] || '').toUpperCase();
      if (matchedLetter && matchedLetter !== curr) {
        if (match.index > 10) {
          cleaned = cleaned.slice(0, match.index).trim();
          break;
        }
      }
    }

    // 3. Remove leading Option (X): or (X) prefix, or "Option (X) is correct." prefix
    if (curr) {
      const escapedCurr = escapeRegExp(curr);
      cleaned = cleaned.replace(new RegExp(`^(?:\\*\\*)?(?:(?:Option|विकल्प|पर्याय)\\s*\\(?${escapedCurr}\\)?|\\(?${escapedCurr}\\))(?:\\s+is\\s+correct\\.?)?(?:\\*\\*)?\\s*[:\\-\\—–]?\\s*`, 'i'), '').trim();
      cleaned = cleaned.replace(/^(?:is\\s+correct\\.?|सही\\s+उत्तर\\s+है\\.?)(?:\\*\\*)?\\s*/i, '').trim();
    }

    // 4. Remove leading bullets, icons, dashes
    cleaned = cleaned.replace(/^[\s✓✔✗✘×•·*\-–—:]+/, '').trim();

    return cleaned;
  } catch (err) {
    console.warn('cleanOptionAnalysisText error:', err);
    return text;
  }
}

// A block that markdown must keep separate: heading, list item, table, quote, code fence or rule.
const STRUCTURAL_BLOCK = /^\s*(#{1,6}\s|[-*+]\s|\d+[.)]\s|\||>|```|---|\*\*\*)/;

/**
 * Re-joins sentences that the source text (often PDF extraction) split with blank lines, e.g.
 * "…wrote Mahaviracharita,\n\nMalatimadhava and\n\nUttararamacharita." — markdown would
 * otherwise render every fragment as its own paragraph. A block is merged into the previous one
 * only when the previous one does not end a sentence and neither is structural markdown.
 */
function reflowBrokenParagraphs(md: string): string {
  if (!md) return md;
  const blocks = md.split(/\n[ \t]*\n+/);
  const out: string[] = [];
  for (const block of blocks) {
    const prev = out[out.length - 1];
    const prevLastLine = prev?.split('\n').pop() ?? '';
    const endsSentence = /[.!?:;]["'”’)\]*_]*\s*$/.test(prevLastLine);
    if (
      prev !== undefined &&
      !endsSentence &&
      !STRUCTURAL_BLOCK.test(prevLastLine) &&
      !STRUCTURAL_BLOCK.test(block) &&
      block.trim()
    ) {
      out[out.length - 1] = `${prev.trimEnd()} ${block.trimStart()}`;
    } else {
      out.push(block);
    }
  }
  return out.join('\n\n');
}

export function QuestionSolutionMarkdownCard({
  isUserCorrect,
  selectedOptionLabel,
  solution,
  isLoading = false,
  options = [],
}: QuestionSolutionMarkdownCardProps) {
  const { t } = useExamText();
  if (isLoading) {
    return (
      <div
        style={{
          marginTop: 20,
          padding: '24px',
          borderRadius: 'var(--radius)',
          backgroundColor: 'var(--bg-subtle)',
          border: '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          color: 'var(--text-muted)',
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}
      >
        <Loader2 size={18} className="animate-spin text-blue-600" />
        <span style={{ fontSize: 14, fontWeight: 600 }}>{t('loadingFullSolution')}</span>
      </div>
    );
  }

  const correctLabel = (solution.correct_option_label || 'A').replace(/[\(\)\.\s]/g, '').toUpperCase();
  const difficulty = solution.difficulty || 'MEDIUM';

  const explObj = typeof solution.explanation === 'object' && solution.explanation !== null ? solution.explanation : null;
  const rawFullExplanation =
    explObj?.detailed_solution ||
    explObj?.detailed_text ||
    explObj?.text ||
    (typeof solution.explanation === 'string' ? solution.explanation : 'Detailed explanation is available.');

  // Extract reverseLogic source text: either explicit reverse_logic field, or the Reverse Logic Box inside rawFullExplanation
  const explicitReverseLogic = (explObj?.reverse_logic || '').trim();
  const rlBoxMatch = rawFullExplanation.match(/(?:[◆■•·*#-]*\s*(?:Reverse\s+Logic(?:\s+Box)?|Why\s+(?:the\s+)?other\s+options\s+are\s+wrong)[^\n]*)([\s\S]*)/i);
  const embeddedReverseLogic = rlBoxMatch ? rlBoxMatch[1].trim() : '';

  // Also inspect options or distractor_scores if they contain Reverse Logic Box
  let optsReverseLogicSource = '';
  const allOptCandidates = [
    ...(options || []),
    ...((Array.isArray(solution.distractor_scores) ? solution.distractor_scores : solution.distractor_scores ? Object.values(solution.distractor_scores) : []))
  ];
  for (const o of allOptCandidates) {
    const da = (o as any)?.distractor_analysis || (o as any)?.analysis || '';
    if (da && /(?:Reverse\s+Logic|Why\s+(?:the\s+)?other\s+options|Option\s*\(?[B-D]\)?\s*[:\-\—–]|रिवर्स\s+लॉजिक|रिव्हर्स\s+लॉजिक)/i.test(da)) {
      optsReverseLogicSource = da;
      break;
    }
  }

  const fullReverseLogicSource = explicitReverseLogic || embeddedReverseLogic || optsReverseLogicSource;

  // detailedMarkdown for Section 1 (Detailed Explanation & Reference):
  // Strip out the Reverse Logic Box so Section 1 contains ONLY the core explanation/reference
  let rawDetailed = rawFullExplanation;
  const rlIdx = rawDetailed.search(/(?:[◆■•·*#-]*\s*(?:Reverse\s+Logic(?:\s+Box)?|Why\s+(?:the\s+)?other\s+options\s+are\s+wrong))/i);
  if (rlIdx !== -1) {
    rawDetailed = rawDetailed.slice(0, rlIdx).trim();
  }

  const detailedMarkdown = reflowBrokenParagraphs(rawDetailed);

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
  const reverseLogic = reflowBrokenParagraphs(explicitReverseLogic);

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

    // If analysis is still missing, try extracting from fullReverseLogicSource or rawFullExplanation
    if (!analysis) {
      if (fullReverseLogicSource) {
        const extracted = extractOptionAnalysisFromText(fullReverseLogicSource, itemLabel);
        if (extracted) analysis = extracted;
      }
      if (!analysis && rawFullExplanation) {
        const extracted = extractOptionAnalysisFromText(rawFullExplanation, itemLabel);
        if (extracted) analysis = extracted;
      }
    }

    // Clean up analysis text so other options' descriptions don't leak into this option's summary
    analysis = cleanOptionAnalysisText(analysis, isOptionCorrect, itemLabel);

    // For the correct option, NEVER duplicate the Detailed Explanation & Reference text
    // which is already displayed right above in the main explanation section.
    const isDuplicateOfMain = isOptionCorrect && Boolean(
      analysis && (
        analysis.trim() === rawDetailed.trim() ||
        analysis.trim() === detailedMarkdown.trim() ||
        (rawDetailed.length > 25 && analysis.includes(rawDetailed.slice(0, 40))) ||
        (analysis.length > 25 && rawDetailed.includes(analysis.slice(0, 40))) ||
        /evaluates core conceptual mastery/i.test(analysis)
      )
    );

    if (isOptionCorrect && (isDuplicateOfMain || !analysis)) {
      // In Option-by-Option Analysis, the card header already clearly shows "Correct Key".
      // Show concise confirmation or unique concept note without repeating the main explanation.
      analysis = explObj?.core_concept && !rawDetailed.includes(explObj.core_concept)
        ? `${t('thisIsCorrect')} ${explObj.core_concept}`
        : t('thisIsCorrect');
    } else if (!analysis) {
      const trapHint = commonTraps.length > 0 ? ` Common trap: ${commonTraps[0]}` : '';
      analysis = `${t('thisIsIncorrect')}${trapHint}`;
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
        borderRadius: 'var(--radius)',
        border: '1px solid #E2E8F0',
        backgroundColor: 'var(--bg-card)',
        boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.06)',
        overflow: 'visible',
        fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {/* Header Banner with Accuracy & Badges */}
      <div
        style={{
          padding: '16px 20px',
          backgroundColor: isUserCorrect ? '#F0FDF4' : isUserCorrect === false ? '#FEF2F2' : 'var(--bg-subtle)',
          borderBottom: `1px solid ${isUserCorrect ? 'var(--status-success-bg)' : isUserCorrect === false ? 'var(--primary-red-bg)' : 'var(--border-color)'}`,
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
                borderRadius: 'var(--radius)',
                backgroundColor: 'var(--status-success-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--status-success)',
              }}
            >
              <CheckCircle2 size={20} />
            </div>
          ) : isUserCorrect === false ? (
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 'var(--radius)',
                backgroundColor: 'var(--primary-red-bg)',
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
                borderRadius: 'var(--radius)',
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
                {t('optionIsCorrect', { label: correctLabel })}
              </span>
              {selectedOptionLabel && selectedOptionLabel !== correctLabel && (
                <span style={{ fontSize: 13, fontWeight: 600, color: '#DC2626' }}>
                  {t('yourSelection', { label: selectedOptionLabel })}
                </span>
              )}
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {t('solutionSubtitle')}
            </span>
          </div>
        </div>

        {/* Cognitive & Taxonomy Badges */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
          <span
            style={{
              padding: '4px 10px',
              borderRadius: 'var(--radius)',
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
            {['EASY', 'MEDIUM', 'HARD'].includes(String(difficulty).toUpperCase())
              ? t(`${String(difficulty).toUpperCase()}_TIER` as ExamTextKey)
              : `${formatEnum(difficulty)} Tier`}
          </span>
          {solution.topic && (
            <span
              style={{
                padding: '4px 10px',
                borderRadius: 'var(--radius)',
                fontSize: 11,
                fontWeight: 600,
                backgroundColor: 'var(--bg-hover)',
                color: 'var(--text-secondary)',
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
          {(solution.question_type_tag || (solution.cognitive_skill && !['conceptual reasoning', 'none', ''].includes(solution.cognitive_skill.toLowerCase()))) && (
            <span
              style={{
                padding: '4px 10px',
                borderRadius: 'var(--radius)',
                fontSize: 11,
                fontWeight: 600,
                backgroundColor: '#EFF6FF',
                color: '#1D4ED8',
                border: '1px solid #BFDBFE',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <BrainCircuit size={12} />
              {solution.question_type_tag || solution.cognitive_skill}
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
            {t('detailedExplanation')}
          </div>
          <div
            style={{
              borderRadius: 'var(--radius)',
              border: '1px solid #F1F5F9',
              backgroundColor: 'var(--bg-subtle)',
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

            {distractorsList.length > 0 ? (
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
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    padding: '10px 0 8px',
                  }}
                >
                  <Target size={13} style={{ color: 'var(--primary-red)' }} />
                  {t('optionAnalysis')}
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
                      {/* Letter chip + option text on the left (wraps freely), badge on the right;
                          the badge drops to its own line when the row is too narrow. */}
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          marginBottom: 6,
                          gap: '6px 10px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flex: '1 1 180px', minWidth: 0 }}>
                          <span
                            style={{
                              width: 22,
                              height: 22,
                              flexShrink: 0,
                              borderRadius: 'var(--radius)',
                              backgroundColor: isOptionCorrect ? 'var(--status-success-bg)' : 'var(--border-color)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 11.5,
                              fontWeight: 700,
                              color: isOptionCorrect ? 'var(--status-success)' : 'var(--text-secondary)',
                            }}
                          >
                            {isOptionCorrect ? (
                              <CheckCircle2 size={15} style={{ color: 'var(--status-success)' }} />
                            ) : (
                              item.label || String.fromCharCode(65 + idx)
                            )}
                          </span>
                          <span
                            style={{
                              fontSize: 13.5,
                              fontWeight: 700,
                              lineHeight: '22px',
                              color: isOptionCorrect ? 'var(--status-success)' : 'var(--text-primary, var(--deep-navy))',
                              minWidth: 0,
                              overflowWrap: 'anywhere',
                            }}
                          >
                            {item.text || `Option ${item.label || String.fromCharCode(65 + idx)}`}
                          </span>
                        </div>

                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            lineHeight: 1.3,
                            padding: '3px 8px',
                            borderRadius: 'var(--radius)',
                            backgroundColor: isOptionCorrect ? 'var(--status-success-bg)' : 'var(--bg-hover)',
                            color: isOptionCorrect ? '#15803D' : 'var(--text-muted)',
                            maxWidth: '100%',
                            marginLeft: 30,
                          }}
                        >
                          {isOptionCorrect
                            ? t('correctKey')
                            : item.classification === 'Distractor'
                              ? t('distractor')
                              : item.classification || `${t('distractor')} (${item.closeness_score ?? 0})`}
                        </span>
                      </div>

                      {item.distractor_analysis ? (
                        <p style={{ margin: '0 0 0 30px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55, overflowWrap: 'anywhere' }}>
                          {item.distractor_analysis}
                        </p>
                      ) : (
                        <p style={{ margin: '0 0 0 30px', fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          {isOptionCorrect ? t('thisIsCorrect') : t('thisIsIncorrect')}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : reverseLogic ? (
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
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    padding: '10px 0 8px',
                  }}
                >
                  <Target size={13} style={{ color: 'var(--primary-red)' }} />
                  {t('optionReasoning')}
                </div>
                <div className="prose prose-slate max-w-none text-slate-800" style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{reverseLogic}</ReactMarkdown>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Section 4: Common Traps to Avoid */}
        {commonTraps.length > 0 && (
          <div
            style={{
              padding: '16px 18px',
              borderRadius: 'var(--radius)',
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
              {t('commonTraps')}
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
          backgroundColor: 'var(--bg-subtle)',
          borderTop: '1px solid #F1F5F9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 12,
          color: 'var(--text-disabled)',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <FileCheck2 size={14} />
          {t('cognitiveSkill')}: {solution.cognitive_skill || 'Analytical & Conceptual Reasoning'}
        </span>
      </div>
    </div>
  );
}
