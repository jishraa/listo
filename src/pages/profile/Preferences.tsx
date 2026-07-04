import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Cloud, History, Monitor, Moon, Sun, Tag } from 'lucide-react'
import { useThemeStore } from '../../store/useThemeStore'
import type { ThemePref } from '../../store/useThemeStore'
import { useListsStore, visibleLists } from '../../store/useListsStore'
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
  const navigate = useNavigate()
  const { pref, setPref } = useThemeStore()
  const lists = useListsStore(s => s.lists)
  const [defaultType, setDefaultType] = useState<ListType>(getDefaultListType)

  const visible = visibleLists(lists)
  const lastActivity = visible.length > 0
    ? visible.reduce((max, l) => l.updated_at > max ? l.updated_at : max, visible[0].updated_at)
    : null

  const pickDefaultType = (t: ListType) => {
    setDefaultType(t)
    localStorage.setItem(DEFAULT_TYPE_KEY, t)
  }

  const tile = (active: boolean) => ({
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center',
    gap: 7, padding: '13px 8px', borderRadius: 12, cursor: 'pointer',
    background: active ? 'var(--accent-dim)' : 'var(--bg-input)',
    border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
    color: active ? 'var(--accent)' : 'var(--text-2)',
    transition: 'all 0.18s',
  })

  return (
    <SubPage title="Preferences">
      <Section title="Appearance">
        <div style={{ padding: '14px 16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {THEME_OPTIONS.map(({ value, label, Icon }) => {
              const active = pref === value
              return (
                <button key={value} onClick={() => setPref(value)} style={tile(active)}>
                  <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
                  <span style={{ fontSize: 12, fontWeight: active ? 700 : 500 }}>{label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </Section>

      <Section title="General">
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 10 }}>Default List Type</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {LIST_TYPE_OPTIONS.map(({ value, label, emoji }) => {
              const active = defaultType === value
              return (
                <button key={value} onClick={() => pickDefaultType(value)} style={tile(active)}>
                  <span style={{ fontSize: 18 }}>{emoji}</span>
                  <span style={{ fontSize: 12, fontWeight: active ? 700 : 500 }}>{label}</span>
                </button>
              )
            })}
          </div>
        </div>
        <Row icon={<Tag size={17} />} label="Manage Categories" onPress={() => navigate('/categories')} last />
      </Section>

      <Section title="Cloud & Sync">
        <Row icon={<Cloud size={17} />} label="Cloud Sync" value="Enabled" valueColor="var(--accent)" />
        <Row icon={<History size={17} />} label="Last activity"
          value={lastActivity ? formatRelativeTime(lastActivity) : '—'} last />
      </Section>
    </SubPage>
  )
}
