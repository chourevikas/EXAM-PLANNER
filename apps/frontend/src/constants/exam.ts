export const EXAM_OPTIONS = [
  { value: 'upsc', label: 'UPSC (Civil Services)' },
  { value: 'mppsc', label: 'MPPSC (State Services)' },
  { value: 'mpsc', label: 'MPSC (Maharashtra Services)' },
] as const;

export const PAPER_TYPE_OPTIONS = [
  { value: 'previous_year_question', label: 'Previous Year Question (PYQ)' },
  { value: 'mock_test', label: 'Mock Test' },
] as const;

export const YEAR_OPTIONS = Array.from({ length: 15 }, (_, i) => String(2024 - i));

export const SET_OPTIONS = [
  { value: 'SET_A', label: 'Set A' },
  { value: 'SET_B', label: 'Set B' },
  { value: 'SET_C', label: 'Set C' },
  { value: 'SET_D', label: 'Set D' },
] as const;
