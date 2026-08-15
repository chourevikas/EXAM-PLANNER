import React, { useState, useEffect } from 'react';
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
  Eye,
  Layers,
  Sparkles,
} from 'lucide-react';
import { useExamUpload } from '../../hooks/useExamUpload';
import { EXAM_OPTIONS, PAPER_TYPE_OPTIONS, YEAR_OPTIONS } from '../../constants/exam';
import {
  fetchExamPipelineStatuses,
  approveAndPublishExam,
  ExamPipelineStatusItem,
} from '../../services/adminService';

export function UploadReviewView() {
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

  // Real-time Pipeline & Queue State
  const [pipelineExams, setPipelineExams] = useState<ExamPipelineStatusItem[]>([]);
  const [loadingQueue, setLoadingQueue] = useState<boolean>(true);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [stageFilter, setStageFilter] = useState<string>('ALL');

  // UI Tabs / View Sections
  const [activeTab, setActiveTab] = useState<'UNIFIED' | 'UPLOAD_ONLY' | 'PIPELINE_ONLY'>('UNIFIED');

  // Drawer and Approval State
  const [selectedExam, setSelectedExam] = useState<ExamPipelineStatusItem | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadRealTimeQueue = async () => {
    setLoadingQueue(true);
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
      setQueueError(err.message || 'Could not load pipeline jobs.');
    } finally {
      setLoadingQueue(false);
    }
  };

  useEffect(() => {
    loadRealTimeQueue();
  }, []);

  const handleFormSubmit = async (e: React.FormEvent) => {
    await handleHookSubmit(e);
    // Reload live queue after uploading
    setTimeout(() => {
      loadRealTimeQueue();
    }, 1200);
  };

  const handleApprove = async (examId: string, examTitle: string) => {
    setApprovingId(examId);
    try {
      await approveAndPublishExam(examId);
      setToastMessage(`Exam '${examTitle}' successfully approved & published. S3 JSON artifacts generated.`);
      setTimeout(() => setToastMessage(null), 5000);
      await loadRealTimeQueue();
    } catch (err: any) {
      alert(`Error approving exam: ${err.message}`);
    } finally {
      setApprovingId(null);
    }
  };

  // Filter real-time jobs
  const filteredQueueExams = pipelineExams.filter((exam) => {
    const matchesSearch =
      !searchQuery ||
      exam.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exam.code.toLowerCase().includes(searchQuery.toLowerCase());

    const statusUpper = exam.status.toUpperCase();
    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'PROCESSING' && (statusUpper.includes('PROCESSING') || statusUpper.includes('PARSING'))) ||
      (statusFilter === 'QUEUED' && statusUpper.includes('QUEUED')) ||
      (statusFilter === 'PENDING' && statusUpper.includes('PENDING')) ||
      (statusFilter === 'COMPLETED' && (statusUpper.includes('PUBLISHED') || statusUpper.includes('READY'))) ||
      (statusFilter === 'FAILED' && (statusUpper.includes('FAILED') || statusUpper.includes('REJECTED')));

    const matchesStage = stageFilter === 'ALL' || exam.stage?.toLowerCase() === stageFilter.toLowerCase();

    return matchesSearch && matchesStatus && matchesStage;
  });

  // Calculate live summary stats
  const totalExamsCount = pipelineExams.length;
  const activeCount = pipelineExams.filter((e) => {
    const s = e.status.toUpperCase();
    return s.includes('PROCESSING') || s.includes('PARSING');
  }).length;
  const pendingCount = pipelineExams.filter((e) => e.status.toUpperCase().includes('PENDING')).length;
  const completedCount = pipelineExams.filter((e) => {
    const s = e.status.toUpperCase();
    return s.includes('PUBLISHED') || s.includes('READY');
  }).length;

  const renderStatusBadge = (statusStr: string) => {
    const s = statusStr.toUpperCase();
    if (s.includes('PUBLISHED') || s.includes('READY')) {
      return (
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: '#15803D',
            backgroundColor: '#DCFCE7',
            border: '1px solid #BBF7D0',
            padding: '3px 8px',
            borderRadius: 4,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#15803D' }} />
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
            padding: '3px 8px',
            borderRadius: 4,
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
            padding: '3px 8px',
            borderRadius: 4,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#B42318' }} />
          Failed
        </span>
      );
    }
    if (s.includes('PENDING')) {
      return (
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: '#B45309',
            backgroundColor: '#FEF3C7',
            border: '1px solid #FDE68A',
            padding: '3px 8px',
            borderRadius: 4,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#D97706' }} />
          Pending Review
        </span>
      );
    }
    return (
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: '#475467',
          backgroundColor: '#F2F4F7',
          border: '1px solid #EAECF0',
          padding: '3px 8px',
          borderRadius: 4,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#98A2B3' }} />
        Queued
      </span>
    );
  };

  const renderPipelineStageVisualizer = (exam: ExamPipelineStatusItem) => {
    const total = exam.total_questions || 100;
    const ext = exam.extracted_questions_count || 0;
    const isExtractDone = ext >= total || ext > 0;
    const isKeyMatched = Boolean(exam.paper_set_code) && (exam.status.toUpperCase().includes('PUBLISHED') || ext > 0);
    const isExplDone = exam.status.toUpperCase().includes('PUBLISHED') || Boolean(exam.solutions_json_path);

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {/* Stage 1: Extraction */}
        <div
          title={`Stage 1: Question Extraction (${ext}/${total} Qs)`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 6px',
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 600,
            backgroundColor: isExtractDone ? '#DCFCE7' : '#F2F4F7',
            color: isExtractDone ? '#15803D' : '#667085',
            border: `1px solid ${isExtractDone ? '#BBF7D0' : '#E4E7EC'}`,
          }}
        >
          <FileText size={11} />
          <span>1. Extraction ({ext}/{total})</span>
        </div>

        <span style={{ color: '#98A2B3', fontSize: 10 }}>→</span>

        {/* Stage 2: Key Mapping */}
        <div
          title={`Stage 2: Answer Key Mapping (${exam.paper_set_code || 'Set A'})`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 6px',
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 600,
            backgroundColor: isKeyMatched ? '#DCFCE7' : '#FEF3C7',
            color: isKeyMatched ? '#15803D' : '#B45309',
            border: `1px solid ${isKeyMatched ? '#BBF7D0' : '#FDE68A'}`,
          }}
        >
          <Key size={11} />
          <span>2. Key ({exam.paper_set_code || 'Set A'})</span>
        </div>

        <span style={{ color: '#98A2B3', fontSize: 10 }}>→</span>

        {/* Stage 3: Explanations */}
        <div
          title="Stage 3: Explanations & Taxonomy Generation"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 6px',
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 600,
            backgroundColor: isExplDone ? '#DCFCE7' : '#E0F2FE',
            color: isExplDone ? '#15803D' : '#0369A1',
            border: `1px solid ${isExplDone ? '#BBF7D0' : '#BAE6FD'}`,
          }}
        >
          <Sparkles size={11} />
          <span>3. Explanations</span>
        </div>
      </div>
    );
  };

  return (
    <div style={{ maxWidth: 1380, margin: '0 auto', fontFamily: 'Inter, sans-serif', paddingBottom: 60 }}>
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
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
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

      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: '#172033', margin: 0, letterSpacing: '-0.02em' }}>
            Question Paper Upload & 3-Stage Pipeline Ingestion Center
          </h1>
          <p style={{ fontSize: 13.5, color: '#667085', marginTop: 4, margin: '4px 0 0 0' }}>
            Upload question papers and answer keys, track the 3 extraction & explanation pipeline stages, and manage exam publishing.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={loadRealTimeQueue}
            disabled={loadingQueue}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              fontSize: 13,
              fontWeight: 600,
              backgroundColor: '#FFFFFF',
              color: '#172033',
              border: '1px solid #E4E7EC',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} className={loadingQueue ? 'animate-spin' : ''} />
            Refresh Pipeline
          </button>
        </div>
      </div>

      {/* 4-Metric Summary KPIs */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #E4E7EC',
          borderRadius: 8,
          padding: '16px 24px',
          marginBottom: 24,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 16,
          boxShadow: '0 1px 3px rgba(16,24,40,0.03)',
        }}
      >
        <div style={{ paddingRight: 16, borderRight: '1px solid #E4E7EC' }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#172033' }}>{totalExamsCount}</div>
          <div style={{ fontSize: 12, color: '#667085', fontWeight: 600, marginTop: 2 }}>Total Exam Papers</div>
        </div>

        <div style={{ paddingRight: 16, borderRight: '1px solid #E4E7EC' }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#0369A1', display: 'flex', alignItems: 'center', gap: 8 }}>
            {activeCount}
            {activeCount > 0 && <Loader2 size={18} className="animate-spin" color="#0369A1" />}
          </div>
          <div style={{ fontSize: 12, color: '#667085', fontWeight: 600, marginTop: 2 }}>Active Pipeline Tasks</div>
        </div>

        <div style={{ paddingRight: 16, borderRight: '1px solid #E4E7EC' }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#B45309' }}>{pendingCount}</div>
          <div style={{ fontSize: 12, color: '#667085', fontWeight: 600, marginTop: 2 }}>Pending Review & Publish</div>
        </div>

        <div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#15803D' }}>{completedCount}</div>
          <div style={{ fontSize: 12, color: '#667085', fontWeight: 600, marginTop: 2 }}>Published & Active in S3</div>
        </div>
      </div>

      {/* View Switcher Controls */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button
          onClick={() => setActiveTab('UNIFIED')}
          style={{
            padding: '7px 16px',
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 6,
            border: 'none',
            backgroundColor: activeTab === 'UNIFIED' ? '#3B6EA8' : '#FFFFFF',
            color: activeTab === 'UNIFIED' ? '#FFFFFF' : '#344054',
            cursor: 'pointer',
            boxShadow: '0 1px 2px rgba(16,24,40,0.05)',
          }}
        >
          Unified View (Upload + Live Pipelines)
        </button>
        <button
          onClick={() => setActiveTab('UPLOAD_ONLY')}
          style={{
            padding: '7px 16px',
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 6,
            border: 'none',
            backgroundColor: activeTab === 'UPLOAD_ONLY' ? '#3B6EA8' : '#FFFFFF',
            color: activeTab === 'UPLOAD_ONLY' ? '#FFFFFF' : '#344054',
            cursor: 'pointer',
            boxShadow: '0 1px 2px rgba(16,24,40,0.05)',
          }}
        >
          Upload Form Only
        </button>
        <button
          onClick={() => setActiveTab('PIPELINE_ONLY')}
          style={{
            padding: '7px 16px',
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 6,
            border: 'none',
            backgroundColor: activeTab === 'PIPELINE_ONLY' ? '#3B6EA8' : '#FFFFFF',
            color: activeTab === 'PIPELINE_ONLY' ? '#FFFFFF' : '#344054',
            cursor: 'pointer',
            boxShadow: '0 1px 2px rgba(16,24,40,0.05)',
          }}
        >
          3-Stage Pipeline Status & S3 Artifacts
        </button>
      </div>

      {/* SECTION 1: Question Paper & Answer Key Upload Module */}
      {(activeTab === 'UNIFIED' || activeTab === 'UPLOAD_ONLY') && (
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E4E7EC',
            borderRadius: 8,
            padding: 24,
            marginBottom: 24,
            boxShadow: '0 1px 3px rgba(16, 24, 40, 0.03)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#172033', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Upload size={18} color="#3B6EA8" />
              Upload Examination Document
            </h2>

            {/* Document Type Selector */}
            <div
              style={{
                display: 'inline-flex',
                gap: 4,
                background: '#F7F7F5',
                padding: 3,
                borderRadius: 6,
                border: '1px solid #E4E7EC',
              }}
            >
              <button
                type="button"
                onClick={() => setUploadMode('QUESTION_PAPER')}
                style={{
                  padding: '5px 12px',
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: 4,
                  border: 'none',
                  backgroundColor: uploadMode === 'QUESTION_PAPER' ? '#FFFFFF' : 'transparent',
                  color: uploadMode === 'QUESTION_PAPER' ? '#172033' : '#667085',
                  boxShadow: uploadMode === 'QUESTION_PAPER' ? '0 1px 2px rgba(16,24,40,0.06)' : 'none',
                  cursor: 'pointer',
                }}
              >
                Question Paper (PDF/JSON)
              </button>
              <button
                type="button"
                onClick={() => setUploadMode('ANSWER_KEY')}
                style={{
                  padding: '5px 12px',
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: 4,
                  border: 'none',
                  backgroundColor: uploadMode === 'ANSWER_KEY' ? '#FFFFFF' : 'transparent',
                  color: uploadMode === 'ANSWER_KEY' ? '#172033' : '#667085',
                  boxShadow: uploadMode === 'ANSWER_KEY' ? '0 1px 2px rgba(16,24,40,0.06)' : 'none',
                  cursor: 'pointer',
                }}
              >
                Official Answer Key (PDF/JSON)
              </button>
            </div>
          </div>

          <form onSubmit={handleFormSubmit}>
            {/* Metadata Fields Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 16,
                marginBottom: 20,
              }}
            >
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#344054', marginBottom: 6 }}>
                  Target Exam
                </label>
                <select
                  value={examName}
                  onChange={(e) => setExamName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid #D0D5DD',
                    fontSize: 13,
                    outline: 'none',
                    backgroundColor: '#FFFFFF',
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
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#344054', marginBottom: 6 }}>
                  Examination Year
                </label>
                <select
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid #D0D5DD',
                    fontSize: 13,
                    outline: 'none',
                    backgroundColor: '#FFFFFF',
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
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#344054', marginBottom: 6 }}>
                  Paper Set Code
                </label>
                <input
                  type="text"
                  value={setCode}
                  onChange={(e) => setSetCode(e.target.value.toUpperCase())}
                  placeholder="SET_A, SET_B, etc."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid #D0D5DD',
                    fontSize: 13,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#344054', marginBottom: 6 }}>
                  Paper Classification
                </label>
                <select
                  value={paperType}
                  onChange={(e) => setPaperType(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid #D0D5DD',
                    fontSize: 13,
                    outline: 'none',
                    backgroundColor: '#FFFFFF',
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

            {/* Dropzone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${isDragOver ? '#3B6EA8' : '#D0D5DD'}`,
                backgroundColor: isDragOver ? '#F0F9FF' : '#F9FAFB',
                borderRadius: 8,
                padding: '28px 20px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                marginBottom: 16,
              }}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".pdf,.json,.zip"
                style={{ display: 'none' }}
              />
              <Cloud size={32} color={isDragOver ? '#3B6EA8' : '#667085'} style={{ margin: '0 auto 8px' }} />
              <div style={{ fontSize: 13.5, fontWeight: 600, color: '#172033' }}>
                {selectedFile ? selectedFile.name : 'Click to upload or drag & drop exam document'}
              </div>
              <div style={{ fontSize: 12, color: '#667085', marginTop: 4 }}>
                Supports standard PDF question papers, S3 JSON format, and multi-file packages (Max 100MB)
              </div>
            </div>

            {/* Upload Button and Status */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 13, color: '#667085' }}>
                {statusMessage && (
                  <span style={{ color: statusMessage.isError ? '#B42318' : '#15803D', fontWeight: 500 }}>
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
                  padding: '9px 20px',
                  borderRadius: 6,
                  fontSize: 13.5,
                  fontWeight: 600,
                  backgroundColor: !selectedFile || isUploading ? '#98A2B3' : '#3B6EA8',
                  color: '#FFFFFF',
                  border: 'none',
                  cursor: !selectedFile || isUploading ? 'not-allowed' : 'pointer',
                }}
              >
                {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                {isUploading ? 'Uploading & Triggering Pipeline...' : 'Upload & Start 3-Stage Pipeline'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SECTION 2: 3-Stage Pipeline Progress & Exam Status Table */}
      {(activeTab === 'UNIFIED' || activeTab === 'PIPELINE_ONLY') && (
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E4E7EC',
            borderRadius: 8,
            boxShadow: '0 1px 3px rgba(16, 24, 40, 0.03)',
            overflow: 'hidden',
          }}
        >
          {/* Header & Filter Controls */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #E4E7EC', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: 12, color: '#667085' }} />
              <input
                type="text"
                placeholder="Search exam by code or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px 8px 32px',
                  borderRadius: 6,
                  border: '1px solid #E4E7EC',
                  backgroundColor: '#FFFFFF',
                  fontSize: 13,
                  color: '#172033',
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
                border: '1px solid #E4E7EC',
                fontSize: 13,
                fontWeight: 500,
                color: '#172033',
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
                border: '1px solid #E4E7EC',
                fontSize: 13,
                fontWeight: 500,
                color: '#172033',
                backgroundColor: '#FFFFFF',
                outline: 'none',
              }}
            >
              <option value="ALL">All Stages</option>
              <option value="prelims">Prelims</option>
              <option value="mains">Mains</option>
            </select>
          </div>

          {/* Table Content */}
          {loadingQueue ? (
            <div style={{ padding: 48, textAlign: 'center', color: '#667085', fontSize: 13.5 }}>
              <Loader2 size={24} className="animate-spin" color="#3B6EA8" style={{ margin: '0 auto 10px' }} />
              Loading exam pipeline records from database...
            </div>
          ) : filteredQueueExams.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: '#667085', fontSize: 13.5 }}>
              <FileSpreadsheet size={32} color="#98A2B3" style={{ margin: '0 auto 10px' }} />
              <div>No examination papers found matching filter criteria.</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13.5 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #E4E7EC', backgroundColor: '#F7F7F5' }}>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: '#667085', fontSize: 12 }}>EXAM PAPER</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: '#667085', fontSize: 12 }}>STATUS</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: '#667085', fontSize: 12 }}>3-PIPELINE PROGRESS</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: '#667085', fontSize: 12 }}>S3 JSON ARTIFACTS</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: '#667085', fontSize: 12, textAlign: 'right' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredQueueExams.map((exam, i) => {
                    return (
                      <tr
                        key={exam.id}
                        onClick={() => {
                          setSelectedExam(exam);
                          setIsDrawerOpen(true);
                        }}
                        style={{
                          borderBottom: i === filteredQueueExams.length - 1 ? 'none' : '1px solid #E4E7EC',
                          cursor: 'pointer',
                          transition: 'background 0.12s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F9FAFB')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <td style={{ padding: '14px 16px', maxWidth: 280 }}>
                          <div style={{ fontWeight: 600, color: '#172033' }}>{exam.name}</div>
                          <div style={{ fontSize: 11.5, color: '#667085', fontFamily: 'monospace', marginTop: 2 }}>
                            {exam.code} • {exam.source_year} • {exam.paper_set_code}
                          </div>
                        </td>

                        <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                          {renderStatusBadge(exam.status)}
                        </td>

                        <td style={{ padding: '14px 16px' }}>
                          {renderPipelineStageVisualizer(exam)}
                        </td>

                        <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                          {exam.questions_json_path ? (
                            <span style={{ fontSize: 12, color: '#15803D', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <Database size={13} /> S3 Ready
                            </span>
                          ) : (
                            <span style={{ fontSize: 12, color: '#98A2B3', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <Clock size={13} /> Generating...
                            </span>
                          )}
                        </td>

                        <td style={{ padding: '14px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'inline-flex', gap: 8 }} onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => {
                                setSelectedExam(exam);
                                setIsDrawerOpen(true);
                              }}
                              style={{
                                padding: '5px 10px',
                                fontSize: 12,
                                fontWeight: 600,
                                color: '#172033',
                                background: '#FFFFFF',
                                border: '1px solid #E4E7EC',
                                borderRadius: 4,
                                cursor: 'pointer',
                              }}
                            >
                              Details
                            </button>

                            {exam.status.toUpperCase().includes('PENDING') && (
                              <button
                                onClick={() => handleApprove(exam.id, exam.name)}
                                disabled={approvingId === exam.id}
                                style={{
                                  padding: '5px 12px',
                                  fontSize: 12,
                                  fontWeight: 600,
                                  color: '#FFFFFF',
                                  background: '#15803D',
                                  border: 'none',
                                  borderRadius: 4,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                }}
                              >
                                {approvingId === exam.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                                Publish
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Slide-out Examination Pipeline Inspection Drawer */}
      {isDrawerOpen && selectedExam && (
        <>
          <div
            onClick={() => setIsDrawerOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(16, 33, 61, 0.4)',
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
              boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.12)',
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
                borderBottom: '1px solid #E4E7EC',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
              }}
            >
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#667085', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  PIPELINE AUDIT & INSPECTION
                </div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#172033', margin: '4px 0 0 0' }}>
                  {selectedExam.name}
                </h2>
                <div style={{ fontSize: 12, fontFamily: 'monospace', color: '#667085', marginTop: 2 }}>
                  {selectedExam.code}
                </div>
              </div>
              <button
                onClick={() => setIsDrawerOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#667085',
                  cursor: 'pointer',
                  padding: 4,
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Drawer Body */}
            <div style={{ flex: 1, padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Status */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: '#667085', fontWeight: 500 }}>Overall Status</span>
                <div>{renderStatusBadge(selectedExam.status)}</div>
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid #E4E7EC', margin: 0 }} />

              {/* 3 Pipeline Stages Breakdown */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#667085', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
                  3-STAGE PIPELINE PROGRESS
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ background: '#F9FAFB', border: '1px solid #E4E7EC', borderRadius: 6, padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#172033' }}>Stage 1: Question Extraction</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#15803D' }}>
                        {selectedExam.extracted_questions_count} / {selectedExam.total_questions || 100} Qs
                      </span>
                    </div>
                    <div style={{ height: 6, background: '#EAECF0', borderRadius: 3, overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.min(100, Math.round((selectedExam.extracted_questions_count / (selectedExam.total_questions || 100)) * 100))}%`,
                          background: '#15803D',
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ background: '#F9FAFB', border: '1px solid #E4E7EC', borderRadius: 6, padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#172033' }}>Stage 2: Answer Key Mapping</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#15803D' }}>
                        Set Code: {selectedExam.paper_set_code || 'SET_A'}
                      </span>
                    </div>
                  </div>

                  <div style={{ background: '#F9FAFB', border: '1px solid #E4E7EC', borderRadius: 6, padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#172033' }}>Stage 3: Explanation & Taxonomy</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: selectedExam.solutions_json_path ? '#15803D' : '#0369A1' }}>
                        {selectedExam.solutions_json_path ? 'Ready & Verified' : 'In Progress'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid #E4E7EC', margin: 0 }} />

              {/* S3 Artifacts */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#667085', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                  S3 ARTIFACT PATHS
                </div>
                <div style={{ background: '#F7F7F5', padding: 12, borderRadius: 6, border: '1px solid #E4E7EC', fontFamily: 'monospace', fontSize: 11, color: '#344054', wordBreak: 'break-all' }}>
                  <div>Questions: {selectedExam.questions_json_path || 'artifacts/' + selectedExam.code + '/json/questions'}</div>
                  <div style={{ marginTop: 6 }}>Solutions: {selectedExam.solutions_json_path || 'artifacts/' + selectedExam.code + '/json/solutions'}</div>
                </div>
              </div>
            </div>

            {/* Drawer Actions */}
            <div style={{ padding: 20, borderTop: '1px solid #E4E7EC', backgroundColor: '#F7F7F5', display: 'flex', gap: 10 }}>
              <button
                onClick={() => setIsDrawerOpen(false)}
                style={{
                  flex: 1,
                  padding: '9px 16px',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #D0D5DD',
                  color: '#344054',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>

              <button
                onClick={() => handleApprove(selectedExam.id, selectedExam.name)}
                disabled={approvingId === selectedExam.id}
                style={{
                  flex: 1,
                  padding: '9px 16px',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  backgroundColor: '#15803D',
                  border: 'none',
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                {approvingId === selectedExam.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Approve & Publish Exam
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
