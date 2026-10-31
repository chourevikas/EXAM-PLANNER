import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Target, Languages, Check, Lock, ArrowRight, ArrowLeft } from 'lucide-react';
import { Logo } from '../components/common/Logo';
import { Spinner } from '../components/common/Spinner';
import { completeOnboarding, fetchCurrentUser } from '../services/authService';
import { fetchActiveExamTypes } from '../services/examTypeService';
import { SUPPORTED_LANGUAGES } from '../constants/languages';
import { useBreakpoint } from '../hooks/useBreakpoint';
import {
  TARGET_YEAR_OPTIONS,
  WEEKLY_HOURS_OPTIONS,
} from '../constants/onboarding';

const STEPS = [
  { title: 'Your exam target', icon: Target },
  { title: 'Preferred language', icon: Languages },
];

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: 'var(--text-primary)',
  display: 'block',
  marginBottom: 6,
};

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 14px',
  borderRadius: 'var(--radius)',
  border: '1px solid var(--border-default)',
  backgroundColor: 'var(--bg-subtle)',
  color: 'var(--text-primary)',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
};

export function OnboardingPage() {
  const navigate = useNavigate();
  const { isSmallScreen } = useBreakpoint();
  const [user, setUser] = useState<any>(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  });
  const [checked, setChecked] = useState(false);

  const [step, setStep] = useState(0);
  const [examOptions, setExamOptions] = useState<string[]>([]);

  const [targetExam, setTargetExam] = useState('');
  const [targetYear, setTargetYear] = useState('');
  const [weeklyHours, setWeeklyHours] = useState('');
  const [language, setLanguage] = useState<string>(() => localStorage.getItem('preferred_language') || 'en');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Always confirm with the server: the cached user may predate onboarding or be from another session.
  useEffect(() => {
    fetchCurrentUser()
      .then((fresh) => {
        setUser(fresh);
        if (fresh?.target_exam) setTargetExam(fresh.target_exam);
        if (fresh?.target_year) setTargetYear(fresh.target_year);
        if (fresh?.weekly_hours) setWeeklyHours(fresh.weekly_hours);
        if (fresh?.preferred_language) setLanguage(fresh.preferred_language);
      })
      .catch(() => {})
      .finally(() => setChecked(true));
  }, []);

  useEffect(() => {
    document.title = 'Welcome - ExamPlanner';
    fetchActiveExamTypes().then((types) => {
      const names = types.filter((t) => t.is_active !== false).map((t) => t.name);
      setExamOptions(names.length ? names : ['UPSC CSE']);
      setTargetExam((cur) => cur || (names.length === 1 ? names[0] : ''));
    });
  }, []);

  const firstName = useMemo(() => (user?.full_name || '').split(' ')[0] || 'there', [user]);

  if (!checked) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spinner size={40} label="Loading…" />
      </div>
    );
  }
  if (user?.role && user.role !== 'STUDENT') return <Navigate to="/" replace />;
  if (user?.onboarding_completed) return <Navigate to="/dashboard" replace />;

  const validateStep = (i: number): string | null => {
    if (i === 0) {
      if (!targetExam) return 'Please choose your primary target exam.';
      if (!targetYear) return 'Please choose the year you are targeting.';
      if (!weeklyHours) return 'Please choose your weekly study goal.';
    }
    return null;
  };

  const next = () => {
    const problem = validateStep(step);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };

  const finish = async () => {
    const problem = validateStep(0);
    if (problem) {
      setStep(0);
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await completeOnboarding({
        target_exam: targetExam,
        target_year: targetYear,
        weekly_hours: weeklyHours,
        preferred_language: language,
      });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your details.');
      setSaving(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-body, #f8fafc)', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          backgroundColor: '#172033',
          padding: '12px clamp(16px, 4vw, 32px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <Logo inverted />
        <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 600 }}>
          Step {step + 1} of {STEPS.length}
        </span>
      </header>

      <main style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: 'clamp(16px, 4vw, 40px) 16px' }}>
        <div style={{ width: '100%', maxWidth: 640 }}>
          <h1 style={{ fontSize: 'clamp(22px, 4vw, 28px)', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px' }}>
            Welcome, {firstName}! 👋
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: '0 0 20px' }}>
            Tell us a little about your preparation so we can personalise ExamPlanner for you.
          </p>

          {/* Step indicator */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }} aria-label="Progress">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const done = i < step;
              const active = i === step;
              return (
                <div
                  key={s.title}
                  aria-label={s.title}
                  aria-current={active ? 'step' : undefined}
                  style={{
                    // On small screens only the current step shows its label; the others collapse to icons.
                    flex: isSmallScreen && !active ? '0 0 auto' : 1,
                    minWidth: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 10px',
                    borderRadius: 'var(--radius)',
                    border: `1px solid ${active ? 'var(--primary-red)' : 'var(--border-default)'}`,
                    backgroundColor: active ? 'rgba(var(--primary-red-rgb), 0.08)' : 'var(--bg-card)',
                    color: active || done ? 'var(--text-primary)' : 'var(--text-muted)',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {done ? <Check size={14} color="var(--status-success, #16a34a)" /> : <Icon size={14} />}
                  {(!isSmallScreen || active) && (
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</span>
                  )}
                </div>
              );
            })}
          </div>

          <section
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius)',
              padding: 'clamp(16px, 3vw, 28px)',
              boxShadow: 'var(--shadow-color-base)',
            }}
          >
            {step === 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18 }}>
                <div>
                  <label style={labelStyle} htmlFor="ob-exam">Primary Target Exam</label>
                  <select id="ob-exam" style={selectStyle} value={targetExam} onChange={(e) => setTargetExam(e.target.value)}>
                    <option value="">Select exam…</option>
                    {examOptions.map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle} htmlFor="ob-year">Target Attempt Year</label>
                  <select id="ob-year" style={selectStyle} value={targetYear} onChange={(e) => setTargetYear(e.target.value)}>
                    <option value="">Select year…</option>
                    {TARGET_YEAR_OPTIONS.map((y) => (
                      <option key={y} value={y}>{y} Attempt</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle} htmlFor="ob-hours">Weekly Study Goal</label>
                  <select id="ob-hours" style={selectStyle} value={weeklyHours} onChange={(e) => setWeeklyHours(e.target.value)}>
                    <option value="">Select hours…</option>
                    {WEEKLY_HOURS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div
                  style={{
                    gridColumn: '1 / -1',
                    display: 'flex',
                    gap: 8,
                    alignItems: 'flex-start',
                    fontSize: 12.5,
                    color: 'var(--text-muted)',
                    backgroundColor: 'var(--bg-subtle)',
                    borderRadius: 'var(--radius)',
                    padding: '10px 12px',
                  }}
                >
                  <Lock size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>
                    Your target exam and year are locked after this step so your plan stays consistent.
                    Your weekly study goal can be changed later from your profile.
                  </span>
                </div>
              </div>
            )}

            {step === 1 && (
              <div>
                <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 0, marginBottom: 16 }}>
                  Tests and practice open in English; pick another language to switch questions and explanations to it from the exam header. You can change this later in your Profile.
                </p>
                <div role="radiogroup" aria-label="Preferred language" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                  {SUPPORTED_LANGUAGES.map((lang) => {
                    const selected = language === lang.code;
                    return (
                      <button
                        key={lang.code}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setLanguage(lang.code)}
                        style={{
                          textAlign: 'left',
                          padding: '14px 16px',
                          borderRadius: 'var(--radius)',
                          cursor: 'pointer',
                          border: selected ? '2px solid var(--primary-red)' : '1px solid var(--border-default)',
                          backgroundColor: selected ? 'rgba(var(--primary-red-rgb), 0.08)' : 'var(--bg-subtle)',
                          color: 'var(--text-primary)',
                        }}
                      >
                        <div style={{ fontSize: 16, fontWeight: 800 }}>{lang.nativeName}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{lang.name}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {error && (
              <div role="alert" style={{ marginTop: 16, color: '#d32f2f', fontSize: 13, fontWeight: 600 }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setStep((s) => Math.max(0, s - 1));
                }}
                disabled={step === 0 || saving}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '11px 18px',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border-default)',
                  backgroundColor: 'transparent',
                  color: 'var(--text-primary)',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: step === 0 || saving ? 'default' : 'pointer',
                  visibility: step === 0 ? 'hidden' : 'visible',
                }}
              >
                <ArrowLeft size={15} /> Back
              </button>

              {step < STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={next}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '11px 22px',
                    borderRadius: 'var(--radius)',
                    border: 'none',
                    backgroundColor: 'var(--primary-red)',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: 'pointer',
                  }}
                >
                  Continue <ArrowRight size={15} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={finish}
                  disabled={saving}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '11px 22px',
                    borderRadius: 'var(--radius)',
                    border: 'none',
                    backgroundColor: 'var(--primary-red)',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: saving ? 'default' : 'pointer',
                    opacity: saving ? 0.7 : 1,
                  }}
                >
                  {saving ? 'Saving…' : 'Finish & go to dashboard'}
                  {!saving && <Check size={15} />}
                </button>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
