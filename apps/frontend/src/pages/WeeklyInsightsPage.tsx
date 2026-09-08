import React, { useEffect, useState, useCallback, Suspense, lazy } from 'react';
import { StudentLayout } from '../components/student/StudentLayout';
import { Ico } from '../components/common/Icons';
import { fetchWeeklyInsights, WeeklyInsightsResponse } from '../services/studyPlannerService';
import { Target, CheckCircle2, Clock, Award, AlertCircle, RefreshCw } from 'lucide-react';
import { Spinner } from '../components/common/Spinner';
import { useBreakpoint } from '../hooks/useBreakpoint';

// Code-split auxiliary testimonial component so it doesn't block weekly insights bundle/rendering
const StudentTestimonialForm = lazy(() =>
  import('../components/student/StudentTestimonialForm').then((m) => ({
    default: m.StudentTestimonialForm,
  }))
);

// ==================== BASE MODULE STYLES ====================

const BANNER_BASE_STYLE: React.CSSProperties = {
  borderRadius: 0,
  backgroundColor: 'var(--bg-card)',
  border: '1px solid var(--border-default)',
  boxShadow: 'var(--shadow-color-base)',
  backgroundImage: 'linear-gradient(135deg, rgba(219,39,119,0.06) 0%, rgba(91,92,235,0.06) 100%)',
};

const BANNER_BADGE_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '4px 12px',
  backgroundColor: 'rgba(219, 39, 119, 0.1)',
  borderRadius: 0,
  marginBottom: 10,
  border: '1px solid rgba(219, 39, 119, 0.25)',
};

const BANNER_BADGE_TEXT_STYLE: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: '#db2777',
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

const LOADING_CONTAINER_STYLE: React.CSSProperties = {
  padding: 48,
  textAlign: 'center',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 12,
};

const LOADING_TEXT_STYLE: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  color: 'var(--text-primary)',
};

const ERROR_CONTAINER_STYLE: React.CSSProperties = {
  padding: 24,
  textAlign: 'center',
  backgroundColor: 'var(--bg-card)',
  border: '1px solid var(--border-default)',
  borderRadius: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 16,
};

const ERROR_MESSAGE_STYLE: React.CSSProperties = {
  fontSize: 14.5,
  fontWeight: 600,
  color: '#ef4444',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const RETRY_BUTTON_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  padding: '10px 20px',
  minHeight: 44,
  fontSize: 13.5,
  fontWeight: 700,
  color: '#ffffff',
  backgroundColor: '#E31B23',
  border: 'none',
  borderRadius: 0,
  cursor: 'pointer',
  boxShadow: '0 4px 12px rgba(227, 27, 35, 0.25)',
};

const METRIC_CARD_BASE_STYLE: React.CSSProperties = {
  borderRadius: 0,
  backgroundColor: 'var(--bg-card)',
  border: '1px solid var(--border-default)',
};

const METRIC_HEADER_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  marginBottom: 8,
};

const METRIC_SUB_STYLE: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--text-muted)',
};

const REPORT_CARD_BASE_STYLE: React.CSSProperties = {
  backgroundColor: 'var(--bg-card)',
  borderRadius: 0,
  border: '1px solid var(--border-default)',
};

const REPORT_CARD_HEADER_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  marginBottom: 16,
};

