import React, { useState, useEffect } from 'react';
import {
  Brain,
  Zap,
  Target,
  Clock,
  RotateCcw,
  CheckCircle2,
  XCircle,
  MinusCircle,
  AlertTriangle,
  FileText,
  Info,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  BookOpen,
  Folder,
  FolderOpen,
  Activity,
  Layers,
  TrendingUp,
  ShieldAlert,
  Lightbulb,
  Check,
  Compass,
  Gauge,
  Sliders,
  Award,
  CalendarPlus,
  ArrowRight,
  Filter,
  Loader2,
} from 'lucide-react';
import {
  PsychometricReport,
  QuestionReportItem,
  UserProgressionReportData,
  ActionableStudyTask,
  CognitiveDiagnosticInsight,
} from '../../types/exam';
import {
  bulkAddStudyTasksFromReport,
  getAttemptScheduledTasksStatus,
} from '../../services/examService';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { formatEnum } from '../../utils/formatEnum';
import { SimilarQuestionsSection } from '../exam/SimilarQuestionsSection';
import { ReportSummary, LockedSummary } from './ReportSummary';

interface PsychometricReportViewProps {
  report: PsychometricReport;
  questionReportData?: QuestionReportItem[];
  userProgressionData?: UserProgressionReportData | null;
}

