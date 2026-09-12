import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ExamHeader } from '../components/exam/ExamHeader';
import { ExamQuestionCard } from '../components/exam/ExamQuestionCard';
import { GuestScoreModal } from '../components/exam/GuestScoreModal';
import { ExamLoaderOverlay } from '../components/exam/ExamLoaderOverlay';
import { RecommendedQuestionsPanel, ExamFilterToggles } from '../components/exam/RecommendedQuestionsPanel';
import { QuestionSolutionData } from '../components/exam/QuestionSolutionMarkdownCard';
import {
  Loader2,
  AlertCircle,
  ArrowLeft,
  RotateCcw,
  Search,
  ChevronDown,
  ChevronRight,
  Check,
  SlidersHorizontal,
  GraduationCap,
  X,
  Lightbulb,
  Focus,
  Minimize2,
  Globe,
} from 'lucide-react';
import { SUPPORTED_LANGUAGES } from '../constants/languages';
import { QuestionOut, QuestionPaletteItem, RevealAnswerResponse } from '../types/exam';
import { saveGuestAttempt } from '../utils/guestStorage';
import { fetchMasterSyllabus, fetchExamsByYear, verifySyllabusNode, listExams } from '../services/examService';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { formatEnum, extractCanonicalExamName } from '../utils/formatEnum';
import { guardedFetch } from '../utils/apiGuard';

