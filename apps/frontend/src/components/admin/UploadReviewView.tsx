import React, { useState, useEffect, useRef } from 'react';
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
  Sparkles,
  ClipboardCheck,
  Activity,
  ArrowRight,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { useExamUpload } from '../../hooks/useExamUpload';
import { EXAM_OPTIONS, PAPER_TYPE_OPTIONS, YEAR_OPTIONS } from '../../constants/exam';
import {
  fetchExamPipelineStatuses,
  approveAndPublishExam,
  fetchStuckPipelines,
  resumeExamPipeline,
  dismissStuckPipeline,
  ExamPipelineStatusItem,
  StuckPipelineItem,
} from '../../services/adminService';

interface UploadReviewViewProps {
  onNavigate?: (view: string, extraData?: any) => void;
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
}

function MetricCard({ title, value, supportingText, icon, isProcessing = false }: MetricCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const accentColor = '#2563EB';

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        background: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: 14,
        position: 'relative',
        overflow: 'hidden',
        padding: '18px 20px',
        boxShadow: isHovered
          ? '0 8px 20px -4px rgba(15, 23, 42, 0.08), 0 4px 6px -2px rgba(15, 23, 42, 0.03)'
          : '0 1px 3px rgba(15, 23, 42, 0.04), 0 1px 2px rgba(15, 23, 42, 0.02)',
        transform: isHovered ? 'translateY(-3px)' : 'translateY(0)',
        transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: 120,
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', letterSpacing: '-0.01em' }}>
          {title}
        </div>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            backgroundColor: '#EFF6FF',
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
      <div style={{ marginTop: 10 }}>
        <div
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: isHovered ? accentColor : '#0F172A',
            lineHeight: 1.05,
            letterSpacing: '-0.025em',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'color 200ms ease-out',
          }}
        >
          <span>{value}</span>
          {isProcessing && <Loader2 size={18} className="animate-spin" color="#2563EB" />}
        </div>
        <div style={{ fontSize: 12, fontWeight: 500, color: '#64748B', marginTop: 4 }}>
          {supportingText}
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// 2. Horizontal 5-Stage Pipeline Visualizer Preview Banner
// ----------------------------------------------------------------------
function FiveStagePipelinePreview() {
  const stages = [
    { num: '01', title: 'Extraction', desc: 'AI PDF to JSON parsing', icon: FileText, color: '#2563EB', bg: '#EFF6FF' },
    { num: '02', title: 'Answer Mapping', desc: 'Linking official SET key', icon: Key, color: '#2563EB', bg: '#EFF6FF' },
    { num: '03', title: 'Explanations', desc: 'Detailed solution AI engine', icon: Sparkles, color: '#2563EB', bg: '#EFF6FF' },
    { num: '04', title: 'Human Review', desc: 'QA verification & audit', icon: ClipboardCheck, color: '#D97706', bg: '#FEF3C7' },
    { num: '05', title: 'Publish', desc: 'Live S3 catalog deployment', icon: Database, color: '#16A34A', bg: '#ECFDF5' },
  ];

  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: 14,
        padding: '20px 24px',
        marginBottom: 24,
        boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <div style={{ width: 4, height: 18, backgroundColor: '#2563EB', borderRadius: 2 }} />
        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', margin: 0, letterSpacing: '-0.01em' }}>
          Examination Content Processing Flow
        </h3>
        <span style={{ fontSize: 12, color: '#64748B', fontWeight: 500, marginLeft: 4 }}>
          (5-Stage Pipeline Standard)
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
          alignItems: 'center',
        }}
      >
        {stages.map((stg, idx) => {
          const StageIcon = stg.icon;
          return (
            <React.Fragment key={stg.num}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: '12px 14px',
                  borderRadius: 10,
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    backgroundColor: stg.bg,
                    color: stg.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <StageIcon size={16} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#94A3B8', letterSpacing: '0.05em' }}>
                      {stg.num}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
                      {stg.title}
                    </span>
                  </div>
                  <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 2, lineHeight: 1.3 }}>
                    {stg.desc}
                  </div>
                </div>
              </div>

              {idx < stages.length - 1 && (
                <div style={{ display: 'none' /* Responsive grid fallback */ }} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// 3. Table Row with Stage Checkpoint Hover & Dimming Behavior
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
  const s1InProgress = exam.stage1_status === 'IN_PROGRESS' || (ext > 0 && ext < total);
  const s1Missing = exam.stage1_status === 'MISSING_INPUT' || (!exam.has_question_paper && ext === 0);

  // Stage 2 status
  const targetQ = ext > 0 ? ext : total;
  const s2Completed = exam.stage2_status === 'COMPLETED' || isPublished || (keyCount >= targetQ && targetQ > 0);
  const s2InProgress = exam.stage2_status === 'IN_PROGRESS';
  const s2Missing = exam.stage2_status === 'MISSING_INPUT' || (!exam.has_answer_key && keyCount === 0 && !exam.paper_set_code);

  // Stage 3 status
  const s3Completed = exam.stage3_status === 'COMPLETED' || isPublished || (expCount >= targetQ && targetQ > 0);
  const s3InProgress = exam.stage3_status === 'IN_PROGRESS';

  return (
    <tr
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
      {/* EXAM PAPER (Two-line title hierarchy) */}
      <td
        style={{
          padding: '14px 16px',
          maxWidth: 280,
          borderLeft: rowHovered ? '3px solid #2563EB' : '3px solid transparent',
          transition: 'border-left 150ms ease-out',
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 13.5, color: '#0F172A', lineHeight: 1.3 }}>
          {exam.name}
        </div>
        <div style={{ fontSize: 12, color: '#64748B', fontFamily: 'monospace', marginTop: 2 }}>
          {exam.code} • {exam.source_year} • Set {exam.paper_set_code || 'A'}
        </div>
      </td>

      {/* STATUS */}
      <td style={{ padding: '14px 16px', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
        {renderStatusBadge(exam.status)}
      </td>

      {/* 3-STAGE PROGRESS CHECKPOINTS */}
      <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
          {/* Stage 1 Checkpoint */}
          <div
            onMouseEnter={(e) => {
              e.stopPropagation();
              setHoveredStageIndex(1);
            }}
            onMouseLeave={(e) => {
              e.stopPropagation();
              setHoveredStageIndex(null);
            }}
            style={{
              padding: '3px 8px',
              borderRadius: 6,
              fontSize: 11.5,
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              backgroundColor: s1Completed ? '#DCFCE7' : s1InProgress ? '#FEF3C7' : s1Missing ? '#FEF2F2' : '#F1F5F9',
              color: s1Completed ? '#15803D' : s1InProgress ? '#B45309' : s1Missing ? '#B42318' : '#64748B',
              border: `1px solid ${s1Completed ? '#86EFAC' : s1InProgress ? '#FDE68A' : s1Missing ? '#FECDCA' : '#CBD5E1'}`,
              opacity: hoveredStageIndex !== null && hoveredStageIndex !== 1 ? 0.45 : 1,
              transform: hoveredStageIndex === 1 ? 'scale(1.05)' : 'scale(1)',
              transition: 'all 150ms ease-out',
              position: 'relative',
            }}
          >
            {s1Completed ? <CheckCircle2 size={12} /> : s1InProgress ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
            <span>01 Extraction ({ext}/{total})</span>

            {/* Stage Hover Tooltip Popover */}
            {hoveredStageIndex === 1 && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: 0,
                  marginBottom: 6,
                  backgroundColor: '#0F172A',
                  color: '#FFFFFF',
                  padding: '6px 10px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  boxShadow: '0 4px 12px rgba(15, 23, 42, 0.25)',
                  zIndex: 100,
                }}
              >
                <div><strong>Stage 1: Question Extraction</strong></div>
                <div>Completion: {Math.round((ext / (total || 1)) * 100)}% ({ext}/{total} Qs)</div>
                <div>State: {s1Completed ? 'COMPLETED' : s1InProgress ? 'PARSING' : 'PENDING'}</div>
              </div>
            )}
          </div>

          <span style={{ color: '#CBD5E1', fontSize: 11, fontWeight: 700 }}>→</span>

          {/* Stage 2 Checkpoint */}
          <div
            onMouseEnter={(e) => {
              e.stopPropagation();
              setHoveredStageIndex(2);
            }}
            onMouseLeave={(e) => {
              e.stopPropagation();
              setHoveredStageIndex(null);
            }}
            style={{
              padding: '3px 8px',
              borderRadius: 6,
              fontSize: 11.5,
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              backgroundColor: s2Completed ? '#DCFCE7' : s2InProgress ? '#FEF3C7' : s2Missing ? '#FEF2F2' : '#F1F5F9',
              color: s2Completed ? '#15803D' : s2InProgress ? '#B45309' : s2Missing ? '#B42318' : '#64748B',
              border: `1px solid ${s2Completed ? '#86EFAC' : s2InProgress ? '#FDE68A' : s2Missing ? '#FECDCA' : '#CBD5E1'}`,
              opacity: hoveredStageIndex !== null && hoveredStageIndex !== 2 ? 0.45 : 1,
              transform: hoveredStageIndex === 2 ? 'scale(1.05)' : 'scale(1)',
              transition: 'all 150ms ease-out',
              position: 'relative',
            }}
          >
            {s2Completed ? <CheckCircle2 size={12} /> : s2InProgress ? <Loader2 size={12} className="animate-spin" /> : <Key size={12} />}
            <span>02 Key ({keyCount}/{targetQ})</span>

            {/* Stage Hover Tooltip Popover */}
            {hoveredStageIndex === 2 && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: 0,
                  marginBottom: 6,
                  backgroundColor: '#0F172A',
                  color: '#FFFFFF',
                  padding: '6px 10px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  boxShadow: '0 4px 12px rgba(15, 23, 42, 0.25)',
                  zIndex: 100,
                }}
              >
                <div><strong>Stage 2: Answer Key Mapping</strong></div>
                <div>Mapped: {keyCount}/{targetQ} Keys (Set {exam.paper_set_code || 'A'})</div>
                <div>State: {s2Completed ? 'MAPPED' : s2InProgress ? 'MAPPING' : 'MISSING KEY'}</div>
              </div>
            )}
          </div>

          <span style={{ color: '#CBD5E1', fontSize: 11, fontWeight: 700 }}>→</span>

          {/* Stage 3 Checkpoint */}
          <div
            onMouseEnter={(e) => {
              e.stopPropagation();
              setHoveredStageIndex(3);
            }}
            onMouseLeave={(e) => {
              e.stopPropagation();
              setHoveredStageIndex(null);
            }}
            style={{
              padding: '3px 8px',
              borderRadius: 6,
              fontSize: 11.5,
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              backgroundColor: s3Completed ? '#DCFCE7' : s3InProgress ? '#FEF3C7' : '#F1F5F9',
              color: s3Completed ? '#15803D' : s3InProgress ? '#B45309' : '#64748B',
              border: `1px solid ${s3Completed ? '#86EFAC' : s3InProgress ? '#FDE68A' : '#CBD5E1'}`,
              opacity: hoveredStageIndex !== null && hoveredStageIndex !== 3 ? 0.45 : 1,
              transform: hoveredStageIndex === 3 ? 'scale(1.05)' : 'scale(1)',
              transition: 'all 150ms ease-out',
              position: 'relative',
            }}
          >
            {s3Completed ? <CheckCircle2 size={12} /> : s3InProgress ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            <span>03 Explanations ({expCount}/{targetQ})</span>

            {/* Stage Hover Tooltip Popover */}
            {hoveredStageIndex === 3 && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: 0,
                  marginBottom: 6,
                  backgroundColor: '#0F172A',
                  color: '#FFFFFF',
                  padding: '6px 10px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  boxShadow: '0 4px 12px rgba(15, 23, 42, 0.25)',
                  zIndex: 100,
                }}
              >
                <div><strong>Stage 3: Explanations Generator</strong></div>
                <div>Generated: {expCount}/{targetQ} Detailed Solutions</div>
                <div>State: {s3Completed ? 'COMPLETED' : s3InProgress ? 'GENERATING' : 'QUEUED'}</div>
              </div>
            )}
          </div>
        </div>
      </td>

      {/* OVERALL STATUS */}
      <td style={{ padding: '14px 16px', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
        {renderOverallStatusBadge(exam)}
      </td>

      {/* ACTIONS */}
      <td style={{ padding: '14px 16px', textAlign: 'right', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
        <div style={{ display: 'inline-flex', gap: 8 }} onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => onSelect(exam)}
            style={{
              padding: '5px 12px',
              fontSize: 12.5,
              fontWeight: 600,
              color: '#0F172A',
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: 6,
              cursor: 'pointer',
              boxShadow: rowHovered ? '0 1px 2px rgba(15, 23, 42, 0.05)' : 'none',
              transition: 'all 150ms ease-out',
            }}
          >
            Details
          </button>

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
              background: '#2563EB',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              boxShadow: '0 1px 2px rgba(37, 99, 235, 0.2)',
              transition: 'all 150ms ease-out',
            }}
          >
            <Check size={13} />
            Review Exam
          </button>
        </div>
      </td>
    </tr>
  );
}

