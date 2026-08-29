import React, { useEffect, useState } from 'react';
import { StudentLayout } from '../components/student/StudentLayout';
import { Ico } from '../components/common/Icons';
import { fetchWeeklyInsights, WeeklyInsightsResponse } from '../services/studyPlannerService';
import { StudentTestimonialForm } from '../components/student/StudentTestimonialForm';
import { Loader2, Target, CheckCircle2, Clock, Award } from 'lucide-react';

export function WeeklyInsightsPage() {
  const [data, setData] = useState<WeeklyInsightsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadInsights() {
      setIsLoading(true);
      try {
        const res = await fetchWeeklyInsights();
        setData(res);
      } catch (err: any) {
        console.warn('Failed to load weekly insights:', err);
        setError('Unable to load weekly performance report.');
      } finally {
        setIsLoading(false);
      }
    }

    loadInsights();
  }, []);

  return (
    <StudentLayout pageTitle="Weekly Insights">
      {/* Header Banner */}
      <section
        style={{
          marginBottom: 32,
          padding: 32,
          borderRadius: 24,
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
          boxShadow: 'var(--shadow-color-base)',
          backgroundImage: 'linear-gradient(135deg, rgba(219,39,119,0.06) 0%, rgba(91,92,235,0.06) 100%)',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 12px',
            backgroundColor: 'rgba(219, 39, 119, 0.1)',
            borderRadius: 20,
            marginBottom: 10,
            border: '1px solid rgba(219, 39, 119, 0.25)',
          }}
        >
          <Ico.Sparkles size={14} />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#db2777', textTransform: 'uppercase' }}>
            Weekly Executive Summary
          </span>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px 0' }}>
          Weekly Performance Report
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>
          {data ? `Personalized weekly review for ${data.date_range_formatted}` : 'Synthesizing live weekly review metrics...'}
        </p>
      </section>

      {isLoading ? (
        <div style={{ padding: 48, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <Loader2 size={28} className="animate-spin" color="#2563eb" />
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
            Generating Weekly Executive Insights...
          </span>
        </div>
      ) : error ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#ef4444', backgroundColor: 'var(--bg-card)', borderRadius: 20 }}>
          {error}
        </div>
      ) : data ? (
        <>
          {/* Top Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 28 }}>
            <div style={{ padding: 20, borderRadius: 16, backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, color: '#2563eb' }}>
                <Clock size={20} />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>Logged Study Time</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>
                {data.total_logged_hours} hrs
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Across {data.active_days_count} active days</span>
            </div>

            <div style={{ padding: 20, borderRadius: 16, backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, color: '#10b981' }}>
                <Target size={20} />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>Questions & Accuracy</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>
                {data.total_questions_solved} Qs • {data.avg_accuracy}%
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Average test accuracy</span>
            </div>

            <div style={{ padding: 20, borderRadius: 16, backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, color: '#8b5cf6' }}>
                <CheckCircle2 size={20} />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>Target Completion</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>
                {data.completion_rate}%
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{data.completed_tasks}/{data.total_tasks} study targets</span>
            </div>

            <div style={{ padding: 20, borderRadius: 16, backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, color: '#f59e0b' }}>
                <Award size={20} />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>Primary Focus</span>
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {data.top_subject}
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Dominant weekly subject</span>
            </div>
          </div>

          {/* Grid of Report Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
            {/* Card 1: Key Achievements */}
            <div style={{ backgroundColor: 'var(--bg-card)', padding: 28, borderRadius: 24, border: '1px solid var(--border-default)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{ padding: 8, backgroundColor: 'rgba(16, 185, 129, 0.12)', color: '#10b981', borderRadius: 10 }}>
                  <Ico.Trophy size={18} />
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Weekly Highlights</h3>
              </div>
              <ul style={{ paddingLeft: 20, margin: 0, fontSize: 14, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {data.highlights.map((item, idx) => (
                  <li key={`highlight_${idx}`} style={{ lineHeight: 1.5 }}>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Card 2: Recommended Revision */}
            <div style={{ backgroundColor: 'var(--bg-card)', padding: 28, borderRadius: 24, border: '1px solid var(--border-default)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{ padding: 8, backgroundColor: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', borderRadius: 10 }}>
                  <Ico.Brain size={18} />
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Focus Next Week</h3>
              </div>
              <ul style={{ paddingLeft: 20, margin: 0, fontSize: 14, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {data.focus_next_week.map((item, idx) => (
                  <li key={`focus_${idx}`} style={{ lineHeight: 1.5 }}>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Student Testimonial Submission Form */}
          <StudentTestimonialForm />
        </>
      ) : null}
    </StudentLayout>
  );
}
