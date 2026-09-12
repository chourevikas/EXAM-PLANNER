import React, { useState, useEffect } from 'react';
import {
  Download,
  AlertCircle,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Loader2,
} from 'lucide-react';
import {
  fetchPlatformAnalytics,
  PlatformAnalyticsData,
} from '../../../services/adminService';
import { fetchActiveExamTypes } from '../../../services/examTypeService';
import { ExamType } from '../../../types/examType';

export function AnalyticsView() {
  const [timeRange, setTimeRange] = useState<string>('30d');
  const [examFilter, setExamFilter] = useState<string>('ALL');
  const [examTypes, setExamTypes] = useState<ExamType[]>([]);
  const [data, setData] = useState<PlatformAnalyticsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<boolean>(false);

  // Fetch available exam types for filter dropdown
  useEffect(() => {
    let isMounted = true;
    fetchActiveExamTypes()
      .then((types) => {
        if (isMounted && Array.isArray(types) && types.length > 0) {
          setExamTypes(types);
        }
      })
      .catch((err) => {
        console.warn('Could not load dynamic exam types, using defaults', err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch analytics data when timeRange or examFilter changes
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    fetchPlatformAnalytics(timeRange, examFilter)
      .then((res) => {
        if (isMounted) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Error loading analytics:', err);
          setError(err.message || 'Failed to fetch platform analytics.');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [timeRange, examFilter]);

  // Export report as clean CSV
  const handleExportReport = () => {
    if (!data) return;
    setExporting(true);

    try {
      const rows: string[] = [];

      // Meta Information
      rows.push(`"Reports & Platform Analytics - Export"`);
      rows.push(`"Generated At:","${data.generated_at}"`);
      rows.push(`"Time Range:","${timeRange}"`);
      rows.push(`"Exam Filter:","${examFilter}"`);
      rows.push(``);

      // Executive Summary
      rows.push(`"EXECUTIVE SUMMARY"`);
      rows.push(`"Metric","Value"`);
      rows.push(`"Total Attempts","${data.summary.total_attempts}"`);
      rows.push(`"Avg Accuracy","${data.summary.avg_accuracy.toFixed(1)}%"`);
      rows.push(
        `"MoM Accuracy Delta","${data.summary.mom_accuracy_delta >= 0 ? '+' : ''}${data.summary.mom_accuracy_delta.toFixed(1)}%"`
      );
      rows.push(`"AI Precision","${data.summary.ai_precision.toFixed(1)}%"`);
      rows.push(`"Active Test Takers","${data.summary.active_test_takers}"`);
      rows.push(``);

      // Subject Diagnostic Breakdown
      rows.push(`"SUBJECT ACCURACY & DIAGNOSTIC PERFORMANCE"`);
      rows.push(
        `"Subject Module","Total Questions","Candidate Attempts","Avg Accuracy","Target Accuracy","Diagnostic Status"`
      );
      data.subject_accuracy.forEach((item) => {
        rows.push(
          `"${item.subject.replace(/"/g, '""')}","${item.total_questions}","${item.attempted}","${item.accuracy}","${item.target}","${item.status}"`
        );
      });
      rows.push(``);

      // AI Pipeline Precision
      rows.push(`"AI PROCESSING & EXTRACTION PIPELINE PRECISION"`);
      rows.push(`"Metric","Value","Description"`);
      data.ai_precision_metrics.forEach((m) => {
        rows.push(
          `"${m.label.replace(/"/g, '""')}","${m.value}","${m.description.replace(/"/g, '""')}"`
        );
      });

      const csvContent = rows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `platform_analytics_${examFilter.toLowerCase()}_${timeRange}_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export CSV:', err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={{ maxWidth: 1320, margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      {/* 1. PAGE HEADER */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#172033', margin: 0, letterSpacing: '-0.02em' }}>
            Reports & Platform Analytics
          </h1>
          <p style={{ fontSize: 14, color: '#667085', marginTop: 4, margin: '4px 0 0 0' }}>
            Candidate performance metrics, subject accuracy diagnostics, AI extraction precision, and system usage analytics.
          </p>
        </div>

        {/* Toolbar Controls */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {loading && data && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#667085', fontSize: 12, marginRight: 4 }}>
              <Loader2 size={14} className="animate-spin" />
              <span>Updating...</span>
            </div>
          )}

          <select
            value={examFilter}
            onChange={(e) => setExamFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: 0,
              border: '1px solid #E4E7EC',
              fontSize: 13,
              fontWeight: 500,
              color: '#172033',
              backgroundColor: '#FFFFFF',
              outline: 'none',
              height: 38,
              cursor: 'pointer',
            }}
          >
            <option value="ALL">All Examinations</option>
            {examTypes.length > 0 ? (
              examTypes.map((et) => (
                <option key={et.id} value={et.type}>
                  {et.name || et.type.toUpperCase()}
                </option>
              ))
            ) : (
              <>
                <option value="UPSC_CSE">UPSC CSE Prelims</option>
                <option value="STATE_PSC">State PSC Exams</option>
              </>
            )}
          </select>

          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: 0,
              border: '1px solid #E4E7EC',
              fontSize: 13,
              fontWeight: 500,
              color: '#172033',
              backgroundColor: '#FFFFFF',
              outline: 'none',
              height: 38,
              cursor: 'pointer',
            }}
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="1y">Full Academic Year</option>
          </select>

          <button
            onClick={handleExportReport}
            disabled={!data || exporting}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              fontSize: 13,
              fontWeight: 500,
              borderRadius: 0,
              backgroundColor: '#FFFFFF',
              color: !data || exporting ? '#98A2B3' : '#172033',
              border: '1px solid #E4E7EC',
              cursor: !data || exporting ? 'not-allowed' : 'pointer',
              height: 38,
              transition: 'background-color 0.15s ease',
            }}
          >
            <Download size={14} color={!data || exporting ? '#98A2B3' : '#667085'} />
            <span>{exporting ? 'Exporting...' : 'Export Report'}</span>
          </button>
        </div>
      </div>

      {/* ERROR BANNER */}
      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            backgroundColor: '#FEF3F2',
            border: '1px solid #FECDCA',
            color: '#B42318',
            fontSize: 13.5,
            marginBottom: 20,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          <button
            onClick={() => {
              setLoading(true);
              setError(null);
              fetchPlatformAnalytics(timeRange, examFilter)
                .then((res) => {
                  setData(res);
                  setLoading(false);
                })
                .catch((e) => {
                  setError(e.message || 'Failed to load analytics.');
                  setLoading(false);
                });
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 8px',
              fontSize: 12,
              fontWeight: 600,
              backgroundColor: 'transparent',
              border: '1px solid #B42318',
              color: '#B42318',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={12} />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* 2. COMPACT TOP SUMMARY STRIP (~68px height) */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #E4E7EC',
          borderRadius: 0,
          padding: '12px 20px',
          marginBottom: 24,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 16,
          alignItems: 'center',
          boxShadow: '0 1px 2px rgba(16,24,40,0.02)',
          opacity: loading && !data ? 0.6 : 1,
          transition: 'opacity 0.2s ease',
        }}
      >
        <div style={{ paddingRight: 12, borderRight: '1px solid #E4E7EC' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#667085', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            TOTAL ATTEMPTS
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#172033', marginTop: 2 }}>
            {data ? data.summary.total_attempts.toLocaleString() : '—'}
          </div>
        </div>

        <div style={{ paddingRight: 12, borderRight: '1px solid #E4E7EC' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#667085', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            AVG ACCURACY
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#15803D', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>{data ? `${data.summary.avg_accuracy.toFixed(1)}%` : '—'}</span>
            {data && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: data.summary.mom_accuracy_delta >= 0 ? '#15803D' : '#B42318',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 2,
                }}
              >
                {data.summary.mom_accuracy_delta >= 0 ? (
                  <TrendingUp size={12} />
                ) : (
                  <TrendingDown size={12} />
                )}
                <span>
                  {data.summary.mom_accuracy_delta >= 0 ? '+' : ''}
                  {data.summary.mom_accuracy_delta.toFixed(1)}% MoM
                </span>
              </span>
            )}
          </div>
        </div>

        <div style={{ paddingRight: 12, borderRight: '1px solid #E4E7EC' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#667085', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            AI PRECISION
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#172033', marginTop: 2 }}>
            {data ? `${data.summary.ai_precision.toFixed(1)}%` : '—'}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#667085', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            ACTIVE TEST TAKERS
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#172033', marginTop: 2 }}>
            {data ? data.summary.active_test_takers.toLocaleString() : '—'}
          </div>
        </div>
      </div>

      {/* 3. DIAGNOSTIC ACCURACY BY SUBJECT TABLE */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#172033', margin: 0 }}>
            Subject Accuracy & Diagnostic Performance
          </h2>
          <span style={{ fontSize: 12.5, color: '#667085' }}>
            Based on {data ? data.summary.total_attempts.toLocaleString() : 0} candidate test responses
          </span>
        </div>

        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E4E7EC',
            borderRadius: 0,
            boxShadow: '0 1px 2px rgba(16, 24, 40, 0.02)',
            overflow: 'hidden',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13.5 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E4E7EC', backgroundColor: '#F7F7F5' }}>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: '#667085', fontSize: 12 }}>SUBJECT MODULE</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: '#667085', fontSize: 12 }}>TOTAL QUESTIONS</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: '#667085', fontSize: 12 }}>CANDIDATE ATTEMPTS</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: '#667085', fontSize: 12 }}>AVG ACCURACY</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: '#667085', fontSize: 12 }}>TARGET ACCURACY</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: '#667085', fontSize: 12, textAlign: 'right' }}>DIAGNOSTIC STATUS</th>
              </tr>
            </thead>
            <tbody>
              {data && data.subject_accuracy && data.subject_accuracy.length > 0 ? (
                data.subject_accuracy.map((row, idx) => {
                  const isStrong = row.status === 'Strong' || row.status === 'Optimal';
                  const isWarning = row.status === 'Attention Required';
                  const statusColor = isStrong ? '#15803D' : isWarning ? '#B42318' : '#B45309';

                  return (
                    <tr
                      key={row.subject}
                      style={{
                        borderBottom: idx === data.subject_accuracy.length - 1 ? 'none' : '1px solid #E4E7EC',
                        height: 56,
                      }}
                    >
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: '#172033' }}>
                        {row.subject}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#667085', fontFamily: 'monospace' }}>
                        {row.total_questions.toLocaleString()}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#667085', fontFamily: 'monospace' }}>
                        {row.attempted.toLocaleString()}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: statusColor }}>
                        {row.accuracy}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#667085', fontFamily: 'monospace' }}>
                        {row.target}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 500,
                            color: statusColor,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                          }}
                        >
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: 0,
                              backgroundColor: statusColor,
                            }}
                          />
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} style={{ padding: '32px 16px', textAlign: 'center', color: '#667085' }}>
                    {loading ? 'Loading subject diagnostics...' : 'No subject accuracy data found for the selected filter.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. AI EXTRACTION PIPELINE PRECISION METRICS */}
      <div>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#172033', margin: '0 0 12px 0' }}>
          AI Processing & Extraction Pipeline Precision
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
          {data && data.ai_precision_metrics && data.ai_precision_metrics.length > 0 ? (
            data.ai_precision_metrics.map((m) => (
              <div
                key={m.label}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E4E7EC',
                  borderRadius: 0,
                  padding: 16,
                  boxShadow: '0 1px 2px rgba(16, 24, 40, 0.02)',
                }}
              >
                <div style={{ fontSize: 11.5, fontWeight: 700, color: '#667085', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {m.label}
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#172033', marginTop: 4 }}>
                  {m.value}
                </div>
                <div style={{ fontSize: 12, color: '#667085', marginTop: 4 }}>
                  {m.description}
                </div>
              </div>
            ))
          ) : (
            [
              { label: 'OCR Text Accuracy', value: '...', description: 'Character error rate' },
              { label: 'Question Boundary Detection', value: '...', description: 'Question split rate' },
              { label: 'Option Classification Confidence', value: '...', description: 'Key matching accuracy' },
              { label: 'Human Review Override Rate', value: '...', description: 'Questions edited in review' },
            ].map((m) => (
              <div
                key={m.label}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E4E7EC',
                  borderRadius: 0,
                  padding: 16,
                  boxShadow: '0 1px 2px rgba(16, 24, 40, 0.02)',
                  opacity: 0.6,
                }}
              >
                <div style={{ fontSize: 11.5, fontWeight: 700, color: '#667085', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {m.label}
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#172033', marginTop: 4 }}>
                  {m.value}
                </div>
                <div style={{ fontSize: 12, color: '#667085', marginTop: 4 }}>
                  {m.description}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
