import { Pencil, Plus, Trash2, Undo2 } from 'lucide-react'
import Sheet from '../../components/ui/Sheet'
import { formatQuantity } from '../../lib/utils'
import type { ListItem } from '../../types'

interface CompletedItemSheetProps {
  item: ListItem | null
  onClose: () => void
  /** Add Again — legitimate repeat purchase: a fresh pending item, never
   *  routed through the active-duplicate merge warning. */
  onAddAgain: (item: ListItem) => void
  onMoveToPending: (item: ListItem) => void
  onEdit: (item: ListItem) => void
  onDelete: (item: ListItem) => void
}

// Tapping a completed item opens this small action sheet instead of
// mutating it directly.
export default function CompletedItemSheet({ item, onClose, onAddAgain, onMoveToPending, onEdit, onDelete }: CompletedItemSheetProps) {
  if (!item) return null
  const act = (fn: (item: ListItem) => void) => () => { onClose(); fn(item) }
  return (
    <Sheet
      open
      onClose={onClose}
      title={`${item.title}${item.quantity ? ` · ${formatQuantity(item.quantity)}` : ''}`}
    >
      <div className="ld-menu">
        <div className="ld-menu-group">
          <button className="ld-menu-row" onClick={act(onAddAgain)}>
            <span className="ld-row-icon"><Plus size={16} /></span>
            <span className="ld-row-label">Add Again</span>
          </button>
          <button className="ld-menu-row" onClick={act(onMoveToPending)}>
            <span className="ld-row-icon"><Undo2 size={16} /></span>
            <span className="ld-row-label">Move to Pending</span>
          </button>
          <button className="ld-menu-row" onClick={act(onEdit)}>
            <span className="ld-row-icon"><Pencil size={16} /></span>
            <span className="ld-row-label">Edit</span>
          </button>
        </div>
        <div className="ld-menu-group">
          <button className="ld-menu-row danger" onClick={act(onDelete)}>
            <span className="ld-row-icon"><Trash2 size={16} /></span>
            <span className="ld-row-label">Delete</span>
          </button>
        </div>
      </div>
    </Sheet>
  )
}
