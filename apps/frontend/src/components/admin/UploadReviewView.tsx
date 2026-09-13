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
  Activity,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
  ChevronLeft,
  ChevronsRight,
  ChevronsLeft,
  Filter,
} from 'lucide-react';
import { useExamUpload } from '../../hooks/useExamUpload';
import { EXAM_OPTIONS, PAPER_TYPE_OPTIONS, YEAR_OPTIONS, GROUPED_YEAR_OPTIONS } from '../../constants/exam';
import {
  fetchExamPipelineStatuses,
  approveAndPublishExam,
  fetchStuckPipelines,
  resumeExamPipeline,
  dismissStuckPipeline,
  ExamPipelineStatusItem,
  StuckPipelineItem,
} from '../../services/adminService';
import { createAdaptivePoller, AdaptivePollerController } from '../../utils/adaptivePolling';
import { formatEnum, cleanExamTitle } from '../../utils/formatEnum';
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
        background: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: 0,
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
        <div style={{ fontSize: isMobile ? 12 : 13, fontWeight: 600, color: '#172033', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
          {title}
        </div>
        <div
          style={{
            width: isMobile ? 26 : 32,
            height: isMobile ? 26 : 32,
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
      <div style={{ marginTop: isMobile ? 6 : 10 }}>
        <div
          style={{
            fontSize: isMobile ? 22 : 28,
            fontWeight: 700,
            color: isHovered ? accentColor : '#172033',
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
        <div style={{ fontSize: isMobile ? 11 : 12, fontWeight: 500, color: '#64748B', marginTop: isMobile ? 2 : 4 }}>
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
      (exam.status || '').toUpperCase() === 'PUBLISHED');

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
        backgroundColor: rowHovered ? '#F8FAFC' : '#FFFFFF',
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
        <div style={{ fontWeight: 700, fontSize: 13.5, color: '#172033', lineHeight: 1.3 }}>
          {cleanExamTitle(exam.name)}
        </div>
        <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
          {exam.source_year ? `Year ${exam.source_year}` : ''}
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
                borderRadius: 0,
                fontSize: 11.5,
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                backgroundColor: s1Completed ? '#DCFCE7' : isExtracting ? '#FEF3C7' : s1Missing ? '#FEF2F2' : '#F1F5F9',
                color: s1Completed ? '#15803D' : isExtracting ? '#B45309' : s1Missing ? '#B42318' : '#64748B',
                border: `1px solid ${s1Completed ? '#86EFAC' : isExtracting ? '#FDE68A' : s1Missing ? '#FECDCA' : '#CBD5E1'}`,
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
            <span style={{ fontSize: 11, fontWeight: 700, color: s1Completed ? '#15803D' : isExtracting ? '#B45309' : '#64748B' }}>
              {Math.min(100, Math.round((ext / (total || 1)) * 100))}%
            </span>
          </div>

          {/* Micro Progress Bar */}
          <div style={{ width: '100%', height: 4, backgroundColor: '#E2E8F0', borderRadius: 0, overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${Math.min(100, Math.round((ext / (total || 1)) * 100))}%`,
                backgroundColor: s1Completed ? '#16A34A' : isExtracting ? '#F59E0B' : '#94A3B8',
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
              color: '#172033',
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: 0,
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
                color: '#94A3B8',
                background: '#F1F5F9',
                borderRadius: 0,
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
                color: '#FFFFFF',
                background: 'var(--primary-red)',
                border: 'none',
                borderRadius: 0,
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
                color: '#64748B',
                background: '#F1F5F9',
                borderRadius: 0,
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
      (exam.status || '').toUpperCase() === 'PUBLISHED');

  const percent = Math.min(100, Math.round((ext / (total || 1)) * 100));

  return (
    <div
      onClick={() => onSelect(exam)}
      style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: 0,
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
          <div style={{ fontWeight: 700, fontSize: 14, color: '#172033', lineHeight: 1.3, wordBreak: 'break-word' }}>
            {cleanExamTitle(exam.name)}
          </div>
          <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
            {exam.source_year ? `Year ${exam.source_year}` : 'Year unspecified'}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
          {renderStatusBadge(exam.status)}
          {renderOverallStatusBadge(exam)}
        </div>
      </div>

      {/* Middle Row: Extraction Progress */}
      <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 0, padding: '10px 12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 0,
              fontSize: 11,
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              backgroundColor: s1Completed ? '#DCFCE7' : isExtracting ? '#FEF3C7' : s1Missing ? '#FEF2F2' : '#F1F5F9',
              color: s1Completed ? '#15803D' : isExtracting ? '#B45309' : s1Missing ? '#B42318' : '#64748B',
              border: `1px solid ${s1Completed ? '#86EFAC' : isExtracting ? '#FDE68A' : s1Missing ? '#FECDCA' : '#CBD5E1'}`,
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
          <span style={{ fontSize: 11.5, fontWeight: 700, color: s1Completed ? '#15803D' : isExtracting ? '#B45309' : '#64748B' }}>
            {percent}%
          </span>
        </div>

        {/* Micro Progress Bar */}
        <div style={{ width: '100%', height: 5, backgroundColor: '#E2E8F0', borderRadius: 0, overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${percent}%`,
              backgroundColor: s1Completed ? '#16A34A' : isExtracting ? '#F59E0B' : '#94A3B8',
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
            color: '#172033',
            background: '#FFFFFF',
            border: '1px solid #CBD5E1',
            borderRadius: 0,
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
              color: '#94A3B8',
              background: '#F1F5F9',
              borderRadius: 0,
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
              color: '#FFFFFF',
              background: 'var(--primary-red)',
              border: '1px solid var(--primary-red)',
              borderRadius: 0,
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
              color: '#64748B',
              background: '#F1F5F9',
              borderRadius: 0,
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
export function UploadReviewView({ onNavigate, initialTab = 'UPLOAD_ONLY' }: UploadReviewViewProps = {}) {
  const { isMobile, isTabletOrBelow } = useBreakpoint();

  const {
    uploadMode,
    setUploadMode,
    availableExamTypes,
    examName,
    setExamName,
    year,
    setYear,
    setCode,
    setSetCode,
    paperType,
    setPaperType,
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

  // UI Mode ('UPLOAD_ONLY' | 'PIPELINE_ONLY') - Default to UPLOAD_ONLY for direct paper upload
  const [activeTab, setActiveTab] = useState<'UPLOAD_ONLY' | 'PIPELINE_ONLY'>(initialTab);

  // Sync activeTab when initialTab prop changes from external navigation
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Table Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(8);

  // Reset pagination to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, stageFilter]);

  // Slide-out Audit Drawer
  const [selectedExam, setSelectedExam] = useState<ExamPipelineStatusItem | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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
    await handleHookSubmit(e);
    setTimeout(() => {
      pollerRef.current?.resetCurve();
      loadRealTimeQueue(true);
      setActiveTab('PIPELINE_ONLY');
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

    return matchesSearch && matchesStatus && matchesStage;
  });

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

  const activeCount = pipelineExams.filter((e) => {
    const s = (e.overall_status || e.status || '').toUpperCase();
    const isStage1Running = (e.stage1_status === 'IN_PROGRESS' || Boolean(e.is_extracting)) && e.stage1_status !== 'COMPLETED';
    const isStage2Running = e.stage2_status === 'IN_PROGRESS';
    const isStage3Running = e.stage3_status === 'IN_PROGRESS';
    return s.includes('PROCESSING') || s.includes('PARSING') || isStage1Running || isStage2Running || isStage3Running;
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
            backgroundColor: '#DCFCE7',
            border: '1px solid #86EFAC',
            padding: '3px 9px',
            borderRadius: 0,
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
            borderRadius: 0,
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

    if (overall === 'PROCESSING' || exam.stage1_status === 'IN_PROGRESS' || exam.stage2_status === 'IN_PROGRESS' || exam.stage3_status === 'IN_PROGRESS' || statusUpper.includes('PROCESSING') || statusUpper.includes('PARSING')) {
      return (
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: '#0369A1',
            backgroundColor: '#E0F2FE',
            border: '1px solid #BAE6FD',
            padding: '3px 9px',
            borderRadius: 0,
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
          color: '#B45309',
          backgroundColor: '#FEF3C7',
          border: '1px solid #FDE68A',
          padding: '3px 9px',
          borderRadius: 0,
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
            backgroundColor: '#DCFCE7',
            border: '1px solid #86EFAC',
            padding: '3px 9px',
            borderRadius: 0,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: 0, backgroundColor: '#16A34A' }} />
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
            borderRadius: 0,
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
            borderRadius: 0,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: 0, backgroundColor: '#DC2626' }} />
          Failed
        </span>
      );
    }
    return (
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: '#B45309',
          backgroundColor: '#FEF3C7',
          border: '1px solid #FDE68A',
          padding: '3px 9px',
          borderRadius: 0,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: 0, backgroundColor: '#F2B623' }} />
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
            color: '#FFFFFF',
            padding: '12px 20px',
            borderRadius: 0,
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
              color: '#172033',
              margin: 0,
              letterSpacing: '-0.02em',
              lineHeight: 1.25,
            }}
          >
            {activeTab === 'UPLOAD_ONLY' ? 'Upload Question Paper' : 'Exam Paper Pipeline'}
          </h1>
          <p style={{ fontSize: isMobile ? 12.5 : 13.5, color: '#64748B', marginTop: 4, margin: '4px 0 0 0', lineHeight: 1.4 }}>
            {activeTab === 'UPLOAD_ONLY'
              ? 'Configure examination parameters and upload PDF paper to ingest into content pipeline.'
              : 'Upload, process, review and publish examination papers through the content pipeline.'}
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: isMobile ? '100%' : 'auto' }}>
          {activeTab === 'UPLOAD_ONLY' ? (
            <button
              onClick={() => setActiveTab('PIPELINE_ONLY')}
              style={{
                width: isMobile ? '100%' : 'auto',
                justifyContent: 'center',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '9px 16px',
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 0,
                backgroundColor: '#FFFFFF',
                color: '#334155',
                border: '1px solid #CBD5E1',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
              }}
            >
              <ArrowLeft size={15} />
              <span>Back to Pipeline & Artifacts</span>
            </button>
          ) : (
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
                  borderRadius: 0,
                  backgroundColor: '#FFFFFF',
                  color: '#172033',
                  border: '1px solid #E2E8F0',
                  cursor: loadingQueue ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
                }}
                title="Refresh Real-Time Pipeline Status"
              >
                <RefreshCw size={14} className={loadingQueue ? 'animate-spin' : ''} color="#64748B" />
                <span>Refresh</span>
              </button>

              <button
                onClick={() => setActiveTab('UPLOAD_ONLY')}
                style={{
                  flex: isMobile ? 1 : 'none',
                  justifyContent: 'center',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 16px',
                  fontSize: 13,
                  fontWeight: 600,
                  borderRadius: 0,
                  backgroundColor: '#172033',
                  color: '#FFFFFF',
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
          )}
        </div>
      </div>

      {/* 2. Compact 4 Metric Cards (Shown in Pipeline View) */}
      {activeTab === 'PIPELINE_ONLY' && (
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
          title="Active Pipeline Tasks"
          value={activeCount}
          supportingText="Processing in background"
          icon={<Activity size={17} color="var(--primary-red)" />}
          isProcessing={activeCount > 0}
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
            borderRadius: 0,
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
                    borderRadius: 0,
                    backgroundColor: '#FEE2E2',
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
                    color: '#FFFFFF',
                    fontSize: 12.5,
                    fontWeight: 600,
                    borderRadius: 0,
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
                    backgroundColor: '#FFFFFF',
                    color: '#475569',
                    fontSize: 12.5,
                    fontWeight: 600,
                    borderRadius: 0,
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


      {/* 4. Upload Examination Document Card (Visual Focal Point) */}
      {activeTab === 'UPLOAD_ONLY' && (
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: 0,
            padding: isMobile ? '18px 14px' : 26,
            marginBottom: 24,
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 4, height: 20, backgroundColor: 'var(--primary-red)', borderRadius: 0 }} />
              <h2 style={{ fontSize: isMobile ? 15.5 : 17, fontWeight: 700, color: '#172033', margin: 0, letterSpacing: '-0.01em' }}>
                Upload Question Paper PDF
              </h2>
            </div>
          </div>

          <form onSubmit={handleFormSubmit}>
            {/* Metadata Inputs Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 16,
                marginBottom: 20,
              }}
            >
              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                  Target Exam
                </label>
                <select
                  value={examName}
                  onChange={(e) => setExamName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 0,
                    border: '1px solid #CBD5E1',
                    fontSize: 13,
                    outline: 'none',
                    backgroundColor: '#FFFFFF',
                    color: '#172033',
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
                  <label style={{ fontSize: 12.5, fontWeight: 600, color: '#334155' }}>
                    Examination Year
                  </label>
                  <span style={{ fontSize: 11, color: '#64748B' }}>
                    1900 – {YEAR_OPTIONS[0]}
                  </span>
                </div>
                <select
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 0,
                    border: '1px solid #CBD5E1',
                    fontSize: 13,
                    outline: 'none',
                    backgroundColor: '#FFFFFF',
                    color: '#172033',
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
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
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
                    borderRadius: 0,
                    border: '1px solid #CBD5E1',
                    fontSize: 13,
                    outline: 'none',
                    backgroundColor: '#FFFFFF',
                    color: '#172033',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                  Paper Classification
                </label>
                <select
                  value={paperType}
                  onChange={(e) => setPaperType(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 0,
                    border: '1px solid #CBD5E1',
                    fontSize: 13,
                    outline: 'none',
                    backgroundColor: '#FFFFFF',
                    color: '#172033',
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

            {/* Drag & Drop Upload Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${isDragOver ? 'var(--primary-red)' : '#93C5FD'}`,
                backgroundColor: isDragOver ? '#E2E8F0' : '#F8FAFC',
                borderRadius: 0,
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
                  borderRadius: 0,
                  backgroundColor: '#FFFFFF',
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
              <div style={{ fontSize: isMobile ? 13 : 14, fontWeight: 700, color: '#172033' }}>
                {selectedFile ? selectedFile.name : isMobile ? 'Tap to choose Question Paper PDF' : 'Click to upload or drag & drop Question Paper PDF'}
              </div>
              <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 4 }}>
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
                  <span style={{ color: statusMessage.isError ? '#DC2626' : '#16A34A', fontWeight: 600 }}>
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
                  borderRadius: 0,
                  fontSize: 13.5,
                  fontWeight: 600,
                  backgroundColor: !selectedFile || isUploading ? '#94A3B8' : 'var(--primary-red)',
                  color: '#FFFFFF',
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
      )}

      {/* Pipeline Table View (Pipeline & Artifacts Repository) */}
      {activeTab === 'PIPELINE_ONLY' && (
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: 0,
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
              backgroundColor: '#FAFAFA',
            }}
          >
            <div style={{ position: 'relative', flex: isMobile ? '1 1 100%' : 1, minWidth: isMobile ? '100%' : 260 }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: 11, color: '#64748B' }} />
              <input
                type="text"
                placeholder="Search paper by code or title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 36px',
                  borderRadius: 0,
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  fontSize: 13,
                  color: '#172033',
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
                  borderRadius: 0,
                  border: '1px solid #CBD5E1',
                  fontSize: 13,
                  fontWeight: 500,
                  color: '#172033',
                  backgroundColor: '#FFFFFF',
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
                  borderRadius: 0,
                  border: '1px solid #CBD5E1',
                  fontSize: 13,
                  fontWeight: 500,
                  color: '#172033',
                  backgroundColor: '#FFFFFF',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              >
                <option value="ALL">All Stages</option>
                <option value="prelims">Prelims</option>
                <option value="mains">Mains</option>
              </select>
            </div>

            {(searchQuery || statusFilter !== 'ALL' || stageFilter !== 'ALL') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('ALL');
                  setStageFilter('ALL');
                }}
                style={{
                  width: isMobile ? '100%' : 'auto',
                  padding: '8px 12px',
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: '#64748B',
                  background: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  borderRadius: 0,
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
            <div style={{ padding: 48, textAlign: 'center', color: '#64748B', fontSize: 13.5 }}>
              <Loader2 size={24} className="animate-spin" color="var(--primary-red)" style={{ margin: '0 auto 10px' }} />
              Loading pipeline records from database...
            </div>
          ) : filteredQueueExams.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: '#64748B', fontSize: 13.5 }}>
              <FileSpreadsheet size={32} color="#94A3B8" style={{ margin: '0 auto 10px' }} />
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
                  <tr style={{ borderBottom: '1px solid #E2E8F0', backgroundColor: '#FAFAFA' }}>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: '#64748B', fontSize: 12, letterSpacing: '0.04em' }}>
                      EXAM PAPER
                    </th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: '#64748B', fontSize: 12, letterSpacing: '0.04em' }}>
                      STATUS
                    </th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: '#64748B', fontSize: 12, letterSpacing: '0.04em' }}>
                      EXTRACTION STATUS
                    </th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: '#64748B', fontSize: 12, letterSpacing: '0.04em' }}>
                      OVERALL STATUS
                    </th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: '#64748B', fontSize: 12, letterSpacing: '0.04em', textAlign: 'right' }}>
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
                backgroundColor: '#FAFAFA',
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
                  color: '#475569',
                }}
              >
                <span>
                  Showing{' '}
                  <strong style={{ color: '#0F172A', fontWeight: 600 }}>
                    {(safeCurrentPage - 1) * pageSize + 1}
                  </strong>{' '}
                  to{' '}
                  <strong style={{ color: '#0F172A', fontWeight: 600 }}>
                    {Math.min(safeCurrentPage * pageSize, filteredQueueExams.length)}
                  </strong>{' '}
                  of{' '}
                  <strong style={{ color: '#0F172A', fontWeight: 600 }}>
                    {filteredQueueExams.length}
                  </strong>{' '}
                  papers
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, color: '#64748B' }}>Per page:</span>
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
                      borderRadius: 0,
                      border: '1px solid #CBD5E1',
                      backgroundColor: '#FFFFFF',
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
                    borderRadius: 0,
                    border: '1px solid #CBD5E1',
                    backgroundColor: safeCurrentPage === 1 ? '#F1F5F9' : '#FFFFFF',
                    color: safeCurrentPage === 1 ? '#94A3B8' : '#334155',
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
                    borderRadius: 0,
                    border: '1px solid #CBD5E1',
                    backgroundColor: safeCurrentPage === 1 ? '#F1F5F9' : '#FFFFFF',
                    color: safeCurrentPage === 1 ? '#94A3B8' : '#334155',
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
                      <span key={`ellipsis-${idx}`} style={{ padding: '0 4px', color: '#94A3B8', fontSize: 13 }}>
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
                          borderRadius: 0,
                          fontSize: 13,
                          fontWeight: safeCurrentPage === item ? 700 : 500,
                          border: safeCurrentPage === item ? '1px solid #E31B23' : '1px solid #CBD5E1',
                          backgroundColor: safeCurrentPage === item ? '#E31B23' : '#FFFFFF',
                          color: safeCurrentPage === item ? '#FFFFFF' : '#334155',
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
                    borderRadius: 0,
                    border: '1px solid #CBD5E1',
                    backgroundColor: safeCurrentPage === totalPages ? '#F1F5F9' : '#FFFFFF',
                    color: safeCurrentPage === totalPages ? '#94A3B8' : '#334155',
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
                    borderRadius: 0,
                    border: '1px solid #CBD5E1',
                    backgroundColor: safeCurrentPage === totalPages ? '#F1F5F9' : '#FFFFFF',
                    color: safeCurrentPage === totalPages ? '#94A3B8' : '#334155',
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
              backgroundColor: '#FFFFFF',
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
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  PIPELINE AUDIT & INSPECTION
                </div>
                <h2 style={{ fontSize: isMobile ? 16 : 18, fontWeight: 700, color: '#172033', margin: '4px 0 0 0' }}>
                  {cleanExamTitle(selectedExam.name)}
                </h2>
                <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                  {selectedExam.source_year ? `Year ${selectedExam.source_year}` : ''}
                </div>
              </div>
              <button
                onClick={() => setIsDrawerOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748B',
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
                <span style={{ fontSize: 13, color: '#64748B', fontWeight: 500 }}>Overall Pipeline & Publication Status</span>
                <div>{renderOverallStatusBadge(selectedExam)}</div>
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid #E2E8F0', margin: 0 }} />

              {/* Prerequisites Check */}
              <div>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                  PIPELINE INPUT PREREQUISITES
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
                  <div
                    style={{
                      padding: 10,
                      background: selectedExam.has_question_paper !== false || selectedExam.extracted_questions_count > 0 ? '#F0FDF4' : '#FEF2F2',
                      border: `1px solid ${selectedExam.has_question_paper !== false || selectedExam.extracted_questions_count > 0 ? '#BBF7D0' : '#FECDCA'}`,
                      borderRadius: 0,
                    }}
                  >
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: selectedExam.has_question_paper !== false || selectedExam.extracted_questions_count > 0 ? '#15803D' : '#DC2626' }}>
                      {selectedExam.has_question_paper !== false || selectedExam.extracted_questions_count > 0 ? '✓ Question Paper PDF' : '✕ Missing Question Paper'}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                      {selectedExam.extracted_questions_count > 0 ? `${selectedExam.extracted_questions_count} Questions Extracted` : 'Not uploaded'}
                    </div>
                  </div>

                  <div
                    style={{
                      padding: 10,
                      background: selectedExam.has_answer_key !== false || (selectedExam.key_mapped_count || 0) > 0 || selectedExam.paper_set_code ? '#F0FDF4' : '#FEF2F2',
                      border: `1px solid ${selectedExam.has_answer_key !== false || (selectedExam.key_mapped_count || 0) > 0 || selectedExam.paper_set_code ? '#BBF7D0' : '#FECDCA'}`,
                      borderRadius: 0,
                    }}
                  >
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: selectedExam.has_answer_key !== false || (selectedExam.key_mapped_count || 0) > 0 || selectedExam.paper_set_code ? '#15803D' : '#DC2626' }}>
                      {selectedExam.has_answer_key !== false || (selectedExam.key_mapped_count || 0) > 0 || selectedExam.paper_set_code ? '✓ Answer Key Mapped' : '✕ Missing Answer Key'}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                      {selectedExam.has_answer_key !== false || (selectedExam.key_mapped_count || 0) > 0 || selectedExam.paper_set_code ? 'Official Key Verified' : 'Awaiting Answer Key'}
                    </div>
                  </div>
                </div>
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid #E2E8F0', margin: 0 }} />

              {/* Extraction Pipeline Details */}
              <div>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
                  EXTRACTION PIPELINE DETAILS
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 0, padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#172033' }}>One-Pass Content Extraction</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#15803D' }}>
                        {selectedExam.extracted_questions_count} / {selectedExam.total_questions || 100} Questions & Solutions
                      </span>
                    </div>
                    <div style={{ height: 6, background: '#E2E8F0', borderRadius: 0, overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.min(100, Math.round((selectedExam.extracted_questions_count / (selectedExam.total_questions || 100)) * 100))}%`,
                          background: '#16A34A',
                        }}
                      />
                    </div>
                    <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 6 }}>
                      Unified extraction captures questions, official SET answer keys, and detailed explanations in a single pipeline pass.
                    </div>
                  </div>
                </div>
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid #E2E8F0', margin: 0 }} />

              {/* Artifact Paths */}
              <div>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                  ARTIFACT PATHS & DEPLOYMENT
                </div>
                <div style={{ background: '#FAFAFA', padding: 12, borderRadius: 0, border: '1px solid #E2E8F0', fontFamily: 'monospace', fontSize: 11.5, color: '#334155', wordBreak: 'break-all' }}>
                  <div>Questions JSON: {selectedExam.questions_json_path || 'artifacts/json/questions.json'}</div>
                  <div style={{ marginTop: 6 }}>Solutions JSON: {selectedExam.solutions_json_path || 'artifacts/json/solutions.json'}</div>
                </div>
              </div>
            </div>

            {/* Drawer Actions */}
            <div style={{ padding: 20, borderTop: '1px solid #E2E8F0', backgroundColor: '#FAFAFA', display: 'flex', gap: 10 }}>
              <button
                onClick={() => setIsDrawerOpen(false)}
                style={{
                  flex: 1,
                  padding: '9px 16px',
                  borderRadius: 0,
                  fontSize: 13,
                  fontWeight: 600,
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  color: '#334155',
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
                        borderRadius: 0,
                        fontSize: 12.5,
                        fontWeight: 600,
                        backgroundColor: '#F1F5F9',
                        border: '1px solid #E2E8F0',
                        color: '#94A3B8',
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
                      borderRadius: 0,
                      fontSize: 13,
                      fontWeight: 600,
                      backgroundColor: 'var(--primary-red)',
                      border: 'none',
                      color: '#FFFFFF',
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
                      borderRadius: 0,
                      fontSize: 12.5,
                      fontWeight: 600,
                      backgroundColor: '#F1F5F9',
                      border: '1px solid #E2E8F0',
                      color: '#64748B',
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
          </div>
        </>
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
              backgroundColor: '#FFFFFF',
              borderRadius: 0,
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
                  borderRadius: 0,
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
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#172033' }}>
                  {conflictModal.title}
                </h3>
                <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                  Conflict Resolution Action Required
                </div>
              </div>
            </div>

            <p style={{ fontSize: 13.5, color: '#334155', lineHeight: 1.5, marginBottom: 24 }}>
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
                      borderRadius: 0,
                      fontSize: 13.5,
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: isCancel ? '1px solid #CBD5E1' : 'none',
                      backgroundColor: isCancel ? '#FFFFFF' : isRestart ? '#DC2626' : 'var(--primary-red)',
                      color: isCancel ? '#475569' : '#FFFFFF',
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
