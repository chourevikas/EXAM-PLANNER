import React, { useEffect, useState } from 'react';
import {
  fetchExamPipelineStatuses,
  approveAndPublishExam,
  ExamPipelineStatusItem,
} from '../../../services/adminService';
import {
  RefreshCw,
  Search,
  AlertCircle,
  FileSpreadsheet,
  X,
  CheckCircle2,
  Clock,
  Loader2,
  ArrowRight,
  Database,
  FileText,
  Check,
} from 'lucide-react';

interface ExamPipelineStatusViewProps {
  onNavigate?: (view: string, extraData?: any) => void;
}

export function ExamPipelineStatusView({ onNavigate }: ExamPipelineStatusViewProps = {}) {
  const [exams, setExams] = useState<ExamPipelineStatusItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [stageFilter, setStageFilter] = useState('ALL');

  const [selectedExam, setSelectedExam] = useState<ExamPipelineStatusItem | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadData = async (isSilent: boolean = false) => {
    if (!isSilent) setIsLoading(true);
    setError(null);
    try {
      const data = await fetchExamPipelineStatuses();
      setExams(data);
      // Keep selected exam updated if drawer is open
      if (selectedExam) {
        const updated = data.find((item) => item.id === selectedExam.id);
        if (updated) setSelectedExam(updated);
      }
    } catch (err: any) {
      if (!isSilent) setError(err.message || 'Failed to load exam pipeline statuses.');
    } finally {
      if (!isSilent) setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData(false);
  }, []);

  // Adaptive polling for exam pipeline statuses (20s when active pipelines run, 35s when idle) to reduce server load
  useEffect(() => {
    const hasActivePipeline = exams.some(
      (e) =>
        (e.status || '').toUpperCase().includes('PROCESSING') ||
        (e.status || '').toUpperCase().includes('IN_PROGRESS') ||
        (e.overall_status || '').toUpperCase().includes('PROCESSING')
    );
    const pollInterval = hasActivePipeline ? 20000 : 35000;

    const intervalId = setInterval(() => {
      loadData(true);
    }, pollInterval);

    return () => clearInterval(intervalId);
  }, [exams]);

  const handleApprove = async (examId: string, examName: string) => {
    setApprovingId(examId);
    try {
      await approveAndPublishExam(examId);
      setToastMessage(`Exam '${examName}' successfully approved & published. S3 JSON artifacts generated.`);
      setTimeout(() => setToastMessage(null), 5000);
      await loadData();
    } catch (err: any) {
      alert(`Error approving exam: ${err.message}`);
    } finally {
      setApprovingId(null);
    }
  };

  // Filter exams
  const filteredExams = exams.filter((e) => {
    const matchesSearch =
      e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.code.toLowerCase().includes(searchQuery.toLowerCase());

    const statusUpper = e.status.toUpperCase();
    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'PENDING' && statusUpper.includes('PENDING')) ||
      (statusFilter === 'PUBLISHED' && (statusUpper.includes('PUBLISHED') || statusUpper.includes('READY'))) ||
      (statusFilter === 'PROCESSING' && (statusUpper.includes('PROCESSING') || statusUpper.includes('PARSING')));

    const matchesStage = stageFilter === 'ALL' || e.stage.toLowerCase() === stageFilter.toLowerCase();

    return matchesSearch && matchesStatus && matchesStage;
  });

  // Calculate Pipeline Summary Counts
  const totalExams = exams.length;
  const processingCount = exams.filter((e) => {
    const s = e.status.toUpperCase();
    return s.includes('PROCESSING') || s.includes('PARSING');
  }).length;
  const pendingCount = exams.filter((e) => e.status.toUpperCase().includes('PENDING')).length;
  const publishedCount = exams.filter((e) => {
    const s = e.status.toUpperCase();
    return s.includes('PUBLISHED') || s.includes('READY');
  }).length;

  const getStatusBadge = (statusStr: string) => {
    const s = statusStr.toUpperCase();
    if (s.includes('PUBLISHED') || s.includes('READY')) {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '3px 8px',
            borderRadius: 4,
            fontSize: 11.5,
            fontWeight: 600,
            backgroundColor: '#DCFCE7',
            color: '#15803D',
            border: '1px solid #BBF7D0',
          }}
        >
          Published
        </span>
      );
    }
    if (s.includes('PENDING')) {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '3px 8px',
            borderRadius: 4,
            fontSize: 11.5,
            fontWeight: 600,
            backgroundColor: '#FEF3C7',
            color: '#B45309',
            border: '1px solid #FDE68A',
          }}
        >
          Pending Review
        </span>
      );
    }
    if (s.includes('PROCESSING') || s.includes('PARSING')) {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '3px 8px',
            borderRadius: 4,
            fontSize: 11.5,
            fontWeight: 600,
            backgroundColor: '#E0F2FE',
            color: '#0369A1',
            border: '1px solid #BAE6FD',
          }}
        >
          Processing
        </span>
      );
    }
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          padding: '3px 8px',
          borderRadius: 4,
          fontSize: 11.5,
          fontWeight: 600,
          backgroundColor: '#F2F4F7',
          color: '#344054',
          border: '1px solid #E4E7EC',
        }}
      >
        {statusStr.replace('_', ' ')}
      </span>
    );
  };

  const getS3StatusBadge = (exam: ExamPipelineStatusItem) => {
    if (exam.is_active) {
      return (
        <span style={{ fontSize: 12, fontWeight: 600, color: '#15803D', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Check size={13} color="#15803D" /> Active (S3 Ready)
        </span>
      );
    }
    if (exam.status.toUpperCase().includes('PUBLISHED') || approvingId === exam.id) {
      return (
        <span style={{ fontSize: 12, fontWeight: 500, color: '#64748B', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Loader2 size={13} className="animate-spin" color="#64748B" /> Uploading to S3...
        </span>
      );
    }
    return <span style={{ fontSize: 12, color: '#667085' }}>Not generated</span>;
  };


  return (
    <div style={{ maxWidth: 1320, margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            marginBottom: 20,
            padding: '12px 16px',
            borderRadius: 6,
            backgroundColor: '#10B981',
            color: '#FFFFFF',
            fontWeight: 500,
            fontSize: 13.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 3px rgba(16,24,40,0.1)',
          }}
        >
          <span>{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 14 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* 1. Page Header (Sitting directly on background) */}
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
            Exam Pipeline
          </h1>
          <p style={{ fontSize: 14, color: '#667085', marginTop: 4, margin: '4px 0 0 0' }}>
            Monitor question extraction, review, and publishing status for uploaded examination papers.
          </p>
        </div>

        <button
          onClick={() => loadData()}
          disabled={isLoading}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            fontSize: 13,
            fontWeight: 500,
            borderRadius: 6,
            background: '#FFFFFF',
            color: '#172033',
            border: '1px solid #E4E7EC',
            cursor: isLoading ? 'not-allowed' : 'pointer',
          }}
          title="Refresh Pipeline Status"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} color="#667085" />
          <span>Refresh Status</span>
        </button>
      </div>

      {/* 2. Compact Search & Filter Controls */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          marginBottom: 20,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
          <Search
            size={15}
            style={{ position: 'absolute', left: 12, top: 12, color: '#667085' }}
          />
          <input
            type="text"
            placeholder="Search by exam name or code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 36px',
              borderRadius: 6,
              border: '1px solid #E4E7EC',
              backgroundColor: '#FFFFFF',
              fontSize: 13.5,
              color: '#172033',
              outline: 'none',
              height: 40,
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
            height: 40,
            boxSizing: 'border-box',
          }}
        >
          <option value="ALL">All Statuses</option>
          <option value="PENDING">Pending Human Review</option>
          <option value="PUBLISHED">Published</option>
          <option value="PROCESSING">Processing</option>
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
            height: 40,
            boxSizing: 'border-box',
          }}
        >
          <option value="ALL">All Stages</option>
          <option value="prelims">Prelims</option>
          <option value="mains">Mains</option>
        </select>
      </div>

      {/* 3. Pipeline Summary Block (Horizontal compact strip) */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #E4E7EC',
          borderRadius: 6,
          padding: '14px 20px',
          marginBottom: 24,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 16,
          boxShadow: '0 1px 2px rgba(16,24,40,0.02)',
        }}
      >
        <div style={{ paddingRight: 16, borderRight: '1px solid #E4E7EC' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#172033', lineHeight: 1.1 }}>{totalExams}</div>
          <div style={{ fontSize: 12, color: '#667085', marginTop: 2, fontWeight: 500 }}>Total Exams</div>
        </div>

        <div style={{ paddingRight: 16, borderRight: '1px solid #E4E7EC' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#3B6EA8', lineHeight: 1.1 }}>{processingCount}</div>
          <div style={{ fontSize: 12, color: '#667085', marginTop: 2, fontWeight: 500 }}>Processing</div>
        </div>

        <div style={{ paddingRight: 16, borderRight: '1px solid #E4E7EC' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#B45309', lineHeight: 1.1 }}>{pendingCount}</div>
          <div style={{ fontSize: 12, color: '#667085', marginTop: 2, fontWeight: 500 }}>Pending Review</div>
        </div>

        <div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#15803D', lineHeight: 1.1 }}>{publishedCount}</div>
          <div style={{ fontSize: 12, color: '#667085', marginTop: 2, fontWeight: 500 }}>Published</div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div
          style={{
            padding: '12px 16px',
            background: '#FEF2F2',
            border: '1px solid #FECDCA',
            borderRadius: 6,
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
            onClick={() => loadData()}
            style={{
              padding: '4px 10px',
              fontSize: 12,
              fontWeight: 600,
              color: '#B42318',
              background: '#FFFFFF',
              border: '1px solid #FECDCA',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* 4. Main Pipeline Table */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #E4E7EC',
          borderRadius: 6,
          boxShadow: '0 1px 2px rgba(16, 24, 40, 0.02)',
          overflow: 'hidden',
        }}
      >
        {isLoading ? (
          <div style={{ padding: '40px 24px', textAlign: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 600, margin: '0 auto' }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    height: 48,
                    background: '#F7F7F5',
                    borderRadius: 4,
                    animation: 'pulse 1.5s infinite ease-in-out',
                  }}
                />
              ))}
            </div>
          </div>
        ) : filteredExams.length === 0 ? (
          <div
            style={{
              padding: '48px 24px',
              textAlign: 'center',
              color: '#667085',
            }}
          >
            <FileSpreadsheet size={32} color="#667085" style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 14, fontWeight: 600, color: '#172033' }}>No exam papers found</div>
            <div style={{ fontSize: 13, color: '#667085', marginTop: 4 }}>
              Try adjusting your search query or status filter.
            </div>
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
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#667085', fontSize: 12 }}>EXAM PAPER</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#667085', fontSize: 12 }}>CODE</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#667085', fontSize: 12, width: 140 }}>PROGRESS</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#667085', fontSize: 12 }}>QUESTIONS</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#667085', fontSize: 12 }}>STATUS</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#667085', fontSize: 12 }}>S3 ARTIFACT</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#667085', fontSize: 12, textAlign: 'right' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {filteredExams.map((exam, i) => {
                  const total = exam.total_questions || 100;
                  const ext = exam.extracted_questions_count || 0;
                  const pct = Math.min(100, Math.round((ext / total) * 100));

                  return (
                    <tr
                      key={exam.id}
                      onClick={() => {
                        setSelectedExam(exam);
                        setIsDrawerOpen(true);
                      }}
                      style={{
                        borderBottom: i === filteredExams.length - 1 ? 'none' : '1px solid #E4E7EC',
                        cursor: 'pointer',
                        transition: 'background 0.12s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F7F7F5')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td style={{ padding: '14px 16px', fontWeight: 600, color: '#172033', maxWidth: 260 }}>
                        <div>{exam.name}</div>
                        <div style={{ fontSize: 11, color: '#667085', fontWeight: 400, marginTop: 2 }}>
                          {exam.source_year} • {exam.stage} • {exam.paper_set_code}
                        </div>
                      </td>

                      <td style={{ padding: '14px 16px', fontFamily: 'monospace', fontSize: 12, color: '#667085' }}>
                        {exam.code}
                      </td>

                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, color: '#172033', marginBottom: 4 }}>
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

                      <td style={{ padding: '14px 16px', color: '#172033', fontWeight: 500 }}>
                        {ext} / {total}
                      </td>

                      <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                        {getStatusBadge(exam.status)}
                      </td>

                      <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                        {getS3StatusBadge(exam)}
                      </td>

                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedExam(exam);
                            setIsDrawerOpen(true);
                          }}
                          style={{
                            padding: '4px 10px',
                            fontSize: 12.5,
                            fontWeight: 500,
                            color: '#172033',
                            background: '#FFFFFF',
                            border: '1px solid #E4E7EC',
                            borderRadius: 4,
                            cursor: 'pointer',
                          }}
                        >
                          View →
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

      {/* 5. Exam Detail Drawer Overlay */}
      {isDrawerOpen && selectedExam && (
        <>
          {/* Backdrop */}
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

          {/* Right Slide-over Drawer */}
          <div
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              width: 440,
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
                  EXAM DETAILS
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
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Drawer Body (Scrollable) */}
            <div style={{ flex: 1, padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Status Section */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: '#667085', fontWeight: 500 }}>Status</span>
                <div>{getStatusBadge(selectedExam.status)}</div>
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid #E4E7EC', margin: 0 }} />

              {/* Extraction Progress Section */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#667085', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                  EXTRACTION PROGRESS
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, fontWeight: 600, color: '#172033', marginBottom: 6 }}>
                  <span>{selectedExam.extracted_questions_count} / {selectedExam.total_questions || 100} questions</span>
                  <span>{Math.min(100, Math.round((selectedExam.extracted_questions_count / (selectedExam.total_questions || 100)) * 100))}%</span>
                </div>
                <div style={{ height: 6, background: '#F2F4F7', borderRadius: 3, overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.min(100, Math.round((selectedExam.extracted_questions_count / (selectedExam.total_questions || 100)) * 100))}%`,
                      background: '#3B6EA8',
                      borderRadius: 3,
                    }}
                  />
                </div>
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid #E4E7EC', margin: 0 }} />

              {/* Metadata Grid */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#667085', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
                  EXAM METADATA
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={{ background: '#F7F7F5', padding: 10, borderRadius: 4, border: '1px solid #E4E7EC' }}>
                    <div style={{ fontSize: 11, color: '#667085' }}>Year</div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: '#172033', marginTop: 2 }}>{selectedExam.source_year}</div>
                  </div>
                  <div style={{ background: '#F7F7F5', padding: 10, borderRadius: 4, border: '1px solid #E4E7EC' }}>
                    <div style={{ fontSize: 11, color: '#667085' }}>Stage</div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: '#172033', marginTop: 2 }}>{selectedExam.stage}</div>
                  </div>
                  <div style={{ background: '#F7F7F5', padding: 10, borderRadius: 4, border: '1px solid #E4E7EC' }}>
                    <div style={{ fontSize: 11, color: '#667085' }}>Subject Code</div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: '#172033', marginTop: 2 }}>{selectedExam.subject_code}</div>
                  </div>
                  <div style={{ background: '#F7F7F5', padding: 10, borderRadius: 4, border: '1px solid #E4E7EC' }}>
                    <div style={{ fontSize: 11, color: '#667085' }}>Paper Set Code</div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: '#172033', marginTop: 2 }}>{selectedExam.paper_set_code}</div>
                  </div>
                </div>
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid #E4E7EC', margin: 0 }} />

              {/* Question Counts */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#667085', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
                  QUESTION METRICS
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={{ background: '#F7F7F5', padding: 10, borderRadius: 4, border: '1px solid #E4E7EC' }}>
                    <div style={{ fontSize: 11, color: '#667085' }}>Extracted Questions</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#15803D', marginTop: 2 }}>
                      {selectedExam.extracted_questions_count} Questions
                    </div>
                  </div>
                  <div style={{ background: '#F7F7F5', padding: 10, borderRadius: 4, border: '1px solid #E4E7EC' }}>
                    <div style={{ fontSize: 11, color: '#667085' }}>Missing Questions</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: selectedExam.missing_questions_count > 0 ? '#B42318' : '#667085', marginTop: 2 }}>
                      {selectedExam.missing_questions_count} Missing
                    </div>
                  </div>
                </div>
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid #E4E7EC', margin: 0 }} />

              {/* S3 Artifact Technical Info */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#667085', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                  S3 ARTIFACT PATHS
                </div>
                <div style={{ fontSize: 12, color: '#667085', marginBottom: 6 }}>
                  Status: <strong style={{ color: selectedExam.questions_json_path ? '#15803D' : '#667085' }}>{selectedExam.questions_json_path ? 'Ready' : 'Not generated'}</strong>
                </div>

                {selectedExam.questions_json_path && (
                  <div style={{ background: '#F7F7F5', padding: 10, borderRadius: 4, border: '1px solid #E4E7EC', fontFamily: 'monospace', fontSize: 11, color: '#344054', wordBreak: 'break-all' }}>
                    <div>questions: {selectedExam.questions_json_path}</div>
                    {selectedExam.solutions_json_path && <div style={{ marginTop: 4 }}>solutions: {selectedExam.solutions_json_path}</div>}
                  </div>
                )}
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div style={{ padding: 20, borderTop: '1px solid #E4E7EC', backgroundColor: '#F7F7F5' }}>
              {selectedExam.status.toUpperCase().includes('PUBLISHED') && selectedExam.is_active ? (
                <div
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 6,
                    border: '1px solid #BBF7D0',
                    backgroundColor: '#DCFCE7',
                    color: '#15803D',
                    fontWeight: 600,
                    fontSize: 13.5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <Check size={16} /> ✓ Published & Active (S3 Ready)
                </div>
              ) : (selectedExam.status.toUpperCase().includes('PUBLISHED') && !selectedExam.is_active) || approvingId === selectedExam.id ? (
                <button
                  disabled
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    borderRadius: 6,
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#94A3B8',
                    color: '#FFFFFF',
                    fontWeight: 600,
                    fontSize: 13.5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    cursor: 'not-allowed',
                  }}
                >
                  <Loader2 size={16} className="animate-spin" />
                  <span>Published (Uploading S3 Artifacts...)</span>
                </button>
              ) : (
                <button
                  onClick={() => handleApprove(selectedExam.id, selectedExam.name)}
                  disabled={approvingId === selectedExam.id || selectedExam.extracted_questions_count === 0}
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    borderRadius: 6,
                    border: 'none',
                    backgroundColor: selectedExam.extracted_questions_count === 0 ? '#94A3B8' : '#12233F',
                    color: '#FFFFFF',
                    fontWeight: 600,
                    fontSize: 13.5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    cursor: selectedExam.extracted_questions_count === 0 ? 'not-allowed' : 'pointer',
                    boxShadow: '0 1px 2px rgba(16,24,40,0.05)',
                  }}
                >
                  <span>Approve & Build S3 JSON</span>
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

