import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Ico } from '../common/Icons';
import { listExams } from '../../services/examService';

export function UpNextQueueCard() {
  const [activeExam, setActiveExam] = useState<any>(null);

  useEffect(() => {
    listExams().then(exams => {
      if (Array.isArray(exams) && exams.length > 0) {
        const published = exams.find(e => e.is_active || (e.status && String(e.status).includes('PUBLISHED')));
        setActiveExam(published || exams[0]);
      }
    }).catch(err => console.error("Failed to fetch live exams in UpNextQueueCard:", err));
  }, []);

  const examTarget = activeExam ? `/exam/${activeExam.code}` : '/pyq';

  return (
    <div style={{ 
      backgroundColor: 'var(--accent-primary)', padding: 32, borderRadius: 24, 
      color: '#FFFFFF', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      boxShadow: '0 16px 36px var(--shadow-color-accent)',
      backgroundImage: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-darker) 100%)',
      position: 'relative', overflow: 'hidden'
    }}>
      <div style={{ position: 'absolute', top: -20, right: -20, opacity: 0.15, pointerEvents: 'none' }}>
        <Ico.Target size={120} />
      </div>
      
      <div>
        <div style={{ display: 'inline-block', padding: '6px 12px', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>
          Up Next In Queue
        </div>
        <h3 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 10px 0', lineHeight: 1.3 }}>
          {activeExam ? `Practice ${activeExam.name}` : 'Resume UPSC CSE Practice'}
        </h3>
        <p style={{ fontSize: 14, opacity: 0.9, margin: 0, lineHeight: 1.5 }}>
          Test your memory and question accuracy on official UPSC Prelims papers.
        </p>
      </div>

      <Link 
        to={examTarget}
        style={{ 
          width: '100%', padding: '14px', borderRadius: 12, border: 'none',
          backgroundColor: '#FFFFFF', color: 'var(--accent-darker)',
          fontSize: 14, fontWeight: 700, cursor: 'pointer', textDecoration: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          marginTop: 24, transition: 'transform 0.2s ease', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }}
      >
        <span>Start Practice Test</span>
        <Ico.ArrowRight size={16} />
      </Link>
    </div>
  );
}
