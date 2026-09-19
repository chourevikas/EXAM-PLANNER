import React, { useState } from 'react';
import { Ico } from '../common/Icons';
import { createStudyTask, CreateTaskPayload } from '../../services/studyPlannerService';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const SUBJECT_OPTIONS = [
  'Indian Polity & Governance',
  'Modern Indian History',
  'Indian Economy',
  'Geography & Environment',
  'Environment & Ecology',
  'Science & Technology',
  'Current Affairs & IR',
  'CSAT & Quantitative Aptitude'
];

const ACTIVITY_TYPES = [
  { value: 'CONCEPT_REVISION', label: '📖 Concept Revision' },
  { value: 'PRACTICE_MCQS', label: '✍️ MCQ Practice' },
  { value: 'PYQ_SOLVING', label: '📜 PYQ Solving' },
  { value: 'MOCK_TEST', label: '📝 Mock Test' },
  { value: 'NOTES_REVIEW', label: '📑 Notes Review' }
];

export function CreateTaskModal({ isOpen, onClose, onSuccess }: CreateTaskModalProps) {
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState(SUBJECT_OPTIONS[0]);
  const [topic, setTopic] = useState('');
  const [priority, setPriority] = useState<'HIGH' | 'MEDIUM' | 'LOW'>('HIGH');
  const [allocatedMins, setAllocatedMins] = useState<number>(45);
  const [activityType, setActivityType] = useState('CONCEPT_REVISION');
  const [dueInDays, setDueInDays] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Please enter a task title.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const payload: CreateTaskPayload = {
        title: title.trim(),
        subject,
        topic: topic.trim() || undefined,
        priority,
        allocated_time_minutes: allocatedMins,
        activity_type: activityType,
        due_in_days: dueInDays
      };

      await createStudyTask(payload);
      setLoading(false);
      onSuccess();
      onClose();
    } catch (err: any) {
      setLoading(false);
      setErrorMsg(err.message || 'Failed to create task.');
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 99999, padding: 16
    }}>
      <div style={{
        backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius)', padding: 28, width: '100%', maxWidth: 520,
        boxShadow: '0 20px 40px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 'var(--radius)',
              backgroundColor: 'rgba(79, 70, 229, 0.1)', color: 'var(--accent-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Ico.Cal size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>Add Study Task</h3>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Schedule a new subject topic target</span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            <Ico.X size={20} />
          </button>
        </div>

        {errorMsg && (
          <div style={{
            padding: '10px 14px', borderRadius: 'var(--radius)', backgroundColor: 'var(--danger-bg)',
            color: 'var(--danger-primary)', fontSize: 13, marginBottom: 16, border: '1px solid rgba(var(--primary-red-rgb), 0.2)'
          }}>
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Title */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--text-secondary)' }}>
              Task Title *
            </label>
            <input
              type="text"
              placeholder="e.g. Solve 30 PYQs on Inflation & Monetary Policy"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 'var(--radius)',
                border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-card)',
                color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Subject & Activity */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--text-secondary)' }}>
                Subject
              </label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 'var(--radius)',
                  border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-primary)', fontSize: 13, outline: 'none'
                }}
              >
                {SUBJECT_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--text-secondary)' }}>
                Activity Type
              </label>
              <select
                value={activityType}
                onChange={(e) => setActivityType(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 'var(--radius)',
                  border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-primary)', fontSize: 13, outline: 'none'
                }}
              >
                {ACTIVITY_TYPES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </div>
          </div>

          {/* Topic & Priority */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--text-secondary)' }}>
                Topic Name
              </label>
              <input
                type="text"
                placeholder="e.g. Monetary Policy Committee & RBI"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 'var(--radius)',
                  border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--text-secondary)' }}>
                Priority Level
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 'var(--radius)',
                  border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-primary)', fontSize: 13, outline: 'none'
                }}
              >
                <option value="HIGH">🔥 HIGH PRIORITY</option>
                <option value="MEDIUM">⚡ MEDIUM PRIORITY</option>
                <option value="LOW">🌱 LOW PRIORITY</option>
              </select>
            </div>
          </div>

          {/* Schedule Date (Due in Days) & Target Duration */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--text-secondary)' }}>
                Schedule Target Date
              </label>
              <select
                value={dueInDays}
                onChange={(e) => setDueInDays(parseInt(e.target.value, 10))}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 'var(--radius)',
                  border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-primary)', fontSize: 13, outline: 'none'
                }}
              >
                <option value={0}>Today</option>
                <option value={1}>Tomorrow</option>
                <option value={2}>In 2 Days</option>
                <option value={3}>In 3 Days</option>
                <option value={5}>In 5 Days</option>
                <option value={7}>Next Week (7 Days)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--text-secondary)' }}>
                Allocated Time (Mins)
              </label>
              <input
                type="number"
                min="10"
                step="5"
                value={allocatedMins}
                onChange={(e) => setAllocatedMins(parseInt(e.target.value, 10) || 30)}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 'var(--radius)',
                  border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1, padding: '12px', borderRadius: 'var(--radius)', border: '1px solid var(--border-default)',
                backgroundColor: 'transparent', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 700, cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                flex: 1, padding: '12px', borderRadius: 'var(--radius)', border: 'none',
                backgroundColor: 'var(--accent-primary)', color: '#FFF', fontSize: 14, fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1
              }}
            >
              {loading ? 'Creating...' : 'Add Task to Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
