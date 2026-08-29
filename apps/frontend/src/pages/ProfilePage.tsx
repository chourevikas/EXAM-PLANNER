import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { StudentLayout } from '../components/student/StudentLayout';
import { SuperAdminTopNav } from '../components/superadmin/SuperAdminTopNav';
import { SuperAdminSidebar } from '../components/superadmin/SuperAdminSidebar';
import { AdminTopNav } from '../components/admin/AdminTopNav';
import { AdminSidebar } from '../components/admin/AdminSidebar';
import {
  User,
  Target,
  CreditCard,
  Lock,
  Save,
  Check,
  Star,
  Zap,
  Shield,
  Clock,
  Award,
  BookOpen,
  Download,
  Calendar,
  Sparkles
} from 'lucide-react';

import { updateUserProfile, fetchCurrentUser } from '../services/authService';
import { UserAvatar } from '../components/common/UserAvatar';

const PREDEFINED_AVATARS = ['👨‍🎓', '👩‍🎓', '🚀', '🌟', '🧠', '🦉', '🎯', '📚'];

export function ProfilePage() {
  const navigate = useNavigate();
  const { user: clerkUser, isLoaded: isClerkLoaded } = useUser();
  const [user, setUser] = useState(() => {
    return JSON.parse(localStorage.getItem('user') || '{}');
  });

  const [activeTab, setActiveTab] = useState<'personal' | 'exam' | 'billing' | 'security'>('personal');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowWidth <= 768;
  const isSuperAdmin = user.role === 'SUPER_ADMIN';
  const isAdmin = user.role === 'ADMIN';

  // Form Fields
  const [fullName, setFullName] = useState(user.full_name || 'Aspirant');
  const [profileImage, setProfileImage] = useState(user.profile_image || '👨‍🎓');
  const [phone, setPhone] = useState(user.phone || '');
  const [bio, setBio] = useState(user.bio || 'Determined UPSC CSE 2026 aspirant focused on Prelims General Studies & Answer Writing.');
  
  // Sync Clerk user details if logged in via Clerk
  useEffect(() => {
    if (isClerkLoaded && clerkUser) {
      const email = clerkUser.primaryEmailAddress?.emailAddress;
      const name = clerkUser.fullName || `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim();
      const phoneNum = clerkUser.primaryPhoneNumber?.phoneNumber || clerkUser.phoneNumbers?.[0]?.phoneNumber;

      setUser((prev: any) => {
        const updated = {
          ...prev,
          email: email || prev?.email || '',
          full_name: name || prev?.full_name || 'Aspirant',
          phone: phoneNum || prev?.phone || '',
          clerk_id: clerkUser.id,
        };
        localStorage.setItem('user', JSON.stringify(updated));
        return updated;
      });

      if (name && (!fullName || fullName === 'Aspirant')) {
        setFullName(name);
      }
      if (phoneNum && !phone) {
        setPhone(phoneNum);
      }
    }
  }, [clerkUser, isClerkLoaded]);
  
  // Exam Target Fields
  const [targetExam, setTargetExam] = useState(user.target_exam || 'UPSC CSE');
  const [targetYear, setTargetYear] = useState(user.target_year || '2026');
  const [optionalSubject, setOptionalSubject] = useState(user.optional_subject || 'Political Science & IR');
  const [weeklyGoalHours, setWeeklyGoalHours] = useState(user.weekly_hours || '35');

  // Security Fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [twoFactor, setTwoFactor] = useState(true);

  useEffect(() => {
    document.title = 'Profile Settings - ExamPlanner';
    fetchCurrentUser().then(data => {
      setUser((prev: any) => {
        const merged = { ...prev, ...data };
        localStorage.setItem('user', JSON.stringify(merged));
        return merged;
      });
    }).catch(err => {
      console.error("Failed to fetch live user profile stats:", err);
    });
  }, []);

  const handleSaveChanges = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedUser = {
      ...user,
      full_name: fullName,
      profile_image: profileImage,
      phone,
      bio,
      target_exam: targetExam,
      target_year: targetYear,
      optional_subject: optionalSubject,
      weekly_hours: weeklyGoalHours,
    };

    localStorage.setItem('user', JSON.stringify(updatedUser));
    setUser(updatedUser);
    
    // Trigger window events so header picks up changes
    window.dispatchEvent(new Event('user_profile_updated'));
    window.dispatchEvent(new Event('storage'));

    updateUserProfile({ full_name: fullName, profile_image: profileImage })
      .catch(err => console.error("Failed to sync profile change with backend:", err));

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const isPro = user.subscription_tier === 'PREMIUM';

  const availableTabs = (isSuperAdmin || isAdmin)
    ? [
        { id: 'personal', label: 'Personal Info', icon: User },
        { id: 'security', label: 'Security & Password', icon: Lock },
      ]
    : [
        { id: 'personal', label: 'Personal Info', icon: User },
        { id: 'exam', label: 'Exam Targets', icon: Target },
        { id: 'billing', label: 'Billing & Plan', icon: CreditCard },
        { id: 'security', label: 'Security & Password', icon: Lock },
      ];

  const profileContent = (
    <>
      {/* ─── Profile Hero Banner Card ─────────────────────────────────────────── */}
      <div
        style={{
          backgroundColor: 'var(--bg-card, #ffffff)',
          borderRadius: 24,
          border: '1px solid var(--border-default, #e2e8f0)',
          boxShadow: 'var(--shadow-color-base, 0 4px 20px rgba(0,0,0,0.04))',
          padding: 32,
          marginBottom: 28,
          backgroundImage: 'linear-gradient(135deg, rgba(37,99,235,0.06) 0%, rgba(91,92,235,0.04) 100%)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 24
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {/* Avatar Display */}
          <UserAvatar
            userOrImage={clerkUser?.imageUrl || profileImage || user}
            size={84}
            fullName={fullName}
            style={{
              borderRadius: '50%',
              border: '2px solid var(--accent-primary, #2563eb)',
              boxShadow: '0 4px 16px var(--shadow-color-accent, rgba(37,99,235,0.25))'
            }}
          />

          {/* User Details */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary, #0f172a)', margin: 0, letterSpacing: '-0.02em' }}>
                {fullName}
              </h1>
              {isSuperAdmin ? (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    padding: '4px 12px',
                    borderRadius: 20,
                    backgroundColor: 'rgba(249, 115, 22, 0.15)',
                    color: '#ea580c',
                    border: '1px solid rgba(249, 115, 22, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                >
                  👑 SUPER ADMIN
                </span>
              ) : isAdmin ? (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    padding: '4px 12px',
                    borderRadius: 20,
                    backgroundColor: 'rgba(37, 99, 235, 0.15)',
                    color: '#2563eb',
                    border: '1px solid rgba(37, 99, 235, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                >
                  🛡️ INSTITUTIONAL ADMIN
                </span>
              ) : isPro ? (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: 20,
                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                    color: '#60a5fa',
                    border: '1px solid rgba(59, 130, 246, 0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                >
                  <Star size={12} fill="#60a5fa" /> Pro Member
                </span>
              ) : (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: 20,
                    backgroundColor: 'var(--bg-subtle, #f8fafc)',
                    color: 'var(--text-muted, #64748b)',
                    border: '1px solid var(--border-default, #e2e8f0)'
                  }}
                >
                  Free Account
                </span>
              )}
            </div>

            <div style={{ fontSize: 14, color: 'var(--text-muted, #64748b)', marginBottom: 12 }}>
              {clerkUser?.primaryEmailAddress?.emailAddress || user.email || 'superadmin@examplanner.com'}
              {!(isSuperAdmin || isAdmin) && (
                <> • Target: <strong style={{ color: 'var(--text-primary, #0f172a)' }}>{targetExam} {targetYear}</strong></>
              )}
              {(isSuperAdmin || isAdmin) && (
                <> • <strong style={{ color: '#2563eb' }}>Administrative Console Access</strong></>
              )}
            </div>

            {/* Quick Badges */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {isSuperAdmin ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 8, backgroundColor: 'rgba(249, 115, 22, 0.1)', color: '#ea580c', border: '1px solid rgba(249, 115, 22, 0.25)' }}>
                    <Shield size={13} color="#ea580c" />
                    <span>Executive Security Clearance</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 8, backgroundColor: 'rgba(37, 99, 235, 0.1)', color: '#2563eb', border: '1px solid rgba(37, 99, 235, 0.25)' }}>
                    <Zap size={13} color="#2563eb" fill="#2563eb" />
                    <span>Full Platform Control</span>
                  </div>
                </>
              ) : isAdmin ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 8, backgroundColor: 'rgba(37, 99, 235, 0.1)', color: '#2563eb', border: '1px solid rgba(37, 99, 235, 0.25)' }}>
                    <Shield size={13} color="#2563eb" />
                    <span>Institutional Admin Clearance</span>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 8, backgroundColor: 'var(--bg-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}>
                    <Zap size={13} color="#f59e0b" fill="#f59e0b" />
                    <span>{user?.current_streak || 0}-Day Streak</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 8, backgroundColor: 'var(--bg-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}>
                    <BookOpen size={13} color="#3b82f6" />
                    <span>{(user?.total_questions_attempted ?? user?.free_questions_attempted ?? 0).toLocaleString()} Questions Solved</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 8, backgroundColor: 'var(--bg-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}>
                    <Award size={13} color="#10b981" />
                    <span>Level {user?.level || 1} Scholar</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Upgrade / Billing CTA if Student & Free */}
        {!(isSuperAdmin || isAdmin) && !isPro && (
          <Link
            to="/pricing"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 20px',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              borderRadius: 12,
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: 700,
              boxShadow: '0 4px 16px rgba(37, 99, 235, 0.4)',
              transition: 'transform 0.2s'
            }}
          >
            <Sparkles size={16} />
            <span>Upgrade to Pro Plan</span>
          </Link>
        )}
      </div>

      {/* ─── Navigation Tabs Bar ─────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 24,
          borderBottom: '1px solid var(--border-default, #e2e8f0)',
          paddingBottom: 4
        }}
      >
        {availableTabs.map((tab) => {
          const TabIcon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 18px',
                borderRadius: 10,
                border: 'none',
                backgroundColor: isActive ? 'var(--accent-bg, rgba(37,99,235,0.1))' : 'transparent',
                color: isActive ? 'var(--accent-primary, #2563eb)' : 'var(--text-muted, #64748b)',
                fontSize: 14,
                fontWeight: isActive ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                borderBottom: isActive ? '2px solid var(--accent-primary, #2563eb)' : '2px solid transparent'
              }}
            >
              <TabIcon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ─── Settings Form & Content Body ───────────────────────────────────── */}
      <form onSubmit={handleSaveChanges} style={{ maxWidth: 840 }}>
        
        {/* Tab 1: Personal Info */}
        {activeTab === 'personal' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            
            {/* Avatar Selector */}
            <div
              style={{
                backgroundColor: 'var(--bg-card)',
                padding: 24,
                borderRadius: 18,
                border: '1px solid var(--border-default)',
                boxShadow: 'var(--shadow-color-base)'
              }}
            >
              <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 12 }}>
                Choose Profile Avatar
              </label>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {PREDEFINED_AVATARS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setProfileImage(emoji)}
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: '50%',
                      fontSize: 26,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      border: profileImage === emoji ? '2px solid var(--accent-primary)' : '1px solid var(--border-default)',
                      backgroundColor: profileImage === emoji ? 'var(--accent-bg)' : 'var(--bg-subtle)',
                      transition: 'transform 0.15s ease'
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Inputs Grid */}
            <div
              style={{
                backgroundColor: 'var(--bg-card)',
                padding: 24,
                borderRadius: 18,
                border: '1px solid var(--border-default)',
                boxShadow: 'var(--shadow-color-base)',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 20
              }}
            >
              <div>
                <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
                  Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: '1px solid var(--border-default)',
                    backgroundColor: 'var(--bg-subtle)',
                    color: 'var(--text-primary)',
                    fontSize: 14,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={clerkUser?.primaryEmailAddress?.emailAddress || user.email || ''}
                  disabled
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: '1px solid var(--border-default)',
                    backgroundColor: 'var(--bg-disabled, rgba(0,0,0,0.05))',
                    color: 'var(--text-muted)',
                    fontSize: 14,
                    outline: 'none',
                    boxSizing: 'border-box',
                    cursor: 'not-allowed'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
                  Phone Number
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: '1px solid var(--border-default)',
                    backgroundColor: 'var(--bg-subtle)',
                    color: 'var(--text-primary)',
                    fontSize: 14,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
                  User Role
                </label>
                <input
                  type="text"
                  value={user.role ? user.role.toUpperCase() : "ASPIRANT / STUDENT"}
                  disabled
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: '1px solid var(--border-default)',
                    backgroundColor: 'var(--bg-disabled, rgba(0,0,0,0.05))',
                    color: 'var(--text-muted)',
                    fontSize: 14,
                    outline: 'none',
                    boxSizing: 'border-box',
                    cursor: 'not-allowed'
                  }}
                />
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
                  Personal Goal / Aspirant Motto
                </label>
                <textarea
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: '1px solid var(--border-default)',
                    backgroundColor: 'var(--bg-subtle)',
                    color: 'var(--text-primary)',
                    fontSize: 14,
                    outline: 'none',
                    boxSizing: 'border-box',
                    resize: 'vertical'
                  }}
                />
              </div>
            </div>

          </div>
        )}

        {/* Tab 2: Exam Targets */}
        {activeTab === 'exam' && (
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              padding: 24,
              borderRadius: 18,
              border: '1px solid var(--border-default)',
              boxShadow: 'var(--shadow-color-base)',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 20
            }}
          >
            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
                Primary Target Exam
              </label>
              <select
                value={targetExam}
                onChange={(e) => setTargetExam(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: '1px solid var(--border-default)',
                  backgroundColor: 'var(--bg-subtle)',
                  color: 'var(--text-primary)',
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              >
                <option value="UPSC CSE">UPSC Civil Services Examination (CSE)</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
                Target Attempt Year
              </label>
              <select
                value={targetYear}
                onChange={(e) => setTargetYear(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: '1px solid var(--border-default)',
                  backgroundColor: 'var(--bg-subtle)',
                  color: 'var(--text-primary)',
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              >
                <option value="2025">2025 Attempt</option>
                <option value="2026">2026 Attempt</option>
                <option value="2027">2027 Attempt</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
                Optional Subject (Mains)
              </label>
              <select
                value={optionalSubject}
                onChange={(e) => setOptionalSubject(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: '1px solid var(--border-default)',
                  backgroundColor: 'var(--bg-subtle)',
                  color: 'var(--text-primary)',
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              >
                <option value="Political Science & IR">Political Science & International Relations (PSIR)</option>
                <option value="History">History</option>
                <option value="Geography">Geography</option>
                <option value="Public Administration">Public Administration</option>
                <option value="Sociology">Sociology</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
                Weekly Target Hours Goal
              </label>
              <select
                value={weeklyGoalHours}
                onChange={(e) => setWeeklyGoalHours(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: '1px solid var(--border-default)',
                  backgroundColor: 'var(--bg-subtle)',
                  color: 'var(--text-primary)',
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              >
                <option value="25">25 Hours / Week (Part-Time / Working)</option>
                <option value="35">35 Hours / Week (Standard Dedicated)</option>
                <option value="45">45 Hours / Week (Intense Full-Time)</option>
              </select>
            </div>

          </div>
        )}

        {/* Tab 3: Billing & Subscriptions */}
        {activeTab === 'billing' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            
            {/* Current Plan Status Box */}
            <div
              style={{
                backgroundColor: 'var(--bg-card)',
                padding: 24,
                borderRadius: 18,
                border: isPro ? '2px solid var(--accent-primary)' : '1px solid var(--border-default)',
                boxShadow: 'var(--shadow-color-base)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                  Current Subscription Plan
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{isPro ? 'ExamPlanner Pro Annual Plan' : 'Free Starter Plan'}</span>
                  {isPro && <Star size={16} fill="#60a5fa" color="#60a5fa" />}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                  {isPro ? 'Renews automatically on Aug 9, 2027' : 'Basic free access with 10 PYQs / day limit'}
                </div>
              </div>

              {!isPro ? (
                <Link
                  to="/pricing"
                  style={{
                    padding: '10px 20px',
                    borderRadius: 10,
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    fontSize: 14,
                    fontWeight: 700,
                    textDecoration: 'none',
                    boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)'
                  }}
                >
                  Upgrade to Pro
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => alert('Your Pro Subscription is active and fully unlocked!')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 10,
                    border: '1px solid var(--border-default)',
                    backgroundColor: 'var(--bg-subtle)',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Manage Membership
                </button>
              )}
            </div>

            {/* Invoices History Table */}
            <div
              style={{
                backgroundColor: 'var(--bg-card)',
                padding: 24,
                borderRadius: 18,
                border: '1px solid var(--border-default)',
                boxShadow: 'var(--shadow-color-base)'
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
                Billing History & Download Receipts
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { id: 'INV-2026-001', date: 'Aug 09, 2026', amount: '₹5,988', status: 'Paid', plan: 'Pro Annual Membership' }
                ].map((inv) => (
                  <div
                    key={inv.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 12,
                      borderRadius: 10,
                      backgroundColor: 'var(--bg-subtle)',
                      border: '1px solid var(--border-default)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <Calendar size={18} color="var(--accent-primary)" />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{inv.plan}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{inv.id} • {inv.date}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{inv.amount}</span>
                      <button
                        type="button"
                        onClick={() => alert(`Downloading Invoice ${inv.id}...`)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#2563eb',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 12,
                          fontWeight: 600
                        }}
                      >
                        <Download size={14} /> Receipt
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* Tab 4: Security & Password */}
        {activeTab === 'security' && (
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              padding: 24,
              borderRadius: 18,
              border: '1px solid var(--border-default)',
              boxShadow: 'var(--shadow-color-base)',
              display: 'flex',
              flexDirection: 'column',
              gap: 20
            }}
          >
            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
                Current Password
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: '1px solid var(--border-default)',
                  backgroundColor: 'var(--bg-subtle)',
                  color: 'var(--text-primary)',
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
                New Password
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: '1px solid var(--border-default)',
                  backgroundColor: 'var(--bg-subtle)',
                  color: 'var(--text-primary)',
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
                Confirm New Password
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: '1px solid var(--border-default)',
                  backgroundColor: 'var(--bg-subtle)',
                  color: 'var(--text-primary)',
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 16, borderTop: '1px solid var(--border-default)' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Two-Factor Authentication (2FA)</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Add an extra layer of security to your account with SMS or Authenticator app code</div>
              </div>
              <button
                type="button"
                onClick={() => setTwoFactor(!twoFactor)}
                style={{
                  padding: '6px 16px',
                  borderRadius: 20,
                  border: 'none',
                  backgroundColor: twoFactor ? '#10b981' : 'var(--bg-subtle)',
                  color: twoFactor ? '#ffffff' : 'var(--text-muted)',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {twoFactor ? 'Enabled ✓' : 'Disabled'}
              </button>
            </div>

          </div>
        )}

        {/* ─── Save Changes Sticky Action Bar ───────────────────────────────────── */}
        <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            type="submit"
            style={{
              padding: '12px 24px',
              borderRadius: 12,
              border: 'none',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)',
              transition: 'transform 0.2s'
            }}
          >
            <Save size={18} />
            <span>Save Profile Settings</span>
          </button>

          {savedSuccess && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#10b981', fontSize: 13, fontWeight: 700 }}>
              <Check size={18} />
              <span>Settings updated successfully!</span>
            </div>
          )}
        </div>

      </form>
    </>
  );

  if (isSuperAdmin) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg-body, #F8FAFC)', fontFamily: 'Inter, sans-serif', color: '#0F172A', overflowX: 'hidden' }}>
        <SuperAdminTopNav
          activeTab={'all_users' as any}
          onNavigate={() => navigate('/super-admin')}
          onToggleSidebar={() => setSidebarCollapsed(prev => !prev)}
        />
        <div style={{ display: 'flex', flex: 1, marginTop: 60 }}>
          <SuperAdminSidebar
            activeTab={'all_users' as any}
            onNavigate={() => navigate('/super-admin')}
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed(prev => !prev)}
            pendingCount={0}
            pendingTestimonialsCount={0}
            mobileOpen={mobileOpen}
            onCloseMobile={() => setMobileOpen(false)}
          />
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
              <div style={{ maxWidth: 1000, margin: '0 auto' }}>
                {profileContent}
              </div>
            </main>
          </div>
        </div>
      </div>
    );
  }

  if (isAdmin) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#F7F7F5', fontFamily: 'Inter, sans-serif', color: '#172033', overflowX: 'hidden' }}>
        <AdminTopNav
          user={user}
          activeView="dashboard"
          onNavigate={() => navigate('/admin')}
          onToggleSidebar={() => setSidebarCollapsed(prev => !prev)}
        />
        <div style={{ display: 'flex', flex: 1, marginTop: '60px' }}>
          <AdminSidebar
            activeView="dashboard"
            onNavigate={() => navigate('/admin')}
            collapsed={sidebarCollapsed}
            mobileOpen={mobileOpen}
            onCloseMobile={() => setMobileOpen(false)}
            onToggleSidebar={() => setSidebarCollapsed(prev => !prev)}
          />
          <div
            style={{
              flex: 1,
              marginLeft: isMobile ? 0 : (sidebarCollapsed ? '68px' : '240px'),
              display: 'flex',
              flexDirection: 'column',
              minWidth: 0,
              transition: 'margin-left 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
              width: '100%'
            }}
          >
            <main style={{ flex: 1, overflowY: 'auto', background: '#F7F7F5', padding: isMobile ? '16px 20px' : '24px 32px', boxSizing: 'border-box' }}>
              <div style={{ maxWidth: 1000, margin: '0 auto' }}>
                {profileContent}
              </div>
            </main>
          </div>
        </div>
      </div>
    );
  }

  return (
    <StudentLayout pageTitle="Account Settings">
      {profileContent}
    </StudentLayout>
  );
}
