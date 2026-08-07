import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../components/common/Logo';
import { Ico } from '../components/common/Icons';
import { useTheme } from '../hooks/useTheme';

const PREDEFINED_AVATARS = ['👨‍🎓', '👩‍🎓', '🚀', '🌟', '🧠', '🦉', '🎯', '📚'];

export function ProfilePage() {
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || '{}'));
  const { theme, toggleTheme } = useTheme();
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  const [editName, setEditName] = useState(user.full_name || '');
  const [editAvatar, setEditAvatar] = useState(user.profile_image || '👨‍🎓');

  useEffect(() => {
    document.title = 'Profile - Exam Planner';
  }, []);

  const handleSaveProfile = () => {
    const updatedUser = { ...user, full_name: editName, profile_image: editAvatar };
    localStorage.setItem('user', JSON.stringify(updatedUser));
    setUser(updatedUser);
    setIsEditing(false);
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-body)', overflowX: 'hidden' }}>
      
      {/* Overlay for sidebar */}
      {isSidebarOpen && (
        <div 
          onClick={() => setIsSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)', zIndex: 90 }}
        />
      )}

      {/* Slide-in Sidebar */}
      <aside style={{ 
        position: 'fixed', top: 0, left: 0, bottom: 0, width: '280px', 
        background: 'var(--bg-card)', borderRight: '1px solid var(--border-color)', 
        display: 'flex', flexDirection: 'column', padding: '24px 0', zIndex: 100,
        transform: isSidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        boxShadow: isSidebarOpen ? 'var(--shadow-lg)' : 'none'
      }}>
        <div style={{ padding: '0 24px', marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Logo />
          <button onClick={() => setIsSidebarOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Ico.X />
          </button>
        </div>
        
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '0 16px' }}>
          <Link to="/dashboard" onClick={() => setIsSidebarOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '12px', color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 600 }}>
            <Ico.Target /> Dashboard
          </Link>
          <Link to="/study-planner" onClick={() => setIsSidebarOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '12px', color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 600 }}>
            <Ico.Cal /> Study Planner
          </Link>
          <Link to="/pyq" onClick={() => setIsSidebarOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '12px', color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 600 }}>
            <Ico.Book /> Previous Year Qs
          </Link>
          <Link to="/mock-tests" onClick={() => setIsSidebarOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '12px', color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 600 }}>
            <Ico.Brain /> Mock Tests
          </Link>
          <Link to="/analytics" onClick={() => setIsSidebarOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '12px', color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 600 }}>
            <Ico.Chart /> Analytics
          </Link>

          <div style={{ margin: '16px 16px 8px 16px', fontSize: '11px', textTransform: 'uppercase', fontWeight: 800, color: 'var(--text-subtle)', letterSpacing: '0.05em' }}>
            Reports
          </div>
          <Link to="/reports/weekly" onClick={() => setIsSidebarOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '12px', color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 600 }}>
            <Ico.Chart /> Weekly Report
          </Link>
          <Link to="/reports/monthly" onClick={() => setIsSidebarOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '12px', color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 600 }}>
            <Ico.Target /> Monthly Report
          </Link>
        </nav>
        
        <div style={{ marginTop: 'auto', padding: '24px 16px', borderTop: '1px solid var(--border-color)' }}>
           <Link to="/signout" className="btn btn-ghost" style={{ width: '100%', padding: '10px' }}>Sign Out</Link>
        </div>
      </aside>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        
        {/* Glassmorphism Header */}
        <header className="glass-nav" style={{ padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 40 }}>
          {/* Left Side: Menu Toggle */}
          <div>
            <button onClick={() => setIsSidebarOpen(true)} className="theme-toggle-btn" aria-label="Open Menu">
              <Ico.Menu />
            </button>
          </div>

          {/* Right Side: Profile & Theme Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            
            <Link 
              to="/profile"
              style={{ display: 'flex', alignItems: 'center', gap: '12px', borderLeft: '1px solid var(--border-color)', paddingLeft: '20px', textDecoration: 'none' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', marginRight: '8px' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-main)' }}>{user.full_name || 'Aspirant'}</span>
                <span className="admin-badge" style={{ fontSize: '10px', padding: '2px 8px', letterSpacing: '0.05em' }}>
                  {user.role === 'STUDENT' ? 'ASPIRANT' : (user.role || 'ASPIRANT')}
                </span>
              </div>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                {user.profile_image || '👨‍🎓'}
              </div>
            </Link>
          </div>
        </header>

        <main className="admin-container" style={{ margin: '32px auto', width: '100%', maxWidth: '800px', padding: '0 32px' }}>
          <section className="anim-fade-up">
            <Link to="/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 600, marginBottom: '16px', fontSize: '14px', transition: 'color 0.2s' }} onMouseOver={(e: any) => e.currentTarget.style.color = 'var(--royal)'} onMouseOut={(e: any) => e.currentTarget.style.color = 'var(--text-muted)'}>
              ← Back to Dashboard
            </Link>
            <h1 style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-main)', marginBottom: 24 }}>
              My Profile
            </h1>

            <div className="feature-card" style={{ padding: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', borderBottom: '1px solid var(--border-color)', paddingBottom: '24px' }}>
                
                <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                  <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--blue50)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>
                    {user.profile_image || '👨‍🎓'}
                  </div>
                  <div>
                    <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>{user.full_name || 'Aspirant'}</h2>
                    <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: '4px', marginBottom: 0 }}>{user.email || 'aspirant@example.com'}</p>
                    <span className="admin-badge" style={{ marginTop: '12px', display: 'inline-block', fontSize: '11px', padding: '4px 12px', letterSpacing: '0.05em' }}>
                      {user.role === 'STUDENT' ? 'ASPIRANT' : (user.role || 'ASPIRANT')}
                    </span>
                  </div>
                </div>

                <button onClick={() => setIsEditing(true)} className="btn btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Ico.Pen /> Edit Profile
                </button>
              </div>

              {/* Read-only Data */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                <div>
                  <div className="admin-metric-label">Target Exam</div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-main)' }}>UPSC Civil Services</div>
                </div>
                <div>
                  <div className="admin-metric-label">Attempt Year</div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-main)' }}>2027</div>
                </div>
                <div>
                  <div className="admin-metric-label">Optional Subject</div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-main)' }}>Public Administration</div>
                </div>
                <div>
                  <div className="admin-metric-label">Daily Study Goal</div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-main)' }}>8 Hours</div>
                </div>
                <div>
                  <div className="admin-metric-label">Timezone</div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-main)' }}>Asia/Kolkata (IST)</div>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>

      {/* Edit Profile Modal (Only for basic details) */}
      {isEditing && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="feature-card anim-fade-up" style={{ width: '400px', background: 'var(--bg-modal)', padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-main)' }}>Edit Basic Details</h2>
              <button onClick={() => setIsEditing(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Ico.X /></button>
            </div>
            
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label">Full Name</label>
              <input 
                type="text" 
                className="form-select" 
                value={editName} 
                onChange={e => setEditName(e.target.value)} 
                placeholder="Enter your name" 
                style={{ cursor: 'text' }}
              />
            </div>
            
            <div className="form-group" style={{ marginBottom: '32px' }}>
              <label className="form-label">Choose Avatar</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                {PREDEFINED_AVATARS.map(avatar => (
                  <button 
                    key={avatar}
                    onClick={() => setEditAvatar(avatar)}
                    style={{ 
                      width: 44, height: 44, borderRadius: '50%', fontSize: 22, 
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: editAvatar === avatar ? 'var(--blue50)' : 'var(--bg-secondary)',
                      border: `2px solid ${editAvatar === avatar ? 'var(--royal)' : 'transparent'}`,
                      cursor: 'pointer', transition: 'all 0.2s'
                    }}
                  >
                    {avatar}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={handleSaveProfile} className="btn btn-primary" style={{ width: '100%', padding: '14px' }}>Save Changes</button>
          </div>
        </div>
      )}

    </div>
  );
}
