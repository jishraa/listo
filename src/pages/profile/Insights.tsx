import { useListsStore, visibleLists } from '../../store/useListsStore'
import { useCategoriesStore } from '../../store/useCategoriesStore'
import { SubPage, useEnsureData } from './common'

// All cross-list statistics live here (profile spec v4) — only numbers
// computable from real data; savings/health/achievements need history.
export default function InsightsPage() {
  useEnsureData()
  const lists = useListsStore(s => s.lists)
  const itemsMap = useListsStore(s => s.items)
  const membersMap = useListsStore(s => s.members)
  const categories = useCategoriesStore(s => s.categories)

  const visible = visibleLists(lists)
  const allItems = visible.flatMap(l => itemsMap[l.id] ?? [])
  const doneItems = allItems.filter(i => i.completed)
  const completionPct = allItems.length > 0 ? Math.round((doneItems.length / allItems.length) * 100) : 0
  const sharedCount = visible.filter(l => (membersMap[l.id] ?? []).length > 1).length

  const shoppingItems = visible.filter(l => l.type === 'shopping').flatMap(l => itemsMap[l.id] ?? [])
  const catNames = new Map(categories.shopping.map(c => [c.id, c]))
  const catCounts = new Map<string, number>()
  for (const item of shoppingItems) {
    if (!item.category) continue
    catCounts.set(item.category, (catCounts.get(item.category) ?? 0) + 1)
  }
  const topCats = [...catCounts.entries()]
    .map(([id, count]) => ({ cat: catNames.get(id), count }))
    .filter(e => e.cat)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
  const maxCatCount = topCats[0]?.count ?? 1

  const stats = [
    { label: 'Lists', value: visible.length },
    { label: 'Items completed', value: doneItems.length },
    { label: 'Items pending', value: allItems.length - doneItems.length },
    { label: 'Shared lists', value: sharedCount },
  ]

  return (
    <SubPage title="Insights">
      {allItems.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📊</div>
          <h3>No data yet</h3>
          <p>Add items to your lists and insights will appear here.</p>
        </div>
      ) : (
        <>
          {/* Completion */}
          <div className="card">
            <div className="flex items-center justify-between">
              <span style={{ fontWeight: 600, fontSize: 14 }}>Completion rate</span>
              <span style={{ fontWeight: 800, fontSize: 20, color: 'var(--accent)' }}>{completionPct}%</span>
            </div>
            <div className="progress-bar mt-3">
              <div className="progress-fill" style={{ width: `${completionPct}%`, background: 'var(--accent)' }} />
            </div>
            <p className="text-sm mt-2" style={{ color: 'var(--text-2)' }}>
              {doneItems.length} of {allItems.length} items done across all lists
            </p>
          </div>

          {/* Stat grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {stats.map(s => (
              <div key={s.label} className="card" style={{ padding: '14px 16px' }}>
                <p style={{ fontSize: 24, fontWeight: 800 }}>{s.value}</p>
                <p className="text-sm" style={{ color: 'var(--text-2)', marginTop: 2 }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Category distribution */}
          {topCats.length > 0 && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', padding: '0 4px 8px' }}>
                Top shopping categories
              </p>
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {topCats.map(({ cat, count }) => (
                  <div key={cat!.id}>
                    <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{cat!.emoji} {cat!.name}</span>
                      <span className="text-xs" style={{ color: 'var(--text-3)' }}>{count}</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${(count / maxCatCount) * 100}%`, background: cat!.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs" style={{ color: 'var(--text-3)', textAlign: 'center', padding: '4px 0 8px' }}>
            Savings, shopping health and achievements arrive with shopping history.
          </p>
        </>
      )}
    </SubPage>
  )
}
