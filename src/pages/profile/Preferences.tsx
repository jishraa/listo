import { useState } from 'react'
import { Check, ClipboardList, Cloud, History, Monitor, Moon, Palette, Sun } from 'lucide-react'
import Sheet from '../../components/ui/Sheet'
import { useThemeStore } from '../../store/useThemeStore'
import type { ThemePref } from '../../store/useThemeStore'
import { useListsStore, visibleLists } from '../../store/useListsStore'
import { useSyncStore } from '../../store/useSyncStore'
import { storageKeys, getDefaultListType } from '../../lib/storage'
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
  const [typePickerOpen, setTypePickerOpen] = useState(false)

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
    localStorage.setItem(storageKeys.defaultListType, t)
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
        <Row
          icon={<ClipboardList size={17} />}
          label="Default List"
          subtitle="Used as the default when creating a new list"
          value={`${LIST_TYPE_OPTIONS.find(o => o.value === defaultType)?.emoji} ${LIST_TYPE_OPTIONS.find(o => o.value === defaultType)?.label}`}
          onPress={() => setTypePickerOpen(true)}
          last
        />
      </Section>

      {/* Same picker pattern as everywhere else — no native select */}
      <Sheet open={typePickerOpen} onClose={() => setTypePickerOpen(false)} title="Default List Type">
        <div className="sheet-body" style={{ gap: 7 }} role="radiogroup" aria-label="Default list type">
          {LIST_TYPE_OPTIONS.map(({ value, label, emoji }) => {
            const selected = defaultType === value
            return (
              <button
                key={value}
                role="radio"
                aria-checked={selected}
                className={`sort-row${selected ? ' selected' : ''}`}
                onClick={() => { pickDefaultType(value); setTypePickerOpen(false) }}
              >
                <span>{emoji} {label}</span>
                {selected && <Check size={17} color="var(--accent-text)" strokeWidth={2.6} />}
              </button>
            )
          })}
        </div>
      </Sheet>

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
