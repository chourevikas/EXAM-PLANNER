import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Upload,
  Cloud,
  Loader2,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Key,
  X,
  Search,
  RefreshCw,
  AlertCircle,
  Database,
  Check,
  Clock,
  FileSpreadsheet,
  Layers,
  ClipboardCheck,
  ArrowRight,

  ChevronRight,
  ChevronLeft,
  ChevronsRight,
  ChevronsLeft,
  Filter,
  Trash2,
} from 'lucide-react';
import { useExamUpload } from '../../hooks/useExamUpload';
import { EXAM_OPTIONS, PAPER_TYPE_OPTIONS, YEAR_OPTIONS, GROUPED_YEAR_OPTIONS } from '../../constants/exam';
import {
  fetchExamPipelineStatuses,
  approveAndPublishExam,
  deleteAdminExam,
  fetchStuckPipelines,
  resumeExamPipeline,
  dismissStuckPipeline,
  ExamPipelineStatusItem,
  StuckPipelineItem,
} from '../../services/adminService';
import { createAdaptivePoller, AdaptivePollerController } from '../../utils/adaptivePolling';
import { formatEnum, cleanExamTitle, examYearLabel } from '../../utils/formatEnum';
import { useBreakpoint } from '../../hooks/useBreakpoint';

interface UploadReviewViewProps {
  onNavigate?: (view: string, extraData?: any) => void;
  initialTab?: 'UPLOAD_ONLY' | 'PIPELINE_ONLY';
}

// ----------------------------------------------------------------------
// 1. MetricCard Component (Single Variant Blue & Left-to-Right Hover Line)
// ----------------------------------------------------------------------
interface MetricCardProps {
  title: string;
  value: string | number;
  supportingText: string;
  icon: React.ReactNode;
  isProcessing?: boolean;
  isMobile?: boolean;
}

