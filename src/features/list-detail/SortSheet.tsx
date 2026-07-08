import { Check } from 'lucide-react'
import Sheet from '../../components/ui/Sheet'
import type { SortMode } from './helpers'

const OPTIONS: { key: SortMode; label: string; hint: string }[] = [
  { key: 'date', label: 'Date added', hint: 'Newest first' },
  { key: 'alpha', label: 'Alphabetical', hint: 'A → Z' },
  { key: 'category', label: 'Category', hint: 'Grouped' },
]

interface SortSheetProps {
  open: boolean
  sortMode: SortMode
  onSelect: (mode: SortMode) => void
  onClose: () => void
}

export default function SortSheet({ open, sortMode, onSelect, onClose }: SortSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title="Sort by">
      <div style={{ padding: '4px 0 8px' }}>
        {OPTIONS.map(opt => {
          const active = sortMode === opt.key
          return (
            <button key={opt.key} onClick={() => onSelect(opt.key)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
              <span style={{ fontSize: 15, fontWeight: active ? 700 : 500, color: active ? 'var(--accent)' : 'var(--text)', flex: 1 }}>{opt.label}</span>
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{opt.hint}</span>
              {active && <Check size={16} strokeWidth={2.5} color="var(--accent)" />}
            </button>
          )
        })}
      </div>
    </Sheet>
  )
}
