import React, { useState } from 'react';
import {
  BarChart2,
  TrendingUp,
  Target,
  Users,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  Clock,
  Download,
  Filter,
} from 'lucide-react';

export function AnalyticsView() {
  const [timeRange, setTimeRange] = useState<string>('30d');
  const [examFilter, setExamFilter] = useState<string>('ALL');

  // Diagnostic accuracy breakdown by subject
  const subjectAccuracy = [
    { subject: 'Indian Polity & Governance', totalQuestions: 1420, attempted: 12450, accuracy: '68.4%', status: 'Optimal', target: '70.0%' },
    { subject: 'Indian History & Culture', totalQuestions: 1850, attempted: 14200, accuracy: '61.2%', status: 'Needs Review', target: '65.0%' },
    { subject: 'Geography & Environment', totalQuestions: 1620, attempted: 11800, accuracy: '66.8%', status: 'Optimal', target: '68.0%' },
    { subject: 'Indian Economy & Development', totalQuestions: 1340, attempted: 9850, accuracy: '58.5%', status: 'Attention Required', target: '65.0%' },
    { subject: 'Science & Technology', totalQuestions: 980, attempted: 7600, accuracy: '71.0%', status: 'Strong', target: '68.0%' },
    { subject: 'General Science & CSAT', totalQuestions: 1100, attempted: 8900, accuracy: '74.2%', status: 'Strong', target: '70.0%' },
  ];

  // AI Extraction Precision Metrics
  const aiPrecisionMetrics = [
    { label: 'OCR Text Accuracy', value: '98.6%', description: 'Character error rate < 0.2%' },
    { label: 'Question Boundary Detection', value: '96.4%', description: 'Correct Q1-Q100 split rate' },
    { label: 'Option Classification Confidence', value: '94.8%', description: 'A/B/C/D key matching accuracy' },
    { label: 'Human Review Override Rate', value: '3.2%', description: 'Percentage of questions edited in review' },
  ];

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
          <select
            value={examFilter}
            onChange={(e) => setExamFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: 6,
              border: '1px solid #E4E7EC',
              fontSize: 13,
              fontWeight: 500,
              color: '#172033',
              backgroundColor: '#FFFFFF',
              outline: 'none',
              height: 38,
            }}
          >
            <option value="ALL">All Examinations</option>
            <option value="UPSC_CSE">UPSC CSE Prelims</option>
            <option value="STATE_PSC">State PSC Exams</option>
          </select>

          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: 6,
              border: '1px solid #E4E7EC',
              fontSize: 13,
              fontWeight: 500,
              color: '#172033',
              backgroundColor: '#FFFFFF',
              outline: 'none',
              height: 38,
            }}
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="1y">Full Academic Year</option>
          </select>

          <button
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              fontSize: 13,
              fontWeight: 500,
              borderRadius: 6,
              backgroundColor: '#FFFFFF',
              color: '#172033',
              border: '1px solid #E4E7EC',
              cursor: 'pointer',
              height: 38,
            }}
          >
            <Download size={14} color="#667085" />
            <span>Export Report</span>
          </button>
        </div>
      </div>

      {/* 2. COMPACT TOP SUMMARY STRIP (~68px height) */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #E4E7EC',
          borderRadius: 6,
          padding: '12px 20px',
          marginBottom: 24,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 16,
          alignItems: 'center',
          boxShadow: '0 1px 2px rgba(16,24,40,0.02)',
        }}
      >
        <div style={{ paddingRight: 12, borderRight: '1px solid #E4E7EC' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#667085', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            TOTAL ATTEMPTS
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#172033', marginTop: 2 }}>
            14,280
          </div>
        </div>

        <div style={{ paddingRight: 12, borderRight: '1px solid #E4E7EC' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#667085', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            AVG ACCURACY
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#15803D', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>64.8%</span>
            <span style={{ fontSize: 11, fontWeight: 500, color: '#15803D' }}>+2.4% MoM</span>
          </div>
        </div>

        <div style={{ paddingRight: 12, borderRight: '1px solid #E4E7EC' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#667085', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            AI PRECISION
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#172033', marginTop: 2 }}>
            94.2%
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#667085', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            ACTIVE TEST TAKERS
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#172033', marginTop: 2 }}>
            1,840
          </div>
        </div>
      </div>

      {/* 3. DIAGNOSTIC ACCURACY BY SUBJECT TABLE */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#172033', margin: 0 }}>
            Subject Accuracy & Diagnostic Performance
          </h2>
          <span style={{ fontSize: 12.5, color: '#667085' }}>Based on 14,280 candidate test responses</span>
        </div>

        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E4E7EC',
            borderRadius: 6,
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
              {subjectAccuracy.map((row, idx) => {
                const isStrong = row.status === 'Strong' || row.status === 'Optimal';
                const isWarning = row.status === 'Attention Required';

                return (
                  <tr
                    key={row.subject}
                    style={{
                      borderBottom: idx === subjectAccuracy.length - 1 ? 'none' : '1px solid #E4E7EC',
                      height: 56,
                    }}
                  >
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: '#172033' }}>
                      {row.subject}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#667085', fontFamily: 'monospace' }}>
                      {row.totalQuestions}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#667085', fontFamily: 'monospace' }}>
                      {row.attempted.toLocaleString()}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: isStrong ? '#15803D' : isWarning ? '#B42318' : '#172033' }}>
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
                          color: isStrong ? '#15803D' : isWarning ? '#B42318' : '#B45309',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                        }}
                      >
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            backgroundColor: isStrong ? '#15803D' : isWarning ? '#B42318' : '#B45309',
                          }}
                        />
                        {row.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
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
          {aiPrecisionMetrics.map((m) => (
            <div
              key={m.label}
              style={{
                background: '#FFFFFF',
                border: '1px solid #E4E7EC',
                borderRadius: 6,
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
          ))}
        </div>
      </div>
    </div>
  );
}
