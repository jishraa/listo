import { Gift, Share2 } from 'lucide-react'
import { SubPage } from './common'

const REFERRAL_MESSAGE =
  "I'm using Listo to organize my shopping and daily lists. It's simple, collaborative, and helps save time. Try it:"

export default function InvitePage() {
  const handleInvite = async () => {
    // Send friends to the public marketing landing so they see what Listo is
    // before signing up.
    const url = `${window.location.origin}/about`
    if (navigator.share) {
      await navigator.share({ title: 'Listo', text: REFERRAL_MESSAGE, url }).catch(() => {})
    } else {
      await navigator.clipboard.writeText(`${REFERRAL_MESSAGE} ${url}`).catch(() => {})
    }
  }

  return (
    <SubPage title="Invite Friends">
      <div className="card referral-card" style={{
        textAlign: 'center', padding: '32px 24px',
        background: 'linear-gradient(160deg, rgba(22,163,74,0.14) 0%, var(--bg-card) 70%)',
        borderColor: 'var(--border-2)',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: 18, margin: '0 auto 16px',
          background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Gift size={30} color="#fff" />
        </div>
        <p style={{ fontWeight: 800, fontSize: 20, letterSpacing: -0.3 }}>Planning is better together</p>
        <p className="text-sm" style={{ color: 'var(--text-2)', marginTop: 6, lineHeight: 1.5 }}>
          Share Listo with your family and friends.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '20px auto', maxWidth: 220, textAlign: 'left' }}>
          {['Shared lists', 'Real-time updates', 'Faster shopping'].map(b => (
            <span key={b} className="text-sm" style={{ color: 'var(--text-2)' }}>
              <span style={{ color: 'var(--accent)', fontWeight: 700 }}>✓</span>  {b}
            </span>
          ))}
        </div>

        <button className="btn btn-primary btn-full" onClick={handleInvite}>
          <Share2 size={16} /> Invite Friends
        </button>
      </div>

      <p className="text-xs" style={{ color: 'var(--text-3)', textAlign: 'center', padding: '0 16px' }}>
        Referral status and rewards are coming in a future update.
      </p>
    </SubPage>
  )
}