function MetricCard({ title, value, supportingText, icon, isProcessing = false, isMobile = false }: MetricCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const accentColor = 'var(--primary-red)';

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        background: 'var(--bg-card)',
        border: '1px solid #E2E8F0',
        borderRadius: 'var(--radius)',
        position: 'relative',
        overflow: 'hidden',
        padding: isMobile ? '12px 14px' : '18px 20px',
        boxShadow: isHovered
          ? '0 8px 20px -4px rgba(15, 23, 42, 0.08), 0 4px 6px -2px rgba(15, 23, 42, 0.03)'
          : '0 1px 3px rgba(15, 23, 42, 0.04), 0 1px 2px rgba(15, 23, 42, 0.02)',
        transform: isHovered ? 'translateY(-3px)' : 'translateY(0)',
        transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: isMobile ? 82 : 120,
      }}
    >
      {/* Top Edge Accent Line (Appears Left-to-Right on Hover) */}
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

      {/* Header Row: Title & Tinted Icon Container */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: 6 }}>
        <div style={{ fontSize: isMobile ? 12 : 13, fontWeight: 600, color: 'var(--deep-navy)', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
          {title}
        </div>
        <div
          style={{
            width: isMobile ? 26 : 32,
            height: isMobile ? 26 : 32,
            borderRadius: 'var(--radius)',
            backgroundColor: 'var(--bg-subtle)',
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
      <div style={{ marginTop: isMobile ? 6 : 10 }}>
        <div
          style={{
            fontSize: isMobile ? 22 : 28,
            fontWeight: 700,
            color: isHovered ? accentColor : 'var(--deep-navy)',
            lineHeight: 1.05,
            letterSpacing: '-0.025em',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'color 200ms ease-out',
          }}
        >
          <span>{value}</span>
          {isProcessing && <Loader2 size={isMobile ? 15 : 18} className="animate-spin" color="var(--primary-red)" />}
        </div>
        <div style={{ fontSize: isMobile ? 11 : 12, fontWeight: 500, color: 'var(--text-muted)', marginTop: isMobile ? 2 : 4 }}>
          {supportingText}
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// 2. Table Row with Stage Checkpoint Hover & Dimming Behavior
// ----------------------------------------------------------------------
function TableRowItem({
  exam,
  isLast,
  onSelect,
  onNavigate,
  renderOverallStatusBadge,
  renderStatusBadge,
}: {
  exam: ExamPipelineStatusItem;
  isLast: boolean;
  onSelect: (exam: ExamPipelineStatusItem) => void;
  onNavigate?: (view: string, extraData?: any) => void;
  renderOverallStatusBadge: (exam: ExamPipelineStatusItem) => React.ReactNode;
  renderStatusBadge: (status: string) => React.ReactNode;
}) {
  const [rowHovered, setRowHovered] = useState(false);
  const [hoveredStageIndex, setHoveredStageIndex] = useState<number | null>(null);

  const total = exam.total_questions || 100;
  const ext = exam.extracted_questions_count || 0;
  const keyCount = exam.key_mapped_count || 0;
  const expCount = exam.explanations_count || 0;
  const isPublished =
    (exam.status || '').toUpperCase().includes('PUBLISHED') ||
    Boolean(exam.questions_json_path && exam.solutions_json_path);

  // Stage 1 status
  const s1Completed = exam.stage1_status === 'COMPLETED' || isPublished || (ext >= total && ext > 0);
  const s1InProgress = !s1Completed && (exam.stage1_status === 'IN_PROGRESS' || Boolean(exam.is_extracting));
  const s1Missing = exam.stage1_status === 'MISSING_INPUT' || (!exam.has_question_paper && ext === 0);

  // Stage 2 status
  const targetQ = ext > 0 ? ext : total;
  const s2Completed = exam.stage2_status === 'COMPLETED' || isPublished || (keyCount >= targetQ && targetQ > 0);
  const s2InProgress = exam.stage2_status === 'IN_PROGRESS';
  const s2Missing = exam.stage2_status === 'MISSING_INPUT' || (!exam.has_answer_key && keyCount === 0 && !exam.paper_set_code);

  // Stage 3 status
  const stage3Completed = exam.stage3_status === 'COMPLETED' || isPublished || (expCount >= targetQ && targetQ > 0);
  const stage3InProgress = exam.stage3_status === 'IN_PROGRESS';

  const isExtracting = !s1Completed && Boolean(
    exam.is_extracting ||
    s1InProgress ||
    exam.stage1_status === 'IN_PROGRESS' ||
    exam.overall_status === 'PROCESSING' ||
    ['PROCESSING', 'EXTRACTING', 'RUNNING', 'INITIALIZING', 'PARSING_PDF'].includes((exam.status || '').toUpperCase()) ||
    ['PROCESSING', 'EXTRACTING', 'RUNNING', 'INITIALIZING'].includes((exam.overall_status || '').toUpperCase())
  );

  const isPipelineComplete =
    !isExtracting &&
    !s2InProgress &&
    !stage3InProgress &&
    ((s1Completed && s2Completed && stage3Completed) ||
      exam.overall_status === 'READY_FOR_REVIEW' ||
      exam.overall_status === 'PUBLISHED' ||
      (exam.status || '').toUpperCase() === 'COMPLETED' ||
      (exam.status || '').toUpperCase() === 'PUBLISHED' ||
      (exam.status || '').toUpperCase() === 'PENDING_HUMAN_REVIEW');

  return (
    <tr
      className="pipeline-table-row"
      onClick={() => onSelect(exam)}
      onMouseEnter={() => setRowHovered(true)}
      onMouseLeave={() => {
        setRowHovered(false);
        setHoveredStageIndex(null);
      }}
      style={{
        borderBottom: isLast ? 'none' : '1px solid #E2E8F0',
        backgroundColor: rowHovered ? 'var(--bg-subtle)' : 'var(--bg-card)',
        cursor: 'pointer',
        transition: 'background-color 150ms ease-out',
        position: 'relative',
      }}
    >
      {/* EXAM PAPER (Clean title & year) */}
      <td
        className="pipeline-cell cell-exam-paper"
        style={{
          padding: '14px 16px',
          maxWidth: 280,
          borderLeft: rowHovered ? '3px solid var(--primary-red)' : '3px solid transparent',
          transition: 'border-left 150ms ease-out',
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--deep-navy)', lineHeight: 1.3 }}>
          {cleanExamTitle(exam.name)}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
          {examYearLabel(exam)}
        </div>
      </td>

      {/* STATUS */}
      <td className="pipeline-cell cell-status" style={{ padding: '14px 16px', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
        {renderStatusBadge(exam.status)}
      </td>

      {/* SINGLE EXTRACTION STATUS */}
      <td className="pipeline-cell cell-extraction" style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 140, maxWidth: 240, width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span
              style={{
                padding: '3px 8px',
                borderRadius: 'var(--radius)',
                fontSize: 11.5,
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                backgroundColor: s1Completed ? 'var(--status-success-bg)' : isExtracting ? 'var(--status-warning-bg)' : s1Missing ? '#FEF2F2' : 'var(--bg-hover)',
                color: s1Completed ? '#15803D' : isExtracting ? 'var(--status-warning)' : s1Missing ? '#B42318' : 'var(--text-muted)',
                border: `1px solid ${s1Completed ? '#86EFAC' : isExtracting ? '#FDE68A' : s1Missing ? '#FECDCA' : 'var(--border-color)'}`,
              }}
            >
              {s1Completed ? (
                <CheckCircle2 size={12} />
              ) : isExtracting ? (
                <Loader2 size={12} className="animate-spin" />
              ) : s1Missing ? (
                <AlertCircle size={12} />
              ) : (
                <FileText size={12} />
              )}
              <span>
                {s1Completed
                  ? `Extracted (${ext}/${total} Qs)`
                  : isExtracting
                  ? `Extracting (${ext}/${total} Qs)`
                  : s1Missing
                  ? 'Missing Paper'
                  : `Queued (${ext}/${total} Qs)`}
              </span>
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: s1Completed ? '#15803D' : isExtracting ? 'var(--status-warning)' : 'var(--text-muted)' }}>
              {Math.min(100, Math.round((ext / (total || 1)) * 100))}%
            </span>
          </div>

          {/* Micro Progress Bar */}
          <div style={{ width: '100%', height: 4, backgroundColor: 'var(--border-color)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${Math.min(100, Math.round((ext / (total || 1)) * 100))}%`,
                backgroundColor: s1Completed ? 'var(--status-success)' : isExtracting ? 'var(--status-warning)' : 'var(--text-disabled)',
                transition: 'width 300ms ease-out',
              }}
            />
          </div>
        </div>
      </td>

      {/* OVERALL STATUS */}
      <td className="pipeline-cell cell-overall" style={{ padding: '14px 16px', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
        {renderOverallStatusBadge(exam)}
      </td>

      {/* ACTIONS */}
      <td className="pipeline-cell cell-actions" style={{ padding: '14px 16px', textAlign: 'right', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
        <div style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => onSelect(exam)}
            style={{
              padding: '5px 12px',
              fontSize: 12.5,
              fontWeight: 600,
              color: 'var(--deep-navy)',
              background: 'var(--bg-card)',
              border: '1px solid #E2E8F0',
              borderRadius: 'var(--radius)',
              cursor: 'pointer',
              boxShadow: rowHovered ? '0 1px 2px rgba(15, 23, 42, 0.05)' : 'none',
              transition: 'all 150ms ease-out',
            }}
          >
            Details
          </button>

          {isExtracting ? (
            <button
              disabled
              style={{
                padding: '5px 10px',
                fontSize: 11.5,
                fontWeight: 600,
                color: 'var(--text-disabled)',
                background: 'var(--bg-hover)',
                borderRadius: 'var(--radius)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                border: '1px solid #E2E8F0',
                cursor: 'not-allowed',
              }}
              title="Exam is currently undergoing extraction — review is locked"
            >
              <Loader2 size={11} className="animate-spin text-amber-600" />
              In Extraction
            </button>
          ) : isPipelineComplete ? (
            <button
              onClick={() => {
                if (onNavigate) {
                  onNavigate('review', exam);
                } else {
                  onSelect(exam);
                }
              }}
              style={{
                padding: '5px 13px',
                fontSize: 12.5,
                fontWeight: 600,
                color: 'var(--bg-card)',
                background: 'var(--primary-red)',
                border: 'none',
                borderRadius: 'var(--radius)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                boxShadow: '0 1px 2px rgba(var(--primary-red-rgb), 0.2)',
                transition: 'all 150ms ease-out',
              }}
            >
              <Check size={13} />
              Review Exam
            </button>
          ) : (
            <span
              style={{
                padding: '5px 10px',
                fontSize: 11.5,
                fontWeight: 600,
                color: 'var(--text-muted)',
                background: 'var(--bg-hover)',
                borderRadius: 'var(--radius)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                border: '1px solid #E2E8F0',
              }}
              title="Review will be available once all pipeline stages complete"
            >
              <Loader2 size={11} className="animate-spin" />
              Pipeline Running
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}

// ----------------------------------------------------------------------
// 2b. Mobile Pipeline Card Component (Optimized Native Mobile Layout)
// ----------------------------------------------------------------------
function MobilePipelineCard({
  exam,
  onSelect,
  onNavigate,
  renderOverallStatusBadge,
  renderStatusBadge,
}: {
  exam: ExamPipelineStatusItem;
  onSelect: (exam: ExamPipelineStatusItem) => void;
  onNavigate?: (view: string, extraData?: any) => void;
  renderOverallStatusBadge: (exam: ExamPipelineStatusItem) => React.ReactNode;
  renderStatusBadge: (status: string) => React.ReactNode;
}) {
  const total = exam.total_questions || 100;
  const ext = exam.extracted_questions_count || 0;
  const keyCount = exam.key_mapped_count || 0;
  const expCount = exam.explanations_count || 0;
  const isPublished =
    (exam.status || '').toUpperCase().includes('PUBLISHED') ||
    Boolean(exam.questions_json_path && exam.solutions_json_path);

  // Stage 1 status
  const s1Completed = exam.stage1_status === 'COMPLETED' || isPublished || (ext >= total && ext > 0);
  const s1InProgress = !s1Completed && (exam.stage1_status === 'IN_PROGRESS' || Boolean(exam.is_extracting));
  const s1Missing = exam.stage1_status === 'MISSING_INPUT' || (!exam.has_question_paper && ext === 0);

  // Stage 2 status
  const targetQ = ext > 0 ? ext : total;
  const s2Completed = exam.stage2_status === 'COMPLETED' || isPublished || (keyCount >= targetQ && targetQ > 0);
  const s2InProgress = exam.stage2_status === 'IN_PROGRESS';

  // Stage 3 status
  const stage3Completed = exam.stage3_status === 'COMPLETED' || isPublished || (expCount >= targetQ && targetQ > 0);
  const stage3InProgress = exam.stage3_status === 'IN_PROGRESS';

  const isExtracting = !s1Completed && Boolean(
    exam.is_extracting ||
    s1InProgress ||
    exam.stage1_status === 'IN_PROGRESS' ||
    exam.overall_status === 'PROCESSING' ||
    ['PROCESSING', 'EXTRACTING', 'RUNNING', 'INITIALIZING', 'PARSING_PDF'].includes((exam.status || '').toUpperCase()) ||
    ['PROCESSING', 'EXTRACTING', 'RUNNING', 'INITIALIZING'].includes((exam.overall_status || '').toUpperCase())
  );

  const isPipelineComplete =
    !isExtracting &&
    !s2InProgress &&
    !stage3InProgress &&
    ((s1Completed && s2Completed && stage3Completed) ||
      exam.overall_status === 'READY_FOR_REVIEW' ||
      exam.overall_status === 'PUBLISHED' ||
      (exam.status || '').toUpperCase() === 'COMPLETED' ||
      (exam.status || '').toUpperCase() === 'PUBLISHED' ||
      (exam.status || '').toUpperCase() === 'PENDING_HUMAN_REVIEW');

  const percent = Math.min(100, Math.round((ext / (total || 1)) * 100));

  return (
    <div
      onClick={() => onSelect(exam)}
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid #E2E8F0',
        borderRadius: 'var(--radius)',
        padding: '14px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
        cursor: 'pointer',
        transition: 'all 150ms ease-out',
        borderLeft: '3px solid var(--primary-red)',
      }}
    >
      {/* Top Row: Exam Info & Badges */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--deep-navy)', lineHeight: 1.3, wordBreak: 'break-word' }}>
            {cleanExamTitle(exam.name)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {examYearLabel(exam, 'Year unspecified')}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
          {renderStatusBadge(exam.status)}
          {renderOverallStatusBadge(exam)}
        </div>
      </div>

      {/* Middle Row: Extraction Progress */}
      <div style={{ backgroundColor: 'var(--bg-subtle)', border: '1px solid #E2E8F0', borderRadius: 'var(--radius)', padding: '10px 12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 'var(--radius)',
              fontSize: 11,
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              backgroundColor: s1Completed ? 'var(--status-success-bg)' : isExtracting ? 'var(--status-warning-bg)' : s1Missing ? '#FEF2F2' : 'var(--bg-hover)',
              color: s1Completed ? '#15803D' : isExtracting ? 'var(--status-warning)' : s1Missing ? '#B42318' : 'var(--text-muted)',
              border: `1px solid ${s1Completed ? '#86EFAC' : isExtracting ? '#FDE68A' : s1Missing ? '#FECDCA' : 'var(--border-color)'}`,
            }}
          >
            {s1Completed ? (
              <CheckCircle2 size={11} />
            ) : isExtracting ? (
              <Loader2 size={11} className="animate-spin" />
            ) : s1Missing ? (
              <AlertCircle size={11} />
            ) : (
              <FileText size={11} />
            )}
            <span>
              {s1Completed
                ? `Extracted (${ext}/${total} Qs)`
                : isExtracting
                ? `Extracting (${ext}/${total} Qs)`
                : s1Missing
                ? 'Missing Paper'
                : `Queued (${ext}/${total} Qs)`}
            </span>
          </span>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: s1Completed ? '#15803D' : isExtracting ? 'var(--status-warning)' : 'var(--text-muted)' }}>
            {percent}%
          </span>
        </div>

        {/* Micro Progress Bar */}
        <div style={{ width: '100%', height: 5, backgroundColor: 'var(--border-color)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${percent}%`,
              backgroundColor: s1Completed ? 'var(--status-success)' : isExtracting ? 'var(--status-warning)' : 'var(--text-disabled)',
              transition: 'width 300ms ease-out',
            }}
          />
        </div>
      </div>

      {/* Bottom Row: Actions */}
      <div
        style={{ display: 'flex', gap: 8, width: '100%', marginTop: 2 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => onSelect(exam)}
          style={{
            flex: 1,
            padding: '8px 12px',
            fontSize: 12.5,
            fontWeight: 600,
            color: 'var(--deep-navy)',
            background: 'var(--bg-card)',
            border: '1px solid #CBD5E1',
            borderRadius: 'var(--radius)',
            cursor: 'pointer',
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          Details
        </button>

        {isExtracting ? (
          <button
            type="button"
            disabled
            style={{
              flex: 1,
              padding: '8px 12px',
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--text-disabled)',
              background: 'var(--bg-hover)',
              borderRadius: 'var(--radius)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              border: '1px solid #E2E8F0',
              cursor: 'not-allowed',
            }}
          >
            <Loader2 size={12} className="animate-spin text-amber-600" />
            In Extraction
          </button>
        ) : isPipelineComplete ? (
          <button
            type="button"
            onClick={() => {
              if (onNavigate) {
                onNavigate('review', exam);
              }
            }}
            style={{
              flex: 1,
              padding: '8px 12px',
              fontSize: 12.5,
              fontWeight: 600,
              color: 'var(--bg-card)',
              background: 'var(--primary-red)',
              border: '1px solid var(--primary-red)',
              borderRadius: 'var(--radius)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <Check size={13} />
            Review Exam
          </button>
        ) : (
          <span
            style={{
              flex: 1,
              padding: '8px 12px',
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--text-muted)',
              background: 'var(--bg-hover)',
              borderRadius: 'var(--radius)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              border: '1px solid #E2E8F0',
            }}
          >
            <Loader2 size={12} className="animate-spin" />
            Processing
          </span>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Main UploadReviewView Component
// ----------------------------------------------------------------------
export function UploadReviewView({ onNavigate, initialTab = 'PIPELINE_ONLY' }: UploadReviewViewProps = {}) {
  const { isMobile, isTabletOrBelow } = useBreakpoint();

  const {
    uploadMode,
    setUploadMode,
    paperMode,
    setPaperMode,
    availableExamTypes,
    examName,
    setExamName,
    year,
    setYear,
    setCode,
    setSetCode,
    paperType,
    setPaperType,
    marksPerQuestion,
    setMarksPerQuestion,
    negativeMarks,
    setNegativeMarks,
    selectedFile,
    setSelectedFile,
    isUploading,
    statusMessage,
    isDragOver,
    fileInputRef,
    conflictModal,
    setConflictModal,
    handleFileChange,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleSubmit: handleHookSubmit,
    handleConflictResolve,
  } = useExamUpload();

  // Live Pipeline State
  const [pipelineExams, setPipelineExams] = useState<ExamPipelineStatusItem[]>([]);
  const [stuckPipelines, setStuckPipelines] = useState<StuckPipelineItem[]>([]);
  const [resumingExamId, setResumingExamId] = useState<number | string | null>(null);
  const [loadingQueue, setLoadingQueue] = useState<boolean>(true);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [stageFilter, setStageFilter] = useState<string>('ALL');
  const [examFilter, setExamFilter] = useState<string>('ALL');

  // Always show PIPELINE_ONLY as main screen; Upload is a modal

  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(initialTab === 'UPLOAD_ONLY');

  // Open upload modal if initialTab changes to UPLOAD_ONLY
  useEffect(() => {
    if (initialTab === 'UPLOAD_ONLY') {
      setIsUploadModalOpen(true);
    }
  }, [initialTab]);

  // Table Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(8);

  // Reset pagination to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, stageFilter, examFilter]);

  // Slide-out Audit Drawer
  const [selectedExam, setSelectedExam] = useState<ExamPipelineStatusItem | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [examToDelete, setExamToDelete] = useState<ExamPipelineStatusItem | null>(null);
  const [deletingExam, setDeletingExam] = useState<boolean>(false);

  const loadStuckPipelines = async () => {
    try {
      const stuckData = await fetchStuckPipelines();
      setStuckPipelines(stuckData);
    } catch (err: any) {
      console.error('Failed to load stuck pipelines:', err);
    }
  };

  const loadRealTimeQueue = async (isSilent: boolean = false) => {
    if (!isSilent) setLoadingQueue(true);
    setQueueError(null);
    try {
      const data = await fetchExamPipelineStatuses();
      setPipelineExams(data);
      if (selectedExam) {
        const updated = data.find((item) => item.id === selectedExam.id);
        if (updated) setSelectedExam(updated);
      }
    } catch (err: any) {
      console.error('Failed to load real-time pipeline queue:', err);
      if (!isSilent) setQueueError(err.message || 'Could not load pipeline jobs.');
    } finally {
      if (!isSilent) setLoadingQueue(false);
    }
  };

  const handleResumePipeline = async (examId: number | string, examName: string) => {
    setResumingExamId(examId);
    try {
      const res = await resumeExamPipeline(examId);
      setToastMessage(res.message || `Pipeline for '${examName}' resumed successfully!`);
      setTimeout(() => setToastMessage(null), 5000);
      setStuckPipelines((prev) => prev.filter((p) => p.exam_id !== examId));
      await loadRealTimeQueue(true);
    } catch (err: any) {
      alert(`Could not resume pipeline: ${err.message}`);
    } finally {
      setResumingExamId(null);
    }
  };

  const handleDismissStuck = async (examId: number | string) => {
    try {
      await dismissStuckPipeline(examId);
      setStuckPipelines((prev) => prev.filter((p) => p.exam_id !== examId));
    } catch (err: any) {
      console.error('Failed to dismiss stuck pipeline prompt:', err);
    }
  };

  const handleConfirmDeleteExam = async () => {
    if (!examToDelete) return;
    setDeletingExam(true);
    try {
      await deleteAdminExam(examToDelete.id);
      setToastMessage(`Exam '${examToDelete.name}' and all associated data were deleted.`);
      setTimeout(() => setToastMessage(null), 5000);
      setExamToDelete(null);
      setIsDrawerOpen(false);
      setSelectedExam(null);
      await loadRealTimeQueue(false);
    } catch (err: any) {
      alert(`Error deleting exam: ${err.message}`);
    } finally {
      setDeletingExam(false);
    }
  };

  const pollerRef = useRef<AdaptivePollerController | null>(null);

  // Initial load and Adaptive Non-Linear Polling for pipeline queue updates
  useEffect(() => {
    loadRealTimeQueue(false);
    loadStuckPipelines();

    const poller = createAdaptivePoller(
      async () => {
        try {
          const data = await fetchExamPipelineStatuses();
          setPipelineExams(data);
          if (selectedExam) {
            const updated = data.find((item) => item.id === selectedExam.id);
            if (updated) setSelectedExam(updated);
          }

          const hasActive = data.some(
            (e) =>
              (e.status || '').toUpperCase().includes('PROCESSING') ||
              (e.status || '').toUpperCase().includes('IN_PROGRESS') ||
              (e.overall_status || '').toUpperCase().includes('PROCESSING')
          );

          const activeTasks = data.filter((e) =>
            (e.status || '').toUpperCase().includes('PROCESSING') ||
            (e.status || '').toUpperCase().includes('IN_PROGRESS')
          );
          const maxProgress = activeTasks.length > 0
            ? Math.max(...activeTasks.map((t) => (t.stage3_status === 'COMPLETED' ? 95 : t.stage2_status === 'COMPLETED' ? 66 : 33)))
            : 0;

          return {
            hasActiveTask: hasActive,
            progressPercent: maxProgress,
            isCompleted: !hasActive,
          };
        } catch (err) {
          console.error('Adaptive poller error fetching queue:', err);
          return { hasActiveTask: false };
        }
      },
      {
        initialDelayMs: 8000,
        minDelayMs: 3000,
        maxDelayMs: 30000,
        idleDelayMs: 35000,
        activeDecayStepMs: 2000,
      }
    );

    pollerRef.current = poller;
    poller.start();

    return () => {
      poller.stop();
      pollerRef.current = null;
    };
  }, []);

  const handleFormSubmit = async (e: React.FormEvent) => {
    // Keep the dialog open when the upload was refused, so its message stays visible
    if (!(await handleHookSubmit(e))) return;
    setTimeout(() => {
      pollerRef.current?.resetCurve();
      loadRealTimeQueue(true);
      setIsUploadModalOpen(false);
    }, 1200);
  };

  // Filter real-time jobs
  const filteredQueueExams = pipelineExams.filter((exam) => {
    const matchesSearch =
      !searchQuery ||
      exam.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exam.code.toLowerCase().includes(searchQuery.toLowerCase());

    const statusUpper = (exam.status || '').toUpperCase();
    const overallUpper = (exam.overall_status || '').toUpperCase();
    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'PROCESSING' && (statusUpper.includes('PROCESSING') || statusUpper.includes('PARSING') || overallUpper.includes('PROCESSING'))) ||
      (statusFilter === 'PENDING' && (statusUpper.includes('PENDING') || overallUpper.includes('REVIEW'))) ||
      (statusFilter === 'COMPLETED' && (statusUpper.includes('PUBLISHED') || statusUpper.includes('READY') || overallUpper === 'PUBLISHED')) ||
      (statusFilter === 'FAILED' && (statusUpper.includes('FAILED') || statusUpper.includes('REJECTED') || overallUpper.includes('MISSING')));

    const matchesStage = stageFilter === 'ALL' || exam.stage?.toLowerCase() === stageFilter.toLowerCase();
    
    const matchesExam = examFilter === 'ALL' || (exam.exam_type_code || '').toLowerCase() === examFilter;

    return matchesSearch && matchesStatus && matchesStage && matchesExam;
  });

  // Exam filter options come from the exam-types API (keyed by type code) so the
  // dropdown matches the configured exam types rather than ad-hoc paper names.
  // Types referenced by papers but missing from the active list are appended.
  const uniqueExamOptions = useMemo(() => {
    const options = new Map<string, string>();
    (availableExamTypes || []).forEach((t) => {
      if (t.type) options.set(t.type.toLowerCase(), t.name || t.type.toUpperCase());
    });
    pipelineExams.forEach((e) => {
      const code = (e.exam_type_code || '').toLowerCase();
      if (code && !options.has(code)) options.set(code, e.exam_type_name || code.toUpperCase());
    });
    return Array.from(options.entries())
      .map(([value, name]) => ({ value, label: `${name} (${value.toUpperCase()})` }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [availableExamTypes, pipelineExams]);

  // Table Pagination Computations
  const totalPages = Math.max(1, Math.ceil(filteredQueueExams.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedExams = useMemo(() => {
    const startIdx = (safeCurrentPage - 1) * pageSize;
    return filteredQueueExams.slice(startIdx, startIdx + pageSize);
  }, [filteredQueueExams, safeCurrentPage, pageSize]);

  // KPI Counts
  const totalExamsCount = pipelineExams.length;
  const publishedCount = pipelineExams.filter((e) => {
    const s = (e.status || '').toUpperCase();
    return s.includes('PUBLISHED') || Boolean(e.questions_json_path && e.solutions_json_path);
  }).length;

  const pendingCount = pipelineExams.filter((e) => {
    const s = (e.status || '').toUpperCase();
    const isPublished = s.includes('PUBLISHED') || Boolean(e.questions_json_path && e.solutions_json_path);
    return !isPublished;
  }).length;

  const renderOverallStatusBadge = (exam: ExamPipelineStatusItem) => {
    const statusUpper = (exam.status || '').toUpperCase();
    const isPublished = statusUpper.includes('PUBLISHED') || Boolean(exam.questions_json_path && exam.solutions_json_path);
    const overall = (exam.overall_status || '').toUpperCase();

    if (isPublished) {
      return (
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: '#15803D',
            backgroundColor: 'var(--status-success-bg)',
            border: '1px solid #86EFAC',
            padding: '3px 9px',
            borderRadius: 'var(--radius)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          <Database size={12} />
          Live & Ready
        </span>
      );
    }

    if (overall === 'MISSING_INPUTS' || exam.stage1_status === 'MISSING_INPUT' || exam.stage2_status === 'MISSING_INPUT') {
      return (
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: '#B42318',
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECDCA',
            padding: '3px 9px',
            borderRadius: 'var(--radius)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          <AlertCircle size={12} />
          Missing Input
        </span>
      );
    }

    if (overall === 'PROCESSING' || exam.stage1_status === 'IN_PROGRESS' || statusUpper.includes('PROCESSING') || statusUpper.includes('PARSING')) {
      return (
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: '#0369A1',
            backgroundColor: '#E0F2FE',
            border: '1px solid #BAE6FD',
            padding: '3px 9px',
            borderRadius: 'var(--radius)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          <Loader2 size={12} className="animate-spin" color="var(--primary-red)" />
          Pipeline Processing
        </span>
      );
    }

    return (
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--status-warning)',
          backgroundColor: 'var(--status-warning-bg)',
          border: '1px solid #FDE68A',
          padding: '3px 9px',
          borderRadius: 'var(--radius)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
        }}
      >
        <Clock size={12} />
        Pending QA Review
      </span>
    );
  };

  const renderStatusBadge = (statusStr: string) => {
    const s = (statusStr || '').toUpperCase();
    if (s.includes('PUBLISHED') || s.includes('READY')) {
      return (
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: '#15803D',
            backgroundColor: 'var(--status-success-bg)',
            border: '1px solid #86EFAC',
            padding: '3px 9px',
            borderRadius: 'var(--radius)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: 'var(--radius)', backgroundColor: 'var(--status-success)' }} />
          Published
        </span>
      );
    }
    if (s.includes('PROCESSING') || s.includes('PARSING')) {
      return (
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: '#0369A1',
            backgroundColor: '#E0F2FE',
            border: '1px solid #BAE6FD',
            padding: '3px 9px',
            borderRadius: 'var(--radius)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          <Loader2 size={12} className="animate-spin" color="var(--primary-red)" />
          Processing
        </span>
      );
    }
    if (s.includes('FAILED') || s.includes('REJECTED')) {
      return (
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: '#B42318',
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECDCA',
            padding: '3px 9px',
            borderRadius: 'var(--radius)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: 'var(--radius)', backgroundColor: '#DC2626' }} />
          Failed
        </span>
      );
    }
    return (
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--status-warning)',
          backgroundColor: 'var(--status-warning-bg)',
          border: '1px solid #FDE68A',
          padding: '3px 9px',
          borderRadius: 'var(--radius)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: 'var(--radius)', backgroundColor: '#F2B623' }} />
        Pending Review
      </span>
    );
  };

  return (
    <div style={{ maxWidth: 1320, margin: '0 auto', fontFamily: 'Inter, sans-serif', paddingBottom: 60 }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: 24,
            right: 24,
            zIndex: 9999,
            backgroundColor: '#15803D',
            color: 'var(--bg-card)',
            padding: '12px 20px',
            borderRadius: 'var(--radius)',
            boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 13.5,
            fontWeight: 600,
          }}
        >
          <CheckCircle2 size={18} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: isMobile ? 'stretch' : 'flex-start',
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? 12 : 16,
          marginBottom: isMobile ? 16 : 24,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: isMobile ? 21 : 26,
              fontWeight: 700,
              color: 'var(--deep-navy)',
              margin: 0,
              letterSpacing: '-0.02em',
              lineHeight: 1.25,
            }}
          >
            Exam Paper Pipeline
          </h1>
          <p style={{ fontSize: isMobile ? 12.5 : 13.5, color: 'var(--text-muted)', marginTop: 4, margin: '4px 0 0 0', lineHeight: 1.4 }}>
            Upload, process, review and publish examination papers through the content pipeline.
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: isMobile ? '100%' : 'auto' }}>
          <>
            <button
              onClick={() => loadRealTimeQueue(false)}
              disabled={loadingQueue}
              style={{
                flex: isMobile ? 1 : 'none',
                justifyContent: 'center',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '9px 14px',
                fontSize: 13,
                fontWeight: 500,
                borderRadius: 'var(--radius)',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--deep-navy)',
                border: '1px solid #E2E8F0',
                cursor: loadingQueue ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
              }}
              title="Refresh Real-Time Pipeline Status"
            >
              <RefreshCw size={14} className={loadingQueue ? 'animate-spin' : ''} color="var(--text-muted)" />
              <span>Refresh</span>
            </button>

            <button
              onClick={() => setIsUploadModalOpen(true)}
              style={{
                flex: isMobile ? 1 : 'none',
                justifyContent: 'center',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '9px 16px',
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 'var(--radius)',
                backgroundColor: 'var(--deep-navy)',
                color: 'var(--bg-card)',
                border: '1px solid #172033',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(15, 23, 42, 0.08)',
                transition: 'background 0.15s ease',
                whiteSpace: 'nowrap',
              }}
            >
              <Upload size={15} />
              <span>Upload Paper</span>
            </button>
          </>
        </div>
      </div>

      {/* 2. Compact 4 Metric Cards (Shown in Pipeline View) */}
      {(
        <>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: isMobile ? 10 : 16,
          marginBottom: isMobile ? 16 : 24,
        }}
      >
        <MetricCard
          title="Total Exam Papers"
          value={totalExamsCount}
          supportingText="Extracted & cataloged"
          icon={<FileSpreadsheet size={17} color="var(--primary-red)" />}
          isMobile={isMobile}
        />
        <MetricCard
          title="Pending Review"
          value={pendingCount}
          supportingText="Awaiting verification"
          icon={<Clock size={17} color="var(--primary-red)" />}
          isMobile={isMobile}
        />
        <MetricCard
          title="Published"
          value={publishedCount}
          supportingText="Catalog live & active"
          icon={<CheckCircle2 size={17} color="var(--primary-red)" />}
          isMobile={isMobile}
        />
      </div>

      {/* Interrupted Task Alert */}
      {stuckPipelines.length > 0 && (
        <div
          style={{
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECDCA',
            borderRadius: 'var(--radius)',
            padding: '16px 20px',
            marginBottom: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            boxShadow: '0 2px 6px rgba(220,38,38,0.06)',
          }}
        >
          {stuckPipelines.map((stuck) => (
            <div
              key={stuck.exam_id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 'var(--radius)',
                    backgroundColor: 'var(--primary-red-bg)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <AlertTriangle size={18} color="#DC2626" />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#991B1B' }}>
                    Interrupted Task: {stuck.exam_name}
                  </div>
                  <div style={{ fontSize: 12.5, color: '#B91C1C', marginTop: 2 }}>
                    Task was interrupted during <strong>{formatEnum(stuck.pipeline_type)}</strong> ({formatEnum(stuck.current_step) || 'Server reload'}).
                    Resuming will automatically skip previously completed items.
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={() => handleResumePipeline(stuck.exam_id, stuck.exam_name)}
                  disabled={resumingExamId === stuck.exam_id}
                  style={{
                    padding: '7px 14px',
                    backgroundColor: '#DC2626',
                    color: 'var(--bg-card)',
                    fontSize: 12.5,
                    fontWeight: 600,
                    borderRadius: 'var(--radius)',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  {resumingExamId === stuck.exam_id ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Resuming...
                    </>
                  ) : (
                    <>
                      <RefreshCw size={14} />
                      Resume Task
                    </>
                  )}
                </button>
                <button
                  onClick={() => handleDismissStuck(stuck.exam_id)}
                  style={{
                    padding: '7px 12px',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-secondary)',
                    fontSize: 12.5,
                    fontWeight: 600,
                    borderRadius: 'var(--radius)',
                    border: '1px solid #CBD5E1',
                    cursor: 'pointer',
                  }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      </>
      )}



      {/* Upload Question Paper Modal */}
      {isUploadModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setIsUploadModalOpen(false); }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 680,
              maxHeight: '90vh',
              overflowY: 'auto',
              background: 'var(--bg-card)',
              border: '1px solid #E2E8F0',
              borderRadius: 'var(--radius)',
              padding: isMobile ? '18px 14px' : 28,
              boxShadow: '0 20px 40px rgba(15, 23, 42, 0.2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 4, height: 20, backgroundColor: 'var(--primary-red)', borderRadius: 'var(--radius)' }} />
                <h2 style={{ fontSize: isMobile ? 15.5 : 17, fontWeight: 700, color: 'var(--deep-navy)', margin: 0, letterSpacing: '-0.01em' }}>
                  Upload Question Paper PDF
                </h2>
              </div>
              <button aria-label="Close"
                onClick={() => setIsUploadModalOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 4,
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: 20,
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '0 0 18px 0', lineHeight: 1.4 }}>
              Configure examination parameters and upload PDF paper to ingest into content pipeline.
            </p>


          <form onSubmit={handleFormSubmit}>
            {/* Paper mode: one exam & year, or a bank mixing exams and years */}
            <div
              role="radiogroup"
              aria-label="Paper type"
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 4,
                padding: 4,
                marginBottom: 16,
                borderRadius: 'var(--radius)',
                backgroundColor: 'var(--bg-subtle)',
                border: '1px solid var(--border-color)',
              }}
            >
              {([
                { value: 'EXAM_WISE', label: 'Exam-wise paper', hint: 'One exam, one year' },
                { value: 'MIXED', label: 'Mixed question bank', hint: 'Exams & years vary per question' },
              ] as const).map((opt) => {
                const active = paperMode === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setPaperMode(opt.value)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 'var(--radius)',
                      border: active ? '1px solid var(--primary-red)' : '1px solid transparent',
                      backgroundColor: active ? 'var(--bg-card)' : 'transparent',
                      boxShadow: active ? '0 1px 3px rgba(15, 23, 42, 0.08)' : 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 700, color: active ? 'var(--primary-red)' : 'var(--deep-navy)' }}>
                      {opt.label}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{opt.hint}</div>
                  </button>
                );
              })}
            </div>

            {paperMode === 'MIXED' && (
              <div
                style={{
                  marginBottom: 20,
                  padding: '10px 12px',
                  borderRadius: 'var(--radius)',
                  backgroundColor: 'var(--bg-subtle)',
                  border: '1px solid var(--border-color)',
                  fontSize: 12.5,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.5,
                }}
              >
                No exam or year needed. Each question&apos;s exam and year are read from its tag, e.g.{' '}
                <strong>[MPSC Mains 2017]</strong>. Subject, Microtheme, Nano Theme and difficulty are tagged by AI
                after upload. The bank is named after the file.
              </div>
            )}

            {/* Metadata Inputs Grid */}
            <div
              style={{
                display: paperMode === 'MIXED' ? 'none' : 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 16,
                marginBottom: 20,
              }}
            >
              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Target Exam
                </label>
                <select
                  value={examName}
                  onChange={(e) => setExamName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 'var(--radius)',
                    border: '1px solid #CBD5E1',
                    fontSize: 13,
                    outline: 'none',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--deep-navy)',
                  }}
                >
                  {availableExamTypes && availableExamTypes.length > 0 ? (
                    availableExamTypes.map((opt) => (
                      <option key={opt.id} value={opt.type}>
                        {opt.name} ({opt.type.toUpperCase()})
                      </option>
                    ))
                  ) : (
                    EXAM_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                  <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Examination Year
                  </label>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    1900 – {YEAR_OPTIONS[0]}
                  </span>
                </div>
                <select
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 'var(--radius)',
                    border: '1px solid #CBD5E1',
                    fontSize: 13,
                    outline: 'none',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--deep-navy)',
                  }}
                >
                  {GROUPED_YEAR_OPTIONS.map((group) => (
                    <optgroup key={group.label} label={group.label}>
                      {group.options.map((yr) => (
                        <option key={yr} value={yr}>
                          {yr}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Paper Set Code
                </label>
                <input
                  type="text"
                  value={setCode}
                  onChange={(e) => setSetCode(e.target.value.toUpperCase())}
                  placeholder="SET_A, SET_B, etc."
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 'var(--radius)',
                    border: '1px solid #CBD5E1',
                    fontSize: 13,
                    outline: 'none',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--deep-navy)',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Paper Classification
                </label>
                <select
                  value={paperType}
                  onChange={(e) => setPaperType(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 'var(--radius)',
                    border: '1px solid #CBD5E1',
                    fontSize: 13,
                    outline: 'none',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--deep-navy)',
                  }}
                >
                  {PAPER_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Marking scheme: asked for every paper and used for every score and report */}
            <fieldset
              style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', padding: '12px 14px 14px', margin: '0 0 20px' }}
            >
              <legend style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-secondary)', padding: '0 6px' }}>
                Marking scheme
              </legend>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                <div>
                  <label htmlFor="marks-per-question" style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    Marks for a correct answer
                  </label>
                  <input
                    id="marks-per-question"
                    type="number"
                    min={0}
                    step="0.01"
                    required
                    value={marksPerQuestion}
                    onChange={(e) => setMarksPerQuestion(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius)', border: '1px solid #CBD5E1', fontSize: 13, backgroundColor: 'var(--bg-card)', color: 'var(--deep-navy)', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label htmlFor="negative-marks" style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    Marks deducted for a wrong answer
                  </label>
                  <input
                    id="negative-marks"
                    type="number"
                    min={0}
                    step="0.01"
                    required
                    value={negativeMarks}
                    onChange={(e) => setNegativeMarks(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius)', border: '1px solid #CBD5E1', fontSize: 13, backgroundColor: 'var(--bg-card)', color: 'var(--deep-navy)', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
              <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                Prefilled from the exam type. Use 0 when there is no negative marking (e.g. 0.67 is a third of 2 marks).
              </p>
            </fieldset>

            {/* Drag & Drop Upload Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${isDragOver ? 'var(--primary-red)' : '#93C5FD'}`,
                backgroundColor: isDragOver ? 'var(--border-color)' : 'var(--bg-subtle)',
                borderRadius: 'var(--radius)',
                padding: isMobile ? '22px 14px' : '32px 24px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 200ms ease-out',
                marginBottom: 20,
              }}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".pdf,.json,.zip"
                style={{ display: 'none' }}
              />
              <div
                style={{
                  width: isMobile ? 40 : 48,
                  height: isMobile ? 40 : 48,
                  borderRadius: 'var(--radius)',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--primary-red)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                  boxShadow: '0 2px 8px rgba(var(--primary-red-rgb), 0.15)',
                  transform: isDragOver ? 'scale(1.1)' : 'scale(1)',
                  transition: 'transform 200ms ease-out',
                }}
              >
                <Cloud size={isMobile ? 22 : 26} />
              </div>
              <div style={{ fontSize: isMobile ? 13 : 14, fontWeight: 700, color: 'var(--deep-navy)' }}>
                {selectedFile ? selectedFile.name : isMobile ? 'Tap to choose Question Paper PDF' : 'Click to upload or drag & drop Question Paper PDF'}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
                Supports standard PDF question papers (Max 50MB)
              </div>
            </div>

            {/* Footer Row */}
            <div
              style={{
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                justifyContent: 'space-between',
                alignItems: isMobile ? 'stretch' : 'center',
                gap: 12,
              }}
            >
              <div style={{ fontSize: 13 }}>
                {statusMessage && (
                  <span style={{ color: statusMessage.isError ? '#DC2626' : 'var(--status-success)', fontWeight: 600 }}>
                    {statusMessage.text}
                  </span>
                )}
              </div>

              <button
                type="submit"
                disabled={isUploading || !selectedFile}
                style={{
                  width: isMobile ? '100%' : 'auto',
                  justifyContent: 'center',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: isMobile ? '11px 18px' : '10px 22px',
                  borderRadius: 'var(--radius)',
                  fontSize: 13.5,
                  fontWeight: 600,
                  backgroundColor: !selectedFile || isUploading ? 'var(--text-disabled)' : 'var(--primary-red)',
                  color: 'var(--bg-card)',
                  border: 'none',
                  cursor: !selectedFile || isUploading ? 'not-allowed' : 'pointer',
                  boxShadow: !selectedFile || isUploading ? 'none' : '0 2px 6px rgba(var(--primary-red-rgb), 0.3)',
                  transition: 'all 150ms ease-out',
                }}
              >
                {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                {isUploading ? 'Uploading & Starting Pipeline...' : 'Upload & Start Extraction Pipeline'}
              </button>
            </div>
          </form>
          </div>
        </div>
      )}

      {/* Pipeline Table View (Pipeline & Artifacts Repository) */}
      {(
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid #E2E8F0',
            borderRadius: 'var(--radius)',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
            overflow: 'hidden',
          }}
        >
          {/* Header & Filter Controls Bar */}
          <div
            style={{
              padding: isMobile ? '12px 14px' : '16px 20px',
              borderBottom: '1px solid #E2E8F0',
              display: 'flex',
              gap: 10,
              alignItems: 'center',
              flexWrap: 'wrap',
              backgroundColor: 'var(--bg-subtle)',
            }}
          >
            <div style={{ position: 'relative', flex: isMobile ? '1 1 100%' : 1, minWidth: isMobile ? '100%' : 260 }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: 11, color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search paper by code or title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 36px',
                  borderRadius: 'var(--radius)',
                  border: '1px solid #CBD5E1',
                  backgroundColor: 'var(--bg-card)',
                  fontSize: 13,
                  color: 'var(--deep-navy)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 8, width: isMobile ? '100%' : 'auto', flex: isMobile ? '1 1 100%' : 'none' }}>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  flex: isMobile ? 1 : 'none',
                  width: isMobile ? '100%' : 'auto',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius)',
                  border: '1px solid #CBD5E1',
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--deep-navy)',
                  backgroundColor: 'var(--bg-card)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              >
                <option value="ALL">All Statuses</option>
                <option value="PROCESSING">Processing</option>
                <option value="PENDING">Pending Review</option>
                <option value="COMPLETED">Published</option>
                <option value="FAILED">Failed</option>
              </select>

              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
                style={{
                  flex: isMobile ? 1 : 'none',
                  width: isMobile ? '100%' : 'auto',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius)',
                  border: '1px solid #CBD5E1',
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--deep-navy)',
                  backgroundColor: 'var(--bg-card)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              >
                <option value="ALL">All Stages</option>
                <option value="prelims">Prelims</option>
              </select>

              <select
                value={examFilter}
                onChange={(e) => setExamFilter(e.target.value)}
                style={{
                  flex: isMobile ? 1 : 'none',
                  width: isMobile ? '100%' : 'auto',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius)',
                  border: '1px solid #CBD5E1',
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--deep-navy)',
                  backgroundColor: 'var(--bg-card)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              >
                <option value="ALL">All Exams</option>
                {uniqueExamOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {(searchQuery || statusFilter !== 'ALL' || stageFilter !== 'ALL' || examFilter !== 'ALL') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('ALL');
                  setStageFilter('ALL');
                  setExamFilter('ALL');
                }}
                style={{
                  width: isMobile ? '100%' : 'auto',
                  padding: '8px 12px',
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  background: 'var(--bg-card)',
                  border: '1px solid #CBD5E1',
                  borderRadius: 'var(--radius)',
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                Clear Filters
              </button>
            )}
          </div>

          {/* Table / Card List Content */}
          {loadingQueue ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13.5 }}>
              <Loader2 size={24} className="animate-spin" color="var(--primary-red)" style={{ margin: '0 auto 10px' }} />
              Loading pipeline records from database...
            </div>
          ) : filteredQueueExams.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13.5 }}>
              <FileSpreadsheet size={32} color="var(--text-disabled)" style={{ margin: '0 auto 10px' }} />
              <div>No examination papers found matching filter criteria.</div>
            </div>
          ) : isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 14px' }}>
              {paginatedExams.map((exam) => (
                <MobilePipelineCard
                  key={exam.id}
                  exam={exam}
                  onSelect={(item) => {
                    setSelectedExam(item);
                    setIsDrawerOpen(true);
                  }}
                  onNavigate={onNavigate}
                  renderOverallStatusBadge={renderOverallStatusBadge}
                  renderStatusBadge={renderStatusBadge}
                />
              ))}
            </div>
          ) : (
            <div className="pipeline-table-wrapper" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <style>{`
                .pipeline-table {
                  width: 100%;
                  min-width: 0;
                }
                @media (max-width: 960px) {
                  .pipeline-table thead {
                    display: none;
                  }
                  .pipeline-table,
                  .pipeline-table tbody {
                    display: block;
                    width: 100%;
                  }
                  .pipeline-table tr.pipeline-table-row {
                    display: flex !important;
                    flex-wrap: wrap !important;
                    align-items: center !important;
                    justify-content: flex-start !important;
                    padding: 14px 16px !important;
                    gap: 12px 16px !important;
                    border-bottom: 1px solid #E2E8F0 !important;
                    height: auto !important;
                    min-height: auto !important;
                  }
                  .pipeline-table tr.pipeline-table-row td.pipeline-cell {
                    padding: 0 !important;
                    border: none !important;
                    white-space: normal !important;
                    height: auto !important;
                    min-height: auto !important;
                  }
                  .pipeline-table tr.pipeline-table-row td.cell-exam-paper {
                    flex: 1 1 200px !important;
                    max-width: 100% !important;
                    height: auto !important;
                  }
                  .pipeline-table tr.pipeline-table-row td.cell-status {
                    flex: 0 0 auto !important;
                  }
                  .pipeline-table tr.pipeline-table-row td.cell-extraction {
                    flex: 1 1 190px !important;
                    max-width: 320px !important;
                    height: auto !important;
                  }
                  .pipeline-table tr.pipeline-table-row td.cell-overall {
                    flex: 0 0 auto !important;
                  }
                  .pipeline-table tr.pipeline-table-row td.cell-actions {
                    flex: 0 0 auto !important;
                    margin-left: auto !important;
                  }
                }
                @media (max-width: 640px) {
                  .pipeline-table tr.pipeline-table-row {
                    flex-direction: column !important;
                    align-items: stretch !important;
                    justify-content: flex-start !important;
                    gap: 12px !important;
                  }
                  .pipeline-table tr.pipeline-table-row td.pipeline-cell {
                    flex: none !important;
                    max-width: 100% !important;
                    width: 100% !important;
                    height: auto !important;
                    min-height: auto !important;
                  }
                  .pipeline-table tr.pipeline-table-row td.cell-exam-paper,
                  .pipeline-table tr.pipeline-table-row td.cell-extraction {
                    flex: none !important;
                    max-width: 100% !important;
                    width: 100% !important;
                    height: auto !important;
                  }
                  .pipeline-table tr.pipeline-table-row td.cell-actions {
                    margin-left: 0 !important;
                    width: 100% !important;
                  }
                  .pipeline-table tr.pipeline-table-row td.cell-actions > div {
                    width: 100% !important;
                    display: flex !important;
                  }
                  .pipeline-table tr.pipeline-table-row td.cell-actions button {
                    flex: 1 !important;
                    justify-content: center !important;
                  }
                }
              `}</style>
              <table className="pipeline-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13.5 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #E2E8F0', backgroundColor: 'var(--bg-subtle)' }}>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 12, letterSpacing: '0.04em' }}>
                      EXAM PAPER
                    </th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 12, letterSpacing: '0.04em' }}>
                      STATUS
                    </th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 12, letterSpacing: '0.04em' }}>
                      EXTRACTION STATUS
                    </th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 12, letterSpacing: '0.04em' }}>
                      OVERALL STATUS
                    </th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 12, letterSpacing: '0.04em', textAlign: 'right' }}>
                      ACTIONS
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedExams.map((exam, i) => (
                    <TableRowItem
                      key={exam.id}
                      exam={exam}
                      isLast={i === paginatedExams.length - 1}
                      onSelect={(item) => {
                        setSelectedExam(item);
                        setIsDrawerOpen(true);
                      }}
                      onNavigate={onNavigate}
                      renderOverallStatusBadge={renderOverallStatusBadge}
                      renderStatusBadge={renderStatusBadge}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Table Pagination Controls */}
          {filteredQueueExams.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexDirection: isMobile ? 'column' : 'row',
                padding: isMobile ? '12px 14px' : '14px 20px',
                borderTop: '1px solid #E2E8F0',
                backgroundColor: 'var(--bg-subtle)',
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              {/* Left: Summary & Page Size Selector */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: isMobile ? 'space-between' : 'flex-start',
                  width: isMobile ? '100%' : 'auto',
                  gap: 16,
                  fontSize: 13,
                  color: 'var(--text-secondary)',
                }}
              >
                <span>
                  Showing{' '}
                  <strong style={{ color: 'var(--deep-navy)', fontWeight: 600 }}>
                    {(safeCurrentPage - 1) * pageSize + 1}
                  </strong>{' '}
                  to{' '}
                  <strong style={{ color: 'var(--deep-navy)', fontWeight: 600 }}>
                    {Math.min(safeCurrentPage * pageSize, filteredQueueExams.length)}
                  </strong>{' '}
                  of{' '}
                  <strong style={{ color: 'var(--deep-navy)', fontWeight: 600 }}>
                    {filteredQueueExams.length}
                  </strong>{' '}
                  papers
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Per page:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    style={{
                      padding: '4px 8px',
                      fontSize: 12,
                      fontWeight: 500,
                      borderRadius: 'var(--radius)',
                      border: '1px solid #CBD5E1',
                      backgroundColor: 'var(--bg-card)',
                      color: '#1E293B',
                      cursor: 'pointer',
                      outline: 'none',
                    }}
                  >
                    <option value={5}>5</option>
                    <option value={8}>8</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                  </select>
                </div>
              </div>

              {/* Right: Page Navigation Buttons */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  width: isMobile ? '100%' : 'auto',
                }}
              >
                <button
                  type="button"
                  disabled={safeCurrentPage === 1}
                  onClick={() => setCurrentPage(1)}
                  title="First Page"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 32,
                    height: 32,
                    borderRadius: 'var(--radius)',
                    border: '1px solid #CBD5E1',
                    backgroundColor: safeCurrentPage === 1 ? 'var(--bg-hover)' : 'var(--bg-card)',
                    color: safeCurrentPage === 1 ? 'var(--text-disabled)' : 'var(--text-secondary)',
                    cursor: safeCurrentPage === 1 ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <ChevronsLeft size={15} />
                </button>

                <button
                  type="button"
                  disabled={safeCurrentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  title="Previous Page"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 32,
                    height: 32,
                    borderRadius: 'var(--radius)',
                    border: '1px solid #CBD5E1',
                    backgroundColor: safeCurrentPage === 1 ? 'var(--bg-hover)' : 'var(--bg-card)',
                    color: safeCurrentPage === 1 ? 'var(--text-disabled)' : 'var(--text-secondary)',
                    cursor: safeCurrentPage === 1 ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <ChevronLeft size={15} />
                </button>

                {/* Page Number Buttons */}
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - safeCurrentPage) <= 1)
                  .reduce<(number | string)[]>((acc, p, idx, arr) => {
                    if (idx > 0 && p - (arr[idx - 1] as number) > 1) {
                      acc.push('...');
                    }
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((item, idx) =>
                    item === '...' ? (
                      <span key={`ellipsis-${idx}`} style={{ padding: '0 4px', color: 'var(--text-disabled)', fontSize: 13 }}>
                        ...
                      </span>
                    ) : (
                      <button
                        key={`page-${item}`}
                        type="button"
                        onClick={() => setCurrentPage(Number(item))}
                        style={{
                          minWidth: 32,
                          height: 32,
                          padding: '0 8px',
                          borderRadius: 'var(--radius)',
                          fontSize: 13,
                          fontWeight: safeCurrentPage === item ? 700 : 500,
                          border: safeCurrentPage === item ? '1px solid #E31B23' : '1px solid #CBD5E1',
                          backgroundColor: safeCurrentPage === item ? '#E31B23' : 'var(--bg-card)',
                          color: safeCurrentPage === item ? 'var(--bg-card)' : 'var(--text-secondary)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {item}
                      </button>
                    )
                  )}

                <button
                  type="button"
                  disabled={safeCurrentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  title="Next Page"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 32,
                    height: 32,
                    borderRadius: 'var(--radius)',
                    border: '1px solid #CBD5E1',
                    backgroundColor: safeCurrentPage === totalPages ? 'var(--bg-hover)' : 'var(--bg-card)',
                    color: safeCurrentPage === totalPages ? 'var(--text-disabled)' : 'var(--text-secondary)',
                    cursor: safeCurrentPage === totalPages ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <ChevronRight size={15} />
                </button>

                <button
                  type="button"
                  disabled={safeCurrentPage === totalPages}
                  onClick={() => setCurrentPage(totalPages)}
                  title="Last Page"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 32,
                    height: 32,
                    borderRadius: 'var(--radius)',
                    border: '1px solid #CBD5E1',
                    backgroundColor: safeCurrentPage === totalPages ? 'var(--bg-hover)' : 'var(--bg-card)',
                    color: safeCurrentPage === totalPages ? 'var(--text-disabled)' : 'var(--text-secondary)',
                    cursor: safeCurrentPage === totalPages ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <ChevronsRight size={15} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Slide-out Examination Pipeline Audit Drawer */}
      {isDrawerOpen && selectedExam && (
        <>
          <div
            onClick={() => setIsDrawerOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.4)',
              backdropFilter: 'blur(2px)',
              zIndex: 190,
            }}
          />

          <div
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              width: isMobile ? '100vw' : 480,
              maxWidth: '100vw',
              backgroundColor: 'var(--bg-card)',
              boxShadow: '-4px 0 24px rgba(15, 23, 42, 0.15)',
              zIndex: 200,
              display: 'flex',
              flexDirection: 'column',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            {/* Drawer Header */}
            <div
              style={{
                padding: isMobile ? '16px 18px' : '20px 24px',
                borderBottom: '1px solid #E2E8F0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
              }}
            >
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  PIPELINE AUDIT & INSPECTION
                </div>
                <h2 style={{ fontSize: isMobile ? 16 : 18, fontWeight: 700, color: 'var(--deep-navy)', margin: '4px 0 0 0' }}>
                  {cleanExamTitle(selectedExam.name)}
                </h2>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {examYearLabel(selectedExam)}
                </div>
              </div>
              <button
                onClick={() => setIsDrawerOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 4,
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Drawer Body */}
            <div style={{ flex: 1, padding: isMobile ? '16px 18px' : 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Overall Status */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>Overall Pipeline & Publication Status</span>
                <div>{renderOverallStatusBadge(selectedExam)}</div>
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid #E2E8F0', margin: 0 }} />

              {/* Prerequisites Check */}
              <div>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                  PIPELINE INPUT PREREQUISITES
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
                  <div
                    style={{
                      padding: 10,
                      background: selectedExam.has_question_paper !== false || selectedExam.extracted_questions_count > 0 ? '#F0FDF4' : '#FEF2F2',
                      border: `1px solid ${selectedExam.has_question_paper !== false || selectedExam.extracted_questions_count > 0 ? '#BBF7D0' : '#FECDCA'}`,
                      borderRadius: 'var(--radius)',
                    }}
                  >
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: selectedExam.has_question_paper !== false || selectedExam.extracted_questions_count > 0 ? '#15803D' : '#DC2626' }}>
                      {selectedExam.has_question_paper !== false || selectedExam.extracted_questions_count > 0 ? '✓ Question Paper PDF' : '✕ Missing Question Paper'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {selectedExam.extracted_questions_count > 0 ? `${selectedExam.extracted_questions_count} Questions Extracted` : 'Not uploaded'}
                    </div>
                  </div>

                  <div
                    style={{
                      padding: 10,
                      background: selectedExam.has_answer_key !== false || (selectedExam.key_mapped_count || 0) > 0 || selectedExam.paper_set_code ? '#F0FDF4' : '#FEF2F2',
                      border: `1px solid ${selectedExam.has_answer_key !== false || (selectedExam.key_mapped_count || 0) > 0 || selectedExam.paper_set_code ? '#BBF7D0' : '#FECDCA'}`,
                      borderRadius: 'var(--radius)',
                    }}
                  >
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: selectedExam.has_answer_key !== false || (selectedExam.key_mapped_count || 0) > 0 || selectedExam.paper_set_code ? '#15803D' : '#DC2626' }}>
                      {selectedExam.has_answer_key !== false || (selectedExam.key_mapped_count || 0) > 0 || selectedExam.paper_set_code ? '✓ Answer Key Mapped' : '✕ Missing Answer Key'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {selectedExam.has_answer_key !== false || (selectedExam.key_mapped_count || 0) > 0 || selectedExam.paper_set_code ? 'Official Key Verified' : 'Awaiting Answer Key'}
                    </div>
                  </div>
                </div>
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid #E2E8F0', margin: 0 }} />

              {/* Extraction Pipeline Details */}
              <div>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
                  EXTRACTION PIPELINE DETAILS
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ background: 'var(--bg-subtle)', border: '1px solid #E2E8F0', borderRadius: 'var(--radius)', padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--deep-navy)' }}>One-Pass Content Extraction</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#15803D' }}>
                        {selectedExam.extracted_questions_count} / {selectedExam.total_questions || 100} Questions & Solutions
                      </span>
                    </div>
                    <div style={{ height: 6, background: 'var(--border-color)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.min(100, Math.round((selectedExam.extracted_questions_count / (selectedExam.total_questions || 100)) * 100))}%`,
                          background: 'var(--status-success)',
                        }}
                      />
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6 }}>
                      Unified extraction captures questions, official SET answer keys, and detailed explanations in a single pipeline pass.
                    </div>
                  </div>
                </div>
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid #E2E8F0', margin: 0 }} />

              {/* Artifact Paths */}
              <div>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                  ARTIFACT PATHS & DEPLOYMENT
                </div>
                <div style={{ background: 'var(--bg-subtle)', padding: 12, borderRadius: 'var(--radius)', border: '1px solid #E2E8F0', fontFamily: 'monospace', fontSize: 11.5, color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
                  <div>Questions JSON: {selectedExam.questions_json_path || 'artifacts/json/questions.json'}</div>
                  <div style={{ marginTop: 6 }}>Solutions JSON: {selectedExam.solutions_json_path || 'artifacts/json/solutions.json'}</div>
                </div>
              </div>
            </div>

            {/* Drawer Actions */}
            <div style={{ padding: 20, borderTop: '1px solid #E2E8F0', backgroundColor: 'var(--bg-subtle)' }}>
            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <button
                onClick={() => setIsDrawerOpen(false)}
                style={{
                  flex: 1,
                  padding: '9px 16px',
                  borderRadius: 'var(--radius)',
                  fontSize: 13,
                  fontWeight: 600,
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid #CBD5E1',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>

              {(() => {
                const isSelectedCompleteStatus =
                  selectedExam.stage1_status === 'COMPLETED' ||
                  selectedExam.overall_status === 'READY_FOR_REVIEW' ||
                  selectedExam.overall_status === 'PUBLISHED' ||
                  (selectedExam.status || '').toUpperCase() === 'COMPLETED' ||
                  (selectedExam.status || '').toUpperCase() === 'PUBLISHED' ||
                  (selectedExam.status || '').toUpperCase() === 'PENDING_HUMAN_REVIEW';

                const isSelectedExtracting = !isSelectedCompleteStatus && Boolean(
                  selectedExam.is_extracting ||
                  selectedExam.stage1_status === 'IN_PROGRESS' ||
                  selectedExam.overall_status === 'PROCESSING' ||
                  ['PROCESSING', 'EXTRACTING', 'RUNNING', 'INITIALIZING', 'PARSING_PDF'].includes((selectedExam.status || '').toUpperCase()) ||
                  ['PROCESSING', 'EXTRACTING', 'RUNNING', 'INITIALIZING'].includes((selectedExam.overall_status || '').toUpperCase())
                );

                const isSelectedComplete =
                  !isSelectedExtracting &&
                  ((selectedExam.stage1_status === 'COMPLETED' && selectedExam.stage2_status === 'COMPLETED' && selectedExam.stage3_status === 'COMPLETED') ||
                  selectedExam.overall_status === 'READY_FOR_REVIEW' ||
                  selectedExam.overall_status === 'PUBLISHED' ||
                  (selectedExam.status || '').toUpperCase() === 'COMPLETED' ||
                  (selectedExam.status || '').toUpperCase() === 'PUBLISHED');

                if (isSelectedExtracting) {
                  return (
                    <button
                      disabled
                      style={{
                        flex: 1,
                        padding: '9px 16px',
                        borderRadius: 'var(--radius)',
                        fontSize: 12.5,
                        fontWeight: 600,
                        backgroundColor: 'var(--bg-hover)',
                        border: '1px solid #E2E8F0',
                        color: 'var(--text-disabled)',
                        cursor: 'not-allowed',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                      }}
                      title="Exam is currently undergoing extraction — review is locked"
                    >
                      <Loader2 size={13} className="animate-spin text-amber-600" />
                      In Extraction (Review Locked)
                    </button>
                  );
                }

                return isSelectedComplete ? (
                  <button
                    onClick={() => {
                      setIsDrawerOpen(false);
                      if (onNavigate) {
                        onNavigate('review', selectedExam);
                      }
                    }}
                    style={{
                      flex: 1,
                      padding: '9px 16px',
                      borderRadius: 'var(--radius)',
                      fontSize: 13,
                      fontWeight: 600,
                      backgroundColor: 'var(--primary-red)',
                      border: 'none',
                      color: 'var(--bg-card)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      boxShadow: '0 2px 6px rgba(var(--primary-red-rgb), 0.25)',
                    }}
                  >
                    <Check size={14} />
                    Open Question Review
                  </button>
                ) : (
                  <div
                    style={{
                      flex: 1,
                      padding: '9px 16px',
                      borderRadius: 'var(--radius)',
                      fontSize: 12.5,
                      fontWeight: 600,
                      backgroundColor: 'var(--bg-hover)',
                      border: '1px solid #E2E8F0',
                      color: 'var(--text-muted)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    <Loader2 size={13} className="animate-spin" />
                    Review Available After Pipeline Completion
                  </div>
                );
              })()}
            </div>

            <button
              onClick={() => setExamToDelete(selectedExam)}
              style={{
                width: '100%',
                padding: '9px 16px',
                borderRadius: 'var(--radius)',
                border: '1px solid #FECACA',
                backgroundColor: 'var(--bg-card)',
                color: '#DC2626',
                fontWeight: 600,
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                cursor: 'pointer',
              }}
            >
              <Trash2 size={14} />
              <span>Delete Exam Paper</span>
            </button>
            </div>
          </div>
        </>
      )}

      {/* Delete Exam Confirmation Modal */}
      {examToDelete && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 20,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 'min(480px, calc(100vw - 24px))',
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius)',
              boxShadow: '0 20px 25px -5px rgba(15, 23, 42, 0.25)',
              padding: 24,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 'var(--radius)',
                  backgroundColor: 'var(--primary-red-bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AlertCircle size={22} color="#DC2626" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--deep-navy)' }}>
                  Delete Exam Paper
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: 12.5, color: 'var(--text-muted)' }}>
                  This action is permanent and cannot be undone.
                </p>
              </div>
            </div>

            <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 20px 0' }}>
              Are you sure you want to delete <strong>{examToDelete.name}</strong>?
              <span style={{ display: 'block', color: '#DC2626', fontWeight: 600, marginTop: 8 }}>
                ⚠️ Warning: all extracted questions, options, solutions, review history, and any student
                attempts linked to this paper will be permanently deleted.
              </span>
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setExamToDelete(null)}
                disabled={deletingExam}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'var(--bg-hover)',
                  border: '1px solid #CBD5E1',
                  color: 'var(--text-secondary)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={deletingExam}
                onClick={handleConfirmDeleteExam}
                style={{
                  padding: '8px 18px',
                  backgroundColor: '#DC2626',
                  border: 'none',
                  color: 'var(--bg-card)',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: deletingExam ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {deletingExam ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Conflict Modal */}
      {conflictModal && conflictModal.isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius)',
              maxWidth: 480,
              width: '100%',
              padding: 28,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              border: '1px solid #E2E8F0',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div
                style={{
                  padding: 10,
                  borderRadius: 'var(--radius)',
                  backgroundColor: 'rgba(245, 158, 11, 0.15)',
                  color: '#F2B623',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--deep-navy)' }}>
                  {conflictModal.title}
                </h3>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  Conflict Resolution Action Required
                </div>
              </div>
            </div>

            <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 24 }}>
              {conflictModal.message}
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              {conflictModal.options.map((opt) => {
                const isCancel = opt.toUpperCase() === 'CANCEL' || opt.toUpperCase() === 'IGNORE' || opt.toUpperCase() === 'SKIP';
                const isRestart = opt.toUpperCase() === 'RESTART' || opt.toUpperCase() === 'OVERWRITE';

                return (
                  <button
                    key={opt}
                    onClick={() => handleConflictResolve(opt)}
                    style={{
                      padding: '9px 18px',
                      borderRadius: 'var(--radius)',
                      fontSize: 13.5,
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: isCancel ? '1px solid #CBD5E1' : 'none',
                      backgroundColor: isCancel ? 'var(--bg-card)' : isRestart ? '#DC2626' : 'var(--primary-red)',
                      color: isCancel ? 'var(--text-secondary)' : 'var(--bg-card)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {opt === 'RESTART'
                      ? 'Cancel Old Task & Restart'
                      : opt === 'OVERWRITE'
                        ? 'Overwrite Existing Paper'
                        : opt === 'SKIP'
                          ? 'Skip Upload'
                          : opt === 'CANCEL'
                            ? 'Cancel Upload'
                            : opt}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
