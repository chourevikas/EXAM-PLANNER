import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../components/common/Logo';
import { Ico } from '../components/common/Icons';
import { useTheme } from '../hooks/useTheme';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Cell } from 'recharts';
import { fetchCurrentUser } from '../services/authService';

const subjectData = [
  { subject: 'History', accuracy: 85 },
  { subject: 'Polity', accuracy: 72 },
  { subject: 'Geography', accuracy: 90 },
  { subject: 'Economy', accuracy: 55 },
  { subject: 'Science', accuracy: 65 },
];

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
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    document.title = 'Dashboard - Exam Planner';
    
    // Fetch fresh user data from API
    fetchCurrentUser().then(data => {
      setUser(data);
    }).catch(err => {
      console.error("Failed to fetch fresh user data:", err);
    });
  }, []);

  const isFreeTier = user.subscription_tier !== 'PREMIUM';

  const currentPath = window.location.pathname;

  const NavItem = ({ to, icon: Icon, label, active }: { to: string, icon: any, label: string, active?: boolean }) => {
    const [hovered, setHovered] = useState(false);
    const isActive = active || currentPath === to;
    
    return (
      <Link 
        to={to} 
        onClick={() => setIsSidebarOpen(false)} 
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ 
          display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', 
          borderRadius: '12px', textDecoration: 'none', fontWeight: isActive ? 600 : 500,
          backgroundColor: isActive ? 'var(--accent-bg)' : hovered ? 'var(--bg-hover)' : 'transparent',
          color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
          transition: 'all 0.2s ease'
        }}
      >
        <Icon /> {label}
      </Link>
    );
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-page)', fontFamily: 'var(--font-sans)', color: 'var(--text-primary)' }}>
      
      {/* Overlay for mobile sidebar */}
      {isSidebarOpen && (
        <div 
          onClick={() => setIsSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 90 }}
        />
      )}

      {/* Left Sidebar */}
      <aside style={{ 
        position: 'fixed', top: 0, left: 0, bottom: 0, width: '260px', 
        backgroundColor: 'var(--bg-card)', borderRight: '1px solid var(--border-default)', 
        display: 'flex', flexDirection: 'column', zIndex: 100,
        transform: isSidebarOpen ? 'translateX(0)' : 'translateX(0)', // Adjust for mobile later if needed, assuming desktop focus
        transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      }}>
        <div style={{ padding: '24px', marginBottom: '16px' }}>
          <Logo />
        </div>
        
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '0 16px', flex: 1 }}>
          <NavItem to="/dashboard" icon={Ico.Target} label="Dashboard" active />
          <NavItem to="/study-planner" icon={Ico.Cal} label="Study Planner" />
          <NavItem to="/pyq" icon={Ico.Book} label="Previous Year Qs" />
          <NavItem to="/mocks" icon={Ico.Brain} label="Mock Tests" />
          <NavItem to="/analytics" icon={Ico.Chart} label="Analytics" />

          <div style={{ margin: '24px 16px 8px 16px', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-disabled)', letterSpacing: '0.05em' }}>
            Reports
          </div>
          <NavItem to="/reports/weekly" icon={Ico.Chart} label="Weekly Report" />
          <NavItem to="/reports/monthly" icon={Ico.Target} label="Monthly Report" />
        </nav>
        
        {/* User Profile Mini */}
        <div style={{ padding: '20px 16px', borderTop: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column', gap: 12 }}>
           <Link to="/profile" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', padding: '8px', borderRadius: 12, transition: 'background 0.2s', ...({':hover': {background: 'var(--bg-hover)'}} as any) }}>
             <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, border: '1px solid var(--accent-border)' }}>
               {user.profile_image || '👨‍🎓'}
             </div>
             <div style={{ display: 'flex', flexDirection: 'column' }}>
               <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{user.full_name || 'Aspirant'}</span>
               <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                 {user.subscription_tier === 'PREMIUM' ? 'Pro Plan' : 'Free Tier'}
               </span>
             </div>
           </Link>
           <Link to="/signout" style={{ 
             display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, 
             padding: '10px', borderRadius: '10px', textDecoration: 'none', 
             color: 'var(--error-primary, #EF4444)', backgroundColor: 'var(--error-bg, rgba(239,68,68,0.1))',
             fontSize: 14, fontWeight: 600, transition: 'all 0.2s'
           }}>
             <Ico.X /> Sign Out
           </Link>
        </div>
      </aside>

      {/* Main Content */}
      <div style={{ flex: 1, marginLeft: '260px', display: 'flex', flexDirection: 'column' }}>
        
        {/* Top Header */}
        <header style={{ 
          height: '72px', padding: '0 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
          position: 'sticky', top: 0, zIndex: 40,
          backgroundColor: 'rgba(var(--bg-page-rgb, 248, 250, 252), 0.8)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--border-default)'
        }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}>
            Overview / <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Dashboard</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {user.subscription_tier === 'PREMIUM' ? (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
                backgroundColor: 'var(--accent-bg)', borderRadius: 20,
                border: '1px solid var(--accent-border)'
              }}>
                <Ico.Star filled={true} />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-primary)' }}>Premium Member</span>
              </div>
            ) : (
              <Link to="/pricing" style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
                backgroundColor: 'var(--bg-subtle)', borderRadius: 20,
                border: '1px solid var(--border-default)', textDecoration: 'none',
                transition: 'all 0.2s ease', ...({':hover': {backgroundColor: 'var(--bg-hover)'}} as any)
              }}>
                <Ico.Star />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Upgrade to Pro</span>
              </Link>
            )}

            <Link to="/profile" style={{ 
              width: 36, height: 36, borderRadius: '50%', border: '1px solid var(--border-default)',
              backgroundColor: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--text-secondary)', textDecoration: 'none'
            }}>
              <Ico.Settings />
            </Link>
            
            {/* Dark mode toggle should be handled globally or here. Assuming GlobalThemeToggle exists, but we can put a button here too if desired. */}
          </div>
        </header>

        <main style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
          
          {/* 1. Personalized Welcome & AI Motivation */}
          <section style={{ marginBottom: 40 }}>
            <h1 style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8, letterSpacing: '-0.02em' }}>
              Welcome back, {user.full_name?.split(' ')[0] || 'Aspirant'}! 👋
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: 15 }}>
              <div style={{ color: 'var(--accent-primary)' }}><Ico.Brain /></div>
              <span><strong style={{ color: 'var(--text-primary)' }}>AI Insight:</strong> Your polity accuracy is up 12% this week. Keep up the momentum!</span>
            </div>
          </section>

          {/* 2. Key Metrics Grid */}
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginBottom: 40 }}>
            <div style={{ backgroundColor: 'var(--bg-card)', padding: 24, borderRadius: 20, border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-color-base)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}>Questions Attempted</span>
                <div style={{ color: 'var(--accent-primary)' }}><Ico.Target /></div>
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 12 }}>
                {user.free_questions_attempted ?? 0} <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-muted)' }}>/ 100</span>
              </div>
              <div style={{ height: 6, width: '100%', backgroundColor: 'var(--bg-subtle)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(((user.free_questions_attempted ?? 0) / 100) * 100, 100)}%`, height: '100%', backgroundColor: 'var(--accent-primary)', borderRadius: 3 }} />
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-card)', padding: 24, borderRadius: 20, border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-color-base)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}>Study Streak</span>
                <div style={{ color: 'var(--warning-primary)' }}><Ico.Trend /></div>
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>
                14 <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-muted)' }}>Days</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--success-primary)', fontWeight: 500 }}>
                ↑ 3 days longer than last week
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-card)', padding: 24, borderRadius: 20, border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-color-base)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}>Total XP / Level</span>
                <div style={{ color: 'var(--emerald, #10B981)' }}><Ico.Star filled /></div>
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>
                2,450 <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-muted)' }}>XP</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>
                Level 4 Achiever
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-card)', padding: 24, borderRadius: 20, border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-color-base)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}>Predicted Rank</span>
                <div style={{ color: 'var(--info-primary)' }}><Ico.Chart /></div>
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>
                Top 8%
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>
                92nd Percentile
              </div>
            </div>
          </section>

          {/* 3. Performance Analytics */}
          <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 40 }}>
            {/* Subject Accuracy */}
            <div style={{ backgroundColor: 'var(--bg-card)', padding: 24, borderRadius: 24, border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-color-base)' }}>
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>Subject Accuracy</h3>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>Your strong areas vs. areas needing improvement.</p>
              </div>
              <div style={{ height: 260, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={subjectData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--border-disabled)" opacity={0.5} />
                    <XAxis dataKey="subject" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-muted)' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
                    <Tooltip 
                      cursor={{ fill: 'var(--bg-hover)' }}
                      contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)', borderRadius: 12, boxShadow: 'var(--shadow-color-base)', color: 'var(--text-primary)' }}
                    />
                    <Bar dataKey="accuracy" radius={[6, 6, 0, 0]} maxBarSize={40}>
                      {subjectData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.accuracy >= 75 ? 'var(--success-primary)' : entry.accuracy >= 60 ? 'var(--accent-primary)' : 'var(--warning-primary)'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Time Management */}
            <div style={{ backgroundColor: 'var(--bg-card)', padding: 24, borderRadius: 24, border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-color-base)' }}>
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>Time Management</h3>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>Daily study hours over the last 7 days.</p>
              </div>
              <div style={{ height: 260, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={studyHoursData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--border-disabled)" opacity={0.5} />
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-muted)' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)', borderRadius: 12, boxShadow: 'var(--shadow-color-base)', color: 'var(--text-primary)' }}
                    />
                    <Area type="monotone" dataKey="hours" stroke="var(--accent-primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorHours)" />
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
                    Unlock deep AI behavioral tracking and psychometric insights with the Pro Plan.
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
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Deep AI Insights</h3>
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
                  Resume UPSC CSE PYQ 2022
                </h3>
                <p style={{ fontSize: 15, opacity: 0.9, margin: 0, lineHeight: 1.5 }}>
                  You paused at Question 42. Taking a customized 15-question Polity quiz beforehand might improve your weak areas.
                </p>
              </div>

              <button 
                onClick={() => window.location.href='/exam/pyq_2022'}
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
                Resume Test <Ico.ArrowLeft /> {/* Note: arrow left is being used, you can rotate it via CSS or add an ArrowRight */}
              </button>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
