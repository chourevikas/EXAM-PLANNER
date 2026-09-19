import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  SlidersHorizontal,
  ChevronDown,
  Check,
  Search,
  CheckCircle2,
  X,
  Lightbulb,
  Loader2,
} from 'lucide-react';
import { ExamHeader } from '../components/exam/ExamHeader';
import { ExamQuestionCard } from '../components/exam/ExamQuestionCard';
import { GuestScoreModal } from '../components/exam/GuestScoreModal';
import { ExamLoaderOverlay } from '../components/exam/ExamLoaderOverlay';
import { RecommendedQuestionsPanel, ExamFilterToggles } from '../components/exam/RecommendedQuestionsPanel';
import { QuestionSolutionData } from '../components/exam/QuestionSolutionMarkdownCard';
import { QuestionOut, QuestionPaletteItem, RevealAnswerResponse } from '../types/exam';
import { fetchMasterSyllabus, verifySyllabusNode, listExams, fetchExamsByYear } from '../services/examService';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { addBookmark, removeBookmark, listBookmarks } from '../services/bookmarkService';
import { saveGuestAttempt } from '../utils/guestStorage';
import { formatEnum, extractCanonicalExamName, cleanExamTitle } from '../utils/formatEnum';
import { guardedFetch } from '../utils/apiGuard';
import { parseTaxonomyParam, formatTaxonomyParam, parseYearParam } from '../utils/taxonomyParam';