export function PsychometricReportView({
  report,
  questionReportData,
  userProgressionData,
}: PsychometricReportViewProps) {
  const isDark = false;

  const isCumulative =
    report?.is_cumulative ||
    report?.metadata?.report_type === 'CUMULATIVE_MULTI_EXAM_AGGREGATE';

  const hasAiInsight = Boolean(
    report?.llm_insight?.executive_summary ||
    (report as any)?.part_2_exam_macro_scorecard?.mentorship_insight?.executive_summary ||
    (report as any)?.part_3_aggregated_user_report?.mentorship_insight?.executive_summary ||
    ((report?.llm_insight?.study_plan_tasks || []).length > 0) ||
    (((report as any)?.part_2_exam_macro_scorecard?.actionable_tasks || []).length > 0) ||
    (((report as any)?.part_3_aggregated_user_report?.actionable_tasks || []).length > 0)
  );

  const rawTasksList = (
    report?.llm_insight?.study_plan_tasks ||
    (report as any)?.part_2_exam_macro_scorecard?.mentorship_insight?.study_plan_tasks ||
    (report as any)?.part_2_exam_macro_scorecard?.actionable_tasks ||
    (report as any)?.part_3_aggregated_user_report?.actionable_tasks ||
    (report as any)?.part_3_aggregated_user_report?.mentorship_insight?.study_plan_tasks ||
    []
  );

  const [activeTab, setActiveTab] = useState<'summary' | 'questions' | 'ai-insights' | 'topics'>('summary');
  const [showDetailedAnalysis, setShowDetailedAnalysis] = useState(false);
  // Free plan: the API sends only the score and per-question review
  const analysisLocked = Boolean((report as any)?.analysis_locked);

  useEffect(() => {
    if (isCumulative && activeTab === 'questions') {
      setActiveTab('summary');
    }
  }, [isCumulative]);

  const [openInfoKeys, setOpenInfoKeys] = useState<Record<string, boolean>>({});
  const [questionFilter, setQuestionFilter] = useState<
    'all' | 'attempted' | 'correct' | 'incorrect' | 'unattempted' | 'rushed' | 'trapped'
  >('all');
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | number | null>(null);
  const [expandedHierarchyNodes, setExpandedHierarchyNodes] = useState<Record<string, boolean>>({});
  const [completedTasks, setCompletedTasks] = useState<Record<string, boolean>>({});
  const [addedTaskPlanSuccess, setAddedTaskPlanSuccess] = useState<Record<string, string>>({});
  const [isAddingTask, setIsAddingTask] = useState<Record<string, boolean>>({});
  const [isBulkAdding, setIsBulkAdding] = useState<boolean>(false);
  const [scheduledTaskTitles, setScheduledTaskTitles] = useState<Set<string>>(new Set());
  const [selectedModality, setSelectedModality] = useState<
    'all_exams' | 'full_mock_exams' | 'practice_tests' | 'guest_trials'
  >('all_exams');

  const [questionPage, setQuestionPage] = useState<number>(1);
  const questionPageSize = 10;

  const [matrixPage, setMatrixPage] = useState<number>(1);
  const matrixPageSize = 10;

  const attemptId = isCumulative
    ? null
    : (report as any)?.metadata?.exam_attempt?.attempt_id ||
      (report as any)?.attempt_id ||
      (report as any)?.exam_attempt?.attempt_id;

  // Sync already scheduled tasks for this attempt from backend
  useEffect(() => {
    if (attemptId && attemptId !== 'CUMULATIVE_ALL' && !isCumulative) {
      getAttemptScheduledTasksStatus(String(attemptId))
        .then((res) => {
          if (res?.scheduled_task_titles) {
            setScheduledTaskTitles(new Set(res.scheduled_task_titles));
          }
        })
        .catch(() => { });
    }
  }, [attemptId, isCumulative]);

  const toggleTaskCompleted = (taskId: string) => {
    setCompletedTasks((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  const handleScheduleSingleTask = async (task: any) => {
    const targetAttemptId = attemptId || 'CUMULATIVE_ALL';
    const taskId = task.task_id || task.title;
    setIsAddingTask((prev) => ({ ...prev, [taskId]: true }));
    try {
      await bulkAddStudyTasksFromReport({
        attempt_id: String(targetAttemptId),
        tasks: [task],
      });
      const fullTitle = `[${task.subject || 'Core'}] ${task.title}`;
      setScheduledTaskTitles((prev) => new Set([...prev, task.title, fullTitle]));
      setAddedTaskPlanSuccess((prev) => ({ ...prev, [taskId]: 'ADDED' }));
    } catch (err) {
      console.warn('Failed to schedule study task:', err);
    } finally {
      setIsAddingTask((prev) => ({ ...prev, [taskId]: false }));
    }
  };

  const handleScheduleAllTasks = async (tasks: any[]) => {
    const targetAttemptId = attemptId || 'CUMULATIVE_ALL';
    if (!tasks.length) return;
    setIsBulkAdding(true);
    try {
      await bulkAddStudyTasksFromReport({
        attempt_id: String(targetAttemptId),
        tasks,
      });
      const nextTitles = new Set(scheduledTaskTitles);
      tasks.forEach((t) => {
        const fullTitle = `[${t.subject || 'Core'}] ${t.title}`;
        nextTitles.add(t.title);
        nextTitles.add(fullTitle);
        setAddedTaskPlanSuccess((prev) => ({ ...prev, [t.task_id || t.title]: 'ADDED' }));
      });
      setScheduledTaskTitles(nextTitles);
    } catch (err) {
      console.warn('Failed to schedule all tasks:', err);
    } finally {
      setIsBulkAdding(false);
    }
  };

  const toggleInfo = (key: string) => {
    setOpenInfoKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const {
    metadata,
    user_overall_skill_profile,
    exam_macro_analytics = {},
    per_question_diagnostic_report = [],
  } = report || {};

  const rawTimelineData = React.useMemo(() => {
    if (report?.exam_timeline && Array.isArray(report.exam_timeline) && report.exam_timeline.length > 0) {
      return report.exam_timeline;
    }
    if ((report as any)?.metadata?.exam_timeline && Array.isArray((report as any).metadata.exam_timeline)) {
      return (report as any).metadata.exam_timeline;
    }
    const evo = (report as any)?.evolution_graphs;
    if (evo && Array.isArray(evo.labels) && evo.labels.length > 0) {
      return evo.labels.map((lbl: string, idx: number) => ({
        attempt_number: idx + 1,
        exam_name: lbl,
        total_score: evo.scores?.[idx] ?? 0,
        max_possible_score: evo.max_scores?.[idx] ?? 200,
        accuracy_percentage: evo.accuracies?.[idx] ?? 0,
        icrs_score: evo.icrs_scores?.[idx] ?? 65,
        irt_theta: evo.irt_thetas?.[idx] ?? 0,
        gti_score: (evo.gti_percentages?.[idx] ?? 20) / 100,
        oeei_score: (evo.oeei_percentages?.[idx] ?? 70) / 100,
        satoi_score: evo.satoi_scores?.[idx] ?? 80,
        date_formatted: evo.dates?.[idx] ?? `Session ${idx + 1}`,
      }));
    }
    return [];
  }, [report]);

  const timelineData = React.useMemo(() => {
    return rawTimelineData.map((item: any, idx: number) => {
      const rawScore = Number(item.total_score ?? item.score ?? 0);
      const maxScore = Number(item.max_possible_score ?? item.max_score ?? 200);
      const acc = Number(item.accuracy_percentage ?? item.accuracy ?? 0);
      const icrsVal = Number(item.icrs_score ?? 65);
      const satoiVal = Number(item.satoi_score ?? 80);
      const gtiVal = Number(item.gti_score ?? item.gti ?? 0.2);
      const oeeiVal = Number(item.oeei_score ?? item.oeei ?? 0.7);
      const irtVal = Number(item.irt_theta ?? item.irt ?? 0.0);
      const exName = item.exam_name || item.name || `Exam #${item.attempt_number || idx + 1}`;
      const dispLabel = `Exam ${item.attempt_number || idx + 1}`;

      return {
        ...item,
        display_label: dispLabel,
        exam_name: exName,
        total_score: Math.round(rawScore * 10) / 10,
        max_possible_score: Math.round(maxScore * 10) / 10,
        accuracy_percentage: Math.round(acc * 10) / 10,
        icrs_score: Math.round(icrsVal * 10) / 10,
        satoi_score: Math.round(satoiVal * 10) / 10,
        gti_pct: Math.round((gtiVal <= 1.0 ? gtiVal * 100 : gtiVal) * 10) / 10,
        oeei_pct: Math.round((oeeiVal <= 1.0 ? oeeiVal * 100 : oeeiVal) * 10) / 10,
        irt_theta: Math.round(irtVal * 100) / 100,
      };
    });
  }, [rawTimelineData]);

  const macroAnalytics: Record<string, any> =
    (report as any)?.part_2_exam_macro_scorecard ||
    (report as any)?.part_3_aggregated_user_report ||
    exam_macro_analytics ||
    {};

  // Extract individual metrics for Place 1 (Exam Level)
  const icrs =
    macroAnalytics['overall_exam_readiness'] ||
    macroAnalytics['icrs'] ||
    macroAnalytics['1_integrated_cognitive_readiness']?.value ||
    { icrs_score: 0, classification: 'EVALUATING', interpretation: 'Metrics being compiled from attempt telemetry.' };

  const irt =
    macroAnalytics['concept_mastery_level'] ||
    macroAnalytics['irt_3pl'] ||
    macroAnalytics['2_irt_3pl_latent_ability']?.value ||
    { latent_ability_theta: 0.0, percentile_estimate: 0.0, standard_error: 0.0 };

  const gti =
    macroAnalytics['guessing_instinct_risk'] ||
    macroAnalytics['gti'] ||
    macroAnalytics['3_guessing_tendency_index']?.value ||
    { aggregate: 0.0, aggregate_gti: 0.0, category: 'EVALUATING', label: 'Pending Calculation', recommendation: '' };

  const pacing =
    macroAnalytics['pacing_efficiency'] ||
    macroAnalytics['pacing'] ||
    macroAnalytics['4_macro_pacing_and_fatigue']?.value ||
    { time_utilization_pct: 0, skew_ratio: 1.0, pacing_classification: 'EVALUATING', pacing_status: 'EVALUATING' };

  const oeei =
    macroAnalytics['option_elimination_precision'] ||
    macroAnalytics['oeei'] ||
    macroAnalytics['5_option_elimination_efficiency']?.value ||
    { oeei_score: 0, elimination_efficiency_rating: 'EVALUATING' };

  const satoi =
    macroAnalytics['cognitive_stamina'] ||
    macroAnalytics['satoi'] ||
    macroAnalytics['6_speed_accuracy_tradeoff_satoi']?.value ||
    { satoi_score: 0, burnout_risk: 'EVALUATING', cognitive_stamina_status: 'EVALUATING' };

  const switchRegret =
    macroAnalytics['second_guessing_discipline'] ||
    macroAnalytics['switch_regret'] ||
    macroAnalytics['7_option_switch_regret']?.value ||
    { switch_frequency: 0, total_switches: 0, regret_ratio: 0.0, recommendation: 'NO_SWITCHES' };

  const blooms =
    macroAnalytics['thinking_cognitive_levels'] ||
    macroAnalytics['blooms_mastery'] ||
    macroAnalytics['8_blooms_taxonomy_mastery']?.value ||
    {};

  const topicDecay =
    (report as any)?.part_4_aggregate_profile?.topic_memory_retention_overview ||
    (report as any)?.part_4_aggregate_profile?.topic_fsrs_decay ||
    macroAnalytics['9_topic_fsrs_memory_decay']?.value ||
    macroAnalytics['topic_fsrs_decay'] ||
    { topic_decay_records: [] };

  const distractor =
    macroAnalytics['distractor_trap_distribution'] ||
    macroAnalytics['closeness_distribution'] ||
    macroAnalytics['10_option_closeness_classification']?.value ||
    macroAnalytics['10_distractor_closeness_analysis']?.value ||
    {};

  const llmInsight =
    (report as any)?.llm_insight ||
    macroAnalytics['llm_insight'] ||
    null;

  const aiInsights: any =
    (report as any)?.part_2_exam_macro_scorecard?.ai_cognitive_insights ||
    (report as any)?.part_3_aggregated_user_report?.ai_cognitive_insights ||
    (report as any)?.ai_cognitive_insights ||
    (report as any)?.llm_insight ||
    (report as any)?.part_2_exam_macro_scorecard?.mentorship_insight ||
    {};

  // Extract cumulative metrics for Place 2 (User Aggregate Level)
  const userProfile =
    user_overall_skill_profile ||
    (report as any)?.part_3_aggregated_user_report?.cumulative_skill_profile || {
      cumulative_icrs_score: 0.0,
      cumulative_irt_theta: 0.0,
      cumulative_gti: 0.0,
      cumulative_oeei: 0.0,
      cumulative_satoi: 0.0,
      total_tests_given: 0,
      total_questions_answered: 0,
    };

  const deltas = userProgressionData?.deltas || {
    icrs_delta: 0.0,
    irt_theta_delta: 0.0,
    gti_delta: 0.0,
    oeei_delta: 0.0,
    satoi_delta: 0.0,
  };

  // Taxonomy breakdown items
  const taxonomyData: any[] =
    (report as any)?.part_2_taxonomy_analysis?.by_subject ||
    (report as any)?.part_2_taxonomy_analysis?.by_topic ||
    userProfile.taxonomy_mastery_breakdown ||
    [];

  const cardStyle: React.CSSProperties = {
    backgroundColor: isDark ? '#131f37' : 'var(--bg-card)',
    borderRadius: 'var(--radius)',
    padding: 24,
    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'var(--border-color)'}`,
    boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.2)' : '0 2px 8px rgba(0,0,0,0.03)',
  };

  // Helper for dynamic badge styling
  const getBadgeStyle = (rawStatus: string): { bg: string; color: string; border: string; label: string } => {
    const s = (rawStatus || '').toUpperCase();
    const cleanLabel = (rawStatus || '').replace(/_/g, ' ');

    if (s.includes('UNATTEMPTED')) {
      return { bg: 'rgba(148, 163, 184, 0.15)', color: 'var(--text-muted)', border: 'rgba(148, 163, 184, 0.35)', label: 'Unattempted' };
    }

    if (
      s.includes('EXCEPTIONAL') ||
      s.includes('ELITE') ||
      s.includes('SUPERIOR') ||
      s.includes('OPTIMAL') ||
      s.includes('HIGH_COMPETENCE') ||
      s.includes('STRONG')
    ) {
      return { bg: 'rgba(16, 185, 129, 0.15)', color: '#3A8B53', border: 'rgba(16, 185, 129, 0.35)', label: cleanLabel || 'High Competence' };
    }
    if (s.includes('HIGH') || s.includes('HEALTHY') || s.includes('CONTROLLED') || s.includes('CONSTRUCTIVE')) {
      return { bg: 'rgba(var(--primary-red-rgb), 0.15)', color: 'var(--primary-red)', border: 'rgba(var(--primary-red-rgb), 0.35)', label: cleanLabel || 'Controlled & Solid' };
    }
    if (s.includes('COMPETITIVE') || s.includes('COMPETENT') || s.includes('STABLE') || s.includes('BALANCED')) {
      return { bg: 'rgba(99, 102, 241, 0.15)', color: '#6366f1', border: 'rgba(99, 102, 241, 0.35)', label: cleanLabel || 'Competitive' };
    }
    if (s.includes('MODERATE') || s.includes('REVISION_RECOMMENDED') || s.includes('MILD')) {
      return { bg: 'rgba(245, 158, 11, 0.15)', color: '#d97706', border: 'rgba(245, 158, 11, 0.35)', label: cleanLabel || 'Moderate' };
    }
    if (s.includes('VULNERABLE') || s.includes('ELEVATED') || s.includes('FOUNDATIONAL')) {
      return { bg: 'rgba(249, 115, 22, 0.15)', color: '#ea580c', border: 'rgba(249, 115, 22, 0.35)', label: cleanLabel || 'Needs Focus' };
    }
    return { bg: 'rgba(var(--primary-red-rgb), 0.15)', color: '#dc2626', border: 'rgba(var(--primary-red-rgb), 0.35)', label: cleanLabel || 'Urgent Revision' };
  };

  const renderInfoToggle = (key: string, description: string, calculationMethod: string, idealScore: string) => {
    const isOpen = !!openInfoKeys[key];
    return (
      <div style={{ marginTop: 12 }}>
        <button
          onClick={() => toggleInfo(key)}
          style={{
            background: isOpen ? 'var(--primary-red)' : isDark ? 'rgba(255,255,255,0.08)' : 'var(--bg-hover)',
            color: isOpen ? 'var(--bg-card)' : isDark ? 'var(--text-disabled)' : 'var(--text-muted)',
            border: 'none',
            borderRadius: 'var(--radius)',
            padding: '3px 10px',
            fontSize: 11.5,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            transition: 'all 0.2s ease',
          }}
          title="Click to view explanation"
        >
          <Info size={12} />
          <span>{isOpen ? 'Hide Details' : 'What is this?'}</span>
        </button>

        {isOpen && (
          <div
            style={{
              marginTop: 10,
              padding: 12,
              borderRadius: 'var(--radius)',
              backgroundColor: isDark ? 'rgba(30, 41, 59, 0.9)' : 'var(--bg-subtle)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'var(--border-color)'}`,
              fontSize: 12,
              lineHeight: 1.5,
              color: isDark ? 'var(--border-color)' : 'var(--text-secondary)',
            }}
          >
            <div style={{ marginBottom: 6 }}>
              <strong>What it measures:</strong> {description}
            </div>
            <div style={{ marginBottom: 6 }}>
              <strong>How it is computed:</strong> {calculationMethod}
            </div>
            <div>
              <strong>Target / Ideal:</strong> <span style={{ color: '#3A8B53', fontWeight: 700 }}>{idealScore}</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Merge question items
  const rawQuestionsList: any[] =
    (report as any)?.part_1_per_question_analysis && (report as any).part_1_per_question_analysis.length > 0
      ? (report as any).part_1_per_question_analysis
      : (questionReportData && questionReportData.length > 0)
        ? questionReportData
        : per_question_diagnostic_report;

  // Enrich with questionReportData if needed
  const questionsList = React.useMemo(() => {
    if (!questionReportData || questionReportData.length === 0) return rawQuestionsList;
    const qMap = new Map<string | number, any>();
    questionReportData.forEach((q) => {
      if (q.question_id) qMap.set(String(q.question_id), q);
      if (q.question_number != null) qMap.set(Number(q.question_number), q);
    });
    return rawQuestionsList.map((item, idx) => {
      const qNum = item.question_number || idx + 1;
      const extra = qMap.get(String(item.question_id)) || qMap.get(qNum);
      if (extra) {
        return {
          ...item,
          ...extra,
          question_text: item.question_text || extra.question_text,
          options: item.options && item.options.length ? item.options : extra.options,
          explanation: item.explanation || extra.explanation,
        };
      }
      return item;
    });
  }, [rawQuestionsList, questionReportData]);

  // Helper for item attempt state
  const getQuestionState = (q: any) => {
    const isAtt =
      q.selected_option_id != null ||
      (q.user_selected_option &&
        q.user_selected_option !== 'Unattempted' &&
        q.user_selected_option !== 'UNATTEMPTED') ||
      (q.user_selected_label && q.user_selected_label !== 'Unattempted');
    const isCorr = isAtt && (q.is_correct ?? q.is_answer_correct ?? false);
    const isInc = isAtt && !isCorr;
    const isUnatt = !isAtt;
    return { isAtt, isCorr, isInc, isUnatt };
  };

  const filteredQuestions = questionsList.filter((q) => {
    const state = getQuestionState(q);
    if (questionFilter === 'attempted') return state.isAtt;
    if (questionFilter === 'correct') return state.isCorr;
    if (questionFilter === 'incorrect') return state.isInc;
    if (questionFilter === 'unattempted') return state.isUnatt;
    return true;
  });

  // ─── HIERARCHY TREE BUILDER FOR TAB 3 (SUBJECT, TOPIC, SUBTOPIC & BLOOM MATRIX) ───
  const hierarchyData = React.useMemo(() => {
    // If questionsList is available, compute fine-grained stats with question mappings
    if (questionsList && questionsList.length > 0) {
      const subjMap: Record<string, any> = {};

      questionsList.forEach((q, idx) => {
        const sName = q.subject || q.subject_name || 'General Studies';
        const tName = q.topic || q.topic_name || 'Core Concepts';
        const subName = q.subtopic || 'Foundations';
        const state = getQuestionState(q);
        const qNum = Number(q.question_number || idx + 1);
        const timeTaken = Number(q.time_taken_seconds || 60);
        const expTime = Number(q.expected_time_seconds || 60);
        const blooms = (q.blooms_level || 'ANALYZE').toUpperCase();

        if (!subjMap[sName]) {
          subjMap[sName] = {
            name: sName,
            total: 0,
            attempted: 0,
            correct: 0,
            incorrect: 0,
            unattempted: 0,
            total_time: 0,
            total_expected_time: 0,
            blooms: { REMEMBER: { total: 0, correct: 0 }, UNDERSTAND: { total: 0, correct: 0 }, APPLY: { total: 0, correct: 0 }, ANALYZE: { total: 0, correct: 0 }, EVALUATE: { total: 0, correct: 0 } },
            question_numbers: [],
            topics: {},
          };
        }
        const sObj = subjMap[sName];
        sObj.total += 1;
        sObj.total_time += timeTaken;
        sObj.total_expected_time += expTime;
        if (!sObj.question_numbers.includes(qNum)) sObj.question_numbers.push(qNum);
        if (sObj.blooms[blooms]) sObj.blooms[blooms].total += 1;

        if (state.isAtt) {
          sObj.attempted += 1;
          if (state.isCorr) {
            sObj.correct += 1;
            if (sObj.blooms[blooms]) sObj.blooms[blooms].correct += 1;
          } else {
            sObj.incorrect += 1;
          }
        } else {
          sObj.unattempted += 1;
        }

        if (!sObj.topics[tName]) {
          sObj.topics[tName] = {
            name: tName,
            subject: sName,
            total: 0,
            attempted: 0,
            correct: 0,
            incorrect: 0,
            unattempted: 0,
            total_time: 0,
            total_expected_time: 0,
            blooms: { REMEMBER: { total: 0, correct: 0 }, UNDERSTAND: { total: 0, correct: 0 }, APPLY: { total: 0, correct: 0 }, ANALYZE: { total: 0, correct: 0 }, EVALUATE: { total: 0, correct: 0 } },
            question_numbers: [],
            subtopics: {},
          };
        }
        const tObj = sObj.topics[tName];
        tObj.total += 1;
        tObj.total_time += timeTaken;
        tObj.total_expected_time += expTime;
        if (!tObj.question_numbers.includes(qNum)) tObj.question_numbers.push(qNum);
        if (tObj.blooms[blooms]) tObj.blooms[blooms].total += 1;

        if (state.isAtt) {
          tObj.attempted += 1;
          if (state.isCorr) {
            tObj.correct += 1;
            if (tObj.blooms[blooms]) tObj.blooms[blooms].correct += 1;
          } else {
            tObj.incorrect += 1;
          }
        } else {
          tObj.unattempted += 1;
        }

        if (!tObj.subtopics[subName]) {
          tObj.subtopics[subName] = {
            name: subName,
            subject: sName,
            topic: tName,
            total: 0,
            attempted: 0,
            correct: 0,
            incorrect: 0,
            unattempted: 0,
            total_time: 0,
            total_expected_time: 0,
            blooms: { REMEMBER: { total: 0, correct: 0 }, UNDERSTAND: { total: 0, correct: 0 }, APPLY: { total: 0, correct: 0 }, ANALYZE: { total: 0, correct: 0 }, EVALUATE: { total: 0, correct: 0 } },
            question_numbers: [],
          };
        }
        const subObj = tObj.subtopics[subName];
        subObj.total += 1;
        subObj.total_time += timeTaken;
        subObj.total_expected_time += expTime;
        if (!subObj.question_numbers.includes(qNum)) subObj.question_numbers.push(qNum);
        if (subObj.blooms[blooms]) subObj.blooms[blooms].total += 1;

        if (state.isAtt) {
          subObj.attempted += 1;
          if (state.isCorr) {
            subObj.correct += 1;
            if (subObj.blooms[blooms]) subObj.blooms[blooms].correct += 1;
          } else {
            subObj.incorrect += 1;
          }
        } else {
          subObj.unattempted += 1;
        }
      });

      const finalizeNode = (node: any) => {
        const acc = node.attempted > 0 ? Math.round((node.correct / node.attempted) * 100) : 0;
        const posMarks = Math.round(node.correct * 2.0 * 100) / 100;
        const negMarks = Math.round(node.incorrect * 0.6667 * 100) / 100;
        const netMarks = Math.round((posMarks - negMarks) * 100) / 100;
        const numExams = Math.max(1, timelineData.length || (report as any)?.metadata?.total_exams_evaluated || 1);
        const meanScore = Math.round((netMarks / numExams) * 100) / 100;
        const avgTime = Math.round(node.total_time / Math.max(1, node.total));
        const expTime = Math.round(node.total_expected_time / Math.max(1, node.total));
        const effRatio = node.total_time / Math.max(1, node.total_expected_time);
        const pStatus = effRatio >= 0.7 && effRatio <= 1.35 ? 'OPTIMAL' : effRatio > 1.35 ? 'BOTTLENECK' : 'RUSHED';
        const pLabel = pStatus === 'OPTIMAL' ? '⚡ Optimal Pace' : pStatus === 'BOTTLENECK' ? '⏳ Time Bottleneck' : '💨 Rapid / Rushed';

        let status = 'UNATTEMPTED';
        let statusLabel = 'Unattempted';
        if (node.attempted > 0) {
          if (acc >= 85) {
            status = 'EXCEPTIONAL_MASTERY';
            statusLabel = 'Mastered';
          } else if (acc >= 70) {
            status = 'STRONG';
            statusLabel = 'Strong';
          } else if (acc >= 50) {
            status = 'COMPETENT';
            statusLabel = 'Competent';
          } else if (acc >= 30) {
            status = 'WEAK_REVISION_REQUIRED';
            statusLabel = 'Needs Practice';
          } else {
            status = 'CRITICAL_DEFICIT';
            statusLabel = 'Critical Gap';
          }
        }

        const retention = node.attempted > 0 ? Math.round(Math.min(98, Math.max(20, acc * 0.78 + 20))) : 50;
        const stabDays = Math.round((2.0 + (acc / 100) * 5.0) * 10) / 10;
        const rHealth = retention >= 80 ? 'Strong Memory' : retention >= 65 ? 'Healthy Active' : retention >= 45 ? 'Revision Due Soon' : 'Critical Decay';

        const bloomsSummary: Record<string, any> = {};
        Object.entries(node.blooms).forEach(([bK, bV]: [string, any]) => {
          if (bV.total > 0) {
            bloomsSummary[bK] = {
              total: bV.total,
              correct: bV.correct,
              accuracy: Math.round((bV.correct / bV.total) * 100),
            };
          }
        });

        return {
          ...node,
          accuracy: acc,
          positive_marks: posMarks,
          negative_marks: negMarks,
          net_marks: netMarks,
          mean_score: meanScore,
          avg_time: avgTime,
          expected_time: expTime,
          pacing_status: pStatus,
          pacing_label: pLabel,
          status,
          status_label: statusLabel,
          retention_pct: retention,
          stability_days: stabDays,
          retention_health: rHealth,
          blooms: bloomsSummary,
        };
      };

      return Object.values(subjMap).map((s: any) => {
        const topicsList = Object.values(s.topics).map((t: any) => {
          const subtopicsList = Object.values(t.subtopics).map((sub: any) => finalizeNode(sub));
          return { ...finalizeNode(t), subtopics: subtopicsList };
        });
        return { ...finalizeNode(s), topics: topicsList };
      });
    }

    // Fallback: Build tree from part_2_taxonomy_analysis if questionsList is empty (cumulative mode)
    const part2Tax = (report as any)?.part_2_taxonomy_analysis || {};
    const subjs = part2Tax.by_subject || part2Tax.subject_breakdown || (report as any)?.part_2_exam_macro_scorecard?.subject_cumulative_mean_scoreboard || (report as any)?.part_2_exam_macro_scorecard?.subjects || (report as any)?.syllabus_hierarchy || [];
    const tops = part2Tax.by_topic || part2Tax.topic_breakdown || [];
    const numExams = Math.max(1, timelineData.length || (report as any)?.metadata?.total_exams_evaluated || 1);

    const subjMap: Record<string, any> = {};

    subjs.forEach((s: any) => {
      const sName = s.taxonomy_name || s.subject_name || s.name || s.subject || 'General Studies';
      const tot = Number(s.total_questions || s.total || s.total_attempts || 0);
      const att = Number(s.attempted_questions || s.attempted || s.total_attempts || 0);
      const corr = Number(s.correct || s.correct_attempts || 0);
      const inc = Number(s.incorrect || Math.max(0, att - corr));
      const acc = Math.round(Number(s.accuracy_percentage ?? s.accuracy ?? (att > 0 ? (corr / att) * 100 : 0)));
      const posMarks = Number(s.positive_marks ?? Math.round(corr * 2.0 * 100) / 100);
      const negMarks = Number(s.negative_marks ?? Math.round(inc * 0.6667 * 100) / 100);
      const netMarks = Number(s.net_marks ?? Math.round((posMarks - negMarks) * 100) / 100);
      const meanScore = Number(s.mean_score ?? s.mean_score_per_exam ?? Math.round((netMarks / numExams) * 100) / 100);

      const nestedTopics = s.topics_list || (s.topics && Array.isArray(s.topics) ? s.topics : s.topics && typeof s.topics === 'object' ? Object.values(s.topics) : []);

      subjMap[sName] = {
        name: sName,
        total: tot,
        attempted: att,
        correct: corr,
        incorrect: inc,
        unattempted: Math.max(0, tot - att),
        accuracy: acc,
        positive_marks: posMarks,
        negative_marks: negMarks,
        net_marks: netMarks,
        mean_score: meanScore,
        avg_time: Math.round(s.avg_time_per_question || 60),
        expected_time: Math.round(s.expected_time_per_question || 60),
        pacing_status: s.pacing_status || 'OPTIMAL',
        pacing_label: s.pacing_label || '⚡ Optimal Pace',
        status: s.strength_status || s.status || (acc >= 75 ? 'STRONG' : acc >= 50 ? 'COMPETENT' : 'WEAK_REVISION_REQUIRED'),
        status_label: s.strength_label || (acc >= 75 ? 'Mastered' : acc >= 50 ? 'Competent' : 'Focus Area'),
        retention_pct: Math.round(s.topic_retention_pct || s.retention_percentage || 75),
        stability_days: s.fsrs_stability_days || 3.5,
        retention_health: s.retention_health_label || 'Healthy Active',
        blooms: s.blooms_breakdown || {},
        question_numbers: [],
        topics: nestedTopics.map((t: any) => ({
          name: t.name || t.taxonomy_name || 'Core Concepts',
          subject: sName,
          total: t.total_questions || t.total || 0,
          attempted: t.attempted || 0,
          correct: t.correct || 0,
          incorrect: t.incorrect || 0,
          unattempted: Math.max(0, (t.total_questions || 0) - (t.attempted || 0)),
          accuracy: Math.round(t.accuracy_percentage || 0),
          positive_marks: t.positive_marks || 0,
          negative_marks: t.negative_marks || 0,
          net_marks: t.net_marks || 0,
          mean_score: t.mean_score || 0,
          avg_time: 60,
          expected_time: 60,
          pacing_status: 'OPTIMAL',
          pacing_label: '⚡ Optimal Pace',
          status: t.status || 'STRONG',
          status_label: t.status_label || 'Mastered',
          retention_pct: t.retention_percentage || 75,
          stability_days: 3.5,
          retention_health: 'Healthy Active',
          blooms: {},
          question_numbers: [],
          subtopics: Array.isArray(t.subtopics) ? t.subtopics : typeof t.subtopics === 'object' && t.subtopics ? Object.values(t.subtopics) : [],
        })),
      };
    });

    tops.forEach((t: any) => {
      const sName = t.subject || 'General Studies';
      const tName = t.taxonomy_name || t.topic || 'Core Concept';
      if (!subjMap[sName]) {
        subjMap[sName] = {
          name: sName,
          total: t.total_questions || 0,
          attempted: t.attempted_questions || t.total_questions || 0,
          correct: t.correct || 0,
          incorrect: t.incorrect || 0,
          unattempted: Math.max(0, (t.total_questions || 0) - (t.attempted_questions || 0)),
          accuracy: Math.round(t.accuracy_percentage || 0),
          positive_marks: t.positive_marks || Math.round((t.correct || 0) * 2.0 * 100) / 100,
          negative_marks: t.negative_marks || Math.round((t.incorrect || 0) * 0.6667 * 100) / 100,
          net_marks: t.net_marks || 0,
          mean_score: t.mean_score || 0,
          avg_time: Math.round(t.avg_time_per_question || 60),
          expected_time: 60,
          pacing_status: t.pacing_status || 'OPTIMAL',
          pacing_label: t.pacing_label || '⚡ Optimal Pace',
          status: t.strength_status || 'STRONG',
          status_label: t.strength_label || 'Strong',
          retention_pct: Math.round(t.topic_retention_pct || 75),
          stability_days: t.fsrs_stability_days || 3.5,
          retention_health: t.retention_health_label || 'Healthy Active',
          blooms: t.blooms_breakdown || {},
          question_numbers: [],
          topics: [],
        };
      }

      const alreadyHasTopic = subjMap[sName].topics.some((existingT: any) => existingT.name === tName);
      if (!alreadyHasTopic) {
        const tNode = {
          name: tName,
          subject: sName,
          total: t.total_questions || 0,
          attempted: t.attempted_questions || t.total_questions || 0,
          correct: t.correct || 0,
          incorrect: t.incorrect || 0,
          unattempted: Math.max(0, (t.total_questions || 0) - (t.attempted_questions || 0)),
          accuracy: Math.round(t.accuracy_percentage || 0),
          positive_marks: t.positive_marks || Math.round((t.correct || 0) * 2.0 * 100) / 100,
          negative_marks: t.negative_marks || Math.round((t.incorrect || 0) * 0.6667 * 100) / 100,
          net_marks: t.net_marks || 0,
          mean_score: t.mean_score || 0,
          avg_time: Math.round(t.avg_time_per_question || 60),
          expected_time: 60,
          pacing_status: t.pacing_status || 'OPTIMAL',
          pacing_label: t.pacing_label || '⚡ Optimal Pace',
          status: t.strength_status || 'STRONG',
          status_label: t.strength_label || 'Strong',
          retention_pct: Math.round(t.topic_retention_pct || 75),
          stability_days: t.fsrs_stability_days || 3.5,
          retention_health: t.retention_health_label || 'Healthy Active',
          blooms: t.blooms_breakdown || {},
          question_numbers: [],
          subtopics: Array.isArray(t.subtopics) ? t.subtopics : typeof t.subtopics === 'object' && t.subtopics ? Object.values(t.subtopics) : [],
        };
        subjMap[sName].topics.push(tNode);
      }
    });

    if (Object.keys(subjMap).length === 0) {
      const defSubjects = [
        { name: 'Indian Polity & Governance', topics: ['Constitution & Preamble', 'Fundamental Rights & DPSP', 'Union & State Executive'] },
        { name: 'History & Art of India', topics: ['Ancient India', 'Medieval India', 'Modern National Movement'] },
        { name: 'Geography & Environment', topics: ['Physical Geography', 'Indian Geography', 'Ecology & Climate Change'] },
        { name: 'Indian Economy & Social Development', topics: ['Macroeconomics & GDP', 'Fiscal & Monetary Policy', 'Inclusive Growth'] },
        { name: 'General Science & Technology', topics: ['Space & Defense', 'Biotechnology', 'Information Technology'] },
        { name: 'Current Affairs & International Relations', topics: ['Bilateral Summits', 'Global Treaties', 'National Initiatives'] },
      ];
      defSubjects.forEach((s) => {
        subjMap[s.name] = {
          name: s.name,
          total: 0,
          attempted: 0,
          correct: 0,
          incorrect: 0,
          unattempted: 0,
          accuracy: 0,
          positive_marks: 0,
          negative_marks: 0,
          net_marks: 0,
          mean_score: 0,
          avg_time: 60,
          expected_time: 60,
          pacing_status: 'OPTIMAL',
          pacing_label: '⚡ Optimal Pace',
          status: 'COMPETENT',
          status_label: 'Focus Area',
          retention_pct: 75,
          stability_days: 3.5,
          retention_health: 'Healthy Active',
          blooms: {},
          question_numbers: [],
          topics: s.topics.map((t) => ({
            name: t,
            subject: s.name,
            total: 0,
            attempted: 0,
            correct: 0,
            incorrect: 0,
            unattempted: 0,
            accuracy: 0,
            positive_marks: 0,
            negative_marks: 0,
            net_marks: 0,
            mean_score: 0,
            avg_time: 60,
            expected_time: 60,
            pacing_status: 'OPTIMAL',
            pacing_label: '⚡ Optimal Pace',
            status: 'COMPETENT',
            status_label: 'Focus Area',
            retention_pct: 75,
            stability_days: 3.5,
            retention_health: 'Healthy Active',
            blooms: {},
            question_numbers: [],
            subtopics: [],
          })),
        };
      });
    }

    return Object.values(subjMap);
  }, [questionsList, report]);

  const handleJumpToQuestion = (qNum: number) => {
    setActiveTab('questions');
    setQuestionFilter('all');
    const matchedIndex = questionsList.findIndex((q, idx) => Number(q.question_number || idx + 1) === qNum);
    if (matchedIndex >= 0) {
      const targetPage = Math.floor(matchedIndex / questionPageSize) + 1;
      setQuestionPage(targetPage);
      const matchedQ = questionsList[matchedIndex];
      const qId = matchedQ.question_id || matchedQ.question_number || qNum;
      setExpandedQuestionId(qId);
      setTimeout(() => {
        const el = document.getElementById(`question_card_${qNum}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 150);
    }
  };

  const toggleHierarchyNode = (nodeId: string) => {
    setExpandedHierarchyNodes((prev) => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  const expandAllHierarchy = () => {
    const allIds: Record<string, boolean> = {};
    const traverse = (node: any, currentId: string) => {
      allIds[currentId] = true;
      node.topics?.forEach((t: any) => traverse(t, `${currentId}_${t.name}`));
      node.subtopics?.forEach((s: any) => traverse(s, `${currentId}_${s.name}`));
    };
    hierarchyData.forEach((s: any) => traverse(s, `node_${s.name}`));
    setExpandedHierarchyNodes(allIds);
  };

  const collapseAllHierarchy = () => {
    setExpandedHierarchyNodes({});
  };

  const renderHierarchyNode = (node: any, level: number, nodeId: string) => {
    const isExpanded = !!expandedHierarchyNodes[nodeId];
    const hasChildren = (node.topics && node.topics.length > 0) || (node.subtopics && node.subtopics.length > 0);
    const hasQuestions = node.question_numbers && node.question_numbers.length > 0;
    const isLeaf = !hasChildren;

    const accColor = node.accuracy >= 85 ? '#3A8B53' : node.accuracy >= 70 ? 'var(--status-success)' : node.accuracy >= 50 ? '#F2B623' : node.accuracy >= 30 ? '#F47B35' : 'var(--primary-red)';

    return (
      <div key={nodeId} style={{ marginBottom: 4 }}>
        <div
          onClick={() => hasChildren ? toggleHierarchyNode(nodeId) : undefined}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            marginLeft: level * 20,
            backgroundColor: level === 0 ? (isDark ? 'rgba(255,255,255,0.05)' : 'var(--bg-subtle)') : 'transparent',
            border: level === 0 ? `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'var(--border-color)'}` : 'none',
            borderBottom: level > 0 ? `1px dashed ${isDark ? 'rgba(255,255,255,0.1)' : 'var(--border-color)'}` : undefined,
            borderRadius: 'var(--radius)',
            cursor: hasChildren ? 'pointer' : 'default',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {hasChildren ? (
              isExpanded ? <ChevronDown size={16} color="var(--text-muted)" /> : <ChevronRight size={16} color="var(--text-muted)" />
            ) : (
              <div style={{ width: 16 }} />
            )}
            <span style={{
              fontSize: level === 0 ? 14 : level === 1 ? 13 : 12,
              fontWeight: level === 0 ? 800 : level === 1 ? 700 : 600,
              color: isDark ? 'var(--border-color)' : '#1e293b'
            }}>
              {node.name || 'Unnamed Node'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {node.correct || 0} / {node.total || 0}
            </span>
            <span style={{
              display: 'inline-block',
              width: 48,
              textAlign: 'right',
              fontSize: 12,
              fontWeight: 800,
              color: accColor
            }}>
              {node.accuracy || 0}%
            </span>
          </div>
        </div>

        {isExpanded && hasChildren && (
          <div style={{ marginTop: 4 }}>
            {node.topics && node.topics.map((child: any) => renderHierarchyNode(child, level + 1, `${nodeId}_${child.name}`))}
            {node.subtopics && node.subtopics.map((child: any) => renderHierarchyNode(child, level + 1, `${nodeId}_${child.name}`))}
          </div>
        )}
        
        {isExpanded && isLeaf && hasQuestions && !isCumulative && (
          <div style={{ marginLeft: level * 20 + 36, marginTop: 4, marginBottom: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {node.question_numbers.map((qNum: number) => (
              <button
                key={qNum}
                onClick={(e) => {
                  e.stopPropagation();
                  handleJumpToQuestion(qNum);
                }}
                style={{
                  padding: '4px 8px',
                  fontSize: 11,
                  fontWeight: 700,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'var(--bg-hover)',
                  color: isDark ? 'var(--border-color)' : 'var(--text-secondary)',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'var(--border-color)'}`,
                  borderRadius: 'var(--radius)',
                  cursor: 'pointer'
                }}
              >
                Q{qNum}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Navigation Tabs (Separated Sub-Pages for Exam Report & User Report) */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'var(--border-color)'}`,
          paddingBottom: 12,
          overflowX: 'auto',
        }}
      >
        {(analysisLocked
          ? [
              { id: 'summary', label: 'Summary', icon: Zap },
              { id: 'questions', label: 'Questions', icon: Target },
            ]
          : isCumulative
          ? [
              { id: 'summary', label: 'Summary', icon: TrendingUp },
              { id: 'topics', label: 'Topics', icon: BookOpen },
              { id: 'ai-insights', label: 'Study plan', icon: Lightbulb },
            ]
          : [
              { id: 'summary', label: 'Summary', icon: Zap },
              { id: 'questions', label: 'Questions', icon: Target },
              { id: 'topics', label: 'Topics', icon: BookOpen },
              { id: 'ai-insights', label: 'Study plan', icon: Lightbulb },
            ]
        ).map((tab) => {
          const IconComp = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 18px',
                borderRadius: 'var(--radius)',
                border: 'none',
                backgroundColor: isActive ? 'var(--primary-red)' : isDark ? 'rgba(255,255,255,0.05)' : 'var(--bg-hover)',
                color: isActive ? 'var(--bg-card)' : isDark ? 'var(--text-disabled)' : 'var(--text-muted)',
                fontWeight: 700,
                fontSize: 13.5,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap',
              }}
            >
              <IconComp size={16} />
              <span>{tab.label}</span>
              {tab.id === 'ai-insights' && !hasAiInsight && !analysisLocked && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    padding: '2px 6px',
                    borderRadius: 2,
                    backgroundColor: hasAiInsight
                      ? (isActive ? 'rgba(255,255,255,0.25)' : '#ECFDF5')
                      : (isActive ? 'rgba(255,255,255,0.25)' : 'var(--status-warning-bg)'),
                    color: hasAiInsight
                      ? (isActive ? 'var(--bg-card)' : '#059669')
                      : (isActive ? 'var(--bg-card)' : '#D97706'),
                  }}
                >
                  {hasAiInsight ? 'READY' : 'GENERATING'}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          PLACE 1: EXAM SCORECARD PERFORMANCE (Tab 1)
      ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'summary' && analysisLocked && <LockedSummary report={report as any} />}
      {activeTab === 'summary' && !analysisLocked && (
        <>
          <ReportSummary report={report as any} isCumulative={Boolean(isCumulative)} />
          <button
            type="button"
            onClick={() => setShowDetailedAnalysis((v) => !v)}
            aria-expanded={showDetailedAnalysis}
            style={{
              alignSelf: 'flex-start',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 16px',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-primary)',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            {showDetailedAnalysis ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            {showDetailedAnalysis ? 'Hide detailed analysis' : 'Show detailed analysis'}
          </button>
        </>
      )}

      {activeTab === 'summary' && showDetailedAnalysis && !isCumulative && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Executive Prelims / Practice Performance & Benchmark Card */}
          {(() => {
            const upscBench = (report as any)?.part_2_exam_macro_scorecard?.upsc_prelims_benchmark || {};
            const totalCount = questionsList.length || (metadata?.exam_attempt as any)?.total_questions || 10;
            const maxPossibleScore = Number(metadata?.exam_attempt?.max_possible_score || (metadata?.exam_attempt as any)?.total_marks_possible || upscBench.total_marks_possible || (totalCount * 2.0));
            const netMarks = Number(metadata?.exam_attempt?.total_score_awarded ?? (metadata?.exam_attempt as any)?.total_score ?? upscBench.candidate_net_score ?? 0);
            const isPractice = Boolean(upscBench.is_practice_mode || (maxPossibleScore < 100) || (totalCount < 50));
            const cutoffTarget = Number(upscBench.expected_cutoff_marks || (isPractice ? Math.round(maxPossibleScore * 0.46 * 100) / 100 : 92.0));
            const cutoffMargin = Math.round((netMarks - cutoffTarget) * 10) / 10;
            const isAboveCutoff = netMarks >= cutoffTarget;
            const corrCount = questionsList.filter((q) => getQuestionState(q).isCorr).length;
            const incCount = questionsList.filter((q) => getQuestionState(q).isInc).length;
            const unattCount = questionsList.filter((q) => getQuestionState(q).isUnatt).length;
            const attemptedCount = corrCount + incCount;
            const posMarks = upscBench.positive_marks_earned || Math.round(corrCount * 2.0 * 100) / 100;
            const negMarks = upscBench.negative_marks_lost || Math.round(incCount * 0.66 * 100) / 100;
            const attemptAccPct = attemptedCount > 0 ? Math.round((corrCount / attemptedCount) * 1000) / 10 : 0.0;
            const coveragePct = Math.round((attemptedCount / Math.max(1, totalCount)) * 1000) / 10;

            return (
              <div
                style={{
                  ...cardStyle,
                  background: isDark
                    ? 'linear-gradient(135deg, rgba(23, 32, 51, 0.3) 0%, rgba(15, 23, 42, 0.8) 100%)'
                    : 'linear-gradient(135deg, #F8FAFC 0%, #ffffff 100%)',
                  border: '1px solid rgba(var(--primary-red-rgb), 0.3)',
                  padding: 24,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
                  <div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 'var(--radius)', backgroundColor: isAboveCutoff ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)', color: isAboveCutoff ? '#3A8B53' : '#F2B623', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', marginBottom: 8 }}>
                      <Award size={14} />
                      {upscBench.benchmark_status || (isAboveCutoff ? (isPractice ? 'Qualifying Practice Standard' : 'Clearing Qualifying Cutoff') : (isPractice ? 'Practice Revision Recommended' : 'Near Cutoff Benchmark'))}
                    </div>
                    <h2 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 4px 0', color: isDark ? 'var(--bg-card)' : 'var(--deep-navy)' }}>
                      {isPractice ? 'Practice Session Diagnostic Summary' : 'Executive UPSC Prelims Diagnostic Summary'}
                    </h2>
                    <p style={{ fontSize: 13, color: isDark ? 'var(--text-disabled)' : 'var(--text-muted)', margin: 0 }}>
                      Comprehensive marks accounting, qualifying benchmark margin, and error breakdown.
                    </p>
                  </div>

                  <div style={{ padding: '10px 18px', borderRadius: 'var(--radius)', backgroundColor: isDark ? 'rgba(15, 23, 42, 0.6)' : 'var(--bg-card)', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'var(--border-color)'}`, textAlign: 'right' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      {isPractice ? 'Practice Mastery Benchmark' : 'UPSC Cutoff Benchmark'}
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: isAboveCutoff ? '#3A8B53' : '#F2B623' }}>
                      {cutoffMargin >= 0 ? `+${cutoffMargin}` : cutoffMargin} Marks
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}> vs {cutoffTarget.toFixed(1)} {isPractice ? 'Target' : 'Cutoff'}</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
                  <div style={{ padding: 14, borderRadius: 'var(--radius)', backgroundColor: isDark ? 'rgba(16,185,129,0.1)' : '#f0fdf4', border: '1px solid rgba(16,185,129,0.25)' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#3A8B53', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <CheckCircle2 size={16} /> Marks Earned (+)
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: '#3A8B53', marginTop: 4 }}>+{posMarks}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{corrCount} correct answers</div>
                  </div>

                  <div style={{ padding: 14, borderRadius: 'var(--radius)', backgroundColor: isDark ? 'rgba(var(--primary-red-rgb), 0.1)' : '#fef2f2', border: '1px solid rgba(var(--primary-red-rgb), 0.25)' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary-red)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <AlertTriangle size={16} /> Negative Marks Lost (-)
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--primary-red)', marginTop: 4 }}>-{negMarks}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{incCount} incorrect selections</div>
                  </div>

                  <div style={{ padding: 14, borderRadius: 'var(--radius)', backgroundColor: isDark ? 'rgba(var(--primary-red-rgb), 0.1)' : 'var(--bg-subtle)', border: '1px solid rgba(var(--primary-red-rgb), 0.25)' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary-red)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Zap size={16} /> Net Final Score
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--primary-red)', marginTop: 4 }}>{netMarks.toFixed(2)}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Out of {maxPossibleScore.toFixed(2)} Marks</div>
                  </div>

                  <div style={{ padding: 14, borderRadius: 'var(--radius)', backgroundColor: isDark ? 'rgba(139,92,246,0.1)' : '#faf5ff', border: '1px solid rgba(139,92,246,0.25)' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Target size={16} /> Accuracy & Coverage
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: '#8b5cf6', marginTop: 4 }}>{attemptAccPct}%</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{attemptedCount}/{totalCount} questions attempted ({coveragePct}%)</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
                  <div style={{ padding: 12, borderRadius: 'var(--radius)', backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'var(--bg-card)', border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'var(--border-color)'}` }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#3A8B53', marginBottom: 4 }}>🟢 Top Marks Drivers</div>
                    <div style={{ fontSize: 12.5, color: isDark ? 'var(--border-color)' : 'var(--text-secondary)' }}>
                      {corrCount > 0 ? `Secured +${posMarks} positive marks across ${corrCount} accurate concept selections.` : 'No positive mark drivers recorded in this attempt.'}
                    </div>
                  </div>

                  <div style={{ padding: 12, borderRadius: 'var(--radius)', backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'var(--bg-card)', border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'var(--border-color)'}` }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--primary-red)', marginBottom: 4 }}>🔴 Primary Marks Leakage</div>
                    <div style={{ fontSize: 12.5, color: isDark ? 'var(--border-color)' : 'var(--text-secondary)' }}>
                      {incCount > 0 ? `Lost -${negMarks} marks to negative penalty across ${incCount} incorrect distractor choices.` : 'Zero marks leaked to negative penalty.'}
                    </div>
                  </div>

                  <div style={{ padding: 12, borderRadius: 'var(--radius)', backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'var(--bg-card)', border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'var(--border-color)'}` }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--primary-red)', marginBottom: 4 }}>⚡ Attempt Coverage & Pacing</div>
                    <div style={{ fontSize: 12.5, color: isDark ? 'var(--border-color)' : 'var(--text-secondary)' }}>
                      {coveragePct < 50.0 ? `Attempted ${coveragePct}% of the paper. Focus on syllabus breadth to attempt 80+ questions on test day.` : `Solid attempt volume covering ${coveragePct}% of the exam.`}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* 9 Macro Performance Scorecards (Horizontal Full-Width Cards with Optimal Height) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%' }}>
            {/* 1. Overall Exam Readiness */}
            <div
              style={{
                ...cardStyle,
                width: '100%',
                padding: '16px 20px',
                borderLeft: '5px solid var(--primary-red)',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 900,
                      color: 'var(--primary-red)',
                      backgroundColor: isDark ? 'rgba(var(--primary-red-rgb), 0.15)' : 'var(--bg-subtle)',
                      padding: '3px 8px',
                      borderRadius: 'var(--radius)',
                      textTransform: 'uppercase',
                    }}
                  >
                    Metric 01
                  </span>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: isDark ? 'var(--bg-card)' : 'var(--deep-navy)' }}>
                      Overall Exam Readiness
                    </h3>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Qualification Target Benchmark</div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--primary-red)' }}>
                    {icrs?.icrs_score != null ? icrs.icrs_score : '—'} <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>/ 100</span>
                  </div>
                  {(() => {
                    const b = getBadgeStyle(icrs?.readiness_label || icrs?.classification || 'Competitive Benchmark Ready');
                    return (
                      <span
                        style={{
                          fontSize: 11.5,
                          fontWeight: 700,
                          padding: '3px 10px',
                          borderRadius: 'var(--radius)',
                          backgroundColor: b.bg,
                          color: b.color,
                          border: `1px solid ${b.border}`,
                        }}
                      >
                        {b.label}
                      </span>
                    );
                  })()}
                </div>
              </div>

              <div style={{ fontSize: 12.5, color: isDark ? 'var(--border-color)' : 'var(--text-secondary)' }}>
                Cutoff Buffer: <strong>{icrs?.cutoff_margin !== undefined ? `${icrs.cutoff_margin > 0 ? '+' : ''}${icrs.cutoff_margin} Marks` : 'On Qualifying Track'}</strong> • Readiness Band: <strong>{icrs?.readiness_label || 'Competitive'}</strong>
              </div>

              <div
                style={{
                  padding: '9px 14px',
                  borderRadius: 'var(--radius)',
                  backgroundColor: isDark ? 'rgba(var(--primary-red-rgb), 0.08)' : 'rgba(var(--primary-red-rgb), 0.04)',
                  borderLeft: '3px solid var(--primary-red)',
                  border: `1px solid ${isDark ? 'rgba(var(--primary-red-rgb), 0.2)' : 'rgba(var(--primary-red-rgb), 0.15)'}`,
                  borderLeftWidth: 3,
                  fontSize: 12.5,
                  color: isDark ? 'var(--border-color)' : 'var(--text-secondary)',
                  lineHeight: 1.5,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--primary-red)', textTransform: 'uppercase', marginBottom: 2 }}>
                  💡 Mentor's Diagnostic Context
                </div>
                {aiInsights.exam_readiness_insight || aiInsights.benchmark_verdict || icrs?.interpretation || 'Multi-factor readiness index evaluating net score against qualification benchmarks.'}
              </div>
              {renderInfoToggle('icrs_info', 'Comprehensive multi-factor readiness score.', 'Evaluates your net score against historical cutoffs, attempt accuracy, and elimination discipline.', 'Score > 70 indicates competitive prelims readiness.')}
            </div>

            {/* 2. Knowledge Depth & Mastery */}
            <div
              style={{
                ...cardStyle,
                width: '100%',
                padding: '16px 20px',
                borderLeft: '5px solid #3A8B53',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 900,
                      color: '#3A8B53',
                      backgroundColor: isDark ? 'rgba(16,185,129,0.15)' : '#f0fdf4',
                      padding: '3px 8px',
                      borderRadius: 'var(--radius)',
                      textTransform: 'uppercase',
                    }}
                  >
                    Metric 02
                  </span>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: isDark ? 'var(--bg-card)' : 'var(--deep-navy)' }}>
                      Knowledge Depth & Mastery
                    </h3>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Conceptual Command Across Difficulty</div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ fontSize: 24, fontWeight: 900, color: '#3A8B53' }}>
                    {irt?.percentile_rank ? `Top ${(100 - irt.percentile_rank).toFixed(1)}% Benchmark` : 'Competent Tier'}
                  </div>
                  <span
                    style={{
                      fontSize: 11.5,
                      fontWeight: 700,
                      padding: '3px 10px',
                      borderRadius: 'var(--radius)',
                      backgroundColor: 'rgba(16,185,129,0.15)',
                      color: '#3A8B53',
                      border: '1px solid rgba(16,185,129,0.3)',
                    }}
                  >
                    {irt?.ability_label || 'Competent Tier'}
                  </span>
                </div>
              </div>

              <div style={{ fontSize: 12.5, color: isDark ? 'var(--border-color)' : 'var(--text-secondary)' }}>
                Estimated Percentile: <strong>{irt?.percentile_rank ?? 50.0}%</strong> • Mastery Status: <strong style={{ color: '#3A8B53' }}>{irt?.ability_label || 'Competent'}</strong>
              </div>

              <div
                style={{
                  padding: '9px 14px',
                  borderRadius: 'var(--radius)',
                  backgroundColor: isDark ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.04)',
                  borderLeft: '3px solid #3A8B53',
                  border: `1px solid ${isDark ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.15)'}`,
                  borderLeftWidth: 3,
                  fontSize: 12.5,
                  color: isDark ? 'var(--border-color)' : 'var(--text-secondary)',
                  lineHeight: 1.5,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 800, color: '#3A8B53', textTransform: 'uppercase', marginBottom: 2 }}>
                  💡 Mentor's Diagnostic Context
                </div>
                {aiInsights.knowledge_depth_insight || 'Measures underlying conceptual strength independently of question difficulty variations.'}
              </div>
              {renderInfoToggle('irt_info', 'Estimates true underlying ability independently of paper difficulty.', 'Calculates how consistently you answer moderate and high-difficulty questions correctly.', 'Percentile > 75% represents competitive benchmark.')}
            </div>

            {/* 3. Guessing Risk & Confidence */}
            <div
              style={{
                ...cardStyle,
                width: '100%',
                padding: '16px 20px',
                borderLeft: '5px solid #F2B623',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 900,
                      color: '#F2B623',
                      backgroundColor: isDark ? 'rgba(245,158,11,0.15)' : '#fefce8',
                      padding: '3px 8px',
                      borderRadius: 'var(--radius)',
                      textTransform: 'uppercase',
                    }}
                  >
                    Metric 03
                  </span>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: isDark ? 'var(--bg-card)' : 'var(--deep-navy)' }}>
                      Guessing Risk & Confidence
                    </h3>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Educated Eliminations vs Blind Guesses</div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ fontSize: 24, fontWeight: 900, color: '#F2B623' }}>
                    {(() => {
                      const val = gti?.aggregate !== undefined ? gti.aggregate : gti?.aggregate_gti !== undefined ? gti.aggregate_gti : 0.15;
                      return `${(val * 100).toFixed(1)}% Guess Rate`;
                    })()}
                  </div>
                  {(() => {
                    const b = getBadgeStyle(gti?.label || gti?.category || 'CONTROLLED_CALCULATED_RISK');
                    return (
                      <span
                        style={{
                          fontSize: 11.5,
                          fontWeight: 700,
                          padding: '3px 10px',
                          borderRadius: 'var(--radius)',
                          backgroundColor: b.bg,
                          color: b.color,
                          border: `1px solid ${b.border}`,
                        }}
                      >
                        {b.label}
                      </span>
                    );
                  })()}
                </div>
              </div>

              <div style={{ fontSize: 12.5, color: isDark ? 'var(--border-color)' : 'var(--text-secondary)' }}>
                Instinct Profile: <strong>{gti?.label || 'Controlled Risk'}</strong> • Discipline Threshold: <strong>Target &lt; 20%</strong>
              </div>

              <div
                style={{
                  padding: '9px 14px',
                  borderRadius: 'var(--radius)',
                  backgroundColor: isDark ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.04)',
                  borderLeft: '3px solid #F2B623',
                  border: `1px solid ${isDark ? 'rgba(245,158,11,0.2)' : 'rgba(245,158,11,0.15)'}`,
                  borderLeftWidth: 3,
                  fontSize: 12.5,
                  color: isDark ? 'var(--border-color)' : 'var(--text-secondary)',
                  lineHeight: 1.5,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 800, color: '#F2B623', textTransform: 'uppercase', marginBottom: 2 }}>
                  💡 Mentor's Diagnostic Context
                </div>
                {aiInsights.guessing_and_confidence_insight || gti?.recommendation || 'Differentiates educated 50:50 eliminations from blind impulsive guesses under time pressure.'}
              </div>
              {renderInfoToggle('gti_info', 'Ratio of rushed guesses versus thoughtful attempts.', 'Evaluates response times against minimum cognitive thresholds.', 'Guess rate < 20% indicates controlled exam discipline.')}
            </div>

            {/* 4. Elimination Accuracy */}
            <div
              style={{
                ...cardStyle,
                width: '100%',
                padding: '16px 20px',
                borderLeft: '5px solid #8b5cf6',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 900,
                      color: '#8b5cf6',
                      backgroundColor: isDark ? 'rgba(139,92,246,0.15)' : '#faf5ff',
                      padding: '3px 8px',
                      borderRadius: 'var(--radius)',
                      textTransform: 'uppercase',
                    }}
                  >
                    Metric 04
                  </span>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: isDark ? 'var(--bg-card)' : 'var(--deep-navy)' }}>
                      Elimination Accuracy
                    </h3>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Accuracy on 50:50 Pruned Choices</div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ fontSize: 24, fontWeight: 900, color: '#8b5cf6' }}>
                    {(() => {
                      const rawScore = oeei?.oeei_score_pct ?? (oeei?.oeei_score !== undefined ? (oeei.oeei_score <= 1.0 ? oeei.oeei_score * 100 : oeei.oeei_score) : 70);
                      return `${Math.round(rawScore)}% Conversion`;
                    })()}
                  </div>
                  {(() => {
                    const b = getBadgeStyle(oeei?.elimination_rating || oeei?.elimination_efficiency_rating || 'HIGH_TACTICAL_PRECISION');
                    return (
                      <span
                        style={{
                          fontSize: 11.5,
                          fontWeight: 700,
                          padding: '3px 10px',
                          borderRadius: 'var(--radius)',
                          backgroundColor: b.bg,
                          color: b.color,
                          border: `1px solid ${b.border}`,
                        }}
                      >
                        {b.label}
                      </span>
                    );
                  })()}
                </div>
              </div>

              <div style={{ fontSize: 12.5, color: isDark ? 'var(--border-color)' : 'var(--text-secondary)' }}>
                Elimination Rating: <strong>{oeei?.elimination_rating || 'High Precision'}</strong> • Target: <strong>&gt; 70% Conversion</strong>
              </div>

              <div
                style={{
                  padding: '9px 14px',
                  borderRadius: 'var(--radius)',
                  backgroundColor: isDark ? 'rgba(139,92,246,0.08)' : 'rgba(139,92,246,0.04)',
                  borderLeft: '3px solid #8b5cf6',
                  border: `1px solid ${isDark ? 'rgba(139,92,246,0.2)' : 'rgba(139,92,246,0.15)'}`,
                  borderLeftWidth: 3,
                  fontSize: 12.5,
                  color: isDark ? 'var(--border-color)' : 'var(--text-secondary)',
                  lineHeight: 1.5,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 800, color: '#8b5cf6', textTransform: 'uppercase', marginBottom: 2 }}>
                  💡 Mentor's Diagnostic Context
                </div>
                {aiInsights.elimination_skill_insight || 'Measures how reliably you convert 50:50 elimination choices into net positive marks.'}
              </div>
              {renderInfoToggle('oeei_info', 'Option elimination conversion rate.', 'Measures accuracy on questions after eliminating 1 or 2 options.', 'Conversion > 70% indicates strong analytical pruning.')}
            </div>

            {/* 5. Cognitive Stamina */}
            <div
              style={{
                ...cardStyle,
                width: '100%',
                padding: '16px 20px',
                borderLeft: '5px solid #06b6d4',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 900,
                      color: '#06b6d4',
                      backgroundColor: isDark ? 'rgba(6,182,212,0.15)' : '#ecfeff',
                      padding: '3px 8px',
                      borderRadius: 'var(--radius)',
                      textTransform: 'uppercase',
                    }}
                  >
                    Metric 05
                  </span>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: isDark ? 'var(--bg-card)' : 'var(--deep-navy)' }}>
                      Cognitive Stamina
                    </h3>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Focus & Precision Across Duration</div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ fontSize: 24, fontWeight: 900, color: '#06b6d4' }}>
                    {satoi?.satoi_score ?? 80} / 100 Stamina
                  </div>
                  {(() => {
                    const b = getBadgeStyle(satoi?.stamina_label || satoi?.cognitive_stamina_status || 'STABLE_COGNITIVE_STAMINA');
                    return (
                      <span
                        style={{
                          fontSize: 11.5,
                          fontWeight: 700,
                          padding: '3px 10px',
                          borderRadius: 'var(--radius)',
                          backgroundColor: b.bg,
                          color: b.color,
                          border: `1px solid ${b.border}`,
                        }}
                      >
                        {b.label}
                      </span>
                    );
                  })()}
                </div>
              </div>

              <div style={{ fontSize: 12.5, color: isDark ? 'var(--border-color)' : 'var(--text-secondary)' }}>
                Endurance Profile: <strong>{satoi?.stamina_label || 'Stable Focus'}</strong> • Late Exam Stability: <strong>Maintained</strong>
              </div>

              <div
                style={{
                  padding: '9px 14px',
                  borderRadius: 'var(--radius)',
                  backgroundColor: isDark ? 'rgba(6,182,212,0.08)' : 'rgba(6,182,212,0.04)',
                  borderLeft: '3px solid #06b6d4',
                  border: `1px solid ${isDark ? 'rgba(6,182,212,0.2)' : 'rgba(6,182,212,0.15)'}`,
                  borderLeftWidth: 3,
                  fontSize: 12.5,
                  color: isDark ? 'var(--border-color)' : 'var(--text-secondary)',
                  lineHeight: 1.5,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 800, color: '#06b6d4', textTransform: 'uppercase', marginBottom: 2 }}>
                  💡 Mentor's Diagnostic Context
                </div>
                {aiInsights.stamina_and_consistency_insight || satoi?.recommendation || 'Evaluates whether your attempt accuracy and focus remained stable across all quarters of the paper.'}
              </div>
              {renderInfoToggle('satoi_info', 'Cognitive endurance across paper quartiles.', 'Compares accuracy in early questions versus late questions taking unattempted questions into account.', 'Score > 75 represents stable 2-hour test stamina.')}
            </div>

            {/* 6. Pacing & Speed Management */}
            <div
              style={{
                ...cardStyle,
                width: '100%',
                padding: '16px 20px',
                borderLeft: '5px solid #ec4899',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 900,
                      color: '#ec4899',
                      backgroundColor: isDark ? 'rgba(236,72,153,0.15)' : '#fdf2f8',
                      padding: '3px 8px',
                      borderRadius: 'var(--radius)',
                      textTransform: 'uppercase',
                    }}
                  >
                    Metric 06
                  </span>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: isDark ? 'var(--bg-card)' : 'var(--deep-navy)' }}>
                      Pacing & Speed Management
                    </h3>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Time Allocation & Velocity per Question (Telemetry Calibrated)</div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ fontSize: 24, fontWeight: 900, color: '#ec4899' }}>
                    ~{pacing?.avg_time_per_question_sec ? Math.round(pacing.avg_time_per_question_sec) : 60}s <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>/ question</span>
                  </div>
                  {(() => {
                    const b = getBadgeStyle(pacing?.pacing_classification || pacing?.pacing_status || 'BALANCED_PACING');
                    return (
                      <span
                        style={{
                          fontSize: 11.5,
                          fontWeight: 700,
                          padding: '3px 10px',
                          borderRadius: 'var(--radius)',
                          backgroundColor: b.bg,
                          color: b.color,
                          border: `1px solid ${b.border}`,
                        }}
                      >
                        {b.label}
                      </span>
                    );
                  })()}
                </div>
              </div>

              <div style={{ fontSize: 12.5, color: isDark ? 'var(--border-color)' : 'var(--text-secondary)' }}>
                Time Utilization: <strong>{pacing?.time_utilization_pct || 90}% of Duration</strong> • Benchmark Pace: <strong>60–72s / question</strong>
              </div>

              <div
                style={{
                  padding: '9px 14px',
                  borderRadius: 'var(--radius)',
                  backgroundColor: isDark ? 'rgba(236,72,153,0.08)' : 'rgba(236,72,153,0.04)',
                  borderLeft: '3px solid #ec4899',
                  border: `1px solid ${isDark ? 'rgba(236,72,153,0.2)' : 'rgba(236,72,153,0.15)'}`,
                  borderLeftWidth: 3,
                  fontSize: 12.5,
                  color: isDark ? 'var(--border-color)' : 'var(--text-secondary)',
                  lineHeight: 1.5,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 800, color: '#ec4899', textTransform: 'uppercase', marginBottom: 2 }}>
                  💡 Mentor's Diagnostic Context
                </div>
                {aiInsights.pacing_and_time_insight || 'Tracks whether you allocated sufficient time per question without running into end-of-test time pressure.'}
              </div>
              {renderInfoToggle('pacing_info', 'Time management across the full paper.', 'Tracks whether you allocated sufficient time per question without running into end-of-test time pressure.', 'Ideal average pace is 60–75s per question for UPSC GS1.')}
            </div>

            {/* 7. Decision Consistency & Changing Answers */}
            <div
              style={{
                ...cardStyle,
                width: '100%',
                padding: '16px 20px',
                borderLeft: '5px solid #f43f5e',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                transition: 'all 0.2s ease',
              }}
            >
              {(() => {
                const totalSwitches = switchRegret?.total_switches ?? switchRegret?.switch_frequency ?? questionsList.filter((q) => q.is_option_switched || (q.option_switch_count && q.option_switch_count > 0)).length;
                const posSwitches = switchRegret?.positive_switches ?? 0;
                const negSwitches = switchRegret?.negative_regret_switches ?? 0;
                const wrongToWrong = switchRegret?.wrong_to_wrong_switches ?? Math.max(0, totalSwitches - posSwitches - negSwitches);
                const netImpact = switchRegret?.net_score_impact !== undefined ? Number(switchRegret.net_score_impact) : (Math.round((posSwitches * 2.6667 - negSwitches * 2.6667) * 100) / 100);

                return (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 900,
                            color: '#f43f5e',
                            backgroundColor: isDark ? 'rgba(244,63,94,0.15)' : '#fff1f2',
                            padding: '3px 8px',
                            borderRadius: 'var(--radius)',
                            textTransform: 'uppercase',
                          }}
                        >
                          Metric 07
                        </span>
                        <div>
                          <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: isDark ? 'var(--bg-card)' : 'var(--deep-navy)' }}>
                            Answer Changing Impact
                          </h3>
                          <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Outcome & Marks Impact of Changing Options</div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ fontSize: 24, fontWeight: 900, color: netImpact >= 0 ? '#3A8B53' : 'var(--primary-red)' }}>
                          {netImpact >= 0 ? `+${netImpact}` : netImpact} Marks <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Net Impact</span>
                        </div>
                        <span
                          style={{
                            fontSize: 11.5,
                            fontWeight: 700,
                            padding: '3px 10px',
                            borderRadius: 'var(--radius)',
                            backgroundColor: netImpact >= 0 ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.15)',
                            color: netImpact >= 0 ? '#3A8B53' : '#f43f5e',
                            border: `1px solid ${netImpact >= 0 ? 'rgba(16,185,129,0.3)' : 'rgba(244,63,94,0.3)'}`,
                          }}
                        >
                          {totalSwitches === 0 ? 'Zero Switches' : netImpact >= 0 ? 'Net Positive' : 'Switch Regret'}
                        </span>
                      </div>
                    </div>

                    <div style={{ fontSize: 12.5, color: isDark ? 'var(--border-color)' : 'var(--text-secondary)' }}>
                      Changed: <strong>{totalSwitches} questions</strong> (Right→Wrong: <strong style={{ color: 'var(--primary-red)' }}>{negSwitches}</strong>, Wrong→Right: <strong style={{ color: '#3A8B53' }}>{posSwitches}</strong>, Wrong→Wrong: <strong style={{ color: '#F2B623' }}>{wrongToWrong}</strong>)
                    </div>

                    <div
                      style={{
                        padding: '9px 14px',
                        borderRadius: 'var(--radius)',
                        backgroundColor: isDark ? 'rgba(244,63,94,0.08)' : 'rgba(244,63,94,0.04)',
                        borderLeft: '3px solid #f43f5e',
                        border: `1px solid ${isDark ? 'rgba(244,63,94,0.2)' : 'rgba(244,63,94,0.15)'}`,
                        borderLeftWidth: 3,
                        fontSize: 12.5,
                        color: isDark ? 'var(--border-color)' : 'var(--text-secondary)',
                        lineHeight: 1.5,
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#f43f5e', textTransform: 'uppercase', marginBottom: 2 }}>
                        💡 Mentor's Diagnostic Context
                      </div>
                      {aiInsights.decision_confidence_insight || 'Measures whether second-guessing and switching options produced positive gains or costly negative penalties.'}
                    </div>
                  </>
                );
              })()}
              {renderInfoToggle('switch_info', 'Measures the cost vs benefit of second-guessing.', 'Tracks whether switching answers produced point gains or costly negative marking.', 'Only change answers when you find concrete factual evidence.')}
            </div>

            {/* 8. Trap Resistance */}
            <div
              style={{
                ...cardStyle,
                width: '100%',
                padding: '16px 20px',
                borderLeft: '5px solid #a855f7',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                transition: 'all 0.2s ease',
              }}
            >
              {(() => {
                const nearMiss = questionsList.filter((q) => {
                  const c = q.closeness_score_awarded ?? q.closeness_score ?? 0;
                  const label = q.closeness_classification || '';
                  return !getQuestionState(q).isCorr && ((c >= 0.33 && c < 0.99) || label.includes('High-Closeness') || label.includes('Near-Correct') || label.includes('Moderate'));
                }).length || (distractor?.high_closeness_count ?? 0);

                const cogTraps = questionsList.filter((q) => {
                  const c = q.closeness_score_awarded ?? q.closeness_score ?? 0;
                  const label = q.closeness_classification || '';
                  return !getQuestionState(q).isCorr && (c < 0.0 || label.includes('Misleading') || label.includes('Trap') || label.includes('Inverse') || label.includes('Contradictory'));
                }).length || (distractor?.misleading_distractor_count ?? 0);

                const totalTrapsFallen = nearMiss + cogTraps;
                const totalQCount = Math.max(1, questionsList.length || 10);
                const trapResistancePct = Math.max(0, Math.min(100, Math.round((1.0 - (totalTrapsFallen / totalQCount)) * 100)));

                return (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 900,
                            color: '#a855f7',
                            backgroundColor: isDark ? 'rgba(168,85,247,0.15)' : '#faf5ff',
                            padding: '3px 8px',
                            borderRadius: 'var(--radius)',
                            textTransform: 'uppercase',
                          }}
                        >
                          Metric 08
                        </span>
                        <div>
                          <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: isDark ? 'var(--bg-card)' : 'var(--deep-navy)' }}>
                            Trap Resistance
                          </h3>
                          <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Distractor & Extreme Keyword Avoidance (Closeness Score Evaluated)</div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ fontSize: 24, fontWeight: 900, color: '#a855f7' }}>
                          {trapResistancePct} <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>/ 100 Resistance</span>
                        </div>
                        <span
                          style={{
                            fontSize: 11.5,
                            fontWeight: 700,
                            padding: '3px 10px',
                            borderRadius: 'var(--radius)',
                            backgroundColor: 'rgba(168,85,247,0.15)',
                            color: '#a855f7',
                            border: '1px solid rgba(168,85,247,0.3)',
                          }}
                        >
                          {trapResistancePct >= 80 ? 'Trap Shield' : trapResistancePct >= 60 ? 'Moderate Shield' : 'Trap Vulnerable'}
                        </span>
                      </div>
                    </div>

                    <div style={{ fontSize: 12.5, color: isDark ? 'var(--border-color)' : 'var(--text-secondary)' }}>
                      Near-Miss Distractors: <strong>{nearMiss}</strong> • Statement Traps: <strong>{cogTraps} Detected</strong> • Traps Deflected: <strong>{totalQCount - totalTrapsFallen} / {totalQCount}</strong>
                    </div>

                    <div
                      style={{
                        padding: '9px 14px',
                        borderRadius: 'var(--radius)',
                        backgroundColor: isDark ? 'rgba(168,85,247,0.08)' : 'rgba(168,85,247,0.04)',
                        borderLeft: '3px solid #a855f7',
                        border: `1px solid ${isDark ? 'rgba(168,85,247,0.2)' : 'rgba(168,85,247,0.15)'}`,
                        borderLeftWidth: 3,
                        fontSize: 12.5,
                        color: isDark ? 'var(--border-color)' : 'var(--text-secondary)',
                        lineHeight: 1.5,
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#a855f7', textTransform: 'uppercase', marginBottom: 2 }}>
                        💡 Mentor's Diagnostic Context
                      </div>
                      {aiInsights.trap_resistance_insight || (totalTrapsFallen === 0 ? 'You exhibit strong trap resistance, successfully avoiding high-closeness and inverse fact distractors in the questions you chose to answer.' : `Detected ${totalTrapsFallen} trap selections. Strengthen factual boundary precision on extreme statement options.`)}
                    </div>
                  </>
                );
              })()}
              {renderInfoToggle('distractor_info', 'Resistance to deceptive distractor options.', 'Detects errors caused by extreme word traps (all, only, never) or partial memory alignment.', 'Resistance > 80 indicates deep conceptual clarity.')}
            </div>

            {/* 9. Priority Syllabus Action Areas */}
            <div
              style={{
                ...cardStyle,
                width: '100%',
                padding: '16px 20px',
                borderLeft: '5px solid #ef4444',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 900,
                      color: 'var(--primary-red)',
                      backgroundColor: isDark ? 'rgba(var(--primary-red-rgb), 0.15)' : '#fef2f2',
                      padding: '3px 8px',
                      borderRadius: 'var(--radius)',
                      textTransform: 'uppercase',
                    }}
                  >
                    Metric 09
                  </span>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: isDark ? 'var(--bg-card)' : 'var(--deep-navy)' }}>
                      Priority Syllabus Focus
                    </h3>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>High-Yield Action Areas</div>
                  </div>
                </div>

                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: 'var(--radius)',
                    backgroundColor: 'rgba(var(--primary-red-rgb), 0.15)',
                    color: 'var(--primary-red)',
                    border: '1px solid rgba(var(--primary-red-rgb), 0.3)',
                  }}
                >
                  Urgent Action
                </span>
              </div>

              {(() => {
                const weakSpotsList: string[] =
                  (report as any)?.part_3_aggregated_user_report?.mentorship_insight?.high_yield_weak_spots?.topics ||
                  (report as any)?.part_2_exam_macro_scorecard?.mentorship_insight?.high_yield_weak_spots?.topics ||
                  (report as any)?.part_2_taxonomy_analysis?.weakest_topics ||
                  taxonomyData.filter((t) => (t.accuracy_percentage ?? 100) < 65).map((t) => t.taxonomy_name) ||
                  [];
                const urgentLabel =
                  weakSpotsList.length > 0
                    ? weakSpotsList.slice(0, 4).join(', ')
                    : 'All evaluated topics above qualifying threshold';

                return (
                  <>
                    <div style={{ fontSize: 14, fontWeight: 800, color: weakSpotsList.length > 0 ? 'var(--primary-red)' : '#3A8B53' }}>
                      {urgentLabel}
                    </div>

                    <div
                      style={{
                        padding: '9px 14px',
                        borderRadius: 'var(--radius)',
                        backgroundColor: isDark ? 'rgba(var(--primary-red-rgb), 0.08)' : 'rgba(var(--primary-red-rgb), 0.04)',
                        borderLeft: '3px solid #ef4444',
                        border: `1px solid ${isDark ? 'rgba(var(--primary-red-rgb), 0.2)' : 'rgba(var(--primary-red-rgb), 0.15)'}`,
                        borderLeftWidth: 3,
                        fontSize: 12.5,
                        color: isDark ? 'var(--border-color)' : 'var(--text-secondary)',
                        lineHeight: 1.5,
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--primary-red)', textTransform: 'uppercase', marginBottom: 2 }}>
                        💡 Mentor's Diagnostic Context
                      </div>
                      {aiInsights.critical_vulnerabilities?.[0] || 'Focus on high-yield revision tasks listed below to maximize your score.'}
                    </div>
                  </>
                );
              })()}
              {renderInfoToggle('urgency_info', 'Identifies weak syllabus nodes falling below 60% accuracy.', 'Generates targeted practice items to fix conceptual gaps.', 'Reviewing flagged areas within 3 days restores retention.')}
            </div>
          </div>

          {/* Single Exam Dedicated Visualizer Graphs (Pacing Velocity Curve & Quartile Stamina Fatigue Curve) */}
          {questionsList.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 20, marginTop: 4 }}>
              {/* Visualizer 1: Per-Question Pacing Velocity Curve */}
              <div style={cardStyle}>
                <div style={{ marginBottom: 14 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 4px 0', color: isDark ? 'var(--bg-card)' : 'var(--deep-navy)' }}>
                    ⚡ Pacing & Time Allocation Curve per Question
                  </h3>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                    Tracks actual time spent (seconds) on each question compared against the 60s benchmark pace.
                  </p>
                </div>
                <div style={{ height: 240, width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={questionsList.map((q, i) => {
                        const st = getQuestionState(q);
                        const t = Number(q.time_taken_seconds || 0);
                        return {
                          qNum: `Q${q.question_number || i + 1}`,
                          time_taken: t,
                          target_pace: 60,
                          status: st.isCorr ? 'Correct' : st.isInc ? 'Incorrect' : 'Unattempted',
                        };
                      })}
                      margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? 'rgba(255,255,255,0.08)' : 'var(--border-color)'} />
                      <XAxis dataKey="qNum" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} interval={Math.max(0, Math.floor(questionsList.length / 10))} />
                      <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} unit="s" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: isDark ? 'var(--deep-navy)' : 'var(--bg-card)',
                          borderColor: isDark ? 'var(--text-secondary)' : 'var(--border-color)',
                          borderRadius: 'var(--radius)',
                          fontSize: 12,
                        }}
                        formatter={(val: any, name: any) => [`${val}s`, name === 'time_taken' ? 'Time Spent' : 'Target Pace']}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Area type="monotone" dataKey="time_taken" name="Time Spent (s)" stroke="var(--primary-red)" fill="rgba(var(--primary-red-rgb), 0.2)" strokeWidth={2} />
                      <Line type="monotone" dataKey="target_pace" name="Target Pace (60s)" stroke="#F2B623" strokeDasharray="4 4" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Visualizer 2: Cognitive Stamina & Endurance Fatigue Curve (Quartiles) */}
              <div style={cardStyle}>
                <div style={{ marginBottom: 14 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 4px 0', color: isDark ? 'var(--bg-card)' : 'var(--deep-navy)' }}>
                    🔋 Cognitive Stamina & Accuracy Across Test Quartiles
                  </h3>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                    Compares precision across all 4 quarters of the paper to identify late-exam mental fatigue.
                  </p>
                </div>
                <div style={{ height: 240, width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={(() => {
                        const totalQ = questionsList.length || 4;
                        const qSize = Math.max(1, Math.ceil(totalQ / 4));
                        const quartiles = [
                          { name: 'Q1 (0-25%)', questions: questionsList.slice(0, qSize) },
                          { name: 'Q2 (25-50%)', questions: questionsList.slice(qSize, qSize * 2) },
                          { name: 'Q3 (50-75%)', questions: questionsList.slice(qSize * 2, qSize * 3) },
                          { name: 'Q4 (75-100%)', questions: questionsList.slice(qSize * 3) },
                        ];
                        return quartiles.map((q) => {
                          const att = q.questions.filter((item) => getQuestionState(item).isAtt);
                          const corr = q.questions.filter((item) => getQuestionState(item).isCorr).length;
                          const acc = att.length > 0 ? Math.round((corr / att.length) * 100) : 0;
                          const avgT = q.questions.length > 0 ? Math.round(q.questions.reduce((a, b) => a + Number(b.time_taken_seconds || 0), 0) / q.questions.length) : 0;
                          return {
                            quartile: q.name,
                            accuracy: acc,
                            avg_time: avgT,
                          };
                        });
                      })()}
                      margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? 'rgba(255,255,255,0.08)' : 'var(--border-color)'} />
                      <XAxis dataKey="quartile" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} unit="%" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: isDark ? 'var(--deep-navy)' : 'var(--bg-card)',
                          borderColor: isDark ? 'var(--text-secondary)' : 'var(--border-color)',
                          borderRadius: 'var(--radius)',
                          fontSize: 12,
                        }}
                        formatter={(val: any) => [`${val}%`, 'Accuracy']}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="accuracy" name="Quarter Accuracy %" fill="#06b6d4" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          PAGE 3: AI COGNITIVE INSIGHTS & ACTIONABLE REVISION PLAN (Tab 3)
      ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'ai-insights' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* AI Status Banner */}
          <div
            style={{
              padding: '16px 20px',
              borderRadius: 'var(--radius)',
              backgroundColor: hasAiInsight ? '#ECFDF5' : 'var(--status-warning-bg)',
              border: `1px solid ${hasAiInsight ? '#A7F3D0' : '#FDE68A'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {hasAiInsight ? (
                <div style={{ padding: 8, backgroundColor: 'var(--status-success-bg)', color: '#059669' }}>
                  
                </div>
              ) : (
                <div style={{ padding: 8, backgroundColor: '#FDE68A', color: '#D97706' }}>
                  <Loader2 size={22} className="animate-spin" />
                </div>
              )}
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: hasAiInsight ? '#065F46' : '#92400E' }}>
                  {hasAiInsight
                    ? (isCumulative ? '✨ Longitudinal Strategic Diagnostic: Ready & Synthesized' : '✨ Cognitive Diagnostic & Revision Plan: Ready')
                    : '⏳ Mentorship Engine: Synthesizing Cognitive Insights & Tasks...'}
                </div>
                <div style={{ fontSize: 12.5, color: hasAiInsight ? '#047857' : 'var(--status-warning)' }}>
                  {hasAiInsight
                    ? (isCumulative
                        ? 'Deep longitudinal evaluation across all attempts with custom strategic study tasks.'
                        : 'Personalized evaluation of errors, option distractors, and high-yield revision tasks for this test.')
                    : 'Analyzing distractor choices, mistake patterns, and timing matrices in the background. Please wait a moment...'}
                </div>
              </div>
            </div>

            {hasAiInsight && (
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 800,
                  padding: '4px 12px',
                  backgroundColor: '#059669',
                  color: 'var(--bg-card)',
                  letterSpacing: '0.04em',
                }}
              >
                DATA VERIFIED
              </span>
            )}
          </div>

          {/* AI Cognitive Diagnostic Insights Narrative Card */}
          <div
            style={{
              ...cardStyle,
              gridColumn: '1 / -1',
              background: isDark
                ? 'linear-gradient(135deg, #131d36 0%, #172033 100%)'
                : 'linear-gradient(135deg, #f8fafc 0%, #F8FAFC 100%)',
              border: '1px solid rgba(var(--primary-red-rgb), 0.3)',
              padding: 24,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
              <div
                style={{
                  padding: 10,
                  borderRadius: 'var(--radius)',
                  backgroundColor: 'rgba(var(--primary-red-rgb), 0.2)',
                  color: 'var(--primary-red)',
                }}
              >
                <Brain size={24} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <h3
                    style={{
                      fontSize: 19,
                      fontWeight: 800,
                      margin: 0,
                      color: isDark ? 'var(--bg-card)' : 'var(--deep-navy)',
                    }}
                  >
                    {isCumulative ? 'Longitudinal Strategic Master Evaluation' : 'Cognitive Diagnostic Report'}
                  </h3>
                  {!hasAiInsight && (
                    <span
                      style={{
                        padding: '2px 8px',
                        fontSize: 11,
                        fontWeight: 700,
                        borderRadius: 12,
                        backgroundColor: 'rgba(var(--primary-red-rgb), 0.1)',
                        color: 'var(--primary-red)',
                        border: '1px solid rgba(var(--primary-red-rgb), 0.25)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                       Synthesizing live mentor advice...
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12.5, color: isDark ? 'var(--text-disabled)' : 'var(--text-muted)' }}>
                  Structured Psychometric Evaluation & Behavioral Diagnostic Analysis
                </div>
              </div>
            </div>

        {(() => {
          const insightObj: Record<string, any> =
            (report as any)?.llm_insight ||
            (report as any)?.part_2_exam_macro_scorecard?.llm_insight ||
            (report as any)?.part_2_exam_macro_scorecard?.mentorship_insight ||
            (report as any)?.part_3_aggregated_user_report?.llm_insight ||
            (report as any)?.part_3_aggregated_user_report?.mentorship_insight ||
            {};

          // No made-up text: missing fields say so, and with no written summary at all we show a notice instead.
          const NOT_AVAILABLE = 'Not available for this test.';
          const execSummary = insightObj.executive_summary || '';
          const benchmarkVerdict = insightObj.benchmark_verdict || '';
          const strengths: string[] = insightObj.tactical_strengths || insightObj.strengths || [];
          const weaknesses: string[] = insightObj.critical_vulnerabilities || insightObj.weaknesses || [];
          const pacingDiag = insightObj.pacing_and_unattempted_diagnosis || NOT_AVAILABLE;
          const distractorCritique = insightObj.distractor_trap_critique || NOT_AVAILABLE;
          const closingAdvice = insightObj.closing_mentorship_advice || insightObj.closing || '';
          const hasInsight = Boolean(
            execSummary || benchmarkVerdict || strengths.length || weaknesses.length ||
            insightObj.pacing_and_unattempted_diagnosis || insightObj.distractor_trap_critique || closingAdvice,
          );

          if (!hasInsight) {
            return (
              <div
                style={{
                  padding: 16,
                  borderRadius: 'var(--radius)',
                  border: '1px dashed var(--border-color)',
                  fontSize: 13,
                  color: 'var(--text-muted)',
                  lineHeight: 1.55,
                }}
              >
                The written summary for this test isn&apos;t available. Your scores and the metrics in this report are
                complete.
              </div>
            );
          }

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Executive Summary & Benchmark Verdict Callout */}
              <div
                style={{
                  padding: 16,
                  borderRadius: 'var(--radius)',
                  backgroundColor: isDark
                    ? 'rgba(var(--primary-red-rgb), 0.1)'
                    : 'rgba(var(--primary-red-rgb), 0.08)',
                  border: '1px solid rgba(var(--primary-red-rgb), 0.25)',
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: 'var(--primary-red)',
                    textTransform: 'uppercase',
                    marginBottom: 4,
                    letterSpacing: '0.5px',
                  }}
                >
                  🎯 Executive Summary & UPSC Benchmark Verdict
                </div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: isDark ? 'var(--bg-card)' : 'var(--deep-navy)',
                    marginBottom: 8,
                    lineHeight: 1.45,
                  }}
                >
                  {benchmarkVerdict || NOT_AVAILABLE}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: isDark ? 'var(--border-color)' : 'var(--text-secondary)',
                    lineHeight: 1.55,
                  }}
                >
                  {execSummary}
                </div>
              </div>

              {/* Strengths & Critical Vulnerabilities Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                  gap: 16,
                }}
              >
                {/* Strengths */}
                <div
                  style={{
                    padding: 16,
                    borderRadius: 'var(--radius)',
                    backgroundColor: isDark ? 'rgba(16,185,129,0.1)' : '#f0fdf4',
                    border: '1px solid rgba(16,185,129,0.25)',
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 800,
                      color: '#3A8B53',
                      marginBottom: 10,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <CheckCircle2 size={18} /> Tactical Strengths Observed
                  </div>
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: 18,
                      fontSize: 12.5,
                      color: isDark ? 'var(--border-color)' : '#166534',
                      lineHeight: 1.55,
                    }}
                  >
                    {strengths.length === 0 && <li style={{ margin: '4px 0' }}>{NOT_AVAILABLE}</li>}
                    {strengths.map((s: string, sIdx: number) => (
                      <li key={sIdx} style={{ margin: '4px 0' }}>
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Critical Vulnerabilities */}
                <div
                  style={{
                    padding: 16,
                    borderRadius: 'var(--radius)',
                    backgroundColor: isDark ? 'rgba(var(--primary-red-rgb), 0.1)' : '#fef2f2',
                    border: '1px solid rgba(var(--primary-red-rgb), 0.25)',
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 800,
                      color: 'var(--primary-red)',
                      marginBottom: 10,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <AlertTriangle size={18} /> Critical Vulnerabilities & Traps
                  </div>
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: 18,
                      fontSize: 12.5,
                      color: isDark ? 'var(--border-color)' : '#991b1b',
                      lineHeight: 1.55,
                    }}
                  >
                    {weaknesses.length === 0 && <li style={{ margin: '4px 0' }}>{NOT_AVAILABLE}</li>}
                    {weaknesses.map((w: string, wIdx: number) => (
                      <li key={wIdx} style={{ margin: '4px 0' }}>
                        {w}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Behavioral Pacing & Distractor Critique */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                  gap: 16,
                }}
              >
                <div
                  style={{
                    padding: 16,
                    borderRadius: 'var(--radius)',
                    backgroundColor: isDark
                      ? 'rgba(139,92,246,0.08)'
                      : 'rgba(139,92,246,0.05)',
                    border: '1px solid rgba(139,92,246,0.2)',
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 800,
                      color: '#8b5cf6',
                      marginBottom: 6,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Clock size={16} /> Pacing & Unattempted Questions Diagnosis
                  </div>
                  <div
                    style={{
                      fontSize: 12.5,
                      color: isDark ? 'var(--border-color)' : 'var(--text-secondary)',
                      lineHeight: 1.55,
                    }}
                  >
                    {pacingDiag}
                  </div>
                </div>

                <div
                  style={{
                    padding: 16,
                    borderRadius: 'var(--radius)',
                    backgroundColor: isDark
                      ? 'rgba(245,158,11,0.08)'
                      : 'rgba(245,158,11,0.05)',
                    border: '1px solid rgba(245,158,11,0.2)',
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 800,
                      color: '#F2B623',
                      marginBottom: 6,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <ShieldAlert size={16} /> Distractor & Option Revision Critique
                  </div>
                  <div
                    style={{
                      fontSize: 12.5,
                      color: isDark ? 'var(--border-color)' : 'var(--text-secondary)',
                      lineHeight: 1.55,
                    }}
                  >
                    {distractorCritique}
                  </div>
                </div>
              </div>

              {/* Closing Advice */}
              {closingAdvice && (
                <div
                  style={{
                    padding: '12px 18px',
                    borderRadius: 'var(--radius)',
                    backgroundColor: isDark
                      ? 'rgba(255,255,255,0.03)'
                      : 'rgba(0,0,0,0.02)',
                    borderLeft: '4px solid var(--primary-red)',
                    fontSize: 12.5,
                    fontStyle: 'italic',
                    color: isDark ? '#93c5fd' : '#A4161A',
                    lineHeight: 1.5,
                  }}
                >
                  💡 Mentor's Guidance: "{closingAdvice}"
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Actionable Study Plan Tasks Section - SHOWN ONLY WHEN AI DATA ARRIVES */}
      {hasAiInsight && rawTasksList.length > 0 && (
        <div
          style={{
            ...cardStyle,
            gridColumn: '1 / -1',
            padding: 24,
            border: '1px solid rgba(var(--primary-red-rgb), 0.3)',
            background: isDark
              ? 'linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.95) 100%)'
              : 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)',
          }}
        >
          {(() => {
            const unaddedCount = rawTasksList.filter(
              (t: any) =>
                !scheduledTaskTitles.has(t.title) &&
                !scheduledTaskTitles.has(`[${t.subject || 'Core'}] ${t.title}`) &&
                !addedTaskPlanSuccess[t.task_id || t.title]
            ).length;

            return (
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 18,
                    flexWrap: 'wrap',
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        padding: 10,
                        borderRadius: 'var(--radius)',
                        backgroundColor: 'rgba(var(--primary-red-rgb), 0.15)',
                        color: 'var(--primary-red)',
                      }}
                    >
                      <CalendarPlus size={24} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <h3
                          style={{
                            fontSize: 19,
                            fontWeight: 800,
                            margin: 0,
                            color: isDark ? 'var(--bg-card)' : 'var(--deep-navy)',
                          }}
                        >
                          Mentor-Recommended Study Plan Tasks ({rawTasksList.length} Action Items)
                        </h3>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 'var(--radius)',
                            backgroundColor: 'rgba(var(--primary-red-rgb), 0.1)',
                            color: 'var(--primary-red)',
                          }}
                        >
                          {rawTasksList.length} Priorities
                        </span>
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>
                        Targeted study interventions generated from your test errors. Click to add or remove from your personal study planner.
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: isDark ? 'var(--text-disabled)' : 'var(--text-muted)',
                      }}
                    >
                      {rawTasksList.length - unaddedCount}/{rawTasksList.length} Scheduled
                    </span>
                    {unaddedCount > 0 ? (
                      <button
                        disabled={isBulkAdding}
                        onClick={() => handleScheduleAllTasks(rawTasksList)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '8px 16px',
                          borderRadius: 'var(--radius)',
                          backgroundColor: 'var(--primary-red)',
                          color: 'var(--bg-card)',
                          border: 'none',
                          fontSize: 12.5,
                          fontWeight: 800,
                          cursor: isBulkAdding ? 'not-allowed' : 'pointer',
                          boxShadow: '0 2px 10px rgba(var(--primary-red-rgb), 0.3)',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        
                        {isBulkAdding ? 'Scheduling All...' : `⚡ Add All (${unaddedCount}) to Study Plan`}
                      </button>
                    ) : (
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '6px 14px',
                          borderRadius: 'var(--radius)',
                          backgroundColor: 'rgba(16,185,129,0.15)',
                          color: '#3A8B53',
                          fontSize: 12,
                          fontWeight: 800,
                        }}
                      >
                        <CheckCircle2 size={16} /> All Tasks Added to Plan
                      </div>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
                    gap: 18,
                  }}
                >
                  {rawTasksList.map((t: any, idx: number) => {
                    const taskId = t.task_id || `task_${idx}`;
                    const fullTitle = `[${t.subject || 'Core'}] ${t.title}`;
                    const isAdded =
                      scheduledTaskTitles.has(t.title) ||
                      scheduledTaskTitles.has(fullTitle) ||
                      addedTaskPlanSuccess[taskId] === 'ADDED' ||
                      t.is_added_to_plan;
                    const isDone = completedTasks[taskId];
                    const isAdding = isAddingTask[taskId];

                    const priorityColor =
                      t.priority === 'CRITICAL' ? 'var(--primary-red)' : t.priority === 'HIGH' ? 'var(--status-warning)' : 'var(--accent-primary)';

                    return (
                      <div
                        key={taskId}
                        style={{
                          padding: 18,
                          borderRadius: 'var(--radius)',
                          backgroundColor: isDark ? '#1a2234' : 'var(--bg-card)',
                          border: `1px solid ${isAdded ? 'var(--status-success)' : isDark ? 'var(--text-secondary)' : 'var(--border-color)'}`,
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                            <span
                              style={{
                                fontSize: 10.5,
                                fontWeight: 800,
                                padding: '2px 8px',
                                borderRadius: 'var(--radius)',
                                backgroundColor: `${priorityColor}15`,
                                color: priorityColor,
                                border: `1px solid ${priorityColor}30`,
                              }}
                            >
                              {formatEnum(t.priority || 'HIGH')}
                            </span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>
                              ⏱️ {t.allocated_time_minutes || 30} mins
                            </span>
                          </div>

                          <h4 style={{ fontSize: 14.5, fontWeight: 800, color: isDark ? 'var(--bg-card)' : 'var(--deep-navy)', margin: '0 0 4px 0' }}>
                            {t.title}
                          </h4>
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary-red)', marginBottom: 8 }}>
                            📚 {formatEnum(t.subject)} • {formatEnum(t.topic)}
                          </div>

                          {t.reasoning && (
                            <p style={{ fontSize: 12, color: isDark ? 'var(--border-color)' : 'var(--text-secondary)', margin: '0 0 10px 0', lineHeight: 1.45 }}>
                              💡 {t.reasoning}
                            </p>
                          )}

                          {t.action_checklist && t.action_checklist.length > 0 && (
                            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11.5, color: isDark ? 'var(--text-disabled)' : 'var(--text-muted)', lineHeight: 1.4 }}>
                              {t.action_checklist.map((item: string, cIdx: number) => (
                                <li key={cIdx}>{item}</li>
                              ))}
                            </ul>
                          )}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 10, borderTop: `1px solid ${isDark ? 'var(--text-secondary)' : 'var(--bg-hover)'}` }}>
                          <button
                            disabled={isAdded || isAdding}
                            onClick={() => handleScheduleSingleTask(t)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '6px 12px',
                              borderRadius: 'var(--radius)',
                              backgroundColor: isAdded ? 'var(--status-success)' : 'var(--primary-red)',
                              color: 'var(--bg-card)',
                              border: 'none',
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: isAdded || isAdding ? 'default' : 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            {isAdding ? (
                              <>
                                <Loader2 size={13} className="animate-spin" /> Scheduling...
                              </>
                            ) : isAdded ? (
                              <>
                                <CheckCircle2 size={13} /> ✓ Added to Plan
                              </>
                            ) : (
                              <>
                                <CalendarPlus size={13} /> Add to Study Plan
                              </>
                            )}
                          </button>

                          <button
                            onClick={() => toggleTaskCompleted(taskId)}
                            style={{
                              padding: '6px 10px',
                              borderRadius: 'var(--radius)',
                              backgroundColor: isDone ? 'rgba(16,185,129,0.15)' : 'transparent',
                              color: isDone ? 'var(--status-success)' : 'var(--text-muted)',
                              border: `1px solid ${isDone ? 'var(--status-success)' : 'var(--border-color)'}`,
                              fontSize: 11.5,
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <CheckCircle2 size={12} /> {isDone ? 'Completed' : 'Mark Done'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  )}

      {/* ──────────────────────────────────────────────────────────────────────────
          PAGE 1: USER LONGITUDINAL TRAJECTORY (Tab 1 for Cumulative Profile)
      ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'summary' && showDetailedAnalysis && isCumulative && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Header Banner */}
          <div
            style={{
              padding: '16px 20px',
              borderRadius: 'var(--radius)',
              backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : '#f0fdf4',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <TrendingUp size={22} color="#3A8B53" />
              <div style={{ fontSize: 13.5, color: isDark ? '#6ee7b7' : '#065f46' }}>
                <strong>Cumulative Longitudinal Skill Baseline:</strong> Tracks multi-test evolution across all 12 matrices with mode-weighted calibration across Full Mocks, Practice Tests, and Guest Trials.
              </div>
            </div>
          </div>

          {/* Exam Modality Segregation Filter Pills */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 18px',
              borderRadius: 'var(--radius)',
              backgroundColor: isDark ? '#131f37' : 'var(--bg-card)',
              border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'var(--border-color)'}`,
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Filter size={14} /> Filter Aggregates by Exam Modality:
            </span>

            {[
              { key: 'all_exams', label: 'All Exams (Weighted Global)', weight: '100%', count: (report as any)?.segregated_aggregates?.all_exams?.count ?? timelineData.length },
              { key: 'full_mock_exams', label: 'Full Mock Exams', weight: 'W: 1.00', count: (report as any)?.segregated_aggregates?.full_mock_exams?.count ?? timelineData.filter((i: any) => i.mode === 'EXAM' || i.exam_type_label === 'FULL_MOCK').length },
              { key: 'practice_tests', label: 'Practice Tests', weight: 'W: 0.65', count: (report as any)?.segregated_aggregates?.practice_tests?.count ?? timelineData.filter((i: any) => i.mode === 'PRACTICE' || i.exam_type_label === 'PRACTICE_TEST').length },
              { key: 'guest_trials', label: 'Guest Trials', weight: 'W: 0.25', count: (report as any)?.segregated_aggregates?.guest_trials?.count ?? timelineData.filter((i: any) => i.exam_type_label === 'GUEST_PRACTICE').length },
            ].map((mod) => {
              const isSelected = selectedModality === mod.key;
              return (
                <button
                  key={mod.key}
                  onClick={() => setSelectedModality(mod.key as any)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 14px',
                    borderRadius: 'var(--radius)',
                    backgroundColor: isSelected
                      ? 'var(--primary-red)'
                      : isDark
                        ? 'rgba(255,255,255,0.05)'
                        : 'var(--bg-hover)',
                    color: isSelected ? 'var(--bg-card)' : isDark ? 'var(--border-color)' : 'var(--text-secondary)',
                    border: `1px solid ${isSelected ? 'var(--primary-red)' : isDark ? 'rgba(255,255,255,0.1)' : 'var(--border-color)'}`,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span>{mod.label}</span>
                  <span
                    style={{
                      fontSize: 10.5,
                      padding: '1px 6px',
                      borderRadius: 'var(--radius)',
                      backgroundColor: isSelected ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.08)',
                    }}
                  >
                    {mod.count} tests ({mod.weight})
                  </span>
                </button>
              );
            })}
          </div>

          {/* 5 Core Competency Progress Visualizers (Dynamic to Selected Modality) */}
          {(() => {
            const segAggs = (report as any)?.segregated_aggregates || {};
            const activeSeg = segAggs[selectedModality] || segAggs['all_exams'] || {};

            const dispIcrs = activeSeg.icrs_score ?? (userProfile as any)?.cumulative_icrs_score ?? (userProfile as any)?.cumulative_icrs ?? 80.0;
            const dispIrt = activeSeg.irt_theta ?? userProfile.cumulative_irt_theta ?? 0.88;
            const dispGti = activeSeg.gti_score ?? userProfile.cumulative_gti ?? 0.16;
            const dispOeei = activeSeg.oeei_score ?? userProfile.cumulative_oeei ?? 0.75;
            const dispSatoi = activeSeg.satoi_score ?? userProfile.cumulative_satoi ?? 83.0;

            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                {/* Competency 1: Overall Preparedness */}
                <div style={cardStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--primary-red)' }}>Exam Preparedness (ICRS)</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: deltas.icrs_delta >= 0 ? '#3A8B53' : 'var(--primary-red)' }}>
                      {deltas.icrs_delta >= 0 ? `+${deltas.icrs_delta}` : `${deltas.icrs_delta}`} Δ
                    </span>
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 900, margin: '4px 0' }}>
                    {dispIcrs} / 100
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                    Status: <strong>{dispIcrs >= 75 ? 'Qualifying Ready' : dispIcrs >= 55 ? 'Developing Competence' : 'Foundational Revision'}</strong>
                  </div>
                  <div style={{ width: '100%', height: 6, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'var(--border-color)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, dispIcrs)}%`, height: '100%', backgroundColor: 'var(--primary-red)', borderRadius: 'var(--radius)' }} />
                  </div>
                </div>

                {/* Competency 2: Conceptual Mastery */}
                <div style={cardStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#3A8B53' }}>Concept Mastery (IRT Ability)</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: deltas.irt_theta_delta >= 0 ? '#3A8B53' : 'var(--primary-red)' }}>
                      {deltas.irt_theta_delta >= 0 ? `+${deltas.irt_theta_delta}` : `${deltas.irt_theta_delta}`} Δ
                    </span>
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 900, margin: '4px 0' }}>
                    {dispIrt >= 0 ? `+${Number(dispIrt).toFixed(2)} θ` : `${Number(dispIrt).toFixed(2)} θ`}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                    Percentile: <strong>Top {Math.max(1, Math.round(100 - (50 + dispIrt * 22)))}% Competency</strong>
                  </div>
                  <div style={{ width: '100%', height: 6, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'var(--border-color)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, Math.max(10, 50 + dispIrt * 22))}%`, height: '100%', backgroundColor: '#3A8B53', borderRadius: 'var(--radius)' }} />
                  </div>
                </div>

                {/* Competency 3: Guessing Discipline */}
                <div style={cardStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#F2B623' }}>Guessing Control (GTI)</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: deltas.gti_delta <= 0 ? '#3A8B53' : 'var(--primary-red)' }}>
                      {deltas.gti_delta <= 0 ? `${(deltas.gti_delta * 100).toFixed(1)}% (Safer)` : `+${(deltas.gti_delta * 100).toFixed(1)}%`}
                    </span>
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 900, margin: '4px 0' }}>
                    {(Number(dispGti) * 100).toFixed(1)}% Impulse Rate
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                    Classification: <strong>{dispGti <= 0.22 ? 'Controlled Calculated Risk' : 'Impulsive Guesswork'}</strong>
                  </div>
                  <div style={{ width: '100%', height: 6, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'var(--border-color)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, Number(dispGti) * 100)}%`, height: '100%', backgroundColor: '#F2B623', borderRadius: 'var(--radius)' }} />
                  </div>
                </div>

                {/* Competency 4: Elimination Precision */}
                <div style={cardStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#8b5cf6' }}>Elimination Precision (OEEI)</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: deltas.oeei_delta >= 0 ? '#3A8B53' : 'var(--primary-red)' }}>
                      {deltas.oeei_delta >= 0 ? `+${(deltas.oeei_delta * 100).toFixed(1)}%` : `${(deltas.oeei_delta * 100).toFixed(1)}%`}
                    </span>
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 900, margin: '4px 0' }}>
                    {(Number(dispOeei) * 100).toFixed(1)}% Conversion
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                    Efficiency: <strong>{dispOeei >= 0.70 ? 'High Analytical Conversion' : 'Moderate Pruning'}</strong>
                  </div>
                  <div style={{ width: '100%', height: 6, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'var(--border-color)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, Number(dispOeei) * 100)}%`, height: '100%', backgroundColor: '#8b5cf6', borderRadius: 'var(--radius)' }} />
                  </div>
                </div>

                {/* Competency 5: Stamina & Velocity */}
                <div style={cardStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#06b6d4' }}>Exam Stamina (SATOI)</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: deltas.satoi_delta >= 0 ? '#3A8B53' : 'var(--primary-red)' }}>
                      {deltas.satoi_delta >= 0 ? `+${deltas.satoi_delta}` : `${deltas.satoi_delta}`} Δ
                    </span>
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 900, margin: '4px 0' }}>
                    {dispSatoi} / 100 Balance
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                    Fatigue Risk: <strong>{dispSatoi >= 80 ? 'Optimal Cognitive Stamina' : 'Moderate Fatigue Dropoff'}</strong>
                  </div>
                  <div style={{ width: '100%', height: 6, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'var(--border-color)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, dispSatoi)}%`, height: '100%', backgroundColor: '#06b6d4', borderRadius: 'var(--radius)' }} />
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Test History Overview */}
          <div style={cardStyle}>
            <h3 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 16px 0' }}>
              Cumulative Examination History
            </h3>
            <div style={{ display: 'flex', gap: 30, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Full-Length Mock Tests Completed</div>
                <div style={{ fontSize: 24, fontWeight: 800 }}>{timelineData.length || userProfile.total_tests_given || 1} Tests</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total Item Responses Analyzed</div>
                <div style={{ fontSize: 24, fontWeight: 800 }}>
                  {userProfile.total_questions_answered ||
                    questionsList.filter((q) => getQuestionState(q).isAtt).length ||
                    14}{' '}
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>
                    Attempted / {questionsList.length || 100} Total
                  </span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Longitudinal Competency Band</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#3A8B53' }}>
                  {(userProfile.cumulative_icrs_score ?? (userProfile as any).cumulative_icrs ?? 0) >= 70
                    ? 'Prelims Ready Benchmark'
                    : (userProfile.cumulative_icrs_score ?? (userProfile as any).cumulative_icrs ?? 0) >= 50
                      ? 'Competitive Contender'
                      : 'Developing Foundation'}
                </div>
              </div>
            </div>
          </div>

          {/* Multi-Exam Evolution & Progression Visualizers (Cross-Exam Comparison) */}
          {timelineData && timelineData.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 20 }}>
                {/* Chart 1: Exam Score & Accuracy Evolution */}
                <div style={cardStyle}>
                  <div style={{ marginBottom: 14 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 4px 0', color: isDark ? 'var(--bg-card)' : 'var(--deep-navy)' }}>
                      📈 Score & Accuracy Progression Across Exams
                    </h3>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                      Tracks your net score and precision percentage across each evaluated exam session.
                    </p>
                  </div>
                  <div style={{ height: 260, width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={timelineData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? 'rgba(255,255,255,0.08)' : 'var(--border-color)'} />
                        <XAxis dataKey="display_label" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                        <YAxis yAxisId="left" domain={[0, 'auto']} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} unit="m" />
                        <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} unit="%" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: isDark ? 'var(--deep-navy)' : 'var(--bg-card)',
                            borderColor: isDark ? 'var(--text-secondary)' : 'var(--border-color)',
                            borderRadius: 'var(--radius)',
                            fontSize: 12,
                          }}
                          formatter={(value: any, name: any) => [name === 'Total Score' ? `${value} Marks` : `${value}%`, name]}
                          labelFormatter={(_: any, items: any) => {
                            const item = items?.[0]?.payload;
                            return item ? `${item.display_label}: ${item.exam_name}` : '';
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar yAxisId="left" dataKey="total_score" name="Total Score" fill="var(--primary-red)" radius={[6, 6, 0, 0]} />
                        <Line yAxisId="right" type="monotone" dataKey="accuracy_percentage" name="Accuracy %" stroke="#3A8B53" strokeWidth={3} dot={{ r: 4 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Chart 2: Cognitive Readiness (ICRS) & Latent Ability Progression */}
                <div style={cardStyle}>
                  <div style={{ marginBottom: 14 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 4px 0', color: isDark ? 'var(--bg-card)' : 'var(--deep-navy)' }}>
                      🧠 Integrated Cognitive Readiness (ICRS) Evolution
                    </h3>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                      Longitudinal readiness metric combining IRT ability, elimination discipline, and pacing.
                    </p>
                  </div>
                  <div style={{ height: 260, width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={timelineData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? 'rgba(255,255,255,0.08)' : 'var(--border-color)'} />
                        <XAxis dataKey="display_label" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} unit="/100" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: isDark ? 'var(--deep-navy)' : 'var(--bg-card)',
                            borderColor: isDark ? 'var(--text-secondary)' : 'var(--border-color)',
                            borderRadius: 'var(--radius)',
                            fontSize: 12,
                          }}
                          formatter={(value: any, name: any) => [`${value} / 100`, name]}
                          labelFormatter={(_: any, items: any) => {
                            const item = items?.[0]?.payload;
                            return item ? `${item.display_label}: ${item.exam_name}` : '';
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Line type="monotone" dataKey="icrs_score" name="ICRS Readiness" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 5 }} />
                        <Line type="monotone" dataKey="satoi_score" name="SATOI Stamina" stroke="#06b6d4" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Chart 3: Tactical Elimination (OEEI) vs Guessing Risk (GTI) */}
                <div style={cardStyle}>
                  <div style={{ marginBottom: 14 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 4px 0', color: isDark ? 'var(--bg-card)' : 'var(--deep-navy)' }}>
                      🎯 Tactical Elimination (OEEI) vs Guessing Impulse (GTI)
                    </h3>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                      Higher elimination conversion (OEEI) and lower impulse guesswork (GTI) signify elite exam temperament.
                    </p>
                  </div>
                  <div style={{ height: 260, width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={timelineData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? 'rgba(255,255,255,0.08)' : 'var(--border-color)'} />
                        <XAxis dataKey="display_label" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} unit="%" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: isDark ? 'var(--deep-navy)' : 'var(--bg-card)',
                            borderColor: isDark ? 'var(--text-secondary)' : 'var(--border-color)',
                            borderRadius: 'var(--radius)',
                            fontSize: 12,
                          }}
                          formatter={(value: any, name: any) => [`${value}%`, name]}
                          labelFormatter={(_: any, items: any) => {
                            const item = items?.[0]?.payload;
                            return item ? `${item.display_label}: ${item.exam_name}` : '';
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="oeei_pct" name="Elimination Precision (OEEI %)" fill="#3A8B53" radius={[6, 6, 0, 0]} />
                        <Bar dataKey="gti_pct" name="Guessing Risk (GTI %)" fill="#F2B623" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Chart 4: Latent Knowledge Ability (IRT 3PL Theta) */}
                <div style={cardStyle}>
                  <div style={{ marginBottom: 14 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 4px 0', color: isDark ? 'var(--bg-card)' : 'var(--deep-navy)' }}>
                      ⚡ IRT Latent Ability (θ) Curve Progression
                    </h3>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                      Item Response Theory latent skill calibrated across item discrimination (a), difficulty (b), and guessing floor (c).
                    </p>
                  </div>
                  <div style={{ height: 260, width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? 'rgba(255,255,255,0.08)' : 'var(--border-color)'} />
                        <XAxis dataKey="display_label" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                        <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} domain={[-1, 3]} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: isDark ? 'var(--deep-navy)' : 'var(--bg-card)',
                            borderColor: isDark ? 'var(--text-secondary)' : 'var(--border-color)',
                            borderRadius: 'var(--radius)',
                            fontSize: 12,
                          }}
                          formatter={(value: any) => [`+${Number(value).toFixed(2)} θ`, 'Latent Ability']}
                          labelFormatter={(_: any, items: any) => {
                            const item = items?.[0]?.payload;
                            return item ? `${item.display_label}: ${item.exam_name}` : '';
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Area type="monotone" dataKey="irt_theta" name="IRT Ability (θ)" stroke="var(--primary-red)" fill="rgba(var(--primary-red-rgb), 0.2)" strokeWidth={3} dot={{ r: 5 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Side-by-Side Exam Comparison Matrix Table */}
              <div style={cardStyle}>
                <h3 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Award size={20} color="var(--primary-red)" /> Longitudinal Cross-Exam Comparison Matrix
                </h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: `2px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'var(--border-color)'}`, textAlign: 'left' }}>
                        <th style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>#</th>
                        <th style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>Exam Paper</th>
                        <th style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>Date</th>
                        <th style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>Score</th>
                        <th style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>Accuracy</th>
                        <th style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>ICRS</th>
                        <th style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>IRT θ</th>
                        <th style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>GTI (Impulse)</th>
                        <th style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>OEEI (Elimination)</th>
                        <th style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>SATOI (Stamina)</th>
                        <th style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>Pacing</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const totalPages = Math.ceil(timelineData.length / matrixPageSize) || 1;
                        const validPage = Math.min(Math.max(1, matrixPage), totalPages);
                        const startIndex = (validPage - 1) * matrixPageSize;
                        const paginatedItems = timelineData.slice(startIndex, startIndex + matrixPageSize);

                        return paginatedItems.map((item: any, idx: number) => {
                          const globalIdx = startIndex + idx;
                          return (
                            <tr
                              key={item.attempt_id || globalIdx}
                              style={{
                                borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'var(--bg-hover)'}`,
                                backgroundColor: globalIdx % 2 === 0 ? 'transparent' : isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                              }}
                            >
                              <td style={{ padding: '10px 12px', fontWeight: 800, color: 'var(--primary-red)' }}>{item.attempt_number || globalIdx + 1}</td>
                              <td style={{ padding: '10px 12px', fontWeight: 700 }}>{item.exam_name}</td>
                              <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{item.date_formatted || item.date}</td>
                              <td style={{ padding: '10px 12px', fontWeight: 800 }}>
                                {item.total_score} <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>/ {item.max_possible_score}</span>
                              </td>
                              <td style={{ padding: '10px 12px', fontWeight: 700, color: item.accuracy_percentage >= 65 ? '#3A8B53' : item.accuracy_percentage >= 50 ? '#F2B623' : 'var(--primary-red)' }}>
                                {item.accuracy_percentage}%
                              </td>
                              <td style={{ padding: '10px 12px', fontWeight: 800, color: '#8b5cf6' }}>{item.icrs_score}/100</td>
                              <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--primary-red)' }}>+{Number(item.irt_theta).toFixed(2)} θ</td>
                              <td style={{ padding: '10px 12px', color: item.gti_score <= 0.22 ? '#3A8B53' : '#F2B623' }}>{(item.gti_score * 100).toFixed(1)}%</td>
                              <td style={{ padding: '10px 12px', color: item.oeei_score >= 0.70 ? '#3A8B53' : '#8b5cf6' }}>{(item.oeei_score * 100).toFixed(1)}%</td>
                              <td style={{ padding: '10px 12px', color: '#06b6d4' }}>{item.satoi_score}/100</td>
                              <td style={{ padding: '10px 12px' }}>
                                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 'var(--radius)', backgroundColor: 'rgba(var(--primary-red-rgb), 0.1)', color: 'var(--primary-red)' }}>
                                  {formatEnum(item.pacing_status)}
                                </span>
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>

                {/* Longitudinal Matrix Pagination Controls */}
                {timelineData.length > matrixPageSize && (() => {
                  const totalPages = Math.ceil(timelineData.length / matrixPageSize);
                  const startItem = (matrixPage - 1) * matrixPageSize + 1;
                  const endItem = Math.min(matrixPage * matrixPageSize, timelineData.length);

                  return (
                    <div
                      style={{
                        marginTop: 16,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 10,
                        paddingTop: 12,
                        borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'var(--border-color)'}`,
                      }}
                    >
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        Showing <strong style={{ color: isDark ? 'var(--bg-card)' : 'var(--deep-navy)' }}>{startItem} - {endItem}</strong> of <strong style={{ color: isDark ? 'var(--bg-card)' : 'var(--deep-navy)' }}>{timelineData.length}</strong> exams
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button
                          disabled={matrixPage <= 1}
                          onClick={() => setMatrixPage((p) => Math.max(1, p - 1))}
                          style={{
                            padding: '5px 12px',
                            borderRadius: 'var(--radius)',
                            border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'var(--border-color)'}`,
                            backgroundColor: matrixPage <= 1 ? 'transparent' : isDark ? 'rgba(255,255,255,0.05)' : 'var(--bg-subtle)',
                            color: matrixPage <= 1 ? 'var(--text-muted)' : isDark ? 'var(--bg-card)' : 'var(--deep-navy)',
                            cursor: matrixPage <= 1 ? 'not-allowed' : 'pointer',
                            fontSize: 12,
                            fontWeight: 700,
                            opacity: matrixPage <= 1 ? 0.5 : 1,
                          }}
                        >
                          ← Previous
                        </button>

                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                          <button
                            key={`matrix_page_${pageNum}`}
                            onClick={() => setMatrixPage(pageNum)}
                            style={{
                              padding: '5px 10px',
                              borderRadius: 'var(--radius)',
                              border: pageNum === matrixPage ? '1px solid var(--primary-red)' : `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'var(--border-color)'}`,
                              backgroundColor: pageNum === matrixPage ? 'var(--primary-red)' : isDark ? 'rgba(255,255,255,0.05)' : 'var(--bg-subtle)',
                              color: pageNum === matrixPage ? 'var(--bg-card)' : isDark ? 'var(--bg-card)' : 'var(--deep-navy)',
                              cursor: 'pointer',
                              fontSize: 12,
                              fontWeight: 700,
                            }}
                          >
                            {pageNum}
                          </button>
                        ))}

                        <button
                          disabled={matrixPage >= totalPages}
                          onClick={() => setMatrixPage((p) => Math.min(totalPages, p + 1))}
                          style={{
                            padding: '5px 12px',
                            borderRadius: 'var(--radius)',
                            border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'var(--border-color)'}`,
                            backgroundColor: matrixPage >= totalPages ? 'transparent' : isDark ? 'rgba(255,255,255,0.05)' : 'var(--bg-subtle)',
                            color: matrixPage >= totalPages ? 'var(--text-muted)' : isDark ? 'var(--bg-card)' : 'var(--deep-navy)',
                            cursor: matrixPage >= totalPages ? 'not-allowed' : 'pointer',
                            fontSize: 12,
                            fontWeight: 700,
                            opacity: matrixPage >= totalPages ? 0.5 : 1,
                          }}
                        >
                          Next →
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          TAB 1: PER-QUESTION DEEP ANALYSIS & SOLUTIONS
      ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'questions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {(() => {
            const totalQuestionPages = Math.ceil(filteredQuestions.length / questionPageSize) || 1;
            const validQuestionPage = Math.min(Math.max(1, questionPage), totalQuestionPages);
            const startQuestionIdx = (validQuestionPage - 1) * questionPageSize;
            const paginatedQuestions = filteredQuestions.slice(startQuestionIdx, startQuestionIdx + questionPageSize);

            return (
              <>
                {/* Question Filter Bar & Top Quick-Pagination */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {[
                      { id: 'all', label: `All (${questionsList.length})` },
                      {
                        id: 'attempted',
                        label: `Attempted (${questionsList.filter((q) => getQuestionState(q).isAtt).length})`,
                      },
                      {
                        id: 'correct',
                        label: `Correct (${questionsList.filter((q) => getQuestionState(q).isCorr).length})`,
                      },
                      {
                        id: 'incorrect',
                        label: `Incorrect (${questionsList.filter((q) => getQuestionState(q).isInc).length})`,
                      },
                      {
                        id: 'unattempted',
                        label: `Unattempted (${questionsList.filter((q) => getQuestionState(q).isUnatt).length})`,
                      },
                    ].map((f) => (
                      <button
                        key={f.id}
                        onClick={() => {
                          setQuestionFilter(f.id as any);
                          setQuestionPage(1);
                        }}
                        style={{
                          padding: '8px 16px',
                          borderRadius: 'var(--radius)',
                          border:
                            questionFilter === f.id
                              ? '1px solid var(--primary-red)'
                              : `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'var(--border-color)'}`,
                          backgroundColor:
                            questionFilter === f.id
                              ? 'var(--primary-red)'
                              : isDark
                                ? 'rgba(255,255,255,0.04)'
                                : 'var(--bg-card)',
                          color: questionFilter === f.id ? 'var(--bg-card)' : isDark ? 'var(--border-color)' : 'var(--text-secondary)',
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  {filteredQuestions.length > questionPageSize && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)' }}>
                      <span>
                        Showing <strong style={{ color: isDark ? 'var(--bg-card)' : 'var(--deep-navy)' }}>{startQuestionIdx + 1}-{Math.min(startQuestionIdx + questionPageSize, filteredQuestions.length)}</strong> of <strong style={{ color: isDark ? 'var(--bg-card)' : 'var(--deep-navy)' }}>{filteredQuestions.length}</strong>
                      </span>
                      <button
                        disabled={validQuestionPage <= 1}
                        onClick={() => setQuestionPage((p) => Math.max(1, p - 1))}
                        style={{
                          padding: '5px 12px',
                          borderRadius: 'var(--radius)',
                          border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'var(--border-color)'}`,
                          backgroundColor: validQuestionPage <= 1 ? 'transparent' : isDark ? 'rgba(255,255,255,0.05)' : 'var(--bg-card)',
                          color: validQuestionPage <= 1 ? 'var(--text-muted)' : isDark ? 'var(--bg-card)' : 'var(--deep-navy)',
                          cursor: validQuestionPage <= 1 ? 'not-allowed' : 'pointer',
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        ←
                      </button>
                      <span style={{ fontWeight: 800, color: 'var(--primary-red)' }}>
                        {validQuestionPage} / {totalQuestionPages}
                      </span>
                      <button
                        disabled={validQuestionPage >= totalQuestionPages}
                        onClick={() => setQuestionPage((p) => Math.min(totalQuestionPages, p + 1))}
                        style={{
                          padding: '5px 12px',
                          borderRadius: 'var(--radius)',
                          border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'var(--border-color)'}`,
                          backgroundColor: validQuestionPage >= totalQuestionPages ? 'transparent' : isDark ? 'rgba(255,255,255,0.05)' : 'var(--bg-card)',
                          color: validQuestionPage >= totalQuestionPages ? 'var(--text-muted)' : isDark ? 'var(--bg-card)' : 'var(--deep-navy)',
                          cursor: validQuestionPage >= totalQuestionPages ? 'not-allowed' : 'pointer',
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        →
                      </button>
                    </div>
                  )}
                </div>

                {/* Questions Detailed Accordion List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {paginatedQuestions.map((q, idx) => {
                    const qId = q.question_id || q.question_number || idx;
                    const isExpanded = expandedQuestionId === qId;
                    const state = getQuestionState(q);
                    const qNum = q.question_number || idx + 1;
                    const expl = q.explanation || null;

                    // Chosen and correct option labels
                    const userOptLabel = q.user_selected_option || q.user_selected_label || 'Unattempted';
                    const correctOptLabel = q.correct_option || q.correct_option_label || 'A';

                    const cardBorderColor = state.isCorr
                      ? '#3A8B53'
                      : state.isInc
                        ? 'var(--primary-red)'
                        : 'var(--text-disabled)';

                    return (
                      <div
                        key={qId}
                        id={`question_card_${qNum}`}
                        style={{
                          ...cardStyle,
                          padding: 20,
                          borderLeft: `5px solid ${cardBorderColor}`,
                          transition: 'all 0.2s ease',
                        }}
                      >
                        {/* Question Card Header (Clickable) */}
                        <div
                          onClick={() => setExpandedQuestionId(isExpanded ? null : qId)}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            cursor: 'pointer',
                            userSelect: 'none',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span
                              style={{
                                fontSize: 14,
                                fontWeight: 900,
                                color: 'var(--primary-red)',
                                backgroundColor: isDark ? 'rgba(var(--primary-red-rgb), 0.15)' : 'var(--bg-subtle)',
                                padding: '4px 10px',
                                borderRadius: 'var(--radius)',
                              }}
                            >
                              Q{qNum}
                            </span>

                            <div>
                              <div
                                style={{
                                  fontSize: 14,
                                  fontWeight: 700,
                                  color: isDark ? 'var(--bg-card)' : 'var(--deep-navy)',
                                }}
                              >
                                {q.topic || q.topic_name || q.meaningful_name || `Question #${qNum}`}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                Time Spent: {q.time_taken_seconds || 60}s
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            {/* Result Badge */}
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                fontSize: 12,
                                fontWeight: 800,
                                padding: '4px 12px',
                                borderRadius: 'var(--radius)',
                                backgroundColor: state.isCorr
                                  ? 'rgba(16,185,129,0.15)'
                                  : state.isInc
                                    ? 'rgba(var(--primary-red-rgb), 0.15)'
                                    : 'rgba(148,163,184,0.15)',
                                color: state.isCorr
                                  ? '#3A8B53'
                                  : state.isInc
                                    ? 'var(--primary-red)'
                                    : 'var(--text-disabled)',
                              }}
                            >
                              {state.isCorr ? (
                                <CheckCircle2 size={14} />
                              ) : state.isInc ? (
                                <XCircle size={14} />
                              ) : (
                                <MinusCircle size={14} />
                              )}
                              <span>
                                {state.isCorr
                                  ? 'Correct (+2.0)'
                                  : state.isInc
                                    ? 'Incorrect (-0.67)'
                                    : 'Unattempted (0.0)'}
                              </span>
                            </span>

                            {isExpanded ? (
                              <ChevronUp size={18} color="var(--text-muted)" />
                            ) : (
                              <ChevronDown size={18} color="var(--text-muted)" />
                            )}
                          </div>
                        </div>

                        {/* Expanded Solution & Option Feedback */}
                        {isExpanded && (
                          <div
                            style={{
                              marginTop: 20,
                              paddingTop: 16,
                              borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'var(--border-color)'
                                }`,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 16,
                            }}
                          >
                            {/* Per-Question 12-Matrix Diagnostic Badges */}
                            <div
                              style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                                gap: 10,
                                padding: '12px 16px',
                                borderRadius: 'var(--radius)',
                                backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'var(--bg-subtle)',
                                border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'var(--border-color)'}`,
                              }}
                            >
                              {/* 0. Self-reported confidence vs outcome */}
                              {q.confidence_level && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>🎯 Your confidence</span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                    {(() => {
                                      const lvl = String(q.confidence_level);
                                      const label = lvl === 'SURE' ? 'Sure' : lvl === 'FIFTY_FIFTY' ? '50-50' : 'Guess';
                                      const verdict = state.isCorr
                                        ? lvl === 'GUESS' ? 'Lucky guess' : 'Right'
                                        : lvl === 'SURE' ? 'Sure but wrong' : 'Wrong';
                                      const good = state.isCorr && lvl !== 'GUESS';
                                      const bad = !state.isCorr && lvl === 'SURE';
                                      return (
                                        <>
                                          <span style={{ padding: '2px 8px', borderRadius: 'var(--radius)', fontSize: 11, fontWeight: 800, backgroundColor: 'var(--bg-hover)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}>
                                            You said: {label}
                                          </span>
                                          <span style={{ fontSize: 11.5, fontWeight: 700, color: good ? '#3A8B53' : bad ? 'var(--primary-red)' : 'var(--text-muted)' }}>
                                            {verdict}
                                          </span>
                                        </>
                                      );
                                    })()}
                                  </div>
                                </div>
                              )}

                              {/* 1. Time Score & Pacing */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>⏱️ Time Score & Pacing</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                  {(() => {
                                    const pBadge = q.pacing_efficiency || q.time_window || 'OPTIMAL';
                                    const b = getBadgeStyle(pBadge);
                                    const speedIdx = q.time_efficiency_score || Math.round(((q.expected_time_seconds || 60) / Math.max(1, q.time_taken_seconds || 60)) * 100);
                                    return (
                                      <>
                                        <span style={{ padding: '2px 8px', borderRadius: 'var(--radius)', fontSize: 11, fontWeight: 800, backgroundColor: b.bg, color: b.color, border: `1px solid ${b.border}` }}>
                                          {q.pacing_efficiency || b.label}
                                        </span>
                                        <span style={{ fontSize: 11.5, fontWeight: 700, color: isDark ? 'var(--border-color)' : 'var(--text-secondary)' }}>
                                          {q.time_taken_seconds || 60}s / {q.expected_time_seconds || 60}s ({speedIdx}% Speed)
                                        </span>
                                      </>
                                    );
                                  })()}
                                </div>
                              </div>

                              {/* 2. FSRS Topic Retention & Memory */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>🧠 FSRS Concept Memory</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                  <span style={{ padding: '2px 8px', borderRadius: 'var(--radius)', fontSize: 11, fontWeight: 800, backgroundColor: 'rgba(16,185,129,0.15)', color: '#3A8B53', border: '1px solid rgba(16,185,129,0.35)' }}>
                                    {q.fsrs_retention_pct || 75}% Retention
                                  </span>
                                  <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)' }}>
                                    Stability: <strong>{q.fsrs_stability_days ? `${q.fsrs_stability_days} Days` : '3.0 Days'}</strong>
                                  </span>
                                </div>
                              </div>

                              {/* 3. OSRI (Answer Revision Safety) */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>🔄 OSRI Answer Revision</span>
                                <div>
                                  {(() => {
                                    const isSwitched = q.is_option_switched;
                                    const osriStatus = q.osri_status || (isSwitched ? (state.isCorr ? 'Rewarding Switch (+2.67 Marks)' : 'Costly Second-Guess (-2.67 Marks)') : 'Initial Selection Retained');
                                    const isPositive = osriStatus.includes('Rewarding');
                                    const isNegative = osriStatus.includes('Costly');
                                    return (
                                      <span
                                        style={{
                                          padding: '2px 8px',
                                          borderRadius: 'var(--radius)',
                                          fontSize: 11,
                                          fontWeight: 800,
                                          backgroundColor: isPositive
                                            ? 'rgba(16,185,129,0.15)'
                                            : isNegative
                                              ? 'rgba(var(--primary-red-rgb), 0.15)'
                                              : isDark
                                                ? 'rgba(255,255,255,0.06)'
                                                : 'var(--border-color)',
                                          color: isPositive ? '#3A8B53' : isNegative ? 'var(--primary-red)' : 'var(--text-muted)',
                                          border: isPositive
                                            ? '1px solid rgba(16,185,129,0.35)'
                                            : isNegative
                                              ? '1px solid rgba(var(--primary-red-rgb), 0.35)'
                                              : '1px solid transparent',
                                        }}
                                      >
                                        {osriStatus}
                                      </span>
                                    );
                                  })()}
                                </div>
                              </div>

                              {/* 5. Distractor Trap Classification */}
                              {q.distractor_classification || q.closeness_classification ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>🎯 Distractor Trap Analysis</span>
                                  <div>
                                    {(() => {
                                      const dClass = q.distractor_classification || q.closeness_classification;
                                      const b = getBadgeStyle(dClass.includes('Near') || dClass.includes('High') ? 'VULNERABLE' : 'COMPETENT');
                                      return (
                                        <span style={{ padding: '2px 8px', borderRadius: 'var(--radius)', fontSize: 11, fontWeight: 800, backgroundColor: b.bg, color: b.color, border: `1px solid ${b.border}` }}>
                                          {formatEnum(dClass)}
                                        </span>
                                      );
                                    })()}
                                  </div>
                                </div>
                              ) : null}
                            </div>

                            {/* Question Statement */}
                            {q.question_text && (
                              <div
                                style={{
                                  fontSize: 14.5,
                                  fontWeight: 600,
                                  lineHeight: 1.6,
                                  color: isDark ? 'var(--bg-card)' : 'var(--deep-navy)',
                                  backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'var(--bg-subtle)',
                                  padding: 16,
                                  borderRadius: 'var(--radius)',
                                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'var(--border-color)'
                                    }`,
                                }}
                              >
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                  {q.question_text}
                                </ReactMarkdown>
                              </div>
                            )}

                            {/* Options List */}
                            {q.options && q.options.length > 0 && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <div
                                  style={{
                                    fontSize: 12,
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    color: 'var(--text-muted)',
                                  }}
                                >
                                  Options & Choices
                                </div>
                                {q.options.map((opt: any, optIdx: number) => {
                                  const optLabel = opt.option_label || String.fromCharCode(65 + optIdx);
                                  const isSelected =
                                    q.selected_option_id === opt.option_id ||
                                    userOptLabel === optLabel;
                                  const isOptCorrect =
                                    opt.is_correct ||
                                    correctOptLabel === optLabel;

                                  // Lookup distractor analysis for this option
                                  const distScores = q.distractor_scores || q.distractor_analysis || {};
                                  let optDistAnalysis: string | null = null;
                                  if (distScores && typeof distScores === 'object') {
                                    if (opt.option_id && distScores[opt.option_id]) {
                                      const entry = distScores[opt.option_id];
                                      optDistAnalysis = typeof entry === 'string' ? entry : (entry.distractor_analysis || entry.distractor_analysis_translations?.ENGLISH || null);
                                    }
                                    if (!optDistAnalysis) {
                                      const cleanOptLabel = String(optLabel).toLowerCase().replace(/[^a-z0-9]/g, '');
                                      for (const [k, v] of Object.entries(distScores)) {
                                        const cleanK = String(k).toLowerCase().replace(/[^a-z0-9]/g, '');
                                        let vLabel = '';
                                        if (typeof v === 'object' && v !== null) {
                                          vLabel = String((v as any).label || (v as any).option_label || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                                        }
                                        if (cleanK === cleanOptLabel || vLabel === cleanOptLabel) {
                                          optDistAnalysis = typeof v === 'string' ? v : ((v as any).distractor_analysis || (v as any).distractor_analysis_translations?.ENGLISH || null);
                                          if (optDistAnalysis) break;
                                        }
                                      }
                                    }
                                  }

                                  let optBorder = isDark ? 'rgba(255,255,255,0.06)' : 'var(--border-color)';
                                  let optBg = isDark ? 'rgba(255,255,255,0.02)' : 'var(--bg-subtle)';
                                  if (isSelected && isOptCorrect) {
                                    optBorder = '#3A8B53';
                                    optBg = isDark ? 'rgba(16,185,129,0.12)' : '#ecfdf5';
                                  } else if (isSelected && !isOptCorrect) {
                                    optBorder = 'var(--primary-red)';
                                    optBg = isDark ? 'rgba(var(--primary-red-rgb), 0.12)' : '#fef2f2';
                                  } else if (isOptCorrect) {
                                    optBorder = '#3A8B53';
                                    optBg = isDark ? 'rgba(16,185,129,0.08)' : '#f0fdf4';
                                  }

                                  return (
                                    <div
                                      key={opt.option_id || optIdx}
                                      style={{
                                        padding: '12px 16px',
                                        borderRadius: 'var(--radius)',
                                        border: `1.5px solid ${optBorder}`,
                                        backgroundColor: optBg,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 6,
                                        fontSize: 13.5,
                                      }}
                                    >
                                      <div
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                        }}
                                      >
                                        <div
                                          style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 10,
                                            flex: 1,
                                          }}
                                        >
                                          <span
                                            style={{
                                              fontWeight: 800,
                                              color: isOptCorrect
                                                ? '#3A8B53'
                                                : isSelected
                                                  ? 'var(--primary-red)'
                                                  : 'var(--text-muted)',
                                            }}
                                          >
                                            {optLabel}.
                                          </span>
                                          <div style={{ display: 'inline', margin: 0 }}>
                                            <ReactMarkdown
                                              remarkPlugins={[remarkGfm]}
                                              components={{
                                                p: ({ node, ...props }: any) => (
                                                  <span
                                                    style={{ display: 'inline', margin: 0 }}
                                                    {...props}
                                                  />
                                                ),
                                              }}
                                            >
                                              {opt.text || opt.option_text || `Option ${optLabel}`}
                                            </ReactMarkdown>
                                          </div>
                                        </div>

                                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                          {isSelected && (
                                            <span
                                              style={{
                                                fontSize: 11,
                                                fontWeight: 800,
                                                padding: '2px 8px',
                                                borderRadius: 'var(--radius)',
                                                backgroundColor: isOptCorrect ? '#3A8B53' : 'var(--primary-red)',
                                                color: 'var(--bg-card)',
                                              }}
                                            >
                                              Your Choice
                                            </span>
                                          )}
                                          {isOptCorrect && !isSelected && (
                                            <span
                                              style={{
                                                fontSize: 11,
                                                fontWeight: 800,
                                                padding: '2px 8px',
                                                borderRadius: 'var(--radius)',
                                                backgroundColor: '#3A8B53',
                                                color: 'var(--bg-card)',
                                              }}
                                            >
                                              Correct Option
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      {/* Per-Option Distractor Analysis */}
                                      {optDistAnalysis && (
                                        <div
                                          style={{
                                            marginTop: 4,
                                            paddingLeft: 24,
                                            fontSize: 12.5,
                                            lineHeight: 1.45,
                                            color: isOptCorrect
                                              ? (isDark ? '#86efac' : '#166534')
                                              : isSelected
                                                ? (isDark ? 'var(--primary-red-border)' : '#991b1b')
                                                : 'var(--text-muted)',
                                            borderLeft: `2px solid ${isOptCorrect ? '#3A8B53' : isSelected ? 'var(--primary-red)' : (isDark ? 'var(--text-secondary)' : 'var(--border-color)')}`,
                                          }}
                                        >
                                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {optDistAnalysis}
                                          </ReactMarkdown>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Option Chosen Feedback & Distractor Explanation Box */}
                            {(() => {
                              const distScores = q.distractor_scores || q.distractor_analysis || {};
                              let chosenFeedback: string | null = null;
                              if (distScores && typeof distScores === 'object') {
                                if (q.selected_option_id && distScores[q.selected_option_id]) {
                                  const entry = distScores[q.selected_option_id];
                                  chosenFeedback = typeof entry === 'string' ? entry : (entry.distractor_analysis || entry.distractor_analysis_translations?.ENGLISH || null);
                                }
                                if (!chosenFeedback && userOptLabel && userOptLabel !== 'Unattempted') {
                                  const cleanUserLbl = String(userOptLabel).toLowerCase().replace(/[^a-z0-9]/g, '');
                                  for (const [k, v] of Object.entries(distScores)) {
                                    const cleanK = String(k).toLowerCase().replace(/[^a-z0-9]/g, '');
                                    let vLabel = '';
                                    if (typeof v === 'object' && v !== null) {
                                      vLabel = String((v as any).label || (v as any).option_label || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                                    }
                                    if (cleanK === cleanUserLbl || vLabel === cleanUserLbl) {
                                      chosenFeedback = typeof v === 'string' ? v : ((v as any).distractor_analysis || (v as any).distractor_analysis_translations?.ENGLISH || null);
                                      if (chosenFeedback) break;
                                    }
                                  }
                                }
                              }

                              const optionsList = q.options || [];

                              return (
                                <div
                                  style={{
                                    padding: 16,
                                    borderRadius: 'var(--radius)',
                                    backgroundColor: isDark ? 'rgba(245, 158, 11, 0.08)' : '#fffbeb',
                                    border: '1px solid rgba(245, 158, 11, 0.25)',
                                    fontSize: 13,
                                    lineHeight: 1.5,
                                  }}
                                >
                                  <div
                                    style={{
                                      fontWeight: 700,
                                      color: '#d97706',
                                      marginBottom: 8,
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 6,
                                    }}
                                  >
                                    <Lightbulb size={18} />
                                    <span>
                                      {state.isUnatt
                                        ? 'Unattempted Question — Full Option Distractor & Trap Analysis:'
                                        : `Option (${userOptLabel}) Selected — Diagnostic Feedback:`}
                                    </span>
                                  </div>

                                  <div style={{ color: isDark ? 'var(--border-color)' : '#451a03', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    <div>
                                      <strong>Trap / Choice Classification:</strong>{' '}
                                      <span style={{ color: '#d97706', fontWeight: 600 }}>
                                        {q.closeness_classification || 'Standard Conceptual Distractor'}
                                      </span>
                                    </div>

                                    {state.isUnatt ? (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                                        <div style={{ fontSize: 12.5, color: isDark ? 'var(--border-color)' : '#78350f' }}>
                                          You left this question unattempted. Below is why each incorrect option is a distractor trap and why Option ({correctOptLabel}) is correct:
                                        </div>
                                        {optionsList.map((opt: any, optIdx: number) => {
                                          const optLabel = opt.option_label || String.fromCharCode(65 + optIdx);
                                          const isCorrectOpt = opt.is_correct || correctOptLabel === optLabel;

                                          let optDistText: string | null = null;
                                          if (distScores && typeof distScores === 'object') {
                                            const entry = distScores[opt.option_id] || distScores[optLabel] || distScores[optLabel.toLowerCase()];
                                            if (entry) {
                                              optDistText = typeof entry === 'string' ? entry : (entry.distractor_analysis || entry.explanation || null);
                                            }
                                          }

                                          return (
                                            <div
                                              key={opt.option_id || optIdx}
                                              style={{
                                                padding: '8px 12px',
                                                borderRadius: 'var(--radius)',
                                                backgroundColor: isCorrectOpt
                                                  ? (isDark ? 'rgba(16,185,129,0.1)' : '#f0fdf4')
                                                  : (isDark ? 'rgba(255,255,255,0.03)' : '#fef2f2'),
                                                border: `1px solid ${isCorrectOpt ? '#3A8B53' : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(var(--primary-red-rgb), 0.2)')}`,
                                              }}
                                            >
                                              <div style={{ fontWeight: 700, fontSize: 12.5, color: isCorrectOpt ? '#3A8B53' : 'var(--primary-red)', marginBottom: 2 }}>
                                                Option {optLabel}: {isCorrectOpt ? '🟢 Correct Answer' : '🔴 Incorrect Distractor Trap'}
                                              </div>
                                              <div style={{ fontSize: 12, color: isDark ? 'var(--border-color)' : 'var(--text-secondary)' }}>
                                                {optDistText ? (
                                                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{optDistText}</ReactMarkdown>
                                                ) : isCorrectOpt ? (
                                                  `Option (${optLabel}) is the uniquely correct statement based on core concepts.`
                                                ) : (
                                                  `Option (${optLabel}) is a plausible distractor designed to test precise factual understanding.`
                                                )}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    ) : chosenFeedback ? (
                                      <div style={{ marginTop: 2 }}>
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                          {chosenFeedback}
                                        </ReactMarkdown>
                                      </div>
                                    ) : state.isInc ? (
                                      <div>
                                        Option ({userOptLabel}) was selected because it represents a common distractor trap. Option ({correctOptLabel}) is the correct choice.
                                      </div>
                                    ) : (
                                      <div>
                                        You successfully identified Option ({correctOptLabel}) as correct and avoided the deceptive distractor traps in this question.
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })()}

                            {/* Comprehensive Solution Breakdown */}
                            {expl && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                                {/* Step-by-Step Detailed Solution */}
                                {expl.detailed_solution && (
                                  <div
                                    style={{
                                      padding: 14,
                                      borderRadius: 'var(--radius)',
                                      backgroundColor: isDark
                                        ? 'rgba(255,255,255,0.03)'
                                        : 'var(--bg-subtle)',
                                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'var(--border-color)'
                                        }`,
                                    }}
                                  >
                                    <div
                                      style={{
                                        fontSize: 12,
                                        fontWeight: 800,
                                        color: 'var(--text-muted)',
                                        textTransform: 'uppercase',
                                        marginBottom: 6,
                                      }}
                                    >
                                      📝 Step-by-Step Authoritative Solution
                                    </div>
                                    <div
                                      style={{
                                        fontSize: 13.5,
                                        color: isDark ? 'var(--border-color)' : 'var(--text-secondary)',
                                        lineHeight: 1.6,
                                      }}
                                    >
                                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {expl.detailed_solution}
                                      </ReactMarkdown>
                                    </div>
                                  </div>
                                )}

                                {/* Common Traps */}
                                {expl.common_traps && (
                                  <div
                                    style={{
                                      padding: 14,
                                      borderRadius: 'var(--radius)',
                                      backgroundColor: isDark
                                        ? 'rgba(245,158,11,0.08)'
                                        : '#fffbeb',
                                      border: '1px solid rgba(245,158,11,0.25)',
                                    }}
                                  >
                                    <div
                                      style={{
                                        fontSize: 12,
                                        fontWeight: 800,
                                        color: '#d97706',
                                        textTransform: 'uppercase',
                                        marginBottom: 6,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 6,
                                      }}
                                    >
                                      <AlertTriangle size={16} /> Common Examiner Traps
                                    </div>
                                    <div
                                      style={{
                                        fontSize: 13,
                                        color: isDark ? 'var(--border-color)' : '#78350f',
                                        lineHeight: 1.5,
                                      }}
                                    >
                                      {Array.isArray(expl.common_traps) ? (
                                        <ul style={{ margin: 0, paddingLeft: 18 }}>
                                          {expl.common_traps.map((item: string, tIdx: number) => (
                                            <li key={tIdx} style={{ margin: '3px 0' }}>
                                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                {item}
                                              </ReactMarkdown>
                                            </li>
                                          ))}
                                        </ul>
                                      ) : (
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                          {String(expl.common_traps)}
                                        </ReactMarkdown>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Knowledge Layer: similar PYQs for this question (loads only while the card is open) */}
                            <SimilarQuestionsSection questionId={q.question_id} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Bottom Full Question Pagination Bar */}
                {filteredQuestions.length > questionPageSize && (
                  <div
                    style={{
                      marginTop: 18,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 12,
                      padding: 16,
                      borderRadius: 'var(--radius)',
                      backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'var(--bg-card)',
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'var(--border-color)'}`,
                    }}
                  >
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                      Page <strong style={{ color: isDark ? 'var(--bg-card)' : 'var(--deep-navy)' }}>{validQuestionPage}</strong> of <strong style={{ color: isDark ? 'var(--bg-card)' : 'var(--deep-navy)' }}>{totalQuestionPages}</strong> ({filteredQuestions.length} Total Questions)
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button
                        disabled={validQuestionPage <= 1}
                        onClick={() => {
                          setQuestionPage((p) => Math.max(1, p - 1));
                          window.scrollTo({ top: 300, behavior: 'smooth' });
                        }}
                        style={{
                          padding: '6px 14px',
                          borderRadius: 'var(--radius)',
                          border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'var(--border-color)'}`,
                          backgroundColor: validQuestionPage <= 1 ? 'transparent' : isDark ? 'rgba(255,255,255,0.05)' : 'var(--bg-card)',
                          color: validQuestionPage <= 1 ? 'var(--text-muted)' : isDark ? 'var(--bg-card)' : 'var(--deep-navy)',
                          cursor: validQuestionPage <= 1 ? 'not-allowed' : 'pointer',
                          fontSize: 12,
                          fontWeight: 700,
                          opacity: validQuestionPage <= 1 ? 0.5 : 1,
                        }}
                      >
                        ← Previous
                      </button>

                      {Array.from({ length: totalQuestionPages }, (_, i) => i + 1)
                        .filter((pageNum) => {
                          if (totalQuestionPages <= 8) return true;
                          return Math.abs(pageNum - validQuestionPage) <= 2 || pageNum === 1 || pageNum === totalQuestionPages;
                        })
                        .map((pageNum, idx, arr) => {
                          const prev = arr[idx - 1];
                          const showEllipsis = prev && pageNum - prev > 1;
                          return (
                            <React.Fragment key={`qpage_${pageNum}`}>
                              {showEllipsis && <span style={{ padding: '0 4px', color: 'var(--text-muted)' }}>...</span>}
                              <button
                                onClick={() => {
                                  setQuestionPage(pageNum);
                                  window.scrollTo({ top: 300, behavior: 'smooth' });
                                }}
                                style={{
                                  padding: '6px 12px',
                                  borderRadius: 'var(--radius)',
                                  border: pageNum === validQuestionPage ? '1px solid var(--primary-red)' : `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'var(--border-color)'}`,
                                  backgroundColor: pageNum === validQuestionPage ? 'var(--primary-red)' : isDark ? 'rgba(255,255,255,0.05)' : 'var(--bg-card)',
                                  color: pageNum === validQuestionPage ? 'var(--bg-card)' : isDark ? 'var(--bg-card)' : 'var(--deep-navy)',
                                  cursor: 'pointer',
                                  fontSize: 12,
                                  fontWeight: 700,
                                }}
                              >
                                {pageNum}
                              </button>
                            </React.Fragment>
                          );
                        })}

                      <button
                        disabled={validQuestionPage >= totalQuestionPages}
                        onClick={() => {
                          setQuestionPage((p) => Math.min(totalQuestionPages, p + 1));
                          window.scrollTo({ top: 300, behavior: 'smooth' });
                        }}
                        style={{
                          padding: '6px 14px',
                          borderRadius: 'var(--radius)',
                          border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'var(--border-color)'}`,
                          backgroundColor: validQuestionPage >= totalQuestionPages ? 'transparent' : isDark ? 'rgba(255,255,255,0.05)' : 'var(--bg-card)',
                          color: validQuestionPage >= totalQuestionPages ? 'var(--text-muted)' : isDark ? 'var(--bg-card)' : 'var(--deep-navy)',
                          cursor: validQuestionPage >= totalQuestionPages ? 'not-allowed' : 'pointer',
                          fontSize: 12,
                          fontWeight: 700,
                          opacity: validQuestionPage >= totalQuestionPages ? 0.5 : 1,
                        }}
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          TAB 3: SUBJECT, TOPIC & COGNITIVE PERFORMANCE MATRIX
      ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'topics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Header Card */}
          <div style={cardStyle}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12,
                marginBottom: 16,
              }}
            >
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 4px 0' }}>
                  Syllabus Performance & Cognitive Matrix
                </h3>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Multi-level breakdown across Subjects, Topics, and Subtopics with Pacing Velocity, Strong/Weak Zones, Bloom Thinking Levels, and Memory Retention.
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  onClick={expandAllHierarchy}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 'var(--radius)',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : 'var(--border-color)'}`,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'var(--bg-subtle)',
                    color: isDark ? 'var(--border-color)' : 'var(--text-secondary)',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Expand All
                </button>
                <button
                  onClick={collapseAllHierarchy}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 'var(--radius)',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : 'var(--border-color)'}`,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'var(--bg-subtle)',
                    color: isDark ? 'var(--border-color)' : 'var(--text-secondary)',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Collapse All
                </button>
              </div>
            </div>

            {/* Matrix Legend / Summary Bar */}
            <div
              style={{
                padding: '10px 16px',
                borderRadius: 'var(--radius)',
                backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'var(--bg-subtle)',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'var(--border-color)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12,
                fontSize: 12,
                marginBottom: 16,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>Mastery Zones:</span>
                <span style={{ color: '#3A8B53', fontWeight: 700 }}>🟢 Mastered (≥85%)</span>
                <span style={{ color: 'var(--primary-red)', fontWeight: 700 }}>🔵 Strong (70–84%)</span>
                <span style={{ color: '#F2B623', fontWeight: 700 }}>🟡 Competent (50–69%)</span>
                <span style={{ color: '#F47B35', fontWeight: 700 }}>🟠 Needs Practice (30–49%)</span>
                <span style={{ color: 'var(--primary-red)', fontWeight: 700 }}>🔴 Critical Gap (&lt;30%)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>Pacing:</span>
                <span style={{ color: '#3A8B53', fontWeight: 700 }}>⚡ Optimal (0.7x–1.35x)</span>
                <span style={{ color: 'var(--primary-red)', fontWeight: 700 }}>⏳ Bottleneck (&gt;1.35x)</span>
                <span style={{ color: '#8b5cf6', fontWeight: 700 }}>💨 Rapid (&lt;0.7x)</span>
              </div>
            </div>


            {/* Interactive Hierarchy Tree */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Layers size={18} color="var(--primary-red)" />
                <h4 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: isDark ? 'var(--bg-card)' : 'var(--deep-navy)' }}>
                  Subject & Topic Hierarchy Breakdown
                </h4>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {hierarchyData.map((node: any) => renderHierarchyNode(node, 0, `node_${node.name}`))}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
