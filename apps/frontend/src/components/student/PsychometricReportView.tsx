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
  Copy,
  Info,
  ChevronDown,
  ChevronUp,
  BarChart2,
  BookOpen,
  Activity,
  Layers,
} from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { PsychometricReport } from '../../types/exam';

interface PsychometricReportViewProps {
  report: PsychometricReport;
  markdownContent?: string;
}

export function PsychometricReportView({ report, markdownContent }: PsychometricReportViewProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [activeTab, setActiveTab] = useState<'overview' | 'macro' | 'topics' | 'questions' | 'markdown'>('overview');
  const [copied, setCopied] = useState(false);
  const [openInfoKeys, setOpenInfoKeys] = useState<Record<string, boolean>>({});

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

  const icrs = macroAnalytics['1_integrated_cognitive_readiness']?.value;
  const irt = macroAnalytics['2_irt_3pl_latent_ability']?.value;
  const gti = macroAnalytics['3_guessing_tendency_index']?.value;
  const pacing = macroAnalytics['4_macro_pacing_and_fatigue']?.value;
  const oeei = macroAnalytics['5_option_elimination_efficiency']?.value;
  const satoi = macroAnalytics['6_speed_accuracy_tradeoff_satoi']?.value;
  const switchRegret = macroAnalytics['7_option_switch_regret']?.value;
  const blooms = macroAnalytics['8_blooms_taxonomy_mastery']?.value;
  const topicDecay = macroAnalytics['9_topic_fsrs_memory_decay']?.value;
  const distractor = macroAnalytics['10_distractor_closeness_analysis']?.value;

  const handleCopyMarkdown = () => {
    if (markdownContent) {
      navigator.clipboard.writeText(markdownContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: isDark ? '#131f37' : '#ffffff',
    borderRadius: 20,
    padding: 24,
    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'}`,
    boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.2)' : '0 2px 8px rgba(0,0,0,0.03)',
  };

  // Helper for 5-tier & 7-tier dynamic badge colors
  const getBadgeStyle = (rawStatus: string): { bg: string; color: string; border: string; label: string } => {
    const s = (rawStatus || '').toUpperCase();
    const cleanLabel = (rawStatus || '').replace(/_/g, ' ');

    if (
      s.includes('EXCEPTIONAL') ||
      s.includes('ELITE') ||
      s.includes('SUPERIOR') ||
      s.includes('OPTIMAL') ||
      s.includes('HIGH_CONFIDENCE') ||
      s.includes('INTUITIVE')
    ) {
      return { bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: 'rgba(16, 185, 129, 0.35)', label: cleanLabel };
    }
    if (
      s.includes('HIGH') ||
      s.includes('STRONG') ||
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
      s.includes('TIME_EXHAUSTION')
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
            background: isOpen ? 'var(--accent-primary, #5b5ceb)' : isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9',
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
          title="Click to view explanation and tips"
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header Banner */}
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
            <Brain size={14} /> Psychometric Diagnostic Audit
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
              {metadata?.exam_attempt?.total_score_awarded !== undefined ? metadata.exam_attempt.total_score_awarded.toFixed(2) : '106.68'}
              <span style={{ fontSize: 13, color: '#64748b' }}> / {metadata?.exam_attempt?.max_marks || 200}</span>
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
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Net Accuracy</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#10b981' }}>
              {user_overall_skill_profile?.net_accuracy_percentage !== undefined ? user_overall_skill_profile.net_accuracy_percentage.toFixed(1) : '75.0'}%
            </div>
          </div>
        </div>
      </section>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: 10, borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`, paddingBottom: 12, overflowX: 'auto' }}>
        {[
          { id: 'overview', label: 'Overall Readiness', icon: Zap },
          { id: 'macro', label: '10 Core Indices', icon: BarChart2 },
          { id: 'topics', label: 'Topic Mastery (FSRS)', icon: BookOpen },
          { id: 'questions', label: 'Question Item Diagnostics', icon: Target },
          { id: 'markdown', label: 'Markdown Audit Report', icon: FileText },
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

      {/* Tab 1: Cognitive Readiness & Latent Ability Overview */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
          {/* ICRS Gauge Card (7-Tier Scale) */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ padding: 8, borderRadius: 10, backgroundColor: 'rgba(37,99,235,0.15)', color: '#2563eb' }}>
                <Zap size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>Overall Exam Readiness Index</h3>
                <div style={{ fontSize: 11, color: '#64748b' }}>Integrated Cognitive Readiness (ICRS)</div>
              </div>
            </div>
            <div style={{ fontSize: 36, fontWeight: 900, color: '#2563eb', marginBottom: 4 }}>
              {icrs?.icrs_score || 82} <span style={{ fontSize: 16, color: '#64748b' }}>/ 100</span>
            </div>
            
            {(() => {
              const b = getBadgeStyle(icrs?.classification || icrs?.readiness_tier || 'HIGH_COMPETENCE_READY');
              return (
                <div style={{ marginBottom: 12 }}>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      padding: '4px 12px',
                      borderRadius: 14,
                      backgroundColor: b.bg,
                      color: b.color,
                      border: `1px solid ${b.border}`,
                      display: 'inline-block',
                    }}
                  >
                    {b.label}
                  </span>
                </div>
              );
            })()}

            <p style={{ fontSize: 13, color: isDark ? 'rgba(255,255,255,0.7)' : '#475569', lineHeight: 1.5, margin: 0 }}>
              {icrs?.interpretation ||
                'Combines your concept mastery, option elimination accuracy, time pacing, and stamina into a single UPSC preparedness score.'}
            </p>
            {renderInfoToggle(
              'icrs_info',
              'Evaluates whether your overall test strategy, subject grasp, and pace match the actual cutoff requirements of UPSC Prelims across a 7-tier scale.',
              'Weighted formula: 40% IRT Latent Ability + 25% Elimination Efficiency + 20% Pacing Balance + 15% Negative Guessing Penalty.',
              '80 or above indicates high readiness for Prelims cutoff.'
            )}
          </div>

          {/* IRT 3PL Latent Ability Card */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ padding: 8, borderRadius: 10, backgroundColor: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
                <Target size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>Actual Subject Ability Level</h3>
                <div style={{ fontSize: 11, color: '#64748b' }}>IRT 3PL Latent Ability ($\theta$)</div>
              </div>
            </div>
            <div style={{ fontSize: 36, fontWeight: 900, color: '#10b981', marginBottom: 4 }}>
              {irt?.latent_ability_theta !== undefined ? irt.latent_ability_theta.toFixed(2) : '+1.45'}{' '}
              <span style={{ fontSize: 16, color: '#64748b' }}>Theta</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#2563eb', marginBottom: 12 }}>
              Estimated Rank Percentile: {irt?.percentile_estimate || irt?.percentile_rank || 94}%
            </div>
            <p style={{ fontSize: 13, color: isDark ? 'rgba(255,255,255,0.7)' : '#475569', lineHeight: 1.5, margin: 0 }}>
              Psychometrically isolates your true knowledge from lucky guesses by scoring questions based on their exact difficulty and discrimination.
            </p>
            {renderInfoToggle(
              'irt_info',
              'Theta measures your genuine capability on a standard scale from -3.0 (low) to +3.0 (exceptional).',
              '3-Parameter Logistic (3PL) Item Response Theory model accounting for Difficulty (b), Discrimination (a), and Guessing (c).',
              '+1.0 or higher puts you comfortably in the top 10% of aspirants.'
            )}
          </div>

          {/* Impulsive Guessing Tendency (GTI - 5-Tier Scale) */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ padding: 8, borderRadius: 10, backgroundColor: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>Impulsive Guessing Risk</h3>
                <div style={{ fontSize: 11, color: '#64748b' }}>Guessing Tendency Index (GTI)</div>
              </div>
            </div>
            <div style={{ fontSize: 36, fontWeight: 900, color: '#f59e0b', marginBottom: 4 }}>
              {gti?.aggregate_gti !== undefined ? (gti.aggregate_gti * 100).toFixed(1) : '12.4'}{' '}
              <span style={{ fontSize: 16, color: '#64748b' }}>% Blind Risk</span>
            </div>

            {(() => {
              const b = getBadgeStyle(gti?.category || gti?.label || 'CONTROLLED_CALCULATED_RISK');
              return (
                <div style={{ marginBottom: 12 }}>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      padding: '4px 12px',
                      borderRadius: 14,
                      backgroundColor: b.bg,
                      color: b.color,
                      border: `1px solid ${b.border}`,
                      display: 'inline-block',
                    }}
                  >
                    {b.label}
                  </span>
                </div>
              );
            })()}

            <p style={{ fontSize: 13, color: isDark ? 'rgba(255,255,255,0.7)' : '#475569', lineHeight: 1.5, margin: 0 }}>
              {gti?.recommendation || 'Detects questions answered too quickly without sufficient reading time, triggering negative mark leakages.'}
            </p>
            {renderInfoToggle(
              'gti_info',
              'Identifies answers selected impulsively before processing all options across a 5-tier risk scale.',
              'Calculated when question time is below 40% of standard reading latency (e.g. answering in &lt;15s).',
              'Below 15% is ideal to avoid negative marking penalty.'
            )}
          </div>
        </div>
      )}

      {/* Tab 2: 10 Macro Psychometric Indices Breakdown */}
      {activeTab === 'macro' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
          {/* Pacing & Fatigue (7-Tier Scale) */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Clock size={18} color="#2563eb" />
              <h4 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: '#2563eb' }}>
                4. Time Management & Fatigue Skew
              </h4>
            </div>
            <div style={{ fontSize: 13, color: isDark ? 'rgba(255,255,255,0.8)' : '#334155', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div>Time Utilization: <strong>{pacing?.time_utilization_pct || 88}%</strong></div>
              <div>First vs Second Half Skew: <strong>{pacing?.skew_ratio || 1.12}x</strong></div>
              <div>
                Pacing Classification:{' '}
                {(() => {
                  const b = getBadgeStyle(pacing?.pacing_classification || pacing?.pacing_status || 'OPTIMAL_SUSTAINED_PACING');
                  return (
                    <span
                      style={{
                        fontSize: 11.5,
                        fontWeight: 700,
                        padding: '2px 10px',
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
            {renderInfoToggle(
              'pacing_info',
              'Monitors whether you rushed at the start or panicked at the end of the exam using a 7-tier scale.',
              'Compares average seconds spent on questions 1–50 vs questions 51–100.',
              'A skew ratio between 0.90 and 1.15 reflects optimal stamina distribution.'
            )}
          </div>

          {/* Option Elimination OEEI (5-Tier Scale) */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <CheckCircle2 size={18} color="#2563eb" />
              <h4 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: '#2563eb' }}>
                5. Option Elimination Precision
              </h4>
            </div>
            <div style={{ fontSize: 13, color: isDark ? 'rgba(255,255,255,0.8)' : '#334155', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div>Elimination Score: <strong>{oeei?.oeei_score || 84} / 100</strong></div>
              <div>
                Tactical Quality:{' '}
                {(() => {
                  const b = getBadgeStyle(oeei?.elimination_efficiency_rating || oeei?.elimination_rating || 'HIGH_TACTICAL_PRECISION');
                  return (
                    <span
                      style={{
                        fontSize: 11.5,
                        fontWeight: 700,
                        padding: '2px 10px',
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
            {renderInfoToggle(
              'oeei_info',
              'Measures your success rate when eliminating 1 or 2 options and selecting between remaining choices using a 5-tier precision scale.',
              'Assesses conversion rate on 50:50 and 33:67 option elimination situations.',
              'Score above 75 indicates strong elimination discipline.'
            )}
          </div>

          {/* SATOI Speed Accuracy Trade-off (5-Tier Scale) */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Activity size={18} color="#2563eb" />
              <h4 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: '#2563eb' }}>
                6. Speed vs Accuracy Balance (SATOI)
              </h4>
            </div>
            <div style={{ fontSize: 13, color: isDark ? 'rgba(255,255,255,0.8)' : '#334155', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div>Balance Score: <strong>{satoi?.satoi_score || 79} / 100</strong></div>
              <div>
                Stamina & Fatigue Status:{' '}
                {(() => {
                  const b = getBadgeStyle(satoi?.burnout_risk || satoi?.cognitive_stamina_status || 'STABLE_COGNITIVE_STAMINA');
                  return (
                    <span
                      style={{
                        fontSize: 11.5,
                        fontWeight: 700,
                        padding: '2px 10px',
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
            {renderInfoToggle(
              'satoi_info',
              'Detects if higher speed is costing you marks on easy/medium questions across 5 stamina decay levels.',
              'Correlation coefficient between question solve time and question accuracy.',
              'Score of 70–85 indicates optimal velocity without careless mistakes.'
            )}
          </div>

          {/* Option Switch Regret (5-Tier Scale) */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <RotateCcw size={18} color="#2563eb" />
              <h4 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: '#2563eb' }}>
                7. Answer Change Regret Ratio
              </h4>
            </div>
            <div style={{ fontSize: 13, color: isDark ? 'rgba(255,255,255,0.8)' : '#334155', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div>Changed Answers: <strong>{switchRegret?.switch_frequency || switchRegret?.total_switches || 3} times</strong></div>
              <div>Regret Ratio: <strong>{switchRegret?.regret_ratio !== undefined ? switchRegret.regret_ratio.toFixed(2) : '0.25'}</strong></div>
              <div>
                Regret Category:{' '}
                {(() => {
                  const b = getBadgeStyle(switchRegret?.regret_level || 'BALANCED_REVISION_OUTCOME');
                  return (
                    <span
                      style={{
                        fontSize: 11.5,
                        fontWeight: 700,
                        padding: '2px 10px',
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
            {renderInfoToggle(
              'switch_info',
              'Measures how often changing your initial option choice resulted in an incorrect answer (Regret) on a 5-tier scale.',
              'Percentage of switches that turned a correct answer into an incorrect one.',
              'Regret ratio below 0.30 means your second thoughts are generally trustworthy.'
            )}
          </div>

          {/* Bloom's Taxonomy Mastery */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Layers size={18} color="#2563eb" />
              <h4 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: '#2563eb' }}>
                8. Cognitive Thinking Level Mastery
              </h4>
            </div>
            <div style={{ fontSize: 13, color: isDark ? 'rgba(255,255,255,0.8)' : '#334155', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div>Direct Recall: <strong>{blooms?.remember_accuracy || blooms?.REMEMBER || 88}%</strong></div>
              <div>Conceptual Analysis: <strong>{blooms?.analyze_accuracy || blooms?.ANALYZE || 76}%</strong></div>
              <div>Critical Evaluation: <strong>{blooms?.evaluate_accuracy || blooms?.EVALUATE || 70}%</strong></div>
            </div>
            {renderInfoToggle(
              'blooms_info',
              'Categorizes question mastery by Bloom’s Taxonomy levels: Recall, Understanding, Analysis, and Critical Evaluation.',
              'Accuracy computed per cognitive complexity tag.',
              'Above 70% in Analysis & Evaluation is necessary for UPSC standard.'
            )}
          </div>

          {/* Distractor Closeness (7-Tier Scale) */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Target size={18} color="#2563eb" />
              <h4 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: '#2563eb' }}>
                10. Option Traps & Distractor Closeness
              </h4>
            </div>
            <div style={{ fontSize: 13, color: isDark ? 'rgba(255,255,255,0.8)' : '#334155', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div>Trap Resistance: <strong>{distractor?.trap_resistance_score || 82} / 100</strong></div>
              <div>Near-Miss Errors: <strong>{distractor?.near_miss_count || 2}</strong></div>
            </div>
            {renderInfoToggle(
              'distractor_info',
              'Measures your ability to avoid attractive trick options across 7 granular distractor classifications.',
              'Analyzes errors where the chosen incorrect option was classified from Near-Correct to Contradictory Opposing Fact.',
              'Trap resistance above 80 indicates deep conceptual clarity.'
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Topic FSRS Retention & Mastery (7-Tier Taxonomy Scale) */}
      {activeTab === 'topics' && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>
              Subject & Topic Mastery Breakdown (FSRS Retention Engine)
            </h3>
            {renderInfoToggle(
              'fsrs_info',
              'Uses the Free Spaced Repetition Scheduler (FSRS) to calculate memory stability across a 7-tier diagnostic scale.',
              'Models exponential forgetting curves $R = e^{-t/S}$ based on your revision intervals and accuracy.',
              'Stability rating of STRONG or EXCEPTIONAL indicates you will retain concepts through the exam day.'
            )}
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
                          <span
                            style={{
                              fontSize: 11,
                              padding: '3px 10px',
                              borderRadius: 12,
                              backgroundColor: b.bg,
                              color: b.color,
                              border: `1px solid ${b.border}`,
                              fontWeight: 700,
                              whiteSpace: 'nowrap',
                            }}
                          >
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

      {/* Tab 4: Per-Question Diagnostics Table */}
      {activeTab === 'questions' && (
        <div style={cardStyle}>
          <h3 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 16px 0' }}>Per-Question Item Diagnostics</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}` }}>
                  <th style={{ padding: 10 }}>#</th>
                  <th style={{ padding: 10 }}>Topic</th>
                  <th style={{ padding: 10 }}>Selected</th>
                  <th style={{ padding: 10 }}>Result</th>
                  <th style={{ padding: 10 }}>Option Trap Analysis</th>
                  <th style={{ padding: 10 }}>Time (Sec)</th>
                  <th style={{ padding: 10 }}>Points</th>
                </tr>
              </thead>
              <tbody>
                {(per_question_diagnostic_report || []).length > 0 ? (
                  (per_question_diagnostic_report || []).map((q) => (
                    <tr key={q.question_number} style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9'}` }}>
                      <td style={{ padding: 10, fontWeight: 800 }}>Q{q.question_number}</td>
                      <td style={{ padding: 10 }}>{q.topic_name}</td>
                      <td style={{ padding: 10, fontWeight: 700 }}>{q.user_selected_option}</td>
                      <td style={{ padding: 10 }}>
                        {q.is_answer_correct ? (
                          <span style={{ color: '#10b981', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <CheckCircle2 size={16} /> Correct
                          </span>
                        ) : (
                          <span style={{ color: '#ef4444', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <XCircle size={16} /> Incorrect
                          </span>
                        )}
                      </td>
                      <td style={{ padding: 10, fontSize: 12, color: isDark ? 'rgba(255,255,255,0.7)' : '#475569' }}>
                        {q.closeness_classification}
                      </td>
                      <td style={{ padding: 10 }}>{q.time_taken_seconds}s / {q.expected_time_seconds}s</td>
                      <td style={{ padding: 10, fontWeight: 800, color: q.final_points_awarded > 0 ? '#10b981' : '#ef4444' }}>
                        {q.final_points_awarded}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                      No per-question diagnostics available for this session.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: Markdown Audit Report Export */}
      {activeTab === 'markdown' && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Markdown Audit Report</h3>
            {markdownContent && (
              <button
                onClick={handleCopyMarkdown}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 10,
                  padding: '8px 16px',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                <Copy size={14} />
                <span>{copied ? 'Copied!' : 'Copy Markdown'}</span>
              </button>
            )}
          </div>
          <textarea
            readOnly
            value={markdownContent || JSON.stringify(report, null, 2)}
            style={{
              width: '100%',
              height: 450,
              backgroundColor: isDark ? '#0b1329' : '#f8fafc',
              color: isDark ? '#ffffff' : '#0f172a',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#cbd5e1'}`,
              borderRadius: 12,
              padding: 16,
              fontFamily: 'monospace',
              fontSize: 13,
              lineHeight: 1.5,
              resize: 'vertical',
            }}
          />
        </div>
      )}
    </div>
  );
}
