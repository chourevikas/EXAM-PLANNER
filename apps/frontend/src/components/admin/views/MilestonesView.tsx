import React, { useCallback, useEffect, useState } from 'react';
import { Award, Plus, Edit2, Trash2, X, AlertCircle } from 'lucide-react';
import { useBreakpoint } from '../../../hooks/useBreakpoint';
import {
  Milestone,
  MilestoneCriteria,
  MilestoneInput,
  deleteMilestone,
  listMilestones,
  saveMilestone,
} from '../../../services/milestoneService';

const EMPTY: MilestoneInput = {
  name: '',
  description: '',
  criteria_type: 'QUESTIONS_SOLVED',
  threshold: 100,
  xp_reward: 100,
  is_active: true,
};

const card: React.CSSProperties = {
  backgroundColor: 'var(--bg-card)',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius)',
};

const input: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  borderRadius: 'var(--radius)',
  border: '1px solid var(--border-default)',
  backgroundColor: 'var(--bg-subtle)',
  color: 'var(--text-primary)',
  fontSize: 14,
  boxSizing: 'border-box',
};

const label: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6, color: 'var(--text-primary)' };

/** Admin: create, edit, switch off and delete milestones (badges students earn at a threshold). */
export function MilestonesView() {
  const { isMobile } = useBreakpoint();
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [criteria, setCriteria] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id?: number; form: MilestoneInput } | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listMilestones();
      setMilestones(res.milestones);
      setCriteria(res.criteria);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setFormError(null);
    try {
      await saveMilestone(editing.form, editing.id);
      setNotice(
        editing.form.is_active
          ? 'Saved. Students who already qualify are getting it now.'
          : 'Saved. It stays hidden from students until you switch it on.',
      );
      setEditing(null);
      await load();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (m: Milestone) => {
    try {
      const { name, description, criteria_type, threshold, xp_reward } = m;
      await saveMilestone({ name, description, criteria_type, threshold, xp_reward, is_active: !m.is_active }, m.id);
      setNotice(`"${m.name}" switched ${m.is_active ? 'off' : 'on'}.`);
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const remove = async (m: Milestone) => {
    if (!window.confirm(`Delete the milestone "${m.name}"?`)) return;
    try {
      await deleteMilestone(m.id);
      setNotice(`"${m.name}" deleted.`);
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const set = <K extends keyof MilestoneInput>(key: K, value: MilestoneInput[K]) =>
    setEditing((cur) => (cur ? { ...cur, form: { ...cur.form, [key]: value } } : cur));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ ...card, padding: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Award size={20} color="#D97706" /> Milestones
          </h2>
          <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text-muted)' }}>
            Students earn a milestone badge, its XP and a notification when they reach the threshold.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setFormError(null); setEditing({ form: { ...EMPTY } }); }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 'var(--radius)', border: 'none', backgroundColor: 'var(--primary-red)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
        >
          <Plus size={16} /> New milestone
        </button>
      </div>

      {notice && (
        <div role="status" style={{ ...card, padding: '10px 14px', borderColor: '#A7F3D0', backgroundColor: '#ECFDF5', color: '#047857', fontSize: 13.5 }}>
          {notice}
        </div>
      )}
      {error && (
        <div role="alert" style={{ ...card, padding: '10px 14px', borderColor: '#FECACA', backgroundColor: '#FEF2F2', color: '#B91C1C', fontSize: 13.5, display: 'flex', gap: 8, alignItems: 'center' }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <div style={{ ...card, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-subtle)', color: 'var(--text-muted)', fontSize: 12, textTransform: 'uppercase', textAlign: 'left' }}>
              <th style={{ padding: '10px 12px' }}>Milestone</th>
              <th style={{ padding: '10px 12px' }}>Unlocks at</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>XP</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Earned by</th>
              <th style={{ padding: '10px 12px' }}>Status</th>
              <th style={{ padding: '10px 12px' }} aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {loading && milestones.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</td></tr>
            )}
            {!loading && milestones.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>No milestones yet.</td></tr>
            )}
            {milestones.map((m) => (
              <tr key={m.id} style={{ borderTop: '1px solid var(--border-color)', opacity: m.is_active ? 1 : 0.65 }}>
                <td style={{ padding: '10px 12px' }}>
                  <div style={{ fontWeight: 700 }}>{m.name}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{m.description}</div>
                </td>
                <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{m.threshold.toLocaleString()} · {m.criteria_label.toLowerCase()}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right' }}>+{m.xp_reward}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right' }}>{m.unlocked_count}</td>
                <td style={{ padding: '10px 12px' }}>
                  <button
                    type="button"
                    onClick={() => toggle(m)}
                    aria-pressed={m.is_active}
                    title={m.is_active ? 'Switch off' : 'Switch on'}
                    style={{
                      padding: '4px 10px', borderRadius: 999, border: '1px solid', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      borderColor: m.is_active ? '#A7F3D0' : 'var(--border-default)',
                      backgroundColor: m.is_active ? '#ECFDF5' : 'var(--bg-subtle)',
                      color: m.is_active ? '#047857' : 'var(--text-muted)',
                    }}
                  >
                    {m.is_active ? 'On' : 'Off'}
                  </button>
                </td>
                <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', textAlign: 'right' }}>
                  <button
                    type="button"
                    aria-label={`Edit ${m.name}`}
                    onClick={() => {
                      setFormError(null);
                      const { name, description, criteria_type, threshold, xp_reward, is_active } = m;
                      setEditing({ id: m.id, form: { name, description, criteria_type, threshold, xp_reward, is_active } });
                    }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: 'var(--text-secondary)' }}
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${m.name}`}
                    title={m.unlocked_count ? 'Students have earned this; switch it off instead' : 'Delete'}
                    disabled={m.unlocked_count > 0}
                    onClick={() => remove(m)}
                    style={{ background: 'none', border: 'none', cursor: m.unlocked_count ? 'not-allowed' : 'pointer', padding: 6, color: 'var(--primary-red)', opacity: m.unlocked_count ? 0.35 : 1 }}
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="milestone-form-title"
          onClick={(e) => e.target === e.currentTarget && setEditing(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <form onSubmit={submit} style={{ ...card, width: '100%', maxWidth: 480, padding: 22, display: 'flex', flexDirection: 'column', gap: 14, position: 'relative' }}>
            <button type="button" aria-label="Close" onClick={() => setEditing(null)} style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <X size={18} />
            </button>
            <h3 id="milestone-form-title" style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{editing.id ? 'Edit milestone' : 'New milestone'}</h3>
            <div>
              <label htmlFor="ms-name" style={label}>Name</label>
              <input id="ms-name" required maxLength={100} value={editing.form.name} onChange={(e) => set('name', e.target.value)} style={input} placeholder="e.g. 500 Questions" />
            </div>
            <div>
              <label htmlFor="ms-desc" style={label}>Description (shown to students)</label>
              <input id="ms-desc" required maxLength={300} value={editing.form.description} onChange={(e) => set('description', e.target.value)} style={input} placeholder="e.g. Solved 500 questions." />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.4fr 1fr', gap: 12 }}>
              <div>
                <label htmlFor="ms-criteria" style={label}>Counts</label>
                <select id="ms-criteria" value={editing.form.criteria_type} onChange={(e) => set('criteria_type', e.target.value as MilestoneCriteria)} style={input}>
                  {Object.entries(criteria).map(([key, text]) => <option key={key} value={key}>{text}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="ms-threshold" style={label}>Unlocks at</label>
                <input id="ms-threshold" type="number" required min={1} value={editing.form.threshold} onChange={(e) => set('threshold', Number(e.target.value))} style={input} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, alignItems: 'end' }}>
              <div>
                <label htmlFor="ms-xp" style={label}>XP reward</label>
                <input id="ms-xp" type="number" required min={0} max={10000} value={editing.form.xp_reward} onChange={(e) => set('xp_reward', Number(e.target.value))} style={input} />
              </div>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer', paddingBottom: 10 }}>
                <input type="checkbox" checked={editing.form.is_active} onChange={(e) => set('is_active', e.target.checked)} /> Active (students can earn it)
              </label>
            </div>
            {formError && <div role="alert" style={{ color: '#B91C1C', fontSize: 13 }}>{formError}</div>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setEditing(null)} style={{ padding: '10px 16px', borderRadius: 'var(--radius)', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', fontWeight: 700, cursor: 'pointer' }}>
                Cancel
              </button>
              <button type="submit" disabled={saving} style={{ padding: '10px 16px', borderRadius: 'var(--radius)', border: 'none', backgroundColor: 'var(--primary-red)', color: '#fff', fontWeight: 700, cursor: saving ? 'wait' : 'pointer' }}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
