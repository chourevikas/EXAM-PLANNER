import React, { useEffect, useState } from 'react';
import {
  Upload,
  RefreshCw,
  AlertCircle,
  FileSpreadsheet,
  ArrowRight,
} from 'lucide-react';
import {
  fetchAdminOverviewStats,
  AdminOverviewStats,
} from '../../services/adminService';

interface AdminOverviewViewProps {
  onNavigate: (view: string) => void;
}

export function AdminOverviewView({ onNavigate }: AdminOverviewViewProps) {
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

  return (
    <div style={{ maxWidth: 1320, margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      {/* 1. Page Header (Directly on main background, minimal institutional design) */}
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
              fontSize: 28,
              fontWeight: 700,
              color: '#172033',
              margin: 0,
              letterSpacing: '-0.02em',
            }}
          >
            Dashboard Overview
          </h1>
          <p style={{ fontSize: 14, color: '#667085', marginTop: 4, margin: '4px 0 0 0' }}>
            Monitor exam papers, question extraction, review activity, and question-bank processing.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            onClick={loadOverviewStats}
            disabled={loading}
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
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s ease',
            }}
            title="Refresh Database Statistics"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} color="#667085" />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => onNavigate('upload')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              fontSize: 13.5,
              fontWeight: 600,
              borderRadius: 6,
              background: '#12233F',
              color: '#FFFFFF',
              border: '1px solid #12233F',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(16, 24, 40, 0.05)',
              transition: 'background 0.15s ease',
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
            onClick={loadOverviewStats}
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

      {/* 2. KPI / Summary Section (Clean horizontal institutional metric tiles) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
          marginBottom: 24,
        }}
      >
        {loading && !stats
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E4E7EC',
                  borderRadius: 6,
                  padding: '20px 24px',
                  height: 100,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  opacity: 0.6,
                }}
              >
                <div style={{ height: 28, width: 80, background: '#F2F4F7', borderRadius: 4 }} />
                <div style={{ height: 16, width: 140, background: '#F2F4F7', borderRadius: 4 }} />
              </div>
            ))
          : stats?.metrics.map((m, i) => {
              // Custom title override to strictly enforce "Extraction Accuracy" as requested
              const displayTitle = m.title.replace('AI Extraction Accuracy', 'Extraction Accuracy').replace('AI ', '');
              return (
                <div
                  key={i}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #E4E7EC',
                    borderRadius: 6,
                    padding: '20px 24px',
                    boxShadow: '0 1px 2px rgba(16, 24, 40, 0.02)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 30,
                        fontWeight: 700,
                        color: '#172033',
                        letterSpacing: '-0.02em',
                        lineHeight: 1.1,
                      }}
                    >
                      {m.value}
                    </div>
                    <div
                      style={{
                        fontSize: 13.5,
                        fontWeight: 600,
                        color: '#172033',
                        marginTop: 6,
                      }}
                    >
                      {displayTitle}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 12.5,
                      color: '#667085',
                      marginTop: 8,
                    }}
                  >
                    {m.badge}
                  </div>
                </div>
              );
            })}
      </div>

      {/* 3. Lower Grid: Data Table (Left) & Question Distribution (Right) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24 }}>
        
        {/* Left Column: Recent Exam Paper Uploads Table */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E4E7EC',
            borderRadius: 6,
            padding: 24,
            boxShadow: '0 1px 2px rgba(16, 24, 40, 0.02)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 18,
            }}
          >
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: '#172033', margin: 0 }}>
                Recent Exam Paper Uploads
              </h2>
              <p style={{ fontSize: 13, color: '#667085', marginTop: 2, margin: '2px 0 0 0' }}>
                Latest question papers processed through the extraction pipeline.
              </p>
            </div>
            <button
              onClick={() => onNavigate('pipeline-status')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                background: 'transparent',
                border: 'none',
                color: '#3B6EA8',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                padding: '4px 8px',
              }}
            >
              <span>View All</span>
              <ArrowRight size={14} />
            </button>
          </div>

          {/* Data Table */}
          {loading && !stats ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#667085', fontSize: 13.5 }}>
              Loading recent uploads...
            </div>
          ) : !stats?.recent_uploads || stats.recent_uploads.length === 0 ? (
            <div
              style={{
                padding: '36px 20px',
                textAlign: 'center',
                background: '#F7F7F5',
                borderRadius: 4,
                border: '1px solid #E4E7EC',
              }}
            >
              <FileSpreadsheet size={28} color="#667085" style={{ marginBottom: 8 }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: '#172033' }}>No exam papers uploaded</div>
              <div style={{ fontSize: 13, color: '#667085', marginTop: 2 }}>
                Uploaded PDFs will appear here in the live administrative log.
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
                    <th style={{ padding: '10px 12px', fontWeight: 600, color: '#667085', fontSize: 12 }}>EXAM PAPER</th>
                    <th style={{ padding: '10px 12px', fontWeight: 600, color: '#667085', fontSize: 12 }}>QUESTIONS</th>
                    <th style={{ padding: '10px 12px', fontWeight: 600, color: '#667085', fontSize: 12 }}>UPLOADED</th>
                    <th style={{ padding: '10px 12px', fontWeight: 600, color: '#667085', fontSize: 12 }}>STATUS / CONFIDENCE</th>
                    <th style={{ padding: '10px 12px', fontWeight: 600, color: '#667085', fontSize: 12, textAlign: 'right' }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recent_uploads.map((paper, i) => (
                    <tr
                      key={paper.id || i}
                      style={{
                        borderBottom: i === stats.recent_uploads.length - 1 ? 'none' : '1px solid #E4E7EC',
                      }}
                    >
                      <td style={{ padding: '14px 12px', fontWeight: 600, color: '#172033', maxWidth: 280 }}>
                        {paper.title}
                      </td>
                      <td style={{ padding: '14px 12px', color: '#172033' }}>
                        {paper.questions}
                      </td>
                      <td style={{ padding: '14px 12px', color: '#667085', whiteSpace: 'nowrap' }}>
                        {paper.date}
                      </td>
                      <td style={{ padding: '14px 12px', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: 12.5, fontWeight: 500, color: '#172033' }}>
                          {paper.confidence}% confidence
                        </span>
                      </td>
                      <td style={{ padding: '14px 12px', textAlign: 'right' }}>
                        <button
                          onClick={() => onNavigate('upload')}
                          style={{
                            padding: '5px 12px',
                            fontSize: 12.5,
                            fontWeight: 500,
                            color: '#172033',
                            background: '#FFFFFF',
                            border: '1px solid #E4E7EC',
                            borderRadius: 4,
                            cursor: 'pointer',
                            transition: 'background 0.15s ease',
                          }}
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Column: Question Distribution (Restrained single muted blue accent bars) */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E4E7EC',
            borderRadius: 6,
            padding: 24,
            boxShadow: '0 1px 2px rgba(16, 24, 40, 0.02)',
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#172033', margin: '0 0 2px 0' }}>
            Question Distribution
          </h2>
          <p style={{ fontSize: 13, color: '#667085', marginBottom: 20, margin: '2px 0 20px 0' }}>
            Extracted question breakdown by subject category.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {loading && !stats ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#667085', fontSize: 13 }}>
                Loading distribution...
              </div>
            ) : !stats?.subject_breakdown || stats.subject_breakdown.length === 0 ? (
              <div style={{ fontSize: 13, color: '#667085', textAlign: 'center', padding: '20px' }}>
                No subject distribution data found.
              </div>
            ) : (
              stats.subject_breakdown.map((item, i) => (
                <div key={i}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 13,
                      fontWeight: 500,
                      color: '#172033',
                      marginBottom: 6,
                    }}
                  >
                    <span>{item.subject}</span>
                    <span style={{ color: '#667085' }}>
                      {item.count} · {item.percent}%
                    </span>
                  </div>
                  <div
                    style={{
                      height: 5,
                      background: '#F2F4F7',
                      borderRadius: 2,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${Math.min(100, item.percent)}%`,
                        background: '#3B6EA8',
                        borderRadius: 2,
                        transition: 'width 0.4s ease',
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
