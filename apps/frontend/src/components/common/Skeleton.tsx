import React from 'react';
import './Skeleton.css';

export interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

/**
 * A generic shimmering rectangle for cards, images, or buttons.
 */
export const SkeletonBox: React.FC<SkeletonProps & { width?: string | number, height?: string | number, borderRadius?: string | number }> = React.memo(({ width = '100%', height = '100%', borderRadius = 4, className = '', style }) => (
  <div
    className={`skeleton-shimmer ${className}`}
    aria-hidden="true"
    style={{ width, height, borderRadius, ...style }}
  />
));

/**
 * A shimmering circle for avatars or icons.
 */
export const SkeletonCircle: React.FC<SkeletonProps & { size?: string | number }> = React.memo(({ size = 40, className = '', style }) => (
  <div
    className={`skeleton-shimmer ${className}`}
    aria-hidden="true"
    style={{ width: size, height: size, borderRadius: '50%', ...style }}
  />
));

/**
 * Shimmering text lines. If lines > 1, outputs multiple lines with varying widths.
 */
export const SkeletonText: React.FC<SkeletonProps & { lines?: number, width?: string | number, fontSize?: string | number, gap?: number }> = React.memo(({ lines = 1, width = '100%', fontSize = 14, gap = 8, className = '', style }) => {
  return (
    <div className={`skeleton-container ${className}`} style={{ display: 'flex', flexDirection: 'column', gap, width, ...style }} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="skeleton-shimmer"
          style={{
            height: fontSize,
            borderRadius: 4,
            width: lines > 1 && i === lines - 1 ? '60%' : '100%', // Make last line shorter if multiple lines
          }}
        />
      ))}
    </div>
  );
});
