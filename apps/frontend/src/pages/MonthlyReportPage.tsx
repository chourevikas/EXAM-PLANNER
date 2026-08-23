import React, { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { StudentLayout } from '../components/student/StudentLayout';
import { Ico } from '../components/common/Icons';
import { fetchMonthlyBenchmark, MonthlyBenchmarkResponse } from '../services/analyticsService';
import { TrendingUp, Award, Target, BarChart2, ShieldCheck, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import StudentMetricCard from '../components/student/StudentMetricCard';

export function MonthlyReportPage() {
  const { getToken } = useAuth();
  const [data, setData] = useState<MonthlyBenchmarkResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [growthPage, setGrowthPage] = useState<number>(0);
  const [subjectPage, setSubjectPage] = useState<number>(0);
  const ITEMS_PER_PAGE = 4;

  const loadBenchmarkData = async () => {
    setLoading(true);
    setError(null);
    try {
      let token = localStorage.getItem('access_token');
      try {
        const clerkToken = await getToken();
        if (clerkToken) {
          token = clerkToken;
          localStorage.setItem('access_token', clerkToken);
        }
      } catch (e) {
        console.warn("Could not retrieve fresh Clerk token:", e);
      }
      const res = await fetchMonthlyBenchmark(token || undefined);
      setData(res);
    } catch (err: any) {
      console.error(err);
      setError('Failed to fetch real-time national benchmarking data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBenchmarkData();
  }, []);

  const growthTotalPages = Math.max(1, Math.ceil((data?.monthly_growth_curve?.length || 0) / ITEMS_PER_PAGE));
  const visibleGrowthItems = data?.monthly_growth_curve?.slice(growthPage * ITEMS_PER_PAGE, (growthPage + 1) * ITEMS_PER_PAGE) || [];

  const subjectTotalPages = Math.max(1, Math.ceil((data?.subject_benchmark?.length || 0) / ITEMS_PER_PAGE));
  const visibleSubjectItems = data?.subject_benchmark?.slice(subjectPage * ITEMS_PER_PAGE, (subjectPage + 1) * ITEMS_PER_PAGE) || [];

  return (
    <StudentLayout pageTitle="Performance Rank & Monthly Report">
      {/* Header Banner */}
      <section style={{ 
        marginBottom: 32, padding: '24px 28px', borderRadius: 16,
        backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0',
        boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
        backgroundImage: 'linear-gradient(135deg, rgba(16,185,129,0.04) 0%, rgba(37,99,235,0.04) 100%)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 16
      }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', backgroundColor: '#ECFDF5', borderRadius: 20, marginBottom: 10 }}>
            <Ico.Trophy size={14} />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#059669', textTransform: 'uppercase' }}>National Benchmarking</span>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#0F172A', margin: '0 0 6px 0', letterSpacing: '-0.02em' }}>Monthly Performance & National Rank</h1>
          <p style={{ fontSize: 14, color: '#64748B', margin: 0 }}>
            Percentile growth curve and exam readiness index for {data?.period || 'August 2026'}.
          </p>
        </div>

        <button
          onClick={loadBenchmarkData}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '9px 18px',
            borderRadius: 10,
            backgroundColor: '#F8FAFC',
            border: '1px solid #E2E8F0',
            color: '#0F172A',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Metrics</span>
        </button>
      </section>

      {error && (
        <div style={{ padding: 16, borderRadius: 12, backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', color: '#B91C1C', marginBottom: 24, fontSize: 13.5 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginBottom: 32 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ backgroundColor: '#FFFFFF', padding: 24, borderRadius: 14, border: '1px solid #E2E8F0', height: 136, animation: 'pulse 1.5s infinite ease-in-out' }} />
          ))}
        </div>
      ) : (
        <>
          {/* Main Stats Grid aligned with Dashboard StudentMetricCard */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginBottom: 32 }}>
            
            {/* 1. Predicted AIR */}
            <StudentMetricCard
              title="PREDICTED ALL INDIA RANK"
              value={`#${data?.predicted_rank ? data.predicted_rank.toLocaleString() : '---'}`}
              supportingText={
                <span style={{ color: '#059669', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <TrendingUp size={14} /> Top {data?.top_percentage ?? 0}% among {data?.active_aspirants ? data.active_aspirants.toLocaleString() : '24,000'}+ active aspirants
                </span>
              }
              icon={<Award size={18} />}
              accentColor="#2563EB"
            />

            {/* 2. Overall Percentile */}
            <StudentMetricCard
              title="OVERALL PERCENTILE"
              value={`${data?.overall_percentile ?? 0} %ile`}
              supportingText={
                <span style={{ color: data?.percentile_delta && data.percentile_delta >= 0 ? '#059669' : '#D97706' }}>
                  {data?.percentile_delta && data.percentile_delta >= 0 ? '↑ Up' : '↓ Down'} {Math.abs(data?.percentile_delta ?? 0)} %ile from last month ({data?.previous_month_percentile ?? 0} %ile)
                </span>
              }
              icon={<BarChart2 size={18} />}
              accentColor="#059669"
            />

            {/* 3. Exam Readiness Index */}
            <StudentMetricCard
              title="EXAM READINESS INDEX"
              value={`${data?.readiness_index ?? 0} / 100`}
              supportingText={data?.readiness_status ?? 'High probability of clearing Prelims cutoff'}
              icon={<ShieldCheck size={18} />}
              accentColor="#D97706"
            />

          </div>

          {/* Detailed Analytics Grid: Symmetrical Heights & Pagination */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 24, marginBottom: 32 }}>
            
            {/* Monthly Percentile Growth Curve Card */}
            <div style={{
              backgroundColor: '#FFFFFF',
              padding: 24,
              borderRadius: 16,
              border: '1px solid #E2E8F0',
              boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              height: 420,
              boxSizing: 'border-box'
            }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <TrendingUp size={18} color="#2563EB" /> Monthly Percentile Growth Trajectory
                  </h3>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 12, backgroundColor: '#EFF6FF', color: '#2563EB' }}>
                    {data?.monthly_growth_curve?.length || 0} Months Tracked
                  </span>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 12 }}>
                  {visibleGrowthItems.map((pt, idx) => (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600 }}>
                        <span style={{ color: '#0F172A' }}>{pt.month}</span>
                        <span style={{ color: '#2563EB' }}>{pt.percentile} %ile</span>
                      </div>
                      <div style={{ height: 10, width: '100%', backgroundColor: '#F1F5F9', borderRadius: 5, overflow: 'hidden' }}>
                        <div 
                          style={{ 
                            height: '100%', 
                            width: `${Math.min(pt.percentile, 100)}%`, 
                            background: 'linear-gradient(90deg, #2563eb 0%, #059669 100%)', 
                            borderRadius: 5,
                            transition: 'width 0.6s ease'
                          }} 
                        />
                      </div>
                    </div>
                  ))}
                  {visibleGrowthItems.length === 0 && (
                    <div style={{ textAlign: 'center', color: '#64748B', fontSize: 13, padding: 30 }}>
                      No growth trajectory records available.
                    </div>
                  )}
                </div>
              </div>

              {/* Card Pagination Footer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14, borderTop: '1px solid #F1F5F9' }}>
                <span style={{ fontSize: 12, color: '#64748B', fontWeight: 500 }}>
                  Page {growthPage + 1} of {growthTotalPages}
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => setGrowthPage(p => Math.max(0, p - 1))}
                    disabled={growthPage === 0}
                    style={{
                      padding: '5px 9px', borderRadius: 6, border: '1px solid #E2E8F0',
                      backgroundColor: growthPage === 0 ? '#F8FAFC' : '#FFFFFF',
                      color: growthPage === 0 ? '#CBD5E1' : '#0F172A',
                      cursor: growthPage === 0 ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    onClick={() => setGrowthPage(p => Math.min(growthTotalPages - 1, p + 1))}
                    disabled={growthPage >= growthTotalPages - 1}
                    style={{
                      padding: '5px 9px', borderRadius: 6, border: '1px solid #E2E8F0',
                      backgroundColor: growthPage >= growthTotalPages - 1 ? '#F8FAFC' : '#FFFFFF',
                      color: growthPage >= growthTotalPages - 1 ? '#CBD5E1' : '#0F172A',
                      cursor: growthPage >= growthTotalPages - 1 ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* Subject National Benchmarking Card */}
            <div style={{
              backgroundColor: '#FFFFFF',
              padding: 24,
              borderRadius: 16,
              border: '1px solid #E2E8F0',
              boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              height: 420,
              boxSizing: 'border-box'
            }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Target size={18} color="#059669" /> Subject Accuracy vs National Average
                  </h3>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 12, backgroundColor: '#ECFDF5', color: '#059669' }}>
                    {data?.subject_benchmark?.length || 0} Subjects
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                  {visibleSubjectItems.map((sb, idx) => (
                    <div key={idx} style={{ padding: '8px 12px', borderRadius: 10, backgroundColor: '#F8FAFC', border: '1px solid #F1F5F9' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>
                        <span style={{ color: '#0F172A' }}>{sb.subject}</span>
                        <span style={{ color: sb.user_accuracy >= sb.national_avg_accuracy ? '#059669' : '#D97706' }}>
                          {sb.user_accuracy}% <span style={{ fontSize: 10.5, color: '#64748B', fontWeight: 400 }}>(National: {sb.national_avg_accuracy}%)</span>
                        </span>
                      </div>
                      
                      {/* Visual Comparison Bars */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ height: 5, width: '100%', backgroundColor: '#E2E8F0', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${sb.user_accuracy}%`, backgroundColor: sb.user_accuracy >= sb.national_avg_accuracy ? '#059669' : '#D97706', borderRadius: 3 }} />
                        </div>
                      </div>
                    </div>
                  ))}
                  {visibleSubjectItems.length === 0 && (
                    <div style={{ textAlign: 'center', color: '#64748B', fontSize: 13, padding: 30 }}>
                      No subject benchmark data calculated yet.
                    </div>
                  )}
                </div>
              </div>

              {/* Card Pagination Footer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14, borderTop: '1px solid #F1F5F9' }}>
                <span style={{ fontSize: 12, color: '#64748B', fontWeight: 500 }}>
                  Page {subjectPage + 1} of {subjectTotalPages}
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => setSubjectPage(p => Math.max(0, p - 1))}
                    disabled={subjectPage === 0}
                    style={{
                      padding: '5px 9px', borderRadius: 6, border: '1px solid #E2E8F0',
                      backgroundColor: subjectPage === 0 ? '#F8FAFC' : '#FFFFFF',
                      color: subjectPage === 0 ? '#CBD5E1' : '#0F172A',
                      cursor: subjectPage === 0 ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    onClick={() => setSubjectPage(p => Math.min(subjectTotalPages - 1, p + 1))}
                    disabled={subjectPage >= subjectTotalPages - 1}
                    style={{
                      padding: '5px 9px', borderRadius: 6, border: '1px solid #E2E8F0',
                      backgroundColor: subjectPage >= subjectTotalPages - 1 ? '#F8FAFC' : '#FFFFFF',
                      color: subjectPage >= subjectTotalPages - 1 ? '#CBD5E1' : '#0F172A',
                      cursor: subjectPage >= subjectTotalPages - 1 ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </div>

          </div>
        </>
      )}
    </StudentLayout>
  );
}


