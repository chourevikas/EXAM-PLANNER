import React from 'react';
import { SkeletonBox, SkeletonText } from '../common/Skeleton';

export interface StudentMetricCardSkeletonProps {
  showProgress?: boolean;
}

export function StudentMetricCardSkeleton({ showProgress = false }: StudentMetricCardSkeletonProps) {
  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid #E2E8F0',
        borderRadius: 0,
        position: 'relative',
        overflow: 'hidden',
        padding: '20px 22px',
        boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04), 0 1px 2px rgba(15, 23, 42, 0.02)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: 136,
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      }}
    >
      {/* Header Row: Title & Top-Right Icon */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
        <div style={{ width: '60%' }}>
          {/* Skeleton for Title */}
          <SkeletonText lines={1} fontSize={13.5} width="80%" />
        </div>

        {/* 34px Icon Container Skeleton */}
        <SkeletonBox width={34} height={34} borderRadius={0} />
      </div>

      {/* Value & Supporting Detail */}
      <div style={{ marginTop: 12 }}>
        {/* Skeleton for Value */}
        <SkeletonBox width="50%" height={28} borderRadius={4} />

        {/* Skeleton for Supporting Text */}
        <div style={{ marginTop: 4 }}>
          <SkeletonText lines={1} fontSize={12.5} width="70%" />
        </div>

        {/* Optional Progress Bar Skeleton */}
        {showProgress && (
          <div style={{ marginTop: 10 }}>
            <SkeletonBox width="100%" height={4} borderRadius={0} />
          </div>
        )}
      </div>
    </div>
  );
}
