import React, { useEffect, useState } from 'react';
import { AdminApprovalRequest, AdminApprovalLog, SystemStats, UserDirectoryItem } from '../types/auth';
import {
  fetchPendingAdminRequests,
  fetchActiveAdmins,
  approveAdminRequest,
  rejectAdminRequest,
  suspendAdmin,
  reactivateAdmin,
  fetchAuditLogs,
  fetchSystemStats,
  fetchPlatformUsers,
  updateUserRole,
} from '../services/adminService';

import { SuperAdminSidebar } from '../components/superadmin/SuperAdminSidebar';
import { SuperAdminTopNav } from '../components/superadmin/SuperAdminTopNav';
import { SuperAdminStats } from '../components/superadmin/SuperAdminStats';
import { SuperAdminTab, SuperAdminTabNav } from '../components/superadmin/SuperAdminTabNav';
import { PendingApprovalsTab } from '../components/superadmin/PendingApprovalsTab';
import { ActiveAdminsTab } from '../components/superadmin/ActiveAdminsTab';
import { AuditLogsTab } from '../components/superadmin/AuditLogsTab';
import { AllUsersTab } from '../components/superadmin/AllUsersTab';
import { TestimonialApprovalsTab } from '../components/superadmin/TestimonialApprovalsTab';
import { RejectionModal } from '../components/superadmin/RejectionModal';
import {
  TestimonialItem,
  fetchAllTestimonialsForAdmin,
  approveTestimonial,
  rejectTestimonial as rejectTestimonialApi,
  deleteTestimonial as deleteTestimonialApi,
} from '../services/testimonialService';

