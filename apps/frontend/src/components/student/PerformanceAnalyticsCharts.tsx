import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Cell } from 'recharts';
import { Info, ChevronDown, ChevronUp } from 'lucide-react';

const subjectData = [
  { subject: 'History', accuracy: 85 },
  { subject: 'Polity', accuracy: 72 },
  { subject: 'Geography', accuracy: 90 },
  { subject: 'Economy', accuracy: 55 },
  { subject: 'Science & Tech', accuracy: 65 },
  { subject: 'Environment', accuracy: 78 },
];

const studyHoursData = [
  { day: 'Mon', hours: 4.5 },
  { day: 'Tue', hours: 5.2 },
  { day: 'Wed', hours: 3.8 },
  { day: 'Thu', hours: 6.0 },
  { day: 'Fri', hours: 7.5 },
  { day: 'Sat', hours: 8.2 },
  { day: 'Sun', hours: 6.5 },
];

export function PerformanceAnalyticsCharts() {
  const [showProficiencyInfo, setShowProficiencyInfo] = useState(false);
  const [showHoursInfo, setShowHoursInfo] = useState(false);

  return (
    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24, marginBottom: 32 }}>
      
      {/* Subject Accuracy Bar Chart */}
      <div style={{ backgroundColor: 'var(--bg-card)', padding: 28, borderRadius: 24, border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-color-base)' }}>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>
              Subject Accuracy & Mastery
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
              Percentage of questions answered correctly across core topics.
            </p>
          </div>
          <button
            onClick={() => setShowProficiencyInfo(!showProficiencyInfo)}
            style={{
              background: showProficiencyInfo ? 'var(--accent-primary)' : 'var(--bg-hover)',
              color: showProficiencyInfo ? '#ffffff' : 'var(--text-muted)',
              border: 'none',
              borderRadius: 20,
              padding: '4px 10px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              transition: 'all 0.2s ease',
            }}
            title="Toggle Detailed Parameter Description"
          >
            <Info size={14} />
            <span>Info</span>
          </button>
        </div>

        {/* Expandable Info Description */}
        {showProficiencyInfo && (
          <div
            style={{
              padding: 12,
              borderRadius: 12,
              backgroundColor: 'var(--accent-bg, rgba(91,92,235,0.08))',
              border: '1px solid var(--accent-border, rgba(91,92,235,0.2))',
              fontSize: 12.5,
              color: 'var(--text-primary)',
              lineHeight: 1.5,
              marginBottom: 16,
            }}
          >
            <strong>How this is evaluated:</strong> Subject Proficiency maps your Net Accuracy (Correct / Total Attempted) across individual modules. 
            Green bars indicate High Competence (≥75%), Purple indicates Stable Control (60–74%), and Amber indicates high-priority revision zones (&lt;60%).
          </div>
        )}

        <div style={{ height: 260, width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={subjectData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-default)" opacity={0.6} />
              <XAxis dataKey="subject" axisLine={false} tickLine={false} tick={{ fontSize: 11.5, fill: 'var(--text-muted)' }} dy={10} />
              <YAxis domain={[0, 100]} ticks={[0, 20, 40, 60, 80, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 11.5, fill: 'var(--text-muted)' }} unit="%" />
              <Tooltip 
                cursor={{ fill: 'var(--bg-hover)' }}
                formatter={(value: any) => [`${value}%`, 'Accuracy']}
                contentStyle={{ 
                  backgroundColor: 'var(--bg-card)', 
                  borderColor: 'var(--border-default)', 
                  borderRadius: 12, 
                  boxShadow: 'var(--shadow-color-base)', 
                  color: 'var(--text-primary)',
                  fontSize: 13
                }}
              />
              <Bar dataKey="accuracy" radius={[8, 8, 0, 0]} maxBarSize={38}>
                {subjectData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.accuracy >= 75 ? 'var(--success-primary, #10b981)' : entry.accuracy >= 60 ? 'var(--accent-primary, #5b5ceb)' : 'var(--warning-primary, #f59e0b)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Time Management Area Chart */}
      <div style={{ backgroundColor: 'var(--bg-card)', padding: 28, borderRadius: 24, border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-color-base)' }}>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>
              Daily Study Engagement
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
              Active study hours dedicated per day over the past 7 days.
            </p>
          </div>
          <button
            onClick={() => setShowHoursInfo(!showHoursInfo)}
            style={{
              background: showHoursInfo ? 'var(--accent-primary)' : 'var(--bg-hover)',
              color: showHoursInfo ? '#ffffff' : 'var(--text-muted)',
              border: 'none',
              borderRadius: 20,
              padding: '4px 10px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              transition: 'all 0.2s ease',
            }}
            title="Toggle Detailed Parameter Description"
          >
            <Info size={14} />
            <span>Info</span>
          </button>
        </div>

        {/* Expandable Info Description */}
        {showHoursInfo && (
          <div
            style={{
              padding: 12,
              borderRadius: 12,
              backgroundColor: 'var(--accent-bg, rgba(91,92,235,0.08))',
              border: '1px solid var(--accent-border, rgba(91,92,235,0.2))',
              fontSize: 12.5,
              color: 'var(--text-primary)',
              lineHeight: 1.5,
              marginBottom: 16,
            }}
          >
            <strong>Pacing and Consistency:</strong> Consistent study engagement between 5.0 to 8.0 hours daily prevents cognitive exhaustion while maximizing long-term memory consolidation under the FSRS memory retention algorithm.
          </div>
        )}

        <div style={{ height: 260, width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={studyHoursData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent-primary, #5b5ceb)" stopOpacity={0.35}/>
                  <stop offset="95%" stopColor="var(--accent-primary, #5b5ceb)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-default)" opacity={0.6} />
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11.5, fill: 'var(--text-muted)' }} dy={10} />
              <YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} axisLine={false} tickLine={false} tick={{ fontSize: 11.5, fill: 'var(--text-muted)' }} unit="h" />
              <Tooltip 
                formatter={(value: any) => [`${value} hrs`, 'Study Time']}
                contentStyle={{ 
                  backgroundColor: 'var(--bg-card)', 
                  borderColor: 'var(--border-default)', 
                  borderRadius: 12, 
                  boxShadow: 'var(--shadow-color-base)', 
                  color: 'var(--text-primary)',
                  fontSize: 13
                }}
              />
              <Area type="monotone" dataKey="hours" stroke="var(--accent-primary, #5b5ceb)" strokeWidth={3} fillOpacity={1} fill="url(#colorHours)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
