import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { useThemeContext } from '../../../contexts/ThemeContext';
import { updateActiveTheme } from '../../../services/siteSettingsService';
import { useBreakpoint } from '../../../hooks/useBreakpoint';

interface ThemePreset {
  id: string;
  label: string;
  description: string;
  swatchColors: string[];
}

const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'crimson',
    label: 'Crimson',
    description: 'The original red & black palette.',
    swatchColors: ['#e31b23', 'var(--deep-navy)', '#111111'],
  },
  {
    id: 'ocean',
    label: 'Ocean',
    description: 'Cool blues with a deep navy accent.',
    swatchColors: ['#1d6fb8', '#0b2540', '#17a2c2'],
  },
  {
    id: 'forest',
    label: 'Forest',
    description: 'Earthy greens with a charcoal base.',
    swatchColors: ['#2f7a4a', '#1b2e22', '#14231a'],
  },
  {
    id: 'royal',
    label: 'Royal',
    description: 'Rich purples for a premium feel.',
    swatchColors: ['#6b3fa0', '#241a3d', '#52306f'],
  },
];

export function ThemeSettingsView() {
  const { isMobile } = useBreakpoint();
  const { themeName, applyThemeOptimistically } = useThemeContext();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; isError: boolean } | null>(null);

  const showToast = (text: string, isError = false) => {
    setToast({ text, isError });
    setTimeout(() => setToast(null), 4000);
  };

  const handleSelect = async (preset: ThemePreset) => {
    if (preset.id === themeName || savingId) return;
    setSavingId(preset.id);
    try {
      await updateActiveTheme(preset.id);
      applyThemeOptimistically(preset.id);
      showToast(`Theme updated to ${preset.label}.`);
    } catch (err: any) {
      showToast(err.message || 'Failed to update theme.', true);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius)',
        padding: isMobile ? '20px 16px' : 32,
        boxShadow: '0 12px 36px -10px rgba(15, 29, 56, 0.08)',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)', margin: 0, letterSpacing: '-0.02em' }}>
          Theme
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4, margin: '4px 0 0 0' }}>
          Choose the color palette applied across the entire platform for every visitor.
        </p>
      </div>

      {toast && (
        <div
          style={{
            padding: '12px 16px',
            marginBottom: 16,
            borderRadius: 'var(--radius)',
            fontSize: 13.5,
            fontWeight: 600,
            background: toast.isError ? 'rgba(227, 27, 35, 0.12)' : 'rgba(16, 185, 129, 0.12)',
            color: toast.isError ? 'var(--primary-red)' : '#3A8B53',
            border: `1px solid ${toast.isError ? 'rgba(227,27,35,0.3)' : 'rgba(16,185,129,0.3)'}`,
          }}
        >
          {toast.text}
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 16,
        }}
      >
        {THEME_PRESETS.map((preset) => {
          const isActive = preset.id === themeName;
          const isSaving = savingId === preset.id;
          return (
            <button
              key={preset.id}
              onClick={() => handleSelect(preset)}
              disabled={isSaving}
              style={{
                textAlign: 'left',
                cursor: isSaving ? 'wait' : 'pointer',
                borderRadius: 'var(--radius)',
                border: isActive ? '2px solid var(--accent-primary, #e31b23)' : '1px solid var(--border-color)',
                background: 'var(--bg-body, #ffffff)',
                padding: 18,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                position: 'relative',
                opacity: isSaving ? 0.6 : 1,
              }}
            >
              {isActive && (
                <div
                  style={{
                    position: 'absolute',
                    top: 10,
                    right: 10,
                    background: 'var(--accent-primary, #e31b23)',
                    color: '#fff',
                    borderRadius: '50%',
                    width: 20,
                    height: 20,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Check size={13} />
                </div>
              )}
              <div style={{ display: 'flex', gap: 6 }}>
                {preset.swatchColors.map((color) => (
                  <span
                    key={color}
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: color,
                      display: 'inline-block',
                      border: '1px solid rgba(0,0,0,0.08)',
                    }}
                  />
                ))}
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)' }}>{preset.label}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>{preset.description}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
