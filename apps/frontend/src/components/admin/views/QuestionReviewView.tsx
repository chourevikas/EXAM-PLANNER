import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  ArrowLeft,
  BookOpen,
  Loader2,
  Save,
  X,
  Check,
  FileText,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Edit3,
  ThumbsUp,
  ThumbsDown,
  UploadCloud,
  Layers,
  Sparkles,
  HelpCircle,
  Clock,
  Award,
  Zap,
  Tag,
  FolderTree,
  Trash2,
  RefreshCw,
  Eye,
  Lock,
  Unlock,
  RotateCcw,
  Database,
  AlertCircle,
  ShieldAlert,
  Plus,
  Percent,
  Sliders,
  GitBranch,
} from 'lucide-react';
import {
  fetchExamPipelineStatuses,
  fetchExamQuestionsForReview,
  fetchExamSyncStatus,
  updateAdminQuestionDetail,
  updateAdminQuestionStatus,
  approveAndPublishExam,
  syncExamToS3,
  ExamPipelineStatusItem,
} from '../../../services/adminService';

interface QuestionOptionItem {
  option_id?: string;
  option_label: string;
  option_text: string;
  is_correct: boolean;
  display_order?: number;
  distractor_analysis?: string | null;
  closeness_score?: number | null;
}

interface QuestionExplanationItem {
  explanation_id?: string;
  language?: string;
  core_concept?: string;
  detailed_solution?: string;
  common_traps?: string[];
  key_takeaways?: string[];
  translations?: Record<string, any>;
}

interface HierarchyLinkItem {
  subject_id?: string;
  subject_name?: string;
  subject_code?: string;
  topic_id?: string;
  topic_name?: string;
  topic_code?: string;
  subtopic_id?: string;
  subtopic_name?: string;
  subtopic_code?: string;
  is_primary?: boolean;
  relevance_weight?: number;
  relevance_percentage?: number;
  concept_name?: string;
}

interface QuestionDetailItem {
  id: string;
  question_id?: string;
  exam_id?: string;
  exam_name?: string;
  exam_code?: string;
  question_number_in_paper: number;
  question_type: string;
  difficulty: string;
  marks: number;
  negative_marks?: number;
  expected_time_seconds?: number;
  status: string;
  question_text: string;
  passage_id?: string;
  passage_text?: string | null;
  subject_name?: string;
  topic_name?: string;
  subtopic_name?: string;
  options: QuestionOptionItem[];
  explanation?: QuestionExplanationItem | null;
  hierarchy?: HierarchyLinkItem[];
  metadata?: {
    blooms_level?: string;
    cognitive_skill?: string;
    primary_concept_tag?: string;
  };
}

interface QuestionReviewViewProps {
  initialExam?: ExamPipelineStatusItem | any | null;
  onNavigate?: (view: string, extraData?: any) => void;
}

