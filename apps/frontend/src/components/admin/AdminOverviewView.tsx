import React, { useEffect, useState } from 'react';
import {
  Upload,
  RefreshCw,
  AlertCircle,
  FileSpreadsheet,
  ArrowRight,
  FileText,
  Layers,
  CheckCircle2,
  GraduationCap,
  Loader2,
} from 'lucide-react';
import {
  fetchAdminOverviewStats,
  AdminOverviewStats,
} from '../../services/adminService';
import { useBreakpoint } from '../../hooks/useBreakpoint';

interface AdminOverviewViewProps {
  onNavigate: (view: string, extraData?: any) => void;
}

// ----------------------------------------------------------------------
// 1. MetricCard Component (Single Variant Color & Left-to-Right Hover Accent Line)
// ----------------------------------------------------------------------
interface MetricCardProps {
  title: string;
  value: string;
  supportingText: string;
  icon: React.ReactNode;
  showProgress?: boolean;
  progressPercent?: number;
  isLoading?: boolean;
  onClick?: () => void;
}

function MetricCard({
  title,
  value,
  supportingText,
  icon,
  showProgress = false,
  progressPercent = 96.3,
  isLoading = false,
  onClick,
}: MetricCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const accentColor = 'var(--primary-red)';

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      title={onClick ? `Open ${title}` : undefined}
      style={{
        background: '#FFFFFF',
        border: isHovered && onClick ? '1px solid var(--primary-red)' : '1px solid #E2E8F0',
        borderRadius: 0,
        position: 'relative',
        overflow: 'hidden',
        padding: '20px 22px',
        boxShadow: isHovered
          ? '0 8px 20px -4px rgba(15, 23, 42, 0.08), 0 4px 6px -2px rgba(15, 23, 42, 0.03)'
          : '0 1px 3px rgba(15, 23, 42, 0.04), 0 1px 2px rgba(15, 23, 42, 0.02)',
        transform: isHovered ? 'translateY(-3px)' : 'translateY(0)',
        transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
        cursor: onClick ? 'pointer' : 'default',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: 136,
      }}
    >
      {/* Top Edge Accent Line (Appears from Left to Right on Hover) */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          backgroundColor: accentColor,
          transform: isHovered ? 'scaleX(1)' : 'scaleX(0)',
          transformOrigin: 'left center',
          transition: 'transform 250ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      />

      {/* Header Row: Title & Top-Right Icon */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div
            style={{
              fontSize: 13.5,
              fontWeight: 600,
              color: isHovered && onClick ? 'var(--primary-red)' : '#172033',
              letterSpacing: '-0.01em',
              transition: 'color 150ms ease',
            }}
          >
            {title}
          </div>
          {onClick && (
            <ArrowRight
              size={13}
              style={{
                color: isHovered ? 'var(--primary-red)' : '#94A3B8',
                transform: isHovered ? 'translateX(2px)' : 'translateX(0)',
                transition: 'all 150ms ease',
                opacity: isHovered ? 1 : 0.6,
              }}
            />
          )}
        </div>

        {/* 34px Icon Container with Single Variant Color Tint */}
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 0,
            backgroundColor: '#F8FAFC',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transform: isHovered ? 'scale(1.06)' : 'scale(1)',
            transition: 'transform 200ms ease-out',
          }}
        >
          {icon}
        </div>
      </div>

      {/* Value & Supporting Detail */}
      <div style={{ marginTop: 12 }}>
        {isLoading ? (
          <div
            style={{
              height: 32,
              width: 56,
              backgroundColor: '#E2E8F0',
              borderRadius: 4,
              animation: 'pulse 1.5s ease-in-out infinite',
              marginBottom: 4,
            }}
          />
        ) : (
          <div
            style={{
              fontSize: 32,
              fontWeight: 700,
              color: isHovered ? accentColor : '#172033',
              lineHeight: 1.05,
              letterSpacing: '-0.025em',
              transition: 'color 200ms ease-out',
            }}
          >
            {value}
          </div>
        )}

        <div
          style={{
            fontSize: 12.5,
            fontWeight: 500,
            color: '#64748B',
            marginTop: 4,
          }}
        >
          {isLoading ? (
            <div
              style={{
                height: 14,
                width: 96,
                backgroundColor: '#F1F5F9',
                borderRadius: 3,
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            />
          ) : (
            supportingText
          )}
        </div>

        {/* Optional Progress Bar for Extraction Accuracy */}
        {showProgress && (
          <div
            style={{
              height: 4,
              width: '100%',
              backgroundColor: '#F1F5F9',
              borderRadius: 0,
              marginTop: 10,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${Math.min(100, Math.max(0, progressPercent))}%`,
                backgroundColor: accentColor,
                borderRadius: 0,
                transition: 'width 400ms ease-out',
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// 2. TableRowItem Component (Subtle Row Hover & 2px Left Accent Line)
// ----------------------------------------------------------------------
function TableRowItem({
  paper,
  isLast,
  onNavigate,
}: {
  paper: any;
  isLast: boolean;
  onNavigate: (view: string, data?: any) => void;
}) {
  const [hovered, setHovered] = useState(false);

  // Formatting two-line paper title hierarchy
  const primaryTitle = paper.primaryTitle || paper.title || 'UPSC Civil Services';
  const secondaryTitle =
    paper.secondaryTitle ||
    (paper.title && paper.title.includes('Set')
      ? paper.title
      : 'Prelims · 2023 · Set B');

  return (
    <tr
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderBottom: isLast ? 'none' : '1px solid #E2E8F0',
        backgroundColor: hovered ? '#F8FAFC' : '#FFFFFF',
        transition: 'background-color 150ms ease-out',
      }}
    >
      {/* EXAM PAPER (2-line hierarchy) */}
      <td
        style={{
          padding: '14px 16px',
          borderLeft: hovered ? '3px solid var(--primary-red)' : '3px solid transparent',
          transition: 'border-left 150ms ease-out',
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 13.5, color: '#172033', lineHeight: 1.3 }}>
          {primaryTitle}
        </div>
        <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
          {secondaryTitle}
        </div>
      </td>

      {/* QUESTIONS */}
      <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
        <span
          style={{
            display: 'inline-block',
            padding: '3px 9px',
            fontSize: 12.5,
            fontWeight: 600,
            color: '#172033',
            backgroundColor: '#F1F5F9',
            borderRadius: 0,
          }}
        >
          {paper.questions}
        </span>
      </td>

      {/* UPLOADED */}
      <td style={{ padding: '14px 16px', color: '#64748B', fontSize: 13, whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
        {paper.date}
      </td>

      {/* STATUS / CONFIDENCE */}
      <td style={{ padding: '14px 16px', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '3px 10px',
            borderRadius: 0,
            backgroundColor: '#F0FDF4',
            border: '1px solid #DCFCE7',
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: 0, backgroundColor: '#16A34A' }} />
          <span style={{ fontSize: 12.5, fontWeight: 600, color: '#15803D' }}>
            {paper.confidence || 99}% confidence
          </span>
        </div>
      </td>

      {/* ACTION */}
      <td style={{ padding: '14px 16px', textAlign: 'right', verticalAlign: 'middle' }}>
        {(() => {
          const isExtracting =
            paper.is_extracting ||
            ['EXTRACTING', 'PROCESSING', 'AI PROCESSING', 'IN_PROGRESS', 'IN PIPELINE', 'PARSING', 'INITIALIZING'].includes((paper.status || '').toUpperCase()) ||
            ['RUNNING', 'PROCESSING', 'INITIALIZING'].includes((paper.raw_status || '').toUpperCase());

          const isCompleted =
            !isExtracting &&
            ((paper.status || '').toUpperCase() === 'COMPLETED' ||
              (paper.status || '').toUpperCase() === 'PUBLISHED' ||
              (paper.status || '').toUpperCase() === 'READY_FOR_REVIEW');

          if (isExtracting) {
            return (
              <button
                disabled
                style={{
                  padding: '5px 12px',
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#94A3B8',
                  background: '#F1F5F9',
                  border: '1px solid #E2E8F0',
                  borderRadius: 0,
                  cursor: 'not-allowed',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                }}
                title="Exam is currently undergoing extraction — review is locked"
              >
                <Loader2 size={12} className="animate-spin text-amber-600" />
                In Extraction
              </button>
            );
          }

          if (isCompleted) {
            return (
              <button
                onClick={() =>
                  onNavigate('review', {
                    id: paper.id,
                    name: primaryTitle,
                    code: primaryTitle,
                    source_year: 2023,
                    stage: 'prelims',
                    status: paper.status || 'COMPLETED',
                    total_questions: paper.questions,
                    extracted_questions_count: paper.questions,
                  })
                }
                style={{
                  padding: '5px 14px',
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: hovered ? 'var(--primary-red)' : '#172033',
                  background: '#FFFFFF',
                  border: hovered ? '1px solid #93C5FD' : '1px solid #E2E8F0',
                  borderRadius: 0,
                  cursor: 'pointer',
                  boxShadow: hovered ? '0 1px 2px rgba(var(--primary-red-rgb), 0.1)' : 'none',
                  transition: 'all 150ms ease-out',
                }}
              >
                Review
              </button>
            );
          }

          return (
            <span
              style={{
                fontSize: 12,
                color: '#64748B',
                fontWeight: 500,
                padding: '4px 8px',
                background: '#F1F5F9',
                border: '1px solid #E2E8F0',
              }}
            >
              In Pipeline
            </span>
          );
        })()}
      </td>
    </tr>
  );
}

// ----------------------------------------------------------------------
// 3. SubjectDistributionRow Component (Interactive Progress Row & Tooltip)
// ----------------------------------------------------------------------
function SubjectDistributionRow({
  subject,
  count,
  percent,
}: {
  subject: string;
  count: number;
  percent: number;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '8px 10px',
        borderRadius: 0,
        backgroundColor: hovered ? '#F8FAFC' : 'transparent',
        transition: 'all 150ms ease-out',
        position: 'relative',
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 13,
          fontWeight: hovered ? 600 : 500,
          color: hovered ? '#172033' : '#172033',
          marginBottom: 6,
        }}
      >
        <span>{subject}</span>
        <span style={{ color: hovered ? 'var(--primary-red)' : '#64748B', fontWeight: 600, fontSize: 12.5 }}>
          {count} · {percent}%
        </span>
      </div>

      {/* Progress Bar */}
      <div
        style={{
          height: hovered ? 7 : 5,
          backgroundColor: '#F1F5F9',
          borderRadius: 0,
          overflow: 'hidden',
          transition: 'height 150ms ease-out',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${Math.min(100, Math.max(0, percent))}%`,
            backgroundColor: hovered ? 'var(--accent-darker)' : 'var(--primary-red)',
            borderRadius: 0,
            transition: 'width 400ms ease-out, background-color 150ms ease-out',
          }}
        />
      </div>

      {/* Micro Tooltip / Extended Info on Hover */}
      {hovered && (
        <div
          style={{
            marginTop: 6,
            fontSize: 11.5,
            color: '#334155',
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: 0,
            padding: '4px 8px',
            boxShadow: '0 2px 8px rgba(15, 23, 42, 0.06)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>
            <strong style={{ color: '#172033' }}>{subject}</strong>: {count} extracted questions
          </span>
          <span style={{ color: 'var(--primary-red)', fontWeight: 600 }}>{percent}% of current dataset</span>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------
// Main AdminOverviewView Component
// ----------------------------------------------------------------------
export function AdminOverviewView({ onNavigate }: AdminOverviewViewProps) {
  const { isMobile, isTabletOrBelow } = useBreakpoint();
  const [stats, setStats] = useState<AdminOverviewStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadOverviewStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchAdminOverviewStats();
      setStats(data);
    } catch (err: any) {
      console.error('Failed to load admin overview stats:', err);
      setError(err.message || 'Unable to fetch real-time database statistics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverviewStats();
  }, []);

  const isDataLoading = loading && !stats;
  const papersList = stats?.recent_uploads ?? [];
  const subjectsList = stats?.subject_breakdown ?? [];

  return (
    <div style={{ maxWidth: 1320, margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      {/* 1. Page Header Hero Banner (Gradual Dark-to-Light Blue Fade) */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0F1D38 0%, #14284C 45%, #1B3864 75%, #224578 100%)',
          borderRadius: 0,
          padding: isMobile ? '16px 18px' : '24px 28px',
          marginBottom: 24,
          boxShadow: '0 4px 16px -2px rgba(15, 29, 56, 0.12)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h1
              style={{
                fontSize: 26,
                fontWeight: 700,
                color: '#FFFFFF',
                margin: 0,
                letterSpacing: '-0.02em',
              }}
            >
              Dashboard Overview
            </h1>

            {/* Subtle Operational Status Indicator */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '3px 10px',
                backgroundColor: 'rgba(255, 255, 255, 0.12)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: 0,
                fontSize: 12,
                fontWeight: 600,
                color: '#6EE7B7',
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: 0, backgroundColor: '#34D399' }} />
              <span>Extraction Pipeline Operational</span>
            </div>
          </div>

          <p style={{ fontSize: 13.5, color: 'rgba(255, 255, 255, 0.75)', marginTop: 6, margin: '6px 0 0 0' }}>
            Monitor exam papers, question extraction, review activity, and question-bank processing.
          </p>
        </div>

        {/* Header Action Buttons */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {/* Secondary Refresh Button */}
          <button
            onClick={loadOverviewStats}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '9px 15px',
              fontSize: 13,
              fontWeight: 500,
              borderRadius: 0,
              background: 'rgba(255, 255, 255, 0.12)',
              color: '#FFFFFF',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
            }}
            title="Refresh Database Statistics"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} color="#FFFFFF" />
            <span>Refresh</span>
          </button>

          {/* Primary Upload Exam Paper Button */}
          <button
            onClick={() => onNavigate('upload', 'UPLOAD_ONLY')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 18px',
              fontSize: 13.5,
              fontWeight: 600,
              borderRadius: 0,
              background: 'var(--primary-red)',
              color: '#FFFFFF',
              border: '1px solid var(--primary-red)',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(var(--primary-red-rgb), 0.3)',
              transition: 'all 0.15s ease',
            }}
          >
            <Upload size={15} />
            <span>Upload Exam Paper</span>
          </button>
        </div>
      </div>

      {/* Error Alert Banner */}
      {error && (
        <div
          style={{
            padding: '12px 16px',
            background: '#FEF2F2',
            border: '1px solid #FECDCA',
            borderRadius: 0,
            marginBottom: 20,
            color: '#B42318',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={18} color="#B42318" />
            <span style={{ fontSize: 13.5, fontWeight: 500 }}>{error}</span>
          </div>
          <button
            onClick={loadOverviewStats}
            style={{
              padding: '4px 10px',
              fontSize: 12,
              fontWeight: 600,
              color: '#B42318',
              background: '#FFFFFF',
              border: '1px solid #FECDCA',
              borderRadius: 0,
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* 2. Top Metric Cards (4 Columns) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(auto-fit, minmax(140px, 1fr))' : 'repeat(auto-fit, minmax(230px, 1fr))',
          gap: isMobile ? 12 : 16,
          marginBottom: 24,
        }}
      >
        {/* Card 1: Total Papers Uploaded -> Question & Solution QA */}
        <MetricCard
          title="Total Papers Uploaded"
          value={stats?.metrics?.[0]?.value || '0'}
          supportingText={stats?.metrics?.[0]?.badge || (isDataLoading ? 'Loading...' : 'Total papers in system')}
          icon={<FileText size={18} color="var(--primary-red)" />}
          isLoading={isDataLoading}
          onClick={() => onNavigate('review')}
        />

        {/* Card 2: Questions Extracted -> Question Bank Catalog */}
        <MetricCard
          title="Questions Extracted"
          value={stats?.metrics?.[1]?.value || '0'}
          supportingText={stats?.metrics?.[1]?.badge || (isDataLoading ? 'Loading...' : 'Extracted questions')}
          icon={<Layers size={18} color="var(--primary-red)" />}
          isLoading={isDataLoading}
          onClick={() => onNavigate('questions')}
        />

        {/* Card 3: Extraction Accuracy -> Question & Solution QA */}
        <MetricCard
          title="Extraction Accuracy"
          value={stats?.metrics?.[2]?.value || '0.0%'}
          supportingText={stats?.metrics?.[2]?.badge || (isDataLoading ? 'Loading...' : 'Extraction confidence')}
          icon={<CheckCircle2 size={18} color="var(--primary-red)" />}
          showProgress={!isDataLoading}
          progressPercent={stats?.metrics?.[2]?.value ? parseFloat(stats.metrics[2].value.replace('%', '')) : 100}
          isLoading={isDataLoading}
          onClick={() => onNavigate('review')}
        />

        {/* Card 4: Supported Exam Types -> Exam Types */}
        <MetricCard
          title="Supported Exam Types"
          value={stats?.metrics?.[3]?.value || '0'}
          supportingText={stats?.metrics?.[3]?.badge || (isDataLoading ? 'Loading...' : 'Exam frameworks')}
          icon={<GraduationCap size={18} color="var(--primary-red)" />}
          isLoading={isDataLoading}
          onClick={() => onNavigate('exam-types')}
        />
      </div>

      {/* 3. Lower Section: Recent Uploads (Left) & Question Distribution (Right) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isTabletOrBelow ? '1fr' : 'calc(100% - 364px) 340px',
          gap: 24,
        }}
      >
        {/* Left Column: Recent Exam Paper Uploads Table */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: 0,
            padding: isMobile ? '16px' : '24px',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
          }}
        >
          {/* Card Header with 3px Blue Vertical Accent */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 20,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 4, height: 22, backgroundColor: 'var(--primary-red)', borderRadius: 0 }} />
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 700, color: '#172033', margin: 0, letterSpacing: '-0.01em' }}>
                  Recent Exam Paper Uploads
                </h2>
                <p style={{ fontSize: 13, color: '#64748B', margin: '2px 0 0 0' }}>
                  Latest question papers processed through the extraction pipeline.
                </p>
              </div>
            </div>

            <button
              onClick={() => onNavigate('pipeline-status')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                background: 'transparent',
                border: 'none',
                color: 'var(--primary-red)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: 0,
                transition: 'color 0.15s ease',
              }}
            >
              <span>View All</span>
              <ArrowRight size={14} />
            </button>
          </div>

          {/* Data Table */}
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table
              style={{
                width: '100%',
                minWidth: 540,
                borderCollapse: 'collapse',
                textAlign: 'left',
                fontSize: 13.5,
              }}
            >
              <thead>
                <tr style={{ borderBottom: '1px solid #E2E8F0', backgroundColor: '#FAFAFA' }}>
                  <th style={{ padding: '10px 16px', fontWeight: 600, color: '#64748B', fontSize: 12, letterSpacing: '0.04em' }}>
                    EXAM PAPER
                  </th>
                  <th style={{ padding: '10px 16px', fontWeight: 600, color: '#64748B', fontSize: 12, letterSpacing: '0.04em' }}>
                    QUESTIONS
                  </th>
                  <th style={{ padding: '10px 16px', fontWeight: 600, color: '#64748B', fontSize: 12, letterSpacing: '0.04em' }}>
                    UPLOADED
                  </th>
                  <th style={{ padding: '10px 16px', fontWeight: 600, color: '#64748B', fontSize: 12, letterSpacing: '0.04em' }}>
                    STATUS / CONFIDENCE
                  </th>
                  <th style={{ padding: '10px 16px', fontWeight: 600, color: '#64748B', fontSize: 12, letterSpacing: '0.04em', textAlign: 'right' }}>
                    ACTION
                  </th>
                </tr>
              </thead>
              <tbody>
                {isDataLoading ? (
                  Array.from({ length: 3 }).map((_, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #E2E8F0' }}>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ height: 16, width: 140, backgroundColor: '#F1F5F9', borderRadius: 3, animation: 'pulse 1.5s ease-in-out infinite', marginBottom: 6 }} />
                        <div style={{ height: 12, width: 90, backgroundColor: '#F8FAFC', borderRadius: 3, animation: 'pulse 1.5s ease-in-out infinite' }} />
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ height: 20, width: 36, backgroundColor: '#F1F5F9', borderRadius: 3, animation: 'pulse 1.5s ease-in-out infinite' }} />
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ height: 14, width: 70, backgroundColor: '#F1F5F9', borderRadius: 3, animation: 'pulse 1.5s ease-in-out infinite' }} />
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ height: 22, width: 110, backgroundColor: '#F1F5F9', borderRadius: 3, animation: 'pulse 1.5s ease-in-out infinite' }} />
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <div style={{ height: 26, width: 60, backgroundColor: '#F1F5F9', borderRadius: 3, animation: 'pulse 1.5s ease-in-out infinite', marginLeft: 'auto' }} />
                      </td>
                    </tr>
                  ))
                ) : papersList.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '32px 16px', textAlign: 'center', color: '#64748B', fontSize: 13.5 }}>
                      No exam papers uploaded yet. Click &quot;Upload Exam Paper&quot; above to get started.
                    </td>
                  </tr>
                ) : (
                  papersList.map((paper, i) => (
                    <TableRowItem
                      key={paper.id || i}
                      paper={paper}
                      isLast={i === papersList.length - 1}
                      onNavigate={onNavigate}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Question Distribution Card */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: 0,
            padding: 24,
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Section Title with Vertical Accent */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ width: 4, height: 20, backgroundColor: 'var(--primary-red)', borderRadius: 0 }} />
            <h2 style={{ fontSize: 17, fontWeight: 700, color: '#172033', margin: 0, letterSpacing: '-0.01em' }}>
              Question Distribution
            </h2>
          </div>
          <p style={{ fontSize: 13, color: '#64748B', margin: '2px 0 16px 0' }}>
            Extracted question breakdown by subject category.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
            {isDataLoading ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} style={{ padding: '8px 10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ height: 14, width: 120, backgroundColor: '#F1F5F9', borderRadius: 3, animation: 'pulse 1.5s ease-in-out infinite' }} />
                    <div style={{ height: 14, width: 40, backgroundColor: '#F1F5F9', borderRadius: 3, animation: 'pulse 1.5s ease-in-out infinite' }} />
                  </div>
                  <div style={{ height: 5, backgroundColor: '#F1F5F9', borderRadius: 0 }} />
                </div>
              ))
            ) : subjectsList.length === 0 ? (
              <div style={{ padding: '24px 0', textAlign: 'center', color: '#64748B', fontSize: 13 }}>
                No subject distribution data available yet.
              </div>
            ) : (
              subjectsList.map((item, i) => (
                <SubjectDistributionRow
                  key={i}
                  subject={item.subject}
                  count={item.count}
                  percent={item.percent}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
