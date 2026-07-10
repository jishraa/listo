import { Lightbulb } from 'lucide-react'
import type { List } from '../../types'

// A single contextual tip shown under the completion state so a finished list
// doesn't read as an empty screen (additions §—). Deliberately lightweight:
// one line of genuinely useful guidance, not a feed. Discovery tips (gestures,
// templates, export) rather than a repeat of the CompletionCard's actions.
const SHOPPING_TIPS = [
  'Save this run as a template from the ⋯ menu to reuse your regulars next time.',
  'Swipe any item left to edit or remove it in a single gesture.',
  'Export a PDF or CSV of this trip from the ⋯ menu to keep a record.',
  'Tap a completed item to add it again or move it back to your list.',
]
const GENERAL_TIPS = [
  'Save this as a template from the ⋯ menu to reuse it later.',
  'Swipe any item left to edit or remove it in a single gesture.',
  'Archive this list from the ⋯ menu to tidy your space — restore it anytime.',
  'Tap a completed item to add it again or move it back to your list.',
]

// Stable per list so the tip doesn't flicker between renders.
function pick(tips: string[], seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  return tips[Math.abs(h) % tips.length]
}

export default function CompletionTip({ list }: { list: List }) {
  const tips = list.type === 'shopping' ? SHOPPING_TIPS : GENERAL_TIPS
  const tip = pick(tips, list.id)
  return (
    <div
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        padding: '12px 14px', borderRadius: 14,
        background: 'var(--bg-input)', border: '1px solid var(--border)',
      }}
    >
      <Lightbulb size={16} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 1 }} />
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.45, color: 'var(--text-2)' }}>
        <strong style={{ color: 'var(--text)', fontWeight: 600 }}>Tip&nbsp;</strong>
        {tip}
      </p>
    </div>
  )
}
