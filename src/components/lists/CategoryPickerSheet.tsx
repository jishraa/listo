import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Search, Settings2, X } from 'lucide-react'
import type { ListCategory } from '../../lib/constants'

interface Props {
  open: boolean
  categories: ListCategory[]
  selected: string | null
  onSelect: (id: string | null) => void
  onClose: () => void
}

// Dedicated bottom sheet for picking an item's category:
// title bar, search, "All categories" rows with icon tiles and a check
// on the current selection. Selecting closes the sheet.
export default function CategoryPickerSheet({ open, categories, selected, onSelect, onClose }: Props) {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()

  if (!open) return null

  const q = query.trim().toLowerCase()
  const filtered = q ? categories.filter(c => c.name.toLowerCase().includes(q)) : categories

  const close = () => { setQuery(''); onClose() }
  const pick = (id: string | null) => { setQuery(''); onSelect(id); onClose() }

  const row = (cat: ListCategory | null) => {
    const isSelected = cat ? selected === cat.id : selected === null
    return (
      <button
        key={cat?.id ?? 'none'}
        onClick={() => pick(cat?.id ?? null)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 14,
          padding: '11px 12px', borderRadius: 12, border: 'none', cursor: 'pointer',
          background: isSelected ? 'var(--accent-dim)' : 'transparent',
          textAlign: 'left',
        }}
      >
        <span style={{
          width: 34, height: 34, borderRadius: 10, flexShrink: 0, fontSize: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: cat ? `${cat.color}1f` : 'var(--bg-input)',
        }}>
          {cat ? cat.emoji : '—'}
        </span>
        <span style={{ flex: 1, fontSize: 15, fontWeight: 500, color: 'var(--text)' }}>
          {cat ? cat.name : 'No category'}
        </span>
        {isSelected && <Check size={17} strokeWidth={2.5} color="var(--accent)" style={{ flexShrink: 0 }} />}
      </button>
    )
  }

  return (
    <>
      <div className="sheet-overlay" onClick={close} />
      <div className="sheet" style={{ maxHeight: '75vh', display: 'flex', flexDirection: 'column' }}>
        <div className="sheet-handle" />

        {/* Title */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px 12px' }}>
          <p style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Select category</p>
          <button
            onClick={close}
            aria-label="Close"
            style={{ width: 32, height: 32, borderRadius: 99, background: 'var(--bg-input)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-2)' }}
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '0 20px 12px', position: 'relative' }}>
          <Search size={16} color="var(--text-3)" style={{ position: 'absolute', left: 34, top: '50%', transform: 'translateY(-70%)' }} />
          <input
            className="input"
            placeholder="Search categories"
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{ paddingLeft: 40 }}
          />
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 20px' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '2px 8px 8px' }}>
            All categories
          </p>
          {!q && row(null)}
          {filtered.map(c => row(c))}
          {q && filtered.length === 0 && (
            <p className="text-sm text-muted" style={{ textAlign: 'center', padding: '20px 0' }}>
              No categories match "{query}"
            </p>
          )}
        </div>

        {/* Manage footer — jumps to the category settings page */}
        <div style={{ borderTop: '1px solid var(--border)', padding: '10px 20px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={() => { close(); navigate('/categories') }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600, color: 'var(--text-2)', padding: '6px 4px',
            }}
          >
            <Settings2 size={15} /> Manage
          </button>
        </div>
      </div>
    </>
  )
}
