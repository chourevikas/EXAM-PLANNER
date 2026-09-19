import React, { useState, useEffect } from 'react';
import { StudentLayout } from '../components/student/StudentLayout';
import { Ico } from '../components/common/Icons';
import { LogStudyModal } from '../components/student/LogStudyModal';
import { CreateTaskModal } from '../components/student/CreateTaskModal';
import {
  fetchWeeklySchedule,
  fetchStudyTasks,
  fetchStudyActivities,
  fetchStudyActivitiesSummary,
  completeStudyTask,
  deleteStudyTask,
  generateWeeklyStudyPlan,
  WeeklyScheduleResponse,
  StudyTaskItem,
  StudyActivityItem,
  StudySummaryResponse,
  deleteStudyActivity,
  sendPendingTasksEmail
} from '../services/studyPlannerService';
import { useMinimumLoadingTime } from '../hooks/useMinimumLoadingTime';
import { StudyPlannerSkeleton } from '../components/student/StudyPlannerSkeleton';
import { formatEnum } from '../utils/formatEnum';

function getActivityTypeBadge(activityType?: string, title?: string) {
  const act = (activityType || '').toUpperCase();
  const titleLower = (title || '').toLowerCase();

  if (act === 'NEW_TOPIC' || (!act && !titleLower.includes('revision') && !titleLower.includes('mcq') && !titleLower.includes('test'))) {
    return { label: '📘 New Topic', bg: 'rgba(var(--primary-red-rgb), 0.12)', color: 'var(--primary-red)', border: 'rgba(var(--primary-red-rgb), 0.25)' };
  }
  if (act === 'PRACTICE_MCQS' || act === 'MOCK_TEST' || act === 'PYQ_SOLVING' || titleLower.includes('mcq') || titleLower.includes('test') || titleLower.includes('pyq')) {
    return { label: '✍️ Practice MCQs / PYQs', bg: 'rgba(16, 185, 129, 0.12)', color: '#3A8B53', border: 'rgba(16, 185, 129, 0.25)' };
  }
  return { label: '🔁 Weak Area Revision', bg: 'rgba(245, 158, 11, 0.12)', color: '#F2B623', border: 'rgba(245, 158, 11, 0.25)' };
}

