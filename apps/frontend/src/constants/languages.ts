export interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
  enumName: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English', nativeName: 'English', enumName: 'ENGLISH' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', enumName: 'HINDI' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', enumName: 'BENGALI' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', enumName: 'TELUGU' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी', enumName: 'MARATHI' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', enumName: 'TAMIL' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو', enumName: 'URDU' },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી', enumName: 'GUJARATI' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', enumName: 'KANNADA' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം', enumName: 'MALAYALAM' },
  { code: 'or', name: 'Odia', nativeName: 'ଓଡ଼ିଆ', enumName: 'ODIA' },
  { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', enumName: 'PUNJABI' },
  { code: 'as', name: 'Assamese', nativeName: 'অসমীয়া', enumName: 'ASSAMESE' },
  { code: 'ma', name: 'Maithili', nativeName: 'मैथिली', enumName: 'MAITHILI' },
  { code: 'sa', name: 'Sanskrit', nativeName: 'संस्कृतम्', enumName: 'SANSKRIT' },
  { code: 'sat', name: 'Santali', nativeName: 'ᱥᱟᱱᱛᱟᱲᱤ', enumName: 'SANTALI' },
  { code: 'ks', name: 'Kashmiri', nativeName: 'कॉशुर / کٲشُر', enumName: 'KASHMIRI' },
  { code: 'ne', name: 'Nepali', nativeName: 'नेपाली', enumName: 'NEPALI' },
  { code: 'sd', name: 'Sindhi', nativeName: 'سنڌي / सिन्धी', enumName: 'SINDHI' },
  { code: 'gom', name: 'Konkani', nativeName: 'कोंकणी', enumName: 'KONKANI' },
  { code: 'doi', name: 'Dogri', nativeName: 'डोगरी', enumName: 'DOGRI' },
  { code: 'mni', name: 'Manipuri', nativeName: 'ꯃꯤꯇꯩꯂꯣꯟ', enumName: 'MANIPURI' },
  { code: 'brx', name: 'Bodo', nativeName: 'बर’', enumName: 'BODO' },
];

export const LANGUAGE_MAP = new Map<string, LanguageOption>();
SUPPORTED_LANGUAGES.forEach((l) => {
  LANGUAGE_MAP.set(l.code.toLowerCase(), l);
  LANGUAGE_MAP.set(l.enumName.toUpperCase(), l);
  LANGUAGE_MAP.set(l.name.toLowerCase(), l);
});

export function getLanguageOption(codeOrEnum?: string | null): LanguageOption {
  if (!codeOrEnum) return SUPPORTED_LANGUAGES[0];
  const clean = codeOrEnum.trim().toLowerCase();
  return LANGUAGE_MAP.get(clean) || LANGUAGE_MAP.get(clean.toUpperCase()) || SUPPORTED_LANGUAGES[0];
}
