import React from 'react';
import { BookMarked, Plus, FileText, Link, Tag } from 'lucide-react';

export function ResourcesView() {
  const resources = [
    { title: 'Indian Polity by M. Laxmikanth (7th Edition Reference Notes)', category: 'Polity', type: 'PDF Summary', downloads: 3420 },
    { title: 'Economic Survey 2025-26 Key Takeaways & Data Points', category: 'Economy', type: 'Infographic Brief', downloads: 5120 },
    { title: 'NCERT Class 11 Fine Arts & Ancient Architecture Mindmap', category: 'History', type: 'Mindmap', downloads: 2890 },
  ];

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 20, padding: 32, boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BookMarked size={20} />
              </div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, color: 'var(--text-main)', margin: 0 }}>
                Learning Resources & Study Material
              </h2>
            </div>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 6 }}>
              Attach NCERT notes, PIB briefs, and standard reference material to syllabus topics and question explanations.
            </p>
          </div>

          <button style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={16} /> Add Resource Link
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {resources.map((r, i) => (
            <div key={i} style={{ padding: 18, borderRadius: 14, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', background: 'rgba(245, 158, 11, 0.12)', padding: '2px 8px', borderRadius: 99, fontFamily: 'var(--font-mono)' }}>{r.category}</span>
                <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)', margin: '6px 0 2px' }}>{r.title}</h4>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{r.type} • {r.downloads} student accesses</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
