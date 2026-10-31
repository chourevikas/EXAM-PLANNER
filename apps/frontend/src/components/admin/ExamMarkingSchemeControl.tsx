import React, { useEffect, useState } from 'react';
import { Pencil } from 'lucide-react';
import { ExamMarkingScheme, fetchExamMarkingScheme, saveExamMarkingScheme } from '../../services/adminService';

const fmt = (v: number) => String(Math.round(v * 100) / 100);

/** The exam's marking scheme as a chip ("+2 / −0.67"), with an inline editor. */
export function ExamMarkingSchemeControl({ examId, onSaved }: { examId: number | string; onSaved?: (msg: string) => void }) {
  const [scheme, setScheme] = useState<ExamMarkingScheme | null>(null);
  const [editing, setEditing] = useState(false);
  const [marks, setMarks] = useState('');
  const [negative, setNegative] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setScheme(null);
    setEditing(false);
    fetchExamMarkingScheme(examId).then(setScheme).catch(() => setScheme(null));
  }, [examId]);

  if (!scheme) return null;

  const open = () => {
    setMarks(fmt(scheme.marks_per_question));
    setNegative(fmt(scheme.negative_marks_per_question));
    setError(null);
    setEditing(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const saved = await saveExamMarkingScheme(examId, Number(marks), Number(negative));
      setScheme(saved);
      setEditing(false);
      onSaved?.(`Marking scheme saved: +${fmt(saved.marks_per_question)} / −${fmt(saved.negative_marks_per_question)}. Tests already taken keep their scores.`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const chip: React.CSSProperties = {
    padding: '3px 9px',
    borderRadius: 'var(--radius)',
    fontSize: 11.5,
    fontWeight: 600,
    backgroundColor: 'var(--bg-hover)',
    color: 'var(--text-secondary)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    border: 'none',
    cursor: 'pointer',
  };

  if (!editing) {
    return (
      <button type="button" onClick={open} style={chip} title="Marks for a correct answer / marks deducted for a wrong one" data-testid="marking-scheme-chip">
        Marking +{fmt(scheme.marks_per_question)} / −{fmt(scheme.negative_marks_per_question)}
        <Pencil size={11} />
      </button>
    );
  }

  const input: React.CSSProperties = { width: 70, padding: '4px 6px', borderRadius: 4, border: '1px solid #CBD5E1', fontSize: 12.5 };
  return (
    <form onSubmit={save} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 12.5 }} aria-label="Marking scheme">
      <label>
        Correct +<input aria-label="Marks for a correct answer" type="number" min={0} step="0.01" value={marks} onChange={(e) => setMarks(e.target.value)} style={input} required />
      </label>
      <label>
        Wrong −<input aria-label="Marks deducted for a wrong answer" type="number" min={0} step="0.01" value={negative} onChange={(e) => setNegative(e.target.value)} style={input} required />
      </label>
      <button type="submit" disabled={saving} style={{ ...chip, backgroundColor: 'var(--primary-red)', color: '#fff' }}>
        {saving ? 'Saving…' : 'Save'}
      </button>
      <button type="button" onClick={() => setEditing(false)} style={chip}>Cancel</button>
      <span style={{ width: '100%', fontSize: 11.5, color: error ? '#B91C1C' : 'var(--text-muted)' }}>
        {error || `Applies to all ${scheme.questions} questions for tests taken from now on.`}
      </span>
    </form>
  );
}
