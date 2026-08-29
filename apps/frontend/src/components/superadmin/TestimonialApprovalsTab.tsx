import React, { useState } from 'react';
import { TestimonialItem } from '../../services/testimonialService';
import { Search, RefreshCw, CheckCircle, XCircle, Trash2, Star, MessageSquare, Clock } from 'lucide-react';

interface TestimonialApprovalsTabProps {
  testimonials: TestimonialItem[];
  loading: boolean;
  processingId: string | null;
  onApprove: (id: string, name: string) => void;
  onReject: (id: string, name: string) => void;
  onDelete: (id: string, name: string) => void;
  onRefresh: () => void;
}

export function TestimonialApprovalsTab({
  testimonials,
  loading,
  processingId,
  onApprove,
  onReject,
  onDelete,
  onRefresh,
}: TestimonialApprovalsTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');

  const filtered = testimonials.filter((t) => {
    const matchesSearch =
      t.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.user_exam.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.quote.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const pendingCount = testimonials.filter((t) => t.status === 'PENDING').length;
  const approvedCount = testimonials.filter((t) => t.status === 'APPROVED').length;
  const rejectedCount = testimonials.filter((t) => t.status === 'REJECTED').length;

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: 22,
        padding: 32,
        boxShadow: '0 12px 36px -10px rgba(15, 29, 56, 0.08)',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)', margin: 0, letterSpacing: '-0.02em' }}>
              Student Testimonials Approval Control
            </h2>
            {pendingCount > 0 && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  padding: '3px 10px',
                  borderRadius: 99,
                  background: 'rgba(249, 115, 22, 0.12)',
                  color: '#f97316',
                  border: '1px solid rgba(249, 115, 22, 0.25)',
                }}
              >
                {pendingCount} Pending Review
              </span>
            )}
          </div>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Moderate aspirant stories before they are published live on the public home page.
          </p>
        </div>

        <button
          onClick={onRefresh}
          style={{
            padding: '9px 18px',
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 10,
            border: '1px solid var(--border-color)',
            background: 'var(--bg-body)',
            color: 'var(--text-main)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.15s ease',
          }}
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          <span>Refresh Stories</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
        <button
          onClick={() => setStatusFilter('ALL')}
          style={{
            padding: '8px 16px',
            borderRadius: 10,
            fontSize: 12.5,
            fontWeight: 700,
            cursor: 'pointer',
            background: statusFilter === 'ALL' ? 'var(--text-main)' : 'var(--bg-body)',
            color: statusFilter === 'ALL' ? 'var(--bg-card)' : 'var(--text-main)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <MessageSquare size={14} />
          <span>All Stories ({testimonials.length})</span>
        </button>

        <button
          onClick={() => setStatusFilter('PENDING')}
          style={{
            padding: '8px 16px',
            borderRadius: 10,
            fontSize: 12.5,
            fontWeight: 700,
            cursor: 'pointer',
            background: statusFilter === 'PENDING' ? 'rgba(249, 115, 22, 0.2)' : 'var(--bg-body)',
            color: statusFilter === 'PENDING' ? '#ea580c' : 'var(--text-main)',
            border: `1px solid ${statusFilter === 'PENDING' ? '#ea580c' : 'var(--border-color)'}`,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Clock size={14} />
          <span>Pending ({pendingCount})</span>
        </button>

        <button
          onClick={() => setStatusFilter('APPROVED')}
          style={{
            padding: '8px 16px',
            borderRadius: 10,
            fontSize: 12.5,
            fontWeight: 700,
            cursor: 'pointer',
            background: statusFilter === 'APPROVED' ? 'rgba(16, 185, 129, 0.2)' : 'var(--bg-body)',
            color: statusFilter === 'APPROVED' ? '#059669' : 'var(--text-main)',
            border: `1px solid ${statusFilter === 'APPROVED' ? '#059669' : 'var(--border-color)'}`,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <CheckCircle size={14} />
          <span>Approved ({approvedCount})</span>
        </button>

        <button
          onClick={() => setStatusFilter('REJECTED')}
          style={{
            padding: '8px 16px',
            borderRadius: 10,
            fontSize: 12.5,
            fontWeight: 700,
            cursor: 'pointer',
            background: statusFilter === 'REJECTED' ? 'rgba(239, 68, 68, 0.2)' : 'var(--bg-body)',
            color: statusFilter === 'REJECTED' ? '#dc2626' : 'var(--text-main)',
            border: `1px solid ${statusFilter === 'REJECTED' ? '#dc2626' : 'var(--border-color)'}`,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <XCircle size={14} />
          <span>Rejected ({rejectedCount})</span>
        </button>
      </div>

      {/* Search Filter */}
      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'var(--bg-body)',
            border: '1px solid var(--border-color)',
            borderRadius: 12,
            padding: '10px 16px',
            maxWidth: 400,
          }}
        >
          <Search size={15} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Search by student name, exam, or quote content..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              border: 'none',
              background: 'transparent',
              outline: 'none',
              fontSize: 13.5,
              color: 'var(--text-main)',
              fontFamily: 'Inter, sans-serif',
              width: '100%',
            }}
          />
        </div>
      </div>

      {/* List / Table Content */}
      {loading ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
          Loading testimonials...
        </div>
      ) : filtered.length === 0 ? (
        <div
          style={{
            padding: '48px 24px',
            textAlign: 'center',
            background: 'var(--bg-body)',
            borderRadius: 18,
            border: '1px solid var(--border-color)',
          }}
        >
          <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
            No testimonials match your filter or search criteria.
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 20 }}>
          {filtered.map((t) => {
            const isProcessing = processingId === t.id;
            const isPending = t.status === 'PENDING';
            const isApproved = t.status === 'APPROVED';
            const isRejected = t.status === 'REJECTED';

            return (
              <div
                key={t.id}
                style={{
                  background: 'var(--bg-body)',
                  border: `1px solid ${
                    isPending
                      ? 'rgba(249, 115, 22, 0.35)'
                      : isApproved
                      ? 'rgba(16, 185, 129, 0.35)'
                      : 'rgba(239, 68, 68, 0.35)'
                  }`,
                  borderRadius: 18,
                  padding: 24,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  position: 'relative',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
                }}
              >
                <div>
                  {/* Status Badge & Rating Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div style={{ display: 'flex', gap: 2 }}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          size={15}
                          fill={i < t.rating ? '#f59e0b' : 'transparent'}
                          color={i < t.rating ? '#f59e0b' : 'var(--text-muted)'}
                        />
                      ))}
                    </div>

                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        padding: '4px 10px',
                        borderRadius: 99,
                        color: isPending ? '#ea580c' : isApproved ? '#059669' : '#dc2626',
                        background: isPending
                          ? 'rgba(249, 115, 22, 0.12)'
                          : isApproved
                          ? 'rgba(16, 185, 129, 0.12)'
                          : 'rgba(239, 68, 68, 0.12)',
                        border: `1px solid ${
                          isPending
                            ? 'rgba(249, 115, 22, 0.25)'
                            : isApproved
                            ? 'rgba(16, 185, 129, 0.25)'
                            : 'rgba(239, 68, 68, 0.25)'
                        }`,
                      }}
                    >
                      {t.status}
                    </span>
                  </div>

                  {/* Quote Content */}
                  <p
                    style={{
                      fontSize: 14,
                      color: 'var(--text-main)',
                      lineHeight: 1.6,
                      fontStyle: 'italic',
                      marginBottom: 20,
                    }}
                  >
                    "{t.quote}"
                  </p>

                  {t.rejection_reason && (
                    <div
                      style={{
                        fontSize: 12,
                        color: '#ef4444',
                        background: 'rgba(239, 68, 68, 0.08)',
                        padding: '8px 12px',
                        borderRadius: 8,
                        marginBottom: 16,
                      }}
                    >
                      <strong>Rejection Reason:</strong> {t.rejection_reason}
                    </div>
                  )}
                </div>

                <div>
                  {/* Author Meta */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      paddingTop: 14,
                      borderTop: '1px solid var(--border-color)',
                      marginBottom: 16,
                    }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: 14,
                        flexShrink: 0,
                      }}
                    >
                      {t.user_name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-main)' }}>{t.user_name}</div>
                      <div style={{ fontSize: 12, color: '#2563eb', fontWeight: 600 }}>{t.user_exam}</div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    {!isApproved && (
                      <button
                        onClick={() => onApprove(t.id, t.user_name)}
                        disabled={isProcessing}
                        style={{
                          padding: '7px 14px',
                          fontSize: 12.5,
                          fontWeight: 700,
                          borderRadius: 8,
                          border: 'none',
                          background: '#10b981',
                          color: '#ffffff',
                          cursor: isProcessing ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <CheckCircle size={14} />
                        <span>Approve</span>
                      </button>
                    )}

                    {!isRejected && (
                      <button
                        onClick={() => onReject(t.id, t.user_name)}
                        disabled={isProcessing}
                        style={{
                          padding: '7px 14px',
                          fontSize: 12.5,
                          fontWeight: 700,
                          borderRadius: 8,
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          background: 'rgba(239, 68, 68, 0.1)',
                          color: '#ef4444',
                          cursor: isProcessing ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <XCircle size={14} />
                        <span>Reject</span>
                      </button>
                    )}

                    <button
                      onClick={() => onDelete(t.id, t.user_name)}
                      disabled={isProcessing}
                      title="Delete Testimonial"
                      style={{
                        padding: '7px 10px',
                        fontSize: 12.5,
                        borderRadius: 8,
                        border: '1px solid var(--border-color)',
                        background: 'transparent',
                        color: 'var(--text-muted)',
                        cursor: isProcessing ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
