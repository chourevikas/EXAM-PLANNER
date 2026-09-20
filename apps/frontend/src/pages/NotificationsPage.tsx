import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { StudentLayout } from '../components/student/StudentLayout';
import {
  Bell,
  ExternalLink,
  Video,
  FileText,
  Globe,
  Package,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Filter,
} from 'lucide-react';
import { Spinner } from '../components/common/Spinner';
import {
  fetchPublishedNotifications,
  fetchNotificationDetail,
  type BroadcastNotification,
} from '../services/notificationService';

// ─── Content Type Config ──────────────────────────────────────────────────────

const CONTENT_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  video:   { label: 'Video', icon: Video, color: '#DC2626', bg: '#FEF2F2' },
  pdf:     { label: 'PDF', icon: FileText, color: 'var(--accent-primary)', bg: 'var(--accent-bg)' },
  article: { label: 'Article', icon: Globe, color: '#059669', bg: '#ECFDF5' },
  other:   { label: 'Announcement', icon: Package, color: '#7C3AED', bg: '#F5F3FF' },
};

function getContentConfig(ct: string) {
  return CONTENT_CONFIG[ct?.toLowerCase()] || CONTENT_CONFIG.other;
}

function formatDate(iso?: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

// ─── Notification Card ────────────────────────────────────────────────────────

function NotificationCard({ notif, onClick }: { notif: BroadcastNotification; onClick: () => void }) {
  const cfg = getContentConfig(notif.contentType);
  const Icon = cfg.icon;

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}
      style={{
        background: 'var(--bg-card, #fff)',
        border: '1px solid var(--border-default, #E5E7EB)',
        borderRadius: 12,
        padding: '18px 20px',
        cursor: 'pointer',
        transition: 'box-shadow 0.15s, transform 0.12s',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 16,
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 18px rgba(0,0,0,0.10)';
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.boxShadow = 'none';
        (e.currentTarget as HTMLElement).style.transform = 'none';
      }}
    >
      {/* Icon */}
      <div style={{
        width: 44, height: 44, borderRadius: 10, background: cfg.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={20} color={cfg.color} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
            color: cfg.color, background: cfg.bg, padding: '2px 8px', borderRadius: 4,
          }}>
            {cfg.label}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-secondary, #6B7280)' }}>
            <Calendar size={11} style={{ marginRight: 3, verticalAlign: 'middle' }} />
            {formatDate(notif.publishedAt || notif.createdAt)}
          </span>
        </div>

        <h3 style={{
          margin: '0 0 4px', fontSize: 16, fontWeight: 700,
          color: 'var(--text-primary, #111827)', lineHeight: 1.3,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {notif.title}
        </h3>

        {notif.description && (
          <p style={{
            margin: 0, fontSize: 13.5, color: 'var(--text-secondary, #6B7280)',
            lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box',
            WebkitBoxOrient: 'vertical', WebkitLineClamp: 2,
          }}>
            {notif.description}
          </p>
        )}

        {notif.createdBy && (
          <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-muted, #9CA3AF)' }}>
            By {notif.createdBy}
          </p>
        )}
      </div>

      {/* Arrow */}
      <ChevronRight size={18} color="var(--text-muted, #9CA3AF)" style={{ flexShrink: 0, marginTop: 4 }} />
    </div>
  );
}

// ─── Notification Detail View ─────────────────────────────────────────────────

function NotificationDetail({ id, onBack }: { id: number; onBack: () => void }) {
  const [notif, setNotif] = useState<BroadcastNotification | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchNotificationDetail(id)
      .then(setNotif)
      .catch(err => setError(err.message || 'Failed to load notification'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '60vh',
      }}>
        <Spinner size={36} />
      </div>
    );
  }

  if (error || !notif) {
    return (
      <div style={{ padding: '40px 24px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary, #6B7280)', marginBottom: 16 }}>{error || 'Notification not found.'}</p>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--primary-red)', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>← Back to Notifications</button>
      </div>
    );
  }

  const cfg = getContentConfig(notif.contentType);
  const Icon = cfg.icon;
  const destination = notif.link || notif.attachment;

  return (
    <div data-page-align="left" style={{ maxWidth: 720, margin: 0 }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      <button
        onClick={onBack}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'none', border: 'none', color: 'var(--primary-red)',
          cursor: 'pointer', fontSize: 14, fontWeight: 600, padding: 0, marginBottom: 24,
        }}>
        <ChevronLeft size={16} /> Back to Announcements
      </button>

      <div style={{
        background: 'var(--bg-card, #fff)',
        border: '1px solid var(--border-default, #E5E7EB)',
        borderRadius: 14, overflow: 'hidden',
        boxShadow: '0 4px 24px rgba(0,0,0,0.07)',
      }}>
        {/* Header banner — dark themed, content-type colour used as accent only */}
        <div style={{
          background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
          padding: '28px 28px 24px',
          borderBottom: `3px solid ${cfg.color}`,
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Subtle glow accent */}
          <div style={{
            position: 'absolute', top: -40, right: -40,
            width: 160, height: 160, borderRadius: '50%',
            background: `${cfg.color}18`,
            pointerEvents: 'none',
          }} />
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: `${cfg.color}22`,
            color: cfg.color,
            border: `1px solid ${cfg.color}55`,
            padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12,
          }}>
            <Icon size={13} /> {cfg.label}
          </span>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--bg-subtle)', lineHeight: 1.3 }}>{notif.title}</h1>
          <p style={{ margin: '8px 0 0', fontSize: 13, color: 'rgba(248,250,252,0.55)' }}>
            {notif.createdBy && `By ${notif.createdBy} · `}
            Published {formatDate(notif.publishedAt || notif.createdAt)}
          </p>
        </div>

        <div style={{ padding: '24px 28px' }}>
          {notif.description && (
            <p style={{ margin: '0 0 24px', fontSize: 15.5, color: 'var(--text-primary, #374151)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
              {notif.description}
            </p>
          )}

          {destination && (
            <a
              href={destination}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '12px 24px', borderRadius: 8, textDecoration: 'none',
                background: cfg.color, color: '#fff', fontWeight: 700, fontSize: 15,
                boxShadow: `0 4px 14px ${cfg.color}40`,
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
              <ExternalLink size={16} />
              {notif.contentType === 'video' ? 'Watch Video' :
               notif.contentType === 'pdf' ? 'Open PDF' :
               notif.contentType === 'article' ? 'Read Article' : 'View Content'}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Notifications Page ──────────────────────────────────────────────────

export function NotificationsPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const [notifications, setNotifications] = useState<BroadcastNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [contentFilter, setContentFilter] = useState('all');

  const loadNotifications = useCallback(async (p: number, ct: string) => {
    setLoading(true);
    try {
      const res = await fetchPublishedNotifications({ page: p, limit: 10, contentType: ct });
      setNotifications(res.items || []);
      setTotal(res.total || 0);
      setTotalPages(res.totalPages || 1);
    } catch (err) {
      console.error('Failed to load notifications', err);
      setNotifications([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!id) {
      loadNotifications(page, contentFilter);
    }
  }, [id, page, contentFilter, loadNotifications]);

  const handleFilterChange = (ct: string) => {
    setContentFilter(ct);
    setPage(1);
  };

  const CONTENT_FILTERS = [
    { value: 'all', label: 'All' },
    { value: 'video', label: '▶ Video' },
    { value: 'pdf', label: '📄 PDF' },
    { value: 'article', label: '📰 Article' },
    { value: 'other', label: '📦 Other' },
  ];

  // If showing detail view
  if (id) {
    return (
      <StudentLayout pageTitle="Announcement">
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        <NotificationDetail id={Number(id)} onBack={() => navigate('/notifications')} />
      </StudentLayout>
    );
  }

  return (
    <StudentLayout pageTitle="Announcements">
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <div data-page-align="left" style={{ maxWidth: 800, margin: 0, paddingBottom: 64 }}>
        {/* Page Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <Bell size={24} color="var(--primary-red)" />
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--text-primary, #111827)' }}>
            Announcements
          </h1>
        </div>
        <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--text-secondary, #6B7280)' }}>
          Stay up to date with the latest study materials, videos, and updates from your mentors.
        </p>

        {/* Content Type Filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
          <Filter size={14} color="var(--text-secondary, #9CA3AF)" />
          {CONTENT_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => handleFilterChange(f.value)}
              style={{
                padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: contentFilter === f.value ? 600 : 400,
                border: contentFilter === f.value ? '1.5px solid var(--primary-red)' : '1.5px solid var(--border-default, #E5E7EB)',
                background: contentFilter === f.value ? '#FFF1F2' : 'var(--bg-card, #fff)',
                color: contentFilter === f.value ? 'var(--primary-red)' : 'var(--text-secondary, #6B7280)',
                cursor: 'pointer', transition: 'all 0.15s',
              }}>
              {f.label}
            </button>
          ))}
          {total > 0 && (
            <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-muted, #9CA3AF)' }}>
              {total} announcement{total !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <Spinner size={32} label="Loading announcements…" />
        ) : notifications.length === 0 ? (
          <div style={{
            padding: '48px 24px', textAlign: 'center',
            background: 'var(--bg-card, #fff)',
            border: '1px solid var(--border-default, #E5E7EB)',
            borderRadius: 12,
          }}>
            <Bell size={36} color="var(--border-default, #E5E7EB)" style={{ marginBottom: 12 }} />
            <p style={{ margin: 0, color: 'var(--text-secondary, #6B7280)', fontSize: 15 }}>
              No announcements found{contentFilter !== 'all' ? ` for filter "${contentFilter}"` : ''}.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {notifications.map(n => (
              <NotificationCard
                key={n.id}
                notif={n}
                onClick={() => navigate(`/notifications/${n.id}`)}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 28 }}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '8px 16px', borderRadius: 8,
                border: '1.5px solid var(--border-default, #E5E7EB)',
                background: page === 1 ? 'var(--bg-muted, #F9FAFB)' : 'var(--bg-card, #fff)',
                color: page === 1 ? 'var(--text-muted, #D1D5DB)' : 'var(--text-primary, #374151)',
                cursor: page === 1 ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 500,
              }}>
              <ChevronLeft size={16} /> Previous
            </button>
            <span style={{ fontSize: 14, color: 'var(--text-secondary, #6B7280)' }}>
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || loading}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '8px 16px', borderRadius: 8,
                border: '1.5px solid var(--border-default, #E5E7EB)',
                background: page === totalPages ? 'var(--bg-muted, #F9FAFB)' : 'var(--bg-card, #fff)',
                color: page === totalPages ? 'var(--text-muted, #D1D5DB)' : 'var(--text-primary, #374151)',
                cursor: page === totalPages ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 500,
              }}>
              Next <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </StudentLayout>
  );
}
