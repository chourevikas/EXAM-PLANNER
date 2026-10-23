import React, { useState, useEffect } from 'react';
import { StudentLayout } from '../components/student/StudentLayout';
import { Ico } from '../components/common/Icons';
import { LogStudyModal } from '../components/student/LogStudyModal';
import { CreateTaskModal } from '../components/student/CreateTaskModal';
import { StudyPlannerV2, PlannerTab } from '../components/student/planner/StudyPlannerV2';
import {
  fetchStudyTasks,
  fetchStudyActivities,
  fetchStudyActivitiesSummary,
  StudyTaskItem,
  StudyActivityItem,
  StudySummaryResponse,
  deleteStudyActivity,
} from '../services/studyPlannerService';
import { formatEnum } from '../utils/formatEnum';

type Tab = PlannerTab | 'logs' | 'history';
const PLANNER_TABS: PlannerTab[] = ['aaj', 'plan', 'progress', 'syllabus', 'revision'];

export function StudyPlannerPage() {
  const [activeTab, setActiveTab] = useState<Tab>(() => (new URLSearchParams(window.location.search).get('plan') ? 'plan' : 'aaj'));
  const [tasks, setTasks] = useState<StudyTaskItem[]>([]);
  const [activities, setActivities] = useState<StudyActivityItem[]>([]);
  const [summary, setSummary] = useState<StudySummaryResponse | null>(null);
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user') || '{}'));
  const [plannerVersion, setPlannerVersion] = useState(0);

  useEffect(() => {
    const handleUserUpdate = () => {
      setUser(JSON.parse(localStorage.getItem('user') || '{}'));
    };
    window.addEventListener('user_profile_updated', handleUserUpdate);
    window.addEventListener('storage', handleUserUpdate);
    return () => {
      window.removeEventListener('user_profile_updated', handleUserUpdate);
      window.removeEventListener('storage', handleUserUpdate);
    };
  }, []);

  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [logModalInitialSubject, setLogModalInitialSubject] = useState('');
  const [logModalInitialTopic, setLogModalInitialTopic] = useState('');
  const [historyTopicFilter, setHistoryTopicFilter] = useState<string>('');
  const [historyTimeWindow, setHistoryTimeWindow] = useState<string>('1_day');
  const [historyTimeOffset, setHistoryTimeOffset] = useState<number>(0);

  /** Logged sessions, their summary, and tasks for the History tab. */
  const loadActivity = async () => {
    const [tasksRes, actRes, sumRes] = await Promise.allSettled([
      fetchStudyTasks(),
      fetchStudyActivities(),
      fetchStudyActivitiesSummary(),
    ]);
    if (tasksRes.status === 'fulfilled') setTasks(tasksRes.value);
    if (actRes.status === 'fulfilled') setActivities(actRes.value);
    if (sumRes.status === 'fulfilled') setSummary(sumRes.value);
  };

  useEffect(() => {
    loadActivity();
  }, []);

  /** Something in the planner changed: refresh the planner views and the logs/history. */
  const plannerChanged = () => {
    setPlannerVersion((v) => v + 1);
    loadActivity();
  };

  const handleDeleteActivity = async (activityId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!window.confirm('Are you sure you want to delete this study session record?')) return;

    setActivities(prev => prev.filter(a => a.id !== activityId));

    try {
      await deleteStudyActivity(activityId);
      const sumData = await fetchStudyActivitiesSummary();
      setSummary(sumData);
    } catch (err) {
      console.error('Failed to delete activity log:', err);
      loadActivity();
    }
  };

  // Color helper for subjects
  const getSubjectBadgeStyle = (subj?: string) => {
    const s = (subj || '').toLowerCase();
    if (s.includes('polity')) return { bg: 'var(--bg-subtle)', color: 'var(--primary-red)', border: 'rgba(var(--primary-red-rgb), 0.2)' };
    if (s.includes('history')) return { bg: 'var(--status-warning-bg)', color: '#F2B623', border: 'rgba(217,119,6,0.2)' };
    if (s.includes('economy')) return { bg: '#ECFDF5', color: '#3A8B53', border: 'rgba(5,150,105,0.2)' };
    if (s.includes('geography')) return { bg: '#F3E8FF', color: '#9333EA', border: 'rgba(147,51,234,0.2)' };
    if (s.includes('environment')) return { bg: '#F0FDF4', color: 'var(--status-success)', border: 'rgba(22,163,74,0.2)' };
    if (s.includes('science') || s.includes('tech')) return { bg: '#F5F3FF', color: '#7C3AED', border: 'rgba(124,58,237,0.2)' };
    return { bg: 'var(--accent-bg)', color: 'var(--accent-primary)', border: 'var(--accent-border)' };
  };

  const getFilterDateRange = () => {
    if (historyTimeWindow === 'all') return null;

    const today = new Date();
    today.setHours(23, 59, 59, 999);

    let daysInWindow = 1;
    if (historyTimeWindow === '3_days') daysInWindow = 3;
    if (historyTimeWindow === '1_week') daysInWindow = 7;
    if (historyTimeWindow === '1_month') daysInWindow = 30;

    const end = new Date(today);
    end.setDate(end.getDate() - (historyTimeOffset * daysInWindow));

    const start = new Date(end);
    start.setDate(start.getDate() - daysInWindow + 1);
    start.setHours(0, 0, 0, 0);

    return { start, end };
  };

  const dateRange = getFilterDateRange();

  const getWindowLabel = () => {
    if (!dateRange) return 'All Time';
    const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    if (historyTimeWindow === '1_day') {
      return fmt(dateRange.start);
    }
    return `${fmt(dateRange.start)} - ${fmt(dateRange.end)}`;
  };

  const completedTasks = tasks.filter(t => t.is_completed).sort((a, b) => {
    // Sort by completion date or scheduled date descending
    const dateA = a.completed_at || a.scheduled_date || '';
    const dateB = b.completed_at || b.scheduled_date || '';
    return dateB.localeCompare(dateA);
  }).filter(t => {
    if (historyTopicFilter && !((t.title || '').toLowerCase().includes(historyTopicFilter.toLowerCase()) || (t.topic || '').toLowerCase().includes(historyTopicFilter.toLowerCase()) || (t.subject || '').toLowerCase().includes(historyTopicFilter.toLowerCase()))) {
      return false;
    }
    if (dateRange) {
      const taskDateStr = (t.completed_at || t.scheduled_date || '').split('T')[0];
      if (taskDateStr) {
        const pad = (n: number) => n.toString().padStart(2, '0');
        const toLocalYYYYMMDD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        const startStr = toLocalYYYYMMDD(dateRange.start);
        const endStr = toLocalYYYYMMDD(dateRange.end);
        if (taskDateStr < startStr || taskDateStr > endStr) return false;
      } else {
        return false;
      }
    }
    return true;
  });


  return (
    <StudentLayout pageTitle="Study Planner">
      {/* Modals */}
      <LogStudyModal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
        onSuccess={plannerChanged}
        initialSubject={logModalInitialSubject}
        initialTopic={logModalInitialTopic}
      />
      <CreateTaskModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={plannerChanged}
      />

      {/* Header Hero Banner */}
      <section style={{
        marginBottom: 32, padding: 32, borderRadius: 'var(--radius)',
        backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)',
        boxShadow: 'var(--shadow-color-base)',
        backgroundImage: 'linear-gradient(135deg, rgba(91,92,235,0.08) 0%, rgba(34,197,94,0.06) 100%)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20
      }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', backgroundColor: 'var(--accent-bg)', borderRadius: 'var(--radius)', marginBottom: 10, border: '1px solid var(--accent-border)' }}>
            <Ico.Cal size={14} />
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase' }}>Plan · Track · Revise</span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px 0' }}>Study Planner</h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>Generate a day-by-day plan from your exam syllabus, tick tasks off as you go, and track your coverage.</p>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              setLogModalInitialSubject('');
              setLogModalInitialTopic('');
              setIsLogModalOpen(true);
            }}
            style={{
              padding: '12px 20px', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)',
              borderRadius: 'var(--radius)', border: '1px solid var(--border-default)', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8, boxShadow: 'var(--shadow-color-base)'
            }}
          >
            <Ico.Clock size={16} /> Log Study Session
          </button>
        </div>
      </section>

      {/* Top Summary Stat Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 16,
        marginBottom: 24
      }}>
        <div style={{ backgroundColor: 'var(--bg-card)', padding: '18px 20px', borderRadius: 'var(--radius)', border: '1px solid var(--border-default)' }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>Total Logged Study Time</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent-primary)' }}>
            {summary?.total_logged_hours || 0} <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>hrs</span>
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-card)', padding: '18px 20px', borderRadius: 'var(--radius)', border: '1px solid var(--border-default)' }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>Practice Questions Attempted</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>
            {summary?.total_questions_attempted || 0} <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>Qs</span>
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-card)', padding: '18px 20px', borderRadius: 'var(--radius)', border: '1px solid var(--border-default)' }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>Target Exam Focus</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>
            {user.target_exam || 'UPSC CSE'} {user.target_year || '2026'}
          </div>
          {user.optional_subject && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Optional: {user.optional_subject}
            </div>
          )}
        </div>
      </div>
      {/* Main Tabs Navigation */}
      <div role="tablist" style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid var(--border-default)', paddingBottom: 12, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {([
          { key: 'aaj', label: 'Aaj', icon: Ico.Check },
          { key: 'plan', label: 'Plan', icon: Ico.Cal },
          { key: 'progress', label: 'Progress', icon: Ico.Cal },
          { key: 'syllabus', label: 'Syllabus', icon: Ico.Check },
          { key: 'revision', label: 'Revision', icon: Ico.Clock },
          { key: 'logs', label: `Study Logs (${activities.length})`, icon: Ico.Clock },
          { key: 'history', label: `History (${completedTasks.length})`, icon: Ico.Check },
        ] as { key: Tab; label: string; icon: typeof Ico.Cal }[]).map(tab => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '10px 16px', borderRadius: 'var(--radius)', border: 'none',
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

      <div style={{ width: '100%' }}>
        {PLANNER_TABS.includes(activeTab as PlannerTab) && (
          <StudyPlannerV2
            tab={activeTab as PlannerTab}
            setTab={setActiveTab}
            version={plannerVersion}
            onChanged={plannerChanged}
            onAddTask={() => setIsCreateModalOpen(true)}
          />
        )}

            {/* TAB 3: STUDY SESSION LOGS TABLE */}
            {activeTab === 'logs' && (
              <div style={{ backgroundColor: 'var(--bg-card)', padding: 28, borderRadius: 'var(--radius)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-color-base)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Logged Study Sessions History</h3>
                  <button
                    onClick={() => {
                      setLogModalInitialSubject('');
                      setLogModalInitialTopic('');
                      setIsLogModalOpen(true);
                    }}
                    style={{
                      padding: '8px 14px', borderRadius: 'var(--radius)', border: 'none',
                      backgroundColor: 'var(--accent-primary)', color: '#FFF', fontSize: 13, fontWeight: 700, cursor: 'pointer'
                    }}
                  >
                    + Log New Session
                  </button>
                </div>

                {activities.length === 0 ? (
                  <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                    No study sessions logged yet. Log your study hours to build your streak!
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-default)', textAlign: 'left', color: 'var(--text-muted)' }}>
                          <th style={{ padding: '12px 10px' }}>Date</th>
                          <th style={{ padding: '12px 10px' }}>Subject & Topic</th>
                          <th style={{ padding: '12px 10px' }}>Activity Type</th>
                          <th style={{ padding: '12px 10px' }}>Duration</th>
                          <th style={{ padding: '12px 10px' }}>MCQs Solved</th>
                          <th style={{ padding: '12px 10px' }}>Confidence</th>
                          <th style={{ padding: '12px 10px', textAlign: 'right' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activities.map(a => (
                          <tr key={a.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <td style={{ padding: '12px 10px', color: 'var(--text-primary)', fontWeight: 600 }}>{a.date}</td>
                            <td style={{ padding: '12px 10px' }}>
                              <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{formatEnum(a.subject || 'General Studies')}</div>
                              {a.topic && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatEnum(a.topic)}</div>}
                            </td>
                            <td style={{ padding: '12px 10px' }}>
                              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--radius)', backgroundColor: 'var(--accent-bg)', color: 'var(--accent-primary)' }}>
                                {formatEnum(a.activity_type || 'CONCEPT_REVISION')}
                              </span>
                            </td>
                            <td style={{ padding: '12px 10px', fontWeight: 700, color: 'var(--text-primary)' }}>
                              {a.duration_minutes} mins
                            </td>
                            <td style={{ padding: '12px 10px', color: 'var(--text-secondary)' }}>
                              {a.questions_attempted ? `${a.questions_correct || 0} / ${a.questions_attempted}` : '—'}
                            </td>
                            <td style={{ padding: '12px 10px', color: '#F2B623', fontWeight: 700 }}>
                              {'★'.repeat(Math.min(5, Math.max(1, a.confidence_rating || 4)))}
                            </td>
                            <td style={{ padding: '12px 10px', textAlign: 'right' }}>
                              <button
                                onClick={(e) => handleDeleteActivity(a.id, e)}
                                title="Delete logged study session"
                                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
                              >
                                <Ico.Trash size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}


            {/* TAB 4: STUDY HISTORY (COMPLETED TASKS) */}
            {activeTab === 'history' && (
              <div style={{ backgroundColor: 'var(--bg-card)', padding: 'clamp(16px, 3vw, 28px)', borderRadius: 'var(--radius)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-color-base)' }}>
                <div style={{ marginBottom: 20 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Completed Study History</h3>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Review previously completed topics and study targets.</div>
                </div>

                {/* History Filters */}
                <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%', maxWidth: 300 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>Search by Topic / Subject:</label>
                    <input
                      type="text"
                      placeholder="e.g. Polity, Geography, fundamental rights..."
                      value={historyTopicFilter}
                      onChange={(e) => setHistoryTopicFilter(e.target.value)}
                      style={{ padding: '0 14px', height: 42, boxSizing: 'border-box', borderRadius: 'var(--radius)', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-subtle)', color: 'var(--text-primary)' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%', maxWidth: 400 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>Filter by Time:</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <select
                        value={historyTimeWindow}
                        onChange={(e) => { setHistoryTimeWindow(e.target.value); setHistoryTimeOffset(0); }}
                        style={{ padding: '0 14px', height: 42, boxSizing: 'border-box', borderRadius: 'var(--radius)', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-subtle)', color: 'var(--text-primary)', flex: 1, minWidth: 120 }}
                      >
                        <option value="all">All Time</option>
                        <option value="1_day">1 Day</option>
                        <option value="3_days">3 Days</option>
                        <option value="1_week">1 Week</option>
                        <option value="1_month">1 Month</option>
                      </select>
                      
                      {historyTimeWindow !== 'all' && (
                        <div style={{ display: 'flex', alignItems: 'center', height: 42, boxSizing: 'border-box', backgroundColor: 'var(--bg-subtle)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius)', flexShrink: 0 }}>
                          <button 
                            onClick={() => setHistoryTimeOffset(o => o + 1)}
                            style={{ padding: '0 12px', height: '100%', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-primary)' }}
                            title="Older"
                          >
                            {'<'}
                          </button>
                          <span style={{ fontSize: 13, fontWeight: 700, padding: '0 8px', width: 90, textAlign: 'center', whiteSpace: 'nowrap' }}>
                            {getWindowLabel()}
                          </span>
                          <button 
                            onClick={() => setHistoryTimeOffset(o => Math.max(0, o - 1))}
                            disabled={historyTimeOffset === 0}
                            style={{ padding: '0 12px', height: '100%', border: 'none', background: 'transparent', cursor: historyTimeOffset === 0 ? 'not-allowed' : 'pointer', color: historyTimeOffset === 0 ? 'var(--text-muted)' : 'var(--text-primary)' }}
                            title="Newer"
                          >
                            {'>'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ width: 100, paddingBottom: 2 }}>
                    {(historyTopicFilter || historyTimeWindow !== 'all') && (
                      <button
                        onClick={() => { setHistoryTopicFilter(''); setHistoryTimeWindow('all'); setHistoryTimeOffset(0); }}
                        style={{ padding: '10px 14px', backgroundColor: 'transparent', color: 'var(--text-muted)', border: 'none', textDecoration: 'underline', cursor: 'pointer', fontSize: 13 }}
                      >
                        Clear Filters
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {completedTasks.length === 0 ? (
                    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                      No study tasks completed yet. Check off items from your Weekly Board to build history!
                    </div>
                  ) : (
                    completedTasks.map(t => {
                      const badge = getSubjectBadgeStyle(t.subject);
                      return (
                        <div
                          key={t.id}
                          style={{
                            padding: 'clamp(12px, 2.5vw, 18px)',
                            borderRadius: 'var(--radius)',
                            border: '1px solid var(--border-default)',
                            backgroundColor: 'var(--bg-subtle)',
                            display: 'flex',
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 14,
                            boxSizing: 'border-box',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flex: '1 1 240px', minWidth: 0 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--radius)', backgroundColor: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>
                                  {t.subject || 'General'}
                                </span>
                                {t.completed_at ? (
                                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                    Completed on {new Date(t.completed_at).toLocaleDateString()}
                                  </span>
                                ) : (
                                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                    Scheduled {t.scheduled_date}
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                                {t.title}
                              </div>
                              {t.topic && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Topic: {t.topic}</div>}
                              {t.description && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.4 }}>{t.description}</div>}
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                              ⏱️ {t.allocated_time_minutes} mins
                            </span>
                            <span style={{
                              padding: '6px 12px',
                              borderRadius: 'var(--radius)',
                              backgroundColor: 'rgba(34, 197, 94, 0.12)',
                              color: 'var(--status-success)',
                              fontSize: 12,
                              fontWeight: 700,
                              border: '1px solid rgba(34, 197, 94, 0.25)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6
                            }}>
                              <Ico.Check size={14} /> Completed
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

      </div>
    </StudentLayout>
  );
}
