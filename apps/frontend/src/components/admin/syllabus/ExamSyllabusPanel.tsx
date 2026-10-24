import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, ArrowDown, ArrowLeft, ArrowUp, BookOpenCheck, Plus, Trash2, Upload } from 'lucide-react';
import {
  ExamSyllabusAdmin, PlannerLevel, PlannerSubjectNode, SyllabusStage,
  addPlannerNode, createSyllabus, deletePlannerNode, deleteSyllabus, fetchSyllabusTree, importSyllabus, listSyllabi,
  reorderPlannerNodes, reorderSyllabi, searchBankSubtopics, updatePlannerNode, updateSyllabus,
} from '../../../services/plannerSyllabusAdminService';
import {
  AddInline, BankLink, ImportPanel, InlineName, Row, card, ghostBtn, iconBtn, input, plural,
} from './syllabusEditorParts';

const STAGE_LABEL: Record<SyllabusStage, string> = { prelims: 'Prelims', mains: 'Mains', optional: 'Optional' };

/**
 * Exam Types → Syllabus (its own admin page): an exam type's study syllabi (Prelims, Mains, optionals) that students build plans from,
 * each a subject → topic → subtopic tree. Subtopics can be linked to this exam type's question bank for Practice.
 */
export function ExamSyllabusPanel({ examType, onClose }: {
  examType: { id: number; type: string; name: string };
  /** Back to the Exam Types list. */
  onClose: () => void;
}) {
  const [syllabi, setSyllabi] = useState<ExamSyllabusAdmin[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [tree, setTree] = useState<PlannerSubjectNode[]>([]);
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [optionalName, setOptionalName] = useState('');
  const current = syllabi.find((s) => s.id === selected) || null;

  const loadSyllabi = useCallback(async (pick?: number) => {
    try {
      const list = await listSyllabi(examType.id);
      setSyllabi(list);
      setSelected((cur) => pick ?? (cur && list.some((s) => s.id === cur) ? cur : list[0]?.id ?? null));
    } catch (e: any) {
      setError(e.message);
    }
  }, [examType.id]);

  const loadTree = useCallback(async (id: number | null) => {
    if (!id) { setTree([]); return; }
    try {
      const res = await fetchSyllabusTree(id);
      setTree(res.subjects);
      setSyllabi((cur) => cur.map((s) => (s.id === id ? res.syllabus : s)));
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  useEffect(() => { loadSyllabi(); }, [loadSyllabi]);
  useEffect(() => { loadTree(selected); setOpen({}); setShowImport(false); }, [selected, loadTree]);

  const run = async (fn: () => Promise<unknown>, done?: string) => {
    setError(null);
    setNotice(null);
    try {
      await fn();
      if (done) setNotice(done);
      await loadTree(selected);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const move = (level: PlannerLevel, ids: number[], index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    const next = ids.slice();
    [next[index], next[j]] = [next[j], next[index]];
    run(() => reorderPlannerNodes(level, next));
  };

  const add = async (stage: SyllabusStage) => {
    setError(null);
    setNotice(null);
    try {
      const s = await createSyllabus(examType.id, stage, stage === 'optional' ? optionalName.trim() : undefined);
      setOptionalName('');
      setNotice(`${s.label} added. Now add its subjects, or use Bulk import.`);
      await loadSyllabi(s.id);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const patch = async (p: Parameters<typeof updateSyllabus>[1], done: string) => {
    if (!current) return;
    setError(null);
    setNotice(null);
    try { await updateSyllabus(current.id, p); setNotice(done); await loadSyllabi(); } catch (e: any) { setError(e.message); }
  };

  const moveSyllabus = async (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= syllabi.length) return;
    const ids = syllabi.map((s) => s.id);
    [ids[index], ids[j]] = [ids[j], ids[index]];
    try { await reorderSyllabi(examType.id, ids); await loadSyllabi(); } catch (e: any) { setError(e.message); }
  };

  const remove = async () => {
    if (!current) return;
    if (!window.confirm(`Delete ${current.label} and its whole syllabus? Students' plans lose its topics and their coverage of it is deleted.`)) return;
    try { await deleteSyllabus(current.id); setNotice(`${current.label} deleted.`); setSelected(null); await loadSyllabi(); }
    catch (e: any) { setError(e.message); }
  };

  const has = (stage: SyllabusStage) => syllabi.some((s) => s.stage === stage);
  const bankSearch = useCallback((q: string) => (current ? searchBankSubtopics(current.id, q) : Promise.resolve([])), [current?.id]);

  return (
    <div style={{ ...card, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <button type="button" onClick={onClose} style={{ ...ghostBtn, alignSelf: 'flex-start', padding: '6px 12px' }}>
        <ArrowLeft size={14} /> Back to Exam Types
      </button>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
            <BookOpenCheck size={18} color="#2563EB" /> Syllabus: {examType.name} ({examType.type.toUpperCase()})
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', maxWidth: 680 }}>
            The syllabi students build study plans from. Link a subtopic to this exam's question bank so its Practice button opens exactly those questions.
          </p>
        </div>
      </div>

      {notice && (
        <div role="status" style={{ ...card, padding: '9px 12px', borderColor: '#A7F3D0', backgroundColor: '#ECFDF5', color: '#047857', fontSize: 13 }}>{notice}</div>
      )}
      {error && (
        <div role="alert" style={{ ...card, padding: '9px 12px', borderColor: '#FECACA', backgroundColor: '#FEF2F2', color: '#B91C1C', fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}>
          <AlertCircle size={15} /> {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {syllabi.map((s, i) => (
          <span key={s.id} style={{ display: 'inline-flex', alignItems: 'center' }}>
            <button type="button" aria-pressed={s.id === selected} onClick={() => setSelected(s.id)}
              style={{
                padding: '6px 12px', borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: s.is_active ? 1 : 0.55,
                border: `1px solid ${s.id === selected ? '#2563EB' : 'var(--border-default)'}`,
                backgroundColor: s.id === selected ? '#EFF6FF' : 'var(--bg-card)', color: s.id === selected ? '#1D4ED8' : 'var(--text-secondary)',
              }}>
              {s.stage === 'optional' ? `Optional: ${s.name}` : s.name}{!s.is_active && ' (hidden)'}
              <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 6 }}>{s.subtopics}</span>
            </button>
            {s.id === selected && syllabi.length > 1 && (
              <>
                <button type="button" aria-label={`Move ${s.label} left`} style={{ ...iconBtn, width: 22 }} disabled={i === 0} onClick={() => moveSyllabus(i, -1)}><ArrowUp size={12} style={{ transform: 'rotate(-90deg)' }} /></button>
                <button type="button" aria-label={`Move ${s.label} right`} style={{ ...iconBtn, width: 22 }} disabled={i === syllabi.length - 1} onClick={() => moveSyllabus(i, 1)}><ArrowDown size={12} style={{ transform: 'rotate(-90deg)' }} /></button>
              </>
            )}
          </span>
        ))}
        {!has('prelims') && <button type="button" style={{ ...ghostBtn, padding: '6px 12px' }} onClick={() => add('prelims')}><Plus size={13} /> Prelims</button>}
        {!has('mains') && <button type="button" style={{ ...ghostBtn, padding: '6px 12px' }} onClick={() => add('mains')}><Plus size={13} /> Mains</button>}
        <span style={{ display: 'inline-flex', gap: 4 }}>
          <input style={{ ...input, width: 170, padding: '5px 9px', fontSize: 12.5 }} value={optionalName} maxLength={120}
            placeholder="Optional subject name" aria-label="Optional subject name" onChange={(e) => setOptionalName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && optionalName.trim() && add('optional')} />
          <button type="button" style={{ ...ghostBtn, padding: '6px 10px' }} disabled={!optionalName.trim()} onClick={() => add('optional')}><Plus size={13} /> Optional</button>
        </span>
      </div>

      {!syllabi.length && <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text-muted)' }}>No syllabus yet. Add Prelims, Mains or an optional subject.</p>}

      {current && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div>
              {current.stage === 'optional'
                ? <InlineName value={current.name} size={15} onSave={(name) => patch({ name }, 'Renamed.')} />
                : <b style={{ fontSize: 15 }}>{STAGE_LABEL[current.stage]}</b>}
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Students see "{current.label}" · {plural(current.subjects, 'subject')} · {plural(current.subtopics, 'subtopic')}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Answer writing (on for Mains and optionals) and hide/show stay in the API; not offered here for now */}
              <button type="button" style={ghostBtn} onClick={() => setShowImport((v) => !v)}><Upload size={14} /> Bulk import</button>
              <button type="button" style={{ ...ghostBtn, color: '#B91C1C' }} onClick={remove}><Trash2 size={14} /> Delete</button>
            </div>
          </div>

          {showImport && (
            <ImportPanel
              onImport={async (text, mode) => {
                setNotice(null);
                const res = await importSyllabus(current.id, text, mode);
                const a = res.added;
                setNotice(`Imported: ${plural(a.subjects, 'subject')}, ${plural(a.topics, 'topic')}, ${plural(a.subtopics, 'subtopic')} added.`);
                setShowImport(false);
                await loadTree(current.id);
              }}
            />
          )}

          {!tree.length && <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text-muted)' }}>No subjects yet. Add one below or use Bulk import.</p>}

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
                                search={bankSearch}
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
          <AddInline placeholder="Add subject" onAdd={(name) => run(() => addPlannerNode('subjects', current.id, name), `"${name}" added.`)} />
        </div>
      )}
    </div>
  );
}
