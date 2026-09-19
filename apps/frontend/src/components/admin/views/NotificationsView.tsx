import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell,
  Plus,
  Edit2,
  Trash2,
  Send,
  X,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  Video,
  Globe,
  Package,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
} from 'lucide-react';
import { Spinner } from '../../../components/common/Spinner';
import {
  adminListNotifications,
  adminCreateNotification,
  adminUpdateNotification,
  adminPublishNotification,
  adminRejectNotification,
  adminDeleteNotification,
  type BroadcastNotification,
  type CreateNotificationPayload,
  type UpdateNotificationPayload,
} from '../../../services/notificationService';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CONTENT_TYPES = [
  { value: 'video', label: 'Video', icon: Video, color: '#DC2626' },
  { value: 'pdf', label: 'PDF', icon: FileText, color: 'var(--accent-primary)' },
  { value: 'article', label: 'Article', icon: Globe, color: '#059669' },
  { value: 'other', label: 'Other', icon: Package, color: '#7C3AED' },
] as const;

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  draft:     { bg: '#FEF9C3', text: '#A16207', border: '#FDE047' },
  published: { bg: 'var(--status-success-bg)', text: '#15803D', border: '#86EFAC' },
  rejected:  { bg: 'var(--primary-red-bg)', text: '#B91C1C', border: 'var(--primary-red-border)' },
};

function statusBadge(status: string) {
  const s = status.toLowerCase();
  const c = STATUS_COLORS[s] || { bg: 'var(--bg-hover)', text: 'var(--text-secondary)', border: 'var(--border-color)' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
      backgroundColor: c.bg, color: c.text, border: `1px solid ${c.border}`,
    }}>
      {s.charAt(0).toUpperCase() + s.slice(1)}
    </span>
  );
}

function contentTypeIcon(ct: string) {
  const found = CONTENT_TYPES.find(t => t.value === ct.toLowerCase());
  if (!found) return <Package size={14} />;
  const Icon = found.icon;
  return <Icon size={14} color={found.color} />;
}

function formatDate(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

// ─── Toast ───────────────────────────────────────────────────────────────────

interface ToastMsg { text: string; type: 'success' | 'error' }

function Toast({ msg, onDismiss }: { msg: ToastMsg; onDismiss: () => void }) {
  const isSuccess = msg.type === 'success';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '12px 16px', borderRadius: 8,
      backgroundColor: isSuccess ? '#F0FDF4' : '#FEF2F2',
      border: `1px solid ${isSuccess ? '#86EFAC' : '#FECACA'}`,
      color: isSuccess ? '#15803D' : '#B91C1C',
      fontWeight: 500, fontSize: 14, marginBottom: 20,
      boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
    }}>
      {isSuccess ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
      <span style={{ flex: 1 }}>{msg.text}</span>
      <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}>
        <X size={14} />
      </button>
    </div>
  );
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────

