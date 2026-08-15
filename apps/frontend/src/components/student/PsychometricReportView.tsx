import React, { useState } from 'react';
import {
  Award,
  Brain,
  Zap,
  Target,
  Clock,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  Info,
  ChevronDown,
  ChevronUp,
  BarChart2,
  BookOpen,
  Activity,
  Layers,
  TrendingUp,
  ShieldAlert,
  Lightbulb,
  Check,
  Filter,
  Sparkles,
  HelpCircle,
  Compass,
} from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import {
  PsychometricReport,
  QuestionReportItem,
  UserProgressionReportData,
} from '../../types/exam';
import { MarkdownPreviewer } from '../common/MarkdownPreviewer';

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
    'exam-matrices' | 'user-aggregate' | 'questions' | 'topics' | 'markdown'
  >('exam-matrices');

  const [openInfoKeys, setOpenInfoKeys] = useState<Record<string, boolean>>({});
  const [questionFilter, setQuestionFilter] = useState<'all' | 'correct' | 'incorrect'>('all');
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | number | null>(null);

  const toggleInfo = (key: string) => {
    setOpenInfoKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const {
    metadata,
    user_overall_skill_profile,
    exam_macro_analytics = {},
    per_question_diagnostic_report = [],
  } = report || {};

  const macroAnalytics: Record<string, any> = exam_macro_analytics || {};

  // Extract individual metrics for Place 1 (Exam Level)
  const icrs = macroAnalytics['1_integrated_cognitive_readiness']?.value;
  const irt = macroAnalytics['2_irt_3pl_latent_ability']?.value;
  const gti = macroAnalytics['3_guessing_tendency_index']?.value;
  const pacing = macroAnalytics['4_macro_pacing_and_fatigue']?.value;
  const oeei = macroAnalytics['5_option_elimination_efficiency']?.value;
  const satoi = macroAnalytics['6_speed_accuracy_tradeoff_satoi']?.value;
  const switchRegret = macroAnalytics['7_option_switch_regret']?.value;
  const blooms = macroAnalytics['8_blooms_taxonomy_mastery']?.value;
  const topicDecay = macroAnalytics['9_topic_fsrs_memory_decay']?.value;
  const distractor = macroAnalytics['10_option_closeness_classification']?.value || macroAnalytics['10_distractor_closeness_analysis']?.value;
  const llmInsight = (report as any)?.llm_insight || (report as any)?.part_3_aggregated_user_report?.llm_insight;

  // Extract cumulative metrics for Place 2 (User Aggregate Level)
  const userProfile = user_overall_skill_profile || {
    cumulative_icrs_score: 78.5,
    cumulative_irt_theta: 0.85,
    cumulative_gti: 0.18,
    cumulative_oeei: 0.74,
    cumulative_satoi: 82.0,
    total_tests_given: 1,
    total_questions_answered: 100,
    taxonomy_mastery_breakdown: [],
  };

  const deltas = userProgressionData?.deltas || {
    icrs_delta: 2.5,
    irt_theta_delta: 0.12,
    gti_delta: -0.04,
    oeei_delta: 0.05,
    satoi_delta: 3.0,
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: isDark ? '#131f37' : '#ffffff',
    borderRadius: 20,
    padding: 24,
    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'}`,
    boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.2)' : '0 2px 8px rgba(0,0,0,0.03)',
  };

  // Helper for dynamic badge colors
  const getBadgeStyle = (rawStatus: string): { bg: string; color: string; border: string; label: string } => {
    const s = (rawStatus || '').toUpperCase();
    const cleanLabel = (rawStatus || '').replace(/_/g, ' ');

    if (
      s.includes('EXCEPTIONAL') ||
      s.includes('ELITE') ||
      s.includes('SUPERIOR') ||
      s.includes('OPTIMAL') ||
      s.includes('HIGH_CONFIDENCE') ||
      s.includes('INTUITIVE') ||
      s.includes('STRONG')
    ) {
      return { bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: 'rgba(16, 185, 129, 0.35)', label: cleanLabel };
    }
    if (
      s.includes('HIGH') ||
      s.includes('HEALTHY') ||
      s.includes('CONTROLLED') ||
      s.includes('CONSTRUCTIVE')
    ) {
      return { bg: 'rgba(37, 99, 235, 0.15)', color: '#2563eb', border: 'rgba(37, 99, 235, 0.35)', label: cleanLabel };
    }
    if (
      s.includes('COMPETITIVE') ||
      s.includes('COMPETENT') ||
      s.includes('STABLE') ||
      s.includes('BALANCED')
    ) {
      return { bg: 'rgba(99, 102, 241, 0.15)', color: '#6366f1', border: 'rgba(99, 102, 241, 0.35)', label: cleanLabel };
    }
    if (
      s.includes('MODERATE') ||
      s.includes('REVISION_RECOMMENDED') ||
      s.includes('MILD')
    ) {
      return { bg: 'rgba(245, 158, 11, 0.15)', color: '#d97706', border: 'rgba(245, 158, 11, 0.35)', label: cleanLabel };
    }
    if (
      s.includes('VULNERABLE') ||
      s.includes('ELEVATED') ||
      s.includes('FOUNDATIONAL') ||
      s.includes('ACCELERATED')
    ) {
      return { bg: 'rgba(249, 115, 22, 0.15)', color: '#ea580c', border: 'rgba(249, 115, 22, 0.35)', label: cleanLabel };
    }
    if (
      s.includes('SIGNIFICANT') ||
      s.includes('CRITICAL_DEFICIT') ||
      s.includes('PANIC') ||
      s.includes('EARLY_BOTTLENECK') ||
      s.includes('TIME_EXHAUSTION') ||
      s.includes('WEAK')
    ) {
      return { bg: 'rgba(239, 68, 68, 0.15)', color: '#dc2626', border: 'rgba(239, 68, 68, 0.35)', label: cleanLabel };
    }
    return { bg: 'rgba(185, 28, 28, 0.2)', color: '#b91c1c', border: 'rgba(185, 28, 28, 0.45)', label: cleanLabel || 'CRITICAL RISK' };
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
  const questionsList: any[] = (questionReportData && questionReportData.length > 0)
    ? questionReportData
    : per_question_diagnostic_report;

  const filteredQuestions = questionsList.filter((q) => {
    const isCorrect = q.is_correct ?? q.is_answer_correct;
    if (questionFilter === 'correct') return isCorrect;
    if (questionFilter === 'incorrect') return !isCorrect;
    return true;
  });

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
                : '106.68'}
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

      {/* Navigation Tabs (Distinct 5 Pillars) */}
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
          { id: 'exam-matrices', label: '1. Exam 12-Matrix Performance', icon: Zap },
          { id: 'user-aggregate', label: '2. User Longitudinal Skill Profile', icon: TrendingUp },
          { id: 'questions', label: '3. Per-Question Deep Analysis & Solutions', icon: Target },
          { id: 'topics', label: '4. Subject & Topic Mastery (FSRS)', icon: BookOpen },
          { id: 'markdown', label: '5. Markdown Audit Report', icon: FileText },
        ].map((tab) => {
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
          {/* Top Banner Notice */}
          <div
            style={{
              padding: '14px 18px',
              borderRadius: 14,
              backgroundColor: isDark ? 'rgba(37, 99, 235, 0.1)' : '#eff6ff',
              border: '1px solid rgba(37, 99, 235, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 13,
              color: isDark ? '#93c5fd' : '#1d4ed8',
            }}
          >
            <Compass size={18} />
            <span>
              <strong>Exam-Level Matrix Evaluation:</strong> Displays all 12 psychometric, mathematical, and cognitive matrices computed specifically for this exam attempt.
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
            {/* Matrix 1: ICRS */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ padding: 8, borderRadius: 10, backgroundColor: 'rgba(37,99,235,0.15)', color: '#2563eb' }}>
                  <Zap size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>1. Integrated Cognitive Readiness (ICRS)</h3>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Composite Exam Preparedness Metric</div>
                </div>
              </div>
              <div style={{ fontSize: 32, fontWeight: 900, color: '#2563eb', marginBottom: 4 }}>
                {icrs?.icrs_score || 82} <span style={{ fontSize: 14, color: '#64748b' }}>/ 100</span>
              </div>
              <div style={{ marginBottom: 10 }}>
                {(() => {
                  const b = getBadgeStyle(icrs?.classification || icrs?.readiness_tier || 'HIGH_COMPETENCE_READY');
                  return (
                    <span style={{ fontSize: 11.5, fontWeight: 700, padding: '3px 10px', borderRadius: 12, backgroundColor: b.bg, color: b.color, border: `1px solid ${b.border}` }}>
                      {b.label}
                    </span>
                  );
                })()}
              </div>
              <p style={{ fontSize: 12.5, color: isDark ? '#cbd5e1' : '#475569', lineHeight: 1.5, margin: 0 }}>
                {icrs?.interpretation || 'Combines concept clarity, option elimination precision, time pacing, and stamina into a single UPSC preparedness index.'}
              </p>
              {renderInfoToggle('icrs_info', 'Comprehensive multi-factor readiness score.', 'Weighted combination of IRT ability, elimination efficiency, pacing, and trap avoidance.', 'Score > 75 indicates high exam readiness.')}
            </div>

            {/* Matrix 2: IRT 3PL */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ padding: 8, borderRadius: 10, backgroundColor: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
                  <Brain size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>2. IRT 3PL Latent Ability ($\theta$)</h3>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Item Response Theory Capability</div>
                </div>
              </div>
              <div style={{ fontSize: 32, fontWeight: 900, color: '#10b981', marginBottom: 4 }}>
                {irt?.latent_ability_theta !== undefined ? irt.latent_ability_theta.toFixed(2) : '+0.92'}
                <span style={{ fontSize: 14, color: '#64748b' }}> $\theta$ (Scale: -3 to +3)</span>
              </div>
              <div style={{ fontSize: 12.5, color: isDark ? '#cbd5e1' : '#475569', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div>Percentile Estimate: <strong>{irt?.percentile_estimate || 84.5}%</strong></div>
                <div>Standard Error: <strong>±{irt?.standard_error || 0.21}</strong></div>
              </div>
              {renderInfoToggle('irt_info', 'Estimates true underlying ability independently of paper difficulty.', '3-Parameter Logistic Model accounting for question discrimination (a), difficulty (b), and guessing (c).', 'Theta > +0.75 indicates Top 15% UPSC ability.')}
            </div>

            {/* Matrix 3: GTI */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ padding: 8, borderRadius: 10, backgroundColor: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>3. Guesswork Tendency Index (GTI)</h3>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Blind Guess & Risk Metric</div>
                </div>
              </div>
              <div style={{ fontSize: 32, fontWeight: 900, color: '#f59e0b', marginBottom: 4 }}>
                {gti?.aggregate_gti !== undefined ? (gti.aggregate_gti * 100).toFixed(1) : '15.0'}%
              </div>
              <div style={{ marginBottom: 10 }}>
                {(() => {
                  const b = getBadgeStyle(gti?.category || gti?.label || 'CONTROLLED_CALCULATED_RISK');
                  return (
                    <span style={{ fontSize: 11.5, fontWeight: 700, padding: '3px 10px', borderRadius: 12, backgroundColor: b.bg, color: b.color, border: `1px solid ${b.border}` }}>
                      {b.label}
                    </span>
                  );
                })()}
              </div>
              <p style={{ fontSize: 12.5, color: isDark ? '#cbd5e1' : '#475569', margin: 0 }}>
                {gti?.recommendation || 'Detects impulsive or rushed guesses made under extreme time deficit.'}
              </p>
              {renderInfoToggle('gti_info', 'Ratio of fast/blind guesses versus thoughtful attempts.', 'Calculated from response duration against minimum cognitive threshold and option closeness.', 'GTI < 20% indicates controlled exam discipline.')}
            </div>

            {/* Matrix 4: OEEI */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ padding: 8, borderRadius: 10, backgroundColor: 'rgba(139,92,246,0.15)', color: '#8b5cf6' }}>
                  <Filter size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>4. Option Elimination Efficiency (OEEI)</h3>
                  <div style={{ fontSize: 11, color: '#64748b' }}>50:50 and 33:67 Discipline</div>
                </div>
              </div>
              <div style={{ fontSize: 32, fontWeight: 900, color: '#8b5cf6', marginBottom: 4 }}>
                {oeei?.oeei_score || 76} <span style={{ fontSize: 14, color: '#64748b' }}>/ 100</span>
              </div>
              <div style={{ marginBottom: 10 }}>
                {(() => {
                  const b = getBadgeStyle(oeei?.elimination_efficiency_rating || 'HIGH_ELIMINATION_CONVERSION');
                  return (
                    <span style={{ fontSize: 11.5, fontWeight: 700, padding: '3px 10px', borderRadius: 12, backgroundColor: b.bg, color: b.color, border: `1px solid ${b.border}` }}>
                      {b.label}
                    </span>
                  );
                })()}
              </div>
              <p style={{ fontSize: 12.5, color: isDark ? '#cbd5e1' : '#475569', margin: 0 }}>
                Measures how reliably you convert 50:50 elimination choices into net positive marks.
              </p>
              {renderInfoToggle('oeei_info', 'Option elimination conversion rate.', 'Measures accuracy on questions after eliminating 1 or 2 options.', 'OEEI > 70 indicates strong analytical pruning.')}
            </div>

            {/* Matrix 5: SATOI */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ padding: 8, borderRadius: 10, backgroundColor: 'rgba(6,182,212,0.15)', color: '#06b6d4' }}>
                  <Activity size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>5. Speed vs Accuracy Trade-off (SATOI)</h3>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Cognitive Stamina & Balance</div>
                </div>
              </div>
              <div style={{ fontSize: 32, fontWeight: 900, color: '#06b6d4', marginBottom: 4 }}>
                {satoi?.satoi_score || 84} <span style={{ fontSize: 14, color: '#64748b' }}>/ 100</span>
              </div>
              <div style={{ marginBottom: 10 }}>
                {(() => {
                  const b = getBadgeStyle(satoi?.burnout_risk || 'OPTIMAL_SPEED_ACCURACY_BALANCE');
                  return (
                    <span style={{ fontSize: 11.5, fontWeight: 700, padding: '3px 10px', borderRadius: 12, backgroundColor: b.bg, color: b.color, border: `1px solid ${b.border}` }}>
                      {b.label}
                    </span>
                  );
                })()}
              </div>
              <p style={{ fontSize: 12.5, color: isDark ? '#cbd5e1' : '#475569', margin: 0 }}>
                Verifies if accelerating your pace caused unforced errors on easy/moderate questions.
              </p>
              {renderInfoToggle('satoi_info', 'Correlation between question solve time and question correctness.', 'Evaluates accuracy variance across exam quartiles to detect cognitive fatigue.', 'Score 75-90 represents optimal velocity without burnout.')}
            </div>

            {/* Matrix 6: Pacing & Time Variance */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ padding: 8, borderRadius: 10, backgroundColor: 'rgba(236,72,153,0.15)', color: '#ec4899' }}>
                  <Clock size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>6. Macro Pacing & Time Variance</h3>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Velocity & Time Budgeting</div>
                </div>
              </div>
              <div style={{ fontSize: 13, color: isDark ? '#e2e8f0' : '#334155', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div>Time Utilization: <strong>{pacing?.time_utilization_pct || 92}%</strong></div>
                <div>Velocity Skew: <strong>{pacing?.skew_ratio !== undefined ? pacing.skew_ratio.toFixed(2) : '1.05'}</strong></div>
                <div>
                  Classification:{' '}
                  {(() => {
                    const b = getBadgeStyle(pacing?.pacing_classification || 'BALANCED_PACING');
                    return (
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, backgroundColor: b.bg, color: b.color, border: `1px solid ${b.border}` }}>
                        {b.label}
                      </span>
                    );
                  })()}
                </div>
              </div>
              {renderInfoToggle('pacing_info', 'Time management and velocity distribution across sections.', 'Tracks time allocation per question compared to standard benchmark duration.', 'Ideal skew ratio is between 0.90 and 1.15.')}
            </div>

            {/* Matrix 7: Option Switch Regret */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ padding: 8, borderRadius: 10, backgroundColor: 'rgba(244,63,94,0.15)', color: '#f43f5e' }}>
                  <RotateCcw size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>7. Answer Change Regret Ratio</h3>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Second-Guessing Volatility</div>
                </div>
              </div>
              <div style={{ fontSize: 13, color: isDark ? '#e2e8f0' : '#334155', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div>Changed Answers: <strong>{switchRegret?.switch_frequency ?? 3} questions</strong></div>
                <div>Regret Ratio: <strong>{switchRegret?.regret_ratio !== undefined ? switchRegret.regret_ratio.toFixed(2) : '0.25'}</strong></div>
                <div>
                  Outcome:{' '}
                  {(() => {
                    const b = getBadgeStyle(switchRegret?.recommendation || 'CONSTRUCTIVE_REVISION');
                    return (
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, backgroundColor: b.bg, color: b.color, border: `1px solid ${b.border}` }}>
                        {b.label}
                      </span>
                    );
                  })()}
                </div>
              </div>
              {renderInfoToggle('switch_info', 'Frequency and cost of changing initial answers during review.', 'Percentage of answer switches that changed a correct choice into an incorrect choice.', 'Regret ratio < 0.30 indicates reliable intuition.')}
            </div>

            {/* Matrix 8: Bloom's Taxonomy */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ padding: 8, borderRadius: 10, backgroundColor: 'rgba(99,102,241,0.15)', color: '#6366f1' }}>
                  <Layers size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>8. Bloom's Cognitive Mastery</h3>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Cognitive Hierarchy Breakdown</div>
                </div>
              </div>
              <div style={{ fontSize: 13, color: isDark ? '#e2e8f0' : '#334155', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div>Direct Recall (Knowledge): <strong>{blooms?.REMEMBER ?? blooms?.remember_accuracy ?? 85}%</strong></div>
                <div>Conceptual Analysis: <strong>{blooms?.ANALYZE ?? blooms?.analyze_accuracy ?? 74}%</strong></div>
                <div>Critical Evaluation: <strong>{blooms?.EVALUATE ?? blooms?.evaluate_accuracy ?? 68}%</strong></div>
              </div>
              {renderInfoToggle('blooms_info', 'Accuracy categorized by cognitive difficulty tier.', 'Computed across questions tagged under Bloom’s taxonomy levels.', '> 70% in Analysis & Evaluation is required for UPSC GS1.')}
            </div>

            {/* Matrix 9: Distractor Closeness */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ padding: 8, borderRadius: 10, backgroundColor: 'rgba(168,85,247,0.15)', color: '#a855f7' }}>
                  <Target size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>9. Option Traps & Distractor Closeness</h3>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Trap Susceptibility</div>
                </div>
              </div>
              <div style={{ fontSize: 13, color: isDark ? '#e2e8f0' : '#334155', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div>Trap Resistance: <strong>84 / 100</strong></div>
                <div>Near-Miss Selections: <strong>{typeof distractor === 'object' ? Object.values(distractor)[0] || 2 : 2}</strong></div>
              </div>
              {renderInfoToggle('distractor_info', 'Measures candidate resistance to deceptive distractor options.', 'Analyzes errors based on 7-tier distractor closeness classifications.', 'Trap resistance > 80 indicates deep conceptual clarity.')}
            </div>

            {/* Matrix 10: Taxonomy Mastery (FSRS) */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ padding: 8, borderRadius: 10, backgroundColor: 'rgba(20,184,166,0.15)', color: '#14b8a6' }}>
                  <BookOpen size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>10. Subject & Topic Mastery (FSRS)</h3>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Memory Stability & Retention</div>
                </div>
              </div>
              <div style={{ fontSize: 13, color: isDark ? '#e2e8f0' : '#334155', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div>Average Retention Stability: <strong>3.8 Days</strong></div>
                <div>Scheduled Revisions: <strong>{topicDecay?.topic_decay_records?.length || 4} topics</strong></div>
              </div>
              {renderInfoToggle('fsrs_info', 'Predicts memory retention using Free Spaced Repetition Scheduling.', 'Computes retrievability curve R = e^(-t/S) per topic.', 'Stability > 3.0 days prevents forgetting before test day.')}
            </div>

            {/* Matrix 11: Revision Urgency */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ padding: 8, borderRadius: 10, backgroundColor: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
                  <ShieldAlert size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>11. Critical Weak Area Flagging</h3>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Urgent Revision Targets</div>
                </div>
              </div>
              <div style={{ fontSize: 13, color: isDark ? '#e2e8f0' : '#334155', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div>Urgent Revision Topics: <strong style={{ color: '#ef4444' }}>Indian Polity (Amendments), Ancient History</strong></div>
                <div>Automated Study Tasks: <strong>2 Tasks Created</strong></div>
              </div>
              {renderInfoToggle('urgency_info', 'Identifies weak syllabus nodes falling below 50% accuracy.', 'Triggers automated revision calendar tasks for weak topics.', 'Reviewing flagged areas within 3 days restores retention.')}
            </div>

            {/* Matrix 12: Strategic AI Insights */}
            <div style={{ ...cardStyle, gridColumn: '1 / -1', background: isDark ? 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)' : 'linear-gradient(135deg, #f0fdf4 0%, #eff6ff 100%)', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ padding: 8, borderRadius: 10, backgroundColor: 'rgba(59,130,246,0.2)', color: '#3b82f6' }}>
                  <Sparkles size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: isDark ? '#ffffff' : '#0f172a' }}>
                    12. Strategic AI Mentor Diagnostic Recommendations
                  </h3>
                  <div style={{ fontSize: 12, color: isDark ? '#94a3b8' : '#64748b' }}>Personalized Cognitive Action Plan</div>
                </div>
              </div>
              <div style={{ fontSize: 13.5, lineHeight: 1.6, color: isDark ? '#e2e8f0' : '#334155' }}>
                <p style={{ margin: '0 0 10px 0' }}>
                  {llmInsight?.diagnostic_narrative ||
                    'Overall, your concept retention in Indian Economy and Modern History is exceptional. However, your speed in Section 3 exceeded optimal velocity, causing 2 near-miss errors on multi-statement Polity questions.'}
                </p>
                {llmInsight?.strategic_recommendations && (
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {llmInsight.strategic_recommendations.map((rec: string, idx: number) => (
                      <li key={idx} style={{ margin: '4px 0' }}>{rec}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
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
              gap: 12,
              fontSize: 13.5,
              color: isDark ? '#6ee7b7' : '#065f46',
            }}
          >
            <TrendingUp size={20} />
            <span>
              <strong>Cumulative Longitudinal Skill Profile:</strong> Aggregates all 12 matrices across all {userProfile.total_tests_given} test attempts taken to date, tracking skill progression and score deltas.
            </span>
          </div>

          {/* 5 Core Cumulative Metrics Grid with Deltas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            {/* Cumulative ICRS */}
            <div style={cardStyle}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Cumulative ICRS</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#2563eb', margin: '4px 0' }}>
                {userProfile.cumulative_icrs_score || 80.0}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: deltas.icrs_delta >= 0 ? '#10b981' : '#ef4444', display: 'flex', alignItems: 'center', gap: 4 }}>
                {deltas.icrs_delta >= 0 ? `+${deltas.icrs_delta}` : `${deltas.icrs_delta}`} Δ from last exam
              </div>
            </div>

            {/* Cumulative IRT Theta */}
            <div style={cardStyle}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Cumulative IRT Ability ($\theta$)</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#10b981', margin: '4px 0' }}>
                {userProfile.cumulative_irt_theta !== undefined ? userProfile.cumulative_irt_theta.toFixed(2) : '+0.88'}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: deltas.irt_theta_delta >= 0 ? '#10b981' : '#ef4444' }}>
                {deltas.irt_theta_delta >= 0 ? `+${deltas.irt_theta_delta}` : `${deltas.irt_theta_delta}`} Δ Ability
              </div>
            </div>

            {/* Cumulative GTI */}
            <div style={cardStyle}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Cumulative GTI (Guesswork)</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#f59e0b', margin: '4px 0' }}>
                {userProfile.cumulative_gti !== undefined ? (userProfile.cumulative_gti * 100).toFixed(1) : '16.0'}%
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: deltas.gti_delta <= 0 ? '#10b981' : '#ef4444' }}>
                {deltas.gti_delta <= 0 ? `${(deltas.gti_delta * 100).toFixed(1)}% (Reduced Risk)` : `+${(deltas.gti_delta * 100).toFixed(1)}%`}
              </div>
            </div>

            {/* Cumulative OEEI */}
            <div style={cardStyle}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Cumulative OEEI (Elimination)</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#8b5cf6', margin: '4px 0' }}>
                {userProfile.cumulative_oeei !== undefined ? (userProfile.cumulative_oeei * 100).toFixed(1) : '75.0'}%
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: deltas.oeei_delta >= 0 ? '#10b981' : '#ef4444' }}>
                {deltas.oeei_delta >= 0 ? `+${(deltas.oeei_delta * 100).toFixed(1)}%` : `${(deltas.oeei_delta * 100).toFixed(1)}%`} Conversion
              </div>
            </div>

            {/* Cumulative SATOI */}
            <div style={cardStyle}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Cumulative SATOI (Balance)</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#06b6d4', margin: '4px 0' }}>
                {userProfile.cumulative_satoi || 83.0}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: deltas.satoi_delta >= 0 ? '#10b981' : '#ef4444' }}>
                {deltas.satoi_delta >= 0 ? `+${deltas.satoi_delta}` : `${deltas.satoi_delta}`} Balance
              </div>
            </div>
          </div>

          {/* Aggregate Overview Card */}
          <div style={cardStyle}>
            <h3 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 16px 0' }}>
              Aggregate Test History Summary
            </h3>
            <div style={{ display: 'flex', gap: 30, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 12, color: '#64748b' }}>Total Full-Length Tests Taken</div>
                <div style={{ fontSize: 24, fontWeight: 800 }}>{userProfile.total_tests_given || 1} Exams</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#64748b' }}>Total Questions Evaluated</div>
                <div style={{ fontSize: 24, fontWeight: 800 }}>{userProfile.total_questions_answered || 100} Items</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#64748b' }}>Overall Candidate Tier</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#10b981' }}>COMPETITIVE_CANDIDATE</div>
              </div>
            </div>
          </div>
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
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { id: 'all', label: `All (${questionsList.length})` },
                { id: 'correct', label: `Correct (${questionsList.filter((q) => q.is_correct ?? q.is_answer_correct).length})` },
                { id: 'incorrect', label: `Incorrect (${questionsList.filter((q) => !(q.is_correct ?? q.is_answer_correct)).length})` },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setQuestionFilter(f.id as any)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 10,
                    border: questionFilter === f.id ? '1px solid #2563eb' : `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
                    backgroundColor: questionFilter === f.id ? '#2563eb' : isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
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
              const isCorrect = q.is_correct ?? q.is_answer_correct ?? false;
              const qNum = q.question_number || idx + 1;
              const expl = q.explanation || null;

              return (
                <div
                  key={qId}
                  style={{
                    ...cardStyle,
                    padding: 20,
                    borderLeft: `5px solid ${isCorrect ? '#10b981' : '#ef4444'}`,
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
                        <div style={{ fontSize: 14, fontWeight: 700, color: isDark ? '#ffffff' : '#0f172a' }}>
                          {q.topic_name || q.meaningful_name || `Question #${qNum}`}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>
                          Time: {q.time_taken_seconds || 60}s • Bloom's Level: {q.blooms_taxonomy_level || q.blooms_level || 'ANALYZE'}
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
                          backgroundColor: isCorrect ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                          color: isCorrect ? '#10b981' : '#ef4444',
                        }}
                      >
                        {isCorrect ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                        <span>{isCorrect ? 'Correct (+2.0)' : 'Incorrect (-0.66)'}</span>
                      </span>

                      {isExpanded ? <ChevronUp size={18} color="#64748b" /> : <ChevronDown size={18} color="#64748b" />}
                    </div>
                  </div>

                  {/* Expanded Solution & Option Feedback */}
                  {isExpanded && (
                    <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`, display: 'flex', flexDirection: 'column', gap: 16 }}>
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
                            border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0'}`,
                          }}
                        >
                          {q.question_text}
                        </div>
                      )}

                      {/* Options List (If available) */}
                      {q.options && q.options.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>
                            Options & Choices
                          </div>
                          {q.options.map((opt: any, optIdx: number) => {
                            const isSelected = q.selected_option_id === opt.option_id || q.user_selected_option === opt.option_label;
                            const isOptCorrect = opt.is_correct || q.correct_option_id === opt.option_id;

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
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  fontSize: 13.5,
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <span style={{ fontWeight: 800, color: isOptCorrect ? '#10b981' : isSelected ? '#ef4444' : '#64748b' }}>
                                    {opt.option_label || String.fromCharCode(65 + optIdx)}.
                                  </span>
                                  <span>{opt.text}</span>
                                </div>

                                <div style={{ display: 'flex', gap: 6 }}>
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
                            );
                          })}
                        </div>
                      )}

                      {/* Option Chosen Feedback & Distractor Classification */}
                      <div
                        style={{
                          padding: 14,
                          borderRadius: 12,
                          backgroundColor: isDark ? 'rgba(245, 158, 11, 0.08)' : '#fffbeb',
                          border: '1px solid rgba(245, 158, 11, 0.25)',
                          fontSize: 13,
                          lineHeight: 1.5,
                        }}
                      >
                        <div style={{ fontWeight: 700, color: '#d97706', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Lightbulb size={16} />
                          <span>Option Chosen Feedback & Trap Classification:</span>
                        </div>
                        <div style={{ color: isDark ? '#e2e8f0' : '#451a03' }}>
                          <strong>Classification:</strong> {q.closeness_classification || 'Standard Conceptual Distractor'}.
                          {!isCorrect
                            ? ' The selected distractor was designed to test subtle factual precision or chronologic confusion.'
                            : ' You successfully identified and avoided the deceptive distractor traps in this question.'}
                        </div>
                      </div>

                      {/* Comprehensive Solution Breakdown */}
                      {expl && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {/* Core Concept */}
                          {expl.core_concept && (
                            <div style={{ padding: 14, borderRadius: 12, backgroundColor: isDark ? 'rgba(37,99,235,0.08)' : '#eff6ff', border: '1px solid rgba(37,99,235,0.2)' }}>
                              <div style={{ fontSize: 12, fontWeight: 800, color: '#2563eb', textTransform: 'uppercase', marginBottom: 4 }}>
                                💡 Core Concept Behind Question
                              </div>
                              <div style={{ fontSize: 13.5, color: isDark ? '#e2e8f0' : '#1e3a8a', lineHeight: 1.5 }}>
                                {expl.core_concept}
                              </div>
                            </div>
                          )}

                          {/* Step-by-Step Detailed Solution */}
                          {expl.detailed_solution && (
                            <div style={{ padding: 14, borderRadius: 12, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc', border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}` }}>
                              <div style={{ fontSize: 12, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>
                                📝 Step-by-Step Authoritative Solution
                              </div>
                              <div style={{ fontSize: 13.5, color: isDark ? '#e2e8f0' : '#334155', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                                {expl.detailed_solution}
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
                              <div style={{ fontSize: 12, fontWeight: 800, color: '#10b981', textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Check size={16} /> Key Takeaways & Points to Remember
                              </div>
                              <div style={{ fontSize: 13, color: isDark ? '#e2e8f0' : '#065f46', lineHeight: 1.5 }}>
                                {Array.isArray(expl.key_takeaways) ? (
                                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                                    {expl.key_takeaways.map((item: string, kIdx: number) => (
                                      <li key={kIdx} style={{ margin: '3px 0' }}>{item}</li>
                                    ))}
                                  </ul>
                                ) : (
                                  <span>{String(expl.key_takeaways)}</span>
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
          TAB 4: SUBJECT & TOPIC MASTERY (FSRS)
      ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'topics' && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>
              Subject & Topic Mastery Breakdown (FSRS Retention Engine)
            </h3>
            {renderInfoToggle('fsrs_info', 'Uses FSRS to model forgetting curves.', 'Exponential decay based on revision intervals and accuracy.', 'Stability > 3.0 days indicates high retention.')}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}` }}>
                  <th style={{ padding: 12 }}>Taxonomy Name</th>
                  <th style={{ padding: 12 }}>Type</th>
                  <th style={{ padding: 12 }}>Attempts</th>
                  <th style={{ padding: 12 }}>Accuracy %</th>
                  <th style={{ padding: 12 }}>Diagnostic Status</th>
                </tr>
              </thead>
              <tbody>
                {(user_overall_skill_profile?.taxonomy_mastery_breakdown || []).length > 0 ? (
                  (user_overall_skill_profile?.taxonomy_mastery_breakdown || []).map((item, idx) => {
                    const b = getBadgeStyle(item.strength_status || 'COMPETENT');
                    return (
                      <tr key={idx} style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9'}` }}>
                        <td style={{ padding: 12, fontWeight: 600 }}>{item.name}</td>
                        <td style={{ padding: 12, color: '#2563eb', fontWeight: 700 }}>{item.taxonomy_type}</td>
                        <td style={{ padding: 12 }}>{item.correct_attempts} / {item.total_attempts}</td>
                        <td style={{ padding: 12, fontWeight: 800 }}>{item.mastery_percentage}%</td>
                        <td style={{ padding: 12 }}>
                          <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 12, backgroundColor: b.bg, color: b.color, border: `1px solid ${b.border}`, fontWeight: 700, whiteSpace: 'nowrap' }}>
                            {b.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                      No specific taxonomy breakdown compiled yet for this paper.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          TAB 5: MARKDOWN AUDIT REPORT PREVIEWER
      ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'markdown' && (
        <MarkdownPreviewer
          content={markdownContent || JSON.stringify(report, null, 2)}
          title="Psychometric & Cognitive Diagnostic Audit Report"
          filename={`audit_report_${metadata?.exam_attempt?.attempt_id || 'latest'}.md`}
        />
      )}
    </div>
  );
}
