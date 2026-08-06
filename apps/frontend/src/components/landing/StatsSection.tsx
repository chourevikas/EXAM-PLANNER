import React, { useState, useEffect, useRef } from 'react';

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

export function Stat({
  value,
  suffix,
  label,
}: {
  value: number;
  suffix: string;
  label: string;
}) {
  const { n, ref } = useCountUp(value);
  return (
    <div ref={ref} style={{ textAlign: 'center' }}>
      <div
        style={{
          fontSize: 'clamp(2.25rem, 4vw, 3.375rem)',
          fontWeight: 900,
          color: 'var(--text-main)',
          letterSpacing: '-1px',
          lineHeight: 1.05,
        }}
      >
        {n >= 1000 ? `${(n / 1000).toFixed(0)}K` : n}
        {suffix}
      </div>
      <div
        style={{
          width: 40,
          height: 3,
          background: 'var(--royal)',
          borderRadius: 2,
          margin: '12px auto 10px',
        }}
      />
      <div style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 500 }}>
        {label}
      </div>
    </div>
  );
}

export function StatsSection() {
  return (
    <section className="landing-section-padding" style={{ background: 'var(--bg-body)', transition: 'background-color 0.3s ease' }}>
      <div className="landing-container">
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div className="section-label" style={{ justifyContent: 'center' }}>
            By The Numbers
          </div>
          <h2
            className="section-heading"
            style={{
              fontWeight: 800,
              color: 'var(--text-main)',
            }}
          >
            Trusted by Serious Aspirants
          </h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-10 items-center">
          <Stat value={100000} suffix="+" label="Questions in Bank" />
          <Stat value={95} suffix="%" label="AI Classification Accuracy" />
          <Stat value={50} suffix="+" label="Subjects Covered" />
          <Stat value={100} suffix="+" label="AI Insights Generated Daily" />
        </div>
      </div>
    </section>
  );
}