export function QuestionReviewView({ initialExam, onNavigate }: QuestionReviewViewProps = {}) {
  const [windowWidth, setWindowWidth] = useState<number>(typeof window !== 'undefined' ? window.innerWidth : 1200);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowWidth <= 768;

  // Selected Exam for Review
  const [selectedExam, setSelectedExam] = useState<ExamPipelineStatusItem | any | null>(initialExam || null);

  useEffect(() => {
    if (initialExam) {
      setSelectedExam(initialExam);
    }
  }, [initialExam]);

  // Exams List & Directory State
  const [examsList, setExamsList] = useState<ExamPipelineStatusItem[]>([]);
  const [loadingExams, setLoadingExams] = useState<boolean>(true);
  const [examSearchQuery, setExamSearchQuery] = useState<string>('');
  const [examStatusFilter, setExamStatusFilter] = useState<string>('ALL');

  // Review Questions State & Server-side Pagination (10 items/query)
  const [questionsList, setQuestionsList] = useState<QuestionDetailItem[]>([]);
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState<number>(0);
  const [loadingQuestions, setLoadingQuestions] = useState<boolean>(false);
  const [questionStatusFilter, setQuestionStatusFilter] = useState<string>('ALL'); // ALL, PENDING, PUBLISHED, REJECTED
  const [questionSearchQuery, setQuestionSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const pageSize = 10;

  // Review Counters from Backend
  const [reviewMetrics, setReviewMetrics] = useState<{
    total: number;
    reviewed: number;
    pending: number;
    rejected: number;
    canPublish: boolean;
  }>({ total: 0, reviewed: 0, pending: 0, rejected: 0, canPublish: false });

  // Dedicated S3 Pipeline Status across 3 Scenarios
  const [s3PublishStatus, setS3PublishStatus] = useState<{
    is_published: boolean;
    publish_status: string; // 'PUBLISHED' | 'PUBLISH_FAILED' | 'CORRUPTED' | 'READY_FOR_PUBLISH' | 'PENDING_REVIEW'
    can_retry: boolean;
    is_corrupted: boolean;
    publish_error: string | null;
    corruption_reason: string | null;
    questions_json_path: string | null;
    solutions_json_path: string | null;
    questions_json_folder_path: string | null;
    solutions_json_folder_path: string | null;
    last_synced_at: string | null;
    updated_at: string | null;
    is_s3_out_of_sync: boolean;
    is_syncing: boolean;
    sync_step: string | null;
    sync_progress: number;
  }>({
    is_published: false,
    publish_status: 'PENDING_REVIEW',
    can_retry: false,
    is_corrupted: false,
    publish_error: null,
    corruption_reason: null,
    questions_json_path: null,
    solutions_json_path: null,
    questions_json_folder_path: null,
    solutions_json_folder_path: null,
    last_synced_at: null,
    updated_at: null,
    is_s3_out_of_sync: false,
    is_syncing: false,
    sync_step: null,
    sync_progress: 0,
  });

  // Action & Toast States
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [publishingExam, setPublishingExam] = useState<boolean>(false);
  const [syncingExam, setSyncingExam] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);

  const syncPollTimerRef = useRef<any>(null);

  const checkSyncStatusOnce = async (examId: string) => {
    try {
      const syncData = await fetchExamSyncStatus(examId);
      if (syncData) {
        const stillSyncing = Boolean(syncData.is_syncing);
        setS3PublishStatus((prev) => ({
          ...prev,
          is_syncing: stillSyncing,
          sync_step: syncData.current_step || null,
          sync_progress: syncData.progress_percent || 0,
          is_published: Boolean(syncData.is_published),
          is_s3_out_of_sync: Boolean(syncData.is_s3_out_of_sync),
          last_synced_at: syncData.last_synced_at || prev.last_synced_at,
          updated_at: syncData.updated_at || prev.updated_at,
          questions_json_path: syncData.questions_json_path || prev.questions_json_path,
          solutions_json_path: syncData.solutions_json_path || prev.solutions_json_path,
          questions_json_folder_path: syncData.questions_json_folder_path || prev.questions_json_folder_path,
          solutions_json_folder_path: syncData.solutions_json_folder_path || prev.solutions_json_folder_path,
        }));

        if (!stillSyncing) {
          if (syncPollTimerRef.current) {
            clearTimeout(syncPollTimerRef.current);
            syncPollTimerRef.current = null;
          }
          setSyncingExam(false);
          if (syncData.sync_status === 'COMPLETED') {
            showToast('success', 'Exam S3 Sync completed successfully! All artifacts updated.');
            await loadExamQuestions(examId, questionStatusFilter, currentPage, selectedQuestionIndex);
          } else if (syncData.sync_status === 'FAILED') {
            showToast('error', `S3 Sync failed: ${syncData.error_log || 'Unknown error'}`);
            setS3PublishStatus((prev) => ({
              ...prev,
              publish_status: 'PUBLISH_FAILED',
              publish_error: syncData.error_log || 'S3 sync task failed.',
            }));
          }
        }
        return stillSyncing;
      }
    } catch (err: any) {
      console.error('Error checking sync status:', err);
    }
    return false;
  };

  const startSyncPolling = (examId: string, isFullSync: boolean = false) => {
    if (syncPollTimerRef.current) {
      clearTimeout(syncPollTimerRef.current);
      syncPollTimerRef.current = null;
    }

    // Non-linear adaptive timing:
    // 1. Initial warm-up (longer delay while server starts S3 sync): 6000ms (or 4000ms for fast sync)
    // 2. Active phase (decreasing delay): 6s -> 4s -> 3s for fast detection
    // 3. Backoff phase (increasing delay): 3s -> 5s -> 8s -> 12s if sync takes longer
    let currentDelay = isFullSync ? 6000 : 4000;
    const minDelay = 2500;
    const maxDelay = isFullSync ? 18000 : 12000;
    const backoffMultiplier = 1.4;
    let iteration = 0;

    const poll = async () => {
      iteration += 1;
      const isStillSyncing = await checkSyncStatusOnce(examId);
      if (isStillSyncing) {
        if (iteration <= 3) {
          // Decreasing interval during initial active execution
          currentDelay = Math.max(minDelay, currentDelay - 1200);
        } else {
          // Increasing interval during extended execution
          currentDelay = Math.min(maxDelay, Math.round(currentDelay * backoffMultiplier));
        }
        syncPollTimerRef.current = setTimeout(poll, currentDelay);
      }
    };

    syncPollTimerRef.current = setTimeout(poll, currentDelay);
  };

  useEffect(() => {
    return () => {
      if (syncPollTimerRef.current) {
        clearInterval(syncPollTimerRef.current);
        syncPollTimerRef.current = null;
      }
    };
  }, []);

  // Unsaved Changes Navigation Guard
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [pendingNavigationAction, setPendingNavigationAction] = useState<(() => void) | null>(null);
  const [showUnsavedModal, setShowUnsavedModal] = useState<boolean>(false);

  // S3 Publish Confirmation Modal
  const [showPublishModal, setShowPublishModal] = useState<boolean>(false);
  const [showPublishWarningModal, setShowPublishWarningModal] = useState<boolean>(false);

  // Full Question Edit Modal State
  const [editingQuestion, setEditingQuestion] = useState<QuestionDetailItem | null>(null);
  const [editQuestionText, setEditQuestionText] = useState<string>('');
  const [editPassageText, setEditPassageText] = useState<string>('');
  const [editSubjectName, setEditSubjectName] = useState<string>('');
  const [editTopicName, setEditTopicName] = useState<string>('');
  const [editSubtopicName, setEditSubtopicName] = useState<string>('');
  const [editHierarchyLinks, setEditHierarchyLinks] = useState<HierarchyLinkItem[]>([]);
  const [editDifficulty, setEditDifficulty] = useState<string>('MEDIUM');
  const [editMarks, setEditMarks] = useState<number>(2.0);
  const [editNegativeMarks, setEditNegativeMarks] = useState<number>(0.66);
  const [editExpectedTime, setEditExpectedTime] = useState<number>(60);
  const [editBloomsLevel, setEditBloomsLevel] = useState<string>('ANALYZE');

  // 4 Solution Parameters Edit State
  const [editCoreConcept, setEditCoreConcept] = useState<string>('');
  const [editDetailedSolution, setEditDetailedSolution] = useState<string>('');
  const [editCommonTraps, setEditCommonTraps] = useState<string[]>([]);
  const [editKeyTakeaways, setEditKeyTakeaways] = useState<string[]>([]);
  const [newTrapInput, setNewTrapInput] = useState<string>('');
  const [newTakeawayInput, setNewTakeawayInput] = useState<string>('');

  // Options Edit State
  const [editOptions, setEditOptions] = useState<{
    option_id?: string;
    option_label: string;
    option_text: string;
    is_correct: boolean;
    distractor_analysis: string;
  }[]>([]);

  const [savingEdit, setSavingEdit] = useState<boolean>(false);

  useEffect(() => {
    if (!selectedExam) {
      loadExamsList();
    }
  }, [selectedExam]);

  useEffect(() => {
    if (selectedExam?.id) {
      loadExamQuestions(selectedExam.id, questionStatusFilter, 1);
    }
  }, [selectedExam?.id, questionStatusFilter]);

  const showToast = (type: 'success' | 'error' | 'warning', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  const loadExamsList = async () => {
    setLoadingExams(true);
    try {
      const data = await fetchExamPipelineStatuses();
      setExamsList(data);
    } catch (err: any) {
      showToast('error', `Failed to load exams: ${err.message}`);
    } finally {
      setLoadingExams(false);
    }
  };

  const loadExamQuestions = async (
    examId: string,
    statusFilterVal?: string,
    pageNum: number = 1,
    targetSelectIdx: number = 0
  ) => {
    setLoadingQuestions(true);
    try {
      const backendStatus =
        statusFilterVal === 'PENDING'
          ? 'PENDING_HUMAN_REVIEW'
          : statusFilterVal === 'PUBLISHED'
          ? 'PUBLISHED'
          : statusFilterVal === 'REJECTED'
          ? 'REJECTED'
          : undefined;

      const data = await fetchExamQuestionsForReview(examId, pageNum, 10, backendStatus);

      const items: QuestionDetailItem[] = (data.items || []).map((q: any) => {
        const primaryH = q.hierarchy && q.hierarchy.length > 0 ? q.hierarchy[0] : null;
        return {
          id: q.question_id || q.id,
          question_id: q.question_id || q.id,
          exam_id: q.exam_id,
          exam_name: q.exam_name,
          exam_code: q.exam_code,
          question_number_in_paper: q.question_number_in_paper,
          question_type: q.question_type || 'SINGLE_CHOICE',
          difficulty: q.difficulty || 'MEDIUM',
          marks: q.marks !== undefined ? q.marks : 2.0,
          negative_marks: q.negative_marks !== undefined ? q.negative_marks : 0.66,
          expected_time_seconds: q.expected_time_seconds || 60,
          status: q.status || 'PENDING_HUMAN_REVIEW',
          question_text: q.question_text || '',
          passage_id: q.passage_id,
          passage_text: q.passage_text || null,
          subject_name: (primaryH && primaryH.subject_name) || q.subject_name || '',
          topic_name: (primaryH && primaryH.topic_name) || q.topic_name || '',
          subtopic_name: (primaryH && primaryH.subtopic_name) || q.subtopic_name || '',
          options: (q.options || []).map((opt: any) => ({
            option_id: opt.option_id,
            option_label: opt.option_label,
            option_text: opt.option_text || '',
            is_correct: Boolean(opt.is_correct),
            display_order: opt.display_order,
            distractor_analysis: opt.distractor_analysis || null,
            closeness_score: opt.closeness_score,
          })),
          explanation: q.explanation
            ? {
                explanation_id: q.explanation.explanation_id,
                language: q.explanation.language,
                core_concept: q.explanation.core_concept || '',
                detailed_solution: q.explanation.detailed_solution || '',
                common_traps: q.explanation.common_traps || [],
                key_takeaways: q.explanation.key_takeaways || [],
                translations: q.explanation.translations || {},
              }
            : null,
          hierarchy: (q.hierarchy || []).map((h: any) => ({
            subject_id: h.subject_id,
            subject_name: h.subject_name,
            subject_code: h.subject_code,
            topic_id: h.topic_id,
            topic_name: h.topic_name,
            topic_code: h.topic_code,
            subtopic_id: h.subtopic_id,
            subtopic_name: h.subtopic_name,
            subtopic_code: h.subtopic_code,
            is_primary: Boolean(h.is_primary),
            relevance_weight: h.relevance_weight !== undefined ? h.relevance_weight : 1.0,
            relevance_percentage: h.relevance_percentage !== undefined ? h.relevance_percentage : (h.relevance_weight ? Math.round(h.relevance_weight * 100) : 100),
            concept_name: h.concept_name || '',
          })),
          metadata: q.metadata || {},
        };
      });

      setQuestionsList(items);
      setCurrentPage(data.page || pageNum);

      const filterCount =
        statusFilterVal === 'PENDING'
          ? (data.pending_count !== undefined ? data.pending_count : items.filter((i) => i.status === 'PENDING_HUMAN_REVIEW').length)
          : statusFilterVal === 'PUBLISHED'
          ? (data.reviewed_count !== undefined ? data.reviewed_count : items.filter((i) => i.status === 'PUBLISHED').length)
          : statusFilterVal === 'REJECTED'
          ? (data.rejected_count !== undefined ? data.rejected_count : items.filter((i) => i.status === 'REJECTED').length)
          : (data.total_questions !== undefined ? data.total_questions : items.length);

      const calculatedPages = data.pages || Math.ceil(filterCount / 10) || 1;
      setTotalPages(Math.max(1, calculatedPages));

      setReviewMetrics({
        total: data.total_questions !== undefined ? data.total_questions : items.length,
        reviewed: data.reviewed_count !== undefined ? data.reviewed_count : items.filter((i) => i.status === 'PUBLISHED').length,
        pending: data.pending_count !== undefined ? data.pending_count : items.filter((i) => i.status === 'PENDING_HUMAN_REVIEW').length,
        rejected: data.rejected_count !== undefined ? data.rejected_count : items.filter((i) => i.status === 'REJECTED').length,
        canPublish: Boolean(data.can_publish),
      });

      const isExamPublished = Boolean(data.is_published || (selectedExam?.status || '').toUpperCase().includes('PUBLISHED'));
      const isCurrentlySyncing = Boolean(data.is_syncing);
      setS3PublishStatus({
        is_published: isExamPublished,
        publish_status: data.publish_status || (isExamPublished ? 'PUBLISHED' : 'PENDING_REVIEW'),
        can_retry: Boolean(data.can_retry),
        is_corrupted: Boolean(data.is_corrupted),
        publish_error: data.publish_error || null,
        corruption_reason: data.corruption_reason || null,
        questions_json_path: data.questions_json_path || selectedExam?.questions_json_path || null,
        solutions_json_path: data.solutions_json_path || selectedExam?.solutions_json_path || null,
        questions_json_folder_path: data.questions_json_folder_path || selectedExam?.questions_json_folder_path || null,
        solutions_json_folder_path: data.solutions_json_folder_path || selectedExam?.solutions_json_folder_path || null,
        last_synced_at: data.last_synced_at || null,
        updated_at: data.updated_at || null,
        is_s3_out_of_sync: Boolean(data.is_s3_out_of_sync),
        is_syncing: isCurrentlySyncing,
        sync_step: isCurrentlySyncing ? 'S3 Synchronization In Progress' : null,
        sync_progress: isCurrentlySyncing ? 30 : 0,
      });

      if (isCurrentlySyncing) {
        setSyncingExam(true);
        startSyncPolling(examId);
      }

      const safeIdx = Math.max(0, Math.min(items.length - 1, targetSelectIdx));
      setSelectedQuestionIndex(safeIdx);
      setHasUnsavedChanges(false);
    } catch (err: any) {
      showToast('error', `Failed to load review questions: ${err.message}`);
    } finally {
      setLoadingQuestions(false);
    }
  };

  const safeNavigate = (action: () => void) => {
    if (hasUnsavedChanges) {
      setPendingNavigationAction(() => action);
      setShowUnsavedModal(true);
    } else {
      action();
    }
  };

  const handleSelectQuestion = (index: number) => {
    safeNavigate(() => {
      setSelectedQuestionIndex(index);
      setHasUnsavedChanges(false);
    });
  };

  const handlePageChange = (newPage: number, targetSelectIdx: number = 0) => {
    if (newPage < 1 || newPage > totalPages || (newPage === currentPage && !loadingQuestions)) return;
    safeNavigate(() => {
      if (selectedExam?.id) {
        loadExamQuestions(selectedExam.id, questionStatusFilter, newPage, targetSelectIdx);
      }
    });
  };

  const handleStatusFilterChange = (newFilter: string) => {
    safeNavigate(() => {
      setQuestionStatusFilter(newFilter);
      setCurrentPage(1);
    });
  };

  const handleBackToExamsList = () => {
    safeNavigate(() => {
      setSelectedExam(null);
      setQuestionsList([]);
      setCurrentPage(1);
      setTotalPages(1);
      setSelectedQuestionIndex(0);
      setHasUnsavedChanges(false);
      loadExamsList();
    });
  };

  const handlePrevQuestionClick = () => {
    if (selectedQuestionIndex > 0) {
      handleSelectQuestion(selectedQuestionIndex - 1);
    } else if (currentPage > 1) {
      handlePageChange(currentPage - 1, 9);
    }
  };

  const handleNextQuestionClick = () => {
    if (selectedQuestionIndex < questionsList.length - 1) {
      handleSelectQuestion(selectedQuestionIndex + 1);
    } else if (currentPage < totalPages) {
      handlePageChange(currentPage + 1, 0);
    }
  };

  const handleQuickApproveQuestion = async (question: QuestionDetailItem) => {
    setActionLoadingId(question.id);
    try {
      await updateAdminQuestionStatus(question.id, 'PUBLISHED');
      showToast('success', `Question #${question.question_number_in_paper} approved & verified!`);
      setQuestionsList((prev) =>
        prev.map((q) => (q.id === question.id ? { ...q, status: 'PUBLISHED' } : q))
      );
      setReviewMetrics((prev) => {
        const nextPending = Math.max(0, prev.pending - 1);
        const nextReviewed = prev.reviewed + (question.status !== 'PUBLISHED' ? 1 : 0);
        const nextRejected = question.status === 'REJECTED' ? Math.max(0, prev.rejected - 1) : prev.rejected;
        return {
          ...prev,
          pending: nextPending,
          reviewed: nextReviewed,
          rejected: nextRejected,
          canPublish: nextPending === 0 && nextRejected === 0 && prev.total > 0,
        };
      });

      const nextPendingIndex = questionsList.findIndex(
        (q, idx) => idx > selectedQuestionIndex && q.status === 'PENDING_HUMAN_REVIEW'
      );
      if (nextPendingIndex !== -1) {
        setSelectedQuestionIndex(nextPendingIndex);
      } else if (selectedQuestionIndex < questionsList.length - 1) {
        setSelectedQuestionIndex(selectedQuestionIndex + 1);
      } else if (currentPage < totalPages) {
        showToast('success', `Current page verified! Advancing to Page ${currentPage + 1}...`);
        handlePageChange(currentPage + 1, 0);
      }
    } catch (err: any) {
      showToast('error', `Failed to approve question: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRejectQuestion = async (question: QuestionDetailItem) => {
    setActionLoadingId(question.id);
    try {
      await updateAdminQuestionStatus(question.id, 'REJECTED');
      showToast('warning', `Question #${question.question_number_in_paper} marked as REJECTED.`);
      setQuestionsList((prev) =>
        prev.map((q) => (q.id === question.id ? { ...q, status: 'REJECTED' } : q))
      );
      setReviewMetrics((prev) => {
        const nextPending = question.status === 'PENDING_HUMAN_REVIEW' ? Math.max(0, prev.pending - 1) : prev.pending;
        const nextReviewed = question.status === 'PUBLISHED' ? Math.max(0, prev.reviewed - 1) : prev.reviewed;
        const nextRejected = prev.rejected + (question.status !== 'REJECTED' ? 1 : 0);
        return {
          ...prev,
          pending: nextPending,
          reviewed: nextReviewed,
          rejected: nextRejected,
          canPublish: false,
        };
      });

      if (selectedQuestionIndex < questionsList.length - 1) {
        setSelectedQuestionIndex(selectedQuestionIndex + 1);
      }
    } catch (err: any) {
      showToast('error', `Failed to reject question: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleOpenEditModal = (q: QuestionDetailItem) => {
    setEditingQuestion(q);
    setEditQuestionText(q.question_text || '');
    setEditPassageText(q.passage_text || '');
    setEditSubjectName(q.subject_name || '');
    setEditTopicName(q.topic_name || '');
    setEditSubtopicName(q.subtopic_name || '');
    setEditDifficulty(q.difficulty || 'MEDIUM');
    setEditMarks(q.marks !== undefined ? q.marks : 2.0);
    setEditNegativeMarks(q.negative_marks !== undefined ? q.negative_marks : 0.66);
    setEditExpectedTime(q.expected_time_seconds || 60);
    setEditBloomsLevel(q.metadata?.blooms_level || 'ANALYZE');

    const rawH = q.hierarchy && q.hierarchy.length > 0 ? q.hierarchy : [];
    const initialH: HierarchyLinkItem[] = rawH.length > 0
      ? rawH.map((h) => ({
          subject_id: h.subject_id,
          subject_name: h.subject_name || q.subject_name || '',
          topic_id: h.topic_id,
          topic_name: h.topic_name || q.topic_name || '',
          subtopic_id: h.subtopic_id,
          subtopic_name: h.subtopic_name || q.subtopic_name || '',
          is_primary: Boolean(h.is_primary),
          relevance_weight: h.relevance_weight !== undefined ? h.relevance_weight : 1.0,
          relevance_percentage: h.relevance_percentage !== undefined ? h.relevance_percentage : (h.relevance_weight ? Math.round(h.relevance_weight * 100) : 100),
          concept_name: h.concept_name || h.topic_name || '',
        }))
      : [
          {
            subject_name: q.subject_name || 'General Science',
            topic_name: q.topic_name || 'General Concepts',
            subtopic_name: q.subtopic_name || '',
            is_primary: true,
            relevance_weight: 1.0,
            relevance_percentage: 100,
            concept_name: q.topic_name || '',
          },
        ];

    setEditHierarchyLinks(initialH);

    setEditCoreConcept(q.explanation?.core_concept || '');
    setEditDetailedSolution(q.explanation?.detailed_solution || '');
    setEditCommonTraps(q.explanation?.common_traps ? [...q.explanation.common_traps] : []);
    setEditKeyTakeaways(q.explanation?.key_takeaways ? [...q.explanation.key_takeaways] : []);

    setEditOptions(
      (q.options && q.options.length > 0 ? q.options : [
        { option_label: 'A', option_text: '', is_correct: false, distractor_analysis: '' },
        { option_label: 'B', option_text: '', is_correct: false, distractor_analysis: '' },
        { option_label: 'C', option_text: '', is_correct: false, distractor_analysis: '' },
        { option_label: 'D', option_text: '', is_correct: false, distractor_analysis: '' },
      ]).map((opt) => ({
        option_id: opt.option_id,
        option_label: opt.option_label,
        option_text: opt.option_text || '',
        is_correct: Boolean(opt.is_correct),
        distractor_analysis: opt.distractor_analysis || '',
      }))
    );
  };

  const handleSaveQuestionChanges = async (publishAfterSave: boolean = true) => {
    if (!editingQuestion) return;
    setSavingEdit(true);
    try {
      const primH = editHierarchyLinks.find((h) => h.is_primary) || editHierarchyLinks[0];
      const finalSubj = editSubjectName || primH?.subject_name || null;
      const finalTop = editTopicName || primH?.topic_name || null;
      const finalSubtop = editSubtopicName || primH?.subtopic_name || null;

      const payload: any = {
        question_text: editQuestionText,
        passage_text: editPassageText || null,
        difficulty: editDifficulty,
        marks: editMarks,
        negative_marks: editNegativeMarks,
        expected_time_seconds: editExpectedTime,
        status: publishAfterSave ? 'PUBLISHED' : editingQuestion.status,
        subject_name: finalSubj,
        topic_name: finalTop,
        subtopic_name: finalSubtop,
        hierarchy_links: editHierarchyLinks.map((h, i) => ({
          subject_id: h.subject_id || null,
          subject_name: h.subject_name || finalSubj,
          topic_id: h.topic_id || null,
          topic_name: h.topic_name || finalTop,
          subtopic_id: h.subtopic_id || null,
          subtopic_name: h.subtopic_name || finalSubtop,
          is_primary: Boolean(h.is_primary) || (i === 0),
          relevance_weight: (h.relevance_percentage !== undefined ? h.relevance_percentage : 100) / 100,
          concept_name: h.concept_name || null,
        })),
        blooms_level: editBloomsLevel,
        core_concept: editCoreConcept,
        detailed_solution: editDetailedSolution,
        common_traps: editCommonTraps,
        key_takeaways: editKeyTakeaways,
        options: editOptions.map((opt, idx) => ({
          option_id: opt.option_id,
          option_label: opt.option_label,
          option_text: opt.option_text,
          is_correct: opt.is_correct,
          display_order: idx + 1,
          distractor_analysis: opt.distractor_analysis,
        })),
      };

      await updateAdminQuestionDetail(editingQuestion.id, payload);
      showToast('success', `Question #${editingQuestion.question_number_in_paper} updated & saved!`);

      setQuestionsList((prev) =>
        prev.map((q) => (q.id === editingQuestion.id ? { ...q, ...payload, status: payload.status } : q))
      );

      if (selectedExam) {
        await loadExamQuestions(selectedExam.id, questionStatusFilter, currentPage, selectedQuestionIndex);
      }

      setEditingQuestion(null);
      setHasUnsavedChanges(false);
    } catch (err: any) {
      showToast('error', `Failed to save changes: ${err.message}`);
    } finally {
      setSavingEdit(false);
    }
  };

  const handlePublishExamToS3 = async () => {
    if (!selectedExam) return;
    if (reviewMetrics.pending > 0 || reviewMetrics.rejected > 0) {
      setShowPublishWarningModal(true);
      return;
    }

    setShowPublishModal(true);
  };

  const confirmPublishExam = async () => {
    if (!selectedExam) return;
    setPublishingExam(true);
    try {
      const res = await approveAndPublishExam(selectedExam.id);
      showToast('success', `Exam '${selectedExam.name}' published to S3 successfully! Questions & solutions JSON deployed.`);
      setShowPublishModal(false);
      setS3PublishStatus((prev) => ({
        ...prev,
        is_published: true,
        publish_status: 'PUBLISHED',
        can_retry: false,
        is_corrupted: false,
        publish_error: null,
        corruption_reason: null,
        questions_json_path: res.questions_json_path || prev.questions_json_path,
        solutions_json_path: res.solutions_json_path || prev.solutions_json_path,
        questions_json_folder_path: res.questions_json_folder_path || prev.questions_json_folder_path,
        solutions_json_folder_path: res.solutions_json_folder_path || prev.solutions_json_folder_path,
      }));
      await loadExamQuestions(selectedExam.id, questionStatusFilter, currentPage, selectedQuestionIndex);
    } catch (err: any) {
      const msg = err.message || 'Publish failed';
      const isCorrupted = msg.includes('EXAM_DATA_CORRUPTED') || msg.includes('CORRUPTED');
      setS3PublishStatus((prev) => ({
        ...prev,
        publish_status: isCorrupted ? 'CORRUPTED' : 'PUBLISH_FAILED',
        can_retry: !isCorrupted,
        is_corrupted: isCorrupted,
        publish_error: msg,
        corruption_reason: isCorrupted ? msg : null,
      }));
      showToast('error', `Publish failed: ${msg}`);
    } finally {
      setPublishingExam(false);
    }
  };

  const handleSyncExamToS3 = async (syncAll: boolean = false) => {
    if (!selectedExam) return;
    setSyncingExam(true);
    const scopeLabel = syncAll ? 'Full S3 Sync (Master + All Questions)' : 'Master Exam JSON Sync (Fast)';
    try {
      const res = await syncExamToS3(selectedExam.id, syncAll);
      showToast('success', `${scopeLabel} started in the background for '${selectedExam.name}'.`);
      setS3PublishStatus((prev) => ({
        ...prev,
        is_syncing: true,
        sync_step: syncAll ? 'INITIALIZING_FULL_S3_SYNC' : 'INITIALIZING_MASTER_S3_SYNC',
        sync_progress: 15,
      }));
      startSyncPolling(selectedExam.id);
    } catch (err: any) {
      showToast('error', `S3 Sync failed to start: ${err.message}`);
      setSyncingExam(false);
    }
  };

  const filteredQuestions = questionsList.filter((q) => {
    if (!questionSearchQuery) return true;
    const query = questionSearchQuery.toLowerCase();
    return (
      q.question_text.toLowerCase().includes(query) ||
      `q${q.question_number_in_paper}`.includes(query) ||
      `${q.question_number_in_paper}`.includes(query) ||
      (q.subject_name && q.subject_name.toLowerCase().includes(query)) ||
      (q.topic_name && q.topic_name.toLowerCase().includes(query))
    );
  });

  const activeQuestion = filteredQuestions[selectedQuestionIndex] || filteredQuestions[0];

  // -------------------------------------------------------------
  // VIEW 1: Exam Directory / Selection Hub View
  // -------------------------------------------------------------
  if (!selectedExam) {
    const filteredExams = examsList.filter((exam) => {
      const matchesSearch =
        !examSearchQuery ||
        exam.name.toLowerCase().includes(examSearchQuery.toLowerCase()) ||
        exam.code.toLowerCase().includes(examSearchQuery.toLowerCase());
      const statusUpper = (exam.status || '').toUpperCase();
      const matchesStatus =
        examStatusFilter === 'ALL' ||
        (examStatusFilter === 'PENDING' && statusUpper.includes('PENDING')) ||
        (examStatusFilter === 'PUBLISHED' && statusUpper.includes('PUBLISHED'));
      return matchesSearch && matchesStatus;
    });

    return (
      <div style={{ maxWidth: 1320, margin: '0 auto', fontFamily: 'Inter, sans-serif', paddingBottom: 60 }}>
        {/* Toast Notification */}
        {toastMessage && (
          <div
            style={{
              position: 'fixed',
              top: 24,
              right: 24,
              zIndex: 9999,
              padding: '12px 20px',
              borderRadius: 8,
              fontSize: 13.5,
              fontWeight: 600,
              backgroundColor: toastMessage.type === 'success' ? '#15803D' : toastMessage.type === 'error' ? '#DC2626' : '#D97706',
              color: '#FFFFFF',
              boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.2)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {toastMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            <span>{toastMessage.text}</span>
          </div>
        )}

        {/* Page Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
            Question & Solution QA Review Hub
          </h1>
          <p style={{ fontSize: 13.5, color: '#64748B', marginTop: 4, margin: '4px 0 0 0' }}>
            Inspect extracted questions, verify 4-parameter solutions & option distractor analyses, update taxonomy, and approve exam packages for S3 release.
          </p>
        </div>

        {/* Filters and Search Bar */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 14,
            border: '1px solid #E2E8F0',
            padding: '16px 20px',
            marginBottom: 24,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
          }}
        >
          <div style={{ position: 'relative', minWidth: 300, flex: 1 }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748B' }} />
            <input
              type="text"
              placeholder="Search exams by title or code..."
              value={examSearchQuery}
              onChange={(e) => setExamSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                fontSize: 13,
                borderRadius: 6,
                border: '1px solid #CBD5E1',
                outline: 'none',
                color: '#0F172A',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: '#475569' }}>Status:</span>
            <select
              value={examStatusFilter}
              onChange={(e) => setExamStatusFilter(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid #CBD5E1',
                fontSize: 13,
                color: '#0F172A',
                backgroundColor: '#FFFFFF',
                outline: 'none',
                fontWeight: 500,
              }}
            >
              <option value="ALL">All Exams ({examsList.length})</option>
              <option value="PENDING">Pending Review</option>
              <option value="PUBLISHED">Published in S3</option>
            </select>

            <button
              onClick={loadExamsList}
              style={{
                padding: '8px 14px',
                borderRadius: 6,
                border: '1px solid #CBD5E1',
                backgroundColor: '#FFFFFF',
                color: '#0F172A',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <RefreshCw size={14} className={loadingExams ? 'animate-spin' : ''} color="#64748B" />
              Refresh
            </button>
          </div>
        </div>

        {/* Exams Table */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: 14, border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)' }}>
          {loadingExams ? (
            <div style={{ padding: 60, textAlign: 'center', color: '#64748B' }}>
              <Loader2 size={26} className="animate-spin" style={{ margin: '0 auto 12px auto', color: '#2563EB' }} />
              <div style={{ fontSize: 14, fontWeight: 600 }}>Loading examination repositories...</div>
            </div>
          ) : filteredExams.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center', color: '#64748B' }}>
              <BookOpen size={36} style={{ margin: '0 auto 12px auto', color: '#94A3B8' }} />
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>No examination papers found</div>
              <p style={{ fontSize: 13, marginTop: 4 }}>Try changing search query or filter criteria.</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#FAFAFA', borderBottom: '1px solid #E2E8F0' }}>
                  <th style={{ padding: '12px 20px', fontSize: 12, fontWeight: 600, color: '#64748B', letterSpacing: '0.04em' }}>EXAM TITLE & CODE</th>
                  <th style={{ padding: '12px 16px', fontSize: 12, fontWeight: 600, color: '#64748B', letterSpacing: '0.04em' }}>STAGE / YEAR</th>
                  <th style={{ padding: '12px 16px', fontSize: 12, fontWeight: 600, color: '#64748B', letterSpacing: '0.04em' }}>SET / EXTRACTED QS</th>
                  <th style={{ padding: '12px 16px', fontSize: 12, fontWeight: 600, color: '#64748B', letterSpacing: '0.04em' }}>STATUS</th>
                  <th style={{ padding: '12px 20px', fontSize: 12, fontWeight: 600, color: '#64748B', letterSpacing: '0.04em', textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredExams.map((exam) => {
                  const isPublished = exam.status.toUpperCase().includes('PUBLISHED');
                  return (
                    <tr
                      key={exam.id}
                      style={{ borderBottom: '1px solid #E2E8F0', transition: 'background-color 150ms ease-out' }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F8FAFC')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
                    >
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: '#0F172A' }}>{exam.name}</div>
                        <div style={{ fontSize: 12, color: '#64748B', fontFamily: 'monospace', marginTop: 2 }}>{exam.code}</div>
                      </td>
                      <td style={{ padding: '16px 16px', fontSize: 13, color: '#334155' }}>
                        <div style={{ textTransform: 'capitalize', fontWeight: 600 }}>{exam.stage || 'Prelims'}</div>
                        <div style={{ fontSize: 12, color: '#64748B' }}>{exam.source_year || '2024'}</div>
                      </td>
                      <td style={{ padding: '16px 16px', fontSize: 13 }}>
                        <span style={{ fontWeight: 600, color: '#0F172A' }}>Set {exam.paper_set_code || 'A'}</span>
                        <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                          {exam.extracted_questions_count || 0} / {exam.total_questions || 100} extracted
                        </div>
                      </td>
                      <td style={{ padding: '16px 16px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '3px 10px',
                            borderRadius: 12,
                            fontSize: 12,
                            fontWeight: 600,
                            backgroundColor: isPublished ? '#DCFCE7' : '#FEF3C7',
                            color: isPublished ? '#15803D' : '#B45309',
                            border: `1px solid ${isPublished ? '#86EFAC' : '#FDE68A'}`,
                          }}
                        >
                          <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: isPublished ? '#16A34A' : '#D97706' }} />
                          {isPublished ? 'Published to S3' : 'Pending QA Review'}
                        </span>
                      </td>
                      <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                        <button
                          onClick={() => {
                            setSelectedExam(exam);
                          }}
                          style={{
                            padding: '7px 15px',
                            backgroundColor: '#2563EB',
                            color: '#FFFFFF',
                            borderRadius: 6,
                            border: 'none',
                            fontSize: 12.5,
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            boxShadow: '0 1px 3px rgba(37, 99, 235, 0.25)',
                          }}
                        >
                          <Eye size={14} />
                          Review Questions
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 2: Dedicated Split-Pane Question QA Review Workspace
  // -------------------------------------------------------------
  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', fontFamily: 'Inter, sans-serif', paddingBottom: 60 }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: 24,
            right: 24,
            zIndex: 9999,
            padding: '12px 20px',
            borderRadius: 8,
            fontSize: 13.5,
            fontWeight: 600,
            backgroundColor: toastMessage.type === 'success' ? '#15803D' : toastMessage.type === 'error' ? '#DC2626' : '#D97706',
            color: '#FFFFFF',
            boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {toastMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Top Header & Exam Status Workspace Banner */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 14,
          border: '1px solid #E2E8F0',
          padding: '20px 24px',
          marginBottom: 20,
          boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button
              onClick={handleBackToExamsList}
              style={{
                padding: '8px 14px',
                backgroundColor: '#FFFFFF',
                border: '1px solid #CBD5E1',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                color: '#334155',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
              }}
            >
              <ArrowLeft size={14} />
              All Exams
            </button>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0F172A', margin: 0, letterSpacing: '-0.015em' }}>
                  {selectedExam.name}
                </h1>
                <span
                  style={{
                    padding: '3px 9px',
                    borderRadius: 6,
                    fontSize: 11.5,
                    fontWeight: 700,
                    backgroundColor: '#EFF6FF',
                    color: '#2563EB',
                    border: '1px solid #BFDBFE',
                  }}
                >
                  Set {selectedExam.paper_set_code || 'A'}
                </span>
                <span
                  style={{
                    padding: '3px 9px',
                    borderRadius: 6,
                    fontSize: 11.5,
                    fontWeight: 600,
                    backgroundColor: '#F1F5F9',
                    color: '#475569',
                  }}
                >
                  {selectedExam.stage ? selectedExam.stage.toUpperCase() : 'PRELIMS'}
                </span>
                <span
                  style={{
                    padding: '3px 9px',
                    borderRadius: 6,
                    fontSize: 11.5,
                    fontWeight: 600,
                    backgroundColor: '#F1F5F9',
                    color: '#475569',
                  }}
                >
                  {selectedExam.source_year || '2024'}
                </span>
              </div>
              <div style={{ fontSize: 12, color: '#64748B', marginTop: 4, fontFamily: 'monospace' }}>
                Code: {selectedExam.code}
              </div>
            </div>
          </div>

          {/* S3 Publish Action Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {s3PublishStatus.is_published ? (
              <button
                disabled={true}
                style={{
                  padding: '9px 18px',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'default',
                  backgroundColor: '#DCFCE7',
                  color: '#15803D',
                  border: '1px solid #86EFAC',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <CheckCircle2 size={16} color="#16A34A" />
                Published to S3 (Live)
              </button>
            ) : s3PublishStatus.is_corrupted ? (
              <button
                disabled={true}
                style={{
                  padding: '9px 18px',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'not-allowed',
                  backgroundColor: '#FEE2E2',
                  color: '#991B1B',
                  border: '1px solid #FCA5A5',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                }}
                title="Database record contains corrupted question data. Please repair data before publishing."
              >
                <ShieldAlert size={16} color="#DC2626" />
                Database Corrupted
              </button>
            ) : s3PublishStatus.can_retry ? (
              <button
                onClick={confirmPublishExam}
                disabled={publishingExam}
                style={{
                  padding: '9px 18px',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: '#D97706',
                  color: '#FFFFFF',
                  border: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: '0 2px 6px rgba(217, 119, 6, 0.35)',
                }}
              >
                {publishingExam ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={15} />}
                Retry Publish to S3
              </button>
            ) : reviewMetrics.canPublish ? (
              <button
                onClick={handlePublishExamToS3}
                disabled={publishingExam}
                style={{
                  padding: '9px 18px',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: '#059669',
                  color: '#FFFFFF',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: '0 2px 8px rgba(5, 150, 105, 0.35)',
                }}
                title="All questions reviewed! Click to publish to S3"
              >
                {publishingExam ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Unlock size={15} />
                )}
                Approve & Publish Package to S3
              </button>
            ) : (
              <button
                disabled={true}
                style={{
                  padding: '9px 18px',
                  border: '1px solid #CBD5E1',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'not-allowed',
                  backgroundColor: '#F1F5F9',
                  color: '#94A3B8',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                }}
                title={`${reviewMetrics.pending} questions are pending review.`}
              >
                <Lock size={15} color="#94A3B8" />
                Publish Locked ({reviewMetrics.pending} Pending Review)
              </button>
            )}
          </div>
        </div>

        {/* Dedicated S3 Pipeline Status Banner (In-Progress vs Out-of-Sync vs In-Sync vs Failed) */}
        {s3PublishStatus.is_syncing && (
          <div style={{ marginTop: 14, padding: '14px 18px', borderRadius: 8, backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ position: 'relative', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <RefreshCw size={22} color="#2563EB" className="animate-spin" />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1D4ED8', display: 'flex', alignItems: 'center', gap: 8 }}>
                  ⚡ S3 Synchronization In Progress
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10, backgroundColor: '#DBEAFE', color: '#1E40AF' }}>
                    {s3PublishStatus.sync_progress ? `${Math.round(s3PublishStatus.sync_progress)}%` : 'RUNNING'}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#1E40AF', marginTop: 2 }}>
                  {s3PublishStatus.sync_step || 'Building questions and solutions JSON files and syncing to AWS S3...'}. You can safely continue working or navigate away.
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={() => selectedExam && checkSyncStatusOnce(selectedExam.id)}
                style={{
                  padding: '7px 12px',
                  borderRadius: 6,
                  backgroundColor: '#FFFFFF',
                  color: '#1D4ED8',
                  border: '1px solid #BFDBFE',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                }}
                title="Check sync status immediately without waiting for the next polling cycle"
              >
                <RefreshCw size={12} />
                Check Status
              </button>
              <button
                disabled={true}
                style={{
                  padding: '7px 14px',
                  borderRadius: 6,
                  backgroundColor: '#93C5FD',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: 'not-allowed',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Loader2 size={14} className="animate-spin" />
                Syncing in Background...
              </button>
            </div>
          </div>
        )}

        {!s3PublishStatus.is_syncing && s3PublishStatus.is_published && s3PublishStatus.is_s3_out_of_sync && (
          <div style={{ marginTop: 14, padding: '12px 16px', borderRadius: 8, backgroundColor: '#FFFBEB', border: '1px solid #FCD34D', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <AlertTriangle size={20} color="#D97706" />
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: '#B45309' }}>
                  Changes Pending S3 Sync
                </div>
                <div style={{ fontSize: 12, color: '#92400E', marginTop: 2 }}>
                  Questions/solutions were modified after the last S3 deployment {s3PublishStatus.last_synced_at ? `(${new Date(s3PublishStatus.last_synced_at).toLocaleString()})` : ''}. Sync master files to update consolidated JSON in S3.
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={() => handleSyncExamToS3(false)}
                disabled={syncingExam}
                style={{
                  padding: '7px 14px',
                  borderRadius: 6,
                  backgroundColor: '#D97706',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: syncingExam ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  boxShadow: '0 1px 3px rgba(217, 119, 6, 0.3)',
                }}
                title="Updates only the 2 consolidated master JSON files (Fast)"
              >
                <RefreshCw size={13} className={syncingExam ? 'animate-spin' : ''} />
                {syncingExam ? 'Syncing...' : '⚡ Sync Master JSON (Fast)'}
              </button>

              <button
                onClick={() => handleSyncExamToS3(true)}
                disabled={syncingExam}
                style={{
                  padding: '7px 12px',
                  borderRadius: 6,
                  backgroundColor: '#FFFFFF',
                  color: '#B45309',
                  border: '1px solid #FCD34D',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: syncingExam ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                }}
                title="Re-uploads all individual question files along with master JSON"
              >
                <Layers size={13} />
                Full S3 Sync
              </button>
            </div>
          </div>
        )}

        {!s3PublishStatus.is_syncing && s3PublishStatus.is_published && !s3PublishStatus.is_s3_out_of_sync && (
          <div style={{ marginTop: 14, padding: '12px 16px', borderRadius: 8, backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <CheckCircle2 size={20} color="#16A34A" />
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: '#15803D' }}>
                  Exam Artifacts In Sync with S3
                </div>
                <div style={{ fontSize: 12, color: '#166534', marginTop: 2 }}>
                  All questions verified & deployed. Last synced: {s3PublishStatus.last_synced_at ? new Date(s3PublishStatus.last_synced_at).toLocaleString() : 'Recently'}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={() => handleSyncExamToS3(false)}
                disabled={syncingExam}
                style={{
                  padding: '5px 10px',
                  borderRadius: 6,
                  backgroundColor: '#FFFFFF',
                  color: '#15803D',
                  border: '1px solid #86EFAC',
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: syncingExam ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                }}
                title="Force re-sync master files to S3"
              >
                <RefreshCw size={12} className={syncingExam ? 'animate-spin' : ''} />
                {syncingExam ? 'Syncing...' : 'Re-Sync Master'}
              </button>

              <button
                onClick={() => handleSyncExamToS3(true)}
                disabled={syncingExam}
                style={{
                  padding: '5px 10px',
                  borderRadius: 6,
                  backgroundColor: '#FFFFFF',
                  color: '#166534',
                  border: '1px solid #BBF7D0',
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: syncingExam ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                }}
                title="Full sync of all individual questions + master JSON"
              >
                <Layers size={12} />
                Full Sync
              </button>

              <span style={{ fontSize: 11.5, fontWeight: 700, padding: '3px 9px', borderRadius: 12, backgroundColor: '#DCFCE7', color: '#15803D', border: '1px solid #86EFAC' }}>
                LIVE IN CATALOG
              </span>
            </div>
          </div>
        )}

        {s3PublishStatus.publish_status === 'PUBLISH_FAILED' && s3PublishStatus.can_retry && (
          <div style={{ marginTop: 14, padding: '12px 16px', borderRadius: 8, backgroundColor: '#FFFBEB', border: '1px solid #FCD34D', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <AlertTriangle size={20} color="#D97706" />
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: '#B45309' }}>
                  S3 Publishing Task Interrupted (Fixable via Retry)
                </div>
                <div style={{ fontSize: 12, color: '#92400E', marginTop: 2 }}>
                  {s3PublishStatus.publish_error || 'Network timeout or transient storage communication error occurred.'}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => selectedExam && loadExamQuestions(selectedExam.id, questionStatusFilter, currentPage, selectedQuestionIndex)}
                disabled={loadingQuestions}
                style={{
                  padding: '7px 12px',
                  borderRadius: 6,
                  backgroundColor: '#FFFFFF',
                  color: '#B45309',
                  border: '1px solid #FCD34D',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
                title="Re-check database integrity and S3 publish status"
              >
                <RefreshCw size={13} className={loadingQuestions ? 'animate-spin' : ''} />
                Re-evaluate Status
              </button>
              <button
                onClick={confirmPublishExam}
                disabled={publishingExam}
                style={{
                  padding: '7px 14px',
                  borderRadius: 6,
                  backgroundColor: '#D97706',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  boxShadow: '0 1px 3px rgba(217, 119, 6, 0.3)',
                }}
              >
                {publishingExam ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                Retry Publish
              </button>
            </div>
          </div>
        )}

        {s3PublishStatus.is_corrupted && (
          <div style={{ marginTop: 14, padding: '12px 16px', borderRadius: 8, backgroundColor: '#FEF2F2', border: '1px solid #FECACA', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <ShieldAlert size={20} color="#DC2626" />
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: '#B91C1C' }}>
                  Database Record Corrupted
                </div>
                <div style={{ fontSize: 12, color: '#991B1B', marginTop: 2 }}>
                  {s3PublishStatus.corruption_reason || s3PublishStatus.publish_error || 'Critical question statement or answer option records are missing in database.'} Edit the question in the editor below to repair data, then click Re-evaluate.
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => selectedExam && loadExamQuestions(selectedExam.id, questionStatusFilter, currentPage, selectedQuestionIndex)}
                disabled={loadingQuestions}
                style={{
                  padding: '7px 14px',
                  borderRadius: 6,
                  backgroundColor: '#FFFFFF',
                  color: '#B91C1C',
                  border: '1px solid #FCA5A5',
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  boxShadow: '0 1px 2px rgba(185, 28, 28, 0.1)',
                }}
                title="Re-check database records and clear corruption status if resolved"
              >
                <RefreshCw size={13} className={loadingQuestions ? 'animate-spin' : ''} />
                Re-evaluate Integrity
              </button>
              <span style={{ fontSize: 11.5, fontWeight: 700, padding: '3px 9px', borderRadius: 12, backgroundColor: '#FEE2E2', color: '#B91C1C', border: '1px solid #FCA5A5' }}>
                CORRUPTED DATA
              </span>
            </div>
          </div>
        )}

        {/* Verification Progress Bar & Metrics */}
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #E2E8F0' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
              Verification Progress: {reviewMetrics.reviewed} / {reviewMetrics.total} Verified ({reviewMetrics.total > 0 ? Math.round((reviewMetrics.reviewed / reviewMetrics.total) * 100) : 0}%)
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 12, backgroundColor: '#FEF3C7', color: '#B45309', border: '1px solid #FDE68A' }}>
                ⏳ {reviewMetrics.pending} Pending Review
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 12, backgroundColor: '#DCFCE7', color: '#15803D', border: '1px solid #86EFAC' }}>
                ✅ {reviewMetrics.reviewed} Verified
              </span>
              {reviewMetrics.rejected > 0 && (
                <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 12, backgroundColor: '#FEF2F2', color: '#B42318', border: '1px solid #FECDCA' }}>
                  ❌ {reviewMetrics.rejected} Rejected
                </span>
              )}
            </div>
          </div>

          <div style={{ width: '100%', height: 6, backgroundColor: '#E2E8F0', borderRadius: 3, overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                backgroundColor: reviewMetrics.canPublish ? '#16A34A' : '#2563EB',
                width: `${reviewMetrics.total > 0 ? (reviewMetrics.reviewed / reviewMetrics.total) * 100 : 0}%`,
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>
      </div>

      {/* Main Split-Pane Workspace */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '330px 1fr', gap: 20 }}>
        {/* LEFT COLUMN: Question Navigator */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 14,
            border: '1px solid #E2E8F0',
            display: 'flex',
            flexDirection: 'column',
            height: 'calc(100vh - 270px)',
            minHeight: 550,
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
          }}
        >
          {/* Navigator Header */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #E2E8F0', backgroundColor: '#FAFAFA' }}>
            <div style={{ display: 'flex', gap: 4, backgroundColor: '#F1F5F9', padding: 3, borderRadius: 8 }}>
              {[
                { id: 'ALL', label: `All (${reviewMetrics.total})` },
                { id: 'PENDING', label: `Pending (${reviewMetrics.pending})` },
                { id: 'PUBLISHED', label: `Approved (${reviewMetrics.reviewed})` },
              ].map((tab) => {
                const isActive = questionStatusFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleStatusFilterChange(tab.id)}
                    style={{
                      flex: 1,
                      padding: '6px 4px',
                      fontSize: 11.5,
                      fontWeight: isActive ? 700 : 500,
                      border: 'none',
                      borderRadius: 6,
                      cursor: 'pointer',
                      backgroundColor: isActive ? '#FFFFFF' : 'transparent',
                      color: isActive ? '#0F172A' : '#64748B',
                      boxShadow: isActive ? '0 1px 2px rgba(15, 23, 42, 0.08)' : 'none',
                      transition: 'all 150ms ease-out',
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Question Search */}
            <div style={{ position: 'relative', marginTop: 10 }}>
              <Search size={14} color="#64748B" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Filter by text or Q#..."
                value={questionSearchQuery}
                onChange={(e) => setQuestionSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 10px 7px 30px',
                  fontSize: 12.5,
                  borderRadius: 6,
                  border: '1px solid #CBD5E1',
                  outline: 'none',
                  color: '#0F172A',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* Question Navigator Rows */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
            {loadingQuestions ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>
                <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px auto', color: '#2563EB' }} />
                <div style={{ fontSize: 13, fontWeight: 600 }}>Loading questions...</div>
              </div>
            ) : filteredQuestions.length === 0 ? (
              <div style={{ padding: 30, textAlign: 'center', color: '#64748B', fontSize: 13 }}>
                No questions found matching criteria.
              </div>
            ) : (
              filteredQuestions.map((q, idx) => {
                const isSelected = activeQuestion && activeQuestion.id === q.id;
                const isPublished = q.status === 'PUBLISHED';
                const isRejected = q.status === 'REJECTED';

                return (
                  <div
                    key={q.id}
                    onClick={() => handleSelectQuestion(idx)}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 10,
                      marginBottom: 8,
                      cursor: 'pointer',
                      border: isSelected ? '1px solid #BFDBFE' : '1px solid #E2E8F0',
                      borderLeft: isSelected ? '3px solid #2563EB' : '1px solid #E2E8F0',
                      backgroundColor: isSelected ? '#EFF6FF' : '#FFFFFF',
                      boxShadow: isSelected ? '0 1px 3px rgba(37, 99, 235, 0.08)' : 'none',
                      transition: 'all 150ms ease-out',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 800,
                          color: isSelected ? '#2563EB' : '#0F172A',
                          backgroundColor: isSelected ? '#DBEAFE' : '#F1F5F9',
                          padding: '2px 7px',
                          borderRadius: 4,
                        }}
                      >
                        Q{q.question_number_in_paper}
                      </span>

                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '2px 7px',
                          borderRadius: 10,
                          backgroundColor: isPublished ? '#DCFCE7' : isRejected ? '#FEF2F2' : '#FEF3C7',
                          color: isPublished ? '#15803D' : isRejected ? '#B42318' : '#B45309',
                          border: `1px solid ${isPublished ? '#86EFAC' : isRejected ? '#FECDCA' : '#FDE68A'}`,
                        }}
                      >
                        {isPublished ? 'Verified' : isRejected ? 'Rejected' : 'Pending'}
                      </span>
                    </div>

                    <div
                      style={{
                        fontSize: 12.5,
                        color: isSelected ? '#0F172A' : '#475569',
                        fontWeight: isSelected ? 600 : 400,
                        lineHeight: 1.4,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {q.question_text || 'No question text extracted.'}
                    </div>

                    {q.subject_name && (
                      <div style={{ fontSize: 11, color: '#64748B', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Tag size={10} color="#2563EB" />
                        <span>{q.subject_name} {q.topic_name ? `› ${q.topic_name}` : ''}</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination Toolbar Footer in Left Column */}
          <div
            style={{
              padding: '10px 12px',
              borderTop: '1px solid #E2E8F0',
              backgroundColor: '#F8FAFC',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: '#475569', fontWeight: 600 }}>
              <span>
                Page {currentPage} of {totalPages}
              </span>
              <span style={{ fontSize: 11, color: '#64748B' }}>
                {(() => {
                  const filterCount =
                    questionStatusFilter === 'PENDING'
                      ? reviewMetrics.pending
                      : questionStatusFilter === 'PUBLISHED'
                      ? reviewMetrics.reviewed
                      : questionStatusFilter === 'REJECTED'
                      ? reviewMetrics.rejected
                      : reviewMetrics.total;
                  if (filterCount === 0) return '0 questions';
                  const startItem = (currentPage - 1) * pageSize + 1;
                  const endItem = Math.min(currentPage * pageSize, filterCount);
                  return `Questions ${startItem}–${endItem} of ${filterCount}`;
                })()}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <button
                  onClick={() => handlePageChange(1)}
                  disabled={currentPage === 1 || loadingQuestions}
                  style={{
                    padding: '5px 7px',
                    borderRadius: 5,
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    color: currentPage === 1 || loadingQuestions ? '#CBD5E1' : '#334155',
                    cursor: currentPage === 1 || loadingQuestions ? 'not-allowed' : 'pointer',
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                  title="First Page"
                >
                  «
                </button>
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1 || loadingQuestions}
                  style={{
                    padding: '5px 8px',
                    borderRadius: 5,
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    color: currentPage === 1 || loadingQuestions ? '#CBD5E1' : '#334155',
                    cursor: currentPage === 1 || loadingQuestions ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 2,
                    fontSize: 11.5,
                    fontWeight: 600,
                  }}
                >
                  <ChevronLeft size={13} />
                  Prev
                </button>
              </div>

              {/* Page Numbers */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .map((p, idx, arr) => {
                    const prevP = arr[idx - 1];
                    const hasGap = prevP && p - prevP > 1;
                    const isCur = p === currentPage;
                    return (
                      <React.Fragment key={p}>
                        {hasGap && <span style={{ fontSize: 10, color: '#94A3B8', padding: '0 1px' }}>…</span>}
                        <button
                          onClick={() => handlePageChange(p)}
                          disabled={loadingQuestions}
                          style={{
                            minWidth: 22,
                            height: 22,
                            padding: '0 3px',
                            borderRadius: 4,
                            border: isCur ? '1px solid #2563EB' : '1px solid #E2E8F0',
                            backgroundColor: isCur ? '#2563EB' : '#FFFFFF',
                            color: isCur ? '#FFFFFF' : '#475569',
                            fontSize: 11,
                            fontWeight: isCur ? 700 : 500,
                            cursor: 'pointer',
                          }}
                        >
                          {p}
                        </button>
                      </React.Fragment>
                    );
                  })}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages || loadingQuestions}
                  style={{
                    padding: '5px 8px',
                    borderRadius: 5,
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    color: currentPage === totalPages || loadingQuestions ? '#CBD5E1' : '#334155',
                    cursor: currentPage === totalPages || loadingQuestions ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 2,
                    fontSize: 11.5,
                    fontWeight: 600,
                  }}
                >
                  Next
                  <ChevronRight size={13} />
                </button>
                <button
                  onClick={() => handlePageChange(totalPages)}
                  disabled={currentPage === totalPages || loadingQuestions}
                  style={{
                    padding: '5px 7px',
                    borderRadius: 5,
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    color: currentPage === totalPages || loadingQuestions ? '#CBD5E1' : '#334155',
                    cursor: currentPage === totalPages || loadingQuestions ? 'not-allowed' : 'pointer',
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                  title="Last Page"
                >
                  »
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Question Review Canvas */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 14,
            border: '1px solid #E2E8F0',
            display: 'flex',
            flexDirection: 'column',
            height: 'calc(100vh - 270px)',
            minHeight: 550,
            overflowY: 'auto',
            padding: 28,
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
          }}
        >
          {activeQuestion ? (
            <div>
              {/* Question Action Toolbar Header */}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  paddingBottom: 18,
                  borderBottom: '1px solid #E2E8F0',
                  marginBottom: 22,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0F172A', margin: 0, letterSpacing: '-0.01em' }}>
                    Question #{activeQuestion.question_number_in_paper}
                  </h2>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      padding: '3px 10px',
                      borderRadius: 12,
                      backgroundColor:
                        activeQuestion.status === 'PUBLISHED'
                          ? '#DCFCE7'
                          : activeQuestion.status === 'REJECTED'
                          ? '#FEF2F2'
                          : '#FEF3C7',
                      color:
                        activeQuestion.status === 'PUBLISHED'
                          ? '#15803D'
                          : activeQuestion.status === 'REJECTED'
                          ? '#B42318'
                          : '#B45309',
                      border: `1px solid ${
                        activeQuestion.status === 'PUBLISHED'
                          ? '#86EFAC'
                          : activeQuestion.status === 'REJECTED'
                          ? '#FECDCA'
                          : '#FDE68A'
                      }`,
                    }}
                  >
                    {activeQuestion.status === 'PUBLISHED'
                      ? '● Verified & Approved'
                      : activeQuestion.status === 'REJECTED'
                      ? '● Rejected'
                      : '● Pending QA Review'}
                  </span>
                </div>

                {/* Primary, Secondary & Destructive Action Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    onClick={() => handleOpenEditModal(activeQuestion)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 6,
                      fontSize: 13,
                      fontWeight: 600,
                      border: '1px solid #CBD5E1',
                      backgroundColor: '#FFFFFF',
                      color: '#0F172A',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
                    }}
                  >
                    <Edit3 size={14} color="#2563EB" />
                    Modify Question & Solutions
                  </button>

                  <button
                    onClick={() => handleRejectQuestion(activeQuestion)}
                    disabled={actionLoadingId === activeQuestion.id}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 6,
                      fontSize: 13,
                      fontWeight: 600,
                      border: '1px solid #FECDCA',
                      backgroundColor: '#FEF2F2',
                      color: '#B42318',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <ThumbsDown size={14} />
                    Reject
                  </button>

                  <button
                    onClick={() => handleQuickApproveQuestion(activeQuestion)}
                    disabled={actionLoadingId === activeQuestion.id || activeQuestion.status === 'PUBLISHED'}
                    style={{
                      padding: '8px 18px',
                      borderRadius: 6,
                      fontSize: 13,
                      fontWeight: 600,
                      border: 'none',
                      backgroundColor: activeQuestion.status === 'PUBLISHED' ? '#F1F5F9' : '#16A34A',
                      color: activeQuestion.status === 'PUBLISHED' ? '#64748B' : '#FFFFFF',
                      cursor: activeQuestion.status === 'PUBLISHED' ? 'default' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      boxShadow: activeQuestion.status === 'PUBLISHED' ? 'none' : '0 2px 6px rgba(22, 163, 74, 0.25)',
                    }}
                  >
                    {actionLoadingId === activeQuestion.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Check size={15} />
                    )}
                    {activeQuestion.status === 'PUBLISHED' ? 'Verified' : 'Approve & Publish'}
                  </button>
                </div>
              </div>

              {/* Taxonomy & Metadata Details Bar */}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 12,
                  backgroundColor: '#FAFAFA',
                  padding: '12px 18px',
                  borderRadius: 10,
                  marginBottom: 16,
                  fontSize: 12.5,
                  border: '1px solid #E2E8F0',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#0F172A', fontWeight: 600 }}>
                  <FolderTree size={15} color="#2563EB" />
                  <span>Subject:</span>
                  <span style={{ color: '#2563EB' }}>{activeQuestion.subject_name || 'General Studies'}</span>
                </div>

                {activeQuestion.topic_name && (
                  <>
                    <span style={{ color: '#CBD5E1' }}>›</span>
                    <span style={{ fontWeight: 600, color: '#475569' }}>{activeQuestion.topic_name}</span>
                  </>
                )}

                {activeQuestion.subtopic_name && (
                  <>
                    <span style={{ color: '#CBD5E1' }}>›</span>
                    <span style={{ fontWeight: 600, color: '#64748B' }}>{activeQuestion.subtopic_name}</span>
                  </>
                )}

                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14, color: '#64748B' }}>
                  <span>Difficulty: <strong style={{ color: '#0F172A' }}>{activeQuestion.difficulty}</strong></span>
                  <span>Marks: <strong style={{ color: '#0F172A' }}>+{activeQuestion.marks} / -{activeQuestion.negative_marks || 0.66}</strong></span>
                  <span>Time: <strong style={{ color: '#0F172A' }}>{activeQuestion.expected_time_seconds || 60}s</strong></span>
                </div>
              </div>

              {/* Authoritative Taxonomy & Interdisciplinary Concepts with Relevance Percentage */}
              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 10,
                  padding: '14px 18px',
                  marginBottom: 24,
                  border: '1px solid #E2E8F0',
                  boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FolderTree size={16} color="#2563EB" />
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
                      Syllabus Hierarchy & Concept Relevance Mappings
                    </span>
                    <span
                      style={{
                        padding: '2px 8px',
                        backgroundColor: '#EFF6FF',
                        color: '#2563EB',
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      {activeQuestion.hierarchy && activeQuestion.hierarchy.length > 0
                        ? `${activeQuestion.hierarchy.length} Concepts`
                        : '1 Primary'}
                    </span>
                  </div>

                  <button
                    onClick={() => handleOpenEditModal(activeQuestion)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '5px 10px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#2563EB',
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #CBD5E1',
                      cursor: 'pointer',
                    }}
                  >
                    <Sliders size={13} />
                    Update Taxonomy & Relevance
                  </button>
                </div>

                {/* Concept Cards Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                  {(activeQuestion.hierarchy && activeQuestion.hierarchy.length > 0
                    ? activeQuestion.hierarchy
                    : [
                        {
                          subject_name: activeQuestion.subject_name || 'General Studies',
                          topic_name: activeQuestion.topic_name || 'General Concepts',
                          subtopic_name: activeQuestion.subtopic_name || '',
                          is_primary: true,
                          relevance_percentage: 100,
                          relevance_weight: 1.0,
                          concept_name: activeQuestion.topic_name || 'Primary Syllabus Concept',
                        },
                      ]
                  ).map((hItem, hIdx) => {
                    const pct =
                      hItem.relevance_percentage !== undefined
                        ? hItem.relevance_percentage
                        : hItem.relevance_weight !== undefined
                        ? Math.round(hItem.relevance_weight * 100)
                        : 100;
                    const isPrim = Boolean(hItem.is_primary) || hIdx === 0;
                    const badgeColor = pct >= 80 ? '#10B981' : pct >= 50 ? '#3B82F6' : '#F59E0B';
                    const badgeBg = pct >= 80 ? '#ECFDF5' : pct >= 50 ? '#EFF6FF' : '#FFFBEB';
                    const badgeBorder = pct >= 80 ? '#A7F3D0' : pct >= 50 ? '#BFDBFE' : '#FDE68A';

                    return (
                      <div
                        key={hIdx}
                        style={{
                          backgroundColor: isPrim ? '#FAFCFF' : '#FAFAFA',
                          border: isPrim ? '1.5px solid #93C5FD' : '1px solid #E2E8F0',
                          borderRadius: 8,
                          padding: '12px 14px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {isPrim ? (
                              <Sparkles size={14} color="#2563EB" />
                            ) : (
                              <GitBranch size={14} color="#64748B" />
                            )}
                            <span style={{ fontSize: 12.5, fontWeight: 700, color: isPrim ? '#1E40AF' : '#334155' }}>
                              {hItem.concept_name || hItem.topic_name || 'Taxonomy Mapping'}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                padding: '2px 6px',
                                borderRadius: 4,
                                backgroundColor: isPrim ? '#DBEAFE' : '#F1F5F9',
                                color: isPrim ? '#1E40AF' : '#475569',
                              }}
                            >
                              {isPrim ? 'PRIMARY' : 'INTERDISCIPLINARY'}
                            </span>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 800,
                                padding: '2px 7px',
                                borderRadius: 10,
                                backgroundColor: badgeBg,
                                color: badgeColor,
                                border: `1px solid ${badgeBorder}`,
                              }}
                            >
                              {pct}%
                            </span>
                          </div>
                        </div>

                        {/* Breadcrumbs */}
                        <div style={{ fontSize: 12, color: '#475569', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                          <span style={{ fontWeight: 600, color: '#0F172A' }}>{hItem.subject_name || 'General Studies'}</span>
                          <span style={{ color: '#94A3B8' }}>›</span>
                          <span style={{ fontWeight: 600, color: '#2563EB' }}>{hItem.topic_name || 'General Concepts'}</span>
                          {hItem.subtopic_name && (
                            <>
                              <span style={{ color: '#94A3B8' }}>›</span>
                              <span style={{ fontWeight: 500, color: '#64748B' }}>{hItem.subtopic_name}</span>
                            </>
                          )}
                        </div>

                        {/* Relevance Bar */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                          <div style={{ flex: 1, height: 6, backgroundColor: '#E2E8F0', borderRadius: 3, overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${pct}%`,
                                height: '100%',
                                backgroundColor: badgeColor,
                                borderRadius: 3,
                                transition: 'width 300ms ease-out',
                              }}
                            />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B' }}>
                            {pct}% Relevance
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Passage Box (If Reading Comprehension passage exists) */}
              {activeQuestion.passage_text && (
                <div
                  style={{
                    backgroundColor: '#F8FAFC',
                    borderRadius: 10,
                    padding: '18px 22px',
                    marginBottom: 24,
                    border: '1px solid #E2E8F0',
                    borderLeft: '4px solid #2563EB',
                  }}
                >
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: '#2563EB', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                    PASSAGE / REFERENCE CONTEXT
                  </div>
                  <div style={{ fontSize: 14.5, color: '#334155', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                    {activeQuestion.passage_text}
                  </div>
                </div>
              )}

              {/* Authoritative Question Text Container */}
              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 10,
                  padding: '22px 24px',
                  border: '1px solid #E2E8F0',
                  marginBottom: 28,
                  boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)',
                }}
              >
                <div style={{ fontSize: 17, fontWeight: 600, color: '#0F172A', lineHeight: 1.65, whiteSpace: 'pre-wrap', letterSpacing: '-0.01em' }}>
                  {activeQuestion.question_text}
                </div>
              </div>

              {/* Options & Distractor Analysis Section */}
              <div style={{ marginBottom: 32 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Layers size={17} color="#2563EB" />
                  <span>Options & Option Explanations (Distractor Analysis)</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }}>
                  {activeQuestion.options.map((opt) => (
                    <div
                      key={opt.option_label}
                      style={{
                        borderRadius: 10,
                        border: opt.is_correct ? '1.5px solid #16A34A' : '1px solid #E2E8F0',
                        borderLeft: opt.is_correct ? '4px solid #16A34A' : '1px solid #E2E8F0',
                        backgroundColor: opt.is_correct ? '#F0FDF4' : '#FFFFFF',
                        padding: '16px 20px',
                        transition: 'all 150ms ease-out',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                        <span
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: 13,
                            backgroundColor: opt.is_correct ? '#16A34A' : '#F1F5F9',
                            color: opt.is_correct ? '#FFFFFF' : '#475569',
                            flexShrink: 0,
                          }}
                        >
                          {opt.option_label}
                        </span>

                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 15, fontWeight: opt.is_correct ? 700 : 500, color: '#0F172A', lineHeight: 1.4 }}>
                            {opt.option_text || '(Empty Option Text)'}
                          </div>

                          {/* Distractor Explanation Academic Box */}
                          <div
                            style={{
                              marginTop: 10,
                              padding: '10px 14px',
                              borderRadius: 8,
                              fontSize: 13,
                              backgroundColor: opt.is_correct ? '#DCFCE7' : '#FAFAFA',
                              color: opt.is_correct ? '#14532D' : '#475569',
                              border: `1px solid ${opt.is_correct ? '#86EFAC' : '#E2E8F0'}`,
                              lineHeight: 1.5,
                            }}
                          >
                            <span style={{ fontWeight: 700 }}>
                              {opt.is_correct ? 'Why Option is Correct:' : 'Why Option is Incorrect (Distractor Analysis):'}{' '}
                            </span>
                            {opt.distractor_analysis || (
                              <span style={{ fontStyle: 'italic', color: '#94A3B8' }}>
                                No distractor explanation specified yet. Click &apos;Modify Question & Solutions&apos; to edit.
                              </span>
                            )}
                          </div>
                        </div>

                        {opt.is_correct && (
                          <span
                            style={{
                              fontSize: 11.5,
                              fontWeight: 700,
                              color: '#15803D',
                              backgroundColor: '#DCFCE7',
                              padding: '3px 10px',
                              borderRadius: 12,
                              border: '1px solid #86EFAC',
                              flexShrink: 0,
                            }}
                          >
                            ✓ Correct Answer
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 4 Solution Parameters Knowledge Base */}
              <div style={{ marginBottom: 32 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Sparkles size={17} color="#2563EB" />
                  <span>4-Parameter Solutions & Knowledge Base</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }}>
                  {/* 1. Core Concept */}
                  <div style={{ backgroundColor: '#FAFAFA', border: '1px solid #E2E8F0', borderRadius: 10, padding: '16px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#2563EB', marginBottom: 6 }}>
                      <Zap size={15} />
                      1. Core Concept
                    </div>
                    <div style={{ fontSize: 13.5, color: '#0F172A', lineHeight: 1.6 }}>
                      {activeQuestion.explanation?.core_concept || (
                        <span style={{ fontStyle: 'italic', color: '#94A3B8' }}>No core concept specified.</span>
                      )}
                    </div>
                  </div>

                  {/* 2. Step-by-Step Detailed Solution */}
                  <div style={{ backgroundColor: '#FAFAFA', border: '1px solid #E2E8F0', borderRadius: 10, padding: '16px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 6 }}>
                      <FileText size={15} color="#2563EB" />
                      2. Step-by-Step Detailed Solution
                    </div>
                    <div style={{ fontSize: 13.5, color: '#0F172A', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                      {activeQuestion.explanation?.detailed_solution || (
                        <span style={{ fontStyle: 'italic', color: '#94A3B8' }}>No detailed solution added.</span>
                      )}
                    </div>
                  </div>

                  {/* 3. Points to Remember / Common Traps */}
                  <div style={{ backgroundColor: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 10, padding: '16px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#B45309', marginBottom: 8 }}>
                      <AlertTriangle size={15} />
                      3. Points to Remember & Common Traps
                    </div>
                    {activeQuestion.explanation?.common_traps && activeQuestion.explanation.common_traps.length > 0 ? (
                      <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#92400E', lineHeight: 1.6 }}>
                        {activeQuestion.explanation.common_traps.map((trap, tIdx) => (
                          <li key={tIdx} style={{ marginBottom: 4 }}>
                            {trap}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div style={{ fontSize: 12.5, color: '#B45309', fontStyle: 'italic' }}>
                        No common traps or memory tips specified.
                      </div>
                    )}
                  </div>

                  {/* 4. Key Takeaways */}
                  <div style={{ backgroundColor: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 10, padding: '16px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#15803D', marginBottom: 8 }}>
                      <Award size={15} />
                      4. Key Takeaways
                    </div>
                    {activeQuestion.explanation?.key_takeaways && activeQuestion.explanation.key_takeaways.length > 0 ? (
                      <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#14532D', lineHeight: 1.6 }}>
                        {activeQuestion.explanation.key_takeaways.map((point, pIdx) => (
                          <li key={pIdx} style={{ marginBottom: 4 }}>
                            {point}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div style={{ fontSize: 12.5, color: '#15803D', fontStyle: 'italic' }}>
                        No key takeaways added.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom Pagination Controller */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: 18,
                  borderTop: '1px solid #E2E8F0',
                  gap: 12,
                }}
              >
                <button
                  onClick={handlePrevQuestionClick}
                  disabled={(selectedQuestionIndex === 0 && currentPage === 1) || loadingQuestions}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 600,
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    color: (selectedQuestionIndex === 0 && currentPage === 1) || loadingQuestions ? '#CBD5E1' : '#334155',
                    cursor: (selectedQuestionIndex === 0 && currentPage === 1) || loadingQuestions ? 'default' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <ChevronLeft size={16} />
                  {selectedQuestionIndex === 0 && currentPage > 1 ? `Previous (Page ${currentPage - 1})` : 'Previous Question'}
                </button>

                <div style={{ fontSize: 13, color: '#64748B', fontWeight: 600, textAlign: 'center' }}>
                  Question #{activeQuestion.question_number_in_paper} &nbsp;•&nbsp; ({selectedQuestionIndex + 1} of {filteredQuestions.length} on Page {currentPage}/{totalPages})
                </div>

                <button
                  onClick={handleNextQuestionClick}
                  disabled={(selectedQuestionIndex === filteredQuestions.length - 1 && currentPage === totalPages) || loadingQuestions}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 600,
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    color: (selectedQuestionIndex === filteredQuestions.length - 1 && currentPage === totalPages) || loadingQuestions ? '#CBD5E1' : '#334155',
                    cursor: (selectedQuestionIndex === filteredQuestions.length - 1 && currentPage === totalPages) || loadingQuestions ? 'default' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  {selectedQuestionIndex === filteredQuestions.length - 1 && currentPage < totalPages ? `Next (Page ${currentPage + 1})` : 'Next Question'}
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          ) : (
            <div style={{ padding: 60, textAlign: 'center', color: '#64748B' }}>
              <HelpCircle size={36} style={{ margin: '0 auto 12px auto', color: '#94A3B8' }} />
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>Select a question from the left sidebar</div>
            </div>
          )}
        </div>
      </div>

      {/* ============================================================= */}
      {/* MODAL 1: Full Question & 4-Parameter Solutions Editor */}
      {/* ============================================================= */}
      {editingQuestion && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 14,
              width: '100%',
              maxWidth: 920,
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 40px rgba(15, 23, 42, 0.2)',
              border: '1px solid #E2E8F0',
              overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid #E2E8F0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: '#FAFAFA',
              }}
            >
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', margin: 0 }}>
                  Modify Question #{editingQuestion.question_number_in_paper} & Solutions
                </h2>
                <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                  Update question text, passage, options, 4-parameter solutions, and curriculum hierarchy.
                </div>
              </div>
              <button
                onClick={() => setEditingQuestion(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
              {/* Question Text */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#0F172A', marginBottom: 6 }}>
                  Question Text:
                </label>
                <textarea
                  rows={4}
                  value={editQuestionText}
                  onChange={(e) => setEditQuestionText(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: 13.5,
                    borderRadius: 6,
                    border: '1px solid #CBD5E1',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              {/* Passage Text */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#0F172A', marginBottom: 6 }}>
                  Passage / Context (Optional):
                </label>
                <textarea
                  rows={3}
                  value={editPassageText}
                  onChange={(e) => setEditPassageText(e.target.value)}
                  placeholder="Paste or edit shared reading passage / context..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: 13,
                    borderRadius: 6,
                    border: '1px solid #CBD5E1',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              {/* Hierarchy & Interdisciplinary Concept Relevance Manager */}
              <div
                style={{
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #CBD5E1',
                  borderRadius: 10,
                  padding: '16px 18px',
                  marginBottom: 20,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <FolderTree size={16} color="#2563EB" />
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
                      Taxonomy Hierarchy & Concept Relevance Manager
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditHierarchyLinks((prev) => [
                        ...prev,
                        {
                          subject_name: editSubjectName || 'General Studies',
                          topic_name: '',
                          subtopic_name: '',
                          is_primary: prev.length === 0,
                          relevance_percentage: 75,
                          relevance_weight: 0.75,
                          concept_name: '',
                        },
                      ]);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '5px 10px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#2563EB',
                      backgroundColor: '#EFF6FF',
                      border: '1px solid #BFDBFE',
                      cursor: 'pointer',
                    }}
                  >
                    <Plus size={13} />
                    Add Concept Link
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {editHierarchyLinks.map((hLink, hIdx) => {
                    const pct = hLink.relevance_percentage !== undefined ? hLink.relevance_percentage : 100;
                    return (
                      <div
                        key={hIdx}
                        style={{
                          backgroundColor: '#FFFFFF',
                          border: hLink.is_primary ? '1.5px solid #2563EB' : '1px solid #E2E8F0',
                          borderRadius: 8,
                          padding: '14px 16px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: hLink.is_primary ? '#2563EB' : '#475569', cursor: 'pointer' }}>
                              <input
                                type="radio"
                                name="primaryHierarchyRadio"
                                checked={Boolean(hLink.is_primary)}
                                onChange={() => {
                                  setEditHierarchyLinks((prev) =>
                                    prev.map((item, i) => ({
                                      ...item,
                                      is_primary: i === hIdx,
                                    }))
                                  );
                                  if (hLink.subject_name) setEditSubjectName(hLink.subject_name);
                                  if (hLink.topic_name) setEditTopicName(hLink.topic_name);
                                  if (hLink.subtopic_name) setEditSubtopicName(hLink.subtopic_name);
                                }}
                              />
                              {hLink.is_primary ? '★ Primary Hierarchy' : 'Secondary / Interdisciplinary Concept'}
                            </label>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 800,
                                color: pct >= 80 ? '#16A34A' : pct >= 50 ? '#2563EB' : '#D97706',
                                backgroundColor: pct >= 80 ? '#F0FDF4' : pct >= 50 ? '#EFF6FF' : '#FFFBEB',
                                padding: '2px 8px',
                                borderRadius: 6,
                                border: `1px solid ${pct >= 80 ? '#BBF7D0' : pct >= 50 ? '#BFDBFE' : '#FDE68A'}`,
                              }}
                            >
                              {pct}% Relevance
                            </span>
                            {editHierarchyLinks.length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditHierarchyLinks((prev) => prev.filter((_, i) => i !== hIdx));
                                }}
                                style={{
                                  border: 'none',
                                  backgroundColor: 'transparent',
                                  color: '#EF4444',
                                  cursor: 'pointer',
                                  padding: 4,
                                }}
                                title="Remove Concept Link"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Input Row: Subject, Topic, Subtopic, Concept Name */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 10 }}>
                          <div>
                            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 3 }}>
                              Subject:
                            </label>
                            <input
                              type="text"
                              value={hLink.subject_name || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEditHierarchyLinks((prev) =>
                                  prev.map((item, i) => (i === hIdx ? { ...item, subject_name: val } : item))
                                );
                                if (hLink.is_primary) setEditSubjectName(val);
                              }}
                              placeholder="e.g. Economy"
                              style={{ width: '100%', padding: '7px 9px', fontSize: 12.5, borderRadius: 6, border: '1px solid #CBD5E1', boxSizing: 'border-box' }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 3 }}>
                              Topic:
                            </label>
                            <input
                              type="text"
                              value={hLink.topic_name || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEditHierarchyLinks((prev) =>
                                  prev.map((item, i) => (i === hIdx ? { ...item, topic_name: val } : item))
                                );
                                if (hLink.is_primary) setEditTopicName(val);
                              }}
                              placeholder="e.g. Money and Banking"
                              style={{ width: '100%', padding: '7px 9px', fontSize: 12.5, borderRadius: 6, border: '1px solid #CBD5E1', boxSizing: 'border-box' }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 3 }}>
                              Subtopic:
                            </label>
                            <input
                              type="text"
                              value={hLink.subtopic_name || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEditHierarchyLinks((prev) =>
                                  prev.map((item, i) => (i === hIdx ? { ...item, subtopic_name: val } : item))
                                );
                                if (hLink.is_primary) setEditSubtopicName(val);
                              }}
                              placeholder="e.g. Banking Structure in India"
                              style={{ width: '100%', padding: '7px 9px', fontSize: 12.5, borderRadius: 6, border: '1px solid #CBD5E1', boxSizing: 'border-box' }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 3 }}>
                              Concept Tag / Name:
                            </label>
                            <input
                              type="text"
                              value={hLink.concept_name || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEditHierarchyLinks((prev) =>
                                  prev.map((item, i) => (i === hIdx ? { ...item, concept_name: val } : item))
                                );
                              }}
                              placeholder="e.g. Monetary Policy"
                              style={{ width: '100%', padding: '7px 9px', fontSize: 12.5, borderRadius: 6, border: '1px solid #CBD5E1', boxSizing: 'border-box' }}
                            />
                          </div>
                        </div>

                        {/* Relevance Slider & Percentage Control */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14, backgroundColor: '#F8FAFC', padding: '8px 12px', borderRadius: 6 }}>
                          <span style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' }}>
                            Relevance Percentage:
                          </span>
                          <input
                            type="range"
                            min="10"
                            max="100"
                            step="5"
                            value={pct}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              setEditHierarchyLinks((prev) =>
                                prev.map((item, i) =>
                                  i === hIdx
                                    ? { ...item, relevance_percentage: val, relevance_weight: val / 100 }
                                    : item
                                )
                              );
                            }}
                            style={{ flex: 1, accentColor: '#2563EB', cursor: 'pointer' }}
                          />
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={pct}
                              onChange={(e) => {
                                const val = Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0));
                                setEditHierarchyLinks((prev) =>
                                  prev.map((item, i) =>
                                    i === hIdx
                                      ? { ...item, relevance_percentage: val, relevance_weight: val / 100 }
                                      : item
                                  )
                                );
                              }}
                              style={{ width: 52, padding: '4px 6px', fontSize: 12, fontWeight: 700, textAlign: 'center', borderRadius: 4, border: '1px solid #CBD5E1' }}
                            />
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#64748B' }}>%</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Difficulty & Marks */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>Difficulty:</label>
                  <select
                    value={editDifficulty}
                    onChange={(e) => setEditDifficulty(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 6, border: '1px solid #CBD5E1' }}
                  >
                    <option value="EASY">EASY</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HARD">HARD</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>Marks:</label>
                  <input
                    type="number"
                    step="0.5"
                    value={editMarks}
                    onChange={(e) => setEditMarks(parseFloat(e.target.value) || 2.0)}
                    style={{ width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 6, border: '1px solid #CBD5E1', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>Negative Marks:</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editNegativeMarks}
                    onChange={(e) => setEditNegativeMarks(parseFloat(e.target.value) || 0.66)}
                    style={{ width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 6, border: '1px solid #CBD5E1', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>Expected Time (s):</label>
                  <input
                    type="number"
                    value={editExpectedTime}
                    onChange={(e) => setEditExpectedTime(parseInt(e.target.value, 10) || 60)}
                    style={{ width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 6, border: '1px solid #CBD5E1', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* Options & Distractor Analyses */}
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>
                  Options & Distractor Analysis (Option Explanations):
                </label>
                {editOptions.map((opt, idx) => (
                  <div
                    key={opt.option_label}
                    style={{
                      padding: '12px 14px',
                      backgroundColor: '#FAFAFA',
                      border: opt.is_correct ? '1.5px solid #16A34A' : '1px solid #CBD5E1',
                      borderRadius: 8,
                      marginBottom: 10,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                      <span style={{ fontWeight: 800, fontSize: 14, color: '#0F172A', width: 20 }}>
                        {opt.option_label}
                      </span>
                      <input
                        type="text"
                        value={opt.option_text}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditOptions((prev) =>
                            prev.map((o, i) => (i === idx ? { ...o, option_text: val } : o))
                          );
                        }}
                        placeholder={`Option ${opt.option_label} text...`}
                        style={{ flex: 1, padding: '7px 10px', fontSize: 13, borderRadius: 6, border: '1px solid #CBD5E1' }}
                      />
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#15803D', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="correctOptionRadio"
                          checked={opt.is_correct}
                          onChange={() => {
                            setEditOptions((prev) =>
                              prev.map((o, i) => ({ ...o, is_correct: i === idx }))
                            );
                          }}
                        />
                        Correct Answer
                      </label>
                    </div>

                    <input
                      type="text"
                      value={opt.distractor_analysis}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditOptions((prev) =>
                          prev.map((o, i) => (i === idx ? { ...o, distractor_analysis: val } : o))
                        );
                      }}
                      placeholder={`Explanation for Option ${opt.option_label} (why it is correct/incorrect)...`}
                      style={{
                        width: '100%',
                        padding: '6px 10px',
                        fontSize: 12,
                        borderRadius: 6,
                        border: '1px solid #CBD5E1',
                        backgroundColor: '#FFFFFF',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                ))}
              </div>

              {/* 4 Solution Parameters */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 12 }}>
                  4 Solution Parameters:
                </label>

                {/* 1. Core Concept */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#2563EB', marginBottom: 4 }}>
                    1. Core Concept:
                  </label>
                  <input
                    type="text"
                    value={editCoreConcept}
                    onChange={(e) => setEditCoreConcept(e.target.value)}
                    placeholder="Fundamental principle or theory tested..."
                    style={{ width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 6, border: '1px solid #CBD5E1', boxSizing: 'border-box' }}
                  />
                </div>

                {/* 2. Detailed Solution */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>
                    2. Step-by-Step Detailed Solution:
                  </label>
                  <textarea
                    rows={4}
                    value={editDetailedSolution}
                    onChange={(e) => setEditDetailedSolution(e.target.value)}
                    placeholder="Comprehensive explanation with steps and derivations..."
                    style={{ width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 6, border: '1px solid #CBD5E1', boxSizing: 'border-box', fontFamily: 'inherit' }}
                  />
                </div>

                {/* 3. Common Traps */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#B45309', marginBottom: 4 }}>
                    3. Points to Remember / Common Traps:
                  </label>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <input
                      type="text"
                      value={newTrapInput}
                      onChange={(e) => setNewTrapInput(e.target.value)}
                      placeholder="Add a common trap or memory tip..."
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newTrapInput.trim()) {
                          e.preventDefault();
                          setEditCommonTraps((prev) => [...prev, newTrapInput.trim()]);
                          setNewTrapInput('');
                        }
                      }}
                      style={{ flex: 1, padding: '7px 10px', fontSize: 12.5, borderRadius: 6, border: '1px solid #CBD5E1' }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newTrapInput.trim()) {
                          setEditCommonTraps((prev) => [...prev, newTrapInput.trim()]);
                          setNewTrapInput('');
                        }
                      }}
                      style={{ padding: '7px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: 'none', backgroundColor: '#D97706', color: '#FFFFFF', cursor: 'pointer' }}
                    >
                      Add
                    </button>
                  </div>
                  {editCommonTraps.map((trap, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 10px', backgroundColor: '#FEF3C7', borderRadius: 6, marginBottom: 4, fontSize: 12, border: '1px solid #FDE68A' }}>
                      <span>{trap}</span>
                      <button
                        type="button"
                        onClick={() => setEditCommonTraps((prev) => prev.filter((_, i) => i !== idx))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626' }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>

                {/* 4. Key Takeaways */}
                <div>
                  <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#15803D', marginBottom: 4 }}>
                    4. Key Takeaways:
                  </label>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <input
                      type="text"
                      value={newTakeawayInput}
                      onChange={(e) => setNewTakeawayInput(e.target.value)}
                      placeholder="Add an essential takeaway point..."
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newTakeawayInput.trim()) {
                          e.preventDefault();
                          setEditKeyTakeaways((prev) => [...prev, newTakeawayInput.trim()]);
                          setNewTakeawayInput('');
                        }
                      }}
                      style={{ flex: 1, padding: '7px 10px', fontSize: 12.5, borderRadius: 6, border: '1px solid #CBD5E1' }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newTakeawayInput.trim()) {
                          setEditKeyTakeaways((prev) => [...prev, newTakeawayInput.trim()]);
                          setNewTakeawayInput('');
                        }
                      }}
                      style={{ padding: '7px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: 'none', backgroundColor: '#15803D', color: '#FFFFFF', cursor: 'pointer' }}
                    >
                      Add
                    </button>
                  </div>
                  {editKeyTakeaways.map((takeaway, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 10px', backgroundColor: '#DCFCE7', borderRadius: 6, marginBottom: 4, fontSize: 12, border: '1px solid #86EFAC' }}>
                      <span>{takeaway}</span>
                      <button
                        type="button"
                        onClick={() => setEditKeyTakeaways((prev) => prev.filter((_, i) => i !== idx))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626' }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div
              style={{
                padding: '16px 24px',
                borderTop: '1px solid #E2E8F0',
                backgroundColor: '#FAFAFA',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 12,
              }}
            >
              <button
                type="button"
                onClick={() => setEditingQuestion(null)}
                style={{
                  padding: '9px 18px',
                  borderRadius: 6,
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: '#475569',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => handleSaveQuestionChanges(false)}
                disabled={savingEdit}
                style={{
                  padding: '9px 18px',
                  borderRadius: 6,
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: '#0F172A',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Save Draft
              </button>

              <button
                type="button"
                onClick={() => handleSaveQuestionChanges(true)}
                disabled={savingEdit}
                style={{
                  padding: '9px 20px',
                  borderRadius: 6,
                  border: 'none',
                  backgroundColor: '#16A34A',
                  color: '#FFFFFF',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  boxShadow: '0 2px 6px rgba(22, 163, 74, 0.25)',
                }}
              >
                {savingEdit ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Save & Mark Verified
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Unsaved Changes Warning Popup */}
      {showUnsavedModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 12,
              maxWidth: 460,
              width: '100%',
              padding: 24,
              boxShadow: '0 20px 40px rgba(15, 23, 42, 0.2)',
              border: '1px solid #E2E8F0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#D97706', marginBottom: 12 }}>
              <AlertTriangle size={24} />
              <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: '#0F172A' }}>
                Unsaved Question Modifications
              </h3>
            </div>
            <p style={{ fontSize: 13.5, color: '#475569', lineHeight: 1.5, margin: '0 0 20px 0' }}>
              You have modified the active question without saving or publishing it. Would you like to discard changes and proceed, or stay on this question?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => setShowUnsavedModal(false)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 6,
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Stay Here
              </button>
              <button
                onClick={() => {
                  setShowUnsavedModal(false);
                  setHasUnsavedChanges(false);
                  if (pendingNavigationAction) {
                    pendingNavigationAction();
                    setPendingNavigationAction(null);
                  }
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: 'none',
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Discard Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: S3 Publish Warning (When questions are still pending) */}
      {showPublishWarningModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 12,
              maxWidth: 480,
              width: '100%',
              padding: 24,
              boxShadow: '0 20px 40px rgba(15, 23, 42, 0.2)',
              border: '1px solid #E2E8F0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#DC2626', marginBottom: 12 }}>
              <Lock size={24} />
              <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: '#0F172A' }}>
                Cannot Publish Exam to S3
              </h3>
            </div>
            <p style={{ fontSize: 13.5, color: '#475569', lineHeight: 1.5, margin: '0 0 16px 0' }}>
              <strong>{reviewMetrics.pending} questions</strong> are still pending human review in exam package <em>&apos;{selectedExam?.name}&apos;</em>.
            </p>
            <div
              style={{
                backgroundColor: '#FEF2F2',
                border: '1px solid #FECDCA',
                borderRadius: 8,
                padding: '12px 14px',
                fontSize: 13,
                color: '#B42318',
                marginBottom: 20,
              }}
            >
              Every single question and solution must be verified and approved before deploying final JSON artifacts to S3.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => {
                  setShowPublishWarningModal(false);
                  handleStatusFilterChange('PENDING');
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: 'none',
                  backgroundColor: '#2563EB',
                  color: '#FFFFFF',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Review Remaining Questions
              </button>
              <button
                onClick={() => setShowPublishWarningModal(false)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 6,
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Final S3 Exam Publish Confirmation */}
      {showPublishModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 12,
              maxWidth: 480,
              width: '100%',
              padding: 24,
              boxShadow: '0 20px 40px rgba(15, 23, 42, 0.2)',
              border: '1px solid #E2E8F0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#16A34A', marginBottom: 12 }}>
              <UploadCloud size={26} />
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#0F172A' }}>
                Publish Exam Package to S3?
              </h3>
            </div>
            <p style={{ fontSize: 13.5, color: '#475569', lineHeight: 1.5, margin: '0 0 16px 0' }}>
              All <strong>{reviewMetrics.total} questions & solutions</strong> have been verified. Publishing will:
            </p>
            <ul style={{ margin: '0 0 20px 0', paddingLeft: 20, fontSize: 13, color: '#334155', lineHeight: 1.6 }}>
              <li>Generate standalone <code style={{ color: '#2563EB' }}>questions.json</code> & <code style={{ color: '#2563EB' }}>solutions.json</code></li>
              <li>Deploy individual question & solution JSONs to Amazon S3</li>
              <li>Activate this exam for candidate mock tests and live assessments</li>
            </ul>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => setShowPublishModal(false)}
                disabled={publishingExam}
                style={{
                  padding: '9px 16px',
                  borderRadius: 6,
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmPublishExam}
                disabled={publishingExam}
                style={{
                  padding: '9px 20px',
                  borderRadius: 6,
                  border: 'none',
                  backgroundColor: '#16A34A',
                  color: '#FFFFFF',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: '0 2px 6px rgba(22, 163, 74, 0.25)',
                }}
              >
                {publishingExam ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                Confirm & Deploy to S3
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