const REPORT_ICON_GREEN_STYLE: React.CSSProperties = {
  padding: 8,
  backgroundColor: 'rgba(16, 185, 129, 0.12)',
  color: '#3A8B53',
  borderRadius: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const REPORT_ICON_GOLD_STYLE: React.CSSProperties = {
  padding: 8,
  backgroundColor: 'rgba(245, 158, 11, 0.12)',
  color: '#F2B623',
  borderRadius: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const REPORT_CARD_TITLE_STYLE: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  margin: 0,
};

const REPORT_LIST_STYLE: React.CSSProperties = {
  paddingLeft: 20,
  margin: 0,
  fontSize: 14,
  color: 'var(--text-secondary)',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
};

const REPORT_LIST_ITEM_STYLE: React.CSSProperties = {
  lineHeight: 1.5,
};

// ==================== MAIN COMPONENT ====================

export function WeeklyInsightsPage() {
  const [data, setData] = useState<WeeklyInsightsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { isMobile, isTabletOrBelow } = useBreakpoint();

  const loadInsights = useCallback(async (signal?: AbortSignal, forceRefresh: boolean = false) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchWeeklyInsights(undefined, { signal, forceRefresh });
      if (!signal?.aborted) {
        setData(res);
      }
    } catch (err: any) {
      if (err?.name === 'AbortError' || signal?.aborted) {
        return;
      }
      console.warn('Failed to load weekly insights:', err);
      if (err?.status === 401 || err?.status === 403) {
        setError('Your session has expired. Please refresh or sign in again.');
      } else if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setError('No internet connection. Please check your network and retry.');
      } else {
        setError('Unable to load weekly performance report. Please try again.');
      }
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadInsights(controller.signal, false);

    return () => {
      controller.abort();
    };
  }, [loadInsights]);

  const handleRetry = () => {
    loadInsights(undefined, true);
  };

  // Responsive dynamic styles
  const bannerStyle: React.CSSProperties = {
    ...BANNER_BASE_STYLE,
    padding: isMobile ? '18px 16px' : isTabletOrBelow ? '24px 24px' : '32px 32px',
    marginBottom: isMobile ? 20 : 32,
  };

  const bannerTitleStyle: React.CSSProperties = {
    ...BANNER_TITLE_BASE_STYLE,
    fontSize: isMobile ? 21 : isTabletOrBelow ? 24 : 28,
  };

  const metricGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: isMobile
      ? '1fr'
      : isTabletOrBelow
      ? 'repeat(2, 1fr)'
      : 'repeat(4, 1fr)',
    gap: isMobile ? 12 : 16,
    marginBottom: isMobile ? 20 : 28,
  };

  const metricCardStyle: React.CSSProperties = {
    ...METRIC_CARD_BASE_STYLE,
    padding: isMobile ? 16 : 20,
  };

  const metricValueStyle: React.CSSProperties = {
    fontSize: isMobile ? 19 : 22,
    fontWeight: 800,
    color: 'var(--text-primary)',
  };

  const reportGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: isTabletOrBelow ? '1fr' : 'repeat(2, 1fr)',
    gap: isMobile ? 16 : 24,
    marginBottom: isMobile ? 20 : 32,
  };

  const reportCardStyle: React.CSSProperties = {
    ...REPORT_CARD_BASE_STYLE,
    padding: isMobile ? '20px 16px' : '28px 24px',
  };

  return (
    <StudentLayout pageTitle="Weekly Insights">
      {/* Header Banner */}
      <section style={bannerStyle}>
        <div style={BANNER_BADGE_STYLE}>
          <Ico.Sparkles size={14} />
          <span style={BANNER_BADGE_TEXT_STYLE}>Weekly Executive Summary</span>
        </div>
        <h1 style={bannerTitleStyle}>Weekly Performance Report</h1>
        <p style={BANNER_SUBTITLE_STYLE}>
          {data ? `Personalized weekly review for ${data.date_range_formatted}` : 'Synthesizing live weekly review metrics...'}
        </p>
      </section>

      {isLoading ? (
        <Spinner size={32} label="Generating Weekly Executive Insights…" />
      ) : error ? (
        <div style={ERROR_CONTAINER_STYLE}>
          <div style={ERROR_MESSAGE_STYLE}>
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
          <button type="button" onClick={handleRetry} style={RETRY_BUTTON_STYLE}>
            <RefreshCw size={16} />
            <span>Try Again</span>
          </button>
        </div>
      ) : data ? (
        <>
          {/* Top Metric Cards */}
          <div style={metricGridStyle}>
            <div style={metricCardStyle}>
              <div style={{ ...METRIC_HEADER_STYLE, color: '#E31B23' }}>
                <Clock size={20} />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>Logged Study Time</span>
              </div>
              <div style={metricValueStyle}>{data.total_logged_hours} hrs</div>
              <span style={METRIC_SUB_STYLE}>Across {data.active_days_count} active days</span>
            </div>

            <div style={metricCardStyle}>
              <div style={{ ...METRIC_HEADER_STYLE, color: '#3A8B53' }}>
                <Target size={20} />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>Questions & Accuracy</span>
              </div>
              <div style={metricValueStyle}>
                {data.total_questions_solved} Qs • {data.avg_accuracy}%
              </div>
              <span style={METRIC_SUB_STYLE}>Average test accuracy</span>
            </div>

            <div style={metricCardStyle}>
              <div style={{ ...METRIC_HEADER_STYLE, color: '#8b5cf6' }}>
                <CheckCircle2 size={20} />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>Target Completion</span>
              </div>
              <div style={metricValueStyle}>{data.completion_rate}%</div>
              <span style={METRIC_SUB_STYLE}>{data.completed_tasks}/{data.total_tasks} study targets</span>
            </div>

            <div style={metricCardStyle}>
              <div style={{ ...METRIC_HEADER_STYLE, color: '#F2B623' }}>
                <Award size={20} />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>Primary Focus</span>
              </div>
              <div
                style={{
                  fontSize: isMobile ? 16 : 18,
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {data.top_subject}
              </div>
              <span style={METRIC_SUB_STYLE}>Dominant weekly subject</span>
            </div>
          </div>

          {/* Grid of Report Cards */}
          <div style={reportGridStyle}>
            {/* Card 1: Key Achievements */}
            <div style={reportCardStyle}>
              <div style={REPORT_CARD_HEADER_STYLE}>
                <div style={REPORT_ICON_GREEN_STYLE}>
                  <Ico.Trophy size={18} />
                </div>
                <h3 style={REPORT_CARD_TITLE_STYLE}>Weekly Highlights</h3>
              </div>
              <ul style={REPORT_LIST_STYLE}>
                {data.highlights.map((item, idx) => (
                  <li key={`highlight_${idx}_${item.slice(0, 16)}`} style={REPORT_LIST_ITEM_STYLE}>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Card 2: Recommended Revision */}
            <div style={reportCardStyle}>
              <div style={REPORT_CARD_HEADER_STYLE}>
                <div style={REPORT_ICON_GOLD_STYLE}>
                  <Ico.Brain size={18} />
                </div>
                <h3 style={REPORT_CARD_TITLE_STYLE}>Focus Next Week</h3>
              </div>
              <ul style={REPORT_LIST_STYLE}>
                {data.focus_next_week.map((item, idx) => (
                  <li key={`focus_${idx}_${item.slice(0, 16)}`} style={REPORT_LIST_ITEM_STYLE}>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Student Testimonial Submission Form (Lazy-loaded) */}
          <Suspense fallback={null}>
            <StudentTestimonialForm />
          </Suspense>
        </>
      ) : null}
    </StudentLayout>
  );
}
