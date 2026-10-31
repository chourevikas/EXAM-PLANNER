import React, { useEffect, useState } from 'react';
import { Languages, X } from 'lucide-react';
import { SUPPORTED_LANGUAGES } from '../../constants/languages';

interface Props {
  open: boolean;
  /** "test" for an exam simulation, "practice" for a practice session; changes the wording only. */
  kind?: 'test' | 'practice';
  busy?: boolean;
  onStart: (language: string) => void;
  onCancel: () => void;
}

/**
 * Asked before a test or practice session starts. English is preselected; the chosen language
 * is used for every question until the session ends.
 */
export function ExamLanguagePicker({ open, kind = 'test', busy = false, onStart, onCancel }: Props) {
  const [choice, setChoice] = useState('en');

  useEffect(() => {
    if (!open) return;
    setChoice('en');
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;
  const session = kind === 'practice' ? 'practice session' : 'test';
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="exam-language-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border-color)',
          padding: 24,
          boxShadow: '0 20px 48px rgba(15, 23, 42, 0.25)',
          position: 'relative',
        }}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onCancel}
          disabled={busy}
          style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 6 }}
        >
          <X size={18} />
        </button>
        <div style={{ display: 'inline-flex', padding: 10, borderRadius: 'var(--radius)', backgroundColor: 'var(--bg-subtle)', color: 'var(--primary-red)', marginBottom: 12 }}>
          <Languages size={22} />
        </div>
        <h2 id="exam-language-title" style={{ fontSize: 19, fontWeight: 800, margin: '0 0 8px', color: 'var(--text-primary)' }}>
          Choose the language for this {session}
        </h2>
        <p style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--text-secondary)', margin: '0 0 16px' }}>
          Every question will be shown in this language until the {session} ends.
        </p>
        <div role="radiogroup" aria-label="Language" style={{ display: 'grid', gap: 8, marginBottom: 20 }}>
          {SUPPORTED_LANGUAGES.map((lang) => {
            const selected = choice === lang.code;
            return (
              <button
                key={lang.code}
                type="button"
                role="radio"
                aria-checked={selected}
                data-lang={lang.code}
                onClick={() => setChoice(lang.code)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  borderRadius: 'var(--radius)',
                  border: `2px solid ${selected ? 'var(--primary-red)' : 'var(--border-color)'}`,
                  backgroundColor: selected ? 'var(--bg-subtle)' : 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  fontSize: 15,
                  fontWeight: selected ? 700 : 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span>{lang.nativeName}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
                  {lang.code === 'en' ? 'Default' : lang.name}
                </span>
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => onStart(choice)}
            disabled={busy}
            style={{
              padding: '11px 18px',
              borderRadius: 'var(--radius)',
              border: 'none',
              backgroundColor: 'var(--primary-red)',
              color: '#fff',
              fontWeight: 700,
              fontSize: 14,
              cursor: busy ? 'wait' : 'pointer',
              opacity: busy ? 0.7 : 1,
            }}
          >
            {busy ? 'Starting…' : kind === 'practice' ? 'Start practice' : 'Start test'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            style={{
              padding: '11px 18px',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-primary)',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
