import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Check, ChevronRight, Edit2, Link2, Link2Off, Plus, Trash2 } from 'lucide-react';

/** Building blocks of the syllabus tree editor (Exam Types → Syllabus). */
export const card: React.CSSProperties = {
  backgroundColor: 'var(--bg-card)',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius)',
};

export const input: React.CSSProperties = {
  width: '100%',
  padding: '8px 11px',
  borderRadius: 'var(--radius)',
  border: '1px solid var(--border-default)',
  backgroundColor: 'var(--bg-subtle)',
  color: 'var(--text-primary)',
  fontSize: 13.5,
  boxSizing: 'border-box',
};

export const iconBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, padding: 0,
  borderRadius: 6, border: '1px solid transparent', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer',
};

export const solidBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 'var(--radius)', border: 'none',
  backgroundColor: 'var(--primary-red)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
};

export const ghostBtn: React.CSSProperties = {
  ...solidBtn, backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-default)',
};

export const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;

export const IMPORT_HINT = `One subject per line:
Polity|Constitution:Preamble,Fundamental Rights;Parliament:Lok Sabha,Rajya Sabha
Economy|Banking:RBI,NPAs

or JSON: {"Polity": {"Constitution": ["Preamble", "Fundamental Rights"]}}`;


export function Row(props: {
  name: string;
  meta?: string;
  bold?: boolean;
  small?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  onRename: (name: string) => void;
  onUp?: () => void;
  onDown?: () => void;
  onDelete: () => void;
  extra?: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: props.bold ? '8px 10px' : '3px 0', flexWrap: 'wrap' }}>
      {props.onToggle && (
        <button type="button" aria-label={props.expanded ? 'Collapse' : 'Expand'} aria-expanded={props.expanded} style={iconBtn} onClick={props.onToggle}>
          <ChevronRight size={15} style={{ transform: props.expanded ? 'rotate(90deg)' : undefined, transition: 'transform .15s' }} />
        </button>
      )}
      <div style={{ flex: 1, minWidth: 140 }}>
        <InlineName value={props.name} size={props.bold ? 14.5 : props.small ? 13 : 13.5} weight={props.bold ? 700 : props.small ? 400 : 600} onSave={props.onRename} />
        {props.meta && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{props.meta}</div>}
      </div>
      {props.extra}
      <button type="button" aria-label={`Move ${props.name} up`} style={{ ...iconBtn, visibility: props.onUp ? 'visible' : 'hidden' }} onClick={props.onUp}><ArrowUp size={14} /></button>
      <button type="button" aria-label={`Move ${props.name} down`} style={{ ...iconBtn, visibility: props.onDown ? 'visible' : 'hidden' }} onClick={props.onDown}><ArrowDown size={14} /></button>
      <button type="button" aria-label={`Delete ${props.name}`} style={{ ...iconBtn, color: '#B91C1C' }} onClick={props.onDelete}><Trash2 size={14} /></button>
    </div>
  );
}

export function InlineName({ value, onSave, size = 14, weight = 700 }: { value: string; onSave: (v: string) => void; size?: number; weight?: number }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  if (!editing) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: size, fontWeight: weight, wordBreak: 'break-word' }}>
        {value}
        <button type="button" aria-label={`Rename ${value}`} style={{ ...iconBtn, width: 22, height: 22 }} onClick={() => setEditing(true)}><Edit2 size={12} /></button>
      </span>
    );
  }
  const save = () => {
    const v = draft.trim();
    setEditing(false);
    if (v && v !== value) onSave(v);
    else setDraft(value);
  };
  return (
    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', width: '100%' }}>
      <input autoFocus style={{ ...input, padding: '4px 8px' }} value={draft} maxLength={255} onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setDraft(value); setEditing(false); } }} />
      <button type="button" aria-label="Save" style={iconBtn} onClick={save}><Check size={14} /></button>
    </span>
  );
}

