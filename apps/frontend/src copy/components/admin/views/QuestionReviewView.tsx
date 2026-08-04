import React, { useState } from 'react';
import { ClipboardCheck, ThumbsUp, ThumbsDown, CheckCircle2, AlertTriangle, Eye } from 'lucide-react';

export function QuestionReviewView() {
  const pendingReviews = [
    { id: 'REV-101', question: "Which one of the following statements best describes the term 'Social Capital'?", options: ['Stock of capital owned by social workers', 'Set of values and networks in a society', 'Total money spent on welfare', 'Infrastructure built by communities'], subject: 'Economy', conf: 96.5, reviewer: 'Unassigned' },
    { id: 'REV-102', question: 'Consider the following statements regarding the Attorney General of India:', options: ['Appointed by the President', 'Must be qualified to be a Supreme Court Judge', 'Has the right of audience in all courts in India', 'All of the above'], subject: 'Polity', conf: 98.1, reviewer: 'Neeraj Admin' },
    { id: 'REV-103', question: 'In the context of Indian economy, what is the purpose of Open Market Operations (OMOs)?', options: ['Buying/selling G-Secs by RBI', 'Regulating private banks', 'Importing essential commodities', 'Fixing interest rates for MSMEs'], subject: 'Economy', conf: 92.4, reviewer: 'Unassigned' },
  ];

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 20, padding: 32, boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ClipboardCheck size={20} />
              </div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, color: 'var(--text-main)', margin: 0 }}>
                Question Review & Verification Queue
              </h2>
            </div>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 6 }}>
              Review, edit, and approve AI-extracted questions before publishing them into student mock test banks.
            </p>
          </div>
        </div>

        {/* Pending Review List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {pendingReviews.map((item) => (
            <div key={item.id} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 14, padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--royal)', fontFamily: 'var(--font-mono)' }}>{item.id}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(37, 99, 235, 0.12)', color: 'var(--royal)', padding: '2px 8px', borderRadius: 99 }}>{item.subject}</span>
                  <span style={{ fontSize: 11, color: '#10b981', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{item.conf}% AI Conf</span>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={{ background: 'rgba(16, 185, 129, 0.15)', border: 'none', color: '#10b981', padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <ThumbsUp size={14} /> Approve & Publish
                  </button>
                  <button style={{ background: 'rgba(239, 68, 68, 0.15)', border: 'none', color: '#ef4444', padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <ThumbsDown size={14} /> Reject
                  </button>
                </div>
              </div>

              <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-main)', margin: '0 0 12px 0', lineHeight: 1.5 }}>{item.question}</p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {item.options.map((opt, idx) => (
                  <div key={idx} style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--bg-body)', border: '1px solid var(--border-color)', fontSize: 13, color: 'var(--text-main)' }}>
                    <span style={{ fontWeight: 700, marginRight: 6, color: 'var(--royal)' }}>{String.fromCharCode(65 + idx)}.</span> {opt}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
