import React from 'react';
import { Link } from 'react-router-dom';
import { Ico } from '../common/Icons';

interface PsychometricAIPanelProps {
  isFreeTier: boolean;
}

export function PsychometricAIPanel({ isFreeTier }: PsychometricAIPanelProps) {
  return (
    <div style={{ 
      backgroundColor: 'var(--bg-card)', padding: 32, borderRadius: 24, 
      border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-color-base)',
      position: 'relative', overflow: 'hidden', gridColumn: 'span 2'
    }}>
      {/* Blur Overlay for Free Tier */}
      {isFreeTier && (
        <div style={{ 
          position: 'absolute', inset: 0, zIndex: 10, 
          backdropFilter: 'blur(8px)', backgroundColor: 'rgba(15, 23, 42, 0.25)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: 24
        }}>
          <div style={{ padding: 16, backgroundColor: 'var(--bg-card)', borderRadius: '50%', boxShadow: 'var(--shadow-color-base)', marginBottom: 16 }}>
            <Ico.Shield />
          </div>
          <h3 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px 0' }}>Pro Behavioral Insights Locked</h3>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24, textAlign: 'center', maxWidth: 360 }}>
            Unlock psychometric option hesitation tracking, mistake patterns, and custom AI recommendations.
          </p>
          <Link to="/pricing" style={{
            padding: '12px 24px', backgroundColor: 'var(--accent-primary)', color: '#FFF',
            borderRadius: 12, fontSize: 14, fontWeight: 700, textDecoration: 'none',
            boxShadow: '0 8px 16px var(--shadow-color-accent)'
          }}>
            Upgrade to Pro Plan
          </Link>
        </div>
      )}

      <div style={{ opacity: isFreeTier ? 0.5 : 1, filter: isFreeTier ? 'blur(2px)' : 'none', transition: 'all 0.3s' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div style={{ padding: 10, backgroundColor: 'var(--pink-bg)', color: 'var(--pink-primary)', borderRadius: 12 }}>
            <Ico.Brain />
          </div>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Deep AI Psychometric Analysis</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '2px 0 0 0' }}>Behavioral metrics during actual test execution.</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24 }}>
          {/* Decision Accuracy */}
          <div>
            <h4 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-disabled)', fontWeight: 700, marginBottom: 16 }}>Decision Precision</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ padding: 14, backgroundColor: 'var(--bg-subtle)', borderRadius: 14, border: '1px solid var(--border-default)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Direct Hits</span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--success-primary)' }}>68%</span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Correct answer selected on first attempt.</p>
              </div>
              <div style={{ padding: 14, backgroundColor: 'var(--bg-subtle)', borderRadius: 14, border: '1px solid var(--border-default)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Partial Understanding</span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--warning-primary)' }}>22%</span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Eliminated 2 options, picked 2nd choice.</p>
              </div>
            </div>
          </div>

          {/* Behavior Analysis */}
          <div>
            <h4 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-disabled)', fontWeight: 700, marginBottom: 16 }}>Behavior Pattern</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Question Jumping</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--warning-primary)' }}>Moderate (12x)</span>
                </div>
                <div style={{ height: 6, width: '100%', backgroundColor: 'var(--bg-subtle)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: '40%', height: '100%', backgroundColor: 'var(--warning-primary)', borderRadius: 3 }} />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Option Hesitation</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--success-primary)' }}>Low (Avg 4s)</span>
                </div>
                <div style={{ height: 6, width: '100%', backgroundColor: 'var(--bg-subtle)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: '18%', height: '100%', backgroundColor: 'var(--success-primary)', borderRadius: 3 }} />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Avg Time / Question</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-primary)' }}>1m 12s</span>
                </div>
                <div style={{ height: 6, width: '100%', backgroundColor: 'var(--bg-subtle)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: '60%', height: '100%', backgroundColor: 'var(--accent-primary)', borderRadius: 3 }} />
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
