import React, { createContext, useCallback, useContext } from 'react';

/**
 * Labels for the exam and practice screens in the session's language (English, Hindi, Marathi).
 *
 * The exam, practice and guest pages wrap their screen in <ExamLanguageProvider language=...>; the
 * shared exam components read their labels with useExamText(). Outside a provider (e.g. the
 * post-test report, which stays English) everything is English. A missing Hindi/Marathi label
 * falls back to English.
 */

const EN = {
  // Header
  timeRemaining: 'TIME REMAINING',
  submitTest: 'Submit Test',
  submit: 'Submit',
  submitting: 'Submitting...',
  fullScreen: 'Full Screen',
  exitFocus: 'Exit Focus',
  enterFullScreen: 'Enter Full Screen',
  exitFullScreen: 'Exit Full Screen',
  // Footer
  review: 'Review',
  openPalette: 'Open Question Palette',
  clear: 'Clear',
  clearResponse: 'Clear Response',
  mark: 'Mark',
  marked: 'Marked',
  markForReview: 'Mark for Review',
  submitAndShow: 'Submit & Show',
  solutionShown: 'Solution ✓',
  prev: 'Prev',
  next: 'Next',
  finish: 'Finish',
  // Confidence
  howSure: 'How sure?',
  howSureLong: 'How sure are you about this answer?',
  selectOptionFirst: 'Select an option first',
  sure: 'Sure',
  fiftyFifty: '50-50',
  guess: 'Guess',
  // Palette
  questionReview: 'Question Review',
  questions: 'Questions',
  answered: 'Answered',
  filterAll: 'All',
  filterUnanswered: 'Unans.',
  submitAndShowSolution: 'Submit & Show Solution',
  solutionRevealed: '✓ Solution Revealed',
  closePalette: 'Close question palette',
  finishAndView: 'Finish & View Diagnosis',
  // Submit dialog
  submitConfirmTitle: 'Submit Test Confirmation',
  submitConfirmBody: 'Are you sure you want to finish and submit your exam?',
  forReview: 'Review',
  left: 'Left',
  resumeTest: 'Resume Test',
  confirmSubmit: 'Confirm Submit',
  // Question card
  questionNumberOf: 'QUESTION {n} OF {total}',
  questionNumber: 'QUESTION {n}',
  EASY: 'EASY',
  MEDIUM: 'MEDIUM',
  HARD: 'HARD',
  loadingSolution: 'Loading solution...',
  showSolution: 'Show Solution',
  hideSolution: 'Hide Solution',
  bookmarkQuestion: 'Bookmark Question',
  removeBookmark: 'Remove Bookmark',
  reportProblem: 'Report a problem with this question',
  notInLanguage: 'This question isn’t available in {language} yet, so it’s shown in English.',
  // Solution card
  loadingFullSolution: 'Loading Comprehensive Solution & Distractor Analysis...',
  optionIsCorrect: 'Option ({label}) is Correct',
  yourSelection: '(Your selection: Option {label})',
  solutionSubtitle: 'Comprehensive Solution & Distractor Evaluation',
  EASY_TIER: 'Easy Tier',
  MEDIUM_TIER: 'Medium Tier',
  HARD_TIER: 'Hard Tier',
  detailedExplanation: 'Detailed Explanation & Reference',
  optionReasoning: 'Option-by-Option Reasoning',
  optionAnalysis: 'Option-by-Option Analysis',
  correctKey: 'Correct Key',
  distractor: 'Distractor',
  thisIsCorrect: 'This is the correct answer.',
  thisIsIncorrect: 'This option is incorrect.',
  officialAnswerKeyConfirmed: 'Official answer key confirmed from source question paper.',
  commonTraps: 'Common Exam Traps & Pitfalls',
  cognitiveSkill: 'Cognitive Skill',
  // Pages
  freePlanLeft: 'Free plan: {remaining} of {limit} questions left today',
  loadingQuestion: 'Loading question #{n}...',
};

export type ExamTextKey = keyof typeof EN;

