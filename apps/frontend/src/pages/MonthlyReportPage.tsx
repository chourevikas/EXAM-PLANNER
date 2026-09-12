import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { StudentLayout } from '../components/student/StudentLayout';
import { Ico } from '../components/common/Icons';
import { fetchMonthlyBenchmark, MonthlyBenchmarkResponse } from '../services/analyticsService';
import { TrendingUp, Award, Target, BarChart2, ShieldCheck, RefreshCw, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import StudentMetricCard from '../components/student/StudentMetricCard';
import { formatEnum } from '../utils/formatEnum';
import { useBreakpoint } from '../hooks/useBreakpoint';

const ITEMS_PER_PAGE = 4;

// ==================== BASE MODULE STYLES ====================

const BANNER_BASE_STYLE: React.CSSProperties = {
  borderRadius: 0,
  backgroundColor: 'var(--bg-card)',
  border: '1px solid #E2E8F0',
  boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
  backgroundImage: 'linear-gradient(135deg, rgba(16,185,129,0.04) 0%, rgba(var(--primary-red-rgb), 0.04) 100%)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 16,
};

const BANNER_BADGE_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '4px 12px',
  backgroundColor: 'rgba(58, 139, 83, 0.1)',
  borderRadius: 0,
  marginBottom: 10,
};

const BANNER_BADGE_TEXT_STYLE: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: 'var(--success-green)',
  textTransform: 'uppercase',
};

const BANNER_TITLE_BASE_STYLE: React.CSSProperties = {
  fontWeight: 800,
  color: 'var(--text-primary)',
  margin: '0 0 6px 0',
  letterSpacing: '-0.02em',
};

const BANNER_SUBTITLE_STYLE: React.CSSProperties = {
  fontSize: 14,
  color: 'var(--text-muted)',
  margin: 0,
};

const ERROR_BOX_STYLE: React.CSSProperties = {
  padding: 16,
  borderRadius: 0,
  backgroundColor: 'rgba(var(--primary-red-rgb), 0.1)',
  border: '1px solid #FCA5A5',
  color: 'var(--primary-red)',
  marginBottom: 24,
  fontSize: 13.5,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const SKELETON_CARD_STYLE: React.CSSProperties = {
  backgroundColor: 'var(--bg-card)',
  padding: 24,
  borderRadius: 0,
  border: '1px solid #E2E8F0',
  height: 136,
  animation: 'pulse 1.5s infinite ease-in-out',
};

const CARD_BASE_STYLE: React.CSSProperties = {
  backgroundColor: 'var(--bg-card)',
  borderRadius: 0,
  border: '1px solid #E2E8F0',
  boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  boxSizing: 'border-box',
};

const CARD_HEADER_STYLE: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 16,
  flexWrap: 'wrap',
  gap: 8,
};

const CARD_TITLE_STYLE: React.CSSProperties = {
  fontSize: 15.5,
  fontWeight: 700,
  color: 'var(--text-primary)',
  margin: 0,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const CARD_BADGE_STYLE: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  padding: '3px 8px',
  borderRadius: 0,
  backgroundColor: 'var(--bg-base)',
  color: 'var(--primary-red)',
};

const SUBJECT_BADGE_STYLE: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  padding: '3px 8px',
  borderRadius: 0,
  backgroundColor: 'rgba(58, 139, 83, 0.1)',
  color: 'var(--success-green)',
};

const CARD_FOOTER_STYLE: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingTop: 14,
  borderTop: '1px solid #F1F5F9',
  marginTop: 16,
};

const EMPTY_STATE_STYLE: React.CSSProperties = {
  textAlign: 'center',
  color: 'var(--text-muted)',
  fontSize: 13,
  padding: 30,
};

const BASE_PAGE_BTN_STYLE: React.CSSProperties = {
  borderRadius: 0,
  border: '1px solid #E2E8F0',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 40,
  minHeight: 40,
  padding: '6px 10px',
  transition: 'all 0.15s ease',
};

// ==================== MAIN COMPONENT ====================