// ----------------------------------------------------------------------
// Main UploadReviewView Component
// ----------------------------------------------------------------------
export function UploadReviewView({ onNavigate }: UploadReviewViewProps = {}) {
  const {
    uploadMode,
    setUploadMode,
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
  const [resumingExamId, setResumingExamId] = useState<string | null>(null);
  const [loadingQueue, setLoadingQueue] = useState<boolean>(true);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [stageFilter, setStageFilter] = useState<string>('ALL');

  // UI Tabs ('UNIFIED' | 'UPLOAD_ONLY' | 'PIPELINE_ONLY')
  const [activeTab, setActiveTab] = useState<'UNIFIED' | 'UPLOAD_ONLY' | 'PIPELINE_ONLY'>('UNIFIED');

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

  const handleResumePipeline = async (examId: string, examName: string) => {
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

  const handleDismissStuck = async (examId: string) => {
    try {
      await dismissStuckPipeline(examId);
      setStuckPipelines((prev) => prev.filter((p) => p.exam_id !== examId));
    } catch (err: any) {
      console.error('Failed to dismiss stuck pipeline prompt:', err);
    }
  };

  useEffect(() => {
    loadRealTimeQueue(false);
    loadStuckPipelines();
  }, []);

  // Polling for active background jobs
  useEffect(() => {
    const hasActiveTasks = pipelineExams.some((e) => {
      const s = (e.overall_status || e.status || '').toUpperCase();
      const isStage1Running = e.stage1_status === 'IN_PROGRESS' || (e.extracted_questions_count > 0 && e.extracted_questions_count < e.total_questions && !s.includes('PUBLISHED'));
      const isStage2Running = e.stage2_status === 'IN_PROGRESS';
      const isStage3Running = e.stage3_status === 'IN_PROGRESS' || ((e.explanations_count || 0) < e.extracted_questions_count && e.extracted_questions_count > 0 && !s.includes('PUBLISHED'));
      return s.includes('PROCESSING') || s.includes('PARSING') || isStage1Running || isStage2Running || isStage3Running;
    });

    if (!hasActiveTasks && !isUploading) return;

    const intervalId = setInterval(() => {
      loadRealTimeQueue(true);
    }, 4000);

    return () => clearInterval(intervalId);
  }, [pipelineExams, isUploading]);

  const handleFormSubmit = async (e: React.FormEvent) => {
    await handleHookSubmit(e);
    setTimeout(() => {
      loadRealTimeQueue(true);
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

  // KPI Counts
  const totalExamsCount = pipelineExams.length;
  const publishedCount = pipelineExams.filter((e) => {
    const s = (e.status || '').toUpperCase();
    return s.includes('PUBLISHED') || Boolean(e.questions_json_path && e.solutions_json_path);
  }).length;

  const activeCount = pipelineExams.filter((e) => {
    const s = (e.overall_status || e.status || '').toUpperCase();
    const isStage1Running = e.stage1_status === 'IN_PROGRESS' || (e.extracted_questions_count > 0 && e.extracted_questions_count < e.total_questions && !s.includes('PUBLISHED'));
    const isStage2Running = e.stage2_status === 'IN_PROGRESS';
    const isStage3Running = e.stage3_status === 'IN_PROGRESS' || ((e.explanations_count || 0) < e.extracted_questions_count && e.extracted_questions_count > 0 && !s.includes('PUBLISHED'));
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
            borderRadius: 12,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          <Database size={12} />
          S3 Live & Ready
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
            borderRadius: 12,
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
            borderRadius: 12,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          <Loader2 size={12} className="animate-spin" color="#0284C7" />
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
          borderRadius: 12,
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
            borderRadius: 12,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#16A34A' }} />
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
            borderRadius: 12,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          <Loader2 size={12} className="animate-spin" color="#0284C7" />
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
            borderRadius: 12,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#DC2626' }} />
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
          borderRadius: 12,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#D97706' }} />
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
            borderRadius: 8,
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
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 26,
              fontWeight: 700,
              color: '#0F172A',
              margin: 0,
              letterSpacing: '-0.02em',
            }}
          >
            Exam Paper Pipeline
          </h1>
          <p style={{ fontSize: 13.5, color: '#64748B', marginTop: 4, margin: '4px 0 0 0' }}>
            Upload, process, review and publish examination papers through the content pipeline.
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            onClick={() => loadRealTimeQueue(false)}
            disabled={loadingQueue}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              fontSize: 13,
              fontWeight: 500,
              borderRadius: 6,
              backgroundColor: '#FFFFFF',
              color: '#0F172A',
              border: '1px solid #E2E8F0',
              cursor: loadingQueue ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
            }}
            title="Refresh Real-Time Pipeline Status"
          >
            <RefreshCw size={14} className={loadingQueue ? 'animate-spin' : ''} color="#64748B" />
            <span>Refresh Pipeline</span>
          </button>

          <button
            onClick={() => setActiveTab('UPLOAD_ONLY')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              fontSize: 13.5,
              fontWeight: 600,
              borderRadius: 6,
              backgroundColor: '#0F172A',
              color: '#FFFFFF',
              border: '1px solid #0F172A',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(15, 23, 42, 0.08)',
              transition: 'background 0.15s ease',
            }}
          >
            <Upload size={15} />
            <span>Upload Exam Paper</span>
          </button>
        </div>
      </div>

      {/* 2. Compact 4 Metric Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <MetricCard
          title="Total Exam Papers"
          value={totalExamsCount}
          supportingText="Extracted & cataloged"
          icon={<FileSpreadsheet size={17} color="#2563EB" />}
        />
        <MetricCard
          title="Active Pipeline Tasks"
          value={activeCount}
          supportingText="Processing in background"
          icon={<Activity size={17} color="#2563EB" />}
          isProcessing={activeCount > 0}
        />
        <MetricCard
          title="Pending Review"
          value={pendingCount}
          supportingText="Awaiting verification"
          icon={<Clock size={17} color="#2563EB" />}
        />
        <MetricCard
          title="Published"
          value={publishedCount}
          supportingText="S3 JSON live & active"
          icon={<CheckCircle2 size={17} color="#2563EB" />}
        />
      </div>

      {/* Interrupted Task Alert */}
      {stuckPipelines.length > 0 && (
        <div
          style={{
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECDCA',
            borderRadius: 12,
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
                    borderRadius: '50%',
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
                    Task was interrupted during <strong>{stuck.pipeline_type}</strong> ({stuck.current_step || 'Server reload'}).
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
                    borderRadius: 6,
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
                    borderRadius: 6,
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

      {/* 3. Workspace Tab Navigation */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid #E2E8F0', paddingBottom: 12 }}>
        <button
          onClick={() => setActiveTab('UNIFIED')}
          style={{
            padding: '8px 18px',
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 8,
            border: activeTab === 'UNIFIED' ? 'none' : '1px solid #E2E8F0',
            backgroundColor: activeTab === 'UNIFIED' ? '#2563EB' : '#FFFFFF',
            color: activeTab === 'UNIFIED' ? '#FFFFFF' : '#475569',
            cursor: 'pointer',
            boxShadow: activeTab === 'UNIFIED' ? '0 2px 6px rgba(37, 99, 235, 0.25)' : 'none',
            transition: 'all 150ms ease-out',
          }}
        >
          Overview & Upload
        </button>
        <button
          onClick={() => setActiveTab('UPLOAD_ONLY')}
          style={{
            padding: '8px 18px',
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 8,
            border: activeTab === 'UPLOAD_ONLY' ? 'none' : '1px solid #E2E8F0',
            backgroundColor: activeTab === 'UPLOAD_ONLY' ? '#2563EB' : '#FFFFFF',
            color: activeTab === 'UPLOAD_ONLY' ? '#FFFFFF' : '#475569',
            cursor: 'pointer',
            boxShadow: activeTab === 'UPLOAD_ONLY' ? '0 2px 6px rgba(37, 99, 235, 0.25)' : 'none',
            transition: 'all 150ms ease-out',
          }}
        >
          Upload Only
        </button>
        <button
          onClick={() => setActiveTab('PIPELINE_ONLY')}
          style={{
            padding: '8px 18px',
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 8,
            border: activeTab === 'PIPELINE_ONLY' ? 'none' : '1px solid #E2E8F0',
            backgroundColor: activeTab === 'PIPELINE_ONLY' ? '#2563EB' : '#FFFFFF',
            color: activeTab === 'PIPELINE_ONLY' ? '#FFFFFF' : '#475569',
            cursor: 'pointer',
            boxShadow: activeTab === 'PIPELINE_ONLY' ? '0 2px 6px rgba(37, 99, 235, 0.25)' : 'none',
            transition: 'all 150ms ease-out',
          }}
        >
          Pipeline & Artifacts
        </button>
      </div>

      {/* 4. Upload Examination Document Card (Visual Focal Point) */}
      {(activeTab === 'UNIFIED' || activeTab === 'UPLOAD_ONLY') && (
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: 14,
            padding: 26,
            marginBottom: 24,
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 4, height: 20, backgroundColor: '#2563EB', borderRadius: 2 }} />
              <h2 style={{ fontSize: 17, fontWeight: 700, color: '#0F172A', margin: 0, letterSpacing: '-0.01em' }}>
                Upload Examination Document
              </h2>
            </div>

            {/* Selector: Question Paper vs Answer Key */}
            <div
              style={{
                display: 'inline-flex',
                gap: 4,
                background: '#F1F5F9',
                padding: 4,
                borderRadius: 8,
                border: '1px solid #E2E8F0',
              }}
            >
              <button
                type="button"
                onClick={() => setUploadMode('QUESTION_PAPER')}
                style={{
                  padding: '6px 14px',
                  fontSize: 12.5,
                  fontWeight: 600,
                  borderRadius: 6,
                  border: 'none',
                  backgroundColor: uploadMode === 'QUESTION_PAPER' ? '#FFFFFF' : 'transparent',
                  color: uploadMode === 'QUESTION_PAPER' ? '#0F172A' : '#64748B',
                  boxShadow: uploadMode === 'QUESTION_PAPER' ? '0 1px 3px rgba(15, 23, 42, 0.08)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 150ms ease-out',
                }}
              >
                Question Paper (PDF/JSON)
              </button>
              <button
                type="button"
                onClick={() => setUploadMode('ANSWER_KEY')}
                style={{
                  padding: '6px 14px',
                  fontSize: 12.5,
                  fontWeight: 600,
                  borderRadius: 6,
                  border: 'none',
                  backgroundColor: uploadMode === 'ANSWER_KEY' ? '#FFFFFF' : 'transparent',
                  color: uploadMode === 'ANSWER_KEY' ? '#0F172A' : '#64748B',
                  boxShadow: uploadMode === 'ANSWER_KEY' ? '0 1px 3px rgba(15, 23, 42, 0.08)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 150ms ease-out',
                }}
              >
                Official Answer Key (PDF/JSON)
              </button>
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
                    borderRadius: 6,
                    border: '1px solid #CBD5E1',
                    fontSize: 13,
                    outline: 'none',
                    backgroundColor: '#FFFFFF',
                    color: '#0F172A',
                  }}
                >
                  {EXAM_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                  Examination Year
                </label>
                <select
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 6,
                    border: '1px solid #CBD5E1',
                    fontSize: 13,
                    outline: 'none',
                    backgroundColor: '#FFFFFF',
                    color: '#0F172A',
                  }}
                >
                  {YEAR_OPTIONS.map((yr) => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
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
                    borderRadius: 6,
                    border: '1px solid #CBD5E1',
                    fontSize: 13,
                    outline: 'none',
                    backgroundColor: '#FFFFFF',
                    color: '#0F172A',
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
                    borderRadius: 6,
                    border: '1px solid #CBD5E1',
                    fontSize: 13,
                    outline: 'none',
                    backgroundColor: '#FFFFFF',
                    color: '#0F172A',
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
                border: `2px dashed ${isDragOver ? '#2563EB' : '#93C5FD'}`,
                backgroundColor: isDragOver ? '#DBEAFE' : '#EFF6FF',
                borderRadius: 12,
                padding: '32px 24px',
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
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  backgroundColor: '#FFFFFF',
                  color: '#2563EB',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                  boxShadow: '0 2px 8px rgba(37, 99, 235, 0.15)',
                  transform: isDragOver ? 'scale(1.1)' : 'scale(1)',
                  transition: 'transform 200ms ease-out',
                }}
              >
                <Cloud size={26} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>
                {selectedFile ? selectedFile.name : 'Click to upload or drag & drop examination document'}
              </div>
              <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
                Supports standard PDF question papers, answer keys, and S3 JSON packages (Max 50MB)
              </div>
            </div>

            {/* Footer Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 22px',
                  borderRadius: 6,
                  fontSize: 13.5,
                  fontWeight: 600,
                  backgroundColor: !selectedFile || isUploading ? '#94A3B8' : '#2563EB',
                  color: '#FFFFFF',
                  border: 'none',
                  cursor: !selectedFile || isUploading ? 'not-allowed' : 'pointer',
                  boxShadow: !selectedFile || isUploading ? 'none' : '0 2px 6px rgba(37, 99, 235, 0.3)',
                  transition: 'all 150ms ease-out',
                }}
              >
                {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                {isUploading ? 'Uploading & Starting Pipeline...' : 'Upload & Start 3-Stage Pipeline'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 5. 5-Stage Pipeline Flow Preview Banner */}
      {(activeTab === 'UNIFIED' || activeTab === 'UPLOAD_ONLY') && <FiveStagePipelinePreview />}

      {/* 6. Pipeline Table View */}
      {(activeTab === 'UNIFIED' || activeTab === 'PIPELINE_ONLY') && (
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: 14,
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
            overflow: 'hidden',
          }}
        >
          {/* Header & Filter Controls Bar */}
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid #E2E8F0',
              display: 'flex',
              gap: 12,
              alignItems: 'center',
              flexWrap: 'wrap',
              backgroundColor: '#FAFAFA',
            }}
          >
            <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: 11, color: '#64748B' }} />
              <input
                type="text"
                placeholder="Search paper by code or title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 36px',
                  borderRadius: 6,
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  fontSize: 13,
                  color: '#0F172A',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid #CBD5E1',
                fontSize: 13,
                fontWeight: 500,
                color: '#0F172A',
                backgroundColor: '#FFFFFF',
                outline: 'none',
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
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid #CBD5E1',
                fontSize: 13,
                fontWeight: 500,
                color: '#0F172A',
                backgroundColor: '#FFFFFF',
                outline: 'none',
              }}
            >
              <option value="ALL">All Stages</option>
              <option value="prelims">Prelims</option>
              <option value="mains">Mains</option>
            </select>

            {(searchQuery || statusFilter !== 'ALL' || stageFilter !== 'ALL') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('ALL');
                  setStageFilter('ALL');
                }}
                style={{
                  padding: '8px 12px',
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: '#64748B',
                  background: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                Clear Filters
              </button>
            )}
          </div>

          {/* Table Content */}
          {loadingQueue ? (
            <div style={{ padding: 48, textAlign: 'center', color: '#64748B', fontSize: 13.5 }}>
              <Loader2 size={24} className="animate-spin" color="#2563EB" style={{ margin: '0 auto 10px' }} />
              Loading pipeline records from database...
            </div>
          ) : filteredQueueExams.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: '#64748B', fontSize: 13.5 }}>
              <FileSpreadsheet size={32} color="#94A3B8" style={{ margin: '0 auto 10px' }} />
              <div>No examination papers found matching filter criteria.</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13.5 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #E2E8F0', backgroundColor: '#FAFAFA' }}>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: '#64748B', fontSize: 12, letterSpacing: '0.04em' }}>
                      EXAM PAPER
                    </th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: '#64748B', fontSize: 12, letterSpacing: '0.04em' }}>
                      STATUS
                    </th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: '#64748B', fontSize: 12, letterSpacing: '0.04em' }}>
                      3-STAGE PROGRESS
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
                  {filteredQueueExams.map((exam, i) => (
                    <TableRowItem
                      key={exam.id}
                      exam={exam}
                      isLast={i === filteredQueueExams.length - 1}
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
              width: 480,
              maxWidth: '90vw',
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
                padding: '20px 24px',
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
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', margin: '4px 0 0 0' }}>
                  {selectedExam.name}
                </h2>
                <div style={{ fontSize: 12, fontFamily: 'monospace', color: '#64748B', marginTop: 2 }}>
                  {selectedExam.code} • Year {selectedExam.source_year} • Set {selectedExam.paper_set_code || 'A'}
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
            <div style={{ flex: 1, padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Overall Status */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: '#64748B', fontWeight: 500 }}>Overall Pipeline & S3 Status</span>
                <div>{renderOverallStatusBadge(selectedExam)}</div>
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid #E2E8F0', margin: 0 }} />

              {/* Prerequisites Check */}
              <div>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                  PIPELINE INPUT PREREQUISITES
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div
                    style={{
                      padding: 10,
                      background: selectedExam.has_question_paper !== false || selectedExam.extracted_questions_count > 0 ? '#F0FDF4' : '#FEF2F2',
                      border: `1px solid ${selectedExam.has_question_paper !== false || selectedExam.extracted_questions_count > 0 ? '#BBF7D0' : '#FECDCA'}`,
                      borderRadius: 8,
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
                      borderRadius: 8,
                    }}
                  >
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: selectedExam.has_answer_key !== false || (selectedExam.key_mapped_count || 0) > 0 || selectedExam.paper_set_code ? '#15803D' : '#DC2626' }}>
                      {selectedExam.has_answer_key !== false || (selectedExam.key_mapped_count || 0) > 0 || selectedExam.paper_set_code ? '✓ Answer Key Mapped' : '✕ Missing Answer Key'}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                      Set Code: {selectedExam.paper_set_code || 'SET_A'}
                    </div>
                  </div>
                </div>
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid #E2E8F0', margin: 0 }} />

              {/* 3 Pipeline Stages Breakdown */}
              <div>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
                  3-STAGE PIPELINE PROGRESS DETAILS
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>Stage 1: Question Extraction</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#15803D' }}>
                        {selectedExam.extracted_questions_count} / {selectedExam.total_questions || 100} Qs
                      </span>
                    </div>
                    <div style={{ height: 6, background: '#E2E8F0', borderRadius: 3, overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.min(100, Math.round((selectedExam.extracted_questions_count / (selectedExam.total_questions || 100)) * 100))}%`,
                          background: '#16A34A',
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>Stage 2: Answer Key Mapping</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#15803D' }}>
                        Set Code: {selectedExam.paper_set_code || 'SET_A'} ({selectedExam.key_mapped_count ?? 0}/{selectedExam.extracted_questions_count || selectedExam.total_questions || 100} mapped)
                      </span>
                    </div>
                  </div>

                  <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>Stage 3: Explanations & Knowledge Base</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: selectedExam.solutions_json_path || (selectedExam.explanations_count || 0) >= (selectedExam.extracted_questions_count || 1) ? '#15803D' : '#0284C7' }}>
                        {selectedExam.solutions_json_path || (selectedExam.explanations_count || 0) >= (selectedExam.extracted_questions_count || 1) ? `Ready & Verified (${selectedExam.explanations_count || selectedExam.extracted_questions_count}/${selectedExam.extracted_questions_count})` : `${selectedExam.explanations_count || 0}/${selectedExam.extracted_questions_count || selectedExam.total_questions || 100} Generated`}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid #E2E8F0', margin: 0 }} />

              {/* S3 Artifacts */}
              <div>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                  S3 ARTIFACT PATHS & DEPLOYMENT
                </div>
                <div style={{ background: '#FAFAFA', padding: 12, borderRadius: 8, border: '1px solid #E2E8F0', fontFamily: 'monospace', fontSize: 11.5, color: '#334155', wordBreak: 'break-all' }}>
                  <div>Questions JSON: {selectedExam.questions_json_path || 'artifacts/' + selectedExam.code + '/json/questions.json'}</div>
                  <div style={{ marginTop: 6 }}>Solutions JSON: {selectedExam.solutions_json_path || 'artifacts/' + selectedExam.code + '/json/solutions.json'}</div>
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
                  borderRadius: 6,
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
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  backgroundColor: '#2563EB',
                  border: 'none',
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)',
                }}
              >
                <Check size={14} />
                Open Question Review
              </button>
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
              borderRadius: 16,
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
                  borderRadius: 12,
                  backgroundColor: 'rgba(245, 158, 11, 0.15)',
                  color: '#D97706',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#0F172A' }}>
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
                const isCancel = opt.toUpperCase() === 'CANCEL' || opt.toUpperCase() === 'IGNORE';
                const isRestart = opt.toUpperCase() === 'RESTART' || opt.toUpperCase() === 'OVERWRITE';

                return (
                  <button
                    key={opt}
                    onClick={() => handleConflictResolve(opt)}
                    style={{
                      padding: '9px 18px',
                      borderRadius: 8,
                      fontSize: 13.5,
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: isCancel ? '1px solid #CBD5E1' : 'none',
                      backgroundColor: isCancel ? '#FFFFFF' : isRestart ? '#DC2626' : '#2563EB',
                      color: isCancel ? '#475569' : '#FFFFFF',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {opt === 'RESTART'
                      ? 'Cancel Old Task & Restart'
                      : opt === 'OVERWRITE'
                      ? 'Overwrite Existing Paper'
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
