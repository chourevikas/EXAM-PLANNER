import React, { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { guardedFetch } from '../../utils/apiGuard';

export interface NotificationSettingsValue {
  notify_revision: boolean;
  notify_pending_tasks: boolean;
  notify_task_email: boolean;
  notify_weak_topic: boolean;
  notify_current_affairs: boolean;
  notify_full_paper: boolean;
  notify_full_paper_day: number;
  weekly_email_enabled: boolean;
  weekly_email_day: number;
  weekly_email_hour: number;
}

type BoolKey = {
  [K in keyof NotificationSettingsValue]: NotificationSettingsValue[K] extends boolean ? K : never;
}[keyof NotificationSettingsValue];

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const IN_APP: { key: BoolKey; label: string; hint: string }[] = [
  { key: 'notify_revision', label: 'Revision due', hint: 'Every morning at 7 AM when questions are due for revision.' },
  { key: 'notify_pending_tasks', label: 'Study plan tasks', hint: "Once a day when tasks in today's plan are still open." },
  { key: 'notify_weak_topic', label: 'Weak topic', hint: 'Every Monday: the topic with your lowest accuracy over the last 30 days, with a practice link.' },
  { key: 'notify_current_affairs', label: 'New current affairs', hint: 'In the evening, on days new current affairs are published.' },
  { key: 'notify_full_paper', label: 'Weekly full paper', hint: "A full past paper you haven't taken yet, on the day you choose." },
];

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const selectStyle: React.CSSProperties = {
  height: 38, padding: '0 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border-default)',
  backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 13, fontWeight: 600,
};

function Toggle({ checked, onChange, label, hint, children }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; hint: string; children?: React.ReactNode;
}) {
  return (
    <div style={{ padding: '14px 0', borderTop: '1px solid var(--border-color)' }}>
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ marginTop: 3, width: 16, height: 16, flexShrink: 0 }} />
        <span>
          <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{label}</span>
          <span style={{ display: 'block', fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.45 }}>{hint}</span>
        </span>
      </label>
      {checked && children && <div style={{ margin: '10px 0 0 26px', display: 'flex', gap: 12, flexWrap: 'wrap' }}>{children}</div>}
    </div>
  );
}

export function NotificationSettings() {
  const [value, setValue] = useState<NotificationSettingsValue | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    guardedFetch('/api/v1/notifications/settings', { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`(${r.status})`))))
      .then(setValue)
      .catch((err) => setError(`Could not load your notification settings ${err?.message || ''}`.trim()));
  }, []);

  const set = <K extends keyof NotificationSettingsValue>(key: K, v: NotificationSettingsValue[K]) => {
    setValue((prev) => (prev ? { ...prev, [key]: v } : prev));
    setSaved(false);
  };

  const save = async () => {
    if (!value) return;
    setSaving(true);
    setError(null);
    try {
      const res = await guardedFetch('/api/v1/notifications/settings', {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(value),
      });
      if (!res.ok) throw new Error(`(${res.status})`);
      setValue(await res.json());
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(`Could not save your settings ${err?.message || ''}. Please try again.`);
    } finally {
      setSaving(false);
    }
  };

  if (!value) {
    return (
      <div style={{ fontSize: 14, color: error ? '#B91C1C' : 'var(--text-muted)', padding: '12px 0' }} role={error ? 'alert' : undefined}>
        {error || 'Loading notification settings…'}
      </div>
    );
  }

  return (
    <div data-testid="notification-settings">
      <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 2px' }}>Reminders in the app</h3>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 6px' }}>Shown under the bell at the top of the page. Times are India time (IST).</p>
      {IN_APP.map(({ key, label, hint }) => (
        <Toggle key={key} checked={value[key]} onChange={(v) => set(key, v)} label={label} hint={hint}>
          {key === 'notify_full_paper' && (
            <label style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              Day
              <select aria-label="Full paper reminder day" value={value.notify_full_paper_day} onChange={(e) => set('notify_full_paper_day', Number(e.target.value))} style={selectStyle}>
                {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
              </select>
            </label>
          )}
        </Toggle>
      ))}

      <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', margin: '24px 0 2px' }}>Email</h3>
      <Toggle
        checked={value.notify_task_email}
        onChange={(v) => set('notify_task_email', v)}
        label="Daily study plan email"
        hint="A daily email, sent around midnight, listing the tasks still open in your study plan."
      />
      <Toggle
        checked={value.weekly_email_enabled}
        onChange={(v) => set('weekly_email_enabled', v)}
        label="Weekly summary email"
        hint="Questions, accuracy, tests, XP, streak, milestones and your rank for the past 7 days. Every email has an unsubscribe link."
      >
        <label style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          Day
          <select aria-label="Weekly email day" value={value.weekly_email_day} onChange={(e) => set('weekly_email_day', Number(e.target.value))} style={selectStyle}>
            {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          Time
          <select aria-label="Weekly email time" value={value.weekly_email_hour} onChange={(e) => set('weekly_email_hour', Number(e.target.value))} style={selectStyle}>
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>{`${((h + 11) % 12) + 1}:00 ${h < 12 ? 'AM' : 'PM'}`}</option>
            ))}
          </select>
        </label>
      </Toggle>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-color)' }}>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          style={{ padding: '10px 20px', borderRadius: 'var(--radius)', border: 'none', backgroundColor: 'var(--primary-red)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1, minHeight: 44 }}
        >
          {saving ? 'Saving…' : 'Save notification settings'}
        </button>
        {saved && (
          <span role="status" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#059669' }}>
            <CheckCircle2 size={16} /> Saved
          </span>
        )}
        {error && <span role="alert" style={{ fontSize: 13, color: '#B91C1C' }}>{error}</span>}
      </div>
    </div>
  );
}
