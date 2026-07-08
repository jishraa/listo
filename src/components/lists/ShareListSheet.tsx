import { useEffect, useRef, useState } from 'react'
import { Check, Copy, Eye, MessageCircle, MoreHorizontal, Pencil, RefreshCw, Shuffle } from 'lucide-react'
import Sheet from '../ui/Sheet'
import { useListsStore } from '../../store/useListsStore'
import type { List, ListMember } from '../../types'

const REVEAL = 80

// Invite message drafts — the shuffle button cycles through these.
const MESSAGE_DRAFTS: ((name: string) => string)[] = [
  n => `🛒 Hey! Join my "${n}" list on Listo — we can add and tick off items together:`,
  n => `📝 I'm organizing "${n}" on Listo. Hop in so we stay in sync:`,
  n => `Let's plan "${n}" together! One tap to join on Listo:`,
  n => `You're invited to "${n}" on Listo — everything updates live:`,
]

function WhatsAppIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
  )
}

const ROLE_LABEL: Record<ListMember['role'], string> = {
  owner: 'Owner',
  collaborator: 'Can edit',
  viewer: 'View only',
}

function MemberRow({
  member, listId, isCurrentUser, canRemove, canManageRole,
}: {
  member: ListMember
  listId: string
  isCurrentUser: boolean
  canRemove: boolean
  canManageRole: boolean
}) {
  const removeMember   = useListsStore(s => s.removeMember)
  const setMemberRole  = useListsStore(s => s.setMemberRole)
  const [offset, setOffset]     = useState(0)
  const startXRef = useRef<number | null>(null)
  const [dragging, setDragging] = useState(false)
  const [removing, setRemoving] = useState(false)

  function onTouchStart(e: React.TouchEvent) {
    if (!canRemove) return
    startXRef.current = e.touches[0].clientX
    setDragging(true)
  }
  function onTouchMove(e: React.TouchEvent) {
    if (startXRef.current === null) return
    const dx = e.touches[0].clientX - startXRef.current
    if (dx > 0) { setOffset(0); return }
    setOffset(Math.max(dx, -REVEAL))
  }
  function onTouchEnd() {
    startXRef.current = null
    setDragging(false)
    setOffset(prev => Math.abs(prev) > REVEAL / 2 ? -REVEAL : 0)
  }

  async function handleRemove() {
    setRemoving(true)
    await removeMember(listId, member.id)
  }

  const avatarHue = (member.display_name.charCodeAt(0) * 47) % 360

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      {canRemove && (
        <div style={{
          position: 'absolute', right: 0, top: 0, bottom: 0, width: REVEAL,
          background: '#EF4444',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <button
            onClick={handleRemove}
            disabled={removing}
            style={{
              width: '100%', height: '100%', border: 'none', background: 'transparent',
              cursor: removing ? 'not-allowed' : 'pointer',
              fontSize: 13, fontWeight: 700, color: '#fff',
            }}
          >
            {removing ? '…' : 'Remove'}
          </button>
        </div>
      )}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={() => { if (offset < 0) setOffset(0) }}
        style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px',
          background: 'var(--bg-card)',
          transform: `translateX(${offset}px)`,
          transition: dragging ? 'none' : 'transform 0.2s var(--ease)',
        }}
      >
        <div style={{
          width: 38, height: 38, borderRadius: 99, flexShrink: 0,
          background: `hsl(${avatarHue}deg, 45%, 38%)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>
            {member.display_name.charAt(0).toUpperCase()}
          </span>
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>
            {member.display_name}{isCurrentUser ? ' (you)' : ''}
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>
            {ROLE_LABEL[member.role]}
          </p>
        </div>
        {member.role === 'owner' ? (
          <span style={{
            fontSize: 11, fontWeight: 700, color: 'var(--accent)',
            background: 'var(--accent-dim)', padding: '3px 10px', borderRadius: 99,
          }}>
            Owner
          </span>
        ) : canManageRole ? (
          <button
            onClick={() => setMemberRole(listId, member.id, member.role === 'viewer' ? 'collaborator' : 'viewer')}
            aria-label={member.role === 'viewer' ? 'Give edit access' : 'Make view only'}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
              fontSize: 11.5, fontWeight: 700, color: 'var(--text-2)',
              background: 'var(--bg-input)', border: '1px solid var(--border)',
              padding: '5px 10px', borderRadius: 99, cursor: 'pointer',
            }}
          >
            {member.role === 'viewer' ? <Eye size={13} /> : <Pencil size={13} />}
            {member.role === 'viewer' ? 'View only' : 'Can edit'}
          </button>
        ) : null}
      </div>
    </div>
  )
}

interface Props {
  list: List
  members: ListMember[]
  onClose: () => void
}

export default function ShareListSheet({ list, members, onClose }: Props) {
  const store = useListsStore()
  const isOwner = list.owner_id === store.userId
  const [currentCode, setCurrentCode] = useState('')
  const [generating, setGenerating]   = useState(true)
  const [copied, setCopied]           = useState(false)
  const [draftIdx, setDraftIdx]       = useState(() => Math.floor(Math.random() * MESSAGE_DRAFTS.length))
  // The access level this link grants. The invite secret is never sent to
  // non-owners, so it's read/minted lazily here, owner-only.
  const [access, setAccess] = useState<'collaborator' | 'viewer'>('collaborator')
  const [seeded, setSeeded] = useState(false)
  // True once an existing link has been invalidated (access switch or an
  // explicit reset) — drives the "older links no longer work" notice.
  const [rotated, setRotated] = useState(false)
  // StrictMode double-invoke guard: mint once per distinct access level so the
  // DB, currentCode, and the visible level always agree.
  const lastGenAccess = useRef<string | null>(null)

  // Reuse the list's existing invite (opening the sheet must never silently
  // invalidate links already shared). Mint only when none exists yet.
  useEffect(() => {
    if (!isOwner) { setGenerating(false); return }
    let cancelled = false
    store.getInvite(list.id)
      .then(inv => {
        if (cancelled) return
        if (inv) {
          setAccess(inv.role)
          setCurrentCode(inv.code)
          lastGenAccess.current = inv.role
          setGenerating(false)
        }
        setSeeded(true)
      })
      .catch(() => { if (!cancelled) setSeeded(true) })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Mint when there's no link yet; rotate when the owner changes the access
  // level (a deliberate act — the old level must stop working).
  useEffect(() => {
    if (!isOwner || !seeded) return
    if (lastGenAccess.current === access) return
    const isRotation = lastGenAccess.current !== null
    lastGenAccess.current = access
    setGenerating(true)
    store.regenerateInvite(list.id, access).then(newCode => {
      if (newCode) { setCurrentCode(newCode); if (isRotation) setRotated(true) }
      setGenerating(false)
    }).catch(() => setGenerating(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [access, seeded, isOwner])

  // Explicit reset: invalidate the current link and mint a fresh one.
  const resetLink = () => {
    if (generating || !isOwner) return
    setGenerating(true)
    store.regenerateInvite(list.id, access).then(newCode => {
      if (newCode) { setCurrentCode(newCode); setRotated(true) }
      setGenerating(false)
    }).catch(() => setGenerating(false))
  }

  const joinUrl   = currentCode ? `${window.location.origin}/join/${currentCode}` : ''
  const shareUrl  = joinUrl
  const message   = MESSAGE_DRAFTS[draftIdx](list.name)
  const shareText = `${message} ${shareUrl}`
  const disabled  = generating || !joinUrl

  function handleCopy() {
    if (disabled) return
    navigator.clipboard.writeText(shareText).catch(() => {})
    navigator.vibrate?.(12)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const btnBase: React.CSSProperties = {
    width: 64, height: 64, borderRadius: 18, border: 'none',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.45 : 1,
    transition: 'opacity 0.14s var(--ease)',
  }

  return (
    <Sheet open onClose={onClose} title="Share list">
      <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', paddingBottom: 24 }}>
        <p style={{ fontSize: 13.5, color: 'var(--text-2)', margin: '12px 20px 14px' }}>
          {generating
            ? 'Preparing your invite link…'
            : rotated
              ? 'A fresh link was generated — older links no longer work.'
              : 'Anyone with this link can join the list.'}
        </p>

        {/* Access level — owners choose what the link grants. Switching mints a
            fresh link at the new level. */}
        {isOwner && (
          <div style={{ margin: '0 20px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 8px' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.06em', textTransform: 'uppercase', margin: 0 }}>
                Anyone with the link
              </p>
              {/* Deliberate invalidation lives here — nowhere else rotates the link */}
              <button
                onClick={resetLink}
                disabled={generating}
                aria-label="Generate a new link — older links stop working"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '10px 4px', margin: '-10px -4px',
                  background: 'none', border: 'none', cursor: generating ? 'default' : 'pointer',
                  fontSize: 12, fontWeight: 600, color: 'var(--text-2)',
                  opacity: generating ? 0.5 : 1,
                }}
              >
                <RefreshCw size={12} strokeWidth={2.2} /> Reset link
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {([
                { key: 'collaborator' as const, icon: <Pencil size={15} />, label: 'Can edit', hint: 'Add & tick off items' },
                { key: 'viewer' as const,       icon: <Eye size={15} />,    label: 'View only', hint: 'See the list, no changes' },
              ]).map(opt => {
                const on = access === opt.key
                return (
                  <button
                    key={opt.key}
                    onClick={() => { if (!generating) setAccess(opt.key) }}
                    disabled={generating}
                    style={{
                      flex: 1, textAlign: 'left', padding: '11px 13px', borderRadius: 13, cursor: generating ? 'default' : 'pointer',
                      background: on ? 'var(--accent-dim)' : 'var(--bg-input)',
                      border: `1px solid ${on ? 'var(--accent-mid)' : 'var(--border)'}`,
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 7, color: on ? 'var(--accent)' : 'var(--text)', fontWeight: 700, fontSize: 13.5 }}>
                      {opt.icon}{opt.label}
                    </span>
                    <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-3)', marginTop: 3 }}>{opt.hint}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Message draft — shuffle cycles the wording; all share actions use it */}
        <div style={{
          margin: '0 20px 18px', padding: '12px 14px', borderRadius: 14,
          background: 'var(--bg-input)', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'flex-start', gap: 10,
        }}>
          <p style={{ flex: 1, fontSize: 13.5, lineHeight: 1.5, color: 'var(--text)', margin: 0, wordBreak: 'break-word' }}>
            {message}{' '}
            {/* The raw URL is never shown (spec §5.1/§5.3) — it's still attached
                to every share/copy action below, just not exposed as text. */}
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, verticalAlign: 'middle',
              color: 'var(--accent)', fontWeight: 600, fontSize: 12.5,
              background: 'var(--accent-dim)', padding: '1px 8px', borderRadius: 99,
            }}>
              🔗 {generating ? 'preparing link…' : 'invite link'}
            </span>
          </p>
          <button
            onClick={() => setDraftIdx(i => (i + 1) % MESSAGE_DRAFTS.length)}
            aria-label="Try another message"
            style={{
              flexShrink: 0, width: 38, height: 38, borderRadius: 11,
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--text-2)',
            }}
          >
            <Shuffle size={14} strokeWidth={2.2} />
          </button>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 18, padding: '0 20px 22px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <button
              disabled={disabled}
              aria-label="Share via WhatsApp"
              onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank')}
              style={{ ...btnBase, background: 'rgba(37,211,102,0.16)', border: '1px solid rgba(37,211,102,0.28)', color: '#25D366' }}
            >
              <WhatsAppIcon size={24} />
            </button>
            <span style={{ fontSize: 12, color: 'var(--text-2)' }}>WhatsApp</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <button
              disabled={disabled}
              aria-label="Share via Messages"
              // Custom-scheme links must navigate — window.open is unreliable
              // for sms: in standalone PWAs (same as the upi:// handling).
              onClick={() => { window.location.href = `sms:?body=${encodeURIComponent(shareText)}` }}
              style={{ ...btnBase, background: 'var(--bg-input)', color: 'var(--text)' }}
            >
              <MessageCircle size={22} strokeWidth={2} />
            </button>
            <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Messages</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <button
              disabled={disabled}
              aria-label="Copy invite link"
              onClick={handleCopy}
              style={{
                ...btnBase,
                background: copied ? 'var(--accent-dim)' : 'var(--bg-input)',
                border: copied ? '1px solid var(--accent-mid)' : 'none',
                color: copied ? 'var(--accent)' : 'var(--text)',
              }}
            >
              {copied ? <Check size={22} strokeWidth={2.5} /> : <Copy size={22} strokeWidth={2} />}
            </button>
            <span style={{ fontSize: 12, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
              {copied ? 'Copied' : 'Copy'}
            </span>
          </div>

          {'share' in navigator && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <button
                disabled={disabled}
                aria-label="More sharing options"
                onClick={() => { if (!disabled) navigator.share({ title: `Join "${list.name}" on Listo`, text: message, url: shareUrl }).catch(() => {}) }}
                style={{ ...btnBase, background: 'var(--bg-input)', color: 'var(--text)' }}
              >
                <MoreHorizontal size={22} strokeWidth={2} />
              </button>
              <span style={{ fontSize: 12, color: 'var(--text-2)' }}>More</span>
            </div>
          )}
        </div>

        <div style={{ height: 1, background: 'var(--border)', margin: '0 20px 18px' }} />

        {/* Members */}
        {members.length > 0 && (
          <>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 20px 8px' }}>
              Members · {members.length}
            </p>
            {members.map(m => (
              <MemberRow
                key={m.id}
                member={m}
                listId={list.id}
                isCurrentUser={m.user_id === store.userId}
                canRemove={isOwner && m.role !== 'owner'}
                canManageRole={isOwner && m.role !== 'owner'}
              />
            ))}
          </>
        )}
      </div>
    </Sheet>
  )
}
