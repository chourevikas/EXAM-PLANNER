import React from 'react';
import { C } from '../../constants/theme';

export function Logo({ inverted = false }: { inverted?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <img
        src="/logo.jpeg"
        alt="ExamPlanner Logo"
        style={{
          width: 40,
          height: 40,
          objectFit: 'contain',
          flexShrink: 0,
        }}
      />
      <div>
        <div
          style={{
            fontSize: 18,
            fontWeight: 800,
            letterSpacing: '-0.3px',
            lineHeight: 1.1,
          }}
        >
          <span style={{ color: inverted ? 'var(--bg-card)' : '#111111' }}>Exam</span>
          <span style={{ color: 'var(--primary-red)' }}>Planner</span>
        </div>
      </div>
    </div>
  );
}
