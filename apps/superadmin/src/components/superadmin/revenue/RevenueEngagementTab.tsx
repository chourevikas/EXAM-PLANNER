import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { IndianRupee, Users, RefreshCw, AlertCircle, Info } from 'lucide-react';
import { useBreakpoint } from '../../../hooks/useBreakpoint';
import { BusinessMetrics, EngagementDay, MetricsRange, fetchBusinessMetrics } from '../../../services/businessMetricsService';
import { MiniChart } from './MiniChart';

const card: React.CSSProperties = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius)',
};

const RANGES: { value: MetricsRange; label: string }[] = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: '365d', label: '12 months' },
];

const inr = (v: number) => `₹${Math.round(v).toLocaleString('en-IN')}`;
const num = (v: number) => v.toLocaleString('en-IN');
const plural = (n: number, one: string, many: string) => `${num(n)} ${n === 1 ? one : many}`;
const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('en-IN', { month: 'short', year: '2-digit' });
};
const dayLabel = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleString('en-IN', { day: 'numeric', month: 'short' });

function Tile({ label, value, hint, testId }: { label: string; value: string; hint?: string; testId?: string }) {
  return (
    <div style={{ ...card, padding: 16, minWidth: 0 }} data-testid={testId}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {hint && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section style={{ ...card, padding: 18, minWidth: 0 }} aria-label={title}>
      <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-main)' }}>{title}</h4>
      {subtitle && <p style={{ margin: '2px 0 12px', fontSize: 12.5, color: 'var(--text-muted)' }}>{subtitle}</p>}
      {children}
    </section>
  );
}

/** A year of days is unreadable; group into weeks (labelled by the week's first day). */
function groupDays(days: EngagementDay[], weekly: boolean): EngagementDay[] {
  if (!weekly) return days;
  const out: EngagementDay[] = [];
  for (let i = 0; i < days.length; i += 7) {
    const chunk = days.slice(i, i + 7);
    out.push({
      date: chunk[0].date,
      active_students: Math.round(chunk.reduce((a, d) => a + d.active_students, 0) / chunk.length),
      new_students: chunk.reduce((a, d) => a + d.new_students, 0),
      questions: chunk.reduce((a, d) => a + d.questions, 0),
      tests: chunk.reduce((a, d) => a + d.tests, 0),
    });
  }
  return out;
}

