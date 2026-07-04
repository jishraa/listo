import { useNavigate } from 'react-router-dom'
import { Heart, Star, Gift, MessageCircle } from 'lucide-react'
import { SubPage, Section, Row } from './common'

// India-friendly support via UPI (no signup). The deep link opens the user's
// UPI app on mobile with the amount left for them to enter; the VPA is also
// shown so desktop / manual payers can send directly. Support is optional.
const UPI_VPA = 'grk766@okicici'
const SUPPORT_URL = `upi://pay?pa=${encodeURIComponent(UPI_VPA)}&pn=${encodeURIComponent('Listo')}&cu=INR`
const FEEDBACK_EMAIL = 'grk766@gmail.com'

export default function SupportPage() {
  const navigate = useNavigate()

  // Custom-scheme deep links must navigate (window.open is blocked for upi://).
  const handleSupport = () => { window.location.href = SUPPORT_URL }
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
        <p className="text-xs" style={{ color: 'var(--text-3)', marginTop: 12 }}>
          Opens your UPI app · or pay to <span style={{ color: 'var(--text-2)', fontWeight: 600 }}>{UPI_VPA}</span>
        </p>
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
