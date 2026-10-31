import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PlannerExams, PlannerSettings, fetchPlannerExams, fetchPlannerSettings, fetchShare, importShare } from '../../../services/plannerService';
import { MyPlan } from './MyPlan';
import { PlanSetup } from './PlanSetup';
import { PlannerToday } from './PlannerToday';
import { ProgressTracker } from './ProgressTracker';
import { RevisionPlan } from './RevisionPlan';
import { SyllabusCoverage } from './SyllabusCoverage';
import { Notice, btn, card } from './plannerUi';

export type PlannerTab = 'aaj' | 'plan' | 'progress' | 'syllabus' | 'revision';

/** Study Planner v2: the client's planner (Aaj / Plan / Progress / Syllabus / Revision), saved to the account. */
export function StudyPlannerV2({ tab, setTab, version, onChanged, onAddTask }: {
  tab: PlannerTab;
  setTab: (t: PlannerTab) => void;
  /** Bumped by the page when something outside (e.g. Add task) changes the student's tasks. */
  version: number;
  onChanged: () => void;
  onAddTask: () => void;
}) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [exams, setExams] = useState<PlannerExams | null>(null);
  const [settings, setSettings] = useState<PlannerSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState<{ message: string; warning: string | null } | null>(null);
  const [focusDate, setFocusDate] = useState<string | null>(null);
  const [share, setShare] = useState<{ token: string; text: string } | null>(null);

  const loadSettings = useCallback(() => fetchPlannerSettings().then(setSettings), []);

  useEffect(() => {
    Promise.all([fetchPlannerExams().then(setExams), loadSettings()]).catch((e) => setError(e.message));
  }, [loadSettings]);

  // A shared plan link: /study-planner?plan=<token>
  const token = params.get('plan');
  useEffect(() => {
    if (!token) return;
    setTab('plan');
    fetchShare(token)
      .then((s) => setShare({ token, text: `A shared plan was found${s.exam_label ? ` (${s.exam_label})` : ''}: ${s.tasks} tasks over ${s.days} days. Importing replaces your current plan.` }))
      .catch((e) => { setError(e.message); dropToken(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const dropToken = () => {
    params.delete('plan');
    setParams(params, { replace: true });
    setShare(null);
  };

  const doImport = async () => {
    if (!share) return;
    try {
      const r = await importShare(share.token);
      setGenerated({ message: `Shared plan imported: ${r.imported} tasks, starting today.`, warning: null });
      dropToken();
      onChanged();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const openDay = (date: string) => {
    setFocusDate(date);
    setTab('aaj');
  };
  const upgrade = () => navigate('/billing');

  if (error && (!exams || !settings)) return <Notice kind="error">{error}</Notice>;
  if (!exams || !settings) return <div style={card}>Loading your planner…</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {share && (
        <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', borderColor: 'var(--accent-border)' }}>
          <span style={{ flex: 1, minWidth: 200, fontSize: 13.5, color: 'var(--text-primary)' }}>{share.text}</span>
          <button type="button" style={btn(true)} onClick={doImport}>Import</button>
          <button type="button" style={btn()} onClick={dropToken}>Ignore</button>
        </div>
      )}
      {error && <Notice kind="error">{error}</Notice>}

      {tab === 'aaj' && <PlannerToday version={version} onChanged={onChanged} onAddTask={onAddTask} focusDate={focusDate} />}

      {tab === 'plan' && (
        <>
          <PlanSetup
            exams={exams}
            settings={settings}
            onUpgrade={upgrade}
            onGenerated={(message, warning) => {
              setGenerated({ message, warning });
              loadSettings().catch(() => {});
              onChanged();
            }}
          />
          {generated && <Notice kind="ok">{generated.message}</Notice>}
          {generated?.warning && <Notice kind="warn">{generated.warning}</Notice>}
          <MyPlan version={version} pro={settings.pro} onChanged={onChanged} onOpenDay={openDay} onUpgrade={upgrade} />
        </>
      )}

      {tab === 'progress' && <ProgressTracker version={version} onOpenDay={openDay} />}

      {tab === 'syllabus' && (
        <SyllabusCoverage exams={exams} version={version} initialExam={settings.prefs?.syllabus_id} onChanged={onChanged} />
      )}

      {tab === 'revision' && <RevisionPlan pro={settings.pro} onChanged={onChanged} onUpgrade={upgrade} />}
    </div>
  );
}