export function AddInline({ placeholder, onAdd }: { placeholder: string; onAdd: (name: string) => void }) {
  const [v, setV] = useState('');
  const add = () => { const name = v.trim(); if (name) { onAdd(name); setV(''); } };
  return (
    <div style={{ display: 'flex', gap: 6, maxWidth: 420 }}>
      <input style={{ ...input, padding: '5px 9px', fontSize: 13 }} value={v} placeholder={placeholder} maxLength={255}
        onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} aria-label={placeholder} />
      <button type="button" aria-label={placeholder} style={{ ...iconBtn, border: '1px solid var(--border-default)' }} onClick={add}><Plus size={14} /></button>
    </div>
  );
}

export function BankLink({ label, onLink, onUnlink, search }: {
  label: string | null;
  onLink: (id: number) => void;
  onUnlink: () => void;
  /** Question-bank subtopics matching the text, in the syllabus's exam type. */
  search: (q: string) => Promise<{ id: number; label: string }[]>;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<{ id: number; label: string }[]>([]);
  const timer = useRef<number>();

  useEffect(() => {
    window.clearTimeout(timer.current);
    if (q.trim().length < 2) { setResults([]); return; }
    timer.current = window.setTimeout(() => {
      search(q.trim()).then(setResults).catch(() => setResults([]));
    }, 250);
    return () => window.clearTimeout(timer.current);
  }, [q, search]);

  if (label && !open) {
    return (
      <span title={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, padding: '2px 8px', borderRadius: 999, backgroundColor: '#ECFDF5', color: '#047857', maxWidth: 260 }}>
        <Link2 size={12} /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        <button type="button" aria-label="Change link" style={{ ...iconBtn, width: 18, height: 18, color: 'inherit' }} onClick={() => setOpen(true)}><Edit2 size={11} /></button>
        <button type="button" aria-label="Unlink" style={{ ...iconBtn, width: 18, height: 18, color: 'inherit' }} onClick={onUnlink}><Link2Off size={11} /></button>
      </span>
    );
  }
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, padding: '2px 8px', borderRadius: 999, border: '1px dashed var(--border-default)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}>
        <Link2 size={12} /> Link to bank
      </button>
    );
  }
  return (
    <span style={{ position: 'relative', display: 'inline-block', width: 260 }}>
      <input autoFocus style={{ ...input, padding: '4px 8px', fontSize: 12.5 }} placeholder="Search bank subtopics" value={q}
        onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && setOpen(false)} onBlur={() => window.setTimeout(() => setOpen(false), 200)} />
      {results.length > 0 && (
        <span role="listbox" style={{ ...card, position: 'absolute', zIndex: 20, top: '100%', left: 0, right: 0, marginTop: 4, maxHeight: 220, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,.12)' }}>
          {results.map((r) => (
            <button type="button" role="option" aria-selected={false} key={r.id}
              onMouseDown={(e) => { e.preventDefault(); onLink(r.id); setOpen(false); setQ(''); }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', fontSize: 12.5, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-primary)' }}>
              {r.label}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}

export function ImportPanel({ onImport }: { onImport: (text: string, mode: 'merge' | 'replace') => Promise<void> }) {
  const [text, setText] = useState('');
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async () => {
    if (mode === 'replace' && !window.confirm("Replace the whole syllabus? Students' coverage of removed subtopics is deleted.")) return;
    setBusy(true);
    setErr(null);
    try { await onImport(text, mode); setText(''); } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <div style={{ border: '1px dashed var(--border-default)', borderRadius: 'var(--radius)', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <textarea style={{ ...input, minHeight: 140, fontFamily: 'ui-monospace, monospace', fontSize: 12.5 }} placeholder={IMPORT_HINT}
        value={text} onChange={(e) => setText(e.target.value)} aria-label="Syllabus to import" />
      {err && <div role="alert" style={{ color: '#B91C1C', fontSize: 13 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 14, fontSize: 13 }}>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="radio" checked={mode === 'merge'} onChange={() => setMode('merge')} /> Add to the current syllabus
          </label>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="radio" checked={mode === 'replace'} onChange={() => setMode('replace')} /> Replace it
          </label>
        </div>
        <button type="button" style={solidBtn} disabled={busy || !text.trim()} onClick={submit}>{busy ? 'Importing…' : 'Import'}</button>
      </div>
    </div>
  );
}
