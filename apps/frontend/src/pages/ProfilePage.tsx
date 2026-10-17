import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
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
import { WEEKLY_HOURS_OPTIONS, PROFICIENCY_LABELS, TARGET_YEAR_OPTIONS } from '../constants/onboarding';
import { fetchActiveExamTypes } from '../services/examTypeService';
import { INDIAN_STATES } from '../constants/indianStates';
import { checkUsername } from '../services/leaderboardService';
import { SubjectRatingEditor } from '../components/student/SubjectRatingEditor';

const editableSelectStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: 'var(--radius)',
  border: '1px solid var(--border-default)',
  backgroundColor: 'var(--bg-subtle)',
  color: 'var(--text-primary)',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
};

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

  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'personal' | 'exam' | 'billing' | 'security'>(() => {
    const t = searchParams.get('tab');
    return t === 'exam' || t === 'billing' || t === 'security' ? t : 'personal';
  });
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
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

  // Subject ratings: moved out of onboarding, edited here (or prompted for on the study planner).
  const [editingRatings, setEditingRatings] = useState(false);
  const [draftRatings, setDraftRatings] = useState<Record<string, number>>({});
  const [savingRatings, setSavingRatings] = useState(false);
  const [ratingsError, setRatingsError] = useState<string | null>(null);

  const startEditingRatings = () => {
    setDraftRatings({ ...(user.subject_proficiency || {}) });
    setRatingsError(null);
    setEditingRatings(true);
  };

  const saveRatings = async () => {
    setSavingRatings(true);
    setRatingsError(null);
    try {
      const fresh = await updateUserProfile({ subject_proficiency: draftRatings });
      setUser(fresh);
      setEditingRatings(false);
    } catch {
      setRatingsError('Could not save your ratings. Please try again.');
    } finally {
      setSavingRatings(false);
    }
  };

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
  // Target exam and year can be changed any time; the optional subject is fixed after onboarding.
  const [targetExam, setTargetExam] = useState<string>(user.target_exam || '');
  const [targetYear, setTargetYear] = useState<string>(user.target_year || '');
  useEffect(() => {
    if (user.target_exam) setTargetExam(user.target_exam);
    if (user.target_year) setTargetYear(user.target_year);
  }, [user.target_exam, user.target_year]);
  const optionalSubject: string = user.optional_subject || '';
  // Leaderboard: state, public username (changeable if free) and which name to show
  const [stateName, setStateName] = useState<string>(user.state || '');
  const [username, setUsername] = useState<string>(user.username || '');
  const [leaderboardDisplay, setLeaderboardDisplay] = useState<'USERNAME' | 'NAME'>(user.leaderboard_display === 'NAME' ? 'NAME' : 'USERNAME');
  const [usernameStatus, setUsernameStatus] = useState<{ checking: boolean; available: boolean | null; reason: string | null }>({ checking: false, available: null, reason: null });
  useEffect(() => {
    if (user.state) setStateName(user.state);
    if (user.username) setUsername(user.username);
    if (user.leaderboard_display) setLeaderboardDisplay(user.leaderboard_display === 'NAME' ? 'NAME' : 'USERNAME');
  }, [user.state, user.username, user.leaderboard_display]);
  useEffect(() => {
    const value = username.trim().toLowerCase();
    if (!value || value === (user.username || '')) {
      setUsernameStatus({ checking: false, available: null, reason: null });
      return;
    }
    setUsernameStatus({ checking: true, available: null, reason: null });
    const timer = setTimeout(() => {
      checkUsername(value).then((r) => setUsernameStatus({ checking: false, available: r.available, reason: r.reason }));
    }, 400);
    return () => clearTimeout(timer);
  }, [username, user.username]);
  const [examOptions, setExamOptions] = useState<string[]>([]);
  useEffect(() => {
    fetchActiveExamTypes()
      .then((types) => setExamOptions(types.filter((t) => t.is_active !== false).map((t) => t.name)))
      .catch(() => setExamOptions([]));
  }, []);
  // Keep the stored values selectable even if they're no longer in the current lists
  const examChoices = targetExam && !examOptions.includes(targetExam) ? [targetExam, ...examOptions] : examOptions;
  const yearChoices = targetYear && !TARGET_YEAR_OPTIONS.includes(targetYear) ? [targetYear, ...TARGET_YEAR_OPTIONS] : TARGET_YEAR_OPTIONS;
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

  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    const isStudent = !(isAdmin || isSuperAdmin);
    setSaveError(null);
    setIsSaving(true);
    try {
      const saved = await updateUserProfile({
        full_name: fullName,
        profile_image: profileImage,
        phone,
        ...(isStudent && weeklyGoalHours ? { weekly_hours: weeklyGoalHours } : {}),
        // Target exam and year are editable; the optional subject is locked server-side after onboarding.
        ...(isStudent && targetExam ? { target_exam: targetExam } : {}),
        ...(isStudent && targetYear ? { target_year: targetYear } : {}),
        ...(isStudent ? { state: stateName, leaderboard_display: leaderboardDisplay } : {}),
        ...(isStudent && username.trim() && username.trim().toLowerCase() !== (user.username || '') ? { username: username.trim().toLowerCase() } : {}),
      });
      const updatedUser = { ...user, ...saved, bio };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      // Trigger window events so header picks up changes
      window.dispatchEvent(new Event('user_profile_updated'));
      window.dispatchEvent(new Event('storage'));
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      console.error('Failed to save profile:', err);
      setSaveError(err?.message || 'Could not save your changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
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
          // On phones the tabs wrap into a grid; a hidden-scrollbar strip cut off the last tab.
          flexWrap: isMobile ? 'wrap' : 'nowrap',
          overflowX: isMobile ? 'visible' : 'auto',
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
                padding: isMobile ? '9px 10px' : '10px 18px',
                flex: isMobile ? '1 1 calc(50% - 4px)' : '0 0 auto',
                justifyContent: isMobile ? 'center' : undefined,
                minWidth: 0,
                whiteSpace: isMobile ? 'normal' : 'nowrap',
                textAlign: 'center',
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
              <label htmlFor="profile-target-exam" style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
                Primary Target Exam
              </label>
              <select
                id="profile-target-exam"
                value={targetExam}
                onChange={(e) => setTargetExam(e.target.value)}
                style={editableSelectStyle}
              >
                {!targetExam && <option value="">Select exam…</option>}
                {examChoices.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="profile-target-year" style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
                Target Attempt Year
              </label>
              <select
                id="profile-target-year"
                value={targetYear}
                onChange={(e) => setTargetYear(e.target.value)}
                style={editableSelectStyle}
              >
                {!targetYear && <option value="">Select year…</option>}
                {yearChoices.map((y) => (
                  <option key={y} value={y}>{y} Attempt</option>
                ))}
              </select>
            </div>

            {/* Only older UPSC profiles have an optional subject; onboarding no longer asks for it. */}
            {optionalSubject && (
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
            )}

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

            {/* Leaderboard identity */}
            <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--border-color)', paddingTop: 16, display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? 16 : 20 }}>
              <div style={{ gridColumn: '1 / -1', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                Leaderboard
                <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-muted)', marginTop: 2 }}>
                  Your state places you in the state ranking. Others see your username or your real name, as you choose.
                </div>
              </div>
              <div>
                <label htmlFor="profile-state" style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>State</label>
                <select id="profile-state" value={stateName} onChange={(e) => setStateName(e.target.value)} style={editableSelectStyle}>
                  <option value="">Select state…</option>
                  {INDIAN_STATES.map((st) => <option key={st} value={st}>{st}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="profile-username" style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>Username</label>
                <input
                  id="profile-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. aspirant_2027"
                  maxLength={20}
                  autoComplete="off"
                  aria-describedby="profile-username-help"
                  style={{ ...editableSelectStyle }}
                />
                <div id="profile-username-help" style={{ fontSize: 12, marginTop: 5, color: usernameStatus.available === false ? 'var(--primary-red)' : usernameStatus.available ? '#059669' : 'var(--text-muted)' }}>
                  {usernameStatus.checking
                    ? 'Checking…'
                    : usernameStatus.available === true
                    ? 'Available'
                    : usernameStatus.available === false
                    ? (usernameStatus.reason || 'Not available')
                    : '3-20 characters: lowercase letters, numbers or underscores'}
                </div>
              </div>
              <fieldset style={{ gridColumn: '1 / -1', border: 'none', padding: 0, margin: 0 }}>
                <legend style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Show on the leaderboard</legend>
                <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 14 }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input type="radio" name="leaderboard-display" checked={leaderboardDisplay === 'USERNAME'} onChange={() => setLeaderboardDisplay('USERNAME')} />
                    My username{username.trim() ? ` (${username.trim().toLowerCase()})` : ''}
                  </label>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input type="radio" name="leaderboard-display" checked={leaderboardDisplay === 'NAME'} onChange={() => setLeaderboardDisplay('NAME')} />
                    My real name ({fullName || 'your name'})
                  </label>
                </div>
              </fieldset>
            </div>

            {/* Self-rated proficiency: editable here, also prompted for before the first study plan */}
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Subject Proficiency</div>
                {!editingRatings && (
                  <button
                    type="button"
                    onClick={startEditingRatings}
                    style={{
                      padding: '7px 14px',
                      borderRadius: 'var(--radius)',
                      border: '1px solid var(--primary-red)',
                      backgroundColor: 'transparent',
                      color: 'var(--primary-red)',
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    {Object.keys(user.subject_proficiency || {}).length ? 'Edit ratings' : 'Rate now'}
                  </button>
                )}
              </div>
              {editingRatings ? (
                <div>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 0, marginBottom: 12 }}>
                    Rate how confident you feel in each subject, from 1 (just starting) to 5 (expert). Skip any you are unsure about.
                  </p>
                  <SubjectRatingEditor value={draftRatings} onChange={setDraftRatings} disabled={savingRatings} />
                  {ratingsError && (
                    <div role="alert" style={{ marginTop: 12, color: '#d32f2f', fontSize: 13, fontWeight: 600 }}>{ratingsError}</div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => setEditingRatings(false)}
                      disabled={savingRatings}
                      style={{
                        padding: '9px 16px',
                        borderRadius: 'var(--radius)',
                        border: '1px solid var(--border-default)',
                        backgroundColor: 'transparent',
                        color: 'var(--text-primary)',
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: savingRatings ? 'default' : 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={saveRatings}
                      disabled={savingRatings}
                      style={{
                        padding: '9px 18px',
                        borderRadius: 'var(--radius)',
                        border: 'none',
                        backgroundColor: 'var(--primary-red)',
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: savingRatings ? 'default' : 'pointer',
                        opacity: savingRatings ? 0.7 : 1,
                      }}
                    >
                      {savingRatings ? 'Saving…' : 'Save ratings'}
                    </button>
                  </div>
                </div>
              ) : Object.keys(user.subject_proficiency || {}).length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  You haven't rated any subjects yet. Rating them helps us personalise your study plan.
                </div>
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
                You can change your target exam, attempt year and weekly goal any time.{optionalSubject ? ' Your optional subject was set during onboarding and stays fixed.' : ''}
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
            disabled={isSaving}
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
            <span>{isSaving ? 'Saving…' : 'Save Profile Settings'}</span>
          </button>

          {saveError && (
            <div role="alert" style={{ color: 'var(--primary-red)', fontSize: 13, fontWeight: 700 }}>
              {saveError}
            </div>
          )}
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
