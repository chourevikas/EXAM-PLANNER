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
  CheckCheck,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Sparkles,
  ChevronsUpDown,
} from 'lucide-react';
import { Spinner } from '../../../components/common/Spinner';
import {
  fetchExamPipelineStatuses,
  fetchExamQuestionsForReview,
  updateAdminQuestionDetail,
  updateAdminQuestionStatus,
  approveAndPublishExam,
  approveAllQuestions,
  fetchExamIntegrityQuestions,
  ExamPipelineStatusItem,
  ExamIntegrityQuestionsResponse,
} from '../../../services/adminService';
import { MissingQuestionsView } from './MissingQuestionsView';
import { AddMissingQuestionModal } from '../modals/AddMissingQuestionModal';
import { AdminQuestionPublicationCard } from '../AdminQuestionPublicationCard';


interface QuestionOptionItem {
  option_id?: string;
  option_label: string;
  option_text: string;
  is_correct: boolean;
  display_order?: number;
  distractor_analysis?: string | null;
  why_tempting?: string | null;
  whats_actually_true?: string | null;
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
  const lastHandledNavRef = useRef<any>(null);
  const lastSelectedExamIdRef = useRef<any>(null);

  useEffect(() => {
    if (!initialExam) return;
    if (initialExam === lastHandledNavRef.current) return;
    lastHandledNavRef.current = initialExam;
    lastSelectedExamIdRef.current = initialExam.id;

    setSelectedExam(initialExam);

    const targetQNum = initialExam.targetQuestionNumber;
    const targetQId = initialExam.targetQuestionId;

    if (targetQNum || targetQId) {
      setQuestionStatusFilter('ALL');
      setQuestionSearchQuery('');
      const estPage = targetQNum ? Math.floor((targetQNum - 1) / 10) + 1 : 1;
      const estIdx = targetQNum ? (targetQNum - 1) % 10 : 0;
      setCurrentPage(estPage);
      setSelectedQuestionIndex(estIdx);
      loadExamQuestions(initialExam.id, 'ALL', estPage, estIdx, targetQNum, targetQId);
    } else {
      loadExamQuestions(initialExam.id, questionStatusFilter, 1);
    }
  }, [initialExam]);

  // Top Navigation Tab state ('review' | 'missing')
  const [qaTab, setQaTab] = useState<'review' | 'missing'>('review');

  // Integrity & Missing Question Diagnostics State for Selected Exam
  const [examIntegrity, setExamIntegrity] = useState<ExamIntegrityQuestionsResponse | null>(null);
  const [isAddMissingModalOpen, setIsAddMissingModalOpen] = useState<boolean>(false);

  useEffect(() => {
    if (selectedExam?.id) {
      fetchExamIntegrityQuestions(selectedExam.id, 'ALL', 1, 250)
        .then((res) => setExamIntegrity(res))
        .catch((err) => console.warn('Failed to fetch exam integrity:', err));
    } else {
      setExamIntegrity(null);
    }
  }, [selectedExam?.id]);

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

  const isSelectedExtracting = Boolean(
    examIntegrity !== undefined && examIntegrity !== null
      ? examIntegrity.is_extracting
      : (
          selectedExam?.is_extracting ||
          selectedExam?.overall_status === 'PROCESSING' ||
          ['IN_PROGRESS', 'RUNNING', 'PROCESSING', 'INITIALIZING'].includes((selectedExam?.stage1_status || '').toUpperCase()) ||
          ['PROCESSING', 'EXTRACTING', 'RUNNING', 'INITIALIZING', 'PARSING_PDF', 'AI PROCESSING'].includes((selectedExam?.status || '').toUpperCase()) ||
          ['PROCESSING', 'EXTRACTING', 'RUNNING', 'INITIALIZING', 'PARSING_PDF', 'AI PROCESSING'].includes((selectedExam?.pipeline_status || '').toUpperCase()) ||
          ['PROCESSING', 'EXTRACTING', 'RUNNING', 'INITIALIZING'].includes((selectedExam?.overall_status || '').toUpperCase()) ||
          (selectedExam?.stage1_step && !['DOCUMENT_EXTRACTION_COMPLETE', 'COMPLETED', 'FLAGGED_QUESTIONS_REQUIRE_ADMIN_REVIEW'].includes((selectedExam?.stage1_step || '').toUpperCase())) ||
          (!((selectedExam?.status || '').toUpperCase().includes('PUBLISHED') || (selectedExam?.overall_status || '').toUpperCase() === 'PUBLISHED') &&
            selectedExam?.stage1_status !== 'COMPLETED' &&
            (selectedExam?.has_question_paper || Boolean(selectedExam?.pdf_path)))
        )
  );


