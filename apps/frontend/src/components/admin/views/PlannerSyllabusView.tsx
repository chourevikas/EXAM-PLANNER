import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle, ArrowDown, ArrowUp, BookOpenCheck, ChevronRight, Check, Edit2, Link2, Link2Off, Plus, Trash2, Upload, X,
} from 'lucide-react';
import { useBreakpoint } from '../../../hooks/useBreakpoint';
import {
  PlannerExamAdmin, PlannerExamInput, PlannerLevel, PlannerSubjectNode,
  addPlannerNode, createPlannerExam, deletePlannerExam, deletePlannerNode, fetchPlannerTree, importPlannerSyllabus,
  listPlannerExams, reorderPlannerExams, reorderPlannerNodes, searchBankSubtopics, updatePlannerExam, updatePlannerNode,
} from '../../../services/plannerSyllabusAdminService';

const card: React.CSSProperties = {
  backgroundColor: 'var(--bg-card)',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius)',
};

const input: React.CSSProperties = {
  width: '100%',
  padding: '8px 11px',
  borderRadius: 'var(--radius)',
  border: '1px solid var(--border-default)',
  backgroundColor: 'var(--bg-subtle)',
  color: 'var(--text-primary)',
  fontSize: 13.5,
  boxSizing: 'border-box',
};

const iconBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, padding: 0,
  borderRadius: 6, border: '1px solid transparent', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer',
};

const solidBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 'var(--radius)', border: 'none',
  backgroundColor: 'var(--primary-red)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
};

const ghostBtn: React.CSSProperties = {
  ...solidBtn, backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-default)',
};

const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;

const EMPTY_EXAM: PlannerExamInput = { code: '', label: '', group: 'main', answer_writing: false, is_active: true };

const IMPORT_HINT = `One subject per line:
Polity|Constitution:Preamble,Fundamental Rights;Parliament:Lok Sabha,Rajya Sabha
Economy|Banking:RBI,NPAs

or JSON: {"Polity": {"Constitution": ["Preamble", "Fundamental Rights"]}}`;

