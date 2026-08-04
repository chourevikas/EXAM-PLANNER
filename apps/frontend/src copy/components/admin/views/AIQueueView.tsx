import React from 'react';
import { Cpu, Loader2, CheckCircle2, AlertTriangle, RefreshCw, Server, Zap } from 'lucide-react';

export function AIQueueView() {
  const queueJobs = [
    { id: 'JOB-9021', paper: 'UPSC Prelims 2024 (GS Paper I)', status: 'processing', stage: 'LLM Subject Classification', progress: 68, speed: '14 q/s', elapsed: '1m 20s' },
    { id: 'JOB-9020', paper: 'MPPSC State Services 2024 (GS Paper I)', status: 'queued', stage: 'Waiting for Worker', progress: 0, speed: '—', elapsed: '0s' },
    { id: 'JOB-9019', paper: 'UPSC CAPF AC 2023 Paper I', status: 'completed', stage: '100% Extracted', progress: 100, speed: '22 q/s', elapsed: '2m 14s' },
    { id: 'JOB-9018', paper: 'MPSC Rajyaseva 2023 GS Paper', status: 'completed', stage: '100% Extracted', progress: 100, speed: '18 q/s', elapsed: '1m 55s' },
    { id: 'JOB-9017', paper: 'UPSC NDA 2023 General Ability', status: 'failed', stage: 'OCR Timeout on Page 14', progress: 42, speed: '0 q/s', elapsed: '45s' },
  ];

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 20, padding: 32, boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(37, 99, 235, 0.12)', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Cpu size={20} />
              </div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, color: 'var(--text-main)', margin: 0 }}>
                AI Processing Queue
              </h2>
            </div>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 6 }}>
              Real-time monitoring of OCR parsing, Vision LLM diagrams, and automated question extraction worker jobs.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#10b981', background: 'rgba(16, 185, 129, 0.12)', padding: '6px 12px', borderRadius: 99, fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Server size={14} /> 3 GPU Workers Active
            </span>
          </div>
        </div>

        {/* Queue Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                {['Job ID', 'Question Paper', 'Status', 'Current Stage', 'Progress', 'Inference Speed', 'Elapsed Time', 'Action'].map((h) => (
                  <th key={h} style={{ padding: '12px 14px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {queueJobs.map((j) => (
                <tr key={j.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '14px', fontSize: 13, fontWeight: 700, color: 'var(--royal)', fontFamily: 'var(--font-mono)' }}>{j.id}</td>
                  <td style={{ padding: '14px', fontSize: 13.5, fontWeight: 600, color: 'var(--text-main)', fontFamily: 'var(--font-body)' }}>{j.paper}</td>
                  <td style={{ padding: '14px' }}>
                    {j.status === 'processing' && (
                      <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(37, 99, 235, 0.15)', color: '#2563eb', padding: '3px 10px', borderRadius: 99, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Loader2 size={12} style={{ animation: 'spin-slow 1s linear infinite' }} /> Processing
                      </span>
                    )}
                    {j.status === 'completed' && (
                      <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '3px 10px', borderRadius: 99, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <CheckCircle2 size={12} /> Completed
                      </span>
                    )}
                    {j.status === 'failed' && (
                      <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '3px 10px', borderRadius: 99, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <AlertTriangle size={12} /> Failed
                      </span>
                    )}
                    {j.status === 'queued' && (
                      <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(100, 116, 139, 0.15)', color: '#64748b', padding: '3px 10px', borderRadius: 99 }}>
                        Queued
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '14px', fontSize: 13, color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>{j.stage}</td>
                  <td style={{ padding: '14px', width: 140 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 6, background: 'var(--bg-secondary)', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${j.progress}%`, background: j.status === 'failed' ? '#ef4444' : j.status === 'completed' ? '#10b981' : '#2563eb', borderRadius: 99 }} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{j.progress}%</span>
                    </div>
                  </td>
                  <td style={{ padding: '14px', fontSize: 12, color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>{j.speed}</td>
                  <td style={{ padding: '14px', fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{j.elapsed}</td>
                  <td style={{ padding: '14px' }}>
                    <button style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <RefreshCw size={12} /> Retry
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
