import React from 'react';

export function ExamsSection() {
  const exams = [
    { name: 'UPSC CSE', e: '🏛️' },
    { name: 'SSC CGL', e: '📋' },
    { name: 'Banking PO', e: '🏦' },
    { name: 'CAT / MBA', e: '📊' },
    { name: 'State PSC', e: '⚖️' },
    { name: 'Railways', e: '🚂' },
    { name: 'NDA', e: '⭐' },
    { name: 'CDS', e: '🎖️' },
  ];

  return (
    <section
      id="exams"
      style={{
        padding: '80px 0',
        borderTop: '1px solid var(--border-color)',
        borderBottom: '1px solid var(--border-color)',
        background: 'var(--bg-body)',
        transition: 'background-color 0.3s ease, border-color 0.3s ease',
      }}
    >
      <div style={{ maxWidth: 1320, margin: '0 auto', padding: '0 52px' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div className="section-label" style={{ justifyContent: 'center' }}>
            Supported Exams
          </div>
          <h2
            style={{
              fontSize: 38,
              fontWeight: 800,
              color: 'var(--text-main)',
              letterSpacing: '-0.8px',
            }}
          >
            One Platform, All Major Exams
          </h2>
        </div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 10,
            justifyContent: 'center',
          }}
        >
          {exams.map((ex) => (
            <div key={ex.name} className="chip">
              <span style={{ fontSize: 16 }}>{ex.e}</span>
              <span>{ex.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
