import { useEffect, useState } from 'react'
import Sheet from '../../components/ui/Sheet'

interface RenameSheetProps {
  open: boolean
  currentName: string
  onClose: () => void
  onRename: (name: string) => void
}

// Rename dialog — owns its draft value; the page only learns the final name.
export default function RenameSheet({ open, currentName, onClose, onRename }: RenameSheetProps) {
  const [value, setValue] = useState(currentName)
  useEffect(() => { if (open) setValue(currentName) }, [open, currentName])

  const unchanged = !value.trim() || value.trim() === currentName
  const save = () => {
    const n = value.trim()
    if (n && n !== currentName) onRename(n)
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Rename list">
      <div className="sheet-body">
        <input
          autoFocus
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') save()
            if (e.key === 'Escape') onClose()
          }}
          maxLength={100}
          style={{ width: '100%', height: 48, borderRadius: 10, padding: '0 14px', background: 'var(--bg-input)', border: '1.5px solid var(--accent)', color: 'var(--text)', fontSize: 15, outline: 'none', boxSizing: 'border-box' }}
        />
        <div className="flex gap-2">
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{ flex: 1, opacity: unchanged ? 0.4 : 1 }}
            disabled={unchanged}
            onClick={save}>
            Save
          </button>
        </div>
      </div>
    </Sheet>
  )
}
