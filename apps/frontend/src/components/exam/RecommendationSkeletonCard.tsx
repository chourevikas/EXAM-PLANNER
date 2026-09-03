export function RecommendationSkeletonCard() {
  return (
    <div
      style={{
        backgroundColor: '#F8FAFC',
        border: '1px solid #E2E8F0',
        borderRadius: 6,
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div className="shimmer-block" style={{ height: 10, width: '35%' }} />
      <div className="shimmer-block" style={{ height: 12, width: '92%' }} />
      <div className="shimmer-block" style={{ height: 12, width: '68%' }} />
    </div>
  );
}
