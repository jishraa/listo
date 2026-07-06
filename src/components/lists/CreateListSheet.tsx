import { useState, useEffect, useMemo } from 'react'
import { Sparkles, ChevronRight, Plus } from 'lucide-react'
import Sheet from '../ui/Sheet'
import type { List, ListType } from '../../types'
import { TEMPLATES, LIST_TYPE_ICONS, suggestListMeta } from '../../lib/constants'
import { useListsStore, templateLists } from '../../store/useListsStore'

const TYPE_LABELS: Record<ListType, string> = {
  personal: 'Personal',
  tasks: 'Tasks',
  shopping: 'Shopping',
}

// Accessible names for the icon buttons — emoji alone reads inconsistently on
// screen readers (a11y §Screen-reader labels for icons).
const ICON_LABELS: Record<string, string> = {
  '🏠': 'Home', '✈️': 'Travel', '⭐': 'Star', '📅': 'Calendar', '📝': 'Notes',
  '✅': 'Checklist', '💼': 'Briefcase', '🎯': 'Target', '🔧': 'Tools',
  '🛒': 'Shopping cart', '🧺': 'Basket', '🛍️': 'Shopping bags', '🍎': 'Food', '🏪': 'Store',
}

// User preference set in Profile → Preferences → Default List Type
export const DEFAULT_TYPE_KEY = 'listo-default-list-type'
export function getDefaultListType(): ListType {
  const t = localStorage.getItem(DEFAULT_TYPE_KEY)
  return t === 'tasks' || t === 'shopping' ? t : 'personal'
}

interface Props {
  open: boolean
  onClose: () => void
  onCreate: (name: string, type: ListType, emoji: string, templateItems?: { title: string; category?: string }[]) => Promise<void>
  // Opening screen: template gallery (default) or the blank-list form
  initialStep?: 'templates' | 'custom'
  // Preselection for the empty-state starter shortcuts — opens straight into
  // the custom form with the name/type/icon filled in, all still editable.
  initial?: { name: string; type: ListType; emoji: string }
}