export function StudentPracticeExamPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // URL Params
  const gExam = searchParams.get('exam') || 'UPSC CSE';
  const gYear = searchParams.get('year') || '';
  const gSubject = searchParams.get('subject') || '';
  const gTopic = searchParams.get('topic') || '';
  const gSubtopic = searchParams.get('subtopic') || '';
  const gDifficulty = searchParams.get('difficulty') || '';
  const gCount = parseInt(searchParams.get('count') || '10', 10);

  // Interactive Filter Bar Popover State
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  // Close active dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-dropdown-container]')) {
        setActiveDropdown(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [filterSearchQuery, setFilterSearchQuery] = useState('');
  const [isFocusMode, setIsFocusMode] = useState(false);

  // Master Syllabus Taxonomy & Available Exams state fetched directly from live APIs
  const [masterSyllabus, setMasterSyllabus] = useState<any>(null);
  const [availableExams, setAvailableExams] = useState<string[]>([]);
  const [yearOptions, setYearOptions] = useState<string[]>(['All Years']);

  const selectedYearsList = useMemo(() => {
    return parseYearParam(gYear, yearOptions);
  }, [gYear, yearOptions]);

  // Computed dynamic list of topics based on selected subject
  // Selected Multi-Select Arrays derived from URL parameters
  const selectedSubjectsList = useMemo(() => {
    return parseTaxonomyParam(gSubject);
  }, [gSubject]);

  // Computed dynamic list of topics based on selected subjects
  const availableTopicsList = useMemo(() => {
    const hierarchy = masterSyllabus?.hierarchy || {};
    const topicsSet = new Set<string>();
    if (selectedSubjectsList.length === 0) {
      Object.values(hierarchy).forEach((topicsMap: any) => {
        if (topicsMap && typeof topicsMap === 'object') {
          Object.keys(topicsMap).forEach((t) => topicsSet.add(t));
        }
      });
    } else {
      selectedSubjectsList.forEach((subj) => {
        const topicsMap = hierarchy[subj];
        if (topicsMap && typeof topicsMap === 'object') {
          Object.keys(topicsMap).forEach((t) => topicsSet.add(t));
        }
      });
    }
    return Array.from(topicsSet).sort();
  }, [selectedSubjectsList, masterSyllabus]);

  const selectedTopicsList = useMemo(() => {
    return parseTaxonomyParam(gTopic, availableTopicsList);
  }, [gTopic, availableTopicsList]);

  // Computed dynamic list of subtopics based on selected subjects and topics
  const availableSubtopicsList = useMemo(() => {
    const hierarchy = masterSyllabus?.hierarchy || {};
    const subSet = new Set<string>();
    if (selectedTopicsList.length > 0) {
      if (selectedSubjectsList.length > 0) {
        selectedSubjectsList.forEach((subj) => {
          const topicsMap = hierarchy[subj] || {};
          selectedTopicsList.forEach((top) => {
            const list = topicsMap[top];
            if (Array.isArray(list)) {
              list.forEach((st: string) => {
                if (!st.startsWith('All Subtopics')) subSet.add(st);
              });
            }
          });
        });
      } else {
        Object.values(hierarchy).forEach((topicsMap: any) => {
          if (topicsMap && typeof topicsMap === 'object') {
            selectedTopicsList.forEach((top) => {
              const list = topicsMap[top];
              if (Array.isArray(list)) {
                list.forEach((st: string) => {
                  if (!st.startsWith('All Subtopics')) subSet.add(st);
                });
              }
            });
          }
        });
      }
    } else if (selectedSubjectsList.length > 0) {
      selectedSubjectsList.forEach((subj) => {
        const topicsMap = hierarchy[subj] || {};
        Object.values(topicsMap).forEach((subList: any) => {
          if (Array.isArray(subList)) {
            subList.forEach((st: string) => {
              if (!st.startsWith('All Subtopics')) subSet.add(st);
            });
          }
        });
      });
    } else {
      Object.values(hierarchy).forEach((topicsMap: any) => {
        if (topicsMap && typeof topicsMap === 'object') {
          Object.values(topicsMap).forEach((subList: any) => {
            if (Array.isArray(subList)) {
              subList.forEach((st: string) => {
                if (!st.startsWith('All Subtopics')) subSet.add(st);
              });
            }
          });
        }
      });
    }
    return Array.from(subSet).sort();
  }, [selectedSubjectsList, selectedTopicsList, masterSyllabus]);

  const selectedSubtopicsList = useMemo(() => {
    return parseTaxonomyParam(gSubtopic, availableSubtopicsList);
  }, [gSubtopic, availableSubtopicsList]);

  // Multi-Select Toggle & Select All Helpers
  const toggleYearFilter = (yearName: string) => {
    const current = new URLSearchParams(searchParams);
    if (yearName.startsWith('All Years') || yearName === 'All Years') {
      if (yearOptions.length > 0) {
        current.set('year', yearOptions[0]);
      } else {
        current.delete('year');
      }
    } else {
      let updated: string[];
      if (selectedYearsList.includes(yearName)) {
        updated = selectedYearsList.filter((y) => y !== yearName);
      } else {
        updated = [...selectedYearsList, yearName];
      }
      if (updated.length === 0) {
        if (yearOptions.length > 0) {
          current.set('year', yearOptions[0]);
        } else {
          current.delete('year');
        }
      } else {
        current.set('year', formatTaxonomyParam(updated));
      }
    }
    navigate(`/practice-exam?${current.toString()}`);
  };

  const selectAllYears = () => {
    const current = new URLSearchParams(searchParams);
    const individualYears = yearOptions.filter((y) => !y.startsWith('All Years'));
    if (individualYears.length > 0) {
      current.set('year', formatTaxonomyParam(individualYears));
    } else {
      current.delete('year');
    }
    navigate(`/practice-exam?${current.toString()}`);
  };

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
        current.set('subject', formatTaxonomyParam(updated));
      }
      current.delete('topic');
      current.delete('subtopic');
    }
    navigate(`/practice-exam?${current.toString()}`);
  };

  const selectAllSubjects = () => {
    const current = new URLSearchParams(searchParams);
    const hierarchySubjects = Object.keys(masterSyllabus?.hierarchy || {});
    if (hierarchySubjects.length > 0) {
      current.set('subject', formatTaxonomyParam(hierarchySubjects));
    } else {
      current.delete('subject');
    }
    current.delete('topic');
    current.delete('subtopic');
    navigate(`/practice-exam?${current.toString()}`);
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
        current.set('topic', formatTaxonomyParam(updated));
      }
      current.delete('subtopic');
    }
    navigate(`/practice-exam?${current.toString()}`);
  };

  const selectAllTopics = () => {
    const current = new URLSearchParams(searchParams);
    if (availableTopicsList.length > 0) {
      current.set('topic', formatTaxonomyParam(availableTopicsList));
    } else {
      current.delete('topic');
    }
    current.delete('subtopic');
    navigate(`/practice-exam?${current.toString()}`);
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
        current.set('subtopic', formatTaxonomyParam(updated));
      }
    }
    navigate(`/practice-exam?${current.toString()}`);
  };

  const selectAllSubtopics = () => {
    const current = new URLSearchParams(searchParams);
    if (availableSubtopicsList.length > 0) {
      current.set('subtopic', formatTaxonomyParam(availableSubtopicsList));
    } else {
      current.delete('subtopic');
    }
    navigate(`/practice-exam?${current.toString()}`);
  };

  // Session State
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(gCount);
  const [timeLeft, setTimeLeft] = useState(600); // Exactly 10 mins (600s)
  const [language, setLanguage] = useState<string>(() => {
    try {
      const userRaw = localStorage.getItem('user');
      if (userRaw) {
        const u = JSON.parse(userRaw);
        if (u.preferred_language) return u.preferred_language;
      }
    } catch (_) {}
    return localStorage.getItem('preferred_language') || 'en';
  });



  const [paletteFilter, setPaletteFilter] = useState<'all' | 'answered' | 'marked' | 'unanswered'>(
    'all',
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isFilterRefreshing, setIsFilterRefreshing] = useState(false);
  const isInitialLoadRef = React.useRef(true);

  // Collapsible Left Drawer State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Question & Response Data
  const [allQuestions, setAllQuestions] = useState<QuestionOut[]>([]);
  const [activeQuestion, setActiveQuestion] = useState<QuestionOut | null>(null);
  const [userResponses, setUserResponses] = useState<
    Record<string | number, { optionId: number | string; optionLabel: string }>
  >({});
  const [revealedMap, setRevealedMap] = useState<Record<string, RevealAnswerResponse>>({});
  const [markedForReview, setMarkedForReview] = useState<Record<string, boolean>>({});
  const [bookmarkedQs, setBookmarkedQs] = useState<Record<number, boolean>>({});
  const [palette, setPalette] = useState<QuestionPaletteItem[]>([]);

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
    try {
      const token = localStorage.getItem('access_token');
      if (token) {
        fetch('/api/v1/auth/me', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ preferred_language: newLang }),
        }).catch(() => {});
      }
    } catch (_) {}

    // Priority translate active question if missing in newLang
    if (activeQuestion) {
      ensureQuestionTranslation(activeQuestion, newLang);
    }
    // Background prefetch next question if present
    if (allQuestions[currentQIndex + 1]) {
      ensureQuestionTranslation(allQuestions[currentQIndex + 1], newLang);
    }
  };

  // Modal & Popup States
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showNoMoreQuestionsModal, setShowNoMoreQuestionsModal] = useState(false);
  const [guestScoreData, setGuestScoreData] = useState<any>(null);
  const [scoreCountdown, setScoreCountdown] = useState<number | null>(null);

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
  const [isSolutionLoading, setIsSolutionLoading] = useState(false);
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

  const userResponsesRef = React.useRef(userResponses);
  userResponsesRef.current = userResponses;
  const revealedMapRef = React.useRef(revealedMap);
  revealedMapRef.current = revealedMap;

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
        Object.keys(userResponsesRef.current || {}).forEach((qId) => existingIds.add(qId));
        Object.keys(revealedMapRef.current || {}).forEach((qId) => existingIds.add(qId));
        Object.keys(recUserResponsesRef.current || {}).forEach((qId) => existingIds.add(qId));

        const excludeIdsParam = Array.from(existingIds).join(',');

        const rawSubject = gSubject && !gSubject.startsWith('All Subjects') ? formatTaxonomyParam(selectedSubjectsList) : '';
        const rawTopic = gTopic && !gTopic.startsWith('All Topics') ? formatTaxonomyParam(selectedTopicsList) : '';
        const rawSubtopic = gSubtopic && !gSubtopic.startsWith('All Subtopics') ? formatTaxonomyParam(selectedSubtopicsList) : '';
        const rawDiff = gDifficulty && !gDifficulty.startsWith('All') ? gDifficulty.trim() : '';

        const activeExams = Object.keys(recExamToggles).filter((e) => recExamToggles[e]);
        if (activeExams.length === 0) {
          setIsRecsExhausted(true);
          return;
        }

        let newFetched: any[] = [];
        const neededCount = Math.max(1, 15 - currentPool.length);

        const subjParams = new URLSearchParams({ limit: String(neededCount) });
        subjParams.append('exam_name', activeExams.map((e) => e.toLowerCase()).join(','));
        if (rawSubject) subjParams.append('subject_name', rawSubject);
        if (rawTopic) subjParams.append('topic_name', rawTopic);
        if (rawSubtopic) subjParams.append('subtopic_name', rawSubtopic);
        if (rawDiff) subjParams.append('difficulty', rawDiff);
        if (excludeIdsParam) subjParams.append('exclude_ids', excludeIdsParam);
        if (language) subjParams.append('language', language);

        try {
          const res = await guardedFetch(
            `/api/v1/questions/recommended?${subjParams.toString()}`,
          );
          if (res.ok) {
            const data = await res.json();
            newFetched = data.items || [];
          }
        } catch (err) {
          console.warn('Recommendation fetch failed:', err);
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
              exam_name: item.exam_name || gExam,
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

            while (newList.length > 15) {
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
                newList.pop();
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
    [gSubject, gTopic, gSubtopic, gDifficulty, gExam, language, recExamToggles, userResponses, revealedMap, isPrefetchingRecs, isRecsExhausted],
  );

  // Fires on mount (allQuestions is still [] at that point) so the
  // recommendations fetch starts in parallel with the main question load
  // instead of waiting for it to finish first — it only needs gSubject/
  // gTopic/gExam (already known from the URL) to build its query, and an
  // empty allQuestions/recommendedPool just means nothing to exclude yet.
  useEffect(() => {
    if (recommendedPool.length < 15 && !isPrefetchingRecs && !isRecsExhausted) {
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

  // Handler to load a recommended question into the main exam flow (used by onNext when pool exhausted)
  const handleLoadRecommendedIntoExam = (recQ: QuestionOut) => {
    const existingIdx = allQuestions.findIndex((q) => q.question_id === recQ.question_id);
    if (existingIdx !== -1) {
      handleSelectQuestion(existingIdx);
      return;
    }
    // Append to allQuestions and navigate to it
    setAllQuestions((prev) => {
      const next = [...prev, recQ];
      setTotalQuestions(next.length);
      setCurrentQIndex(next.length - 1);
      setActiveQuestion(recQ);
      return next;
    });
    // Remove from recommended pool since it's now a main question
    setRecommendedPool((prev) => prev.filter((q) => q.question_id !== recQ.question_id));
  };

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

  // Records the user's answer for a recommended question and kicks off its solution fetch
  const handleSelectRecommendationOption = (rec: QuestionOut, optionId: number | string) => {
    setRecUserResponses((prev) => ({ ...prev, [rec.question_id]: optionId }));
    fetchRecommendationSolution(rec.question_id);
  };

  // Fetches full authoritative solution for a practice question via /api/v1/questions/{id}/solution
  const practiceSolutionLoadingRef = React.useRef<Record<string | number, boolean>>({});
  const fetchPracticeQuestionSolution = async (targetId: string | number, silent: boolean = false) => {
    if (!targetId || practiceSolutionLoadingRef.current[targetId]) return;
    practiceSolutionLoadingRef.current[targetId] = true;
    if (!silent) {
      setIsSolutionLoading(true);
    }
    try {
      const solRes = await fetch(`/api/v1/questions/${targetId}/solution`);
      if (solRes.ok) {
        const solPayload: QuestionSolutionData = await solRes.json();
        setPracticeSolutions((prev) => ({
          ...prev,
          [targetId]: solPayload,
          [String(targetId)]: solPayload,
        }));
        // Only enrich revealedMap if the question has already been submitted/revealed
        setRevealedMap((prev) => {
          const current = prev[targetId] || prev[String(targetId)];
          if (!current) return prev;
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
      if (!silent) {
        setIsSolutionLoading(false);
      }
    }
  };

  const displayRecs = recommendedPool;

  // Mobile Responsiveness
  const { isTabletOrBelow } = useBreakpoint();
  const [showMobileRecs, setShowMobileRecs] = useState(false);
  const [showMobileFilterPanel, setShowMobileFilterPanel] = useState(false);

  const SESSION_KEY = `student_practice_session_${gExam}_${gYear}_${gSubject}_${gTopic}_${gSubtopic}_${gCount}`;

  // Timer countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Handle 10-second countdown after completing all questions
  useEffect(() => {
    if (scoreCountdown === null) return;
    if (scoreCountdown <= 0) {
      setScoreCountdown(null);
      setShowScoreModal(true);
      return;
    }
    const cdTimer = setInterval(() => {
      setScoreCountdown((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(cdTimer);
  }, [scoreCountdown]);

  // Clean option labels helper
  const cleanOptionLabel = (label: string, idx: number): string => {
    if (label && label.length <= 2) return label.toUpperCase();
    const map = ['A', 'B', 'C', 'D', 'E'];
    return map[idx] || `OPT${idx + 1}`;
  };

  // Load Real Practice Questions from Database using Live Syllabus APIs
  useEffect(() => {
    async function loadPracticeQuestions() {
      if (isInitialLoadRef.current) {
        setIsLoading(true);
      } else {
        setIsFilterRefreshing(true);
      }
      const fetchedMap = new Map<string, any>();

      // 1. Fetch Master Syllabus Tree & Published Exams from API
      try {
        const [sData, eList, yData] = await Promise.all([
          fetchMasterSyllabus(undefined, gExam === 'All Exams' ? undefined : extractCanonicalExamName(gExam)).catch(() => null),
          listExams('PUBLISHED').catch(() => []),
          fetchExamsByYear().catch(() => null),
        ]);
        if (sData) setMasterSyllabus(sData);
        if (eList && eList.length > 0) {
          const dynamicExams = eList.map((e: any) =>
            extractCanonicalExamName(e.name || e.title || e.exam_name || e.code),
          ).filter(Boolean);
          const names = Array.from(new Set(dynamicExams)) as string[];
          names.sort((a, b) => (a === 'UPSC CSE' ? -1 : b === 'UPSC CSE' ? 1 : a.localeCompare(b)));
          if (names.length > 0) setAvailableExams(names);
        }
        if (yData && Array.isArray(yData.years) && yData.years.length > 0) {
          const examName = extractCanonicalExamName(gExam);
          let filteredYears = yData.years;
          if (gExam !== 'All Exams') {
             filteredYears = yData.years.filter((y: number) => {
                 const examsInYear = yData.exams_by_year[String(y)] || [];
                 return examsInYear.some((e: any) => extractCanonicalExamName(e.name || e.code) === examName);
             });
          }
          if (filteredYears.length > 0) {
              const sorted = [...filteredYears].sort((a, b) => b - a);
              const fetchedYears = sorted.map((y: number) => `${y} PYQs`);
              const minYear = Math.min(...filteredYears);
              const maxYear = Math.max(...filteredYears);
              const yearsArray = ['All Years', ...fetchedYears];
              setYearOptions(yearsArray);
          } else {
              setYearOptions(['All Years']);
          }
        }
      } catch (err) {
        console.warn('Practice exam taxonomy API warning:', err);
      }

      const formatQuestion = (q: any, idx: number): QuestionOut => {
        const rawOpts = q.options || [];
        const optionsList = rawOpts.map((o: any, oIdx: number) => ({
          option_id: o.option_id || `opt-${idx}-${oIdx}`,
          option_label: cleanOptionLabel(o.option_label || '', oIdx),
          text: o.option_text || o.text || `Option ${o.option_label || oIdx + 1}`,
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
        const subtopName =
          primaryH.subtopic_name ||
          q.subtopic_name ||
          '';

        return {
          question_id: q.question_id || `q-practice-${idx + 1}`,
          question_number: idx + 1,
          text: q.question_text || q.text || '',
          passage_text: q.passage_text || null,
          translations: q.translations || {},
          passage_translations: q.passage_translations || {},
          options: optionsList,
          section_code: subjName || 'General Studies',
          subject_name: subjName,
          topic_name: topName,
          subtopic_name: subtopName,
          concept_name: primaryH.concept_name || '',
          exam_name: q.exam_name || (gExam && !gExam.startsWith('All Exams') ? gExam : ''),
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

      const rawSubject = gSubject && !gSubject.startsWith('All Subjects') ? formatTaxonomyParam(selectedSubjectsList) : '';
      const rawTopic = gTopic && !gTopic.startsWith('All Topics') ? formatTaxonomyParam(selectedTopicsList) : '';
      const rawSubtopic = gSubtopic && !gSubtopic.startsWith('All Subtopics') ? formatTaxonomyParam(selectedSubtopicsList) : '';
      const reqSubject = rawSubject;
      const reqTopic = rawTopic;
      const reqSubtopic = rawSubtopic;

      // Extract numeric exam years if the user picked specific year(s)
      let numericYears: string[] = [];
      if (gYear && !gYear.startsWith('All Years')) {
        const matches = Array.from(gYear.matchAll(/\b(19\d\d|20\d\d)\b/g));
        numericYears = Array.from(new Set(matches.map((m) => m[1])));
      }
      const examYearParam = numericYears.length > 0 ? numericYears.join(',') : null;

      const fetchQuestions = async (params: URLSearchParams): Promise<any[]> => {
        try {
          if (!params.has('include_solutions')) {
            params.append('include_solutions', 'true');
          }
          if (!params.has('language') && language) {
            params.append('language', language);
          }
          const res = await fetch(`/api/v1/questions?${params.toString()}`);
          if (res.ok) {
            const data = await res.json();
            return data.items || [];
          }
        } catch (err) {
          console.warn('Practice questions fetch error:', err);
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

      try {
        const targetExam = gExam
          ? gExam.split(',')
              .map((e) => {
                const cleaned = e.trim().toLowerCase();
                return cleaned.includes('upsc') ? 'upsc' : cleaned;
              })
              .filter(Boolean)
              .join(',')
          : '';

        const initialFetchLimit = 100;

        // 1. Try with subject + topic + subtopic + year + selected exam
        const p1 = new URLSearchParams({ limit: String(initialFetchLimit) });
        if (reqSubject) p1.append('subject_name', reqSubject);
        if (reqTopic) p1.append('topic_name', reqTopic);
        if (reqSubtopic) p1.append('subtopic_name', reqSubtopic);
        if (examYearParam) p1.append('exam_year', examYearParam);
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
          if (examYearParam) {
            const p2 = new URLSearchParams({ limit: String(initialFetchLimit) });
            if (reqSubject) p2.append('subject_name', reqSubject);
            if (reqTopic) p2.append('topic_name', reqTopic);
            if (reqSubtopic) p2.append('subtopic_name', reqSubtopic);
            if (targetExam) p2.append('exam_name', targetExam);
            fallbackTiers.push(p2);
          }

          // 3. Relax subtopic
          if (reqSubtopic) {
            const p3 = new URLSearchParams({ limit: String(initialFetchLimit) });
            if (reqSubject) p3.append('subject_name', reqSubject);
            if (reqTopic) p3.append('topic_name', reqTopic);
            if (targetExam) p3.append('exam_name', targetExam);
            fallbackTiers.push(p3);
          }

          // 4. Relax topic
          if (reqTopic) {
            const p4 = new URLSearchParams({ limit: String(initialFetchLimit) });
            if (reqSubject) p4.append('subject_name', reqSubject);
            if (targetExam) p4.append('exam_name', targetExam);
            fallbackTiers.push(p4);
          }

          // 5. Relax subject (still scoped to exam), or if no exam was chosen, relax to
          // subject+year only and finally to no filters at all.
          if (targetExam) {
            const p5 = new URLSearchParams({ limit: String(initialFetchLimit) });
            p5.append('exam_name', targetExam);
            if (examYearParam) p5.append('exam_year', examYearParam);
            fallbackTiers.push(p5);
          } else {
            const pAll = new URLSearchParams({ limit: String(initialFetchLimit) });
            if (examYearParam) pAll.append('exam_year', examYearParam);
            if (reqSubject) pAll.append('subject_name', reqSubject);
            fallbackTiers.push(pAll);

            const pAllRelaxed = new URLSearchParams({ limit: String(initialFetchLimit) });
            fallbackTiers.push(pAllRelaxed);
          }

          const fallbackResults = await Promise.all(fallbackTiers.map(fetchQuestions));
          mergeItems(fallbackResults.find((items) => items.length > 0) || []);
        }
      } catch (err) {
        console.warn('Practice questions fetch warning:', err);
      }

      let fetchedList = Array.from(fetchedMap.values());
      const questionsList: QuestionOut[] = fetchedList.map((item, idx) =>
        formatQuestion(item, idx),
      );

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
            if (savedData.bookmarkedQs) setBookmarkedQs(savedData.bookmarkedQs);
            if (typeof savedData.timeLeft === 'number' && savedData.timeLeft > 0) {
              setTimeLeft(savedData.timeLeft);
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
          console.warn('Failed to restore student practice sessionStorage:', err);
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

      // Query solution in advance for initial question and upcoming question
      const startQ = questionsList[0];
      if (startQ?.question_id) {
        fetchPracticeQuestionSolution(startQ.question_id, true);
      }
      if (questionsList[1]?.question_id) {
        fetchPracticeQuestionSolution(questionsList[1].question_id, true);
      }

      if (isInitialLoadRef.current) {
        setIsLoading(false);
        isInitialLoadRef.current = false;
      } else {
        setIsFilterRefreshing(false);
      }
    }

    loadPracticeQuestions();
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
        timeLeft,
      };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
    } catch (err) {
      console.warn('Failed to write student practice sessionStorage:', err);
    }
  }, [
    userResponses,
    revealedMap,
    markedForReview,
    bookmarkedQs,
    currentQIndex,
    timeLeft,
    isLoading,
    allQuestions,
  ]);

  // Switch Question
  const handleSelectQuestion = (idx: number) => {
    if (idx < 0 || idx >= allQuestions.length) return;
    setCurrentQIndex(idx);
    const targetQ = allQuestions[idx];
    setActiveQuestion(targetQ);

    // Query solution in advance for current & next question so 'Show Solution' is never delayed
    if (targetQ?.question_id) {
      fetchPracticeQuestionSolution(targetQ.question_id, true);
    }
    if (allQuestions[idx + 1]?.question_id) {
      fetchPracticeQuestionSolution(allQuestions[idx + 1].question_id, true);
    }

    if (language && language !== 'en' && targetQ) {
      ensureQuestionTranslation(targetQ, language);
    }
    if (language && language !== 'en' && allQuestions[idx + 1]) {
      ensureQuestionTranslation(allQuestions[idx + 1], language);
    }

    setPalette((prev) =>
      prev.map((item, i) => {
        if (i === idx) {
          if (item.question_status === 'UNVISITED') {
            return { ...item, question_status: 'VISITED' };
          }
        }
        return item;
      }),
    );
  };

  // Option selection
  const handleToggleBookmark = async () => {
    if (!activeQuestion) return;
    const qId = String(activeQuestion.question_id || (activeQuestion as any).id);
    const isBookmarked = !!bookmarkedQs[currentQIndex];

    // Optimistic UI update
    setBookmarkedQs((prev) => ({ ...prev, [currentQIndex]: !isBookmarked }));

    try {
      if (isBookmarked) {
        await removeBookmark(qId);
      } else {
        await addBookmark(qId);
      }
    } catch (error) {
      console.error('Failed to toggle bookmark', error);
      // Revert on failure
      setBookmarkedQs((prev) => ({ ...prev, [currentQIndex]: isBookmarked }));
    }
  };

  const handleSelectOption = (optionId: number | string, optionLabel: string) => {
    if (!activeQuestion) return;
    const qId = activeQuestion.question_id;
    if (revealedMap[qId]) return; // Locked once submitted

    setUserResponses((prev) => ({
      ...prev,
      [qId]: { optionId, optionLabel },
    }));
  };

  // Helper to expand subject questions when questions are finished
  const checkAndExpandSubjectQuestions = useCallback(async (): Promise<boolean> => {
    return false;
  }, []);

  // Reveal Instant Per-Question Answer & Description with Full Solution
  const handleRevealAnswer = async (
    qId?: number | string,
    overrideOptId?: number | string,
    overrideOptLbl?: string,
  ) => {
    const targetId = qId || activeQuestion?.question_id;
    if (!targetId) return;

    const targetQuestion = allQuestions.find((q) => q.question_id === targetId) || activeQuestion;
    if (!targetQuestion) return;

    let userResp = overrideOptId
      ? { optionId: overrideOptId, optionLabel: overrideOptLbl || '' }
      : userResponses[targetId];
    if (!userResp) return;

    const correctOpt = targetQuestion.options?.find((o) => o.is_correct);

    let isUserCorrect = false;
    if (userResp && targetQuestion.options) {
      const selectedOpt = targetQuestion.options.find(
        (o, idx) =>
          o.option_id === userResp!.optionId ||
          cleanOptionLabel(o.option_label || '', idx) === userResp!.optionLabel,
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
      (targetQuestion as any).description ||
      (targetQuestion as any).solution ||
      (targetQuestion as any).solution_text ||
      `Option (${correctLabel}) is correct.`;

    const distractorScores: Record<string, any> = {};
    if (Array.isArray(targetQuestion.options)) {
      targetQuestion.options.forEach((opt: any) => {
        const oId = String(opt.option_id || opt.id || '');
        distractorScores[oId] = {
          option_id: oId,
          label: opt.option_label || opt.label,
          text: opt.option_text || opt.text || '',
          is_correct: opt.is_correct,
          closeness_score: opt.closeness_score ?? 0,
          distractor_analysis: opt.distractor_analysis || opt.analysis || '',
          analysis: opt.distractor_analysis || opt.analysis || '',
          classification: opt.is_correct ? 'CORRECT' : (opt.classification || 'DISTRACTOR'),
        };
      });
    }

    const revealObj: RevealAnswerResponse = {
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
      closeness_score: isUserCorrect ? 100 : 0,
      closeness_classification: isUserCorrect ? 'EXACT' : 'INCORRECT',
      explanation: expContent,
      distractor_scores: distractorScores,
    };

    const updatedRevealedMap = {
      ...revealedMap,
      [targetId]: revealObj,
      [String(targetId)]: revealObj,
    };

    setRevealedMap(updatedRevealedMap);

    // Fetch authoritative solution details asynchronously from /api/v1/questions/{id}/solution
    fetchPracticeQuestionSolution(targetId);

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

    // Check if ALL currently loaded questions are finished (revealed)
    const numQuestions = allQuestions.length;
    if (Object.keys(updatedRevealedMap).length >= numQuestions && numQuestions > 0) {
      const expanded = await checkAndExpandSubjectQuestions();
      if (!expanded) {
        handleFinishPracticeExam(updatedRevealedMap);
      }
    }
  };

  const handleShowSolution = async (passedRevealedMap?: Record<string, RevealAnswerResponse>) => {
    const targetId = activeQuestion?.question_id;
    if (targetId) {
      await fetchPracticeQuestionSolution(targetId);
    }

    const rMap = passedRevealedMap || revealedMap;
    const numQuestions = allQuestions.length;
    const isCompleted = Object.keys(rMap).length >= numQuestions && numQuestions > 0;
    if (isCompleted && scoreCountdown === null && !showScoreModal) {
      const expanded = await checkAndExpandSubjectQuestions();
      if (!expanded) {
        handleFinishPracticeExam(rMap);
      }
    }
  };

  const handleFinishPracticeExam = (passedRevealedMap?: Record<string, RevealAnswerResponse>) => {
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
      subjectName: gSubject,
      topicName: gSubject,
      subtopicName: '',
      targetExam: gExam,
      targetYear: gYear,
      timeSpentSeconds: Math.max(30, 600 - timeLeft),
      responses: responsesPayload,
    };

    const savedAttempt = saveGuestAttempt(scorePayload);
    setGuestScoreData({ ...scorePayload, attemptId: savedAttempt.id });
    setScoreCountdown(null);
    setShowScoreModal(true);
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

  // Dynamically extract subjects from API masterSyllabus tree and fetched questions.
  const syllabusSubjectsArr: any[] =
    masterSyllabus?.subjects && Array.isArray(masterSyllabus.subjects)
      ? masterSyllabus.subjects
      : [];
  const syllabusSubjects = syllabusSubjectsArr.map((s: any) => s.name).filter(Boolean);
  const questionSubjects = Array.from(
    new Set(allQuestions.map((q) => q.section_code || (q as any).subject_name).filter(Boolean)),
  );
  const combinedSubjects = Array.from(new Set([...syllabusSubjects, ...questionSubjects]));
  const subjectsList = ['All Subjects', ...combinedSubjects];

  const selectedOptionsMap: Record<number, number | string> = {};
  const markedForReviewMap: Record<number, boolean> = {};

  allQuestions.forEach((q, idx) => {
    if (userResponses[q.question_id]) {
      selectedOptionsMap[idx] = userResponses[q.question_id].optionId;
    }
    if (markedForReview[q.question_id]) {
      markedForReviewMap[idx] = true;
    }
  });

  const answeredCount = Object.keys(userResponses).length;
  const markedCount = Object.values(markedForReview).filter(Boolean).length;
  const unattemptedCount = Math.max(0, totalQuestions - answeredCount);

  const currentResponse = activeQuestion ? userResponses[activeQuestion.question_id] : null;
  const currentRevealedResult = activeQuestion
    ? revealedMap[activeQuestion.question_id] || revealedMap[String(activeQuestion.question_id)] || null
    : null;

  const isCurrentAnswered = !!currentResponse;
  const isCurrentMarked = activeQuestion ? !!markedForReview[activeQuestion.question_id] : false;

  if (isLoading) {
    return (
      <ExamLoaderOverlay
        title="Structuring Practice Examination"
        subtitle="Retrieving authentic PYQs and configuring your student workspace..."
      />
    );
  }

  if (allQuestions.length === 0 || !activeQuestion) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          width: '100vw',
          backgroundColor: 'var(--bg-subtle)',
          padding: 24,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid #E2E8F0',
            borderRadius: 0,
            padding: '40px 32px',
            maxWidth: 480,
            boxShadow: '0 10px 25px rgba(0,0,0,0.05)',
          }}
        >
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--deep-navy)', marginBottom: 8 }}>
            No Questions Available
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.5 }}>
            No questions available for{' '}
            <strong>{formatEnum(gSubject || 'this selection')}</strong>.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button
              onClick={() => {
                const current = new URLSearchParams(searchParams);
                current.delete('subject');
                current.delete('topic');
                navigate(`?${current.toString()}`);
              }}
              style={{
                padding: '12px 20px',
                borderRadius: 0,
                backgroundColor: 'var(--deep-navy)',
                color: 'var(--bg-card)',
                fontWeight: 600,
                fontSize: 14,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Practice All Subjects
            </button>
            <button
              onClick={() => navigate('/mocks')}
              style={{
                padding: '12px 20px',
                borderRadius: 0,
                backgroundColor: 'var(--primary-red)',
                color: 'var(--bg-card)',
                fontWeight: 600,
                fontSize: 14,
                border: 'none',
                cursor: 'pointer',
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

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: isTabletOrBelow ? 'auto' : '100vh',
        minHeight: '100vh',
        width: '100vw',
        overflow: isTabletOrBelow ? 'visible' : 'hidden',
        backgroundColor: 'var(--bg-subtle)',
      }}
    >
      {/* Top Header Bar */}
      <ExamHeader
        examTitle={cleanExamTitle(gExam)}
        paperSubtitle={`${cleanExamTitle(gExam)} · ${gYear || (yearOptions[0] || 'All Years')}${gSubject ? ' · ' + gSubject : ''}`}
        timeLeft={timeLeft}
        language={language}
        showSubmitButton={true}
        showTimer={false}
        topicName={gSubject}
        subtopicName={''}
        parentBreadcrumb="Student Dashboard"
        onBack={() => setShowLeaveModal(true)}
        onLanguageChange={handleLanguageChange}
        onSubmitClick={() => handleFinishPracticeExam()}
        focusMode={isFocusMode}
        onToggleFocusMode={() => setIsFocusMode((prev) => !prev)}
        onFilterClick={!isFocusMode ? () => setShowMobileFilterPanel(true) : undefined}
        onRecsClick={!isFocusMode ? () => setShowMobileRecs(true) : undefined}
        recsCount={displayRecs.length}
      />

      {/* Premium Floating Exam Filter Window — Desktop only; mobile/tablet uses header icon + top sheet */}
      {!isFocusMode && !isTabletOrBelow && (
        <div
          style={{
            marginTop: 60,
            padding: 'clamp(8px, 2vw, 14px) clamp(10px, 2.5vw, 24px) 6px clamp(10px, 2.5vw, 24px)',
            backgroundColor: 'transparent',
            zIndex: 80,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
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
                    backgroundColor: isFilterRefreshing ? 'var(--accent-bg)' : 'var(--bg-subtle)',
                    color: 'var(--accent-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {isFilterRefreshing ? (
                    <Loader2 size={16} className="animate-spin" color="var(--accent-primary)" />
                  ) : (
                    <SlidersHorizontal size={16} />
                  )}
                </div>
                {isFilterRefreshing && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: 'var(--accent-primary)',
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
                {/* Filter 1: Exam Target */}
                <div style={{ position: 'relative', flex: 1, minWidth: 140 }} data-dropdown-container>
                  <label
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      color: 'var(--text-muted)',
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
                    onClick={() => {
                      setActiveDropdown(activeDropdown === 'exam' ? null : 'exam');
                      setFilterSearchQuery('');
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 14px',
                      borderRadius: 0,
                      border: activeDropdown === 'exam' ? '1px solid var(--primary-red)' : '1px solid #E2E8F0',
                      backgroundColor: activeDropdown === 'exam' ? 'var(--bg-card)' : 'var(--bg-subtle)',
                      color: 'var(--deep-navy)',
                      fontSize: 13,
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
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
                    <ChevronDown
                      size={14}
                      color="var(--text-muted)"
                      style={{
                        transform: activeDropdown === 'exam' ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.15s ease',
                      }}
                    />
                  </button>

                  {activeDropdown === 'exam' && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 8px)',
                        left: 0,
                        width: 220,
                        maxWidth: 'calc(100vw - 32px)',
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid #E2E8F0',
                        borderRadius: 0,
                        boxShadow: '0 12px 32px rgba(15, 23, 42, 0.14)',
                        padding: 8,
                        zIndex: 100,
                      }}
                    >
                      {(availableExams).map(
                        (opt) => (
                          <div
                            key={opt}
                            onClick={() => {
                              const current = new URLSearchParams(searchParams);
                              current.set('exam', opt);
                              navigate(`/practice-exam?${current.toString()}`);
                              setActiveDropdown(null);
                            }}
                            style={{
                              padding: '9px 12px',
                              borderRadius: 0,
                              fontSize: 12.5,
                              fontWeight: gExam === opt ? 700 : 500,
                              color: gExam === opt ? 'var(--accent-primary)' : 'var(--text-secondary)',
                              backgroundColor: gExam === opt ? 'var(--bg-subtle)' : 'transparent',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              cursor: 'pointer',
                            }}
                          >
                            <span>{opt}</span>
                            {gExam === opt && <Check size={14} color="var(--accent-primary)" />}
                          </div>
                        ),
                      )}
                    </div>
                  )}
                </div>

                {/* Filter 2: Target / PYQ Year */}
                <div style={{ position: 'relative', flex: 1, minWidth: 150 }} data-dropdown-container>
                  <label
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      marginBottom: 4,
                      display: 'block',
                    }}
                  >
                    Target / PYQ Year
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveDropdown(activeDropdown === 'year' ? null : 'year');
                      setFilterSearchQuery('');
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 14px',
                      borderRadius: 0,
                      border:
                        activeDropdown === 'year' ? '1px solid var(--primary-red)' : '1px solid #E2E8F0',
                      backgroundColor: activeDropdown === 'year' ? 'var(--bg-card)' : 'var(--bg-subtle)',
                      color: 'var(--deep-navy)',
                      fontSize: 13,
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      boxShadow:
                        activeDropdown === 'year' ? '0 0 0 3px rgba(23, 32, 51, 0.12)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span
                      style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                    >
                      {selectedYearsList.length === 0
                        ? (yearOptions[0] || 'All Years')
                        : selectedYearsList.length === 1
                          ? selectedYearsList[0]
                          : `${selectedYearsList.length} Years Selected`}
                    </span>
                    <ChevronDown
                      size={14}
                      color="var(--text-muted)"
                      style={{
                        transform: activeDropdown === 'year' ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.15s ease',
                      }}
                    />
                  </button>

                  {activeDropdown === 'year' && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 8px)',
                        left: 0,
                        width: 250,
                        maxWidth: 'calc(100vw - 32px)',
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid #E2E8F0',
                        borderRadius: 0,
                        boxShadow: '0 12px 32px rgba(15, 23, 42, 0.14)',
                        padding: 10,
                        zIndex: 100,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          paddingBottom: 6,
                          marginBottom: 6,
                          borderBottom: '1px solid #F1F5F9',
                        }}
                      >
                        <button
                          type="button"
                          onClick={selectAllYears}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--accent-primary)',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Select All
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleYearFilter('All Years')}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-muted)',
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Clear
                        </button>
                      </div>

                      <div style={{ position: 'relative', marginBottom: 8 }} data-dropdown-container>
                        <Search
                          size={14}
                          color="var(--text-disabled)"
                          style={{ position: 'absolute', left: 10, top: 10 }}
                        />
                        <input
                          type="text"
                          autoFocus
                          placeholder="Search year..."
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
                            backgroundColor: 'var(--bg-subtle)',
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
                        {/* All Years Default */}
                        {(yearOptions[0] || 'All Years')
                          .toLowerCase()
                          .includes(filterSearchQuery.toLowerCase()) && (
                          <div
                            onClick={() => toggleYearFilter('All Years')}
                            style={{
                              padding: '8px 10px',
                              borderRadius: 0,
                              fontSize: 12.5,
                              fontWeight: selectedYearsList.length === 0 ? 700 : 500,
                              color: selectedYearsList.length === 0 ? 'var(--accent-primary)' : 'var(--text-secondary)',
                              backgroundColor:
                                selectedYearsList.length === 0 ? 'var(--bg-hover)' : 'transparent',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              cursor: 'pointer',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <input
                                type="checkbox"
                                checked={selectedYearsList.length === 0}
                                onChange={() => {}}
                                style={{ cursor: 'pointer', accentColor: 'var(--accent-primary)' }}
                              />
                              <span>{yearOptions[0] || 'All Years'}</span>
                            </div>
                            {selectedYearsList.length === 0 && (
                              <Check size={14} color="var(--accent-primary)" />
                            )}
                          </div>
                        )}

                        {/* Individual Years */}
                        {yearOptions
                          .filter(
                            (y) =>
                              !y.startsWith('All Years') &&
                              y.toLowerCase().includes(filterSearchQuery.toLowerCase()),
                          )
                          .map((opt: string) => {
                            const isSelected = selectedYearsList.includes(opt);
                            return (
                              <div
                                key={opt}
                                onClick={() => toggleYearFilter(opt)}
                                style={{
                                  padding: '8px 10px',
                                  borderRadius: 0,
                                  fontSize: 12.5,
                                  fontWeight: isSelected ? 700 : 500,
                                  color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                  backgroundColor: isSelected ? 'var(--bg-hover)' : 'transparent',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  cursor: 'pointer',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => {}}
                                    style={{ cursor: 'pointer', accentColor: 'var(--accent-primary)' }}
                                  />
                                  <span>{opt}</span>
                                </div>
                                {isSelected && <Check size={14} color="var(--accent-primary)" />}
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Filter 3: Subject Focus */}
                <div style={{ position: 'relative', flex: 1.2, minWidth: 160 }} data-dropdown-container>
                  <label
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      color: 'var(--text-muted)',
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
                        activeDropdown === 'subject' ? '1px solid var(--primary-red)' : '1px solid #E2E8F0',
                      backgroundColor: activeDropdown === 'subject' ? 'var(--bg-card)' : 'var(--bg-subtle)',
                      color: 'var(--deep-navy)',
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
                      color="var(--text-muted)"
                      style={{
                        transform: activeDropdown === 'subject' ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.15s ease',
                      }}
                    />
                  </button>

                  {activeDropdown === 'subject' && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 8px)',
                        left: 0,
                        width: 250,
                        maxWidth: 'calc(100vw - 32px)',
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid #E2E8F0',
                        borderRadius: 0,
                        boxShadow: '0 12px 32px rgba(15, 23, 42, 0.14)',
                        padding: 10,
                        zIndex: 100,
                      }}
                    >
                      {/* Action Bar */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 6, marginBottom: 6, borderBottom: '1px solid #F1F5F9' }}>
                        <button type="button" onClick={selectAllSubjects} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Select All</button>
                        <button type="button" onClick={() => toggleSubjectFilter('All Subjects')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Clear</button>
                      </div>

                      <div style={{ position: 'relative', marginBottom: 8 }} data-dropdown-container>
                        <Search
                          size={14}
                          color="var(--text-disabled)"
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
                            backgroundColor: 'var(--bg-subtle)',
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
                        {subjectsList
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
                                  color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                  backgroundColor: isSelected ? 'var(--bg-hover)' : 'transparent',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  cursor: 'pointer',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <input type="checkbox" checked={isSelected} onChange={() => {}} style={{ cursor: 'pointer', accentColor: 'var(--accent-primary)' }} />
                                  <span>{opt}</span>
                                </div>
                                {isSelected && <Check size={14} color="var(--accent-primary)" />}
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Filter: Topic Focus */}
                <div style={{ position: 'relative', flex: 1.2, minWidth: 160 }} data-dropdown-container>
                  <label
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      color: 'var(--text-muted)',
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
                        activeDropdown === 'topic' ? '1px solid var(--primary-red)' : '1px solid #E2E8F0',
                      backgroundColor: activeDropdown === 'topic' ? 'var(--bg-card)' : 'var(--bg-subtle)',
                      color: 'var(--deep-navy)',
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
                      color="var(--text-muted)"
                      style={{
                        transform: activeDropdown === 'topic' ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.15s ease',
                      }}
                    />
                  </button>

                  {activeDropdown === 'topic' && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 8px)',
                        left: 0,
                        width: 260,
                        maxWidth: 'calc(100vw - 32px)',
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid #E2E8F0',
                        borderRadius: 0,
                        boxShadow: '0 12px 32px rgba(15, 23, 42, 0.14)',
                        padding: 10,
                        zIndex: 100,
                      }}
                    >
                      {/* Action Bar */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 6, marginBottom: 6, borderBottom: '1px solid #F1F5F9' }}>
                        <button type="button" onClick={selectAllTopics} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Select All</button>
                        <button type="button" onClick={() => toggleTopicFilter('All Topics')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Clear</button>
                      </div>

                      <div style={{ position: 'relative', marginBottom: 8 }} data-dropdown-container>
                        <Search
                          size={14}
                          color="var(--text-disabled)"
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
                            backgroundColor: 'var(--bg-subtle)',
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
                                  color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                  backgroundColor: isSelected ? 'var(--bg-hover)' : 'transparent',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  cursor: 'pointer',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <input type="checkbox" checked={isSelected} onChange={() => {}} style={{ cursor: 'pointer', accentColor: 'var(--accent-primary)' }} />
                                  <span>{opt}</span>
                                </div>
                                {isSelected && <Check size={14} color="var(--accent-primary)" />}
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Filter: Subtopic Focus */}
                <div style={{ position: 'relative', flex: 1.2, minWidth: 160 }} data-dropdown-container>
                  <label
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      color: 'var(--text-muted)',
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
                        activeDropdown === 'subtopic' ? '1px solid var(--primary-red)' : '1px solid #E2E8F0',
                      backgroundColor: activeDropdown === 'subtopic' ? 'var(--bg-card)' : 'var(--bg-subtle)',
                      color: 'var(--deep-navy)',
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
                      color="var(--text-muted)"
                      style={{
                        transform: activeDropdown === 'subtopic' ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.15s ease',
                      }}
                    />
                  </button>

                  {activeDropdown === 'subtopic' && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 8px)',
                        left: 0,
                        width: 270,
                        maxWidth: 'calc(100vw - 32px)',
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid #E2E8F0',
                        borderRadius: 0,
                        boxShadow: '0 12px 32px rgba(15, 23, 42, 0.14)',
                        padding: 10,
                        zIndex: 100,
                      }}
                    >
                      {/* Action Bar */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 6, marginBottom: 6, borderBottom: '1px solid #F1F5F9' }}>
                        <button type="button" onClick={selectAllSubtopics} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Select All</button>
                        <button type="button" onClick={() => toggleSubtopicFilter('All Subtopics')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Clear</button>
                      </div>

                      <div style={{ position: 'relative', marginBottom: 8 }} data-dropdown-container>
                        <Search
                          size={14}
                          color="var(--text-disabled)"
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
                            backgroundColor: 'var(--bg-subtle)',
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
                                  color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                  backgroundColor: isSelected ? 'var(--bg-hover)' : 'transparent',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  cursor: 'pointer',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <input type="checkbox" checked={isSelected} onChange={() => {}} style={{ cursor: 'pointer', accentColor: 'var(--accent-primary)' }} />
                                  <span>{opt}</span>
                                </div>
                                {isSelected && <Check size={14} color="var(--accent-primary)" />}
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Filter 4: Difficulty */}
                <div style={{ position: 'relative', flex: 1, minWidth: 130 }} data-dropdown-container>
                  <label
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      color: 'var(--text-muted)',
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
                        activeDropdown === 'difficulty' ? '1px solid var(--primary-red)' : '1px solid #E2E8F0',
                      backgroundColor: activeDropdown === 'difficulty' ? 'var(--bg-card)' : 'var(--bg-subtle)',
                      color: 'var(--deep-navy)',
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
                      color="var(--text-muted)"
                      style={{
                        transform: activeDropdown === 'difficulty' ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.15s ease',
                      }}
                    />
                  </button>

                  {activeDropdown === 'difficulty' && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 8px)',
                        left: 0,
                        width: 170,
                        maxWidth: 'calc(100vw - 32px)',
                        backgroundColor: 'var(--bg-card)',
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
                              const current = new URLSearchParams(searchParams);
                              if (opt === 'All Levels') current.delete('difficulty');
                              else current.set('difficulty', opt);
                              navigate(`/practice-exam?${current.toString()}`);
                              setActiveDropdown(null);
                            }}
                            style={{
                              padding: '8px 10px',
                              borderRadius: 0,
                              fontSize: 12.5,
                              fontWeight: isSelected ? 700 : 500,
                              color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                              backgroundColor: isSelected ? 'var(--bg-subtle)' : 'transparent',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              cursor: 'pointer',
                            }}
                          >
                            <span>{opt}</span>
                            {isSelected && <Check size={14} color="var(--accent-primary)" />}
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
              top: 60,
              backgroundColor: 'rgba(15, 23, 42, 0.4)',
              zIndex: 150,
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            style={{
              position: 'fixed',
              top: 60,
              left: 0,
              right: 0,
              zIndex: 151,
              backgroundColor: 'var(--bg-card)',
              borderBottom: '1px solid #E2E8F0',
              boxShadow: '0 20px 40px rgba(15, 23, 42, 0.18)',
              padding: '14px 16px 18px 16px',
              maxHeight: 'calc(100vh - 60px)',
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
                <SlidersHorizontal size={16} color="var(--accent-primary)" />
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: 'var(--accent-primary)',
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
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 4,
                }}
                aria-label="Close filters"
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Filter 1: Exam Target */}
              <div style={{ position: 'relative', flex: 1, minWidth: 140 }} data-dropdown-container>
                <label
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: 'var(--text-muted)',
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
                  onClick={() => {
                    setActiveDropdown(activeDropdown === 'exam' ? null : 'exam');
                    setFilterSearchQuery('');
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 14px',
                    borderRadius: 0,
                    border: activeDropdown === 'exam' ? '1px solid var(--primary-red)' : '1px solid #E2E8F0',
                    backgroundColor: activeDropdown === 'exam' ? 'var(--bg-card)' : 'var(--bg-subtle)',
                    color: 'var(--deep-navy)',
                    fontSize: 13,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
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
                  <ChevronDown
                    size={14}
                    color="var(--text-muted)"
                    style={{
                      transform: activeDropdown === 'exam' ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.15s ease',
                    }}
                  />
                </button>

                {activeDropdown === 'exam' && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 8px)',
                      left: 0,
                      width: 220,
                      maxWidth: 'calc(100vw - 32px)',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid #E2E8F0',
                      borderRadius: 0,
                      boxShadow: '0 12px 32px rgba(15, 23, 42, 0.14)',
                      padding: 8,
                      zIndex: 100,
                    }}
                  >
                    {(availableExams).map(
                      (opt) => (
                        <div
                          key={opt}
                          onClick={() => {
                            const current = new URLSearchParams(searchParams);
                            current.set('exam', opt);
                            navigate(`/practice-exam?${current.toString()}`);
                            setActiveDropdown(null);
                          }}
                          style={{
                            padding: '9px 12px',
                            borderRadius: 0,
                            fontSize: 12.5,
                            fontWeight: gExam === opt ? 700 : 500,
                            color: gExam === opt ? 'var(--accent-primary)' : 'var(--text-secondary)',
                            backgroundColor: gExam === opt ? 'var(--bg-subtle)' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                          }}
                        >
                          <span>{opt}</span>
                          {gExam === opt && <Check size={14} color="var(--accent-primary)" />}
                        </div>
                      ),
                    )}
                  </div>
                )}
              </div>

              {/* Filter 2: Target / PYQ Year */}
              <div style={{ position: 'relative', flex: 1, minWidth: 150 }} data-dropdown-container>
                <label
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: 4,
                    display: 'block',
                  }}
                >
                  Target / PYQ Year
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setActiveDropdown(activeDropdown === 'year' ? null : 'year');
                    setFilterSearchQuery('');
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 14px',
                    borderRadius: 0,
                    border:
                      activeDropdown === 'year' ? '1px solid var(--primary-red)' : '1px solid #E2E8F0',
                    backgroundColor: activeDropdown === 'year' ? 'var(--bg-card)' : 'var(--bg-subtle)',
                    color: 'var(--deep-navy)',
                    fontSize: 13,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    boxShadow:
                      activeDropdown === 'year' ? '0 0 0 3px rgba(23, 32, 51, 0.12)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span
                    style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                  >
                    {selectedYearsList.length === 0
                      ? (yearOptions[0] || 'All Years')
                      : selectedYearsList.length === 1
                        ? selectedYearsList[0]
                        : `${selectedYearsList.length} Years Selected`}
                  </span>
                  <ChevronDown
                    size={14}
                    color="var(--text-muted)"
                    style={{
                      transform: activeDropdown === 'year' ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.15s ease',
                    }}
                  />
                </button>

                {activeDropdown === 'year' && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 8px)',
                      left: 0,
                      width: 250,
                      maxWidth: 'calc(100vw - 32px)',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid #E2E8F0',
                      borderRadius: 0,
                      boxShadow: '0 12px 32px rgba(15, 23, 42, 0.14)',
                      padding: 10,
                      zIndex: 100,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        paddingBottom: 6,
                        marginBottom: 6,
                        borderBottom: '1px solid #F1F5F9',
                      }}
                    >
                      <button
                        type="button"
                        onClick={selectAllYears}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--accent-primary)',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleYearFilter('All Years')}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Clear
                      </button>
                    </div>

                    <div style={{ position: 'relative', marginBottom: 8 }} data-dropdown-container>
                      <Search
                        size={14}
                        color="var(--text-disabled)"
                        style={{ position: 'absolute', left: 10, top: 10 }}
                      />
                      <input
                        type="text"
                        autoFocus
                        placeholder="Search year..."
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
                          backgroundColor: 'var(--bg-subtle)',
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
                      {/* All Years Default */}
                      {(yearOptions[0] || 'All Years')
                        .toLowerCase()
                        .includes(filterSearchQuery.toLowerCase()) && (
                        <div
                          onClick={() => toggleYearFilter('All Years')}
                          style={{
                            padding: '8px 10px',
                            borderRadius: 0,
                            fontSize: 12.5,
                            fontWeight: selectedYearsList.length === 0 ? 700 : 500,
                            color: selectedYearsList.length === 0 ? 'var(--accent-primary)' : 'var(--text-secondary)',
                            backgroundColor:
                              selectedYearsList.length === 0 ? 'var(--bg-hover)' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input
                              type="checkbox"
                              checked={selectedYearsList.length === 0}
                              onChange={() => {}}
                              style={{ cursor: 'pointer', accentColor: 'var(--accent-primary)' }}
                            />
                            <span>{yearOptions[0] || 'All Years'}</span>
                          </div>
                          {selectedYearsList.length === 0 && (
                            <Check size={14} color="var(--accent-primary)" />
                          )}
                        </div>
                      )}

                      {/* Individual Years */}
                      {yearOptions
                        .filter(
                          (y) =>
                            !y.startsWith('All Years') &&
                            y.toLowerCase().includes(filterSearchQuery.toLowerCase()),
                        )
                        .map((opt: string) => {
                          const isSelected = selectedYearsList.includes(opt);
                          return (
                            <div
                              key={opt}
                              onClick={() => toggleYearFilter(opt)}
                              style={{
                                padding: '8px 10px',
                                borderRadius: 0,
                                fontSize: 12.5,
                                fontWeight: isSelected ? 700 : 500,
                                color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                backgroundColor: isSelected ? 'var(--bg-hover)' : 'transparent',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                cursor: 'pointer',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {}}
                                  style={{ cursor: 'pointer', accentColor: 'var(--accent-primary)' }}
                                />
                                <span>{opt}</span>
                              </div>
                              {isSelected && <Check size={14} color="var(--accent-primary)" />}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>

              {/* Filter 3: Subject Focus */}
              <div style={{ position: 'relative', flex: 1.2, minWidth: 160 }} data-dropdown-container>
                <label
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: 'var(--text-muted)',
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
                      activeDropdown === 'subject' ? '1px solid var(--primary-red)' : '1px solid #E2E8F0',
                    backgroundColor: activeDropdown === 'subject' ? 'var(--bg-card)' : 'var(--bg-subtle)',
                    color: 'var(--deep-navy)',
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
                    color="var(--text-muted)"
                    style={{
                      transform: activeDropdown === 'subject' ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.15s ease',
                    }}
                  />
                </button>

                {activeDropdown === 'subject' && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 8px)',
                      left: 0,
                      width: 250,
                      maxWidth: 'calc(100vw - 32px)',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid #E2E8F0',
                      borderRadius: 0,
                      boxShadow: '0 12px 32px rgba(15, 23, 42, 0.14)',
                      padding: 10,
                      zIndex: 100,
                    }}
                  >
                    {/* Action Bar */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 6, marginBottom: 6, borderBottom: '1px solid #F1F5F9' }}>
                      <button type="button" onClick={selectAllSubjects} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Select All</button>
                      <button type="button" onClick={() => toggleSubjectFilter('All Subjects')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Clear</button>
                    </div>

                    <div style={{ position: 'relative', marginBottom: 8 }} data-dropdown-container>
                      <Search
                        size={14}
                        color="var(--text-disabled)"
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
                          backgroundColor: 'var(--bg-subtle)',
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
                      {subjectsList
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
                                color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                backgroundColor: isSelected ? 'var(--bg-hover)' : 'transparent',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                cursor: 'pointer',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <input type="checkbox" checked={isSelected} onChange={() => {}} style={{ cursor: 'pointer', accentColor: 'var(--accent-primary)' }} />
                                <span>{opt}</span>
                              </div>
                              {isSelected && <Check size={14} color="var(--accent-primary)" />}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>

              {/* Filter: Topic Focus */}
              <div style={{ position: 'relative', flex: 1.2, minWidth: 160 }} data-dropdown-container>
                <label
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: 'var(--text-muted)',
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
                      activeDropdown === 'topic' ? '1px solid var(--primary-red)' : '1px solid #E2E8F0',
                    backgroundColor: activeDropdown === 'topic' ? 'var(--bg-card)' : 'var(--bg-subtle)',
                    color: 'var(--deep-navy)',
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
                    color="var(--text-muted)"
                    style={{
                      transform: activeDropdown === 'topic' ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.15s ease',
                    }}
                  />
                </button>

                {activeDropdown === 'topic' && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 8px)',
                      left: 0,
                      width: 260,
                      maxWidth: 'calc(100vw - 32px)',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid #E2E8F0',
                      borderRadius: 0,
                      boxShadow: '0 12px 32px rgba(15, 23, 42, 0.14)',
                      padding: 10,
                      zIndex: 100,
                    }}
                  >
                    {/* Action Bar */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 6, marginBottom: 6, borderBottom: '1px solid #F1F5F9' }}>
                      <button type="button" onClick={selectAllTopics} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Select All</button>
                      <button type="button" onClick={() => toggleTopicFilter('All Topics')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Clear</button>
                    </div>

                    <div style={{ position: 'relative', marginBottom: 8 }} data-dropdown-container>
                      <Search
                        size={14}
                        color="var(--text-disabled)"
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
                          backgroundColor: 'var(--bg-subtle)',
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
                                color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                backgroundColor: isSelected ? 'var(--bg-hover)' : 'transparent',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                cursor: 'pointer',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <input type="checkbox" checked={isSelected} onChange={() => {}} style={{ cursor: 'pointer', accentColor: 'var(--accent-primary)' }} />
                                <span>{opt}</span>
                              </div>
                              {isSelected && <Check size={14} color="var(--accent-primary)" />}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>

              {/* Filter: Subtopic Focus */}
              <div style={{ position: 'relative', flex: 1.2, minWidth: 160 }} data-dropdown-container>
                <label
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: 'var(--text-muted)',
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
                      activeDropdown === 'subtopic' ? '1px solid var(--primary-red)' : '1px solid #E2E8F0',
                    backgroundColor: activeDropdown === 'subtopic' ? 'var(--bg-card)' : 'var(--bg-subtle)',
                    color: 'var(--deep-navy)',
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
                    color="var(--text-muted)"
                    style={{
                      transform: activeDropdown === 'subtopic' ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.15s ease',
                    }}
                  />
                </button>

                {activeDropdown === 'subtopic' && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 8px)',
                      left: 0,
                      width: 270,
                      maxWidth: 'calc(100vw - 32px)',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid #E2E8F0',
                      borderRadius: 0,
                      boxShadow: '0 12px 32px rgba(15, 23, 42, 0.14)',
                      padding: 10,
                      zIndex: 100,
                    }}
                  >
                    {/* Action Bar */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 6, marginBottom: 6, borderBottom: '1px solid #F1F5F9' }}>
                      <button type="button" onClick={selectAllSubtopics} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Select All</button>
                      <button type="button" onClick={() => toggleSubtopicFilter('All Subtopics')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Clear</button>
                    </div>

                    <div style={{ position: 'relative', marginBottom: 8 }} data-dropdown-container>
                      <Search
                        size={14}
                        color="var(--text-disabled)"
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
                          backgroundColor: 'var(--bg-subtle)',
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
                                color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                backgroundColor: isSelected ? 'var(--bg-hover)' : 'transparent',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                cursor: 'pointer',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <input type="checkbox" checked={isSelected} onChange={() => {}} style={{ cursor: 'pointer', accentColor: 'var(--accent-primary)' }} />
                                <span>{opt}</span>
                              </div>
                              {isSelected && <Check size={14} color="var(--accent-primary)" />}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>

              {/* Filter 4: Difficulty */}
              <div style={{ position: 'relative', flex: 1, minWidth: 130 }} data-dropdown-container>
                <label
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: 'var(--text-muted)',
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
                      activeDropdown === 'difficulty' ? '1px solid var(--primary-red)' : '1px solid #E2E8F0',
                    backgroundColor: activeDropdown === 'difficulty' ? 'var(--bg-card)' : 'var(--bg-subtle)',
                    color: 'var(--deep-navy)',
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
                    color="var(--text-muted)"
                    style={{
                      transform: activeDropdown === 'difficulty' ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.15s ease',
                    }}
                  />
                </button>

                {activeDropdown === 'difficulty' && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 8px)',
                      left: 0,
                      width: 170,
                      maxWidth: 'calc(100vw - 32px)',
                      backgroundColor: 'var(--bg-card)',
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
                            const current = new URLSearchParams(searchParams);
                            if (opt === 'All Levels') current.delete('difficulty');
                            else current.set('difficulty', opt);
                            navigate(`/practice-exam?${current.toString()}`);
                            setActiveDropdown(null);
                          }}
                          style={{
                            padding: '8px 10px',
                            borderRadius: 0,
                            fontSize: 12.5,
                            fontWeight: isSelected ? 700 : 500,
                            color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                            backgroundColor: isSelected ? 'var(--bg-subtle)' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                          }}
                        >
                          <span>{opt}</span>
                          {isSelected && <Check size={14} color="var(--accent-primary)" />}
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
                <Lightbulb size={16} color="var(--accent-primary)" />
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: 'var(--accent-primary)',
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
                  color: 'var(--text-muted)',
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
      {/* Main Console Workspace */}
      <div
        style={{
          display: 'flex',
          flex: 1,
          minHeight: 0,
          overflow: 'visible',
          position: 'relative',
          backgroundColor: 'var(--bg-subtle)',
          gap: !isTabletOrBelow && !isFocusMode ? 20 : 0,
          marginTop: isFocusMode || isTabletOrBelow ? 60 : 0,
          paddingTop: 12,
          paddingBottom: 16,
          paddingRight: isTabletOrBelow ? 12 : 24,
          paddingLeft: isTabletOrBelow ? 12 : 24,
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
          solutionData={
            activeQuestion
              ? practiceSolutions[activeQuestion.question_id] ||
                practiceSolutions[String(activeQuestion.question_id)] ||
                null
              : null
          }
          isRevealing={isSolutionLoading}
          onSelectOption={(optId, optLbl) => handleSelectOption(optId, optLbl)}
          onToggleBookmark={handleToggleBookmark}
          onRevealAnswer={() => handleRevealAnswer()}
          onShowSolution={() => handleShowSolution()}
          onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
          onPrev={() => currentQIndex > 0 && handleSelectQuestion(currentQIndex - 1)}
          onNext={() => {
            if (currentQIndex < totalQuestions - 1) {
              handleSelectQuestion(currentQIndex + 1);
            } else {
              setShowNoMoreQuestionsModal(true);
            }
          }}
        />

        {/* Right Side Recommended Questions Fixed Sidebar (Desktop) */}
        {!isTabletOrBelow && !isFocusMode && (
          <aside
            style={{
              width: 380,
              backgroundColor: 'var(--bg-card)',
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
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 990,
            backgroundColor: 'var(--deep-navy)',
            color: 'var(--bg-card)',
            borderRadius: 0,
            padding: '10px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            boxShadow: '0 12px 30px rgba(15, 23, 42, 0.35)',
            border: '1.5px solid rgba(255, 255, 255, 0.15)',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
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
                color: 'var(--bg-card)',
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
            <span>Practice Finished! Showing score report in {scoreCountdown}s...</span>
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
              color: 'var(--bg-card)',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
          >
            View Score Now &rsaquo;
          </button>
        </div>
      )}

      {/* Completion Score Modal */}
      <GuestScoreModal
        isOpen={showScoreModal}
        scoreData={guestScoreData}
        isGuest={false}
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
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: 0,
              padding: 32,
              maxWidth: 420,
              width: '100%',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
              textAlign: 'center',
              border: '1px solid #E2E8F0',
            }}
          >
            <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--deep-navy)', margin: '0 0 8px 0' }}>
              Leave Practice Session?
            </h3>

            <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, margin: '0 0 22px 0' }}>
              Your current practice progress is temporarily saved in your browser. You can return
              anytime.
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
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-secondary)',
                  fontSize: 13.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                Continue Practice
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowLeaveModal(false);
                  navigate('/mocks');
                }}
                style={{
                  flex: 1,
                  height: 42,
                  borderRadius: 0,
                  border: 'none',
                  backgroundColor: '#DC2626',
                  color: 'var(--bg-card)',
                  fontSize: 13.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(220, 38, 38, 0.25)',
                  transition: 'all 0.15s ease',
                }}
              >
                Leave Session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* No More Questions Available Pop-up Modal */}
      {showNoMoreQuestionsModal && (
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
              backgroundColor: 'var(--bg-card)',
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
                backgroundColor: '#ECFDF5',
                border: '1px solid #A7F3D0',
                color: '#3A8B53',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto',
              }}
            >
              <CheckCircle2 size={28} color="#3A8B53" />
            </div>

            <div
              style={{
                display: 'inline-block',
                backgroundColor: 'var(--status-warning-bg)',
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
              Subject Practice Complete
            </div>

            <h3
              style={{
                fontSize: 20,
                fontWeight: 800,
                color: 'var(--deep-navy)',
                margin: '0 0 10px 0',
                lineHeight: 1.3,
              }}
            >
              No More Questions Available
            </h3>

            <p style={{ fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.5, margin: '0 0 24px 0' }}>
              You've completed all available practice questions for{' '}
              <strong>{gSubject || 'this subject'}</strong>. Try selecting a different subject or
              topic to continue practicing!
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                type="button"
                onClick={() => {
                  setShowNoMoreQuestionsModal(false);
                  navigate('/practice-tests');
                }}
                style={{
                  width: '100%',
                  height: 46,
                  borderRadius: 0,
                  border: 'none',
                  backgroundColor: 'var(--accent-primary)',
                  color: 'var(--bg-card)',
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
                  e.currentTarget.style.backgroundColor = 'var(--accent-primary)';
                }}
              >
                Select Another Subject &rsaquo;
              </button>

              <button
                type="button"
                onClick={() => setShowNoMoreQuestionsModal(false)}
                style={{
                  width: '100%',
                  height: 42,
                  borderRadius: 0,
                  border: '1.5px solid #E2E8F0',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-muted)',
                  fontSize: 13.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-subtle)';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-card)';
                  e.currentTarget.style.color = 'var(--text-muted)';
                }}
              >
                Review Attempted Questions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
