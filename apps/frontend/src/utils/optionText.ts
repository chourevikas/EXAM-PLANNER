/**
 * Drops the option's own label when it is repeated in its text ("(A) Jain monks" on option A).
 * Lowercase "(a)"-"(d)" are statement references in answer combinations ("(a) and (b)",
 * "(a), (b) and (c)"), so only the option's exact label is removed, and never when the rest
 * reads as a combination ("(A) and (B) only").
 */
export function stripRepeatedOptionLabel(text: string, label?: string): string {
  const key = String(label || '').replace(/[^A-D1-4]/g, '');
  if (key.length !== 1) return text;
  const stripped = text.replace(new RegExp(`^(?:[\\(\\[]${key}[\\)\\]]\\s*|${key}[\\)\\.:]\\s+)`), '');
  if (stripped === text || /^(?:and\b|or\b|only\b|&|,|\/)/i.test(stripped)) return text;
  return stripped;
}
