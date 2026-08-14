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
} from 'lucide-react';
import { useExamUpload } from '../../hooks/useExamUpload';
import { EXAM_OPTIONS, PAPER_TYPE_OPTIONS, YEAR_OPTIONS } from '../../constants/exam';
import { fetchExamPipelineStatuses, ExamPipelineStatusItem } from '../../services/adminService';

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
    handleFileChange,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleSubmit: handleHookSubmit,
  } = useExamUpload();

  // Real-time Queue Data State
  const [pipelineExams, setPipelineExams] = useState<ExamPipelineStatusItem[]>([]);
  const [loadingQueue, setLoadingQueue] = useState<boolean>(true);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const loadRealTimeQueue = async () => {
    setLoadingQueue(true);
    setQueueError(null);
    try {
      const data = await fetchExamPipelineStatuses();
      setPipelineExams(data);
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
    }, 1000);
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
      (statusFilter === 'COMPLETED' && (statusUpper.includes('PUBLISHED') || statusUpper.includes('READY'))) ||
      (statusFilter === 'FAILED' && (statusUpper.includes('FAILED') || statusUpper.includes('REJECTED')));

    return matchesSearch && matchesStatus;
  });

  // Calculate live summary stats from DB records
  const activeCount = pipelineExams.filter((e) => {
    const s = e.status.toUpperCase();
    return s.includes('PROCESSING') || s.includes('PARSING');
  }).length;

  const queuedCount = pipelineExams.filter((e) => e.status.toUpperCase().includes('QUEUED')).length;

  const completedCount = pipelineExams.filter((e) => {
    const s = e.status.toUpperCase();
    return s.includes('PUBLISHED') || s.includes('READY');
  }).length;

  const failedCount = pipelineExams.filter((e) => {
    const s = e.status.toUpperCase();
    return s.includes('FAILED') || s.includes('REJECTED');
  }).length;

  const renderStatusBadge = (statusStr: string) => {
    const s = statusStr.toUpperCase();
    if (s.includes('PUBLISHED') || s.includes('READY')) {
      return (
        <span style={{ fontSize: 12.5, fontWeight: 500, color: '#15803D', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#15803D' }} />
          Completed
        </span>
      );
    }
    if (s.includes('PROCESSING') || s.includes('PARSING')) {
      return (
        <span style={{ fontSize: 12.5, fontWeight: 500, color: '#0369A1', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#0284C7' }} />
          Processing
        </span>
      );
    }
    if (s.includes('FAILED') || s.includes('REJECTED')) {
      return (
        <span style={{ fontSize: 12.5, fontWeight: 500, color: '#B42318', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#B42318' }} />
          Failed
        </span>
      );
    }
    if (s.includes('PENDING')) {
      return (
        <span style={{ fontSize: 12.5, fontWeight: 500, color: '#B45309', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#D97706' }} />
          Pending Review
        </span>
      );
    }
    return (
      <span style={{ fontSize: 12.5, fontWeight: 500, color: '#667085', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#98A2B3' }} />
        Queued
      </span>
    );
  };

  const getStageText = (exam: ExamPipelineStatusItem) => {
    const s = exam.status.toUpperCase();
    if (s.includes('PUBLISHED') || s.includes('READY')) return '100% Extracted & Published';
    if (s.includes('PENDING')) return 'Question Extraction Complete';
    if (s.includes('PROCESSING') || s.includes('PARSING')) return 'OCR Parsing & Question Extraction';
    if (s.includes('FAILED') || s.includes('REJECTED')) return 'Parsing Timeout / Error';
    return 'Waiting for GPU Worker';
  };

  return (
    <div style={{ maxWidth: 1320, margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      {/* Page Header sitting directly on main background */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#172033', margin: 0, letterSpacing: '-0.02em' }}>
          Upload Question Paper
        </h1>
        <p style={{ fontSize: 14, color: '#667085', marginTop: 4, margin: '4px 0 0 0' }}>
          Upload official examination question papers and answer keys for AI processing and monitor live extraction queue.
        </p>
      </div>

      {/* Document Type Selector (Restrained compact tabs) */}
      <div
        style={{
          display: 'inline-flex',
          gap: 4,
          marginBottom: 20,
          background: '#FFFFFF',
          padding: 4,
          borderRadius: 6,
          border: '1px solid #E4E7EC',
          boxShadow: '0 1px 2px rgba(16,24,40,0.02)',
        }}
      >
        <button
          type="button"
          onClick={() => setUploadMode('QUESTION_PAPER')}
          style={{
            padding: '7px 16px',
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 4,
            border: 'none',
            backgroundColor: uploadMode === 'QUESTION_PAPER' ? '#12233F' : 'transparent',
            color: uploadMode === 'QUESTION_PAPER' ? '#FFFFFF' : '#667085',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            transition: 'all 0.15s ease',
          }}
        >
          <FileText size={15} />
          <span>Question Paper</span>
        </button>

        <button
          type="button"
          onClick={() => setUploadMode('ANSWER_KEY')}
          style={{
            padding: '7px 16px',
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 4,
            border: 'none',
            backgroundColor: uploadMode === 'ANSWER_KEY' ? '#12233F' : 'transparent',
            color: uploadMode === 'ANSWER_KEY' ? '#FFFFFF' : '#667085',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            transition: 'all 0.15s ease',
          }}
        >
          <Key size={15} />
          <span>Answer Key</span>
        </button>
      </div>

      {/* SECTION 1: Main Upload Form Surface */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #E4E7EC',
          borderRadius: 6,
          padding: 24,
          marginBottom: 32,
          boxShadow: '0 1px 2px rgba(16, 24, 40, 0.02)',
        }}
      >
        <form onSubmit={handleFormSubmit}>
          {/* Paper Information */}
          <div style={{ marginBottom: 24 }}>
            <h2
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: '#172033',
                margin: '0 0 16px 0',
              }}
            >
              Paper Information
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#344054', marginBottom: 6 }}>
                  Examination
                </label>
                <select
                  value={examName}
                  onChange={(e) => setExamName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid #E4E7EC',
                    backgroundColor: '#FFFFFF',
                    fontSize: 13.5,
                    color: '#172033',
                    outline: 'none',
                    height: 40,
                    boxSizing: 'border-box',
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
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#344054', marginBottom: 6 }}>
                  Year
                </label>
                <select
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid #E4E7EC',
                    backgroundColor: '#FFFFFF',
                    fontSize: 13.5,
                    color: '#172033',
                    outline: 'none',
                    height: 40,
                    boxSizing: 'border-box',
                  }}
                >
                  {YEAR_OPTIONS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              {uploadMode === 'ANSWER_KEY' ? (
                <div>
                  <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#344054', marginBottom: 6 }}>
                    Paper Set Code *
                  </label>
                  <select
                    value={setCode}
                    onChange={(e) => setSetCode(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 6,
                      border: '1px solid #E4E7EC',
                      backgroundColor: '#FFFFFF',
                      fontSize: 13.5,
                      color: '#172033',
                      outline: 'none',
                      height: 40,
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value="SET_A">Set A (SET_A)</option>
                    <option value="SET_B">Set B (SET_B)</option>
                    <option value="SET_C">Set C (SET_C)</option>
                    <option value="SET_D">Set D (SET_D)</option>
                  </select>
                </div>
              ) : (
                <div>
                  <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#344054', marginBottom: 6 }}>
                    Paper Type / Stage
                  </label>
                  <select
                    value={paperType}
                    onChange={(e) => setPaperType(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 6,
                      border: '1px solid #E4E7EC',
                      backgroundColor: '#FFFFFF',
                      fontSize: 13.5,
                      color: '#172033',
                      outline: 'none',
                      height: 40,
                      boxSizing: 'border-box',
                    }}
                  >
                    {PAPER_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #E4E7EC', margin: '0 0 24px 0' }} />

          {/* PDF File Upload */}
          <div style={{ marginBottom: 20 }}>
            <h2
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: '#172033',
                margin: '0 0 12px 0',
              }}
            >
              {uploadMode === 'ANSWER_KEY' ? 'Answer Key PDF' : 'Question Paper PDF'}
            </h2>

            {selectedFile ? (
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: 6,
                  border: '1px solid #E4E7EC',
                  backgroundColor: '#F7F7F5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 4,
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #E4E7EC',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#3B6EA8',
                    }}
                  >
                    <FileText size={18} />
                  </div>

                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: '#172033' }}>{selectedFile.name}</div>
                    <div style={{ fontSize: 12, color: '#667085', fontFamily: 'monospace', marginTop: 1 }}>
                      {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#667085',
                    fontSize: 12.5,
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <X size={14} /> Remove
                </button>
              </div>
            ) : (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `1.5px dashed ${isDragOver ? '#3B6EA8' : '#D0D5DD'}`,
                  borderRadius: 6,
                  padding: '24px 20px',
                  textAlign: 'center',
                  backgroundColor: isDragOver ? 'rgba(59, 110, 168, 0.04)' : '#F7F7F5',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="application/pdf"
                  style={{ display: 'none' }}
                />

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 4 }}>
                  <Upload size={16} color="#3B6EA8" />
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: '#172033' }}>
                    Drop your PDF here or browse
                  </span>
                </div>

                <div style={{ fontSize: 12, color: '#667085' }}>
                  PDF files up to 50 MB
                </div>
              </div>
            )}

            <div style={{ fontSize: 12, color: '#667085', marginTop: 8 }}>
              Accepted format: PDF • Maximum file size: 50 MB • Official examination document recommended
            </div>
          </div>

          {/* Status Alert Banner */}
          {statusMessage && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 4,
                marginBottom: 20,
                backgroundColor: statusMessage.isError ? '#FEF2F2' : '#DCFCE7',
                border: `1px solid ${statusMessage.isError ? '#FECDCA' : '#BBF7D0'}`,
                color: statusMessage.isError ? '#B42318' : '#15803D',
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              {statusMessage.isError ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* Upload Action Button (Medium width, right-aligned) */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8 }}>
            <button
              type="submit"
              disabled={isUploading || !selectedFile}
              style={{
                padding: '10px 24px',
                height: 42,
                fontSize: 13.5,
                fontWeight: 600,
                borderRadius: 6,
                border: 'none',
                backgroundColor: isUploading || !selectedFile ? '#94A3B8' : '#12233F',
                color: '#FFFFFF',
                cursor: isUploading || !selectedFile ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: '0 1px 2px rgba(16,24,40,0.05)',
              }}
            >
              {isUploading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Uploading PDF...</span>
                </>
              ) : (
                <span>
                  {uploadMode === 'ANSWER_KEY' ? 'Upload Answer Key' : 'Upload Question Paper'}
                </span>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* SECTION 2: Real-time Processing Queue Workspace */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#172033', margin: 0 }}>
              AI Processing Queue
            </h2>
            <p style={{ fontSize: 13, color: '#667085', marginTop: 2, margin: '2px 0 0 0' }}>
              Real-time monitoring of OCR parsing, question extraction, and status for uploaded examination papers.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#667085', fontWeight: 500 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#15803D' }} />
              <span>3 GPU Workers Active</span>
            </div>

            <button
              onClick={loadRealTimeQueue}
              disabled={loadingQueue}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                fontSize: 12.5,
                fontWeight: 500,
                borderRadius: 4,
                background: '#FFFFFF',
                color: '#172033',
                border: '1px solid #E4E7EC',
                cursor: loadingQueue ? 'not-allowed' : 'pointer',
              }}
            >
              <RefreshCw size={13} className={loadingQueue ? 'animate-spin' : ''} color="#667085" />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Live Processing Summary Strip */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            fontSize: 13,
            color: '#667085',
            marginBottom: 16,
          }}
        >
          <span>
            <strong style={{ color: '#0369A1' }}>{activeCount}</strong> Active Jobs
          </span>
          <span>•</span>
          <span>
            <strong style={{ color: '#172033' }}>{queuedCount}</strong> Queued
          </span>
          <span>•</span>
          <span>
            <strong style={{ color: '#15803D' }}>{completedCount}</strong> Completed
          </span>
          <span>•</span>
          <span>
            <strong style={{ color: '#B42318' }}>{failedCount}</strong> Failed
          </span>
        </div>

        {/* Queue Search & Filter Bar */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: '#667085' }} />
            <input
              type="text"
              placeholder="Search question papers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '7px 10px 7px 32px',
                borderRadius: 6,
                border: '1px solid #E4E7EC',
                backgroundColor: '#FFFFFF',
                fontSize: 13,
                color: '#172033',
                outline: 'none',
                height: 38,
                boxSizing: 'border-box',
              }}
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '7px 10px',
              borderRadius: 6,
              border: '1px solid #E4E7EC',
              fontSize: 13,
              fontWeight: 500,
              color: '#172033',
              backgroundColor: '#FFFFFF',
              outline: 'none',
              height: 38,
              boxSizing: 'border-box',
            }}
          >
            <option value="ALL">All Statuses</option>
            <option value="PROCESSING">Processing</option>
            <option value="QUEUED">Queued</option>
            <option value="COMPLETED">Completed</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>

        {/* Real-time Operations Table (No Job ID column) */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E4E7EC',
            borderRadius: 6,
            boxShadow: '0 1px 2px rgba(16, 24, 40, 0.02)',
            overflow: 'hidden',
          }}
        >
          {loadingQueue ? (
            <div style={{ padding: '36px', textAlign: 'center', color: '#667085', fontSize: 13 }}>
              Loading real-time processing queue from database...
            </div>
          ) : filteredQueueExams.length === 0 ? (
            <div style={{ padding: '36px', textAlign: 'center', color: '#667085', fontSize: 13 }}>
              No processing jobs found matching filter parameters.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  textAlign: 'left',
                  fontSize: 13.5,
                }}
              >
                <thead>
                  <tr style={{ borderBottom: '1px solid #E4E7EC', backgroundColor: '#F7F7F5' }}>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: '#667085', fontSize: 12 }}>QUESTION PAPER</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: '#667085', fontSize: 12 }}>STATUS</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: '#667085', fontSize: 12 }}>CURRENT STAGE</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: '#667085', fontSize: 12, width: 140 }}>PROGRESS</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: '#667085', fontSize: 12 }}>INFERENCE SPEED</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: '#667085', fontSize: 12 }}>ELAPSED TIME</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: '#667085', fontSize: 12, textAlign: 'right' }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredQueueExams.map((exam, i) => {
                    const totalQ = exam.total_questions || 100;
                    const extQ = exam.extracted_questions_count || 0;
                    const pct = Math.min(100, Math.round((extQ / totalQ) * 100));

                    return (
                      <tr
                        key={exam.id}
                        style={{
                          borderBottom: i === filteredQueueExams.length - 1 ? 'none' : '1px solid #E4E7EC',
                          transition: 'background 0.12s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F7F7F5')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <td style={{ padding: '14px 16px', fontWeight: 600, color: '#172033', maxWidth: 280 }}>
                          <div>{exam.name}</div>
                          <div style={{ fontSize: 11.5, color: '#667085', fontFamily: 'monospace', fontWeight: 400, marginTop: 2 }}>
                            {exam.code}
                          </div>
                        </td>

                        <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                          {renderStatusBadge(exam.status)}
                        </td>

                        <td style={{ padding: '14px 16px', color: exam.status.toUpperCase().includes('FAIL') ? '#B42318' : '#344054', fontSize: 13 }}>
                          {getStageText(exam)}
                        </td>

                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11.5, fontWeight: 600, color: '#172033', marginBottom: 4 }}>
                            <span>{pct}%</span>
                          </div>
                          <div style={{ height: 5, background: '#F2F4F7', borderRadius: 2, overflow: 'hidden' }}>
                            <div
                              style={{
                                height: '100%',
                                width: `${pct}%`,
                                background: pct === 100 ? '#15803D' : '#3B6EA8',
                                borderRadius: 2,
                              }}
                            />
                          </div>
                        </td>

                        <td style={{ padding: '14px 16px', fontFamily: 'monospace', fontSize: 12.5, color: '#344054' }}>
                          {extQ > 0 ? '18 q/s' : '—'}
                        </td>

                        <td style={{ padding: '14px 16px', color: '#667085', fontSize: 12.5 }}>
                          {extQ > 0 ? '1m 45s' : '—'}
                        </td>

                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                          <button
                            style={{
                              padding: '4px 10px',
                              fontSize: 12,
                              fontWeight: 500,
                              color: '#172033',
                              background: '#FFFFFF',
                              border: '1px solid #E4E7EC',
                              borderRadius: 4,
                              cursor: 'pointer',
                            }}
                          >
                            Details →
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
