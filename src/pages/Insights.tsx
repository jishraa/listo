import { useListsStore } from '../store/useListsStore'
import { LIST_CATEGORIES } from '../lib/constants'

// Insights v1 — stats computable from loaded lists/items only. The vision's
// full module (health score, savings, predictions, coach) needs purchase
// history that doesn't exist yet; every number shown here is real.
export default function Insights() {
  const store = useListsStore()

  const allItems = store.lists.flatMap(l => store.items[l.id] ?? [])
  const doneItems = allItems.filter(i => i.completed)
  const completionPct = allItems.length > 0 ? Math.round((doneItems.length / allItems.length) * 100) : 0

  const sharedCount = store.lists.filter(l => (store.members[l.id] ?? []).length > 1).length

  // Uncategorized shopping items — actionable: categorizing improves future insights
  const shoppingItems = store.lists.filter(l => l.type === 'shopping').flatMap(l => store.items[l.id] ?? [])
  const uncategorized = shoppingItems.filter(i => !i.category).length

  // Category distribution across shopping items
  const catNames = new Map(LIST_CATEGORIES.shopping.map(c => [c.id, c]))
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
    { label: 'Lists', value: store.lists.length },
    { label: 'Items completed', value: doneItems.length },
    { label: 'Items pending', value: allItems.length - doneItems.length },
    { label: 'Shared lists', value: sharedCount },
  ]

  const sectionLabel = { fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', color: 'var(--text-3)', textTransform: 'uppercase' as const, padding: '0 2px 8px', display: 'block' }

  return (
    <div className="page">
      <div style={{ padding: '24px 16px 4px' }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5 }}>Insights</h1>
      </div>

      <div className="page-padded" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
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
                <span style={sectionLabel}>Top shopping categories</span>
                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {topCats.map(({ cat, count }) => (
                    <div key={cat!.id}>
                      <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{cat!.name}</span>
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

            {/* Actionable nudge */}
            {uncategorized > 0 && (
              <div className="card" style={{ borderColor: 'var(--border-2)' }}>
                <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
                  {uncategorized} shopping {uncategorized === 1 ? 'item has' : 'items have'} no category
                </p>
                <p className="text-sm" style={{ color: 'var(--text-2)' }}>
                  Categorizing items improves the breakdown above and powers future insights.
                </p>
              </div>
            )}

            <p className="text-xs" style={{ color: 'var(--text-3)', textAlign: 'center', padding: '4px 0 8px' }}>
              Savings, predictions and the shopping coach arrive with shopping history.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
