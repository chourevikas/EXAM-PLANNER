import React from 'react';
import { SkeletonBox, SkeletonText } from '../common/Skeleton';

export function PerformanceAnalyticsSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%', marginTop: 24 }}>
      {/* Overview Grid Skeletons */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ padding: 20, backgroundColor: 'var(--bg-card)', border: '1px solid #E2E8F0' }}>
            <SkeletonText lines={1} fontSize={12} width="50%" />
            <SkeletonBox height={32} width="80%" style={{ marginTop: 8 }} />
          </div>
        ))}
      </div>

      {/* Large Chart Area Skeleton */}
      <div style={{ padding: 24, backgroundColor: 'var(--bg-card)', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <SkeletonText lines={1} fontSize={18} width="160px" />
            <SkeletonText lines={1} fontSize={13} width="220px" style={{ marginTop: 4 }} />
          </div>
          <SkeletonBox width={100} height={32} />
        </div>
        
        {/* Mocking a Bar/Line Chart with staggered skeleton blocks */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', height: 240, marginTop: 16, borderBottom: '1px solid #E2E8F0', paddingBottom: 10 }}>
           {Array.from({ length: 7 }).map((_, i) => (
             <SkeletonBox key={i} width={30} height={Math.max(40, Math.random() * 200)} />
           ))}
        </div>
      </div>
      
      {/* Lower Details Skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div style={{ padding: 24, backgroundColor: 'var(--bg-card)', border: '1px solid #E2E8F0' }}>
           <SkeletonText lines={1} fontSize={16} width="40%" style={{ marginBottom: 16 }} />
           <SkeletonText lines={5} fontSize={14} gap={12} />
        </div>
        <div style={{ padding: 24, backgroundColor: 'var(--bg-card)', border: '1px solid #E2E8F0' }}>
           <SkeletonText lines={1} fontSize={16} width="40%" style={{ marginBottom: 16 }} />
           <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
             {Array.from({ length: 4 }).map((_, i) => (
               <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                 <SkeletonBox width={24} height={24} borderRadius="50%" />
                 <SkeletonBox height={14} width="80%" />
               </div>
             ))}
           </div>
        </div>
      </div>
    </div>
  );
}
