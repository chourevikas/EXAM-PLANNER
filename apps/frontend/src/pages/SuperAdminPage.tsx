import React, { useEffect, useState } from 'react';
import { AdminApprovalRequest, AdminApprovalLog, SystemStats } from '../types/auth';
import {
  fetchPendingAdminRequests,
  fetchActiveAdmins,
  approveAdminRequest,
  rejectAdminRequest,
  suspendAdmin,
  reactivateAdmin,
  fetchAuditLogs,
  fetchSystemStats,
} from '../services/adminService';

import { SuperAdminSidebar } from '../components/superadmin/SuperAdminSidebar';
import { SuperAdminTopNav } from '../components/superadmin/SuperAdminTopNav';
import { SuperAdminStats } from '../components/superadmin/SuperAdminStats';
import { SuperAdminTab, SuperAdminTabNav } from '../components/superadmin/SuperAdminTabNav';
import { PendingApprovalsTab } from '../components/superadmin/PendingApprovalsTab';
import { ActiveAdminsTab } from '../components/superadmin/ActiveAdminsTab';
import { AuditLogsTab } from '../components/superadmin/AuditLogsTab';
import { RejectionModal } from '../components/superadmin/RejectionModal';

export function SuperAdminPage() {
  const [activeTab, setActiveTab] = useState<SuperAdminTab>('pending');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [stats, setStats] = useState<SystemStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [pendingRequests, setPendingRequests] = useState<AdminApprovalRequest[]>([]);
  const [pendingLoading, setPendingLoading] = useState(true);

  const [activeAdmins, setActiveAdmins] = useState<AdminApprovalRequest[]>([]);
  const [activeLoading, setActiveLoading] = useState(true);

  const [auditLogs, setAuditLogs] = useState<AdminApprovalLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);

  const [processingId, setProcessingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [rejectionTarget, setRejectionTarget] = useState<{ id: string; name: string } | null>(null);

  const loadAllData = async () => {
    loadStats();
    loadPending();
    loadActive();
    loadLogs();
  };

  const loadStats = async () => {
    setStatsLoading(true);
    try {
      const data = await fetchSystemStats();
      setStats(data);
    } catch (err: any) {
      console.error('Failed stats fetch:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  const loadPending = async () => {
    setPendingLoading(true);
    try {
      const data = await fetchPendingAdminRequests();
      setPendingRequests(data);
    } catch (err: any) {
      setToastMessage({ text: err.message || 'Failed to fetch pending requests.', isError: true });
    } finally {
      setPendingLoading(false);
    }
  };

  const loadActive = async () => {
    setActiveLoading(true);
    try {
      const data = await fetchActiveAdmins();
      setActiveAdmins(data);
    } catch (err: any) {
      console.error('Failed active admins fetch:', err);
    } finally {
      setActiveLoading(false);
    }
  };

  const loadLogs = async () => {
    setLogsLoading(true);
    try {
      const data = await fetchAuditLogs();
      setAuditLogs(data);
    } catch (err: any) {
      console.error('Failed audit logs fetch:', err);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const showToast = (text: string, isError: boolean = false) => {
    setToastMessage({ text, isError });
    setTimeout(() => {
      setToastMessage((prev) => (prev?.text === text ? null : prev));
    }, 4000);
  };

  const handleApprove = async (userId: string, name: string) => {
    setProcessingId(userId);
    try {
      await approveAdminRequest(userId);
      showToast(`Success! Approved Admin account for ${name}.`);
      setPendingRequests((prev) => prev.filter((r) => r.id !== userId));
      loadAllData();
    } catch (err: any) {
      showToast(err.message || 'Approval failed.', true);
    } finally {
      setProcessingId(null);
    }
  };

  const openRejectionModal = (userId: string, name: string) => {
    setRejectionTarget({ id: userId, name });
  };

  const handleConfirmRejection = async (reason: string) => {
    if (!rejectionTarget) return;
    const { id, name } = rejectionTarget;
    setRejectionTarget(null);
    setProcessingId(id);

    try {
      await rejectAdminRequest(id, reason);
      showToast(`Admin request for ${name} rejected.`);
      setPendingRequests((prev) => prev.filter((r) => r.id !== id));
      loadAllData();
    } catch (err: any) {
      showToast(err.message || 'Rejection failed.', true);
    } finally {
      setProcessingId(null);
    }
  };

  const handleSuspend = async (userId: string, name: string) => {
    setProcessingId(userId);
    try {
      await suspendAdmin(userId);
      showToast(`Suspended Admin access for ${name}.`, true);
      loadActive();
    } catch (err: any) {
      showToast(err.message || 'Suspend failed.', true);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReactivate = async (userId: string, name: string) => {
    setProcessingId(userId);
    try {
      await reactivateAdmin(userId);
      showToast(`Reactivated Admin access for ${name}.`);
      loadActive();
    } catch (err: any) {
      showToast(err.message || 'Reactivation failed.', true);
    } finally {
      setProcessingId(null);
    }
  };

  const renderActiveTabContent = () => {
    switch (activeTab) {
      case 'pending':
        return (
          <PendingApprovalsTab
            requests={pendingRequests}
            loading={pendingLoading}
            processingId={processingId}
            onApprove={handleApprove}
            onReject={openRejectionModal}
            onRefresh={loadPending}
          />
        );
      case 'active':
        return (
          <ActiveAdminsTab
            admins={activeAdmins}
            loading={activeLoading}
            processingId={processingId}
            onSuspend={handleSuspend}
            onReactivate={handleReactivate}
            onRefresh={loadActive}
          />
        );
      case 'audit':
        return (
          <AuditLogsTab
            logs={auditLogs}
            loading={logsLoading}
            onRefresh={loadLogs}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-body)' }}>
      {/* Figma Collapsible Super Admin Sidebar */}
      <SuperAdminSidebar
        activeTab={activeTab}
        onNavigate={setActiveTab}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((p) => !p)}
        pendingCount={pendingRequests.length}
      />

      {/* Main Area with TopNav */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <SuperAdminTopNav activeTab={activeTab} onNavigate={setActiveTab} />
        
        <main style={{ flex: 1, overflowY: 'auto', padding: '28px 32px', background: 'var(--bg-body)' }}>
          <div style={{ maxWidth: 1400, margin: '0 auto' }}>
            {/* Executive Header Banner */}
            <div
              style={{
                background: 'linear-gradient(135deg, #0f1e3c 0%, #1e293b 100%)',
                borderRadius: 20,
                padding: 32,
                color: '#fff',
                marginBottom: 28,
                boxShadow: 'var(--shadow-md)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 20,
              }}
            >
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#f97316', textTransform: 'uppercase', letterSpacing: '0.8px', fontFamily: 'var(--font-mono)' }}>
                  👑 EXECUTIVE CONTROL CENTER
                </div>
                <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 800, margin: '6px 0 0 0', letterSpacing: '-0.5px' }}>
                  Super Admin Control Center
                </h1>
                <p style={{ fontSize: 14, color: '#94a3b8', marginTop: 6, maxWidth: 650 }}>
                  Top-level organization management, pending admin approvals, user status controls, and security audit logs.
                </p>
              </div>
            </div>

            {/* Toast Banner */}
            {toastMessage && (
              <div
                style={{
                  padding: '14px 18px',
                  borderRadius: 14,
                  fontSize: 14,
                  fontWeight: 600,
                  marginBottom: 24,
                  background: toastMessage.isError ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                  color: toastMessage.isError ? '#ef4444' : '#10b981',
                  border: `1px solid ${toastMessage.isError ? 'rgba(239, 68, 68, 0.35)' : 'rgba(16, 185, 129, 0.35)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <span>{toastMessage.isError ? '⚠️' : '✅'}</span>
                <span>{toastMessage.text}</span>
              </div>
            )}

            {/* KPI Executive Metric Cards */}
            <SuperAdminStats stats={stats} loading={statsLoading} />

            {/* Horizontal Navigation Tabs */}
            <SuperAdminTabNav activeTab={activeTab} onTabChange={setActiveTab} pendingCount={pendingRequests.length} />

            {/* Active Tab View */}
            {renderActiveTabContent()}
          </div>
        </main>
      </div>

      {/* Rejection Modal Popup */}
      <RejectionModal
        isOpen={Boolean(rejectionTarget)}
        adminName={rejectionTarget?.name || ''}
        onClose={() => setRejectionTarget(null)}
        onConfirm={handleConfirmRejection}
      />
    </div>
  );
}
