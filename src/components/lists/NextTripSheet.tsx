import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Check, RefreshCw, ShoppingCart, Sparkles } from 'lucide-react'
import Sheet from '../ui/Sheet'
import { useListsStore } from '../../store/useListsStore'
import { detectCategoryIn } from '../../lib/constants'
import type { List, ListItem } from '../../types'
import type { ListCategory } from '../../lib/constants'
import type { MemoryItem } from '../../store/useMemoryStore'

// "Start next trip" (Next List, Option A — reuse in place). Resets the current
// list for the next run without creating a new one: keep the same items, start
// with just your regulars, or empty it. Optionally advances a date-ish name to
// the next period.

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']

// If the name ends in a period token — a month (full or 3-letter) or
// "Week/Wk N" — return the name advanced to the next period; otherwise null
// (we never rename anything else).
function nextPeriodName(name: string): string | null {
  const weekM = name.match(/^(.*?(?:week|wk)\s*)(\d+)\s*$/i)
  if (weekM) return `${weekM[1]}${parseInt(weekM[2], 10) + 1}`
  const m = name.match(/^(.*?)([A-Za-z]+)\s*$/)
  if (!m) return null
  const token = m[2].toLowerCase()
  const full = MONTHS.indexOf(token)
  if (full >= 0) {
    const next = MONTHS[(full + 1) % 12]
    const cased = m[2][0] === m[2][0].toUpperCase() ? next[0].toUpperCase() + next.slice(1) : next
    return `${m[1]}${cased}`
  }
  const shortIdx = MONTHS.findIndex(mo => mo.slice(0, 3) === token && token.length === 3)
  if (shortIdx >= 0) {
    const next = MONTHS[(shortIdx + 1) % 12].slice(0, 3)
    const cased = m[2][0] === m[2][0].toUpperCase() ? next[0].toUpperCase() + next.slice(1) : next
    return `${m[1]}${cased}`
  }
  return null
}

type Mode = 'keep' | 'regulars' | 'empty'

interface Props {
  open: boolean
  onClose: () => void
  list: List
  items: ListItem[]
  cats: ListCategory[]
  regulars: MemoryItem[]
}

export default function NextTripSheet({ open, onClose, list, items, cats, regulars }: Props) {
  const store = useListsStore()
  const [mode, setMode] = useState<Mode>('keep')
  const [rename, setRename] = useState(true)
  const [busy, setBusy] = useState(false)

  const suggestedName = useMemo(() => nextPeriodName(list.name), [list.name])

  const options: { id: Mode; icon: ReactNode; label: string; hint: string; hide?: boolean }[] = [
    { id: 'keep',     icon: <RefreshCw size={16} />,    label: 'Keep all items',   hint: `Start the same ${items.length} ${items.length === 1 ? 'item' : 'items'} fresh` },
    { id: 'regulars', icon: <Sparkles size={16} />,     label: 'Just my regulars', hint: `Start with your usual ${regulars.length} ${regulars.length === 1 ? 'item' : 'items'}`, hide: regulars.length === 0 },
    { id: 'empty',    icon: <ShoppingCart size={16} />, label: 'Empty list',       hint: 'Start from scratch' },
  ]

  async function start() {
    setBusy(true)
    if (rename && suggestedName) await store.renameList(list.id, suggestedName)
    if (mode === 'keep') {
      await store.uncheckAll(list.id)
    } else {
      await store.clearItems(list.id)
      if (mode === 'regulars') {
        for (const m of regulars) {
          await store.addItem(list.id, m.name, m.lastQuantity ?? '', m.category ?? detectCategoryIn(cats, m.name) ?? null)
        }
      }
    }
    setBusy(false)
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Create New List" subtitle="Reset this list for your next run.">
        <div style={{ padding: '16px 20px 24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {options.filter(o => !o.hide).map(o => {
              const on = mode === o.id
              return (
                <button
                  key={o.id}
                  onClick={() => setMode(o.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
                    padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
                    background: on ? 'var(--accent-dim)' : 'var(--bg-input)',
                    border: `1px solid ${on ? 'var(--accent-mid)' : 'var(--border)'}`,
                  }}
                >
                  <span style={{ color: on ? 'var(--accent)' : 'var(--text-2)', display: 'flex', flexShrink: 0 }}>{o.icon}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 14.5, fontWeight: 600, color: 'var(--text)' }}>{o.label}</span>
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--text-3)', marginTop: 1 }}>{o.hint}</span>
                  </span>
                  <span style={{
                    flexShrink: 0, width: 20, height: 20, borderRadius: '50%',
                    border: `2px solid ${on ? 'var(--accent)' : 'var(--border-2)'}`,
                    background: on ? 'var(--accent)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {on && <Check size={12} strokeWidth={3} color="#fff" />}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Conservative rename — only offered when the name ends in a month */}
          {suggestedName && (
            <button
              onClick={() => setRename(r => !r)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
                marginTop: 12, padding: '10px 4px', background: 'none', border: 'none', cursor: 'pointer',
              }}
            >
              <span style={{
                flexShrink: 0, width: 20, height: 20, borderRadius: 6,
                border: `2px solid ${rename ? 'var(--accent)' : 'var(--border-2)'}`,
                background: rename ? 'var(--accent)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {rename && <Check size={12} strokeWidth={3} color="#fff" />}
              </span>
              <span style={{ fontSize: 13.5, color: 'var(--text-2)' }}>
                Rename to <strong style={{ color: 'var(--text)' }}>{suggestedName}</strong>
              </span>
            </button>
          )}

          <button className="btn btn-primary btn-full" style={{ marginTop: 18 }} disabled={busy} onClick={start}>
            {busy ? <span className="spinner" /> : 'Create New List'}
          </button>
        </div>
    </Sheet>
  )
}
