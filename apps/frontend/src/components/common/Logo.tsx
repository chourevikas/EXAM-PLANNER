import React from 'react';
import { C } from '../../constants/theme';

export function Logo({ inverted = false }: { inverted?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          flexShrink: 0,
          background: 'linear-gradient(135deg,#2563EB 0%,#1e40af 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 10px rgba(37,99,235,0.35)',
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 3L4 7.5V13c0 4.8 3.4 9.3 8 10.5 4.6-1.2 8-5.7 8-10.5V7.5L12 3z"
            fill="rgba(255,255,255,0.15)"
            stroke="white"
            strokeWidth="1.4"
          />
          <circle cx="12" cy="10" r="2" fill="white" />
          <path
            d="M8 14c1-2 6-2 8 0"
            stroke="white"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <div>
        <div
          style={{
            fontSize: 16,
            fontWeight: 800,
            letterSpacing: '-0.3px',
            lineHeight: 1.1,
            color: inverted ? '#fff' : C.navy,
          }}
        >
          RankEdge
        </div>
        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.7px',
            textTransform: 'uppercase',
            lineHeight: 1,
            color: inverted ? C.slate400 : C.muted,
          }}
        >
          ADAPTIVE
        </div>
      </div>
    </div>
  );
}
