import React from 'react';
import type { ExamSyllabus, PlannerExams } from '../../../services/plannerService';
import { Chip, input } from './plannerUi';

/** Every syllabus, flattened. */
export const allSyllabi = (exams: PlannerExams): ExamSyllabus[] => exams.exam_types.flatMap((t) => t.syllabi);

/** A syllabus id that exists: the wanted one, else the default, else the first. */
export function validSyllabusId(exams: PlannerExams, wanted?: number | null): number | null {
  const ids = allSyllabi(exams).map((s) => s.id);
  if (wanted && ids.includes(wanted)) return wanted;
  if (exams.default_syllabus_id && ids.includes(exams.default_syllabus_id)) return exams.default_syllabus_id;
  return ids[0] ?? null;
}

/** Choose the exam (UPSC, MPSC…), then its syllabus: Prelims, Mains, or an optional subject. */
export function ExamPicker({ exams, value, onChange }: { exams: PlannerExams; value: number | null; onChange: (id: number) => void }) {
  const current = allSyllabi(exams).find((s) => s.id === value);
  const type = exams.exam_types.find((t) => t.id === current?.exam_type_id) || exams.exam_types[0];
  if (!type) return <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>No syllabus has been set up yet.</p>;
  const main = type.syllabi.filter((s) => s.stage !== 'optional');
  const optionals = type.syllabi.filter((s) => s.stage === 'optional');
  const onOptional = current?.stage === 'optional';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {exams.exam_types.length > 1 && (
        <div role="group" aria-label="Exam" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {exams.exam_types.map((t) => (
            <Chip key={t.id} on={t.id === type.id} onClick={() => t.id !== type.id && t.syllabi[0] && onChange(t.syllabi[0].id)}>
              {t.code.toUpperCase()}
            </Chip>
          ))}
        </div>
      )}
      <div role="group" aria-label="Syllabus" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {main.map((s) => <Chip key={s.id} on={s.id === value} onClick={() => onChange(s.id)}>{s.label}</Chip>)}
        {optionals.length > 0 && (
          <Chip on={onOptional} onClick={() => !onOptional && onChange(optionals[0].id)}>Optional subject</Chip>
        )}
        {onOptional && optionals.length > 1 && (
          <select aria-label="Optional subject" style={{ ...input, padding: '5px 8px', fontSize: 13 }} value={value ?? ''}
            onChange={(e) => onChange(Number(e.target.value))}>
            {optionals.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        )}
        {onOptional && optionals.length === 1 && <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{optionals[0].name}</span>}
      </div>
    </div>
  );
}