  // Exam Publication & Integrity Status
  const [publishStatus, setPublishStatus] = useState<{
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
  });

  // Action & Toast States
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [publishingExam, setPublishingExam] = useState<boolean>(false);
  const [verifyingAll, setVerifyingAll] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);
  const [reviewCardMode, setReviewCardMode] = useState<'publication' | 'inspection'>('publication');
  const [showTaxonomyWeights, setShowTaxonomyWeights] = useState<boolean>(false);

  // Unsaved Changes Navigation Guard
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [pendingNavigationAction, setPendingNavigationAction] = useState<(() => void) | null>(null);
  const [showUnsavedModal, setShowUnsavedModal] = useState<boolean>(false);

  // Exam Publish Confirmation Modal
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
  // 4 Solution Parameters Edit State
  const [editDetailedSolution, setEditDetailedSolution] = useState<string>('');
  const [editCommonTraps, setEditCommonTraps] = useState<string[]>([]);
  const [editKeyTakeaways, setEditKeyTakeaways] = useState<string[]>([]);
  const [newTrapInput, setNewTrapInput] = useState<string>('');

  // Options Edit State with Reverse Logic Breakdown
  const [editModalTab, setEditModalTab] = useState<'options' | 'solution' | 'classification' | 'all'>('options');
  const [showAdvancedHierarchy, setShowAdvancedHierarchy] = useState<boolean>(false);
  const [showPassageField, setShowPassageField] = useState<boolean>(false);

  interface QuestionEditOptionItem {
    option_id?: string;
    option_label: string;
    option_text: string;
    is_correct: boolean;
    distractor_analysis: string;
    why_tempting?: string;
    whats_actually_true?: string;
    use_split_fields?: boolean;
  }

  const [editOptions, setEditOptions] = useState<QuestionEditOptionItem[]>([]);
  const [expandedOptionIdxs, setExpandedOptionIdxs] = useState<Record<number, boolean>>({});
  const [selectedOptionFilter, setSelectedOptionFilter] = useState<'ALL' | number>('ALL');

  const toggleOptionExpanded = (idx: number) => {
    setExpandedOptionIdxs((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const getWordAndCharCount = (text?: string) => {
    const clean = (text || '').trim();
    const words = clean ? clean.split(/\s+/).length : 0;
    const chars = (text || '').length;
    return `${words} words • ${chars} chars`;
  };

  const [savingEdit, setSavingEdit] = useState<boolean>(false);

  useEffect(() => {
    if (!selectedExam) {
      loadExamsList();
    }
  }, [selectedExam]);

  // Real-time polling when any exam in directory is actively undergoing extraction
  useEffect(() => {
    if (selectedExam) return;

    const hasActiveJob = examsList.some((e) => {
      const isPub = (e.status || '').toUpperCase().includes('PUBLISHED') || (e.overall_status || '').toUpperCase() === 'PUBLISHED';
      return (
        e.is_extracting ||
        ['IN_PROGRESS', 'QUEUED', 'RUNNING', 'PROCESSING', 'INITIALIZING'].includes((e.stage1_status || '').toUpperCase()) ||
        e.overall_status === 'PROCESSING' ||
        ['PROCESSING', 'EXTRACTING', 'RUNNING', 'INITIALIZING', 'PARSING_PDF', 'AI PROCESSING', 'IN PIPELINE', 'QUEUED'].includes((e.status || '').toUpperCase()) ||
        ['PROCESSING', 'EXTRACTING', 'RUNNING', 'INITIALIZING', 'PARSING_PDF', 'AI PROCESSING', 'IN PIPELINE', 'QUEUED'].includes((e.pipeline_status || '').toUpperCase()) ||
        (!isPub && e.stage1_status !== 'COMPLETED' && (e.has_question_paper || Boolean(e.pdf_path)))
      );
    });

    if (hasActiveJob) {
      const timer = setTimeout(() => {
        loadExamsList();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [examsList, selectedExam]);


  useEffect(() => {
    if (!selectedExam?.id) {
      lastSelectedExamIdRef.current = null;
      return;
    }
    // Skip if already handled by initialExam navigation
    if (lastSelectedExamIdRef.current === selectedExam.id) {
      return;
    }
    lastSelectedExamIdRef.current = selectedExam.id;
    loadExamQuestions(selectedExam.id, questionStatusFilter, 1);
  }, [selectedExam?.id]);

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
    examId: string | number,
    statusFilterVal?: string,
    pageNum: number = 1,
    targetSelectIdx: number = 0,
    targetQuestionNumber?: number,
    targetQuestionId?: string | number
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

      const data = await fetchExamQuestionsForReview(
        examId,
        pageNum,
        10,
        backendStatus,
        targetQuestionNumber,
        targetQuestionId
      );

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
            why_tempting: opt.why_tempting || null,
            whats_actually_true: opt.whats_actually_true || null,
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
      setPublishStatus({
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
      });

      // Update selectedExam metadata from response
      setSelectedExam((prev: any) => ({
        ...prev,
        id: data.exam_id,
        name: data.exam_name || prev?.name,
        code: data.exam_code || prev?.code,
        stage: data.stage || prev?.stage,
        source_year: data.source_year || prev?.source_year,
        paper_set_code: data.paper_set_code || prev?.paper_set_code,
        total_questions: data.total_questions,
        status: data.publish_status || (isExamPublished ? 'PUBLISHED' : prev?.status),
      }));

      let safeIdx = Math.max(0, Math.min(items.length - 1, targetSelectIdx));
      if (data.target_index !== undefined && data.target_index !== null && data.target_index >= 0 && data.target_index < items.length) {
        safeIdx = data.target_index;
      } else if (targetQuestionId || targetQuestionNumber) {
        const found = items.findIndex(
          (item) =>
            (targetQuestionId && (String(item.id) === String(targetQuestionId) || String(item.question_id) === String(targetQuestionId))) ||
            (targetQuestionNumber && item.question_number_in_paper === targetQuestionNumber)
        );
        if (found !== -1) {
          safeIdx = found;
        }
      }
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

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const timer = setTimeout(() => {
      const el = document.getElementById(`review-q-item-${selectedQuestionIndex}`);
      if (el) {
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }, 120);
    return () => clearTimeout(timer);
  }, [selectedQuestionIndex, currentPage]);

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
      setSelectedQuestionIndex(0);
      if (selectedExam?.id) {
        loadExamQuestions(selectedExam.id, newFilter, 1, 0);
      }
    });
  };

  const handleBackToExamsList = () => {
    safeNavigate(() => {
      setSelectedExam(null);
      lastSelectedExamIdRef.current = null;
      lastHandledNavRef.current = null;
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
    setShowPassageField(Boolean(q.passage_text && q.passage_text.trim().length > 0));
    setEditSubjectName(q.subject_name || '');
    setEditTopicName(q.topic_name || '');
    setEditSubtopicName(q.subtopic_name || '');
    setEditDifficulty(q.difficulty || 'MEDIUM');
    setEditMarks(q.marks !== undefined ? q.marks : 2.0);
    setEditNegativeMarks(q.negative_marks !== undefined ? q.negative_marks : 0.66);
    setEditExpectedTime(q.expected_time_seconds || 60);
    setEditModalTab('options');
    setShowAdvancedHierarchy(false);

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
            subject_name: q.subject_name || '',
            topic_name: q.topic_name || '',
            subtopic_name: q.subtopic_name || '',
            is_primary: true,
            relevance_weight: 1.0,
            relevance_percentage: 100,
            concept_name: q.topic_name || '',
          },
        ];

    setEditHierarchyLinks(initialH);

    setEditDetailedSolution(q.explanation?.detailed_solution || '');
    setEditCommonTraps(q.explanation?.common_traps ? [...q.explanation.common_traps] : []);
    setEditKeyTakeaways(q.explanation?.key_takeaways ? [...q.explanation.key_takeaways] : []);

    const rawOpts = (q.options && q.options.length > 0 ? q.options : [
      { option_label: 'A', option_text: '', is_correct: false, distractor_analysis: '' },
      { option_label: 'B', option_text: '', is_correct: false, distractor_analysis: '' },
      { option_label: 'C', option_text: '', is_correct: false, distractor_analysis: '' },
      { option_label: 'D', option_text: '', is_correct: false, distractor_analysis: '' },
    ]);

    setEditOptions(
      rawOpts.map((opt) => {
        const rawDistractor = (opt.distractor_analysis || '').trim();
        const directWhy = ((opt as any).why_tempting || '').trim();
        const directTrue = ((opt as any).whats_actually_true || '').trim();

        let whyTempting = directWhy;
        let whatsTrue = directTrue;
        let isSplit = Boolean(directWhy || directTrue);

        if (!isSplit && rawDistractor) {
          const matchWhy = rawDistractor.match(
            /(?:Why\s+it\s+seems\s+tempting|Why\s+tempting)\s*[-–—:]\s*(.*?)(?=(?:What(?:'s|\s+is)\s+actually\s+true|What\s+is\s+true|Actually\s+true)\s*[-–—:]|$)/is
          );
          const matchTrue = rawDistractor.match(
            /(?:What(?:'s|\s+is)\s+actually\s+true|What\s+is\s+true|Actually\s+true)\s*[-–—:]\s*(.*)$/is
          );
          if (matchWhy || matchTrue) {
            whyTempting = matchWhy ? matchWhy[1].trim() : '';
            whatsTrue = matchTrue ? matchTrue[1].trim() : '';
            isSplit = true;
          }
        }

        // For incorrect options, default use_split_fields to true if split was found or if creating new
        const useSplit = !opt.is_correct ? (isSplit || !rawDistractor) : false;

        return {
          option_id: opt.option_id ? String(opt.option_id) : undefined,
          option_label: opt.option_label,
          option_text: opt.option_text || '',
          is_correct: Boolean(opt.is_correct),
          distractor_analysis: rawDistractor,
          why_tempting: whyTempting,
          whats_actually_true: whatsTrue,
          use_split_fields: useSplit,
        };
      })
    );

    setSelectedOptionFilter('ALL');
    const initialExpanded: Record<number, boolean> = {};
    const correctIdx = rawOpts.findIndex((o) => o.is_correct);
    if (correctIdx >= 0) {
      initialExpanded[correctIdx] = true;
    } else {
      initialExpanded[0] = true;
    }
    setExpandedOptionIdxs(initialExpanded);
  };

  const handleSaveQuestionChanges = async (publishAfterSave: boolean = true) => {
    if (!editingQuestion) return;
    setSavingEdit(true);
    try {
      const primH = editHierarchyLinks.find((h) => h.is_primary) || editHierarchyLinks[0];
      const finalSubj = editSubjectName || primH?.subject_name || null;
      const finalTop = editTopicName || primH?.topic_name || null;
      const finalSubtop = editSubtopicName || primH?.subtopic_name || null;

      // Keep primary link synchronized
      const syncedHierarchy = editHierarchyLinks.map((h, i) => {
        if (h.is_primary || i === 0) {
          return {
            subject_id: h.subject_id || null,
            subject_name: finalSubj,
            topic_id: h.topic_id || null,
            topic_name: finalTop,
            subtopic_id: h.subtopic_id || null,
            subtopic_name: finalSubtop,
            is_primary: true,
            relevance_weight: (h.relevance_percentage !== undefined ? h.relevance_percentage : 100) / 100,
            concept_name: h.concept_name || finalTop,
          };
        }
        return {
          subject_id: h.subject_id || null,
          subject_name: h.subject_name || finalSubj,
          topic_id: h.topic_id || null,
          topic_name: h.topic_name || finalTop,
          subtopic_id: h.subtopic_id || null,
          subtopic_name: h.subtopic_name || finalSubtop,
          is_primary: false,
          relevance_weight: (h.relevance_percentage !== undefined ? h.relevance_percentage : 100) / 100,
          concept_name: h.concept_name || null,
        };
      });

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
        hierarchy_links: syncedHierarchy,
        detailed_solution: editDetailedSolution,
        common_traps: editCommonTraps,
        key_takeaways: editKeyTakeaways,
        options: editOptions.map((opt, idx) => {
          let finalDistractor = opt.distractor_analysis || '';
          if (opt.use_split_fields) {
            const why = (opt.why_tempting || '').trim();
            const actual = (opt.whats_actually_true || '').trim();
            if (why && actual) {
              finalDistractor = `Why it seems tempting — ${why}. What's actually true — ${actual}`;
            } else if (why) {
              finalDistractor = `Why it seems tempting — ${why}`;
            } else if (actual) {
              finalDistractor = `What's actually true — ${actual}`;
            }
          }

          return {
            option_id: opt.option_id,
            option_label: opt.option_label,
            option_text: opt.option_text,
            is_correct: opt.is_correct,
            display_order: idx + 1,
            distractor_analysis: finalDistractor,
          };
        }),
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

  const handlePublishExam = async () => {
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
      showToast('success', `Exam '${selectedExam.name}' published successfully! Questions & solutions packages generated.`);
      setShowPublishModal(false);
      setPublishStatus((prev) => ({
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
      setPublishStatus((prev) => ({
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

  const handleVerifyAllQuestions = async () => {
    if (!selectedExam) return;
    setVerifyingAll(true);
    try {
      const res = await approveAllQuestions(selectedExam.id);
      showToast('success', res?.message || `All questions for '${selectedExam.name}' have been verified and approved!`);
      // Optimistically update questions list to PUBLISHED
      setQuestionsList((prev) =>
        prev.map((q) => ({
          ...q,
          status: 'PUBLISHED',
        }))
      );
      // Update review metrics
      setReviewMetrics((prev) => ({
        ...prev,
        pending: 0,
        rejected: 0,
        reviewed: prev.total,
        canPublish: prev.total > 0,
      }));
      setShowPublishWarningModal(false);
      // Reload actual questions from backend
      await loadExamQuestions(selectedExam.id, questionStatusFilter, currentPage, selectedQuestionIndex);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to verify all questions.');
    } finally {
      setVerifyingAll(false);
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
              borderRadius: 0,
              fontSize: 13.5,
              fontWeight: 600,
              backgroundColor: toastMessage.type === 'success' ? '#15803D' : toastMessage.type === 'error' ? '#DC2626' : '#F2B623',
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

        {/* Page Header & Sub-Tab Navigation Bar */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 700, color: '#172033', margin: 0, letterSpacing: '-0.02em' }}>
                Question & Solution QA Review Hub
              </h1>
              <p style={{ fontSize: 13.5, color: '#64748B', marginTop: 4, margin: '4px 0 0 0' }}>
                Inspect extracted questions, verify 4-parameter solutions & option distractor analyses, update taxonomy, and approve exam packages for platform release.
              </p>
            </div>

            {/* QA Sub-Tab Navigation */}
            <div style={{ display: 'flex', backgroundColor: '#E2E8F0', padding: 4, borderRadius: 8 }}>
              <button
                onClick={() => setQaTab('review')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: 'none',
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: qaTab === 'review' ? '#ffffff' : 'transparent',
                  color: qaTab === 'review' ? '#0F172A' : '#64748B',
                  boxShadow: qaTab === 'review' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <BookOpen size={16} />
                <span>Paper Review Directory</span>
              </button>
              <button
                onClick={() => setQaTab('missing')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: 'none',
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: qaTab === 'missing' ? '#ffffff' : 'transparent',
                  color: qaTab === 'missing' ? '#DC2626' : '#64748B',
                  boxShadow: qaTab === 'missing' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <AlertTriangle size={16} color={qaTab === 'missing' ? '#DC2626' : '#64748B'} />
                <span>Missing Questions Screen</span>
              </button>
            </div>
          </div>
        </div>

        {/* If Missing Questions Tab is active */}
        {qaTab === 'missing' ? (
          <MissingQuestionsView
            onSelectExam={(exam) => {
              setSelectedExam(exam);
              setQaTab('review');
            }}
          />
        ) : (
          <>


        {/* Filters and Search Bar */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 0,
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
                borderRadius: 0,
                border: '1px solid #CBD5E1',
                outline: 'none',
                color: '#172033',
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
                borderRadius: 0,
                border: '1px solid #CBD5E1',
                fontSize: 13,
                color: '#172033',
                backgroundColor: '#FFFFFF',
                outline: 'none',
                fontWeight: 500,
              }}
            >
              <option value="ALL">All Exams ({examsList.length})</option>
              <option value="PENDING">Pending Review</option>
              <option value="PUBLISHED">Published (Live)</option>
            </select>

            <button
              onClick={loadExamsList}
              style={{
                padding: '8px 14px',
                borderRadius: 0,
                border: '1px solid #CBD5E1',
                backgroundColor: '#FFFFFF',
                color: '#172033',
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
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: 0, border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)' }}>
          {loadingExams ? (
            <div style={{ padding: 60, textAlign: 'center' }}>
              <Spinner size={32} label="Loading examination repositories…" />
            </div>
          ) : filteredExams.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center', color: '#64748B' }}>
              <BookOpen size={36} style={{ margin: '0 auto 12px auto', color: '#94A3B8' }} />
              <div style={{ fontSize: 15, fontWeight: 700, color: '#172033' }}>No examination papers found</div>
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
                  const isPublished =
                    (exam.status || '').toUpperCase().includes('PUBLISHED') ||
                    (exam.overall_status || '').toUpperCase() === 'PUBLISHED' ||
                    (exam.pipeline_status || '').toUpperCase() === 'PUBLISHED';

                  const isExtracting = Boolean(
                    exam.is_extracting ||
                    exam.overall_status === 'PROCESSING' ||
                    ['IN_PROGRESS', 'QUEUED', 'RUNNING', 'PROCESSING', 'INITIALIZING'].includes((exam.stage1_status || '').toUpperCase()) ||
                    ['PROCESSING', 'EXTRACTING', 'RUNNING', 'INITIALIZING', 'PARSING_PDF', 'AI PROCESSING', 'IN PIPELINE', 'QUEUED'].includes((exam.status || '').toUpperCase()) ||
                    ['PROCESSING', 'EXTRACTING', 'RUNNING', 'INITIALIZING', 'PARSING_PDF', 'AI PROCESSING', 'IN PIPELINE', 'QUEUED'].includes((exam.pipeline_status || '').toUpperCase()) ||
                    ['PROCESSING', 'EXTRACTING', 'RUNNING', 'INITIALIZING'].includes((exam.overall_status || '').toUpperCase()) ||
                    (exam.stage1_step && !['DOCUMENT_EXTRACTION_COMPLETE', 'COMPLETED'].includes((exam.stage1_step || '').toUpperCase())) ||
                    (!isPublished && exam.stage1_status !== 'COMPLETED' && (exam.has_question_paper || Boolean(exam.pdf_path)))
                  );

                  return (
                    <tr
                      key={exam.id}
                      style={{
                        borderBottom: '1px solid #E2E8F0',
                        transition: 'background-color 150ms ease-out',
                        opacity: isExtracting ? 0.45 : 1,
                        backgroundColor: isExtracting ? '#F8FAFC' : '#FFFFFF',
                        cursor: isExtracting ? 'not-allowed' : 'default',
                      }}
                      onMouseEnter={(e) => {
                        if (!isExtracting) e.currentTarget.style.backgroundColor = '#F8FAFC';
                      }}
                      onMouseLeave={(e) => {
                        if (!isExtracting) e.currentTarget.style.backgroundColor = '#FFFFFF';
                      }}
                    >
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: isExtracting ? '#64748B' : '#172033', display: 'flex', alignItems: 'center', gap: 8 }}>
                          {exam.name}
                          {isExtracting && (
                            <span style={{ fontSize: 11, padding: '2px 7px', backgroundColor: '#FEF3C7', color: '#B45309', fontWeight: 600, border: '1px solid #FDE68A', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <Loader2 size={11} className="animate-spin" /> In Extraction
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: '#64748B', fontFamily: 'monospace', marginTop: 2 }}>{exam.code}</div>
                      </td>
                      <td style={{ padding: '16px 16px', fontSize: 13, color: '#334155' }}>
                        <div style={{ textTransform: 'capitalize', fontWeight: 600 }}>{exam.stage || 'Prelims'}</div>
                        <div style={{ fontSize: 12, color: '#64748B' }}>{exam.source_year || '2024'}</div>
                      </td>
                      <td style={{ padding: '16px 16px', fontSize: 13 }}>
                        <span style={{ fontWeight: 600, color: '#172033' }}>Set {exam.paper_set_code || 'A'}</span>
                        <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                          {exam.extracted_questions_count || 0} / {exam.total_questions || 100} extracted
                        </div>
                      </td>
                      <td style={{ padding: '16px 16px' }}>
                        {isExtracting ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                              padding: '3px 10px',
                              borderRadius: 0,
                              fontSize: 12,
                              fontWeight: 600,
                              backgroundColor: '#F1F5F9',
                              color: '#64748B',
                              border: '1px solid #CBD5E1',
                            }}
                          >
                            <Loader2 size={12} className="animate-spin" />
                            Extracting Paper...
                          </span>
                        ) : (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                              padding: '3px 10px',
                              borderRadius: 0,
                              fontSize: 12,
                              fontWeight: 600,
                              backgroundColor: isPublished ? '#DCFCE7' : '#FEF3C7',
                              color: isPublished ? '#15803D' : '#B45309',
                              border: `1px solid ${isPublished ? '#86EFAC' : '#FDE68A'}`,
                            }}
                          >
                            <span style={{ width: 6, height: 6, borderRadius: 0, backgroundColor: isPublished ? '#16A34A' : '#F2B623' }} />
                            {isPublished ? 'Published (Live)' : 'Pending QA Review'}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                        {isExtracting ? (
                          <button
                            disabled={true}
                            style={{
                              padding: '7px 15px',
                              backgroundColor: '#94A3B8',
                              color: '#FFFFFF',
                              borderRadius: 0,
                              border: 'none',
                              fontSize: 12.5,
                              fontWeight: 600,
                              cursor: 'not-allowed',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                            }}
                            title="Paper is currently in the extraction phase. Review is locked."
                          >
                            <Loader2 size={13} className="animate-spin" />
                            In Extraction (Locked)
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setSelectedExam(exam);
                            }}
                            style={{
                              padding: '7px 15px',
                              backgroundColor: 'var(--primary-red)',
                              color: '#FFFFFF',
                              borderRadius: 0,
                              border: 'none',
                              fontSize: 12.5,
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              boxShadow: '0 1px 3px rgba(var(--primary-red-rgb), 0.25)',
                            }}
                          >
                            <Eye size={14} />
                            Review Questions
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        </>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 2: Dedicated Split-Pane Question QA Review Workspace
  // -------------------------------------------------------------
  if (selectedExam) {
    const isSelectedPublished =
      (selectedExam.status || '').toUpperCase().includes('PUBLISHED') ||
      (selectedExam.overall_status || '').toUpperCase() === 'PUBLISHED' ||
      (selectedExam.pipeline_status || '').toUpperCase() === 'PUBLISHED';

    const isSelectedExtracting = Boolean(
      examIntegrity !== undefined && examIntegrity !== null
        ? examIntegrity.is_extracting
        : (
            selectedExam.is_extracting ||
            selectedExam.overall_status === 'PROCESSING' ||
            ['IN_PROGRESS', 'RUNNING', 'PROCESSING', 'INITIALIZING'].includes((selectedExam.stage1_status || '').toUpperCase()) ||
            ['PROCESSING', 'EXTRACTING', 'RUNNING', 'INITIALIZING', 'PARSING_PDF', 'AI PROCESSING'].includes((selectedExam.status || '').toUpperCase()) ||
            ['PROCESSING', 'EXTRACTING', 'RUNNING', 'INITIALIZING', 'PARSING_PDF', 'AI PROCESSING'].includes((selectedExam.pipeline_status || '').toUpperCase()) ||
            ['PROCESSING', 'EXTRACTING', 'RUNNING', 'INITIALIZING'].includes((selectedExam.overall_status || '').toUpperCase()) ||
            (selectedExam.stage1_step && !['DOCUMENT_EXTRACTION_COMPLETE', 'COMPLETED', 'FLAGGED_QUESTIONS_REQUIRE_ADMIN_REVIEW'].includes((selectedExam.stage1_step || '').toUpperCase())) ||
            (!isSelectedPublished && selectedExam.stage1_status !== 'COMPLETED' && (selectedExam.has_question_paper || Boolean(selectedExam.pdf_path)))
          )
    );

    if (isSelectedExtracting) {
      return (
        <div style={{ maxWidth: 1440, margin: '0 auto', fontFamily: 'Inter, sans-serif', padding: '40px 20px' }}>
          <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', padding: 48, textAlign: 'center', boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)' }}>
            <Loader2 size={40} className="animate-spin" style={{ margin: '0 auto 16px auto', color: 'var(--primary-red)' }} />
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#172033', margin: '0 0 8px 0' }}>
              Paper Currently in Extraction Phase
            </h2>
            <p style={{ fontSize: 14, color: '#64748B', maxWidth: 540, margin: '0 auto 24px auto', lineHeight: 1.6 }}>
              <strong>{selectedExam.name}</strong> ({selectedExam.code}) is still being processed by the extraction pipeline ({selectedExam.extracted_questions_count || 0} of {selectedExam.total_questions || 100} questions extracted). The Question & Solution review workspace is locked until extraction completes.
            </p>
            <button
              onClick={handleBackToExamsList}
              style={{
                padding: '9px 20px',
                backgroundColor: '#172033',
                color: '#FFFFFF',
                border: 'none',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              ← Back to Examination Papers
            </button>
          </div>
        </div>
      );
    }
  }

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
            borderRadius: 0,
            fontSize: 13.5,
            fontWeight: 600,
            backgroundColor: toastMessage.type === 'success' ? '#15803D' : toastMessage.type === 'error' ? '#DC2626' : '#F2B623',
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
          borderRadius: 0,
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
                borderRadius: 0,
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
                <h1 style={{ fontSize: 22, fontWeight: 700, color: '#172033', margin: 0, letterSpacing: '-0.015em' }}>
                  {selectedExam.name}
                </h1>
                <span
                  style={{
                    padding: '3px 9px',
                    borderRadius: 0,
                    fontSize: 11.5,
                    fontWeight: 700,
                    backgroundColor: '#F8FAFC',
                    color: 'var(--primary-red)',
                    border: '1px solid #BFDBFE',
                  }}
                >
                  Set {selectedExam.paper_set_code || 'A'}
                </span>
                <span
                  style={{
                    padding: '3px 9px',
                    borderRadius: 0,
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
                    borderRadius: 0,
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

          {/* Action Buttons: Add Missing Question & Publish Package */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => setIsAddMissingModalOpen(true)}
              style={{
                padding: '9px 16px',
                backgroundColor: '#FEF2F2',
                border: '1px solid #FCA5A5',
                color: '#DC2626',
                borderRadius: 0,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
              title="Manually add a missing question to this exam paper"
            >
              <Plus size={16} color="#DC2626" />
              Add Missing Question
            </button>

            {/* Verify All Questions Button */}
            {selectedExam && (reviewMetrics.pending > 0 || reviewMetrics.rejected > 0) && (
              <button
                onClick={handleVerifyAllQuestions}
                disabled={verifyingAll || publishingExam}
                style={{
                  padding: '9px 18px',
                  borderRadius: 0,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: verifyingAll ? 'not-allowed' : 'pointer',
                  backgroundColor: '#0284C7',
                  color: '#FFFFFF',
                  border: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: '0 2px 6px rgba(2, 132, 199, 0.35)',
                }}
                title="Mark all questions in this exam paper as verified and approved"
              >
                {verifyingAll ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <CheckCheck size={16} />
                )}
                {verifyingAll ? 'Verifying All...' : `Verify All Questions (${reviewMetrics.pending})`}
              </button>
            )}

            {publishStatus.is_published ? (
              <button
                disabled={true}
                style={{
                  padding: '9px 18px',
                  borderRadius: 0,
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
                Published (Live)
              </button>
            ) : publishStatus.is_corrupted ? (
              <button
                disabled={true}
                style={{
                  padding: '9px 18px',
                  borderRadius: 0,
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
            ) : publishStatus.can_retry ? (
              <button
                onClick={confirmPublishExam}
                disabled={publishingExam}
                style={{
                  padding: '9px 18px',
                  borderRadius: 0,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: '#F2B623',
                  color: '#FFFFFF',
                  border: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: '0 2px 6px rgba(217, 119, 6, 0.35)',
                }}
              >
                {publishingExam ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={15} />}
                Retry Publish
              </button>
            ) : reviewMetrics.canPublish ? (
              <button
                onClick={handlePublishExam}
                disabled={publishingExam}
                style={{
                  padding: '9px 18px',
                  border: 'none',
                  borderRadius: 0,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: '#3A8B53',
                  color: '#FFFFFF',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: '0 2px 8px rgba(5, 150, 105, 0.35)',
                }}
                title="All questions reviewed! Click to approve and publish package"
              >
                {publishingExam ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Unlock size={15} />
                )}
                Approve & Publish Package
              </button>
            ) : (
              <button
                onClick={() => setShowPublishWarningModal(true)}
                style={{
                  padding: '9px 18px',
                  border: '1px solid #CBD5E1',
                  borderRadius: 0,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: '#F8FAFC',
                  color: '#64748B',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                }}
                title={`${reviewMetrics.pending} questions are pending review. Click to review or verify all.`}
              >
                <Lock size={15} color="#64748B" />
                Publish Locked ({reviewMetrics.pending} Pending Review)
              </button>
            )}
          </div>
        </div>

        {/* Missing Questions Alert Banner */}
        {!isSelectedExtracting && examIntegrity && examIntegrity.missing_count > 0 && (
          <div
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.03)',
              backdropFilter: 'blur(4px)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: 10,
              padding: '14px 20px',
              marginTop: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
              boxShadow: '0 1px 3px rgba(220, 38, 38, 0.04)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#DC2626',
                  flexShrink: 0,
                }}
              >
                <AlertTriangle size={18} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#991B1B' }}>
                  {examIntegrity.missing_count} Missing Question{examIntegrity.missing_count > 1 ? 's' : ''} in this Exam Paper ({examIntegrity.total_extracted_questions} / {examIntegrity.total_expected_questions} Extracted)
                </div>
                <div style={{ fontSize: 12, color: '#B91C1C', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span>Missing Question Numbers:</span>
                  {examIntegrity.missing_question_numbers.slice(0, 12).map((n) => (
                    <span
                      key={n}
                      style={{
                        fontWeight: 600,
                        backgroundColor: 'rgba(239, 68, 68, 0.08)',
                        border: '1px solid rgba(239, 68, 68, 0.22)',
                        color: '#B91C1C',
                        padding: '2px 8px',
                        borderRadius: 6,
                        fontSize: 11.5,
                      }}
                    >
                      #{n}
                    </span>
                  ))}
                  {examIntegrity.missing_question_numbers.length > 12 && (
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: '#DC2626' }}>
                      +{examIntegrity.missing_question_numbers.length - 12} more
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsAddMissingModalOpen(true)}
              style={{
                padding: '8px 16px',
                backgroundColor: 'var(--primary-red)',
                color: '#ffffff',
                border: 'none',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 2px 4px rgba(var(--primary-red-rgb), 0.2)',
              }}
            >
              <Plus size={16} />
              <span>Add Missing Question #{examIntegrity.missing_question_numbers[0]}</span>
            </button>
          </div>
        )}



        {/* Exam Publication & Artifact Status Banner */}
        {publishStatus.is_published && (
          <div style={{ marginTop: 14, padding: '12px 16px', borderRadius: 0, backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <CheckCircle2 size={20} color="#16A34A" />
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: '#15803D' }}>
                  Exam Package Published & Active
                </div>
                <div style={{ fontSize: 12, color: '#166534', marginTop: 2 }}>
                  All questions verified & deployed. Active in catalog for mock tests and student assessments.
                </div>
              </div>
            </div>
            <span style={{ fontSize: 11.5, fontWeight: 700, padding: '3px 9px', borderRadius: 0, backgroundColor: '#DCFCE7', color: '#15803D', border: '1px solid #86EFAC' }}>
              LIVE IN CATALOG
            </span>
          </div>
        )}

        {publishStatus.publish_status === 'PUBLISH_FAILED' && publishStatus.can_retry && (
          <div style={{ marginTop: 14, padding: '12px 16px', borderRadius: 0, backgroundColor: '#FFFBEB', border: '1px solid #FCD34D', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <AlertTriangle size={20} color="#F2B623" />
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: '#B45309' }}>
                  Publishing Task Interrupted (Fixable via Retry)
                </div>
                <div style={{ fontSize: 12, color: '#92400E', marginTop: 2 }}>
                  {publishStatus.publish_error || 'Network timeout or transient storage communication error occurred.'}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => selectedExam && loadExamQuestions(selectedExam.id, questionStatusFilter, currentPage, selectedQuestionIndex)}
                disabled={loadingQuestions}
                style={{
                  padding: '7px 12px',
                  borderRadius: 0,
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
                title="Re-check database integrity and publish status"
              >
                <RefreshCw size={13} className={loadingQuestions ? 'animate-spin' : ''} />
                Re-evaluate Status
              </button>
              <button
                onClick={confirmPublishExam}
                disabled={publishingExam}
                style={{
                  padding: '7px 14px',
                  borderRadius: 0,
                  backgroundColor: '#F2B623',
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

        {publishStatus.is_corrupted && (
          <div style={{ marginTop: 14, padding: '12px 16px', borderRadius: 0, backgroundColor: '#FEF2F2', border: '1px solid #FECACA', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <ShieldAlert size={20} color="#DC2626" />
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: '#B91C1C' }}>
                  Database Record Corrupted
                </div>
                <div style={{ fontSize: 12, color: '#991B1B', marginTop: 2 }}>
                  {publishStatus.corruption_reason || publishStatus.publish_error || 'Critical question statement or answer option records are missing in database.'} Edit the question in the editor below to repair data, then click Re-evaluate.
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => selectedExam && loadExamQuestions(selectedExam.id, questionStatusFilter, currentPage, selectedQuestionIndex)}
                disabled={loadingQuestions}
                style={{
                  padding: '7px 14px',
                  borderRadius: 0,
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
              <span style={{ fontSize: 11.5, fontWeight: 700, padding: '3px 9px', borderRadius: 0, backgroundColor: '#FEE2E2', color: '#B91C1C', border: '1px solid #FCA5A5' }}>
                CORRUPTED DATA
              </span>
            </div>
          </div>
        )}

        {/* Verification Progress Bar & Metrics */}
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #E2E8F0' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#172033' }}>
              Verification Progress: {reviewMetrics.reviewed} / {reviewMetrics.total} Verified ({reviewMetrics.total > 0 ? Math.round((reviewMetrics.reviewed / reviewMetrics.total) * 100) : 0}%)
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {selectedExam && (reviewMetrics.pending > 0 || reviewMetrics.rejected > 0) && (
                <button
                  onClick={handleVerifyAllQuestions}
                  disabled={verifyingAll}
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    padding: '3px 10px',
                    borderRadius: 0,
                    backgroundColor: '#EFF6FF',
                    color: '#0284C7',
                    border: '1px solid #BAE6FD',
                    cursor: verifyingAll ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                  title="Quick verify and approve all questions for this exam"
                >
                  {verifyingAll ? <Loader2 size={12} className="animate-spin" /> : <CheckCheck size={13} />}
                  Verify All
                </button>
              )}
              <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 0, backgroundColor: '#FEF3C7', color: '#B45309', border: '1px solid #FDE68A' }}>
                ⏳ {reviewMetrics.pending} Pending Review
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 0, backgroundColor: '#DCFCE7', color: '#15803D', border: '1px solid #86EFAC' }}>
                ✅ {reviewMetrics.reviewed} Verified
              </span>
              {reviewMetrics.rejected > 0 && (
                <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 0, backgroundColor: '#FEF2F2', color: '#B42318', border: '1px solid #FECDCA' }}>
                  ❌ {reviewMetrics.rejected} Rejected
                </span>
              )}
            </div>
          </div>

          <div style={{ width: '100%', height: 6, backgroundColor: '#E2E8F0', borderRadius: 0, overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                backgroundColor: reviewMetrics.canPublish ? '#16A34A' : 'var(--primary-red)',
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
            borderRadius: 0,
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
            <div style={{ display: 'flex', gap: 4, backgroundColor: '#F1F5F9', padding: 3, borderRadius: 0 }}>
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
                      borderRadius: 0,
                      cursor: 'pointer',
                      backgroundColor: isActive ? '#FFFFFF' : 'transparent',
                      color: isActive ? '#172033' : '#64748B',
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
                  borderRadius: 0,
                  border: '1px solid #CBD5E1',
                  outline: 'none',
                  color: '#172033',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* Question Navigator Rows */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
            {loadingQuestions ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>
                <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px auto', color: 'var(--primary-red)' }} />
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
                const isMissingText = !q.question_text || !q.question_text.trim();
                const isMissingOptions = !q.options || q.options.length === 0;
                const isCorrupted = isMissingText || isMissingOptions || Boolean((q as any).is_corrupted);

                return (
                  <div
                    key={q.id}
                    id={`review-q-item-${idx}`}
                    onClick={() => handleSelectQuestion(idx)}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 0,
                      marginBottom: 8,
                      cursor: 'pointer',
                      border: isCorrupted
                        ? (isSelected ? '1px solid #FCA5A5' : '1px solid #FECACA')
                        : (isSelected ? '1px solid #BFDBFE' : '1px solid #E2E8F0'),
                      borderLeft: isCorrupted
                        ? '4px solid #DC2626'
                        : (isSelected ? '3px solid #E31B23' : '1px solid #E2E8F0'),
                      backgroundColor: isCorrupted
                        ? (isSelected ? '#FEF2F2' : '#FFFBFB')
                        : (isSelected ? '#F8FAFC' : '#FFFFFF'),
                      boxShadow: isSelected ? '0 1px 3px rgba(var(--primary-red-rgb), 0.08)' : 'none',
                      transition: 'all 150ms ease-out',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 800,
                          color: isCorrupted ? '#DC2626' : (isSelected ? 'var(--primary-red)' : '#172033'),
                          backgroundColor: isCorrupted ? '#FEE2E2' : (isSelected ? '#E2E8F0' : '#F1F5F9'),
                          padding: '2px 7px',
                          borderRadius: 0,
                        }}
                      >
                        Q{q.question_number_in_paper}
                      </span>

                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '2px 7px',
                          borderRadius: 0,
                          backgroundColor: isCorrupted ? '#FEF2F2' : isPublished ? '#DCFCE7' : isRejected ? '#FEF2F2' : '#FEF3C7',
                          color: isCorrupted ? '#DC2626' : isPublished ? '#15803D' : isRejected ? '#B42318' : '#B45309',
                          border: isCorrupted ? '1px solid #FCA5A5' : `1px solid ${isPublished ? '#86EFAC' : isRejected ? '#FECDCA' : '#FDE68A'}`,
                        }}
                      >
                        {isCorrupted ? 'Corrupted' : isPublished ? 'Verified' : isRejected ? 'Rejected' : 'Pending'}
                      </span>
                    </div>

                    <div
                      style={{
                        fontSize: 12.5,
                        color: isCorrupted ? '#B91C1C' : (isSelected ? '#172033' : '#475569'),
                        fontWeight: isCorrupted ? 700 : (isSelected ? 600 : 400),
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
                        <Tag size={10} color="var(--primary-red)" />
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
                    borderRadius: 0,
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
                    borderRadius: 0,
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
                            borderRadius: 0,
                            border: isCur ? '1px solid #E31B23' : '1px solid #E2E8F0',
                            backgroundColor: isCur ? 'var(--primary-red)' : '#FFFFFF',
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
                    borderRadius: 0,
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
                    borderRadius: 0,
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
            borderRadius: 0,
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
                  <h2 style={{ fontSize: 20, fontWeight: 700, color: '#172033', margin: 0, letterSpacing: '-0.01em' }}>
                    Question #{activeQuestion.question_number_in_paper}
                  </h2>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      padding: '3px 10px',
                      borderRadius: 0,
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
                      borderRadius: 0,
                      fontSize: 13,
                      fontWeight: 600,
                      border: '1px solid #CBD5E1',
                      backgroundColor: '#FFFFFF',
                      color: '#172033',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
                    }}
                  >
                    <Edit3 size={14} color="var(--primary-red)" />
                    Modify Question & Solutions
                  </button>

                  <button
                    onClick={() => handleRejectQuestion(activeQuestion)}
                    disabled={actionLoadingId === activeQuestion.id}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 0,
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
                      borderRadius: 0,
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

              {/* Question Corrupted / Incomplete Banner */}
              {(!activeQuestion.question_text || !activeQuestion.question_text.trim() || !activeQuestion.options || activeQuestion.options.length === 0) && (
                <div
                  style={{
                    backgroundColor: '#FEF2F2',
                    border: '1px solid #FECACA',
                    borderLeft: '4px solid #DC2626',
                    padding: '12px 16px',
                    marginBottom: 16,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <ShieldAlert size={20} color="#DC2626" />
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: '#B91C1C' }}>
                        Database Record Corrupted / Incomplete
                      </div>
                      <div style={{ fontSize: 12, color: '#991B1B', marginTop: 2 }}>
                        {!activeQuestion.question_text || !activeQuestion.question_text.trim()
                          ? `Question #${activeQuestion.question_number_in_paper} has blank or missing question statement text in database. Click "Modify Question & Solutions" to repair data.`
                          : `Question #${activeQuestion.question_number_in_paper} has 0 answer options in database. Click "Modify Question & Solutions" to configure options.`}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleOpenEditModal(activeQuestion)}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#DC2626',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 0,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Edit3 size={13} />
                    Repair Question
                  </button>
                </div>
              )}

              {/* Question View Mode Selector & Quick Tools */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 20,
                  paddingBottom: 14,
                  borderBottom: '1px solid #E2E8F0',
                  flexWrap: 'wrap',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    onClick={() => setReviewCardMode('publication')}
                    style={{
                      padding: '7px 16px',
                      borderRadius: 0,
                      fontSize: 13,
                      fontWeight: 700,
                      backgroundColor: reviewCardMode === 'publication' ? '#1E3A8A' : '#FFFFFF',
                      color: reviewCardMode === 'publication' ? '#FFFFFF' : '#475569',
                      border: `1px solid ${reviewCardMode === 'publication' ? '#1E3A8A' : '#CBD5E1'}`,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      boxShadow: reviewCardMode === 'publication' ? '0 1px 3px rgba(30, 58, 138, 0.2)' : 'none',
                    }}
                  >
                    <FileText size={14} />
                    Publication Format (Authoritative)
                  </button>
                  <button
                    onClick={() => setReviewCardMode('inspection')}
                    style={{
                      padding: '7px 16px',
                      borderRadius: 0,
                      fontSize: 13,
                      fontWeight: 700,
                      backgroundColor: reviewCardMode === 'inspection' ? '#1E3A8A' : '#FFFFFF',
                      color: reviewCardMode === 'inspection' ? '#FFFFFF' : '#475569',
                      border: `1px solid ${reviewCardMode === 'inspection' ? '#1E3A8A' : '#CBD5E1'}`,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      boxShadow: reviewCardMode === 'inspection' ? '0 1px 3px rgba(30, 58, 138, 0.2)' : 'none',
                    }}
                  >
                    <Layers size={14} />
                    Taxonomy & Distractor Cards
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    onClick={() => setShowTaxonomyWeights((prev) => !prev)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 0,
                      fontSize: 12,
                      fontWeight: 600,
                      backgroundColor: showTaxonomyWeights ? '#EFF6FF' : '#FFFFFF',
                      color: '#1E3A8A',
                      border: '1px solid #BFDBFE',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <FolderTree size={14} />
                    {showTaxonomyWeights ? 'Hide Concept Relevance Mappings' : `Concept Relevance (${activeQuestion.hierarchy?.length || 1})`}
                  </button>
                </div>
              </div>

              {reviewCardMode === 'publication' ? (
                <div style={{ marginBottom: 28 }}>
                  {/* Authoritative Publication Card matching Reference Image */}
                  <AdminQuestionPublicationCard
                    question={activeQuestion}
                    questionNumber={activeQuestion.question_number_in_paper}
                    style={{ marginBottom: 20 }}
                  />

                  {/* Optional Points to Remember / Common Traps Box */}
                  {activeQuestion.explanation?.common_traps && activeQuestion.explanation.common_traps.length > 0 && (
                    <div style={{ backgroundColor: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 0, padding: '14px 18px', marginBottom: 20 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#B45309', marginBottom: 6 }}>
                        <AlertTriangle size={15} />
                        Points to Remember & Common Traps
                      </div>
                      <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#92400E', lineHeight: 1.6 }}>
                        {activeQuestion.explanation.common_traps.map((trap, tIdx) => (
                          <li key={tIdx} style={{ marginBottom: 4 }}>
                            {trap}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Expandable Syllabus Hierarchy & Concept Relevance Mappings */}
                  {showTaxonomyWeights && (
                    <div
                      style={{
                        backgroundColor: '#FFFFFF',
                        borderRadius: 0,
                        padding: '16px 20px',
                        marginBottom: 20,
                        border: '1px solid #E2E8F0',
                        boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <FolderTree size={16} color="var(--primary-red)" />
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#172033' }}>
                            Syllabus Hierarchy & Concept Relevance Mappings
                          </span>
                          <span
                            style={{
                              padding: '2px 8px',
                              backgroundColor: '#F8FAFC',
                              color: 'var(--primary-red)',
                              borderRadius: 0,
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
                            borderRadius: 0,
                            fontSize: 12,
                            fontWeight: 600,
                            color: 'var(--primary-red)',
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
                          const badgeColor = pct >= 80 ? '#3A8B53' : pct >= 50 ? 'var(--primary-red)' : '#F2B623';
                          const badgeBg = pct >= 80 ? '#ECFDF5' : pct >= 50 ? '#F8FAFC' : '#FFFBEB';
                          const badgeBorder = pct >= 80 ? '#A7F3D0' : pct >= 50 ? '#BFDBFE' : '#FDE68A';

                          return (
                            <div
                              key={hIdx}
                              style={{
                                backgroundColor: isPrim ? '#FAFCFF' : '#FAFAFA',
                                border: isPrim ? '1.5px solid #93C5FD' : '1px solid #E2E8F0',
                                borderRadius: 0,
                                padding: '12px 14px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 8,
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  {isPrim ? (
                                    <Tag size={14} color="var(--primary-red)" />
                                  ) : (
                                    <GitBranch size={14} color="#64748B" />
                                  )}
                                  <span style={{ fontSize: 12.5, fontWeight: 700, color: isPrim ? '#A4161A' : '#334155' }}>
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
                                      borderRadius: 0,
                                      backgroundColor: isPrim ? '#E2E8F0' : '#F1F5F9',
                                      color: isPrim ? '#A4161A' : '#475569',
                                    }}
                                  >
                                    {isPrim ? 'PRIMARY' : 'INTERDISCIPLINARY'}
                                  </span>
                                  <span
                                    style={{
                                      fontSize: 11,
                                      fontWeight: 800,
                                      padding: '2px 7px',
                                      borderRadius: 0,
                                      backgroundColor: badgeBg,
                                      color: badgeColor,
                                      border: `1px solid ${badgeBorder}`,
                                    }}
                                  >
                                    {pct}%
                                  </span>
                                </div>
                              </div>

                              <div style={{ fontSize: 12, color: '#475569', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                                <span style={{ fontWeight: 600, color: '#172033' }}>{hItem.subject_name || 'General Studies'}</span>
                                <span style={{ color: '#94A3B8' }}>›</span>
                                <span style={{ fontWeight: 600, color: 'var(--primary-red)' }}>{hItem.topic_name || 'General Concepts'}</span>
                                {hItem.subtopic_name && (
                                  <>
                                    <span style={{ color: '#94A3B8' }}>›</span>
                                    <span style={{ fontWeight: 500, color: '#64748B' }}>{hItem.subtopic_name}</span>
                                  </>
                                )}
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                                <div style={{ flex: 1, height: 6, backgroundColor: '#E2E8F0', borderRadius: 0, overflow: 'hidden' }}>
                                  <div
                                    style={{
                                      width: `${pct}%`,
                                      height: '100%',
                                      backgroundColor: badgeColor,
                                      borderRadius: 0,
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
                  )}
                </div>
              ) : (
                /* Inspection View with Individual Cards */
                <div>
                  {/* Taxonomy & Metadata Details Bar */}
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: 12,
                      backgroundColor: '#FAFAFA',
                      padding: '12px 18px',
                      borderRadius: 0,
                      marginBottom: 16,
                      fontSize: 12.5,
                      border: '1px solid #E2E8F0',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#172033', fontWeight: 600 }}>
                      <FolderTree size={15} color="var(--primary-red)" />
                      <span>Subject:</span>
                      <span style={{ color: 'var(--primary-red)' }}>{activeQuestion.subject_name || 'General Studies'}</span>
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
                      <span>Difficulty: <strong style={{ color: '#172033' }}>{activeQuestion.difficulty}</strong></span>
                      <span>Marks: <strong style={{ color: '#172033' }}>+{activeQuestion.marks} / -{activeQuestion.negative_marks || 0.66}</strong></span>
                      <span>Time: <strong style={{ color: '#172033' }}>{activeQuestion.expected_time_seconds || 60}s</strong></span>
                    </div>
                  </div>

                  {/* Authoritative Taxonomy & Interdisciplinary Concepts with Relevance Percentage */}
                  <div
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: 0,
                      padding: '14px 18px',
                      marginBottom: 24,
                      border: '1px solid #E2E8F0',
                      boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <FolderTree size={16} color="var(--primary-red)" />
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#172033' }}>
                          Syllabus Hierarchy & Concept Relevance Mappings
                        </span>
                        <span
                          style={{
                            padding: '2px 8px',
                            backgroundColor: '#F8FAFC',
                            color: 'var(--primary-red)',
                            borderRadius: 0,
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
                          borderRadius: 0,
                          fontSize: 12,
                          fontWeight: 600,
                          color: 'var(--primary-red)',
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
                        const badgeColor = pct >= 80 ? '#3A8B53' : pct >= 50 ? 'var(--primary-red)' : '#F2B623';
                        const badgeBg = pct >= 80 ? '#ECFDF5' : pct >= 50 ? '#F8FAFC' : '#FFFBEB';
                        const badgeBorder = pct >= 80 ? '#A7F3D0' : pct >= 50 ? '#BFDBFE' : '#FDE68A';

                        return (
                          <div
                            key={hIdx}
                            style={{
                              backgroundColor: isPrim ? '#FAFCFF' : '#FAFAFA',
                              border: isPrim ? '1.5px solid #93C5FD' : '1px solid #E2E8F0',
                              borderRadius: 0,
                              padding: '12px 14px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 8,
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                {isPrim ? (
                                    <Tag size={14} color="var(--primary-red)" />
                                ) : (
                                    <GitBranch size={14} color="#64748B" />
                                )}
                                <span style={{ fontSize: 12.5, fontWeight: 700, color: isPrim ? '#A4161A' : '#334155' }}>
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
                                    borderRadius: 0,
                                    backgroundColor: isPrim ? '#E2E8F0' : '#F1F5F9',
                                    color: isPrim ? '#A4161A' : '#475569',
                                  }}
                                >
                                  {isPrim ? 'PRIMARY' : 'INTERDISCIPLINARY'}
                                </span>
                                <span
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 800,
                                    padding: '2px 7px',
                                    borderRadius: 0,
                                    backgroundColor: badgeBg,
                                    color: badgeColor,
                                    border: `1px solid ${badgeBorder}`,
                                  }}
                                >
                                  {pct}%
                                </span>
                              </div>
                            </div>

                            <div style={{ fontSize: 12, color: '#475569', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                              <span style={{ fontWeight: 600, color: '#172033' }}>{hItem.subject_name || 'General Studies'}</span>
                              <span style={{ color: '#94A3B8' }}>›</span>
                              <span style={{ fontWeight: 600, color: 'var(--primary-red)' }}>{hItem.topic_name || 'General Concepts'}</span>
                              {hItem.subtopic_name && (
                                <>
                                  <span style={{ color: '#94A3B8' }}>›</span>
                                  <span style={{ fontWeight: 500, color: '#64748B' }}>{hItem.subtopic_name}</span>
                                </>
                              )}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                              <div style={{ flex: 1, height: 6, backgroundColor: '#E2E8F0', borderRadius: 0, overflow: 'hidden' }}>
                                <div
                                  style={{
                                    width: `${pct}%`,
                                    height: '100%',
                                    backgroundColor: badgeColor,
                                    borderRadius: 0,
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
                        borderRadius: 0,
                        padding: '18px 22px',
                        marginBottom: 24,
                        border: '1px solid #E2E8F0',
                        borderLeft: '4px solid #E31B23',
                      }}
                    >
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--primary-red)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
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
                      borderRadius: 0,
                      padding: '22px 24px',
                      border: '1px solid #E2E8F0',
                      marginBottom: 28,
                      boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)',
                    }}
                  >
                    <div style={{ fontSize: 17, fontWeight: 600, color: '#172033', lineHeight: 1.65, whiteSpace: 'pre-wrap', letterSpacing: '-0.01em' }}>
                      {activeQuestion.question_text}
                    </div>
                  </div>

                  {/* Options & Distractor Analysis Section */}
                  <div style={{ marginBottom: 32 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#172033', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Layers size={17} color="var(--primary-red)" />
                      <span>Options & Option Explanations (Distractor Analysis)</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }}>
                      {activeQuestion.options.map((opt) => (
                        <div
                          key={opt.option_label}
                          style={{
                            borderRadius: 0,
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
                                borderRadius: 0,
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
                              <div style={{ fontSize: 15, fontWeight: opt.is_correct ? 700 : 500, color: '#172033', lineHeight: 1.4 }}>
                                {opt.option_text || '(Empty Option Text)'}
                              </div>

                              {/* Distractor Explanation Academic Box */}
                              <div
                                style={{
                                  marginTop: 10,
                                  padding: '10px 14px',
                                  borderRadius: 0,
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
                                  borderRadius: 0,
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

                  {/* Solution Parameters Knowledge Base */}
                  <div style={{ marginBottom: 32 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#172033', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <BookOpen size={17} color="var(--primary-red)" />
                      <span>Knowledge Base & Common Traps Analysis</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }}>
                      {/* Points to Remember / Common Traps */}
                      <div style={{ backgroundColor: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 0, padding: '16px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#B45309', marginBottom: 8 }}>
                          <AlertTriangle size={15} />
                          Points to Remember & Common Traps
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
                    </div>
                  </div>
                </div>
              )}

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
                    borderRadius: 0,
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
                    borderRadius: 0,
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
              <div style={{ fontSize: 15, fontWeight: 700, color: '#172033' }}>Select a question from the left sidebar</div>
            </div>
          )}
        </div>
      </div>

      {/* ============================================================= */}
      {/* MODAL 1: Simplified Question & Solutions Editor */}
      {/* ============================================================= */}
      {editingQuestion && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 8,
              width: '100%',
              maxWidth: 940,
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
              border: '1px solid #E2E8F0',
              overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid #E2E8F0',
                backgroundColor: '#FFFFFF',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <h2 style={{ fontSize: 17, fontWeight: 700, color: '#0F172A', margin: 0 }}>
                    Modify Question #{editingQuestion.question_number_in_paper} & Solutions
                  </h2>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 4,
                      backgroundColor: editingQuestion.status === 'PUBLISHED' ? '#DCFCE7' : '#FEF3C7',
                      color: editingQuestion.status === 'PUBLISHED' ? '#15803D' : '#B45309',
                      border: `1px solid ${editingQuestion.status === 'PUBLISHED' ? '#BBF7D0' : '#FDE68A'}`,
                    }}
                  >
                    {editingQuestion.status || 'DRAFT'}
                  </span>
                  {editSubjectName && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: 4,
                        backgroundColor: '#F1F5F9',
                        color: '#475569',
                        border: '1px solid #E2E8F0',
                      }}
                    >
                      {editSubjectName}
                    </span>
                  )}
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '2px 7px',
                      borderRadius: 4,
                      backgroundColor: editDifficulty === 'HARD' ? '#FEE2E2' : editDifficulty === 'MEDIUM' ? '#FEF3C7' : '#DCFCE7',
                      color: editDifficulty === 'HARD' ? '#B91C1C' : editDifficulty === 'MEDIUM' ? '#B45309' : '#15803D',
                    }}
                  >
                    {editDifficulty}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingQuestion(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#64748B',
                    padding: 4,
                    borderRadius: 4,
                  }}
                  title="Close (Esc)"
                >
                  <X size={20} />
                </button>
              </div>

              <div style={{ fontSize: 12, color: '#64748B', marginBottom: 12 }}>
                Easily edit question stem, answer choices, reverse logic explanations, and comprehensive solutions.
              </div>

              {/* Segmented Tab Navigation */}
              <div
                style={{
                  display: 'flex',
                  gap: 6,
                  borderBottom: '1px solid #E2E8F0',
                  paddingBottom: 0,
                  marginBottom: -16,
                  overflowX: 'auto',
                }}
              >
                <button
                  type="button"
                  onClick={() => setEditModalTab('options')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 14px',
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: 'none',
                    background: 'none',
                    color: editModalTab === 'options' ? '#0F172A' : '#64748B',
                    borderBottom: editModalTab === 'options' ? '2.5px solid #16A34A' : '2.5px solid transparent',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <CheckCircle2 size={14} color={editModalTab === 'options' ? '#16A34A' : '#64748B'} />
                  Question & Choices
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '1px 5px',
                      borderRadius: 10,
                      backgroundColor: editModalTab === 'options' ? '#DCFCE7' : '#F1F5F9',
                      color: editModalTab === 'options' ? '#16A34A' : '#64748B',
                    }}
                  >
                    {editOptions.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setEditModalTab('solution')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 14px',
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: 'none',
                    background: 'none',
                    color: editModalTab === 'solution' ? '#0F172A' : '#64748B',
                    borderBottom: editModalTab === 'solution' ? '2.5px solid #16A34A' : '2.5px solid transparent',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <FileText size={14} color={editModalTab === 'solution' ? '#16A34A' : '#64748B'} />
                  Detailed Solution & Traps
                  {editCommonTraps.length > 0 && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '1px 5px',
                        borderRadius: 10,
                        backgroundColor: '#FEF3C7',
                        color: '#92400E',
                      }}
                    >
                      {editCommonTraps.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setEditModalTab('classification')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 14px',
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: 'none',
                    background: 'none',
                    color: editModalTab === 'classification' ? '#0F172A' : '#64748B',
                    borderBottom: editModalTab === 'classification' ? '2.5px solid #16A34A' : '2.5px solid transparent',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Tag size={14} color={editModalTab === 'classification' ? '#16A34A' : '#64748B'} />
                  Taxonomy & Marks
                </button>

                <button
                  type="button"
                  onClick={() => setEditModalTab('all')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 14px',
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: 'none',
                    background: 'none',
                    marginLeft: 'auto',
                    color: editModalTab === 'all' ? '#0F172A' : '#94A3B8',
                    borderBottom: editModalTab === 'all' ? '2.5px solid #16A34A' : '2.5px solid transparent',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Layers size={14} color={editModalTab === 'all' ? '#16A34A' : '#94A3B8'} />
                  View All Sections
                </button>
              </div>
            </div>

            {/* Modal Scrollable Body */}
            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, backgroundColor: '#F8FAFC' }}>
              {/* TAB 1: Question Stem & Choices */}
              {(editModalTab === 'options' || editModalTab === 'all') && (
                <div style={{ marginBottom: editModalTab === 'all' ? 24 : 0 }}>
                  {/* Card: Question Stem */}
                  <div
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: 6,
                      border: '1px solid #E2E8F0',
                      padding: 16,
                      marginBottom: 16,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <label style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
                        Question Stem / Statement
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 11.5, color: '#94A3B8' }}>
                          {editQuestionText.trim().split(/\s+/).filter(Boolean).length} words &nbsp;•&nbsp; {editQuestionText.length} chars
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowPassageField(!showPassageField)}
                          style={{
                            fontSize: 11.5,
                            fontWeight: 600,
                            color: showPassageField ? '#DC2626' : '#2563EB',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                          }}
                        >
                          {showPassageField ? '− Hide Reading Passage' : '+ Add / Edit Reading Passage'}
                        </button>
                      </div>
                    </div>

                    {showPassageField && (
                      <div style={{ marginBottom: 12 }}>
                        <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                          Context Passage / Comprehension Text:
                        </label>
                        <textarea
                          rows={3}
                          value={editPassageText}
                          onChange={(e) => setEditPassageText(e.target.value)}
                          placeholder="Enter reading passage or contextual text if applicable..."
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            fontSize: 13,
                            borderRadius: 4,
                            border: '1px solid #CBD5E1',
                            boxSizing: 'border-box',
                            fontFamily: 'inherit',
                            backgroundColor: '#F8FAFC',
                          }}
                        />
                      </div>
                    )}

                    <textarea
                      rows={4}
                      value={editQuestionText}
                      onChange={(e) => setEditQuestionText(e.target.value)}
                      placeholder="Enter the full question statement..."
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        fontSize: 13.5,
                        lineHeight: 1.5,
                        borderRadius: 4,
                        border: '1px solid #CBD5E1',
                        boxSizing: 'border-box',
                        fontFamily: 'inherit',
                        outline: 'none',
                      }}
                    />
                  </div>

                  {/* Card: Answer Choices & Reverse Logic */}
                  <div
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: 8,
                      border: '1px solid #E2E8F0',
                      padding: '18px 20px',
                      boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)',
                    }}
                  >
                    {/* Header Bar with Option-wise Filter & Expand/Collapse All */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 16,
                        paddingBottom: 14,
                        borderBottom: '1px solid #F1F5F9',
                        flexWrap: 'wrap',
                        gap: 12,
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span>Answer Choices & Reverse Logic</span>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 12,
                              backgroundColor: '#F1F5F9',
                              color: '#475569',
                            }}
                          >
                            {editOptions.length} Choices
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: '#64748B', marginTop: 3 }}>
                          Select the correct answer option and manage option-wise reverse logic & psychological distractor traps.
                        </div>
                      </div>

                      {/* Right Toolbar: Quick Option Filter Tabs & Expand/Collapse All */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        {/* Option Filter Selector */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 3,
                            backgroundColor: '#F1F5F9',
                            padding: 3,
                            borderRadius: 6,
                            border: '1px solid #E2E8F0',
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedOptionFilter('ALL')}
                            style={{
                              padding: '4px 10px',
                              fontSize: 11.5,
                              fontWeight: selectedOptionFilter === 'ALL' ? 700 : 500,
                              borderRadius: 4,
                              border: 'none',
                              backgroundColor: selectedOptionFilter === 'ALL' ? '#FFFFFF' : 'transparent',
                              color: selectedOptionFilter === 'ALL' ? '#0F172A' : '#64748B',
                              boxShadow: selectedOptionFilter === 'ALL' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            All
                          </button>
                          {editOptions.map((opt, oIdx) => (
                            <button
                              key={opt.option_label}
                              type="button"
                              onClick={() => {
                                setSelectedOptionFilter(oIdx);
                                setExpandedOptionIdxs((prev) => ({ ...prev, [oIdx]: true }));
                              }}
                              style={{
                                padding: '4px 9px',
                                fontSize: 11.5,
                                fontWeight: selectedOptionFilter === oIdx ? 700 : 500,
                                borderRadius: 4,
                                border: 'none',
                                backgroundColor: selectedOptionFilter === oIdx ? (opt.is_correct ? '#DCFCE7' : '#FFFFFF') : 'transparent',
                                color: selectedOptionFilter === oIdx ? (opt.is_correct ? '#15803D' : '#0F172A') : '#64748B',
                                boxShadow: selectedOptionFilter === oIdx ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              {opt.option_label} {opt.is_correct ? '✓' : ''}
                            </button>
                          ))}
                        </div>

                        {/* Expand / Collapse All Toggle */}
                        <button
                          type="button"
                          onClick={() => {
                            const allExpanded = editOptions.every((_, i) => expandedOptionIdxs[i]);
                            if (allExpanded) {
                              setExpandedOptionIdxs({});
                            } else {
                              const next: Record<number, boolean> = {};
                              editOptions.forEach((_, i) => { next[i] = true; });
                              setExpandedOptionIdxs(next);
                            }
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '6px 11px',
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 600,
                            backgroundColor: '#FFFFFF',
                            color: '#475569',
                            border: '1px solid #CBD5E1',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <ChevronsUpDown size={13} />
                          <span>
                            {editOptions.every((_, i) => expandedOptionIdxs[i]) ? 'Collapse All' : 'Expand All'}
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Options List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {editOptions.map((opt, idx) => {
                        // If filter is active and not matching, hide
                        if (selectedOptionFilter !== 'ALL' && selectedOptionFilter !== idx) {
                          return null;
                        }

                        const isExpanded = Boolean(expandedOptionIdxs[idx]);
                        const hasDistractorContent = Boolean(
                          opt.use_split_fields
                            ? (opt.why_tempting && opt.why_tempting.trim().length > 0) || (opt.whats_actually_true && opt.whats_actually_true.trim().length > 0)
                            : (opt.distractor_analysis && opt.distractor_analysis.trim().length > 0)
                        );
                        const hasRationaleContent = Boolean(opt.distractor_analysis && opt.distractor_analysis.trim().length > 0);

                        return (
                          <div
                            key={opt.option_label || idx}
                            style={{
                              padding: 14,
                              backgroundColor: opt.is_correct ? '#F0FDF4' : '#FFFFFF',
                              border: opt.is_correct
                                ? '1.5px solid #16A34A'
                                : isExpanded
                                ? '1.5px solid #94A3B8'
                                : '1px solid #E2E8F0',
                              borderRadius: 8,
                              boxShadow: opt.is_correct
                                ? '0 1px 4px rgba(22, 163, 74, 0.08)'
                                : isExpanded
                                ? '0 2px 6px rgba(15, 23, 42, 0.04)'
                                : 'none',
                              transition: 'all 0.2s ease',
                            }}
                          >
                            {/* Option Header Row */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                              {/* Option Letter Avatar */}
                              <div
                                style={{
                                  width: 30,
                                  height: 30,
                                  borderRadius: 6,
                                  backgroundColor: opt.is_correct ? '#16A34A' : '#475569',
                                  color: '#FFFFFF',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: 800,
                                  fontSize: 13.5,
                                  flexShrink: 0,
                                  boxShadow: opt.is_correct ? '0 2px 4px rgba(22, 163, 74, 0.25)' : 'none',
                                }}
                              >
                                {opt.option_label}
                              </div>

                              {/* Option Text Input */}
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
                                style={{
                                  flex: 1,
                                  minWidth: 180,
                                  padding: '8px 12px',
                                  fontSize: 13.5,
                                  fontWeight: 500,
                                  borderRadius: 6,
                                  border: opt.is_correct ? '1px solid #86EFAC' : '1px solid #CBD5E1',
                                  backgroundColor: '#FFFFFF',
                                  outline: 'none',
                                  boxSizing: 'border-box',
                                  transition: 'border-color 0.15s',
                                }}
                              />

                              {/* Correct Answer Button / Badge */}
                              <button
                                type="button"
                                onClick={() => {
                                  setEditOptions((prev) =>
                                    prev.map((o, i) => ({ ...o, is_correct: i === idx }))
                                  );
                                  // Open the newly selected correct option's rationale
                                  setExpandedOptionIdxs((prev) => ({ ...prev, [idx]: true }));
                                }}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  fontSize: 12,
                                  fontWeight: 700,
                                  color: opt.is_correct ? '#15803D' : '#64748B',
                                  cursor: 'pointer',
                                  padding: '6px 12px',
                                  borderRadius: 6,
                                  backgroundColor: opt.is_correct ? '#DCFCE7' : '#F1F5F9',
                                  border: `1px solid ${opt.is_correct ? '#86EFAC' : '#E2E8F0'}`,
                                  flexShrink: 0,
                                  userSelect: 'none',
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                {opt.is_correct ? (
                                  <>
                                    <CheckCircle2 size={14} color="#16A34A" />
                                    <span>✓ Correct Answer</span>
                                  </>
                                ) : (
                                  <>
                                    <span style={{ width: 7, height: 7, borderRadius: '50%', border: '1.5px solid #94A3B8' }} />
                                    <span>Mark as Correct</span>
                                  </>
                                )}
                              </button>

                              {/* The Dropdown Trigger for Reverse Logic / Distractor Analysis */}
                              <button
                                type="button"
                                onClick={() => toggleOptionExpanded(idx)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 7,
                                  padding: '6px 12px',
                                  borderRadius: 6,
                                  fontSize: 12,
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  backgroundColor: isExpanded ? '#EFF6FF' : '#FFFFFF',
                                  border: `1px solid ${isExpanded ? '#93C5FD' : '#CBD5E1'}`,
                                  color: isExpanded ? '#1D4ED8' : '#334155',
                                  boxShadow: isExpanded ? '0 1px 3px rgba(37, 99, 235, 0.1)' : '0 1px 2px rgba(0,0,0,0.02)',
                                  transition: 'all 0.15s ease',
                                  flexShrink: 0,
                                }}
                                title={isExpanded ? 'Collapse Reverse Logic' : 'Expand Reverse Logic & Distractor Analysis'}
                              >
                                {opt.is_correct ? (
                                  <CheckCircle2 size={13} color="#16A34A" />
                                ) : (
                                  <Lightbulb size={13} color={isExpanded ? '#2563EB' : '#D97706'} />
                                )}
                                <span>
                                  {opt.is_correct ? 'Rationale & Facts' : 'Reverse Logic / Distractor'}
                                </span>

                                {/* Status Pill inside button */}
                                {opt.is_correct ? (
                                  <span
                                    style={{
                                      fontSize: 10.5,
                                      fontWeight: 700,
                                      padding: '1px 6px',
                                      borderRadius: 10,
                                      backgroundColor: hasRationaleContent ? '#DCFCE7' : '#F1F5F9',
                                      color: hasRationaleContent ? '#15803D' : '#64748B',
                                      border: `1px solid ${hasRationaleContent ? '#BBF7D0' : '#E2E8F0'}`,
                                    }}
                                  >
                                    {hasRationaleContent ? 'Ready' : 'Empty'}
                                  </span>
                                ) : (
                                  <span
                                    style={{
                                      fontSize: 10.5,
                                      fontWeight: 700,
                                      padding: '1px 6px',
                                      borderRadius: 10,
                                      backgroundColor: hasDistractorContent ? '#FEF3C7' : '#F1F5F9',
                                      color: hasDistractorContent ? '#B45309' : '#64748B',
                                      border: `1px solid ${hasDistractorContent ? '#FDE68A' : '#E2E8F0'}`,
                                    }}
                                  >
                                    {hasDistractorContent ? (opt.use_split_fields ? 'Trap + Reality' : 'Single') : 'Empty'}
                                  </span>
                                )}

                                <ChevronDown
                                  size={13}
                                  style={{
                                    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                    transition: 'transform 0.2s ease',
                                    color: isExpanded ? '#1D4ED8' : '#64748B',
                                  }}
                                />
                              </button>
                            </div>

                            {/* Collapsed One-Line Snippet Preview */}
                            {!isExpanded && (
                              <div
                                onClick={() => toggleOptionExpanded(idx)}
                                style={{
                                  marginTop: 8,
                                  padding: '5px 10px',
                                  borderRadius: 5,
                                  backgroundColor: opt.is_correct ? '#F0FDF4' : '#F8FAFC',
                                  border: `1px dashed ${opt.is_correct ? '#BBF7D0' : '#E2E8F0'}`,
                                  fontSize: 11.5,
                                  color: '#64748B',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: 8,
                                }}
                              >
                                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
                                  {opt.is_correct ? (
                                    <>
                                      <span style={{ fontWeight: 700, color: '#16A34A' }}>✓ Rationale:</span>
                                      <span style={{ color: opt.distractor_analysis ? '#334155' : '#94A3B8' }}>
                                        {opt.distractor_analysis || '(No rationale added yet)'}
                                      </span>
                                    </>
                                  ) : opt.use_split_fields ? (
                                    <>
                                      <span style={{ fontWeight: 700, color: '#B45309' }}>💭 Trap:</span>
                                      <span style={{ color: opt.why_tempting ? '#334155' : '#94A3B8' }}>
                                        {opt.why_tempting || 'None'}
                                      </span>
                                      <span style={{ color: '#CBD5E1' }}>•</span>
                                      <span style={{ fontWeight: 700, color: '#0369A1' }}>💡 Reality:</span>
                                      <span style={{ color: opt.whats_actually_true ? '#334155' : '#94A3B8' }}>
                                        {opt.whats_actually_true || 'None'}
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      <span style={{ fontWeight: 700, color: '#475569' }}>Explanation:</span>
                                      <span style={{ color: opt.distractor_analysis ? '#334155' : '#94A3B8' }}>
                                        {opt.distractor_analysis || '(No explanation added yet)'}
                                      </span>
                                    </>
                                  )}
                                </div>
                                <span style={{ fontSize: 11, fontWeight: 600, color: '#2563EB', flexShrink: 0 }}>
                                  Open Dropdown ▾
                                </span>
                              </div>
                            )}

                            {/* Expanded Reverse Logic / Distractor Analysis Panel */}
                            {isExpanded && (
                              <div
                                style={{
                                  marginTop: 12,
                                  padding: '14px 16px',
                                  borderRadius: 8,
                                  backgroundColor: opt.is_correct ? '#FFFFFF' : '#FAFAFA',
                                  border: opt.is_correct ? '1px solid #BBF7D0' : '1px solid #E2E8F0',
                                }}
                              >
                                {opt.is_correct ? (
                                  /* Correct Option Rationale */
                                  <div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <CheckCircle2 size={14} color="#16A34A" />
                                        <label style={{ fontSize: 12, fontWeight: 700, color: '#15803D' }}>
                                          ✓ Correct Answer Rationale / Key Fact:
                                        </label>
                                      </div>
                                      <span style={{ fontSize: 11, color: '#64748B' }}>
                                        {getWordAndCharCount(opt.distractor_analysis)}
                                      </span>
                                    </div>
                                    <p style={{ fontSize: 11.5, color: '#475569', margin: '0 0 8px 0', lineHeight: 1.4 }}>
                                      State why Option {opt.option_label} is strictly true and reference historical, scientific, or official syllabus facts.
                                    </p>
                                    <textarea
                                      rows={3}
                                      value={opt.distractor_analysis}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setEditOptions((prev) =>
                                          prev.map((o, i) => (i === idx ? { ...o, distractor_analysis: val } : o))
                                        );
                                      }}
                                      placeholder="Explain why this option is correct and key factual/historical points..."
                                      style={{
                                        width: '100%',
                                        padding: '9px 12px',
                                        fontSize: 13,
                                        lineHeight: 1.55,
                                        borderRadius: 6,
                                        border: '1.5px solid #86EFAC',
                                        backgroundColor: '#FFFFFF',
                                        boxSizing: 'border-box',
                                        fontFamily: 'inherit',
                                        outline: 'none',
                                      }}
                                    />
                                  </div>
                                ) : (
                                  /* Incorrect Option Reverse Logic / Distractor Analysis */
                                  <div>
                                    {/* Subheader & Modern Segmented Switch */}
                                    <div
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        marginBottom: 10,
                                        flexWrap: 'wrap',
                                        gap: 8,
                                      }}
                                    >
                                      <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                          <Sparkles size={14} color="#D97706" />
                                          <label style={{ fontSize: 12.5, fontWeight: 700, color: '#1E293B' }}>
                                            Reverse Logic / Distractor Analysis (Option {opt.option_label}):
                                          </label>
                                        </div>
                                        <div style={{ fontSize: 11, color: '#64748B', marginTop: 1 }}>
                                          Psychological trap analysis explaining candidate misconceptions vs factual truth.
                                        </div>
                                      </div>

                                      {/* Segmented Mode Control */}
                                      <div
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          backgroundColor: '#E2E8F0',
                                          padding: 2,
                                          borderRadius: 6,
                                          gap: 2,
                                        }}
                                      >
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditOptions((prev) =>
                                              prev.map((o, i) =>
                                                i === idx ? { ...o, use_split_fields: true } : o
                                              )
                                            );
                                          }}
                                          style={{
                                            padding: '4px 10px',
                                            fontSize: 11,
                                            fontWeight: opt.use_split_fields ? 700 : 500,
                                            backgroundColor: opt.use_split_fields ? '#FFFFFF' : 'transparent',
                                            color: opt.use_split_fields ? '#0F172A' : '#64748B',
                                            border: 'none',
                                            borderRadius: 4,
                                            cursor: 'pointer',
                                            boxShadow: opt.use_split_fields ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                                            transition: 'all 0.15s ease',
                                          }}
                                        >
                                          ⚡ Split (Trap & Reality)
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditOptions((prev) =>
                                              prev.map((o, i) =>
                                                i === idx ? { ...o, use_split_fields: false } : o
                                              )
                                            );
                                          }}
                                          style={{
                                            padding: '4px 10px',
                                            fontSize: 11,
                                            fontWeight: !opt.use_split_fields ? 700 : 500,
                                            backgroundColor: !opt.use_split_fields ? '#FFFFFF' : 'transparent',
                                            color: !opt.use_split_fields ? '#0F172A' : '#64748B',
                                            border: 'none',
                                            borderRadius: 4,
                                            cursor: 'pointer',
                                            boxShadow: !opt.use_split_fields ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                                            transition: 'all 0.15s ease',
                                          }}
                                        >
                                          📄 Single Field
                                        </button>
                                      </div>
                                    </div>

                                    {opt.use_split_fields ? (
                                      /* Dual Structured Cards: Trap + Reality */
                                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                        {/* Box 1: Why Candidates Find It Tempting (Trap) */}
                                        <div
                                          style={{
                                            backgroundColor: '#FFFBEB',
                                            border: '1.5px solid #FDE68A',
                                            borderRadius: 8,
                                            padding: '12px 14px',
                                          }}
                                        >
                                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, color: '#B45309' }}>
                                              <span>💭</span>
                                              <span>Why Candidates Find It Tempting (Trap):</span>
                                            </label>
                                            <span style={{ fontSize: 10.5, color: '#B45309', fontWeight: 600 }}>
                                              {getWordAndCharCount(opt.why_tempting)}
                                            </span>
                                          </div>
                                          <p style={{ fontSize: 11, color: '#92400E', margin: '0 0 6px 0', lineHeight: 1.35 }}>
                                            Why an aspirant might plausibly select this distractor (e.g. familiar keyword, partial overlap).
                                          </p>
                                          <textarea
                                            rows={3}
                                            value={opt.why_tempting || ''}
                                            onChange={(e) => {
                                              const val = e.target.value;
                                              setEditOptions((prev) =>
                                                prev.map((o, i) => (i === idx ? { ...o, why_tempting: val } : o))
                                              );
                                            }}
                                            placeholder="e.g. Tempting because Gandhara is a genuine, famous ancient Buddhist-art centre that could seem plausibly connected..."
                                            style={{
                                              width: '100%',
                                              padding: '8px 12px',
                                              fontSize: 12.5,
                                              lineHeight: 1.55,
                                              borderRadius: 6,
                                              border: '1px solid #FCD34D',
                                              backgroundColor: '#FFFFFF',
                                              boxSizing: 'border-box',
                                              fontFamily: 'inherit',
                                              outline: 'none',
                                            }}
                                          />
                                        </div>

                                        {/* Box 2: What Is Actually True (Factual Correction) */}
                                        <div
                                          style={{
                                            backgroundColor: '#F0F9FF',
                                            border: '1.5px solid #BAE6FD',
                                            borderRadius: 8,
                                            padding: '12px 14px',
                                          }}
                                        >
                                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, color: '#0369A1' }}>
                                              <span>💡</span>
                                              <span>What Is Actually True (Factual Correction):</span>
                                            </label>
                                            <span style={{ fontSize: 10.5, color: '#0369A1', fontWeight: 600 }}>
                                              {getWordAndCharCount(opt.whats_actually_true)}
                                            </span>
                                          </div>
                                          <p style={{ fontSize: 11, color: '#0284C7', margin: '0 0 6px 0', lineHeight: 1.35 }}>
                                            Authoritative factual reason disproving this choice (e.g. different region, era, or jurisdiction).
                                          </p>
                                          <textarea
                                            rows={3}
                                            value={opt.whats_actually_true || ''}
                                            onChange={(e) => {
                                              const val = e.target.value;
                                              setEditOptions((prev) =>
                                                prev.map((o, i) => (i === idx ? { ...o, whats_actually_true: val } : o))
                                              );
                                            }}
                                            placeholder="e.g. Gandhara's Buddhist significance is in a different region (northwest, present Pakistan/Afghanistan border), not Dhanyakataka (Andhra)..."
                                            style={{
                                              width: '100%',
                                              padding: '8px 12px',
                                              fontSize: 12.5,
                                              lineHeight: 1.55,
                                              borderRadius: 6,
                                              border: '1px solid #7DD3FC',
                                              backgroundColor: '#FFFFFF',
                                              boxSizing: 'border-box',
                                              fontFamily: 'inherit',
                                              outline: 'none',
                                            }}
                                          />
                                        </div>
                                      </div>
                                    ) : (
                                      /* Single Field Mode */
                                      <div
                                        style={{
                                          backgroundColor: '#FFFFFF',
                                          border: '1px solid #CBD5E1',
                                          borderRadius: 8,
                                          padding: '12px 14px',
                                        }}
                                      >
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                          <label style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>
                                            📄 Single Distractor Explanation:
                                          </label>
                                          <span style={{ fontSize: 10.5, color: '#64748B' }}>
                                            {getWordAndCharCount(opt.distractor_analysis)}
                                          </span>
                                        </div>
                                        <textarea
                                          rows={3}
                                          value={opt.distractor_analysis || ''}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            setEditOptions((prev) =>
                                              prev.map((o, i) => (i === idx ? { ...o, distractor_analysis: val } : o))
                                            );
                                          }}
                                          placeholder={`Comprehensive explanation for Option ${opt.option_label} (why it is incorrect)...`}
                                          style={{
                                            width: '100%',
                                            padding: '8px 12px',
                                            fontSize: 12.5,
                                            lineHeight: 1.55,
                                            borderRadius: 6,
                                            border: '1px solid #CBD5E1',
                                            backgroundColor: '#FFFFFF',
                                            boxSizing: 'border-box',
                                            fontFamily: 'inherit',
                                            outline: 'none',
                                          }}
                                        />
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: Detailed Solution & Traps */}
              {(editModalTab === 'solution' || editModalTab === 'all') && (
                <div style={{ marginBottom: editModalTab === 'all' ? 24 : 0 }}>
                  {/* Card: Detailed Solution */}
                  <div
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: 6,
                      border: '1px solid #E2E8F0',
                      padding: 16,
                      marginBottom: 16,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0F172A' }}>
                          1. Step-by-Step Comprehensive Solution
                        </div>
                        <div style={{ fontSize: 11.5, color: '#64748B' }}>
                          Detailed walkthrough with historical context, derivations, and breakdown.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setEditDetailedSolution((prev) => prev + (prev.endsWith('\n') ? '• ' : '\n• '));
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '4px 8px',
                          fontSize: 11.5,
                          fontWeight: 600,
                          borderRadius: 4,
                          backgroundColor: '#F1F5F9',
                          border: '1px solid #CBD5E1',
                          color: '#334155',
                          cursor: 'pointer',
                        }}
                      >
                        + Bullet •
                      </button>
                    </div>

                    <textarea
                      rows={editModalTab === 'all' ? 6 : 9}
                      value={editDetailedSolution}
                      onChange={(e) => setEditDetailedSolution(e.target.value)}
                      placeholder="Enter comprehensive solution text. Supports multiple paragraphs and bullets..."
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        fontSize: 13,
                        lineHeight: 1.5,
                        borderRadius: 4,
                        border: '1px solid #CBD5E1',
                        boxSizing: 'border-box',
                        fontFamily: 'inherit',
                      }}
                    />
                  </div>

                  {/* Card: Points to Remember & Common Traps */}
                  <div
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: 6,
                      border: '1px solid #E2E8F0',
                      padding: 16,
                      marginBottom: 16,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                    }}
                  >
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: '#B45309' }}>
                        2. Points to Remember & Common Traps ({editCommonTraps.length})
                      </div>
                      <div style={{ fontSize: 11.5, color: '#64748B' }}>
                        Key mnemonic hooks, examination traps, or formula warnings.
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                      <input
                        type="text"
                        value={newTrapInput}
                        onChange={(e) => setNewTrapInput(e.target.value)}
                        placeholder="Add a common trap or memory tip... (Press Enter to add)"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newTrapInput.trim()) {
                            e.preventDefault();
                            setEditCommonTraps((prev) => [...prev, newTrapInput.trim()]);
                            setNewTrapInput('');
                          }
                        }}
                        style={{
                          flex: 1,
                          padding: '7px 10px',
                          fontSize: 12.5,
                          borderRadius: 4,
                          border: '1px solid #CBD5E1',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (newTrapInput.trim()) {
                            setEditCommonTraps((prev) => [...prev, newTrapInput.trim()]);
                            setNewTrapInput('');
                          }
                        }}
                        style={{
                          padding: '7px 14px',
                          fontSize: 12,
                          fontWeight: 700,
                          borderRadius: 4,
                          border: 'none',
                          backgroundColor: '#F59E0B',
                          color: '#FFFFFF',
                          cursor: 'pointer',
                        }}
                      >
                        Add Trap
                      </button>
                    </div>

                    {editCommonTraps.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {editCommonTraps.map((trap, idx) => (
                          <div
                            key={idx}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '5px 10px',
                              backgroundColor: '#FEF3C7',
                              borderRadius: 4,
                              fontSize: 12,
                              fontWeight: 500,
                              color: '#92400E',
                              border: '1px solid #FDE68A',
                            }}
                          >
                            <span>{trap}</span>
                            <button
                              type="button"
                              onClick={() => setEditCommonTraps((prev) => prev.filter((_, i) => i !== idx))}
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: '#DC2626',
                                padding: 0,
                                display: 'flex',
                              }}
                              title="Remove"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: '#94A3B8', fontStyle: 'italic' }}>
                        No common traps added yet.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: Taxonomy & Marks */}
              {(editModalTab === 'classification' || editModalTab === 'all') && (
                <div>
                  {/* Card: Syllabus Classification */}
                  <div
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: 6,
                      border: '1px solid #E2E8F0',
                      padding: 16,
                      marginBottom: 16,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                    }}
                  >
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0F172A', marginBottom: 12 }}>
                      Curriculum & Syllabus Hierarchy
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 12 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                          Subject:
                        </label>
                        <input
                          type="text"
                          value={editSubjectName}
                          onChange={(e) => setEditSubjectName(e.target.value)}
                          placeholder="e.g. Ancient History"
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            fontSize: 12.5,
                            borderRadius: 4,
                            border: '1px solid #CBD5E1',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                          Topic / Microtheme:
                        </label>
                        <input
                          type="text"
                          value={editTopicName}
                          onChange={(e) => setEditTopicName(e.target.value)}
                          placeholder="e.g. Buddhism"
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            fontSize: 12.5,
                            borderRadius: 4,
                            border: '1px solid #CBD5E1',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                          Subtopic / Nano Theme:
                        </label>
                        <input
                          type="text"
                          value={editSubtopicName}
                          onChange={(e) => setEditSubtopicName(e.target.value)}
                          placeholder="e.g. Dhanyakataka Buddhist centre"
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            fontSize: 12.5,
                            borderRadius: 4,
                            border: '1px solid #CBD5E1',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Card: Scoring & Difficulty */}
                  <div
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: 6,
                      border: '1px solid #E2E8F0',
                      padding: 16,
                      marginBottom: 16,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                    }}
                  >
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0F172A', marginBottom: 12 }}>
                      Scoring & Difficulty
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 12 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                          Difficulty:
                        </label>
                        <select
                          value={editDifficulty}
                          onChange={(e) => setEditDifficulty(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            fontSize: 12.5,
                            borderRadius: 4,
                            border: '1px solid #CBD5E1',
                            backgroundColor: '#FFFFFF',
                          }}
                        >
                          <option value="EASY">EASY</option>
                          <option value="MEDIUM">MEDIUM</option>
                          <option value="HARD">HARD</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                          Marks:
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          value={editMarks}
                          onChange={(e) => setEditMarks(parseFloat(e.target.value) || 2.0)}
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            fontSize: 12.5,
                            borderRadius: 4,
                            border: '1px solid #CBD5E1',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                          Negative Marks:
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={editNegativeMarks}
                          onChange={(e) => setEditNegativeMarks(parseFloat(e.target.value) || 0.66)}
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            fontSize: 12.5,
                            borderRadius: 4,
                            border: '1px solid #CBD5E1',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                          Expected Time (s):
                        </label>
                        <input
                          type="number"
                          value={editExpectedTime}
                          onChange={(e) => setEditExpectedTime(parseInt(e.target.value, 10) || 60)}
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            fontSize: 12.5,
                            borderRadius: 4,
                            border: '1px solid #CBD5E1',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Card: Advanced Multi-Concept Relevance (Optional Accordion) */}
                  <div
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: 6,
                      border: '1px solid #E2E8F0',
                      overflow: 'hidden',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setShowAdvancedHierarchy(!showAdvancedHierarchy)}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: '#F8FAFC',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <FolderTree size={15} color="#64748B" />
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: '#334155' }}>
                          Advanced: Interdisciplinary Concepts & Relevance Weights (Optional)
                        </span>
                      </div>
                      {showAdvancedHierarchy ? <ChevronUp size={16} color="#64748B" /> : <ChevronDown size={16} color="#64748B" />}
                    </button>

                    {showAdvancedHierarchy && (
                      <div style={{ padding: 16, borderTop: '1px solid #E2E8F0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                          <span style={{ fontSize: 12, color: '#64748B' }}>
                            Configure secondary concept linkages and analytical weights for cross-subject analytics.
                          </span>
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
                              gap: 4,
                              padding: '4px 10px',
                              borderRadius: 4,
                              fontSize: 11.5,
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

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {editHierarchyLinks.map((hLink, hIdx) => {
                            const pct = hLink.relevance_percentage !== undefined ? hLink.relevance_percentage : 100;
                            return (
                              <div
                                key={hIdx}
                                style={{
                                  backgroundColor: '#F8FAFC',
                                  border: hLink.is_primary ? '1px solid #86EFAC' : '1px solid #E2E8F0',
                                  borderRadius: 4,
                                  padding: 12,
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, color: hLink.is_primary ? '#15803D' : '#475569', cursor: 'pointer' }}>
                                    <input
                                      type="radio"
                                      name="primaryHierarchyRadio"
                                      checked={Boolean(hLink.is_primary)}
                                      onChange={() => {
                                        setEditHierarchyLinks((prev) =>
                                          prev.map((item, i) => ({ ...item, is_primary: i === hIdx }))
                                        );
                                        if (hLink.subject_name) setEditSubjectName(hLink.subject_name);
                                        if (hLink.topic_name) setEditTopicName(hLink.topic_name);
                                        if (hLink.subtopic_name) setEditSubtopicName(hLink.subtopic_name);
                                      }}
                                    />
                                    {hLink.is_primary ? '★ Primary Curriculum Link' : 'Secondary Concept'}
                                  </label>

                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: '#15803D', backgroundColor: '#DCFCE7', padding: '1px 6px', borderRadius: 3 }}>
                                      {pct}% Relevance
                                    </span>
                                    {editHierarchyLinks.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => setEditHierarchyLinks((prev) => prev.filter((_, i) => i !== hIdx))}
                                        style={{ border: 'none', background: 'none', color: '#EF4444', cursor: 'pointer', padding: 2 }}
                                        title="Remove"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    )}
                                  </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 8, marginBottom: 8 }}>
                                  <input
                                    type="text"
                                    value={hLink.subject_name || ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setEditHierarchyLinks((prev) =>
                                        prev.map((item, i) => (i === hIdx ? { ...item, subject_name: val } : item))
                                      );
                                    }}
                                    placeholder="Subject"
                                    style={{ padding: '5px 8px', fontSize: 11.5, borderRadius: 3, border: '1px solid #CBD5E1' }}
                                  />
                                  <input
                                    type="text"
                                    value={hLink.topic_name || ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setEditHierarchyLinks((prev) =>
                                        prev.map((item, i) => (i === hIdx ? { ...item, topic_name: val } : item))
                                      );
                                    }}
                                    placeholder="Topic"
                                    style={{ padding: '5px 8px', fontSize: 11.5, borderRadius: 3, border: '1px solid #CBD5E1' }}
                                  />
                                  <input
                                    type="text"
                                    value={hLink.subtopic_name || ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setEditHierarchyLinks((prev) =>
                                        prev.map((item, i) => (i === hIdx ? { ...item, subtopic_name: val } : item))
                                      );
                                    }}
                                    placeholder="Subtopic"
                                    style={{ padding: '5px 8px', fontSize: 11.5, borderRadius: 3, border: '1px solid #CBD5E1' }}
                                  />
                                  <input
                                    type="text"
                                    value={hLink.concept_name || ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setEditHierarchyLinks((prev) =>
                                        prev.map((item, i) => (i === hIdx ? { ...item, concept_name: val } : item))
                                      );
                                    }}
                                    placeholder="Concept Tag"
                                    style={{ padding: '5px 8px', fontSize: 11.5, borderRadius: 3, border: '1px solid #CBD5E1' }}
                                  />
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <span style={{ fontSize: 11, color: '#64748B' }}>Weight:</span>
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
                                    style={{ flex: 1, accentColor: '#16A34A', cursor: 'pointer' }}
                                  />
                                  <span style={{ fontSize: 11.5, fontWeight: 700, color: '#334155', minWidth: 32 }}>
                                    {pct}%
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div
              style={{
                padding: '14px 24px',
                borderTop: '1px solid #E2E8F0',
                backgroundColor: '#FAFAFA',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ fontSize: 12, color: '#64748B', fontWeight: 500 }}>
                Question #{editingQuestion.question_number_in_paper} &nbsp;•&nbsp; {editSubjectName || 'General Studies'} &nbsp;•&nbsp; {editDifficulty}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setEditingQuestion(null)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 4,
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
                    padding: '8px 16px',
                    borderRadius: 4,
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
                    padding: '8px 18px',
                    borderRadius: 4,
                    border: 'none',
                    backgroundColor: '#16A34A',
                    color: '#FFFFFF',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    boxShadow: '0 1px 3px rgba(22, 163, 74, 0.25)',
                  }}
                >
                  {savingEdit ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Save & Mark Verified
                </button>
              </div>
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
              borderRadius: 0,
              maxWidth: 460,
              width: '100%',
              padding: 24,
              boxShadow: '0 20px 40px rgba(15, 23, 42, 0.2)',
              border: '1px solid #E2E8F0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#F2B623', marginBottom: 12 }}>
              <AlertTriangle size={24} />
              <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: '#172033' }}>
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
                  borderRadius: 0,
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
                  borderRadius: 0,
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

      {/* MODAL 3: Exam Publish Warning (When questions are still pending) */}
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
              borderRadius: 0,
              maxWidth: 480,
              width: '100%',
              padding: 24,
              boxShadow: '0 20px 40px rgba(15, 23, 42, 0.2)',
              border: '1px solid #E2E8F0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#DC2626', marginBottom: 12 }}>
              <Lock size={24} />
              <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: '#172033' }}>
                Cannot Publish Exam Package
              </h3>
            </div>
            <p style={{ fontSize: 13.5, color: '#475569', lineHeight: 1.5, margin: '0 0 16px 0' }}>
              <strong>{reviewMetrics.pending} questions</strong> are still pending human review in exam package <em>&apos;{selectedExam?.name}&apos;</em>.
            </p>
            <div
              style={{
                backgroundColor: '#FEF2F2',
                border: '1px solid #FECDCA',
                borderRadius: 0,
                padding: '12px 14px',
                fontSize: 13,
                color: '#B42318',
                marginBottom: 20,
              }}
            >
              Every single question and solution must be verified and approved before activating this exam for live assessments.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={handleVerifyAllQuestions}
                disabled={verifyingAll}
                style={{
                  padding: '8px 16px',
                  borderRadius: 0,
                  border: 'none',
                  backgroundColor: '#0284C7',
                  color: '#FFFFFF',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: verifyingAll ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {verifyingAll ? <Loader2 size={14} className="animate-spin" /> : <CheckCheck size={14} />}
                Verify All Questions Now
              </button>
              <button
                onClick={() => {
                  setShowPublishWarningModal(false);
                  handleStatusFilterChange('PENDING');
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: 0,
                  border: 'none',
                  backgroundColor: 'var(--primary-red)',
                  color: '#FFFFFF',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Review Manually
              </button>
              <button
                onClick={() => setShowPublishWarningModal(false)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 0,
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

      {/* MODAL 4: Final Exam Publish Confirmation */}
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
              borderRadius: 0,
              maxWidth: 480,
              width: '100%',
              padding: 24,
              boxShadow: '0 20px 40px rgba(15, 23, 42, 0.2)',
              border: '1px solid #E2E8F0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#16A34A', marginBottom: 12 }}>
              <UploadCloud size={26} />
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#172033' }}>
                Publish Exam Package?
              </h3>
            </div>
            <p style={{ fontSize: 13.5, color: '#475569', lineHeight: 1.5, margin: '0 0 16px 0' }}>
              All <strong>{reviewMetrics.total} questions & solutions</strong> have been verified. Publishing will:
            </p>
            <ul style={{ margin: '0 0 20px 0', paddingLeft: 20, fontSize: 13, color: '#334155', lineHeight: 1.6 }}>
              <li>Generate standalone <code style={{ color: 'var(--primary-red)' }}>questions.json</code> & <code style={{ color: 'var(--primary-red)' }}>solutions.json</code></li>
              <li>Deploy verified questions & solutions packages to platform catalog storage</li>
              <li>Activate this exam for candidate mock tests and live assessments</li>
            </ul>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => setShowPublishModal(false)}
                disabled={publishingExam}
                style={{
                  padding: '9px 16px',
                  borderRadius: 0,
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
                  borderRadius: 0,
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
                Confirm & Publish Package
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Missing Question Modal */}
      {selectedExam && (
        <AddMissingQuestionModal
          isOpen={isAddMissingModalOpen}
          onClose={() => setIsAddMissingModalOpen(false)}
          exam={{
            id: selectedExam.id,
            name: selectedExam.name,
            code: selectedExam.code,
            paper_set_code: selectedExam.paper_set_code,
            missing_question_numbers: examIntegrity?.missing_question_numbers || [],
          }}
          onSuccess={() => {
            showToast('success', 'Missing question created and published successfully!');
            loadExamQuestions(selectedExam.id, questionStatusFilter, currentPage, selectedQuestionIndex);
            fetchExamIntegrityQuestions(selectedExam.id)
              .then((res) => setExamIntegrity(res))
              .catch(() => {});
          }}
        />
      )}
    </div>
  );
}


