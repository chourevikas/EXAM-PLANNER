import React from 'react';

export function AdminOverview() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
      <div className="admin-card" style={{ padding: 24 }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 700 }}>Total Papers Uploaded</div>
        <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--royal)', marginTop: 8 }}>24 Papers</div>
      </div>
      <div className="admin-card" style={{ padding: 24 }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 700 }}>Platform Storage</div>
        <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--emerald)', marginTop: 8 }}>exam-planner://platform</div>
      </div>
      <div className="admin-card" style={{ padding: 24 }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 700 }}>Backend Service Status</div>
        <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--saffron)', marginTop: 8 }}>FastAPI :8000</div>
      </div>
    </div>
  );
}
