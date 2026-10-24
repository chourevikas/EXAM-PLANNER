import React, { useEffect, useState } from 'react';
import { CalendarPlus, Copy, Download, RefreshCw, X } from 'lucide-react';
import { CalendarLinks, fetchCalendarLinks, resetCalendarLinks } from '../../../services/plannerService';
import { Notice, btn, card, h2 } from './plannerUi';

/**
 * Add to calendar: subscribe to the student's private plan feed (Google, Apple, Outlook keep it up to date on
 * their own), or download a one-time .ics file.
 */
export function CalendarDialog({ onClose, onDownload }: { onClose: () => void; onDownload: () => void }) {
  const [links, setLinks] = useState<CalendarLinks | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchCalendarLinks().then(setLinks).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const copy = async () => {
    if (!links) return;
    try {
      await navigator.clipboard.writeText(links.url);
      setMsg('Link copied. In your calendar app, add a calendar "From URL" and paste it.');
    } catch {
      setMsg('Copy the link from the box above.');
    }
  };

  const reset = async () => {
    if (!window.confirm('Make a new link? Calendars using the old link stop updating, so you will need to subscribe again.')) return;
    try {
      setLinks(await resetCalendarLinks());
      setMsg('New link made. The old one no longer works.');
    } catch (e: any) {
      setError(e.message);
    }
  };

  const linkBtn: React.CSSProperties = { ...btn(), justifyContent: 'center', textDecoration: 'none', width: '100%', boxSizing: 'border-box' };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="cal-title" onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ ...card, width: '100%', maxWidth: 460, maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
          <h3 id="cal-title" style={{ ...h2, fontSize: 17, display: 'flex', gap: 8, alignItems: 'center' }}><CalendarPlus size={18} /> Add your plan to your calendar</h3>
          <button type="button" aria-label="Close" onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={18} /></button>
        </div>
        <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Subscribe once and your calendar keeps up with your plan: skipped days, catch-ups and new plans show up on their own.
          Google Calendar can take a few hours to refresh.
        </p>
        {error && <Notice kind="error">{error}</Notice>}
        {!links && !error && <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>Getting your link…</p>}
        {links && (
          <>
            <a href={links.google_url} target="_blank" rel="noopener noreferrer" style={{ ...linkBtn, ...btn(true), justifyContent: 'center', textDecoration: 'none' }}>
              Add to Google Calendar
            </a>
            <a href={links.webcal_url} style={linkBtn}>Apple Calendar / Outlook</a>
            <div>
              <label htmlFor="cal-url" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>Or copy your private link</label>
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                <input id="cal-url" readOnly value={links.url} onFocus={(e) => e.target.select()}
                  style={{ flex: 1, minWidth: 0, padding: '7px 9px', borderRadius: 'var(--radius)', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-subtle)', color: 'var(--text-primary)', fontSize: 12.5 }} />
                <button type="button" style={{ ...btn(), padding: '7px 10px' }} onClick={copy} aria-label="Copy link"><Copy size={14} /></button>
              </div>
              <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>Keep this link private: anyone with it can see your plan.</p>
            </div>
            {msg && <Notice kind="ok">{msg}</Notice>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap', borderTop: '1px solid var(--border-default)', paddingTop: 10 }}>
              <button type="button" style={{ ...btn(), padding: '6px 10px', fontSize: 12.5 }} onClick={onDownload}><Download size={13} /> Download a one-time .ics file</button>
              <button type="button" style={{ ...btn(), padding: '6px 10px', fontSize: 12.5 }} onClick={reset}><RefreshCw size={13} /> Reset link</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
