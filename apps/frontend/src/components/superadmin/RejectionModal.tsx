import React, { useState } from 'react';

interface RejectionModalProps {
  isOpen: boolean;
  adminName: string;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

export function RejectionModal({ isOpen, adminName, onClose, onConfirm }: RejectionModalProps) {
  const [reason, setReason] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(reason);
    setReason('');
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-modal)',
          border: '1px solid var(--border-color)',
          borderRadius: 24,
          padding: 32,
          maxWidth: 440,
          width: '100%',
          boxShadow: 'var(--shadow-lg)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-main)', marginBottom: 8 }}>
          Reject Admin Application
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 20 }}>
          Please specify a reason for rejecting <strong>{adminName}</strong>.
        </p>

        <form onSubmit={handleSubmit}>
          <textarea
            required
            rows={4}
            placeholder="Provide rejection rationale (e.g. Invalid organization proof, incomplete contact info)..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: 12,
              border: '1px solid var(--border-color)',
              background: 'var(--bg-body)',
              color: 'var(--text-main)',
              fontSize: 14,
              outline: 'none',
              resize: 'vertical',
              marginBottom: 20,
            }}
          />

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-ghost"
              style={{ padding: '10px 18px', fontSize: 14 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ padding: '10px 20px', fontSize: 14, background: '#EF4444', borderColor: '#EF4444' }}
            >
              Confirm Rejection
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
