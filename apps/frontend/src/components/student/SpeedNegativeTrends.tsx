import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { guardedFetch } from '../../utils/apiGuard';

interface TrendTest {
  attempt_id: number;
  exam: string;
  date: string;
  answered: number;
  seconds_per_question: number | null;
  negative_marks: number;
  wrong: number;
  accuracy: number | null;
}

interface TrendData {
  tests: TrendTest[];
  summary: null | {
    tests: number;
    average_seconds_per_question: number;
    average_negative_marks: number;
    total_negative_marks: number;
    speed_change?: number;
    negative_marks_change?: number;
  };
}

// One series per chart, so one hue (teal: passes contrast on light and dark cards). Text stays in text colours.
const SERIES = 'var(--info-primary, #199eae)';
const tick = { fontSize: 11, fill: 'var(--text-muted)' };
const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

/** Recent half of the tests vs the earlier half, in plain words (none until there are enough tests). */
function speedChange(v?: number): string | null {
  if (v === undefined) return null;
  if (v === 0) return 'same pace as your earlier tests';
  return `${Math.abs(v)}s ${v < 0 ? 'faster' : 'slower'} per question than your earlier tests`;
}

function negativeChange(v?: number): string | null {
  if (v === undefined) return null;
  if (v === 0) return 'same as your earlier tests';
  return `${Math.abs(v)} ${v < 0 ? 'fewer' : 'more'} marks lost per test than earlier`;
}

/** Speed (seconds per answered question) and marks lost to wrong answers, test by test. Pro only. */
export function SpeedNegativeTrends() {
  const { isMobile } = useBreakpoint();
  const [data, setData] = useState<TrendData | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    guardedFetch('/api/v1/analytics/trends/speed-negative?limit=20', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      // A free-plan student gets 403; the page already shows the upgrade card, so this section stays hidden
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => setData(null));
  }, []);

  if (!data || !data.summary || data.tests.length < 2) return null;
  // Keyed by position: two tests on the same day share a date label, which would merge their points
  const points = data.tests.map((t, i) => ({ ...t, idx: i, label: shortDate(t.date) }));
  const s = data.summary;

  const card: React.CSSProperties = {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius)',
    padding: isMobile ? 14 : 18,
    minWidth: 0,
  };

  const chart = (key: 'seconds_per_question' | 'negative_marks', name: string, unit: string) => (
    <div style={{ width: '100%', height: 200 }}>
      <ResponsiveContainer>
        <LineChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--border-color)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="idx" tick={tick} axisLine={false} tickLine={false} minTickGap={20} tickFormatter={(i: number) => points[i]?.label ?? ''} />
          <YAxis tick={tick} axisLine={false} tickLine={false} width={36} />
          <Tooltip
            contentStyle={{ borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 12 }}
            labelFormatter={(_: any, payload: any) => (payload?.[0]?.payload ? `${payload[0].payload.exam} · ${payload[0].payload.label}` : '')}
            formatter={(v: any) => [`${v}${unit}`, name]}
          />
          <Line type="monotone" dataKey={key} stroke={SERIES} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );

  return (
    <section aria-label="Speed and negative marking over time" style={{ margin: isMobile ? '16px 0' : '24px 0' }}>
      <h3 style={{ fontSize: isMobile ? 16 : 18, fontWeight: 800, margin: '0 0 4px', color: 'var(--text-primary)' }}>
        Speed and negative marking over time
      </h3>
      <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-muted)' }}>Your last {s.tests} completed tests, oldest first.</p>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
        <div style={card} data-testid="speed-trend">
          <div style={{ fontWeight: 700, fontSize: 14 }}>Time per answered question</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '2px 0 8px' }}>
            Average {s.average_seconds_per_question}s
            {speedChange(s.speed_change) ? ` · ${speedChange(s.speed_change)}` : ''}
          </div>
          {chart('seconds_per_question', 'Seconds per question', 's')}
        </div>
        <div style={card} data-testid="negative-trend">
          <div style={{ fontWeight: 700, fontSize: 14 }}>Marks lost to wrong answers</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '2px 0 8px' }}>
            {s.total_negative_marks} in total, {s.average_negative_marks} per test
            {negativeChange(s.negative_marks_change) ? ` · ${negativeChange(s.negative_marks_change)}` : ''}
          </div>
          {chart('negative_marks', 'Marks lost', '')}
        </div>
      </div>
    </section>
  );
}