function renderActivityCategoryDropdowns(
  tasksList: StudyTaskItem[],
  onToggleComplete: (id: string, e: React.MouseEvent) => void,
  onDeleteTask: (id: string, e: React.MouseEvent) => void,
  onOpenLog: (subject: string, topic: string) => void,
  getSubjectBadgeStyle: (subject?: string) => { bg: string; color: string; border: string },
  selectedDayDate?: string
) {
  const todayStr = new Date().toISOString().split('T')[0];

  const newTopics = tasksList.filter(t => {
    const act = (t.activity_type || '').toUpperCase();
    if (act === 'NEW_TOPIC') return true;
    if (act === 'CONCEPT_REVISION' || act === 'NOTES_REVIEW' || act === 'PRACTICE_MCQS' || act === 'PYQ_SOLVING' || act === 'MOCK_TEST') return false;
    const titleLower = (t.title || '').toLowerCase();
    return !titleLower.includes('revision') && !titleLower.includes('review') &&
      !titleLower.includes('mcq') && !titleLower.includes('test') &&
      !titleLower.includes('quiz') && !titleLower.includes('pyq') && !titleLower.includes('practice');
  });

  const revisions = tasksList.filter(t => {
    if (newTopics.includes(t)) return false;
    const act = (t.activity_type || '').toUpperCase();
    if (act === 'CONCEPT_REVISION' || act === 'NOTES_REVIEW') return true;
    if (act === 'PRACTICE_MCQS' || act === 'PYQ_SOLVING' || act === 'MOCK_TEST') return false;
    const titleLower = (t.title || '').toLowerCase();
    return titleLower.includes('revision') || titleLower.includes('review');
  });

  const practices = tasksList.filter(t => !newTopics.includes(t) && !revisions.includes(t));

  const categories = [
    {
      id: 'new_topic',
      title: '📘 New Topics',
      tasks: newTopics,
      bg: 'rgba(var(--primary-red-rgb), 0.04)',
      borderColor: 'rgba(var(--primary-red-rgb), 0.25)',
      badgeBg: 'rgba(var(--primary-red-rgb), 0.12)',
      badgeColor: 'var(--primary-red)',
    },
    {
      id: 'revision',
      title: '🔁 Concept Revisions',
      tasks: revisions,
      bg: 'rgba(245, 158, 11, 0.04)',
      borderColor: 'rgba(245, 158, 11, 0.25)',
      badgeBg: 'rgba(245, 158, 11, 0.12)',
      badgeColor: '#F2B623',
    },
    {
      id: 'practice',
      title: '✍️ Practice & PYQs',
      tasks: practices,
      bg: 'rgba(16, 185, 129, 0.04)',
      borderColor: 'rgba(16, 185, 129, 0.25)',
      badgeBg: 'rgba(16, 185, 129, 0.12)',
      badgeColor: '#3A8B53',
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {categories.map(cat => (
        <details
          key={cat.id}
          open
          style={{
            backgroundColor: 'var(--bg-card)',
            border: `1.5px solid ${cat.borderColor}`,
            borderRadius: 0,
            overflow: 'hidden',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
          }}
        >
          <summary
            style={{
              padding: '14px 18px',
              backgroundColor: cat.bg,
              cursor: 'pointer',
              fontWeight: 800,
              fontSize: 14,
              color: 'var(--text-primary)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              userSelect: 'none',
              listStyle: 'none'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span>{cat.title}</span>
              <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 10px', borderRadius: 0, backgroundColor: cat.badgeBg, color: cat.badgeColor }}>
                {cat.tasks.length} Sub-topics
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Ico.ChevronDown size={18} style={{ color: 'var(--text-muted)' }} />
            </div>
          </summary>

          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10, backgroundColor: 'var(--bg-subtle)' }}>
            {cat.tasks.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', padding: '8px 4px' }}>
                No sub-topics currently scheduled under this activity type.
              </div>
            ) : (
              cat.tasks.map(t => {
                const taskDateStr = selectedDayDate || (t.scheduled_date ? String(t.scheduled_date) : todayStr);
                const isFuture = taskDateStr > todayStr;
                const badge = getSubjectBadgeStyle(t.subject);
                return (
                  <div
                    key={t.id}
                    style={{
                      padding: 14, borderRadius: 0,
                      backgroundColor: t.is_completed ? 'var(--bg-subtle)' : 'var(--bg-card)',
                      border: '1px solid var(--border-default)',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                      opacity: isFuture ? 0.85 : 1
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 220 }}>
                      <button
                        disabled={isFuture}
                        onClick={(e) => {
                          if (isFuture) return;
                          onToggleComplete(t.id, e);
                        }}
                        title={isFuture ? "Upcoming task: Can only be completed on or after its scheduled date" : undefined}
                        style={{
                          width: 22, height: 22, borderRadius: 0,
                          border: isFuture ? '2px dashed var(--border-disabled)' : (t.is_completed ? 'none' : '2px solid var(--border-disabled)'),
                          backgroundColor: isFuture ? 'var(--bg-subtle)' : (t.is_completed ? 'var(--success-primary)' : 'transparent'),
                          color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: isFuture ? 'not-allowed' : 'pointer', flexShrink: 0, opacity: isFuture ? 0.6 : 1
                        }}
                      >
                        {isFuture ? <Ico.Lock size={11} style={{ color: 'var(--text-muted)' }} /> : (t.is_completed && <Ico.Check size={12} />)}
                      </button>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: t.is_completed ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: t.is_completed ? 'line-through' : 'none' }}>
                          {t.title}
                        </div>
                        {t.description && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{t.description}</div>}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {t.is_ai_recommended === false && (
                        <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 0, backgroundColor: 'rgba(168, 85, 247, 0.12)', color: '#9333EA', border: '1px solid rgba(168, 85, 247, 0.25)' }}>
                          📌 Custom Task
                        </span>
                      )}
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 0, backgroundColor: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>
                        {t.subject || 'General'}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
                        ⏱️ {t.allocated_time_minutes}m
                      </span>
                      <button
                        disabled={isFuture}
                        onClick={(e) => {
                          if (isFuture) return;
                          onToggleComplete(t.id, e);
                        }}
                        title={isFuture ? "Upcoming task: Can only be completed on or after its scheduled date" : undefined}
                        style={{
                          padding: '5px 12px', borderRadius: 0,
                          border: isFuture ? '1px solid var(--border-default)' : (t.is_completed ? '1px solid var(--border-default)' : 'none'),
                          backgroundColor: isFuture ? 'var(--bg-subtle)' : (t.is_completed ? 'var(--bg-subtle)' : 'var(--accent-primary)'),
                          color: isFuture ? 'var(--text-muted)' : (t.is_completed ? 'var(--text-muted)' : '#FFF'),
                          fontSize: 11, fontWeight: 700,
                          cursor: isFuture ? 'not-allowed' : 'pointer',
                          opacity: isFuture ? 0.7 : 1,
                          boxShadow: (isFuture || t.is_completed) ? 'none' : '0 2px 6px var(--shadow-color-accent)',
                          display: 'flex', alignItems: 'center', gap: 4
                        }}
                      >
                        {isFuture ? (
                          <>
                            <Ico.Lock size={12} /> Upcoming
                          </>
                        ) : t.is_completed ? (
                          <>
                            <Ico.Check size={12} /> Completed
                          </>
                        ) : (
                          'Mark Complete'
                        )}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </details>
      ))}
    </div>
  );
}

export function StudyPlannerPage() {
  const [activeTab, setActiveTab] = useState<'weekly' | 'daily' | 'logs' | 'history'>('weekly');
  const [schedule, setSchedule] = useState<WeeklyScheduleResponse | null>(null);
  const [tasks, setTasks] = useState<StudyTaskItem[]>([]);
  const [activities, setActivities] = useState<StudyActivityItem[]>([]);
  const [summary, setSummary] = useState<StudySummaryResponse | null>(null);
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user') || '{}'));

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

  const [loading, setLoading] = useState(true);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [logModalInitialSubject, setLogModalInitialSubject] = useState('');
  const [logModalInitialTopic, setLogModalInitialTopic] = useState('');
  const [filterSubject, setFilterSubject] = useState<string>('ALL');
  const [historyTopicFilter, setHistoryTopicFilter] = useState<string>('');
  const [historyTimeWindow, setHistoryTimeWindow] = useState<string>('1_day');
  const [historyTimeOffset, setHistoryTimeOffset] = useState<number>(0);
  const [selectedDayDate, setSelectedDayDate] = useState<string>('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailFeedback, setEmailFeedback] = useState<string | null>(null);

  const handleSendPendingEmail = async () => {
    setIsSendingEmail(true);
    setEmailFeedback(null);
    try {
      const res = await sendPendingTasksEmail();
      setEmailFeedback(res.message || 'Pending tasks email dispatched successfully!');
    } catch (err: any) {
      setEmailFeedback(err.message || 'Failed to send pending tasks email. Please try again.');
    } finally {
      setIsSendingEmail(false);
      setTimeout(() => setEmailFeedback(null), 6000);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [schRes, tasksRes, actRes, sumRes] = await Promise.allSettled([
        fetchWeeklySchedule(),
        fetchStudyTasks(),
        fetchStudyActivities(),
        fetchStudyActivitiesSummary()
      ]);

      let schData = schRes.status === 'fulfilled' ? schRes.value : null;
      let tasksData = tasksRes.status === 'fulfilled' ? tasksRes.value : [];
      let actData = actRes.status === 'fulfilled' ? actRes.value : [];
      let sumData = sumRes.status === 'fulfilled' ? sumRes.value : null;

      // Auto-generate full 7-day weekly plan if schedule is empty for the current week
      const totalWeekTasks = schData?.days?.reduce((acc: any, d: any) => acc + (d.tasks?.length || 0), 0) || 0;
      if (schData && schData.days && totalWeekTasks === 0) {
        await generateWeeklyStudyPlan(undefined, true);
        const [newSch, newTasks] = await Promise.all([
          fetchWeeklySchedule(),
          fetchStudyTasks()
        ]);
        schData = newSch;
        tasksData = newTasks;
      }

      if (schData) setSchedule(schData);
      setTasks(tasksData);
      setActivities(actData);
      if (sumData) setSummary(sumData);
    } catch (err) {
      console.error('Error loading study planner data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleComplete = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    // Check if task is already completed - completion is permanent
    const currentTask = tasks.find(t => t.id === taskId);
    if (currentTask?.is_completed) {
      return; // Do nothing if already completed
    }

    // 1. Optimistically set is_completed = true in local UI state immediately
    setSchedule(prevSchedule => {
      if (!prevSchedule || !prevSchedule.days) return prevSchedule;
      return {
        ...prevSchedule,
        days: prevSchedule.days.map(day => {
          const hasTask = day.tasks.some(t => t.id === taskId);
          if (!hasTask) return day;
          const updatedTasks = day.tasks.map(t =>
            t.id === taskId ? { ...t, is_completed: true } : t
          );
          const completedCount = updatedTasks.filter(t => t.is_completed).length;
          return {
            ...day,
            completed_tasks_count: completedCount,
            tasks: updatedTasks,
          };
        }),
      };
    });

    setTasks(prevTasks =>
      prevTasks.map(t => (t.id === taskId ? { ...t, is_completed: true } : t))
    );

    // 2. Perform DB write operation to persist completion in database
    try {
      await completeStudyTask(taskId);
      const [sumData, actData] = await Promise.all([
        fetchStudyActivitiesSummary(),
        fetchStudyActivities()
      ]);
      setSummary(sumData);
      setActivities(actData);
    } catch (err) {
      console.error('Failed to complete task:', err);
      // Revert state on network failure
      loadData();
    }
  };

  const handleDeleteTask = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!window.confirm('Are you sure you want to remove this task?')) return;

    // Optimistically remove task from UI state immediately
    setSchedule(prevSchedule => {
      if (!prevSchedule || !prevSchedule.days) return prevSchedule;
      return {
        ...prevSchedule,
        days: prevSchedule.days.map(day => {
          const updatedTasks = day.tasks.filter(t => t.id !== taskId);
          return {
            ...day,
            total_tasks_count: updatedTasks.length,
            completed_tasks_count: updatedTasks.filter(t => t.is_completed).length,
            tasks: updatedTasks,
          };
        }),
      };
    });

    setTasks(prevTasks => prevTasks.filter(t => t.id !== taskId));

    try {
      await deleteStudyTask(taskId);
    } catch (err) {
      console.error('Failed to delete task:', err);
      loadData();
    }
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
      loadData();
    }
  };

  const openLogForTask = (subject?: string, topic?: string) => {
    setLogModalInitialSubject(subject || 'Indian Polity & Governance');
    setLogModalInitialTopic(topic || '');
    setIsLogModalOpen(true);
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

  // Today's tasks helper
  const todayStr = new Date().toISOString().split('T')[0];
  const todayTasks = tasks.filter(t => t.scheduled_date === todayStr);

  const filteredTasks = filterSubject === 'ALL'
    ? tasks
    : tasks.filter(t => (t.subject || '').toLowerCase().includes(filterSubject.toLowerCase()));

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
        onSuccess={loadData}
        initialSubject={logModalInitialSubject}
        initialTopic={logModalInitialTopic}
      />
      <CreateTaskModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={loadData}
      />

      {/* Header Hero Banner */}
      <section style={{
        marginBottom: 32, padding: 32, borderRadius: 0,
        backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)',
        boxShadow: 'var(--shadow-color-base)',
        backgroundImage: 'linear-gradient(135deg, rgba(91,92,235,0.08) 0%, rgba(34,197,94,0.06) 100%)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20
      }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', backgroundColor: 'var(--accent-bg)', borderRadius: 0, marginBottom: 10, border: '1px solid var(--accent-border)' }}>
            <Ico.Cal size={14} />
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase' }}>Weekly Schedule & Logger</span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px 0' }}>Adaptive Study Planner</h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>Structure your weekly targets and log actual study hours.</p>
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
              borderRadius: 0, border: '1px solid var(--border-default)', fontSize: 14, fontWeight: 700, cursor: 'pointer',
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
        <div style={{ backgroundColor: 'var(--bg-card)', padding: '18px 20px', borderRadius: 0, border: '1px solid var(--border-default)' }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>Total Logged Study Time</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent-primary)' }}>
            {summary?.total_logged_hours || 0} <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>hrs</span>
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-card)', padding: '18px 20px', borderRadius: 0, border: '1px solid var(--border-default)' }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>Practice Questions Attempted</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>
            {summary?.total_questions_attempted || 0} <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>Qs</span>
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-card)', padding: '18px 20px', borderRadius: 0, border: '1px solid var(--border-default)' }}>
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
      <div style={{ display: 'flex', gap: 12, marginBottom: 28, borderBottom: '1px solid var(--border-default)', paddingBottom: 12, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {[
          { key: 'weekly', label: '7-Day Weekly Board', icon: Ico.Cal },
          { key: 'daily', label: `Today's Focus (${todayTasks.length})`, icon: Ico.Check },
          { key: 'logs', label: `Study Session Logs (${activities.length})`, icon: Ico.Clock },
          { key: 'history', label: `Study History (${completedTasks.length})`, icon: Ico.Check }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            style={{
              padding: '10px 18px', borderRadius: 0, border: 'none',
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

      {/* Content Area */}
      {loading ? (
        <div style={{ width: '100%' }}>
          <StudyPlannerSkeleton />
        </div>
      ) : (
        <div style={{ width: '100%' }}>

          {/* Main Tab Views */}
          <div>

            {/* TAB 1: 7-DAY WEEKLY BOARD */}
            {activeTab === 'weekly' && schedule && (() => {
              const todayDay = schedule.days.find(d => d.is_today) || schedule.days[0];
              const todayIdx = schedule.days.findIndex(d => d.date === todayDay.date);
              const tomorrowDay = schedule.days[(todayIdx + 1) % schedule.days.length];
              const currentSelectedDate = selectedDayDate || todayDay.date;
              const selectedDayData = schedule.days.find(d => d.date === currentSelectedDate) || todayDay;

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

                  {/* Top Bar info */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                        Weekly Schedule ({schedule.start_date} to {schedule.end_date})
                      </h3>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                        Total Weekly Target: <strong>{Math.round(schedule.days.reduce((acc, d) => acc + d.allocated_minutes, 0) / 60)} hours</strong>
                      </div>
                    </div>
                  </div>

                  {schedule.days.every(d => d.tasks.length === 0) && (
                    <div style={{
                      padding: 24, borderRadius: 0,
                      backgroundColor: 'rgba(91,92,235,0.05)', border: '1px solid var(--accent-border)',
                      textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8
                    }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>Setting Up Your Weekly Study Targets...</div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 500 }}>
                        Your 7-day target plan across Polity, History, Economy, Geography, Environment, CSAT & Mocks is automatically initialized.
                      </div>
                    </div>
                  )}

                  {/* UNIFIED DYNAMIC DAY SCHEDULE EXPLORER CARD */}
                  <div style={{
                    backgroundColor: 'var(--bg-card)',
                    border: '2px solid var(--accent-primary)',
                    borderRadius: 0, padding: 24,
                    boxShadow: '0 10px 30px rgba(79, 70, 229, 0.10)',
                    backgroundImage: 'linear-gradient(135deg, rgba(79, 70, 229, 0.03) 0%, rgba(34, 197, 94, 0.02) 100%)'
                  }}>
                    {/* Header & Day Dropdown Selector */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14, marginBottom: 18 }}>
                      <div>
                        <h4 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>
                          📅 Schedule Explorer by Day
                        </h4>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                          Select any day of the week from the dropdown to review, modify, or complete tasks.
                        </div>
                      </div>

                      {/* Dropdown Day Selector */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>Select Day:</label>
                        <select
                          value={currentSelectedDate}
                          onChange={(e) => setSelectedDayDate(e.target.value)}
                          style={{
                            padding: '10px 16px', borderRadius: 0,
                            backgroundColor: 'var(--bg-subtle)', color: 'var(--text-primary)',
                            border: '1px solid var(--border-default)', fontSize: 13, fontWeight: 700,
                            cursor: 'pointer', outline: 'none'
                          }}
                        >
                          {schedule.days.map(d => (
                            <option key={d.date} value={d.date}>
                              {d.day_name} ({d.date}) {d.is_today ? '— Today' : ''} [{d.tasks.length} Tasks]
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Quick Day Selector Pills (Mon, Tue, Wed, Thu, Fri NOW, Sat, Sun) */}
                    <div style={{ display: 'flex', gap: 8, marginBottom: 20, overflowX: 'auto', paddingBottom: 6 }}>
                      {schedule.days.map(d => {
                        const isSelected = d.date === currentSelectedDate;
                        return (
                          <button
                            key={d.date}
                            onClick={() => setSelectedDayDate(d.date)}
                            style={{
                              padding: '8px 14px', borderRadius: 0,
                              border: isSelected ? '2px solid var(--accent-primary)' : '1px solid var(--border-default)',
                              backgroundColor: isSelected ? 'var(--accent-bg)' : 'var(--bg-subtle)',
                              color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                              fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                              display: 'flex', alignItems: 'center', gap: 6
                            }}
                          >
                            <span>{d.day_name.slice(0, 3)}</span>
                            {d.is_today && <span style={{ fontSize: 9, padding: '1px 4px', borderRadius: 0, backgroundColor: 'var(--accent-primary)', color: '#FFF' }}>NOW</span>}
                            <span style={{ opacity: 0.7 }}>({d.tasks.length})</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Selected Day Header & Summary Bar */}
                    <div style={{
                      padding: '14px 18px', borderRadius: 0,
                      backgroundColor: 'var(--bg-subtle)',
                      border: '1px solid var(--border-default)',
                      marginBottom: 16,
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 0, backgroundColor: selectedDayData.is_today ? '#22C55E' : 'var(--accent-primary)' }} />
                        <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>
                          {selectedDayData.day_name}'s Schedule <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>({selectedDayData.date})</span>
                        </span>
                        {selectedDayData.is_today && (
                          <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 0, backgroundColor: 'rgba(34, 197, 94, 0.12)', color: 'var(--status-success)' }}>
                            TODAY
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-primary)' }}>
                        {selectedDayData.tasks.filter(t => t.is_completed).length} / {selectedDayData.tasks.length} Completed ({Math.round(selectedDayData.logged_minutes / 60 * 10) / 10} / {Math.round(selectedDayData.allocated_minutes / 60 * 10) / 10} hrs)
                      </div>
                    </div>

                    {/* Selected Day Tasks Categorized into 3 Activity Categories */}
                    {selectedDayData.tasks.length === 0 ? (
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '24px 0' }}>
                        No targets scheduled for {selectedDayData.day_name}.
                      </div>
                    ) : (
                      renderActivityCategoryDropdowns(
                        selectedDayData.tasks,
                        handleToggleComplete,
                        handleDeleteTask,
                        openLogForTask,
                        getSubjectBadgeStyle,
                        selectedDayData.date
                      )
                    )}
                  </div>
                </div>
              );
            })()}

            {/* TAB 2: TODAY'S FOCUS CHECKLIST */}
            {activeTab === 'daily' && (
              <div style={{ backgroundColor: 'var(--bg-card)', padding: 'clamp(16px, 3vw, 28px)', borderRadius: 0, border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-color-base)' }}>
                <div style={{ marginBottom: 20 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Today's Scheduled Targets</h3>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Date: {todayStr}</div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {todayTasks.length === 0 ? (
                    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                      No targets scheduled for today!
                    </div>
                  ) : (
                    todayTasks.map(t => {
                      const badge = getSubjectBadgeStyle(t.subject);
                      return (
                        <div
                          key={t.id}
                          style={{
                            padding: 'clamp(12px, 2.5vw, 18px)',
                            borderRadius: 0,
                            border: '1px solid var(--border-default)',
                            backgroundColor: t.is_completed ? 'var(--bg-subtle)' : 'var(--bg-card)',
                            display: 'flex',
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 14,
                            boxSizing: 'border-box',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flex: '1 1 240px', minWidth: 0 }}>
                            <button
                              type="button"
                              onClick={(e) => handleToggleComplete(t.id, e)}
                              className="touch-target center-content"
                              style={{
                                width: 24,
                                height: 24,
                                minWidth: 24,
                                minHeight: 24,
                                borderRadius: 0,
                                border: t.is_completed ? 'none' : '2px solid var(--border-disabled)',
                                backgroundColor: t.is_completed ? 'var(--success-primary)' : 'transparent',
                                color: '#FFF',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                flexShrink: 0,
                                marginTop: 2,
                              }}
                              aria-label={t.is_completed ? 'Mark incomplete' : 'Mark complete'}
                            >
                              {t.is_completed && <Ico.Check size={14} />}
                            </button>

                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 0, backgroundColor: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>
                                  {t.subject || 'General'}
                                </span>
                                <span style={{
                                  fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 0,
                                  backgroundColor: t.priority === 'HIGH' ? 'var(--danger-bg)' : 'var(--warning-bg)',
                                  color: t.priority === 'HIGH' ? 'var(--danger-primary)' : 'var(--warning-primary)'
                                }}>
                                  {t.priority || 'MEDIUM'} PRIORITY
                                </span>
                              </div>
                              <div style={{ fontSize: 14.5, fontWeight: 700, color: t.is_completed ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: t.is_completed ? 'line-through' : 'none', lineHeight: 1.4 }}>
                                {t.title}
                              </div>
                              {t.description && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.4 }}>{t.description}</div>}
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{t.allocated_time_minutes} mins</span>
                            <button
                              type="button"
                              onClick={(e) => handleToggleComplete(t.id, e)}
                              className="touch-target center-content"
                              style={{
                                padding: '8px 16px',
                                borderRadius: 0,
                                border: t.is_completed ? '1px solid var(--border-default)' : 'none',
                                backgroundColor: t.is_completed ? 'var(--bg-subtle)' : 'var(--accent-primary)',
                                color: t.is_completed ? 'var(--text-muted)' : '#FFF',
                                fontSize: 13,
                                fontWeight: 700,
                                cursor: 'pointer',
                                boxShadow: t.is_completed ? 'none' : '0 2px 6px var(--shadow-color-accent)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6,
                                minHeight: 38,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {t.is_completed ? (
                                <>
                                  <Ico.Check size={14} /> Completed
                                </>
                              ) : (
                                'Mark Complete'
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: STUDY SESSION LOGS TABLE */}
            {activeTab === 'logs' && (
              <div style={{ backgroundColor: 'var(--bg-card)', padding: 28, borderRadius: 0, border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-color-base)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Logged Study Sessions History</h3>
                  <button
                    onClick={() => {
                      setLogModalInitialSubject('');
                      setLogModalInitialTopic('');
                      setIsLogModalOpen(true);
                    }}
                    style={{
                      padding: '8px 14px', borderRadius: 0, border: 'none',
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
                              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 0, backgroundColor: 'var(--accent-bg)', color: 'var(--accent-primary)' }}>
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
              <div style={{ backgroundColor: 'var(--bg-card)', padding: 'clamp(16px, 3vw, 28px)', borderRadius: 0, border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-color-base)' }}>
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
                      style={{ padding: '0 14px', height: 42, boxSizing: 'border-box', borderRadius: 0, border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-subtle)', color: 'var(--text-primary)' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%', maxWidth: 400 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>Filter by Time:</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <select
                        value={historyTimeWindow}
                        onChange={(e) => { setHistoryTimeWindow(e.target.value); setHistoryTimeOffset(0); }}
                        style={{ padding: '0 14px', height: 42, boxSizing: 'border-box', borderRadius: 0, border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-subtle)', color: 'var(--text-primary)', flex: 1, minWidth: 120 }}
                      >
                        <option value="all">All Time</option>
                        <option value="1_day">1 Day</option>
                        <option value="3_days">3 Days</option>
                        <option value="1_week">1 Week</option>
                        <option value="1_month">1 Month</option>
                      </select>
                      
                      {historyTimeWindow !== 'all' && (
                        <div style={{ display: 'flex', alignItems: 'center', height: 42, boxSizing: 'border-box', backgroundColor: 'var(--bg-subtle)', border: '1px solid var(--border-default)', borderRadius: 0, flexShrink: 0 }}>
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
                            borderRadius: 0,
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
                                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 0, backgroundColor: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>
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
                              borderRadius: 0,
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

        </div>
      )}
    </StudentLayout>
  );
}