function ConfirmDialog({
  message,
  onConfirm,
  onCancel,
  confirmLabel = 'Confirm',
  danger = false,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  danger?: boolean;
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 16,
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, padding: '28px 32px',
        maxWidth: 420, width: '100%', boxShadow: '0 10px 40px rgba(0,0,0,0.18)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20 }}>
          <AlertTriangle size={22} color={danger ? '#DC2626' : 'var(--status-warning)'} style={{ flexShrink: 0, marginTop: 2 }} />
          <p style={{ margin: 0, fontSize: 15, color: '#374151', lineHeight: 1.55 }}>{message}</p>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{ padding: '8px 18px', borderRadius: 6, border: '1px solid #D1D5DB', background: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer', color: '#374151' }}>
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{ padding: '8px 18px', borderRadius: 6, border: 'none', background: danger ? '#DC2626' : 'var(--primary-red)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Form Modal ───────────────────────────────────────────────────────────────

interface FormModalProps {
  mode: 'create' | 'edit';
  initial?: BroadcastNotification | null;
  onSave: (payload: CreateNotificationPayload | UpdateNotificationPayload) => Promise<void>;
  onClose: () => void;
  saving: boolean;
}

function FormModal({ mode, initial, onSave, onClose, saving }: FormModalProps) {
  const [title, setTitle] = useState(initial?.title || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [contentType, setContentType] = useState(initial?.contentType || 'other');
  const [link, setLink] = useState(initial?.link || '');
  const [attachment, setAttachment] = useState(initial?.attachment || '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = 'Title is required.';
    if (!link.trim() && !attachment.trim()) {
      e.link = 'Provide at least one of Link or Attachment URL.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    await onSave({ title: title.trim(), description: description.trim() || undefined, contentType, link: link.trim() || undefined, attachment: attachment.trim() || undefined });
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: 6, fontSize: 14,
    fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: '24px 20px', maxWidth: 'min(560px, calc(100vw - 24px))', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 16px 50px rgba(0,0,0,0.2)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827', fontFamily: 'Inter, sans-serif' }}>
            {mode === 'create' ? 'Create Notification' : 'Edit Notification'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Title */}
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: '#374151' }}>Title <span style={{ color: '#DC2626' }}>*</span></label>
            <input
              id="notif-title"
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. New Study Material Released"
              style={{ ...inputStyle, border: errors.title ? '1px solid #FCA5A5' : '1px solid #D1D5DB' }}
            />
            {errors.title && <p style={{ margin: '4px 0 0', fontSize: 12, color: '#DC2626' }}>{errors.title}</p>}
          </div>

          {/* Description */}
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: '#374151' }}>Description <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(optional)</span></label>
            <textarea
              id="notif-description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              placeholder="Brief summary of the announcement..."
              style={{ ...inputStyle, border: '1px solid #D1D5DB', resize: 'vertical', lineHeight: 1.5 }}
            />
          </div>

          {/* Content Type */}
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600, color: '#374151' }}>Content Type</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {CONTENT_TYPES.map(ct => {
                const Icon = ct.icon;
                const isSelected = contentType === ct.value;
                return (
                  <button
                    key={ct.value}
                    type="button"
                    onClick={() => setContentType(ct.value)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '7px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500,
                      border: isSelected ? `2px solid ${ct.color}` : '2px solid #E5E7EB',
                      background: isSelected ? `${ct.color}12` : '#F9FAFB',
                      color: isSelected ? ct.color : '#6B7280',
                      transition: 'all 0.15s',
                    }}>
                    <Icon size={14} />
                    {ct.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Link */}
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: '#374151' }}>
              Link URL <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(YouTube, article, PDF URL, etc.)</span>
            </label>
            <input
              id="notif-link"
              type="url"
              value={link}
              onChange={e => setLink(e.target.value)}
              placeholder="https://..."
              style={{ ...inputStyle, border: errors.link ? '1px solid #FCA5A5' : '1px solid #D1D5DB' }}
            />
            {errors.link && <p style={{ margin: '4px 0 0', fontSize: 12, color: '#DC2626' }}>{errors.link}</p>}
          </div>

          {/* Attachment */}
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: '#374151' }}>
              Attachment URL <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(or uploaded file path)</span>
            </label>
            <input
              id="notif-attachment"
              type="text"
              value={attachment}
              onChange={e => setAttachment(e.target.value)}
              placeholder="/static/uploads/notifications/file.pdf or https://..."
              style={{ ...inputStyle, border: '1px solid #D1D5DB' }}
            />
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#9CA3AF' }}>At least one of Link or Attachment must be provided.</p>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
            <button type="button" onClick={onClose} disabled={saving}
              style={{ padding: '9px 20px', borderRadius: 6, border: '1px solid #D1D5DB', background: '#fff', fontSize: 14, fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer', color: '#374151' }}>
              Cancel
            </button>
            <button type="submit" disabled={saving}
              style={{ padding: '9px 20px', borderRadius: 6, border: 'none', background: saving ? '#E5E7EB' : 'var(--primary-red)', color: saving ? '#9CA3AF' : '#fff', fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              {saving && <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />}
              {saving ? 'Saving…' : mode === 'create' ? 'Save as Draft' : 'Update'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function NotificationsView() {
  const [notifications, setNotifications] = useState<BroadcastNotification[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<ToastMsg | null>(null);

  // Modal state
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingItem, setEditingItem] = useState<BroadcastNotification | null>(null);
  const [saving, setSaving] = useState(false);

  // Confirm dialog
  const [confirmAction, setConfirmAction] = useState<{
    message: string;
    label: string;
    danger?: boolean;
    onConfirm: () => Promise<void>;
  } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const showToast = useCallback((text: string, type: 'success' | 'error') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const loadNotifications = useCallback(async (p = page, sf = statusFilter) => {
    setLoading(true);
    try {
      const res = await adminListNotifications({ page: p, limit: 10, status: sf });
      setNotifications(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err: any) {
      showToast(err.message || 'Failed to load notifications', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, showToast]);

  useEffect(() => {
    loadNotifications(page, statusFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter]);

  const handleStatusFilter = (sf: string) => {
    setStatusFilter(sf);
    setPage(1);
  };

  const handleOpenCreate = () => {
    setFormMode('create');
    setEditingItem(null);
    setShowForm(true);
  };

  const handleOpenEdit = (item: BroadcastNotification) => {
    setFormMode('edit');
    setEditingItem(item);
    setShowForm(true);
  };

  const handleFormSave = async (payload: any) => {
    setSaving(true);
    try {
      if (formMode === 'create') {
        await adminCreateNotification(payload);
        showToast('Notification created as draft.', 'success');
      } else if (editingItem) {
        await adminUpdateNotification(editingItem.id, payload);
        showToast('Notification updated.', 'success');
      }
      setShowForm(false);
      loadNotifications(page, statusFilter);
    } catch (err: any) {
      showToast(err.message || 'Failed to save notification', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = (item: BroadcastNotification) => {
    setConfirmAction({
      message: `Publish "${item.title}"? This will send an email broadcast to all active users.`,
      label: 'Publish & Send Emails',
      danger: false,
      onConfirm: async () => {
        await adminPublishNotification(item.id);
        showToast('Notification published. Email broadcast queued.', 'success');
        loadNotifications(page, statusFilter);
      },
    });
  };

  const handleReject = (item: BroadcastNotification) => {
    setConfirmAction({
      message: `Reject "${item.title}"? It can be edited and re-submitted later.`,
      label: 'Reject',
      danger: true,
      onConfirm: async () => {
        await adminRejectNotification(item.id);
        showToast('Notification rejected.', 'success');
        loadNotifications(page, statusFilter);
      },
    });
  };

  const handleDelete = (item: BroadcastNotification) => {
    setConfirmAction({
      message: `Permanently delete "${item.title}"? This action cannot be undone.`,
      label: 'Delete',
      danger: true,
      onConfirm: async () => {
        await adminDeleteNotification(item.id);
        showToast('Notification deleted.', 'success');
        const newPage = notifications.length === 1 && page > 1 ? page - 1 : page;
        setPage(newPage);
        loadNotifications(newPage, statusFilter);
      },
    });
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    setConfirmLoading(true);
    try {
      await confirmAction.onConfirm();
    } catch (err: any) {
      showToast(err.message || 'Action failed', 'error');
    } finally {
      setConfirmLoading(false);
      setConfirmAction(null);
    }
  };

  const FILTERS = [
    { value: 'all', label: 'All' },
    { value: 'draft', label: 'Draft' },
    { value: 'published', label: 'Published' },
    { value: 'rejected', label: 'Rejected' },
  ];

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', color: '#111827', minHeight: '60vh' }}>
      {/* Injected spin keyframe */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Bell size={22} color="var(--primary-red)" />
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#111827' }}>Broadcast Notifications</h2>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: '#6B7280' }}>
              Manage announcements sent to all users via in-app &amp; email.
            </p>
          </div>
        </div>
        <button
          id="admin-notif-create-btn"
          onClick={handleOpenCreate}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '9px 18px', borderRadius: 7, border: 'none',
            background: 'var(--primary-red)', color: '#fff', fontSize: 14, fontWeight: 600,
            cursor: 'pointer', boxShadow: '0 2px 8px rgba(var(--primary-red-rgb), 0.25)',
            transition: 'background 0.15s',
          }}>
          <Plus size={16} />
          New Notification
        </button>
      </div>

      {/* Toast */}
      {toast && <Toast msg={toast} onDismiss={() => setToast(null)} />}

      {/* Status filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => handleStatusFilter(f.value)}
            style={{
              padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: statusFilter === f.value ? 600 : 400,
              border: statusFilter === f.value ? '1.5px solid var(--primary-red)' : '1.5px solid #E5E7EB',
              background: statusFilter === f.value ? '#FFF1F2' : '#fff',
              color: statusFilter === f.value ? 'var(--primary-red)' : '#6B7280',
              cursor: 'pointer', transition: 'all 0.15s',
            }}>
            {f.label}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 13, color: '#9CA3AF', alignSelf: 'center' }}>
          {total} total
        </span>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #E5E7EB', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        {loading ? (
          <Spinner size={32} label="Loading notifications…" />
        ) : notifications.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <Bell size={32} color="#E5E7EB" style={{ marginBottom: 12 }} />
            <p style={{ margin: 0, color: '#9CA3AF', fontSize: 15 }}>No notifications found for this filter.</p>
            <button onClick={handleOpenCreate} style={{ marginTop: 12, background: 'none', border: 'none', color: 'var(--primary-red)', fontSize: 14, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}>Create your first notification →</button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                {['Type', 'Title', 'Status', 'Created By', 'Published', 'Actions'].map(col => (
                  <th key={col} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {notifications.map((n, idx) => (
                <tr key={n.id} style={{ borderBottom: idx < notifications.length - 1 ? '1px solid #F3F4F6' : 'none', transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-subtle)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  {/* Type */}
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: '#374151', whiteSpace: 'nowrap' }}>
                      {contentTypeIcon(n.contentType)}
                      <span style={{ fontSize: 12, color: '#6B7280', textTransform: 'capitalize' }}>{n.contentType}</span>
                    </span>
                  </td>
                  {/* Title */}
                  <td style={{ padding: '12px 14px', maxWidth: 260 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</p>
                    {n.description && <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.description}</p>}
                    {(n.link || n.attachment) && (
                      <a
                        href={n.link || n.attachment || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: 12, color: 'var(--primary-red)', display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 2, textDecoration: 'none' }}>
                        <ExternalLink size={11} /> View link
                      </a>
                    )}
                  </td>
                  {/* Status */}
                  <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>{statusBadge(n.status)}</td>
                  {/* Created by */}
                  <td style={{ padding: '12px 14px', fontSize: 13, color: '#374151', whiteSpace: 'nowrap' }}>{n.createdBy || '—'}</td>
                  {/* Published At */}
                  <td style={{ padding: '12px 14px', fontSize: 13, color: '#6B7280', whiteSpace: 'nowrap' }}>{formatDate(n.publishedAt)}</td>
                  {/* Actions */}
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      {/* Edit – only for draft/rejected */}
                      {n.status !== 'published' && (
                        <button
                          title="Edit"
                          onClick={() => handleOpenEdit(n)}
                          style={{ padding: '5px 10px', borderRadius: 5, border: '1px solid #E5E7EB', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#374151' }}>
                          <Edit2 size={12} /> Edit
                        </button>
                      )}
                      {/* Publish – draft only */}
                      {n.status === 'draft' && (
                        <button
                          title="Publish"
                          onClick={() => handlePublish(n)}
                          style={{ padding: '5px 10px', borderRadius: 5, border: 'none', background: '#059669', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#fff', fontWeight: 600 }}>
                          <Send size={12} /> Publish
                        </button>
                      )}
                      {/* Reject – draft only */}
                      {n.status === 'draft' && (
                        <button
                          title="Reject"
                          onClick={() => handleReject(n)}
                          style={{ padding: '5px 10px', borderRadius: 5, border: '1px solid #FECACA', background: '#FEF2F2', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#B91C1C' }}>
                          <X size={12} /> Reject
                        </button>
                      )}
                      {/* Delete – always */}
                      <button
                        title="Delete"
                        onClick={() => handleDelete(n)}
                        style={{ padding: '5px 10px', borderRadius: 5, border: '1px solid #E5E7EB', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#DC2626' }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 20 }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #E5E7EB', background: page === 1 ? '#F9FAFB' : '#fff', cursor: page === 1 ? 'not-allowed' : 'pointer', color: page === 1 ? '#D1D5DB' : '#374151', display: 'flex', alignItems: 'center' }}>
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontSize: 14, color: '#374151' }}>Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #E5E7EB', background: page === totalPages ? '#F9FAFB' : '#fff', cursor: page === totalPages ? 'not-allowed' : 'pointer', color: page === totalPages ? '#D1D5DB' : '#374151', display: 'flex', alignItems: 'center' }}>
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Create / Edit Form Modal */}
      {showForm && (
        <FormModal
          mode={formMode}
          initial={editingItem}
          onSave={handleFormSave}
          onClose={() => setShowForm(false)}
          saving={saving}
        />
      )}

      {/* Confirm Dialog */}
      {confirmAction && (
        <ConfirmDialog
          message={confirmAction.message}
          confirmLabel={confirmLoading ? 'Processing…' : confirmAction.label}
          danger={confirmAction.danger}
          onConfirm={handleConfirmAction}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}
