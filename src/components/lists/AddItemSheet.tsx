import { useState, useRef, useEffect } from 'react'
import Sheet from '../ui/Sheet'
import type { ListType } from '../../types'
import { LIST_CATEGORIES, detectCategory, parseItemInput, GROCERY_VOCAB } from '../../lib/constants'

interface Props {
  open: boolean
  onClose: () => void
  listType: ListType
  onAdd: (title: string, quantity: string, category: string | null) => Promise<void>
}

export default function AddItemSheet({ open, onClose, listType, onAdd }: Props) {
  const [raw, setRaw] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
    else { setRaw(''); setCategory(null); setSuggestions([]) }
  }, [open])

  const handleChange = (val: string) => {
    setRaw(val)
    const { item } = parseItemInput(val)
    const detected = detectCategory(item, listType)
    if (detected) setCategory(detected)

    if (listType === 'shopping' && item.length >= 2) {
      const lower = item.toLowerCase()
      setSuggestions(GROCERY_VOCAB.filter(v => v.toLowerCase().startsWith(lower) && v.toLowerCase() !== lower).slice(0, 4))
    } else {
      setSuggestions([])
    }
  }

  const handleAdd = async () => {
    const { item, qty } = parseItemInput(raw)
    if (!item) return
    setLoading(true)
    await onAdd(item, qty, category)
    setRaw('')
    setCategory(null)
    setSuggestions([])
    setLoading(false)
    inputRef.current?.focus()
  }

  const applySuggestion = (s: string) => {
    setRaw(s)
    setSuggestions([])
    const detected = detectCategory(s, listType)
    if (detected) setCategory(detected)
    inputRef.current?.focus()
  }

  const cats = LIST_CATEGORIES[listType]
  const catMeta = cats.find(c => c.id === category)

  return (
    <Sheet open={open} onClose={onClose} title="Add Item">
      <div className="sheet-body">
        <div className="input-group" style={{ position: 'relative' }}>
          <label className="input-label">Item name</label>
          <input
            ref={inputRef}
            className="input"
            placeholder={listType === 'shopping' ? 'e.g. Milk x2' : 'e.g. Call dentist'}
            value={raw}
            onChange={e => handleChange(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          {suggestions.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
              background: 'var(--bg-card)', borderRadius: 'var(--radius-sm)',
              boxShadow: 'var(--shadow)', border: '1px solid var(--border)', marginTop: 4,
            }}>
              {suggestions.map(s => (
                <button
                  key={s}
                  onClick={() => applySuggestion(s)}
                  style={{
                    display: 'block', width: '100%', padding: '10px 14px',
                    textAlign: 'left', fontSize: 14, color: 'var(--text)',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="input-group">
          <label className="input-label">
            Category
            {catMeta && (
              <span style={{ marginLeft: 8, color: catMeta.color, fontWeight: 600 }}>{catMeta.name}</span>
            )}
          </label>
          <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
            {cats.map(c => (
              <button
                key={c.id}
                onClick={() => setCategory(category === c.id ? null : c.id)}
                style={{
                  padding: '5px 12px', borderRadius: 100, fontSize: 12, fontWeight: 600,
                  background: category === c.id ? c.color : 'var(--bg-input)',
                  color: category === c.id ? '#fff' : 'var(--text-2)',
                  border: `1.5px solid ${category === c.id ? c.color : 'transparent'}`,
                  transition: 'all 0.15s',
                }}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            style={{ flex: 2, opacity: !parseItemInput(raw).item || loading ? 0.6 : 1 }}
            onClick={handleAdd}
            disabled={!parseItemInput(raw).item || loading}
          >
            {loading ? <span className="spinner" /> : 'Add Item'}
          </button>
        </div>
      </div>
    </Sheet>
  )
}
