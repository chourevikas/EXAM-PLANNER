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
  ChevronDown,
  ChevronUp,
  BarChart2,
  BookOpen,
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
            {metadata?.exam_attempt?.exam_name || 'Exam Attempt'}
          </h1>
          <p style={{ fontSize: 13, color: isDark ? 'rgba(255,255,255,0.7)' : '#64748b', margin: 0 }}>
            Candidate: <strong>{metadata?.candidate?.full_name || 'Candidate'}</strong> • Attempt Date:{' '}
            {metadata?.exam_attempt?.attempt_date ? new Date(metadata.exam_attempt.attempt_date).toLocaleDateString() : 'N/A'}
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
            <div style={{ fontSize: 11, fontWeight: 700, color: isDark ? 'rgba(255,255,255,0.5)' : '#64748b' }}>
              SCORE AWARDED
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#2563eb' }}>
              {metadata?.exam_attempt?.total_score_awarded ?? 0}{' '}
              <span style={{ fontSize: 14, color: isDark ? 'rgba(255,255,255,0.5)' : '#64748b' }}>
                / {metadata?.exam_attempt?.max_possible_score ?? 200}
              </span>
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
            <div style={{ fontSize: 11, fontWeight: 700, color: isDark ? 'rgba(255,255,255,0.5)' : '#64748b' }}>
              ICRS READINESS
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#10b981' }}>
              {icrs?.icrs_score || 78}<span style={{ fontSize: 14 }}>/100</span>
            </div>
          </div>
        </div>
      </section>

      {/* Report Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
          paddingBottom: 8,
          overflowX: 'auto',
        }}
      >
        {[
          { id: 'overview', label: 'Cognitive Readiness', icon: Brain },
          { id: 'macro', label: 'Psychometric Indices', icon: BarChart2 },
          { id: 'topics', label: 'Topic Retention (FSRS)', icon: BookOpen },
          { id: 'questions', label: 'Item Diagnostics', icon: Target },
          { id: 'markdown', label: 'Markdown Audit Report', icon: FileText },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 18px',
                borderRadius: 12,
                border: 'none',
                backgroundColor: isActive ? '#2563eb' : 'transparent',
                color: isActive ? '#ffffff' : isDark ? 'rgba(255,255,255,0.7)' : '#64748b',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Cognitive Readiness & Latent Ability Overview */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
          {/* ICRS Gauge Card */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ padding: 8, borderRadius: 10, backgroundColor: 'rgba(37,99,235,0.15)', color: '#2563eb' }}>
                <Zap size={20} />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>Integrated Cognitive Readiness (ICRS)</h3>
            </div>
            <div style={{ fontSize: 36, fontWeight: 900, color: '#2563eb', marginBottom: 4 }}>
              {icrs?.icrs_score || 82} <span style={{ fontSize: 16, color: '#64748b' }}>Index Score</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#10b981', marginBottom: 12 }}>
              {icrs?.classification || 'HIGH_COMPETENCE_READY'}
            </div>
            <p style={{ fontSize: 13, color: isDark ? 'rgba(255,255,255,0.7)' : '#475569', lineHeight: 1.5, margin: 0 }}>
              {icrs?.interpretation ||
                'Unified score evaluating IRT concept mastery, elimination discipline, time pacing, and cognitive stamina.'}
            </p>
          </div>

          {/* IRT 3PL Latent Ability Card */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ padding: 8, borderRadius: 10, backgroundColor: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
                <Target size={20} />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>IRT 3PL Latent Ability ($\theta$)</h3>
            </div>
            <div style={{ fontSize: 36, fontWeight: 900, color: '#10b981', marginBottom: 4 }}>
              {irt?.latent_ability_theta !== undefined ? irt.latent_ability_theta.toFixed(2) : '+1.45'}{' '}
              <span style={{ fontSize: 16, color: '#64748b' }}>Theta</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#2563eb', marginBottom: 12 }}>
              Estimated Rank Percentile: {irt?.percentile_estimate || 94}%
            </div>
            <p style={{ fontSize: 13, color: isDark ? 'rgba(255,255,255,0.7)' : '#475569', lineHeight: 1.5, margin: 0 }}>
              Derived using 3-Parameter Logistic (3PL) Item Response Theory incorporating item difficulty, discrimination, and guessing.
            </p>
          </div>

          {/* Impulsive Guessing Tendency (GTI) */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ padding: 8, borderRadius: 10, backgroundColor: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
                <AlertTriangle size={20} />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>Guessing Tendency Index (GTI)</h3>
            </div>
            <div style={{ fontSize: 36, fontWeight: 900, color: '#f59e0b', marginBottom: 4 }}>
              {gti?.aggregate_gti !== undefined ? (gti.aggregate_gti * 100).toFixed(1) : '12.4'}{' '}
              <span style={{ fontSize: 16, color: '#64748b' }}>% Impulsive Risk</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b', marginBottom: 12 }}>
              Category: {gti?.label || 'Controlled / Calculated Risk'}
            </div>
            <p style={{ fontSize: 13, color: isDark ? 'rgba(255,255,255,0.7)' : '#475569', lineHeight: 1.5, margin: 0 }}>
              {gti?.recommendation || 'Measures uncalculated rapid guessing based on response latency thresholds.'}
            </p>
          </div>
        </div>
      )}

      {/* Tab 2: 10 Macro Psychometric Indices Breakdown */}
      {activeTab === 'macro' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
          {/* Pacing & Fatigue */}
          <div style={cardStyle}>
            <h4 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 10px 0', color: '#2563eb' }}>
              4. Macro Pacing & Time Skew
            </h4>
            <div style={{ fontSize: 13, color: isDark ? 'rgba(255,255,255,0.8)' : '#334155', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div>Time Utilization: <strong>{pacing?.time_utilization_pct || 88}%</strong></div>
              <div>First vs Second Half Skew Ratio: <strong>{pacing?.skew_ratio || 1.12}</strong></div>
              <div>Pacing Status: <span style={{ color: '#10b981', fontWeight: 700 }}>{pacing?.pacing_classification || 'BALANCED_SUSTAINED_PACING'}</span></div>
            </div>
          </div>

          {/* Option Elimination OEEI */}
          <div style={cardStyle}>
            <h4 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 10px 0', color: '#2563eb' }}>
              5. Option Elimination Efficiency (OEEI)
            </h4>
            <div style={{ fontSize: 13, color: isDark ? 'rgba(255,255,255,0.8)' : '#334155', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div>OEEI Score: <strong>{oeei?.oeei_score || 84}/100</strong></div>
              <div>Elimination Discipline: <span style={{ color: '#10b981', fontWeight: 700 }}>{oeei?.elimination_efficiency_rating || 'HIGH_TACTICAL_PRECISION'}</span></div>
            </div>
          </div>

          {/* SATOI Speed Accuracy Trade-off */}
          <div style={cardStyle}>
            <h4 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 10px 0', color: '#2563eb' }}>
              6. Speed-Accuracy Trade-off & Fatigue (SATOI)
            </h4>
            <div style={{ fontSize: 13, color: isDark ? 'rgba(255,255,255,0.8)' : '#334155', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div>SATOI Score: <strong>{satoi?.satoi_score || 79}/100</strong></div>
              <div>Burnout Risk: <span style={{ color: '#10b981', fontWeight: 700 }}>{satoi?.burnout_risk || 'LOW_STAMINA_DECAY'}</span></div>
            </div>
          </div>

          {/* Option Switch Regret */}
          <div style={cardStyle}>
            <h4 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 10px 0', color: '#2563eb' }}>
              7. Option Switch & Regret Matrix
            </h4>
            <div style={{ fontSize: 13, color: isDark ? 'rgba(255,255,255,0.8)' : '#334155', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div>Switch Frequency: <strong>{switchRegret?.switch_frequency || 3} questions</strong></div>
              <div>Regret Ratio: <strong>{switchRegret?.regret_ratio !== undefined ? switchRegret.regret_ratio.toFixed(2) : '0.25'}</strong></div>
              <div>Recommendation: <span>{switchRegret?.recommendation || 'Trust initial instincts on medium items.'}</span></div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Topic FSRS Retention & Mastery */}
      {activeTab === 'topics' && (
        <div style={cardStyle}>
          <h3 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 16px 0' }}>
            Subject & Topic Taxonomy Mastery (FSRS Retention Engine)
          </h3>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}` }}>
                  <th style={{ padding: 12 }}>Taxonomy Name</th>
                  <th style={{ padding: 12 }}>Type</th>
                  <th style={{ padding: 12 }}>Attempts</th>
                  <th style={{ padding: 12 }}>Accuracy %</th>
                  <th style={{ padding: 12 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {(user_overall_skill_profile?.taxonomy_mastery_breakdown || []).length > 0 ? (
                  (user_overall_skill_profile?.taxonomy_mastery_breakdown || []).map((item, idx) => (
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
                            backgroundColor:
                              item.strength_status === 'STRONG'
                                ? 'rgba(16, 185, 129, 0.15)'
                                : item.strength_status === 'MODERATE'
                                ? 'rgba(245, 158, 11, 0.15)'
                                : 'rgba(239, 68, 68, 0.15)',
                            color:
                              item.strength_status === 'STRONG'
                                ? '#10b981'
                                : item.strength_status === 'MODERATE'
                                ? '#d97706'
                                : '#ef4444',
                            fontWeight: 700,
                          }}
                        >
                          {item.strength_status}
                        </span>
                      </td>
                    </tr>
                  ))
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
                  <th style={{ padding: 10 }}>Distractor Classification</th>
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