const HI: Partial<Record<ExamTextKey, string>> = {
  timeRemaining: 'शेष समय',
  submitTest: 'टेस्ट जमा करें',
  submit: 'जमा करें',
  submitting: 'जमा हो रहा है...',
  fullScreen: 'फ़ुल स्क्रीन',
  exitFocus: 'फ़ुल स्क्रीन बंद करें',
  enterFullScreen: 'फ़ुल स्क्रीन करें',
  exitFullScreen: 'फ़ुल स्क्रीन बंद करें',
  review: 'समीक्षा',
  openPalette: 'प्रश्न सूची खोलें',
  clear: 'हटाएँ',
  clearResponse: 'उत्तर हटाएँ',
  mark: 'मार्क करें',
  marked: 'मार्क किया',
  markForReview: 'समीक्षा के लिए मार्क करें',
  submitAndShow: 'जमा करें व हल देखें',
  solutionShown: 'हल ✓',
  prev: 'पिछला',
  next: 'अगला',
  finish: 'समाप्त',
  howSure: 'कितने निश्चित?',
  howSureLong: 'इस उत्तर को लेकर आप कितने निश्चित हैं?',
  selectOptionFirst: 'पहले कोई विकल्प चुनें',
  sure: 'निश्चित',
  fiftyFifty: '50-50',
  guess: 'अनुमान',
  questionReview: 'प्रश्नों की समीक्षा',
  questions: 'प्रश्न',
  answered: 'उत्तर दिए',
  filterAll: 'सभी',
  filterUnanswered: 'बाकी',
  submitAndShowSolution: 'जमा करें व हल देखें',
  solutionRevealed: '✓ हल दिखाया गया',
  closePalette: 'प्रश्न सूची बंद करें',
  finishAndView: 'समाप्त करें व परिणाम देखें',
  submitConfirmTitle: 'टेस्ट जमा करने की पुष्टि',
  submitConfirmBody: 'क्या आप टेस्ट समाप्त करके जमा करना चाहते हैं?',
  forReview: 'समीक्षा हेतु',
  left: 'बाकी',
  resumeTest: 'टेस्ट जारी रखें',
  confirmSubmit: 'पुष्टि करें व जमा करें',
  questionNumberOf: 'प्रश्न {n} / {total}',
  questionNumber: 'प्रश्न {n}',
  EASY: 'आसान',
  MEDIUM: 'मध्यम',
  HARD: 'कठिन',
  loadingSolution: 'हल लोड हो रहा है...',
  showSolution: 'हल देखें',
  hideSolution: 'हल छिपाएँ',
  bookmarkQuestion: 'बुकमार्क करें',
  removeBookmark: 'बुकमार्क हटाएँ',
  reportProblem: 'इस प्रश्न में समस्या बताएँ',
  notInLanguage: 'यह प्रश्न अभी हिंदी में उपलब्ध नहीं है, इसलिए अंग्रेज़ी में दिखाया गया है।',
  loadingFullSolution: 'विस्तृत हल लोड हो रहा है...',
  optionIsCorrect: 'विकल्प ({label}) सही है',
  yourSelection: '(आपका चयन: विकल्प {label})',
  solutionSubtitle: 'विस्तृत हल और विकल्पों का विश्लेषण',
  EASY_TIER: 'आसान स्तर',
  MEDIUM_TIER: 'मध्यम स्तर',
  HARD_TIER: 'कठिन स्तर',
  detailedExplanation: 'विस्तृत व्याख्या',
  optionReasoning: 'हर विकल्प का तर्क',
  optionAnalysis: 'हर विकल्प का विश्लेषण',
  correctKey: 'सही उत्तर',
  distractor: 'भ्रामक विकल्प',
  thisIsCorrect: 'यह सही उत्तर है।',
  thisIsIncorrect: 'यह विकल्प गलत है।',
  officialAnswerKeyConfirmed: 'मूल प्रश्नपत्रिका से आधिकारिक उत्तर कुंजी की पुष्टि।',
  commonTraps: 'परीक्षा में होने वाली आम गलतियाँ',
  cognitiveSkill: 'संज्ञानात्मक कौशल',
  freePlanLeft: 'फ़्री प्लान: आज {limit} में से {remaining} प्रश्न बाकी',
  loadingQuestion: 'प्रश्न #{n} लोड हो रहा है...',
};

