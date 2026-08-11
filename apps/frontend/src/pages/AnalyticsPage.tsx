import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { StudentLayout } from '../components/student/StudentLayout';
import { PerformanceAnalyticsCharts } from '../components/student/PerformanceAnalyticsCharts';
import { PsychometricReportView } from '../components/student/PsychometricReportView';
import { Ico } from '../components/common/Icons';
import { getPsychometricReportJson, getPsychometricReportMarkdown } from '../services/examService';
import { PsychometricReport } from '../types/exam';
import { Loader2 } from 'lucide-react';

export function AnalyticsPage() {
  const [searchParams] = useSearchParams();
  const attemptId = searchParams.get('attemptId');

  const [report, setReport] = useState<PsychometricReport | null>(null);
  const [markdown, setMarkdown] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!attemptId) return;
    const targetAttemptId = attemptId;

    async function fetchReport() {
      setIsLoading(true);
      setError(null);
      try {
        const [jsonRes, mdRes] = await Promise.allSettled([
          getPsychometricReportJson(targetAttemptId),
          getPsychometricReportMarkdown(targetAttemptId),
        ]);

        if (jsonRes.status === 'fulfilled') {
          setReport(jsonRes.value);
        } else {
          setError(jsonRes.reason?.message || 'Report is currently compiling in background. Please refresh in a moment.');
        }

        if (mdRes.status === 'fulfilled') {
          setMarkdown(mdRes.value);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load report.');
      } finally {
        setIsLoading(false);
      }
    }

    fetchReport();
  }, [attemptId]);

  return (
    <StudentLayout pageTitle="Deep Analytics">
      {/* Header Banner */}
      <section
        style={{
          marginBottom: 32,
          padding: 32,
          borderRadius: 24,
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
          boxShadow: 'var(--shadow-color-base)',
          backgroundImage: 'linear-gradient(135deg, rgba(91,92,235,0.06) 0%, rgba(37,99,235,0.06) 100%)',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 12px',
            backgroundColor: 'var(--accent-bg)',
            borderRadius: 20,
            marginBottom: 10,
            border: '1px solid var(--accent-border)',
          }}
        >
          <Ico.Chart size={14} />
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase' }}>
            Psychometric Intelligence
          </span>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px 0' }}>
          Detailed Psychometric & Cognitive Analytics
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>
          Comprehensive breakdown of your speed, topic accuracy, IRT latent ability, and guessing risk.
        </p>
      </section>

      {/* Loading Spinner */}
      {isLoading && (
        <div style={{ padding: 40, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <Loader2 size={28} className="animate-spin" color="#2563eb" />
          <span style={{ fontSize: 16, fontWeight: 700 }}>Compiling Psychometric Diagnostic Audit...</span>
        </div>
      )}

      {/* Error / Processing Banner */}
      {error && (
        <div style={{ padding: 20, borderRadius: 16, backgroundColor: 'rgba(245, 158, 11, 0.15)', border: '1px solid #f59e0b', color: '#d97706', marginBottom: 24 }}>
          <strong>Notice: </strong> {error}
        </div>
      )}

      {/* Live Psychometric Report View */}
      {report ? (
        <PsychometricReportView report={report} markdownContent={markdown} />
      ) : (
        <>
          {/* Main Charts Overview */}
          <PerformanceAnalyticsCharts />

          {/* Additional Analytics Breakdown */}
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24, marginTop: 32 }}>
            {/* Speed vs Accuracy */}
            <div style={{ backgroundColor: 'var(--bg-card)', padding: 28, borderRadius: 24, border: '1px solid var(--border-default)' }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 16px 0', color: 'var(--text-primary)' }}>
                Speed vs. Accuracy Matrix
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: 14, backgroundColor: 'var(--bg-subtle)', borderRadius: 12 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>Fast & Accurate</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--success-primary)' }}>54% of Questions</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: 14, backgroundColor: 'var(--bg-subtle)', borderRadius: 12 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>Slow & Accurate</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent-primary)' }}>28% of Questions</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: 14, backgroundColor: 'var(--bg-subtle)', borderRadius: 12 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>Rushed & Incorrect</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--danger-primary)' }}>18% of Questions</span>
                </div>
              </div>
            </div>

            {/* Mistake Pattern */}
            <div style={{ backgroundColor: 'var(--bg-card)', padding: 28, borderRadius: 24, border: '1px solid var(--border-default)' }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 16px 0', color: 'var(--text-primary)' }}>Mistake Analysis</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: 14, backgroundColor: 'var(--bg-subtle)', borderRadius: 12 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>Silly / Misread Errors</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--warning-primary)' }}>12 Errors</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: 14, backgroundColor: 'var(--bg-subtle)', borderRadius: 12 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>Conceptual Gaps</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--danger-primary)' }}>24 Errors</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: 14, backgroundColor: 'var(--bg-subtle)', borderRadius: 12 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>Time Crunch Pressure</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--info-primary)' }}>6 Errors</span>
                </div>
              </div>
            </div>
          </section>
        </>
      )}
    </StudentLayout>
  );
}

