import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { StudentLayout } from '../components/student/StudentLayout';
import {
  listExams,
  getAttemptStatusByExam,
  formatCanonicalExamTitle,
  fetchMasterSyllabus,
  fetchExamsByYear,
  startExamAttempt,
  listCandidateAttempts,
} from '../services/examService';
import { guardedFetch } from '../utils/apiGuard';
import { StatusBadge } from '../components/common/StatusBadge';
import { extractCanonicalExamName } from '../utils/formatEnum';
import { formatTaxonomyParam } from '../utils/taxonomyParam';
import {
  PlayCircle, BarChart2, RotateCcw, BookOpen, Target,
  ChevronDown, ArrowRight, ArrowLeft, Search, Check, X,
  Calendar, Layers, TrendingUp, Clock, Zap,
} from 'lucide-react';
import { Ico } from '../components/common/Icons';
import { useBreakpoint } from '../hooks/useBreakpoint';

const API_BASE_URL = '/api/v1';
type Screen = 'choice' | 'year' | 'subject' | 'analysis';

interface DisplayExam {
  id: number | string;
  code: string;
  year: number | string;
  title: string;
  totalQuestions: number;
  duration: string;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'NOT_STARTED';
  completedAttemptId?: number | string;
  inProgressAttemptId?: number | string;
  scoreText?: string;
}

/* ─── Shared data loaders ─────────────────────────────────────────── */
function usePublishedExams() {
  const [exams, setExams] = useState<DisplayExam[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('access_token');
        const [liveExams, statusByExam] = await Promise.all([
          listExams('PUBLISHED', true, token || undefined),
          getAttemptStatusByExam(token || undefined),
        ]);
        const published = liveExams.filter((e) => {
          if (!e.is_active || (e.status !== 'PUBLISHED' && e.status !== 'ExamStatus.PUBLISHED')) return false;
          
          const nameToExtract = e.name || e.title || e.exam_name || e.code || '';
          const lowerName = nameToExtract.toLowerCase();
          
          // Ignore dynamic/simulation exams
          if (lowerName.includes('subject-wise') || lowerName.includes('simulation') || e.code?.startsWith('DYN_')) {
            return false;
          }
          
          return true;
        });
        setExams(
          published.map((e) => {
            const att = statusByExam[String(e.id)];
            let status: DisplayExam['status'] = 'NOT_STARTED';
            if (att?.in_progress_attempt_id) status = 'IN_PROGRESS';
            else if (att?.completed_attempt_id) status = 'COMPLETED';
            return {
              id: e.id, code: e.code, year: e.source_year || 2025,
              title: formatCanonicalExamTitle(e),
              totalQuestions: 100, duration: `${e.total_duration_minutes || 120} mins`,
              status,
              completedAttemptId: att?.completed_attempt_id,
              inProgressAttemptId: att?.in_progress_attempt_id,
              scoreText: att?.completed_attempt_id ? `${att.total_score} / ${att.max_possible_score}` : undefined,
            };
          }),
        );
      } catch (_) {}
      finally { setLoading(false); }
    })();
  }, []);
  return { exams, loading };
}

