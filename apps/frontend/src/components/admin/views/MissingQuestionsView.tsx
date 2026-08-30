import React, { useState, useEffect } from 'react';
import {
  Search,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Plus,
  Loader2,
  FileText,
  Calendar,
  Layers,
  ArrowRight,
  RefreshCw,
  Sparkles,
  ShieldAlert
} from 'lucide-react';
import {
  fetchExamsByYear,
  fetchExamIntegrityQuestions,
  ExamIntegrityQuestionsResponse
} from '../../../services/adminService';
import { AddMissingQuestionModal } from '../modals/AddMissingQuestionModal';

interface MissingQuestionsViewProps {
  onSelectExam: (exam: any) => void;
}

export function MissingQuestionsView({ onSelectExam }: MissingQuestionsViewProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const [examsByYear, setExamsByYear] = useState<Record<string, any[]>>({});
  const [years, setYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Detailed Integrity state per exam id
  const [integrityMap, setIntegrityMap] = useState<Record<string, ExamIntegrityQuestionsResponse>>({});
  const [loadingIntegrity, setLoadingIntegrity] = useState<boolean>(false);

  // Add Missing Question Modal state
  const [activeModalExam, setActiveModalExam] = useState<any | null>(null);
  const [modalInitialQNum, setModalInitialQNum] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const yearData = await fetchExamsByYear();
      const yrList: number[] = yearData.years || [];
      const yrMap: Record<string, any[]> = yearData.exams_by_year || {};

      setYears(yrList);
      setExamsByYear(yrMap);

      // Collect all exam items
      const allExams: any[] = [];
      Object.values(yrMap).forEach((list) => {
        if (Array.isArray(list)) allExams.push(...list);
      });

      // Fetch integrity breakdown for exams
      setLoadingIntegrity(true);
      const integrityResults: Record<string, ExamIntegrityQuestionsResponse> = {};
      await Promise.all(
        allExams.map(async (e) => {
          try {
            const diag = await fetchExamIntegrityQuestions(e.id, 'ALL', 1, 100);
            if (diag) {
              integrityResults[e.id] = diag;
            }
          } catch (err) {
            console.warn(`Failed to fetch integrity for exam ${e.id}:`, err);
          }
        })
      );
      setIntegrityMap(integrityResults);
      setLoadingIntegrity(false);
    } catch (err) {
      console.error('Failed to load exams by year for missing questions view:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter exams based on year and search
  const filteredExams = React.useMemo(() => {
    let list: any[] = [];
    if (selectedYear === 'ALL') {
      Object.values(examsByYear).forEach((yrList) => {
        if (Array.isArray(yrList)) list.push(...yrList);
      });
    } else {
      list = examsByYear[selectedYear] || [];
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (e) =>
          (e.name || '').toLowerCase().includes(q) ||
          (e.code || '').toLowerCase().includes(q) ||
          (e.paper_set_code || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [examsByYear, selectedYear, searchQuery]);

  // Aggregate Metrics
  const metrics = React.useMemo(() => {
    let totalExamsCount = filteredExams.length;
    let examsWithMissing = 0;
    let totalMissingQuestionsCount = 0;
    let totalCorruptedCount = 0;

    filteredExams.forEach((e) => {
      const diag = integrityMap[e.id];
      const missingCount = diag ? diag.missing_count : Math.max(0, (e.total_questions || 100) - (e.extracted_questions_count || 0));
      const corruptedCount = diag ? diag.corrupted_count : 0;

      if (missingCount > 0) {
        examsWithMissing += 1;
        totalMissingQuestionsCount += missingCount;
      }
      totalCorruptedCount += corruptedCount;
    });

    const healthyExams = totalExamsCount - examsWithMissing;
    const healthPercentage = totalExamsCount > 0 ? Math.round((healthyExams / totalExamsCount) * 100) : 100;

    return {
      totalExamsCount,
      examsWithMissing,
      totalMissingQuestionsCount,
      totalCorruptedCount,
      healthPercentage,
    };
  }, [filteredExams, integrityMap]);

  const handleOpenAddMissingModal = (exam: any, qNum?: number) => {
    const diag = integrityMap[exam.id];
    const missingNums = diag?.missing_question_numbers || [];

    setActiveModalExam({
      id: exam.id,
      name: exam.name,
      code: exam.code,
      paper_set_code: exam.paper_set_code || 'SET_A',
      missing_question_numbers: missingNums,
    });
    setModalInitialQNum(qNum || (missingNums.length > 0 ? missingNums[0] : 1));
    setIsModalOpen(true);
  };

  const handleModalSuccess = () => {
    loadData();
  };

  // Toggle expanding missing numbers list per exam
  const [expandedExams, setExpandedExams] = useState<Record<string, boolean>>({});


  const toggleExpandExams = (examId: string) => {
    setExpandedExams((prev) => ({
      ...prev,
      [examId]: !prev[examId],
    }));
  };

  return (
    <div style={{ padding: '24px 32px', width: '100%', maxWidth: 1400, margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      {/* Header Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24,
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#DC2626',
              }}
            >
              <AlertTriangle size={20} />
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0F172A', margin: 0, letterSpacing: '-0.015em' }}>
              Missing Questions & Extraction Integrity
            </h1>
          </div>
          <p style={{ fontSize: 13.5, color: '#64748B', margin: 0 }}>
            Audit missing questions across exam papers and manually complete unextracted paper items.
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '9px 16px',
            backgroundColor: '#ffffff',
            border: '1px solid #CBD5E1',
            borderRadius: 8,
            color: '#334155',
            fontSize: 13.5,
            fontWeight: 500,
            cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
            transition: 'all 0.15s ease',
          }}
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Audit</span>
        </button>
      </div>

      {/* Aggregate Overview Stat Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 16,
          marginBottom: 28,
        }}
      >
        <div
          style={{
            backgroundColor: '#ffffff',
            padding: '20px 24px',
            borderRadius: 12,
            border: '1px solid #E2E8F0',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#64748B', marginBottom: 4 }}>Total Exam Papers</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#0F172A' }}>{metrics.totalExamsCount}</div>
          </div>
          <div style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>
            <Layers size={22} />
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#ffffff',
            padding: '20px 24px',
            borderRadius: 12,
            border: '1px solid #E2E8F0',
            borderLeft: '4px solid #EF4444',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#991B1B', marginBottom: 4 }}>Exams With Missing Qs</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#DC2626' }}>{metrics.examsWithMissing}</div>
          </div>
          <div style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#DC2626' }}>
            <AlertCircle size={22} />
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#ffffff',
            padding: '20px 24px',
            borderRadius: 12,
            border: '1px solid #E2E8F0',
            borderLeft: '4px solid #F59E0B',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#92400E', marginBottom: 4 }}>Total Missing Question Items</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#D97706' }}>{metrics.totalMissingQuestionsCount}</div>
          </div>
          <div style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D97706' }}>
            <FileText size={22} />
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#ffffff',
            padding: '20px 24px',
            borderRadius: 12,
            border: '1px solid #E2E8F0',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#64748B', marginBottom: 4 }}>Paper Extraction Health</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: metrics.healthPercentage >= 80 ? '#10B981' : '#D97706' }}>
              {metrics.healthPercentage}%
            </div>
          </div>
          <div style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: metrics.healthPercentage >= 80 ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)', border: `1px solid ${metrics.healthPercentage >= 80 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: metrics.healthPercentage >= 80 ? '#059669' : '#D97706' }}>
            <CheckCircle2 size={22} />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          backgroundColor: '#ffffff',
          padding: '14px 20px',
          borderRadius: 10,
          border: '1px solid #E2E8F0',
          marginBottom: 20,
          flexWrap: 'wrap',
          boxShadow: '0 1px 2px rgba(15, 23, 42, 0.03)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 260 }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: 360 }}>
            <Search size={16} color="#94A3B8" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Search by exam name or paper code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                borderRadius: 6,
                border: '1px solid #CBD5E1',
                fontSize: 13.5,
                outline: 'none',
              }}
            />
          </div>
        </div>

        {/* Year Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#64748B', marginRight: 4 }}>Year:</span>
          <button
            onClick={() => setSelectedYear('ALL')}
            style={{
              padding: '5px 12px',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: selectedYear === 'ALL' ? 600 : 400,
              backgroundColor: selectedYear === 'ALL' ? '#0F172A' : '#F1F5F9',
              color: selectedYear === 'ALL' ? '#ffffff' : '#475569',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            All Years
          </button>
          {years.map((yr) => (
            <button
              key={yr}
              onClick={() => setSelectedYear(String(yr))}
              style={{
                padding: '5px 12px',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: selectedYear === String(yr) ? 600 : 400,
                backgroundColor: selectedYear === String(yr) ? '#0F172A' : '#F1F5F9',
                color: selectedYear === String(yr) ? '#ffffff' : '#475569',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {yr}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0' }}>
          <Loader2 size={32} className="animate-spin" color="#DC2626" />
          <p style={{ fontSize: 14, color: '#64748B', marginTop: 12 }}>Auditing exam paper integrity & missing questions...</p>
        </div>
      ) : filteredExams.length === 0 ? (
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 12,
            padding: '48px 24px',
            textAlign: 'center',
            border: '1px solid #E2E8F0',
          }}
        >
          <CheckCircle2 size={40} color="#10B981" style={{ margin: '0 auto 12px auto' }} />
          <h3 style={{ fontSize: 18, fontWeight: 600, color: '#1E293B', margin: '0 0 6px 0' }}>
            No Missing Questions Found
          </h3>
          <p style={{ fontSize: 14, color: '#64748B', margin: 0 }}>
            All exam papers matching the selected filter are fully extracted and complete.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {filteredExams.map((exam) => {
            const diag = integrityMap[exam.id];
            const missingCount = diag ? diag.missing_count : Math.max(0, (exam.total_questions || 100) - (exam.extracted_questions_count || 0));
            const missingNumbers = diag?.missing_question_numbers || [];
            const extractedCount = diag ? diag.total_extracted_questions : (exam.extracted_questions_count || 0);
            const expectedCount = diag ? diag.total_expected_questions : (exam.total_questions || 100);
            const corruptedCount = diag ? diag.corrupted_count : 0;
            const isExpanded = Boolean(expandedExams[exam.id]);
            const visiblePills = isExpanded ? missingNumbers : missingNumbers.slice(0, 16);
            const hiddenCount = missingNumbers.length - visiblePills.length;

            return (
              <div
                key={exam.id}
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: 12,
                  border: '1px solid #E2E8F0',
                  borderLeft: missingCount > 0 ? '4px solid #EF4444' : '4px solid #10B981',
                  boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
                  padding: '20px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <h3 style={{ fontSize: 17, fontWeight: 600, color: '#0F172A', margin: 0 }}>
                        {exam.name || 'Exam Paper'}
                      </h3>
                      {exam.source_year && (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: 12,
                            backgroundColor: '#F1F5F9',
                            color: '#475569',
                          }}
                        >
                          {exam.source_year}
                        </span>
                      )}
                      {exam.paper_set_code && (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: 12,
                            backgroundColor: '#E0F2FE',
                            color: '#0369A1',
                          }}
                        >
                          Set {exam.paper_set_code}
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: 13, color: '#64748B', margin: '4px 0 0 0' }}>
                      Code: {exam.code || exam.id}
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
                        {extractedCount} / {expectedCount} Extracted
                      </div>
                      <div style={{ fontSize: 11, color: missingCount > 0 ? '#DC2626' : '#10B981', fontWeight: 600 }}>
                        {missingCount > 0 ? `${missingCount} Question${missingCount > 1 ? 's' : ''} Missing` : '100% Extracted'}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      {missingCount > 0 && (
                        <button
                          onClick={() => handleOpenAddMissingModal(exam)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '8px 16px',
                            backgroundColor: '#E31B23',
                            color: '#ffffff',
                            borderRadius: 6,
                            fontSize: 13,
                            fontWeight: 600,
                            border: 'none',
                            cursor: 'pointer',
                            boxShadow: '0 2px 4px rgba(227, 27, 35, 0.2)',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <Plus size={15} />
                          <span>Add Missing Q</span>
                        </button>
                      )}

                      <button
                        onClick={() => onSelectExam(exam)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '8px 14px',
                          backgroundColor: '#ffffff',
                          color: '#334155',
                          borderRadius: 6,
                          fontSize: 13,
                          fontWeight: 500,
                          border: '1px solid #CBD5E1',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <span>Review Paper</span>
                        <ArrowRight size={15} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Premium Transparent Red Glass Missing Sequence Container */}
                {missingNumbers.length > 0 && (
                  <div
                    style={{
                      backgroundColor: 'rgba(239, 68, 68, 0.03)',
                      backdropFilter: 'blur(4px)',
                      padding: '14px 18px',
                      borderRadius: 10,
                      border: '1px solid rgba(239, 68, 68, 0.18)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: '#991B1B', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <AlertCircle size={15} color="#DC2626" />
                        Missing Sequence Numbers ({missingNumbers.length}):
                      </span>
                      {missingNumbers.length > 16 && (
                        <button
                          onClick={() => toggleExpandExams(exam.id)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#DC2626',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                            padding: '2px 6px',
                            borderRadius: 4,
                          }}
                        >
                          {isExpanded ? 'Collapse List' : `+ ${hiddenCount} More Missing Questions`}
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {visiblePills.map((qNum) => (
                        <button
                          key={qNum}
                          onClick={() => handleOpenAddMissingModal(exam, qNum)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 6,
                            backgroundColor: 'rgba(239, 68, 68, 0.08)',
                            border: '1px solid rgba(239, 68, 68, 0.22)',
                            color: '#B91C1C',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.18)';
                            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.08)';
                            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.22)';
                          }}
                          title={`Click to add Question #${qNum}`}
                        >
                          <span>Q#{qNum}</span>
                          <Plus size={12} color="#DC2626" />
                        </button>
                      ))}

                      {!isExpanded && hiddenCount > 0 && (
                        <button
                          onClick={() => toggleExpandExams(exam.id)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 6,
                            backgroundColor: 'rgba(239, 68, 68, 0.04)',
                            border: '1px dashed rgba(239, 68, 68, 0.3)',
                            color: '#DC2626',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          +{hiddenCount} More...
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Missing Question Modal */}
      <AddMissingQuestionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        exam={activeModalExam}
        initialQuestionNumber={modalInitialQNum}
        onSuccess={handleModalSuccess}
      />
    </div>
  );
}

