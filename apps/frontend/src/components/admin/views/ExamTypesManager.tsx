import React, { useState, useEffect } from 'react';
import {
  Layers,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  HelpCircle,
  Award,
  AlertCircle,
  Check,
  X,
  RefreshCw,
  FileText,
  Sliders,
  Loader2,
} from 'lucide-react';
import { Spinner } from '../../../components/common/Spinner';
import { ExamType, ExamTypeCreatePayload, ExamTypeUpdatePayload } from '../../../types/examType';
import {
  adminFetchExamTypes,
  adminCreateExamType,
  adminUpdateExamType,
  adminDeleteExamType,
} from '../../../services/examTypeService';
import { useBreakpoint } from '../../../hooks/useBreakpoint';

export function ExamTypesManager() {
  const { isMobile, isTabletOrBelow } = useBreakpoint();
  const [examTypes, setExamTypes] = useState<ExamType[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingExamType, setEditingExamType] = useState<ExamType | null>(null);
  const [modalSubmitting, setModalSubmitting] = useState<boolean>(false);

  // Delete Confirmation Modal State
  const [deletingExamType, setDeletingExamType] = useState<ExamType | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState<boolean>(false);

  // Form State
  const [formData, setFormData] = useState<ExamTypeCreatePayload>({
    type: '',
    name: '',
    total_duration: 120,
    number_of_questions: 100,
    total_marks: 200,
    negative_marks: 0.66,
    positive_marks: 2.0,
    description: '',
    is_active: true,
  });

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const loadExamTypes = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminFetchExamTypes(true);
      setExamTypes(data);
    } catch (err: any) {
      console.error('Failed to load exam types:', err);
      setError(err.message || 'Unable to load exam types.');
      showToast('error', err.message || 'Could not fetch exam types.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExamTypes();
  }, []);

  const handleOpenAddModal = () => {
    setEditingExamType(null);
    setFormData({
      type: '',
      name: '',
      total_duration: 120,
      number_of_questions: 100,
      total_marks: 200,
      negative_marks: 0.66,
      positive_marks: 2.0,
      description: '',
      is_active: true,
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: ExamType) => {
    setEditingExamType(item);
    setFormData({
      type: item.type,
      name: item.name,
      total_duration: item.total_duration,
      number_of_questions: item.number_of_questions,
      total_marks: item.total_marks,
      negative_marks: item.negative_marks,
      positive_marks: item.positive_marks,
      description: item.description || '',
      is_active: item.is_active,
    });
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.type.trim() || !formData.name.trim()) {
      showToast('error', 'Exam type code and name are required.');
      return;
    }

    setModalSubmitting(true);
    try {
      if (editingExamType) {
        await adminUpdateExamType(editingExamType.id, formData);
        showToast('success', `Exam type '${formData.name}' updated successfully!`);
      } else {
        await adminCreateExamType(formData);
        showToast('success', `Exam type '${formData.name}' created successfully!`);
      }
      setIsModalOpen(false);
      await loadExamTypes();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to save exam type.');
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingExamType) return;
    setDeleteSubmitting(true);
    try {
      await adminDeleteExamType(deletingExamType.id);
      showToast('success', `Exam type '${deletingExamType.name}' deleted successfully.`);
      setDeletingExamType(null);
      await loadExamTypes();
    } catch (err: any) {
      showToast('error', err.message || 'Could not delete exam type.');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const filteredExamTypes = examTypes.filter(
    (item) =>
      item.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div style={{ maxWidth: 1320, margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      {/* Toast Notification Banner */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: 24,
            right: 24,
            zIndex: 99999,
            backgroundColor: toast.type === 'success' ? '#166534' : '#991B1B',
            color: 'var(--bg-card)',
            padding: '12px 20px',
            borderRadius: 'var(--radius)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 13.5,
            fontWeight: 600,
            animation: 'fadeIn 0.2s ease-out',
          }}
        >
          {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Hero Header Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0F1D38 0%, #14284C 45%, #1B3864 75%, #224578 100%)',
          borderRadius: 'var(--radius)',
          padding: isMobile ? '16px 18px' : '24px 28px',
          marginBottom: 24,
          boxShadow: '0 4px 16px -2px rgba(15, 29, 56, 0.12)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 36,
                height: 36,
                flexShrink: 0,
                borderRadius: 'var(--radius)',
                backgroundColor: 'rgba(var(--primary-red-rgb), 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Sliders size={20} color="var(--primary-red)" />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--bg-card)', letterSpacing: '-0.015em' }}>
                Exam Types & Scoring Blueprints
              </h1>
              <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'rgba(255, 255, 255, 0.7)' }}>
                Single source of truth for examination blueprints, total duration, question counts, and scoring schemes.
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={loadExamTypes}
            style={{
              padding: '8px 14px',
              borderRadius: 'var(--radius)',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: 'var(--bg-card)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>

          <button
            onClick={handleOpenAddModal}
            style={{
              padding: '8px 18px',
              borderRadius: 'var(--radius)',
              backgroundColor: 'var(--primary-red)',
              border: 'none',
              color: 'var(--bg-card)',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 2px 6px rgba(var(--primary-red-rgb), 0.3)',
            }}
          >
            <Plus size={16} />
            Add Exam Type
          </button>
        </div>
      </div>

      {/* KPI Stats Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div style={{ background: 'var(--bg-card)', border: '1px solid #E2E8F0', padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Registered Exam Types
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--deep-navy)', marginTop: 8 }}>
            {examTypes.length}
          </div>
          <div style={{ fontSize: 12, color: 'var(--status-success)', marginTop: 4, fontWeight: 600 }}>
            {examTypes.filter((e) => e.is_active).length} active in system
          </div>
        </div>

        <div style={{ background: 'var(--bg-card)', border: '1px solid #E2E8F0', padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Primary Reference Type
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--primary-red)', marginTop: 8 }}>
            UPSC
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            100 Questions • 120 Mins • +2.0 / -0.66
          </div>
        </div>

        <div style={{ background: 'var(--bg-card)', border: '1px solid #E2E8F0', padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Linked Exam Papers
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--deep-navy)', marginTop: 8 }}>
            {examTypes.reduce((acc, curr) => acc + (curr.exams_count || 0), 0)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Configured with foreign key integrity
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid #E2E8F0',
          padding: '16px 20px',
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Search size={16} color="var(--text-muted)" />
        <input
          type="text"
          placeholder="Search exam types by code (upsc, mpsc) or name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            fontSize: 13.5,
            color: 'var(--deep-navy)',
          }}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Exam Types Table */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <Spinner size={32} label="Loading examination types…" />
          </div>
        ) : filteredExamTypes.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
            <Layers size={40} style={{ margin: '0 auto 12px auto', color: 'var(--text-disabled)' }} />
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--deep-navy)' }}>No Exam Types Found</div>
            <p style={{ fontSize: 13, marginTop: 4 }}>
              Click "Add Exam Type" above to configure a new examination type blueprint.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-subtle)', borderBottom: '1px solid #E2E8F0' }}>
                <th style={{ padding: '14px 20px', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                  TYPE CODE & NAME
                </th>
                <th style={{ padding: '14px 16px', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                  DURATION
                </th>
                <th style={{ padding: '14px 16px', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                  QUESTIONS & MARKS
                </th>
                <th style={{ padding: '14px 16px', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                  SCORING SCHEME
                </th>
                <th style={{ padding: '14px 16px', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                  LINKED PAPERS
                </th>
                <th style={{ padding: '14px 16px', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                  STATUS
                </th>
                <th style={{ padding: '14px 20px', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.04em', textAlign: 'right' }}>
                  ACTIONS
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredExamTypes.map((item) => (
                <tr
                  key={item.id}
                  style={{ borderBottom: '1px solid #E2E8F0', transition: 'background-color 150ms ease-out' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-subtle)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-card)')}
                >
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span
                        style={{
                          padding: '3px 8px',
                          backgroundColor: '#1E293B',
                          color: 'var(--bg-card)',
                          fontSize: 11.5,
                          fontWeight: 700,
                          fontFamily: 'monospace',
                          letterSpacing: '0.05em',
                        }}
                      >
                        {item.type.toUpperCase()}
                      </span>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--deep-navy)' }}>{item.name}</div>
                    </div>
                    {item.description && (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, maxWidth: 360 }}>
                        {item.description}
                      </div>
                    )}
                  </td>

                  <td style={{ padding: '16px 16px', fontSize: 13, color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                      <Clock size={14} color="var(--text-muted)" />
                      <span>{item.total_duration} minutes</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      ({(item.total_duration / 60).toFixed(1)} hrs)
                    </div>
                  </td>

                  <td style={{ padding: '16px 16px', fontSize: 13 }}>
                    <div style={{ fontWeight: 700, color: 'var(--deep-navy)' }}>{item.number_of_questions} Questions</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{item.total_marks} Total Marks</div>
                  </td>

                  <td style={{ padding: '16px 16px', fontSize: 13 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span
                        style={{
                          padding: '2px 8px',
                          backgroundColor: 'var(--status-success-bg)',
                          color: '#15803D',
                          fontSize: 12,
                          fontWeight: 700,
                          border: '1px solid #86EFAC',
                        }}
                      >
                        +{item.positive_marks}
                      </span>
                      <span
                        style={{
                          padding: '2px 8px',
                          backgroundColor: 'var(--primary-red-bg)',
                          color: '#B91C1C',
                          fontSize: 12,
                          fontWeight: 700,
                          border: '1px solid #FCA5A5',
                        }}
                      >
                        -{item.negative_marks}
                      </span>
                    </div>
                  </td>

                  <td style={{ padding: '16px 16px' }}>
                    <span
                      style={{
                        padding: '3px 10px',
                        backgroundColor: 'var(--bg-hover)',
                        color: 'var(--text-secondary)',
                        fontSize: 12,
                        fontWeight: 600,
                        borderRadius: 'var(--radius)',
                      }}
                    >
                      {item.exams_count || 0} papers
                    </span>
                  </td>

                  <td style={{ padding: '16px 16px' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '3px 8px',
                        fontSize: 12,
                        fontWeight: 600,
                        backgroundColor: item.is_active ? '#F0FDF4' : 'var(--bg-subtle)',
                        color: item.is_active ? '#15803D' : 'var(--text-disabled)',
                        border: `1px solid ${item.is_active ? 'var(--status-success-bg)' : 'var(--border-color)'}`,
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          backgroundColor: item.is_active ? 'var(--status-success)' : 'var(--text-disabled)',
                        }}
                      />
                      {item.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>

                  <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: 8 }}>
                      <button
                        onClick={() => handleOpenEditModal(item)}
                        title="Edit Exam Type Blueprint"
                        style={{
                          padding: '6px 10px',
                          backgroundColor: 'var(--bg-card)',
                          border: '1px solid #CBD5E1',
                          color: 'var(--deep-navy)',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <Edit2 size={13} />
                        Edit
                      </button>

                      <button
                        onClick={() => setDeletingExamType(item)}
                        title="Delete Exam Type"
                        style={{
                          padding: '6px 10px',
                          backgroundColor: 'var(--bg-card)',
                          border: '1px solid #FECACA',
                          color: '#DC2626',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <Trash2 size={13} />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>

      {/* Add / Edit Exam Type Modal */}
      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 20,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 'min(620px, calc(100vw - 24px))',
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius)',
              boxShadow: '0 20px 25px -5px rgba(15, 23, 42, 0.25)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '90vh',
            }}
          >
            <div
              style={{
                backgroundColor: 'var(--deep-navy)',
                color: 'var(--bg-card)',
                padding: '18px 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Sliders size={18} color="var(--primary-red)" />
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                  {editingExamType ? `Edit Exam Type: ${editingExamType.type.toUpperCase()}` : 'Create New Exam Type'}
                </h2>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--bg-card)', cursor: 'pointer', padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} style={{ padding: 24 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--deep-navy)', marginBottom: 6 }}>
                    Type Code <span style={{ color: 'var(--primary-red)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. upsc, mpsc"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value.toLowerCase().trim() })}
                    required
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: 13,
                      border: '1px solid #CBD5E1',
                      borderRadius: 'var(--radius)',
                      outline: 'none',
                      fontFamily: 'monospace',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--deep-navy)', marginBottom: 6 }}>
                    Examination Name <span style={{ color: 'var(--primary-red)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. UPSC Civil Services Examination"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: 13,
                      border: '1px solid #CBD5E1',
                      borderRadius: 'var(--radius)',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    Duration (Minutes)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formData.total_duration}
                    onChange={(e) => setFormData({ ...formData, total_duration: parseInt(e.target.value) || 120 })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: 13,
                      border: '1px solid #CBD5E1',
                      borderRadius: 'var(--radius)',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    Question Count
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formData.number_of_questions}
                    onChange={(e) => setFormData({ ...formData, number_of_questions: parseInt(e.target.value) || 100 })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: 13,
                      border: '1px solid #CBD5E1',
                      borderRadius: 'var(--radius)',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    Total Marks
                  </label>
                  <input
                    type="number"
                    step="any"
                    min={0}
                    value={formData.total_marks}
                    onChange={(e) => setFormData({ ...formData, total_marks: parseFloat(e.target.value) || 200 })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: 13,
                      border: '1px solid #CBD5E1',
                      borderRadius: 'var(--radius)',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#15803D', marginBottom: 6 }}>
                    Positive Marks (+ Correct)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min={0.01}
                    value={formData.positive_marks}
                    onChange={(e) => setFormData({ ...formData, positive_marks: parseFloat(e.target.value) || 2.0 })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: 13,
                      border: '1px solid #86EFAC',
                      borderRadius: 'var(--radius)',
                      outline: 'none',
                      backgroundColor: '#F0FDF4',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#B91C1C', marginBottom: 6 }}>
                    Negative Marks (- Incorrect)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={formData.negative_marks}
                    onChange={(e) => setFormData({ ...formData, negative_marks: parseFloat(e.target.value) || 0.66 })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: 13,
                      border: '1px solid #FCA5A5',
                      borderRadius: 'var(--radius)',
                      outline: 'none',
                      backgroundColor: '#FEF2F2',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Description (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Notes, syllabus guidelines, or metadata..."
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: 13,
                    border: '1px solid #CBD5E1',
                    borderRadius: 'var(--radius)',
                    outline: 'none',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--deep-navy)' }}>
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    style={{ width: 16, height: 16 }}
                  />
                  <span>Active & Available for Exam Ingestion / Practice</span>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    padding: '9px 18px',
                    backgroundColor: 'var(--bg-hover)',
                    border: '1px solid #CBD5E1',
                    color: 'var(--text-secondary)',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={modalSubmitting}
                  style={{
                    padding: '9px 22px',
                    backgroundColor: 'var(--primary-red)',
                    border: 'none',
                    color: 'var(--bg-card)',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: modalSubmitting ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  {modalSubmitting ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                  {editingExamType ? 'Update Exam Type' : 'Save Exam Type'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingExamType && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 20,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 'min(480px, calc(100vw - 24px))',
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius)',
              boxShadow: '0 20px 25px -5px rgba(15, 23, 42, 0.25)',
              padding: 24,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 'var(--radius)',
                  backgroundColor: 'var(--primary-red-bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AlertCircle size={22} color="#DC2626" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--deep-navy)' }}>
                  Delete Exam Type
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: 12.5, color: 'var(--text-muted)' }}>
                  This action is permanent and cannot be undone.
                </p>
              </div>
            </div>

            <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 20px 0' }}>
              Are you sure you want to delete <strong>{deletingExamType.name}</strong> (<code>{deletingExamType.type}</code>)?
              {(deletingExamType.exams_count || 0) > 0 && (
                <span style={{ display: 'block', color: '#DC2626', fontWeight: 600, marginTop: 8 }}>
                  ⚠️ Warning: {deletingExamType.exams_count} exam paper(s) are linked to this exam type.
                </span>
              )}
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setDeletingExamType(null)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'var(--bg-hover)',
                  border: '1px solid #CBD5E1',
                  color: 'var(--text-secondary)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={deleteSubmitting}
                onClick={handleConfirmDelete}
                style={{
                  padding: '8px 18px',
                  backgroundColor: '#DC2626',
                  border: 'none',
                  color: 'var(--bg-card)',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: deleteSubmitting ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {deleteSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
