"""
22 Official Scheduled Indian Languages (8th Schedule of the Constitution of India) + English.
Provides ISO-639 codes, Database Enum mappings, English names, native script labels,
and flexible normalization utilities.
"""


class LanguageInfo:
    def __init__(
        self,
        code: str,
        enum_name: str,
        name: str,
        native_name: str,
        google_code: str,
    ):
        self.code = code.lower()  # ISO code e.g. "hi"
        self.enum_name = enum_name.upper()  # DB Enum name e.g. "HINDI"
        self.name = name  # English name e.g. "Hindi"
        self.native_name = native_name  # Native script e.g. "हिन्दी"
        self.google_code = google_code  # Google Cloud Translation code e.g. "hi"

    def to_dict(self) -> dict[str, str]:
        return {
            "code": self.code,
            "enum_name": self.enum_name,
            "name": self.name,
            "native_name": self.native_name,
            "google_code": self.google_code,
        }


# The 22 Scheduled Indian Languages + English
SUPPORTED_LANGUAGES_LIST: list[LanguageInfo] = [
    LanguageInfo("en", "ENGLISH", "English", "English", "en"),
    LanguageInfo("as", "ASSAMESE", "Assamese", "অসমীয়া", "as"),
    LanguageInfo("bn", "BENGALI", "Bengali", "বাংলা", "bn"),
    LanguageInfo("brx", "BODO", "Bodo", "बड़ो", "brx"),
    LanguageInfo("doi", "DOGRI", "Dogri", "डोगरी", "doi"),
    LanguageInfo("gu", "GUJARATI", "Gujarati", "ગુજરાતી", "gu"),
    LanguageInfo("hi", "HINDI", "Hindi", "हिन्दी", "hi"),
    LanguageInfo("kn", "KANNADA", "Kannada", "ಕನ್ನಡ", "kn"),
    LanguageInfo("ks", "KASHMIRI", "Kashmiri", "کٲشُر / डोगरी", "ks"),
    LanguageInfo("gom", "KONKANI", "Konkani", "कोंकणी", "gom"),
    LanguageInfo("mai", "MAITHILI", "Maithili", "मैथिली", "mai"),
    LanguageInfo("ml", "MALAYALAM", "Malayalam", "മലയാളം", "ml"),
    LanguageInfo("mni", "MANIPURI", "Manipuri", "মৈতৈলোন্", "mni"),
    LanguageInfo("mr", "MARATHI", "Marathi", "मराठी", "mr"),
    LanguageInfo("ne", "NEPALI", "Nepali", "नेपाली", "ne"),
    LanguageInfo("or", "ODIA", "Odia", "ଓଡ଼ିଆ", "or"),
    LanguageInfo("pa", "PUNJABI", "Punjabi", "ਪੰਜਾਬੀ", "pa"),
    LanguageInfo("sa", "SANSKRIT", "Sanskrit", "संस्कृतम्", "sa"),
    LanguageInfo("sat", "SANTALI", "Santali", "ᱥᱟᱱᱛᱟᱲᱤ", "sat"),
    LanguageInfo("sd", "SINDHI", "Sindhi", "سنڌي / सिन्धी", "sd"),
    LanguageInfo("ta", "TAMIL", "Tamil", "தமிழ்", "ta"),
    LanguageInfo("te", "TELUGU", "Telugu", "తెలుగు", "te"),
    LanguageInfo("ur", "URDU", "Urdu", "اردو", "ur"),
]

# Quick lookup indexes
_BY_CODE: dict[str, LanguageInfo] = {l.code: l for l in SUPPORTED_LANGUAGES_LIST}
_BY_ENUM: dict[str, LanguageInfo] = {l.enum_name: l for l in SUPPORTED_LANGUAGES_LIST}
_BY_NAME: dict[str, LanguageInfo] = {l.name.lower(): l for l in SUPPORTED_LANGUAGES_LIST}
_BY_GOOGLE: dict[str, LanguageInfo] = {l.google_code: l for l in SUPPORTED_LANGUAGES_LIST}

# Aliases for common variations
_ALIASES: dict[str, str] = {
    "meitei": "mni",
    "manipuri": "mni",
    "oriya": "or",
    "odia": "or",
    "punjabi": "pa",
    "panjabi": "pa",
    "bodo": "brx",
    "dogri": "doi",
    "ma": "mai",
    "konkani": "gom",
    "santali": "sat",
    "sindhi": "sd",
    "bilingual": "en",
}


def normalize_language(lang_input: str | None) -> tuple[str, str]:
    """
    Normalizes any language string (code, enum name, or common name)
    into a standardized tuple: (iso_code, enum_name).
    Defaults to ('en', 'ENGLISH') if unrecognized or omitted.
    """
    if not lang_input:
        return ("en", "ENGLISH")

    if hasattr(lang_input, "value"):
        clean = str(lang_input.value).strip().lower()
    else:
        raw_str = str(lang_input).strip().lower()
        if "." in raw_str:
            raw_str = raw_str.split(".")[-1]
        clean = raw_str

    # Check aliases
    if clean in _ALIASES:
        clean = _ALIASES[clean]

    # Check by ISO code
    if clean in _BY_CODE:
        info = _BY_CODE[clean]
        return (info.code, info.enum_name)

    # Check by Enum uppercase
    upper = clean.upper()
    if upper in _BY_ENUM:
        info = _BY_ENUM[upper]
        return (info.code, info.enum_name)

    # Check by English name
    if clean in _BY_NAME:
        info = _BY_NAME[clean]
        return (info.code, info.enum_name)

    # Check by Google code
    if clean in _BY_GOOGLE:
        info = _BY_GOOGLE[clean]
        return (info.code, info.enum_name)

    return ("en", "ENGLISH")


def get_language_info(lang_input: str | None) -> LanguageInfo:
    """Returns the full LanguageInfo for a language input, defaulting to English."""
    code, _ = normalize_language(lang_input)
    return _BY_CODE.get(code, _BY_CODE["en"])


def is_supported_language(lang_input: str | None) -> bool:
    """Returns True if the given string is a recognized supported language."""
    if not lang_input:
        return False
    clean = str(lang_input).strip().lower()
    if clean in _ALIASES:
        return True
    return clean in _BY_CODE or clean.upper() in _BY_ENUM or clean in _BY_NAME


def get_22_indian_languages() -> list[LanguageInfo]:
    """Returns the list of 22 Indian scheduled languages (excluding English)."""
    return [l for l in SUPPORTED_LANGUAGES_LIST if l.code != "en"]


def get_all_supported_languages() -> list[dict[str, str]]:
    """Returns all supported languages as serializable dicts."""
    return [l.to_dict() for l in SUPPORTED_LANGUAGES_LIST]
