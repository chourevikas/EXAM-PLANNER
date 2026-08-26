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
  Sparkles,
  Compass,
  Gauge,
  Sliders,
  Award,
  CalendarPlus,
  ArrowRight,
  Filter,
} from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
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
import { MarkdownPreviewer } from '../common/MarkdownPreviewer';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ResponsiveContainer,
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

interface PsychometricReportViewProps {
  report: PsychometricReport;
  markdownContent?: string;
  questionReportData?: QuestionReportItem[];
  userProgressionData?: UserProgressionReportData | null;
}

export function PsychometricReportView({
  report,
  markdownContent,
  questionReportData,
  userProgressionData,
}: PsychometricReportViewProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [activeTab, setActiveTab] = useState<
    'questions' | 'exam-matrices' | 'topics' | 'user-aggregate' | 'markdown'
  >('questions');

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

  const attemptId =
    (report as any)?.metadata?.exam_attempt?.attempt_id ||
    (report as any)?.attempt_id ||
    (report as any)?.exam_attempt?.attempt_id;

  // Sync already scheduled tasks for this attempt from backend
  useEffect(() => {
    if (attemptId && attemptId !== 'CUMULATIVE_ALL') {
      getAttemptScheduledTasksStatus(attemptId)
        .then((res) => {
          if (res?.scheduled_task_titles) {
            setScheduledTaskTitles(new Set(res.scheduled_task_titles));
          }
        })
        .catch(() => {});
    }
  }, [attemptId]);

  const toggleTaskCompleted = (taskId: string) => {
    setCompletedTasks((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  const handleScheduleSingleTask = async (task: any) => {
    if (!attemptId) return;
    const taskId = task.task_id || task.title;
    setIsAddingTask((prev) => ({ ...prev, [taskId]: true }));
    try {
      await bulkAddStudyTasksFromReport({
        attempt_id: attemptId,
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
    if (!attemptId || !tasks.length) return;
    setIsBulkAdding(true);
    try {
      await bulkAddStudyTasksFromReport({
        attempt_id: attemptId,
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

  const timelineData =
    report?.exam_timeline ||
    (report as any)?.metadata?.exam_timeline ||
    (report as any)?.evolution_graphs?.exam_timeline ||
    [];
  const isCumulative =
    report?.is_cumulative ||
    report?.metadata?.report_type === 'CUMULATIVE_MULTI_EXAM_AGGREGATE';

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
    backgroundColor: isDark ? '#131f37' : '#ffffff',
    borderRadius: 20,
    padding: 24,
    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'}`,
    boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.2)' : '0 2px 8px rgba(0,0,0,0.03)',
  };

  // Helper for dynamic badge styling
  const getBadgeStyle = (rawStatus: string): { bg: string; color: string; border: string; label: string } => {
    const s = (rawStatus || '').toUpperCase();
    const cleanLabel = (rawStatus || '').replace(/_/g, ' ');

    if (s.includes('UNATTEMPTED')) {
      return { bg: 'rgba(148, 163, 184, 0.15)', color: '#64748b', border: 'rgba(148, 163, 184, 0.35)', label: 'Unattempted' };
    }

    if (
      s.includes('EXCEPTIONAL') ||
      s.includes('ELITE') ||
      s.includes('SUPERIOR') ||
      s.includes('OPTIMAL') ||
      s.includes('HIGH_COMPETENCE') ||
      s.includes('STRONG')
    ) {
      return { bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: 'rgba(16, 185, 129, 0.35)', label: cleanLabel || 'High Competence' };
    }
    if (s.includes('HIGH') || s.includes('HEALTHY') || s.includes('CONTROLLED') || s.includes('CONSTRUCTIVE')) {
      return { bg: 'rgba(37, 99, 235, 0.15)', color: '#2563eb', border: 'rgba(37, 99, 235, 0.35)', label: cleanLabel || 'Controlled & Solid' };
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
    return { bg: 'rgba(239, 68, 68, 0.15)', color: '#dc2626', border: 'rgba(239, 68, 68, 0.35)', label: cleanLabel || 'Urgent Revision' };
  };

  const renderInfoToggle = (key: string, description: string, calculationMethod: string, idealScore: string) => {
    const isOpen = !!openInfoKeys[key];
    return (
      <div style={{ marginTop: 12 }}>
        <button
          onClick={() => toggleInfo(key)}
          style={{
            background: isOpen ? '#2563eb' : isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9',
            color: isOpen ? '#ffffff' : isDark ? '#94a3b8' : '#64748b',
            border: 'none',
            borderRadius: 20,
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
              borderRadius: 12,
              backgroundColor: isDark ? 'rgba(30, 41, 59, 0.9)' : '#f8fafc',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
              fontSize: 12,
              lineHeight: 1.5,
              color: isDark ? '#e2e8f0' : '#334155',
            }}
          >
            <div style={{ marginBottom: 6 }}>
              <strong>What it measures:</strong> {description}
            </div>
            <div style={{ marginBottom: 6 }}>
              <strong>How it is computed:</strong> {calculationMethod}
            </div>
            <div>
              <strong>Target / Ideal:</strong> <span style={{ color: '#10b981', fontWeight: 700 }}>{idealScore}</span>
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
    const subjs = part2Tax.by_subject || part2Tax.subject_breakdown || [];
    const tops = part2Tax.by_topic || part2Tax.topic_breakdown || [];

    const subjMap: Record<string, any> = {};

    subjs.forEach((s: any) => {
      const sName = s.taxonomy_name || s.subject || 'General Studies';
      subjMap[sName] = {
        name: sName,
        total: s.total_questions || s.total || 0,
        attempted: s.attempted_questions || s.attempted || s.total_questions || 0,
        correct: s.correct || 0,
        incorrect: s.incorrect || 0,
        unattempted: s.unattempted || 0,
        accuracy: Math.round(s.accuracy_percentage || s.accuracy || 0),
        avg_time: Math.round(s.avg_time_per_question || 60),
        expected_time: Math.round(s.expected_time_per_question || 60),
        pacing_status: s.pacing_status || 'OPTIMAL',
        pacing_label: s.pacing_label || '⚡ Optimal Pace',
        status: s.strength_status || 'STRONG',
        status_label: s.strength_label || 'Strong',
        retention_pct: Math.round(s.topic_retention_pct || s.fsrs_retention_pct || 75),
        stability_days: s.fsrs_stability_days || 3.5,
        retention_health: s.retention_health_label || 'Healthy Active',
        blooms: s.blooms_breakdown || {},
        question_numbers: [],
        topics: [],
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
          unattempted: t.unattempted || 0,
          accuracy: Math.round(t.accuracy_percentage || 0),
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

      const tNode = {
        name: tName,
        subject: sName,
        total: t.total_questions || 0,
        attempted: t.attempted_questions || t.total_questions || 0,
        correct: t.correct || 0,
        incorrect: t.incorrect || 0,
        unattempted: t.unattempted || 0,
        accuracy: Math.round(t.accuracy_percentage || 0),
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
        subtopics: [],
      };

      subjMap[sName].topics.push(tNode);
    });

    return Object.values(subjMap);
  }, [questionsList, report]);

  const handleJumpToQuestion = (qNum: number) => {
    setActiveTab('questions');
    setQuestionFilter('all');
    const matchedQ = questionsList.find((q, idx) => Number(q.question_number || idx + 1) === qNum);
    if (matchedQ) {
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
    hierarchyData.forEach((s: any) => {
      allIds[`subj_${s.name}`] = true;
      s.topics?.forEach((t: any) => {
        allIds[`top_${s.name}_${t.name}`] = true;
      });
    });
    setExpandedHierarchyNodes(allIds);
  };

  const collapseAllHierarchy = () => {
    setExpandedHierarchyNodes({});
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Top Header Banner */}
      <section
        style={{
          ...cardStyle,
          background: 'linear-gradient(135deg, rgba(37,99,235,0.12) 0%, rgba(147,51,234,0.12) 100%)',
          border: '1px solid rgba(37,99,235,0.25)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 20,
        }}
      >
        <div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 12px',
              backgroundColor: 'rgba(37,99,235,0.15)',
              borderRadius: 20,
              marginBottom: 10,
              fontSize: 12,
              fontWeight: 800,
              color: '#2563eb',
              textTransform: 'uppercase',
            }}
          >
            <Brain size={14} /> Full 12-Matrix Diagnostic Platform
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 6px 0', color: isDark ? '#ffffff' : '#0f172a' }}>
            {metadata?.exam_attempt?.exam_name || 'UPSC Civil Services Examination'}
          </h1>
          <p style={{ fontSize: 13, color: isDark ? 'rgba(255,255,255,0.7)' : '#64748b', margin: 0 }}>
            Candidate: <strong>{metadata?.candidate?.full_name || 'Candidate'}</strong> • Attempt Date:{' '}
            {metadata?.exam_attempt?.attempt_date ? new Date(metadata.exam_attempt.attempt_date).toLocaleDateString() : 'Today'}
          </p>
        </div>

        {/* Score & Accuracy Badges */}
        <div style={{ display: 'flex', gap: 16 }}>
          <div
            style={{
              backgroundColor: isDark ? 'rgba(15,23,42,0.6)' : '#ffffff',
              padding: '12px 20px',
              borderRadius: 16,
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Net Marks</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#2563eb' }}>
              {metadata?.exam_attempt?.total_score_awarded !== undefined
                ? metadata.exam_attempt.total_score_awarded.toFixed(2)
                : (metadata?.exam_attempt as any)?.total_score !== undefined
                ? Number((metadata?.exam_attempt as any)?.total_score).toFixed(2)
                : '0.00'}
              <span style={{ fontSize: 13, color: '#64748b' }}> / {metadata?.exam_attempt?.max_possible_score || 200}</span>
            </div>
          </div>

          <div
            style={{
              backgroundColor: isDark ? 'rgba(15,23,42,0.6)' : '#ffffff',
              padding: '12px 20px',
              borderRadius: 16,
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>ICRS Index</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#10b981' }}>
              {icrs?.icrs_score || 82}
              <span style={{ fontSize: 13, color: '#64748b' }}> / 100</span>
            </div>
          </div>
        </div>
      </section>

      {/* Navigation Tabs (4 Standardized Sections) */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
          paddingBottom: 12,
          overflowX: 'auto',
        }}
      >
        {[
          { id: 'questions', label: '1. Per-Question Diagnostics & Solutions', icon: Target },
          { id: 'exam-matrices', label: isCumulative ? '1. Cumulative Performance Scorecards' : '2. Exam Performance & Cognitive Scorecard', icon: Zap },
          { id: 'topics', label: isCumulative ? '2. Syllabus & Category Mastery' : '3. Syllabus & Category Mastery', icon: BookOpen },
          { id: 'user-aggregate', label: '3. Longitudinal Evolution & Trends', icon: TrendingUp },
        ].filter((tab) => {
          if (isCumulative) {
            return tab.id !== 'questions';
          } else {
            return tab.id !== 'user-aggregate';
          }
        }).map((tab) => {
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
                borderRadius: 12,
                border: 'none',
                backgroundColor: isActive ? '#2563eb' : isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9',
                color: isActive ? '#ffffff' : isDark ? '#94a3b8' : '#64748b',
                fontWeight: 700,
                fontSize: 13.5,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap',
              }}
            >
              <IconComp size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          PLACE 1: EXAM 12-MATRIX PERFORMANCE (Tab 1)
      ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'exam-matrices' && (
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
                    ? 'linear-gradient(135deg, rgba(30, 58, 138, 0.3) 0%, rgba(15, 23, 42, 0.8) 100%)'
                    : 'linear-gradient(135deg, #eff6ff 0%, #ffffff 100%)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  padding: 24,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
                  <div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 20, backgroundColor: isAboveCutoff ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)', color: isAboveCutoff ? '#10b981' : '#f59e0b', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', marginBottom: 8 }}>
                      <Award size={14} />
                      {upscBench.benchmark_status || (isAboveCutoff ? (isPractice ? 'Qualifying Practice Standard' : 'Clearing Qualifying Cutoff') : (isPractice ? 'Practice Revision Recommended' : 'Near Cutoff Benchmark'))}
                    </div>
                    <h2 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 4px 0', color: isDark ? '#ffffff' : '#0f172a' }}>
                      {isPractice ? 'Practice Session Diagnostic Summary' : 'Executive UPSC Prelims Diagnostic Summary'}
                    </h2>
                    <p style={{ fontSize: 13, color: isDark ? '#94a3b8' : '#64748b', margin: 0 }}>
                      Comprehensive marks accounting, qualifying benchmark margin, and error breakdown.
                    </p>
                  </div>

                  <div style={{ padding: '10px 18px', borderRadius: 14, backgroundColor: isDark ? 'rgba(15, 23, 42, 0.6)' : '#ffffff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#cbd5e1'}`, textAlign: 'right' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                      {isPractice ? 'Practice Mastery Benchmark' : 'UPSC Cutoff Benchmark'}
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: isAboveCutoff ? '#10b981' : '#f59e0b' }}>
                      {cutoffMargin >= 0 ? `+${cutoffMargin}` : cutoffMargin} Marks
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}> vs {cutoffTarget.toFixed(1)} {isPractice ? 'Target' : 'Cutoff'}</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
                  <div style={{ padding: 14, borderRadius: 14, backgroundColor: isDark ? 'rgba(16,185,129,0.1)' : '#f0fdf4', border: '1px solid rgba(16,185,129,0.25)' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#10b981', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <CheckCircle2 size={16} /> Marks Earned (+)
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: '#10b981', marginTop: 4 }}>+{posMarks}</div>
                    <div style={{ fontSize: 11.5, color: '#64748b' }}>{corrCount} correct answers</div>
                  </div>

                  <div style={{ padding: 14, borderRadius: 14, backgroundColor: isDark ? 'rgba(239,68,68,0.1)' : '#fef2f2', border: '1px solid rgba(239,68,68,0.25)' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <AlertTriangle size={16} /> Negative Marks Lost (-)
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: '#ef4444', marginTop: 4 }}>-{negMarks}</div>
                    <div style={{ fontSize: 11.5, color: '#64748b' }}>{incCount} incorrect selections</div>
                  </div>

                  <div style={{ padding: 14, borderRadius: 14, backgroundColor: isDark ? 'rgba(37,99,235,0.1)' : '#eff6ff', border: '1px solid rgba(37,99,235,0.25)' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#2563eb', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Zap size={16} /> Net Final Score
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: '#2563eb', marginTop: 4 }}>{netMarks.toFixed(2)}</div>
                    <div style={{ fontSize: 11.5, color: '#64748b' }}>Out of {maxPossibleScore.toFixed(2)} Marks</div>
                  </div>

                  <div style={{ padding: 14, borderRadius: 14, backgroundColor: isDark ? 'rgba(139,92,246,0.1)' : '#faf5ff', border: '1px solid rgba(139,92,246,0.25)' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Target size={16} /> Accuracy & Coverage
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: '#8b5cf6', marginTop: 4 }}>{attemptAccPct}%</div>
                    <div style={{ fontSize: 11.5, color: '#64748b' }}>{attemptedCount}/{totalCount} questions attempted ({coveragePct}%)</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
                  <div style={{ padding: 12, borderRadius: 12, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}` }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#10b981', marginBottom: 4 }}>🟢 Top Marks Drivers</div>
                    <div style={{ fontSize: 12.5, color: isDark ? '#e2e8f0' : '#334155' }}>
                      {corrCount > 0 ? `Secured +${posMarks} positive marks across ${corrCount} accurate concept selections.` : 'No positive mark drivers recorded in this attempt.'}
                    </div>
                  </div>

                  <div style={{ padding: 12, borderRadius: 12, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}` }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#ef4444', marginBottom: 4 }}>🔴 Primary Marks Leakage</div>
                    <div style={{ fontSize: 12.5, color: isDark ? '#e2e8f0' : '#334155' }}>
                      {incCount > 0 ? `Lost -${negMarks} marks to negative penalty across ${incCount} incorrect distractor choices.` : 'Zero marks leaked to negative penalty.'}
                    </div>
                  </div>

                  <div style={{ padding: 12, borderRadius: 12, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}` }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#2563eb', marginBottom: 4 }}>⚡ Attempt Coverage & Pacing</div>
                    <div style={{ fontSize: 12.5, color: isDark ? '#e2e8f0' : '#334155' }}>
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
                borderLeft: '5px solid #2563eb',
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
                      color: '#2563eb',
                      backgroundColor: isDark ? 'rgba(37,99,235,0.15)' : '#eff6ff',
                      padding: '3px 8px',
                      borderRadius: 8,
                      textTransform: 'uppercase',
                    }}
                  >
                    Metric 01
                  </span>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: isDark ? '#ffffff' : '#0f172a' }}>
                      Overall Exam Readiness
                    </h3>
                    <div style={{ fontSize: 11.5, color: '#64748b' }}>Qualification Target Benchmark</div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ fontSize: 24, fontWeight: 900, color: '#2563eb' }}>
                    {icrs?.icrs_score !== undefined ? icrs.icrs_score : 75} <span style={{ fontSize: 13, color: '#64748b' }}>/ 100</span>
                  </div>
                  {(() => {
                    const b = getBadgeStyle(icrs?.readiness_label || icrs?.classification || 'Competitive Benchmark Ready');
                    return (
                      <span
                        style={{
                          fontSize: 11.5,
                          fontWeight: 700,
                          padding: '3px 10px',
                          borderRadius: 12,
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

              <div style={{ fontSize: 12.5, color: isDark ? '#cbd5e1' : '#334155' }}>
                Cutoff Buffer: <strong>{icrs?.cutoff_margin !== undefined ? `${icrs.cutoff_margin > 0 ? '+' : ''}${icrs.cutoff_margin} Marks` : 'On Qualifying Track'}</strong> • Readiness Band: <strong>{icrs?.readiness_label || 'Competitive'}</strong>
              </div>

              <div
                style={{
                  padding: '9px 14px',
                  borderRadius: 10,
                  backgroundColor: isDark ? 'rgba(37,99,235,0.08)' : 'rgba(37,99,235,0.04)',
                  borderLeft: '3px solid #2563eb',
                  border: `1px solid ${isDark ? 'rgba(37,99,235,0.2)' : 'rgba(37,99,235,0.15)'}`,
                  borderLeftWidth: 3,
                  fontSize: 12.5,
                  color: isDark ? '#cbd5e1' : '#334155',
                  lineHeight: 1.5,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 800, color: '#2563eb', textTransform: 'uppercase', marginBottom: 2 }}>
                  💡 AI Diagnostic Context
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
                borderLeft: '5px solid #10b981',
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
                      color: '#10b981',
                      backgroundColor: isDark ? 'rgba(16,185,129,0.15)' : '#f0fdf4',
                      padding: '3px 8px',
                      borderRadius: 8,
                      textTransform: 'uppercase',
                    }}
                  >
                    Metric 02
                  </span>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: isDark ? '#ffffff' : '#0f172a' }}>
                      Knowledge Depth & Mastery
                    </h3>
                    <div style={{ fontSize: 11.5, color: '#64748b' }}>Conceptual Command Across Difficulty</div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ fontSize: 24, fontWeight: 900, color: '#10b981' }}>
                    {irt?.percentile_rank ? `Top ${(100 - irt.percentile_rank).toFixed(1)}% Benchmark` : 'Competent Tier'}
                  </div>
                  <span
                    style={{
                      fontSize: 11.5,
                      fontWeight: 700,
                      padding: '3px 10px',
                      borderRadius: 12,
                      backgroundColor: 'rgba(16,185,129,0.15)',
                      color: '#10b981',
                      border: '1px solid rgba(16,185,129,0.3)',
                    }}
                  >
                    {irt?.ability_label || 'Competent Tier'}
                  </span>
                </div>
              </div>

              <div style={{ fontSize: 12.5, color: isDark ? '#cbd5e1' : '#334155' }}>
                Estimated Percentile: <strong>{irt?.percentile_rank ?? 50.0}%</strong> • Mastery Status: <strong style={{ color: '#10b981' }}>{irt?.ability_label || 'Competent'}</strong>
              </div>

              <div
                style={{
                  padding: '9px 14px',
                  borderRadius: 10,
                  backgroundColor: isDark ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.04)',
                  borderLeft: '3px solid #10b981',
                  border: `1px solid ${isDark ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.15)'}`,
                  borderLeftWidth: 3,
                  fontSize: 12.5,
                  color: isDark ? '#cbd5e1' : '#334155',
                  lineHeight: 1.5,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 800, color: '#10b981', textTransform: 'uppercase', marginBottom: 2 }}>
                  💡 AI Diagnostic Context
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
                borderLeft: '5px solid #f59e0b',
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
                      color: '#f59e0b',
                      backgroundColor: isDark ? 'rgba(245,158,11,0.15)' : '#fefce8',
                      padding: '3px 8px',
                      borderRadius: 8,
                      textTransform: 'uppercase',
                    }}
                  >
                    Metric 03
                  </span>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: isDark ? '#ffffff' : '#0f172a' }}>
                      Guessing Risk & Confidence
                    </h3>
                    <div style={{ fontSize: 11.5, color: '#64748b' }}>Educated Eliminations vs Blind Guesses</div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ fontSize: 24, fontWeight: 900, color: '#f59e0b' }}>
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
                          borderRadius: 12,
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

              <div style={{ fontSize: 12.5, color: isDark ? '#cbd5e1' : '#334155' }}>
                Instinct Profile: <strong>{gti?.label || 'Controlled Risk'}</strong> • Discipline Threshold: <strong>Target &lt; 20%</strong>
              </div>

              <div
                style={{
                  padding: '9px 14px',
                  borderRadius: 10,
                  backgroundColor: isDark ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.04)',
                  borderLeft: '3px solid #f59e0b',
                  border: `1px solid ${isDark ? 'rgba(245,158,11,0.2)' : 'rgba(245,158,11,0.15)'}`,
                  borderLeftWidth: 3,
                  fontSize: 12.5,
                  color: isDark ? '#cbd5e1' : '#334155',
                  lineHeight: 1.5,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase', marginBottom: 2 }}>
                  💡 AI Diagnostic Context
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
                      borderRadius: 8,
                      textTransform: 'uppercase',
                    }}
                  >
                    Metric 04
                  </span>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: isDark ? '#ffffff' : '#0f172a' }}>
                      Elimination Accuracy
                    </h3>
                    <div style={{ fontSize: 11.5, color: '#64748b' }}>Accuracy on 50:50 Pruned Choices</div>
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
                          borderRadius: 12,
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

              <div style={{ fontSize: 12.5, color: isDark ? '#cbd5e1' : '#334155' }}>
                Elimination Rating: <strong>{oeei?.elimination_rating || 'High Precision'}</strong> • Target: <strong>&gt; 70% Conversion</strong>
              </div>

              <div
                style={{
                  padding: '9px 14px',
                  borderRadius: 10,
                  backgroundColor: isDark ? 'rgba(139,92,246,0.08)' : 'rgba(139,92,246,0.04)',
                  borderLeft: '3px solid #8b5cf6',
                  border: `1px solid ${isDark ? 'rgba(139,92,246,0.2)' : 'rgba(139,92,246,0.15)'}`,
                  borderLeftWidth: 3,
                  fontSize: 12.5,
                  color: isDark ? '#cbd5e1' : '#334155',
                  lineHeight: 1.5,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 800, color: '#8b5cf6', textTransform: 'uppercase', marginBottom: 2 }}>
                  💡 AI Diagnostic Context
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
                      borderRadius: 8,
                      textTransform: 'uppercase',
                    }}
                  >
                    Metric 05
                  </span>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: isDark ? '#ffffff' : '#0f172a' }}>
                      Cognitive Stamina
                    </h3>
                    <div style={{ fontSize: 11.5, color: '#64748b' }}>Focus & Precision Across Duration</div>
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
                          borderRadius: 12,
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

              <div style={{ fontSize: 12.5, color: isDark ? '#cbd5e1' : '#334155' }}>
                Endurance Profile: <strong>{satoi?.stamina_label || 'Stable Focus'}</strong> • Late Exam Stability: <strong>Maintained</strong>
              </div>

              <div
                style={{
                  padding: '9px 14px',
                  borderRadius: 10,
                  backgroundColor: isDark ? 'rgba(6,182,212,0.08)' : 'rgba(6,182,212,0.04)',
                  borderLeft: '3px solid #06b6d4',
                  border: `1px solid ${isDark ? 'rgba(6,182,212,0.2)' : 'rgba(6,182,212,0.15)'}`,
                  borderLeftWidth: 3,
                  fontSize: 12.5,
                  color: isDark ? '#cbd5e1' : '#334155',
                  lineHeight: 1.5,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 800, color: '#06b6d4', textTransform: 'uppercase', marginBottom: 2 }}>
                  💡 AI Diagnostic Context
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
                      borderRadius: 8,
                      textTransform: 'uppercase',
                    }}
                  >
                    Metric 06
                  </span>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: isDark ? '#ffffff' : '#0f172a' }}>
                      Pacing & Speed Management
                    </h3>
                    <div style={{ fontSize: 11.5, color: '#64748b' }}>Time Allocation & Velocity per Question (Telemetry Calibrated)</div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ fontSize: 24, fontWeight: 900, color: '#ec4899' }}>
                    ~{pacing?.avg_time_per_question_sec ? Math.round(pacing.avg_time_per_question_sec) : 60}s <span style={{ fontSize: 13, color: '#64748b' }}>/ question</span>
                  </div>
                  {(() => {
                    const b = getBadgeStyle(pacing?.pacing_classification || pacing?.pacing_status || 'BALANCED_PACING');
                    return (
                      <span
                        style={{
                          fontSize: 11.5,
                          fontWeight: 700,
                          padding: '3px 10px',
                          borderRadius: 12,
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

              <div style={{ fontSize: 12.5, color: isDark ? '#cbd5e1' : '#334155' }}>
                Time Utilization: <strong>{pacing?.time_utilization_pct || 90}% of Duration</strong> • Benchmark Pace: <strong>60–72s / question</strong>
              </div>

              <div
                style={{
                  padding: '9px 14px',
                  borderRadius: 10,
                  backgroundColor: isDark ? 'rgba(236,72,153,0.08)' : 'rgba(236,72,153,0.04)',
                  borderLeft: '3px solid #ec4899',
                  border: `1px solid ${isDark ? 'rgba(236,72,153,0.2)' : 'rgba(236,72,153,0.15)'}`,
                  borderLeftWidth: 3,
                  fontSize: 12.5,
                  color: isDark ? '#cbd5e1' : '#334155',
                  lineHeight: 1.5,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 800, color: '#ec4899', textTransform: 'uppercase', marginBottom: 2 }}>
                  💡 AI Diagnostic Context
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
                            borderRadius: 8,
                            textTransform: 'uppercase',
                          }}
                        >
                          Metric 07
                        </span>
                        <div>
                          <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: isDark ? '#ffffff' : '#0f172a' }}>
                            Answer Changing Impact
                          </h3>
                          <div style={{ fontSize: 11.5, color: '#64748b' }}>Outcome & Marks Impact of Changing Options</div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ fontSize: 24, fontWeight: 900, color: netImpact >= 0 ? '#10b981' : '#ef4444' }}>
                          {netImpact >= 0 ? `+${netImpact}` : netImpact} Marks <span style={{ fontSize: 13, color: '#64748b' }}>Net Impact</span>
                        </div>
                        <span
                          style={{
                            fontSize: 11.5,
                            fontWeight: 700,
                            padding: '3px 10px',
                            borderRadius: 12,
                            backgroundColor: netImpact >= 0 ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.15)',
                            color: netImpact >= 0 ? '#10b981' : '#f43f5e',
                            border: `1px solid ${netImpact >= 0 ? 'rgba(16,185,129,0.3)' : 'rgba(244,63,94,0.3)'}`,
                          }}
                        >
                          {totalSwitches === 0 ? 'Zero Switches' : netImpact >= 0 ? 'Net Positive' : 'Switch Regret'}
                        </span>
                      </div>
                    </div>

                    <div style={{ fontSize: 12.5, color: isDark ? '#cbd5e1' : '#334155' }}>
                      Changed: <strong>{totalSwitches} questions</strong> (Right→Wrong: <strong style={{ color: '#ef4444' }}>{negSwitches}</strong>, Wrong→Right: <strong style={{ color: '#10b981' }}>{posSwitches}</strong>, Wrong→Wrong: <strong style={{ color: '#f59e0b' }}>{wrongToWrong}</strong>)
                    </div>

                    <div
                      style={{
                        padding: '9px 14px',
                        borderRadius: 10,
                        backgroundColor: isDark ? 'rgba(244,63,94,0.08)' : 'rgba(244,63,94,0.04)',
                        borderLeft: '3px solid #f43f5e',
                        border: `1px solid ${isDark ? 'rgba(244,63,94,0.2)' : 'rgba(244,63,94,0.15)'}`,
                        borderLeftWidth: 3,
                        fontSize: 12.5,
                        color: isDark ? '#cbd5e1' : '#334155',
                        lineHeight: 1.5,
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#f43f5e', textTransform: 'uppercase', marginBottom: 2 }}>
                        💡 AI Diagnostic Context
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
                            borderRadius: 8,
                            textTransform: 'uppercase',
                          }}
                        >
                          Metric 08
                        </span>
                        <div>
                          <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: isDark ? '#ffffff' : '#0f172a' }}>
                            Trap Resistance
                          </h3>
                          <div style={{ fontSize: 11.5, color: '#64748b' }}>Distractor & Extreme Keyword Avoidance (Closeness Score Evaluated)</div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ fontSize: 24, fontWeight: 900, color: '#a855f7' }}>
                          {trapResistancePct} <span style={{ fontSize: 13, color: '#64748b' }}>/ 100 Resistance</span>
                        </div>
                        <span
                          style={{
                            fontSize: 11.5,
                            fontWeight: 700,
                            padding: '3px 10px',
                            borderRadius: 12,
                            backgroundColor: 'rgba(168,85,247,0.15)',
                            color: '#a855f7',
                            border: '1px solid rgba(168,85,247,0.3)',
                          }}
                        >
                          {trapResistancePct >= 80 ? 'Trap Shield' : trapResistancePct >= 60 ? 'Moderate Shield' : 'Trap Vulnerable'}
                        </span>
                      </div>
                    </div>

                    <div style={{ fontSize: 12.5, color: isDark ? '#cbd5e1' : '#334155' }}>
                      Near-Miss Distractors: <strong>{nearMiss}</strong> • Statement Traps: <strong>{cogTraps} Detected</strong> • Traps Deflected: <strong>{totalQCount - totalTrapsFallen} / {totalQCount}</strong>
                    </div>

                    <div
                      style={{
                        padding: '9px 14px',
                        borderRadius: 10,
                        backgroundColor: isDark ? 'rgba(168,85,247,0.08)' : 'rgba(168,85,247,0.04)',
                        borderLeft: '3px solid #a855f7',
                        border: `1px solid ${isDark ? 'rgba(168,85,247,0.2)' : 'rgba(168,85,247,0.15)'}`,
                        borderLeftWidth: 3,
                        fontSize: 12.5,
                        color: isDark ? '#cbd5e1' : '#334155',
                        lineHeight: 1.5,
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#a855f7', textTransform: 'uppercase', marginBottom: 2 }}>
                        💡 AI Diagnostic Context
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
                      color: '#ef4444',
                      backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : '#fef2f2',
                      padding: '3px 8px',
                      borderRadius: 8,
                      textTransform: 'uppercase',
                    }}
                  >
                    Metric 09
                  </span>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: isDark ? '#ffffff' : '#0f172a' }}>
                      Priority Syllabus Focus
                    </h3>
                    <div style={{ fontSize: 11.5, color: '#64748b' }}>High-Yield Action Areas</div>
                  </div>
                </div>

                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: 12,
                    backgroundColor: 'rgba(239,68,68,0.15)',
                    color: '#ef4444',
                    border: '1px solid rgba(239,68,68,0.3)',
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
                    <div style={{ fontSize: 14, fontWeight: 800, color: weakSpotsList.length > 0 ? '#ef4444' : '#10b981' }}>
                      {urgentLabel}
                    </div>

                    <div
                      style={{
                        padding: '9px 14px',
                        borderRadius: 10,
                        backgroundColor: isDark ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.04)',
                        borderLeft: '3px solid #ef4444',
                        border: `1px solid ${isDark ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.15)'}`,
                        borderLeftWidth: 3,
                        fontSize: 12.5,
                        color: isDark ? '#cbd5e1' : '#334155',
                        lineHeight: 1.5,
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', marginBottom: 2 }}>
                        💡 AI Diagnostic Context
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
                  <h3 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 4px 0', color: isDark ? '#ffffff' : '#0f172a' }}>
                    ⚡ Pacing & Time Allocation Curve per Question
                  </h3>
                  <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
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
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'} />
                      <XAxis dataKey="qNum" tick={{ fontSize: 10, fill: '#64748b' }} interval={Math.max(0, Math.floor(questionsList.length / 10))} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} unit="s" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: isDark ? '#1e293b' : '#ffffff',
                          borderColor: isDark ? '#334155' : '#cbd5e1',
                          borderRadius: 12,
                          fontSize: 12,
                        }}
                        formatter={(val: any, name: any) => [`${val}s`, name === 'time_taken' ? 'Time Spent' : 'Target Pace']}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Area type="monotone" dataKey="time_taken" name="Time Spent (s)" stroke="#2563eb" fill="rgba(37,99,235,0.2)" strokeWidth={2} />
                      <Line type="monotone" dataKey="target_pace" name="Target Pace (60s)" stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Visualizer 2: Cognitive Stamina & Endurance Fatigue Curve (Quartiles) */}
              <div style={cardStyle}>
                <div style={{ marginBottom: 14 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 4px 0', color: isDark ? '#ffffff' : '#0f172a' }}>
                    🔋 Cognitive Stamina & Accuracy Across Test Quartiles
                  </h3>
                  <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
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
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'} />
                      <XAxis dataKey="quartile" tick={{ fontSize: 11, fill: '#64748b' }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} unit="%" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: isDark ? '#1e293b' : '#ffffff',
                          borderColor: isDark ? '#334155' : '#cbd5e1',
                          borderRadius: 12,
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

            {/* Personalized Actionable Revision Tasks (Interactive Recommendation Board with Study Plan Sync) */}
            {(() => {
              const rawTasksList = (
                (report as any)?.part_2_exam_macro_scorecard?.actionable_tasks ||
                (report as any)?.part_3_aggregated_user_report?.actionable_tasks ||
                (report as any)?.llm_insight?.study_plan_tasks ||
                (report as any)?.part_2_exam_macro_scorecard?.mentorship_insight?.study_plan_tasks ||
                []
              ).slice(0, 4);

              if (!rawTasksList || rawTasksList.length === 0) return null;

              const unaddedCount = rawTasksList.filter(
                (t: any) =>
                  !scheduledTaskTitles.has(t.title) &&
                  !scheduledTaskTitles.has(`[${t.subject || 'Core'}] ${t.title}`) &&
                  !addedTaskPlanSuccess[t.task_id || t.title]
              ).length;

              return (
                <div
                  style={{
                    ...cardStyle,
                    gridColumn: '1 / -1',
                    padding: 24,
                    border: '1px solid rgba(37,99,235,0.3)',
                    background: isDark
                      ? 'linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.95) 100%)'
                      : 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)',
                  }}
                >
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
                          borderRadius: 12,
                          backgroundColor: 'rgba(37,99,235,0.15)',
                          color: '#2563eb',
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
                              color: isDark ? '#ffffff' : '#0f172a',
                            }}
                          >
                            AI-Recommended Study Plan Tasks (4 Priorities)
                          </h3>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 12,
                              backgroundColor: 'rgba(37,99,235,0.1)',
                              color: '#2563eb',
                            }}
                          >
                            4 Action Steps
                          </span>
                        </div>
                        <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 2 }}>
                          Targeted study interventions generated from your test errors. Click to add or remove from your personal study planner.
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: isDark ? '#94a3b8' : '#64748b',
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
                            borderRadius: 10,
                            backgroundColor: '#2563eb',
                            color: '#ffffff',
                            border: 'none',
                            fontSize: 12.5,
                            fontWeight: 800,
                            cursor: isBulkAdding ? 'not-allowed' : 'pointer',
                            boxShadow: '0 2px 10px rgba(37,99,235,0.3)',
                            transition: 'all 0.2s ease',
                          }}
                        >
                          <Sparkles size={15} />
                          {isBulkAdding ? 'Scheduling All...' : `⚡ Add All (${unaddedCount}) to Study Plan`}
                        </button>
                      ) : (
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '6px 14px',
                            borderRadius: 10,
                            backgroundColor: 'rgba(16,185,129,0.15)',
                            color: '#10b981',
                            fontSize: 12,
                            fontWeight: 800,
                          }}
                        >
                          <CheckCircle2 size={16} /> All 4 Tasks Added
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
                        addedTaskPlanSuccess[taskId] === 'ADDED';
                      const isDone = !!completedTasks[taskId];
                      const loading = !!isAddingTask[taskId];
                      const priority = (t.priority || 'HIGH').toUpperCase();
                      const isCritical = priority === 'CRITICAL';
                      const isHigh = priority === 'HIGH';

                      return (
                        <div
                          key={taskId}
                          style={{
                            padding: 20,
                            borderRadius: 16,
                            backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff',
                            border: `1px solid ${
                              isAdded
                                ? 'rgba(16,185,129,0.35)'
                                : isCritical
                                ? 'rgba(239,68,68,0.3)'
                                : isDark
                                ? 'rgba(255,255,255,0.08)'
                                : '#e2e8f0'
                            }`,
                            boxShadow: isAdded
                              ? '0 2px 12px rgba(16,185,129,0.08)'
                              : '0 2px 8px rgba(0,0,0,0.03)',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            gap: 14,
                            transition: 'all 0.2s ease',
                          }}
                        >
                          <div>
                            {/* Badges Bar */}
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: 8,
                                marginBottom: 10,
                                flexWrap: 'wrap',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <span
                                  style={{
                                    fontSize: 10.5,
                                    fontWeight: 900,
                                    padding: '2px 7px',
                                    borderRadius: 6,
                                    backgroundColor: isDark ? 'rgba(37,99,235,0.15)' : '#eff6ff',
                                    color: '#2563eb',
                                    textTransform: 'uppercase',
                                  }}
                                >
                                  Task 0{idx + 1}
                                </span>

                                <span
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 800,
                                    padding: '2px 8px',
                                    borderRadius: 8,
                                    backgroundColor: isCritical
                                      ? 'rgba(239,68,68,0.15)'
                                      : isHigh
                                      ? 'rgba(245,158,11,0.15)'
                                      : 'rgba(37,99,235,0.15)',
                                    color: isCritical
                                      ? '#ef4444'
                                      : isHigh
                                      ? '#f59e0b'
                                      : '#2563eb',
                                  }}
                                >
                                  {priority} PRIORITY
                                </span>

                                <span
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 700,
                                    padding: '2px 8px',
                                    borderRadius: 8,
                                    backgroundColor: isDark
                                      ? 'rgba(255,255,255,0.06)'
                                      : 'rgba(0,0,0,0.05)',
                                    color: isDark ? '#cbd5e1' : '#475569',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 3,
                                  }}
                                >
                                  <Clock size={12} /> {t.allocated_time_minutes || 30} Mins
                                </span>

                                {t.activity_type && (
                                  <span
                                    style={{
                                      fontSize: 10.5,
                                      fontWeight: 700,
                                      padding: '2px 8px',
                                      borderRadius: 8,
                                      backgroundColor: 'rgba(139,92,246,0.12)',
                                      color: '#8b5cf6',
                                    }}
                                  >
                                    {t.activity_type.replace(/_/g, ' ')}
                                  </span>
                                )}
                              </div>

                              <span style={{ fontSize: 11, color: '#64748b' }}>
                                Due in {t.due_in_days || 2}d
                              </span>
                            </div>

                            {/* Task Title */}
                            <h4
                              style={{
                                fontSize: 15.5,
                                fontWeight: 800,
                                margin: '0 0 6px 0',
                                textDecoration: isDone ? 'line-through' : 'none',
                                color: isDark ? '#ffffff' : '#0f172a',
                                lineHeight: 1.35,
                              }}
                            >
                              {t.title}
                            </h4>

                            {/* Reasoning */}
                            {t.reasoning && (
                              <div
                                style={{
                                  fontSize: 12.5,
                                  color: isDark ? '#94a3b8' : '#64748b',
                                  marginBottom: 10,
                                  lineHeight: 1.45,
                                }}
                              >
                                {t.reasoning}
                              </div>
                            )}

                            {/* Action Checklist */}
                            {t.action_checklist && t.action_checklist.length > 0 && (
                              <div
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 6,
                                  borderTop: `1px solid ${
                                    isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9'
                                  }`,
                                  paddingTop: 10,
                                  marginTop: 6,
                                }}
                              >
                                <div
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 700,
                                    color: isDark ? '#64748b' : '#94a3b8',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px',
                                  }}
                                >
                                  Action Checklist:
                                </div>
                                {t.action_checklist.map((step: string, sIdx: number) => (
                                  <div
                                    key={sIdx}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'flex-start',
                                      gap: 6,
                                      fontSize: 12,
                                      color: isDark ? '#cbd5e1' : '#334155',
                                      lineHeight: 1.4,
                                    }}
                                  >
                                    <span
                                      style={{
                                        width: 5,
                                        height: 5,
                                        borderRadius: '50%',
                                        backgroundColor: '#2563eb',
                                        marginTop: 6,
                                        flexShrink: 0,
                                      }}
                                    />
                                    <span>{step}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Linked Questions */}
                            {t.linked_question_numbers && t.linked_question_numbers.length > 0 && (
                              <div
                                style={{
                                  marginTop: 10,
                                  fontSize: 11.5,
                                  color: '#64748b',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4,
                                }}
                              >
                                <span>Linked Exam Questions:</span>
                                <strong style={{ color: isDark ? '#cbd5e1' : '#1e293b' }}>
                                  Q{t.linked_question_numbers.join(', Q')}
                                </strong>
                              </div>
                            )}
                          </div>

                          {/* Action Footer */}
                          <div
                            style={{
                              borderTop: `1px solid ${
                                isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'
                              }`,
                              paddingTop: 12,
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            {isAdded ? (
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  fontSize: 12,
                                  fontWeight: 800,
                                  color: '#10b981',
                                }}
                              >
                                <CheckCircle2 size={16} /> Scheduled in Study Plan
                              </div>
                            ) : (
                              <button
                                disabled={loading}
                                onClick={() => handleScheduleSingleTask(t)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  padding: '7px 14px',
                                  borderRadius: 8,
                                  backgroundColor: isDark
                                    ? 'rgba(37,99,235,0.15)'
                                    : '#eff6ff',
                                  color: '#2563eb',
                                  border: '1px solid rgba(37,99,235,0.3)',
                                  fontSize: 12,
                                  fontWeight: 800,
                                  cursor: loading ? 'not-allowed' : 'pointer',
                                  transition: 'all 0.2s ease',
                                }}
                              >
                                <CalendarPlus size={14} />
                                {loading ? 'Adding...' : '+ Add to Study Plan'}
                              </button>
                            )}

                            <button
                              onClick={() => toggleTaskCompleted(taskId)}
                              style={{
                                padding: '4px 10px',
                                borderRadius: 6,
                                backgroundColor: isDone
                                  ? '#10b981'
                                  : isDark
                                  ? 'rgba(255,255,255,0.06)'
                                  : '#f1f5f9',
                                color: isDone ? '#ffffff' : isDark ? '#94a3b8' : '#64748b',
                                border: 'none',
                                fontSize: 11,
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

            {/* AI Cognitive Diagnostic Insights Section (Structured LLM Synthesis) */}
            <div
              style={{
                ...cardStyle,
                gridColumn: '1 / -1',
                background: isDark
                  ? 'linear-gradient(135deg, #131d36 0%, #0f172a 100%)'
                  : 'linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                padding: 24,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
                <div
                  style={{
                    padding: 10,
                    borderRadius: 12,
                    backgroundColor: 'rgba(59,130,246,0.2)',
                    color: '#3b82f6',
                  }}
                >
                  <Brain size={24} />
                </div>
                <div>
                  <h3
                    style={{
                      fontSize: 19,
                      fontWeight: 800,
                      margin: 0,
                      color: isDark ? '#ffffff' : '#0f172a',
                    }}
                  >
                    AI Cognitive Diagnostic Report
                  </h3>
                  <div style={{ fontSize: 12.5, color: isDark ? '#94a3b8' : '#64748b' }}>
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
                  {};

                const execSummary =
                  insightObj.executive_summary ||
                  'Candidate demonstrates strong foundational grasp across core subjects with disciplined pacing and strategic question selection.';
                const benchmarkVerdict =
                  insightObj.benchmark_verdict ||
                  'COMPETITIVE QUALIFYING ZONE: Performance clears the expected prelims threshold with solid conceptual accuracy.';
                const strengths: string[] =
                  insightObj.tactical_strengths ||
                  insightObj.strengths || [
                    'High accuracy on conceptual elimination questions.',
                    'Controlled guessing tendency on high-uncertainty items.',
                  ];
                const weaknesses: string[] =
                  insightObj.critical_vulnerabilities ||
                  insightObj.weaknesses || [
                    'Susceptibility to extreme qualifier statement traps.',
                    'Negative switch regret on revised answers in final section.',
                  ];
                const pacingDiag =
                  insightObj.pacing_and_unattempted_diagnosis ||
                  'Time allocation remained balanced with efficient velocity throughout the first two quartiles.';
                const distractorCritique =
                  insightObj.distractor_trap_critique ||
                  'Moderate vulnerability to high-closeness distractors featuring inverted factual clauses.';
                const closingAdvice =
                  insightObj.closing_mentorship_advice ||
                  insightObj.closing ||
                  'Focus on targeted topic drills for flagged weak syllabus areas while maintaining current pacing discipline.';

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Executive Summary & Benchmark Verdict Callout */}
                    <div
                      style={{
                        padding: 16,
                        borderRadius: 14,
                        backgroundColor: isDark
                          ? 'rgba(59,130,246,0.1)'
                          : 'rgba(59,130,246,0.08)',
                        border: '1px solid rgba(59,130,246,0.25)',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 800,
                          color: '#2563eb',
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
                          color: isDark ? '#ffffff' : '#0f172a',
                          marginBottom: 8,
                          lineHeight: 1.45,
                        }}
                      >
                        {benchmarkVerdict}
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          color: isDark ? '#cbd5e1' : '#334155',
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
                          borderRadius: 14,
                          backgroundColor: isDark ? 'rgba(16,185,129,0.1)' : '#f0fdf4',
                          border: '1px solid rgba(16,185,129,0.25)',
                        }}
                      >
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 800,
                            color: '#10b981',
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
                            color: isDark ? '#e2e8f0' : '#166534',
                            lineHeight: 1.55,
                          }}
                        >
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
                          borderRadius: 14,
                          backgroundColor: isDark ? 'rgba(239,68,68,0.1)' : '#fef2f2',
                          border: '1px solid rgba(239,68,68,0.25)',
                        }}
                      >
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 800,
                            color: '#ef4444',
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
                            color: isDark ? '#e2e8f0' : '#991b1b',
                            lineHeight: 1.55,
                          }}
                        >
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
                          borderRadius: 14,
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
                            color: isDark ? '#cbd5e1' : '#334155',
                            lineHeight: 1.55,
                          }}
                        >
                          {pacingDiag}
                        </div>
                      </div>

                      <div
                        style={{
                          padding: 16,
                          borderRadius: 14,
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
                            color: '#f59e0b',
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
                            color: isDark ? '#cbd5e1' : '#334155',
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
                          borderRadius: 12,
                          backgroundColor: isDark
                            ? 'rgba(255,255,255,0.03)'
                            : 'rgba(0,0,0,0.02)',
                          borderLeft: '4px solid #3b82f6',
                          fontSize: 12.5,
                          fontStyle: 'italic',
                          color: isDark ? '#93c5fd' : '#1e40af',
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
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          PLACE 2: USER LONGITUDINAL SKILL PROFILE (Tab 2)
      ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'user-aggregate' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Header Banner */}
          <div
            style={{
              padding: '16px 20px',
              borderRadius: 16,
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
              <TrendingUp size={22} color="#10b981" />
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
              borderRadius: 14,
              backgroundColor: isDark ? '#131f37' : '#ffffff',
              border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'}`,
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontSize: 12.5, fontWeight: 700, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
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
                    borderRadius: 20,
                    backgroundColor: isSelected
                      ? '#2563eb'
                      : isDark
                      ? 'rgba(255,255,255,0.05)'
                      : '#f1f5f9',
                    color: isSelected ? '#ffffff' : isDark ? '#cbd5e1' : '#475569',
                    border: `1px solid ${isSelected ? '#2563eb' : isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
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
                      borderRadius: 10,
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
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#2563eb' }}>Exam Preparedness (ICRS)</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: deltas.icrs_delta >= 0 ? '#10b981' : '#ef4444' }}>
                      {deltas.icrs_delta >= 0 ? `+${deltas.icrs_delta}` : `${deltas.icrs_delta}`} Δ
                    </span>
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 900, margin: '4px 0' }}>
                    {dispIcrs} / 100
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
                    Status: <strong>{dispIcrs >= 75 ? 'Qualifying Ready' : dispIcrs >= 55 ? 'Developing Competence' : 'Foundational Revision'}</strong>
                  </div>
                  <div style={{ width: '100%', height: 6, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, dispIcrs)}%`, height: '100%', backgroundColor: '#2563eb', borderRadius: 4 }} />
                  </div>
                </div>

                {/* Competency 2: Conceptual Mastery */}
                <div style={cardStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#10b981' }}>Concept Mastery (IRT Ability)</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: deltas.irt_theta_delta >= 0 ? '#10b981' : '#ef4444' }}>
                      {deltas.irt_theta_delta >= 0 ? `+${deltas.irt_theta_delta}` : `${deltas.irt_theta_delta}`} Δ
                    </span>
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 900, margin: '4px 0' }}>
                    {dispIrt >= 0 ? `+${Number(dispIrt).toFixed(2)} θ` : `${Number(dispIrt).toFixed(2)} θ`}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
                    Percentile: <strong>Top {Math.max(1, Math.round(100 - (50 + dispIrt * 22)))}% Competency</strong>
                  </div>
                  <div style={{ width: '100%', height: 6, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, Math.max(10, 50 + dispIrt * 22))}%`, height: '100%', backgroundColor: '#10b981', borderRadius: 4 }} />
                  </div>
                </div>

                {/* Competency 3: Guessing Discipline */}
                <div style={cardStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#f59e0b' }}>Guessing Control (GTI)</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: deltas.gti_delta <= 0 ? '#10b981' : '#ef4444' }}>
                      {deltas.gti_delta <= 0 ? `${(deltas.gti_delta * 100).toFixed(1)}% (Safer)` : `+${(deltas.gti_delta * 100).toFixed(1)}%`}
                    </span>
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 900, margin: '4px 0' }}>
                    {(Number(dispGti) * 100).toFixed(1)}% Impulse Rate
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
                    Classification: <strong>{dispGti <= 0.22 ? 'Controlled Calculated Risk' : 'Impulsive Guesswork'}</strong>
                  </div>
                  <div style={{ width: '100%', height: 6, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, Number(dispGti) * 100)}%`, height: '100%', backgroundColor: '#f59e0b', borderRadius: 4 }} />
                  </div>
                </div>

                {/* Competency 4: Elimination Precision */}
                <div style={cardStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#8b5cf6' }}>Elimination Precision (OEEI)</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: deltas.oeei_delta >= 0 ? '#10b981' : '#ef4444' }}>
                      {deltas.oeei_delta >= 0 ? `+${(deltas.oeei_delta * 100).toFixed(1)}%` : `${(deltas.oeei_delta * 100).toFixed(1)}%`}
                    </span>
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 900, margin: '4px 0' }}>
                    {(Number(dispOeei) * 100).toFixed(1)}% Conversion
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
                    Efficiency: <strong>{dispOeei >= 0.70 ? 'High Analytical Conversion' : 'Moderate Pruning'}</strong>
                  </div>
                  <div style={{ width: '100%', height: 6, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, Number(dispOeei) * 100)}%`, height: '100%', backgroundColor: '#8b5cf6', borderRadius: 4 }} />
                  </div>
                </div>

                {/* Competency 5: Stamina & Velocity */}
                <div style={cardStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#06b6d4' }}>Exam Stamina (SATOI)</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: deltas.satoi_delta >= 0 ? '#10b981' : '#ef4444' }}>
                      {deltas.satoi_delta >= 0 ? `+${deltas.satoi_delta}` : `${deltas.satoi_delta}`} Δ
                    </span>
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 900, margin: '4px 0' }}>
                    {dispSatoi} / 100 Balance
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
                    Fatigue Risk: <strong>{dispSatoi >= 80 ? 'Optimal Cognitive Stamina' : 'Moderate Fatigue Dropoff'}</strong>
                  </div>
                  <div style={{ width: '100%', height: 6, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, dispSatoi)}%`, height: '100%', backgroundColor: '#06b6d4', borderRadius: 4 }} />
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
                <div style={{ fontSize: 12, color: '#64748b' }}>Full-Length Mock Tests Completed</div>
                <div style={{ fontSize: 24, fontWeight: 800 }}>{timelineData.length || userProfile.total_tests_given || 1} Tests</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#64748b' }}>Total Item Responses Analyzed</div>
                <div style={{ fontSize: 24, fontWeight: 800 }}>
                  {userProfile.total_questions_answered ||
                    questionsList.filter((q) => getQuestionState(q).isAtt).length ||
                    14}{' '}
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#64748b' }}>
                    Attempted / {questionsList.length || 100} Total
                  </span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#64748b' }}>Longitudinal Competency Band</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#10b981' }}>
                  {userProfile.cumulative_icrs_score >= 80
                    ? 'Prelims Ready Benchmark'
                    : userProfile.cumulative_icrs_score >= 65
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
                    <h3 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 4px 0', color: isDark ? '#ffffff' : '#0f172a' }}>
                      📈 Score & Accuracy Progression Across Exams
                    </h3>
                    <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
                      Tracks your net score and precision percentage across each evaluated exam session.
                    </p>
                  </div>
                  <div style={{ height: 260, width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={timelineData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'} />
                        <XAxis dataKey="exam_name" tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v: string) => v.length > 14 ? `${v.slice(0, 12)}...` : v} />
                        <YAxis domain={[0, 'auto']} tick={{ fontSize: 11, fill: '#64748b' }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: isDark ? '#1e293b' : '#ffffff',
                            borderColor: isDark ? '#334155' : '#cbd5e1',
                            borderRadius: 12,
                            fontSize: 12,
                          }}
                          formatter={(value: any, name: any) => [name === 'total_score' ? `${value} Marks` : `${value}%`, name === 'total_score' ? 'Total Score' : 'Accuracy %']}
                        />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="total_score" name="Total Score" fill="#2563eb" radius={[6, 6, 0, 0]} />
                        <Line type="monotone" dataKey="accuracy_percentage" name="Accuracy %" stroke="#10b981" strokeWidth={3} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Chart 2: Cognitive Readiness (ICRS) & Latent Ability Progression */}
                <div style={cardStyle}>
                  <div style={{ marginBottom: 14 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 4px 0', color: isDark ? '#ffffff' : '#0f172a' }}>
                      🧠 Integrated Cognitive Readiness (ICRS) Evolution
                    </h3>
                    <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
                      Longitudinal readiness metric combining IRT ability, elimination discipline, and pacing.
                    </p>
                  </div>
                  <div style={{ height: 260, width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={timelineData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'} />
                        <XAxis dataKey="exam_name" tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v: string) => v.length > 14 ? `${v.slice(0, 12)}...` : v} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} unit="/100" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: isDark ? '#1e293b' : '#ffffff',
                            borderColor: isDark ? '#334155' : '#cbd5e1',
                            borderRadius: 12,
                            fontSize: 12,
                          }}
                          formatter={(value: any, name: any) => [`${value} / 100`, name === 'icrs_score' ? 'ICRS Score' : name]}
                        />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Line type="monotone" dataKey="icrs_score" name="ICRS Readiness" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 5 }} />
                        <Line type="monotone" dataKey="satoi_score" name="SATOI Stamina" stroke="#06b6d4" strokeWidth={2} strokeDasharray="4 4" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Chart 3: Tactical Elimination (OEEI) vs Guessing Risk (GTI) */}
                <div style={cardStyle}>
                  <div style={{ marginBottom: 14 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 4px 0', color: isDark ? '#ffffff' : '#0f172a' }}>
                      🎯 Tactical Elimination (OEEI) vs Guessing Impulse (GTI)
                    </h3>
                    <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
                      Higher elimination conversion (OEEI) and lower impulse guesswork (GTI) signify elite exam temperament.
                    </p>
                  </div>
                  <div style={{ height: 260, width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={timelineData.map((i: any) => ({ ...i, gti_pct: Math.round(i.gti_score * 100), oeei_pct: Math.round(i.oeei_score * 100) }))} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'} />
                        <XAxis dataKey="exam_name" tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v: string) => v.length > 14 ? `${v.slice(0, 12)}...` : v} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} unit="%" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: isDark ? '#1e293b' : '#ffffff',
                            borderColor: isDark ? '#334155' : '#cbd5e1',
                            borderRadius: 12,
                            fontSize: 12,
                          }}
                          formatter={(value: any, name: any) => [`${value}%`, name === 'oeei_pct' ? 'Elimination Efficiency' : 'Guessing Impulse']}
                        />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="oeei_pct" name="Elimination Precision (OEEI %)" fill="#10b981" radius={[6, 6, 0, 0]} />
                        <Bar dataKey="gti_pct" name="Guessing Risk (GTI %)" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Chart 4: Latent Knowledge Ability (IRT 3PL Theta) */}
                <div style={cardStyle}>
                  <div style={{ marginBottom: 14 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 4px 0', color: isDark ? '#ffffff' : '#0f172a' }}>
                      ⚡ IRT Latent Ability (θ) Curve Progression
                    </h3>
                    <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
                      Item Response Theory latent skill calibrated across item discrimination (a), difficulty (b), and guessing floor (c).
                    </p>
                  </div>
                  <div style={{ height: 260, width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'} />
                        <XAxis dataKey="exam_name" tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v: string) => v.length > 14 ? `${v.slice(0, 12)}...` : v} />
                        <YAxis tick={{ fontSize: 11, fill: '#64748b' }} domain={[-1, 3]} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: isDark ? '#1e293b' : '#ffffff',
                            borderColor: isDark ? '#334155' : '#cbd5e1',
                            borderRadius: 12,
                            fontSize: 12,
                          }}
                          formatter={(value: any) => [`+${Number(value).toFixed(2)} θ`, 'Latent Ability']}
                        />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Area type="monotone" dataKey="irt_theta" name="IRT Ability (θ)" stroke="#2563eb" fill="rgba(37,99,235,0.2)" strokeWidth={3} dot={{ r: 5 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Side-by-Side Exam Comparison Matrix Table */}
              <div style={cardStyle}>
                <h3 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Award size={20} color="#2563eb" /> Longitudinal Cross-Exam Comparison Matrix
                </h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: `2px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`, textAlign: 'left' }}>
                        <th style={{ padding: '10px 12px', color: '#64748b' }}>#</th>
                        <th style={{ padding: '10px 12px', color: '#64748b' }}>Exam Paper</th>
                        <th style={{ padding: '10px 12px', color: '#64748b' }}>Date</th>
                        <th style={{ padding: '10px 12px', color: '#64748b' }}>Score</th>
                        <th style={{ padding: '10px 12px', color: '#64748b' }}>Accuracy</th>
                        <th style={{ padding: '10px 12px', color: '#64748b' }}>ICRS</th>
                        <th style={{ padding: '10px 12px', color: '#64748b' }}>IRT θ</th>
                        <th style={{ padding: '10px 12px', color: '#64748b' }}>GTI (Impulse)</th>
                        <th style={{ padding: '10px 12px', color: '#64748b' }}>OEEI (Elimination)</th>
                        <th style={{ padding: '10px 12px', color: '#64748b' }}>SATOI (Stamina)</th>
                        <th style={{ padding: '10px 12px', color: '#64748b' }}>Pacing</th>
                      </tr>
                    </thead>
                    <tbody>
                      {timelineData.map((item: any, idx: number) => (
                        <tr
                          key={item.attempt_id || idx}
                          style={{
                            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9'}`,
                            backgroundColor: idx % 2 === 0 ? 'transparent' : isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                          }}
                        >
                          <td style={{ padding: '10px 12px', fontWeight: 800, color: '#2563eb' }}>{item.attempt_number || idx + 1}</td>
                          <td style={{ padding: '10px 12px', fontWeight: 700 }}>{item.exam_name}</td>
                          <td style={{ padding: '10px 12px', color: '#64748b' }}>{item.date_formatted || item.date}</td>
                          <td style={{ padding: '10px 12px', fontWeight: 800 }}>
                            {item.total_score} <span style={{ fontSize: 11, color: '#64748b' }}>/ {item.max_possible_score}</span>
                          </td>
                          <td style={{ padding: '10px 12px', fontWeight: 700, color: item.accuracy_percentage >= 65 ? '#10b981' : item.accuracy_percentage >= 50 ? '#f59e0b' : '#ef4444' }}>
                            {item.accuracy_percentage}%
                          </td>
                          <td style={{ padding: '10px 12px', fontWeight: 800, color: '#8b5cf6' }}>{item.icrs_score}/100</td>
                          <td style={{ padding: '10px 12px', fontWeight: 700, color: '#2563eb' }}>+{Number(item.irt_theta).toFixed(2)} θ</td>
                          <td style={{ padding: '10px 12px', color: item.gti_score <= 0.22 ? '#10b981' : '#f59e0b' }}>{(item.gti_score * 100).toFixed(1)}%</td>
                          <td style={{ padding: '10px 12px', color: item.oeei_score >= 0.70 ? '#10b981' : '#8b5cf6' }}>{(item.oeei_score * 100).toFixed(1)}%</td>
                          <td style={{ padding: '10px 12px', color: '#06b6d4' }}>{item.satoi_score}/100</td>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 10, backgroundColor: 'rgba(37,99,235,0.1)', color: '#2563eb' }}>
                              {item.pacing_status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          TAB 3: PER-QUESTION DEEP ANALYSIS & SOLUTIONS
      ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'questions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Question Filter Bar */}
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
                  onClick={() => setQuestionFilter(f.id as any)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 10,
                    border:
                      questionFilter === f.id
                        ? '1px solid #2563eb'
                        : `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
                    backgroundColor:
                      questionFilter === f.id
                        ? '#2563eb'
                        : isDark
                        ? 'rgba(255,255,255,0.04)'
                        : '#ffffff',
                    color: questionFilter === f.id ? '#ffffff' : isDark ? '#cbd5e1' : '#475569',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Questions Detailed Accordion List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {filteredQuestions.map((q, idx) => {
              const qId = q.question_id || q.question_number || idx;
              const isExpanded = expandedQuestionId === qId;
              const state = getQuestionState(q);
              const qNum = q.question_number || idx + 1;
              const expl = q.explanation || null;

              // Chosen and correct option labels
              const userOptLabel = q.user_selected_option || q.user_selected_label || 'Unattempted';
              const correctOptLabel = q.correct_option || q.correct_option_label || 'A';

              const cardBorderColor = state.isCorr
                ? '#10b981'
                : state.isInc
                ? '#ef4444'
                : '#94a3b8';

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
                          color: '#2563eb',
                          backgroundColor: isDark ? 'rgba(37,99,235,0.15)' : '#eff6ff',
                          padding: '4px 10px',
                          borderRadius: 8,
                        }}
                      >
                        Q{qNum}
                      </span>

                      <div>
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: isDark ? '#ffffff' : '#0f172a',
                          }}
                        >
                          {q.topic || q.topic_name || q.meaningful_name || `Question #${qNum}`}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>
                          Time Spent: {q.time_taken_seconds || 60}s • Bloom's Level:{' '}
                          {q.blooms_taxonomy_level || q.blooms_level || 'ANALYZE'}
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
                          borderRadius: 14,
                          backgroundColor: state.isCorr
                            ? 'rgba(16,185,129,0.15)'
                            : state.isInc
                            ? 'rgba(239,68,68,0.15)'
                            : 'rgba(148,163,184,0.15)',
                          color: state.isCorr
                            ? '#10b981'
                            : state.isInc
                            ? '#ef4444'
                            : '#94a3b8',
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
                        <ChevronUp size={18} color="#64748b" />
                      ) : (
                        <ChevronDown size={18} color="#64748b" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Solution & Option Feedback */}
                  {isExpanded && (
                    <div
                      style={{
                        marginTop: 20,
                        paddingTop: 16,
                        borderTop: `1px solid ${
                          isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'
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
                          borderRadius: 12,
                          backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
                          border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0'}`,
                        }}
                      >
                        {/* 1. Time Score & Pacing */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>⏱️ Time Score & Pacing</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            {(() => {
                              const pBadge = q.pacing_efficiency || q.time_window || 'OPTIMAL';
                              const b = getBadgeStyle(pBadge);
                              const speedIdx = q.time_efficiency_score || Math.round(((q.expected_time_seconds || 60) / Math.max(1, q.time_taken_seconds || 60)) * 100);
                              return (
                                <>
                                  <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 800, backgroundColor: b.bg, color: b.color, border: `1px solid ${b.border}` }}>
                                    {q.pacing_efficiency || b.label}
                                  </span>
                                  <span style={{ fontSize: 11.5, fontWeight: 700, color: isDark ? '#cbd5e1' : '#334155' }}>
                                    {q.time_taken_seconds || 60}s / {q.expected_time_seconds || 60}s ({speedIdx}% Speed)
                                  </span>
                                </>
                              );
                            })()}
                          </div>
                        </div>

                        {/* 2. FSRS Topic Retention & Memory */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>🧠 FSRS Concept Memory</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 800, backgroundColor: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.35)' }}>
                              {q.fsrs_retention_pct || 75}% Retention
                            </span>
                            <span style={{ fontSize: 11.5, fontWeight: 600, color: '#64748b' }}>
                              Stability: <strong>{q.fsrs_stability_days ? `${q.fsrs_stability_days} Days` : '3.0 Days'}</strong>
                            </span>
                          </div>
                        </div>

                        {/* 3. OSRI (Answer Revision Safety) */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>🔄 OSRI Answer Revision</span>
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
                                    borderRadius: 8,
                                    fontSize: 11,
                                    fontWeight: 800,
                                    backgroundColor: isPositive
                                      ? 'rgba(16,185,129,0.15)'
                                      : isNegative
                                      ? 'rgba(239,68,68,0.15)'
                                      : isDark
                                      ? 'rgba(255,255,255,0.06)'
                                      : '#e2e8f0',
                                    color: isPositive ? '#10b981' : isNegative ? '#ef4444' : '#64748b',
                                    border: isPositive
                                      ? '1px solid rgba(16,185,129,0.35)'
                                      : isNegative
                                      ? '1px solid rgba(239,68,68,0.35)'
                                      : '1px solid transparent',
                                  }}
                                >
                                  {osriStatus}
                                </span>
                              );
                            })()}
                          </div>
                        </div>

                        {/* 4. Cognitive Thinking Level (Bloom's) */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>💡 Cognitive Thinking Level</span>
                          <div>
                            <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 800, backgroundColor: 'rgba(99,102,241,0.15)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.35)' }}>
                              {q.cognitive_thinking_level || q.blooms_taxonomy_level || q.blooms_level || 'Deep Analytical Thinking'}
                            </span>
                          </div>
                        </div>

                        {/* 5. Distractor Trap Classification */}
                        {q.distractor_classification || q.closeness_classification ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>🎯 Distractor Trap Analysis</span>
                            <div>
                              {(() => {
                                const dClass = q.distractor_classification || q.closeness_classification;
                                const b = getBadgeStyle(dClass.includes('Near') || dClass.includes('High') ? 'VULNERABLE' : 'COMPETENT');
                                return (
                                  <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 800, backgroundColor: b.bg, color: b.color, border: `1px solid ${b.border}` }}>
                                    {dClass}
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
                            color: isDark ? '#ffffff' : '#0f172a',
                            backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
                            padding: 16,
                            borderRadius: 12,
                            border: `1px solid ${
                              isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0'
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
                              color: '#64748b',
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

                            let optBorder = isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0';
                            let optBg = isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc';
                            if (isSelected && isOptCorrect) {
                              optBorder = '#10b981';
                              optBg = isDark ? 'rgba(16,185,129,0.12)' : '#ecfdf5';
                            } else if (isSelected && !isOptCorrect) {
                              optBorder = '#ef4444';
                              optBg = isDark ? 'rgba(239,68,68,0.12)' : '#fef2f2';
                            } else if (isOptCorrect) {
                              optBorder = '#10b981';
                              optBg = isDark ? 'rgba(16,185,129,0.08)' : '#f0fdf4';
                            }

                            return (
                              <div
                                key={opt.option_id || optIdx}
                                style={{
                                  padding: '12px 16px',
                                  borderRadius: 10,
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
                                          ? '#10b981'
                                          : isSelected
                                          ? '#ef4444'
                                          : '#64748b',
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
                                          borderRadius: 8,
                                          backgroundColor: isOptCorrect ? '#10b981' : '#ef4444',
                                          color: '#ffffff',
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
                                          borderRadius: 8,
                                          backgroundColor: '#10b981',
                                          color: '#ffffff',
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
                                        ? (isDark ? '#fca5a5' : '#991b1b')
                                        : '#64748b',
                                      borderLeft: `2px solid ${isOptCorrect ? '#10b981' : isSelected ? '#ef4444' : (isDark ? '#475569' : '#cbd5e1')}`,
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
                              borderRadius: 12,
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

                            <div style={{ color: isDark ? '#e2e8f0' : '#451a03', display: 'flex', flexDirection: 'column', gap: 8 }}>
                              <div>
                                <strong>Trap / Choice Classification:</strong>{' '}
                                <span style={{ color: '#d97706', fontWeight: 600 }}>
                                  {q.closeness_classification || 'Standard Conceptual Distractor'}
                                </span>
                              </div>

                              {state.isUnatt ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                                  <div style={{ fontSize: 12.5, color: isDark ? '#cbd5e1' : '#78350f' }}>
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
                                          borderRadius: 8,
                                          backgroundColor: isCorrectOpt
                                            ? (isDark ? 'rgba(16,185,129,0.1)' : '#f0fdf4')
                                            : (isDark ? 'rgba(255,255,255,0.03)' : '#fef2f2'),
                                          border: `1px solid ${isCorrectOpt ? '#10b981' : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(239,68,68,0.2)')}`,
                                        }}
                                      >
                                        <div style={{ fontWeight: 700, fontSize: 12.5, color: isCorrectOpt ? '#10b981' : '#ef4444', marginBottom: 2 }}>
                                          Option {optLabel}: {isCorrectOpt ? '🟢 Correct Answer' : '🔴 Incorrect Distractor Trap'}
                                        </div>
                                        <div style={{ fontSize: 12, color: isDark ? '#cbd5e1' : '#475569' }}>
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
                          {/* Core Concept */}
                          {expl.core_concept && (
                            <div
                              style={{
                                padding: 14,
                                borderRadius: 12,
                                backgroundColor: isDark
                                  ? 'rgba(37,99,235,0.08)'
                                  : '#eff6ff',
                                border: '1px solid rgba(37,99,235,0.2)',
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 12,
                                  fontWeight: 800,
                                  color: '#2563eb',
                                  textTransform: 'uppercase',
                                  marginBottom: 4,
                                }}
                              >
                                💡 Core Concept Behind Question
                              </div>
                              <div
                                style={{
                                  fontSize: 13.5,
                                  color: isDark ? '#e2e8f0' : '#1e3a8a',
                                  lineHeight: 1.5,
                                }}
                              >
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                  {expl.core_concept}
                                </ReactMarkdown>
                              </div>
                            </div>
                          )}

                          {/* Step-by-Step Detailed Solution */}
                          {expl.detailed_solution && (
                            <div
                              style={{
                                padding: 14,
                                borderRadius: 12,
                                backgroundColor: isDark
                                  ? 'rgba(255,255,255,0.03)'
                                  : '#f8fafc',
                                border: `1px solid ${
                                  isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'
                                }`,
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 12,
                                  fontWeight: 800,
                                  color: '#64748b',
                                  textTransform: 'uppercase',
                                  marginBottom: 6,
                                }}
                              >
                                📝 Step-by-Step Authoritative Solution
                              </div>
                              <div
                                style={{
                                  fontSize: 13.5,
                                  color: isDark ? '#e2e8f0' : '#334155',
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
                                borderRadius: 12,
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
                                  color: isDark ? '#e2e8f0' : '#78350f',
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

                          {/* Key Takeaways / Points to Remember */}
                          {expl.key_takeaways && (
                            <div
                              style={{
                                padding: 14,
                                borderRadius: 12,
                                background: isDark
                                  ? 'linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(6,182,212,0.12) 100%)'
                                  : 'linear-gradient(135deg, #ecfdf5 0%, #eff6ff 100%)',
                                border: '1px solid rgba(16, 185, 129, 0.3)',
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 12,
                                  fontWeight: 800,
                                  color: '#10b981',
                                  textTransform: 'uppercase',
                                  marginBottom: 6,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                }}
                              >
                                <Check size={16} /> Key Takeaways & Points to Remember
                              </div>
                              <div
                                style={{
                                  fontSize: 13,
                                  color: isDark ? '#e2e8f0' : '#065f46',
                                  lineHeight: 1.5,
                                }}
                              >
                                {Array.isArray(expl.key_takeaways) ? (
                                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                                    {expl.key_takeaways.map((item: string, kIdx: number) => (
                                      <li key={kIdx} style={{ margin: '3px 0' }}>
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                          {item}
                                        </ReactMarkdown>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {String(expl.key_takeaways)}
                                  </ReactMarkdown>
                                )}
                              </div>
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
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  Multi-level breakdown across Subjects, Topics, and Subtopics with Pacing Velocity, Strong/Weak Zones, Bloom Thinking Levels, and Memory Retention.
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  onClick={expandAllHierarchy}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 8,
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : '#cbd5e1'}`,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f8fafc',
                    color: isDark ? '#e2e8f0' : '#334155',
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
                    borderRadius: 8,
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : '#cbd5e1'}`,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f8fafc',
                    color: isDark ? '#e2e8f0' : '#334155',
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
                borderRadius: 12,
                backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0'}`,
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
                <span style={{ fontWeight: 700, color: '#64748b' }}>Mastery Zones:</span>
                <span style={{ color: '#10b981', fontWeight: 700 }}>🟢 Mastered (≥85%)</span>
                <span style={{ color: '#3b82f6', fontWeight: 700 }}>🔵 Strong (70–84%)</span>
                <span style={{ color: '#f59e0b', fontWeight: 700 }}>🟡 Competent (50–69%)</span>
                <span style={{ color: '#f97316', fontWeight: 700 }}>🟠 Needs Practice (30–49%)</span>
                <span style={{ color: '#ef4444', fontWeight: 700 }}>🔴 Critical Gap (&lt;30%)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontWeight: 700, color: '#64748b' }}>Pacing:</span>
                <span style={{ color: '#10b981', fontWeight: 700 }}>⚡ Optimal (0.7x–1.35x)</span>
                <span style={{ color: '#ef4444', fontWeight: 700 }}>⏳ Bottleneck (&gt;1.35x)</span>
                <span style={{ color: '#8b5cf6', fontWeight: 700 }}>💨 Rapid (&lt;0.7x)</span>
              </div>
            </div>

            {/* Cumulative Cognitive Category Mastery Board (Bloom Thinking Levels) */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Brain size={18} color="#2563eb" />
                <h4 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: isDark ? '#ffffff' : '#0f172a' }}>
                  Cumulative Category Mastery (All Cognitive Thinking Types)
                </h4>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                {(() => {
                  const bloomKeys: { [key: string]: { label: string; icon: string; color: string } } = {
                    REMEMBER: { label: 'Recall / Memory', icon: '🧠', color: '#3b82f6' },
                    UNDERSTAND: { label: 'Understanding', icon: '💡', color: '#10b981' },
                    APPLY: { label: 'Application', icon: '⚙️', color: '#8b5cf6' },
                    ANALYZE: { label: 'Analysis', icon: '🔍', color: '#f59e0b' },
                    EVALUATE: { label: 'Evaluation', icon: '⚖️', color: '#ec4899' },
                    CREATE: { label: 'Synthesis', icon: '🚀', color: '#06b6d4' },
                  };

                  const statsMap: { [key: string]: { total: number; correct: number } } = {};
                  Object.keys(bloomKeys).forEach((k) => {
                    statsMap[k] = { total: 0, correct: 0 };
                  });

                  if (questionsList && questionsList.length > 0) {
                    questionsList.forEach((q) => {
                      const raw = (q.bloom_level || q.blooms_level || q.bloom_category || 'UNDERSTAND').toUpperCase();
                      const matchKey = Object.keys(bloomKeys).find((k) => raw.includes(k)) || 'UNDERSTAND';
                      statsMap[matchKey].total += 1;
                      if (getQuestionState(q).isCorr) {
                        statsMap[matchKey].correct += 1;
                      }
                    });
                  } else {
                    const bObj = (report as any)?.part_2_exam_macro_scorecard?.thinking_cognitive_levels || (report as any)?.blooms_mastery || {};
                    Object.keys(bloomKeys).forEach((k) => {
                      const acc = Number(bObj[k] ?? bObj[k.toLowerCase()] ?? 70);
                      statsMap[k] = { total: 10, correct: Math.round(acc / 10) };
                    });
                  }

                  return Object.entries(bloomKeys).map(([k, meta]) => {
                    const s = statsMap[k];
                    const acc = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
                    return (
                      <div
                        key={k}
                        style={{
                          padding: '12px 14px',
                          borderRadius: 12,
                          backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff',
                          border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
                          borderLeft: `4px solid ${meta.color}`,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: isDark ? '#e2e8f0' : '#334155' }}>
                            {meta.icon} {meta.label}
                          </span>
                          <span style={{ fontSize: 13, fontWeight: 900, color: meta.color }}>
                            {acc}%
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b' }}>
                          <span>{s.correct}/{s.total} Correct</span>
                          <span>{acc >= 75 ? 'Mastered' : acc >= 50 ? 'Competent' : 'Focus Area'}</span>
                        </div>
                        <div style={{ width: '100%', height: 4, borderRadius: 2, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0', overflow: 'hidden' }}>
                          <div style={{ width: `${acc}%`, height: '100%', backgroundColor: meta.color, borderRadius: 2 }} />
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Cumulative Subject Mastery Overview Scoreboard */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Layers size={18} color="#10b981" />
                <h4 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: isDark ? '#ffffff' : '#0f172a' }}>
                  Subject-Wise Performance & Marks Scoreboard
                </h4>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                {hierarchyData.map((subj: any) => {
                  const bStyle = getBadgeStyle(subj.status);
                  const netMarks = Math.round((subj.correct * 2.0 - (subj.attempted - subj.correct) * 0.66) * 100) / 100;
                  return (
                    <div
                      key={`card_${subj.name}`}
                      style={{
                        padding: '14px 16px',
                        borderRadius: 12,
                        backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff',
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
                        borderLeft: `4px solid ${subj.accuracy >= 70 ? '#10b981' : subj.accuracy >= 50 ? '#f59e0b' : '#ef4444'}`,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: isDark ? '#ffffff' : '#0f172a' }}>
                            {subj.name}
                          </div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>
                            {subj.topics?.length || 0} Topics • {subj.total} Questions
                          </div>
                        </div>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 8,
                            backgroundColor: bStyle.bg,
                            color: bStyle.color,
                            border: `1px solid ${bStyle.border}`,
                          }}
                        >
                          {subj.accuracy}% Acc
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: isDark ? '#cbd5e1' : '#334155' }}>
                        <span>Correct: <strong>{subj.correct}/{subj.attempted}</strong></span>
                        <span>Net Score: <strong style={{ color: netMarks >= 0 ? '#10b981' : '#ef4444' }}>{netMarks >= 0 ? `+${netMarks}` : netMarks} Marks</strong></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Hierarchical Tree Container */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {hierarchyData.map((subj: any) => {
                const isSubjExpanded = !!expandedHierarchyNodes[`subj_${subj.name}`];
                const bSubj = getBadgeStyle(subj.status);

                return (
                  <div
                    key={subj.name}
                    style={{
                      borderRadius: 14,
                      border: `1px solid ${
                        isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'
                      }`,
                      backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#ffffff',
                      overflow: 'hidden',
                    }}
                  >
                    {/* LEVEL 1: SUBJECT HEADER */}
                    <div
                      onClick={() => toggleHierarchyNode(`subj_${subj.name}`)}
                      style={{
                        padding: '14px 18px',
                        backgroundColor: isDark
                          ? 'rgba(37,99,235,0.08)'
                          : 'rgba(37,99,235,0.04)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        userSelect: 'none',
                        flexWrap: 'wrap',
                        gap: 12,
                        borderBottom: isSubjExpanded
                          ? `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`
                          : 'none',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {isSubjExpanded ? (
                          <ChevronDown size={18} color="#2563eb" />
                        ) : (
                          <ChevronRight size={18} color="#2563eb" />
                        )}
                        {isSubjExpanded ? (
                          <FolderOpen size={20} color="#2563eb" />
                        ) : (
                          <Folder size={20} color="#2563eb" />
                        )}
                        <div>
                          <span
                            style={{
                              fontSize: 15,
                              fontWeight: 800,
                              color: isDark ? '#ffffff' : '#0f172a',
                            }}
                          >
                            {subj.name}
                          </span>
                          <span
                            style={{
                              fontSize: 11.5,
                              color: '#64748b',
                              marginLeft: 8,
                            }}
                          >
                            ({subj.topics?.length || 0} topics • {subj.total} questions)
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                        {/* Question stats */}
                        <div style={{ fontSize: 12.5, color: '#64748b' }}>
                          <strong style={{ color: isDark ? '#ffffff' : '#0f172a' }}>
                            {subj.correct}
                          </strong>{' '}
                          / {subj.attempted} Correct
                        </div>

                        {/* Accuracy */}
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 900,
                            color:
                              subj.accuracy >= 85
                                ? '#10b981'
                                : subj.accuracy >= 70
                                ? '#3b82f6'
                                : subj.accuracy >= 50
                                ? '#f59e0b'
                                : '#ef4444',
                            minWidth: 48,
                            textAlign: 'right',
                          }}
                        >
                          {subj.accuracy}%
                        </div>

                        {/* Pacing Badge */}
                        <span
                          style={{
                            fontSize: 11,
                            padding: '3px 8px',
                            borderRadius: 8,
                            backgroundColor:
                              subj.pacing_status === 'OPTIMAL'
                                ? 'rgba(16,185,129,0.12)'
                                : subj.pacing_status === 'BOTTLENECK'
                                ? 'rgba(239,68,68,0.12)'
                                : 'rgba(139,92,246,0.12)',
                            color:
                              subj.pacing_status === 'OPTIMAL'
                                ? '#10b981'
                                : subj.pacing_status === 'BOTTLENECK'
                                ? '#ef4444'
                                : '#8b5cf6',
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {subj.pacing_label || '⚡ Optimal'} (~{subj.avg_time}s/q)
                        </span>

                        {/* Retention Badge */}
                        <span
                          style={{
                            fontSize: 11,
                            padding: '3px 8px',
                            borderRadius: 8,
                            backgroundColor: 'rgba(20,184,166,0.12)',
                            color: '#0d9488',
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          🧠 {subj.retention_pct}% Memory ({subj.stability_days}d stab)
                        </span>

                        {/* Strength Badge */}
                        <span
                          style={{
                            fontSize: 11,
                            padding: '3px 10px',
                            borderRadius: 12,
                            backgroundColor: bSubj.bg,
                            color: bSubj.color,
                            border: `1px solid ${bSubj.border}`,
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {bSubj.label}
                        </span>
                      </div>
                    </div>

                    {/* Bloom Thinking Distribution Sub-bar */}
                    {subj.blooms && Object.keys(subj.blooms).length > 0 && (
                      <div
                        style={{
                          padding: '6px 18px',
                          backgroundColor: isDark ? 'rgba(0,0,0,0.15)' : 'rgba(241,245,249,0.4)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          flexWrap: 'wrap',
                          fontSize: 11.5,
                          borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : '#f1f5f9'}`,
                        }}
                      >
                        <span style={{ fontWeight: 700, color: '#64748b' }}>Bloom Thinking Levels:</span>
                        {Object.entries(subj.blooms).map(([bKey, bVal]: [string, any]) => (
                          <span
                            key={bKey}
                            style={{
                              padding: '2px 7px',
                              borderRadius: 6,
                              backgroundColor: isDark ? 'rgba(99,102,241,0.12)' : '#eef2ff',
                              color: '#6366f1',
                              fontWeight: 700,
                              fontSize: 11,
                            }}
                          >
                            {bKey.charAt(0) + bKey.slice(1).toLowerCase()}: {bVal.accuracy}% ({bVal.correct}/{bVal.total})
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Quick Jump to Subject Questions */}
                    {subj.question_numbers && subj.question_numbers.length > 0 && (
                      <div
                        style={{
                          padding: '6px 18px',
                          backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(241,245,249,0.6)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          flexWrap: 'wrap',
                          borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#e2e8f0'}`,
                        }}
                      >
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>
                          📍 View Subject Questions ({subj.question_numbers.length}):
                        </span>
                        {subj.question_numbers.map((qNum: number) => (
                          <button
                            key={qNum}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleJumpToQuestion(qNum);
                            }}
                            style={{
                              padding: '2px 7px',
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 800,
                              backgroundColor: isDark ? 'rgba(37,99,235,0.15)' : '#eff6ff',
                              color: '#2563eb',
                              border: '1px solid rgba(37,99,235,0.3)',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                            title={`Jump to Question #${qNum} in Detailed Diagnostics Tab`}
                          >
                            Q{qNum}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* LEVEL 2: TOPICS LIST */}
                    {isSubjExpanded && subj.topics && (
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                        }}
                      >
                        {subj.topics.map((top: any) => {
                          const isTopExpanded =
                            !!expandedHierarchyNodes[`top_${subj.name}_${top.name}`];
                          const bTop = getBadgeStyle(top.status);

                          return (
                            <div
                              key={top.name}
                              style={{
                                borderBottom: `1px solid ${
                                  isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9'
                                }`,
                              }}
                            >
                              {/* TOPIC ROW */}
                              <div
                                onClick={() =>
                                  toggleHierarchyNode(`top_${subj.name}_${top.name}`)
                                }
                                style={{
                                  padding: '12px 18px 12px 36px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  cursor: 'pointer',
                                  userSelect: 'none',
                                  flexWrap: 'wrap',
                                  gap: 10,
                                  backgroundColor: isDark
                                    ? isTopExpanded
                                      ? 'rgba(255,255,255,0.03)'
                                      : 'transparent'
                                    : isTopExpanded
                                    ? '#f8fafc'
                                    : 'transparent',
                                }}
                              >
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 10,
                                  }}
                                >
                                  {isTopExpanded ? (
                                    <ChevronDown size={16} color="#64748b" />
                                  ) : (
                                    <ChevronRight size={16} color="#64748b" />
                                  )}
                                  <Layers size={16} color="#6366f1" />
                                  <div>
                                    <span
                                      style={{
                                        fontSize: 13.5,
                                        fontWeight: 700,
                                        color: isDark ? '#e2e8f0' : '#1e293b',
                                      }}
                                    >
                                      {top.name}
                                    </span>
                                    <span
                                      style={{
                                        fontSize: 11,
                                        color: '#64748b',
                                        marginLeft: 6,
                                      }}
                                    >
                                      ({top.subtopics?.length || 0} subtopics • {top.total} Qs)
                                    </span>
                                  </div>
                                </div>

                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 12,
                                    flexWrap: 'wrap',
                                  }}
                                >
                                  <div style={{ fontSize: 12, color: '#64748b' }}>
                                    <strong>{top.correct}</strong> / {top.attempted} Correct
                                  </div>

                                  <div
                                    style={{
                                      fontSize: 13,
                                      fontWeight: 800,
                                      color:
                                        top.accuracy >= 85
                                          ? '#10b981'
                                          : top.accuracy >= 70
                                          ? '#3b82f6'
                                          : top.accuracy >= 50
                                          ? '#f59e0b'
                                          : '#ef4444',
                                      minWidth: 45,
                                      textAlign: 'right',
                                    }}
                                  >
                                    {top.accuracy}%
                                  </div>

                                  {/* Topic Pacing Badge */}
                                  <span
                                    style={{
                                      fontSize: 10.5,
                                      padding: '2px 7px',
                                      borderRadius: 6,
                                      backgroundColor:
                                        top.pacing_status === 'OPTIMAL'
                                          ? 'rgba(16,185,129,0.12)'
                                          : top.pacing_status === 'BOTTLENECK'
                                          ? 'rgba(239,68,68,0.12)'
                                          : 'rgba(139,92,246,0.12)',
                                      color:
                                        top.pacing_status === 'OPTIMAL'
                                          ? '#10b981'
                                          : top.pacing_status === 'BOTTLENECK'
                                          ? '#ef4444'
                                          : '#8b5cf6',
                                      fontWeight: 700,
                                    }}
                                  >
                                    {top.pacing_label || '⚡ Optimal'} (~{top.avg_time}s/q)
                                  </span>

                                  {/* Topic Strength Badge */}
                                  <span
                                    style={{
                                      fontSize: 10.5,
                                      padding: '2px 8px',
                                      borderRadius: 10,
                                      backgroundColor: bTop.bg,
                                      color: bTop.color,
                                      border: `1px solid ${bTop.border}`,
                                      fontWeight: 700,
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {bTop.label}
                                  </span>
                                </div>
                              </div>

                              {/* Topic Bloom Thinking Breakdown */}
                              {top.blooms && Object.keys(top.blooms).length > 0 && (
                                <div
                                  style={{
                                    padding: '4px 18px 4px 58px',
                                    backgroundColor: isDark ? 'rgba(0,0,0,0.1)' : 'rgba(248,250,252,0.4)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    flexWrap: 'wrap',
                                    fontSize: 11,
                                  }}
                                >
                                  <span style={{ fontWeight: 700, color: '#64748b' }}>Thinking Levels:</span>
                                  {Object.entries(top.blooms).map(([bKey, bVal]: [string, any]) => (
                                    <span
                                      key={bKey}
                                      style={{
                                        padding: '1px 6px',
                                        borderRadius: 5,
                                        backgroundColor: isDark ? 'rgba(99,102,241,0.12)' : '#eef2ff',
                                        color: '#6366f1',
                                        fontWeight: 700,
                                      }}
                                    >
                                      {bKey.charAt(0) + bKey.slice(1).toLowerCase()}: {bVal.accuracy}% ({bVal.correct}/{bVal.total})
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Quick Jump to Topic Questions */}
                              {top.question_numbers && top.question_numbers.length > 0 && (
                                <div
                                  style={{
                                    padding: '4px 20px 8px 58px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    flexWrap: 'wrap',
                                    backgroundColor: isDark ? 'rgba(0,0,0,0.1)' : 'rgba(248,250,252,0.6)',
                                  }}
                                >
                                  <span style={{ fontSize: 10.5, fontWeight: 700, color: '#64748b' }}>
                                    📍 Topic Questions:
                                  </span>
                                  {top.question_numbers.map((qNum: number) => (
                                    <button
                                      key={qNum}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleJumpToQuestion(qNum);
                                      }}
                                      style={{
                                        padding: '1px 6px',
                                        borderRadius: 5,
                                        fontSize: 10.5,
                                        fontWeight: 800,
                                        backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : '#eef2ff',
                                        color: '#6366f1',
                                        border: '1px solid rgba(99,102,241,0.3)',
                                        cursor: 'pointer',
                                      }}
                                      title={`Jump to Question #${qNum}`}
                                    >
                                      Q{qNum}
                                    </button>
                                  ))}
                                </div>
                              )}

                              {/* LEVEL 3: SUBTOPICS LIST */}
                              {isTopExpanded && top.subtopics && (
                                <div
                                  style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    backgroundColor: isDark
                                      ? 'rgba(0,0,0,0.15)'
                                      : 'rgba(0,0,0,0.02)',
                                  }}
                                >
                                  {top.subtopics.map((sub: any) => {
                                    const bSub = getBadgeStyle(sub.status);

                                    return (
                                      <div
                                        key={sub.name}
                                        style={{
                                          borderBottom: `1px solid ${
                                            isDark
                                              ? 'rgba(255,255,255,0.03)'
                                              : '#f1f5f9'
                                          }`,
                                        }}
                                      >
                                        <div
                                          style={{
                                            padding: '10px 18px 10px 72px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            fontSize: 12.5,
                                            flexWrap: 'wrap',
                                            gap: 8,
                                          }}
                                        >
                                          <div
                                            style={{
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: 8,
                                            }}
                                          >
                                            <Target size={14} color="#14b8a6" />
                                            <span
                                              style={{
                                                color: isDark ? '#cbd5e1' : '#334155',
                                                fontWeight: 600,
                                              }}
                                            >
                                              {sub.name}
                                            </span>
                                          </div>

                                          <div
                                            style={{
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: 12,
                                              flexWrap: 'wrap',
                                            }}
                                          >
                                            <div style={{ color: '#64748b', fontSize: 11.5 }}>
                                              <strong>{sub.correct}</strong> / {sub.attempted} (
                                              {sub.total} Qs)
                                            </div>
                                            <div
                                              style={{
                                                fontSize: 12,
                                                fontWeight: 800,
                                                color:
                                                  sub.accuracy >= 85
                                                    ? '#10b981'
                                                    : sub.accuracy >= 70
                                                    ? '#3b82f6'
                                                    : sub.accuracy >= 50
                                                    ? '#f59e0b'
                                                    : '#ef4444',
                                                minWidth: 42,
                                                textAlign: 'right',
                                              }}
                                            >
                                              {sub.accuracy}%
                                            </div>
                                            <span
                                              style={{
                                                fontSize: 10,
                                                padding: '2px 7px',
                                                borderRadius: 8,
                                                backgroundColor: bSub.bg,
                                                color: bSub.color,
                                                border: `1px solid ${bSub.border}`,
                                                fontWeight: 700,
                                                whiteSpace: 'nowrap',
                                              }}
                                            >
                                              {bSub.label}
                                            </span>
                                          </div>
                                        </div>

                                        {/* Quick Jump to Subtopic Questions */}
                                        {sub.question_numbers && sub.question_numbers.length > 0 && (
                                          <div
                                            style={{
                                              padding: '2px 20px 6px 72px',
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: 5,
                                              flexWrap: 'wrap',
                                            }}
                                          >
                                            <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b' }}>
                                              📍 Qs:
                                            </span>
                                            {sub.question_numbers.map((qNum: number) => (
                                              <button
                                                key={qNum}
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleJumpToQuestion(qNum);
                                                }}
                                                style={{
                                                  padding: '1px 5px',
                                                  borderRadius: 4,
                                                  fontSize: 10,
                                                  fontWeight: 800,
                                                  backgroundColor: isDark ? 'rgba(20,184,166,0.15)' : '#f0fdfa',
                                                  color: '#0d9488',
                                                  border: '1px solid rgba(20,184,166,0.3)',
                                                  cursor: 'pointer',
                                                }}
                                                title={`Jump to Question #${qNum}`}
                                              >
                                                Q{qNum}
                                              </button>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
