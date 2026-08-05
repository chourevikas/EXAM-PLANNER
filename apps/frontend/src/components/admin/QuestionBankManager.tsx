import React, { useState } from 'react';
import { Search, Filter, BookOpen, CheckCircle2, Tag, ChevronRight } from 'lucide-react';

export function QuestionBankManager() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('All');

  const catalog = [
    { id: 'Q-2024-001', exam: 'UPSC Prelims 2024', subject: 'Polity', topic: 'Digital Governance', diff: 'Medium', question: "With reference to the 'Digital India' programme, which of the following is/are its stated objective(s)?", options: 4, verified: true },
    { id: 'Q-2024-002', exam: 'UPSC Prelims 2024', subject: 'Polity', topic: 'Federalism', diff: 'Easy', question: 'Which one of the following is NOT a feature of the Indian federal system as practiced?', options: 4, verified: true },
    { id: 'Q-2024-003', exam: 'UPSC Prelims 2024', subject: 'History', topic: 'Ancient India', diff: 'Medium', question: 'Consider the following statements about Nalanda University and select the correct ones:', options: 4, verified: true },
    { id: 'Q-2024-004', exam: 'UPSC Prelims 2024', subject: 'Science', topic: 'Space Technology', diff: 'Hard', question: "The term 'Navigational Satellite System' is associated with which of the following?", options: 4, verified: false },
    { id: 'Q-2024-005', exam: 'UPSC Prelims 2024', subject: 'Geography', topic: 'Physical Geography', diff: 'Hard', question: 'With reference to Western Ghats, consider the following statements regarding its biodiversity:', options: 4, verified: true },
  ];

  const subjects = ['All', 'Polity', 'History', 'Geography', 'Science', 'Economy'];

  const filtered = catalog.filter((q) => {
    const matchesSubject = selectedSubject === 'All' || q.subject === selectedSubject;
    const matchesSearch =
      q.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.topic.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.id.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSubject && matchesSearch;
  });

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 20, padding: 32, boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, color: 'var(--text-main)', margin: 0 }}>
              📚 Question Bank Catalog
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>
              Catalog of verified UPSC & State PSC questions parsed through S3 OCR & AI extraction.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: 12 }} />
              <input
                type="text"
                placeholder="Search questions or topics..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  padding: '9px 14px 9px 36px',
                  borderRadius: 10,
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-body)',
                  color: 'var(--text-main)',
                  fontSize: 13,
                  outline: 'none',
                  width: 260,
                }}
              />
            </div>
          </div>
        </div>

        {/* Subject Filter Pills */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, overflowX: 'auto' }}>
          {subjects.map((subj) => (
            <button
              key={subj}
              onClick={() => setSelectedSubject(subj)}
              style={{
                fontSize: 13,
                fontWeight: 600,
                padding: '7px 16px',
                borderRadius: 99,
                border: selectedSubject === subj ? '1px solid var(--royal)' : '1px solid var(--border-color)',
                background: selectedSubject === subj ? 'rgba(37, 99, 235, 0.12)' : 'var(--bg-secondary)',
                color: selectedSubject === subj ? 'var(--royal)' : 'var(--text-muted)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {subj}
            </button>
          ))}
        </div>

        {/* Question Cards Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {filtered.map((q) => (
            <div
              key={q.id}
              style={{
                padding: 20,
                borderRadius: 14,
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 20,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--royal)', fontFamily: 'var(--font-mono)' }}>
                    {q.id}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(37, 99, 235, 0.12)', color: 'var(--royal)', padding: '2px 8px', borderRadius: 99 }}>
                    {q.subject}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {q.topic}
                  </span>
                </div>

                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-main)', margin: '4px 0 0', lineHeight: 1.5 }}>
                  {q.question}
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {q.verified ? (
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CheckCircle2 size={14} /> Verified
                  </span>
                ) : (
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#f59e0b' }}>Pending Review</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
