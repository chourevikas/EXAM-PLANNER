import React from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { CheckCircle2, AlertTriangle } from 'lucide-react';

/**
 * Plain-language summary shown at the top of both the exam-wise and cumulative reports.
 * Answers "how did I do, and what should I do next" on one screen; the full metric
 * cards stay available below it in the collapsed "Detailed analysis" section.
 */

type AnyRecord = Record<string, any>;

interface ReportSummaryProps {
  report: AnyRecord;
  isCumulative: boolean;
}

const num = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const clampPct = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

const card: React.CSSProperties = {
  backgroundColor: 'var(--bg-card)',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius)',
  padding: 20,
};

const sectionTitle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  margin: '0 0 12px 0',
};

function readinessColor(score: number): string {
  if (score >= 70) return '#059669';
  if (score >= 50) return '#2563EB';
  if (score >= 30) return '#D97706';
  return '#DC2626';
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: color || 'var(--text-primary)', lineHeight: 1.2 }}>{value}</div>
      {sub && <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function SkillBar({ label, value, hint }: { label: string; value: number; hint: string }) {
  const pct = clampPct(value);
  const color = readinessColor(pct);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(110px, 150px) 1fr 40px', gap: 12, alignItems: 'center' }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{label}</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{hint}</div>
      </div>
      <div style={{ height: 10, borderRadius: 5, backgroundColor: 'var(--bg-hover)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', backgroundColor: color, borderRadius: 5 }} />
      </div>
      <div style={{ fontSize: 15, fontWeight: 800, color, textAlign: 'right' }}>{pct}</div>
    </div>
  );
}

