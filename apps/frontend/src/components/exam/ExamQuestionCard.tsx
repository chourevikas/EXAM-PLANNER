import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Bookmark,
  Clock,
  Award,
  Lightbulb,
  Loader2,
} from 'lucide-react';
import { QuestionOut, RevealAnswerResponse } from '../../types/exam';
import { QuestionSolutionData, QuestionSolutionMarkdownCard } from './QuestionSolutionMarkdownCard';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { getLanguageOption } from '../../constants/languages';

interface ExamQuestionCardProps {
  question:
    | QuestionOut
    | {
        id: number | string;
        question_id?: number | string;
        sectionId?: string;
        sectionName?: string;
        section_code?: string;
        subject_name?: string;
        subject?: string;
        topic_name?: string;
        topic?: string;
        subtopic_name?: string;
        subtopic?: string;
        concept_name?: string;
        exam_name?: string;
        examName?: string;
        exam_type?: string;
        source_year?: number;
        exam_year?: number;
        year?: number;
        difficulty?: string;
        expected_time_seconds?: number;
        time_tier?: string;
        marks?: number;
        negative_marks?: number;
        text: string;
        textHindi?: string;
        text_hindi?: string;
        question_text_hi?: string;
        question_text_hindi?: string;
        translations?: Record<string, any>;
        passage_text?: string | null;
        passage_text_hindi?: string | null;
        passage_translations?: Record<string, string>;
        options: {
          label?: string;
          option_label?: string;
          text: string;
          textHindi?: string;
          text_hindi?: string;
          option_id?: number | string;
          id?: number | string;
          is_correct?: boolean;
          translations?: Record<string, any>;
        }[];
      };
  questionIndex: number;
  totalQuestions: number;
  selectedOptionId?: number | string | null;
  selectedOptionLabel?: string | null;
  isBookmarked?: boolean;
  language: string;
  mode?: 'EXAM' | 'PRACTICE' | 'REVISION';
  revealResult?: RevealAnswerResponse | null;
  isRevealing?: boolean;
  onSelectOption: (optionId: number | string, optionLabel: string) => void;
  onToggleBookmark?: () => void;
  onRevealAnswer?: () => void;
  onShowSolution?: () => void;
  onToggleSidebar?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  isPYQ?: boolean;
  solutionData?: QuestionSolutionData | null;
}