export function GuestExamPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // URL Params (Max 10 questions allowed)
  const gExam = searchParams.get('exam') || 'UPSC CSE';
  const gYear = searchParams.get('year') || '';
  const gSubject = searchParams.get('subject') || '';
  const gTopic = searchParams.get('topic') || '';
  const gSubtopic = searchParams.get('subtopic') || '';
  const gDifficulty = searchParams.get('difficulty') || '';
  const rawCount = parseInt(searchParams.get('count') || '10', 10);
  const gCount = Math.min(10, Math.max(1, rawCount));

  const isExamLocked = searchParams.get('locked') === 'true';

  // Dynamic 3-level taxonomy fetched directly from Syllabus API (/api/v1/syllabus)
  const [masterSubjects, setMasterSubjects] = useState<any[]>([]);
  const [subjectsList, setSubjectsList] = useState<string[]>([]);
  const [threeLevelHierarchy, setThreeLevelHierarchy] = useState<
    Record<string, Record<string, string[]>>
  >({});
  const [availableYearsList, setAvailableYearsList] = useState<number[]>([]);
  const [availableExams, setAvailableExams] = useState<string[]>(['UPSC CSE']);

  // Computed dynamic list of subjects directly from live master syllabus hierarchy
  const availableSubjectsList = useMemo(() => {
    if (subjectsList && subjectsList.length > 0) {
      return Array.from(new Set(subjectsList.filter((s) => s !== 'All Subjects'))).sort();
    }
    if (threeLevelHierarchy && Object.keys(threeLevelHierarchy).length > 0) {
      return Object.keys(threeLevelHierarchy).sort();
    }
    return [];
  }, [subjectsList, threeLevelHierarchy]);

  // Selected Multi-Select Arrays derived from URL parameters
  const selectedSubjectsList = useMemo(() => {
    if (!gSubject || gSubject.startsWith('All Subjects')) return [];
    return gSubject.split(',').map((s) => s.trim()).filter(Boolean);
  }, [gSubject]);

  const selectedTopicsList = useMemo(() => {
    if (!gTopic || gTopic.startsWith('All Topics')) return [];
    return gTopic.split(',').map((t) => t.trim()).filter(Boolean);
  }, [gTopic]);

  const selectedSubtopicsList = useMemo(() => {
    if (!gSubtopic || gSubtopic.startsWith('All Subtopics')) return [];
    return gSubtopic.split(',').map((st) => st.trim()).filter(Boolean);
  }, [gSubtopic]);

  // Computed dynamic list of topics based on selected subjects
  const availableTopicsList = useMemo(() => {
    const topicsSet = new Set<string>();
    if (selectedSubjectsList.length === 0) {
      Object.values(threeLevelHierarchy).forEach((topicsMap) => {
        if (topicsMap && typeof topicsMap === 'object') {
          Object.keys(topicsMap).forEach((t) => topicsSet.add(t));
        }
      });
    } else {
      selectedSubjectsList.forEach((subj) => {
        const topicsMap = threeLevelHierarchy[subj];
        if (topicsMap && typeof topicsMap === 'object') {
          Object.keys(topicsMap).forEach((t) => topicsSet.add(t));
        }
      });
    }
    return Array.from(topicsSet).sort();
  }, [selectedSubjectsList, threeLevelHierarchy]);

  // Computed dynamic list of subtopics based on selected subjects and topics
  const availableSubtopicsList = useMemo(() => {
    const subSet = new Set<string>();
    if (selectedTopicsList.length > 0) {
      if (selectedSubjectsList.length > 0) {
        selectedSubjectsList.forEach((subj) => {
          const topicsMap = threeLevelHierarchy[subj] || {};
          selectedTopicsList.forEach((top) => {
            const list = topicsMap[top];
            if (Array.isArray(list)) {
              list.forEach((st) => {
                if (!st.startsWith('All Subtopics')) subSet.add(st);
              });
            }
          });
        });
      } else {
        Object.values(threeLevelHierarchy).forEach((topicsMap) => {
          if (topicsMap && typeof topicsMap === 'object') {
            selectedTopicsList.forEach((top) => {
              const list = topicsMap[top];
              if (Array.isArray(list)) {
                list.forEach((st) => {
                  if (!st.startsWith('All Subtopics')) subSet.add(st);
                });
              }
            });
          }
        });
      }
    } else if (selectedSubjectsList.length > 0) {
      selectedSubjectsList.forEach((subj) => {
        const topicsMap = threeLevelHierarchy[subj] || {};
        Object.values(topicsMap).forEach((subList) => {
          if (Array.isArray(subList)) {
            subList.forEach((st) => {
              if (!st.startsWith('All Subtopics')) subSet.add(st);
            });
          }
        });
      });
    } else {
      Object.values(threeLevelHierarchy).forEach((topicsMap) => {
        if (topicsMap && typeof topicsMap === 'object') {
          Object.values(topicsMap).forEach((subList) => {
            if (Array.isArray(subList)) {
              subList.forEach((st) => {
                if (!st.startsWith('All Subtopics')) subSet.add(st);
              });
            }
          });
        }
      });
    }
    return Array.from(subSet).sort();
  }, [selectedSubjectsList, selectedTopicsList, threeLevelHierarchy]);

  // Multi-Select Toggle & Select All Helpers
  const toggleSubjectFilter = (subjectName: string) => {
    const current = new URLSearchParams(searchParams);
    if (subjectName === 'All Subjects') {
      current.delete('subject');
      current.delete('topic');
      current.delete('subtopic');
    } else {
      let updated: string[];
      if (selectedSubjectsList.includes(subjectName)) {
        updated = selectedSubjectsList.filter((s) => s !== subjectName);
      } else {
        updated = [...selectedSubjectsList, subjectName];
      }
      if (updated.length === 0) {
        current.delete('subject');
      } else {
        current.set('subject', updated.join(','));
      }
      current.delete('topic');
      current.delete('subtopic');
    }
    navigate(`/guest-exam?${current.toString()}`);
  };

  const selectAllSubjects = () => {
    const current = new URLSearchParams(searchParams);
    if (availableSubjectsList.length > 0) {
      current.set('subject', availableSubjectsList.join(','));
    } else {
      current.delete('subject');
    }
    current.delete('topic');
    current.delete('subtopic');
    navigate(`/guest-exam?${current.toString()}`);
  };

  const toggleTopicFilter = (topicName: string) => {
    const current = new URLSearchParams(searchParams);
    if (topicName === 'All Topics') {
      current.delete('topic');
      current.delete('subtopic');
    } else {
      let updated: string[];
      if (selectedTopicsList.includes(topicName)) {
        updated = selectedTopicsList.filter((t) => t !== topicName);
      } else {
        updated = [...selectedTopicsList, topicName];
      }
      if (updated.length === 0) {
        current.delete('topic');
      } else {
        current.set('topic', updated.join(','));
      }
      current.delete('subtopic');
    }
    navigate(`/guest-exam?${current.toString()}`);
  };

  const selectAllTopics = () => {
    const current = new URLSearchParams(searchParams);
    if (availableTopicsList.length > 0) {
      current.set('topic', availableTopicsList.join(','));
    } else {
      current.delete('topic');
    }
    current.delete('subtopic');
    navigate(`/guest-exam?${current.toString()}`);
  };

  const toggleSubtopicFilter = (subtopicName: string) => {
    const current = new URLSearchParams(searchParams);
    if (subtopicName === 'All Subtopics') {
      current.delete('subtopic');
    } else {
      let updated: string[];
      if (selectedSubtopicsList.includes(subtopicName)) {
        updated = selectedSubtopicsList.filter((st) => st !== subtopicName);
      } else {
        updated = [...selectedSubtopicsList, subtopicName];
      }
      if (updated.length === 0) {
        current.delete('subtopic');
      } else {
        current.set('subtopic', updated.join(','));
      }
    }
    navigate(`/guest-exam?${current.toString()}`);
  };

  const selectAllSubtopics = () => {
    const current = new URLSearchParams(searchParams);
    if (availableSubtopicsList.length > 0) {
      current.set('subtopic', availableSubtopicsList.join(','));
    } else {
      current.delete('subtopic');
    }
    navigate(`/guest-exam?${current.toString()}`);
  };

  // Fetch dynamic master syllabus taxonomy (/api/v1/syllabus) & exams by year (/api/v1/exams/by-year)
  useEffect(() => {
    async function loadTaxonomyAndYears() {
      try {
        const [syllabusData, yearsData, publishedExams] = await Promise.all([
          fetchMasterSyllabus().catch(() => null),
          fetchExamsByYear().catch(() => null),
          listExams('PUBLISHED').catch(() => []),
        ]);
        if (syllabusData) {
          if (
            syllabusData.subjects &&
            Array.isArray(syllabusData.subjects) &&
            syllabusData.subjects.length > 0
          ) {
            setMasterSubjects(syllabusData.subjects);
          }
          if (syllabusData.subjects_list && Array.isArray(syllabusData.subjects_list)) {
            const cleanSubs = syllabusData.subjects_list.filter(
              (s: string) => s !== 'All Subjects' && s.trim() !== '',
            );
            if (cleanSubs.length > 0) {
              setSubjectsList(cleanSubs);
            }
          }
          if (syllabusData.hierarchy && typeof syllabusData.hierarchy === 'object') {
            setThreeLevelHierarchy(syllabusData.hierarchy);
          }
        }

        if (yearsData && Array.isArray(yearsData.years)) {
          setAvailableYearsList(yearsData.years);
        }
        if (publishedExams && publishedExams.length > 0) {
          const dynamicExams = publishedExams
            .map((e: any) => extractCanonicalExamName(e.name || e.title || e.exam_name || e.code))
            .filter(Boolean);
          const names = Array.from(new Set(dynamicExams)) as string[];
          names.sort((a, b) => (a === 'UPSC CSE' ? -1 : b === 'UPSC CSE' ? 1 : a.localeCompare(b)));
          if (names.length > 0) setAvailableExams(names);
        }
      } catch (err) {
        console.warn('Failed to fetch syllabus taxonomy or exam years:', err);
      }
    }
    loadTaxonomyAndYears();
  }, []);

  // Session State
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(gCount);
  const [timeLeft, setTimeLeft] = useState(gCount * 120);
  const [language, setLanguage] = useState<string>(() => {
    return localStorage.getItem('preferred_language') || 'en';
  });

  const [paletteFilter, setPaletteFilter] = useState<'all' | 'answered' | 'marked' | 'unanswered'>(
    'all',
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isFilterRefreshing, setIsFilterRefreshing] = useState(false);
  const isInitialLoadRef = React.useRef(true);

  // Collapsible Left Drawer State (CLOSED BY DEFAULT)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Question & Response Data
  const [allQuestions, setAllQuestions] = useState<QuestionOut[]>([]);
  const [activeQuestion, setActiveQuestion] = useState<QuestionOut | null>(null);
  const [userResponses, setUserResponses] = useState<
    Record<string | number, { optionId: number | string; optionLabel: string }>
  >({});
  const [revealedMap, setRevealedMap] = useState<Record<string, RevealAnswerResponse>>({});
  const [isSolutionLoading, setIsSolutionLoading] = useState(false);
  const [markedForReview, setMarkedForReview] = useState<Record<string, boolean>>({});
  const [bookmarkedQs, setBookmarkedQs] = useState<Record<number, boolean>>({});
  const [palette, setPalette] = useState<QuestionPaletteItem[]>([]);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [guestScoreData, setGuestScoreData] = useState<any>(null);
  const [scoreCountdown, setScoreCountdown] = useState<number | null>(null);

  // On-demand fast translation state & handler
  const [isTranslatingActiveQ, setIsTranslatingActiveQ] = useState(false);

  const ensureQuestionTranslation = useCallback(
    async (q: QuestionOut, targetLang: string) => {
      if (!q || !q.question_id) return;
      const clean = targetLang.toLowerCase();
      const upper = targetLang.toUpperCase();
      const hasOptionTrans =
        (q.options || []).length === 0 ||
        (q.options || []).every((o: any) =>
          Boolean(
            o.translations &&
              (o.translations[clean] ||
                o.translations[upper] ||
                (clean === 'hi' && (o.translations.HINDI || o.translations.Hindi))),
          ),
        );
      const hasTrans =
        clean === 'en' ||
        (q.translations &&
          (q.translations[clean] ||
            q.translations[upper] ||
            (clean === 'hi' && (q.translations.HINDI || q.translations.Hindi))) &&
          hasOptionTrans);
      if (hasTrans) return;

      try {
        setIsTranslatingActiveQ(true);
        const res = await fetch(`/api/v1/questions/${q.question_id}?language=${targetLang}`);
        if (res.ok) {
          const data = await res.json();
          const newTrans = data.translations || {};
          const newOptTrans: Record<string, Record<string, string>> = {};
          const newOptText: Record<string, string> = {};
          (data.options || []).forEach((opt: any) => {
            if (opt.option_id) {
              const oId = String(opt.option_id);
              newOptTrans[oId] = opt.translations || {};
              if (opt.option_text) newOptText[oId] = opt.option_text;
            }
          });

          setAllQuestions((prev) =>
            prev.map((item) => {
              if (String(item.question_id) === String(q.question_id)) {
                const mergedTranslations = { ...(item.translations || {}), ...newTrans };
                const fetchedText = data.question_text || data.text;
                if (fetchedText && fetchedText !== item.text) {
                   mergedTranslations[upper] = fetchedText;
                }

                const mergedOptions = (item.options || []).map((o: any) => {
                  const optId = String(o.option_id);
                  const mergedOptTrans = { ...(o.translations || {}), ...(newOptTrans[optId] || {}) };
                  const fetchedOptText = newOptText[optId];
                  if (fetchedOptText && fetchedOptText !== o.text) {
                     mergedOptTrans[upper] = fetchedOptText;
                  }

                  return {
                    ...o,
                    text: o.text, // Preserve original English text
                    translations: mergedOptTrans,
                  };
                });
                return {
                  ...item,
                  text: item.text, // Preserve original English text
                  translations: mergedTranslations,
                  options: mergedOptions,
                };
              }
              return item;
            }),
          );

          setActiveQuestion((prev) => {
            if (!prev || String(prev.question_id) !== String(q.question_id)) return prev;
            const mergedTranslations = { ...(prev.translations || {}), ...newTrans };
            const fetchedText = data.question_text || data.text;
            if (fetchedText && fetchedText !== prev.text) {
               mergedTranslations[upper] = fetchedText;
            }

            const mergedOptions = (prev.options || []).map((o: any) => {
              const optId = String(o.option_id);
              const mergedOptTrans = { ...(o.translations || {}), ...(newOptTrans[optId] || {}) };
              const fetchedOptText = newOptText[optId];
              if (fetchedOptText && fetchedOptText !== o.text) {
                 mergedOptTrans[upper] = fetchedOptText;
              }

              return {
                ...o,
                text: o.text, // Preserve original English text
                translations: mergedOptTrans,
              };
            });
            return {
              ...prev,
              text: prev.text, // Preserve original English text
              translations: mergedTranslations,
              options: mergedOptions,
            };
          });
        }
      } catch (err) {
        console.warn('Failed to fetch on-demand question translation:', err);
      } finally {
        setIsTranslatingActiveQ(false);
      }
    },
    [],
  );

  const handleLanguageChange = (newLang: string) => {
    setLanguage(newLang);
    localStorage.setItem('preferred_language', newLang);

    // Priority translate active question if missing in newLang
    if (activeQuestion) {
      ensureQuestionTranslation(activeQuestion, newLang);
    }
    // Background prefetch next question if present
    if (allQuestions[currentQIndex + 1]) {
      ensureQuestionTranslation(allQuestions[currentQIndex + 1], newLang);
    }
  };

  // Dynamic Recommended Questions Pool
  const [recommendedPool, setRecommendedPool] = useState<QuestionOut[]>([]);
  const [expandedRecId, setExpandedRecId] = useState<number | string | null>(null);
  const [recUserResponses, setRecUserResponses] = useState<Record<string, number | string>>({});
  const [recSolutions, setRecSolutions] = useState<Record<string | number, QuestionSolutionData>>(
    {},
  );
  const [practiceSolutions, setPracticeSolutions] = useState<Record<string | number, QuestionSolutionData>>(
    {},
  );
  const [recSolutionLoading, setRecSolutionLoading] = useState<Record<string | number, boolean>>(
    {},
  );
  const expandedRecIdRef = React.useRef<number | string | null>(null);
  const recUserResponsesRef = React.useRef<Record<string, number | string>>({});
  const userToggledRecRef = React.useRef(false);

  useEffect(() => {
    expandedRecIdRef.current = expandedRecId;
  }, [expandedRecId]);

  useEffect(() => {
    recUserResponsesRef.current = recUserResponses;
  }, [recUserResponses]);

  const [isPrefetchingRecs, setIsPrefetchingRecs] = useState(false);
  const [isRecsExhausted, setIsRecsExhausted] = useState(false);

  const [recExamToggles, setRecExamToggles] = useState<ExamFilterToggles>({
    UPSC: true,
    MPPSC: false,
    BPSC: false,
    UPPCS: false,
  });

  const toggleRecExam = useCallback((examName: string) => {
    setRecExamToggles((prev) => {
      const updated = { ...prev, [examName]: !prev[examName] };
      setIsRecsExhausted(false);
      setRecommendedPool([]);
      return updated;
    });
  }, []);

  // Reset recommendations exhaustion when exam/subject/topic/subtopic/difficulty/recExamToggles/language change
  useEffect(() => {
    setIsRecsExhausted(false);
    setRecommendedPool([]);
  }, [gExam, gSubject, gTopic, gSubtopic, gDifficulty, recExamToggles, language]);

  // Mobile Responsiveness & Custom Dropdown Search State
  const { isTabletOrBelow } = useBreakpoint();
  const [showMobileRecs, setShowMobileRecs] = useState(false);
  const [showMobileFilterPanel, setShowMobileFilterPanel] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [filterSearchQuery, setFilterSearchQuery] = useState('');
  const [isFocusMode, setIsFocusMode] = useState(false);

  const SESSION_KEY = `guest_exam_session_${gExam}_${gYear}_${gSubject}_${gTopic}_${gSubtopic}_${gCount}`;

  // Background prefetch function for dynamic recommended questions
  const prefetchRecommendations = useCallback(
    async (currentTestQuestions: QuestionOut[], currentPool: QuestionOut[]) => {
      if (isPrefetchingRecs || isRecsExhausted) return;
      setIsPrefetchingRecs(true);

      try {
        const existingIds = new Set<string | number>();
        currentTestQuestions.forEach((q) => {
          if (q.question_id) existingIds.add(q.question_id);
        });
        currentPool.forEach((q) => {
          if (q.question_id) existingIds.add(q.question_id);
        });
        Object.keys(recUserResponsesRef.current || {}).forEach((qId) => existingIds.add(qId));

        const excludeIdsParam = Array.from(existingIds).join(',');

        const rawSubject = gSubject && !gSubject.startsWith('All Subjects') ? gSubject.trim() : '';
        const rawTopic = gTopic && !gTopic.startsWith('All Topics') ? gTopic.trim() : '';
        const rawSubtopic = gSubtopic && !gSubtopic.startsWith('All Subtopics') ? gSubtopic.trim() : '';
        const rawDiff = gDifficulty && !gDifficulty.startsWith('All') ? gDifficulty.trim() : '';
        const targetExam = gExam
          ? gExam.toLowerCase().includes('upsc')
            ? 'upsc'
            : gExam.toLowerCase().trim()
          : '';

        let newFetched: any[] = [];
        const maxGuestRecs = Math.min(10, gCount);
        const neededCount = Math.max(1, maxGuestRecs - currentPool.length);

        if (neededCount <= 0 && currentPool.length >= maxGuestRecs) return;

        const activeExams = Object.keys(recExamToggles).filter((e) => recExamToggles[e]);
        if (activeExams.length === 0) {
          setIsRecsExhausted(true);
          return;
        }

        const subjParams = new URLSearchParams({ limit: String(neededCount) });
        subjParams.append('exam_name', activeExams.map((e) => e.toLowerCase()).join(','));
        if (rawSubject) subjParams.append('subject_name', rawSubject);
        if (rawTopic) subjParams.append('topic_name', rawTopic);
        if (rawSubtopic) subjParams.append('subtopic_name', rawSubtopic);
        if (rawDiff) subjParams.append('difficulty', rawDiff);
        if (excludeIdsParam) subjParams.append('exclude_ids', excludeIdsParam);
        if (language) subjParams.append('language', language);

        try {
          const res = await guardedFetch(`/api/v1/questions/recommended?${subjParams.toString()}`);
          if (res.ok) {
            const data = await res.json();
            newFetched = data.items || [];
          }
        } catch (err) {
          console.warn('Subject recommendation fetch failed:', err);
        }

        // If no questions even of subject are found, mark exhausted and DO NOT call API in loop
        if (newFetched.length === 0) {
          setIsRecsExhausted(true);
          return;
        }

        if (newFetched.length > 0) {
          const formatted: QuestionOut[] = newFetched.map((item: any, idx: number) => {
            const rawOptions = item.options || [];
            const optionsList = rawOptions.map((o: any, oIdx: number) => ({
              option_id:
                o.option_id || `opt-rec-${idx}-${o.option_label || String.fromCharCode(65 + oIdx)}`,
              option_label: o.option_label || String.fromCharCode(65 + oIdx),
              text:
                o.option_text ||
                o.text ||
                `Option ${o.option_label || String.fromCharCode(65 + oIdx)}`,
              is_correct: Boolean(o.is_correct),
              distractor_analysis:
                o.distractor_analysis ||
                o.explanation ||
                o.description ||
                (o.is_correct
                  ? 'Correct option matching core syllabus concepts.'
                  : 'Distractor option.'),
              translations: o.translations || {},
            }));
            return {
              question_id: item.question_id,
              question_number: 0,
              text: item.question_text || item.text || '',
              passage_text: item.passage_text || null,
              translations: item.translations || {},
              passage_translations: item.passage_translations || {},
              options: optionsList,
              section_code: item.subject_name || rawSubject || 'Recommended',
              subject: item.subject_name || rawSubject || 'General Studies',
              topic_name: item.topic_name || item.subject_name || rawSubject || '',
              subtopic_name: item.subtopic_name,
              difficulty: item.difficulty || 'MEDIUM',
              marks: item.marks || 2.0,
              negative_marks: item.negative_marks || 0.66,
              expected_time_seconds: item.expected_time_seconds || 60,
              source_year: item.source_year || item.exam_year || gYear,
              exam_name: item.exam_name || gExam || 'UPSC CSE',
            } as any;
          });

          setRecommendedPool((prev) => {
            let newList = [...prev];
            const existingIds = new Set(prev.map((q) => q.question_id));

            for (let i = formatted.length - 1; i >= 0; i--) {
              const q = formatted[i];
              if (!existingIds.has(q.question_id)) {
                newList.unshift(q);
              }
            }

            while (newList.length > maxGuestRecs) {
              let evictIdx = -1;
              const currentExpanded = expandedRecIdRef.current;
              const currentResponses = recUserResponsesRef.current;

              // Prefer removing already-answered questions that are not expanded
              for (let i = newList.length - 1; i >= 0; i--) {
                const q = newList[i];
                if (q.question_id !== currentExpanded && currentResponses[q.question_id]) {
                  evictIdx = i;
                  break;
                }
              }

              // If none found, just find the oldest not expanded
              if (evictIdx === -1) {
                for (let i = newList.length - 1; i >= 0; i--) {
                  if (newList[i].question_id !== currentExpanded) {
                    evictIdx = i;
                    break;
                  }
                }
              }

              if (evictIdx !== -1) {
                newList.splice(evictIdx, 1);
              } else {
                break;
              }
            }
            return newList;
          });
        }
      } catch (err) {
        console.warn('Background recommendation prefetch error:', err);
        setIsRecsExhausted(true);
      } finally {
        setIsPrefetchingRecs(false);
      }
    },
    [gSubject, gTopic, gSubtopic, gDifficulty, gExam, language, recExamToggles, isPrefetchingRecs, isRecsExhausted],
  );

  // Timer countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Post-Exam Score Modal 10s Countdown Effect
  useEffect(() => {
    if (scoreCountdown === null) return;
    if (scoreCountdown <= 0) {
      setScoreCountdown(null);
      setShowScoreModal(true);
      return;
    }
    const timer = setTimeout(() => {
      setScoreCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearTimeout(timer);
  }, [scoreCountdown]);

  // Fetch Guest Questions strictly from DB
  useEffect(() => {
    async function loadGuestQuestions() {
      if (isInitialLoadRef.current) {
        setIsLoading(true);
      } else {
        setIsFilterRefreshing(true);
      }

      const fetchedMap = new Map<string, any>();

      const formatQuestion = (q: any, idx: number): QuestionOut => {
        const rawOptions = q.options || [];
        const optionsList = rawOptions.map((o: any, oIdx: number) => ({
          option_id:
            o.option_id || `opt-${idx}-${o.option_label || String.fromCharCode(65 + oIdx)}`,
          option_label: o.option_label || String.fromCharCode(65 + oIdx),
          text:
            o.option_text || o.text || `Option ${o.option_label || String.fromCharCode(65 + oIdx)}`,
          is_correct: Boolean(o.is_correct),
          distractor_analysis: o.distractor_analysis || null,
          translations: o.translations || {},
        }));

        const expObj = q.explanation;
        let expText = '';
        if (typeof expObj === 'object' && expObj !== null) {
          expText = expObj.detailed_solution || expObj.solution || expObj.text || '';
        } else if (typeof expObj === 'string') {
          expText = expObj;
        }

        const primaryH =
          (q.hierarchy || []).find((h: any) => h.is_primary) || (q.hierarchy || [])[0] || {};
        const fallbackSubj =
          gSubject && !gSubject.startsWith('All Subjects')
            ? gSubject.split(',')[0].trim()
            : 'General Studies';
        const subjName = primaryH.subject_name || q.subject_name || fallbackSubj;
        const topName =
          primaryH.topic_name ||
          q.topic_name ||
          subjName;
        const subtopName = '';

        return {
          question_id: q.question_id || `q-guest-${idx + 1}`,
          question_number: idx + 1,
          text: q.question_text || q.text || '',
          passage_text: q.passage_text || null,
          options: optionsList,
          translations: q.translations || {},
          passage_translations: q.passage_translations || {},
          section_code: subjName || 'General Studies',
          subject_name: subjName,
          topic_name: topName,
          subtopic_name: subtopName,
          concept_name: primaryH.concept_name || '',
          exam_name: q.exam_name || (gExam && !gExam.startsWith('All Exams') ? gExam : 'UPSC CSE'),
          source_year:
            q.source_year ||
            (gYear && gYear.replace(/\D/g, '') ? Number(gYear.replace(/\D/g, '')) : 2023),
          stage: q.stage || 'Prelims',
          paper_set_code: q.paper_set_code || 'SET_A',
          difficulty: q.difficulty || 'MEDIUM',
          marks: q.marks || 2.0,
          negative_marks: q.negative_marks || 0.66,
          expected_time_seconds: q.expected_time_seconds || 60,
          explanation: expObj || expText,
        } as any;
      };

      const fetchQuestions = async (params: URLSearchParams): Promise<any[]> => {
        try {
          if (!params.has('language') && language) {
            params.append('language', language);
          }
          const res = await fetch(`/api/v1/questions?${params.toString()}`);
          if (res.ok) {
            const data = await res.json();
            return data.items || [];
          }
        } catch (err) {
          console.warn('Questions fetch error:', err);
        }
        return [];
      };

      const mergeItems = (items: any[]) => {
        items.forEach((item: any) => {
          if (item.question_id && !fetchedMap.has(item.question_id)) {
            fetchedMap.set(item.question_id, item);
          }
        });
      };

      const rawSubject = gSubject && !gSubject.startsWith('All Subjects') ? gSubject.trim() : '';
      const rawTopic = gTopic && !gTopic.startsWith('All Topics') ? gTopic.trim() : '';
      const rawSubtopic = gSubtopic && !gSubtopic.startsWith('All Subtopics') ? gSubtopic.trim() : '';
      const reqSubject = rawSubject;
      const reqTopic = rawTopic;
      const reqSubtopic = rawSubtopic;

      const targetExam = gExam
        ? gExam.toLowerCase().includes('upsc')
          ? 'upsc'
          : gExam.toLowerCase().trim()
        : '';

      const rawYearDigits = gYear.replace(/\D/g, '');
      const validYear =
        rawYearDigits &&
        !isNaN(Number(rawYearDigits)) &&
        Number(rawYearDigits) >= 2000 &&
        Number(rawYearDigits) <= 2024
          ? rawYearDigits
          : null;

      // 1. Try with subject + topic + subtopic + year + selected exam
      const p1 = new URLSearchParams({ limit: gCount.toString(), include_solutions: 'true' });
      if (reqSubject) p1.append('subject_name', reqSubject);
      if (reqTopic) p1.append('topic_name', reqTopic);
      if (reqSubtopic) p1.append('subtopic_name', reqSubtopic);
      if (validYear) p1.append('exam_year', validYear);
      if (targetExam) p1.append('exam_name', targetExam);
      mergeItems(await fetchQuestions(p1));

      // Remaining tiers are progressive relaxations of the same filters, tried in
      // priority order (most specific first). With sparse data the exact-match tier
      // above often returns nothing, so instead of awaiting each relaxation one at a
      // time, fire every applicable fallback tier in parallel and keep the most
      // specific one that returned results — this bounds worst-case latency to a
      // single extra round trip instead of up to 6 sequential ones.
      if (fetchedMap.size === 0) {
        const fallbackTiers: URLSearchParams[] = [];

        // 2. Relax year
        if (validYear) {
          const p2 = new URLSearchParams({ limit: gCount.toString(), include_solutions: 'true' });
          if (reqSubject) p2.append('subject_name', reqSubject);
          if (reqTopic) p2.append('topic_name', reqTopic);
          if (reqSubtopic) p2.append('subtopic_name', reqSubtopic);
          if (targetExam) p2.append('exam_name', targetExam);
          fallbackTiers.push(p2);
        }

        // 3. Relax subtopic
        if (reqSubtopic) {
          const p3 = new URLSearchParams({ limit: gCount.toString(), include_solutions: 'true' });
          if (reqSubject) p3.append('subject_name', reqSubject);
          if (reqTopic) p3.append('topic_name', reqTopic);
          if (targetExam) p3.append('exam_name', targetExam);
          fallbackTiers.push(p3);
        }

        // 4. Relax topic
        if (reqTopic) {
          const p4 = new URLSearchParams({ limit: gCount.toString(), include_solutions: 'true' });
          if (reqSubject) p4.append('subject_name', reqSubject);
          if (targetExam) p4.append('exam_name', targetExam);
          fallbackTiers.push(p4);
        }

        // 5. Relax subject (still scoped to exam), or if no exam was chosen, relax to
        // subject+year only and finally to no filters at all.
        if (targetExam) {
          const p5 = new URLSearchParams({ limit: gCount.toString(), include_solutions: 'true' });
          p5.append('exam_name', targetExam);
          if (validYear) p5.append('exam_year', validYear);
          fallbackTiers.push(p5);
        } else {
          const pAll = new URLSearchParams({ limit: gCount.toString(), include_solutions: 'true' });
          if (validYear) pAll.append('exam_year', validYear);
          if (reqSubject) pAll.append('subject_name', reqSubject);
          fallbackTiers.push(pAll);

          const pAllRelaxed = new URLSearchParams({ limit: gCount.toString(), include_solutions: 'true' });
          fallbackTiers.push(pAllRelaxed);
        }

        const fallbackResults = await Promise.all(fallbackTiers.map(fetchQuestions));
        mergeItems(fallbackResults.find((items) => items.length > 0) || []);
      }

      const fetchedList = Array.from(fetchedMap.values());
      let questionsList: QuestionOut[] = fetchedList.map((item, idx) => formatQuestion(item, idx));
      if (gDifficulty && gDifficulty.trim()) {
        const filteredByDiff = questionsList.filter(
          (q) => String(q.difficulty || '').toUpperCase() === gDifficulty.toUpperCase(),
        );
        if (filteredByDiff.length > 0) {
          questionsList = filteredByDiff;
        }
      }
      if (questionsList.length > gCount) {
        questionsList = questionsList.slice(0, gCount);
      }

      setAllQuestions(questionsList);
      setTotalQuestions(questionsList.length);
      setActiveQuestion(questionsList.length > 0 ? questionsList[0] : null);

      // Restore session state from sessionStorage
      let restoredResponses: Record<string, any> = {};
      let restoredRevealed: Record<string, any> = {};
      let restoredMarked: Record<string, boolean> = {};

      if (questionsList.length > 0) {
        try {
          const savedRaw = sessionStorage.getItem(SESSION_KEY);
          if (savedRaw) {
            const savedData = JSON.parse(savedRaw);
            if (savedData.userResponses) {
              restoredResponses = savedData.userResponses;
              setUserResponses(savedData.userResponses);
            }
            if (savedData.revealedMap) {
              restoredRevealed = savedData.revealedMap;
              setRevealedMap(savedData.revealedMap);
            }
            if (savedData.markedForReview) {
              restoredMarked = savedData.markedForReview;
              setMarkedForReview(savedData.markedForReview);
            }
            if (
              typeof savedData.currentQIndex === 'number' &&
              savedData.currentQIndex >= 0 &&
              savedData.currentQIndex < questionsList.length
            ) {
              setCurrentQIndex(savedData.currentQIndex);
              setActiveQuestion(questionsList[savedData.currentQIndex]);
            }
          }
        } catch (err) {
          console.warn('Failed to restore guest sessionStorage:', err);
        }

        const initialPalette: QuestionPaletteItem[] = questionsList.map((q, i) => {
          const qId = q.question_id;
          const isRevealed = !!restoredRevealed[qId];
          const isMarked = !!restoredMarked[qId];
          let status: any = i === 0 ? 'VISITED' : 'UNVISITED';
          if (isRevealed) {
            status = isMarked ? 'ANSWERED_AND_MARKED' : 'ANSWERED';
          } else if (isMarked) {
            status = 'MARKED_FOR_REVIEW';
          }
          return {
            question_number: i + 1,
            question_id: qId,
            question_status: status,
          };
        });
        setPalette(initialPalette);
      } else {
        setPalette([]);
      }

      if (isInitialLoadRef.current) {
        setIsLoading(false);
        isInitialLoadRef.current = false;
      } else {
        setIsFilterRefreshing(false);
      }
    }

    loadGuestQuestions();
  }, [gExam, gYear, gSubject, gTopic, gSubtopic, gDifficulty, gCount]);

  // Persist session state to sessionStorage
  useEffect(() => {
    if (isLoading || allQuestions.length === 0) return;
    try {
      const payload = {
        userResponses,
        revealedMap,
        markedForReview,
        bookmarkedQs,
        currentQIndex,
      };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
    } catch (err) {
      console.warn('Failed to write guest sessionStorage:', err);
    }
  }, [
    userResponses,
    revealedMap,
    markedForReview,
    bookmarkedQs,
    currentQIndex,
    isLoading,
    allQuestions,
  ]);

  // Auto-prefetch background recommendations whenever pool has fewer than 5 items
  useEffect(() => {
    if (
      allQuestions.length > 0 &&
      recommendedPool.length < 5 &&
      !isPrefetchingRecs &&
      !isRecsExhausted
    ) {
      prefetchRecommendations(allQuestions, recommendedPool);
    }
  }, [
    allQuestions,
    recommendedPool.length,
    isPrefetchingRecs,
    isRecsExhausted,
    prefetchRecommendations,
  ]);

  // Handler to toggle recommended question accordion (NEVER touches the center card)
  const handleSelectRecommendation = (recQ: QuestionOut) => {
    userToggledRecRef.current = true;
    setExpandedRecId((prev) => (prev === recQ.question_id ? null : recQ.question_id));
  };

  // Keep the first recommended question expanded until the user manually
  // expands/collapses a card themselves — recommendedPool can reorder or evict
  // items as it prefetches, so a one-shot "expand index 0 once" can end up
  // pointing at a question_id that's no longer in the list.
  useEffect(() => {
    if (!userToggledRecRef.current) {
      setExpandedRecId(recommendedPool[0]?.question_id ?? null);
    }
  }, [recommendedPool]);

  // Fetches the full comprehensive solution for a recommended question (once per question)
  const fetchRecommendationSolution = async (qId: number | string) => {
    if (recSolutions[qId] || recSolutionLoading[qId]) return;
    setRecSolutionLoading((prev) => ({ ...prev, [qId]: true }));
    try {
      const res = await fetch(`/api/v1/questions/${qId}/solution`);
      if (res.ok) {
        const data = await res.json();
        setRecSolutions((prev) => ({ ...prev, [qId]: data }));
      }
    } catch (err) {
      console.warn('Rec solution fetch error:', err);
    } finally {
      setRecSolutionLoading((prev) => ({ ...prev, [qId]: false }));
    }
  };

  // Fetches full authoritative solution for a practice question via /api/v1/questions/{id}/solution
  const practiceSolutionLoadingRef = React.useRef<Record<string | number, boolean>>({});
  const fetchPracticeQuestionSolution = async (targetId: string | number) => {
    if (!targetId || practiceSolutionLoadingRef.current[targetId]) return;
    practiceSolutionLoadingRef.current[targetId] = true;
    setIsSolutionLoading(true);
    try {
      const solRes = await fetch(`/api/v1/questions/${targetId}/solution`);
      if (solRes.ok) {
        const solPayload: QuestionSolutionData = await solRes.json();
        setPracticeSolutions((prev) => ({
          ...prev,
          [targetId]: solPayload,
          [String(targetId)]: solPayload,
        }));
        setRevealedMap((prev) => {
          const current = prev[targetId] || prev[String(targetId)] || {};
          const updatedObj = {
            ...current,
            question_id: targetId,
            correct_option_id: solPayload.correct_option_id || current.correct_option_id,
            correct_option_label:
              solPayload.correct_option_label || current.correct_option_label,
            explanation: solPayload.explanation || current.explanation,
            distractor_scores: solPayload.distractor_scores || current.distractor_scores,
            presigned_url: solPayload.presigned_url || (current as any)?.presigned_url,
          };
          return {
            ...prev,
            [targetId]: updatedObj,
            [String(targetId)]: updatedObj,
          };
        });
      }
    } catch (err) {
      console.warn('Practice solution fetch error:', err);
    } finally {
      practiceSolutionLoadingRef.current[targetId] = false;
      setIsSolutionLoading(false);
    }
  };

  // Records the user's answer for a recommended question and kicks off its solution fetch
  const handleSelectRecommendationOption = (rec: QuestionOut, optionId: number | string) => {
    setRecUserResponses((prev) => ({ ...prev, [rec.question_id]: optionId }));
    fetchRecommendationSolution(rec.question_id);
  };

  // All up to 10 recommended items to display for Guest mode
  const displayRecs = recommendedPool.slice(0, 10);

  // Switch Question
  const handleSelectQuestion = (idx: number) => {
    if (idx < 0 || idx >= totalQuestions || idx >= allQuestions.length) return;
    setCurrentQIndex(idx);
    const targetQ = allQuestions[idx];
    setActiveQuestion(targetQ);

    if (language && language !== 'en' && targetQ) {
      ensureQuestionTranslation(targetQ, language);
    }
    if (language && language !== 'en' && allQuestions[idx + 1]) {
      ensureQuestionTranslation(allQuestions[idx + 1], language);
    }

    setPalette((prev) =>
      prev.map((item, i) => {
        if (i === idx && item.question_status === 'UNVISITED') {
          return { ...item, question_status: 'VISITED' as any };
        }
        return item;
      }),
    );
  };

  // Option Selection
  const handleSelectOption = (optId: number | string, optLabel: string) => {
    if (!activeQuestion) return;
    const qId = activeQuestion.question_id;
    if (revealedMap[qId]) return; // Locked once submitted

    setUserResponses((prev) => ({
      ...prev,
      [qId]: { optionId: optId, optionLabel: optLabel },
    }));
  };

  // Reveal Instant Per-Question Answer & Description with Full Markdown Solution
  const handleRevealAnswer = async (qId?: string) => {
    const targetId = qId || activeQuestion?.question_id;
    if (!targetId) return;

    const targetQuestion = allQuestions.find((q) => q.question_id === targetId) || activeQuestion;
    if (!targetQuestion) return;

    const cleanOptionLabel = (rawLabel: string, index: number): string => {
      if (!rawLabel) return String.fromCharCode(65 + index);
      const clean = String(rawLabel)
        .replace(/[\(\)\.\s]/g, '')
        .toUpperCase();
      return clean.length === 1 ? clean : String.fromCharCode(65 + index);
    };

    let userResp = userResponses[targetId];
    if (!userResp) return;
    const correctOpt = targetQuestion.options?.find((o) => o.is_correct);

    let isUserCorrect = false;
    if (userResp && targetQuestion.options) {
      const selectedOpt = targetQuestion.options.find(
        (o, idx) =>
          o.option_id === userResp.optionId ||
          cleanOptionLabel(o.option_label || '', idx) === userResp.optionLabel,
      );
      if (selectedOpt && selectedOpt.is_correct) {
        isUserCorrect = true;
      }
    }

    const correctOptIndex = targetQuestion.options?.findIndex((o) => o.is_correct) ?? 0;
    const correctLabel = correctOpt
      ? cleanOptionLabel(correctOpt.option_label || '', correctOptIndex)
      : 'A';

    const expContent =
      (targetQuestion as any).explanation?.detailed_solution ||
      (targetQuestion as any).explanation ||
      `Option (${correctLabel}) is correct for this question on ${targetQuestion.topic_name || targetQuestion.subject || gSubject || 'General Studies'}.`;

    const distractorScores: Record<string, any> = {};
    if (Array.isArray(targetQuestion.options)) {
      targetQuestion.options.forEach((opt: any) => {
        const oId = String(opt.option_id);
        const closeness = opt.closeness_score ?? (opt.is_correct ? 1.0 : 0.0);
        distractorScores[oId] = {
          option_id: oId,
          label: opt.option_label,
          text: opt.text || opt.option_text || `Option ${opt.option_label}`,
          is_correct: opt.is_correct,
          closeness_score: closeness,
          classification: opt.is_correct ? 'Correct' : 'Distractor',
          distractor_analysis: opt.distractor_analysis || '',
          analysis: opt.distractor_analysis || '',
        };
      });
    }

    const revealObj: RevealAnswerResponse & { presigned_url?: string } = {
      question_id: targetId,
      question_number: targetQuestion.question_number,
      correct_option_id: correctOpt?.option_id || '',
      correct_option_label: correctLabel,
      is_user_correct: isUserCorrect,
      user_selected_option_id: userResp?.optionId || null,
      user_selected_label: userResp?.optionLabel || null,
      marks_awarded: isUserCorrect
        ? targetQuestion.marks || 2.0
        : -(targetQuestion.negative_marks || 0.66),
      closeness_score: isUserCorrect ? 1.0 : 0.0,
      closeness_classification: isUserCorrect ? 'Correct Response' : 'Incorrect Response',
      explanation: expContent,
      distractor_scores: distractorScores,
    };

    const updatedRevealedMap = {
      ...revealedMap,
      [targetId]: revealObj,
      [String(targetId)]: revealObj,
    };

    setRevealedMap(updatedRevealedMap);

    fetchPracticeQuestionSolution(targetId);

    // Update palette question_status on Submit
    setPalette((prev) =>
      prev.map((item) => {
        if (item.question_id === targetId) {
          const isMarked = markedForReview[targetId];
          return {
            ...item,
            question_status: isMarked ? ('ANSWERED_AND_MARKED' as any) : ('ANSWERED' as any),
          };
        }
        return item;
      }),
    );
  };

  // Lazy-fetch full detailed solution metadata when user clicks 'Show Solution'
  const handleShowSolution = async (passedRevealedMap?: Record<string, RevealAnswerResponse>) => {
    const targetId = activeQuestion?.question_id;
    if (targetId) {
      await fetchPracticeQuestionSolution(targetId);
    }

    const rMap = passedRevealedMap || revealedMap;
    const numQuestions = allQuestions.length;
    // When Show Solution is clicked, if test is completed (or 1 question), start 10s countdown to feedback modal
    const isCompleted = Object.keys(rMap).length >= numQuestions || numQuestions === 1;
    if (isCompleted && scoreCountdown === null && !showScoreModal) {
      handleFinishGuestExam(rMap, true);
    }
  };

  const handleFinishGuestExam = (
    passedRevealedMap?: Record<string, RevealAnswerResponse>,
    startCountdown: boolean = false,
  ) => {
    const rMap = passedRevealedMap || revealedMap;
    const numQuestions = allQuestions.length;
    let correctCount = 0;
    let incorrectCount = 0;
    let attemptedCount = 0;

    const cleanOptionLabel = (rawLabel: string, index: number): string => {
      if (!rawLabel) return String.fromCharCode(65 + index);
      const clean = String(rawLabel)
        .replace(/[\(\)\.\s]/g, '')
        .toUpperCase();
      return clean.length === 1 ? clean : String.fromCharCode(65 + index);
    };

    const responsesPayload = allQuestions.map((q, idx) => {
      const userResp = userResponses[q.question_id];
      const rev = rMap[q.question_id];
      let isCorr = false;

      if (rev) {
        isCorr = Boolean(rev.is_user_correct);
      } else if (userResp && q.options) {
        const selectedOpt = q.options.find(
          (o, oIdx) =>
            o.option_id === userResp.optionId ||
            cleanOptionLabel(o.option_label || '', oIdx) === userResp.optionLabel,
        );
        if (selectedOpt && selectedOpt.is_correct) {
          isCorr = true;
        }
      }

      if (userResp || rev) {
        attemptedCount += 1;
        if (isCorr) {
          correctCount += 1;
        } else {
          incorrectCount += 1;
        }
      }

      return {
        question_id: q.question_id,
        selected_option_id: userResp?.optionId || rev?.user_selected_option_id || null,
        is_correct: isCorr,
        time_taken_seconds: 60.0,
        expected_time_seconds: q.expected_time_seconds || 60.0,
        is_switched: false,
      };
    });

    const totalMarksPossible = numQuestions;
    const unattemptedCount = Math.max(0, numQuestions - attemptedCount);
    const accuracy = attemptedCount > 0 ? Math.round((correctCount / attemptedCount) * 100) : 0;

    const scorePayload = {
      score: correctCount,
      totalMarksPossible,
      correctCount,
      incorrectCount,
      unattemptedCount,
      accuracy,
      totalQuestions: numQuestions,
      topicName: gSubject,
      subjectName: gSubject,
      subtopicName: '',
      targetExam: gExam,
      targetYear: gYear,
      timeSpentSeconds: Math.max(30, gCount * 120 - timeLeft),
      responses: responsesPayload,
    };

    setGuestScoreData(scorePayload);
    saveGuestAttempt(scorePayload);

    if (startCountdown) {
      setScoreCountdown(10);
    } else {
      setScoreCountdown(null);
      setShowScoreModal(true);
    }
  };

  // Clear Response
  const handleClearResponse = () => {
    if (!activeQuestion) return;
    const qId = activeQuestion.question_id;

    setUserResponses((prev) => {
      const updated = { ...prev };
      delete updated[qId];
      return updated;
    });

    setPalette((prev) =>
      prev.map((item) => {
        if (item.question_id === qId) {
          const isMarked = markedForReview[qId];
          return {
            ...item,
            question_status: isMarked ? ('MARKED_FOR_REVIEW' as any) : ('VISITED' as any),
          };
        }
        return item;
      }),
    );
  };

  // Toggle Mark for Review
  const handleToggleMarkReview = () => {
    if (!activeQuestion) return;
    const qId = activeQuestion.question_id;
    const nextMarked = !markedForReview[qId];

    setMarkedForReview((prev) => ({
      ...prev,
      [qId]: nextMarked,
    }));

    setPalette((prev) =>
      prev.map((item) => {
        if (item.question_id === qId) {
          const isSubmitted = !!revealedMap[qId];
          if (nextMarked) {
            return {
              ...item,
              question_status: isSubmitted
                ? ('ANSWERED_AND_MARKED' as any)
                : ('MARKED_FOR_REVIEW' as any),
            };
          }
          return {
            ...item,
            question_status: isSubmitted ? ('ANSWERED' as any) : ('VISITED' as any),
          };
        }
        return item;
      }),
    );
  };

  if (isLoading) {
    return (
      <ExamLoaderOverlay
        title="Preparing Mock Examination"
        subtitle="Structuring authentic PYQs and setting up your workspace..."
      />
    );
  }

  if (!activeQuestion || allQuestions.length === 0) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: '#F8FAFC',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: 520,
            width: '100%',
            backgroundColor: '#FFFFFF',
            borderRadius: 0,
            padding: '36px 32px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.08)',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 0,
              backgroundColor: '#FEF3C7',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#F2B623',
              marginBottom: 16,
            }}
          >
            <AlertCircle size={28} />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#172033', margin: '0 0 8px 0' }}>
            No Questions Available
          </h2>
          <p style={{ fontSize: 14, color: '#64748B', lineHeight: 1.6, margin: '0 0 24px 0' }}>
            No questions available for{' '}
            <strong>{formatEnum(gSubject || 'this selection')}</strong>.
          </p>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => {
                const current = new URLSearchParams(searchParams);
                current.delete('subject');
                current.delete('topic');
                navigate(`?${current.toString()}`);
              }}
              style={{
                padding: '10px 18px',
                borderRadius: 0,
                backgroundColor: '#172033',
                color: '#FFFFFF',
                fontSize: 13.5,
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <RotateCcw size={15} />
              Practice All Subjects
            </button>
            <button
              type="button"
              onClick={() => navigate('/mocks')}
              style={{
                padding: '10px 18px',
                borderRadius: 0,
                backgroundColor: 'var(--primary-red)',
                color: '#FFFFFF',
                fontSize: 13.5,
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 4px 12px rgba(var(--primary-red-rgb), 0.2)',
              }}
            >
              Select Another Subject
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentResponse = userResponses[activeQuestion.question_id];
  const isCurrentAnswered = !!currentResponse;
  const isCurrentMarked = !!markedForReview[activeQuestion.question_id];
  const currentRevealedResult =
    revealedMap[activeQuestion.question_id] ||
    revealedMap[String(activeQuestion.question_id)] ||
    null;

  const selectedOptionsMap: Record<number, number | string> = {};
  allQuestions.forEach((q, idx) => {
    if (userResponses[q.question_id]) {
      selectedOptionsMap[idx] = userResponses[q.question_id].optionId;
    }
  });

  const markedForReviewMap: Record<number, boolean> = {};
  allQuestions.forEach((q, idx) => {
    if (markedForReview[q.question_id]) {
      markedForReviewMap[idx] = true;
    }
  });

  const answeredCount = Object.keys(revealedMap).length;
  const markedCount = Object.values(markedForReview).filter(Boolean).length;
  const unattemptedCount = Math.max(0, totalQuestions - answeredCount);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: isTabletOrBelow ? 'auto' : '100vh',
        minHeight: '100vh',
        width: '100vw',
        overflow: isTabletOrBelow ? 'visible' : 'hidden',
        backgroundColor: '#F8FAF8',
        color: '#172033',
        fontFamily: "'Manrope', 'Inter', system-ui, sans-serif",
      }}
    >
      {/* 1. Top Application Header */}
      <header
        style={{
          height: 64,
          background: 'linear-gradient(90deg, #0F1D38 0%, #14284C 35%, #1B3864 70%, #224578 100%)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          boxShadow: '0 4px 20px rgba(15, 29, 56, 0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          zIndex: 30,
          flexShrink: 0,
        }}
      >
        {/* Left: Brand Icon, ExamPlanner Title & Clickable Home > Test Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Logo Badge */}
          <img
            src="/logo.jpeg"
            alt="ExamPlanner"
            onClick={() => navigate('/')}
            style={{
              width: 36,
              height: 36,
              objectFit: 'contain',
              cursor: 'pointer',
              flexShrink: 0,
            }}
            title="Go to Home"
          />

          {!isTabletOrBelow && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  onClick={() => navigate('/')}
                  style={{
                    fontSize: 16,
                    fontWeight: 800,
                    color: '#FFFFFF',
                    letterSpacing: '-0.01em',
                    cursor: 'pointer',
                  }}
                >
                  ExamPlanner
                </span>
                <span style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.4)' }}>|</span>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'rgba(255, 255, 255, 0.9)',
                  }}
                >
                  PYQs Practice Engine
                </span>
              </div>

              {/* Breadcrumb: Home (Link) > Test (Current Page) */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 11.5,
                  fontWeight: 600,
                }}
              >
                <span
                  onClick={() => navigate('/')}
                  style={{
                    color: 'rgba(255, 255, 255, 0.75)',
                    cursor: 'pointer',
                    transition: 'color 0.15s ease',
                    textDecoration: 'underline',
                    textUnderlineOffset: '2px',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#FFFFFF')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.75)')}
                >
                  Home
                </span>
                <ChevronRight size={12} style={{ color: 'rgba(255, 255, 255, 0.4)' }} />
                <span style={{ color: '#93C5FD', cursor: 'default' }}>Test</span>
              </div>
            </div>
          )}
        </div>

        {/* Right: Full Screen toggle + End & View Feedback action button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {isTabletOrBelow && !isFocusMode && (
            <button
              type="button"
              onClick={() => setShowMobileFilterPanel(true)}
              className="touch-target"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                borderRadius: 0,
                border: '1px solid rgba(255, 255, 255, 0.25)',
                backgroundColor: 'rgba(255, 255, 255, 0.09)',
                color: '#FFFFFF',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'all 0.15s ease',
              }}
              title="Filters"
              aria-label="Show filters"
            >
              <SlidersHorizontal size={15} />
            </button>
          )}
          {isTabletOrBelow && !isFocusMode && (
            <button
              type="button"
              onClick={() => setShowMobileRecs(true)}
              className="touch-target"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                width: displayRecs.length ? 'auto' : 32,
                height: 32,
                padding: displayRecs.length ? '0 8px' : 0,
                borderRadius: 0,
                border: '1px solid rgba(255, 255, 255, 0.25)',
                backgroundColor: 'rgba(255, 255, 255, 0.09)',
                color: '#FFFFFF',
                cursor: 'pointer',
                flexShrink: 0,
                fontSize: 11.5,
                fontWeight: 700,
                transition: 'all 0.15s ease',
              }}
              title="Recommended Questions"
              aria-label="Show recommended questions"
            >
              <Lightbulb size={15} />
              {!!displayRecs.length && <span>{displayRecs.length}</span>}
            </button>
          )}
          {/* Language Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Globe size={14} style={{ color: 'rgba(255, 255, 255, 0.7)' }} />
            <select
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value)}
              aria-label="Select Language"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                color: '#FFFFFF',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                padding: '5px 8px',
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code} style={{ backgroundColor: '#1E293B', color: '#FFFFFF' }}>
                  {lang.nativeName} ({lang.name})
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => setIsFocusMode((prev) => !prev)}
            className="touch-target"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 10px',
              borderRadius: 0,
              border: `1px solid ${isFocusMode ? 'rgba(var(--primary-red-rgb), 0.5)' : 'rgba(255, 255, 255, 0.25)'}`,
              backgroundColor: isFocusMode
                ? 'rgba(var(--primary-red-rgb), 0.18)'
                : 'rgba(255, 255, 255, 0.09)',
              color: '#FFFFFF',
              fontSize: 12.5,
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
            title={isFocusMode ? 'Exit Full Screen' : 'Enter Full Screen'}
          >
            {isFocusMode ? <Minimize2 size={13} /> : <Focus size={13} />}
            {!isTabletOrBelow && <span>{isFocusMode ? 'Exit Focus' : 'Full Screen'}</span>}
          </button>
          <button
            type="button"
            onClick={() => handleFinishGuestExam()}
            style={{
              padding: '7px 18px',
              borderRadius: 0,
              border: '1px solid rgba(255, 255, 255, 0.25)',
              backgroundColor: 'rgba(255, 255, 255, 0.09)',
              color: '#FFFFFF',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              backdropFilter: 'blur(4px)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.18)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.09)';
            }}
          >
            End
          </button>
        </div>
      </header>
      {/* 2. Premium Floating Exam Filter Window — Desktop only; mobile/tablet uses header icon + top sheet */}
      {!isFocusMode && !isTabletOrBelow && (
        <div
          style={{
            padding: 'clamp(8px, 2vw, 14px) clamp(10px, 2.5vw, 24px) 6px clamp(10px, 2.5vw, 24px)',
            backgroundColor: 'transparent',
            zIndex: 40,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: 0,
              padding: 'clamp(10px, 2vw, 14px) clamp(12px, 2.5vw, 18px)',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '8px 12px',
              boxShadow:
                '0 10px 30px -5px rgba(15, 23, 42, 0.08), 0 4px 12px rgba(15, 23, 42, 0.03)',
              position: 'relative',
            }}
          >
            {/* Filter Bar Badge (+ Hide/Show toggle on mobile/tablet, grouped on their own row) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: isTabletOrBelow ? 'space-between' : 'flex-start',
                gap: 8,
                paddingRight: isTabletOrBelow ? 0 : 12,
                borderRight: isTabletOrBelow ? 'none' : '1px solid #F1F5F9',
                flexShrink: 0,
                flexBasis: isTabletOrBelow ? '100%' : 'auto',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 0,
                    backgroundColor: isFilterRefreshing ? '#EFF6FF' : '#F8FAFC',
                    color: '#1E3A8A',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {isFilterRefreshing ? (
                    <Loader2 size={16} className="animate-spin" color="#2563EB" />
                  ) : (
                    <SlidersHorizontal size={16} />
                  )}
                </div>
                {isFilterRefreshing && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#2563EB',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Updating questions...
                  </span>
                )}
              </div>
            </div>

            {
              <>
                {/* Filter 1: Exam */}
                <div style={{ position: 'relative', flex: 1, minWidth: 140 }}>
                  <label
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      color: '#64748B',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      marginBottom: 4,
                      display: 'block',
                    }}
                  >
                    Exam Target
                  </label>
                  <button
                    type="button"
                    disabled={isExamLocked}
                    onClick={() => {
                      if (!isExamLocked) {
                        setActiveDropdown(activeDropdown === 'exam' ? null : 'exam');
                        setFilterSearchQuery('');
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 14px',
                      borderRadius: 0,
                      border: activeDropdown === 'exam' ? '1px solid #1E3A8A' : '1px solid #E2E8F0',
                      backgroundColor: activeDropdown === 'exam' ? '#FFFFFF' : '#F8FAFC',
                      color: '#172033',
                      fontSize: 13,
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: isExamLocked ? 'not-allowed' : 'pointer',
                      opacity: isExamLocked ? 0.7 : 1,
                      boxShadow:
                        activeDropdown === 'exam' ? '0 0 0 3px rgba(23, 32, 51, 0.12)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span
                      style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                    >
                      {gExam}
                    </span>
                    {!isExamLocked && (
                      <ChevronDown
                        size={14}
                        color="#64748B"
                        style={{
                          transform: activeDropdown === 'exam' ? 'rotate(180deg)' : 'none',
                          transition: 'transform 0.15s ease',
                        }}
                      />
                    )}
                  </button>

                  {/* Exam Popover */}
                  {activeDropdown === 'exam' && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 8px)',
                        left: 0,
                        width: 220,
                        maxWidth: 'calc(100vw - 32px)',
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #E2E8F0',
                        borderRadius: 0,
                        boxShadow: '0 12px 32px rgba(15, 23, 42, 0.14)',
                        padding: 8,
                        zIndex: 100,
                      }}
                    >
                      {(availableExams.length > 0 ? availableExams : ['UPSC CSE']).map((opt) => (
                        <div
                          key={opt}
                          onClick={() => {
                            navigate(
                              `/guest-exam?exam=${encodeURIComponent(opt)}&subject=${encodeURIComponent(gSubject)}&count=${gCount}`,
                            );
                            setActiveDropdown(null);
                          }}
                          style={{
                            padding: '9px 12px',
                            borderRadius: 0,
                            fontSize: 12.5,
                            fontWeight: gExam === opt ? 700 : 500,
                            color: gExam === opt ? '#1E3A8A' : '#334155',
                            backgroundColor: gExam === opt ? '#F8FAFC' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            transition: 'backgroundColor 0.1s ease',
                          }}
                          onMouseEnter={(e) => {
                            if (gExam !== opt) e.currentTarget.style.backgroundColor = '#F8FAFC';
                          }}
                          onMouseLeave={(e) => {
                            if (gExam !== opt)
                              e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <span>{opt}</span>
                          {gExam === opt && <Check size={14} color="#1E3A8A" />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Filter 2: Subject */}
                <div style={{ position: 'relative', flex: 1.2, minWidth: 160 }}>
                  <label
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      color: '#64748B',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      marginBottom: 4,
                      display: 'block',
                    }}
                  >
                    Subject Focus
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveDropdown(activeDropdown === 'subject' ? null : 'subject');
                      setFilterSearchQuery('');
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 14px',
                      borderRadius: 0,
                      border:
                        activeDropdown === 'subject' ? '1px solid #1E3A8A' : '1px solid #E2E8F0',
                      backgroundColor: activeDropdown === 'subject' ? '#FFFFFF' : '#F8FAFC',
                      color: '#172033',
                      fontSize: 13,
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      boxShadow:
                        activeDropdown === 'subject' ? '0 0 0 3px rgba(23, 32, 51, 0.12)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span
                      style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                    >
                      {selectedSubjectsList.length === 0
                        ? 'All Subjects'
                        : selectedSubjectsList.length === 1
                          ? formatEnum(selectedSubjectsList[0])
                          : `${selectedSubjectsList.length} Subjects Selected`}
                    </span>
                    <ChevronDown
                      size={14}
                      color="#64748B"
                      style={{
                        transform: activeDropdown === 'subject' ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.15s ease',
                      }}
                    />
                  </button>

                  {/* Subject Popover with Multi-Select */}
                  {activeDropdown === 'subject' && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 8px)',
                        left: 0,
                        width: 260,
                        maxWidth: 'calc(100vw - 32px)',
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #E2E8F0',
                        borderRadius: 0,
                        boxShadow: '0 12px 32px rgba(15, 23, 42, 0.14)',
                        padding: 10,
                        zIndex: 100,
                      }}
                    >
                      {/* Action Bar */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 6, marginBottom: 6, borderBottom: '1px solid #F1F5F9' }}>
                        <button type="button" onClick={selectAllSubjects} style={{ background: 'none', border: 'none', color: '#1E3A8A', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Select All</button>
                        <button type="button" onClick={() => toggleSubjectFilter('All Subjects')} style={{ background: 'none', border: 'none', color: '#64748B', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Clear</button>
                      </div>

                      {/* Internal Search Bar */}
                      <div style={{ position: 'relative', marginBottom: 8 }}>
                        <Search
                          size={14}
                          color="#94A3B8"
                          style={{ position: 'absolute', left: 10, top: 10 }}
                        />
                        <input
                          type="text"
                          autoFocus
                          placeholder="Search subject..."
                          value={filterSearchQuery}
                          onChange={(e) => setFilterSearchQuery(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '7px 10px 7px 30px',
                            borderRadius: 0,
                            border: '1px solid #E2E8F0',
                            fontSize: 12,
                            outline: 'none',
                            boxSizing: 'border-box',
                            backgroundColor: '#F8FAFC',
                          }}
                        />
                      </div>

                      <div
                        style={{
                          maxHeight: 180,
                          overflowY: 'auto',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 2,
                        }}
                      >
                        {['All Subjects', ...availableSubjectsList]
                          .filter((s) => s.toLowerCase().includes(filterSearchQuery.toLowerCase()))
                          .map((opt) => {
                            const isSelected = opt === 'All Subjects' ? selectedSubjectsList.length === 0 : selectedSubjectsList.includes(opt);
                            return (
                              <div
                                key={opt}
                                onClick={() => toggleSubjectFilter(opt)}
                                style={{
                                  padding: '8px 10px',
                                  borderRadius: 0,
                                  fontSize: 12.5,
                                  fontWeight: isSelected ? 700 : 500,
                                  color: isSelected ? '#1E3A8A' : '#334155',
                                  backgroundColor: isSelected ? '#F1F5F9' : 'transparent',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  cursor: 'pointer',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <input type="checkbox" checked={isSelected} onChange={() => {}} style={{ cursor: 'pointer', accentColor: '#1E3A8A' }} />
                                  <span>{opt}</span>
                                </div>
                                {isSelected && <Check size={14} color="#1E3A8A" />}
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Filter: Topic */}
                <div style={{ position: 'relative', flex: 1.2, minWidth: 160 }}>
                  <label
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      color: '#64748B',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      marginBottom: 4,
                      display: 'block',
                    }}
                  >
                    Topic Focus
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveDropdown(activeDropdown === 'topic' ? null : 'topic');
                      setFilterSearchQuery('');
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 14px',
                      borderRadius: 0,
                      border:
                        activeDropdown === 'topic' ? '1px solid #1E3A8A' : '1px solid #E2E8F0',
                      backgroundColor: activeDropdown === 'topic' ? '#FFFFFF' : '#F8FAFC',
                      color: '#172033',
                      fontSize: 13,
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      boxShadow:
                        activeDropdown === 'topic' ? '0 0 0 3px rgba(23, 32, 51, 0.12)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span
                      style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                    >
                      {selectedTopicsList.length === 0
                        ? 'All Topics'
                        : selectedTopicsList.length === 1
                          ? formatEnum(selectedTopicsList[0])
                          : `${selectedTopicsList.length} Topics Selected`}
                    </span>
                    <ChevronDown
                      size={14}
                      color="#64748B"
                      style={{
                        transform: activeDropdown === 'topic' ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.15s ease',
                      }}
                    />
                  </button>

                  {/* Topic Popover */}
                  {activeDropdown === 'topic' && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 8px)',
                        left: 0,
                        width: 260,
                        maxWidth: 'calc(100vw - 32px)',
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #E2E8F0',
                        borderRadius: 0,
                        boxShadow: '0 12px 32px rgba(15, 23, 42, 0.14)',
                        padding: 10,
                        zIndex: 100,
                      }}
                    >
                      {/* Action Bar */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 6, marginBottom: 6, borderBottom: '1px solid #F1F5F9' }}>
                        <button type="button" onClick={selectAllTopics} style={{ background: 'none', border: 'none', color: '#1E3A8A', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Select All</button>
                        <button type="button" onClick={() => toggleTopicFilter('All Topics')} style={{ background: 'none', border: 'none', color: '#64748B', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Clear</button>
                      </div>

                      <div style={{ position: 'relative', marginBottom: 8 }}>
                        <Search
                          size={14}
                          color="#94A3B8"
                          style={{ position: 'absolute', left: 10, top: 10 }}
                        />
                        <input
                          type="text"
                          autoFocus
                          placeholder="Search topic..."
                          value={filterSearchQuery}
                          onChange={(e) => setFilterSearchQuery(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '7px 10px 7px 30px',
                            borderRadius: 0,
                            border: '1px solid #E2E8F0',
                            fontSize: 12,
                            outline: 'none',
                            boxSizing: 'border-box',
                            backgroundColor: '#F8FAFC',
                          }}
                        />
                      </div>

                      <div
                        style={{
                          maxHeight: 180,
                          overflowY: 'auto',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 2,
                        }}
                      >
                        {['All Topics', ...availableTopicsList]
                          .filter((t) => t.toLowerCase().includes(filterSearchQuery.toLowerCase()))
                          .map((opt) => {
                            const isSelected = opt === 'All Topics' ? selectedTopicsList.length === 0 : selectedTopicsList.includes(opt);
                            return (
                              <div
                                key={opt}
                                onClick={() => toggleTopicFilter(opt)}
                                style={{
                                  padding: '8px 10px',
                                  borderRadius: 0,
                                  fontSize: 12.5,
                                  fontWeight: isSelected ? 700 : 500,
                                  color: isSelected ? '#1E3A8A' : '#334155',
                                  backgroundColor: isSelected ? '#F1F5F9' : 'transparent',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  cursor: 'pointer',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <input type="checkbox" checked={isSelected} onChange={() => {}} style={{ cursor: 'pointer', accentColor: '#1E3A8A' }} />
                                  <span>{opt}</span>
                                </div>
                                {isSelected && <Check size={14} color="#1E3A8A" />}
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Filter: Subtopic */}
                <div style={{ position: 'relative', flex: 1.2, minWidth: 160 }}>
                  <label
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      color: '#64748B',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      marginBottom: 4,
                      display: 'block',
                    }}
                  >
                    Subtopic Focus
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveDropdown(activeDropdown === 'subtopic' ? null : 'subtopic');
                      setFilterSearchQuery('');
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 14px',
                      borderRadius: 0,
                      border:
                        activeDropdown === 'subtopic' ? '1px solid #1E3A8A' : '1px solid #E2E8F0',
                      backgroundColor: activeDropdown === 'subtopic' ? '#FFFFFF' : '#F8FAFC',
                      color: '#172033',
                      fontSize: 13,
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      boxShadow:
                        activeDropdown === 'subtopic' ? '0 0 0 3px rgba(23, 32, 51, 0.12)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span
                      style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                    >
                      {selectedSubtopicsList.length === 0
                        ? 'All Subtopics'
                        : selectedSubtopicsList.length === 1
                          ? formatEnum(selectedSubtopicsList[0])
                          : `${selectedSubtopicsList.length} Subtopics Selected`}
                    </span>
                    <ChevronDown
                      size={14}
                      color="#64748B"
                      style={{
                        transform: activeDropdown === 'subtopic' ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.15s ease',
                      }}
                    />
                  </button>

                  {/* Subtopic Popover */}
                  {activeDropdown === 'subtopic' && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 8px)',
                        left: 0,
                        width: 270,
                        maxWidth: 'calc(100vw - 32px)',
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #E2E8F0',
                        borderRadius: 0,
                        boxShadow: '0 12px 32px rgba(15, 23, 42, 0.14)',
                        padding: 10,
                        zIndex: 100,
                      }}
                    >
                      {/* Action Bar */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 6, marginBottom: 6, borderBottom: '1px solid #F1F5F9' }}>
                        <button type="button" onClick={selectAllSubtopics} style={{ background: 'none', border: 'none', color: '#1E3A8A', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Select All</button>
                        <button type="button" onClick={() => toggleSubtopicFilter('All Subtopics')} style={{ background: 'none', border: 'none', color: '#64748B', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Clear</button>
                      </div>

                      <div style={{ position: 'relative', marginBottom: 8 }}>
                        <Search
                          size={14}
                          color="#94A3B8"
                          style={{ position: 'absolute', left: 10, top: 10 }}
                        />
                        <input
                          type="text"
                          autoFocus
                          placeholder="Search subtopic..."
                          value={filterSearchQuery}
                          onChange={(e) => setFilterSearchQuery(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '7px 10px 7px 30px',
                            borderRadius: 0,
                            border: '1px solid #E2E8F0',
                            fontSize: 12,
                            outline: 'none',
                            boxSizing: 'border-box',
                            backgroundColor: '#F8FAFC',
                          }}
                        />
                      </div>

                      <div
                        style={{
                          maxHeight: 180,
                          overflowY: 'auto',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 2,
                        }}
                      >
                        {['All Subtopics', ...availableSubtopicsList]
                          .filter((st) => st.toLowerCase().includes(filterSearchQuery.toLowerCase()))
                          .map((opt) => {
                            const isSelected = opt === 'All Subtopics' ? selectedSubtopicsList.length === 0 : selectedSubtopicsList.includes(opt);
                            return (
                              <div
                                key={opt}
                                onClick={() => toggleSubtopicFilter(opt)}
                                style={{
                                  padding: '8px 10px',
                                  borderRadius: 0,
                                  fontSize: 12.5,
                                  fontWeight: isSelected ? 700 : 500,
                                  color: isSelected ? '#1E3A8A' : '#334155',
                                  backgroundColor: isSelected ? '#F1F5F9' : 'transparent',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  cursor: 'pointer',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <input type="checkbox" checked={isSelected} onChange={() => {}} style={{ cursor: 'pointer', accentColor: '#1E3A8A' }} />
                                  <span>{opt}</span>
                                </div>
                                {isSelected && <Check size={14} color="#1E3A8A" />}
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Filter 3: Difficulty */}
                <div style={{ position: 'relative', flex: 1, minWidth: 130 }}>
                  <label
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      color: '#64748B',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      marginBottom: 4,
                      display: 'block',
                    }}
                  >
                    Difficulty
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveDropdown(activeDropdown === 'difficulty' ? null : 'difficulty');
                      setFilterSearchQuery('');
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 14px',
                      borderRadius: 0,
                      border:
                        activeDropdown === 'difficulty' ? '1px solid #1E3A8A' : '1px solid #E2E8F0',
                      backgroundColor: activeDropdown === 'difficulty' ? '#FFFFFF' : '#F8FAFC',
                      color: '#172033',
                      fontSize: 13,
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      boxShadow:
                        activeDropdown === 'difficulty'
                          ? '0 0 0 3px rgba(23, 32, 51, 0.12)'
                          : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span>{gDifficulty ? gDifficulty : 'All Levels'}</span>
                    <ChevronDown
                      size={14}
                      color="#64748B"
                      style={{
                        transform: activeDropdown === 'difficulty' ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.15s ease',
                      }}
                    />
                  </button>

                  {/* Difficulty Popover */}
                  {activeDropdown === 'difficulty' && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 8px)',
                        left: 0,
                        width: 170,
                        maxWidth: 'calc(100vw - 32px)',
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #E2E8F0',
                        borderRadius: 0,
                        boxShadow: '0 12px 32px rgba(15, 23, 42, 0.14)',
                        padding: 8,
                        zIndex: 100,
                      }}
                    >
                      {['All Levels', 'EASY', 'MEDIUM', 'HARD'].map((opt) => {
                        const isSelected =
                          (opt === 'All Levels' && !gDifficulty) ||
                          gDifficulty.toUpperCase() === opt;
                        return (
                          <div
                            key={opt}
                            onClick={() => {
                              const val = opt === 'All Levels' ? '' : opt;
                              navigate(
                                `/guest-exam?exam=${encodeURIComponent(gExam)}&subject=${encodeURIComponent(gSubject)}&difficulty=${encodeURIComponent(val)}&count=${gCount}`,
                              );
                              setActiveDropdown(null);
                            }}
                            style={{
                              padding: '8px 10px',
                              borderRadius: 0,
                              fontSize: 12.5,
                              fontWeight: isSelected ? 700 : 500,
                              color: isSelected ? '#1E3A8A' : '#334155',
                              backgroundColor: isSelected ? '#F8FAFC' : 'transparent',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              cursor: 'pointer',
                            }}
                            onMouseEnter={(e) => {
                              if (!isSelected) e.currentTarget.style.backgroundColor = '#F8FAFC';
                            }}
                            onMouseLeave={(e) => {
                              if (!isSelected)
                                e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            <span>{opt}</span>
                            {isSelected && <Check size={14} color="#1E3A8A" />}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            }
          </div>
        </div>
      )}
      {/* Mobile/Tablet Filter Top-Sheet (dropdown from top, replaces the inline filter bar) */}
      {isTabletOrBelow && !isFocusMode && showMobileFilterPanel && (
        <>
          <div
            onClick={() => setShowMobileFilterPanel(false)}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.4)',
              zIndex: 150,
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 151,
              backgroundColor: '#FFFFFF',
              borderBottom: '1px solid #E2E8F0',
              boxShadow: '0 20px 40px rgba(15, 23, 42, 0.18)',
              padding: '14px 16px 18px 16px',
              maxHeight: '85vh',
              overflowY: 'auto',
              boxSizing: 'border-box',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 14,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <SlidersHorizontal size={16} color="#1E3A8A" />
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: '#1E3A8A',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  Filters
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowMobileFilterPanel(false)}
                className="touch-target center-content"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748B',
                  cursor: 'pointer',
                  padding: 4,
                }}
                aria-label="Close filters"
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Filter 1: Exam */}
              <div style={{ position: 'relative', flex: 1, minWidth: 140 }}>
                <label
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: '#64748B',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: 4,
                    display: 'block',
                  }}
                >
                  Exam Target
                </label>
                <button
                  type="button"
                  disabled={isExamLocked}
                  onClick={() => {
                    if (!isExamLocked) {
                      setActiveDropdown(activeDropdown === 'exam' ? null : 'exam');
                      setFilterSearchQuery('');
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 14px',
                    borderRadius: 0,
                    border: activeDropdown === 'exam' ? '1px solid #1E3A8A' : '1px solid #E2E8F0',
                    backgroundColor: activeDropdown === 'exam' ? '#FFFFFF' : '#F8FAFC',
                    color: '#172033',
                    fontSize: 13,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: isExamLocked ? 'not-allowed' : 'pointer',
                    opacity: isExamLocked ? 0.7 : 1,
                    boxShadow:
                      activeDropdown === 'exam' ? '0 0 0 3px rgba(23, 32, 51, 0.12)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span
                    style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                  >
                    {gExam}
                  </span>
                  {!isExamLocked && (
                    <ChevronDown
                      size={14}
                      color="#64748B"
                      style={{
                        transform: activeDropdown === 'exam' ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.15s ease',
                      }}
                    />
                  )}
                </button>

                {/* Exam Popover */}
                {activeDropdown === 'exam' && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 8px)',
                      left: 0,
                      width: 220,
                      maxWidth: 'calc(100vw - 32px)',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #E2E8F0',
                      borderRadius: 0,
                      boxShadow: '0 12px 32px rgba(15, 23, 42, 0.14)',
                      padding: 8,
                      zIndex: 100,
                    }}
                  >
                    {(availableExams.length > 0 ? availableExams : ['UPSC CSE']).map((opt) => (
                      <div
                        key={opt}
                        onClick={() => {
                          navigate(
                            `/guest-exam?exam=${encodeURIComponent(opt)}&subject=${encodeURIComponent(gSubject)}&count=${gCount}`,
                          );
                          setActiveDropdown(null);
                        }}
                        style={{
                          padding: '9px 12px',
                          borderRadius: 0,
                          fontSize: 12.5,
                          fontWeight: gExam === opt ? 700 : 500,
                          color: gExam === opt ? '#1E3A8A' : '#334155',
                          backgroundColor: gExam === opt ? '#F8FAFC' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          transition: 'backgroundColor 0.1s ease',
                        }}
                        onMouseEnter={(e) => {
                          if (gExam !== opt) e.currentTarget.style.backgroundColor = '#F8FAFC';
                        }}
                        onMouseLeave={(e) => {
                          if (gExam !== opt) e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <span>{opt}</span>
                        {gExam === opt && <Check size={14} color="#1E3A8A" />}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Filter 2: Subject */}
              <div style={{ position: 'relative', flex: 1.2, minWidth: 160 }}>
                <label
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: '#64748B',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: 4,
                    display: 'block',
                  }}
                >
                  Subject Focus
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setActiveDropdown(activeDropdown === 'subject' ? null : 'subject');
                    setFilterSearchQuery('');
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 14px',
                    borderRadius: 0,
                    border:
                      activeDropdown === 'subject' ? '1px solid #1E3A8A' : '1px solid #E2E8F0',
                    backgroundColor: activeDropdown === 'subject' ? '#FFFFFF' : '#F8FAFC',
                    color: '#172033',
                    fontSize: 13,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    boxShadow:
                      activeDropdown === 'subject' ? '0 0 0 3px rgba(23, 32, 51, 0.12)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span
                    style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                  >
                    {selectedSubjectsList.length === 0
                      ? 'All Subjects'
                      : selectedSubjectsList.length === 1
                        ? formatEnum(selectedSubjectsList[0])
                        : `${selectedSubjectsList.length} Subjects Selected`}
                  </span>
                  <ChevronDown
                    size={14}
                    color="#64748B"
                    style={{
                      transform: activeDropdown === 'subject' ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.15s ease',
                    }}
                  />
                </button>

                {/* Subject Popover */}
                {activeDropdown === 'subject' && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 8px)',
                      left: 0,
                      width: 250,
                      maxWidth: 'calc(100vw - 32px)',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #E2E8F0',
                      borderRadius: 0,
                      boxShadow: '0 12px 32px rgba(15, 23, 42, 0.14)',
                      padding: 10,
                      zIndex: 100,
                    }}
                  >
                    {/* Action Bar */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 6, marginBottom: 6, borderBottom: '1px solid #F1F5F9' }}>
                      <button type="button" onClick={selectAllSubjects} style={{ background: 'none', border: 'none', color: '#1E3A8A', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Select All</button>
                      <button type="button" onClick={() => toggleSubjectFilter('All Subjects')} style={{ background: 'none', border: 'none', color: '#64748B', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Clear</button>
                    </div>

                    <div style={{ position: 'relative', marginBottom: 8 }}>
                      <Search
                        size={14}
                        color="#94A3B8"
                        style={{ position: 'absolute', left: 10, top: 10 }}
                      />
                      <input
                        type="text"
                        autoFocus
                        placeholder="Search subject..."
                        value={filterSearchQuery}
                        onChange={(e) => setFilterSearchQuery(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '7px 10px 7px 30px',
                          borderRadius: 0,
                          border: '1px solid #E2E8F0',
                          fontSize: 12,
                          outline: 'none',
                          boxSizing: 'border-box',
                          backgroundColor: '#F8FAFC',
                        }}
                      />
                    </div>

                    <div
                      style={{
                        maxHeight: 180,
                        overflowY: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                      }}
                    >
                      {['All Subjects', ...availableSubjectsList]
                        .filter((s) => s.toLowerCase().includes(filterSearchQuery.toLowerCase()))
                        .map((opt) => {
                          const isSelected = opt === 'All Subjects' ? selectedSubjectsList.length === 0 : selectedSubjectsList.includes(opt);
                          return (
                            <div
                              key={opt}
                              onClick={() => toggleSubjectFilter(opt)}
                              style={{
                                padding: '8px 10px',
                                borderRadius: 0,
                                fontSize: 12.5,
                                fontWeight: isSelected ? 700 : 500,
                                color: isSelected ? '#1E3A8A' : '#334155',
                                backgroundColor: isSelected ? '#F1F5F9' : 'transparent',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                cursor: 'pointer',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <input type="checkbox" checked={isSelected} onChange={() => {}} style={{ cursor: 'pointer', accentColor: '#1E3A8A' }} />
                                <span>{opt}</span>
                              </div>
                              {isSelected && <Check size={14} color="#1E3A8A" />}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>

              {/* Filter: Topic */}
              <div style={{ position: 'relative', flex: 1.2, minWidth: 160 }}>
                <label
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: '#64748B',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: 4,
                    display: 'block',
                  }}
                >
                  Topic Focus
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setActiveDropdown(activeDropdown === 'topic' ? null : 'topic');
                    setFilterSearchQuery('');
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 14px',
                    borderRadius: 0,
                    border:
                      activeDropdown === 'topic' ? '1px solid #1E3A8A' : '1px solid #E2E8F0',
                    backgroundColor: activeDropdown === 'topic' ? '#FFFFFF' : '#F8FAFC',
                    color: '#172033',
                    fontSize: 13,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    boxShadow:
                      activeDropdown === 'topic' ? '0 0 0 3px rgba(23, 32, 51, 0.12)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span
                    style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                  >
                    {selectedTopicsList.length === 0
                      ? 'All Topics'
                      : selectedTopicsList.length === 1
                        ? formatEnum(selectedTopicsList[0])
                        : `${selectedTopicsList.length} Topics Selected`}
                  </span>
                  <ChevronDown
                    size={14}
                    color="#64748B"
                    style={{
                      transform: activeDropdown === 'topic' ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.15s ease',
                    }}
                  />
                </button>

                {/* Topic Popover */}
                {activeDropdown === 'topic' && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 8px)',
                      left: 0,
                      width: 260,
                      maxWidth: 'calc(100vw - 32px)',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #E2E8F0',
                      borderRadius: 0,
                      boxShadow: '0 12px 32px rgba(15, 23, 42, 0.14)',
                      padding: 10,
                      zIndex: 100,
                    }}
                  >
                    {/* Action Bar */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 6, marginBottom: 6, borderBottom: '1px solid #F1F5F9' }}>
                      <button type="button" onClick={selectAllTopics} style={{ background: 'none', border: 'none', color: '#1E3A8A', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Select All</button>
                      <button type="button" onClick={() => toggleTopicFilter('All Topics')} style={{ background: 'none', border: 'none', color: '#64748B', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Clear</button>
                    </div>

                    <div style={{ position: 'relative', marginBottom: 8 }}>
                      <Search
                        size={14}
                        color="#94A3B8"
                        style={{ position: 'absolute', left: 10, top: 10 }}
                      />
                      <input
                        type="text"
                        autoFocus
                        placeholder="Search topic..."
                        value={filterSearchQuery}
                        onChange={(e) => setFilterSearchQuery(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '7px 10px 7px 30px',
                          borderRadius: 0,
                          border: '1px solid #E2E8F0',
                          fontSize: 12,
                          outline: 'none',
                          boxSizing: 'border-box',
                          backgroundColor: '#F8FAFC',
                        }}
                      />
                    </div>

                    <div
                      style={{
                        maxHeight: 180,
                        overflowY: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                      }}
                    >
                      {['All Topics', ...availableTopicsList]
                        .filter((t) => t.toLowerCase().includes(filterSearchQuery.toLowerCase()))
                        .map((opt) => {
                          const isSelected = opt === 'All Topics' ? selectedTopicsList.length === 0 : selectedTopicsList.includes(opt);
                          return (
                            <div
                              key={opt}
                              onClick={() => toggleTopicFilter(opt)}
                              style={{
                                padding: '8px 10px',
                                borderRadius: 0,
                                fontSize: 12.5,
                                fontWeight: isSelected ? 700 : 500,
                                color: isSelected ? '#1E3A8A' : '#334155',
                                backgroundColor: isSelected ? '#F1F5F9' : 'transparent',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                cursor: 'pointer',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <input type="checkbox" checked={isSelected} onChange={() => {}} style={{ cursor: 'pointer', accentColor: '#1E3A8A' }} />
                                <span>{opt}</span>
                              </div>
                              {isSelected && <Check size={14} color="#1E3A8A" />}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>

              {/* Filter: Subtopic */}
              <div style={{ position: 'relative', flex: 1.2, minWidth: 160 }}>
                <label
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: '#64748B',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: 4,
                    display: 'block',
                  }}
                >
                  Subtopic Focus
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setActiveDropdown(activeDropdown === 'subtopic' ? null : 'subtopic');
                    setFilterSearchQuery('');
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 14px',
                    borderRadius: 0,
                    border:
                      activeDropdown === 'subtopic' ? '1px solid #1E3A8A' : '1px solid #E2E8F0',
                    backgroundColor: activeDropdown === 'subtopic' ? '#FFFFFF' : '#F8FAFC',
                    color: '#172033',
                    fontSize: 13,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    boxShadow:
                      activeDropdown === 'subtopic' ? '0 0 0 3px rgba(23, 32, 51, 0.12)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span
                    style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                  >
                    {selectedSubtopicsList.length === 0
                      ? 'All Subtopics'
                      : selectedSubtopicsList.length === 1
                        ? formatEnum(selectedSubtopicsList[0])
                        : `${selectedSubtopicsList.length} Subtopics Selected`}
                  </span>
                  <ChevronDown
                    size={14}
                    color="#64748B"
                    style={{
                      transform: activeDropdown === 'subtopic' ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.15s ease',
                    }}
                  />
                </button>

                {/* Subtopic Popover */}
                {activeDropdown === 'subtopic' && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 8px)',
                      left: 0,
                      width: 270,
                      maxWidth: 'calc(100vw - 32px)',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #E2E8F0',
                      borderRadius: 0,
                      boxShadow: '0 12px 32px rgba(15, 23, 42, 0.14)',
                      padding: 10,
                      zIndex: 100,
                    }}
                  >
                    {/* Action Bar */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 6, marginBottom: 6, borderBottom: '1px solid #F1F5F9' }}>
                      <button type="button" onClick={selectAllSubtopics} style={{ background: 'none', border: 'none', color: '#1E3A8A', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Select All</button>
                      <button type="button" onClick={() => toggleSubtopicFilter('All Subtopics')} style={{ background: 'none', border: 'none', color: '#64748B', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Clear</button>
                    </div>

                    <div style={{ position: 'relative', marginBottom: 8 }}>
                      <Search
                        size={14}
                        color="#94A3B8"
                        style={{ position: 'absolute', left: 10, top: 10 }}
                      />
                      <input
                        type="text"
                        autoFocus
                        placeholder="Search subtopic..."
                        value={filterSearchQuery}
                        onChange={(e) => setFilterSearchQuery(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '7px 10px 7px 30px',
                          borderRadius: 0,
                          border: '1px solid #E2E8F0',
                          fontSize: 12,
                          outline: 'none',
                          boxSizing: 'border-box',
                          backgroundColor: '#F8FAFC',
                        }}
                      />
                    </div>

                    <div
                      style={{
                        maxHeight: 180,
                        overflowY: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                      }}
                    >
                      {['All Subtopics', ...availableSubtopicsList]
                        .filter((st) => st.toLowerCase().includes(filterSearchQuery.toLowerCase()))
                        .map((opt) => {
                          const isSelected = opt === 'All Subtopics' ? selectedSubtopicsList.length === 0 : selectedSubtopicsList.includes(opt);
                          return (
                            <div
                              key={opt}
                              onClick={() => toggleSubtopicFilter(opt)}
                              style={{
                                padding: '8px 10px',
                                borderRadius: 0,
                                fontSize: 12.5,
                                fontWeight: isSelected ? 700 : 500,
                                color: isSelected ? '#1E3A8A' : '#334155',
                                backgroundColor: isSelected ? '#F1F5F9' : 'transparent',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                cursor: 'pointer',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <input type="checkbox" checked={isSelected} onChange={() => {}} style={{ cursor: 'pointer', accentColor: '#1E3A8A' }} />
                                <span>{opt}</span>
                              </div>
                              {isSelected && <Check size={14} color="#1E3A8A" />}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>

              {/* Filter 3: Difficulty */}
              <div style={{ position: 'relative', flex: 1, minWidth: 130 }}>
                <label
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: '#64748B',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: 4,
                    display: 'block',
                  }}
                >
                  Difficulty
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setActiveDropdown(activeDropdown === 'difficulty' ? null : 'difficulty');
                    setFilterSearchQuery('');
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 14px',
                    borderRadius: 0,
                    border:
                      activeDropdown === 'difficulty' ? '1px solid #1E3A8A' : '1px solid #E2E8F0',
                    backgroundColor: activeDropdown === 'difficulty' ? '#FFFFFF' : '#F8FAFC',
                    color: '#172033',
                    fontSize: 13,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    boxShadow:
                      activeDropdown === 'difficulty' ? '0 0 0 3px rgba(23, 32, 51, 0.12)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span>{gDifficulty ? gDifficulty : 'All Levels'}</span>
                  <ChevronDown
                    size={14}
                    color="#64748B"
                    style={{
                      transform: activeDropdown === 'difficulty' ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.15s ease',
                    }}
                  />
                </button>

                {/* Difficulty Popover */}
                {activeDropdown === 'difficulty' && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 8px)',
                      left: 0,
                      width: 170,
                      maxWidth: 'calc(100vw - 32px)',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #E2E8F0',
                      borderRadius: 0,
                      boxShadow: '0 12px 32px rgba(15, 23, 42, 0.14)',
                      padding: 8,
                      zIndex: 100,
                    }}
                  >
                    {['All Levels', 'EASY', 'MEDIUM', 'HARD'].map((opt) => {
                      const isSelected =
                        (opt === 'All Levels' && !gDifficulty) || gDifficulty.toUpperCase() === opt;
                      return (
                        <div
                          key={opt}
                          onClick={() => {
                            const val = opt === 'All Levels' ? '' : opt;
                            navigate(
                              `/guest-exam?exam=${encodeURIComponent(gExam)}&subject=${encodeURIComponent(gSubject)}&difficulty=${encodeURIComponent(val)}&count=${gCount}`,
                            );
                            setActiveDropdown(null);
                          }}
                          style={{
                            padding: '8px 10px',
                            borderRadius: 0,
                            fontSize: 12.5,
                            fontWeight: isSelected ? 700 : 500,
                            color: isSelected ? '#1E3A8A' : '#334155',
                            backgroundColor: isSelected ? '#F8FAFC' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) e.currentTarget.style.backgroundColor = '#F8FAFC';
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected)
                              e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <span>{opt}</span>
                          {isSelected && <Check size={14} color="#1E3A8A" />}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Mobile/Tablet Recommended Questions Modal */}
      {isTabletOrBelow && showMobileRecs && (
        <div
          className="auth-modal-overlay"
          onClick={() => setShowMobileRecs(false)}
          role="dialog"
          aria-modal="true"
          style={{
            borderRadius: '5 !important',
          }}
        >
          <div
            className="auth-modal-card"
            style={{ maxWidth: 440, maxHeight: '80vh', overflowY: 'auto', padding: 16 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Lightbulb size={16} color="#1E3A8A" />
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: '#1E3A8A',
                    textTransform: 'uppercase',
                  }}
                >
                  Cross Exam Similar Questions ({displayRecs.length})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowMobileRecs(false)}
                className="touch-target center-content"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748B',
                  cursor: 'pointer',
                  padding: 4,
                }}
                aria-label="Close recommendations"
              >
                <X size={20} />
              </button>
            </div>

            <RecommendedQuestionsPanel
              title={null}
              questions={displayRecs}
              isLoading={isPrefetchingRecs}
              expandedId={expandedRecId}
              selectedOptions={recUserResponses}
              solutions={recSolutions}
              solutionLoading={recSolutionLoading}
              onToggleExpand={handleSelectRecommendation}
              onSelectOption={handleSelectRecommendationOption}
              examFilterToggles={recExamToggles}
              onToggleExamFilter={toggleRecExam}
              language={language}
            />
          </div>
        </div>
      )}
      {/* 3. Main Workspace Container */}
      <div
        style={{
          display: 'flex',
          flex: 1,
          minHeight: 0,
          paddingTop: 12,
          paddingBottom: 16,
          paddingRight: isTabletOrBelow ? 12 : 24,
          paddingLeft: isTabletOrBelow ? 12 : 24,
          overflow: 'visible',
          position: 'relative',
          backgroundColor: '#F8FAF8',
          boxSizing: 'border-box',
          gap: !isTabletOrBelow && !isFocusMode ? 20 : 0,
        }}
      >
        {/* Subtle Translating Indicator */}
        {isTranslatingActiveQ && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full shadow-md animate-pulse">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            Translating question to selected language...
          </div>
        )}

        {/* Center Reading Canvas */}
        <ExamQuestionCard
          question={activeQuestion}
          questionIndex={currentQIndex}
          totalQuestions={totalQuestions}
          selectedOptionId={currentResponse?.optionId || null}
          selectedOptionLabel={currentResponse?.optionLabel || null}
          isBookmarked={!!bookmarkedQs[currentQIndex]}
          language={language}
          mode="PRACTICE"
          revealResult={currentRevealedResult}
          isRevealing={isSolutionLoading}
          solutionData={
            activeQuestion
              ? practiceSolutions[activeQuestion.question_id] ||
                practiceSolutions[String(activeQuestion.question_id)] ||
                null
              : null
          }
          onSelectOption={(optId, optLbl) => handleSelectOption(optId, optLbl)}
          onToggleBookmark={() =>
            setBookmarkedQs((prev) => ({ ...prev, [currentQIndex]: !prev[currentQIndex] }))
          }
          onRevealAnswer={() => handleRevealAnswer()}
          onShowSolution={() => handleShowSolution()}
          onPrev={() => currentQIndex > 0 && handleSelectQuestion(currentQIndex - 1)}
          onNext={() =>
            currentQIndex < totalQuestions - 1 && handleSelectQuestion(currentQIndex + 1)
          }
        />

        {/* Right Side Recommended Questions Fixed Panel (Desktop) */}
        {!isTabletOrBelow && !isFocusMode && (
          <aside
            style={{
              width: 380,
              backgroundColor: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: 0,
              display: 'flex',
              flexDirection: 'column',
              padding: '16px 14px',
              gap: 14,
              overflowY: 'auto',
              flexShrink: 0,
              height: '100%',
              boxShadow:
                '0 10px 30px -5px rgba(15, 23, 42, 0.08), 0 4px 12px rgba(15, 23, 42, 0.03)',
            }}
          >
            <RecommendedQuestionsPanel
              subtitle={`Matched questions for ${gSubject || 'your focus area'}.`}
              questions={displayRecs}
              isLoading={isPrefetchingRecs}
              expandedId={expandedRecId}
              selectedOptions={recUserResponses}
              solutions={recSolutions}
              solutionLoading={recSolutionLoading}
              onToggleExpand={handleSelectRecommendation}
              onSelectOption={handleSelectRecommendationOption}
              examFilterToggles={recExamToggles}
              onToggleExamFilter={toggleRecExam}
              language={language}
            />
          </aside>
        )}
      </div>

      {/* Floating 10-Second Post-Exam Countdown Banner */}
      {scoreCountdown !== null && (
        <div
          style={{
            position: 'fixed',
            bottom: 74,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 990,
            backgroundColor: '#172033',
            color: '#FFFFFF',
            borderRadius: 0,
            padding: '10px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            boxShadow: '0 12px 30px rgba(15, 23, 42, 0.35)',
            border: '1.5px solid rgba(255, 255, 255, 0.15)',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}
          >
            <span
              style={{
                width: 26,
                height: 26,
                borderRadius: 0,
                backgroundColor: 'var(--primary-red)',
                color: '#FFFFFF',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13,
                fontWeight: 800,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {scoreCountdown}
            </span>
            <span>Test Finished! Showing score report in {scoreCountdown}s...</span>
          </div>

          <button
            type="button"
            onClick={() => {
              setScoreCountdown(null);
              setShowScoreModal(true);
            }}
            style={{
              padding: '6px 14px',
              borderRadius: 0,
              border: 'none',
              backgroundColor: 'var(--primary-red)',
              color: '#FFFFFF',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--accent-darker)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--primary-red)';
            }}
          >
            View Score Now &rsaquo;
          </button>
        </div>
      )}

      {/* Completion Score & Account Upsell Modal */}
      <GuestScoreModal
        isOpen={showScoreModal}
        scoreData={guestScoreData}
        onClose={() => setShowScoreModal(false)}
        onRetake={() => {
          setShowScoreModal(false);
          setRevealedMap({});
          setUserResponses({});
          setMarkedForReview({});
          setCurrentQIndex(0);
        }}
      />

      {/* Leave Practice Session Pop-up Modal */}
      {showLeaveModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            animation: 'fadeIn 0.2s ease-out',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 420,
              backgroundColor: '#FFFFFF',
              borderRadius: 0,
              padding: '28px 28px',
              border: '2px solid #E2E8F0',
              boxShadow: '0 20px 40px -10px rgba(15, 23, 42, 0.25)',
              textAlign: 'center',
              fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif",
            }}
          >
            <div
              style={{
                width: 50,
                height: 50,
                borderRadius: 0,
                backgroundColor: '#FEF2F2',
                border: '1px solid #FECACA',
                color: '#DC2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 14px auto',
              }}
            >
              <span style={{ fontSize: 22, fontWeight: 800 }}>!</span>
            </div>

            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#172033', margin: '0 0 8px 0' }}>
              Leave Practice Session?
            </h3>

            <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.5, margin: '0 0 22px 0' }}>
              Your current test progress is temporarily cached in your browser. You can return
              anytime or start fresh.
            </p>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => setShowLeaveModal(false)}
                style={{
                  flex: 1,
                  height: 42,
                  borderRadius: 0,
                  border: '1.5px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: '#475569',
                  fontSize: 13.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#F8FAFC';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#FFFFFF';
                }}
              >
                Continue Practice
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowLeaveModal(false);
                  navigate('/');
                }}
                style={{
                  flex: 1,
                  height: 42,
                  borderRadius: 0,
                  border: 'none',
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  fontSize: 13.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(220, 38, 38, 0.25)',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#B91C1C';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#DC2626';
                }}
              >
                Leave Session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Guest Question Limit Reached / Log In Modal */}
      {showLoginModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            animation: 'fadeIn 0.2s ease-out',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 440,
              backgroundColor: '#FFFFFF',
              borderRadius: 0,
              padding: '32px 28px',
              border: '1.5px solid #E2E8F0',
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
              textAlign: 'center',
              fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif",
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 0,
                backgroundColor: '#F8FAFC',
                border: '1px solid #BFDBFE',
                color: '#1E3A8A',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto',
              }}
            >
              <Lightbulb size={26} color="#1E3A8A" />
            </div>

            <div
              style={{
                display: 'inline-block',
                backgroundColor: '#FEF3C7',
                color: '#92400E',
                fontSize: 11,
                fontWeight: 800,
                padding: '3px 10px',
                borderRadius: 0,
                marginBottom: 10,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              Guest Limit Reached (10 Questions)
            </div>

            <h3
              style={{
                fontSize: 20,
                fontWeight: 800,
                color: '#172033',
                margin: '0 0 10px 0',
                lineHeight: 1.3,
              }}
            >
              Log in to Unlock More Questions
            </h3>

            <p style={{ fontSize: 13.5, color: '#64748B', lineHeight: 1.5, margin: '0 0 24px 0' }}>
              You've experienced your 10 free practice questions limit for guest users. Log in or
              create your free account to access 10,000+ PYQs, subtopic filters, detailed
              explanations, and unlimited test series!
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                type="button"
                onClick={() => {
                  setShowLoginModal(false);
                  navigate('/login');
                }}
                style={{
                  width: '100%',
                  height: 46,
                  borderRadius: 0,
                  border: 'none',
                  backgroundColor: '#1E3A8A',
                  color: '#FFFFFF',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(23, 32, 51, 0.3)',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--accent-darker)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#1E3A8A';
                }}
              >
                <GraduationCap size={18} color="#FFFFFF" />
                Log In / Sign Up Now &rsaquo;
              </button>

              <button
                type="button"
                onClick={() => setShowLoginModal(false)}
                style={{
                  width: '100%',
                  height: 42,
                  borderRadius: 0,
                  border: '1.5px solid #E2E8F0',
                  backgroundColor: '#FFFFFF',
                  color: '#64748B',
                  fontSize: 13.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#F8FAFC';
                  e.currentTarget.style.color = '#334155';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#FFFFFF';
                  e.currentTarget.style.color = '#64748B';
                }}
              >
                Review Current 10 Questions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
