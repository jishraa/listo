import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { useAuthStore } from '../store/useAuthStore'
import { useCategoriesStore, makeCategoryId } from '../store/useCategoriesStore'
import type { ListCategory } from '../lib/constants'
import Sheet from '../components/ui/Sheet'
import type { ListType } from '../types'

const TYPE_TABS: { id: ListType; label: string }[] = [
  { id: 'shopping', label: 'Shopping' },
  { id: 'tasks',    label: 'Tasks' },
  { id: 'personal', label: 'Personal' },
]

const COLOR_SWATCHES = ['#16A34A', '#1D9E75', '#06B6D4', '#3B82F6', '#A855F7', '#EC4899', '#EF4444', '#F59E0B', '#EAB308', '#6B7280']

interface Draft {
  id: string | null // null = new category
  name: string
  emoji: string
  color: string
  keywords: string
}

const emptyDraft = (): Draft => ({ id: null, name: '', emoji: '🏷️', color: COLOR_SWATCHES[0], keywords: '' })

export default function Categories() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const categories = useCategoriesStore(s => s.categories)
  const init = useCategoriesStore(s => s.init)
  const saveCategory = useCategoriesStore(s => s.saveCategory)
  const deleteCategory = useCategoriesStore(s => s.deleteCategory)
  const lastError = useCategoriesStore(s => s.lastError)
  const clearError = useCategoriesStore(s => s.clearError)

  const [tab, setTab] = useState<ListType>('shopping')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (user) init(user.id) }, [user])

  const cats = categories[tab]

  const openEdit = (c: ListCategory) => {
    setConfirmingDelete(false)
    setDraft({ id: c.id, name: c.name, emoji: c.emoji, color: c.color, keywords: c.keywords.join(', ') })
  }
  const openAdd = () => { setConfirmingDelete(false); setDraft(emptyDraft()) }

  const handleSave = async () => {
    if (!draft || !draft.name.trim() || saving) return
    setSaving(true)
    await saveCategory(tab, {
      id: draft.id ?? makeCategoryId(draft.name),
      name: draft.name.trim().slice(0, 30),
      emoji: (draft.emoji.trim() || '🏷️').slice(0, 4),
      color: draft.color,
      keywords: draft.keywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean),
    })
    setSaving(false)
    setDraft(null)
  }

  const handleDelete = async () => {
    if (!draft?.id || saving) return
    setSaving(true)
    await deleteCategory(tab, draft.id)
    setSaving(false)
    setDraft(null)
  }

  return (
    <div className="app-container">
      <div className="header">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)} aria-label="Go back">
          <ArrowLeft size={20} />
        </button>
        <span className="header-title">Categories</span>
        <button className="btn btn-ghost btn-sm" onClick={openAdd} aria-label="Add category" style={{ color: 'var(--accent)' }}>
          <Plus size={20} />
        </button>
      </div>

      <div className="page page-padded" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {lastError && (
          <div className="error-msg">
            {lastError}
            <button onClick={clearError} style={{ float: 'right', fontWeight: 700, background: 'none', color: '#dc2626', fontSize: 16 }}>✕</button>
          </div>
        )}

        {/* Type tabs */}
        <div style={{ display: 'flex', gap: 6 }}>
          {TYPE_TABS.map(t => {
            const active = tab === t.id
            return (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                flex: 1, height: 36, borderRadius: 99, cursor: 'pointer', border: 'none',
                background: active ? 'var(--accent)' : 'var(--bg-input)',
                color: active ? '#030a14' : 'var(--text-2)',
                fontSize: 13, fontWeight: active ? 700 : 500,
                transition: 'background 150ms ease, color 150ms ease',
              }}>{t.label}</button>
            )
          })}
        </div>

        <p className="text-sm text-muted" style={{ margin: '0 2px' }}>
          Keywords drive auto-detection when adding items. Deleting a category keeps its items — they just lose the label.
        </p>

        {/* Category rows */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {cats.map((c, i) => (
            <button
              key={c.id}
              onClick={() => openEdit(c)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 13,
                padding: '12px 14px', border: 'none', cursor: 'pointer', textAlign: 'left',
                background: 'none',
                borderBottom: i < cats.length - 1 ? '1px solid var(--border)' : 'none',
              }}
            >
              <span style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0, fontSize: 17,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `${c.color}1f`,
              }}>{c.emoji}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{c.name}</span>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--text-3)', marginTop: 1 }}>
                  {c.keywords.length > 0 ? `${c.keywords.length} keywords` : 'No keywords'}
                </span>
              </span>
              <span style={{ width: 12, height: 12, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
              <ChevronRight size={16} color="var(--text-3)" style={{ flexShrink: 0 }} />
            </button>
          ))}
          {cats.length === 0 && (
            <p className="text-sm text-muted" style={{ textAlign: 'center', padding: '24px 0' }}>
              No categories yet — add one with the + button.
            </p>
          )}
        </div>

        <button className="btn btn-primary btn-full" onClick={openAdd}>
          <Plus size={16} /> Add Category
        </button>
      </div>

      {/* Add / edit sheet */}
      <Sheet open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? 'Edit Category' : 'New Category'}>
        {draft && (
          <div className="sheet-body">
            <div className="flex gap-2">
              <div className="input-group" style={{ width: 76, flexShrink: 0 }}>
                <label className="input-label">Emoji</label>
                <input
                  className="input"
                  value={draft.emoji}
                  onChange={e => setDraft({ ...draft, emoji: e.target.value })}
                  maxLength={4}
                  style={{ textAlign: 'center', fontSize: 20 }}
                />
              </div>
              <div className="input-group" style={{ flex: 1 }}>
                <label className="input-label">Name</label>
                <input
                  className="input"
                  placeholder="e.g. Baby care"
                  value={draft.name}
                  onChange={e => setDraft({ ...draft, name: e.target.value })}
                  maxLength={30}
                  autoFocus={!draft.id}
                />
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Color</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {COLOR_SWATCHES.map(col => (
                  <button
                    key={col}
                    onClick={() => setDraft({ ...draft, color: col })}
                    aria-label={`Color ${col}`}
                    style={{
                      width: 32, height: 32, borderRadius: '50%', cursor: 'pointer',
                      background: col,
                      border: draft.color === col ? '3px solid var(--text)' : '3px solid transparent',
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Keywords (comma separated — used for auto-detect)</label>
              <textarea
                className="input"
                value={draft.keywords}
                onChange={e => setDraft({ ...draft, keywords: e.target.value })}
                placeholder="milk, cheese, butter"
                rows={3}
                style={{ resize: 'vertical', minHeight: 70, paddingTop: 10, fontFamily: 'inherit' }}
              />
            </div>

            <button className="btn btn-primary btn-full" onClick={handleSave} disabled={!draft.name.trim() || saving}>
              {saving ? <span className="spinner" /> : draft.id ? 'Save Changes' : 'Add Category'}
            </button>

            {draft.id && (
              confirmingDelete ? (
                <div className="flex gap-2">
                  <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setConfirmingDelete(false)}>Cancel</button>
                  <button className="btn btn-danger" style={{ flex: 1 }} onClick={handleDelete} disabled={saving}>
                    <Trash2 size={15} /> Delete
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmingDelete(true)}
                  style={{ width: '100%', padding: '10px 0', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#ef4444' }}
                >
                  Delete category
                </button>
              )
            )}
          </div>
        )}
      </Sheet>
    </div>
  )
}
