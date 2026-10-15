// Option lists shared by the first-login onboarding and the profile page.

const thisYear = new Date().getFullYear();

/** Attempt years a student can target: this year plus the next three. */
export const TARGET_YEAR_OPTIONS: string[] = Array.from({ length: 4 }, (_, i) => String(thisYear + i));

export const WEEKLY_HOURS_OPTIONS: { value: string; label: string }[] = [
  { value: '15', label: '15 Hours / Week (Light)' },
  { value: '25', label: '25 Hours / Week (Part-Time / Working)' },
  { value: '35', label: '35 Hours / Week (Standard Dedicated)' },
  { value: '45', label: '45 Hours / Week (Intense Full-Time)' },
];

export const PROFICIENCY_LABELS: Record<number, string> = {
  1: 'Just starting',
  2: 'Basics only',
  3: 'Comfortable',
  4: 'Strong',
  5: 'Expert',
};

/** Used when the taxonomy endpoint returns nothing. */
export const FALLBACK_SUBJECTS: string[] = [
  'History',
  'Geography',
  'Polity',
  'Economy',
  'Ecology & Environment',
  'Science & Technology',
  'Current Affairs',
];
