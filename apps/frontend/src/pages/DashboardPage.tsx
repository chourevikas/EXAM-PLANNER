import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../components/common/Logo';
import { Ico } from '../components/common/Icons';
import { useTheme } from '../hooks/useTheme';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Cell } from 'recharts';
import { fetchCurrentUser } from '../services/authService';
import { listExams } from '../services/examService';
import { useUser, useAuth } from '@clerk/clerk-react';
import { StudentLayout } from '../components/student/StudentLayout';
import StudentMetricCard from '../components/student/StudentMetricCard';

import { fetchPredictedRank, PredictedRankResponse } from '../services/analyticsService';

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
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || '{}'));
  const { theme, toggleTheme } = useTheme();
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

  const fetchActivities = async () => {
    const token = await getToken();
    if (token) {
      fetch('/api/v1/analytics/activity/today', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setTodayActivities(data);
        })
        .catch(err => console.error("Failed to fetch activities:", err));
    }
  };

  const fetchSubjectPerformance = async () => {
    try {
      const token = await getToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/v1/analytics/subject-performance', { headers });
      const data = await res.json();
      if (Array.isArray(data)) {
        setSubjectData(data);
      }
    } catch (err) {
      console.error("Failed to fetch subject performance:", err);
    } finally {
      setIsLoadingSubjects(false);
    }
  };

  useEffect(() => {
    document.title = 'Dashboard - Exam Planner';

    listExams().then(exams => {
      if (Array.isArray(exams) && exams.length > 0) {
        const published = exams.find(e => e.is_active || (e.status && String(e.status).includes('PUBLISHED')));
        setActiveExam(published || exams[0]);
      }
    }).catch(err => console.error("Failed to fetch live exams:", err));

    getToken().then((token) => {
      fetchCurrentUser(token || undefined).then(data => {
        setUser(data);
      }).catch(err => {
        console.error("Failed to fetch fresh user data:", err);
      });
    });

    fetchActivities();
    fetchSubjectPerformance();
    fetchPredictedRank().then(data => setPredictedRank(data)).catch(err => console.error("Failed to fetch predicted rank:", err));

    // Fetch user badges
    getToken().then((token: string | null) => {
      if (token) {
        fetch('/api/v1/study-plan/badges', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
          .then(res => res.json())
          .then(data => {
            if (data && data.unlocked && data.locked) {
              setBadges(data);
            }
          })
          .catch(err => console.error("Failed to fetch badges:", err));
      }
    });
  }, []);

  const isFreeTier = user.subscription_tier !== 'PREMIUM';

  return (
    <StudentLayout pageTitle="Dashboard">

      {/* 1. Personalized Welcome & AI Motivation */}
      <section style={{ marginBottom: 40, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8, letterSpacing: '-0.02em' }}>
            Welcome back, {clerkUser?.firstName || user.full_name?.split(' ')[0] || 'Aspirant'}! 👋
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: 15 }}>
            <div style={{ color: 'var(--accent-primary)' }}><Ico.Brain /></div>
            <span><strong style={{ color: 'var(--text-primary)' }}>Smart Insight:</strong> Your polity accuracy is up 12% this week. Keep up the momentum!</span>
          </div>
        </div>

        <button
          onClick={() => setShowLogModal(true)}
          style={{
            padding: '12px 20px',
            backgroundColor: 'var(--accent-primary)',
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
            transition: 'transform 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          <Ico.Pen /> Log Today's Study
        </button>
      </section>

      {/* 2. Key Metrics Grid (Admin Dashboard Design Language) */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18, marginBottom: 32 }}>
        <StudentMetricCard
          title="Questions Attempted Today"
          value={
            <span>
              {user.today_questions_attempted ?? user.free_questions_attempted ?? user.total_questions_attempted ?? 0}{' '}
              <span style={{ fontSize: 14, fontWeight: 500, color: '#64748B' }}>/ 100</span>
            </span>
          }
          supportingText="Daily practice progress"
          icon={<Ico.Target size={18} />}
          showProgress={true}
          progressPercent={Math.min((((user.today_questions_attempted ?? user.free_questions_attempted ?? user.total_questions_attempted ?? 0) / 100) * 100), 100)}
          accentColor="#2563EB"
        />

        <StudentMetricCard
          title="Study Streak"
          value={
            <span>
              {user.current_streak ?? 0}{' '}
              <span style={{ fontSize: 14, fontWeight: 500, color: '#64748B' }}>Days</span>
            </span>
          }
          supportingText="Active daily streak"
          icon={<Ico.Trend size={18} />}
          accentColor="#D97706"
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
            <span style={{ color: '#2563EB', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              View Achievements <Ico.ArrowRight size={13} />
            </span>
          }
          icon={<Ico.Star filled />}
          onClick={() => setShowBadgesModal(true)}
          accentColor="#10B981"
        />

        <StudentMetricCard
          title="Predicted Rank"
          value={predictedRank ? `Top ${predictedRank.top_percentage}%` : "Top 8%"}
          supportingText={
            predictedRank 
              ? `AIR #${predictedRank.predicted_rank.toLocaleString()} (${predictedRank.predicted_percentile}th Pct)`
              : "92nd Percentile"
          }
          icon={<Ico.Chart size={18} />}
          accentColor="#3B82F6"
        />
      </section>

      {/* 3. Performance Analytics */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20, marginBottom: 32 }}>
        {/* Subject Accuracy */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            padding: '22px 24px',
            borderRadius: 14,
            border: '1px solid #E2E8F0',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04), 0 1px 2px rgba(15, 23, 42, 0.02)',
            fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
          }}
        >
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h3 style={{ fontSize: 16.5, fontWeight: 700, color: '#0F172A', margin: '0 0 4px 0' }}>Subject Accuracy</h3>
              <p style={{ fontSize: 13, color: '#64748B', margin: 0 }}>Your strong areas vs. areas needing improvement.</p>
            </div>
            {subjectData.length > 0 && subjectData.every(s => s.total_attempted === 0) && (
              <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, backgroundColor: '#FEF3C7', color: '#B45309' }}>
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
                          <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', padding: '10px 14px', borderRadius: 10, boxShadow: '0 4px 12px rgba(15,23,42,0.08)' }}>
                            <div style={{ fontWeight: 700, fontSize: 13, color: '#0F172A', marginBottom: 4 }}>{data.subject}</div>
                            <div style={{ fontSize: 12, color: '#2563EB', fontWeight: 600 }}>Accuracy: {data.accuracy}%</div>
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
                        fill={entry.total_attempted === 0 ? '#CBD5E1' : entry.accuracy >= 75 ? '#10B981' : entry.accuracy >= 60 ? '#2563EB' : '#D97706'}
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
            borderRadius: 14,
            border: '1px solid #E2E8F0',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04), 0 1px 2px rgba(15, 23, 42, 0.02)',
            fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
          }}
        >
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 16.5, fontWeight: 700, color: '#0F172A', margin: '0 0 4px 0' }}>Time Management</h3>
            <p style={{ fontSize: 13, color: '#64748B', margin: 0 }}>Study hours logged this week.</p>
          </div>
          <div style={{ height: 250, width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={studyHoursData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#E2E8F0" opacity={0.6} />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                <Tooltip
                  cursor={{ stroke: '#CBD5E1', strokeWidth: 1, strokeDasharray: '4 4' }}
                  contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#E2E8F0', borderRadius: 10, boxShadow: '0 4px 12px rgba(15,23,42,0.08)', color: '#0F172A' }}
                />
                <Area type="monotone" dataKey="hours" stroke="#2563EB" strokeWidth={2.5} fillOpacity={1} fill="url(#colorHours)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>


      {/* 4. Deep AI Insights & Call to Action */}
      <section style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>

        {/* The Psychometric Layer */}
        <div style={{
          backgroundColor: 'var(--bg-card)', padding: 32, borderRadius: 24,
          border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-color-base)',
          position: 'relative', overflow: 'hidden'
        }}>
          {/* Blur Overlay for Free Tier */}
          {isFreeTier && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 10,
              backdropFilter: 'blur(8px)', backgroundColor: 'rgba(255,255,255,0.1)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
            }}>
              <div style={{ padding: 16, backgroundColor: 'var(--bg-card)', borderRadius: '50%', boxShadow: 'var(--shadow-color-base)', marginBottom: 16 }}>
                <Ico.Shield />
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px 0' }}>Premium Analytics Locked</h3>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24, textAlign: 'center', maxWidth: 280 }}>
                Unlock deep behavioral tracking and psychometric insights with the Pro Plan.
              </p>
              <Link to="/pricing" style={{
                padding: '12px 24px', backgroundColor: 'var(--accent-primary)', color: '#FFF',
                borderRadius: 12, fontSize: 14, fontWeight: 700, textDecoration: 'none',
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
              <div style={{ padding: 8, backgroundColor: 'var(--pink-bg)', color: 'var(--pink-primary)', borderRadius: 12 }}>
                <Ico.Brain />
              </div>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Deep Behavioral Insights</h3>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>Behavioral & Psychometric Analysis</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
              {/* Decision Accuracy */}
              <div>
                <h4 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-disabled)', fontWeight: 700, marginBottom: 16 }}>Decision Accuracy</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ padding: 16, backgroundColor: 'var(--bg-subtle)', borderRadius: 16, border: '1px solid var(--border-default)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Direct Hits</span>
                      <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--success-primary)' }}>68%</span>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Perfect accuracy on first attempt.</p>
                  </div>
                  <div style={{ padding: 16, backgroundColor: 'var(--bg-subtle)', borderRadius: 16, border: '1px solid var(--border-default)' }}>
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
                    <div style={{ height: 6, width: '100%', backgroundColor: 'var(--bg-subtle)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: '40%', height: '100%', backgroundColor: 'var(--warning-primary)', borderRadius: 3 }} />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}>Option Hesitation</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--success-primary)' }}>Low (Avg 4s)</span>
                    </div>
                    <div style={{ height: 6, width: '100%', backgroundColor: 'var(--bg-subtle)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: '15%', height: '100%', backgroundColor: 'var(--success-primary)', borderRadius: 3 }} />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}>Avg Time / Question</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-primary)' }}>1m 12s</span>
                    </div>
                    <div style={{ height: 6, width: '100%', backgroundColor: 'var(--bg-subtle)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: '60%', height: '100%', backgroundColor: 'var(--accent-primary)', borderRadius: 3 }} />
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>
        </div>
        {/* 5. Call to Action / Next Up */}
        <div style={{
          backgroundColor: 'var(--accent-primary)', padding: 32, borderRadius: 24,
          color: '#FFFFFF', display: 'flex', flexDirection: 'column',
          boxShadow: '0 20px 40px var(--shadow-color-accent)',
          backgroundImage: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-darker) 100%)',
          position: 'relative', overflow: 'hidden'
        }}>
          <div style={{ position: 'absolute', top: -30, right: -30, opacity: 0.1 }}>
            <Ico.Target />
          </div>

          <div style={{ marginBottom: 'auto', position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'inline-block', padding: '6px 12px', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8, fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 16 }}>
              Up Next
            </div>
            <h3 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 12px 0', lineHeight: 1.3 }}>
              {activeExam ? `Practice ${activeExam.name}` : 'Resume UPSC CSE Practice'}
            </h3>
            <p style={{ fontSize: 15, opacity: 0.9, margin: 0, lineHeight: 1.5 }}>
              Ready to test your concept retention? Start an active UPSC Prelims exam session now.
            </p>
          </div>

          <button
            onClick={() => window.location.href = activeExam ? `/exam/${activeExam.code}` : '/pyq'}
            style={{
              width: '100%', padding: '16px', borderRadius: 14, border: 'none',
              backgroundColor: '#FFFFFF', color: 'var(--accent-darker)',
              fontSize: 15, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              marginTop: 32, transition: 'transform 0.2s', position: 'relative', zIndex: 1
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            Start Practice Exam <Ico.ArrowRight />
          </button>
        </div>
      </section>


      {/* 4. Today's Study Feed */}
      <section style={{ marginBottom: 40 }}>
        <div style={{ backgroundColor: 'var(--bg-card)', padding: 24, borderRadius: 24, border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-color-base)' }}>
          <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>Today's Study Log</h3>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>
                {todayActivities.length === 0 ? 'No activities logged today.' : `${todayActivities.length} activities logged`}
              </p>
            </div>
            <div style={{ padding: '8px 16px', backgroundColor: 'var(--bg-subtle)', borderRadius: 12, border: '1px solid var(--border-default)' }}>
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
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 16, backgroundColor: 'var(--bg-subtle)', borderRadius: 16, border: '1px solid var(--border-default)' }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: activity.activity_type === 'MOCK_TEST' ? 'rgba(234, 179, 8, 0.1)' :
                      activity.activity_type === 'PYQ' ? 'rgba(168, 85, 247, 0.1)' :
                        activity.activity_type === 'REVISION' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                    color: activity.activity_type === 'MOCK_TEST' ? '#EAB308' :
                      activity.activity_type === 'PYQ' ? '#A855F7' :
                        activity.activity_type === 'REVISION' ? '#22C55E' : '#3B82F6'
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
      {/* Badges Modal */}
      {showBadgesModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }} onClick={() => setShowBadgesModal(false)}>
          <div style={{
            backgroundColor: 'var(--bg-card)', width: '100%', maxWidth: 480,
            borderRadius: 24, padding: 32, boxShadow: '0 24px 48px rgba(0,0,0,0.2)',
            border: '1px solid var(--border-default)'
          }} onClick={e => e.stopPropagation()}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Your Achievements</h2>
              <button onClick={() => setShowBadgesModal(false)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: 'var(--text-secondary)' }}>&times;</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
              {/* Earned Badges */}
              {badges?.unlocked?.map(badge => (
                <div key={badge.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 16, backgroundColor: 'var(--success-bg, rgba(16, 185, 129, 0.1))', borderRadius: 16, border: '1px solid var(--success-primary)' }}>
                  <div style={{ fontSize: 32 }}>{badge.icon_url}</div>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{badge.name}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{badge.description}</div>
                  </div>
                </div>
              ))}

              {/* Locked Badges */}
              {badges?.locked?.map(badge => (
                <div key={badge.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 16, backgroundColor: 'var(--bg-subtle)', borderRadius: 16, border: '1px dashed var(--border-disabled)', opacity: 0.6 }}>
                  <div style={{ fontSize: 32, filter: 'grayscale(1)' }}>{badge.icon_url}</div>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                      {badge.name}
                      {badge.required_xp && <span style={{ fontSize: 11, backgroundColor: 'var(--bg-card)', padding: '2px 6px', borderRadius: 4, marginLeft: 8 }}>Requires {badge.required_xp} XP</span>}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{badge.description}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 24, textAlign: 'center' }}>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 8 }}>Keep hitting your daily goals to unlock more!</div>
              <div style={{ width: '100%', height: 8, backgroundColor: 'var(--bg-subtle)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(((user.total_xp ?? 0) / 2500) * 100, 100)}%`, height: '100%', backgroundColor: 'var(--accent-primary)', borderRadius: 4 }} />
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Study Log Drawer */}
      {showLogModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
          display: 'flex', justifyContent: 'flex-end',
          animation: 'fadeIn 0.2s ease-out'
        }} onClick={() => setShowLogModal(false)}>
          <div style={{
            backgroundColor: 'var(--bg-card)', width: '100%', maxWidth: 600,
            height: '100vh', padding: '40px 32px', boxShadow: '-10px 0 40px rgba(0,0,0,0.4)',
            borderLeft: '1px solid var(--border-default)', overflowY: 'auto',
            animation: 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
          }} onClick={e => e.stopPropagation()}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Log Study Activity</h2>
              <button onClick={() => setShowLogModal(false)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: 'var(--text-secondary)' }}>&times;</button>
            </div>

            {/* Activity Type Pill Selector */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
              {['REVISION', 'PYQ', 'MOCK_TEST', 'NEW_TOPIC', 'ANSWER_WRITING', 'CURRENT_AFFAIRS'].map(type => (
                <button
                  key={type}
                  onClick={() => setStudyLog({ ...studyLog, activity_type: type })}
                  style={{
                    padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    border: studyLog.activity_type === type ? '1px solid var(--accent-primary)' : '1px solid var(--border-default)',
                    backgroundColor: studyLog.activity_type === type ? 'var(--accent-primary)' : 'var(--bg-subtle)',
                    color: studyLog.activity_type === type ? '#fff' : 'var(--text-secondary)'
                  }}>
                  {type.replace('_', ' ')}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Common Fields */}
              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Subject</label>
                  <input type="text" placeholder="e.g. Polity" value={studyLog.subject} onChange={e => setStudyLog({ ...studyLog, subject: e.target.value })} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }} />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Topic</label>
                  <input type="text" placeholder="e.g. Fundamental Rights" value={studyLog.topic} onChange={e => setStudyLog({ ...studyLog, topic: e.target.value })} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }} />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Duration (Minutes)</label>
                <input type="number" min="0" value={studyLog.duration_minutes} onChange={e => setStudyLog({ ...studyLog, duration_minutes: parseInt(e.target.value) || 0 })} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }} />
              </div>

              {/* Dynamic Fields based on Type */}
              {(studyLog.activity_type === 'MOCK_TEST' || studyLog.activity_type === 'PYQ') && (
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Questions Attempted</label>
                    <input type="number" min="0" value={studyLog.questions_attempted} onChange={e => setStudyLog({ ...studyLog, questions_attempted: parseInt(e.target.value) || 0 })} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }} />
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Questions Correct</label>
                    <input type="number" min="0" value={studyLog.questions_correct} onChange={e => setStudyLog({ ...studyLog, questions_correct: parseInt(e.target.value) || 0 })} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }} />
                  </div>
                </div>
              )}

              {studyLog.activity_type === 'REVISION' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Confidence After Revision (1-10)</label>
                  <input type="range" min="1" max="10" value={studyLog.confidence_rating} onChange={e => setStudyLog({ ...studyLog, confidence_rating: parseInt(e.target.value) })} style={{ width: '100%', accentColor: 'var(--accent-primary)' }} />
                  <div style={{ textAlign: 'center', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{studyLog.confidence_rating} / 10</div>
                </div>
              )}

              {studyLog.activity_type === 'ANSWER_WRITING' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Answers Written</label>
                  <input type="number" min="1" value={studyLog.questions_attempted} onChange={e => setStudyLog({ ...studyLog, questions_attempted: parseInt(e.target.value) || 0 })} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }} />
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Notes (Optional)</label>
                <input type="text" placeholder="e.g. Revised Articles 12-35" value={studyLog.notes} onChange={e => setStudyLog({ ...studyLog, notes: e.target.value })} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }} />
              </div>
            </div>

            <button
              disabled={isSubmittingLog}
              onClick={async () => {
                setIsSubmittingLog(true);
                try {
                  const token = await getToken();
                  const res = await fetch('/api/v1/analytics/activity', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(studyLog)
                  });
                  if (res.ok) {
                    setShowLogModal(false);
                    fetchActivities();
                  } else {
                    console.error('Failed to log activity');
                  }
                } catch (err) {
                  console.error(err);
                } finally {
                  setIsSubmittingLog(false);
                }
              }}
              style={{
                width: '100%', marginTop: 32, padding: 16,
                backgroundColor: 'var(--accent-primary)', color: '#fff',
                border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 700,
                cursor: isSubmittingLog ? 'not-allowed' : 'pointer', opacity: isSubmittingLog ? 0.7 : 1,
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
              }}>
              {isSubmittingLog ? 'Saving...' : 'Save Activity'}
            </button>
          </div>
        </div>
      )}
    </StudentLayout>
  );
}
