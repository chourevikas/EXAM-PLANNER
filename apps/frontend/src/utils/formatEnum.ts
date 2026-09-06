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
