import { Plus } from 'lucide-react'
import type { ListType } from '../../types'

export interface Starter { label: string; name: string; type: ListType; emoji: string }

// Compact first-run starter shortcuts. Each opens the Create List sheet
// prefilled (name + type + icon), all still editable before creating.
const STARTERS: Starter[] = [
  { label: 'Shopping',       name: 'Shopping',         type: 'shopping', emoji: '🛒' },
  { label: 'Travel',         name: 'Travel Checklist', type: 'personal', emoji: '✈️' },
  { label: 'Personal Tasks', name: 'Personal Tasks',   type: 'tasks',    emoji: '✅' },
]

// Minimal Listo-style empty-list mark: a stacked checklist with one green
// check (Create → Organize → Complete). Decorative — kept quieter than the
// heading (spec §3). Colour/size come from the .empty-illustration class.
function EmptyListsIcon() {
  return (
    <svg width="68" height="68" viewBox="0 0 60 60" fill="none" aria-hidden="true" focusable="false" className="empty-illustration">
      <rect x="14" y="9" width="32" height="42" rx="9" fill="none" stroke="currentColor" strokeWidth="2.4" opacity="0.45" />
      {/* row 1 — completed, green accent */}
      <rect x="20" y="17" width="8" height="8" rx="2.6" fill="var(--accent)" />
      <path d="M22 21l1.7 1.7 3-3.2" stroke="#04120a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="31" y="19.4" width="10" height="2.6" rx="1.3" fill="currentColor" opacity="0.5" />
      {/* row 2 */}
      <rect x="20" y="29" width="8" height="8" rx="2.6" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.5" />
      <rect x="31" y="31.4" width="10" height="2.6" rx="1.3" fill="currentColor" opacity="0.4" />
      {/* row 3 — shorter */}
      <rect x="20" y="41" width="8" height="8" rx="2.6" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.35" />
      <rect x="31" y="43.4" width="6.5" height="2.6" rx="1.3" fill="currentColor" opacity="0.3" />
    </svg>
  )
}

interface EmptyListsProps {
  isGuest: boolean
  onCreateBlank: () => void
  onBrowseTemplates: () => void
  onStarter: (starter: Starter) => void
  onCreateAccount: () => void
}

// First-run full-screen empty state (spec §2/§16): guests learn how lists
// arrive; members get create/template CTAs plus starter shortcuts.
export default function EmptyLists({ isGuest, onCreateBlank, onBrowseTemplates, onStarter, onCreateAccount }: EmptyListsProps) {
  return (
    <div className="empty-state empty-state--full">
      <EmptyListsIcon />
      {isGuest ? (
        <>
          <h3>No shared lists yet</h3>
          <p>Lists people invite you to will appear here. Create a free account to make your own.</p>
          <button className="btn btn-primary mt-4" onClick={onCreateAccount}>Create Account</button>
        </>
      ) : (
        <>
          <h3>No lists yet</h3>
          <p>Create your first list or explore a template.</p>
          <div className="empty-cta-row">
            <button className="btn btn-primary" onClick={onCreateBlank}>
              <Plus size={18} /> Create List
            </button>
            <button className="btn btn-secondary" onClick={onBrowseTemplates}>
              Browse Templates
            </button>
          </div>
          <div className="empty-starters">
            <span className="empty-starters-label">Start with</span>
            <div>
              {STARTERS.map(s => (
                <button key={s.label} className="starter-link" onClick={() => onStarter(s)}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