export function MonthlyReportPage() {
  const { getToken } = useAuth();
  const [data, setData] = useState<MonthlyBenchmarkResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [growthPage, setGrowthPage] = useState<number>(0);
  const [subjectPage, setSubjectPage] = useState<number>(0);

  const { isMobile, isTabletOrBelow } = useBreakpoint();

  const loadBenchmarkData = useCallback(
    async (signal?: AbortSignal, forceRefresh: boolean = false) => {
      setLoading(true);
      setError(null);
      try {
        let token = localStorage.getItem('access_token');
        if (!token || forceRefresh) {
          try {
            const clerkToken = await getToken();
            if (clerkToken) {
              token = clerkToken;
              localStorage.setItem('access_token', clerkToken);
            }
          } catch (e) {
            console.warn('Could not retrieve fresh Clerk token:', e);
          }
        }

        const res = await fetchMonthlyBenchmark(token || undefined, {
          signal,
          forceRefresh,
        });
        if (!signal?.aborted) {
          setData(res);
        }
      } catch (err: any) {
        if (err?.name === 'AbortError' || signal?.aborted) {
          return;
        }
        console.error(err);
        setError('Failed to fetch real-time national benchmarking data. Please try again.');
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [getToken]
  );

  useEffect(() => {
    const controller = new AbortController();
    loadBenchmarkData(controller.signal, false);

    return () => {
      controller.abort();
    };
  }, [loadBenchmarkData]);

  // Memoize pagination slices so hover or sibling state changes do not recalculate slices
  const growthCurve = data?.monthly_growth_curve;
  const growthTotalPages = useMemo(
    () => Math.max(1, Math.ceil((growthCurve?.length || 0) / ITEMS_PER_PAGE)),
    [growthCurve?.length]
  );

  const visibleGrowthItems = useMemo(
    () => growthCurve?.slice(growthPage * ITEMS_PER_PAGE, (growthPage + 1) * ITEMS_PER_PAGE) || [],
    [growthCurve, growthPage]
  );

  const subjectBenchmark = data?.subject_benchmark;
  const subjectTotalPages = useMemo(
    () => Math.max(1, Math.ceil((subjectBenchmark?.length || 0) / ITEMS_PER_PAGE)),
    [subjectBenchmark?.length]
  );

  const visibleSubjectItems = useMemo(
    () => subjectBenchmark?.slice(subjectPage * ITEMS_PER_PAGE, (subjectPage + 1) * ITEMS_PER_PAGE) || [],
    [subjectBenchmark, subjectPage]
  );

  const handleRefresh = () => {
    loadBenchmarkData(undefined, true);
  };

  // Responsive dynamic styles
  const bannerSectionStyle: React.CSSProperties = {
    ...BANNER_BASE_STYLE,
    padding: isMobile ? '16px 14px' : isTabletOrBelow ? '20px 20px' : '24px 28px',
    marginBottom: isMobile ? 20 : 32,
    flexDirection: isMobile ? 'column' : 'row',
    alignItems: isMobile ? 'stretch' : 'center',
  };

  const bannerTitleStyle: React.CSSProperties = {
    ...BANNER_TITLE_BASE_STYLE,
    fontSize: isMobile ? 20 : isTabletOrBelow ? 23 : 26,
  };

  const refreshBtnStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '9px 18px',
    minHeight: 44,
    width: isMobile ? '100%' : 'auto',
    borderRadius: 0,
    backgroundColor: 'var(--bg-base)',
    border: '1px solid #E2E8F0',
    color: 'var(--text-primary)',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  };

  const metricGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: isMobile
      ? '1fr'
      : isTabletOrBelow
      ? 'repeat(2, 1fr)'
      : 'repeat(3, 1fr)',
    gap: isMobile ? 12 : 20,
    marginBottom: isMobile ? 20 : 32,
  };

  const analyticsGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: isTabletOrBelow ? '1fr' : 'repeat(2, 1fr)',
    gap: isMobile ? 16 : 24,
    marginBottom: isMobile ? 20 : 32,
  };

  const cardStyle: React.CSSProperties = {
    ...CARD_BASE_STYLE,
    padding: isMobile ? '18px 14px' : 24,
    minHeight: isMobile ? 'auto' : 420,
  };

  return (
    <StudentLayout pageTitle="Performance Rank & Monthly Report">
      {/* Header Banner */}
      <section style={bannerSectionStyle}>
        <div>
          <div style={BANNER_BADGE_STYLE}>
            <Ico.Trophy size={14} />
            <span style={BANNER_BADGE_TEXT_STYLE}>National Benchmarking</span>
          </div>
          <h1 style={bannerTitleStyle}>Monthly Performance & National Rank</h1>
          <p style={BANNER_SUBTITLE_STYLE}>
            Percentile growth curve and exam readiness index for {data?.period || 'August 2026'}.
          </p>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={loading}
          style={refreshBtnStyle}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Metrics</span>
        </button>
      </section>

      {error && (
        <div style={ERROR_BOX_STYLE}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div style={metricGridStyle}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={SKELETON_CARD_STYLE} />
          ))}
        </div>
      ) : (
        <>
          {/* Main Stats Grid aligned with Dashboard StudentMetricCard */}
          <div style={metricGridStyle}>
            {/* 1. Predicted AIR */}
            <StudentMetricCard
              title="PREDICTED ALL INDIA RANK"
              value={`#${data?.predicted_rank ? data.predicted_rank.toLocaleString() : '---'}`}
              supportingText={
                <span style={{ color: 'var(--success-green)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <TrendingUp size={14} /> Top {data?.top_percentage ?? 0}% among {data?.active_aspirants ? data.active_aspirants.toLocaleString() : '24,000'}+ active aspirants
                </span>
              }
              icon={<Award size={18} />}
              accentColor="var(--primary-red)"
            />

            {/* 2. Overall Percentile */}
            <StudentMetricCard
              title="OVERALL PERCENTILE"
              value={`${data?.overall_percentile ?? 0} %ile`}
              supportingText={
                <span style={{ color: data?.percentile_delta && data.percentile_delta >= 0 ? 'var(--success-green)' : 'var(--warning-yellow)' }}>
                  {data?.percentile_delta && data.percentile_delta >= 0 ? '↑ Up' : '↓ Down'} {Math.abs(data?.percentile_delta ?? 0)} %ile from last month ({data?.previous_month_percentile ?? 0} %ile)
                </span>
              }
              icon={<BarChart2 size={18} />}
              accentColor="#3A8B53"
            />

            {/* 3. Exam Readiness Index */}
            <StudentMetricCard
              title="EXAM READINESS INDEX"
              value={`${data?.readiness_index ?? 0} / 100`}
              supportingText={data?.readiness_status ?? 'High probability of clearing Prelims cutoff'}
              icon={<ShieldCheck size={18} />}
              accentColor="#F2B623"
            />
          </div>

          {/* Detailed Analytics Grid: Symmetrical Heights & Pagination */}
          <div style={analyticsGridStyle}>
            {/* Monthly Percentile Growth Curve Card */}
            <div style={cardStyle}>
              <div>
                <div style={CARD_HEADER_STYLE}>
                  <h3 style={CARD_TITLE_STYLE}>
                    <TrendingUp size={18} color="var(--primary-red)" /> Monthly Percentile Growth Trajectory
                  </h3>
                  <span style={CARD_BADGE_STYLE}>
                    {data?.monthly_growth_curve?.length || 0} Months Tracked
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 12 }}>
                  {visibleGrowthItems.map((pt, idx) => (
                    <div key={`growth_${pt.month}_${idx}`} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600 }}>
                        <span style={{ color: 'var(--text-primary)' }}>{pt.month}</span>
                        <span style={{ color: 'var(--primary-red)' }}>{pt.percentile} %ile</span>
                      </div>
                      <div style={{ height: 10, width: '100%', backgroundColor: 'var(--bg-muted)', borderRadius: 0, overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${Math.min(pt.percentile, 100)}%`,
                            background: 'linear-gradient(90deg, var(--primary-red) 0%, #3A8B53 100%)',
                            borderRadius: 0,
                            transition: 'width 0.6s ease',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                  {visibleGrowthItems.length === 0 && (
                    <div style={EMPTY_STATE_STYLE}>No growth trajectory records available.</div>
                  )}
                </div>
              </div>

              {/* Card Pagination Footer */}
              <div style={CARD_FOOTER_STYLE}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
                  Page {growthPage + 1} of {growthTotalPages}
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => setGrowthPage((p) => Math.max(0, p - 1))}
                    disabled={growthPage === 0}
                    style={{
                      ...BASE_PAGE_BTN_STYLE,
                      backgroundColor: growthPage === 0 ? 'var(--bg-base)' : 'var(--bg-card)',
                      color: growthPage === 0 ? 'var(--text-muted)' : 'var(--text-primary)',
                      cursor: growthPage === 0 ? 'not-allowed' : 'pointer',
                    }}
                    aria-label="Previous growth page"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setGrowthPage((p) => Math.min(growthTotalPages - 1, p + 1))}
                    disabled={growthPage >= growthTotalPages - 1}
                    style={{
                      ...BASE_PAGE_BTN_STYLE,
                      backgroundColor: growthPage >= growthTotalPages - 1 ? 'var(--bg-base)' : 'var(--bg-card)',
                      color: growthPage >= growthTotalPages - 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                      cursor: growthPage >= growthTotalPages - 1 ? 'not-allowed' : 'pointer',
                    }}
                    aria-label="Next growth page"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Subject National Benchmarking Card */}
            <div style={cardStyle}>
              <div>
                <div style={CARD_HEADER_STYLE}>
                  <h3 style={CARD_TITLE_STYLE}>
                    <Target size={18} color="#3A8B53" /> Subject Accuracy vs National Average
                  </h3>
                  <span style={SUBJECT_BADGE_STYLE}>
                    {data?.subject_benchmark?.length || 0} Subjects
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                  {visibleSubjectItems.map((sb, idx) => (
                    <div key={`subject_${sb.subject}_${idx}`} style={{ padding: '8px 12px', borderRadius: 0, backgroundColor: 'var(--bg-base)', border: '1px solid #F1F5F9' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5, fontWeight: 700, marginBottom: 4, gap: 8 }}>
                        <span style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {formatEnum(sb.subject)}
                        </span>
                        <span style={{ color: sb.user_accuracy >= sb.national_avg_accuracy ? 'var(--success-green)' : 'var(--warning-yellow)', flexShrink: 0 }}>
                          {sb.user_accuracy}%{' '}
                          <span style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 400 }}>
                            (Nat: {sb.national_avg_accuracy}%)
                          </span>
                        </span>
                      </div>

                      {/* Visual Comparison Bars */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ height: 5, width: '100%', backgroundColor: 'var(--border-color)', borderRadius: 0, overflow: 'hidden' }}>
                          <div
                            style={{
                              height: '100%',
                              width: `${sb.user_accuracy}%`,
                              backgroundColor: sb.user_accuracy >= sb.national_avg_accuracy ? 'var(--success-green)' : 'var(--warning-yellow)',
                              borderRadius: 0,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  {visibleSubjectItems.length === 0 && (
                    <div style={EMPTY_STATE_STYLE}>No subject benchmark data calculated yet.</div>
                  )}
                </div>
              </div>

              {/* Card Pagination Footer */}
              <div style={CARD_FOOTER_STYLE}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
                  Page {subjectPage + 1} of {subjectTotalPages}
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => setSubjectPage((p) => Math.max(0, p - 1))}
                    disabled={subjectPage === 0}
                    style={{
                      ...BASE_PAGE_BTN_STYLE,
                      backgroundColor: subjectPage === 0 ? 'var(--bg-base)' : 'var(--bg-card)',
                      color: subjectPage === 0 ? 'var(--text-muted)' : 'var(--text-primary)',
                      cursor: subjectPage === 0 ? 'not-allowed' : 'pointer',
                    }}
                    aria-label="Previous subject page"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubjectPage((p) => Math.min(subjectTotalPages - 1, p + 1))}
                    disabled={subjectPage >= subjectTotalPages - 1}
                    style={{
                      ...BASE_PAGE_BTN_STYLE,
                      backgroundColor: subjectPage >= subjectTotalPages - 1 ? 'var(--bg-base)' : 'var(--bg-card)',
                      color: subjectPage >= subjectTotalPages - 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                      cursor: subjectPage >= subjectTotalPages - 1 ? 'not-allowed' : 'pointer',
                    }}
                    aria-label="Next subject page"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </StudentLayout>
  );
}
