/**
 * Utilities for formatting raw enum strings, database keys, and snake_case labels into clean, human-readable Title Case text.
 */

const KNOWN_ACRONYMS = new Set([
  'UPSC',
  'CSE',
  'GS',
  'GS1',
  'GS2',
  'GS3',
  'GS4',
  'IAS',
  'IPS',
  'IRS',
  'IFS',
  'CSAT',
  'PYQ',
  'IRT',
  'ICRS',
  'SATOI',
  'GTI',
  'OEEI',
  'OSRI',
  'NCERT',
  'AI',
  'LLM',
  'ID',
  'KPI',
]);

const CUSTOM_OVERRIDE_MAP: Record<string, string> = {
  // Exam Modalities & Modes
  FULL_MOCK: 'Full Mock Exam',
  PRACTICE_TEST: 'Practice Test',
  PRACTICE: 'Practice Test',
  GUEST_PRACTICE: 'Guest Trial',
  GUEST_EXAM: 'Guest Exam',
  MOCK: 'Full Mock Exam',
  EXAM: 'Exam Mode',
  REVISION: 'Revision Mode',
  STUDY_SESSION: 'Study Session',

  // Exam Papers & Types
  GS1: 'GS Paper 1',
  GS2: 'GS Paper 2',
  GS3: 'GS Paper 3',
  GS4: 'GS Paper 4',
  GS_PAPER_1: 'GS Paper 1',
  GS_PAPER_2: 'GS Paper 2',
  GS_PAPER_3: 'GS Paper 3',
  GS_PAPER_4: 'GS Paper 4',
  PRELIMS_GS1: 'UPSC Prelims GS-I',
  PRELIMS_CSAT: 'UPSC Prelims CSAT',
  MAINS_GS1: 'UPSC Mains GS-I',
  MAINS_GS2: 'UPSC Mains GS-II',
  MAINS_GS3: 'UPSC Mains GS-III',
  MAINS_GS4: 'UPSC Mains GS-IV',
  UPSC_CSE: 'UPSC CSE',

  // Difficulties
  EASY: 'Easy',
  MEDIUM: 'Medium',
  HARD: 'Hard',

  // Priorities
  CRITICAL: 'Critical Priority',
  HIGH: 'High Priority',
  MODERATE: 'Moderate Priority',
  MEDIUM_PRIORITY: 'Medium Priority',
  LOW: 'Low Priority',

  // Attempt & Pipeline Statuses
  COMPLETED: 'Completed',
  EVALUATED: 'Evaluated',
  IN_PROGRESS: 'In Progress',
  AUTO_SUBMITTED: 'Auto Submitted',
  SUBMITTED: 'Submitted',
  FAILED: 'Failed',
  PENDING_REVIEW: 'Pending Review',
  EVALUATING: 'Evaluating',
  PUBLISHED_TO_S3: 'Published',
  PUBLISHED_S3: 'Published',
  S3_PUBLISH: 'Published',
  PUBLISH_TO_S3: 'Published',
  S3_PUBLISHED: 'Published',
  S3_SYNC: 'Published',

  // Pacing & Psychometric Statuses
  OPTIMAL_PACING: 'Optimal Pacing',
  TIME_PRESSURE: 'Time Pressure',
  RUSHED: 'Rushed',
  FATIGUE_PRONE: 'Fatigue Prone',
  BALANCED: 'Balanced Velocity',

  // Activity Types
  CONCEPT_BUILDING: 'Concept Building',
  FLASHCARD_REVISION: 'Flashcard Revision',
  MOCK_DRILL: 'Mock Drill',
  WEAK_AREA_DRILL: 'Weak Area Drill',
  PYQ_PRACTICE: 'PYQ Practice',
  SUMMARY_NOTE: 'Summary Note',
  TARGETED_DRILL: 'Targeted Drill',
};

