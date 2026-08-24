import React from 'react';
import { C } from '../../constants/theme';
import { Ico } from '../common/Icons';

export function HeroIllustration() {
  return (
    <div style={{ position: 'relative', width: '100%', height: 560 }}>
      {/* Main card cluster */}
      <div
        className="anim-float"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      >
        {/* Central Dashboard card */}
        <div
          style={{
            position: 'absolute',
            top: 40,
            left: 10,
            right: 30,
            bottom: 40,
            background: '#fff',
            borderRadius: 20,
            border: `1px solid ${C.border}`,
            boxShadow: '0 32px 80px rgba(15,23,42,0.13)',
            overflow: 'hidden',
          }}
        >
          {/* Window chrome */}
          <div
            style={{
              padding: '12px 16px',
              borderBottom: `1px solid ${C.light}`,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: '#FAFAFA',
            }}
          >
            {['#FF5F57', '#FFBD2E', '#28C840'].map((c) => (
              <div
                key={c}
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: c,
                }}
              />
            ))}
            <div style={{ flex: 1, textAlign: 'center' }}>
              <span style={{ fontSize: 11, color: C.muted, fontWeight: 500 }}>
                ExamPlanner · Dashboard
              </span>
            </div>
          </div>

          <div
            style={{
              padding: 20,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 10,
              borderBottom: `1px solid ${C.light}`,
            }}
          >
            {[
              { l: 'Accuracy', v: '78%', c: C.emerald },
              { l: 'Questions', v: '4,287', c: C.royal },
              { l: 'Streak', v: '14 Days', c: C.saffron },
            ].map((s) => (
              <div
                key={s.l}
                style={{
                  background: C.ivory,
                  borderRadius: 10,
                  padding: '10px 12px',
                  border: `1px solid ${C.border}`,
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    color: C.muted,
                    fontWeight: 500,
                    marginBottom: 4,
                  }}
                >
                  {s.l}
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: s.c }}>
                  {s.v}
                </div>
              </div>
            ))}
          </div>

          <div style={{ padding: 20 }}>
            {/* Subject bars */}
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: C.slate,
                marginBottom: 12,
                letterSpacing: '0.3px',
              }}
            >
              Performance by Subject
            </div>
            {[
              { name: 'Indian Polity', pct: 84, c: C.emerald },
              { name: 'Modern History', pct: 42, c: C.saffron },
              { name: 'Geography', pct: 71, c: C.royal },
              { name: 'Economy', pct: 58, c: '#8B5CF6' },
              { name: 'Science & Tech', pct: 91, c: C.emerald },
            ].map((s) => (
              <div
                key={s.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: C.grey,
                    width: 100,
                    flexShrink: 0,
                  }}
                >
                  {s.name}
                </div>
                <div className="progress-bar" style={{ flex: 1 }}>
                  <div
                    className="progress-fill"
                    style={{
                      width: `${s.pct}%`,
                      background: s.c,
                    }}
                  />
                </div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: C.slate,
                    width: 28,
                    textAlign: 'right',
                  }}
                >
                  {s.pct}%
                </div>
              </div>
            ))}

            {/* Heatmap */}
            <div
              style={{
                marginTop: 16,
                padding: '12px',
                background: C.ivory,
                borderRadius: 10,
                border: `1px solid ${C.border}`,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: C.grey,
                  marginBottom: 8,
                }}
              >
                30-Day Activity
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {Array.from({ length: 30 }).map((_, i) => {
                  const v = [0, 1, 2, 3, 4][Math.floor(((i * 7 + 13) % 5))];
                  const bg = [
                    '#F1F5F9',
                    '#BFDBFE',
                    '#93C5FD',
                    '#60A5FA',
                    '#2563EB',
                  ][v];
                  return (
                    <div
                      key={i}
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 3,
                        background: bg,
                      }}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Floating Smart Mentor badge */}
        <div
          className="anim-float-b"
          style={{
            position: 'absolute',
            top: 16,
            left: -10,
            background: `linear-gradient(135deg,${C.royal},${C.elec})`,
            color: '#fff',
            padding: '10px 16px',
            borderRadius: 14,
            fontSize: 12,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: '0 8px 24px rgba(37,99,235,0.4)',
            zIndex: 10,
          }}
        >
          <div style={{ position: 'relative', width: 10, height: 10 }}>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                background: '#10B981',
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: '-3px',
                borderRadius: '50%',
                background: 'rgba(16,185,129,0.4)',
                animation: 'pulse-ring 1.5s ease infinite',
              }}
            />
          </div>
          Smart Mentor Active
        </div>

        {/* Smart Recommendation chip */}
        <div
          style={{
            position: 'absolute',
            top: -10,
            right: -50,
            background: '#fff',
            borderRadius: 12,
            padding: '10px 14px',
            border: `1px solid ${C.blue100}`,
            boxShadow: '0 8px 24px rgba(37,99,235,0.10)',
            maxWidth: 190,
            zIndex: 10,
          }}
          className="anim-float-b"
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginBottom: 6,
            }}
          >
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: 6,
                background: C.blue50,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: C.royal,
              }}
            >
              <Ico.Brain />
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, color: C.royal }}>
              Smart Insight
            </span>
          </div>
          <p style={{ fontSize: 11, color: C.grey, lineHeight: 1.5 }}>
            Focus on Modern History today — 42% accuracy needs work.
          </p>
        </div>

        {/* Weekly progress floating card */}
        <div
          style={{
            position: 'absolute',
            bottom: -30,
            right: -50,
            width: 195,
            background: '#fff',
            borderRadius: 14,
            padding: '14px 16px',
            border: `1px solid ${C.border}`,
            boxShadow: '0 12px 32px rgba(15,23,42,0.10)',
            zIndex: 10,
          }}
          className="anim-float"
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: C.slate,
              marginBottom: 10,
            }}
          >
            Weekly Goal
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* ring */}
            <svg width="44" height="44" viewBox="0 0 44 44">
              <circle
                cx="22"
                cy="22"
                r="18"
                fill="none"
                stroke={C.light}
                strokeWidth="4"
              />
              <circle
                cx="22"
                cy="22"
                r="18"
                fill="none"
                stroke={C.royal}
                strokeWidth="4"
                strokeDasharray="113"
                strokeDashoffset="28"
                strokeLinecap="round"
                transform="rotate(-90 22 22)"
              />
              <text
                x="22"
                y="26"
                textAnchor="middle"
                fontSize="11"
                fontWeight="800"
                fill={C.royal}
              >
                75%
              </text>
            </svg>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.slate }}>
                150/200
              </div>
              <div style={{ fontSize: 11, color: C.muted }}>Questions done</div>
            </div>
          </div>
        </div>
      </div>

      {/* Neural network background SVG */}
      <svg
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          opacity: 0.06,
          zIndex: 0,
        }}
        viewBox="0 0 520 560"
      >
        {[
          [80, 80],
          [200, 40],
          [400, 100],
          [450, 280],
          [380, 450],
          [160, 480],
          [60, 300],
        ].map(([x, y], i, arr) =>
          arr.slice(i + 1).map(([x2, y2], j) => (
            <line
              key={`${i}-${j}`}
              x1={x}
              y1={y}
              x2={x2}
              y2={y2}
              stroke={C.royal}
              strokeWidth="1"
            />
          ))
        )}
        {[
          [80, 80],
          [200, 40],
          [400, 100],
          [450, 280],
          [380, 450],
          [160, 480],
          [60, 300],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="4" fill={C.royal} />
        ))}
      </svg>
    </div>
  );
}
