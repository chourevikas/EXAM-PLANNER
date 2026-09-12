import React, { useState, useEffect, useRef } from 'react';
import { BarChart2, FileText, BookOpen, Zap } from 'lucide-react';

export function useCountUp(target: number, duration = 2200) {
  const [n, setN] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const fired = useRef(false);

  useEffect(() => {
    const ob = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !fired.current) {
          fired.current = true;
          const t0 = performance.now();
          const tick = (now: number) => {
            const prog = Math.min((now - t0) / duration, 1);
            const ease = 1 - Math.pow(1 - prog, 3);
            setN(Math.round(ease * target));
            if (prog < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.6 }
    );
    if (ref.current) ob.observe(ref.current);
    return () => ob.disconnect();
  }, [target, duration]);

  return { n, ref };
}

interface StatProps {
  value: number;
  suffix: string;
  label: string;
  icon: React.ElementType;
  color: string;
  bg: string;
}

function StatCard({ value, suffix, label, icon: Icon, color, bg }: StatProps) {
  const { n, ref } = useCountUp(value);
  return (
    <div
      ref={ref}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        padding: '32px 24px',
        borderRadius: 0,
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(8px)',
        transition: 'transform 0.25s ease, border-color 0.25s ease',
        cursor: 'default',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)';
        (e.currentTarget as HTMLDivElement).style.borderColor = color + '55';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
        (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.08)';
      }}
    >
      {/* Icon chip */}
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 0,
          background: bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 20,
          border: `1px solid ${color}33`,
        }}
      >
        <Icon size={20} color={color} strokeWidth={2} />
      </div>

      {/* Number */}
      <div
        style={{
          fontSize: 'clamp(2rem, 4vw, 3rem)',
          fontWeight: 900,
          color: '#F8FAFC',
          letterSpacing: '-1px',
          lineHeight: 1.05,
        }}
      >
        {n >= 1000 ? `${(n / 1000).toFixed(0)}K` : n}
        {suffix}
      </div>

      {/* Accent bar */}
      <div
        style={{
          width: 36,
          height: 3,
          background: color,
          borderRadius: 0,
          margin: '12px auto 10px',
          opacity: 0.8,
        }}
      />

      {/* Label */}
      <div style={{ fontSize: 13.5, color: '#94A3B8', fontWeight: 500, lineHeight: 1.4 }}>
        {label}
      </div>
    </div>
  );
}

export function StatsSection() {
  const stats: StatProps[] = [
    { value: 100000, suffix: '+', label: 'Questions in Bank',           icon: BookOpen,  color: 'var(--primary-red)', bg: 'rgba(var(--primary-red-rgb), 0.15)'   },
    { value: 95,     suffix: '%', label: 'Diagnostic Classification Accuracy', icon: BarChart2,  color: '#3A8B53', bg: 'rgba(58, 139, 83, 0.15)'  },
    { value: 50,     suffix: '+', label: 'Subjects Covered',            icon: FileText,  color: '#199EAE', bg: 'rgba(25, 158, 174, 0.15)'  },
    { value: 100,    suffix: '+', label: 'Smart Insights Daily',           icon: Zap,       color: '#F2B623', bg: 'rgba(242, 182, 35, 0.15)'  },
  ];

  return (
    <section
      className="landing-section-padding"
      style={{
        background: '#172033',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Subtle top glow */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 800,
          height: 200,
          background: 'radial-gradient(ellipse at top, rgba(var(--primary-red-rgb), 0.15) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <div className="landing-container" style={{ position: 'relative' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '1.2px',
              textTransform: 'uppercase' as const,
              color: 'var(--primary-red)',
              marginBottom: 12,
              fontFamily: 'var(--font-mono)',
            }}
          >
            By The Numbers
          </div>
          <h2
            className="section-heading"
            style={{ fontWeight: 800, color: '#F8FAFC' }}
          >
            Trusted by Serious Aspirants
          </h2>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6">
          {stats.map((s) => (
            <StatCard key={s.label} {...s} />
          ))}
        </div>
      </div>
    </section>
  );
}