export function SuperAdminPage() {
  const [activeTab, setActiveTab] = useState<SuperAdminTab>('pending');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  const [stats, setStats] = useState<SystemStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [pendingRequests, setPendingRequests] = useState<AdminApprovalRequest[]>([]);
  const [pendingLoading, setPendingLoading] = useState(true);

  const [activeAdmins, setActiveAdmins] = useState<AdminApprovalRequest[]>([]);
  const [activeLoading, setActiveLoading] = useState(true);

  const [auditLogs, setAuditLogs] = useState<AdminApprovalLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);

  const [allUsers, setAllUsers] = useState<UserDirectoryItem[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);

  const [testimonials, setTestimonials] = useState<TestimonialItem[]>([]);
  const [testimonialsLoading, setTestimonialsLoading] = useState(true);

  const [processingId, setProcessingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [rejectionTarget, setRejectionTarget] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (!mobile) setMobileOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleToggleSidebar = () => {
    if (isMobile) {
      setMobileOpen((prev) => !prev);
    } else {
      setSidebarCollapsed((prev) => !prev);
    }
  };

  const loadAllData = async () => {
    loadStats();
    loadPending();
    loadActive();
    loadLogs();
    loadUsers();
    loadTestimonials();
  };

  const loadTestimonials = async () => {
    setTestimonialsLoading(true);
    try {
      const data = await fetchAllTestimonialsForAdmin();
      setTestimonials(data);
    } catch (err: any) {
      console.error('Failed testimonials fetch:', err);
    } finally {
      setTestimonialsLoading(false);
    }
  };

  const loadUsers = async () => {
    setUsersLoading(true);
    try {
      const data = await fetchPlatformUsers();
      setAllUsers(data);
    } catch (err: any) {
      console.error('Failed users fetch:', err);
    } finally {
      setUsersLoading(false);
    }
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

  const showToast = (text: string, isError = false) => {
    setToastMessage({ text, isError });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleApprove = async (id: string, name: string) => {
    setProcessingId(id);
    try {
      await approveAdminRequest(id);
      showToast(`Successfully approved admin access for ${name}`);
      loadAllData();
    } catch (err: any) {
      showToast(err.message || 'Failed to approve admin', true);
    } finally {
      setProcessingId(null);
    }
  };

  const handleOpenRejection = (id: string, name: string) => {
    setRejectionTarget({ id, name });
  };

  const handleConfirmRejection = async (reason: string) => {
    if (!rejectionTarget) return;
    const { id, name } = rejectionTarget;
    setProcessingId(id);
    try {
      await rejectAdminRequest(id, reason);
      showToast(`Rejected request for ${name}`);
      setRejectionTarget(null);
      loadAllData();
    } catch (err: any) {
      showToast(err.message || 'Failed to reject request', true);
    } finally {
      setProcessingId(null);
    }
  };

  const handleSuspend = async (id: string, name: string) => {
    setProcessingId(id);
    try {
      await suspendAdmin(id);
      showToast(`Suspended admin account: ${name}`);
      loadAllData();
    } catch (err: any) {
      showToast(err.message || 'Failed to suspend admin', true);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReactivate = async (id: string, name: string) => {
    setProcessingId(id);
    try {
      await reactivateAdmin(id);
      showToast(`Reactivated admin account: ${name}`);
      loadAllData();
    } catch (err: any) {
      showToast(err.message || 'Failed to reactivate admin', true);
    } finally {
      setProcessingId(null);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string, userName: string) => {
    try {
      await updateUserRole(userId, newRole);
      showToast(`Updated role for ${userName} to ${newRole}`);
      loadAllData();
    } catch (err: any) {
      showToast(err.message || 'Failed to update user role', true);
    }
  };

  const handleApproveTestimonial = async (id: string, name: string) => {
    setProcessingId(id);
    try {
      await approveTestimonial(id);
      showToast(`Approved student testimonial by ${name}`);
      loadTestimonials();
    } catch (err: any) {
      showToast(err.message || 'Failed to approve testimonial', true);
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectTestimonial = async (id: string, name: string) => {
    setProcessingId(id);
    try {
      await rejectTestimonialApi(id, 'Inappropriate or invalid submission');
      showToast(`Rejected testimonial by ${name}`);
      loadTestimonials();
    } catch (err: any) {
      showToast(err.message || 'Failed to reject testimonial', true);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeleteTestimonial = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete the story by ${name}?`)) return;
    setProcessingId(id);
    try {
      await deleteTestimonialApi(id);
      showToast(`Deleted testimonial by ${name}`);
      loadTestimonials();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete testimonial', true);
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
            onReject={handleOpenRejection}
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
      case 'users':
        return (
          <AllUsersTab
            users={allUsers}
            loading={usersLoading}
            onRefresh={loadUsers}
            onRoleChange={handleRoleChange}
          />
        );
      case 'testimonials':
        return (
          <TestimonialApprovalsTab
            testimonials={testimonials}
            loading={testimonialsLoading}
            processingId={processingId}
            onApprove={handleApproveTestimonial}
            onReject={handleRejectTestimonial}
            onDelete={handleDeleteTestimonial}
            onRefresh={loadTestimonials}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg-body, #F8FAFC)', fontFamily: 'Inter, sans-serif', color: '#0F172A', overflowX: 'hidden' }}>
      {/* Full-Width Top Header (fixed at top: 0) */}
      <SuperAdminTopNav
        activeTab={activeTab}
        onNavigate={setActiveTab}
        onToggleSidebar={handleToggleSidebar}
      />

      {/* Main Container below Top Header (marginTop: 60px) */}
      <div style={{ display: 'flex', flex: 1, marginTop: 60 }}>
        {/* Sidebar Navigation (fixed at top: 60px joining header) */}
        <SuperAdminSidebar
          activeTab={activeTab}
          onNavigate={(tab) => {
            setActiveTab(tab);
            if (isMobile) setMobileOpen(false);
          }}
          collapsed={sidebarCollapsed}
          onToggle={handleToggleSidebar}
          pendingCount={pendingRequests.length}
          pendingTestimonialsCount={testimonials.filter((t) => t.status === 'PENDING').length}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
        />

        {/* Main Content Area */}
        <div
          style={{
            flex: 1,
            marginLeft: isMobile ? 0 : (sidebarCollapsed ? 68 : 240),
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            transition: 'margin-left 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            width: '100%',
          }}
        >
          <main style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '18px 20px' : '28px 36px', boxSizing: 'border-box' }}>
            <div style={{ maxWidth: 1400, margin: '0 auto' }}>
              {/* Executive Header Banner */}
              <div
                style={{
                  background: 'linear-gradient(135deg, #0A1128 0%, #0F1D38 40%, #162B4E 75%, #1F3D6E 100%)',
                  borderRadius: 24,
                  padding: '36px 40px',
                  color: '#ffffff',
                  marginBottom: 32,
                  boxShadow: '0 20px 45px -15px rgba(10, 17, 40, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 20,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Decorative Background Lighting */}
                <div
                  style={{
                    position: 'absolute',
                    top: -60,
                    right: -60,
                    width: 300,
                    height: 300,
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(249, 115, 22, 0.25) 0%, rgba(249, 115, 22, 0) 70%)',
                    pointerEvents: 'none',
                  }}
                />

                <div style={{ position: 'relative', zIndex: 2 }}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      color: '#fdba74',
                      textTransform: 'uppercase',
                      letterSpacing: '0.12em',
                      padding: '4px 12px',
                      borderRadius: 99,
                      background: 'rgba(249, 115, 22, 0.15)',
                      border: '1px solid rgba(249, 115, 22, 0.3)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      marginBottom: 12,
                    }}
                  >
                    👑 EXECUTIVE CONTROL CENTER
                  </div>
                  <h1 style={{ fontFamily: 'Inter, sans-serif', fontSize: 32, fontWeight: 800, margin: 0, letterSpacing: '-0.03em', lineHeight: 1.2 }}>
                    Super Admin Portal
                  </h1>
                  <p style={{ fontSize: 14.5, color: 'rgba(255, 255, 255, 0.75)', marginTop: 8, maxWidth: 680, lineHeight: 1.5, margin: '8px 0 0 0' }}>
                    Central executive console for managing institutional admin access, monitoring platform health, and reviewing security audit records.
                  </p>
                </div>
              </div>

              {/* Toast Banner */}
              {toastMessage && (
                <div
                  style={{
                    padding: '14px 20px',
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
                    boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
                  }}
                >
                  <span>{toastMessage.isError ? '⚠️' : '✅'}</span>
                  <span>{toastMessage.text}</span>
                </div>
              )}

              {/* KPI Executive Metric Cards */}
              <SuperAdminStats stats={stats} loading={statsLoading} onSelectTab={setActiveTab} />

              {/* Horizontal Navigation Tabs */}
              <SuperAdminTabNav
                activeTab={activeTab}
                onTabChange={setActiveTab}
                pendingCount={pendingRequests.length}
                pendingTestimonialsCount={testimonials.filter((t) => t.status === 'PENDING').length}
              />

              {/* Active Tab View */}
              {renderActiveTabContent()}
            </div>
          </main>
        </div>
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
