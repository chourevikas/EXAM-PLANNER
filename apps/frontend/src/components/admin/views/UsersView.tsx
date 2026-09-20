import React, { useEffect, useState } from 'react';
import {
  Users,
  Search,
  ShieldAlert,
  CheckCircle,
  XCircle,
  Loader2,
  Crown,
  X,
  ChevronRight,
  ChevronLeft,
  Filter
} from 'lucide-react';
import { fetchAllUsers, fetchUserById } from '../../../services/adminService';
import { User } from '../../../types/auth';
import { useBreakpoint } from '../../../hooks/useBreakpoint';
import { CandidateDetailView } from './CandidateDetailView';

export function UsersView() {
  const { isMobile, isTabletOrBelow } = useBreakpoint();
  const [usersList, setUsersList] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [accessFilter, setAccessFilter] = useState<string>('ALL');

  // Pagination State (5 entries per page)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const ITEMS_PER_PAGE = 5;

  // Candidate Detail Modal State
  const [selectedCandidate, setSelectedCandidate] = useState<User | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState<boolean>(false);

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

  // Handle Escape key to close popup modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedCandidate) {
        setSelectedCandidate(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCandidate]);

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

  // Filtered Users (Super Admin is hidden at all cost)
  const filteredUsers = usersList.filter(user => {
    if (user.role === 'SUPER_ADMIN') return false;

    const matchesSearch =
      user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.target_exam?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.optional_subject?.toLowerCase().includes(searchQuery.toLowerCase());

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

  // Helper for displaying candidate names in table list
  const getCandidateDisplayName = (u: User) => {
    if (!u.full_name || u.full_name.trim() === '' || u.full_name === 'Clerk Sync User') {
      if (u.email && !u.email.includes('@clerk.local')) {
        return u.email.split('@')[0];
      }
      return `Candidate #${u.id}`;
    }
    return u.full_name;
  };

  const getCandidateInitials = (u: User) => {
    const name = getCandidateDisplayName(u);
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  // If a candidate is selected, render full-page CandidateDetailView instead of popup modal
  if (selectedCandidate) {
    return (
      <div style={{ padding: 0, maxWidth: 1440, margin: '0 auto', fontFamily: 'var(--font-sans, sans-serif)' }}>
        <CandidateDetailView
          candidate={selectedCandidate}
          isDetailLoading={isDetailLoading}
          onBack={() => setSelectedCandidate(null)}
          onUpdateCandidate={(updated) => {
            setSelectedCandidate(updated);
            setUsersList(prev => prev.map(u => u.id === updated.id ? { ...u, ...updated } : u));
          }}
        />
      </div>
    );
  }

  return (
    <div style={{ padding: 0, maxWidth: 1440, margin: '0 auto', fontFamily: 'var(--font-sans, sans-serif)' }}>

      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 8, background: 'linear-gradient(135deg, var(--primary-red), var(--accent-darker))', color: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(var(--primary-red-rgb), 0.25)' }}>
              <Users size={22} />
            </div>
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 24, color: 'var(--deep-navy)', margin: 0, letterSpacing: '-0.02em' }}>
                Candidate Directory & Profiles
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                Monitor candidates, inspect individual learning metrics, and review comprehensive student profiles.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Alert Notifications */}
      {errorMsg && (
        <div style={{ padding: '12px 16px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: 13, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShieldAlert size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div style={{ padding: '12px 16px', borderRadius: 8, background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#3A8B53', fontSize: 13, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Analytics Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 165px), 1fr))', gap: 12, marginBottom: 24 }}>
        <div style={{ background: 'var(--bg-card)', border: '1px solid #e2e8f0', borderRadius: 8, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
          <div style={{ width: 44, height: 44, borderRadius: 8, background: 'var(--bg-subtle)', color: 'var(--primary-red)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={20} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>Total Candidates</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--deep-navy)', fontFamily: 'var(--font-display)' }}>{totalCount}</div>
          </div>
        </div>

        <div style={{ background: 'var(--bg-card)', border: '1px solid #e2e8f0', borderRadius: 8, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
          <div style={{ width: 44, height: 44, borderRadius: 8, background: '#ecfdf5', color: '#3A8B53', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle size={20} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>Active Candidates</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#3A8B53', fontFamily: 'var(--font-display)' }}>{activeCount}</div>
          </div>
        </div>

        <div style={{ background: 'var(--bg-card)', border: '1px solid #e2e8f0', borderRadius: 8, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
          <div style={{ width: 44, height: 44, borderRadius: 8, background: '#fef2f2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <XCircle size={20} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>Suspended Accounts</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#dc2626', fontFamily: 'var(--font-display)' }}>{suspendedCount}</div>
          </div>
        </div>

        <div style={{ background: 'var(--bg-card)', border: '1px solid #e2e8f0', borderRadius: 8, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
          <div style={{ width: 44, height: 44, borderRadius: 8, background: '#fffbe8', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Crown size={20} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>Premium Members</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#d97706', fontFamily: 'var(--font-display)' }}>{premiumCount}</div>
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid #e2e8f0', borderRadius: 10, padding: 0, boxShadow: '0 4px 20px rgba(0,0,0,0.04)', overflow: 'hidden' }}>

        {/* Controls Toolbar: Search & Filters */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', gap: 16, flexWrap: 'wrap' }}>

          {/* Search Box */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: 'var(--bg-subtle)', borderRadius: 6, padding: '8px 14px', border: '1px solid #cbd5e1', width: isMobile ? '100%' : 320, maxWidth: '100%', boxSizing: 'border-box' }}>
            <Search size={16} color="var(--text-disabled)" />
            <input
              type="text"
              placeholder="Search name, email or target exam..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: 13,
                color: 'var(--deep-navy)',
                width: '100%'
              }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', color: 'var(--text-disabled)', cursor: 'pointer', padding: 0 }}>
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filter Dropdowns */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              <Filter size={14} />
              <span>Status Filter:</span>
            </div>

            {/* Access Filter */}
            <select
              value={accessFilter}
              onChange={(e) => setAccessFilter(e.target.value)}
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid #cbd5e1',
                borderRadius: 6,
                color: 'var(--deep-navy)',
                padding: '7px 12px',
                fontSize: 12,
                outline: 'none',
                cursor: 'pointer',
                fontWeight: 500
              }}
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Only</option>
              <option value="SUSPENDED">Suspended Only</option>
            </select>
          </div>

        </div>

        {/* Directory Table */}
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, gap: 10, color: 'var(--primary-red)' }}>
            <Loader2 className="animate-spin" size={24} />
            <span style={{ fontSize: 14, fontWeight: 600 }}>Loading live candidate directory...</span>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', minWidth: 820, borderCollapse: 'separate', borderSpacing: 0, textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-subtle)', borderBottom: '2px solid #e2e8f0' }}>
                  {['Candidate Profile', 'Role', 'Target Exam', 'Subscription Plan', 'Access Status', 'Actions'].map((h, idx) => (
                    <th
                      key={h}
                      style={{
                        padding: '14px 18px',
                        fontSize: 11,
                        fontWeight: 800,
                        color: 'var(--text-secondary)',
                        fontFamily: 'var(--font-mono)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        borderBottom: '2px solid #e2e8f0',
                        borderTopLeftRadius: idx === 0 ? 8 : 0,
                        borderTopRightRadius: idx === 5 ? 8 : 0
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
                    <td colSpan={6} style={{ padding: 60, textAlign: 'center', color: 'var(--text-disabled)', fontSize: 14 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                        <Users size={36} color="var(--border-color)" />
                        <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>No candidate accounts found matching your search.</span>
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
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-subtle)')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        {/* Candidate Profile: Avatar, Name & Email */}
                        <td style={{ padding: '16px 18px', borderBottom: '1px solid #f1f5f9' }}>
                          <div
                            style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                            onClick={() => handleSelectCandidate(u)}
                            title="Click to view candidate profile"
                          >
                            <div style={{
                              width: 40,
                              height: 40,
                              borderRadius: 8,
                              background: 'linear-gradient(135deg, var(--primary-red), var(--accent-darker))',
                              color: 'var(--bg-card)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 14,
                              fontWeight: 800,
                              boxShadow: '0 2px 8px rgba(var(--primary-red-rgb), 0.2)',
                              border: '2px solid #ffffff',
                              flexShrink: 0,
                              overflow: 'hidden',
                            }}>
                              {u.profile_image && u.profile_image.startsWith('http') ? (
                                <img
                                  src={u.profile_image}
                                  alt={getCandidateDisplayName(u)}
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                              ) : (
                                getCandidateInitials(u)
                              )}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--deep-navy)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                  {getCandidateDisplayName(u)}
                                </span>
                                {(!u.full_name || u.full_name === 'Clerk Sync User') && (
                                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--status-warning)', backgroundColor: 'var(--status-warning-bg)', padding: '1px 6px', borderRadius: 4, border: '1px solid #fde68a', flexShrink: 0 }}>
                                    Clerk Account
                                  </span>
                                )}
                                {u.is_verified && (
                                  <CheckCircle size={14} color="#3A8B53" title="Verified Candidate" />
                                )}
                              </div>
                              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
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
                            background: u.role === 'SUPER_ADMIN' ? 'rgba(124, 58, 237, 0.1)' : u.role === 'ADMIN' ? 'rgba(var(--primary-red-rgb), 0.1)' : 'rgba(16, 185, 129, 0.1)',
                            color: u.role === 'SUPER_ADMIN' ? '#7c3aed' : u.role === 'ADMIN' ? 'var(--primary-red)' : '#3A8B53',
                            padding: '5px 12px',
                            borderRadius: 6,
                            border: `1px solid ${u.role === 'SUPER_ADMIN' ? 'rgba(124, 58, 237, 0.25)' : u.role === 'ADMIN' ? 'rgba(var(--primary-red-rgb), 0.25)' : 'rgba(16, 185, 129, 0.25)'}`
                          }}>
                            {u.role}
                          </span>
                        </td>

                        {/* Target Exam (what the student is preparing for) */}
                        <td style={{ padding: '16px 18px', borderBottom: '1px solid #f1f5f9' }}>
                          {u.target_exam || u.target_year ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--deep-navy)', whiteSpace: 'nowrap' }}>
                                {`${u.target_exam || ''} ${u.target_year || ''}`.trim()}
                              </span>
                              {u.optional_subject && (
                                <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Optional: {u.optional_subject}</span>
                              )}
                            </div>
                          ) : u.role === 'STUDENT' ? (
                            <span style={{ fontSize: 12.5, color: 'var(--text-disabled)', fontStyle: 'italic' }}>Not set</span>
                          ) : (
                            <span style={{ fontSize: 12.5, color: 'var(--text-disabled)' }}>—</span>
                          )}
                        </td>

                        {/* Subscription Tier */}
                        <td style={{ padding: '16px 18px', borderBottom: '1px solid #f1f5f9' }}>
                          <span style={{
                            fontSize: 11,
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            background: isPremium ? '#fffbe8' : 'var(--bg-subtle)',
                            color: isPremium ? 'var(--status-warning)' : 'var(--text-muted)',
                            padding: '5px 12px',
                            borderRadius: 6,
                            border: `1px solid ${isPremium ? '#fde68a' : 'var(--border-color)'}`
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
                            borderRadius: 6,
                            border: `1px solid ${isAccessAllowed ? '#a7f3d0' : '#fecaca'}`,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6
                          }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: isAccessAllowed ? '#3A8B53' : 'var(--primary-red)' }} />
                            {isAccessAllowed ? 'Active' : 'Suspended'}
                          </span>
                        </td>

                        {/* View Profile Action */}
                        <td style={{ padding: '16px 18px', borderBottom: '1px solid #f1f5f9' }}>
                          <button
                            onClick={() => handleSelectCandidate(u)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '7px 14px',
                              borderRadius: 6,
                              border: '1px solid #cbd5e1',
                              backgroundColor: 'var(--bg-card)',
                              color: 'var(--deep-navy)',
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'var(--bg-subtle)';
                              e.currentTarget.style.borderColor = '#93c5fd';
                              e.currentTarget.style.color = 'var(--primary-red)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'var(--bg-card)';
                              e.currentTarget.style.borderColor = 'var(--border-color)';
                              e.currentTarget.style.color = 'var(--deep-navy)';
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
            <div style={{ padding: '14px 20px', borderTop: '1px solid #e2e8f0', backgroundColor: 'var(--bg-subtle)', borderBottomLeftRadius: 10, borderBottomRightRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, fontSize: 12, color: 'var(--text-muted)' }}>
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
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    backgroundColor: currentPage === 1 ? 'var(--bg-hover)' : 'var(--bg-card)',
                    color: currentPage === 1 ? 'var(--text-disabled)' : 'var(--deep-navy)',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <ChevronLeft size={15} />
                  <span>Previous</span>
                </button>

                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--deep-navy)', padding: '0 8px', fontFamily: 'var(--font-mono)' }}>
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
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    backgroundColor: currentPage >= totalPages ? 'var(--bg-hover)' : 'var(--bg-card)',
                    color: currentPage >= totalPages ? 'var(--text-disabled)' : 'var(--deep-navy)',
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
    </div>
  );
}

