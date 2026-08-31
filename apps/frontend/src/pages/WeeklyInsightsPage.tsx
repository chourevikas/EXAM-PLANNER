import React, { useEffect, useState, useCallback, Suspense, lazy } from 'react';
import { StudentLayout } from '../components/student/StudentLayout';
import { Ico } from '../components/common/Icons';
import { fetchWeeklyInsights, WeeklyInsightsResponse } from '../services/studyPlannerService';
import { Loader2, Target, CheckCircle2, Clock, Award, AlertCircle, RefreshCw } from 'lucide-react';

// Code-split auxiliary testimonial component so it doesn't block weekly insights bundle/rendering
const StudentTestimonialForm = lazy(() =>
  import('../components/student/StudentTestimonialForm').then((m) => ({
    default: m.StudentTestimonialForm,
  }))
);

// ==================== STATIC MODULE STYLES (Zero GC allocation per render) ====================

const BANNER_SECTION_STYLE: React.CSSProperties = {
  marginBottom: 32,
  padding: 32,
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

const BANNER_TITLE_STYLE: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 800,
  color: 'var(--text-primary)',
  margin: '0 0 6px 0',
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
  padding: 32,
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
  fontSize: 15,
  fontWeight: 600,
  color: '#ef4444',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const RETRY_BUTTON_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '10px 20px',
  fontSize: 13.5,
  fontWeight: 700,
  color: '#ffffff',
  backgroundColor: '#E31B23',
  border: 'none',
  borderRadius: 0,
  cursor: 'pointer',
  boxShadow: '0 4px 12px rgba(227, 27, 35, 0.25)',
};

const METRIC_GRID_STYLE: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 16,
  marginBottom: 28,
};

const METRIC_CARD_STYLE: React.CSSProperties = {
  padding: 20,
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

const METRIC_VALUE_STYLE: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 800,
  color: 'var(--text-primary)',
};

const METRIC_SUB_STYLE: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--text-muted)',
};

const REPORT_GRID_STYLE: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
  gap: 24,
};

const REPORT_CARD_STYLE: React.CSSProperties = {
  backgroundColor: 'var(--bg-card)',
  padding: 28,
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
};

const REPORT_ICON_GOLD_STYLE: React.CSSProperties = {
  padding: 8,
  backgroundColor: 'rgba(245, 158, 11, 0.12)',
  color: '#F2B623',
  borderRadius: 0,
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

  return (
    <StudentLayout pageTitle="Weekly Insights">
      {/* Header Banner */}
      <section style={BANNER_SECTION_STYLE}>
        <div style={BANNER_BADGE_STYLE}>
          <Ico.Sparkles size={14} />
          <span style={BANNER_BADGE_TEXT_STYLE}>Weekly Executive Summary</span>
        </div>
        <h1 style={BANNER_TITLE_STYLE}>Weekly Performance Report</h1>
        <p style={BANNER_SUBTITLE_STYLE}>
          {data ? `Personalized weekly review for ${data.date_range_formatted}` : 'Synthesizing live weekly review metrics...'}
        </p>
      </section>

      {isLoading ? (
        <div style={LOADING_CONTAINER_STYLE}>
          <Loader2 size={28} className="animate-spin" color="#E31B23" />
          <span style={LOADING_TEXT_STYLE}>Generating Weekly Executive Insights...</span>
        </div>
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
          <div style={METRIC_GRID_STYLE}>
            <div style={METRIC_CARD_STYLE}>
              <div style={{ ...METRIC_HEADER_STYLE, color: '#E31B23' }}>
                <Clock size={20} />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>Logged Study Time</span>
              </div>
              <div style={METRIC_VALUE_STYLE}>{data.total_logged_hours} hrs</div>
              <span style={METRIC_SUB_STYLE}>Across {data.active_days_count} active days</span>
            </div>

            <div style={METRIC_CARD_STYLE}>
              <div style={{ ...METRIC_HEADER_STYLE, color: '#3A8B53' }}>
                <Target size={20} />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>Questions & Accuracy</span>
              </div>
              <div style={METRIC_VALUE_STYLE}>
                {data.total_questions_solved} Qs • {data.avg_accuracy}%
              </div>
              <span style={METRIC_SUB_STYLE}>Average test accuracy</span>
            </div>

            <div style={METRIC_CARD_STYLE}>
              <div style={{ ...METRIC_HEADER_STYLE, color: '#8b5cf6' }}>
                <CheckCircle2 size={20} />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>Target Completion</span>
              </div>
              <div style={METRIC_VALUE_STYLE}>{data.completion_rate}%</div>
              <span style={METRIC_SUB_STYLE}>{data.completed_tasks}/{data.total_tasks} study targets</span>
            </div>

            <div style={METRIC_CARD_STYLE}>
              <div style={{ ...METRIC_HEADER_STYLE, color: '#F2B623' }}>
                <Award size={20} />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>Primary Focus</span>
              </div>
              <div
                style={{
                  fontSize: 18,
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
          <div style={REPORT_GRID_STYLE}>
            {/* Card 1: Key Achievements */}
            <div style={REPORT_CARD_STYLE}>
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
            <div style={REPORT_CARD_STYLE}>
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
