import React, { useState } from 'react';
import { StudentLayout } from '../components/student/StudentLayout';
import { Ico } from '../components/common/Icons';

export function StudyPlannerPage() {
  const [activeTab, setActiveTab] = useState<'daily' | 'weekly' | 'milestones'>('daily');

  const dailyTasks = [
    { id: 1, subject: 'Polity', topic: 'Fundamental Rights & Writs (Articles 12-35)', duration: '1h 30m', status: 'completed', priority: 'HIGH' },
    { id: 2, subject: 'History', topic: 'Modern History: Non-Cooperation Movement 1920', duration: '2h 00m', status: 'in-progress', priority: 'HIGH' },
    { id: 3, subject: 'Economy', topic: 'Inflation Metrics: CPI vs WPI & RBI Policy', duration: '1h 15m', status: 'pending', priority: 'MEDIUM' },
    { id: 4, subject: 'Current Affairs', topic: 'Monthly Digest: Science & Tech & Defence', duration: '45m', status: 'pending', priority: 'LOW' }
  ];

  return (
    <StudentLayout pageTitle="Study Planner">
      {/* Header Banner */}
      <section style={{ 
        marginBottom: 32, padding: 32, borderRadius: 24,
        backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)',
        boxShadow: 'var(--shadow-color-base)',
        backgroundImage: 'linear-gradient(135deg, rgba(91,92,235,0.06) 0%, rgba(34,197,94,0.06) 100%)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20
      }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', backgroundColor: 'var(--accent-bg)', borderRadius: 20, marginBottom: 10, border: '1px solid var(--accent-border)' }}>
            <Ico.Cal size={14} />
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase' }}>Dynamic Schedule</span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px 0' }}>Adaptive Study Planner</h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>Personalized daily timetable based on your accuracy trends & target exam date.</p>
        </div>

        <button style={{
          padding: '12px 20px', backgroundColor: 'var(--accent-primary)', color: '#FFF',
          borderRadius: 14, border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 12px var(--shadow-color-accent)'
        }}>
          <Ico.Sparkles size={16} /> Re-Generate Schedule
        </button>
      </section>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 28, borderBottom: '1px solid var(--border-default)', paddingBottom: 12, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {[
          { key: 'daily', label: 'Today\'s Targets', icon: Ico.Check },
          { key: 'weekly', label: 'Weekly Timetable', icon: Ico.Cal },
          { key: 'milestones', label: 'Revision Milestones', icon: Ico.Trophy }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            style={{
              padding: '10px 18px', borderRadius: 12, border: 'none',
              backgroundColor: activeTab === tab.key ? 'var(--accent-bg)' : 'transparent',
              color: activeTab === tab.key ? 'var(--accent-primary)' : 'var(--text-secondary)',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s',
              whiteSpace: 'nowrap', flexShrink: 0
            }}
          >
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      {/* Main Task List */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
        
        <div style={{ backgroundColor: 'var(--bg-card)', padding: 28, borderRadius: 24, border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-color-base)' }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 20px 0', color: 'var(--text-primary)' }}>Today's Scheduled Topics</h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {dailyTasks.map(task => (
              <div 
                key={task.id}
                style={{
                  padding: 20, borderRadius: 16, border: '1px solid var(--border-default)',
                  backgroundColor: task.status === 'completed' ? 'var(--bg-subtle)' : 'var(--bg-card)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%',
                    backgroundColor: task.status === 'completed' ? 'var(--success-primary)' : 'transparent',
                    border: task.status === 'completed' ? 'none' : '2px solid var(--border-disabled)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF'
                  }}>
                    {task.status === 'completed' && <Ico.Check size={14} />}
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 6, backgroundColor: 'var(--accent-bg)', color: 'var(--accent-primary)' }}>
                        {task.subject}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, backgroundColor: task.priority === 'HIGH' ? 'var(--danger-bg)' : 'var(--warning-bg)', color: task.priority === 'HIGH' ? 'var(--danger-primary)' : 'var(--warning-primary)' }}>
                        {task.priority} PRIORITY
                      </span>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{task.topic}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>{task.duration}</span>
                  <button style={{
                    padding: '8px 14px', borderRadius: 10, border: 'none',
                    backgroundColor: task.status === 'completed' ? 'var(--bg-subtle)' : 'var(--accent-primary)',
                    color: task.status === 'completed' ? 'var(--text-muted)' : '#FFF',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer'
                  }}>
                    {task.status === 'completed' ? 'Completed' : task.status === 'in-progress' ? 'Resume' : 'Start'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Side Summary */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ backgroundColor: 'var(--bg-card)', padding: 24, borderRadius: 20, border: '1px solid var(--border-default)' }}>
            <h4 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px 0' }}>Daily Completion Rate</h4>
            <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--accent-primary)', marginBottom: 8 }}>
              25% <span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 500 }}>completed</span>
            </div>
            <div style={{ height: 8, width: '100%', backgroundColor: 'var(--bg-subtle)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: '25%', height: '100%', backgroundColor: 'var(--accent-primary)' }} />
            </div>
          </div>

          <div style={{ backgroundColor: 'var(--bg-card)', padding: 24, borderRadius: 20, border: '1px solid var(--border-default)' }}>
            <h4 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px 0' }}>Weak Areas to Revise</h4>
            <ul style={{ paddingLeft: 20, margin: 0, fontSize: 14, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <li>Indian Economy: Inflation & Fiscal Deficit</li>
              <li>Geography: River Systems of Peninsular India</li>
              <li>Ancient History: Gupta Dynasty Administration</li>
            </ul>
          </div>
        </div>

      </div>
    </StudentLayout>
  );
}
