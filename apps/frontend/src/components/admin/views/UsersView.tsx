import React, { useEffect, useState } from 'react';
import {
  Users,
  Search,
  ShieldAlert,
  CheckCircle,
  XCircle,
  Loader2,
  Crown,
  Mail,
  Award,
  Zap,
  BookOpen,
  X,
  ChevronRight,
  ChevronLeft,
  Filter,
  Copy,
  Check,
  GraduationCap
} from 'lucide-react';
import { fetchAllUsers, fetchUserById } from '../../../services/adminService';
import { User } from '../../../types/auth';
import { useBreakpoint } from '../../../hooks/useBreakpoint';

export function UsersView() {
  const { isMobile, isTabletOrBelow } = useBreakpoint();
  const [usersList, setUsersList] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [copiedId, setCopiedId] = useState<boolean>(false);

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
            <div style={{ width: 42, height: 42, borderRadius: 8, background: 'linear-gradient(135deg, var(--primary-red), var(--accent-darker))', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(var(--primary-red-rgb), 0.25)' }}>
              <Users size={22} />
            </div>
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 24, color: '#172033', margin: 0, letterSpacing: '-0.02em' }}>
                Candidate Directory & Profiles
              </h2>
              <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
          <div style={{ width: 44, height: 44, borderRadius: 8, background: '#F8FAFC', color: 'var(--primary-red)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={20} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>Total Candidates</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#172033', fontFamily: 'var(--font-display)' }}>{totalCount}</div>
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
          <div style={{ width: 44, height: 44, borderRadius: 8, background: '#ecfdf5', color: '#3A8B53', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle size={20} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>Active Candidates</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#3A8B53', fontFamily: 'var(--font-display)' }}>{activeCount}</div>
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
          <div style={{ width: 44, height: 44, borderRadius: 8, background: '#fef2f2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <XCircle size={20} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>Suspended Accounts</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#dc2626', fontFamily: 'var(--font-display)' }}>{suspendedCount}</div>
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
          <div style={{ width: 44, height: 44, borderRadius: 8, background: '#fffbe8', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Crown size={20} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>Premium Members</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#d97706', fontFamily: 'var(--font-display)' }}>{premiumCount}</div>
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 0, boxShadow: '0 4px 20px rgba(0,0,0,0.04)', overflow: 'hidden' }}>

        {/* Controls Toolbar: Search & Filters */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', gap: 16, flexWrap: 'wrap' }}>

          {/* Search Box */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: '#f8fafc', borderRadius: 6, padding: '8px 14px', border: '1px solid #cbd5e1', width: isMobile ? '100%' : 320, maxWidth: '100%', boxSizing: 'border-box' }}>
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
                color: '#172033',
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
              <span>Status Filter:</span>
            </div>

            {/* Access Filter */}
            <select
              value={accessFilter}
              onChange={(e) => setAccessFilter(e.target.value)}
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: 6,
                color: '#172033',
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
            <table style={{ width: '100%', minWidth: 680, borderCollapse: 'separate', borderSpacing: 0, textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  {['Candidate Profile', 'Role', 'Subscription Plan', 'Access Status', 'Actions'].map((h, idx) => (
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
                        borderTopLeftRadius: idx === 0 ? 8 : 0,
                        borderTopRightRadius: idx === 4 ? 8 : 0
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
                    <td colSpan={5} style={{ padding: 60, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
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
                            title="Click to view candidate profile"
                          >
                            <div style={{
                              width: 40,
                              height: 40,
                              borderRadius: 8,
                              background: 'linear-gradient(135deg, var(--primary-red), var(--accent-darker))',
                              color: '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 14,
                              fontWeight: 800,
                              boxShadow: '0 2px 8px rgba(var(--primary-red-rgb), 0.2)',
                              border: '2px solid #ffffff',
                              flexShrink: 0
                            }}>
                              {u.full_name ? u.full_name.substring(0, 2).toUpperCase() : 'U'}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 14, fontWeight: 700, color: '#172033', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                  {u.full_name}
                                </span>
                                {u.is_verified && (
                                  <CheckCircle size={14} color="#3A8B53" title="Verified Candidate" />
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
                            background: u.role === 'SUPER_ADMIN' ? 'rgba(124, 58, 237, 0.1)' : u.role === 'ADMIN' ? 'rgba(var(--primary-red-rgb), 0.1)' : 'rgba(16, 185, 129, 0.1)',
                            color: u.role === 'SUPER_ADMIN' ? '#7c3aed' : u.role === 'ADMIN' ? 'var(--primary-red)' : '#3A8B53',
                            padding: '5px 12px',
                            borderRadius: 6,
                            border: `1px solid ${u.role === 'SUPER_ADMIN' ? 'rgba(124, 58, 237, 0.25)' : u.role === 'ADMIN' ? 'rgba(var(--primary-red-rgb), 0.25)' : 'rgba(16, 185, 129, 0.25)'}`
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
                            borderRadius: 6,
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
                            borderRadius: 6,
                            border: `1px solid ${isAccessAllowed ? '#a7f3d0' : '#fecaca'}`,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6
                          }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: isAccessAllowed ? '#3A8B53' : '#ef4444' }} />
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
                              backgroundColor: '#ffffff',
                              color: '#172033',
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#F8FAFC';
                              e.currentTarget.style.borderColor = '#93c5fd';
                              e.currentTarget.style.color = 'var(--primary-red)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = '#ffffff';
                              e.currentTarget.style.borderColor = '#cbd5e1';
                              e.currentTarget.style.color = '#172033';
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
            <div style={{ padding: '14px 20px', borderTop: '1px solid #e2e8f0', backgroundColor: '#f8fafc', borderBottomLeftRadius: 10, borderBottomRightRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, fontSize: 12, color: '#64748b' }}>
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
                    backgroundColor: currentPage === 1 ? '#f1f5f9' : '#ffffff',
                    color: currentPage === 1 ? '#94a3b8' : '#172033',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <ChevronLeft size={15} />
                  <span>Previous</span>
                </button>

                <span style={{ fontSize: 12, fontWeight: 700, color: '#172033', padding: '0 8px', fontFamily: 'var(--font-mono)' }}>
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
                    backgroundColor: currentPage >= totalPages ? '#f1f5f9' : '#ffffff',
                    color: currentPage >= totalPages ? '#94a3b8' : '#172033',
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

      {/* Candidate Profile Details Centered Modal */}
      {selectedCandidate && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(6px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px 16px',
          }}
          onClick={() => setSelectedCandidate(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 'min(620px, calc(100vw - 24px))',
              maxHeight: '90vh',
              backgroundColor: '#ffffff',
              borderRadius: 14,
              boxShadow: '0 25px 60px -15px rgba(15, 23, 42, 0.35)',
              border: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {/* Modal Header Bar with Title, Sync Status & Cross Button */}
            <div
              style={{
                padding: '16px 22px',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: '#ffffff',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    backgroundColor: '#F8FAFC',
                    color: 'var(--primary-red)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <GraduationCap size={18} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.01em' }}>
                      Student Profile Details
                    </span>
                    {isDetailLoading && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 10.5,
                          color: 'var(--primary-red)',
                          backgroundColor: '#F8FAFC',
                          padding: '2px 7px',
                          borderRadius: 10,
                          fontWeight: 600,
                        }}
                      >
                        <Loader2 size={11} className="animate-spin" /> Syncing
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 1 }}>
                    Candidate overview, platform engagement metrics & account info
                  </div>
                </div>
              </div>

              {/* Cross (Close) Button */}
              <button
                onClick={() => setSelectedCandidate(null)}
                aria-label="Close modal"
                title="Close"
                style={{
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  color: '#64748b',
                  cursor: 'pointer',
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f1f5f9';
                  e.currentTarget.style.color = '#0f172a';
                  e.currentTarget.style.borderColor = '#94a3b8';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#f8fafc';
                  e.currentTarget.style.color = '#64748b';
                  e.currentTarget.style.borderColor = '#cbd5e1';
                }}
              >
                <X size={17} />
              </button>
            </div>

            {/* Scrollable Content Body */}
            <div
              style={{
                padding: '20px 22px',
                display: 'flex',
                flexDirection: 'column',
                gap: 18,
                overflowY: 'auto',
                flex: 1,
              }}
            >
              {/* Profile Hero Card */}
              <div
                style={{
                  padding: 16,
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  boxShadow: '0 2px 10px rgba(15, 23, 42, 0.04)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 10,
                      background: 'linear-gradient(135deg, var(--primary-red) 0%, #4f46e5 50%, #7c3aed 100%)',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 19,
                      fontWeight: 800,
                      boxShadow: '0 4px 14px rgba(79, 70, 229, 0.3)',
                      border: '2px solid #ffffff',
                      flexShrink: 0,
                    }}
                  >
                    {selectedCandidate.full_name ? selectedCandidate.full_name.substring(0, 2).toUpperCase() : 'U'}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span
                        style={{
                          fontSize: 16,
                          fontWeight: 800,
                          color: '#0F172A',
                          whiteSpace: 'nowrap',
                          textOverflow: 'ellipsis',
                          overflow: 'hidden',
                          letterSpacing: '-0.01em',
                        }}
                      >
                        {selectedCandidate.full_name}
                      </span>
                      {selectedCandidate.is_verified && (
                        <CheckCircle size={15} color="#3A8B53" title="Verified Candidate" />
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748B', fontFamily: 'var(--font-mono)' }}>
                      <Mail size={12} color="var(--primary-red)" />
                      <span style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                        {selectedCandidate.email}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 4,
                          backgroundColor: selectedCandidate.role === 'SUPER_ADMIN' ? '#f3e8ff' : selectedCandidate.role === 'ADMIN' ? '#F8FAFC' : '#ecfdf5',
                          color: selectedCandidate.role === 'SUPER_ADMIN' ? '#7c3aed' : selectedCandidate.role === 'ADMIN' ? 'var(--primary-red)' : '#3A8B53',
                          border: `1px solid ${selectedCandidate.role === 'SUPER_ADMIN' ? '#ddd6fe' : selectedCandidate.role === 'ADMIN' ? '#bfdbfe' : '#a7f3d0'}`,
                        }}
                      >
                        {selectedCandidate.role}
                      </span>

                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 4,
                          backgroundColor: selectedCandidate.status === 'ACTIVE' ? '#ecfdf5' : '#fef2f2',
                          color: selectedCandidate.status === 'ACTIVE' ? '#3A8B53' : '#dc2626',
                          border: `1px solid ${selectedCandidate.status === 'ACTIVE' ? '#a7f3d0' : '#fecaca'}`,
                        }}
                      >
                        {selectedCandidate.status === 'ACTIVE' ? 'Active' : 'Suspended'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick Action Bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 10, borderTop: '1px solid #f1f5f9', flexWrap: 'wrap' }}>
                  <a
                    href={`mailto:${selectedCandidate.email}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '5px 12px',
                      borderRadius: 6,
                      backgroundColor: '#F8FAFC',
                      color: 'var(--primary-red)',
                      border: '1px solid #bfdbfe',
                      fontSize: 11,
                      fontWeight: 600,
                      textDecoration: 'none',
                      transition: 'all 0.15s ease',
                      boxShadow: '0 1px 3px rgba(var(--primary-red-rgb), 0.06)',
                    }}
                  >
                    <Mail size={12} />
                    <span>Send Email</span>
                  </a>

                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(String(selectedCandidate.id));
                      setCopiedId(true);
                      setTimeout(() => setCopiedId(false), 2000);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '5px 12px',
                      borderRadius: 6,
                      backgroundColor: copiedId ? '#ecfdf5' : '#f8fafc',
                      color: copiedId ? '#3A8B53' : '#475569',
                      border: `1px solid ${copiedId ? '#a7f3d0' : '#cbd5e1'}`,
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
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
                      borderRadius: 6,
                      backgroundColor: selectedCandidate.is_verified ? '#ecfdf5' : '#fffbe8',
                      color: selectedCandidate.is_verified ? '#3A8B53' : '#b45309',
                      border: `1px solid ${selectedCandidate.is_verified ? '#a7f3d0' : '#fde68a'}`,
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    {selectedCandidate.is_verified ? <CheckCircle size={12} /> : <XCircle size={12} />}
                    <span>{selectedCandidate.is_verified ? 'Verified Account' : 'Pending Verification'}</span>
                  </div>
                </div>
              </div>

              {/* Learning Metrics & Engagement */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Learning Metrics & Engagement
                </span>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                  {/* Streak Card */}
                  <div
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      backgroundColor: '#ffffff',
                      border: '1px solid #E2E8F0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        background: 'linear-gradient(135deg, #F8FAFC 0%, #E2E8F0 100%)',
                        color: 'var(--primary-red)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Zap size={18} />
                    </div>
                    <div>
                      <div style={{ fontSize: 10.5, fontWeight: 600, color: '#64748B' }}>Streak</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--primary-red)' }}>
                        {selectedCandidate.current_streak || selectedCandidate.student_profile?.current_streak || 0} Days
                      </div>
                    </div>
                  </div>

                  {/* Questions Solved Card */}
                  <div
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      backgroundColor: '#ffffff',
                      border: '1px solid #a7f3d0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      boxShadow: '0 2px 6px rgba(16, 185, 129, 0.04)',
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
                        color: '#3A8B53',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <BookOpen size={18} />
                    </div>
                    <div>
                      <div style={{ fontSize: 10.5, fontWeight: 600, color: '#64748B' }}>Questions</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#3A8B53' }}>
                        {selectedCandidate.free_questions_attempted || selectedCandidate.student_profile?.free_questions_attempted || 0} Solved
                      </div>
                    </div>
                  </div>

                  {/* Rank Level Card */}
                  <div
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      backgroundColor: '#ffffff',
                      border: '1px solid #fde68a',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      boxShadow: '0 2px 6px rgba(245, 158, 11, 0.04)',
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        background: 'linear-gradient(135deg, #fffbe8 0%, #fef3c7 100%)',
                        color: '#d97706',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Crown size={18} />
                    </div>
                    <div>
                      <div style={{ fontSize: 10.5, fontWeight: 600, color: '#64748B' }}>Rank Level</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#d97706' }}>
                        Level {selectedCandidate.level || selectedCandidate.student_profile?.level || 1}
                      </div>
                    </div>
                  </div>

                  {/* Total XP Card */}
                  <div
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      backgroundColor: '#ffffff',
                      border: '1px solid #ddd6fe',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      boxShadow: '0 2px 6px rgba(124, 58, 237, 0.04)',
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        background: 'linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%)',
                        color: '#7c3aed',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Award size={18} />
                    </div>
                    <div>
                      <div style={{ fontSize: 10.5, fontWeight: 600, color: '#64748B' }}>Total XP</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#7c3aed' }}>
                        {selectedCandidate.total_xp || selectedCandidate.student_profile?.total_xp || 0} XP
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Subscription Level Card */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Subscription Level
                </span>

                <div
                  style={{
                    padding: 14,
                    borderRadius: 8,
                    backgroundColor: '#ffffff',
                    border: (selectedCandidate.subscription_tier === 'PREMIUM' || selectedCandidate.student_profile?.subscription_tier === 'PREMIUM') ? '1px solid #fde68a' : '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        backgroundColor: (selectedCandidate.subscription_tier === 'PREMIUM' || selectedCandidate.student_profile?.subscription_tier === 'PREMIUM') ? '#fffbe8' : '#f8fafc',
                        color: (selectedCandidate.subscription_tier === 'PREMIUM' || selectedCandidate.student_profile?.subscription_tier === 'PREMIUM') ? '#d97706' : '#64748b',
                        border: `1px solid ${(selectedCandidate.subscription_tier === 'PREMIUM' || selectedCandidate.student_profile?.subscription_tier === 'PREMIUM') ? '#fde68a' : '#cbd5e1'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Crown size={18} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
                        {(selectedCandidate.subscription_tier === 'PREMIUM' || selectedCandidate.student_profile?.subscription_tier === 'PREMIUM') ? 'PREMIUM Pro Plan' : 'FREE Standard Tier'}
                      </div>
                      <div style={{ fontSize: 11, color: '#64748B', marginTop: 1 }}>
                        {(selectedCandidate.subscription_tier === 'PREMIUM' || selectedCandidate.student_profile?.subscription_tier === 'PREMIUM') ? 'Full question bank & analytics active' : 'Standard candidate account limits applied'}
                      </div>
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '3px 10px',
                      borderRadius: 4,
                      backgroundColor: (selectedCandidate.subscription_tier === 'PREMIUM' || selectedCandidate.student_profile?.subscription_tier === 'PREMIUM') ? '#fffbe8' : '#F8FAFC',
                      color: (selectedCandidate.subscription_tier === 'PREMIUM' || selectedCandidate.student_profile?.subscription_tier === 'PREMIUM') ? '#b45309' : 'var(--primary-red)',
                      border: `1px solid ${(selectedCandidate.subscription_tier === 'PREMIUM' || selectedCandidate.student_profile?.subscription_tier === 'PREMIUM') ? '#fde68a' : '#bfdbfe'}`,
                    }}
                  >
                    Active Tier
                  </span>
                </div>
              </div>

              {/* Account Metadata Grid */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Account System Details
                </span>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                  <div style={{ padding: 11, borderRadius: 8, backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 10, color: '#64748B', marginBottom: 2 }}>Timezone</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#0F172A', fontFamily: 'var(--font-mono)' }}>
                      {selectedCandidate.timezone || 'Asia/Kolkata'}
                    </div>
                  </div>

                  <div style={{ padding: 11, borderRadius: 8, backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 10, color: '#64748B', marginBottom: 2 }}>Registration Date</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#0F172A', fontFamily: 'var(--font-mono)' }}>
                      {selectedCandidate.created_at ? new Date(selectedCandidate.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                    </div>
                  </div>

                  <div style={{ padding: 11, borderRadius: 8, backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 10, color: '#64748B', marginBottom: 2 }}>Last Profile Sync</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#0F172A', fontFamily: 'var(--font-mono)' }}>
                      {selectedCandidate.updated_at ? new Date(selectedCandidate.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                    </div>
                  </div>

                  <div style={{ padding: 11, borderRadius: 8, backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 10, color: '#64748B', marginBottom: 2 }}>Verification</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: selectedCandidate.is_verified ? '#3A8B53' : '#dc2626' }}>
                      {selectedCandidate.is_verified ? 'Verified ✅' : 'Unverified ❌'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '14px 22px',
                borderTop: '1px solid #e2e8f0',
                backgroundColor: '#fafafa',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'var(--font-mono)' }}>
                Candidate ID: <strong>{String(selectedCandidate.id).slice(0, 18)}...</strong>
              </div>

              <button
                onClick={() => setSelectedCandidate(null)}
                style={{
                  padding: '8px 18px',
                  borderRadius: 6,
                  backgroundColor: '#ffffff',
                  color: '#334155',
                  fontSize: 12,
                  fontWeight: 600,
                  border: '1px solid #cbd5e1',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f1f5f9';
                  e.currentTarget.style.color = '#0f172a';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#ffffff';
                  e.currentTarget.style.color = '#334155';
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
