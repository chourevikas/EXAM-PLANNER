import React, { useState } from 'react';
import {
  Plus,
  Search,
  BookOpen,
  Clock,
  CheckCircle2,
  AlertTriangle,
  X,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Copy,
  Archive,
  Eye,
  Sliders,
  Check,
  FileText,
  BarChart2,
  Calendar,
  Zap,
} from 'lucide-react';

interface MockTestItem {
  id: string;
  title: string;
  exam: string;
  year: number;
  type: 'Full Length' | 'Sectional' | 'Speed Test';
  questions: number;
  duration: number; // minutes
  attempts: number;
  status: 'Published' | 'Draft' | 'Scheduled' | 'Archived';
  negativeMarking: boolean;
  marksPerQuestion: number;
  negativeMarks: number;
  updatedAt: string;
  createdAt: string;
  subjects?: string[];
}

export function MockTestsView() {
  // Pre-populated mock tests database state
  const [mockTests, setMockTests] = useState<MockTestItem[]>([
    {
      id: 'MT-101',
      title: 'UPSC Prelims Full Mock Test 01',
      exam: 'UPSC',
      year: 2026,
      type: 'Full Length',
      questions: 100,
      duration: 120,
      attempts: 1420,
      status: 'Published',
      negativeMarking: true,
      marksPerQuestion: 2.0,
      negativeMarks: 0.66,
      updatedAt: '2 hours ago',
      createdAt: '10 Aug 2026',
      subjects: ['Polity', 'History', 'Economy', 'Geography', 'Environment'],
    },
    {
      id: 'MT-102',
      title: 'Polity & Constitution Sectional Test',
      exam: 'UPSC',
      year: 2026,
      type: 'Sectional',
      questions: 50,
      duration: 60,
      attempts: 980,
      status: 'Published',
      negativeMarking: true,
      marksPerQuestion: 2.0,
      negativeMarks: 0.66,
      updatedAt: '1 day ago',
      createdAt: '12 Aug 2026',
      subjects: ['Polity & Governance'],
    },
    {
      id: 'MT-103',
      title: 'MPPSC State Services Full Length Test 01',
      exam: 'MPPSC',
      year: 2026,
      type: 'Full Length',
      questions: 100,
      duration: 120,
      attempts: 650,
      status: 'Scheduled',
      negativeMarking: true,
      marksPerQuestion: 2.0,
      negativeMarks: 0.0,
      updatedAt: '3 hours ago',
      createdAt: '13 Aug 2026',
      subjects: ['General Studies', 'MP History & Culture'],
    },
    {
      id: 'MT-104',
      title: 'Indian Economy & Budget 2026 Speed Test',
      exam: 'UPSC',
      year: 2026,
      type: 'Speed Test',
      questions: 30,
      duration: 35,
      attempts: 420,
      status: 'Published',
      negativeMarking: true,
      marksPerQuestion: 2.0,
      negativeMarks: 0.66,
      updatedAt: 'Yesterday',
      createdAt: '11 Aug 2026',
      subjects: ['Economy', 'Current Affairs'],
    },
    {
      id: 'MT-105',
      title: 'UPSC CSAT Paper II Logic & Aptitude Mock',
      exam: 'UPSC',
      year: 2026,
      type: 'Sectional',
      questions: 80,
      duration: 120,
      attempts: 890,
      status: 'Draft',
      negativeMarking: true,
      marksPerQuestion: 2.5,
      negativeMarks: 0.83,
      updatedAt: '4 hours ago',
      createdAt: '14 Aug 2026',
      subjects: ['CSAT', 'Reasoning', 'Quantitative Aptitude'],
    },
    {
      id: 'MT-106',
      title: 'MPSC Rajyaseva General Studies Mock 01',
      exam: 'MPSC',
      year: 2025,
      type: 'Full Length',
      questions: 100,
      duration: 120,
      attempts: 310,
      status: 'Published',
      negativeMarking: true,
      marksPerQuestion: 2.0,
      negativeMarks: 0.66,
      updatedAt: '3 days ago',
      createdAt: '08 Aug 2026',
      subjects: ['General Studies', 'Maharashtra Geography'],
    },
    {
      id: 'MT-107',
      title: 'Environment & Ecology Current Affairs Quiz',
      exam: 'UPSC',
      year: 2026,
      type: 'Speed Test',
      questions: 25,
      duration: 30,
      attempts: 0,
      status: 'Draft',
      negativeMarking: true,
      marksPerQuestion: 2.0,
      negativeMarks: 0.66,
      updatedAt: 'Just now',
      createdAt: '14 Aug 2026',
      subjects: ['Environment', 'Current Affairs'],
    },
    {
      id: 'MT-108',
      title: 'CAPF AC Paper 1 General Ability Mock 02',
      exam: 'CAPF',
      year: 2025,
      type: 'Full Length',
      questions: 125,
      duration: 120,
      attempts: 1150,
      status: 'Published',
      negativeMarking: true,
      marksPerQuestion: 2.0,
      negativeMarks: 0.66,
      updatedAt: '5 days ago',
      createdAt: '05 Aug 2026',
      subjects: ['General Ability', 'Science', 'Polity'],
    },
  ]);

  // Filter & Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [examFilter, setExamFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('UPDATED');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Selected Test Detail Drawer State
  const [selectedTest, setSelectedTest] = useState<MockTestItem | null>(null);

  // Creation Wizard Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [newTestForm, setNewTestForm] = useState({
    title: '',
    exam: 'UPSC',
    year: 2026,
    type: 'Full Length' as MockTestItem['type'],
    questions: 100,
    duration: 120,
    negativeMarking: true,
    marksPerQuestion: 2.0,
    negativeMarks: 0.66,
    status: 'Draft' as MockTestItem['status'],
    primarySubject: 'General Studies',
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Filter & Sort Logic
  const filteredTests = mockTests
    .filter((test) => {
      const matchesSearch =
        !searchQuery ||
        test.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        test.exam.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesExam = examFilter === 'ALL' || test.exam === examFilter;
      const matchesType = typeFilter === 'ALL' || test.type === typeFilter;
      const matchesStatus = statusFilter === 'ALL' || test.status === statusFilter;

      return matchesSearch && matchesExam && matchesType && matchesStatus;
    })
    .sort((a, b) => {
      if (sortBy === 'TITLE') return a.title.localeCompare(b.title);
      if (sortBy === 'ATTEMPTS') return b.attempts - a.attempts;
      return 0; // default updated
    });

  // Pagination Logic
  const totalCount = filteredTests.length;
  const publishedCount = mockTests.filter((t) => t.status === 'Published').length;
  const draftCount = mockTests.filter((t) => t.status === 'Draft').length;
  const scheduledCount = mockTests.filter((t) => t.status === 'Scheduled').length;

  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedTests = filteredTests.slice(startIndex, startIndex + pageSize);

  // Handlers for Test Management
  const handleDuplicateTest = (test: MockTestItem) => {
    const dup: MockTestItem = {
      ...test,
      id: `MT-${Date.now().toString().slice(-3)}`,
      title: `${test.title} (Copy)`,
      attempts: 0,
      status: 'Draft',
      updatedAt: 'Just now',
      createdAt: 'Today',
    };
    setMockTests([dup, ...mockTests]);
    showToast(`Created duplicate draft: "${dup.title}"`);
    if (selectedTest?.id === test.id) setSelectedTest(dup);
  };

  const handleToggleStatus = (testId: string) => {
    setMockTests((prev) =>
      prev.map((t) => {
        if (t.id === testId) {
          const nextStatus = t.status === 'Published' ? 'Draft' : 'Published';
          return { ...t, status: nextStatus, updatedAt: 'Just now' };
        }
        return t;
      })
    );
    showToast('Mock test status updated.');
    if (selectedTest?.id === testId) {
      setSelectedTest((prev) => (prev ? { ...prev, status: prev.status === 'Published' ? 'Draft' : 'Published' } : null));
    }
  };

  const handleArchiveTest = (testId: string) => {
    setMockTests((prev) =>
      prev.map((t) => (t.id === testId ? { ...t, status: 'Archived', updatedAt: 'Just now' } : t))
    );
    showToast('Mock test archived.');
    if (selectedTest?.id === testId) setSelectedTest(null);
  };

  const handleCreateSubmit = () => {
    if (!newTestForm.title.trim()) {
      alert('Please enter a valid test title.');
      return;
    }

    const created: MockTestItem = {
      id: `MT-${Math.floor(100 + Math.random() * 900)}`,
      title: newTestForm.title,
      exam: newTestForm.exam,
      year: newTestForm.year,
      type: newTestForm.type,
      questions: newTestForm.questions,
      duration: newTestForm.duration,
      attempts: 0,
      status: newTestForm.status,
      negativeMarking: newTestForm.negativeMarking,
      marksPerQuestion: newTestForm.marksPerQuestion,
      negativeMarks: newTestForm.negativeMarking ? newTestForm.negativeMarks : 0,
      updatedAt: 'Just now',
      createdAt: 'Today',
      subjects: [newTestForm.primarySubject],
    };

    setMockTests([created, ...mockTests]);
    setIsCreateModalOpen(false);
    setCreateStep(1);
    setNewTestForm({
      title: '',
      exam: 'UPSC',
      year: 2026,
      type: 'Full Length',
      questions: 100,
      duration: 120,
      negativeMarking: true,
      marksPerQuestion: 2.0,
      negativeMarks: 0.66,
      status: 'Draft',
      primarySubject: 'General Studies',
    });

    showToast(`Successfully created mock test: "${created.title}"`);
  };

  const renderStatusBadge = (status: MockTestItem['status']) => {
    switch (status) {
      case 'Published':
        return (
          <span style={{ fontSize: 12, fontWeight: 500, padding: '3px 8px', borderRadius: 'var(--radius)', backgroundColor: 'var(--status-success-bg)', color: '#15803D', border: '1px solid #BBF7D0', display: 'inline-block' }}>
            Published
          </span>
        );
      case 'Scheduled':
        return (
          <span style={{ fontSize: 12, fontWeight: 500, padding: '3px 8px', borderRadius: 'var(--radius)', backgroundColor: '#E0F2FE', color: '#0369A1', border: '1px solid #BAE6FD', display: 'inline-block' }}>
            Scheduled
          </span>
        );
      case 'Archived':
        return (
          <span style={{ fontSize: 12, fontWeight: 500, padding: '3px 8px', borderRadius: 'var(--radius)', backgroundColor: '#F7F7F5', color: '#667085', border: '1px solid #E4E7EC', display: 'inline-block' }}>
            Archived
          </span>
        );
      case 'Draft':
      default:
        return (
          <span style={{ fontSize: 12, fontWeight: 500, padding: '3px 8px', borderRadius: 'var(--radius)', backgroundColor: '#F2F4F7', color: '#475467', border: '1px solid #E4E7EC', display: 'inline-block' }}>
            Draft
          </span>
        );
    }
  };

  return (
    <div style={{ maxWidth: 1320, margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      {/* Toast Feedback Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            backgroundColor: '#12233F',
            color: 'var(--bg-card)',
            padding: '12px 20px',
            borderRadius: 'var(--radius)',
            boxShadow: '0 4px 12px rgba(16,24,40,0.15)',
            fontSize: 13.5,
            fontWeight: 500,
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <CheckCircle2 size={16} color="#4ADE80" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* PAGE HEADER (Sitting directly on off-white main background) */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 16,
        }}
      >
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--deep-navy)', margin: 0, letterSpacing: '-0.02em' }}>
            Mock Tests
          </h1>
          <p style={{ fontSize: 14, color: '#667085', marginTop: 4, margin: '4px 0 0 0' }}>
            Create, manage, and monitor full-length and sectional examination tests.
          </p>
        </div>

        {/* Primary Blue Action Button */}
        <button
          onClick={() => {
            setCreateStep(1);
            setIsCreateModalOpen(true);
          }}
          style={{
            padding: '10px 18px',
            height: 42,
            fontSize: 13.5,
            fontWeight: 600,
            borderRadius: 'var(--radius)',
            border: 'none',
            backgroundColor: '#12233F',
            color: 'var(--bg-card)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: '0 1px 2px rgba(16,24,40,0.05)',
            transition: 'background 0.15s ease',
          }}
        >
          <Plus size={16} />
          <span>Create Mock Test</span>
        </button>
      </div>

      {/* SUBTLE TEXTUAL SUMMARY (Simple text with muted separators) */}
      <div style={{ fontSize: 13.5, color: '#667085', marginBottom: 20 }}>
        <strong style={{ color: 'var(--deep-navy)', fontWeight: 600 }}>{mockTests.length} mock tests</strong>
        <span> · {publishedCount} published · {draftCount} drafts · {scheduledCount} scheduled</span>
      </div>

      {/* COMPACT FILTER & SEARCH TOOLBAR (~44px height) */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          marginBottom: 20,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        {/* Left: Search Field */}
        <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: 12, color: '#667085' }} />
          <input
            type="text"
            placeholder="Search tests..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              width: '100%',
              padding: '8px 12px 8px 36px',
              borderRadius: 'var(--radius)',
              border: '1px solid #E4E7EC',
              backgroundColor: 'var(--bg-card)',
              fontSize: 13.5,
              color: 'var(--deep-navy)',
              outline: 'none',
              height: 40,
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Right Dropdowns */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Exam Filter */}
          <select
            value={examFilter}
            onChange={(e) => {
              setExamFilter(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              padding: '8px 12px',
              borderRadius: 'var(--radius)',
              border: '1px solid #E4E7EC',
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--deep-navy)',
              backgroundColor: 'var(--bg-card)',
              outline: 'none',
              height: 40,
              boxSizing: 'border-box',
            }}
          >
            <option value="ALL">Exam: All</option>
            <option value="UPSC">Exam: UPSC</option>
            <option value="MPPSC">Exam: MPPSC</option>
            <option value="MPSC">Exam: MPSC</option>
            <option value="CAPF">Exam: CAPF</option>
          </select>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              padding: '8px 12px',
              borderRadius: 'var(--radius)',
              border: '1px solid #E4E7EC',
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--deep-navy)',
              backgroundColor: 'var(--bg-card)',
              outline: 'none',
              height: 40,
              boxSizing: 'border-box',
            }}
          >
            <option value="ALL">Type: All</option>
            <option value="Full Length">Full Length</option>
            <option value="Sectional">Sectional</option>
            <option value="Speed Test">Speed Test</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              padding: '8px 12px',
              borderRadius: 'var(--radius)',
              border: '1px solid #E4E7EC',
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--deep-navy)',
              backgroundColor: 'var(--bg-card)',
              outline: 'none',
              height: 40,
              boxSizing: 'border-box',
            }}
          >
            <option value="ALL">Status: All</option>
            <option value="Published">Published</option>
            <option value="Draft">Draft</option>
            <option value="Scheduled">Scheduled</option>
            <option value="Archived">Archived</option>
          </select>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: 'var(--radius)',
              border: '1px solid #E4E7EC',
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--deep-navy)',
              backgroundColor: 'var(--bg-card)',
              outline: 'none',
              height: 40,
              boxSizing: 'border-box',
            }}
          >
            <option value="UPDATED">Sort: Recently updated</option>
            <option value="TITLE">Sort: Title (A-Z)</option>
            <option value="ATTEMPTS">Sort: Most attempted</option>
          </select>
        </div>
      </div>

      {/* MAIN CONTENT TABLE */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid #E4E7EC',
          borderRadius: 'var(--radius)',
          boxShadow: '0 1px 2px rgba(16, 24, 40, 0.02)',
          overflow: 'hidden',
        }}
      >
        {paginatedTests.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: '#667085' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--deep-navy)', marginBottom: 4 }}>
              No mock tests found
            </div>
            <div style={{ fontSize: 13, color: '#667085', marginBottom: 16 }}>
              Create your first mock test to begin building the examination library.
            </div>
            <button
              onClick={() => {
                setCreateStep(1);
                setIsCreateModalOpen(true);
              }}
              style={{
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 'var(--radius)',
                border: 'none',
                backgroundColor: '#12233F',
                color: 'var(--bg-card)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Plus size={14} /> Create Mock Test
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                textAlign: 'left',
                fontSize: 13.5,
              }}
            >
              <thead>
                <tr style={{ borderBottom: '1px solid #E4E7EC', backgroundColor: '#F7F7F5' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#667085', fontSize: 12 }}>TEST</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#667085', fontSize: 12 }}>EXAM</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#667085', fontSize: 12 }}>TYPE</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#667085', fontSize: 12 }}>QUESTIONS</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#667085', fontSize: 12 }}>DURATION</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#667085', fontSize: 12 }}>ATTEMPTS</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#667085', fontSize: 12 }}>STATUS</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#667085', fontSize: 12, textAlign: 'right' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTests.map((test, i) => (
                  <tr
                    key={test.id}
                    onClick={() => setSelectedTest(test)}
                    style={{
                      borderBottom: i === paginatedTests.length - 1 ? 'none' : '1px solid #E4E7EC',
                      cursor: 'pointer',
                      transition: 'background 0.12s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F7F7F5')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    {/* TEST TITLE & SECONDARY METADATA */}
                    <td style={{ padding: '14px 16px', maxWidth: 320 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--deep-navy)' }}>
                        {test.title}
                      </div>
                      <div style={{ fontSize: 12, color: '#667085', marginTop: 2 }}>
                        Last updated {test.updatedAt}
                      </div>
                    </td>

                    {/* EXAM */}
                    <td style={{ padding: '14px 16px', fontWeight: 500, color: 'var(--deep-navy)' }}>
                      {test.exam} ({test.year})
                    </td>

                    {/* TYPE */}
                    <td style={{ padding: '14px 16px', color: '#344054', fontSize: 13 }}>
                      {test.type}
                    </td>

                    {/* QUESTIONS */}
                    <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--deep-navy)' }}>
                      {test.questions}
                    </td>

                    {/* DURATION */}
                    <td style={{ padding: '14px 16px', color: '#667085', fontSize: 13 }}>
                      {test.duration} min
                    </td>

                    {/* ATTEMPTS */}
                    <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--deep-navy)', fontFamily: 'monospace', fontSize: 13 }}>
                      {test.attempts.toLocaleString()}
                    </td>

                    {/* STATUS */}
                    <td style={{ padding: '14px 16px' }}>
                      {renderStatusBadge(test.status)}
                    </td>

                    {/* ACTION */}
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTest(test);
                        }}
                        style={{
                          padding: '5px 12px',
                          fontSize: 12.5,
                          fontWeight: 500,
                          color: 'var(--deep-navy)',
                          background: 'var(--bg-card)',
                          border: '1px solid #E4E7EC',
                          borderRadius: 'var(--radius)',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(59, 110, 168, 0.06)';
                          e.currentTarget.style.borderColor = '#3B6EA8';
                          e.currentTarget.style.color = '#3B6EA8';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--bg-card)';
                          e.currentTarget.style.borderColor = '#E4E7EC';
                          e.currentTarget.style.color = 'var(--deep-navy)';
                        }}
                      >
                        <span>Manage</span>
                        <span>→</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CLEAN PAGINATION FOOTER */}
      {totalCount > 0 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 16,
            fontSize: 13,
            color: '#667085',
          }}
        >
          <div>
            Showing {Math.min(startIndex + 1, totalCount)}–
            {Math.min(startIndex + pageSize, totalCount)} of {totalCount} tests
          </div>

          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              style={{
                padding: '5px 10px',
                borderRadius: 'var(--radius)',
                border: '1px solid #E4E7EC',
                background: 'var(--bg-card)',
                color: currentPage === 1 ? 'var(--text-disabled)' : 'var(--deep-navy)',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                fontSize: 12.5,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <ChevronLeft size={14} /> Previous
            </button>

            {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((pg) => (
              <button
                key={pg}
                onClick={() => setCurrentPage(pg)}
                style={{
                  padding: '5px 10px',
                  borderRadius: 'var(--radius)',
                  border: '1px solid #E4E7EC',
                  background: currentPage === pg ? '#12233F' : 'var(--bg-card)',
                  color: currentPage === pg ? 'var(--bg-card)' : 'var(--deep-navy)',
                  cursor: 'pointer',
                  fontSize: 12.5,
                  fontWeight: currentPage === pg ? 600 : 400,
                }}
              >
                {pg}
              </button>
            ))}

            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              style={{
                padding: '5px 10px',
                borderRadius: 'var(--radius)',
                border: '1px solid #E4E7EC',
                background: 'var(--bg-card)',
                color: currentPage === totalPages ? 'var(--text-disabled)' : 'var(--deep-navy)',
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                fontSize: 12.5,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* TEST DETAIL SLIDE-OVER DRAWER */}
      {selectedTest && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(16, 33, 61, 0.35)',
            display: 'flex',
            justifyContent: 'flex-end',
            zIndex: 1000,
          }}
          onClick={() => setSelectedTest(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 480,
              height: '100%',
              backgroundColor: 'var(--bg-card)',
              borderLeft: '1px solid #E4E7EC',
              boxShadow: '-4px 0 16px rgba(16,24,40,0.08)',
              display: 'flex',
              flexDirection: 'column',
              padding: 24,
              boxSizing: 'border-box',
              overflowY: 'auto',
            }}
          >
            {/* Drawer Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  {renderStatusBadge(selectedTest.status)}
                  <span style={{ fontSize: 12, color: '#667085', fontFamily: 'monospace' }}>{selectedTest.id}</span>
                </div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--deep-navy)', margin: 0, lineHeight: 1.3 }}>
                  {selectedTest.title}
                </h2>
              </div>
              <button
                onClick={() => setSelectedTest(null)}
                style={{ background: 'none', border: 'none', color: '#667085', cursor: 'pointer', padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid #E4E7EC', margin: '0 0 20px 0' }} />

            {/* Test Configuration Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
              <div style={{ padding: 12, borderRadius: 'var(--radius)', border: '1px solid #E4E7EC', backgroundColor: '#F7F7F5' }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: '#667085', textTransform: 'uppercase' }}>Examination</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--deep-navy)', marginTop: 4 }}>
                  {selectedTest.exam} ({selectedTest.year})
                </div>
              </div>

              <div style={{ padding: 12, borderRadius: 'var(--radius)', border: '1px solid #E4E7EC', backgroundColor: '#F7F7F5' }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: '#667085', textTransform: 'uppercase' }}>Test Type</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--deep-navy)', marginTop: 4 }}>
                  {selectedTest.type}
                </div>
              </div>

              <div style={{ padding: 12, borderRadius: 'var(--radius)', border: '1px solid #E4E7EC', backgroundColor: '#F7F7F5' }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: '#667085', textTransform: 'uppercase' }}>Questions</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--deep-navy)', marginTop: 4 }}>
                  {selectedTest.questions} Qs
                </div>
              </div>

              <div style={{ padding: 12, borderRadius: 'var(--radius)', border: '1px solid #E4E7EC', backgroundColor: '#F7F7F5' }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: '#667085', textTransform: 'uppercase' }}>Duration</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--deep-navy)', marginTop: 4 }}>
                  {selectedTest.duration} minutes
                </div>
              </div>
            </div>

            {/* Test Rules & Scoring Information */}
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--deep-navy)', margin: '0 0 12px 0' }}>
                Scoring & Evaluation Rules
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: '#344054' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #F2F4F7' }}>
                  <span>Negative Marking:</span>
                  <strong style={{ color: selectedTest.negativeMarking ? '#15803D' : '#667085' }}>
                    {selectedTest.negativeMarking ? 'Enabled' : 'Disabled'}
                  </strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #F2F4F7' }}>
                  <span>Marks Per Question:</span>
                  <strong style={{ color: 'var(--deep-navy)' }}>+{selectedTest.marksPerQuestion.toFixed(1)}</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #F2F4F7' }}>
                  <span>Negative Penalty:</span>
                  <strong style={{ color: '#B42318' }}>
                    {selectedTest.negativeMarking ? `-${selectedTest.negativeMarks.toFixed(2)}` : 'None'}
                  </strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #F2F4F7' }}>
                  <span>Total Student Attempts:</span>
                  <strong style={{ color: 'var(--deep-navy)', fontFamily: 'monospace' }}>
                    {selectedTest.attempts.toLocaleString()}
                  </strong>
                </div>
              </div>
            </div>

            {/* Included Subjects */}
            {selectedTest.subjects && (
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--deep-navy)', margin: '0 0 8px 0' }}>
                  Syllabus Coverage
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {selectedTest.subjects.map((sub) => (
                    <span
                      key={sub}
                      style={{
                        fontSize: 12,
                        padding: '4px 8px',
                        borderRadius: 'var(--radius)',
                        backgroundColor: '#F7F7F5',
                        border: '1px solid #E4E7EC',
                        color: '#344054',
                      }}
                    >
                      {sub}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Timestamps Footer */}
            <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid #E4E7EC', fontSize: 12, color: '#667085', display: 'flex', justifyContent: 'space-between' }}>
              <span>Created: {selectedTest.createdAt}</span>
              <span>Updated: {selectedTest.updatedAt}</span>
            </div>

            {/* Drawer Management Action Buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16 }}>
              <button
                onClick={() => handleToggleStatus(selectedTest.id)}
                style={{
                  padding: '9px 12px',
                  fontSize: 12.5,
                  fontWeight: 600,
                  borderRadius: 'var(--radius)',
                  border: '1px solid #E4E7EC',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--deep-navy)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <Eye size={14} />
                <span>{selectedTest.status === 'Published' ? 'Unpublish' : 'Publish Test'}</span>
              </button>

              <button
                onClick={() => handleDuplicateTest(selectedTest)}
                style={{
                  padding: '9px 12px',
                  fontSize: 12.5,
                  fontWeight: 600,
                  borderRadius: 'var(--radius)',
                  border: '1px solid #E4E7EC',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--deep-navy)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <Copy size={14} />
                <span>Duplicate</span>
              </button>

              <button
                onClick={() => handleArchiveTest(selectedTest.id)}
                style={{
                  gridColumn: 'span 2',
                  padding: '9px 12px',
                  fontSize: 12.5,
                  fontWeight: 500,
                  borderRadius: 'var(--radius)',
                  border: '1px solid #FECDCA',
                  backgroundColor: '#FEF2F2',
                  color: '#B42318',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <Archive size={14} />
                <span>Archive Test</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE MOCK TEST WORKSPACE MODAL */}
      {isCreateModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(16, 33, 61, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              borderRadius: 'var(--radius)',
              border: '1px solid #E4E7EC',
              width: '100%',
              maxWidth: 640,
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: 24,
              boxShadow: '0 4px 16px rgba(16, 24, 40, 0.12)',
            }}
          >
            {/* Modal Header & Step Indicator */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--deep-navy)', margin: 0 }}>
                  Create Mock Test
                </h2>
                <div style={{ fontSize: 12.5, color: '#667085', marginTop: 2 }}>
                  Step {createStep} of 4 — {createStep === 1 ? 'Basic Information' : createStep === 2 ? 'Question Configuration' : createStep === 3 ? 'Scoring & Rules' : 'Review & Finalize'}
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#667085', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Step Progress Bar */}
            <div style={{ height: 4, background: '#F2F4F7', borderRadius: 'var(--radius)', marginBottom: 24, overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${(createStep / 4) * 100}%`,
                  backgroundColor: '#12233F',
                  transition: 'width 0.2s ease',
                }}
              />
            </div>

            {/* STEP 1: Basic Information */}
            {createStep === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#344054', marginBottom: 6 }}>
                    Test Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. UPSC Prelims 2026 Full Length Mock Test 02"
                    value={newTestForm.title}
                    onChange={(e) => setNewTestForm({ ...newTestForm, title: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 'var(--radius)',
                      border: '1px solid #E4E7EC',
                      fontSize: 13.5,
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#344054', marginBottom: 6 }}>
                      Target Examination
                    </label>
                    <select
                      value={newTestForm.exam}
                      onChange={(e) => setNewTestForm({ ...newTestForm, exam: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: 'var(--radius)',
                        border: '1px solid #E4E7EC',
                        fontSize: 13.5,
                        outline: 'none',
                        height: 40,
                        backgroundColor: 'var(--bg-card)',
                      }}
                    >
                      <option value="UPSC">UPSC Civil Services</option>
                      <option value="MPPSC">MPPSC State Services</option>
                      <option value="MPSC">MPSC Rajyaseva</option>
                      <option value="CAPF">CAPF Assistant Commandant</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#344054', marginBottom: 6 }}>
                      Exam Year
                    </label>
                    <select
                      value={newTestForm.year}
                      onChange={(e) => setNewTestForm({ ...newTestForm, year: parseInt(e.target.value, 10) })}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: 'var(--radius)',
                        border: '1px solid #E4E7EC',
                        fontSize: 13.5,
                        outline: 'none',
                        height: 40,
                        backgroundColor: 'var(--bg-card)',
                      }}
                    >
                      <option value={2026}>2026</option>
                      <option value={2025}>2025</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#344054', marginBottom: 6 }}>
                    Test Format / Type
                  </label>
                  <select
                    value={newTestForm.type}
                    onChange={(e) => setNewTestForm({ ...newTestForm, type: e.target.value as MockTestItem['type'] })}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 'var(--radius)',
                      border: '1px solid #E4E7EC',
                      fontSize: 13.5,
                      outline: 'none',
                      height: 40,
                      backgroundColor: 'var(--bg-card)',
                    }}
                  >
                    <option value="Full Length">Full Length Mock (100+ Qs)</option>
                    <option value="Sectional">Sectional Subject Test (50 Qs)</option>
                    <option value="Speed Test">Speed Practice Test (25–30 Qs)</option>
                  </select>
                </div>
              </div>
            )}

            {/* STEP 2: Question Configuration */}
            {createStep === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#344054', marginBottom: 6 }}>
                    Number of Questions
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={200}
                    value={newTestForm.questions}
                    onChange={(e) => setNewTestForm({ ...newTestForm, questions: parseInt(e.target.value, 10) || 100 })}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 'var(--radius)',
                      border: '1px solid #E4E7EC',
                      fontSize: 13.5,
                      outline: 'none',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#344054', marginBottom: 6 }}>
                    Primary Subject Coverage
                  </label>
                  <select
                    value={newTestForm.primarySubject}
                    onChange={(e) => setNewTestForm({ ...newTestForm, primarySubject: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 'var(--radius)',
                      border: '1px solid #E4E7EC',
                      fontSize: 13.5,
                      outline: 'none',
                      height: 40,
                      backgroundColor: 'var(--bg-card)',
                    }}
                  >
                    <option value="General Studies (Full Syllabus)">General Studies (Full Syllabus)</option>
                    <option value="Polity & Governance">Polity & Governance</option>
                    <option value="History & Culture">History & Culture</option>
                    <option value="Economy & Social Development">Economy & Social Development</option>
                    <option value="Geography & Environment">Geography & Environment</option>
                    <option value="General Science & Technology">General Science & Technology</option>
                  </select>
                </div>
              </div>
            )}

            {/* STEP 3: Scoring & Rules */}
            {createStep === 3 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#344054', marginBottom: 6 }}>
                      Duration (Minutes)
                    </label>
                    <input
                      type="number"
                      value={newTestForm.duration}
                      onChange={(e) => setNewTestForm({ ...newTestForm, duration: parseInt(e.target.value, 10) || 120 })}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: 'var(--radius)',
                        border: '1px solid #E4E7EC',
                        fontSize: 13.5,
                        outline: 'none',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#344054', marginBottom: 6 }}>
                      Marks Per Question
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={newTestForm.marksPerQuestion}
                      onChange={(e) => setNewTestForm({ ...newTestForm, marksPerQuestion: parseFloat(e.target.value) || 2.0 })}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: 'var(--radius)',
                        border: '1px solid #E4E7EC',
                        fontSize: 13.5,
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>

                <div style={{ padding: 14, border: '1px solid #E4E7EC', borderRadius: 'var(--radius)', backgroundColor: '#F7F7F5' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, color: 'var(--deep-navy)' }}>
                    <input
                      type="checkbox"
                      checked={newTestForm.negativeMarking}
                      onChange={(e) => setNewTestForm({ ...newTestForm, negativeMarking: e.target.checked })}
                    />
                    Enable Negative Marking Penalty
                  </label>

                  {newTestForm.negativeMarking && (
                    <div style={{ marginTop: 12 }}>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#667085', marginBottom: 4 }}>
                        Deduction Per Wrong Answer
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={newTestForm.negativeMarks}
                        onChange={(e) => setNewTestForm({ ...newTestForm, negativeMarks: parseFloat(e.target.value) || 0.66 })}
                        style={{
                          width: '100%',
                          padding: '7px 10px',
                          borderRadius: 'var(--radius)',
                          border: '1px solid #E4E7EC',
                          fontSize: 13,
                          outline: 'none',
                          backgroundColor: 'var(--bg-card)',
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* STEP 4: Review & Finalize */}
            {createStep === 4 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ padding: 16, borderRadius: 'var(--radius)', border: '1px solid #E4E7EC', backgroundColor: '#F7F7F5' }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--deep-navy)', margin: '0 0 12px 0' }}>
                    Test Configuration Summary
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#344054' }}>
                    <div><strong>Title:</strong> {newTestForm.title || 'Untitled Test'}</div>
                    <div><strong>Exam:</strong> {newTestForm.exam} ({newTestForm.year})</div>
                    <div><strong>Type:</strong> {newTestForm.type}</div>
                    <div><strong>Questions:</strong> {newTestForm.questions} Qs ({newTestForm.duration} mins)</div>
                    <div><strong>Scoring:</strong> +{newTestForm.marksPerQuestion} / {newTestForm.negativeMarking ? `-${newTestForm.negativeMarks}` : 'No negative marks'}</div>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#344054', marginBottom: 6 }}>
                    Initial Publication Status
                  </label>
                  <select
                    value={newTestForm.status}
                    onChange={(e) => setNewTestForm({ ...newTestForm, status: e.target.value as MockTestItem['status'] })}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 'var(--radius)',
                      border: '1px solid #E4E7EC',
                      fontSize: 13.5,
                      outline: 'none',
                      height: 40,
                      backgroundColor: 'var(--bg-card)',
                    }}
                  >
                    <option value="Draft">Draft (Hidden from students)</option>
                    <option value="Published">Publish Immediately</option>
                    <option value="Scheduled">Schedule Publication</option>
                  </select>
                </div>
              </div>
            )}

            {/* Modal Navigation Buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24, paddingTop: 16, borderTop: '1px solid #E4E7EC' }}>
              <button
                disabled={createStep === 1}
                onClick={() => setCreateStep((s) => Math.max(1, s - 1))}
                style={{
                  padding: '8px 16px',
                  fontSize: 13,
                  fontWeight: 500,
                  color: createStep === 1 ? 'var(--text-disabled)' : 'var(--deep-navy)',
                  background: 'var(--bg-card)',
                  border: '1px solid #E4E7EC',
                  borderRadius: 'var(--radius)',
                  cursor: createStep === 1 ? 'not-allowed' : 'pointer',
                }}
              >
                Back
              </button>

              {createStep < 4 ? (
                <button
                  onClick={() => setCreateStep((s) => Math.min(4, s + 1))}
                  style={{
                    padding: '8px 20px',
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--bg-card)',
                    background: '#12233F',
                    border: 'none',
                    borderRadius: 'var(--radius)',
                    cursor: 'pointer',
                  }}
                >
                  Next Step →
                </button>
              ) : (
                <button
                  onClick={handleCreateSubmit}
                  style={{
                    padding: '8px 20px',
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--bg-card)',
                    background: '#12233F',
                    border: 'none',
                    borderRadius: 'var(--radius)',
                    cursor: 'pointer',
                  }}
                >
                  Create Mock Test
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
