export interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
  enumName: string;
}

// Active languages with full translation coverage.
// Add more languages here once their translations are seeded in the DB.
export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English', nativeName: 'English', enumName: 'ENGLISH' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', enumName: 'HINDI' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी', enumName: 'MARATHI' },
];

export const LANGUAGE_MAP = new Map<string, LanguageOption>();
SUPPORTED_LANGUAGES.forEach((l) => {
  LANGUAGE_MAP.set(l.code.toLowerCase(), l);
  LANGUAGE_MAP.set(l.enumName.toUpperCase(), l);
  LANGUAGE_MAP.set(l.name.toLowerCase(), l);
});

/**
 * The student's secondary question language from their profile, or null when none is set.
 * English is always the primary language; sessions open in it and can switch to the secondary.
 */
export function getSecondaryLanguage(): string | null {
  let code: string | null = null;
  try {
    code = localStorage.getItem('preferred_language');
    if (!code) code = JSON.parse(localStorage.getItem('user') || '{}')?.preferred_language ?? null;
  } catch {
    // Storage unavailable (private mode): no secondary language
  }
  const lang = code ? SUPPORTED_LANGUAGES.find((l) => l.code === code!.trim().toLowerCase()) : undefined;
  return lang && lang.code !== 'en' ? lang.code : null;
}

export function getLanguageOption(codeOrEnum?: string | null): LanguageOption {
  if (!codeOrEnum) return SUPPORTED_LANGUAGES[0];
  const clean = codeOrEnum.trim().toLowerCase();
  return LANGUAGE_MAP.get(clean) || LANGUAGE_MAP.get(clean.toUpperCase()) || SUPPORTED_LANGUAGES[0];
}