/**
 * Converts any raw enum, SNAKE_CASE, or camelCase value into clean, human-readable Title Case.
 * Example:
 *   formatEnum('OPTIMAL_PACING') => 'Optimal Pacing'
 *   formatEnum('ANCIENT_HISTORY') => 'Ancient History'
 *   formatEnum('FULL_MOCK') => 'Full Mock Exam'
 *   formatEnum('EASY') => 'Easy'
 */
export function formatEnum(value?: string | number | null): string {
  if (value === null || value === undefined) return '';
  const str = String(value).trim();
  if (!str) return '';

  // Check known custom dictionary first
  const upperKey = str.toUpperCase();
  if (CUSTOM_OVERRIDE_MAP[upperKey]) {
    return CUSTOM_OVERRIDE_MAP[upperKey];
  }

  // If already formatted with spaces and lowercase words, do minor cleanup
  let formatted = str.replace(/_/g, ' ').replace(/-/g, ' ');

  // Split into words and convert to Title Case unless it's an acronym
  return formatted
    .split(' ')
    .filter(Boolean)
    .map((word) => {
      const upperWord = word.toUpperCase();
      if (KNOWN_ACRONYMS.has(upperWord)) {
        return upperWord;
      }
      if (word.length === 0) return '';
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * Shorter alias for formatEnum
 */
export const formatEnumLabel = formatEnum;

/**
 * Default fallback target examination when dynamic list is loading or empty.
 */
export const DEFAULT_TARGET_EXAMS = ['UPSC CSE'];
export const CANONICAL_TARGET_EXAMS = DEFAULT_TARGET_EXAMS;

// Lower-cased codes of the active exam types, filled by fetchActiveExamTypes. Mirrors the backend's
// load_exam_type_codes so exam labels on both sides agree.
let examTypeCodes = new Set<string>();

export function setExamTypeCodes(codes: string[]): void {
  examTypeCodes = new Set(codes.filter(Boolean).map((c) => c.toLowerCase()));
}

/**
 * The exam type code a name starts with, upper-cased ('MPSCPRE (2024) - Set A' -> 'MPSCPRE'), or null.
 * Paper names lead with their type code and the backend keeps that true when an admin renames the code.
 */
function examTypeCodeLabel(raw?: string | null): string | null {
  if (!raw || examTypeCodes.size === 0) return null;
  const match = String(raw).trim().match(/^[A-Za-z0-9_-]+/);
  if (!match) return null;
  const token = match[0].toLowerCase();
  for (const candidate of [token, token.split(/[-_]/)[0]]) {
    if (examTypeCodes.has(candidate)) {
      if (candidate === 'upsccse' || candidate === 'upsc') {
        return 'UPSC CSE';
      }
      return candidate.toUpperCase();
    }
  }
  return null;
}

/**
 * Extracts a clean canonical examination name from raw exam titles, codes, or database keys.
 * Names led by an active exam type code are labelled by that code ('MPSCPRE (2024) - Set A' -> 'MPSCPRE'),
 * and the legacy labels below collapse onto their type code ('UPSC CSE' -> 'UPSC') so old links still match.
 * Never returns raw PYQ codes, years, or set names.
 */
export function extractCanonicalExamName(raw?: string | null): string {
  if (!raw) return 'UPSC CSE';
  const clean = String(raw).trim();
  const lower = clean.toLowerCase();

  // Known canonical exam matches - always collapse UPSC variations to 'UPSC CSE'
  if (lower.includes('upsc') || lower.includes('upsccse') || lower.includes('civil services') || lower.includes('upse')) {
    return 'UPSC CSE';
  }

  const legacy = legacyCanonicalExamName(raw);
  const code = examTypeCodeLabel(raw) || examTypeCodeLabel(legacy);
  if (code && (code.toLowerCase() === 'upsccse' || code.toLowerCase() === 'upsc')) {
    return 'UPSC CSE';
  }
  return code || legacy;
}

/** The label of the default exam ('UPSC CSE' resolved through the exam type codes, e.g. 'UPSC'). */
export function defaultExamLabel(): string {
  return extractCanonicalExamName(DEFAULT_TARGET_EXAMS[0]);
}

/** Distinct exam labels, default exam first, the rest alphabetical. */
export function sortExamLabels(labels: string[]): string[] {
  const first = defaultExamLabel();
  return Array.from(new Set(labels)).sort((a, b) => (a === first ? -1 : b === first ? 1 : a.localeCompare(b)));
}

function legacyCanonicalExamName(raw?: string | null): string {
  if (!raw) return 'UPSC CSE';
  const clean = String(raw).trim();
  const lower = clean.toLowerCase();

  // Known canonical exam matches
  if (lower.includes('upsc') || lower.includes('civil services') || lower.includes('upse')) {
    return 'UPSC CSE';
  }
  if (lower.includes('mppsc')) return 'MPPSC';
  if (lower.includes('bpsc')) return 'BPSC';
  if (lower.includes('uppcs') || lower.includes('uppsc')) return 'UPPCS';
  if (lower.includes('mpsc')) return 'MPSC';
  if (lower.includes('ras') || lower.includes('rpsc')) return 'RPSC';
  if (lower.includes('kpsc')) return 'KPSC';
  if (lower.includes('wbcs') || lower.includes('wbpsc')) return 'WBPSC';
  if (lower.includes('tnpsc')) return 'TNPSC';
  if (lower.includes('ssc')) return 'SSC';

  if (clean === 'State PSC') return 'State PSC';

  // Explicitly block subject/topic names that were erroneously created as exams in the database
  const invalidNames = ['polity', 'geography', 'history', 'economy', 'science', 'environment', 'math', 'reasoning', 'english'];
  if (invalidNames.some(name => lower.includes(name)) || lower.includes('subject-wise')) {
    return 'UPSC CSE';
  }

  // Strip years, set codes, prelims, mains, gs paper tokens
  const stripped = clean
    .replace(/\s*\(\d{4}\).*$/i, '')
    .replace(/-\d{4}.*$/i, '')
    .replace(/-prelims.*$/i, '')
    .replace(/\s+prelims.*$/i, '')
    .replace(/-mains.*$/i, '')
    .replace(/\s+mains.*$/i, '')
    .replace(/\s+set\s+[a-z0-9]+/i, '')
    .replace(/-set_[a-z0-9]+/i, '')
    .replace(/_set_[a-z0-9]+/i, '')
    .replace(/-gs\d+.*$/i, '')
    .replace(/\s+gs\s*paper.*$/i, '')
    .trim();

  // If still looks like a code, slug, or is empty/too long, fallback safely to UPSC CSE
  if (!stripped || stripped.length > 25 || stripped.includes('-') || stripped.includes('_')) {
    return 'UPSC CSE';
  }

  return stripped.toUpperCase();
}

/**
 * Strips Set designations (e.g. "- Set A", "Set SET_A", "(Set B)", "_set_a")
 * and trailing punctuation from exam names for clean user-facing frontend display.
 */
export function cleanExamTitle(raw?: string | null): string {
  if (!raw) return '';
  return raw
    .replace(/\s*[-–—:]?\s*\(?Set\s+[A-Za-z0-9_]+\)?/gi, '')
    .replace(/[-_]set[-_][a-z0-9]+/gi, '')
    .replace(/\s*[-–—]\s*$/g, '')
    .trim();
}

/** "Year 2021" for a paper; "Mixed years (2011–2023)" for a mixed question bank, whose own year is a placeholder. */
export function examYearLabel(
  exam: { source_year?: number | null; is_mixed_bank?: boolean; question_years?: number[] } | null | undefined,
  fallback = '',
): string {
  if (!exam) return fallback;
  if (exam.is_mixed_bank) {
    const years = exam.question_years || [];
    if (years.length === 0) return 'Mixed years';
    const min = Math.min(...years);
    const max = Math.max(...years);
    return min === max ? `Mixed exams (${min})` : `Mixed years (${min}–${max})`;
  }
  return exam.source_year ? `Year ${exam.source_year}` : fallback;
}
