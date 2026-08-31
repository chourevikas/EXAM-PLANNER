import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Logo } from '../components/common/Logo';
import { Ico } from '../components/common/Icons';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Cell } from 'recharts';
import { fetchCurrentUser, syncGuestSessionsOnAuth } from '../services/authService';
import { listExams } from '../services/examService';
import { useUser, useAuth } from '@clerk/clerk-react';
import { StudentLayout } from '../components/student/StudentLayout';
import StudentMetricCard from '../components/student/StudentMetricCard';
import { LogStudyModal } from '../components/student/LogStudyModal';
import { StudentTestimonialForm } from '../components/student/StudentTestimonialForm';
import { StudentMetricCardSkeleton } from '../components/student/StudentMetricCardSkeleton';
import { useMinimumLoadingTime } from '../hooks/useMinimumLoadingTime';

import { fetchPredictedRank, PredictedRankResponse } from '../services/analyticsService';
import { ChevronLeft, ChevronRight, Trophy, RefreshCw } from 'lucide-react';
import { StatusBadge } from '../components/common/StatusBadge';
import { formatEnum } from '../utils/formatEnum';

const studyHoursData = [
  { day: 'Mon', hours: 4.5 },
  { day: 'Tue', hours: 5.2 },
  { day: 'Wed', hours: 3.8 },
  { day: 'Thu', hours: 6.0 },
  { day: 'Fri', hours: 7.5 },
  { day: 'Sat', hours: 8.2 },
  { day: 'Sun', hours: 6.5 },
];

