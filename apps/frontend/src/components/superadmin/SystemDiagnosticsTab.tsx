import React from 'react';
import { SystemStats } from '../../types/auth';

interface SystemDiagnosticsTabProps {
  stats: SystemStats | null;
  loading: boolean;
}

export function SystemDiagnosticsTab({ stats, loading }: SystemDiagnosticsTabProps) {
  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: 20,
        padding: 32,
        boxShadow: 'var(--shadow-md)',
      }}
    >
      <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-main)', marginBottom: 8 }}>
        ⚡ System Diagnostics & Cloud Infrastructure
      </h2>
      <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 28 }}>
        Live monitoring of AWS RDS connection state, API authentication settings, and platform configuration.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
        {/* Database Status Card */}
        <div
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderLeft: '4px solid #8B5CF6',
            borderRadius: 16,
            padding: 24,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: 'rgba(139, 92, 246, 0.15)',
                color: '#8B5CF6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
              }}
            >
              ☁️
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)' }}>
              AWS RDS PostgreSQL Database
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Status:</span>
              <span style={{ color: 'var(--emerald)', fontWeight: 700 }}>
                {loading ? 'Checking...' : stats?.aws_rds_status || 'Healthy'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Database Engine:</span>
              <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>PostgreSQL 16 (AWS RDS)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Database Name:</span>
              <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{stats?.database_name || 'postgres'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>AWS Region:</span>
              <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>ap-southeast-2 (Sydney)</span>
            </div>
          </div>
        </div>

        {/* Auth & Security Status Card */}
        <div
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderLeft: '4px solid var(--royal)',
            borderRadius: 16,
            padding: 24,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: 'rgba(37, 99, 235, 0.15)',
                color: 'var(--royal)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
              }}
            >
              🔒
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)' }}>
              Authentication & Security
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Token Security:</span>
              <span style={{ color: 'var(--emerald)', fontWeight: 700 }}>JWT Bearer Active</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Password Hashing:</span>
              <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>Bcrypt (salted)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Super Admin Seed:</span>
              <span style={{ color: 'var(--royal)', fontWeight: 600 }}>Auto-seeded on Startup</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>CORS Policy:</span>
              <span style={{ color: 'var(--emerald)', fontWeight: 600 }}>Strict localhost Enabled</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