/** Admin: the Study Planner syllabus. Exams students plan for, and their subjects → topics → subtopics. */
export function PlannerSyllabusView() {
  const { isTabletOrBelow } = useBreakpoint();
  const [exams, setExams] = useState<PlannerExamAdmin[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [tree, setTree] = useState<PlannerSubjectNode[]>([]);
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [examForm, setExamForm] = useState<PlannerExamInput | null>(null);
  const [showImport, setShowImport] = useState(false);

  const exam = exams.find((e) => e.id === selected) || null;

  const loadExams = useCallback(async () => {
    try {
      const list = await listPlannerExams();
      setExams(list);
      setSelected((cur) => (cur && list.some((e) => e.id === cur) ? cur : list[0]?.id ?? null));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTree = useCallback(async (id: number | null) => {
    if (!id) { setTree([]); return; }
    try {
      const res = await fetchPlannerTree(id);
      setTree(res.subjects);
      setExams((cur) => cur.map((e) => (e.id === id ? res.exam : e)));
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  useEffect(() => { loadExams(); }, [loadExams]);
  useEffect(() => { loadTree(selected); }, [selected, loadTree]);

  /** Run a change, show what happened, then reload the tree. */
  const run = async (fn: () => Promise<unknown>, done?: string) => {
    setError(null);
    setNotice(null);
    try {
      await fn();
      if (done) setNotice(done);
      await loadTree(selected);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const move = (level: PlannerLevel, ids: number[], index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    const next = ids.slice();
    [next[index], next[j]] = [next[j], next[index]];
    run(() => reorderPlannerNodes(level, next));
  };

  const moveExam = async (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= exams.length) return;
    const ids = exams.map((e) => e.id);
    [ids[index], ids[j]] = [ids[j], ids[index]];
    try { await reorderPlannerExams(ids); await loadExams(); } catch (err: any) { setError(err.message); }
  };

  const saveExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examForm) return;
    setError(null);
    setNotice(null);
    try {
      const created = await createPlannerExam(examForm);
      setExamForm(null);
      setNotice(`"${created.label}" added. Now add its subjects, or import a syllabus.`);
      await loadExams();
      setSelected(created.id);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const patchExam = async (patch: Parameters<typeof updatePlannerExam>[1], done: string) => {
    if (!exam) return;
    setError(null);
    setNotice(null);
    try { await updatePlannerExam(exam.id, patch); setNotice(done); await loadExams(); } catch (err: any) { setError(err.message); }
  };

  const removeExam = async () => {
    if (!exam) return;
    if (!window.confirm(`Delete "${exam.label}" and its whole syllabus? Students' coverage of it is deleted too.`)) return;
    try { await deletePlannerExam(exam.id); setNotice(`"${exam.label}" deleted.`); setSelected(null); await loadExams(); }
    catch (err: any) { setError(err.message); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ ...card, padding: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <BookOpenCheck size={20} color="#2563EB" /> Planner Syllabus
          </h2>
          <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text-muted)' }}>
            The exams students can build a study plan for, and their subjects, topics and subtopics. Link a subtopic to the
            question bank so its Practice button and weak-topic data work.
          </p>
        </div>
        <button type="button" style={solidBtn} onClick={() => { setError(null); setExamForm({ ...EMPTY_EXAM }); }}>
          <Plus size={16} /> New exam
        </button>
      </div>

      {notice && (
        <div role="status" style={{ ...card, padding: '10px 14px', borderColor: '#A7F3D0', backgroundColor: '#ECFDF5', color: '#047857', fontSize: 13.5, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <span>{notice}</span>
          <button type="button" aria-label="Dismiss" style={{ ...iconBtn, width: 20, height: 20, color: 'inherit' }} onClick={() => setNotice(null)}><X size={14} /></button>
        </div>
      )}
      {error && (
        <div role="alert" style={{ ...card, padding: '10px 14px', borderColor: '#FECACA', backgroundColor: '#FEF2F2', color: '#B91C1C', fontSize: 13.5, display: 'flex', gap: 8, alignItems: 'center' }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {examForm && (
        <form onSubmit={saveExam} style={{ ...card, padding: 16, display: 'grid', gap: 12, gridTemplateColumns: isTabletOrBelow ? '1fr' : '1fr 1fr 160px', alignItems: 'end' }}>
          <label style={{ fontSize: 13, fontWeight: 700 }}>
            Name students see
            <input style={{ ...input, marginTop: 6 }} required maxLength={120} value={examForm.label} placeholder="e.g. MPSC Rajyaseva Prelims"
              onChange={(e) => setExamForm({ ...examForm, label: e.target.value })} />
          </label>
          <label style={{ fontSize: 13, fontWeight: 700 }}>
            Code (cannot change later)
            <input style={{ ...input, marginTop: 6 }} required maxLength={50} value={examForm.code} placeholder="e.g. mpsc_prelims"
              onChange={(e) => setExamForm({ ...examForm, code: e.target.value })} />
          </label>
          <label style={{ fontSize: 13, fontWeight: 700 }}>
            Type
            <select style={{ ...input, marginTop: 6 }} value={examForm.group} onChange={(e) => setExamForm({ ...examForm, group: e.target.value as 'main' | 'optional' })}>
              <option value="main">Exam</option>
              <option value="optional">Optional subject</option>
            </select>
          </label>
          <label style={{ fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={examForm.answer_writing} onChange={(e) => setExamForm({ ...examForm, answer_writing: e.target.checked })} />
            Mains-style: add a daily answer-writing task to plans
          </label>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', gridColumn: isTabletOrBelow ? undefined : '2 / 4' }}>
            <button type="button" style={ghostBtn} onClick={() => setExamForm(null)}>Cancel</button>
            <button type="submit" style={solidBtn}>Add exam</button>
          </div>
        </form>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: isTabletOrBelow ? '1fr' : '280px 1fr', gap: 16, alignItems: 'start' }}>
        <div style={{ ...card, padding: 8 }}>
          {loading && <div style={{ padding: 12, color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>}
          {!loading && exams.length === 0 && <div style={{ padding: 12, color: 'var(--text-muted)', fontSize: 13 }}>No exams yet.</div>}
          {exams.map((e, i) => (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 2, borderRadius: 8, backgroundColor: e.id === selected ? 'var(--bg-subtle)' : 'transparent' }}>
              <button type="button" onClick={() => setSelected(e.id)} aria-pressed={e.id === selected}
                style={{ flex: 1, textAlign: 'left', padding: '9px 10px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-primary)', opacity: e.is_active ? 1 : 0.55 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>{e.label}{!e.is_active && ' (hidden)'}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {e.group === 'optional' ? 'Optional · ' : ''}{plural(e.subjects, 'subject')} · {plural(e.subtopics, 'subtopic')}
                </div>
              </button>
              <button type="button" aria-label={`Move ${e.label} up`} style={iconBtn} disabled={i === 0} onClick={() => moveExam(i, -1)}><ArrowUp size={14} /></button>
              <button type="button" aria-label={`Move ${e.label} down`} style={iconBtn} disabled={i === exams.length - 1} onClick={() => moveExam(i, 1)}><ArrowDown size={14} /></button>
            </div>
          ))}
        </div>

        {exam && (
          <div style={{ ...card, padding: 16, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0 }}>
                <InlineName value={exam.label} size={17} onSave={(label) => patchExam({ label }, 'Exam renamed.')} />
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Code: {exam.code}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <label style={{ fontSize: 12.5, display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="checkbox" checked={exam.answer_writing}
                    onChange={(e) => patchExam({ answer_writing: e.target.checked }, e.target.checked ? 'Plans will include answer writing.' : 'Answer writing removed from new plans.')} />
                  Answer writing
                </label>
                <button type="button" style={ghostBtn} onClick={() => patchExam({ is_active: !exam.is_active }, exam.is_active ? 'Hidden from students.' : 'Visible to students.')}>
                  {exam.is_active ? 'Hide from students' : 'Show to students'}
                </button>
                <button type="button" style={ghostBtn} onClick={() => setShowImport((v) => !v)}><Upload size={14} /> Bulk import</button>
                <button type="button" style={{ ...ghostBtn, color: '#B91C1C' }} onClick={removeExam}><Trash2 size={14} /> Delete</button>
              </div>
            </div>

            {showImport && (
              <ImportPanel
                onImport={async (text, mode) => {
                  setNotice(null);
                  const res = await importPlannerSyllabus(exam.id, text, mode);
                  const a = res.added;
                  setNotice(`Imported: ${plural(a.subjects, 'subject')}, ${plural(a.topics, 'topic')}, ${plural(a.subtopics, 'subtopic')} added.`);
                  setShowImport(false);
                  await loadTree(exam.id);
                }}
              />
            )}

            {tree.length === 0 && <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text-muted)' }}>No subjects yet. Add one below or use Bulk import.</p>}

            {tree.map((s, si) => (
              <div key={s.id} style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius)' }}>
                <Row
                  name={s.name}
                  bold
                  expanded={!!open[s.id]}
                  onToggle={() => setOpen((o) => ({ ...o, [s.id]: !o[s.id] }))}
                  meta={`${plural(s.topics.length, 'topic')} · ${plural(s.topics.reduce((a, t) => a + t.subtopics.length, 0), 'subtopic')}`}
                  onRename={(name) => run(() => updatePlannerNode('subjects', s.id, { name }))}
                  onUp={si > 0 ? () => move('subjects', tree.map((x) => x.id), si, -1) : undefined}
                  onDown={si < tree.length - 1 ? () => move('subjects', tree.map((x) => x.id), si, 1) : undefined}
                  onDelete={() => window.confirm(`Delete the subject "${s.name}" and everything in it?`) && run(() => deletePlannerNode('subjects', s.id), `"${s.name}" deleted.`)}
                />
                {open[s.id] && (
                  <div style={{ padding: '4px 10px 10px 26px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {s.topics.map((t, ti) => (
                      <div key={t.id}>
                        <Row
                          name={t.name}
                          onRename={(name) => run(() => updatePlannerNode('topics', t.id, { name }))}
                          onUp={ti > 0 ? () => move('topics', s.topics.map((x) => x.id), ti, -1) : undefined}
                          onDown={ti < s.topics.length - 1 ? () => move('topics', s.topics.map((x) => x.id), ti, 1) : undefined}
                          onDelete={() => window.confirm(`Delete the topic "${t.name}" and its subtopics?`) && run(() => deletePlannerNode('topics', t.id), `"${t.name}" deleted.`)}
                        />
                        <div style={{ paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {t.subtopics.map((st, sti) => (
                            <Row
                              key={st.id}
                              small
                              name={st.name}
                              onRename={(name) => run(() => updatePlannerNode('subtopics', st.id, { name }))}
                              onUp={sti > 0 ? () => move('subtopics', t.subtopics.map((x) => x.id), sti, -1) : undefined}
                              onDown={sti < t.subtopics.length - 1 ? () => move('subtopics', t.subtopics.map((x) => x.id), sti, 1) : undefined}
                              onDelete={() => run(() => deletePlannerNode('subtopics', st.id), `"${st.name}" deleted.`)}
                              extra={
                                <BankLink
                                  label={st.bank_label}
                                  onLink={(id) => run(() => updatePlannerNode('subtopics', st.id, { bank_subtopic_id: id }), 'Linked to the question bank.')}
                                  onUnlink={() => run(() => updatePlannerNode('subtopics', st.id, { clear_bank: true }), 'Unlinked.')}
                                />
                              }
                            />
                          ))}
                          <AddInline placeholder="Add subtopic" onAdd={(name) => run(() => addPlannerNode('subtopics', t.id, name))} />
                        </div>
                      </div>
                    ))}
                    <AddInline placeholder="Add topic" onAdd={(name) => run(() => addPlannerNode('topics', s.id, name))} />
                  </div>
                )}
              </div>
            ))}
            <AddInline placeholder="Add subject" onAdd={(name) => run(() => addPlannerNode('subjects', exam.id, name), `"${name}" added.`)} />
          </div>
        )}
      </div>
    </div>
  );
}

function Row(props: {
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

function InlineName({ value, onSave, size = 14, weight = 700 }: { value: string; onSave: (v: string) => void; size?: number; weight?: number }) {
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

function AddInline({ placeholder, onAdd }: { placeholder: string; onAdd: (name: string) => void }) {
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

function BankLink({ label, onLink, onUnlink }: { label: string | null; onLink: (id: number) => void; onUnlink: () => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<{ id: number; label: string }[]>([]);
  const timer = useRef<number>();

  useEffect(() => {
    window.clearTimeout(timer.current);
    if (q.trim().length < 2) { setResults([]); return; }
    timer.current = window.setTimeout(() => {
      searchBankSubtopics(q.trim()).then(setResults).catch(() => setResults([]));
    }, 250);
    return () => window.clearTimeout(timer.current);
  }, [q]);

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

function ImportPanel({ onImport }: { onImport: (text: string, mode: 'merge' | 'replace') => Promise<void> }) {
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
