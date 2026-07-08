interface SmartBannersProps {
  isShopping: boolean
  dupeCount: number
  uncatCount: number
  onReviewDupes: () => void
  onCategorize: () => void
}

// Smart banner (spec §4/§16) — one at a time, only when actionable.
// The page renders this only for members who can edit.
export default function SmartBanners({ isShopping, dupeCount, uncatCount, onReviewDupes, onCategorize }: SmartBannersProps) {
  if (dupeCount > 0) {
    return (
      <div style={{ padding: '0 16px 8px' }}>
        <button
          onClick={onReviewDupes}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px',
            borderRadius: 10, background: 'rgba(217,119,6,0.10)', border: '1px solid rgba(217,119,6,0.28)',
            cursor: 'pointer', textAlign: 'left',
          }}>
          <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#d97706' }}>
            ⚠ {dupeCount} duplicate {dupeCount === 1 ? 'item' : 'items'} found
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#d97706', flexShrink: 0 }}>Review →</span>
        </button>
      </div>
    )
  }
  if (uncatCount > 0 && isShopping) {
    return (
      <div style={{ padding: '0 16px 8px' }}>
        <button
          onClick={onCategorize}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px',
            borderRadius: 10, background: 'var(--bg-input)', border: '1px solid var(--border)',
            cursor: 'pointer', textAlign: 'left',
          }}>
          <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text-2)' }}>
            ⚠ {uncatCount} uncategorized {uncatCount === 1 ? 'item' : 'items'}
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', flexShrink: 0 }}>Categorize →</span>
        </button>
      </div>
    )
  }
  return null
}
