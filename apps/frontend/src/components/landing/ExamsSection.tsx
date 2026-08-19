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
      className="landing-section-padding"
      style={{
        borderTop: '1px solid var(--border-color)',
        borderBottom: '1px solid var(--border-color)',
        background: 'var(--bg-body)',
        transition: 'background-color 0.3s ease, border-color 0.3s ease',
      }}
    >
      <div className="landing-container">
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div className="section-label" style={{ justifyContent: 'center' }}>
            Supported Exams
          </div>
          <h2
            className="section-heading"
            style={{
              fontWeight: 800,
              color: 'var(--text-main)',
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

