import { useEffect, useState } from 'react'
import { ChevronLeft, Check, ChevronRight, Plus, Trash2, X } from 'lucide-react'
import { useSafeBack } from '../hooks/useSafeBack'
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

const EMOJI_PRESETS: Record<ListType, string[]> = {
  shopping: ['🛒', '🍎', '🥛', '🍗', '🌾', '❄️', '🥤', '🍿', '🧻', '🧴', '🐟', '🍞', '🧀', '🍫', '💊', '🧹'],
  tasks:    ['💼', '🏠', '🛵', '❤️', '💰', '🎉', '📚', '⚡', '🧾', '📞', '🖥️', '🔧', '📅', '✈️'],
  personal: ['💡', '📝', '⭐', '✈️', '📌', '🎬', '🎵', '🎁', '📷', '🍽️', '🏋️', '🌱'],
}

interface Draft {
  id: string | null // null = new category
  name: string
  emoji: string
  color: string
  keywords: string[]
}

const emptyDraft = (): Draft => ({ id: null, name: '', emoji: '🏷️', color: COLOR_SWATCHES[0], keywords: [] })

export default function Categories() {
  const goBack = useSafeBack()
  const { user } = useAuthStore()
  const categories = useCategoriesStore(s => s.categories)
  const init = useCategoriesStore(s => s.init)
  const saveCategory = useCategoriesStore(s => s.saveCategory)
  const deleteCategory = useCategoriesStore(s => s.deleteCategory)
  const lastError = useCategoriesStore(s => s.lastError)
  const clearError = useCategoriesStore(s => s.clearError)

  const [tab, setTab] = useState<ListType>('shopping')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [keywordInput, setKeywordInput] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (user) init(user.id) }, [user])

  const cats = categories[tab]

  const openEdit = (c: ListCategory) => {
    setConfirmingDelete(false)
    setKeywordInput('')
    setDraft({ id: c.id, name: c.name, emoji: c.emoji, color: c.color, keywords: [...c.keywords] })
  }
  const openAdd = () => { setConfirmingDelete(false); setKeywordInput(''); setDraft(emptyDraft()) }

  // Turns the pending input into a keyword tag (Enter, comma, or blur)
  const commitKeyword = () => {
    if (!draft) return
    const k = keywordInput.trim().toLowerCase().replace(/,/g, '')
    setKeywordInput('')
    if (!k || draft.keywords.includes(k)) return
    setDraft({ ...draft, keywords: [...draft.keywords, k] })
  }
  const removeKeyword = (k: string) => {
    if (!draft) return
    setDraft({ ...draft, keywords: draft.keywords.filter(x => x !== k) })
  }

  const handleSave = async () => {
    if (!draft || !draft.name.trim() || saving) return
    setSaving(true)
    // Include anything still sitting in the input box
    const pending = keywordInput.trim().toLowerCase().replace(/,/g, '')
    const keywords = pending && !draft.keywords.includes(pending)
      ? [...draft.keywords, pending] : draft.keywords
    await saveCategory(tab, {
      id: draft.id ?? makeCategoryId(draft.name),
      name: draft.name.trim().slice(0, 30),
      emoji: (draft.emoji.trim() || '🏷️').slice(0, 4),
      color: draft.color,
      keywords,
    })
    setSaving(false)
    setKeywordInput('')
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
        <button className="btn btn-ghost btn-sm" onClick={goBack} aria-label="Go back">
          <ChevronLeft size={20} />
        </button>
        <span className="header-title">Categories</span>
        <button className="btn btn-ghost btn-sm" onClick={openAdd} aria-label="Add category" style={{ color: 'var(--accent)' }}>
          <Plus size={20} />
        </button>
      </div>

      <div className="page page-padded" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {lastError && (
          <div className="error-msg" role="alert">
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
            <div className="input-group">
              <label className="input-label">Category name</label>
              <input
                className="input"
                placeholder="e.g. Baby care"
                value={draft.name}
                onChange={e => setDraft({ ...draft, name: e.target.value })}
                maxLength={30}
                autoFocus={!draft.id}
              />
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Required to create category</span>
            </div>

            {/* Icon — preset tiles, horizontal scroll */}
            <div className="input-group">
              <label className="input-label">Icon</label>
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 } as React.CSSProperties}>
                {[...new Set([draft.emoji, ...EMOJI_PRESETS[tab]])].map(e => {
                  const active = draft.emoji === e
                  return (
                    <button
                      key={e}
                      onClick={() => setDraft({ ...draft, emoji: e })}
                      style={{
                        width: 42, height: 42, borderRadius: 12, flexShrink: 0, fontSize: 19,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                        background: active ? 'var(--accent)' : 'var(--bg-input)',
                        border: 'none',
                        transition: 'background 150ms ease',
                      }}
                    >{e}</button>
                  )
                })}
              </div>
            </div>

            {/* Color — circles with a check on the selected one */}
            <div className="input-group">
              <label className="input-label">Color</label>
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 } as React.CSSProperties}>
                {COLOR_SWATCHES.map(col => {
                  const active = draft.color === col
                  return (
                    <button
                      key={col}
                      onClick={() => setDraft({ ...draft, color: col })}
                      aria-label={`Color ${col}`}
                      style={{
                        width: 38, height: 38, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
                        background: col, border: active ? '2.5px solid var(--text)' : '2.5px solid transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      {active && <Check size={16} strokeWidth={3} color="#fff" />}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Keywords</label>
              <div
                onClick={e => (e.currentTarget.querySelector('input') as HTMLInputElement)?.focus()}
                style={{
                  display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center',
                  minHeight: 48, padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-input)', border: '1.5px solid rgba(22, 163, 74, 0.10)',
                  cursor: 'text',
                }}
              >
                {draft.keywords.map(k => (
                  <span key={k} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '4px 6px 4px 10px', borderRadius: 99,
                    background: `${draft.color}1f`, fontSize: 13, fontWeight: 500, color: 'var(--text)',
                  }}>
                    {k}
                    <button
                      onClick={e => { e.stopPropagation(); removeKeyword(k) }}
                      aria-label={`Remove ${k}`}
                      style={{
                        width: 24, height: 24, borderRadius: 99, border: 'none', cursor: 'pointer',
                        background: 'rgba(0,0,0,0.25)', color: 'var(--text-2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                      }}
                    >
                      <X size={11} strokeWidth={2.5} />
                    </button>
                  </span>
                ))}
                <input
                  value={keywordInput}
                  onChange={e => {
                    // A typed comma commits the tag immediately
                    if (e.target.value.includes(',')) {
                      setKeywordInput(e.target.value)
                      setTimeout(commitKeyword, 0)
                    } else {
                      setKeywordInput(e.target.value)
                    }
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); commitKeyword() }
                    if (e.key === 'Backspace' && !keywordInput && draft.keywords.length > 0) {
                      removeKeyword(draft.keywords[draft.keywords.length - 1])
                    }
                  }}
                  onBlur={commitKeyword}
                  placeholder="＋ add"
                  style={{
                    flex: 1, minWidth: 70, border: 'none', outline: 'none',
                    // 16px avoids iOS Safari focus-zoom on this keyword field
                    background: 'transparent', color: 'var(--text)', fontSize: 16, padding: '4px 2px',
                  }}
                />
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                Items containing these words auto-sort into this category.
              </span>
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
