import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { StudentLayout } from '../components/student/StudentLayout';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Ico } from '../components/common/Icons';
import { ArrowLeft } from 'lucide-react';

export function CurrentAffairsDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [affair, setAffair] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchAffair = async () => {
      try {
        const token = localStorage.getItem('access_token');
        const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};
        const res = await fetch(`/api/v1/current-affairs/${id}`, { headers });
        if (res.ok) {
          const data = await res.json();
          setAffair(data);
        } else {
          setError('Article not found.');
        }
      } catch (err) {
        console.error("Failed to fetch article", err);
        setError('Failed to fetch article.');
      } finally {
        setLoading(false);
      }
    };
    if (id) {
      fetchAffair();
    }
  }, [id]);

  const handlePractice = (affairData: any) => {
    const params = new URLSearchParams();
    if (affairData.topic) params.append('subject', affairData.topic);
    if (affairData.subtopic) params.append('topic', affairData.subtopic);
    navigate(`/practice-exam?${params.toString()}`);
  };

  return (
    <StudentLayout pageTitle="Read Article">
      <div style={{ paddingBottom: 64, width: '100%' }}>
        <button 
          onClick={() => navigate('/current-affairs')}
          style={{ 
            display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', 
            color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: 24, padding: 0, fontWeight: 500, fontSize: 14 
          }}
        >
          <ArrowLeft size={16} /> Back to Current Affairs
        </button>

        {loading ? (
          <p>Loading article...</p>
        ) : error || !affair ? (
          <div style={{ padding: 40, textAlign: 'center', backgroundColor: 'var(--bg-card)', borderRadius: 8 }}>
            <p style={{ color: 'var(--text-secondary)' }}>{error || 'Article not found.'}</p>
          </div>
        ) : (
          <div style={{ backgroundColor: 'var(--bg-card)', padding: 32, borderRadius: 12, boxShadow: 'var(--shadow-color-base)', border: '1px solid var(--border-default)' }}>
            <h1 style={{ margin: '0 0 16px 0', fontSize: 28, color: 'var(--text-primary)', lineHeight: 1.3 }}>{affair.title}</h1>
            
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 32, paddingBottom: 24, borderBottom: '1px solid var(--border-default)' }}>
              <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                {new Date(affair.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
              {affair.topic && (
                <span style={{ fontSize: 12, padding: '4px 12px', backgroundColor: 'var(--bg-subtle)', borderRadius: 16, color: 'var(--text-primary)', fontWeight: 500 }}>
                  {affair.topic} {affair.subtopic && ` • ${affair.subtopic}`}
                </span>
              )}
            </div>
            
            <div className="markdown-content" style={{ fontSize: 16, lineHeight: 1.8, color: 'var(--text-primary)', marginBottom: 40 }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{affair.content}</ReactMarkdown>
            </div>

            <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: 32, display: 'flex', justifyContent: 'center' }}>
              <button 
                onClick={() => handlePractice(affair)}
                style={{
                  padding: '12px 24px', backgroundColor: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer',
                  fontWeight: 600, display: 'flex', alignItems: 'center', gap: 12, fontSize: 15, boxShadow: '0 4px 12px rgba(var(--primary-red-rgb), 0.25)'
                }}
              >
                <Ico.Target size={20} /> Practice Questions on this Topic
              </button>
            </div>
          </div>
        )}
      </div>
    </StudentLayout>
  );
}
