import React from 'react';
import { SkeletonBox, SkeletonText } from '../common/Skeleton';

export function StudyPlannerSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%' }}>
      {/* Top Header Skeleton */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ width: '40%' }}>
          <SkeletonText lines={1} fontSize={20} width="100%" />
          <SkeletonBox height={16} width="60%" style={{ marginTop: 8 }} />
        </div>
        <SkeletonBox width={120} height={36} />
      </div>

      {/* Main Content Card Skeleton (mimicking the "Schedule Explorer") */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid #E2E8F0',
          borderRadius: 'var(--radius)',
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 20
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <SkeletonText lines={1} fontSize={18} width="30%" />
          <SkeletonBox width={150} height={38} />
        </div>

        {/* Day Pills Skeleton */}
        <div style={{ display: 'flex', gap: 8 }}>
          {Array.from({ length: 7 }).map((_, i) => (
            <SkeletonBox key={i} width={70} height={34} />
          ))}
        </div>

        {/* Categories / Task Lists Skeletons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 8 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} style={{ border: '1px solid #E2E8F0' }}>
              <div style={{ padding: '14px 18px', backgroundColor: 'var(--bg-subtle)', display: 'flex', justifyContent: 'space-between' }}>
                <SkeletonText lines={1} fontSize={14} width={120} />
                <SkeletonBox width={80} height={20} />
              </div>
              <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {Array.from({ length: i === 0 ? 2 : 1 }).map((_, j) => (
                  <div key={j} style={{ padding: 14, border: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '60%' }}>
                      <SkeletonBox width={22} height={22} />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
                        <SkeletonText lines={1} fontSize={14} width="70%" />
                        <SkeletonText lines={1} fontSize={12} width="40%" />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <SkeletonBox width={60} height={22} />
                      <SkeletonBox width={100} height={28} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