function cleanQuestionTextBody(rawText: string): string {
  if (!rawText) return '';
  let text = String(rawText).trim();
  text = text.replace(/^\[[^\]]+\]\s*Question\s*#\d+\:\s*/i, '');
  text = text.replace(/^Question\s*#\d+\:\s*/i, '');
  return text.trim();
}

export function getQuestionText(q: any, lang: string): string {
  if (!q) return '';
  const cleanLang = (lang || 'en').trim().toLowerCase();
  let raw = '';

  if (cleanLang !== 'en' && cleanLang !== 'english') {
    const langOpt = getLanguageOption(cleanLang);
    const enumName = langOpt?.enumName || cleanLang.toUpperCase();
    const upper = cleanLang.toUpperCase();

    if (cleanLang === 'hi' || cleanLang === 'hindi') {
      if (q.textHindi) raw = q.textHindi;
      else if (q.text_hindi) raw = q.text_hindi;
      else if (q.question_text_hindi) raw = q.question_text_hindi;
      else if (q.question_text_hi) raw = q.question_text_hi;
    } else if (cleanLang === 'mr' || cleanLang === 'marathi') {
      if (q.textMarathi) raw = q.textMarathi;
      else if (q.text_marathi) raw = q.text_marathi;
    }

    if (!raw && q.translations) {
      const t =
        q.translations[enumName] ||
        q.translations[cleanLang] ||
        q.translations[upper] ||
        q.translations[langOpt?.name?.toLowerCase()] ||
        (cleanLang === 'hi' ? q.translations.HINDI : null) ||
        (cleanLang === 'mr' ? q.translations.MARATHI : null);
      if (typeof t === 'string') raw = t;
      else if (t?.text) raw = t.text;
      else if (t?.question_text) raw = t.question_text;
    }
  }

  if (!raw) {
    raw = q.text || q.question_text || '';
    if (!raw && q.translations) {
      const eng = q.translations.ENGLISH || q.translations.en;
      if (typeof eng === 'string') raw = eng;
      else if (eng?.text) raw = eng.text;
      else if (eng?.question_text) raw = eng.question_text;
    }
  }
  return cleanQuestionTextBody(raw);
}

export function getPassageText(q: any, lang: string): string | null {
  if (!q) return null;
  const cleanLang = (lang || 'en').trim().toLowerCase();
  let raw: string | null = null;

  if (cleanLang !== 'en' && cleanLang !== 'english') {
    const langOpt = getLanguageOption(cleanLang);
    const enumName = langOpt?.enumName || cleanLang.toUpperCase();
    const upper = cleanLang.toUpperCase();

    if (cleanLang === 'hi' || cleanLang === 'hindi') {
      if (q.passage_text_hindi) raw = q.passage_text_hindi;
      else if (q.passage_text_hi) raw = q.passage_text_hi;
      else if (q.passageTextHindi) raw = q.passageTextHindi;
    }

    if (!raw && q.passage_translations) {
      const pt =
        q.passage_translations[enumName] ||
        q.passage_translations[cleanLang] ||
        q.passage_translations[upper] ||
        q.passage_translations[langOpt?.name?.toLowerCase()] ||
        (cleanLang === 'hi' ? q.passage_translations.HINDI : null);
      if (typeof pt === 'string') raw = pt;
      else if (pt?.passage_text) raw = pt.passage_text;
    }
  }

  if (!raw) {
    raw = q.passage_text || null;
    if (!raw && q.passage_translations) {
      const engPt = q.passage_translations.ENGLISH || q.passage_translations.en;
      if (typeof engPt === 'string') raw = engPt;
      else if (engPt?.passage_text) raw = engPt.passage_text;
    }
  }
  return raw;
}

function cleanOptionLabel(rawLabel: string, index: number): string {
  if (!rawLabel) return String.fromCharCode(65 + index);
  const clean = String(rawLabel)
    .replace(/[\(\)\.\s]/g, '')
    .toUpperCase();
  return clean.length === 1 ? clean : String.fromCharCode(65 + index);
}

function cleanOptionText(rawText: string): string {
  if (!rawText) return '';
  let text = String(rawText).trim();
  text = text.replace(/^[\(\[]+([a-dA-D1-4])[\)\]]+\s*/, '');
  text = text.replace(/^([a-dA-D1-4])[\)\.\:]\s*/, '');
  text = text.replace(/^['"]+|['"]+$/g, '');
  return text.trim();
}

export function getOptionText(opt: any, lang: string, optIdx?: number, q?: any): string {
  if (!opt) return `Option ${String.fromCharCode(65 + (optIdx || 0))}`;
  const cleanLang = (lang || 'en').trim().toLowerCase();
  let rawText = '';

  if (cleanLang !== 'en' && cleanLang !== 'english') {
    const langOpt = getLanguageOption(cleanLang);
    const enumName = langOpt?.enumName || cleanLang.toUpperCase();
    const upper = cleanLang.toUpperCase();

    if (cleanLang === 'hi' || cleanLang === 'hindi') {
      if (opt.textHindi) rawText = opt.textHindi;
      else if (opt.text_hindi) rawText = opt.text_hindi;
      else if (opt.option_text_hindi) rawText = opt.option_text_hindi;
      else if (opt.option_text_hi) rawText = opt.option_text_hi;
    } else if (cleanLang === 'mr' || cleanLang === 'marathi') {
      if (opt.textMarathi) rawText = opt.textMarathi;
      else if (opt.text_marathi) rawText = opt.text_marathi;
    }

    if (!rawText && opt.translations && typeof opt.translations === 'object') {
      let ot =
        opt.translations[enumName] ||
        opt.translations[enumName.toUpperCase()] ||
        opt.translations[cleanLang] ||
        opt.translations[upper] ||
        (langOpt?.name ? opt.translations[langOpt.name] : null) ||
        (langOpt?.name ? opt.translations[langOpt.name.toLowerCase()] : null) ||
        (cleanLang === 'hi' ? (opt.translations.HINDI || opt.translations.Hindi || opt.translations.hindi) : null) ||
        (cleanLang === 'mr' ? (opt.translations.MARATHI || opt.translations.Marathi || opt.translations.marathi) : null);

      if (!ot) {
        // Case-insensitive key match in opt.translations
        const transKeys = Object.keys(opt.translations);
        const matchKey = transKeys.find((k) => {
          const kLower = k.toLowerCase();
          return (
            kLower === cleanLang ||
            kLower === enumName.toLowerCase() ||
            (langOpt?.name && kLower === langOpt.name.toLowerCase())
          );
        });
        if (matchKey) ot = opt.translations[matchKey];
      }

      if (typeof ot === 'string') rawText = ot;
      else if (ot?.text) rawText = ot.text;
      else if (ot?.option_text) rawText = ot.option_text;
    }

    // Check if question object has option_translations mapping
    if (!rawText && q && (q.option_translations || q.optionTranslations)) {
      const qOptTrans = q.option_translations || q.optionTranslations;
      const optId = opt.option_id || opt.id;
      const optMap = qOptTrans[optId] || qOptTrans[String(optId)];
      if (optMap && typeof optMap === 'object') {
        const ot = optMap[enumName] || optMap[cleanLang] || optMap[upper] || (cleanLang === 'hi' ? optMap.HINDI : null);
        if (typeof ot === 'string') rawText = ot;
        else if (ot?.text) rawText = ot.text;
        else if (ot?.option_text) rawText = ot.option_text;
      }
    }
  }

  if (!rawText) {
    rawText = opt.text || opt.option_text || '';
    if (!rawText && opt.translations) {
      const engOt = opt.translations.ENGLISH || opt.translations.en || opt.translations.English;
      if (typeof engOt === 'string') rawText = engOt;
      else if (engOt?.text) rawText = engOt.text;
      else if (engOt?.option_text) rawText = engOt.option_text;
    }
  }

  if (!rawText) {
    rawText = `Option ${String.fromCharCode(65 + (optIdx || 0))}`;
  }
  return cleanOptionText(rawText);
}

export function ExamQuestionCard({
  question,
  questionIndex,
  totalQuestions,
  selectedOptionId,
  selectedOptionLabel,
  isBookmarked,
  language,
  mode = 'EXAM',
  revealResult,
  isRevealing = false,
  onSelectOption,
  onToggleBookmark,
  onRevealAnswer,
  onShowSolution,
  onToggleSidebar,
  onPrev,
  onNext,
  isPYQ = false,
  solutionData,
}: ExamQuestionCardProps) {
  const [showDetailedSolution, setShowDetailedSolution] = useState<boolean>(false);

  useEffect(() => {
    if (revealResult) {
      setShowDetailedSolution(true);
    } else {
      setShowDetailedSolution(false);
    }
  }, [questionIndex, revealResult]);

  // Extract Question Tags & Metadata
  const examName =
    (question as any).exam_name ||
    (question as any).examName ||
    (question as any).exam_type ||
    'UPSC CSE';

  const sourceYear =
    (question as any).source_year || (question as any).exam_year || (question as any).year || '';

  const examYearDisplay = sourceYear ? `${examName} ${sourceYear}` : examName;

  const subjectLabel = (question as any).subject_name || (question as any).subject || '';

  const topicLabel =
    (question as any).topic_name ||
    (question as any).topic ||
    (question as any).section_code ||
    (question as any).sectionName ||
    '';

  const subtopicLabel = (question as any).subtopic_name || (question as any).subtopic || '';

  const difficultyLabel = String(question.difficulty || 'MEDIUM').toUpperCase();

  // Difficulty tag styling
  const getDifficultyColors = (diff: string) => {
    switch (diff) {
      case 'EASY':
        return { text: '#059669', bg: '#ECFDF5', border: '#A7F3D0' };
      case 'HARD':
        return { text: '#E11D48', bg: '#FFE4E6', border: '#FECDD3' };
      case 'MEDIUM':
      default:
        return { text: '#D97706', bg: 'var(--status-warning-bg)', border: '#FDE68A' };
    }
  };
  const diffColors = getDifficultyColors(difficultyLabel);

  // Time & Tier Tag
  const expectedTimeSeconds = (question as any).expected_time_seconds || 60;
  const getTimeTierLabel = (secs: number) => {
    if (secs <= 45) return `Fast Tier (⏱️ ${secs}s)`;
    if (secs <= 75) return `Standard Tier (⏱️ ${secs}s)`;
    return `Deep Analysis (⏱️ ${secs}s)`;
  };
  const timeTierLabel = getTimeTierLabel(expectedTimeSeconds);

  // Marks
  const marksVal = (question as any).marks != null ? (question as any).marks : 2.0;
  const negMarksVal =
    (question as any).negative_marks != null ? (question as any).negative_marks : 0.66;

  const passageContent = getPassageText(question, language);
  const questionContent = getQuestionText(question, language);

  const options = (question.options || []).map((opt: any, optIdx: number) => {
    const rawLabel = opt.option_label || opt.label;
    const cleanLbl = cleanOptionLabel(rawLabel, optIdx);
    return {
      id: opt.option_id || opt.id || cleanLbl,
      rawLabel,
      cleanLabel: cleanLbl,
      text: getOptionText(opt, language, optIdx, question),
    };
  });

  const questionMarkdownComponents: any = {
    p: ({ node, ...props }: any) => (
      <p
        style={{
          margin: '6px 0',
          lineHeight: 1.55,
          fontSize: 15,
          fontWeight: 600,
          color: 'var(--deep-navy)',
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}
        {...props}
      />
    ),
    strong: ({ node, ...props }: any) => (
      <strong style={{ fontWeight: 700, color: 'var(--deep-navy)' }} {...props} />
    ),
    table: ({ node, ...props }: any) => (
      <div style={{ overflowX: 'auto', margin: '10px 0' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 12.5,
            border: '1px solid #E2E8F0',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}
          {...props}
        />
      </div>
    ),
    th: ({ node, ...props }: any) => (
      <th
        style={{
          padding: '6px 10px',
          fontWeight: 700,
          textAlign: 'left',
          backgroundColor: 'var(--bg-hover)',
          borderBottom: '2px solid #E2E8F0',
          color: 'var(--deep-navy)',
        }}
        {...props}
      />
    ),
    td: ({ node, ...props }: any) => (
      <td
        style={{
          padding: '6px 10px',
          borderBottom: '1px solid #F1F5F9',
          color: 'var(--deep-navy)',
        }}
        {...props}
      />
    ),
    ul: ({ node, ...props }: any) => <ul style={{ paddingLeft: 18, margin: '6px 0' }} {...props} />,
    ol: ({ node, ...props }: any) => <ol style={{ paddingLeft: 18, margin: '6px 0' }} {...props} />,
    li: ({ node, ...props }: any) => (
      <li
        style={{
          margin: '3px 0',
          fontSize: 14,
          color: 'var(--deep-navy)',
          lineHeight: 1.45,
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}
        {...props}
      />
    ),
  };

  const optionMarkdownComponents: any = {
    p: ({ node, ...props }: any) => (
      <span
        style={{ display: 'inline', margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        {...props}
      />
    ),
    strong: ({ node, ...props }: any) => <strong style={{ fontWeight: 700 }} {...props} />,
  };

  const { isTabletOrBelow } = useBreakpoint();

  return (
    <main
      style={{
        flex: 1,
        width: '100%',
        overflow: 'hidden',
        boxSizing: 'border-box',
        backgroundColor: '#F8FAF8',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        justifyContent: 'flex-start',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        height: isTabletOrBelow ? 'auto' : '100%',
        maxHeight: isTabletOrBelow ? 'none' : '100%',
        minHeight: 0,
      }}
    >
      <div
        style={{
          maxWidth: isPYQ ? '1100px' : '100%',
          width: '100%',
          margin: '0 0',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          gap: 12,
          height: isTabletOrBelow ? 'auto' : '100%',
          maxHeight: isTabletOrBelow ? 'none' : '100%',
          minHeight: 0,
          boxSizing: 'border-box',
        }}
      >
        {/* Reading Passage (If Present) */}
        {passageContent && (
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              padding: 'clamp(12px, 2.5vw, 18px)',
              border: '1px solid #E2E8F0',
              borderLeft: '4px solid var(--primary-red)',
              fontSize: 'clamp(13px, 2vw, 15px)',
              color: 'var(--text-secondary)',
              lineHeight: 1.55,
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={questionMarkdownComponents}>
              {passageContent}
            </ReactMarkdown>
          </div>
        )}

        {/* Compact Examination Canvas Floating Card with Internal Scrollbar */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid #E2E8F0',
            borderTop: '4px solid var(--primary-red)',
            borderRadius: 0,
            boxShadow: '0 10px 30px -5px rgba(15, 23, 42, 0.08), 0 4px 12px rgba(15, 23, 42, 0.03)',
            padding: 'clamp(12px, 2.5vw, 20px)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            flex: 1,
            minHeight: 0,
            maxHeight: isTabletOrBelow ? 'none' : '100%',
            boxSizing: 'border-box',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            overflow: isTabletOrBelow ? 'visible' : 'hidden',
          }}
        >
          {/* Question Metadata Header Bar with Comprehensive Tags */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              marginBottom: 14,
              paddingBottom: 12,
              borderBottom: '1.5px solid #F1F5F9',
              flexShrink: 0,
            }}
          >
            {/* Top Row: Question Counter, Difficulty, Time Tier, Marks, and Bookmark */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              {/* Left group: Counter + Difficulty + Time + Marks */}
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                {/* Question Counter Pill */}
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: 'var(--primary-red)',
                    backgroundColor: '#EFF6FF',
                    border: '1px solid #BFDBFE',
                    padding: '3px 10px',
                    borderRadius: 2,
                    letterSpacing: '0.04em',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  QUESTION {(question as any)?.question_number || questionIndex + 1}{' '}
                  {totalQuestions ? `OF ${totalQuestions}` : ''}
                </span>

                {/* Difficulty Badge */}
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: diffColors.text,
                    backgroundColor: diffColors.bg,
                    border: `1px solid ${diffColors.border}`,
                    padding: '3px 8px',
                    borderRadius: 2,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    letterSpacing: '0.03em',
                  }}
                >
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: '50%',
                      backgroundColor: diffColors.text,
                    }}
                  />
                  {difficultyLabel}
                </span>

                {/* Time & Tier Badge */}
                {/* <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    backgroundColor: 'var(--bg-subtle)',
                    border: '1px solid #E2E8F0',
                    padding: '3px 8px',
                    borderRadius: 2,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                  title={`Target solve time: ${expectedTimeSeconds} seconds`}
                >
                  <Clock size={12} color="var(--text-muted)" />
                  {timeTierLabel}
                </span> */}

                {/* Marks Badge */}
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'var(--text-secondary)',
                    backgroundColor: 'var(--bg-hover)',
                    border: '1px solid #E2E8F0',
                    padding: '3px 8px',
                    borderRadius: 2,
                  }}
                >
                  +{marksVal} / -{negMarksVal}
                </span>

                {/* Exam & Year Tag */}
                {examYearDisplay && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: 'var(--primary-red)',
                      backgroundColor: '#F0F9FF',
                      border: '1px solid #BAE6FD',
                      padding: '2px 8px',
                      borderRadius: 2,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Award size={12} color="#0284C7" />
                    {examYearDisplay}
                  </span>
                )}

                {/* Subject Tag */}
                {subjectLabel && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: '#4338CA',
                      backgroundColor: '#EEF2FF',
                      border: '1px solid #C7D2FE',
                      padding: '2px 8px',
                      borderRadius: 2,
                    }}
                  >
                    {subjectLabel}
                  </span>
                )}

                {/* Topic Tag */}
                {topicLabel && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      backgroundColor: 'var(--bg-subtle)',
                      border: '1px solid #CBD5E1',
                      padding: '2px 8px',
                      borderRadius: 2,
                    }}
                  >
                    {topicLabel}
                  </span>
                )}

                {/* Subtopic Tag */}
                {subtopicLabel && (
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 500,
                      color: 'var(--text-muted)',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px dashed #CBD5E1',
                      padding: '2px 7px',
                      borderRadius: 2,
                    }}
                  >
                    ↳ {subtopicLabel}
                  </span>
                )}
              </div>

              {/* Right: Bookmark Button */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {onToggleBookmark && (
                  <button
                    type="button"
                    onClick={onToggleBookmark}
                    title={isBookmarked ? 'Remove Bookmark' : 'Bookmark Question'}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 4,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: isBookmarked ? 'var(--primary-red)' : 'var(--text-disabled)',
                      transition: 'color 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = 'var(--primary-red)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = isBookmarked ? 'var(--primary-red)' : 'var(--text-disabled)';
                    }}
                  >
                    <Bookmark size={18} fill={isBookmarked ? 'var(--primary-red)' : 'none'} />
                  </button>
                )}
              </div>
            </div>

            {/* Second Row: Exam Year, Subject, Topic, Subtopic Tags */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}></div>
          </div>

          {/* Internally Scrollable Question Content Body (Desktop Only) */}
          <div
            style={{
              overflowY: isTabletOrBelow ? 'visible' : 'auto',
              flex: 1,
              paddingRight: 6,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Question Body */}
            <div
              style={{
                marginBottom: 16,
                fontSize: 15,
                color: 'var(--deep-navy)',
                fontWeight: 600,
                lineHeight: 1.55,
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={questionMarkdownComponents}>
                {questionContent}
              </ReactMarkdown>
            </div>

            {/* Answer Choice Radio Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: '10px' }}>
              {options.map((opt) => {
                const isSelected =
                  selectedOptionId === opt.id ||
                  selectedOptionLabel === opt.cleanLabel ||
                  selectedOptionLabel === opt.rawLabel;

                const isCorrectOpt =
                  revealResult &&
                  (revealResult.correct_option_id === opt.id ||
                    revealResult.correct_option_label === opt.cleanLabel);
                const isWrongSelectedOpt = revealResult && isSelected && !isCorrectOpt;

                let borderStyle = isSelected ? '1.5px solid var(--primary-red)' : '1px solid #E2E8F0';
                let bgStyle = isSelected ? '#F0F9FF' : '#F8FAFC';
                let badgeBg = isSelected ? 'var(--primary-red)' : '#FFFFFF';
                let badgeColor = isSelected ? '#FFFFFF' : '#475569';
                let badgeBorder = isSelected ? '1px solid var(--primary-red)' : '1px solid #CBD5E1';

                if (revealResult) {
                  if (isCorrectOpt) {
                    borderStyle = '1.5px solid #3A8B53';
                    bgStyle = '#ECFDF5';
                    badgeBg = '#3A8B53';
                    badgeColor = 'var(--bg-card)';
                    badgeBorder = '1px solid #3A8B53';
                  } else if (isWrongSelectedOpt) {
                    borderStyle = '1.5px solid #EF4444';
                    bgStyle = '#FEF2F2';
                    badgeBg = 'var(--primary-red)';
                    badgeColor = 'var(--bg-card)';
                    badgeBorder = '1px solid #EF4444';
                  }
                }

                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      if (revealResult) return; // Locked after submission!
                      onSelectOption(opt.id, opt.cleanLabel);
                    }}
                    disabled={!!revealResult}
                    className="touch-target"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 14px',
                      borderRadius: 4,
                      border: borderStyle,
                      backgroundColor: bgStyle,
                      color: 'var(--deep-navy)',
                      cursor: revealResult ? 'default' : 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.18s ease-out',
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      minHeight: 44,
                    }}
                  >
                    {/* Radio Button Circle Indicator */}
                    <div
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        border: revealResult
                          ? isCorrectOpt
                            ? '5px solid #3A8B53'
                            : isWrongSelectedOpt
                              ? '5px solid #EF4444'
                              : '1.5px solid #CBD5E1'
                          : isSelected
                            ? '5px solid var(--primary-red)'
                            : '1.5px solid #CBD5E1',
                        backgroundColor: 'var(--bg-card)',
                        flexShrink: 0,
                        boxSizing: 'border-box',
                        transition: 'all 0.18s ease-out',
                      }}
                    />

                    {/* Option Label Badge ([A], [B], [C], [D]) */}
                    <div
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 3,
                        backgroundColor: badgeBg,
                        color: badgeColor,
                        border: badgeBorder,
                        fontWeight: 700,
                        fontSize: 12.5,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        transition: 'all 0.18s ease-out',
                        fontFamily: "'Plus Jakarta Sans', sans-serif",
                      }}
                    >
                      {opt.cleanLabel}
                    </div>

                    {/* Option Text */}
                    <div
                      style={{
                        fontSize: 14,
                        color: 'var(--deep-navy)',
                        fontWeight: isSelected || isCorrectOpt ? 600 : 500,
                        lineHeight: 1.45,
                        flex: 1,
                        fontFamily: "'Plus Jakarta Sans', sans-serif",
                      }}
                    >
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={optionMarkdownComponents}
                      >
                        {opt.text}
                      </ReactMarkdown>
                    </div>

                    {/* Right Status Indicator once submitted */}
                    {revealResult && isCorrectOpt ? (
                      <CheckCircle2 size={18} style={{ color: '#3A8B53', flexShrink: 0 }} />
                    ) : revealResult && isWrongSelectedOpt ? (
                      <XCircle size={18} style={{ color: 'var(--primary-red)', flexShrink: 0 }} />
                    ) : null}
                  </button>
                );
              })}
            </div>

            {/* Rich Solution Markdown Card (Practice / Revision Mode) */}
            {mode !== 'EXAM' && (revealResult || solutionData) && showDetailedSolution && (
              <QuestionSolutionMarkdownCard
                isLoading={isRevealing}
                isUserCorrect={revealResult?.is_user_correct}
                selectedOptionLabel={
                  revealResult?.user_selected_label || selectedOptionLabel || undefined
                }
                options={question.options}
                solution={
                  solutionData || {
                    question_id: revealResult?.question_id,
                    question_number: revealResult?.question_number || questionIndex + 1,
                    correct_option_id: revealResult?.correct_option_id,
                    correct_option_label: revealResult?.correct_option_label,
                    difficulty: (question as any)?.difficulty || 'MEDIUM',
                    topic:
                      (question as any)?.topic_name ||
                      (question as any)?.topic ||
                      (question as any)?.section_code,
                    subtopic: (question as any)?.subtopic_name || (question as any)?.subtopic,
                    presigned_url: (revealResult as any)?.presigned_url,
                    explanation:
                      typeof revealResult?.explanation === 'object' &&
                      revealResult?.explanation !== null
                        ? {
                            detailed_solution:
                              (revealResult.explanation as any).detailed_solution ||
                              (revealResult.explanation as any).detailed_text ||
                              (revealResult.explanation as any).text ||
                              (typeof revealResult.explanation === 'string'
                                ? revealResult.explanation
                                : ''),
                            reverse_logic: (revealResult.explanation as any).reverse_logic || '',
                            common_traps:
                              (revealResult.explanation as any).common_traps ||
                              (revealResult.explanation as any).traps ||
                              [],
                            key_takeaways:
                              (revealResult.explanation as any).key_takeaways ||
                              (revealResult.explanation as any).points_to_remember ||
                              ((revealResult.explanation as any).key_takeaway
                                ? [(revealResult.explanation as any).key_takeaway]
                                : []),
                          }
                        : {
                            detailed_solution:
                              typeof revealResult?.explanation === 'string'
                                ? revealResult.explanation
                                : 'Detailed solution is available.',
                          },
                    distractor_scores: (() => {
                      const baseScores: Record<string, any> = { ...(revealResult?.distractor_scores || {}) };
                      (question.options || []).forEach((opt: any, idx: number) => {
                        const optKey = String(opt.option_id ?? opt.id ?? idx);
                        const optLabel = (opt.option_label || opt.label || String.fromCharCode(65 + idx)).replace(/[\(\)\.\s]/g, '').toUpperCase();
                        const existingKey = Object.keys(baseScores).find((k) => k === optKey || baseScores[k]?.label === optLabel);
                        if (existingKey) {
                          baseScores[existingKey] = {
                            ...baseScores[existingKey],
                            text: baseScores[existingKey].text || opt.text || opt.option_text || '',
                            distractor_analysis: baseScores[existingKey].distractor_analysis || opt.distractor_analysis || opt.analysis || '',
                          };
                        } else {
                          baseScores[optKey] = {
                            option_id: opt.option_id || opt.id,
                            label: optLabel,
                            text: opt.text || opt.option_text || '',
                            is_correct: opt.is_correct,
                            closeness_score: opt.closeness_score ?? (opt.is_correct ? 1.0 : 0.0),
                            classification: opt.is_correct ? 'Correct Key' : 'Distractor',
                            distractor_analysis: opt.distractor_analysis || opt.analysis || '',
                          };
                        }
                      });
                      return baseScores;
                    })(),
                  }
                }
              />
            )}

            {/* Action Buttons & Navigation (only rendered when there's something to show) */}
            {(onPrev || onNext || mode !== 'EXAM') && (
              <div
                style={{
                  marginTop: 14,
                  paddingTop: 12,
                  borderTop: '1px solid #F1F5F9',
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 10,
                  flexShrink: 0,
                }}
              >
                {/* Left: Prev | Next Buttons */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  {/* Previous Question Button */}
                  {onPrev && (
                    <button
                      type="button"
                      onClick={onPrev}
                      disabled={questionIndex === 0}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '7px 14px',
                        borderRadius: 3,
                        border: '1px solid #CBD5E1',
                        backgroundColor: questionIndex === 0 ? '#F1F5F9' : '#FFFFFF',
                        color: questionIndex === 0 ? '#94A3B8' : 'var(--deep-navy)',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: questionIndex === 0 ? 'not-allowed' : 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
                        fontFamily: "'Plus Jakarta Sans', sans-serif",
                      }}
                    >
                      <ChevronLeft size={15} />
                      <span>Prev</span>
                    </button>
                  )}

                  {/* Next Question Button */}
                  {onNext && (
                    <button
                      type="button"
                      onClick={onNext}
                      disabled={questionIndex >= totalQuestions - 1}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '7px 14px',
                        borderRadius: 3,
                        border: '1px solid #CBD5E1',
                        backgroundColor:
                          questionIndex >= totalQuestions - 1 ? '#F1F5F9' : '#FFFFFF',
                        color: questionIndex >= totalQuestions - 1 ? '#94A3B8' : 'var(--deep-navy)',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: questionIndex >= totalQuestions - 1 ? 'not-allowed' : 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
                        fontFamily: "'Plus Jakarta Sans', sans-serif",
                      }}
                    >
                      <span>Next</span>
                      <ChevronRight size={15} />
                    </button>
                  )}
                </div>

                {/* Right: Single Action Button */}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  {mode !== 'EXAM' && (
                    <>
                      {!revealResult ? (
                        /* Single Button: Submit & Show Solution */
                        <button
                          type="button"
                          onClick={() => {
                            if (!selectedOptionId) return;
                            setShowDetailedSolution(true);
                            if (onRevealAnswer) onRevealAnswer();
                            if (onShowSolution) onShowSolution();
                          }}
                          disabled={!selectedOptionId || isRevealing}
                          style={{
                            padding: '8px 20px',
                            borderRadius: 3,
                            border: !selectedOptionId ? '1px solid #CBD5E1' : '1px solid var(--primary-red)',
                            backgroundColor: !selectedOptionId ? '#E2E8F0' : 'var(--primary-red)',
                            color: !selectedOptionId ? '#94A3B8' : '#FFFFFF',
                            fontSize: 12.5,
                            fontWeight: 700,
                            cursor: !selectedOptionId ? 'not-allowed' : 'pointer',
                            boxShadow: !selectedOptionId
                              ? 'none'
                              : '0 2px 8px rgba(var(--primary-red-rgb), 0.25)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            transition: 'all 0.15s ease',
                            fontFamily: "'Plus Jakarta Sans', sans-serif",
                          }}
                          onMouseEnter={(e) => {
                            if (selectedOptionId) e.currentTarget.style.backgroundColor = '#172554';
                          }}
                          onMouseLeave={(e) => {
                            if (selectedOptionId) e.currentTarget.style.backgroundColor = 'var(--primary-red)';
                          }}
                        >
                          {isRevealing ? (
                            <>
                              <Loader2 size={14} className="spin-loader" />
                              <span>Loading solution...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 size={14} />
                              <span>Submit & Show Solution</span>
                            </>
                          )}
                        </button>
                      ) : (
                        /* Toggle Solution Button */
                        <button
                          type="button"
                          onClick={() => {
                            const next = !showDetailedSolution;
                            setShowDetailedSolution(next);
                            if (next && onShowSolution) {
                              onShowSolution();
                            }
                          }}
                          style={{
                            padding: '8px 18px',
                            borderRadius: 3,
                            border: showDetailedSolution
                              ? '1px solid var(--primary-red)'
                              : '1px solid #CBD5E1',
                            backgroundColor: showDetailedSolution ? '#EFF6FF' : '#FFFFFF',
                            color: showDetailedSolution ? 'var(--primary-red)' : 'var(--deep-navy)',
                            fontSize: 12.5,
                            fontWeight: 700,
                            cursor: 'pointer',
                            boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            transition: 'all 0.15s ease',
                            fontFamily: "'Plus Jakarta Sans', sans-serif",
                          }}
                        >
                          <Lightbulb
                            size={14}
                            color={showDetailedSolution ? 'var(--primary-red)' : '#64748B'}
                          />
                          <span>{showDetailedSolution ? 'Hide Solution' : 'Show Solution'}</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