export default function CreateListSheet({ open, onClose, onCreate, initialStep = 'templates', initial }: Props) {
  const [step, setStep] = useState<'templates' | 'custom'>(initialStep)
  const [name, setName] = useState('')
  const [type, setType] = useState<ListType>(getDefaultListType)
  // Latches once the user picks a type, so smart suggestions never override a
  // manual choice (Create List spec §5).
  const [typeManual, setTypeManual] = useState(false)
  // 'auto' = let the name/type decide; otherwise an explicit emoji.
  const [iconChoice, setIconChoice] = useState<'auto' | string>('auto')
  // Starter items carried from a chosen template into the review form; they're
  // created with the list once the user confirms (spec §8/§9).
  const [pendingItems, setPendingItems] = useState<{ title: string; category?: string }[] | undefined>(undefined)
  const [loading, setLoading] = useState(false)

  const lists = useListsStore(s => s.lists)
  const items = useListsStore(s => s.items)
  const createFromTemplate = useListsStore(s => s.createFromTemplate)
  const myTemplates = templateLists(lists)

  // Lightweight local keyword match → suggested { type, emoji }
  const suggestion = useMemo(() => suggestListMeta(name), [name])

  // Follow the suggested type only until the user picks one themselves.
  useEffect(() => {
    if (!typeManual && suggestion) setType(suggestion.type)
  }, [suggestion, typeManual])

  // Auto icon: the suggestion's emoji while the type is still auto-driven,
  // otherwise the chosen type's default icon (predictable, spec §5/§11).
  const autoEmoji = (!typeManual && suggestion) ? suggestion.emoji : LIST_TYPE_ICONS[type][0]
  const resolvedEmoji = iconChoice === 'auto' ? autoEmoji : iconChoice

  // Re-sync when reopened — the same instance can be opened with a different
  // initialStep (e.g. Lists' "New List" vs "Templates" actions) or with a
  // starter preselection that jumps straight into the prefilled custom form.
  useEffect(() => {
    if (!open) return
    if (initial) {
      setStep('custom')
      setName(initial.name)
      setType(initial.type)
      setTypeManual(true)      // honor the starter's type; still user-editable
      setIconChoice(initial.emoji)
      setPendingItems(undefined)
    } else {
      setStep(initialStep)
    }
  }, [open, initialStep, initial])

  const reset = () => {
    setStep(initialStep); setName(''); setType(getDefaultListType())
    setTypeManual(false); setIconChoice('auto'); setPendingItems(undefined)
  }

  // Tapping a suggested template doesn't create it — it prefills the review
  // form (name/type/icon + starter items), all still editable (spec §8/§9).
  const configureTemplate = (t: typeof TEMPLATES[0]) => {
    setName(t.label); setType(t.type); setTypeManual(true)
    setIconChoice(t.emoji); setPendingItems(t.items); setStep('custom')
  }

  // "Create Blank List" — a clean form with no template prefill (spec §10/§12).
  const startBlank = () => {
    setName(''); setType(getDefaultListType()); setTypeManual(false)
    setIconChoice('auto'); setPendingItems(undefined); setStep('custom')
  }

  const handleCreate = async (templateItems?: { title: string; category?: string }[]) => {
    // Guard also blocks duplicate submissions while a create is in flight (§8).
    if (!name.trim() || loading) return
    setLoading(true)
    await onCreate(name.trim(), type, resolvedEmoji, templateItems)
    reset()
    setLoading(false)
    onClose()
  }

  const handleUserTemplate = async (t: List) => {
    if (loading) return
    setLoading(true)
    await createFromTemplate(t.id)
    setLoading(false)
    onClose()
  }

  const handleClose = () => { reset(); onClose() }

  const isCustom = step === 'custom'

  return (
    <Sheet
      open={open}
      onClose={handleClose}
      title={isCustom ? 'Create List' : 'Create a List'}
      subtitle={isCustom
        ? (pendingItems ? 'Review your list — tweak anything, then create.' : 'Choose a name and type to get started.')
        : 'Start quickly with a template or create your own.'}
      // Step navigation back to the gallery (only when we came from it) — not a
      // dismissal, so it doesn't compete with X / swipe / backdrop (spec §7).
      onBack={isCustom && initialStep === 'templates' ? () => setStep('templates') : undefined}
    >
      {!isCustom ? (
        <div className="sheet-body">
          {myTemplates.length > 0 && (
            <>
              <p className="tmpl-section-label">My templates</p>
              <div className="flex-col gap-2">
                {myTemplates.map(t => {
                  const count = (items[t.id] ?? []).length
                  return (
                    <button
                      key={t.id}
                      onClick={() => handleUserTemplate(t)}
                      disabled={loading}
                      className="card card-press tmpl-card"
                      aria-label={`${t.name} template, ${TYPE_LABELS[t.type]} list, ${count} ${count === 1 ? 'item' : 'items'}`}
                    >
                      <span className="tmpl-emoji">{t.emoji}</span>
                      <div className="tmpl-text">
                        <p className="tmpl-name truncate">{t.name}</p>
                        <p className="tmpl-meta">{TYPE_LABELS[t.type]} · {count} {count === 1 ? 'item' : 'items'}</p>
                      </div>
                      <ChevronRight size={17} className="tmpl-chevron" />
                    </button>
                  )
                })}
              </div>
            </>
          )}

          <p className="tmpl-section-label">Suggested</p>
          <div className="flex-col gap-2">
            {TEMPLATES.map(t => (
              <button
                key={t.id}
                onClick={() => configureTemplate(t)}
                className="card card-press tmpl-card"
                aria-label={`${t.label} template, ${TYPE_LABELS[t.type]} list, ${t.items.length} starter items`}
              >
                <span className="tmpl-emoji">{t.emoji}</span>
                <div className="tmpl-text">
                  <p className="tmpl-name truncate">{t.label}</p>
                  <p className="tmpl-meta">{TYPE_LABELS[t.type]} · {t.items.length} starter items</p>
                </div>
                <ChevronRight size={17} className="tmpl-chevron" />
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2" aria-hidden="true">
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span className="text-xs" style={{ color: 'var(--text-3)', fontWeight: 700, letterSpacing: '0.08em' }}>OR</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          <button className="btn btn-secondary btn-full" onClick={startBlank}>
            <Plus size={18} /> Create Blank List
          </button>
        </div>
      ) : (
        <div className="sheet-body sheet-body--form">
          <div className="input-group">
            <label className="input-label" htmlFor="new-list-name">List Name</label>
            <input
              id="new-list-name"
              className="input"
              placeholder="e.g. Weekend Trip"
              value={name}
              autoFocus
              enterKeyHint="done"
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
            />
          </div>

          <div className="input-group">
            <label className="input-label" id="list-type-label">List Type</label>
            <div className="seg-group" role="group" aria-labelledby="list-type-label">
              {(['personal', 'tasks', 'shopping'] as ListType[]).map(t => (
                <button
                  key={t}
                  type="button"
                  className="seg-btn"
                  aria-pressed={type === t}
                  onClick={() => { setType(t); setTypeManual(true) }}
                >
                  {TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          <div className="input-group">
            <label className="input-label" id="list-icon-label">Choose an Icon</label>
            <div className="icon-grid" role="group" aria-labelledby="list-icon-label">
              <button
                type="button"
                className="icon-btn icon-btn--auto"
                aria-pressed={iconChoice === 'auto'}
                aria-label={`Auto — pick an icon automatically (currently ${ICON_LABELS[autoEmoji] ?? 'suggested'})`}
                onClick={() => setIconChoice('auto')}
              >
                <Sparkles size={15} /> Auto
              </button>
              {LIST_TYPE_ICONS[type].map(e => (
                <button
                  key={e}
                  type="button"
                  className="icon-btn"
                  aria-pressed={iconChoice === e}
                  aria-label={ICON_LABELS[e] ?? 'Icon'}
                  onClick={() => setIconChoice(e)}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {pendingItems && pendingItems.length > 0 && (
            <div className="input-group">
              <label className="input-label">Starter items · {pendingItems.length}</label>
              <div className="tmpl-items-review">
                {pendingItems.map((it, i) => (
                  <span key={i} className="tmpl-item-chip">{it.title}</span>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            className="btn btn-primary btn-full"
            disabled={!name.trim() || loading}
            aria-busy={loading}
            onClick={() => handleCreate(pendingItems)}
          >
            {loading ? <><span className="spinner" style={{ marginRight: 8 }} />Creating…</> : 'Create List'}
          </button>
        </div>
      )}
    </Sheet>
  )
}