function PointList({ title, items, tone }: { title: string; items: string[]; tone: 'good' | 'fix' }) {
  const Icon = tone === 'good' ? CheckCircle2 : AlertTriangle;
  const color = tone === 'good' ? '#059669' : '#D97706';
  return (
    <div style={{ ...card, flex: '1 1 260px' }}>
      <h3 style={{ ...sectionTitle, color }}>{title}</h3>
      {items.length === 0 ? (
        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Nothing to flag yet.</div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map((t) => (
            <li key={t} style={{ display: 'flex', gap: 8, fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.45 }}>
              <Icon size={16} color={color} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface SubjectRow {
  name: string;
  accuracy: number;
  attempted: number;
}

function subjectRows(list: AnyRecord[] | undefined): SubjectRow[] {
  return (list || [])
    .map((s) => ({
      name: String(s.taxonomy_name || s.name || s.subject_name || ''),
      accuracy: num(s.accuracy_percentage),
      attempted: num(s.attempted_questions ?? s.attempted, 0),
    }))
    .filter((s) => s.name && s.attempted > 0);
}

/** Up to 3 strengths and 3 things to fix, derived only from measured values. */
function buildPoints(opts: {
  subjects: SubjectRow[];
  gti: number;
  oeei: number;
  negativeMarks: number;
  wrongCount: number;
  timeStarved: number;
  pacingStatus: string;
  calibration?: AnyRecord;
}) {
  const good: string[] = [];
  const fix: string[] = [];
  const sorted = [...opts.subjects].sort((a, b) => b.accuracy - a.accuracy);

  sorted
    .filter((s) => s.accuracy >= 70)
    .slice(0, 2)
    .forEach((s) => good.push(`${s.name}: ${Math.round(s.accuracy)}% accuracy`));
  if (opts.gti < 0.3) good.push('Few blind guesses — you answer after reading properly');
  if (opts.oeei >= 0.7) good.push('Good at ruling out wrong options');
  const cal = opts.calibration;
  if (cal?.calibration_status === 'WELL_CALIBRATED') {
    good.push(`Your "sure" answers were ${Math.round(num(cal.by_level?.SURE?.accuracy_pct))}% right — trust them`);
  }

  [...sorted]
    .reverse()
    .filter((s) => s.accuracy < 50)
    .slice(0, 2)
    .forEach((s) => fix.push(`${s.name}: ${Math.round(s.accuracy)}% accuracy — revise this first`));
  if (opts.negativeMarks >= 5) {
    fix.push(`${opts.wrongCount} wrong answers cost you ${opts.negativeMarks.toFixed(1)} marks — skip when unsure`);
  }
  if (cal && num(cal.sure_but_wrong_count) >= 2) {
    fix.push(`${num(cal.sure_but_wrong_count)} answers you were sure about were wrong — recheck these topics`);
  }
  if (cal && num(cal.by_level?.GUESS?.answered) >= 3 && num(cal.guess_net_marks) < 0) {
    fix.push(`Guessing cost you ${Math.abs(num(cal.guess_net_marks)).toFixed(1)} marks — skip questions you would guess`);
  }
  if (opts.gti >= 0.5) fix.push('Many answers were too quick to be read fully — slow down');
  if (opts.timeStarved > 0) fix.push(`${opts.timeStarved} questions left because time ran out`);
  if (['EARLY_BOTTLENECK_OVERTHINK', 'LATE_EXAM_PANIC_RUSH', 'TIME_EXHAUSTION_OVERTHOUGHT'].includes(opts.pacingStatus)) {
    fix.push('Uneven pacing — spread your time more evenly across the paper');
  }

  return { good: good.slice(0, 3), fix: fix.slice(0, 3) };
}

const CONFIDENCE_LEVELS: { key: string; label: string; color: string }[] = [
  { key: 'SURE', label: 'Sure', color: '#047857' },
  { key: 'FIFTY_FIFTY', label: '50-50', color: '#B45309' },
  { key: 'GUESS', label: 'Guess', color: '#B91C1C' },
];

/** Accuracy and net marks for each self-reported confidence level. Hidden until answers are rated. */
function ConfidenceCard({ calibration }: { calibration?: AnyRecord }) {
  if (!calibration || num(calibration.rated_count) === 0) return null;
  return (
    <section style={card}>
      <h3 style={sectionTitle}>Confidence check</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16 }}>
        {CONFIDENCE_LEVELS.map(({ key, label, color }) => {
          const lvl: AnyRecord = calibration.by_level?.[key] || {};
          const answered = num(lvl.answered);
          const net = num(lvl.net_marks);
          return (
            <div key={key} style={{ borderLeft: `3px solid ${color}`, paddingLeft: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color }}>{label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>
                {answered ? `${Math.round(num(lvl.accuracy_pct))}% right` : '—'}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                {answered ? `${answered} ${answered === 1 ? 'answer' : 'answers'} · ${net >= 0 ? '+' : ''}${net.toFixed(1)} marks` : 'Not used'}
              </div>
            </div>
          );
        })}
      </div>
      <p style={{ margin: '12px 0 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
        {calibration.calibration_label}
        {num(calibration.rating_coverage_pct) < 100 ? ` · You rated ${Math.round(num(calibration.rating_coverage_pct))}% of your answers.` : ''}
      </p>
    </section>
  );
}

const ANSWER_ROUNDS: { key: string; label: string; color: string }[] = [
  { key: 'round_1', label: 'Round 1 (first pass)', color: '#1D4ED8' },
  { key: 'round_2', label: 'Round 2 (came back)', color: '#7C3AED' },
];

/** Answers given on the first visit vs after skipping and returning. Hidden for reports without round data. */
function RoundsCard({ rounds }: { rounds?: AnyRecord }) {
  if (!rounds || num(rounds.tracked_count) === 0) return null;
  const cameBack = num(rounds.round_2?.answered);
  return (
    <section style={card}>
      <h3 style={sectionTitle}>Rounds</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16 }}>
        {ANSWER_ROUNDS.map(({ key, label, color }) => {
          const r: AnyRecord = rounds[key] || {};
          const answered = num(r.answered);
          const net = num(r.net_marks);
          return (
            <div key={key} style={{ borderLeft: `3px solid ${color}`, paddingLeft: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color }}>{label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>
                {answered} {answered === 1 ? 'question' : 'questions'}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                {answered ? `${Math.round(num(r.accuracy_pct))}% right · ${net >= 0 ? '+' : ''}${net.toFixed(1)} marks` : 'None'}
              </div>
            </div>
          );
        })}
      </div>
      <p style={{ margin: '12px 0 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
        {cameBack
          ? `You came back and answered ${cameBack} ${cameBack === 1 ? 'question' : 'questions'} you had skipped.`
          : 'You answered every question on your first pass.'}
      </p>
    </section>
  );
}

function ExamSummary({ report }: { report: AnyRecord }) {
  const p2: AnyRecord = report.part_2_exam_macro_scorecard || report.part_3_aggregated_user_report || {};
  const score: AnyRecord = p2.score_summary || {};
  const bench: AnyRecord = p2.upsc_prelims_benchmark || {};
  const icrs: AnyRecord = p2.icrs || p2.overall_exam_readiness || {};
  const breakdown: AnyRecord = icrs.breakdown || {};
  const gti = num(p2.gti?.aggregate);
  const oeei = num(p2.oeei?.oeei_score);
  const unatt: AnyRecord = p2.unattempted_summary || {};
  const tax: AnyRecord = report.part_3_taxonomy_hierarchy_retention || report.part_2_taxonomy_analysis || {};
  const summaryText: string | undefined =
    p2.mentorship_insight?.executive_summary || p2.llm_insight?.executive_summary || report.llm_insight?.executive_summary;

  const total = num(score.total_score);
  const max = num(score.max_score, 200);
  const attempted = num(score.attempted_count);
  const totalQ = attempted + num(score.unattempted_count);
  const readiness = num(icrs.icrs_score);
  const cutoff = num(bench.expected_cutoff_marks, 92);
  const margin = num(bench.cutoff_margin, total - cutoff);

  const { good, fix } = buildPoints({
    subjects: subjectRows(tax.by_subject),
    gti,
    oeei,
    negativeMarks: num(bench.negative_marks_lost),
    wrongCount: num(score.incorrect_count),
    timeStarved: num(unatt.time_starved_count),
    pacingStatus: String(p2.pacing?.pacing_status || ''),
    calibration: p2.confidence_calibration,
  });

  return (
    <>
      <section style={card}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 20 }}>
          <Stat
            label="Score"
            value={`${total.toFixed(1)} / ${max}`}
            sub={`${Math.abs(margin).toFixed(1)} ${margin >= 0 ? 'above' : 'below'} the ${Number(cutoff.toFixed(1))} target`}
            color={margin >= 0 ? '#059669' : 'var(--text-primary)'}
          />
          <Stat label="Accuracy" value={`${Math.round(num(score.accuracy_percentage))}%`} sub={`${num(score.correct_count)} right, ${num(score.incorrect_count)} wrong`} />
          <Stat label="Attempted" value={`${attempted} / ${totalQ}`} sub={`${Math.round(totalQ ? (attempted / totalQ) * 100 : 0)}% of the paper`} />
          <Stat label="Readiness" value={`${Math.round(readiness)} / 100`} sub={icrs.readiness_label} color={readinessColor(readiness)} />
        </div>
        {summaryText && (
          <p style={{ margin: '16px 0 0 0', fontSize: 14, color: 'var(--text-secondary, var(--text-muted))', lineHeight: 1.55 }}>{summaryText}</p>
        )}
      </section>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        <PointList title="What went well" items={good} tone="good" />
        <PointList title="Fix next" items={fix} tone="fix" />
      </div>

      <ConfidenceCard calibration={p2.confidence_calibration} />

      <RoundsCard rounds={p2.answer_rounds} />

      <section style={card}>
        <h3 style={sectionTitle}>Your skills in this exam</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <SkillBar label="Knowledge" hint="How hard the questions you got right were" value={num(breakdown.concept_mastery_irt_pct)} />
          <SkillBar
            label="Exam technique"
            hint="Ruling out options, avoiding blind guesses"
            value={(num(breakdown.tactical_elimination_pct) + num(breakdown.discipline_gti_pct)) / 2}
          />
          <SkillBar
            label="Time & stamina"
            hint="Even pacing, steady accuracy to the end"
            value={(num(breakdown.cognitive_stamina_pct) + num(breakdown.pacing_balance_pct)) / 2}
          />
        </div>
      </section>
    </>
  );
}

function CumulativeSummary({ report }: { report: AnyRecord }) {
  const timeline: AnyRecord[] = report.exam_timeline || [];
  const agg: AnyRecord = report.segregated_aggregates?.all_exams || {};
  const p2: AnyRecord = report.part_2_exam_macro_scorecard || {};
  const tax: AnyRecord = report.part_2_taxonomy_analysis || {};
  const unattTotal = num(report.metadata?.total_unattempted);
  const summaryText: string | undefined = report.ai_cognitive_insights?.executive_summary;

  const n = timeline.length;
  const avgPct = n ? timeline.reduce((s, t) => s + (num(t.total_score) / Math.max(1, num(t.max_possible_score, 200))) * 100, 0) / n : 0;
  const readiness = num(agg.icrs_score);
  const theta = num(agg.irt_theta);
  const gti = num(agg.gti_score);
  const oeei = num(agg.oeei_score);

  const chartData = timeline.map((t, i) => ({
    name: `#${i + 1}`,
    exam: t.exam_name,
    date: t.date_formatted,
    score: Math.round((num(t.total_score) / Math.max(1, num(t.max_possible_score, 200))) * 1000) / 10,
    readiness: num(t.icrs_score),
  }));

  const { good, fix } = buildPoints({
    subjects: subjectRows(tax.by_subject),
    gti,
    oeei,
    negativeMarks: num(p2.upsc_prelims_benchmark?.negative_marks_lost),
    wrongCount: num(p2.score_summary?.incorrect_count),
    timeStarved: 0,
    pacingStatus: '',
    calibration: p2.confidence_calibration,
  });

  return (
    <>
      <section style={card}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 20 }}>
          <Stat label="Exams taken" value={String(n)} sub={`${num(agg.total_questions_attempted)} questions answered`} />
          <Stat label="Average score" value={`${Math.round(avgPct)}%`} sub="of the maximum marks" />
          <Stat label="Accuracy" value={`${Math.round(num(agg.accuracy_percentage))}%`} sub={`${unattTotal} questions skipped in total`} />
          <Stat label="Readiness" value={`${Math.round(readiness)} / 100`} sub={p2.icrs?.readiness_label} color={readinessColor(readiness)} />
        </div>
        {summaryText && (
          <p style={{ margin: '16px 0 0 0', fontSize: 14, color: 'var(--text-secondary, var(--text-muted))', lineHeight: 1.55 }}>{summaryText}</p>
        )}
      </section>

      {chartData.length >= 2 && (
        <section style={card}>
          <h3 style={sectionTitle}>Progress across exams</h3>
          <div style={{ width: '100%', height: 240 }}>
            <ResponsiveContainer>
              <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
                <CartesianGrid stroke="var(--border-color)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
                <Tooltip
                  formatter={(v: any, key: any) => [key === 'score' ? `${v}%` : `${v} / 100`, key === 'score' ? 'Score' : 'Readiness']}
                  labelFormatter={(_l: unknown, payload: readonly any[]) => {
                    const p = payload?.[0]?.payload;
                    return p ? `${p.exam} (${p.date})` : '';
                  }}
                />
                <Line type="linear" dataKey="score" name="Score %" stroke="#2563EB" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="linear" dataKey="readiness" name="Readiness" stroke="#059669" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', gap: 18, fontSize: 12.5, color: 'var(--text-muted)', marginTop: 6 }}>
            <span><span style={{ color: '#2563EB', fontWeight: 800 }}>—</span> Score (% of max)</span>
            <span><span style={{ color: '#059669', fontWeight: 800 }}>—</span> Readiness (0–100)</span>
          </div>
        </section>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        <PointList title="Your strengths" items={good} tone="good" />
        <PointList title="Focus next" items={fix} tone="fix" />
      </div>

      <ConfidenceCard calibration={p2.confidence_calibration} />

      <section style={card}>
        <h3 style={sectionTitle}>Your skills overall</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <SkillBar label="Knowledge" hint="How hard the questions you get right are" value={((theta + 3.5) / 7) * 100} />
          <SkillBar label="Exam technique" hint="Ruling out options, avoiding blind guesses" value={(oeei * 100 + (1 - gti) * 100) / 2} />
          <SkillBar label="Stamina" hint="Steady accuracy to the end of full mocks" value={num(agg.satoi_score)} />
        </div>
      </section>
    </>
  );
}

export function ReportSummary({ report, isCumulative }: ReportSummaryProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {isCumulative ? <CumulativeSummary report={report} /> : <ExamSummary report={report} />}
    </div>
  );
}

export default ReportSummary;