/* ─── Reusable panel header ─────────────────────────────────────────── */
function PanelHead({
  icon, iconBg, iconColor, title, desc, onBack,
}: {
  icon: React.ReactNode; iconBg: string; iconColor: string;
  title: string; desc: string; onBack: () => void;
}) {
  return (
    <>
      <button
        onClick={onBack}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 18,
          fontSize: 13.5, fontWeight: 600, color: 'var(--text-muted)', cursor: 'pointer',
          padding: '6px 12px', borderRadius: 10, border: '1px solid var(--border-default)',
          backgroundColor: 'var(--bg-subtle)', transition: 'all 0.15s ease',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent-primary)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent-primary)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-default)'; }}
      >
        <ArrowLeft size={14} /> Change practice mode
      </button>
      <div style={{
        padding: '20px 24px', borderRadius: 'var(--radius)',
        border: '1px solid var(--border-default)', background: 'var(--bg-card)',
        marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <div style={{
          width: 46, height: 46, borderRadius: 'var(--radius)', flexShrink: 0,
          background: iconBg, color: iconColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{icon}</div>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, letterSpacing: '-0.015em' }}>{title}</h2>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)', margin: '2px 0 0 0' }}>{desc}</p>
        </div>
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   SCREEN 0 — Choice
══════════════════════════════════════════════════════════════════════ */
function ChoiceScreen({ onChoose }: { onChoose: (s: Screen) => void }) {
  const { isMobile } = useBreakpoint();
  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      {/* Intro */}
      <div style={{ textAlign: 'center', marginBottom: 36 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', backgroundColor: 'var(--accent-bg)', borderRadius: 999, marginBottom: 14, border: '1px solid var(--accent-border)' }}>
          <Target size={12} />
          <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>PYQs Simulation</span>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: '0 0 10px 0', letterSpacing: '-0.025em' }}>How do you want to practise?</h1>
        <p style={{ fontSize: 15, color: 'var(--text-muted)', margin: 0, maxWidth: '50ch', marginInline: 'auto', lineHeight: 1.6 }}>
          Pick a year to relive a full past paper, or build a set from any subject and topic. Both are timed like the real exam.
        </p>
      </div>

      {/* 2-column top cards + full-width bottom card */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
        {/* Year-wise card */}
        <ChoiceCard
          kind="year"
          icon={<Calendar size={22} />}
          iconBg="#eef0ff" iconColor="#4f46e5"
          title="Year-wise"
          desc="Solve every question from one year's paper, in order, as it actually appeared."
          bullets={['Pick a year and exam', 'Full original paper, no filtering']}
          cta="Start year-wise"
          onClick={() => onChoose('year')}
        />
        {/* Subject-wise card */}
        <ChoiceCard
          kind="subj"
          icon={<Layers size={22} />}
          iconBg="#fdebec" iconColor="#c73338"
          title="Subject-wise"
          desc="Choose a subject and topic. Every matching question from every year is pulled in — no limit."
          bullets={['Subject, topic and subtopic filters', 'Optionally narrow by year']}
          cta="Start subject-wise"
          onClick={() => onChoose('subject')}
        />
        {/* Analysis card — full width */}
        <button
          onClick={() => onChoose('analysis')}
          style={{
            gridColumn: '1 / -1', background: 'var(--bg-card)',
            border: '1px solid var(--border-default)', borderRadius: 'var(--radius)',
            padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 16,
            textAlign: 'left', cursor: 'pointer', transition: 'all 0.18s ease',
          }}
          onMouseEnter={(e) => {
            const b = e.currentTarget as HTMLButtonElement;
            b.style.borderColor = '#b9b4ff'; b.style.transform = 'translateY(-2px)';
            b.style.boxShadow = '0 14px 28px -16px rgba(79,70,229,.4)';
          }}
          onMouseLeave={(e) => {
            const b = e.currentTarget as HTMLButtonElement;
            b.style.borderColor = 'var(--border-default)'; b.style.transform = '';
            b.style.boxShadow = '';
          }}
        >
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#eafaf0', color: '#1b8a5b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <TrendingUp size={20} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 2 }}>PYQ frequency analysis</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>How many past-year questions exist for each subject and topic in the bank.</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5, fontWeight: 700, color: 'var(--accent-primary)', flexShrink: 0 }}>
            View analysis <ArrowRight size={15} />
          </div>
        </button>
      </div>
    </div>
  );
}

function ChoiceCard({
  kind, icon, iconBg, iconColor, title, desc, bullets, cta, onClick,
}: {
  kind: string; icon: React.ReactNode; iconBg: string; iconColor: string;
  title: string; desc: string; bullets: string[]; cta: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius)', padding: '28px 24px', textAlign: 'left',
        display: 'flex', flexDirection: 'column', gap: 14, cursor: 'pointer',
        transition: 'all 0.18s ease',
      }}
      onMouseEnter={(e) => {
        const b = e.currentTarget as HTMLButtonElement;
        b.style.borderColor = '#b9b4ff'; b.style.transform = 'translateY(-2px)';
        b.style.boxShadow = '0 18px 34px -20px rgba(79,70,229,.5)';
      }}
      onMouseLeave={(e) => {
        const b = e.currentTarget as HTMLButtonElement;
        b.style.borderColor = 'var(--border-default)'; b.style.transform = '';
        b.style.boxShadow = '';
      }}
    >
      <div style={{ width: 44, height: 44, borderRadius: 12, background: iconBg, color: iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </div>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 6px 0', letterSpacing: '-0.01em' }}>{title}</h2>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>{desc}</p>
      </div>
      <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
        {bullets.map((b) => (
          <li key={b} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: 'var(--text-secondary)' }}>
            <Check size={14} style={{ color: '#22a06b', flexShrink: 0 }} /> {b}
          </li>
        ))}
      </ul>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13.5, fontWeight: 700, color: 'var(--accent-primary)' }}>
        {cta} <ArrowRight size={14} />
      </div>
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   SCREEN 1 — Year-wise (PYQ Archive Grid)
══════════════════════════════════════════════════════════════════════ */
function YearWiseScreen({ onBack }: { onBack: () => void }) {
  const { exams: examsList, loading: isExamsLoading } = usePublishedExams();
  const [hoveredExam, setHoveredExam] = useState<number | string | null>(null);
  const [yearFilter, setYearFilter] = useState('All Years');
  const [examFilter, setExamFilter] = useState('All Exams');
  const [searchQuery, setSearchQuery] = useState('');

  const archiveYearOptions = useMemo(() => ['All Years', ...Array.from(new Set(examsList.map((e) => String(e.year)))).sort((a, b) => Number(b) - Number(a))], [examsList]);
  const archiveExamOptions = useMemo(() => {
    const names = Array.from(new Set(examsList.map((e) => {
      const t = e.title.toLowerCase();
      if (t.includes('upsc')) return 'UPSC CSE';
      if (t.includes('mpsc')) return 'MPSC';
      if (t.includes('mppsc')) return 'MPPSC';
      if (t.includes('bpsc')) return 'BPSC';
      return e.title.split(' ')[0];
    }))).sort();
    return ['All Exams', ...names];
  }, [examsList]);
  const filteredExams = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return examsList.filter((e) => {
      if (yearFilter !== 'All Years' && String(e.year) !== yearFilter) return false;
      if (examFilter !== 'All Exams' && !e.title.toLowerCase().includes(examFilter.toLowerCase().split(' ')[0])) return false;
      if (q && !e.title.toLowerCase().includes(q) && !String(e.code || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [examsList, yearFilter, examFilter, searchQuery]);

  return (
    <>
      <PanelHead
        icon={<Calendar size={22} />} iconBg="#eef0ff" iconColor="#4f46e5"
        title="Year-wise Analysis"
        desc="Pick the exam and year. Every question from that paper is included."
        onBack={onBack}
      />

      {/* Archive heading */}
      <div style={{ marginBottom: 18, padding: '20px 24px', borderRadius: 'var(--radius)', border: '1px solid var(--border-default)', background: 'linear-gradient(135deg,rgba(91,92,235,0.06) 0%,rgba(245,158,11,0.06) 100%), var(--bg-card)' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', backgroundColor: 'var(--accent-bg)', borderRadius: 999, marginBottom: 8, border: '1px solid var(--accent-border)' }}>
          <BookOpen size={12} />
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Authentic PYQ Archive</span>
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 3px 0' }}>Previous Year Papers</h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>Select an active paper to attempt or view your psychometric diagnostic report.</p>
      </div>

      {/* Filter bar */}
      <div style={{ marginBottom: 18, padding: '12px 16px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius)', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: '10px 14px' }}>
        <div style={{ minWidth: 130 }}>
          <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Exam</label>
          <select value={examFilter} onChange={(e) => setExamFilter(e.target.value)} style={{ width: '100%', height: 36, padding: '0 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-subtle)', color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, outline: 'none' }}>
            {archiveExamOptions.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div style={{ minWidth: 110 }}>
          <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Year</label>
          <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} style={{ width: '100%', height: 36, padding: '0 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-subtle)', color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, outline: 'none' }}>
            {archiveYearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Search</label>
          <div style={{ position: 'relative' }}>
            <Search size={13} color="var(--text-muted)" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search papers..." style={{ width: '100%', height: 36, padding: '0 10px 0 30px', borderRadius: 'var(--radius)', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-subtle)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          </div>
        </div>
      </div>

      {/* Exam grid */}
      {isExamsLoading ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ marginBottom: 12 }} />
          Fetching exam archive and attempt status...
        </div>
      ) : examsList.length === 0 ? (
        <div style={{ padding: 56, textAlign: 'center', backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius)', border: '1px solid var(--border-default)' }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, margin: '12px 0 6px 0' }}>No Approved PYQ Papers Available Yet</h3>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>Papers appear here once published by an administrator.</p>
        </div>
      ) : filteredExams.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius)', border: '1px solid var(--border-default)' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 6px 0' }}>No Papers Match Your Filters</h3>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>Try a different year or clear your search.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 18 }}>
          {filteredExams.map((exam) => {
            const hasCompleted = Boolean(exam.completedAttemptId);
            const hasInProgress = Boolean(exam.inProgressAttemptId);
            const isHov = hoveredExam === exam.id;
            return (
              <div
                key={exam.id}
                onMouseEnter={() => setHoveredExam(exam.id)}
                onMouseLeave={() => setHoveredExam(null)}
                style={{
                  backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius)', position: 'relative', overflow: 'hidden',
                  padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14,
                  border: `1px solid ${isHov ? 'var(--primary-red)' : hasCompleted ? '#A7F3D0' : 'var(--border-color)'}`,
                  boxShadow: isHov ? '0 8px 20px -4px rgba(15,23,42,0.10)' : '0 1px 3px rgba(15,23,42,0.04)',
                  transition: 'all 200ms cubic-bezier(0.16,1,0.3,1)', transform: isHov ? 'translateY(-3px)' : 'translateY(0)',
                }}
              >
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: 'var(--primary-red)', transform: isHov ? 'scaleX(1)' : 'scaleX(0)', transformOrigin: 'left center', transition: 'transform 250ms cubic-bezier(0.16,1,0.3,1)' }} />
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    {hasInProgress
                      ? <StatusBadge status="in-progress" label="In Progress" size="sm" />
                      : hasCompleted
                        ? <StatusBadge status="completed" label="Completed" size="sm" />
                        : <StatusBadge status="pyq" label={`${exam.year} Paper`} size="sm" />}
                    <Ico.Book size={18} />
                  </div>
                  <h3 style={{ fontSize: 16.5, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 7px 0', lineHeight: 1.35 }}>{exam.title}</h3>
                  <div style={{ display: 'flex', gap: 12, fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>
                    <span>{exam.totalQuestions} Qs</span><span>•</span><span>{exam.duration}</span>
                  </div>
                  {hasCompleted && exam.scoreText && (
                    <div style={{ marginTop: 10, padding: '7px 11px', borderRadius: 10, backgroundColor: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', fontSize: 12.5, color: '#3A8B53', fontWeight: 700, display: 'flex', justifyContent: 'space-between' }}>
                      <span>Report Ready</span><span>Score: {exam.scoreText}</span>
                    </div>
                  )}
                </div>
                <div style={{ paddingTop: 12, borderTop: '1px solid var(--border-default)', display: 'flex', gap: 8 }}>
                  {hasInProgress ? (
                    <>
                      <Link to={`/exam/${exam.id}?type=PYQ`} style={{ flex: 1, padding: '8px 12px', borderRadius: 'var(--radius)', backgroundColor: '#F2B623', color: '#000', fontWeight: 700, fontSize: 13, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}><PlayCircle size={13} /> Resume</Link>
                      {hasCompleted && <Link to={`/analytics?attemptId=${exam.completedAttemptId}`} style={{ padding: '8px 12px', borderRadius: 'var(--radius)', backgroundColor: 'var(--primary-red)', color: '#fff', fontWeight: 700, fontSize: 13, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}><BarChart2 size={13} /> Report</Link>}
                      <Link to={`/exam/${exam.id}?forceNew=true&type=PYQ`} style={{ padding: '8px 12px', borderRadius: 'var(--radius)', backgroundColor: 'var(--bg-subtle)', color: 'var(--text-primary)', fontWeight: 600, fontSize: 13, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, border: '1px solid var(--border-default)' }}><RotateCcw size={13} /></Link>
                    </>
                  ) : hasCompleted ? (
                    <>
                      <Link to={`/analytics?attemptId=${exam.completedAttemptId}`} style={{ flex: 1, padding: '8px 12px', borderRadius: 'var(--radius)', backgroundColor: 'var(--primary-red)', color: '#fff', fontWeight: 700, fontSize: 13, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}><BarChart2 size={13} /> View Report</Link>
                      <Link to={`/exam/${exam.id}?forceNew=true&type=PYQ`} style={{ padding: '8px 12px', borderRadius: 'var(--radius)', backgroundColor: 'var(--bg-subtle)', color: 'var(--text-primary)', fontWeight: 600, fontSize: 13, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, border: '1px solid var(--border-default)' }}><RotateCcw size={13} /> Retake</Link>
                    </>
                  ) : (
                    <Link to={`/exam/${exam.id}?type=PYQ`} style={{ flex: 1, padding: '8px 12px', borderRadius: 'var(--radius)', backgroundColor: 'var(--accent-primary)', color: '#fff', fontWeight: 700, fontSize: 13, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                      Start Paper <ArrowRight size={13} />
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   SCREEN 2 — Subject-wise form
══════════════════════════════════════════════════════════════════════ */
function SubjectWiseScreen({ onBack }: { onBack: () => void }) {
  const { isMobile } = useBreakpoint();
  const navigate = useNavigate();
  const [masterSyllabus, setMasterSyllabus] = useState<any>(null);
  const [availableExams, setAvailableExams] = useState<string[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [examToYears, setExamToYears] = useState<Record<string, number[]>>({});
  const [loading, setLoading] = useState(true);

  // Form state
  const [selExams, setSelExams] = useState<string[]>(['all']);
  const [selYears, setSelYears] = useState<string[]>(['all']);
  const [selSubject, setSelSubject] = useState('all');
  const [selTopic, setSelTopic] = useState('all');
  const [selSubtopic, setSelSubtopic] = useState('all');
  const [qSize, setQSize] = useState('all');
  const [customCount, setCustomCount] = useState('');
  
  // Past dynamic attempts
  const [pastAttempts, setPastAttempts] = useState<any[]>([]);
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [yearsData, publishedExams, syllabus, allAttempts] = await Promise.all([
          fetchExamsByYear().catch(() => null),
          listExams('PUBLISHED').catch(() => []),
          fetchMasterSyllabus().catch(() => null),
          listCandidateAttempts().catch(() => []),
        ]);
        if (syllabus) setMasterSyllabus(syllabus);
        if (yearsData?.years) setAvailableYears([...yearsData.years].sort((a: number, b: number) => b - a));
        
        const names: string[] = [];
        const mapping: Record<string, Set<number>> = {};
        
        if (Array.isArray(publishedExams)) {
          publishedExams.forEach((e: any) => {
            const nameToExtract = e.name || e.title || e.exam_name || e.code || '';
            const lowerName = nameToExtract.toLowerCase();
            
            // Ignore dynamic/simulation exams
            if (lowerName.includes('subject-wise') || lowerName.includes('simulation') || e.code?.startsWith('DYN_')) {
              return;
            }
            
            const c = extractCanonicalExamName(nameToExtract);
            if (c) {
              names.push(c);
              const year = e.source_year || e.year;
              if (year) {
                if (!mapping[c]) mapping[c] = new Set();
                mapping[c].add(Number(year));
              }
            }
          });
        }
        
        const finalMapping: Record<string, number[]> = {};
        for (const ex in mapping) {
          finalMapping[ex] = Array.from(mapping[ex]).sort((a, b) => b - a);
        }
        setExamToYears(finalMapping);
        
        const distinct = Array.from(new Set(names)) as string[];
        distinct.sort((a, b) => (a === 'UPSC CSE' ? -1 : b === 'UPSC CSE' ? 1 : a.localeCompare(b)));
        setAvailableExams(distinct.length > 0 ? distinct : ['UPSC CSE']);
        
        // Filter dynamic attempts
        if (Array.isArray(allAttempts)) {
           const dynAttempts = allAttempts.filter(a => a.exam?.code?.startsWith('DYN_') || a.exam_name?.includes('Subject-wise Simulation') || a.exam_name?.includes('Simulation'));
           setPastAttempts(dynAttempts);
        }
      } catch (_) {}
      finally { setLoading(false); }
    })();
  }, []);

  const subjectsList = useMemo<string[]>(() => Object.keys(masterSyllabus?.hierarchy || {}), [masterSyllabus]);
  const topicsList = useMemo<string[]>(() => {
    const h = masterSyllabus?.hierarchy || {};
    if (selSubject === 'all' || !h[selSubject]) return [];
    return Object.keys(h[selSubject]);
  }, [selSubject, masterSyllabus]);
  const subtopicsList = useMemo<string[]>(() => {
    const h = masterSyllabus?.hierarchy || {};
    if (selSubject === 'all' || selTopic === 'all') return [];
    return (h[selSubject]?.[selTopic] || []).filter((s: string) => !s.startsWith('All'));
  }, [selSubject, selTopic, masterSyllabus]);

  const toggleExam = (v: string) => {
    if (v === 'all') { setSelExams(['all']); return; }
    const next = selExams.filter((x) => x !== 'all');
    setSelExams(next.includes(v) ? next.filter((x) => x !== v) || ['all'] : [...next, v]);
  };
  const toggleYear = (v: string) => {
    if (v === 'all') { setSelYears(['all']); return; }
    const next = selYears.filter((x) => x !== 'all');
    setSelYears(next.includes(v) ? next.filter((x) => x !== v) || ['all'] : [...next, v]);
  };

  const estTime = (() => {
    if (qSize === 'all') return '—';
    const n = qSize === 'custom' ? Number(customCount) || 0 : Number(qSize);
    const m = Math.round((n * 72) / 60);
    return `${m} min`;
  })();

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isStarting) return;
    setIsStarting(true);
    
    try {
      const exs = selExams.filter((x) => x !== 'all');
      const yrs = selYears.filter((x) => x !== 'all');
      const qLimit = qSize === 'custom' && customCount ? Number(customCount) : (qSize !== 'all' ? Number(qSize) : 100);
      
      const payload: any = {
        exam_id: 'dynamic',
        force_new: true,
        dynamic_limit: qLimit || 100,
      };
      if (selSubject !== 'all') payload.dynamic_subject = selSubject;
      if (selTopic !== 'all') payload.dynamic_topic = selTopic;
      if (selSubtopic !== 'all') payload.dynamic_subtopic = selSubtopic;
      if (exs.length) payload.dynamic_exams = exs.join(',');
      if (yrs.length) payload.dynamic_years = yrs.join(',');
      
      const res = await startExamAttempt(payload);
      navigate(`/exam/${res.attempt_id}?type=PYQ`);
    } catch (err) {
      console.error(err);
      alert('Failed to start dynamic test. Please try again.');
      setIsStarting(false);
    }
  };

  const selStyle = {
    appearance: 'none' as const, width: '100%', height: 40, padding: '0 32px 0 12px',
    border: '1px solid var(--border-default)', borderRadius: 'var(--radius)',
    background: 'var(--bg-subtle)', fontWeight: 600, fontSize: 13.5,
    color: 'var(--text-primary)', outline: 'none',
  };
  const chipStyle = (active: boolean) => ({
    height: 32, padding: '0 12px', borderRadius: 999, border: `1px solid ${active ? 'var(--accent-primary)' : 'var(--border-default)'}`,
    background: active ? 'var(--accent-primary)' : 'var(--bg-card)', color: active ? '#fff' : 'var(--text-secondary)',
    fontWeight: 600, fontSize: 12.5, display: 'inline-flex', alignItems: 'center', gap: 6,
    cursor: 'pointer', transition: 'all 0.15s ease', boxShadow: active ? '0 4px 10px -4px rgba(79,70,229,.6)' : 'none',
  });

  return (
    <>
      <PanelHead
        icon={<Layers size={22} />} iconBg="#fdebec" iconColor="#c73338"
        title="Subject-wise simulation"
        desc="Choose a subject and topic. Every matching question is included, from any year."
        onBack={onBack}
      />

      <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius)', overflow: 'hidden', boxShadow: '0 2px 8px rgba(15,23,42,.06)' }}>
        {/* Dark header */}
        <div style={{ padding: '16px 20px', background: 'radial-gradient(120% 90% at 100% 0,rgba(217,36,58,.3) 0,transparent 60%),linear-gradient(120deg,#141c31 0%,#241c4a 65%,#33193c 100%)', color: '#fff', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg,#6d5ef0,#4f46e5)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 20px -8px rgba(79,70,229,.9)' }}><Zap size={18} fill="#fff" color="#fff" /></div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.015em' }}>Build your test set</div>
            <div style={{ fontSize: 12, color: '#b9c3e2', marginTop: 2 }}>Filter questions by exam, subject, topic and year</div>
          </div>
        </div>

        <form onSubmit={handleStart} style={{ padding: '20px 24px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}><div className="spinner" style={{ marginBottom: 8 }} />Loading...</div>
          ) : (
            <>
              {/* Exam chips */}
              <div>
                <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Exam (pick one or more)</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  <button type="button" onClick={() => toggleExam('all')} style={chipStyle(selExams.includes('all'))}>All exams</button>
                  {availableExams.map((ex) => (
                    <button type="button" key={ex} onClick={() => toggleExam(ex)} style={chipStyle(selExams.includes(ex))}>{ex}</button>
                  ))}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 5 }}>Questions will be pulled from every exam you select</div>
              </div>

              {/* Subject + Topic */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 7 }}>Subject</label>
                  <div style={{ position: 'relative' }}>
                    <select value={selSubject} onChange={(e) => { setSelSubject(e.target.value); setSelTopic('all'); setSelSubtopic('all'); }} style={selStyle}>
                      <option value="all">All subjects</option>
                      {subjectsList.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <ChevronDown size={15} color="var(--text-muted)" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 7 }}>Topic</label>
                  <div style={{ position: 'relative' }}>
                    <select value={selTopic} onChange={(e) => { setSelTopic(e.target.value); setSelSubtopic('all'); }} disabled={selSubject === 'all'} style={{ ...selStyle, color: selSubject === 'all' ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                      <option value="all">All topics</option>
                      {topicsList.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <ChevronDown size={15} color="var(--text-muted)" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                  </div>
                </div>
              </div>

              {/* Filters */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 7 }}>Subtopic</label>
                  <div style={{ position: 'relative' }}>
                    <select value={selSubtopic} onChange={(e) => setSelSubtopic(e.target.value)} disabled={selTopic === 'all'} style={{ ...selStyle, color: selTopic === 'all' ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                      <option value="all">All subtopics</option>
                      {subtopicsList.map((st) => <option key={st} value={st}>{st}</option>)}
                    </select>
                    <ChevronDown size={15} color="var(--text-muted)" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                  </div>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Years (optional)</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    <button type="button" onClick={() => toggleYear('all')} style={chipStyle(selYears.includes('all'))}>All years</button>
                    {(() => {
                      let yearsToShow = availableYears;
                      if (!selExams.includes('all')) {
                        const yearsSet = new Set<number>();
                        selExams.forEach(ex => {
                          if (examToYears[ex]) examToYears[ex].forEach(yr => yearsSet.add(yr));
                        });
                        yearsToShow = Array.from(yearsSet).sort((a, b) => b - a);
                      }
                      return yearsToShow.slice(0, 6).map((yr) => (
                        <button type="button" key={yr} onClick={() => toggleYear(String(yr))} style={chipStyle(selYears.includes(String(yr)))}>{yr}</button>
                      ));
                    })()}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 6 }}>Pick one or more years, or leave on "All years"</div>
                </div>
              </div>

              {/* Number of questions */}
              <div>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Number of questions</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {['all', '10', '20', '30', '50', 'custom'].map((v) => (
                    <button type="button" key={v} onClick={() => setQSize(v)} style={chipStyle(qSize === v)}>
                      {v === 'all' ? 'All available' : v === 'custom' ? 'Custom' : v}
                    </button>
                  ))}
                </div>
                {qSize === 'custom' && (
                  <input type="number" value={customCount} onChange={(e) => setCustomCount(e.target.value)} placeholder="e.g. 75" min={1} style={{ marginTop: 10, width: 140, height: 40, padding: '0 12px', border: '1px solid var(--border-default)', borderRadius: 10, fontWeight: 700, fontSize: 14, outline: 'none', backgroundColor: 'var(--bg-subtle)', color: 'var(--text-primary)' }} />
                )}
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 7 }}>
                  {qSize === 'all' ? 'Test will include all matching questions' : `Test will include ${qSize === 'custom' ? customCount || '—' : qSize} questions`}
                </div>
              </div>

              {/* Timebox */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius)', border: '1px solid var(--border-default)' }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid var(--border-default)' }}>
                  <Clock size={16} color="var(--text-muted)" />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{estTime === '—' ? 'Time will be calculated from question count' : `Estimated time: ${estTime}`}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>One overall timer for the whole set, worked out from the question count</div>
                </div>
              </div>

              {/* Footer */}
              <div style={{ display: 'flex', gap: 10, paddingTop: 4, borderTop: '1px solid var(--border-default)' }}>
                <button type="button" onClick={onBack} style={{ height: 50, padding: '0 20px', borderRadius: 'var(--radius)', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-subtle)', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={isStarting} style={{ flex: 1, height: 50, borderRadius: 'var(--radius)', background: 'linear-gradient(90deg,#5236d9 0%,#d9243a 100%)', color: '#fff', fontWeight: 800, fontSize: 15.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: isStarting ? 'not-allowed' : 'pointer', border: 'none', boxShadow: '0 14px 26px -12px rgba(217,36,58,.75)', letterSpacing: '-0.01em', opacity: isStarting ? 0.7 : 1 }}>
                  {isStarting ? 'Preparing test...' : 'Start test'} <ArrowRight size={16} />
                </button>
              </div>
            </>
          )}
        </form>
      </div>

      {/* Past Dynamic Attempts */}
      {pastAttempts.length > 0 && (
        <div style={{ marginTop: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <RotateCcw size={20} color="var(--accent-primary)" />
            <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Past Subject-wise Tests</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 18 }}>
            {pastAttempts.map((attempt) => {
              const meta = attempt.report_metadata_json || {};
              const subj = meta.dynamic_subject && meta.dynamic_subject !== 'all' ? meta.dynamic_subject : 'Subject-wise Test';
              const top = meta.dynamic_topic && meta.dynamic_topic !== 'all' ? meta.dynamic_topic : '';
              const title = top ? `${subj} - ${top}` : subj;
              const hasCompleted = attempt.status === 'COMPLETED' || attempt.status === 'SUBMITTED' || attempt.status === 'EVALUATED';
              const hasInProgress = attempt.status === 'IN_PROGRESS';
              
              return (
                <div
                  key={attempt.id}
                  style={{
                    backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius)', position: 'relative', overflow: 'hidden',
                    padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14,
                    border: `1px solid ${hasCompleted ? '#A7F3D0' : 'var(--border-color)'}`,
                    boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      {hasInProgress
                        ? <StatusBadge status="in-progress" label="In Progress" size="sm" />
                        : hasCompleted
                          ? <StatusBadge status="completed" label="Completed" size="sm" />
                          : <StatusBadge status="pyq" label="Simulation" size="sm" />}
                      <Layers size={18} color="var(--text-muted)" />
                    </div>
                    <h3 style={{ fontSize: 16.5, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 7px 0', lineHeight: 1.35 }}>{title}</h3>
                    <div style={{ display: 'flex', gap: 12, fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>
                      <span>{attempt.total_questions} Qs</span><span>•</span><span>{Math.round((attempt.max_duration_seconds || 7200)/60)} mins</span>
                    </div>
                    {hasCompleted && attempt.total_score !== undefined && (
                      <div style={{ marginTop: 10, padding: '7px 11px', borderRadius: 10, backgroundColor: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', fontSize: 12.5, color: '#3A8B53', fontWeight: 700, display: 'flex', justifyContent: 'space-between' }}>
                        <span>Report Ready</span><span>Score: {attempt.total_score} / {attempt.max_possible_score}</span>
                      </div>
                    )}
                  </div>
                  <div style={{ paddingTop: 12, borderTop: '1px solid var(--border-default)', display: 'flex', gap: 8 }}>
                    {hasInProgress ? (
                      <>
                        <Link to={`/exam/${attempt.id}?type=PYQ`} style={{ flex: 1, padding: '8px 12px', borderRadius: 'var(--radius)', backgroundColor: '#F2B623', color: '#000', fontWeight: 700, fontSize: 13, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}><PlayCircle size={13} /> Resume</Link>
                        <Link to={`/exam/${attempt.exam_id || attempt.exam?.id}?forceNew=true&type=PYQ`} style={{ padding: '8px 12px', borderRadius: 'var(--radius)', backgroundColor: 'var(--bg-subtle)', color: 'var(--text-primary)', fontWeight: 600, fontSize: 13, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, border: '1px solid var(--border-default)' }}><RotateCcw size={13} /></Link>
                      </>
                    ) : (
                      <>
                        <Link to={`/analytics?attemptId=${attempt.id}`} style={{ flex: 1, padding: '8px 12px', borderRadius: 'var(--radius)', backgroundColor: 'var(--primary-red)', color: '#fff', fontWeight: 700, fontSize: 13, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}><BarChart2 size={13} /> View Report</Link>
                        <Link to={`/exam/${attempt.exam_id || attempt.exam?.id}?forceNew=true&type=PYQ`} style={{ padding: '8px 12px', borderRadius: 'var(--radius)', backgroundColor: 'var(--bg-subtle)', color: 'var(--text-primary)', fontWeight: 600, fontSize: 13, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, border: '1px solid var(--border-default)' }}><RotateCcw size={13} /> Retake</Link>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   SCREEN 3 — Frequency Analysis
══════════════════════════════════════════════════════════════════════ */
function AnalysisScreen({ onBack }: { onBack: () => void }) {
  const { isMobile } = useBreakpoint();
  const navigate = useNavigate();
  const [freqExamFilter, setFreqExamFilter] = useState('all');
  const [freqYearFilter, setFreqYearFilter] = useState('all');
  const [freqData, setFreqData] = useState<{ name: string; count: number }[]>([]);
  const [freqTopicData, setFreqTopicData] = useState<Record<string, { topic: string; count: number }[]>>({});
  const [yearwiseTableData, setYearwiseTableData] = useState<any>(null);
  const [freqLoading, setFreqLoading] = useState(true);
  const [expandedSubject, setExpandedSubject] = useState<string | null>(null);
  const [availableExams, setAvailableExams] = useState<{ val: string; label: string }[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [summary, setSummary] = useState('Showing: all exams, all years');

  const [allExamsData, setAllExamsData] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const publishedExams = await listExams('PUBLISHED').catch(() => []);
        setAllExamsData(publishedExams);
        const names: { val: string; label: string }[] = [];
        (publishedExams as any[]).forEach((e: any) => {
          const c = extractCanonicalExamName(e.name || e.title || e.exam_name || e.code);
          if (c) {
            const val = c.toLowerCase().includes('upsc') ? 'upsc' : c.toLowerCase().split(' ')[0];
            names.push({ val, label: c });
          }
        });
        const distinct = Array.from(new Map(names.map((n) => [n.val, n])).values());
        setAvailableExams(distinct);
      } catch (_) {}
    })();
  }, []);

  useEffect(() => {
    if (allExamsData.length === 0) return;
    const years = new Set<number>();
    allExamsData.forEach(e => {
       const c = extractCanonicalExamName(e.name || e.title || e.exam_name || e.code);
       if (c) {
          const val = c.toLowerCase().includes('upsc') ? 'upsc' : c.toLowerCase().split(' ')[0];
          if (freqExamFilter === 'all' || freqExamFilter === val) {
             const y = Number(e.source_year || e.year);
             if (y && !isNaN(y)) years.add(y);
          }
       }
    });
    const sortedYears = Array.from(years).sort((a,b) => b-a);
    setAvailableYears(sortedYears);
    if (freqYearFilter !== 'all' && !sortedYears.includes(Number(freqYearFilter))) {
       setFreqYearFilter('all');
    }
  }, [allExamsData, freqExamFilter]);

  useEffect(() => {
    (async () => {
      setFreqLoading(true);
      try {
        const params = new URLSearchParams({ limit: '100', language: 'en', include_solutions: 'false' });
        if (freqExamFilter !== 'all') params.set('exam_name', freqExamFilter);
        if (freqYearFilter !== 'all') params.set('exam_year', freqYearFilter);
        const firstRes = await guardedFetch(`${API_BASE_URL}/questions?${params}`);
        const firstData = await firstRes.json();
        let items: any[] = firstData?.items || [];
        
        const totalPages = firstData?.pages || 1;
        if (totalPages > 1) {
           const maxPages = Math.min(totalPages, 50);
           const promises = [];
           for (let p = 2; p <= maxPages; p++) {
              const pParams = new URLSearchParams(params);
              pParams.set('page', String(p));
              promises.push(guardedFetch(`${API_BASE_URL}/questions?${pParams}`).then(r => r.json()).catch(() => ({items: []})));
           }
           const results = await Promise.all(promises);
           results.forEach(res => {
              if (res?.items) items = items.concat(res.items);
           });
        }

        const subjCount: Record<string, number> = {};
        const subjTopicCount: Record<string, Record<string, number>> = {};
        const subjYearCount: Record<string, Record<number, number>> = {};
        const allYearsSet = new Set<number>();

        items.forEach((q: any) => {
          const h = q.hierarchy?.[0] || {};
          const subj = h.subject_name || 'Uncategorized';
          const topic = h.topic_name || 'General';
          const year = q.source_year;
          subjCount[subj] = (subjCount[subj] || 0) + 1;
          if (!subjTopicCount[subj]) subjTopicCount[subj] = {};
          subjTopicCount[subj][topic] = (subjTopicCount[subj][topic] || 0) + 1;
          if (year) {
            allYearsSet.add(year);
            if (!subjYearCount[subj]) subjYearCount[subj] = {};
            subjYearCount[subj][year] = (subjYearCount[subj][year] || 0) + 1;
          }
        });

        const sorted = Object.entries(subjCount).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
        setFreqData(sorted);
        const topicBD: Record<string, { topic: string; count: number }[]> = {};
        Object.entries(subjTopicCount).forEach(([s, tm]) => {
          topicBD[s] = Object.entries(tm).sort((a, b) => b[1] - a[1]).map(([topic, count]) => ({ topic, count }));
        });
        setFreqTopicData(topicBD);

        const sortedYears = [...allYearsSet].sort((a, b) => b - a);
        const tableSubjects = sorted.map((s) => s.name);
        const table: any = { subjects: tableSubjects, years: sortedYears, cells: {}, rowTotals: {}, colTotals: {} };
        tableSubjects.forEach((subj) => {
          table.cells[subj] = {};
          table.rowTotals[subj] = subjCount[subj] || 0;
          sortedYears.forEach((yr) => {
            table.cells[subj][yr] = (subjYearCount[subj] || {})[yr] || 0;
            table.colTotals[yr] = (table.colTotals[yr] || 0) + table.cells[subj][yr];
          });
        });
        setYearwiseTableData(table);

        const examLabel = freqExamFilter === 'all' ? 'all exams' : (availableExams.find((x) => x.val === freqExamFilter)?.label ?? freqExamFilter);
        const yearLabel = freqYearFilter === 'all' ? 'all years' : freqYearFilter;
        setSummary(`Showing: ${examLabel}, ${yearLabel}`);
      } catch (_) {}
      finally { setFreqLoading(false); }
    })();
  }, [freqExamFilter, freqYearFilter, availableExams]);

  return (
    <>
      <PanelHead
        icon={<TrendingUp size={22} />} iconBg="#eafaf0" iconColor="#1b8a5b"
        title="PYQ frequency analysis"
        desc="How many past-year questions exist for each subject and topic. Tap a subject to see its topic-wise split."
        onBack={onBack}
      />

      <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius)', overflow: 'hidden', boxShadow: '0 2px 8px rgba(15,23,42,.06)' }}>
        {/* Filters */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-default)' }}>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Exam</label>
              <div style={{ position: 'relative' }}>
                <select value={freqExamFilter} onChange={(e) => setFreqExamFilter(e.target.value)} style={{ height: 40, padding: '0 36px 0 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-subtle)', color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, outline: 'none', appearance: 'none' }}>
                  <option value="all">All exams</option>
                  {availableExams.map((ex) => <option key={ex.val} value={ex.val}>{ex.label}</option>)}
                </select>
                <ChevronDown size={13} color="var(--text-muted)" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Year</label>
              <div style={{ position: 'relative' }}>
                <select value={freqYearFilter} onChange={(e) => setFreqYearFilter(e.target.value)} style={{ height: 40, padding: '0 36px 0 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-subtle)', color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, outline: 'none', appearance: 'none' }}>
                  <option value="all">All years</option>
                  {availableYears.map((yr) => <option key={yr} value={String(yr)}>{yr}</option>)}
                </select>
                <ChevronDown size={13} color="var(--text-muted)" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              </div>
            </div>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '10px 0 0 0' }}>{summary}</p>
        </div>

        <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 28 }}>
          {freqLoading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}><div className="spinner" style={{ marginBottom: 10 }} />Computing frequency data...</div>
          ) : (
            <>
              {/* Subject frequency bars */}
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 14px 0', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Subject-wise count</h3>
                {freqData.length === 0
                  ? <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No data for selected filters.</p>
                  : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {freqData.slice(0, 10).map(({ name, count }, i) => {
                        const pct = Math.round((count / (freqData[0]?.count || 1)) * 100);
                        const isExp = expandedSubject === name;
                        return (
                          <div key={name}>
                            <button
                              onClick={() => setExpandedSubject(isExp ? null : name)}
                              style={{
                                width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                                padding: '10px 14px', borderRadius: 12,
                                border: `1px solid ${isExp ? 'var(--accent-primary)' : 'var(--border-default)'}`,
                                background: isExp ? 'var(--accent-bg)' : 'var(--bg-subtle)',
                                cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s ease',
                              }}
                            >
                              <div style={{ width: 28, height: 28, borderRadius: 8, background: isExp ? 'var(--accent-primary)' : 'var(--border-default)', color: isExp ? '#fff' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>{i + 1}</div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13.5, fontWeight: 700, color: isExp ? 'var(--accent-primary)' : 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
                                <div style={{ marginTop: 5, height: 5, borderRadius: 3, background: 'var(--border-default)', overflow: 'hidden' }}>
                                  <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: isExp ? 'var(--accent-primary)' : 'linear-gradient(90deg,#5236d9,#d9243a)', transition: 'width 0.4s ease' }} />
                                </div>
                              </div>
                              <span style={{ fontSize: 15, fontWeight: 800, color: isExp ? 'var(--accent-primary)' : 'var(--text-primary)', minWidth: 36, textAlign: 'right' }}>{count}</span>
                              <ChevronDown size={14} color="var(--text-muted)" style={{ transform: isExp ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }} />
                            </button>
                            {isExp && freqTopicData[name] && (
                              <div style={{ margin: '6px 0 6px 12px', padding: '14px 16px', borderRadius: 12, backgroundColor: 'var(--bg-card)', border: '1px solid var(--accent-border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{name} — topic-wise</div>
                                {freqTopicData[name].slice(0, 10).map(({ topic, count: tc }) => (
                                  <div key={topic} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 10, alignItems: 'center' }}>
                                    <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{topic}</span>
                                    <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--text-primary)' }}>{tc} Qs</span>
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); navigate(`/practice-exam?subject=${encodeURIComponent(name)}&topic=${encodeURIComponent(topic)}`); }}
                                      style={{ height: 28, padding: '0 10px', borderRadius: 8, background: 'var(--accent-bg)', color: 'var(--accent-primary)', border: '1px solid var(--accent-border)', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
                                    >
                                      Practice
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
              </div>

              {/* Year-wise table */}
              {yearwiseTableData && yearwiseTableData.years.length > 0 && (
                <div>
                  <h3 id="pyqYrH" style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 14px 0', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Year-wise PYQ Analysis{freqExamFilter !== 'all' && <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', textTransform: 'none', letterSpacing: 0, marginLeft: 8 }}>— {availableExams.find((x) => x.val === freqExamFilter)?.label ?? freqExamFilter}</span>}
                  </h3>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 480 }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', padding: '8px 10px 8px 0', color: 'var(--text-muted)', fontWeight: 700, borderBottom: '2px solid var(--border-default)', whiteSpace: 'nowrap' }}>Subject</th>
                          {yearwiseTableData.years.map((yr: number) => (
                            <th key={yr} style={{ textAlign: 'center', padding: '8px 10px', color: 'var(--text-muted)', fontWeight: 700, borderBottom: '2px solid var(--border-default)', whiteSpace: 'nowrap' }}>{yr}</th>
                          ))}
                          <th style={{ textAlign: 'center', padding: '8px 10px', color: 'var(--text-primary)', fontWeight: 800, borderBottom: '2px solid var(--border-default)' }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {yearwiseTableData.subjects.map((subj: string) => (
                          <tr key={subj} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <td style={{ padding: '9px 10px 9px 0', fontWeight: 600, color: 'var(--text-primary)', maxWidth: 130, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={subj}>{subj}</td>
                            {yearwiseTableData.years.map((yr: number) => {
                              const val = yearwiseTableData.cells[subj]?.[yr] || 0;
                              return <td key={yr} style={{ textAlign: 'center', padding: '9px 10px', fontWeight: val > 0 ? 700 : 400, color: val > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>{val > 0 ? val : '—'}</td>;
                            })}
                            <td style={{ textAlign: 'center', padding: '9px 10px', fontWeight: 800, color: 'var(--accent-primary)' }}>{yearwiseTableData.rowTotals[subj] || 0}</td>
                          </tr>
                        ))}
                        <tr style={{ borderTop: '2px solid var(--border-default)' }}>
                          <td style={{ padding: '9px 10px 9px 0', fontWeight: 800, color: 'var(--text-primary)' }}>Total</td>
                          {yearwiseTableData.years.map((yr: number) => (
                            <td key={yr} style={{ textAlign: 'center', padding: '9px 10px', fontWeight: 800, color: 'var(--text-primary)' }}>{yearwiseTableData.colTotals[yr] || 0}</td>
                          ))}
                          <td style={{ textAlign: 'center', padding: '9px 10px', fontWeight: 800, color: 'var(--accent-primary)' }}>
                            {yearwiseTableData.subjects.reduce((s: number, sub: string) => s + (yearwiseTableData.rowTotals[sub] || 0), 0)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   ROOT PAGE
══════════════════════════════════════════════════════════════════════ */
export function PYQSelectionPage() {
  const [screen, setScreen] = useState<Screen>('choice');

  return (
    <StudentLayout pageTitle="PYQs Simulation">
      <div style={{ animation: 'fadeIn 0.22s ease' }}>
        {screen === 'choice' && <ChoiceScreen onChoose={setScreen} />}
        {screen === 'year' && <YearWiseScreen onBack={() => setScreen('choice')} />}
        {screen === 'subject' && <SubjectWiseScreen onBack={() => setScreen('choice')} />}
        {screen === 'analysis' && <AnalysisScreen onBack={() => setScreen('choice')} />}
      </div>
    </StudentLayout>
  );
}
