import React, { useEffect, useState, useRef } from 'react';
import {
  Users,
  Search,
  ShieldAlert,
  CheckCircle,
  XCircle,
  Info,
  Loader2,
  UserCheck,
  UserX,
  Crown,
  Mail,
  Calendar,
  Award,
  Zap,
  BookOpen,
  X,
  ChevronRight,
  ChevronLeft,
  Filter,
  Copy,
  Check,
  Globe
} from 'lucide-react';
import { fetchAllUsers, updateUserStatus, fetchUserById } from '../../../services/adminService';
import { User, UserStatus } from '../../../types/auth';

export function UsersView() {
  const [usersList, setUsersList] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [copiedId, setCopiedId] = useState<boolean>(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [accessFilter, setAccessFilter] = useState<string>('ALL');

  // Pagination State (5 ntries per page)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const ITEMS_PER_PAGE = 5;

  // Popover State for Access Info ("i") button
  const [activePopoverUserId, setActivePopoverUserId] = useState<string | null>(null);

  // Candidate Detail Drawer / Modal State
  const [selectedCandidate, setSelectedCandidate] = useState<User | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState<boolean>(false);
  const [actionLoadingUserId, setActionLoadingUserId] = useState<string | null>(null);

  const popoverRef = useRef<HTMLDivElement>(null);

  const handleSelectCandidate = async (candidate: User) => {
    setSelectedCandidate(candidate);
    setIsDetailLoading(true);
    try {
      const freshUser = await fetchUserById(candidate.id);
      if (freshUser) {
        setSelectedCandidate(prev => prev && prev.id === candidate.id ? { ...prev, ...freshUser } : freshUser);
      }
    } catch (err) {
      console.warn('Could not fetch latest user details:', err);
    } finally {
      setIsDetailLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  // Reset pagination when search query or access filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, accessFilter]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setActivePopoverUserId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const data = await fetchAllUsers();
      setUsersList(data);
    } catch (err: any) {
      console.error('Failed to load user directory:', err);
      setErrorMsg(err.message || 'Could not load users from database.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAccess = async (userId: string, newStatus: 'ACTIVE' | 'SUSPENDED') => {
    setActionLoadingUserId(userId);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const updatedUser = await updateUserStatus(userId, newStatus);
      setUsersList(prev => prev.map(u => u.id === userId ? { ...u, status: updatedUser.status || newStatus as UserStatus } : u));
      if (selectedCandidate && selectedCandidate.id === userId) {
        setSelectedCandidate(prev => prev ? { ...prev, status: newStatus as UserStatus } : null);
      }
      setSuccessMsg(`Access state updated to ${newStatus} successfully.`);
      setActivePopoverUserId(null);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      console.error('Failed to update access:', err);
      setErrorMsg(err.message || 'Failed to update access status.');
    } finally {
      setActionLoadingUserId(null);
    }
  };

  // Filtered Users (Super Admin is hidden at all cost)
  const filteredUsers = usersList.filter(user => {
    // Hide Super Admin at all cost
    if (user.role === 'SUPER_ADMIN') return false;

    const matchesSearch =
      user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesAccess = accessFilter === 'ALL' || user.status === accessFilter;

    return matchesSearch && matchesAccess;
  });

  // Pagination Calculations
  const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, filteredUsers.length);
  const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

  // Analytics summary metrics
  const totalCount = usersList.length;
  const activeCount = usersList.filter(u => u.status === 'ACTIVE').length;
  const suspendedCount = usersList.filter(u => u.status === 'SUSPENDED').length;
  const premiumCount = usersList.filter(u => u.subscription_tier === 'PREMIUM' || u.student_profile?.subscription_tier === 'PREMIUM').length;

  return (
    <div style={{ padding: 0, maxWidth: 1440, margin: '0 auto', fontFamily: 'var(--font-sans, sans-serif)' }}>

      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(37,99,235,0.25)' }}>
              <Users size={22} />
            </div>
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 24, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
                Candidate Directory & Access Control
              </h2>
              <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                Monitor candidates, inspect individual profiles, and configure platform access permissions in real time.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Alert Notifications */}
      {errorMsg && (
        <div style={{ padding: '12px 16px', borderRadius: 12, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: 13, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShieldAlert size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div style={{ padding: '12px 16px', borderRadius: 12, background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#059669', fontSize: 13, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Analytics Metric Cards (White Theme) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={20} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>Total Candidates</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', fontFamily: 'var(--font-display)' }}>{totalCount}</div>
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <UserCheck size={20} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>Access Allowed</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#059669', fontFamily: 'var(--font-display)' }}>{activeCount}</div>
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#fef2f2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <UserX size={20} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>Access Revoked</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#dc2626', fontFamily: 'var(--font-display)' }}>{suspendedCount}</div>
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#fffbe8', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Crown size={20} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>Premium Members</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#d97706', fontFamily: 'var(--font-display)' }}>{premiumCount}</div>
          </div>
        </div>
      </div>

      {/* Main Table Container (White Theme) */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 20, padding: 0, boxShadow: '0 4px 20px rgba(0,0,0,0.04)', overflow: 'hidden' }}>

        {/* Controls Toolbar: Search & Filters */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', gap: 16, flexWrap: 'wrap' }}>

          {/* Search Box */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: '#f8fafc', borderRadius: 10, padding: '8px 14px', border: '1px solid #cbd5e1', width: 320 }}>
            <Search size={16} color="#94a3b8" />
            <input
              type="text"
              placeholder="Search candidate name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: 13,
                color: '#0f172a',
                width: '100%'
              }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}>
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filter Dropdowns */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748b', fontFamily: 'var(--font-mono)' }}>
              <Filter size={14} />
              <span>Access Filter:</span>
            </div>

            {/* Access Filter */}
            <select
              value={accessFilter}
              onChange={(e) => setAccessFilter(e.target.value)}
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: 8,
                color: '#0f172a',
                padding: '7px 12px',
                fontSize: 12,
                outline: 'none',
                cursor: 'pointer',
                fontWeight: 500
              }}
            >
              <option value="ALL">All Access</option>
              <option value="ACTIVE">Active (Allowed)</option>
              <option value="SUSPENDED">Suspended (Revoked)</option>
            </select>
          </div>

        </div>

        {/* Directory Table */}
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, gap: 10, color: '#2563eb' }}>
            <Loader2 className="animate-spin" size={24} />
            <span style={{ fontSize: 14, fontWeight: 600 }}>Loading live candidate directory...</span>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  {['Candidate Profile', 'Role', 'Subscription Plan', 'Access Status', 'Permissions', 'Actions'].map((h, idx) => (
                    <th
                      key={h}
                      style={{
                        padding: '14px 18px',
                        fontSize: 11,
                        fontWeight: 800,
                        color: '#475569',
                        fontFamily: 'var(--font-mono)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        borderBottom: '2px solid #e2e8f0',
                        borderTopLeftRadius: idx === 0 ? 12 : 0,
                        borderTopRightRadius: idx === 5 ? 12 : 0
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: 60, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                        <Users size={36} color="#cbd5e1" />
                        <span style={{ fontWeight: 600, color: '#64748b' }}>No candidate accounts found matching your search.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedUsers.map((u) => {
                    const isAccessAllowed = u.status === 'ACTIVE';
                    const isPremium = u.subscription_tier === 'PREMIUM' || u.student_profile?.subscription_tier === 'PREMIUM';

                    return (
                      <tr
                        key={u.id}
                        style={{ borderBottom: '1px solid #f1f5f9', transition: 'all 0.15s ease' }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        {/* Candidate Profile: Avatar, Name & Email */}
                        <td style={{ padding: '16px 18px', borderBottom: '1px solid #f1f5f9' }}>
                          <div
                            style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                            onClick={() => handleSelectCandidate(u)}
                          >
                            <div style={{
                              width: 40,
                              height: 40,
                              borderRadius: '50%',
                              background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                              color: '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 14,
                              fontWeight: 800,
                              boxShadow: '0 2px 8px rgba(37,99,235,0.2)',
                              border: '2px solid #ffffff',
                              flexShrink: 0
                            }}>
                              {u.full_name ? u.full_name.substring(0, 2).toUpperCase() : 'U'}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                  {u.full_name}
                                </span>
                                {u.is_verified && (
                                  <CheckCircle size={14} color="#059669" title="Verified Candidate" />
                                )}
                              </div>
                              <span style={{ fontSize: 12, color: '#64748b', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                {u.email}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Role Badge */}
                        <td style={{ padding: '16px 18px', borderBottom: '1px solid #f1f5f9' }}>
                          <span style={{
                            fontSize: 11,
                            fontWeight: 700,
                            background: u.role === 'SUPER_ADMIN' ? 'rgba(124, 58, 237, 0.1)' : u.role === 'ADMIN' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                            color: u.role === 'SUPER_ADMIN' ? '#7c3aed' : u.role === 'ADMIN' ? '#2563eb' : '#059669',
                            padding: '5px 12px',
                            borderRadius: 20,
                            border: `1px solid ${u.role === 'SUPER_ADMIN' ? 'rgba(124, 58, 237, 0.25)' : u.role === 'ADMIN' ? 'rgba(59, 130, 246, 0.25)' : 'rgba(16, 185, 129, 0.25)'}`
                          }}>
                            {u.role}
                          </span>
                        </td>

                        {/* Subscription Tier */}
                        <td style={{ padding: '16px 18px', borderBottom: '1px solid #f1f5f9' }}>
                          <span style={{
                            fontSize: 11,
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            background: isPremium ? '#fffbe8' : '#f8fafc',
                            color: isPremium ? '#b45309' : '#64748b',
                            padding: '5px 12px',
                            borderRadius: 10,
                            border: `1px solid ${isPremium ? '#fde68a' : '#e2e8f0'}`
                          }}>
                            {isPremium && <Crown size={13} color="#d97706" />}
                            {isPremium ? 'PREMIUM PRO' : 'FREE TIER'}
                          </span>
                        </td>

                        {/* Status Column */}
                        <td style={{ padding: '16px 18px', borderBottom: '1px solid #f1f5f9' }}>
                          <span style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: isAccessAllowed ? '#047857' : '#b91c1c',
                            backgroundColor: isAccessAllowed ? '#ecfdf5' : '#fef2f2',
                            padding: '4px 10px',
                            borderRadius: 12,
                            border: `1px solid ${isAccessAllowed ? '#a7f3d0' : '#fecaca'}`,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6
                          }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: isAccessAllowed ? '#10b981' : '#ef4444' }} />
                            {isAccessAllowed ? 'Active' : 'Suspended'}
                          </span>
                        </td>

                        {/* Access Permissions ("i" Info button popover) */}
                        <td style={{ padding: '16px 18px', position: 'relative', borderBottom: '1px solid #f1f5f9' }}>
                          <div style={{ position: 'relative', display: 'inline-block' }}>

                            {/* "i" Info Button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActivePopoverUserId(activePopoverUserId === u.id ? null : u.id);
                              }}
                              style={{
                                width: 34,
                                height: 34,
                                borderRadius: '50%',
                                border: '1px solid #bae6fd',
                                backgroundColor: activePopoverUserId === u.id ? '#0284c7' : '#f0f9ff',
                                color: activePopoverUserId === u.id ? '#ffffff' : '#0284c7',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                boxShadow: activePopoverUserId === u.id ? '0 0 0 3px rgba(2, 132, 199, 0.2)' : 'none'
                              }}
                              title="Access Control Permissions"
                            >
                              <Info size={17} />
                            </button>

                            {/* Floating Access Control Popover Card */}
                            {activePopoverUserId === u.id && (
                              <div
                                ref={popoverRef}
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  position: 'absolute',
                                  top: 42,
                                  left: 0,
                                  width: 250,
                                  backgroundColor: '#ffffff',
                                  borderRadius: 16,
                                  border: '1px solid #cbd5e1',
                                  boxShadow: '0 12px 32px rgba(0, 0, 0, 0.14)',
                                  padding: 16,
                                  zIndex: 100,
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 12
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: 8 }}>
                                  <span style={{ fontSize: 12, fontWeight: 800, color: '#0f172a' }}>Access Control</span>
                                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 12, backgroundColor: isAccessAllowed ? '#ecfdf5' : '#fef2f2', color: isAccessAllowed ? '#059669' : '#dc2626' }}>
                                    {isAccessAllowed ? 'Granted' : 'Revoked'}
                                  </span>
                                </div>

                                <p style={{ fontSize: 11, color: '#64748b', margin: 0, lineHeight: 1.4 }}>
                                  Configure platform access rights for <strong>{u.full_name}</strong>.
                                </p>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 2 }}>
                                  {/* Allow Access Button */}
                                  <button
                                    disabled={actionLoadingUserId === u.id || isAccessAllowed}
                                    onClick={() => handleUpdateAccess(u.id, 'ACTIVE')}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: 6,
                                      padding: '9px 12px',
                                      borderRadius: 10,
                                      border: '1px solid #10b981',
                                      backgroundColor: isAccessAllowed ? '#f0fdf4' : '#10b981',
                                      color: isAccessAllowed ? '#a7f3d0' : '#ffffff',
                                      fontSize: 12,
                                      fontWeight: 700,
                                      cursor: isAccessAllowed ? 'not-allowed' : 'pointer',
                                      transition: 'all 0.2s ease'
                                    }}
                                  >
                                    {actionLoadingUserId === u.id ? (
                                      <Loader2 size={14} className="animate-spin" />
                                    ) : (
                                      <>
                                        <UserCheck size={14} />
                                        <span>Allow Access</span>
                                      </>
                                    )}
                                  </button>

                                  {/* Revoke Access Button */}
                                  <button
                                    disabled={actionLoadingUserId === u.id || !isAccessAllowed}
                                    onClick={() => handleUpdateAccess(u.id, 'SUSPENDED')}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: 6,
                                      padding: '9px 12px',
                                      borderRadius: 10,
                                      border: '1px solid #ef4444',
                                      backgroundColor: !isAccessAllowed ? '#fef2f2' : '#ef4444',
                                      color: !isAccessAllowed ? '#fca5a5' : '#ffffff',
                                      fontSize: 12,
                                      fontWeight: 700,
                                      cursor: !isAccessAllowed ? 'not-allowed' : 'pointer',
                                      transition: 'all 0.2s ease'
                                    }}
                                  >
                                    {actionLoadingUserId === u.id ? (
                                      <Loader2 size={14} className="animate-spin" />
                                    ) : (
                                      <>
                                        <UserX size={14} />
                                        <span>Revoke Access</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            )}

                          </div>
                        </td>

                        {/* View Details Action */}
                        <td style={{ padding: '16px 18px', borderBottom: '1px solid #f1f5f9' }}>
                          <button
                            onClick={() => handleSelectCandidate(u)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '7px 14px',
                              borderRadius: 10,
                              border: '1px solid #cbd5e1',
                              backgroundColor: '#ffffff',
                              color: '#0f172a',
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#eff6ff';
                              e.currentTarget.style.borderColor = '#93c5fd';
                              e.currentTarget.style.color = '#2563eb';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = '#ffffff';
                              e.currentTarget.style.borderColor = '#cbd5e1';
                              e.currentTarget.style.color = '#0f172a';
                            }}
                          >
                            <span>View Profile</span>
                            <ChevronRight size={14} />
                          </button>
                        </td>

                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            {/* Table Footer Summary Bar with Interactive Pagination Controls */}
            <div style={{ padding: '14px 20px', borderTop: '1px solid #e2e8f0', backgroundColor: '#f8fafc', borderBottomLeftRadius: 20, borderBottomRightRadius: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, fontSize: 12, color: '#64748b' }}>
              <div>
                Showing <strong>{filteredUsers.length > 0 ? startIndex + 1 : 0}</strong> to <strong>{endIndex}</strong> of <strong>{filteredUsers.length}</strong> candidate accounts
              </div>

              {/* Pagination Page Controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    backgroundColor: currentPage === 1 ? '#f1f5f9' : '#ffffff',
                    color: currentPage === 1 ? '#94a3b8' : '#0f172a',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <ChevronLeft size={15} />
                  <span>Previous</span>
                </button>

                <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', padding: '0 8px', fontFamily: 'var(--font-mono)' }}>
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    backgroundColor: currentPage >= totalPages ? '#f1f5f9' : '#ffffff',
                    color: currentPage >= totalPages ? '#94a3b8' : '#0f172a',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span>Next</span>
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* Candidate Details Slide-Over Drawer */}
      {selectedCandidate && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(5px)', zIndex: 200, display: 'flex', justifyContent: 'flex-end' }}>

          <div
            style={{
              width: '100%',
              maxWidth: 440,
              backgroundColor: '#ffffff',
              height: '100vh',
              boxShadow: '-10px 0 40px rgba(15, 23, 42, 0.18)',
              display: 'flex',
              flexDirection: 'column',
              overflowY: 'auto',
              borderLeft: '1px solid #e2e8f0',
              position: 'relative'
            }}
          >
            {/* Minimal Top Close Bar (Without redundant Candidate Profile title header) */}
            <div style={{ padding: '14px 18px 6px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#ffffff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#10b981', boxShadow: '0 0 8px rgba(16, 185, 129, 0.6)' }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Live Candidate Details
                </span>
                {isDetailLoading && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#2563eb', backgroundColor: '#eff6ff', padding: '1px 6px', borderRadius: 8, fontWeight: 600 }}>
                    <Loader2 size={10} className="animate-spin" /> Syncing
                  </span>
                )}
              </div>

              <button
                onClick={() => setSelectedCandidate(null)}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: 6,
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f1f5f9';
                  e.currentTarget.style.color = '#0f172a';
                  e.currentTarget.style.boxShadow = '0 0 10px rgba(37, 99, 235, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#f8fafc';
                  e.currentTarget.style.color = '#64748b';
                  e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.03)';
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Drawer Main Body */}
            <div style={{ padding: '12px 20px 24px 20px', display: 'flex', flexDirection: 'column', gap: 18, flex: 1 }}>

              {/* Colorful Glow Hero Profile Card */}
              <div style={{
                padding: 18,
                borderRadius: 16,
                background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                boxShadow: '0 4px 20px rgba(37, 99, 235, 0.06)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  {/* Avatar with Vibrant Gradient & Soft Glow */}
                  <div style={{
                    width: 52,
                    height: 52,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 50%, #7c3aed 100%)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 20,
                    fontWeight: 800,
                    boxShadow: '0 0 16px rgba(79, 70, 229, 0.35)',
                    border: '2.5px solid #ffffff',
                    flexShrink: 0
                  }}>
                    {selectedCandidate.full_name ? selectedCandidate.full_name.substring(0, 2).toUpperCase() : 'U'}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', letterSpacing: '-0.01em' }}>
                        {selectedCandidate.full_name}
                      </span>
                      {selectedCandidate.is_verified && (
                        <CheckCircle size={16} color="#059669" title="Verified Candidate" />
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748b', fontFamily: 'var(--font-mono)' }}>
                      <Mail size={12} color="#3b82f6" />
                      <span style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{selectedCandidate.email}</span>
                    </div>

                    {/* Status Badges */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 12,
                        backgroundColor: selectedCandidate.role === 'SUPER_ADMIN' ? '#f3e8ff' : selectedCandidate.role === 'ADMIN' ? '#eff6ff' : '#ecfdf5',
                        color: selectedCandidate.role === 'SUPER_ADMIN' ? '#7c3aed' : selectedCandidate.role === 'ADMIN' ? '#2563eb' : '#059669',
                        border: `1px solid ${selectedCandidate.role === 'SUPER_ADMIN' ? '#ddd6fe' : selectedCandidate.role === 'ADMIN' ? '#bfdbfe' : '#a7f3d0'}`,
                        boxShadow: selectedCandidate.role === 'SUPER_ADMIN' ? '0 0 8px rgba(124, 58, 237, 0.15)' : '0 0 8px rgba(37, 99, 235, 0.12)'
                      }}>
                        {selectedCandidate.role}
                      </span>

                      <span style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 12,
                        backgroundColor: selectedCandidate.status === 'ACTIVE' ? '#ecfdf5' : '#fef2f2',
                        color: selectedCandidate.status === 'ACTIVE' ? '#059669' : '#dc2626',
                        border: `1px solid ${selectedCandidate.status === 'ACTIVE' ? '#a7f3d0' : '#fecaca'}`,
                        boxShadow: selectedCandidate.status === 'ACTIVE' ? '0 0 8px rgba(16, 185, 129, 0.15)' : '0 0 8px rgba(239, 68, 68, 0.15)'
                      }}>
                        {selectedCandidate.status === 'ACTIVE' ? 'Active' : 'Suspended'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Translucent Action Bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 12, borderTop: '1px solid #f1f5f9', flexWrap: 'wrap' }}>
                  <a
                    href={`mailto:${selectedCandidate.email}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '5px 12px',
                      borderRadius: 20,
                      backgroundColor: '#eff6ff',
                      color: '#2563eb',
                      border: '1px solid #bfdbfe',
                      fontSize: 11,
                      fontWeight: 600,
                      textDecoration: 'none',
                      transition: 'all 0.15s ease',
                      boxShadow: '0 2px 6px rgba(37, 99, 235, 0.08)'
                    }}
                  >
                    <Mail size={12} />
                    <span>Send Email</span>
                  </a>

                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(selectedCandidate.id);
                      setCopiedId(true);
                      setTimeout(() => setCopiedId(false), 2000);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '5px 12px',
                      borderRadius: 20,
                      backgroundColor: copiedId ? '#ecfdf5' : '#f8fafc',
                      color: copiedId ? '#059669' : '#475569',
                      border: `1px solid ${copiedId ? '#a7f3d0' : '#cbd5e1'}`,
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
                    }}
                  >
                    {copiedId ? <Check size={12} /> : <Copy size={12} />}
                    <span>{copiedId ? 'Copied ID!' : 'Copy Candidate ID'}</span>
                  </button>

                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '5px 12px',
                      borderRadius: 20,
                      backgroundColor: selectedCandidate.is_verified ? '#ecfdf5' : '#fffbe8',
                      color: selectedCandidate.is_verified ? '#059669' : '#b45309',
                      border: `1px solid ${selectedCandidate.is_verified ? '#a7f3d0' : '#fde68a'}`,
                      fontSize: 11,
                      fontWeight: 600,
                      boxShadow: selectedCandidate.is_verified ? '0 0 8px rgba(16, 185, 129, 0.12)' : '0 0 8px rgba(245, 158, 11, 0.12)'
                    }}
                  >
                    {selectedCandidate.is_verified ? <CheckCircle size={12} /> : <XCircle size={12} />}
                    <span>{selectedCandidate.is_verified ? 'Verified Account' : 'Pending Verification'}</span>
                  </div>
                </div>
              </div>

              {/* Colorful Glow Learning Metrics Grid (2x2 Grid) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Learning Metrics & Engagement
                </span>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {/* Streak Card with Blue Glow */}
                  <div style={{
                    padding: 12,
                    borderRadius: 12,
                    backgroundColor: '#ffffff',
                    border: '1px solid #dbeafe',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.06)'
                  }}>
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                      color: '#2563eb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 0 10px rgba(37, 99, 235, 0.2)',
                      flexShrink: 0
                    }}>
                      <Zap size={18} />
                    </div>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: '#64748b' }}>Streak</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#2563eb' }}>
                        {selectedCandidate.current_streak || selectedCandidate.student_profile?.current_streak || 0} Days
                      </div>
                    </div>
                  </div>

                  {/* Questions Solved Card with Emerald Glow */}
                  <div style={{
                    padding: 12,
                    borderRadius: 12,
                    backgroundColor: '#ffffff',
                    border: '1px solid #a7f3d0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.06)'
                  }}>
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
                      color: '#059669',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 0 10px rgba(16, 185, 129, 0.2)',
                      flexShrink: 0
                    }}>
                      <BookOpen size={18} />
                    </div>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: '#64748b' }}>Questions</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#059669' }}>
                        {selectedCandidate.free_questions_attempted || selectedCandidate.student_profile?.free_questions_attempted || 0} Solved
                      </div>
                    </div>
                  </div>

                  {/* Rank Level Card with Amber Glow */}
                  <div style={{
                    padding: 12,
                    borderRadius: 12,
                    backgroundColor: '#ffffff',
                    border: '1px solid #fde68a',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    boxShadow: '0 4px 12px rgba(245, 158, 11, 0.06)'
                  }}>
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: 'linear-gradient(135deg, #fffbe8 0%, #fef3c7 100%)',
                      color: '#d97706',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 0 10px rgba(245, 158, 11, 0.2)',
                      flexShrink: 0
                    }}>
                      <Crown size={18} />
                    </div>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: '#64748b' }}>Rank Level</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#d97706' }}>
                        Level {selectedCandidate.level || selectedCandidate.student_profile?.level || 1}
                      </div>
                    </div>
                  </div>

                  {/* Total XP Card with Purple Glow */}
                  <div style={{
                    padding: 12,
                    borderRadius: 12,
                    backgroundColor: '#ffffff',
                    border: '1px solid #ddd6fe',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    boxShadow: '0 4px 12px rgba(124, 58, 237, 0.06)'
                  }}>
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: 'linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%)',
                      color: '#7c3aed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 0 10px rgba(124, 58, 237, 0.2)',
                      flexShrink: 0
                    }}>
                      <Award size={18} />
                    </div>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: '#64748b' }}>Total XP</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#7c3aed' }}>
                        {selectedCandidate.total_xp || selectedCandidate.student_profile?.total_xp || 0} XP
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Subscription Tier Card */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Subscription Level
                </span>

                <div style={{
                  padding: 14,
                  borderRadius: 12,
                  backgroundColor: '#ffffff',
                  border: (selectedCandidate.subscription_tier === 'PREMIUM' || selectedCandidate.student_profile?.subscription_tier === 'PREMIUM') ? '1px solid #fde68a' : '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  boxShadow: (selectedCandidate.subscription_tier === 'PREMIUM' || selectedCandidate.student_profile?.subscription_tier === 'PREMIUM') ? '0 0 14px rgba(245, 158, 11, 0.12)' : '0 2px 8px rgba(0,0,0,0.02)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      backgroundColor: (selectedCandidate.subscription_tier === 'PREMIUM' || selectedCandidate.student_profile?.subscription_tier === 'PREMIUM') ? '#fffbe8' : '#f8fafc',
                      color: (selectedCandidate.subscription_tier === 'PREMIUM' || selectedCandidate.student_profile?.subscription_tier === 'PREMIUM') ? '#d97706' : '#64748b',
                      border: `1px solid ${(selectedCandidate.subscription_tier === 'PREMIUM' || selectedCandidate.student_profile?.subscription_tier === 'PREMIUM') ? '#fde68a' : '#cbd5e1'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: (selectedCandidate.subscription_tier === 'PREMIUM' || selectedCandidate.student_profile?.subscription_tier === 'PREMIUM') ? '0 0 10px rgba(245, 158, 11, 0.25)' : 'none',
                      flexShrink: 0
                    }}>
                      <Crown size={18} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                        {(selectedCandidate.subscription_tier === 'PREMIUM' || selectedCandidate.student_profile?.subscription_tier === 'PREMIUM') ? 'PREMIUM Pro Plan' : 'FREE Standard Tier'}
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>
                        {(selectedCandidate.subscription_tier === 'PREMIUM' || selectedCandidate.student_profile?.subscription_tier === 'PREMIUM') ? 'Full question bank & analytics active' : 'Standard candidate account limits applied'}
                      </div>
                    </div>
                  </div>

                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: 12,
                    backgroundColor: (selectedCandidate.subscription_tier === 'PREMIUM' || selectedCandidate.student_profile?.subscription_tier === 'PREMIUM') ? '#fffbe8' : '#eff6ff',
                    color: (selectedCandidate.subscription_tier === 'PREMIUM' || selectedCandidate.student_profile?.subscription_tier === 'PREMIUM') ? '#b45309' : '#2563eb',
                    border: `1px solid ${(selectedCandidate.subscription_tier === 'PREMIUM' || selectedCandidate.student_profile?.subscription_tier === 'PREMIUM') ? '#fde68a' : '#bfdbfe'}`
                  }}>
                    Active Tier
                  </span>
                </div>
              </div>

              {/* Account Metadata Grid */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Account System Details
                </span>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ padding: 11, borderRadius: 10, backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 10, color: '#64748b', marginBottom: 2 }}>Timezone</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', fontFamily: 'var(--font-mono)' }}>
                      {selectedCandidate.timezone || 'Asia/Kolkata'}
                    </div>
                  </div>

                  <div style={{ padding: 11, borderRadius: 10, backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 10, color: '#64748b', marginBottom: 2 }}>Registration Date</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', fontFamily: 'var(--font-mono)' }}>
                      {selectedCandidate.created_at ? new Date(selectedCandidate.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                    </div>
                  </div>

                  <div style={{ padding: 11, borderRadius: 10, backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 10, color: '#64748b', marginBottom: 2 }}>Last Profile Sync</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', fontFamily: 'var(--font-mono)' }}>
                      {selectedCandidate.updated_at ? new Date(selectedCandidate.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                    </div>
                  </div>

                  <div style={{ padding: 11, borderRadius: 10, backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 10, color: '#64748b', marginBottom: 2 }}>Verification</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: selectedCandidate.is_verified ? '#059669' : '#dc2626' }}>
                      {selectedCandidate.is_verified ? 'Verified ✅' : 'Unverified ❌'}
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Access Control Action Footer */}
            <div style={{ padding: '14px 20px', borderTop: '1px solid #e2e8f0', backgroundColor: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  disabled={actionLoadingUserId === selectedCandidate.id || selectedCandidate.status === 'ACTIVE'}
                  onClick={() => handleUpdateAccess(selectedCandidate.id, 'ACTIVE')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '7px 14px',
                    borderRadius: 8,
                    border: '1px solid #10b981',
                    backgroundColor: selectedCandidate.status === 'ACTIVE' ? '#ecfdf5' : '#10b981',
                    color: selectedCandidate.status === 'ACTIVE' ? '#059669' : '#ffffff',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: selectedCandidate.status === 'ACTIVE' ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: selectedCandidate.status === 'ACTIVE' ? 'none' : '0 0 10px rgba(16, 185, 129, 0.3)'
                  }}
                >
                  {actionLoadingUserId === selectedCandidate.id ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <>
                      <UserCheck size={13} />
                      <span>Allow Access</span>
                    </>
                  )}
                </button>

                <button
                  disabled={actionLoadingUserId === selectedCandidate.id || selectedCandidate.status === 'SUSPENDED'}
                  onClick={() => handleUpdateAccess(selectedCandidate.id, 'SUSPENDED')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '7px 14px',
                    borderRadius: 8,
                    border: '1px solid #ef4444',
                    backgroundColor: selectedCandidate.status === 'SUSPENDED' ? '#fef2f2' : '#ef4444',
                    color: selectedCandidate.status === 'SUSPENDED' ? '#dc2626' : '#ffffff',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: selectedCandidate.status === 'SUSPENDED' ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: selectedCandidate.status === 'SUSPENDED' ? 'none' : '0 0 10px rgba(239, 68, 68, 0.3)'
                  }}
                >
                  {actionLoadingUserId === selectedCandidate.id ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <>
                      <UserX size={13} />
                      <span>Revoke Access</span>
                    </>
                  )}
                </button>
              </div>

              <button
                onClick={() => setSelectedCandidate(null)}
                style={{
                  padding: '7px 14px',
                  borderRadius: 8,
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  fontSize: 12,
                  fontWeight: 600,
                  border: '1px solid #cbd5e1',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f1f5f9';
                  e.currentTarget.style.color = '#0f172a';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#ffffff';
                  e.currentTarget.style.color = '#475569';
                }}
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