const MR: Partial<Record<ExamTextKey, string>> = {
  timeRemaining: 'उरलेला वेळ',
  submitTest: 'चाचणी सबमिट करा',
  submit: 'सबमिट करा',
  submitting: 'सबमिट होत आहे...',
  fullScreen: 'फुल स्क्रीन',
  exitFocus: 'फुल स्क्रीन बंद करा',
  enterFullScreen: 'फुल स्क्रीन करा',
  exitFullScreen: 'फुल स्क्रीन बंद करा',
  review: 'आढावा',
  openPalette: 'प्रश्न सूची उघडा',
  clear: 'काढा',
  clearResponse: 'उत्तर काढा',
  mark: 'मार्क करा',
  marked: 'मार्क केले',
  markForReview: 'आढाव्यासाठी मार्क करा',
  submitAndShow: 'सबमिट करा व उत्तर पहा',
  solutionShown: 'स्पष्टीकरण ✓',
  prev: 'मागील',
  next: 'पुढील',
  finish: 'पूर्ण करा',
  howSure: 'किती खात्री?',
  howSureLong: 'या उत्तराबद्दल तुम्हाला किती खात्री आहे?',
  selectOptionFirst: 'आधी एक पर्याय निवडा',
  sure: 'खात्री',
  fiftyFifty: '50-50',
  guess: 'अंदाज',
  questionReview: 'प्रश्नांचा आढावा',
  questions: 'प्रश्न',
  answered: 'उत्तर दिलेले',
  filterAll: 'सर्व',
  filterUnanswered: 'बाकी',
  submitAndShowSolution: 'सबमिट करा व स्पष्टीकरण पहा',
  solutionRevealed: '✓ स्पष्टीकरण दाखवले',
  closePalette: 'प्रश्न सूची बंद करा',
  finishAndView: 'पूर्ण करा व निकाल पहा',
  submitConfirmTitle: 'चाचणी सबमिट करण्याची खात्री',
  submitConfirmBody: 'तुम्हाला चाचणी पूर्ण करून सबमिट करायची आहे का?',
  forReview: 'आढाव्यासाठी',
  left: 'बाकी',
  resumeTest: 'चाचणी सुरू ठेवा',
  confirmSubmit: 'खात्री करून सबमिट करा',
  questionNumberOf: 'प्रश्न {n} / {total}',
  questionNumber: 'प्रश्न {n}',
  EASY: 'सोपा',
  MEDIUM: 'मध्यम',
  HARD: 'कठीण',
  loadingSolution: 'स्पष्टीकरण लोड होत आहे...',
  showSolution: 'स्पष्टीकरण पहा',
  hideSolution: 'स्पष्टीकरण लपवा',
  bookmarkQuestion: 'बुकमार्क करा',
  removeBookmark: 'बुकमार्क काढा',
  reportProblem: 'या प्रश्नातील त्रुटी कळवा',
  notInLanguage: 'हा प्रश्न अजून मराठीत उपलब्ध नाही, म्हणून इंग्रजीत दाखवला आहे.',
  loadingFullSolution: 'सविस्तर स्पष्टीकरण लोड होत आहे...',
  optionIsCorrect: 'पर्याय ({label}) बरोबर आहे',
  yourSelection: '(तुमची निवड: पर्याय {label})',
  solutionSubtitle: 'सविस्तर स्पष्टीकरण आणि पर्यायांचे विश्लेषण',
  EASY_TIER: 'सोपी पातळी',
  MEDIUM_TIER: 'मध्यम पातळी',
  HARD_TIER: 'कठीण पातळी',
  detailedExplanation: 'सविस्तर स्पष्टीकरण',
  optionReasoning: 'प्रत्येक पर्यायाचे कारण',
  optionAnalysis: 'प्रत्येक पर्यायाचे विश्लेषण',
  correctKey: 'बरोबर उत्तर',
  distractor: 'दिशाभूल करणारा पर्याय',
  thisIsCorrect: 'हे बरोबर उत्तर आहे.',
  thisIsIncorrect: 'हा पर्याय चुकीचा आहे.',
  officialAnswerKeyConfirmed: 'मूळ प्रश्नपत्रिकेवरून अधिकृत उत्तरसूचीची पुष्टी.',
  commonTraps: 'परीक्षेतील नेहमीच्या चुका',
  cognitiveSkill: 'बौद्धिक कौशल्य',
  freePlanLeft: 'फ्री प्लॅन: आज {limit} पैकी {remaining} प्रश्न बाकी',
  loadingQuestion: 'प्रश्न #{n} लोड होत आहे...',
};

const TABLES: Record<string, Partial<Record<ExamTextKey, string>>> = { en: EN, hi: HI, mr: MR };

/** The label in `language` (en / hi / mr), English when it has none; {name} placeholders filled from vars. */
export function examText(language: string, key: ExamTextKey, vars?: Record<string, string | number>): string {
  const code = (language || 'en').toLowerCase();
  let text = TABLES[code]?.[key] ?? EN[key];
  if (vars) {
    for (const [name, value] of Object.entries(vars)) text = text.split(`{${name}}`).join(String(value));
  }
  return text;
}

const ExamLanguageContext = createContext<string>('en');

export function ExamLanguageProvider({ language, children }: { language: string; children: React.ReactNode }) {
  return <ExamLanguageContext.Provider value={language || 'en'}>{children}</ExamLanguageContext.Provider>;
}

/** The session language and a label lookup for it. */
export function useExamText() {
  const language = useContext(ExamLanguageContext);
  const t = useCallback(
    (key: ExamTextKey, vars?: Record<string, string | number>) => examText(language, key, vars),
    [language],
  );
  return { t, language };
}
