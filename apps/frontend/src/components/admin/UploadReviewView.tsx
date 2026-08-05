import React, { useState } from 'react';
import {
  CheckCircle2,
  Upload,
  FileText,
  ChevronDown,
  AlertTriangle,
  X,
  Eye,
  Edit3,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  Target,
  BookOpen,
  Loader2,
  ImageIcon,
  Shield,
  Clock,
  Zap,
  Info,
  Save,
  Send,
  Calendar,
  Maximize2,
  Filter,
  Cloud,
} from 'lucide-react';
import { useExamUpload } from '../../hooks/useExamUpload';
import { EXAM_OPTIONS, PAPER_TYPE_OPTIONS, YEAR_OPTIONS } from '../../constants/exam';

/* ── Stepper Component ── */
const steps = [
  'Select Exam',
  'Upload PDF',
  'OCR Processing',
  'AI Extraction',
  'Question Review',
  'Publish',
];

function Stepper({ current }: { current: number }) {
  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: 16,
        padding: '20px 32px',
        marginBottom: 24,
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {steps.map((step, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: i < current ? '#10b981' : i === current ? '#2563eb' : 'var(--bg-secondary)',
                border: i === current ? '2px solid #2563eb' : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: i === current ? '0 0 0 4px rgba(37,99,235,0.15)' : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              {i < current ? (
                <CheckCircle2 size={18} color="#fff" />
              ) : (
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: i === current ? '#fff' : 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {i + 1}
                </span>
              )}
            </div>
            <span
              style={{
                fontSize: 12,
                fontWeight: i === current ? 700 : 500,
                color: i < current ? '#10b981' : i === current ? '#2563eb' : 'var(--text-muted)',
                fontFamily: 'var(--font-body)',
                whiteSpace: 'nowrap',
              }}
            >
              {step}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              style={{
                flex: 1,
                height: 2,
                background: i < current ? '#10b981' : 'var(--border-color)',
                marginTop: -20,
                minWidth: 32,
                transition: 'all 0.3s ease',
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

/* ── AI Processing Panel ── */
const aiStages = [
  { label: 'PDF Uploaded', status: 'done', detail: '4.2 MB, 24 pages' },
  { label: 'OCR Running', status: 'done', detail: '98.4% confidence' },
  { label: 'Questions Detected', status: 'done', detail: '100 questions found' },
  { label: 'Options Extracted', status: 'done', detail: '400 options parsed' },
  { label: 'Images Identified', status: 'done', detail: '3 diagrams found' },
  { label: 'Subject Classified', status: 'running', detail: 'Processing…' },
  { label: 'Topic Classified', status: 'waiting', detail: '' },
  { label: 'Difficulty Predicted', status: 'waiting', detail: '' },
  { label: 'Explanation Generated', status: 'waiting', detail: '' },
  { label: 'Learning Objectives', status: 'waiting', detail: '' },
  { label: 'Duplicate Detection', status: 'waiting', detail: '' },
  { label: 'Final Validation', status: 'waiting', detail: '' },
];

const statusIcon = (s: string) => {
  if (s === 'done') return <CheckCircle2 size={14} color="#10b981" />;
  if (s === 'running') return <Loader2 size={14} color="#2563eb" style={{ animation: 'spin-slow 1s linear infinite' }} />;
  return <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--text-subtle)' }} />;
};

function AIProcessingPanel() {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 16, padding: 24, boxShadow: 'var(--shadow-sm)', marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: 'var(--text-main)', margin: 0 }}>
          ⚡ AI Extraction & Processing Status
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#f59e0b', fontFamily: 'var(--font-mono)' }}>
          <Loader2 size={13} style={{ animation: 'spin-slow 1s linear infinite' }} />
          5 / 12 stages complete
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
        {aiStages.map((stage, i) => (
          <div
            key={i}
            style={{
              padding: '10px 12px',
              borderRadius: 10,
              border: `1px solid ${stage.status === 'done' ? 'rgba(16, 185, 129, 0.4)' : stage.status === 'running' ? 'rgba(37, 99, 235, 0.4)' : 'var(--border-color)'}`,
              background: stage.status === 'done' ? 'rgba(16, 185, 129, 0.08)' : stage.status === 'running' ? 'rgba(37, 99, 235, 0.08)' : 'var(--bg-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            {statusIcon(stage.status)}
            <div>
              <div
                style={{
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: stage.status === 'done' ? '#10b981' : stage.status === 'running' ? '#2563eb' : 'var(--text-muted)',
                  fontFamily: 'var(--font-body)',
                }}
              >
                {stage.label}
              </div>
              {stage.detail && (
                <div style={{ fontSize: 11, color: 'var(--text-subtle)', fontFamily: 'var(--font-mono)', marginTop: 1 }}>
                  {stage.detail}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Summary Stats ── */
const summaryStats = [
  { icon: FileText, label: 'Questions Found', value: '100', color: '#2563eb', bg: 'rgba(37, 99, 235, 0.12)' },
  { icon: ImageIcon, label: 'Images Found', value: '3', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.12)' },
  { icon: Target, label: 'Confidence Score', value: '91.4%', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)' },
  { icon: Shield, label: 'Duplicates', value: '2', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)' },
  { icon: Clock, label: 'Processing Time', value: '2m 14s', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)' },
  { icon: AlertTriangle, label: 'Errors Found', value: '0', color: '#64748b', bg: 'rgba(100, 116, 139, 0.12)' },
];

function SummaryStats() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 24 }}>
      {summaryStats.map((s, i) => {
        const Icon = s.icon;
        return (
          <div
            key={i}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 14,
              padding: '16px 18px',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ width: 32, height: 32, borderRadius: 8, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={16} color={s.color} />
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 24, color: 'var(--text-main)' }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontWeight: 500 }}>{s.label}</div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Question Table ── */
const sampleQuestions = [
  { num: 1, preview: "With reference to the 'Digital India' programme, which of the following is/are its stated objective(s)?", subject: 'Polity', topic: 'Digital Governance', sub: 'e-Governance', diff: 'Medium', conf: 94.2, status: 'pending' },
  { num: 2, preview: 'Which one of the following is NOT a feature of the Indian federal system as practiced?', subject: 'Polity', topic: 'Federalism', sub: 'Constitutional Provisions', diff: 'Easy', conf: 88.7, status: 'approved' },
  { num: 3, preview: 'Consider the following statements about Nalanda University and select the correct ones:', subject: 'History', topic: 'Ancient India', sub: 'Education', diff: 'Medium', conf: 91.3, status: 'pending' },
  { num: 4, preview: "The term 'Navigational Satellite System' is associated with which of the following?", subject: 'Science', topic: 'Space Technology', sub: 'ISRO Missions', diff: 'Hard', conf: 76.8, status: 'rejected' },
  { num: 5, preview: 'With reference to Western Ghats, consider the following statements regarding its biodiversity:', subject: 'Geography', topic: 'Physical Geography', sub: 'Biodiversity Hotspots', diff: 'Hard', conf: 83.1, status: 'pending' },
];

const diffBadge: Record<string, { bg: string; color: string }> = {
  Easy: { bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981' },
  Medium: { bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' },
  Hard: { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' },
};

const statusBadge: Record<string, { bg: string; color: string; label: string }> = {
  pending: { bg: 'rgba(100, 116, 139, 0.15)', color: '#64748b', label: 'Pending' },
  approved: { bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981', label: 'Approved' },
  rejected: { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', label: 'Rejected' },
};

function QuestionTable({ onExpand }: { onExpand: (idx: number) => void }) {
  const [filter, setFilter] = useState('All');

  const filteredQuestions = sampleQuestions.filter((q) => {
    if (filter === 'All') return true;
    return q.status.toLowerCase() === filter.toLowerCase();
  });

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 16, boxShadow: 'var(--shadow-sm)', overflow: 'hidden', marginBottom: 24 }}>
      <div style={{ padding: '20px 24px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: 'var(--text-main)', margin: 0 }}>
          Extracted Questions List
          <span style={{ marginLeft: 10, fontSize: 12, color: 'var(--text-muted)', fontWeight: 400, fontFamily: 'var(--font-mono)' }}>
            ({filteredQuestions.length} items)
          </span>
        </h3>
        <div style={{ display: 'flex', gap: 8 }}>
          {['All', 'Pending', 'Approved', 'Rejected'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                fontSize: 12,
                fontWeight: 600,
                padding: '6px 14px',
                borderRadius: 8,
                border: filter === f ? '1px solid var(--royal)' : '1px solid var(--border-color)',
                background: filter === f ? 'rgba(37, 99, 235, 0.12)' : 'var(--bg-secondary)',
                color: filter === f ? 'var(--royal)' : 'var(--text-muted)',
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
                transition: 'all 0.15s ease',
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
              {['#', 'Question Preview', 'Subject', 'Topic', 'Subtopic', 'Difficulty', 'AI Conf.', 'Status', 'Actions'].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: '10px 14px',
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredQuestions.map((q, i) => {
              const db = diffBadge[q.diff] || diffBadge['Medium'];
              const sb = statusBadge[q.status] || statusBadge['pending'];
              return (
                <tr
                  key={i}
                  style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.1s ease' }}
                >
                  <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {q.num}
                  </td>
                  <td style={{ padding: '12px 14px', maxWidth: 280 }}>
                    <p
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: 'var(--text-main)',
                        margin: 0,
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        lineHeight: 1.4,
                        fontFamily: 'var(--font-body)',
                      }}
                    >
                      {q.preview}
                    </p>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(37, 99, 235, 0.12)', color: 'var(--royal)', padding: '3px 8px', borderRadius: 99, fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                      {q.subject}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-main)', fontFamily: 'var(--font-body)', whiteSpace: 'nowrap', fontWeight: 500 }}>
                    {q.topic}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-body)', whiteSpace: 'nowrap' }}>
                    {q.sub}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ fontSize: 11, background: db.bg, color: db.color, padding: '3px 8px', borderRadius: 99, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                      {q.diff}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span
                      style={{
                        fontSize: 13,
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 700,
                        color: q.conf > 85 ? '#10b981' : q.conf > 70 ? '#f59e0b' : '#ef4444',
                      }}
                    >
                      {q.conf}%
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ fontSize: 11, background: sb.bg, color: sb.color, padding: '3px 8px', borderRadius: 99, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                      {sb.label}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => onExpand(i)}
                        title="Expand Detail View"
                        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', color: 'var(--text-muted)' }}
                      >
                        <Maximize2 size={13} />
                      </button>
                      <button title="Approve Question" style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', color: '#10b981' }}>
                        <ThumbsUp size={13} />
                      </button>
                      <button title="Reject Question" style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', color: '#ef4444' }}>
                        <ThumbsDown size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Expanded Question Drawer Modal ── */
function QuestionDrawer({ questionIdx, onClose }: { questionIdx: number; onClose: () => void }) {
  const q = sampleQuestions[questionIdx] || sampleQuestions[0];
  const options = ['1 only', '2 and 3 only', '1 and 3 only', '1, 2, and 3'];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex' }}>
      <div style={{ flex: 1, background: 'rgba(9, 13, 22, 0.65)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <div
        style={{
          width: 600,
          maxWidth: '100%',
          background: 'var(--bg-card)',
          color: 'var(--text-main)',
          height: '100%',
          overflowY: 'auto',
          padding: '32px 32px 100px',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          borderLeft: '1px solid var(--border-color)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, color: 'var(--text-main)', margin: 0 }}>
              Inspect Question #{q.num}
            </h3>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              UPSC Prelims 2024 · GS Paper I
            </span>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'var(--bg-secondary)', border: 'none', borderRadius: 8, padding: '8px', cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Question text */}
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 18, border: '1px solid var(--border-color)' }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
            QUESTION TEXT
          </label>
          <p style={{ fontSize: 14, color: 'var(--text-main)', margin: '8px 0 0', lineHeight: 1.6, fontFamily: 'var(--font-body)', fontWeight: 500 }}>
            {q.preview}
          </p>
        </div>

        {/* Options */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
            EXTRACTED OPTIONS
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
            {options.map((opt, i) => (
              <div
                key={i}
                style={{
                  padding: '12px 16px',
                  borderRadius: 10,
                  border: `1px solid ${i === 1 ? 'rgba(16, 185, 129, 0.4)' : 'var(--border-color)'}`,
                  background: i === 1 ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-body)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <span
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    background: i === 1 ? '#10b981' : 'var(--bg-secondary)',
                    color: i === 1 ? '#fff' : 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {String.fromCharCode(65 + i)}
                </span>
                <span style={{ fontSize: 14, color: 'var(--text-main)', fontFamily: 'var(--font-body)', fontWeight: 500 }}>{opt}</span>
                {i === 1 && <CheckCircle2 size={16} color="#10b981" style={{ marginLeft: 'auto' }} />}
              </div>
            ))}
          </div>
        </div>

        {/* Metadata grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            { label: 'Subject', value: q.subject },
            { label: 'Topic', value: q.topic },
            { label: 'Subtopic', value: q.sub },
            { label: 'Difficulty', value: q.diff },
            { label: "Bloom's Taxonomy", value: 'Comprehension' },
            { label: 'Estimated Solving Time', value: '90 seconds' },
            { label: 'Negative Marks', value: '−0.66' },
            { label: 'AI Confidence', value: `${q.conf}%` },
          ].map((item, i) => (
            <div key={i} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 10, padding: '10px 14px' }}>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em', marginBottom: 3 }}>
                {item.label.toUpperCase()}
              </div>
              <div style={{ fontSize: 13.5, color: 'var(--text-main)', fontFamily: 'var(--font-body)', fontWeight: 600 }}>
                {item.value}
              </div>
            </div>
          ))}
        </div>

        {/* Explanation */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
            GENERATED EXPLANATION
          </label>
          <textarea
            style={{
              width: '100%',
              marginTop: 8,
              padding: '12px 14px',
              borderRadius: 10,
              border: '1px solid var(--border-color)',
              background: 'var(--bg-body)',
              color: 'var(--text-main)',
              fontSize: 13.5,
              lineHeight: 1.6,
              fontFamily: 'var(--font-body)',
              resize: 'vertical',
              minHeight: 100,
              outline: 'none',
            }}
            defaultValue="The Digital India programme was launched with three key vision areas: Digital Infrastructure as Core Utility, Governance & Services on Demand, and Digital Empowerment of Citizens. Option (b) correctly identifies the stated objectives."
          />
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 12, position: 'sticky', bottom: 0, background: 'var(--bg-card)', paddingTop: 16, borderTop: '1px solid var(--border-color)' }}>
          <button style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <ThumbsUp size={15} /> Approve Question
          </button>
          <button style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: '#ef4444', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <ThumbsDown size={15} /> Reject
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main View Component ── */
export function UploadReviewView() {
  const [drawerIdx, setDrawerIdx] = useState<number | null>(null);

  const {
    examName,
    setExamName,
    year,
    setYear,
    paperType,
    setPaperType,
    selectedFile,
    isUploading,
    statusMessage,
    isDragOver,
    fileInputRef,
    handleFileChange,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleSubmit,
  } = useExamUpload();

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Step Progress Tracker */}
      <Stepper current={1} />

      {/* Main Upload & Review Grid Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>
        {/* Left Column: Exam Details & File Upload Form */}
        <div>
          {/* Exam Details Card */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 16, padding: 24, boxShadow: 'var(--shadow-sm)', marginBottom: 24 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: 'var(--text-main)', margin: '0 0 18px' }}>
              ⚙️ Exam Metadata Parameters
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>Exam Name</label>
                <select value={examName} onChange={(e) => setExamName(e.target.value)} className="form-select">
                  {EXAM_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>Year</label>
                <select value={year} onChange={(e) => setYear(e.target.value)} className="form-select">
                  {YEAR_OPTIONS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>Paper Type</label>
                <select value={paperType} onChange={(e) => setPaperType(e.target.value)} className="form-select">
                  {PAPER_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* PDF Drag and Drop Area */}
          <form onSubmit={handleSubmit} style={{ marginBottom: 24 }}>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`dropzone ${isDragOver ? 'active' : ''}`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="application/pdf"
                style={{ display: 'none' }}
              />

              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 14,
                  background: 'rgba(37, 99, 235, 0.12)',
                  color: 'var(--royal)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 14px',
                }}
              >
                <Upload size={28} />
              </div>

              {selectedFile ? (
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--royal)' }}>
                    {selectedFile.name}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Click or drag to replace PDF
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)' }}>
                    Drop Exam PDF here or click to browse
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                    Supports official UPSC / State PSC Question Papers (up to 50MB)
                  </div>
                </div>
              )}
            </div>

            {/* Status Alert Banner */}
            {statusMessage && (
              <div className={`alert-card ${statusMessage.isError ? 'error' : 'success'}`}>
                <span>{statusMessage.isError ? '⚠️' : '✅'}</span>
                <span>{statusMessage.text}</span>
              </div>
            )}

            {/* Upload Action Button */}
            <button
              type="submit"
              disabled={isUploading}
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '14px',
                fontSize: 15,
                fontWeight: 700,
                borderRadius: 12,
                cursor: isUploading ? 'not-allowed' : 'pointer',
              }}
            >
              {isUploading ? (
                <>
                  <Loader2 size={18} style={{ animation: 'spin-slow 1s linear infinite' }} />
                  <span>Uploading PDF to S3 Storage...</span>
                </>
              ) : (
                <>
                  <Cloud size={18} />
                  <span>Upload & Run AI Question Extraction</span>
                </>
              )}
            </button>
          </form>

          {/* AI Extraction Progress Status Panel */}
          <AIProcessingPanel />

          {/* KPI Summary Stats */}
          <SummaryStats />

          {/* Extracted Questions Table */}
          <QuestionTable onExpand={(idx) => setDrawerIdx(idx)} />
        </div>

        {/* Right Sidebar Column: AI Suggestions & Validation Warnings */}
        <div>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 16, padding: 20, boxShadow: 'var(--shadow-sm)', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Sparkles size={16} color="#8b5cf6" />
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: 'var(--text-main)', margin: 0 }}>
                AI Analysis & Insights
              </h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'Weak Topic Mapping', value: 'Digital Governance', color: '#8b5cf6' },
                { label: 'Related PYQs', value: '12 similar questions found', color: '#2563eb' },
                { label: 'Suggested Resources', value: '3 articles linked', color: '#10b981' },
                { label: 'Estimated Difficulty', value: 'Medium', color: '#f59e0b' },
                { label: 'Expected Accuracy', value: '62%', color: '#06b6d4' },
                { label: 'Quality Score', value: '8.4 / 10', color: '#10b981' },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < 5 ? '1px solid var(--border-color)' : 'none' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{item.label}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)', fontFamily: 'var(--font-body)' }}>{item.value}</div>
                  </div>
                </div>
              ))}

              <div style={{ marginTop: 8, padding: '12px', borderRadius: 10, background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <AlertTriangle size={14} color="#f59e0b" />
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b' }}>Potential Duplicate</span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
                  2 similar questions detected from Prelims 2019. Review before publishing.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Question Detail Drawer */}
      {drawerIdx !== null && (
        <QuestionDrawer questionIdx={drawerIdx} onClose={() => setDrawerIdx(null)} />
      )}
    </div>
  );
}
