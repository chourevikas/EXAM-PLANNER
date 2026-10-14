import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { StudentLayout } from '../components/student/StudentLayout';
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
  Calendar
} from 'lucide-react';

import { updateUserProfile, fetchCurrentUser } from '../services/authService';
import { useRefreshUserOnFocus } from '../hooks/useRefreshUserOnFocus';
import { UserAvatar } from '../components/common/UserAvatar';
import { SUPPORTED_LANGUAGES } from '../constants/languages';
import { WEEKLY_HOURS_OPTIONS, PROFICIENCY_LABELS } from '../constants/onboarding';

const lockedFieldStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: 'var(--radius)',
  border: '1px solid var(--border-default)',
  backgroundColor: 'var(--bg-disabled, rgba(0,0,0,0.05))',
  color: 'var(--text-muted)',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
  cursor: 'not-allowed',
};

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

  // Question display language — drives which language questions/solutions are shown
  // in across mock tests and practice sessions (same field the in-exam switcher uses).
  const [activeLanguage, setActiveLanguage] = useState<string>(
    () => localStorage.getItem('preferred_language') || user.preferred_language || 'en'
  );
  const [switchingLanguage, setSwitchingLanguage] = useState(false);

  const handleLanguageChange = async (nextLang: string) => {
    if (nextLang === activeLanguage) return;
    const previousLang = activeLanguage;
    setActiveLanguage(nextLang);
    setSwitchingLanguage(true);
    try {
      await updateUserProfile({ preferred_language: nextLang });
      localStorage.setItem('preferred_language', nextLang);
    } catch (err) {
      console.error('Failed to update language preference:', err);
      setActiveLanguage(previousLang);
    } finally {
      setSwitchingLanguage(false);
    }
  };

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

      // Proactively sync actual email and name to backend
      if (name || (email && !email.includes('@clerk.local')) || clerkUser.imageUrl) {
        updateUserProfile({
          full_name: name || undefined,
          email: (email && !email.includes('@clerk.local')) ? email : undefined,
          profile_image: clerkUser.imageUrl || undefined,
        }).catch(err => {
          console.warn('Failed to auto-sync Clerk profile to backend:', err);
        });
      }
    }
  }, [clerkUser, isClerkLoaded]);
  
  // Exam Target Fields
  // The primary target (exam / year / optional subject) is set once during onboarding and shown read-only.
  const targetExam: string = user.target_exam || '';
  const targetYear: string = user.target_year || '';
  const optionalSubject: string = user.optional_subject || '';
  const [weeklyGoalHours, setWeeklyGoalHours] = useState(user.weekly_hours || '');
  useEffect(() => {
    if (user.weekly_hours) setWeeklyGoalHours(user.weekly_hours);
  }, [user.weekly_hours]);

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

  useRefreshUserOnFocus(fresh => setUser((prev: any) => ({ ...prev, ...fresh })));

  const handleSaveChanges = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedUser = {
      ...user,
      full_name: fullName,
      profile_image: profileImage,
      phone,
      bio,
      weekly_hours: weeklyGoalHours || user.weekly_hours,
    };

    localStorage.setItem('user', JSON.stringify(updatedUser));
    setUser(updatedUser);
    
    // Trigger window events so header picks up changes
    window.dispatchEvent(new Event('user_profile_updated'));
    window.dispatchEvent(new Event('storage'));

    updateUserProfile({
      full_name: fullName,
      profile_image: profileImage,
      phone,
      // Only the weekly goal is editable; the primary target is locked server-side after onboarding.
      ...(isAdmin || isSuperAdmin || !weeklyGoalHours ? {} : { weekly_hours: weeklyGoalHours }),
    }).catch(err => console.error("Failed to sync profile change with backend:", err));

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
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border-default, #e2e8f0)',
          boxShadow: 'var(--shadow-color-base, 0 4px 20px rgba(0,0,0,0.04))',
          padding: isMobile ? 20 : 32,
          marginBottom: isMobile ? 20 : 28,
          backgroundImage: 'linear-gradient(135deg, rgba(var(--primary-red-rgb), 0.06) 0%, rgba(91,92,235,0.04) 100%)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 24
        }}
      >
        <div style={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', gap: isMobile ? 14 : 20, minWidth: 0, flex: isMobile ? '1 1 100%' : undefined }}>
          {/* Avatar Display */}
          <UserAvatar
            userOrImage={clerkUser?.imageUrl || profileImage || user}
            size={isMobile ? 56 : 84}
            fullName={fullName}
            style={{
              borderRadius: 'var(--radius)',
              border: '2px solid var(--accent-primary, var(--primary-red))',
              boxShadow: '0 4px 16px var(--shadow-color-accent, rgba(var(--primary-red-rgb), 0.25))'
            }}
          />

          {/* User Details */}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: isMobile ? 6 : 10, marginBottom: 4 }}>
              <h1 style={{ fontSize: isMobile ? 19 : 24, fontWeight: 800, color: 'var(--text-primary, #172033)', margin: 0, letterSpacing: '-0.02em', lineHeight: 1.25, overflowWrap: 'anywhere' }}>
                {fullName}
              </h1>
              {isSuperAdmin ? (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    padding: '4px 12px',
                    borderRadius: 'var(--radius)',
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
                    borderRadius: 'var(--radius)',
                    backgroundColor: 'rgba(var(--primary-red-rgb), 0.15)',
                    color: 'var(--primary-red)',
                    border: '1px solid rgba(var(--primary-red-rgb), 0.3)',
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
                    borderRadius: 'var(--radius)',
                    backgroundColor: 'rgba(var(--primary-red-rgb), 0.2)',
                    color: '#60a5fa',
                    border: '1px solid rgba(var(--primary-red-rgb), 0.4)',
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
                    borderRadius: 'var(--radius)',
                    backgroundColor: 'var(--bg-subtle, #f8fafc)',
                    color: 'var(--text-muted, #64748b)',
                    border: '1px solid var(--border-default, #e2e8f0)',
                    whiteSpace: 'nowrap'
                  }}
                >
                  Free Account
                </span>
              )}
            </div>

            <div style={{ fontSize: isMobile ? 13 : 14, color: 'var(--text-muted, #64748b)', marginBottom: 12, overflowWrap: 'anywhere' }}>
              {clerkUser?.primaryEmailAddress?.emailAddress || user.email || 'superadmin@examplanner.com'}
              {!(isSuperAdmin || isAdmin) && (
                targetExam && (
                  <> • Target: <strong style={{ color: 'var(--text-primary, #172033)' }}>{targetExam} {targetYear}</strong></>
                )
              )}
              {(isSuperAdmin || isAdmin) && (
                <> • <strong style={{ color: 'var(--primary-red)' }}>Administrative Console Access</strong></>
              )}
            </div>

            {/* Quick Badges */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: isMobile ? 6 : 10 }}>
              {isSuperAdmin ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 'var(--radius)', backgroundColor: 'rgba(249, 115, 22, 0.1)', color: '#ea580c', border: '1px solid rgba(249, 115, 22, 0.25)' }}>
                    <Shield size={13} color="#ea580c" />
                    <span>Executive Security Clearance</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 'var(--radius)', backgroundColor: 'rgba(var(--primary-red-rgb), 0.1)', color: 'var(--primary-red)', border: '1px solid rgba(var(--primary-red-rgb), 0.25)' }}>
                    <Zap size={13} color="var(--primary-red)" fill="var(--primary-red)" />
                    <span>Full Platform Control</span>
                  </div>
                </>
              ) : isAdmin ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 'var(--radius)', backgroundColor: 'rgba(var(--primary-red-rgb), 0.1)', color: 'var(--primary-red)', border: '1px solid rgba(var(--primary-red-rgb), 0.25)' }}>
                    <Shield size={13} color="var(--primary-red)" />
                    <span>Institutional Admin Clearance</span>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 'var(--radius)', backgroundColor: 'var(--bg-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}>
                    <Zap size={13} color="#F2B623" fill="#F2B623" />
                    <span>{user?.current_streak || 0}-Day Streak</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 'var(--radius)', backgroundColor: 'var(--bg-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}>
                    <BookOpen size={13} color="var(--primary-red)" />
                    <span>{(user?.total_questions_attempted ?? user?.free_questions_attempted ?? 0).toLocaleString()} Questions Solved</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 'var(--radius)', backgroundColor: 'var(--bg-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}>
                    <Award size={13} color="#3A8B53" />
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
            to="/billing"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              width: isMobile ? '100%' : undefined,
              boxSizing: 'border-box',
              padding: '12px 20px',
              backgroundColor: 'var(--primary-red)',
              color: 'var(--bg-card)',
              borderRadius: 'var(--radius)',
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: 700,
              boxShadow: '0 4px 16px rgba(var(--primary-red-rgb), 0.4)',
              transition: 'transform 0.2s'
            }}
          >
            <Zap size={16} />
            <span>Upgrade to Pro Plan</span>
          </Link>
        )}
      </div>

      {/* ─── Navigation Tabs Bar ─────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          gap: isMobile ? 4 : 8,
          marginBottom: isMobile ? 16 : 24,
          borderBottom: '1px solid var(--border-default, #e2e8f0)',
          paddingBottom: 4,
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none'
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
                gap: isMobile ? 6 : 8,
                padding: isMobile ? '9px 12px' : '10px 18px',
                flexShrink: 0,
                whiteSpace: 'nowrap',
                borderRadius: 'var(--radius)',
                border: 'none',
                backgroundColor: isActive ? 'var(--accent-bg, rgba(var(--primary-red-rgb), 0.1))' : 'transparent',
                color: isActive ? 'var(--accent-primary, var(--primary-red))' : 'var(--text-muted, #64748b)',
                fontSize: isMobile ? 13 : 14,
                fontWeight: isActive ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                borderBottom: isActive ? '2px solid var(--accent-primary, var(--primary-red))' : '2px solid transparent'
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
                padding: isMobile ? 16 : 24,
                borderRadius: 'var(--radius)',
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
                      borderRadius: 'var(--radius)',
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
                padding: isMobile ? 16 : 24,
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border-default)',
                boxShadow: 'var(--shadow-color-base)',
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                gap: isMobile ? 16 : 20
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
                    borderRadius: 'var(--radius)',
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
                    borderRadius: 'var(--radius)',
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
                    borderRadius: 'var(--radius)',
                    border: '1px solid var(--border-default)',
                    backgroundColor: 'var(--bg-subtle)',
                    color: 'var(--text-primary)',
                    fontSize: 14,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Role is only shown to staff accounts; students don't see it */}
              {(isSuperAdmin || isAdmin) && (
                <div>
                  <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
                    User Role
                  </label>
                  <input
                    type="text"
                    value={user.role ? user.role.toUpperCase() : ''}
                    disabled
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius)',
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
              )}

              <div>
                <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
                  Preferred Question Language
                </label>
                <select
                  value={activeLanguage}
                  disabled={switchingLanguage}
                  onChange={(e) => handleLanguageChange(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius)',
                    border: '1px solid var(--border-default)',
                    backgroundColor: 'var(--bg-subtle)',
                    color: 'var(--text-primary)',
                    fontSize: 14,
                    outline: 'none',
                    boxSizing: 'border-box',
                    cursor: switchingLanguage ? 'not-allowed' : 'pointer',
                    opacity: switchingLanguage ? 0.7 : 1,
                  }}
                >
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.name} ({lang.nativeName})
                    </option>
                  ))}
                </select>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '6px 0 0 0' }}>
                  Controls which language questions and solutions are shown in across mock tests and practice sessions.
                </p>
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
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
                    borderRadius: 'var(--radius)',
                    border: '1px solid var(--border-default)',
                    backgroundColor: 'var(--bg-subtle)',
                    color: 'var(--text-primary)',
                    fontSize: 14,
                    outline: 'none',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                    fontFamily: 'inherit'
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
              padding: isMobile ? 16 : 24,
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border-default)',
              boxShadow: 'var(--shadow-color-base)',
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
              gap: isMobile ? 16 : 20
            }}
          >
            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                Primary Target Exam <Lock size={12} color="var(--text-muted)" aria-hidden="true" />
              </label>
              <input
                type="text"
                readOnly
                aria-readonly="true"
                title="Set during onboarding and can't be changed"
                value={targetExam}
                placeholder="Not set"
                style={{ ...lockedFieldStyle }}
              />
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                Target Attempt Year <Lock size={12} color="var(--text-muted)" aria-hidden="true" />
              </label>
              <input
                type="text"
                readOnly
                aria-readonly="true"
                title="Set during onboarding and can't be changed"
                value={targetYear ? `${targetYear} Attempt` : ''}
                placeholder="Not set"
                style={{ ...lockedFieldStyle }}
              />
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                Optional Subject (Mains) <Lock size={12} color="var(--text-muted)" aria-hidden="true" />
              </label>
              <input
                type="text"
                readOnly
                aria-readonly="true"
                title="Set during onboarding and can't be changed"
                value={optionalSubject}
                placeholder="Not set"
                style={{ ...lockedFieldStyle }}
              />
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
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border-default)',
                  backgroundColor: 'var(--bg-subtle)',
                  color: 'var(--text-primary)',
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              >
                {!weeklyGoalHours && <option value="">Select hours…</option>}
                {WEEKLY_HOURS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Self-rated proficiency captured during onboarding */}
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>
                Subject Proficiency
              </div>
              {Object.keys(user.subject_proficiency || {}).length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>You haven't rated any subjects yet.</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))', gap: 10 }}>
                  {Object.entries(user.subject_proficiency as Record<string, number>)
                    .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))
                    .map(([subject, rating]) => (
                      <div
                        key={subject}
                        style={{
                          padding: '10px 12px',
                          borderRadius: 'var(--radius)',
                          border: '1px solid var(--border-default)',
                          backgroundColor: 'var(--bg-subtle)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>{subject}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', flexShrink: 0 }}>{rating}/5</span>
                        </div>
                        <div
                          role="img"
                          aria-label={`${subject}: ${rating} out of 5, ${PROFICIENCY_LABELS[rating] || ''}`}
                          style={{ display: 'flex', gap: 3 }}
                        >
                          {[1, 2, 3, 4, 5].map((n) => (
                            <span
                              key={n}
                              style={{
                                flex: 1,
                                height: 6,
                                borderRadius: 3,
                                backgroundColor: n <= rating ? 'var(--primary-red)' : 'var(--border-default)',
                              }}
                            />
                          ))}
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 5 }}>{PROFICIENCY_LABELS[rating] || ''}</div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div
              style={{
                gridColumn: '1 / -1',
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start',
                fontSize: 12.5,
                color: 'var(--text-muted)',
                backgroundColor: 'var(--bg-subtle)',
                borderRadius: 'var(--radius)',
                padding: '10px 12px',
              }}
            >
              <Lock size={14} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>
                Your primary target exam, attempt year and optional subject were set during onboarding and can't be
                edited here. Your weekly goal can be changed any time.
              </span>
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
                padding: isMobile ? 16 : 24,
                borderRadius: 'var(--radius)',
                border: isPro ? '2px solid var(--accent-primary)' : '1px solid var(--border-default)',
                boxShadow: 'var(--shadow-color-base)',
                display: 'flex',
                flexWrap: 'wrap',
                gap: 16,
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                  Current Subscription Plan
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{isPro ? (user.subscription_plan_name || 'Pro Plan') : 'Free Starter Plan'}</span>
                  {isPro && <Star size={16} fill="#60a5fa" color="#60a5fa" />}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                  {isPro && user.subscription_ends_at 
                    ? `Renews automatically on ${new Date(user.subscription_ends_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}` 
                    : 'Basic free access with 10 PYQs / day limit'}
                </div>
              </div>

              {!isPro ? (
                <Link
                  to="/billing"
                  style={{
                    padding: '10px 20px',
                    borderRadius: 'var(--radius)',
                    backgroundColor: 'var(--primary-red)',
                    color: 'var(--bg-card)',
                    fontSize: 14,
                    fontWeight: 700,
                    textDecoration: 'none',
                    boxShadow: '0 4px 14px rgba(var(--primary-red-rgb), 0.4)'
                  }}
                >
                  Upgrade to Pro
                </Link>
              ) : (
                <button
                  type="button"
                  style={{
                    padding: '8px 16px',
                    borderRadius: 'var(--radius)',
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
                padding: isMobile ? 16 : 24,
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border-default)',
                boxShadow: 'var(--shadow-color-base)'
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
                Billing History & Download Receipts
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
                  No billing history available for this account.
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Tab 4: Security & Password */}
        {activeTab === 'security' && (
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              padding: isMobile ? 16 : 24,
              borderRadius: 'var(--radius)',
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
                  borderRadius: 'var(--radius)',
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
                  borderRadius: 'var(--radius)',
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
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border-default)',
                  backgroundColor: 'var(--bg-subtle)',
                  color: 'var(--text-primary)',
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 16, borderTop: '1px solid var(--border-default)' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Two-Factor Authentication (2FA)</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Add an extra layer of security to your account with SMS or Authenticator app code</div>
              </div>
              <button
                type="button"
                onClick={() => setTwoFactor(!twoFactor)}
                style={{
                  padding: '6px 16px',
                  borderRadius: 'var(--radius)',
                  border: 'none',
                  backgroundColor: twoFactor ? '#3A8B53' : 'var(--bg-subtle)',
                  color: twoFactor ? 'var(--bg-card)' : 'var(--text-muted)',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  flexShrink: 0
                }}
              >
                {twoFactor ? 'Enabled ✓' : 'Disabled'}
              </button>
            </div>

          </div>
        )}

        {/* ─── Save Changes Sticky Action Bar ───────────────────────────────────── */}
        <div style={{ marginTop: 24, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: isMobile ? 12 : 16 }}>
          <button
            type="submit"
            style={{
              padding: '12px 24px',
              width: isMobile ? '100%' : undefined,
              justifyContent: 'center',
              borderRadius: 'var(--radius)',
              border: 'none',
              backgroundColor: 'var(--primary-red)',
              color: 'var(--bg-card)',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 4px 14px rgba(var(--primary-red-rgb), 0.4)',
              transition: 'transform 0.2s'
            }}
          >
            <Save size={18} />
            <span>Save Profile Settings</span>
          </button>

          {savedSuccess && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#3A8B53', fontSize: 13, fontWeight: 700 }}>
              <Check size={18} />
              <span>Settings updated successfully!</span>
            </div>
          )}
        </div>

      </form>
    </>
  );

  if (isAdmin) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#F7F7F5', fontFamily: 'Inter, sans-serif', color: 'var(--deep-navy)', overflowX: 'hidden' }}>
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
            permissions={user?.admin_permissions}
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
