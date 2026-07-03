import { useState } from 'react'
import Sheet from '../ui/Sheet'
import type { List, ListType } from '../../types'
import { TEMPLATES } from '../../lib/constants'
import { useListsStore, templateLists } from '../../store/useListsStore'

const TYPE_EMOJIS: Record<ListType, string[]> = {
  personal: ['📋', '📝', '🗒️', '📌', '🏠', '💼'],
  tasks: ['✅', '🎯', '⚡', '🚀', '📅', '🔧'],
  shopping: ['🛒', '🧺', '🛍️', '🍎', '🥗', '🏪'],
}

const TYPE_LABELS: Record<ListType, string> = {
  personal: 'Personal',
  tasks: 'Tasks',
  shopping: 'Shopping',
}

interface Props {
  open: boolean
  onClose: () => void
  onCreate: (name: string, type: ListType, emoji: string, templateItems?: { title: string; category?: string }[]) => Promise<void>
}

export default function CreateListSheet({ open, onClose, onCreate }: Props) {
  const [step, setStep] = useState<'templates' | 'custom'>('templates')
  const [name, setName] = useState('')
  const [type, setType] = useState<ListType>('personal')
  const [emoji, setEmoji] = useState('📋')
  const [loading, setLoading] = useState(false)

  const lists = useListsStore(s => s.lists)
  const items = useListsStore(s => s.items)
  const createFromTemplate = useListsStore(s => s.createFromTemplate)
  const myTemplates = templateLists(lists)

  const reset = () => { setStep('templates'); setName(''); setType('personal'); setEmoji('📋') }

  const handleCreate = async (templateItems?: { title: string; category?: string }[]) => {
    if (!name.trim()) return
    setLoading(true)
    await onCreate(name.trim(), type, emoji, templateItems)
    reset()
    setLoading(false)
    onClose()
  }

  const handleTemplate = async (t: typeof TEMPLATES[0]) => {
    setLoading(true)
    await onCreate(t.label, t.type, t.emoji, t.items)
    setLoading(false)
    onClose()
  }

  const handleUserTemplate = async (t: List) => {
    setLoading(true)
    await createFromTemplate(t.id)
    setLoading(false)
    onClose()
  }

  const handleClose = () => { reset(); onClose() }

  return (
    <Sheet open={open} onClose={handleClose} title={step === 'templates' ? 'New List' : 'Custom List'}>
      {step === 'templates' ? (
        <div className="sheet-body">
          {myTemplates.length > 0 && (
            <>
              <p className="text-xs" style={{ fontWeight: 700, letterSpacing: '0.07em', color: 'var(--text-3)', textTransform: 'uppercase' }}>
                My templates
              </p>
              <div className="flex-col gap-2">
                {myTemplates.map(t => {
                  const count = (items[t.id] ?? []).length
                  return (
                    <button
                      key={t.id}
                      onClick={() => handleUserTemplate(t)}
                      disabled={loading}
                      className="card"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 14,
                        padding: '12px 14px', textAlign: 'left', width: '100%',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        opacity: loading ? 0.6 : 1,
                      }}
                    >
                      <span style={{ fontSize: 26 }}>{t.emoji}</span>
                      <div>
                        <p style={{ fontWeight: 600, fontSize: 14 }}>{t.name}</p>
                        <p className="text-xs text-hint" style={{ marginTop: 2 }}>
                          {count} {count === 1 ? 'item' : 'items'} · {TYPE_LABELS[t.type]}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
              <p className="text-xs" style={{ fontWeight: 700, letterSpacing: '0.07em', color: 'var(--text-3)', textTransform: 'uppercase' }}>
                Suggested
              </p>
            </>
          )}
          <div className="flex-col gap-2">
            {TEMPLATES.map(t => (
              <button
                key={t.id}
                onClick={() => handleTemplate(t)}
                disabled={loading}
                className="card"
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '12px 14px', textAlign: 'left', width: '100%',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1,
                }}
              >
                <span style={{ fontSize: 26 }}>{t.emoji}</span>
                <div>
                  <p style={{ fontWeight: 600, fontSize: 14 }}>{t.label}</p>
                  <p className="text-xs text-hint" style={{ marginTop: 2 }}>
                    {t.items.length} items · {TYPE_LABELS[t.type]}
                  </p>
                </div>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span className="text-xs text-hint">or start blank</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          <button className="btn btn-secondary btn-full" onClick={() => setStep('custom')}>
            Create Custom List
          </button>
        </div>
      ) : (
        <div className="sheet-body">
          <div className="input-group">
            <label className="input-label">List name</label>
            <input
              className="input"
              placeholder="e.g. Weekly groceries"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
            />
          </div>

          <div className="input-group">
            <label className="input-label">Type</label>
            <div className="flex gap-2">
              {(['personal', 'tasks', 'shopping'] as ListType[]).map(t => (
                <button
                  key={t}
                  onClick={() => { setType(t); setEmoji(TYPE_EMOJIS[t][0]) }}
                  className="btn btn-sm"
                  style={{
                    flex: 1,
                    background: type === t ? 'var(--accent)' : 'var(--bg-input)',
                    color: type === t ? '#fff' : 'var(--text-2)',
                  }}
                >
                  {TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Emoji</label>
            <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
              {TYPE_EMOJIS[type].map(e => (
                <button
                  key={e}
                  onClick={() => setEmoji(e)}
                  style={{
                    width: 44, height: 44, borderRadius: 10, fontSize: 22,
                    background: emoji === e ? 'var(--accent-dim)' : 'var(--bg-input)',
                    border: emoji === e ? '2px solid var(--accent)' : '2px solid transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setStep('templates')}>Back</button>
            <button
              className="btn btn-primary"
              style={{ flex: 2, opacity: !name.trim() || loading ? 0.6 : 1 }}
              onClick={() => handleCreate()}
              disabled={!name.trim() || loading}
            >
              {loading ? <span className="spinner" /> : 'Create List'}
            </button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