/** Revenue from paid subscriptions and how students use the platform. */
export function RevenueEngagementTab() {
  const { isMobile } = useBreakpoint();
  const [range, setRange] = useState<MetricsRange>('30d');
  const [data, setData] = useState<BusinessMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTable, setShowTable] = useState(false);

  const load = useCallback(async (r: MetricsRange) => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchBusinessMetrics(r));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(range);
  }, [range, load]);

  const weekly = range === '365d';
  const series = useMemo(() => groupDays(data?.engagement.daily || [], weekly), [data, weekly]);
  const tiles = (min: number): React.CSSProperties => ({
    display: 'grid',
    gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? 150 : min}px, 1fr))`,
    gap: 12,
  });
  const twoCols: React.CSSProperties = { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 };

  const r = data?.revenue;
  const e = data?.engagement;
  const change = r && r.previous_revenue > 0 ? Math.round(((r.revenue - r.previous_revenue) / r.previous_revenue) * 100) : null;
  const langTotal = e ? e.test_languages.en + e.test_languages.hi + e.test_languages.mr : 0;
  const rangeLabel = RANGES.find((x) => x.value === range)?.label;
  const dayPoint = (d: EngagementDay, value: number) => ({
    label: dayLabel(d.date),
    tooltipLabel: weekly ? `Week of ${dayLabel(d.date)}` : dayLabel(d.date),
    value,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px' }}>Revenue &amp; Engagement</h2>
          <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text-muted)' }}>Students only; staff accounts are left out. Days are India time.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div role="radiogroup" aria-label="Period" style={{ display: 'flex', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
            {RANGES.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={range === opt.value}
                onClick={() => setRange(opt.value)}
                style={{
                  padding: '8px 12px',
                  border: 'none',
                  borderRadius: 0,
                  background: range === opt.value ? 'var(--deep-navy)' : 'var(--bg-card)',
                  color: range === opt.value ? '#fff' : 'var(--text-main)',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => load(range)}
            aria-label="Refresh"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-main)', fontWeight: 600, cursor: 'pointer' }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" style={{ ...card, padding: '10px 14px', borderColor: '#FECACA', background: '#FEF2F2', color: '#B91C1C', fontSize: 13.5, display: 'flex', gap: 8, alignItems: 'center' }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}
      {loading && !data && <div style={{ ...card, padding: 24, color: 'var(--text-muted)' }}>Loading…</div>}

      {r && e && (
        <>
          {/* Revenue */}
          <h3 style={{ margin: '4px 0 0', fontSize: 17, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
            <IndianRupee size={17} /> Revenue
          </h3>
          <div role="note" style={{ ...card, padding: '10px 14px', fontSize: 13, color: 'var(--text-muted)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <Info size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>
              Revenue counts paid subscriptions at the price paid, after discounts. Online payments aren&apos;t live yet, so Pro granted from
              Premium Management earns nothing and is counted separately. Refunds will be deducted once online payments go live.
            </span>
          </div>
          <div style={tiles(180)}>
            <Tile testId="tile-revenue" label={`Revenue, last ${rangeLabel?.toLowerCase()}`} value={inr(r.revenue)}
              hint={change === null ? `Previous period ${inr(r.previous_revenue)}` : `${change >= 0 ? '+' : ''}${change}% vs previous ${inr(r.previous_revenue)}`} />
            <Tile testId="tile-mrr" label="Monthly recurring revenue" value={inr(r.mrr)} hint="Active paid plans; yearly ÷ 12" />
            <Tile label="New paid subscriptions" value={num(r.new_paid_subscriptions)} hint={plural(r.paying_students, 'paying student', 'paying students')} />
            <Tile label="Revenue per paying student" value={inr(r.average_revenue_per_paying_student)} />
            <Tile testId="tile-pro" label="Pro students now" value={num(r.pro_students)}
              hint={`Paid ${r.active_subscriptions_by_source.PAYMENT} · Granted ${r.active_subscriptions_by_source.ADMIN_GRANT} · Promo ${r.active_subscriptions_by_source.PROMO}`} />
            <Tile label="Students on a paid plan" value={`${r.paid_conversion_percent}%`} hint={`of ${num(e.total_students)} students`} />
            <Tile label="Discounts given" value={inr(r.discounts_given)} />
            <Tile label="Subscriptions ended" value={num(r.ended_subscriptions)} hint="Expired or cancelled in the period" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr', gap: 12 }}>
            <Panel title="Revenue by month" subtitle="Last 12 months, by the month the subscription was paid">
              <MiniChart
                kind="bar"
                seriesName="Revenue"
                format={inr}
                points={r.monthly.map((m) => ({ label: monthLabel(m.month), value: m.revenue }))}
              />
            </Panel>
            <Panel title="Revenue by plan" subtitle={`Last ${rangeLabel?.toLowerCase()}`}>
              {r.by_plan.length === 0 ? (
                <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text-muted)' }}>No paid subscriptions in this period.</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: 12 }}>
                      <th style={{ padding: '6px 4px' }}>Plan</th>
                      <th style={{ padding: '6px 4px', textAlign: 'right' }}>Paid</th>
                      <th style={{ padding: '6px 4px', textAlign: 'right' }}>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.by_plan.map((p) => (
                      <tr key={p.plan} style={{ borderTop: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '8px 4px' }}>{p.plan}</td>
                        <td style={{ padding: '8px 4px', textAlign: 'right' }}>{num(p.subscriptions)}</td>
                        <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 700 }}>{inr(p.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>
          </div>

          {/* Engagement */}
          <h3 style={{ margin: '8px 0 0', fontSize: 17, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Users size={17} /> Engagement
          </h3>
          <div style={tiles(170)}>
            <Tile testId="tile-dau" label="Active today" value={num(e.active_today)} hint="Answered a question or finished a test" />
            <Tile label="Active, last 7 days" value={num(e.active_7d)} />
            <Tile label="Active, last 30 days" value={num(e.active_30d)} hint={`${e.stickiness_percent}% of them were active today`} />
            <Tile label="Returning students" value={e.returning_percent === null ? '—' : `${e.returning_percent}%`} hint="Of last period's active students" />
            <Tile testId="tile-new" label="New students" value={num(e.new_students)} hint={`${num(e.total_students)} in total`} />
            <Tile testId="tile-questions" label="Questions answered" value={num(e.questions_answered)} hint={`${e.questions_per_active_student} per active student`} />
            <Tile label="Tests completed" value={num(e.tests_completed)} hint={`${num(e.subject_wise_tests)} subject-wise`} />
            <Tile label="Free students who hit the daily limit" value={num(e.free_students_hit_limit)} hint="Likely to upgrade" />
            <Tile label="Milestones unlocked" value={num(e.milestones_unlocked)} />
            <Tile label="Weekly email subscribers" value={num(e.weekly_email_subscribers)} />
          </div>
          <div style={twoCols}>
            <Panel title="Active students" subtitle={weekly ? 'Average per day, by week' : 'Per day'}>
              <MiniChart kind="line" seriesName="Active students" points={series.map((d) => dayPoint(d, d.active_students))} />
            </Panel>
            <Panel title="Questions answered" subtitle={`Tests and practice, ${weekly ? 'per week' : 'per day'}`}>
              <MiniChart kind="bar" seriesName="Questions" points={series.map((d) => dayPoint(d, d.questions))} />
            </Panel>
          </div>
          <div style={twoCols}>
            <Panel title="New students" subtitle={weekly ? 'Per week' : 'Per day'}>
              <MiniChart kind="bar" seriesName="New students" points={series.map((d) => dayPoint(d, d.new_students))} />
            </Panel>
            <Panel title="Test language" subtitle={`Tests started, last ${rangeLabel?.toLowerCase()}`}>
              {([['en', 'English'], ['hi', 'Hindi · हिन्दी'], ['mr', 'Marathi · मराठी']] as const).map(([code, label]) => {
                const n = e.test_languages[code];
                const pct = langTotal ? Math.round((n * 100) / langTotal) : 0;
                return (
                  <div key={code} style={{ marginBottom: 12 }} data-lang={code}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                      <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{label}</span>
                      <span style={{ color: 'var(--text-main)', fontWeight: 700 }}>{num(n)} · {pct}%</span>
                    </div>
                    <div style={{ height: 8, borderRadius: 999, background: 'var(--bg-secondary)', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: 'var(--info-teal)', borderRadius: 4 }} />
                    </div>
                  </div>
                );
              })}
              <h4 style={{ margin: '16px 0 8px', fontSize: 14, fontWeight: 700 }}>Most-taken papers</h4>
              {e.top_exams.length === 0 ? (
                <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text-muted)' }}>No completed tests in this period.</p>
              ) : (
                <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {e.top_exams.map((x) => (
                    <li key={x.exam}>
                      <span style={{ overflowWrap: 'anywhere' }}>{x.exam}</span>{' '}
                      <span style={{ color: 'var(--text-muted)' }}>· {plural(x.tests, 'test', 'tests')}</span>
                    </li>
                  ))}
                </ol>
              )}
            </Panel>
          </div>

          <section style={{ ...card, padding: 16 }}>
            <button
              type="button"
              aria-expanded={showTable}
              onClick={() => setShowTable((v) => !v)}
              style={{ background: 'none', border: 'none', padding: 0, fontWeight: 700, fontSize: 14, cursor: 'pointer', color: 'var(--text-main)' }}
            >
              {showTable ? '▾' : '▸'} Day-by-day numbers
            </button>
            {showTable && (
              <div style={{ overflowX: 'auto', marginTop: 10 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: 12 }}>
                      <th style={{ padding: '6px 4px' }}>{weekly ? 'Week of' : 'Day'}</th>
                      <th style={{ padding: '6px 4px', textAlign: 'right' }}>Active</th>
                      <th style={{ padding: '6px 4px', textAlign: 'right' }}>New</th>
                      <th style={{ padding: '6px 4px', textAlign: 'right' }}>Questions</th>
                      <th style={{ padding: '6px 4px', textAlign: 'right' }}>Tests</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...series].reverse().map((d) => (
                      <tr key={d.date} style={{ borderTop: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '6px 4px' }}>{dayLabel(d.date)}</td>
                        <td style={{ padding: '6px 4px', textAlign: 'right' }}>{num(d.active_students)}</td>
                        <td style={{ padding: '6px 4px', textAlign: 'right' }}>{num(d.new_students)}</td>
                        <td style={{ padding: '6px 4px', textAlign: 'right' }}>{num(d.questions)}</td>
                        <td style={{ padding: '6px 4px', textAlign: 'right' }}>{num(d.tests)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
            Questions are counted from when the app began recording answer times (the free-plan update); tests completed before that still count.
          </p>
        </>
      )}
    </div>
  );
}