export function DashboardPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || '{}'));

  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN') {
      navigate('/superadmin', { replace: true });
    } else if (user?.role === 'ADMIN') {
      navigate('/admin', { replace: true });
    } else if (user?.role === 'TEACHER') {
      navigate('/teacher', { replace: true });
    }
  }, [user, navigate]);

  const { user: clerkUser } = useUser();
  const { getToken } = useAuth();

  const [activeExam, setActiveExam] = useState<any>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showBadgesModal, setShowBadgesModal] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [badges, setBadges] = useState<{ unlocked: any[], locked: any[] }>({ unlocked: [], locked: [] });
  const [todayActivities, setTodayActivities] = useState<any[]>([]);
  const [subjectData, setSubjectData] = useState<any[]>([]);
  const [isLoadingSubjects, setIsLoadingSubjects] = useState<boolean>(true);
  const [predictedRank, setPredictedRank] = useState<PredictedRankResponse | null>(null);
  const [studyLog, setStudyLog] = useState<any>({
    activity_type: 'REVISION',
    activity_source: 'UNPLANNED',
    subject: '',
    topic: '',
    duration_minutes: 60,
    questions_attempted: 0,
    questions_correct: 0,
    confidence_rating: 5,
    notes: ''
  });
  const [isSubmittingLog, setIsSubmittingLog] = useState(false);

  const [dashboardStats, setDashboardStats] = useState<any>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [attemptsPage, setAttemptsPage] = useState<number>(0);
  const [guestSessionsPage, setGuestSessionsPage] = useState<number>(0);
  const SESSIONS_PER_PAGE = 3;

  useEffect(() => {
    document.title = 'Dashboard - Exam Planner';

    const loadDashboard = async () => {
      // Acquire token once — reused by all parallel requests
      const token = (await getToken()) || localStorage.getItem('access_token');
      const authHeaders: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};

      // Sync guest sessions before firing dashboard queries
      if (token) {
        syncGuestSessionsOnAuth(token).catch(() => {});
        sessionStorage.removeItem('latest_synced_attempt_id');
      }

      // Fire ALL dashboard requests in parallel — no more sequential waterfall
      const [
        userResult,
        statsResult,
        subjectResult,
        activityResult,
        rankResult,
        badgesResult,
        examsResult,
      ] = await Promise.allSettled([
        fetchCurrentUser(token || undefined),
        fetch('/api/v1/attempts/student-dashboard-stats', { headers: authHeaders }).then(r => r.ok ? r.json() : null),
        fetch('/api/v1/analytics/subject-performance', { headers: authHeaders }).then(r => r.ok ? r.json() : null),
        fetch('/api/v1/analytics/activity/today', { headers: authHeaders }).then(r => r.ok ? r.json() : null),
        fetchPredictedRank(),
        token ? fetch('/api/v1/study-plan/badges', { headers: authHeaders }).then(r => r.ok ? r.json() : null) : Promise.resolve(null),
        listExams(),
      ]);

      // Apply results — each is independent so a failure in one doesn't block others
      if (userResult.status === 'fulfilled' && userResult.value) {
        setUser(userResult.value);
      }
      if (statsResult.status === 'fulfilled' && statsResult.value?.totalExams !== undefined) {
        setDashboardStats(statsResult.value);
      }
      if (subjectResult.status === 'fulfilled' && Array.isArray(subjectResult.value)) {
        setSubjectData(subjectResult.value);
      }
      if (activityResult.status === 'fulfilled' && Array.isArray(activityResult.value)) {
        setTodayActivities(activityResult.value);
      }
      if (rankResult.status === 'fulfilled' && rankResult.value) {
        setPredictedRank(rankResult.value);
      }
      if (badgesResult.status === 'fulfilled' && badgesResult.value?.unlocked) {
        setBadges(badgesResult.value);
      }
      if (examsResult.status === 'fulfilled' && Array.isArray(examsResult.value) && examsResult.value.length > 0) {
        const published = examsResult.value.find((e: any) => e.is_active || (e.status && String(e.status).includes('PUBLISHED')));
        setActiveExam(published || examsResult.value[0]);
      }

      // Done loading
      setIsLoadingStats(false);
      setIsLoadingSubjects(false);
    };

    loadDashboard().catch(err => {
      console.error('Dashboard load error:', err);
      setIsLoadingStats(false);
      setIsLoadingSubjects(false);
    });
  }, []);



  const isFreeTier = user.subscription_tier !== 'PREMIUM';

  const todayQuestionsAttempted = todayActivities.reduce((acc: number, curr: any) => acc + (curr.questions_attempted || 0), 0);
  const totalQuestionsSolved = dashboardStats && dashboardStats.totalQuestionsAttempted !== undefined
    ? dashboardStats.totalQuestionsAttempted
    : (user?.free_questions_attempted || 0);

  return (
    <StudentLayout pageTitle="Dashboard">

      {/* 1. Personalized Welcome & AI Motivation */}
      <section style={{ marginBottom: 'clamp(24px, 4vw, 40px)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ flex: '1 1 280px', minWidth: 0 }}>
          <h1 style={{ fontSize: 'clamp(22px, 3.5vw, 32px)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8, letterSpacing: '-0.02em' }}>
            Welcome back, {clerkUser?.firstName || user.full_name?.split(' ')[0] || 'Aspirant'}! 👋
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: 'clamp(13px, 2.5vw, 15px)', flexWrap: 'wrap' }}>
            <div style={{ color: 'var(--accent-primary)', flexShrink: 0 }}><Ico.Brain /></div>
            <span><strong style={{ color: 'var(--text-primary)' }}>Smart Insight:</strong> Your polity accuracy is up 12% this week. Keep up the momentum!</span>
          </div>
        </div>

        <button
          onClick={() => setShowLogModal(true)}
          className="touch-target"
          style={{
            padding: '12px 20px',
            backgroundColor: 'var(--accent-primary)',
            color: '#fff',
            border: 'none',
            borderRadius: 0,
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: '0 4px 12px rgba(227, 27, 35, 0.3)',
            transition: 'transform 0.2s',
            whiteSpace: 'nowrap',
          }}
          onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          <Ico.Pen /> Log Today's Study
        </button>
      </section>

      {/* 2. Key Metrics Grid (Admin Dashboard Design Language) */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 18, marginBottom: 32 }}>
        {useMinimumLoadingTime(isLoadingStats) ? (
          <>
            {Array.from({ length: 4 }).map((_, i) => (
              <StudentMetricCardSkeleton key={i} showProgress={i === 0} />
            ))}
          </>
        ) : (
          <>
            <StudentMetricCard
              title="Total Questions Solved"
              value={
                <span>
                  {totalQuestionsSolved.toLocaleString()}{' '}
                  <span style={{ fontSize: 14, fontWeight: 500, color: '#64748B' }}>Qs</span>
                </span>
              }
              supportingText={todayQuestionsAttempted > 0 ? `${todayQuestionsAttempted} Qs attempted today` : "Across all practice exams"}
              icon={<Ico.Target size={18} />}
              showProgress={true}
              progressPercent={Math.min((totalQuestionsSolved / 500) * 100, 100)}
              accentColor="#E31B23"
            />

            <StudentMetricCard
              title="Tests Completed"
              value={
                <span>
                  {dashboardStats?.totalExams ?? 0}{' '}
                  <span style={{ fontSize: 14, fontWeight: 500, color: '#64748B' }}>Exams</span>
                </span>
              }
              supportingText="Completed practice tests"
              icon={<Ico.Trophy size={18} />}
              accentColor="#F2B623"
            />

            <StudentMetricCard
              title="Overall Accuracy"
              value={
                <span>
                  {dashboardStats?.overallAccuracy ?? 0}%
                </span>
              }
              supportingText="Average correctness score"
              icon={<Ico.Chart size={18} />}
              accentColor="#3A8B53"
            />

            <StudentMetricCard
              title="Total XP / Badges"
              value={
                <span>
                  {(user.total_xp ?? 0).toLocaleString()}{' '}
                  <span style={{ fontSize: 14, fontWeight: 500, color: '#64748B' }}>XP</span>
                </span>
              }
              supportingText={
                <span style={{ color: '#E31B23', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  View Achievements <Ico.ArrowRight size={13} />
                </span>
              }
              icon={<Ico.Star filled />}
              onClick={() => setShowBadgesModal(true)}
              accentColor="#E31B23"
            />
          </>
        )}
      </section>


      {/* 3. Performance Analytics */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 20, marginBottom: 32 }}>
        {/* Subject Accuracy */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            padding: '22px 24px',
            borderRadius: 0,
            border: '1px solid #E2E8F0',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04), 0 1px 2px rgba(15, 23, 42, 0.02)',
            fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
          }}
        >
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h3 style={{ fontSize: 16.5, fontWeight: 700, color: '#172033', margin: '0 0 4px 0' }}>Subject Accuracy</h3>
              <p style={{ fontSize: 13, color: '#64748B', margin: 0 }}>Your strong areas vs. areas needing improvement.</p>
            </div>
            {subjectData.length > 0 && subjectData.every(s => s.total_attempted === 0) && (
              <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 0, backgroundColor: '#FEF3C7', color: '#B45309' }}>
                No Activity Recorded
              </span>
            )}
          </div>
          <div style={{ height: 250, width: '100%' }}>
            {isLoadingSubjects ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B', fontSize: 13 }}>
                Loading subject performance...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={subjectData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#E2E8F0" opacity={0.6} />
                  <XAxis dataKey="subject" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} domain={[0, 100]} unit="%" />
                  <Tooltip
                    cursor={{ fill: '#F8FAFC' }}
                    content={({ active, payload }: any) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', padding: '10px 14px', borderRadius: 0, boxShadow: '0 4px 12px rgba(15,23,42,0.08)' }}>
                            <div style={{ fontWeight: 700, fontSize: 13, color: '#172033', marginBottom: 4 }}>{formatEnum(data.subject)}</div>
                            <div style={{ fontSize: 12, color: '#E31B23', fontWeight: 600 }}>Accuracy: {data.accuracy}%</div>
                            <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                              Attempted: {data.total_attempted} | Correct: {data.total_correct}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="accuracy" radius={[6, 6, 0, 0]} maxBarSize={38}>
                    {subjectData.map((entry: any, index: number) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.total_attempted === 0 ? '#CBD5E1' : entry.accuracy >= 75 ? '#3A8B53' : entry.accuracy >= 60 ? '#E31B23' : '#F2B623'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Time Management */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            padding: '22px 24px',
            borderRadius: 0,
            border: '1px solid #E2E8F0',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04), 0 1px 2px rgba(15, 23, 42, 0.02)',
            fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
          }}
        >
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 16.5, fontWeight: 700, color: '#172033', margin: '0 0 4px 0' }}>Time Management</h3>
            <p style={{ fontSize: 13, color: '#64748B', margin: 0 }}>Study hours logged this week.</p>
          </div>
          <div style={{ height: 250, width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={studyHoursData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#E31B23" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#E31B23" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#E2E8F0" opacity={0.6} />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                <Tooltip
                  cursor={{ stroke: '#CBD5E1', strokeWidth: 1, strokeDasharray: '4 4' }}
                  contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#E2E8F0', borderRadius: 0, boxShadow: '0 4px 12px rgba(15,23,42,0.08)', color: '#172033' }}
                />
                <Area type="monotone" dataKey="hours" stroke="#E31B23" strokeWidth={2.5} fillOpacity={1} fill="url(#colorHours)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>


      {/* 4. Deep AI Insights & Call to Action */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: 24, marginBottom: 32 }}>

        {/* The Psychometric Layer */}
        <div style={{
          backgroundColor: 'var(--bg-card)', padding: 'clamp(20px, 4vw, 32px)', borderRadius: 0,
          border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-color-base)',
          position: 'relative', overflow: 'hidden'
        }}>
          {/* Blur Overlay for Free Tier */}
          {isFreeTier && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 10,
              backdropFilter: 'blur(8px)', backgroundColor: 'rgba(255,255,255,0.1)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: 20,
            }}>
              <div style={{ padding: 16, backgroundColor: 'var(--bg-card)', borderRadius: 0, boxShadow: 'var(--shadow-color-base)', marginBottom: 16 }}>
                <Ico.Shield />
              </div>
              <h3 style={{ fontSize: 'clamp(18px, 3.5vw, 20px)', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px 0', textAlign: 'center' }}>Premium Analytics Locked</h3>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24, textAlign: 'center', maxWidth: 280 }}>
                Unlock deep behavioral tracking and psychometric insights with the Pro Plan.
              </p>
              <Link to="/pricing" className="touch-target" style={{
                padding: '12px 24px', backgroundColor: 'var(--accent-primary)', color: '#FFF',
                borderRadius: 0, fontSize: 14, fontWeight: 700, textDecoration: 'none',
                boxShadow: '0 8px 16px var(--shadow-color-accent)'
              }}>
                Upgrade to Pro
              </Link>
            </div>
          )}

          <div style={{ opacity: isFreeTier ? 0.6 : 1, filter: isFreeTier ? 'blur(3px)' : 'none', transition: 'all 0.3s' }}>
            {/* Subtle ambient glow for AI section */}
            <div style={{ position: 'absolute', top: -50, right: -50, width: 200, height: 200, background: 'radial-gradient(circle, var(--accent-bg) 0%, transparent 70%)', opacity: 0.7, pointerEvents: 'none' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <div style={{ padding: 8, backgroundColor: 'var(--pink-bg)', color: 'var(--pink-primary)', borderRadius: 0 }}>
                <Ico.Brain />
              </div>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Deep Behavioral Insights</h3>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>Behavioral & Psychometric Analysis</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 'clamp(16px, 3vw, 32px)' }}>
              {/* Decision Accuracy */}
              <div>
                <h4 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-disabled)', fontWeight: 700, marginBottom: 16 }}>Decision Accuracy</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ padding: 16, backgroundColor: 'var(--bg-subtle)', borderRadius: 0, border: '1px solid var(--border-default)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Direct Hits</span>
                      <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--success-primary)' }}>68%</span>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Perfect accuracy on first attempt.</p>
                  </div>
                  <div style={{ padding: 16, backgroundColor: 'var(--bg-subtle)', borderRadius: 0, border: '1px solid var(--border-default)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Partial Understanding</span>
                      <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--warning-primary)' }}>22%</span>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Selected the 2nd most probable option.</p>
                  </div>
                </div>
              </div>

              {/* Behavior Analysis */}
              <div>
                <h4 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-disabled)', fontWeight: 700, marginBottom: 16 }}>Behavior Analysis</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}>Question Jumping</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--warning-primary)' }}>Moderate (12 times)</span>
                    </div>
                    <div style={{ height: 6, width: '100%', backgroundColor: 'var(--bg-subtle)', borderRadius: 0, overflow: 'hidden' }}>
                      <div style={{ width: '40%', height: '100%', backgroundColor: 'var(--warning-primary)', borderRadius: 0 }} />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}>Option Hesitation</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--success-primary)' }}>Low (Avg 4s)</span>
                    </div>
                    <div style={{ height: 6, width: '100%', backgroundColor: 'var(--bg-subtle)', borderRadius: 0, overflow: 'hidden' }}>
                      <div style={{ width: '15%', height: '100%', backgroundColor: 'var(--success-primary)', borderRadius: 0 }} />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}>Avg Time / Question</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-primary)' }}>1m 12s</span>
                    </div>
                    <div style={{ height: 6, width: '100%', backgroundColor: 'var(--bg-subtle)', borderRadius: 0, overflow: 'hidden' }}>
                      <div style={{ width: '60%', height: '100%', backgroundColor: 'var(--accent-primary)', borderRadius: 0 }} />
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 5. Call to Action / Next Up */}
        <div style={{
          backgroundColor: 'var(--accent-primary)', padding: 'clamp(20px, 4vw, 32px)', borderRadius: 0,
          color: '#FFFFFF', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          boxShadow: '0 20px 40px var(--shadow-color-accent)',
          backgroundImage: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-darker) 100%)',
          position: 'relative', overflow: 'hidden', minWidth: 0
        }}>
          <div style={{ position: 'absolute', top: -30, right: -30, opacity: 0.1 }}>
            <Ico.Target />
          </div>

          <div style={{ marginBottom: 20, position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'inline-block', padding: '6px 12px', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 0, fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 16 }}>
              Up Next
            </div>
            <h3 style={{ fontSize: 'clamp(18px, 3vw, 22px)', fontWeight: 800, margin: '0 0 12px 0', lineHeight: 1.3 }}>
              {activeExam ? `Practice ${activeExam.name}` : 'Resume UPSC CSE Practice'}
            </h3>
            <p style={{ fontSize: 14, opacity: 0.9, margin: 0, lineHeight: 1.5 }}>
              Ready to test your concept retention? Start an active UPSC Prelims exam session now.
            </p>
          </div>

          <button
            onClick={() => window.location.href = activeExam ? `/exam/${activeExam.code}` : '/pyq'}
            className="touch-target"
            style={{
              width: '100%', padding: '14px', borderRadius: 0, border: 'none',
              backgroundColor: '#FFFFFF', color: 'var(--accent-darker)',
              fontSize: 14, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              marginTop: 16, transition: 'transform 0.2s', position: 'relative', zIndex: 1,
              whiteSpace: 'nowrap'
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            <span>Start Practice Exam</span>
            <Ico.ArrowRight size={16} />
          </button>
        </div>
      </section>


      {/* 4. Today's Study Feed */}
      <section style={{ marginBottom: 40 }}>
        <div style={{ backgroundColor: 'var(--bg-card)', padding: 24, borderRadius: 0, border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-color-base)' }}>
          <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>Today's Study Log</h3>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>
                {todayActivities.length === 0 ? 'No activities logged today.' : `${todayActivities.length} activities logged`}
              </p>
            </div>
            <div style={{ padding: '8px 16px', backgroundColor: 'var(--bg-subtle)', borderRadius: 0, border: '1px solid var(--border-default)' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                Total: {Math.floor(todayActivities.reduce((acc, curr) => acc + curr.duration_minutes, 0) / 60)}h{' '}
                {todayActivities.reduce((acc, curr) => acc + curr.duration_minutes, 0) % 60}m
              </span>
            </div>
          </div>
          <div style={{ overflowY: 'auto', maxHeight: 300, display: 'flex', flexDirection: 'column', gap: 12, paddingRight: 4 }}>
            {todayActivities.length === 0 ? (
              <div style={{ padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                <Ico.Book size={40} />
                <p style={{ fontSize: 15, marginTop: 16 }}>Ready to start studying? Log your first activity today!</p>
              </div>
            ) : (
              todayActivities.map((activity, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 16, backgroundColor: 'var(--bg-subtle)', borderRadius: 0, border: '1px solid var(--border-default)' }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: activity.activity_type === 'MOCK_TEST' ? 'rgba(234, 179, 8, 0.1)' :
                      activity.activity_type === 'PYQ' ? 'rgba(168, 85, 247, 0.1)' :
                        activity.activity_type === 'REVISION' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(227, 27, 35, 0.1)',
                    color: activity.activity_type === 'MOCK_TEST' ? '#EAB308' :
                      activity.activity_type === 'PYQ' ? '#A855F7' :
                        activity.activity_type === 'REVISION' ? '#22C55E' : '#E31B23'
                  }}>
                    {activity.activity_type === 'MOCK_TEST' || activity.activity_type === 'PYQ' ? <Ico.Trophy size={20} /> :
                      activity.activity_type === 'REVISION' ? <Ico.Refresh /> : <Ico.Book size={20} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                      {activity.subject || activity.activity_type.replace('_', ' ')}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      {activity.topic || 'General Practice'} • {activity.activity_source}
                    </div>
                    {(activity.activity_type === 'MOCK_TEST' || activity.activity_type === 'PYQ') && activity.questions_attempted > 0 && (
                      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Accuracy: {Math.round((activity.questions_correct / activity.questions_attempted) * 100)}%</div>
                    )}
                    {activity.activity_type === 'REVISION' && activity.confidence_rating && (
                      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Confidence: {activity.confidence_rating}/10</div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
                      {Math.floor(activity.duration_minutes / 60) > 0 && `${Math.floor(activity.duration_minutes / 60)}h `}{activity.duration_minutes % 60}m
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                      {new Date(activity.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* 5. Exam Attempts History & Synced Guest Sessions Feed - Symmetrical Cards */}
      <section style={{ marginBottom: 40 }}>
        {(() => {
          const registeredAttempts = dashboardStats?.recentAttempts?.filter((a: any) => !a.isGuestSynced) || [];
          const syncedGuestAttempts = dashboardStats?.recentAttempts?.filter((a: any) => a.isGuestSynced) || [];
          
          const attemptsTotalPages = Math.max(1, Math.ceil(registeredAttempts.length / SESSIONS_PER_PAGE));
          const visibleRegisteredAttempts = registeredAttempts.slice(attemptsPage * SESSIONS_PER_PAGE, (attemptsPage + 1) * SESSIONS_PER_PAGE);

          const guestTotalPages = Math.max(1, Math.ceil(syncedGuestAttempts.length / SESSIONS_PER_PAGE));
          const visibleSyncedGuestAttempts = syncedGuestAttempts.slice(guestSessionsPage * SESSIONS_PER_PAGE, (guestSessionsPage + 1) * SESSIONS_PER_PAGE);

          return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: 24 }}>
              
              {/* Card 1: Recent Exam Attempts */}
              <div style={{
                backgroundColor: 'var(--bg-card)',
                padding: 24,
                borderRadius: 0,
                border: '1px solid var(--border-default)',
                boxShadow: 'var(--shadow-color-base)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                height: 420,
                boxSizing: 'border-box'
              }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div>
                      <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 2px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Trophy size={18} color="#E31B23" /> Recent Exam Attempts
                      </h3>
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>Registered exam history</p>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 0, backgroundColor: '#F8FAFC', color: '#E31B23', border: '1px solid #BFDBFE' }}>
                      {registeredAttempts.length} Recorded
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {visibleRegisteredAttempts.length === 0 ? (
                      <div style={{ padding: '36px 16px', textAlign: 'center', backgroundColor: 'var(--bg-subtle)', borderRadius: 0, color: 'var(--text-muted)' }}>
                        <Trophy size={28} />
                        <p style={{ fontSize: 13, marginTop: 8, margin: 0 }}>No main exam attempts recorded yet.</p>
                      </div>
                    ) : (
                      visibleRegisteredAttempts.map((attempt: any) => (
                        <div
                          key={attempt.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 14px',
                            backgroundColor: 'var(--bg-subtle)',
                            borderRadius: 0,
                            border: '1px solid var(--border-default)',
                            gap: 12
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                              width: 36, height: 36, borderRadius: 0,
                              backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0', color: '#3A8B53',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontWeight: 800, fontSize: 14
                            }}>
                              P
                            </div>
                            <div>
                              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>
                                {attempt.topicName}
                              </div>
                              <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                                {attempt.targetExam} • {new Date(attempt.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                              </div>
                            </div>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>
                              Score: {attempt.score} / {attempt.totalMarksPossible}
                            </div>
                            <StatusBadge
                              status={attempt.accuracy >= 70 ? 'high-accuracy' : attempt.accuracy >= 40 ? 'moderate-accuracy' : 'low-accuracy'}
                              label={`${attempt.accuracy}% Acc`}
                              size="sm"
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Pagination Footer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: '1px solid var(--border-default)' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
                    Page {attemptsPage + 1} of {attemptsTotalPages}
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => setAttemptsPage(p => Math.max(0, p - 1))}
                      disabled={attemptsPage === 0}
                      style={{
                        padding: '5px 9px', borderRadius: 0, border: '1px solid var(--border-default)',
                        backgroundColor: attemptsPage === 0 ? 'var(--bg-subtle)' : 'var(--bg-card)',
                        color: attemptsPage === 0 ? 'var(--text-disabled)' : 'var(--text-primary)',
                        cursor: attemptsPage === 0 ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <button
                      onClick={() => setAttemptsPage(p => Math.min(attemptsTotalPages - 1, p + 1))}
                      disabled={attemptsPage >= attemptsTotalPages - 1}
                      style={{
                        padding: '5px 9px', borderRadius: 0, border: '1px solid var(--border-default)',
                        backgroundColor: attemptsPage >= attemptsTotalPages - 1 ? 'var(--bg-subtle)' : 'var(--bg-card)',
                        color: attemptsPage >= attemptsTotalPages - 1 ? 'var(--text-disabled)' : 'var(--text-primary)',
                        cursor: attemptsPage >= attemptsTotalPages - 1 ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Card 2: Synced Guest Sessions */}
              <div style={{
                backgroundColor: 'var(--bg-card)',
                padding: 24,
                borderRadius: 0,
                border: '1px solid var(--border-default)',
                boxShadow: 'var(--shadow-color-base)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                height: 420,
                boxSizing: 'border-box'
              }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div>
                      <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 2px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <RefreshCw size={18} color="#3A8B53" /> Synced Guest Sessions
                      </h3>
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>Auto-synced guest tests</p>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 0, backgroundColor: '#ECFDF5', color: '#3A8B53', border: '1px solid #A7F3D0' }}>
                      {syncedGuestAttempts.length} Synced
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {visibleSyncedGuestAttempts.length === 0 ? (
                      <div style={{ padding: '36px 16px', textAlign: 'center', backgroundColor: 'var(--bg-subtle)', borderRadius: 0, color: 'var(--text-muted)' }}>
                        <RefreshCw size={28} />
                        <p style={{ fontSize: 13, marginTop: 8, margin: 0 }}>No guest sessions synced yet.</p>
                      </div>
                    ) : (
                      visibleSyncedGuestAttempts.map((attempt: any) => (
                        <div
                          key={attempt.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 14px',
                            backgroundColor: 'var(--bg-subtle)',
                            borderRadius: 0,
                            border: '1px solid var(--border-default)',
                            gap: 12
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                              width: 36, height: 36, borderRadius: 0,
                              backgroundColor: '#F8FAFC', border: '1px solid #BFDBFE', color: '#E31B23',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontWeight: 800, fontSize: 14
                            }}>
                              G
                            </div>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>
                                  {attempt.topicName}
                                </span>
                                <span style={{ fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 0, backgroundColor: '#F8FAFC', color: '#E31B23', border: '1px solid #BFDBFE' }}>
                                  SYNCED
                                </span>
                              </div>
                              <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                                {attempt.targetExam} • {new Date(attempt.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                              </div>
                            </div>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>
                              Score: {attempt.score} / {attempt.totalMarksPossible}
                            </div>
                            <div style={{ fontSize: 11, color: attempt.accuracy >= 70 ? '#3A8B53' : '#F2B623', fontWeight: 700 }}>
                              {attempt.accuracy}% Acc
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Pagination Footer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: '1px solid var(--border-default)' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
                    Page {guestSessionsPage + 1} of {guestTotalPages}
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => setGuestSessionsPage(p => Math.max(0, p - 1))}
                      disabled={guestSessionsPage === 0}
                      style={{
                        padding: '5px 9px', borderRadius: 0, border: '1px solid var(--border-default)',
                        backgroundColor: guestSessionsPage === 0 ? 'var(--bg-subtle)' : 'var(--bg-card)',
                        color: guestSessionsPage === 0 ? 'var(--text-disabled)' : 'var(--text-primary)',
                        cursor: guestSessionsPage === 0 ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <button
                      onClick={() => setGuestSessionsPage(p => Math.min(guestTotalPages - 1, p + 1))}
                      disabled={guestSessionsPage >= guestTotalPages - 1}
                      style={{
                        padding: '5px 9px', borderRadius: 0, border: '1px solid var(--border-default)',
                        backgroundColor: guestSessionsPage >= guestTotalPages - 1 ? 'var(--bg-subtle)' : 'var(--bg-card)',
                        color: guestSessionsPage >= guestTotalPages - 1 ? 'var(--text-disabled)' : 'var(--text-primary)',
                        cursor: guestSessionsPage >= guestTotalPages - 1 ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </div>

            </div>
          );
        })()}
      </section>

      {/* Share Testimonial / Preparation Journey Section */}
      <StudentTestimonialForm userExamDefault={`${user.target_exam || 'UPSC CSE'} ${user.target_year || '2026'} Aspirant`} />

      {/* Badges Modal */}
      {showBadgesModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }} onClick={() => setShowBadgesModal(false)}>
          <div style={{
            backgroundColor: 'var(--bg-card)', width: '100%', maxWidth: 480,
            borderRadius: 0, padding: 32, boxShadow: '0 24px 48px rgba(0,0,0,0.2)',
            border: '1px solid var(--border-default)'
          }} onClick={e => e.stopPropagation()}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Your Achievements</h2>
              <button onClick={() => setShowBadgesModal(false)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: 'var(--text-secondary)' }}>&times;</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
              {/* Earned Badges */}
              {badges?.unlocked?.map(badge => (
                <div key={badge.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 16, backgroundColor: 'var(--success-bg, rgba(16, 185, 129, 0.1))', borderRadius: 0, border: '1px solid var(--success-primary)' }}>
                  <div style={{ fontSize: 32 }}>{badge.icon_url}</div>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{badge.name}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{badge.description}</div>
                  </div>
                </div>
              ))}

              {/* Locked Badges */}
              {badges?.locked?.map(badge => (
                <div key={badge.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 16, backgroundColor: 'var(--bg-subtle)', borderRadius: 0, border: '1px dashed var(--border-disabled)', opacity: 0.6 }}>
                  <div style={{ fontSize: 32, filter: 'grayscale(1)' }}>{badge.icon_url}</div>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                      {badge.name}
                      {badge.required_xp && <span style={{ fontSize: 11, backgroundColor: 'var(--bg-card)', padding: '2px 6px', borderRadius: 0, marginLeft: 8 }}>Requires {badge.required_xp} XP</span>}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{badge.description}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 24, textAlign: 'center' }}>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 8 }}>Keep hitting your daily goals to unlock more!</div>
              <div style={{ width: '100%', height: 8, backgroundColor: 'var(--bg-subtle)', borderRadius: 0, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(((user.total_xp ?? 0) / 2500) * 100, 100)}%`, height: '100%', backgroundColor: 'var(--accent-primary)', borderRadius: 0 }} />
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Unified Log Study Modal */}
      <LogStudyModal
        isOpen={showLogModal}
        onClose={() => setShowLogModal(false)}
        onSuccess={async () => {
          // Reload activity + stats in parallel after logging study
          const token = (await getToken()) || localStorage.getItem('access_token');
          const authHeaders: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};
          const [actRes, statsRes, subjRes] = await Promise.allSettled([
            fetch('/api/v1/analytics/activity/today', { headers: authHeaders }).then(r => r.ok ? r.json() : null),
            fetch('/api/v1/attempts/student-dashboard-stats', { headers: authHeaders }).then(r => r.ok ? r.json() : null),
            fetch('/api/v1/analytics/subject-performance', { headers: authHeaders }).then(r => r.ok ? r.json() : null),
          ]);
          if (actRes.status === 'fulfilled' && Array.isArray(actRes.value)) setTodayActivities(actRes.value);
          if (statsRes.status === 'fulfilled' && statsRes.value?.totalExams !== undefined) setDashboardStats(statsRes.value);
          if (subjRes.status === 'fulfilled' && Array.isArray(subjRes.value)) setSubjectData(subjRes.value);
        }}
      />
    </StudentLayout>
  );
}
