import { useState } from 'react'
import { ChevronDown, ClipboardList, Cloud, History, Monitor, Moon, Palette, Sun } from 'lucide-react'
import { useThemeStore } from '../../store/useThemeStore'
import type { ThemePref } from '../../store/useThemeStore'
import { useListsStore, visibleLists } from '../../store/useListsStore'
import { useSyncStore } from '../../store/useSyncStore'
import { DEFAULT_TYPE_KEY, getDefaultListType } from '../../components/lists/CreateListSheet'
import { formatRelativeTime } from '../../lib/utils'
import { SubPage, Section, Row, useEnsureData } from './common'
import type { ListType } from '../../types'

const THEME_OPTIONS: { value: ThemePref; label: string; Icon: typeof Sun }[] = [
  { value: 'light',  label: 'Light',  Icon: Sun },
  { value: 'dark',   label: 'Dark',   Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
]

const LIST_TYPE_OPTIONS: { value: ListType; label: string; emoji: string }[] = [
  { value: 'personal', label: 'Personal', emoji: '📋' },
  { value: 'tasks',    label: 'Tasks',    emoji: '✅' },
  { value: 'shopping', label: 'Shopping', emoji: '🛒' },
]

export default function PreferencesPage() {
  useEnsureData()
  const { pref, setPref } = useThemeStore()
  const lists = useListsStore(s => s.lists)
  const online = useSyncStore(s => s.online)
  const syncing = useSyncStore(s => s.syncing)
  const queueLen = useSyncStore(s => s.queue.length)
  const [defaultType, setDefaultType] = useState<ListType>(getDefaultListType)

  const visible = visibleLists(lists)
  const lastActivity = visible.length > 0
    ? visible.reduce((max, l) => l.updated_at > max ? l.updated_at : max, visible[0].updated_at)
    : null

  // Honest sync status from real connectivity/queue state (no invented time).
  const sync = !online
    ? { label: `Offline${queueLen > 0 ? ` · ${queueLen} pending` : ''}`, color: '#d97706' }
    : syncing && queueLen > 0
      ? { label: `Syncing ${queueLen}…`, color: 'var(--accent)' }
      : { label: 'Synced ✓', color: 'var(--accent)' }

  const pickDefaultType = (t: ListType) => {
    setDefaultType(t)
    localStorage.setItem(DEFAULT_TYPE_KEY, t)
  }

  return (
    <SubPage title="Preferences">
      <Section title="Appearance">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
          <span style={{ color: 'var(--accent)', display: 'flex', flexShrink: 0 }}><Palette size={17} /></span>
          <span style={{ flex: 1, fontSize: 15, fontWeight: 500, color: 'var(--text)' }}>Theme</span>
          <div className="seg-pill" role="radiogroup" aria-label="Theme" style={{ flexShrink: 0 }}>
            {THEME_OPTIONS.map(({ value, label, Icon }) => {
              const active = pref === value
              return (
                <button
                  key={value}
                  role="radio"
                  aria-checked={active}
                  aria-label={label}
                  className={`seg-pill-item${active ? ' active' : ''}`}
                  onClick={() => setPref(value)}
                >
                  <Icon size={16} strokeWidth={active ? 2.4 : 1.9} />
                </button>
              )
            })}
          </div>
        </div>
      </Section>

      <Section title="General">
        <div style={{ padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ color: 'var(--accent)', display: 'flex', flexShrink: 0 }}><ClipboardList size={17} /></span>
            <label htmlFor="default-list-type" style={{ flex: 1, fontSize: 15, fontWeight: 500, color: 'var(--text)' }}>
              Default List
            </label>
            {/* Compact right-aligned dropdown value + chevron (matches the row pattern) */}
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', flexShrink: 0, maxWidth: '55%' }}>
              <select
                id="default-list-type"
                value={defaultType}
                onChange={e => pickDefaultType(e.target.value as ListType)}
                style={{
                  appearance: 'none', WebkitAppearance: 'none', background: 'transparent', border: 'none',
                  color: 'var(--text-2)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  paddingRight: 20, textAlignLast: 'right', outline: 'none', maxWidth: '100%',
                }}
              >
                {LIST_TYPE_OPTIONS.map(({ value, label, emoji }) => (
                  <option key={value} value={value}>{emoji} {label}</option>
                ))}
              </select>
              <ChevronDown size={16} style={{ position: 'absolute', right: 0, pointerEvents: 'none', color: 'var(--text-3)' }} />
            </div>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-3)', margin: '8px 0 0 29px' }}>
            Used as the default when creating a new list.
          </p>
        </div>
      </Section>

      <Section title="Cloud & Sync">
        <Row icon={<Cloud size={17} />} label="Cloud Sync" value={sync.label} valueColor={sync.color} />
        <Row icon={<History size={17} />} label="Last activity"
          value={lastActivity ? formatRelativeTime(lastActivity) : '—'} last />
      </Section>

      <p className="text-xs" style={{ color: 'var(--text-3)', textAlign: 'center', padding: '4px 16px' }}>
        Preferences are saved automatically.
      </p>
    </SubPage>
  )
}
