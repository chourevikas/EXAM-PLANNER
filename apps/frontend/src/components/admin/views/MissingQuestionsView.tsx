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
  ShieldAlert
} from 'lucide-react';
import { Spinner } from '../../../components/common/Spinner';
import {
  fetchExamsByYear,
  fetchExamIntegrityQuestions,
  clearExamIntegrityCache,
  ExamIntegrityQuestionsResponse
} from '../../../services/adminService';
import { createAdaptivePoller } from '../../../utils/adaptivePolling';
import { AddMissingQuestionModal } from '../modals/AddMissingQuestionModal';
import { cleanExamTitle } from '../../../utils/formatEnum';

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

  const computeIsExtracting = (exam: any, diag?: ExamIntegrityQuestionsResponse): boolean => {
    // If diag is loaded and explicitly reports is_extracting
    if (diag !== undefined) {
      if (diag.is_extracting) return true;
      return false;
    }

    const isPub = Boolean(
      exam.is_published ||
      (exam.status || '').toUpperCase().includes('PUBLISHED') ||
      (exam.overall_status || '').toUpperCase() === 'PUBLISHED' ||
      (exam.pipeline_status || '').toUpperCase() === 'PUBLISHED'
    );
    if (isPub) return false;

    if (exam.is_extracting) return true;
    if ((exam.overall_status || '').toUpperCase() === 'PROCESSING') return true;

    const s1 = (exam.stage1_status || '').toUpperCase();
    if (['IN_PROGRESS', 'RUNNING', 'PROCESSING', 'INITIALIZING'].includes(s1)) return true;

    const pipeSt = (exam.pipeline_status || exam.status || '').toUpperCase();
    if (['PROCESSING', 'EXTRACTING', 'RUNNING', 'INITIALIZING', 'PARSING_PDF', 'AI PROCESSING'].includes(pipeSt)) return true;

    if (exam.stage1_step && !['DOCUMENT_EXTRACTION_COMPLETE', 'COMPLETED', 'FLAGGED_QUESTIONS_REQUIRE_ADMIN_REVIEW'].includes(exam.stage1_step.toUpperCase())) {
      return true;
    }

    return false;
  };

  const loadData = async (forceRefresh: boolean = false, isBackground: boolean = false) => {
    if (!isBackground) {
      setLoading(true);
    }
    try {
      if (forceRefresh) {
        clearExamIntegrityCache();
      }
      const yearData = await fetchExamsByYear(forceRefresh);
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
      if (!isBackground) {
        setLoadingIntegrity(true);
      }
      const integrityResults: Record<string, ExamIntegrityQuestionsResponse> = {};
      await Promise.all(
        allExams.map(async (e) => {
          try {
            const diag = await fetchExamIntegrityQuestions(e.id, 'ALL', 1, 250, forceRefresh);
            if (diag) {
              integrityResults[e.id] = diag;
            }
          } catch (err) {
            console.warn(`Failed to fetch integrity for exam ${e.id}:`, err);
          }
        })
      );
      setIntegrityMap(integrityResults);
      if (!isBackground) {
        setLoadingIntegrity(false);
      }
    } catch (err) {
      console.error('Failed to load exams by year for missing questions view:', err);
    } finally {
      if (!isBackground) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Adaptive background polling for pipeline status changes (e.g. when extraction completes or progresses)
  useEffect(() => {
    const poller = createAdaptivePoller(
      async () => {
        const allList: any[] = [];
        Object.values(examsByYear).forEach((l) => {
          if (Array.isArray(l)) allList.push(...l);
        });
        const hasExtracting = allList.some(
          (e) => computeIsExtracting(e, integrityMap[e.id])
        );
        await loadData(hasExtracting, true);
        return { hasActiveTask: hasExtracting };
      },
      {
        initialDelayMs: 4000,
        minDelayMs: 3000,
        idleDelayMs: 15000,
        maxDelayMs: 25000,
      }
    );

    poller.start();
    return () => poller.stop();
  }, [examsByYear, integrityMap]);

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
      const isExtracting = computeIsExtracting(e, diag);
      if (isExtracting) {
        return; // Do not show or aggregate missing questions for papers currently undergoing extraction
      }
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

  const handleOpenAddMissingModal = (exam: any, qNum?: number, isCorrupted: boolean = false) => {
    const diag = integrityMap[exam.id];
    const missingNums = diag?.missing_question_numbers || [];
    const corruptedNums = (diag?.items || [])
      .filter((item: any) => item.issue_category === 'CORRUPTED' || item.issue_category === 'PARTIALLY_CORRUPTED')
      .map((item: any) => item.question_number_in_paper)
      .sort((a: number, b: number) => a - b);

    setActiveModalExam({
      id: exam.id,
      name: exam.name,
      code: exam.code,
      paper_set_code: exam.paper_set_code || 'SET_A',
      missing_question_numbers: isCorrupted ? corruptedNums : missingNums,
    });
    setModalInitialQNum(qNum || (isCorrupted ? (corruptedNums.length > 0 ? corruptedNums[0] : 1) : (missingNums.length > 0 ? missingNums[0] : 1)));
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
                borderRadius: 0,
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
          onClick={() => loadData(true)}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '9px 16px',
            backgroundColor: '#ffffff',
            border: '1px solid #CBD5E1',
            borderRadius: 0,
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
            borderRadius: 0,
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
          <div style={{ width: 44, height: 44, borderRadius: 0, backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>
            <Layers size={22} />
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#ffffff',
            padding: '20px 24px',
            borderRadius: 0,
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
          <div style={{ width: 44, height: 44, borderRadius: 0, backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#DC2626' }}>
            <AlertCircle size={22} />
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#ffffff',
            padding: '20px 24px',
            borderRadius: 0,
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
          <div style={{ width: 44, height: 44, borderRadius: 0, backgroundColor: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D97706' }}>
            <FileText size={22} />
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#ffffff',
            padding: '20px 24px',
            borderRadius: 0,
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
          <div style={{ width: 44, height: 44, borderRadius: 0, backgroundColor: metrics.healthPercentage >= 80 ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)', border: `1px solid ${metrics.healthPercentage >= 80 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: metrics.healthPercentage >= 80 ? '#059669' : '#D97706' }}>
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
          borderRadius: 0,
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
                borderRadius: 0,
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
              borderRadius: 0,
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
                borderRadius: 0,
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
        <Spinner size={36} label="Auditing exam paper integrity & missing questions…" />
      ) : filteredExams.length === 0 ? (
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 0,
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
            const isExtracting = computeIsExtracting(exam, diag);
            const missingCount = isExtracting ? 0 : (diag ? diag.missing_count : Math.max(0, (exam.total_questions || 100) - (exam.extracted_questions_count || 0)));
            const missingNumbers = isExtracting ? [] : (diag?.missing_question_numbers || []);
            const corruptedNumbers = (diag?.items || [])
              .filter((item: any) => item.issue_category === 'CORRUPTED' || item.issue_category === 'PARTIALLY_CORRUPTED')
              .map((item: any) => item.question_number_in_paper)
              .sort((a: number, b: number) => a - b);
            
            const extractedCount = diag ? diag.total_extracted_questions : (exam.extracted_questions_count || 0);
            const expectedCount = diag ? diag.total_expected_questions : (exam.total_questions || 100);
            const corruptedCount = diag ? diag.corrupted_count + diag.partially_corrupted_count : 0;
            const isExpanded = Boolean(expandedExams[exam.id]);
            
            const visiblePills = isExpanded ? missingNumbers : missingNumbers.slice(0, 16);
            const hiddenCount = missingNumbers.length - visiblePills.length;
            
            const visibleCorruptedPills = isExpanded ? corruptedNumbers : corruptedNumbers.slice(0, 16);
            const hiddenCorruptedCount = corruptedNumbers.length - visibleCorruptedPills.length;

            return (
              <div
                key={exam.id}
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: 0,
                  border: '1px solid #E2E8F0',
                  borderLeft: isExtracting ? '4px solid #3B82F6' : (missingCount > 0 ? '4px solid #EF4444' : '4px solid #10B981'),
                  boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
                  padding: '20px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                }}
              >
                {/* Header Row: Info & Action Buttons */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 16,
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', margin: 0 }}>
                        {cleanExamTitle(exam.name || 'Exam Paper')}
                      </h3>
                    </div>

                    <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
                      Year: <strong>{exam.source_year || 'N/A'}</strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    {/* Metrics badge */}
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
                        {extractedCount} / {expectedCount} Extracted
                      </div>
                      <div style={{ fontSize: 11, color: isExtracting ? '#2563EB' : ((missingCount > 0 || corruptedCount > 0) ? '#DC2626' : '#10B981'), fontWeight: 600 }}>
                        {isExtracting ? (
                          'Extraction In Progress...'
                        ) : (
                          <>
                            {missingCount > 0 ? `${missingCount} Missing ` : ''}
                            {corruptedCount > 0 ? `${corruptedCount} Corrupted ` : ''}
                            {missingCount === 0 && corruptedCount === 0 ? '100% Extracted & Valid' : ''}
                          </>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      {!isExtracting && missingCount > 0 && (
                        <button
                          onClick={() => handleOpenAddMissingModal(exam)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '8px 14px',
                            backgroundColor: '#FEF2F2',
                            color: '#DC2626',
                            borderRadius: 0,
                            fontSize: 13,
                            fontWeight: 600,
                            border: '1px solid #FECACA',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <Plus size={14} />
                          <span>Add Missing Q</span>
                        </button>
                      )}

                      {isExtracting ? (
                        <button
                          disabled
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '8px 14px',
                            backgroundColor: '#F1F5F9',
                            color: '#94A3B8',
                            borderRadius: 0,
                            fontSize: 13,
                            fontWeight: 500,
                            border: '1px solid #E2E8F0',
                            cursor: 'not-allowed',
                          }}
                          title="Paper is currently undergoing extraction — review is locked"
                        >
                          <Loader2 size={14} className="animate-spin text-amber-600" />
                          <span>In Extraction (Locked)</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => onSelectExam(exam)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '8px 14px',
                            backgroundColor: '#ffffff',
                            color: '#334155',
                            borderRadius: 0,
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
                      )}
                    </div>
                  </div>
                </div>

                {/* Extraction Active Notice */}
                {isExtracting && (
                  <div
                    style={{
                      backgroundColor: 'rgba(59, 130, 246, 0.05)',
                      padding: '12px 16px',
                      borderRadius: 0,
                      border: '1px solid rgba(59, 130, 246, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      color: '#1D4ED8',
                      fontSize: 13,
                      fontWeight: 500,
                    }}
                  >
                    <Loader2 size={16} className="animate-spin" />
                    <span>This paper is currently undergoing question extraction. Missing question checks will activate once extraction completes.</span>
                  </div>
                )}

                {/* Premium Transparent Red Glass Missing Sequence Container */}
                {!isExtracting && missingNumbers.length > 0 && (
                  <div
                    style={{
                      backgroundColor: 'rgba(239, 68, 68, 0.03)',
                      backdropFilter: 'blur(4px)',
                      padding: '14px 18px',
                      borderRadius: 0,
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
                            borderRadius: 0,
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
                          onClick={() => handleOpenAddMissingModal(exam, qNum, false)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 0,
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
                            borderRadius: 0,
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

                {/* Premium Transparent Amber Glass Corrupted Sequence Container */}
                {corruptedNumbers.length > 0 && (
                  <div
                    style={{
                      backgroundColor: 'rgba(245, 158, 11, 0.03)',
                      backdropFilter: 'blur(4px)',
                      padding: '14px 18px',
                      borderRadius: 0,
                      border: '1px solid rgba(245, 158, 11, 0.18)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: '#92400E', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <AlertTriangle size={15} color="#D97706" />
                        Corrupted Sequence Numbers ({corruptedNumbers.length}):
                      </span>
                      {corruptedNumbers.length > 16 && (
                        <button
                          onClick={() => toggleExpandExams(exam.id)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#D97706',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                            padding: '2px 6px',
                            borderRadius: 0,
                          }}
                        >
                          {isExpanded ? 'Collapse List' : `+ ${hiddenCorruptedCount} More Corrupted Questions`}
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {visibleCorruptedPills.map((qNum) => (
                        <button
                          key={qNum}
                          onClick={() => handleOpenAddMissingModal(exam, qNum, true)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 0,
                            backgroundColor: 'rgba(245, 158, 11, 0.08)',
                            border: '1px solid rgba(245, 158, 11, 0.22)',
                            color: '#B45309',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(245, 158, 11, 0.18)';
                            e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.4)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(245, 158, 11, 0.08)';
                            e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.22)';
                          }}
                          title={`Click to fix Corrupted Question #${qNum}`}
                        >
                          <span>Q#{qNum}</span>
                          <AlertCircle size={12} color="#D97706" />
                        </button>
                      ))}

                      {!isExpanded && hiddenCorruptedCount > 0 && (
                        <button
                          onClick={() => toggleExpandExams(exam.id)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 0,
                            backgroundColor: 'rgba(245, 158, 11, 0.04)',
                            border: '1px dashed rgba(245, 158, 11, 0.3)',
                            color: '#D97706',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          +{hiddenCorruptedCount} More...
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

