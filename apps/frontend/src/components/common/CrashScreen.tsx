import { monitoringEnabled } from '../../utils/monitoring';

/** Shown instead of a blank page when a render error escapes every component (see main.tsx). */
export function CrashScreen() {
  return (
    <div
      role="alert"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: '#F7F7F5',
        fontFamily: 'Inter, sans-serif',
        color: '#172033',
      }}
    >
      <div style={{ maxWidth: 420, textAlign: 'center' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 8px' }}>Something went wrong</h1>
        <p style={{ fontSize: 14, color: '#64748B', margin: '0 0 20px', lineHeight: 1.5 }}>
          This page hit an error and couldn't load.{monitoringEnabled ? " We've been notified." : ''} Reloading
          usually fixes it; answers you already saved are safe.
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ padding: '10px 20px', fontSize: 14, fontWeight: 700, borderRadius: 8, border: 'none', background: '#172033', color: '#fff', cursor: 'pointer', minHeight: 44 }}
          >
            Reload page
          </button>
          <button
            type="button"
            onClick={() => { window.location.href = '/dashboard'; }}
            style={{ padding: '10px 20px', fontSize: 14, fontWeight: 700, borderRadius: 8, border: '1px solid #CBD5E1', background: 'transparent', color: '#172033', cursor: 'pointer', minHeight: 44 }}
          >
            Go to dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
