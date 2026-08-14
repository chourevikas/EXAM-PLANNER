import React, { useEffect, useState, useRef } from 'react';
import {
  Users,
  Search,
  ShieldAlert,
  CheckCircle,
  XCircle,
  Loader2,
  Mail,
  X,
  ChevronRight,
  ChevronLeft,
  Filter,
  Copy,
  Check,
  MoreVertical,
  AlertTriangle,
} from 'lucide-react';
import { fetchAllUsers, updateUserStatus } from '../../../services/adminService';
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
  const [subscriptionFilter, setSubscriptionFilter] = useState<string>('ALL');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const ITEMS_PER_PAGE = 8;

  // 3-Dot Action Menu Popover State
  const [activeMenuUserId, setActiveMenuUserId] = useState<string | null>(null);

  // Candidate Detail Drawer State
  const [selectedCandidate, setSelectedCandidate] = useState<User | null>(null);
  const [actionLoadingUserId, setActionLoadingUserId] = useState<string | null>(null);

  // Revoke Access Confirmation Modal State
  const [revokingUser, setRevokingUser] = useState<User | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, accessFilter, subscriptionFilter, roleFilter]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenuUserId(null);
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
      setUsersList((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, status: updatedUser.status || (newStatus as UserStatus) } : u))
      );
      if (selectedCandidate && selectedCandidate.id === userId) {
        setSelectedCandidate((prev) => (prev ? { ...prev, status: newStatus as UserStatus } : null));
      }
      setSuccessMsg(`Access state updated to ${newStatus === 'ACTIVE' ? 'Granted' : 'Revoked'} successfully.`);
      setActiveMenuUserId(null);
      setRevokingUser(null);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      console.error('Failed to update access:', err);
      setErrorMsg(err.message || 'Failed to update access status.');
    } finally {
      setActionLoadingUserId(null);
    }
  };

  // Filtered Users (Hide Super Admin)
  const filteredUsers = usersList.filter((user) => {
    if (user.role === 'SUPER_ADMIN') return false;

    const matchesSearch =
      !searchQuery ||
      user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesAccess = accessFilter === 'ALL' || user.status === accessFilter;

    const userTier = user.subscription_tier || user.student_profile?.subscription_tier || 'FREE';
    const matchesSubscription = subscriptionFilter === 'ALL' || userTier === subscriptionFilter;

    const matchesRole = roleFilter === 'ALL' || user.role === roleFilter;

    return matchesSearch && matchesAccess && matchesSubscription && matchesRole;
  });

  // Pagination Calculations
  const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, filteredUsers.length);
  const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

  // Summary Metrics
  const totalCount = usersList.filter((u) => u.role !== 'SUPER_ADMIN').length;
  const activeCount = usersList.filter((u) => u.role !== 'SUPER_ADMIN' && u.status === 'ACTIVE').length;
  const suspendedCount = usersList.filter((u) => u.role !== 'SUPER_ADMIN' && u.status === 'SUSPENDED').length;
  const premiumCount = usersList.filter(
    (u) =>
      u.role !== 'SUPER_ADMIN' &&
      (u.subscription_tier === 'PREMIUM' || u.student_profile?.subscription_tier === 'PREMIUM')
  ).length;

  const hasActiveFilters =
    searchQuery !== '' || accessFilter !== 'ALL' || subscriptionFilter !== 'ALL' || roleFilter !== 'ALL';

  const clearFilters = () => {
    setSearchQuery('');
    setAccessFilter('ALL');
    setSubscriptionFilter('ALL');
    setRoleFilter('ALL');
  };

  return (
    <div style={{ maxWidth: 1320, margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      {/* 1. PAGE HEADER (Sitting directly on off-white background) */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#172033', margin: 0, letterSpacing: '-0.02em' }}>
          Candidate Directory
        </h1>
        <p style={{ fontSize: 14, color: '#667085', marginTop: 4, margin: '4px 0 0 0' }}>
          Manage candidate accounts, access permissions, subscription status, and candidate activity.
        </p>
      </div>

      {/* Alert Banners */}
      {errorMsg && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 6,
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECDCA',
            color: '#B42318',
            fontSize: 13,
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <ShieldAlert size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 6,
            backgroundColor: '#DCFCE7',
            border: '1px solid #BBF7D0',
            color: '#15803D',
            fontSize: 13,
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <CheckCircle size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* 2. COMPACT TOP SUMMARY STRIP (~68px height) */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #E4E7EC',
          borderRadius: 6,
          padding: '12px 20px',
          marginBottom: 20,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 16,
          alignItems: 'center',
          boxShadow: '0 1px 2px rgba(16,24,40,0.02)',
        }}
      >
        <div style={{ paddingRight: 12, borderRight: '1px solid #E4E7EC' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#667085', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            TOTAL CANDIDATES
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#172033', marginTop: 2 }}>
            {totalCount}
          </div>
        </div>

        <div style={{ paddingRight: 12, borderRight: '1px solid #E4E7EC' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#667085', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            ACTIVE ACCESS
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#15803D', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>{activeCount}</span>
            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#15803D' }} />
          </div>
        </div>

        <div style={{ paddingRight: 12, borderRight: '1px solid #E4E7EC' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#667085', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            ACCESS REVOKED
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: suspendedCount > 0 ? '#B42318' : '#172033', marginTop: 2 }}>
            {suspendedCount}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#667085', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            PREMIUM MEMBERS
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#172033', marginTop: 2 }}>
            {premiumCount}
          </div>
        </div>
      </div>

      {/* 3. SEARCH & FILTER TOOLBAR (~42px height) */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          marginBottom: 16,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        {/* Search Field */}
        <div style={{ position: 'relative', flex: 1, minWidth: 280 }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: 12, color: '#667085' }} />
          <input
            type="text"
            placeholder="Search by candidate name or email..."
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
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ position: 'absolute', right: 10, top: 11, background: 'none', border: 'none', color: '#667085', cursor: 'pointer' }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Access Status Filter */}
        <select
          value={accessFilter}
          onChange={(e) => setAccessFilter(e.target.value)}
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
          <option value="ALL">Access Status: All</option>
          <option value="ACTIVE">Active (Granted)</option>
          <option value="SUSPENDED">Suspended (Revoked)</option>
        </select>

        {/* Subscription Filter */}
        <select
          value={subscriptionFilter}
          onChange={(e) => setSubscriptionFilter(e.target.value)}
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
          <option value="ALL">Subscription: All</option>
          <option value="FREE">Free Tier</option>
          <option value="PREMIUM">Premium Pro</option>
        </select>

        {/* Role Filter */}
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
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
          <option value="ALL">Role: All</option>
          <option value="STUDENT">Student</option>
          <option value="ADMIN">Admin</option>
        </select>

        {/* Clear Filters Action */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            style={{
              background: 'none',
              border: 'none',
              color: '#3B6EA8',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              padding: '0 4px',
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* 4. CANDIDATE DIRECTORY TABLE */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #E4E7EC',
          borderRadius: 6,
          boxShadow: '0 1px 2px rgba(16, 24, 40, 0.02)',
          overflow: 'hidden',
        }}
      >
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#667085', fontSize: 13 }}>
            <Loader2 className="animate-spin" size={20} style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle' }} />
            Loading candidate directory...
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13.5 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E4E7EC', backgroundColor: '#F7F7F5' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#667085', fontSize: 12 }}>CANDIDATE</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#667085', fontSize: 12 }}>ROLE</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#667085', fontSize: 12 }}>PLAN</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#667085', fontSize: 12 }}>ACCESS</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#667085', fontSize: 12 }}>VERIFICATION</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#667085', fontSize: 12 }}>LAST ACTIVE</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#667085', fontSize: 12, textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '40px 16px', textAlign: 'center', color: '#667085', fontSize: 13 }}>
                      No candidate accounts found matching search or filter parameters.
                    </td>
                  </tr>
                ) : (
                  paginatedUsers.map((u, i) => {
                    const isAccessAllowed = u.status === 'ACTIVE';
                    const isPremium = u.subscription_tier === 'PREMIUM' || u.student_profile?.subscription_tier === 'PREMIUM';

                    return (
                      <tr
                        key={u.id}
                        style={{
                          borderBottom: i === paginatedUsers.length - 1 ? 'none' : '1px solid #E4E7EC',
                          transition: 'background 0.12s ease',
                          height: 64,
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F7F7F5')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        {/* 1. CANDIDATE */}
                        <td style={{ padding: '12px 16px' }}>
                          <div
                            style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                            onClick={() => setSelectedCandidate(u)}
                          >
                            <div
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: '50%',
                                backgroundColor: '#F7F7F5',
                                border: '1px solid #E4E7EC',
                                color: '#172033',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 13,
                                fontWeight: 700,
                                flexShrink: 0,
                              }}
                            >
                              {u.full_name ? u.full_name.substring(0, 2).toUpperCase() : 'U'}
                            </div>
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 600, color: '#172033' }}>
                                {u.full_name || 'Candidate Account'}
                              </div>
                              <div style={{ fontSize: 12, color: '#667085', fontFamily: 'monospace', marginTop: 1 }}>
                                {u.email}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 2. ROLE */}
                        <td style={{ padding: '12px 16px', color: '#344054', fontSize: 13 }}>
                          <span style={{ fontSize: 12, fontWeight: 500, color: '#475467' }}>
                            {u.role || 'STUDENT'}
                          </span>
                        </td>

                        {/* 3. PLAN */}
                        <td style={{ padding: '12px 16px' }}>
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 500,
                              color: isPremium ? '#15803D' : '#667085',
                            }}
                          >
                            {isPremium ? 'PREMIUM' : 'FREE'}
                          </span>
                        </td>

                        {/* 4. ACCESS */}
                        <td style={{ padding: '12px 16px' }}>
                          <span
                            style={{
                              fontSize: 12.5,
                              fontWeight: 500,
                              color: isAccessAllowed ? '#15803D' : '#B42318',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                            }}
                          >
                            <span
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                backgroundColor: isAccessAllowed ? '#15803D' : '#B42318',
                              }}
                            />
                            {isAccessAllowed ? 'Active' : 'Revoked'}
                          </span>
                        </td>

                        {/* 5. VERIFICATION */}
                        <td style={{ padding: '12px 16px' }}>
                          <span
                            style={{
                              fontSize: 12.5,
                              fontWeight: 500,
                              color: u.is_verified ? '#15803D' : '#B45309',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            {u.is_verified ? <Check size={14} color="#15803D" /> : <AlertTriangle size={13} color="#B45309" />}
                            <span>{u.is_verified ? 'Verified' : 'Unverified'}</span>
                          </span>
                        </td>

                        {/* 6. LAST ACTIVE */}
                        <td style={{ padding: '12px 16px', color: '#667085', fontSize: 12.5 }}>
                          {u.updated_at ? 'Today, 10:42 AM' : '3 days ago'}
                        </td>

                        {/* 7. ACTIONS (View Profile + 3-Dot Overflow Menu) */}
                        <td style={{ padding: '12px 16px', textAlign: 'right', position: 'relative' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <button
                              onClick={() => setSelectedCandidate(u)}
                              style={{
                                padding: '4px 10px',
                                fontSize: 12.5,
                                fontWeight: 500,
                                color: '#172033',
                                background: '#FFFFFF',
                                border: '1px solid #E4E7EC',
                                borderRadius: 4,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                transition: 'all 0.15s ease',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'rgba(59, 110, 168, 0.06)';
                                e.currentTarget.style.borderColor = '#3B6EA8';
                                e.currentTarget.style.color = '#3B6EA8';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = '#FFFFFF';
                                e.currentTarget.style.borderColor = '#E4E7EC';
                                e.currentTarget.style.color = '#172033';
                              }}
                            >
                              <span>View Profile</span>
                              <span>→</span>
                            </button>

                            {/* 3-Dot Overflow Menu Trigger */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuUserId(activeMenuUserId === u.id ? null : u.id);
                              }}
                              style={{
                                padding: 6,
                                background: '#FFFFFF',
                                border: '1px solid #E4E7EC',
                                borderRadius: 4,
                                color: '#667085',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <MoreVertical size={14} />
                            </button>

                            {/* Overflow Dropdown Card */}
                            {activeMenuUserId === u.id && (
                              <div
                                ref={menuRef}
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  position: 'absolute',
                                  right: 0,
                                  top: 42,
                                  width: 170,
                                  backgroundColor: '#FFFFFF',
                                  border: '1px solid #E4E7EC',
                                  borderRadius: 6,
                                  boxShadow: '0 4px 12px rgba(16,24,40,0.1)',
                                  zIndex: 100,
                                  padding: 4,
                                  textAlign: 'left',
                                }}
                              >
                                <button
                                  onClick={() => {
                                    setSelectedCandidate(u);
                                    setActiveMenuUserId(null);
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '7px 10px',
                                    fontSize: 12.5,
                                    color: '#172033',
                                    border: 'none',
                                    background: 'none',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    borderRadius: 4,
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F7F7F5')}
                                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                >
                                  View Profile
                                </button>

                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(u.id);
                                    setCopiedId(true);
                                    setActiveMenuUserId(null);
                                    setTimeout(() => setCopiedId(false), 2000);
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '7px 10px',
                                    fontSize: 12.5,
                                    color: '#172033',
                                    border: 'none',
                                    background: 'none',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    borderRadius: 4,
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F7F7F5')}
                                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                >
                                  Copy Candidate ID
                                </button>

                                <a
                                  href={`mailto:${u.email}`}
                                  style={{
                                    display: 'block',
                                    padding: '7px 10px',
                                    fontSize: 12.5,
                                    color: '#172033',
                                    textDecoration: 'none',
                                    borderRadius: 4,
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F7F7F5')}
                                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                >
                                  Send Email
                                </a>

                                <hr style={{ border: 'none', borderTop: '1px solid #E4E7EC', margin: '4px 0' }} />

                                {isAccessAllowed ? (
                                  <button
                                    onClick={() => {
                                      setRevokingUser(u);
                                      setActiveMenuUserId(null);
                                    }}
                                    style={{
                                      width: '100%',
                                      padding: '7px 10px',
                                      fontSize: 12.5,
                                      color: '#B42318',
                                      border: 'none',
                                      background: 'none',
                                      cursor: 'pointer',
                                      textAlign: 'left',
                                      borderRadius: 4,
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#FEF2F2')}
                                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                  >
                                    Revoke Access
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleUpdateAccess(u.id, 'ACTIVE')}
                                    style={{
                                      width: '100%',
                                      padding: '7px 10px',
                                      fontSize: 12.5,
                                      color: '#15803D',
                                      border: 'none',
                                      background: 'none',
                                      cursor: 'pointer',
                                      textAlign: 'left',
                                      borderRadius: 4,
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#DCFCE7')}
                                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                  >
                                    Grant Access
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. CLEAN PAGINATION FOOTER */}
      {filteredUsers.length > 0 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 16,
            fontSize: 13,
            color: '#667085',
          }}
        >
          <div>
            Showing {startIndex + 1}–{endIndex} of {filteredUsers.length} candidates
          </div>

          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              style={{
                padding: '5px 10px',
                borderRadius: 4,
                border: '1px solid #E4E7EC',
                background: '#FFFFFF',
                color: currentPage === 1 ? '#94A3B8' : '#172033',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                fontSize: 12.5,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <ChevronLeft size={14} /> Previous
            </button>

            {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((pg) => (
              <button
                key={pg}
                onClick={() => setCurrentPage(pg)}
                style={{
                  padding: '5px 10px',
                  borderRadius: 4,
                  border: '1px solid #E4E7EC',
                  background: currentPage === pg ? '#12233F' : '#FFFFFF',
                  color: currentPage === pg ? '#FFFFFF' : '#172033',
                  cursor: 'pointer',
                  fontSize: 12.5,
                  fontWeight: currentPage === pg ? 600 : 400,
                }}
              >
                {pg}
              </button>
            ))}

            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              style={{
                padding: '5px 10px',
                borderRadius: 4,
                border: '1px solid #E4E7EC',
                background: '#FFFFFF',
                color: currentPage === totalPages ? '#94A3B8' : '#172033',
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                fontSize: 12.5,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* 6. REVOKE ACCESS CONFIRMATION MODAL */}
      {revokingUser && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(16, 33, 61, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: 16,
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 8,
              border: '1px solid #E4E7EC',
              width: '100%',
              maxWidth: 420,
              padding: 24,
              boxShadow: '0 4px 16px rgba(16, 24, 40, 0.12)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#B42318', marginBottom: 12 }}>
              <AlertTriangle size={20} />
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#172033' }}>
                Revoke platform access?
              </h3>
            </div>

            <p style={{ fontSize: 13.5, color: '#667085', margin: '0 0 20px 0', lineHeight: 1.5 }}>
              Candidate <strong style={{ color: '#172033' }}>{revokingUser.full_name}</strong> will no longer be able to log in or access examination papers.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => setRevokingUser(null)}
                style={{
                  padding: '8px 16px',
                  fontSize: 13,
                  fontWeight: 500,
                  color: '#667085',
                  background: '#FFFFFF',
                  border: '1px solid #E4E7EC',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>

              <button
                onClick={() => handleUpdateAccess(revokingUser.id, 'SUSPENDED')}
                disabled={actionLoadingUserId === revokingUser.id}
                style={{
                  padding: '8px 18px',
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#FFFFFF',
                  background: '#B42318',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {actionLoadingUserId === revokingUser.id ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : null}
                <span>Revoke Access</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. CANDIDATE DETAILS SLIDE-OVER DRAWER */}
      {selectedCandidate && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(16, 33, 61, 0.35)',
            display: 'flex',
            justifyContent: 'flex-end',
            zIndex: 1000,
          }}
          onClick={() => setSelectedCandidate(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 520,
              backgroundColor: '#FFFFFF',
              height: '100vh',
              boxShadow: '-4px 0 20px rgba(16,24,40,0.08)',
              display: 'flex',
              flexDirection: 'column',
              borderLeft: '1px solid #E4E7EC',
            }}
          >
            {/* 1. FIXED DRAWER HEADER */}
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid #E4E7EC',
                backgroundColor: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: '#172033', margin: 0, letterSpacing: '-0.01em' }}>
                  Candidate Profile
                </h3>
                <div style={{ fontSize: 12, color: '#667085', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'monospace' }}>
                  <span>Candidate ID: {selectedCandidate.id}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(selectedCandidate.id);
                      setCopiedId(true);
                      setTimeout(() => setCopiedId(false), 2000);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: copiedId ? '#15803D' : '#3B6EA8',
                      cursor: 'pointer',
                      fontSize: 11.5,
                      padding: 0,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 3,
                    }}
                  >
                    {copiedId ? <Check size={12} /> : <Copy size={12} />}
                    <span>{copiedId ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              <button
                onClick={() => setSelectedCandidate(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#667085',
                  cursor: 'pointer',
                  padding: 4,
                  borderRadius: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* SCROLLABLE DRAWER BODY */}
            <div style={{ padding: 24, flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* 1. CANDIDATE IDENTITY SUMMARY CARD */}
              <div
                style={{
                  padding: 16,
                  borderRadius: 6,
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E4E7EC',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      backgroundColor: '#F7F7F5',
                      border: '1px solid #E4E7EC',
                      color: '#172033',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 18,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {selectedCandidate.full_name ? selectedCandidate.full_name.substring(0, 2).toUpperCase() : 'U'}
                  </div>

                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontSize: 17, fontWeight: 700, color: '#172033' }}>
                      {selectedCandidate.full_name || 'Candidate Account'}
                    </div>
                    <div style={{ fontSize: 13, color: '#667085', marginTop: 1, fontFamily: 'monospace' }}>
                      {selectedCandidate.email}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, fontSize: 12, color: '#667085' }}>
                      <span>Role: <strong style={{ color: '#172033' }}>{selectedCandidate.role}</strong></span>
                      <span>•</span>
                      <span>Access: <strong style={{ color: selectedCandidate.status === 'ACTIVE' ? '#15803D' : '#B42318' }}>{selectedCandidate.status === 'ACTIVE' ? 'Granted' : 'Revoked'}</strong></span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. QUICK ACTIONS ROW */}
              <div>
                <h4 style={{ fontSize: 11.5, fontWeight: 700, color: '#667085', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 10px 0' }}>
                  QUICK ACTIONS
                </h4>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <a
                    href={`mailto:${selectedCandidate.email}`}
                    style={{
                      padding: '7px 14px',
                      borderRadius: 4,
                      border: '1px solid #E4E7EC',
                      backgroundColor: '#FFFFFF',
                      color: '#172033',
                      fontSize: 12.5,
                      fontWeight: 500,
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Mail size={13} color="#667085" />
                    <span>Send email</span>
                  </a>

                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(selectedCandidate.id);
                      setCopiedId(true);
                      setTimeout(() => setCopiedId(false), 2000);
                    }}
                    style={{
                      padding: '7px 14px',
                      borderRadius: 4,
                      border: '1px solid #E4E7EC',
                      backgroundColor: '#FFFFFF',
                      color: '#172033',
                      fontSize: 12.5,
                      fontWeight: 500,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Copy size={13} color="#667085" />
                    <span>Copy Candidate ID</span>
                  </button>

                  {selectedCandidate.status === 'ACTIVE' ? (
                    <button
                      onClick={() => setRevokingUser(selectedCandidate)}
                      style={{
                        padding: '7px 14px',
                        borderRadius: 4,
                        border: '1px solid #FECDCA',
                        backgroundColor: '#FFFFFF',
                        color: '#B42318',
                        fontSize: 12.5,
                        fontWeight: 500,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <span>Revoke Access</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleUpdateAccess(selectedCandidate.id, 'ACTIVE')}
                      style={{
                        padding: '7px 14px',
                        borderRadius: 4,
                        border: 'none',
                        backgroundColor: '#12233F',
                        color: '#FFFFFF',
                        fontSize: 12.5,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <span>Grant Access</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 3. CANDIDATE INFORMATION */}
              <div>
                <h4 style={{ fontSize: 11.5, fontWeight: 700, color: '#667085', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 10px 0' }}>
                  CANDIDATE INFORMATION
                </h4>

                <div style={{ padding: '12px 16px', borderRadius: 6, backgroundColor: '#FFFFFF', border: '1px solid #E4E7EC', display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid #F2F4F7' }}>
                    <span style={{ color: '#667085' }}>Role:</span>
                    <span style={{ color: '#172033', fontWeight: 600 }}>{selectedCandidate.role}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid #F2F4F7' }}>
                    <span style={{ color: '#667085' }}>Email:</span>
                    <span style={{ color: '#172033', fontFamily: 'monospace' }}>{selectedCandidate.email}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid #F2F4F7' }}>
                    <span style={{ color: '#667085' }}>Candidate ID:</span>
                    <span style={{ color: '#667085', fontFamily: 'monospace' }}>{selectedCandidate.id}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid #F2F4F7' }}>
                    <span style={{ color: '#667085' }}>Registration Date:</span>
                    <span style={{ color: '#172033', fontWeight: 500 }}>{new Date(selectedCandidate.created_at).toLocaleDateString()}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#667085' }}>Verification:</span>
                    <span style={{ color: selectedCandidate.is_verified ? '#15803D' : '#B45309', fontWeight: 500 }}>
                      {selectedCandidate.is_verified ? 'Verified' : 'Unverified'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 4. EXAM PREPARATION SECTION */}
              <div>
                <h4 style={{ fontSize: 11.5, fontWeight: 700, color: '#667085', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 10px 0' }}>
                  EXAM PREPARATION
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  <div style={{ padding: 12, borderRadius: 6, backgroundColor: '#FFFFFF', border: '1px solid #E4E7EC' }}>
                    <div style={{ fontSize: 11.5, color: '#667085', marginBottom: 3 }}>Target Exam</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#172033' }}>UPSC CSE Prelims</div>
                  </div>

                  <div style={{ padding: 12, borderRadius: 6, backgroundColor: '#FFFFFF', border: '1px solid #E4E7EC' }}>
                    <div style={{ fontSize: 11.5, color: '#667085', marginBottom: 3 }}>Target Attempt</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#172033' }}>2026 — Attempt #1</div>
                  </div>

                  <div style={{ padding: 12, borderRadius: 6, backgroundColor: '#FFFFFF', border: '1px solid #E4E7EC' }}>
                    <div style={{ fontSize: 11.5, color: '#667085', marginBottom: 3 }}>Medium</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#172033' }}>English (GS-1)</div>
                  </div>
                </div>
              </div>

              {/* 5. SUBSCRIPTION SECTION */}
              <div>
                <h4 style={{ fontSize: 11.5, fontWeight: 700, color: '#667085', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 10px 0' }}>
                  SUBSCRIPTION
                </h4>

                <div
                  style={{
                    padding: 16,
                    borderRadius: 6,
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E4E7EC',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#172033' }}>
                      {selectedCandidate.subscription_tier === 'PREMIUM' ? 'PREMIUM Pro Plan' : 'Free Standard'}
                    </div>
                    <div style={{ fontSize: 12.5, color: '#667085', marginTop: 2 }}>
                      {selectedCandidate.subscription_tier === 'PREMIUM'
                        ? 'Full question bank & AI analytics active'
                        : 'Basic candidate access limits'}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 500, color: '#15803D' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#15803D' }} />
                    <span>Active Plan</span>
                  </div>
                </div>
              </div>

              {/* 6. ACCOUNT & SECURITY */}
              <div>
                <h4 style={{ fontSize: 11.5, fontWeight: 700, color: '#667085', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 10px 0' }}>
                  ACCOUNT & SECURITY
                </h4>

                <div style={{ padding: '12px 16px', borderRadius: 6, backgroundColor: '#FFFFFF', border: '1px solid #E4E7EC', display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid #F2F4F7' }}>
                    <span style={{ color: '#667085' }}>Verification:</span>
                    <span style={{ color: selectedCandidate.is_verified ? '#15803D' : '#B45309', fontWeight: 500 }}>
                      {selectedCandidate.is_verified ? 'Verified' : 'Unverified'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid #F2F4F7' }}>
                    <span style={{ color: '#667085' }}>Registration Date:</span>
                    <span style={{ color: '#172033', fontWeight: 500 }}>{new Date(selectedCandidate.created_at).toLocaleDateString()}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid #F2F4F7' }}>
                    <span style={{ color: '#667085' }}>Last Login:</span>
                    <span style={{ color: '#667085', fontFamily: 'monospace' }}>Today, 10:42 AM</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#667085' }}>Account Status:</span>
                    <span style={{ color: selectedCandidate.status === 'ACTIVE' ? '#15803D' : '#B42318', fontWeight: 500 }}>
                      {selectedCandidate.status === 'ACTIVE' ? 'Active' : 'Suspended'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 7. LEARNING ACTIVITY */}
              <div>
                <h4 style={{ fontSize: 11.5, fontWeight: 700, color: '#667085', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 10px 0' }}>
                  LEARNING ACTIVITY
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 12 }}>
                  <div style={{ padding: 12, borderRadius: 6, backgroundColor: '#FFFFFF', border: '1px solid #E4E7EC', textAlign: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#172033' }}>
                      {selectedCandidate.free_questions_attempted || selectedCandidate.student_profile?.free_questions_attempted || 0}
                    </div>
                    <div style={{ fontSize: 11, color: '#667085', marginTop: 2 }}>Questions</div>
                  </div>

                  <div style={{ padding: 12, borderRadius: 6, backgroundColor: '#FFFFFF', border: '1px solid #E4E7EC', textAlign: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#172033' }}>
                      {selectedCandidate.current_streak || selectedCandidate.student_profile?.current_streak || 0}
                    </div>
                    <div style={{ fontSize: 11, color: '#667085', marginTop: 2 }}>Streak (days)</div>
                  </div>

                  <div style={{ padding: 12, borderRadius: 6, backgroundColor: '#FFFFFF', border: '1px solid #E4E7EC', textAlign: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#172033' }}>0</div>
                    <div style={{ fontSize: 11, color: '#667085', marginTop: 2 }}>XP</div>
                  </div>

                  <div style={{ padding: 12, borderRadius: 6, backgroundColor: '#FFFFFF', border: '1px solid #E4E7EC', textAlign: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#172033' }}>
                      Lvl {selectedCandidate.level || selectedCandidate.student_profile?.level || 1}
                    </div>
                    <div style={{ fontSize: 11, color: '#667085', marginTop: 2 }}>Level</div>
                  </div>
                </div>
              </div>

              {/* 8. ACCESS CONTROL ACTIONS */}
              <div>
                <h4 style={{ fontSize: 11.5, fontWeight: 700, color: '#667085', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 10px 0' }}>
                  ACCESS CONTROL
                </h4>

                <div style={{ padding: 14, borderRadius: 6, backgroundColor: '#FFFFFF', border: '1px solid #E4E7EC', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: selectedCandidate.status === 'ACTIVE' ? '#15803D' : '#B42318' }}>
                      {selectedCandidate.status === 'ACTIVE' ? 'Access Granted' : 'Access Revoked'}
                    </div>
                  </div>

                  {selectedCandidate.status === 'ACTIVE' ? (
                    <button
                      onClick={() => setRevokingUser(selectedCandidate)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 4,
                        border: '1px solid #FECDCA',
                        backgroundColor: '#FFFFFF',
                        color: '#B42318',
                        fontSize: 12.5,
                        fontWeight: 500,
                        cursor: 'pointer',
                      }}
                    >
                      Revoke Access
                    </button>
                  ) : (
                    <button
                      onClick={() => handleUpdateAccess(selectedCandidate.id, 'ACTIVE')}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 4,
                        border: 'none',
                        backgroundColor: '#12233F',
                        color: '#FFFFFF',
                        fontSize: 12.5,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Grant Access
                    </button>
                  )}
                </div>
              </div>

              {/* 9. RECENT AUDIT TIMELINE */}
              <div>
                <h4 style={{ fontSize: 11.5, fontWeight: 700, color: '#667085', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 10px 0' }}>
                  RECENT ACTIVITY
                </h4>

                <div style={{ padding: '12px 16px', borderRadius: 6, backgroundColor: '#F7F7F5', border: '1px solid #E4E7EC', display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5, color: '#667085' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Account created</span>
                    <strong style={{ color: '#172033' }}>{new Date(selectedCandidate.created_at).toLocaleDateString()}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Access granted</span>
                    <strong style={{ color: '#172033' }}>{new Date(selectedCandidate.created_at).toLocaleDateString()}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Profile viewed</span>
                    <strong style={{ color: '#172033' }}>Today, 10:42 AM</strong>
                  </div>
                </div>
              </div>

              {/* DRAWER FOOTER CLOSE ACTION */}
              <div style={{ paddingTop: 16, borderTop: '1px solid #E4E7EC', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setSelectedCandidate(null)}
                  style={{
                    padding: '8px 18px',
                    borderRadius: 6,
                    backgroundColor: '#FFFFFF',
                    color: '#172033',
                    fontSize: 13,
                    fontWeight: 500,
                    border: '1px solid #E4E7EC',
                    cursor: 'pointer',
                  }}
                >
                  Close Profile
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
