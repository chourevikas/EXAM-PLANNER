import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { StudentLayout } from '../components/student/StudentLayout';
import { ChevronRight } from 'lucide-react';
import { Spinner } from '../components/common/Spinner';

export function CurrentAffairsPage() {
  const [affairs, setAffairs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchAffairs = async () => {
      try {
        const token = localStorage.getItem('access_token');
        const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};
        const res = await fetch('/api/v1/current-affairs/', { headers });
        if (res.ok) {
          const data = await res.json();
          setAffairs(data);
        }
      } catch (err) {
        console.error("Failed to fetch current affairs", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAffairs();
  }, []);

  const groupedAffairs = useMemo(() => {
    const groups: Record<string, any[]> = {};
    affairs.forEach(affair => {
      const dateStr = new Date(affair.date).toISOString().split('T')[0];
      if (!groups[dateStr]) groups[dateStr] = [];
      groups[dateStr].push(affair);
    });
    
    // Sort dates descending
    return Object.keys(groups)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
      .map(date => ({
        date,
        items: groups[date]
      }));
  }, [affairs]);

  return (
    <StudentLayout pageTitle="Current Affairs">
      <div data-page-align="left" style={{ maxWidth: 800, margin: 0, paddingBottom: 64 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 24, color: 'var(--text-primary)' }}>Daily Current Affairs</h1>
        
        {loading ? (
          <Spinner size={36} label="Loading articles…" />
        ) : groupedAffairs.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', backgroundColor: 'var(--bg-card)', borderRadius: 8 }}>
            <p style={{ color: 'var(--text-secondary)' }}>No current affairs published yet.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            {groupedAffairs.map(group => (
              <div key={group.date}>
                <h2 style={{ 
                  fontSize: 18, 
                  fontWeight: 700, 
                  color: 'var(--text-primary)', 
                  margin: '0 0 16px 0',
                  paddingBottom: 8,
                  borderBottom: '2px solid var(--border-default)',
                  position: 'sticky',
                  top: 0,
                  backgroundColor: 'var(--bg-base)',
                  zIndex: 10,
                  paddingTop: 8
                }}>
                  {new Date(group.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </h2>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {group.items.map(affair => (
                    <div 
                      key={affair.id} 
                      style={{ 
                        backgroundColor: 'var(--bg-card)', 
                        padding: '20px 24px', 
                        borderRadius: 12, 
                        boxShadow: 'var(--shadow-color-base)', 
                        border: '1px solid var(--border-default)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 16
                      }}
                    >
                      <div>
                        <h3 style={{ margin: '0 0 8px 0', fontSize: 18, color: 'var(--text-primary)' }}>{affair.title}</h3>
                        {affair.topic && (
                          <span style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'inline-block' }}>
                            {affair.topic} {affair.subtopic && ` • ${affair.subtopic}`}
                          </span>
                        )}
                      </div>
                      
                      <button 
                        onClick={() => navigate(`/current-affairs/${affair.id}`)}
                        style={{
                          padding: '10px 20px', backgroundColor: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer',
                          fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, whiteSpace: 'nowrap', fontSize: 14
                        }}
                      >
                        Read Article <ChevronRight size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </StudentLayout>
  );
}
