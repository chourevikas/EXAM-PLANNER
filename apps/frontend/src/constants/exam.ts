export const EXAM_OPTIONS = [
  { value: 'upsc', label: 'UPSC (Civil Services)' },
] as const;

export const PAPER_TYPE_OPTIONS = [
  { value: 'previous_year_question', label: 'Previous Year Question (PYQ)' },
] as const;

const CURRENT_YEAR = new Date().getFullYear();

export const YEAR_OPTIONS: string[] = Array.from(
  { length: CURRENT_YEAR - 1900 + 1 },
  (_, i) => String(CURRENT_YEAR - i)
);

export interface YearGroup {
  label: string;
  options: string[];
}

export const GROUPED_YEAR_OPTIONS: YearGroup[] = (() => {
  const currentYear = CURRENT_YEAR;
  const groups: YearGroup[] = [];

  // Recent / current decade (e.g., 2020–present)
  const currentDecadeStart = Math.floor(currentYear / 10) * 10;
  groups.push({
    label: `Recent (${currentDecadeStart}–${currentYear})`,
    options: YEAR_OPTIONS.filter((y) => Number(y) >= currentDecadeStart),
  });

  // Decades from (currentDecadeStart - 10) down to 1900
  for (let decade = currentDecadeStart - 10; decade >= 1900; decade -= 10) {
    const end = decade + 9;
    const label = `${decade}s (${decade}–${end})`;
    const opts = YEAR_OPTIONS.filter((y) => {
      const num = Number(y);
      return num >= decade && num <= end;
    });
    if (opts.length > 0) {
      groups.push({ label, options: opts });
    }
  }

  return groups;
})();

export const SET_OPTIONS = [
  { value: 'SET_A', label: 'Set A' },
  { value: 'SET_B', label: 'Set B' },
  { value: 'SET_C', label: 'Set C' },
  { value: 'SET_D', label: 'Set D' },
] as const;
