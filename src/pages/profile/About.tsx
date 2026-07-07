import { useNavigate } from 'react-router-dom'
import { FileText, Info, Shield } from 'lucide-react'
import { SubPage, Section, Row } from './common'
import { APP_VERSION } from '../../lib/version'

export default function AboutPage() {
  const navigate = useNavigate()
  return (
    <SubPage title="About">
      <div style={{ textAlign: 'center', padding: '10px 0 4px' }}>
        <img
          src="/brand.png"
          alt="Listo"
          style={{ width: 84, height: 84, borderRadius: 20, boxShadow: '0 6px 22px rgba(22,163,74,0.25)' }}
        />
        <p style={{ fontWeight: 800, fontSize: 18, marginTop: 12, letterSpacing: -0.3 }}>Listo</p>
        <p className="text-sm" style={{ color: 'var(--text-3)', marginTop: 2 }}>Smart lists for everyday life</p>
        <p className="text-sm" style={{ color: 'var(--text-2)', marginTop: 12, lineHeight: 1.55, maxWidth: 300, marginInline: 'auto' }}>
          Listo makes planning and shopping simpler. Create collaborative to-do and
          shopping lists, check items off in real time, and stay in sync with family
          and friends — wherever you are.
        </p>
      </div>
      <Section>
        <Row icon={<Info size={17} />} label="Version" value={APP_VERSION} />
        <Row icon={<Shield size={17} />} label="Privacy Policy" onPress={() => navigate('/privacy')} />
        <Row icon={<FileText size={17} />} label="Terms of Service" onPress={() => navigate('/terms')} last />
      </Section>
      <p className="text-sm" style={{ color: 'var(--text-3)', textAlign: 'center' }}>
        Thank you for using Listo! 💚
      </p>
    </SubPage>
  )
}
