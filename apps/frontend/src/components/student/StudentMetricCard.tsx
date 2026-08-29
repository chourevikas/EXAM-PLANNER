import React, { useState } from 'react';

interface StudentMetricCardProps {
  title: string;
  value: React.ReactNode;
  supportingText?: React.ReactNode;
  icon: React.ReactNode;
  showProgress?: boolean;
  progressPercent?: number;
  onClick?: () => void;
  accentColor?: string;
}

export function StudentMetricCard({
  title,
  value,
  supportingText,
  icon,
  showProgress = false,
  progressPercent = 0,
  onClick,
  accentColor = '#E31B23',
}: StudentMetricCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        background: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: 0,
        position: 'relative',
        overflow: 'hidden',
        padding: '20px 22px',
        boxShadow: isHovered
          ? '0 8px 20px -4px rgba(15, 23, 42, 0.08), 0 4px 6px -2px rgba(15, 23, 42, 0.03)'
          : '0 1px 3px rgba(15, 23, 42, 0.04), 0 1px 2px rgba(15, 23, 42, 0.02)',
        transform: isHovered ? 'translateY(-3px)' : 'translateY(0)',
        transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
        cursor: onClick ? 'pointer' : 'default',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: 136,
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      }}
    >
      {/* Top Edge Accent Line (Appears from Left to Right on Hover) */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          backgroundColor: accentColor,
          transform: isHovered ? 'scaleX(1)' : 'scaleX(0)',
          transformOrigin: 'left center',
          transition: 'transform 250ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      />

      {/* Header Row: Title & Top-Right Icon */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 600,
            color: '#172033',
            letterSpacing: '-0.01em',
          }}
        >
          {title}
        </div>

        {/* 34px Icon Container with Single Variant Color Tint */}
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 0,
            backgroundColor: '#F8FAFC',
            color: accentColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transform: isHovered ? 'scale(1.06)' : 'scale(1)',
            transition: 'transform 200ms ease-out',
          }}
        >
          {icon}
        </div>
      </div>

      {/* Value & Supporting Detail */}
      <div style={{ marginTop: 12 }}>
        <div
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: isHovered ? accentColor : '#172033',
            lineHeight: 1.08,
            letterSpacing: '-0.025em',
            transition: 'color 200ms ease-out',
          }}
        >
          {value}
        </div>

        {supportingText && (
          <div
            style={{
              fontSize: 12.5,
              fontWeight: 500,
              color: '#64748B',
              marginTop: 4,
            }}
          >
            {supportingText}
          </div>
        )}

        {/* Optional Progress Bar */}
        {showProgress && (
          <div
            style={{
              height: 4,
              width: '100%',
              backgroundColor: '#F1F5F9',
              borderRadius: 0,
              marginTop: 10,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${Math.min(100, Math.max(0, progressPercent))}%`,
                backgroundColor: accentColor,
                borderRadius: 0,
                transition: 'width 400ms ease-out',
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default StudentMetricCard;
