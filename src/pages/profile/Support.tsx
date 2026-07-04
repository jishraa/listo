import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart, Star, Gift, MessageCircle } from 'lucide-react'
import { SubPage, Section, Row } from './common'

// Fill these when the real channels exist. Empty SUPPORT_URL shows a gentle
// "coming soon" note rather than a dead link — support is always optional and
// never pressured (spec UX rules).
const SUPPORT_URL = ''
const FEEDBACK_EMAIL = 'hello@listo.app'

export default function SupportPage() {
  const navigate = useNavigate()
  const [note, setNote] = useState<string | null>(null)

  const handleSupport = () => {
    if (SUPPORT_URL) window.open(SUPPORT_URL, '_blank', 'noopener,noreferrer')
    else setNote('Support options are coming soon — thank you for the love! 💚')
  }
  const mailTo = (subject: string) => {
    window.location.href = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}`
  }

  return (
    <SubPage title="Support Listo">
      {/* Hero */}
      <div className="card" style={{
        textAlign: 'center', padding: '30px 24px',
        background: 'linear-gradient(160deg, rgba(22,163,74,0.14) 0%, var(--bg-card) 70%)',
        borderColor: 'var(--border-2)',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: 18, margin: '0 auto 16px',
          background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Heart size={30} color="#fff" fill="#fff" />
        </div>
        <p style={{ fontWeight: 800, fontSize: 20, letterSpacing: -0.3 }}>Help Listo Grow</p>
        <p className="text-sm" style={{ color: 'var(--text-2)', marginTop: 8, lineHeight: 1.55 }}>
          Enjoying Listo? Your support helps us keep improving the app and building useful new features.
        </p>
        <button className="btn btn-primary btn-full" style={{ marginTop: 20, height: 52 }} onClick={handleSupport}>
          <Heart size={16} fill="#fff" /> Support Development
        </button>
        {note && <p className="text-sm" style={{ color: 'var(--accent)', marginTop: 12, fontWeight: 600 }}>{note}</p>}
      </div>

      {/* Other ways to help — inclusive of non-financial support */}
      <Section title="Other ways to help">
        <Row icon={<Star size={17} />} label="Rate Listo" onPress={() => mailTo('I love Listo ⭐')} />
        <Row icon={<Gift size={17} />} label="Invite Friends" onPress={() => navigate('/profile/invite')} />
        <Row icon={<MessageCircle size={17} />} label="Send Feedback" onPress={() => mailTo('Listo feedback')} last />
      </Section>

      <p className="text-xs" style={{ color: 'var(--text-3)', textAlign: 'center', padding: '0 16px' }}>
        Supporting Listo is always optional. Thank you for being here. 💚
      </p>
    </SubPage>
  )
}
