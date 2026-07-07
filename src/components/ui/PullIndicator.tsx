// Visual half of usePullToRefresh: a spinner that fades/rotates in as the
// user pulls, then spins while the refresh runs.
export default function PullIndicator({ pullY, isRefreshing }: { pullY: number; isRefreshing: boolean }) {
  if (pullY <= 0 && !isRefreshing) return null

  return (
    <div style={{
      height: isRefreshing ? 56 : pullY,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden', transition: isRefreshing ? 'none' : 'height 0.15s ease',
    }}>
      <div className={isRefreshing ? 'spinner' : undefined} style={{
        width: 22, height: 22, borderRadius: '50%',
        border: '2px solid var(--accent)', borderTopColor: 'transparent',
        transform: isRefreshing ? undefined : `rotate(${pullY * 5}deg)`,
        opacity: Math.min(pullY / 40, 1),
      }} />
    </div>
  )
}
