import React, { useEffect, useState } from 'react';
import {
  fetchExamPipelineStatuses,
  approveAndPublishExam,
  ExamPipelineStatusItem,
} from '../../../services/adminService';
import {
  CheckCircle2,
  Clock,
  FileCheck2,
  RefreshCw,
  Search,
  AlertTriangle,
  FileText,
  UploadCloud,
  Check,
  Loader2,
  Database,
} from 'lucide-react';

export function ExamPipelineStatusView() {
  const [exams, setExams] = useState<ExamPipelineStatusItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchExamPipelineStatuses();
      setExams(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load exam pipeline statuses.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApprove = async (examId: string, examName: string) => {
    setApprovingId(examId);
    try {
      const result = await approveAndPublishExam(examId);
      setToastMessage(`✅ Successfully approved & published '${examName}'. S3 JSON folders created!`);
      setTimeout(() => setToastMessage(null), 5000);
      await loadData();
    } catch (err: any) {
      alert(`Error approving exam: ${err.message}`);
    } finally {
      setApprovingId(null);
    }
  };

  const filteredExams = exams.filter((e) => {
    const matchesSearch =
      e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === 'ALL' || e.status.toUpperCase() === statusFilter.toUpperCase();
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (statusStr: string) => {
    const s = statusStr.toUpperCase();
    if (s.includes('PUBLISHED') || s.includes('READY')) {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 700,
            backgroundColor: '#dcfce7',
            color: '#15803d',
            border: '1px solid #bbf7d0',
          }}
        >
          <CheckCircle2 size={14} /> PUBLISHED
        </span>
      );
    }
    if (s.includes('PENDING')) {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 700,
            backgroundColor: '#fef3c7',
            color: '#b45309',
            border: '1px solid #fde68a',
          }}
        >
          <Clock size={14} /> PENDING HUMAN REVIEW
        </span>
      );
    }
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          borderRadius: 20,
          fontSize: 12,
          fontWeight: 700,
          backgroundColor: '#e0f2fe',
          color: '#0369a1',
          border: '1px solid #bae6fd',
        }}
      >
        <FileCheck2 size={14} /> {statusStr}
      </span>
    );
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            marginBottom: 20,
            padding: '12px 20px',
            borderRadius: 12,
            backgroundColor: '#10b981',
            color: '#ffffff',
            fontWeight: 600,
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 12px rgba(16,185,129,0.3)',
          }}
        >
          <span>{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 28,
        }}
      >
        <div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '4px 12px',
              backgroundColor: '#eff6ff',
              borderRadius: 20,
              color: '#2563eb',
              fontSize: 12,
              fontWeight: 700,
              marginBottom: 8,
            }}
          >
            <Database size={14} /> EXAM PIPELINE MANAGEMENT
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1e293b', margin: 0 }}>
            Exam Extraction & S3 Pipeline Status
          </h1>
          <p style={{ fontSize: 14, color: '#64748b', margin: '4px 0 0 0' }}>
            Monitor database question extraction progress, S3 JSON artifact generation, and admin approvals.
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={isLoading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 16px',
            backgroundColor: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 600,
            color: '#334155',
            cursor: 'pointer',
          }}
        >
          <RefreshCw size={16} className={isLoading ? 'spin' : ''} /> Refresh Status
        </button>
      </div>

      {/* Search & Filters */}
      <div
        style={{
          display: 'flex',
          gap: 16,
          marginBottom: 24,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
          <Search
            size={18}
            style={{ position: 'absolute', left: 14, top: 12, color: '#94a3b8' }}
          />
          <input
            type="text"
            placeholder="Search by exam name or code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 16px 10px 42px',
              borderRadius: 10,
              border: '1px solid #cbd5e1',
              fontSize: 14,
              outline: 'none',
            }}
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            padding: '10px 16px',
            borderRadius: 10,
            border: '1px solid #cbd5e1',
            fontSize: 14,
            fontWeight: 600,
            color: '#334155',
            backgroundColor: '#ffffff',
            outline: 'none',
          }}
        >
          <option value="ALL">All Statuses</option>
          <option value="PENDING_HUMAN_REVIEW">Pending Human Review</option>
          <option value="PUBLISHED">Published & Active</option>
        </select>
      </div>

      {/* Main Grid Content */}
      {isLoading ? (
        <div
          style={{
            padding: 60,
            textAlign: 'center',
            color: '#64748b',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <Loader2 size={32} color="#2563eb" style={{ animation: 'spin 1s linear infinite' }} />
          <span>Loading exam pipeline statuses from backend database...</span>
        </div>
      ) : error ? (
        <div
          style={{
            padding: 24,
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 12,
            color: '#991b1b',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <AlertTriangle size={20} />
          <span>{error}</span>
        </div>
      ) : filteredExams.length === 0 ? (
        <div
          style={{
            padding: 48,
            textAlign: 'center',
            backgroundColor: '#f8fafc',
            borderRadius: 16,
            border: '1px border-dashed #cbd5e1',
            color: '#64748b',
          }}
        >
          <FileText size={40} style={{ marginBottom: 12, opacity: 0.5 }} />
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>No Exams Found</h3>
          <p style={{ fontSize: 14, margin: '4px 0 0 0' }}>
            No exams matched your filter criteria or no exams are registered yet.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 20 }}>
          {filteredExams.map((exam) => {
            const pct = Math.min(
              100,
              Math.round((exam.extracted_questions_count / (exam.total_questions || 100)) * 100)
            );
            const isApproved =
              exam.status.toUpperCase().includes('PUBLISHED') ||
              exam.status.toUpperCase().includes('READY');

            return (
              <div
                key={exam.id}
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: 16,
                  border: '1px solid #e2e8f0',
                  padding: 24,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  {/* Top Bar */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: 12,
                      gap: 12,
                    }}
                  >
                    <div>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: '#64748b',
                          fontFamily: 'monospace',
                          textTransform: 'uppercase',
                        }}
                      >
                        CODE: {exam.code}
                      </span>
                      <h3
                        style={{
                          fontSize: 16,
                          fontWeight: 700,
                          color: '#0f172a',
                          margin: '4px 0 0 0',
                          lineHeight: 1.3,
                        }}
                      >
                        {exam.name}
                      </h3>
                    </div>
                    {getStatusBadge(exam.status)}
                  </div>

                  {/* Extraction Progress */}
                  <div style={{ marginTop: 16, marginBottom: 16 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 13,
                        fontWeight: 600,
                        color: '#475569',
                        marginBottom: 6,
                      }}
                    >
                      <span>Question Extraction Progress</span>
                      <span>
                        {exam.extracted_questions_count} / {exam.total_questions || 100} Questions ({pct}%)
                      </span>
                    </div>
                    <div
                      style={{
                        height: 8,
                        backgroundColor: '#e2e8f0',
                        borderRadius: 4,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${pct}%`,
                          height: '100%',
                          backgroundColor: pct === 100 ? '#10b981' : pct > 0 ? '#2563eb' : '#94a3b8',
                          transition: 'width 0.4s ease',
                        }}
                      />
                    </div>
                  </div>

                  {/* Metadata Chips */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 10,
                      backgroundColor: '#f8fafc',
                      padding: 12,
                      borderRadius: 10,
                      fontSize: 13,
                      marginBottom: 16,
                    }}
                  >
                    <div>
                      <span style={{ color: '#64748b', fontSize: 11, display: 'block' }}>Year & Stage</span>
                      <strong style={{ color: '#334155' }}>
                        {exam.source_year || 'N/A'} ({exam.stage || 'Prelims'})
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', fontSize: 11, display: 'block' }}>Paper Set Code</span>
                      <strong style={{ color: '#334155' }}>{exam.paper_set_code || 'SET_A'}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', fontSize: 11, display: 'block' }}>Extracted Count</span>
                      <strong style={{ color: '#16a34a' }}>{exam.extracted_questions_count} Questions</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', fontSize: 11, display: 'block' }}>Missing Count</span>
                      <strong style={{ color: exam.missing_questions_count > 0 ? '#dc2626' : '#64748b' }}>
                        {exam.missing_questions_count} Missing
                      </strong>
                    </div>
                  </div>

                  {/* S3 Artifact Details */}
                  <div
                    style={{
                      borderTop: '1px border-dashed #e2e8f0',
                      paddingTop: 12,
                      marginBottom: 20,
                      fontSize: 12,
                    }}
                  >
                    <div style={{ fontWeight: 600, color: '#475569', marginBottom: 4 }}>S3 JSON Artifact Status:</div>
                    {exam.questions_json_path ? (
                      <div style={{ color: '#059669', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'monospace' }}>
                        <Check size={14} /> {exam.questions_json_path}
                      </div>
                    ) : (
                      <div style={{ color: '#94a3b8', fontStyle: 'italic' }}>
                        Not generated yet (Generated automatically on Admin Approval)
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div>
                  {isApproved ? (
                    <button
                      disabled
                      style={{
                        width: '100%',
                        padding: '12px',
                        borderRadius: 10,
                        border: '1px solid #bbf7d0',
                        backgroundColor: '#f0fdf4',
                        color: '#166534',
                        fontWeight: 700,
                        fontSize: 14,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        cursor: 'default',
                      }}
                    >
                      <Check size={18} /> Published & S3 JSONs Ready
                    </button>
                  ) : (
                    <button
                      onClick={() => handleApprove(exam.id, exam.name)}
                      disabled={approvingId === exam.id || exam.extracted_questions_count === 0}
                      style={{
                        width: '100%',
                        padding: '12px',
                        borderRadius: 10,
                        border: 'none',
                        backgroundColor: exam.extracted_questions_count === 0 ? '#94a3b8' : '#2563eb',
                        color: '#ffffff',
                        fontWeight: 700,
                        fontSize: 14,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        cursor: exam.extracted_questions_count === 0 ? 'not-allowed' : 'pointer',
                        boxShadow: exam.extracted_questions_count === 0 ? 'none' : '0 4px 12px rgba(37,99,235,0.25)',
                      }}
                    >
                      {approvingId === exam.id ? (
                        <>
                          <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                          <span>Generating S3 JSONs & Publishing...</span>
                        </>
                      ) : (
                        <>
                          <UploadCloud size={18} />
                          <span>Approve & Build S3 JSON Folders</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
