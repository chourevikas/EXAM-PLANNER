import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Cell } from 'recharts';

const subjectData = [
  { subject: 'History', accuracy: 85 },
  { subject: 'Polity', accuracy: 72 },
  { subject: 'Geography', accuracy: 90 },
  { subject: 'Economy', accuracy: 55 },
  { subject: 'Science', accuracy: 65 },
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
  return (
    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24, marginBottom: 32 }}>
      
      {/* Subject Accuracy Bar Chart */}
      <div style={{ backgroundColor: 'var(--bg-card)', padding: 28, borderRadius: 24, border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-color-base)' }}>
        <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>Subject Proficiency</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>Accuracy breakdown across major exam subjects.</p>
          </div>
        </div>
        <div style={{ height: 260, width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={subjectData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-default)" opacity={0.6} />
              <XAxis dataKey="subject" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-muted)' }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
              <Tooltip 
                cursor={{ fill: 'var(--bg-hover)' }}
                contentStyle={{ 
                  backgroundColor: 'var(--bg-card)', 
                  borderColor: 'var(--border-default)', 
                  borderRadius: 12, 
                  boxShadow: 'var(--shadow-color-base)', 
                  color: 'var(--text-primary)',
                  fontSize: 13
                }}
              />
              <Bar dataKey="accuracy" radius={[8, 8, 0, 0]} maxBarSize={44}>
                {subjectData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.accuracy >= 75 ? 'var(--success-primary)' : entry.accuracy >= 60 ? 'var(--accent-primary)' : 'var(--warning-primary)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Time Management Area Chart */}
      <div style={{ backgroundColor: 'var(--bg-card)', padding: 28, borderRadius: 24, border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-color-base)' }}>
        <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>Daily Study Commitment</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>Hours dedicated per day over the last 7 days.</p>
          </div>
        </div>
        <div style={{ height: 260, width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={studyHoursData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.35}/>
                  <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-default)" opacity={0.6} />
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-muted)' }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'var(--bg-card)', 
                  borderColor: 'var(--border-default)', 
                  borderRadius: 12, 
                  boxShadow: 'var(--shadow-color-base)', 
                  color: 'var(--text-primary)',
                  fontSize: 13
                }}
              />
              <Area type="monotone" dataKey="hours" stroke="var(--accent-primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorHours)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
