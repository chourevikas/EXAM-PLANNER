import type { ConfidenceLevel } from '../../types/exam';
import { useExamText, ExamTextKey } from '../../i18n/examText';

/**
 * "How sure are you?" — Sure / 50-50 / Guess. Enabled once an option is selected;
 * clicking the active choice again clears it.
 */

const CHOICES: { value: ConfidenceLevel; label: ExamTextKey; color: string; bg: string }[] = [
  { value: 'SURE', label: 'sure', color: '#047857', bg: '#ECFDF5' },
  { value: 'FIFTY_FIFTY', label: 'fiftyFifty', color: '#B45309', bg: '#FFFBEB' },
  { value: 'GUESS', label: 'guess', color: '#B91C1C', bg: '#FEF2F2' },
];

interface ConfidenceSelectorProps {
  value: ConfidenceLevel | null | undefined;
  onChange: (value: ConfidenceLevel | null) => void;
  disabled?: boolean;
  compact?: boolean;
}

export function ConfidenceSelector({ value, onChange, disabled = false, compact = false }: ConfidenceSelectorProps) {
  const { t } = useExamText();
  return (
    <div
      role="radiogroup"
      aria-label={t('howSureLong')}
      title={disabled ? t('selectOptionFirst') : t('howSureLong')}
      style={{ display: 'flex', alignItems: 'center', gap: compact ? 4 : 6 }}
    >
      {!compact && (
        <span style={{ fontSize: 12, fontWeight: 600, color: disabled ? 'var(--text-disabled)' : 'var(--text-secondary)' }}>
          {t('howSure')}
        </span>
      )}
      {CHOICES.map((c) => {
        const active = value === c.value;
        return (
          <button
            key={c.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(active ? null : c.value)}
            className="touch-target"
            style={{
              padding: compact ? '6px 8px' : '7px 12px',
              borderRadius: 'var(--radius)',
              border: `1px solid ${active ? c.color : 'var(--border-color)'}`,
              backgroundColor: active ? c.bg : 'var(--bg-card)',
              color: disabled ? 'var(--text-disabled)' : active ? c.color : 'var(--text-secondary)',
              fontSize: 12,
              fontWeight: active ? 800 : 600,
              cursor: disabled ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
            }}
          >
            {t(c.label)}
          </button>
        );
      })}
    </div>
  );
}
