import { useNavigate } from 'react-router-dom'
import { FileText, Info, MessageSquare, Shield } from 'lucide-react'
import { SubPage, Section, Row } from './common'

export default function AboutPage() {
  const navigate = useNavigate()
  return (
    <SubPage title="About">
      <Section>
        <Row icon={<Info size={17} />} label="Version" value="1.0.0" />
        <Row icon={<Shield size={17} />} label="Privacy Policy" onPress={() => navigate('/privacy')} />
        <Row icon={<FileText size={17} />} label="Terms of Service" onPress={() => navigate('/terms')} />
        <Row icon={<MessageSquare size={17} />} label="Send Feedback"
          onPress={() => { window.location.href = 'mailto:grk766@gmail.com?subject=Listo%20Feedback' }} last />
      </Section>
      <p className="text-sm" style={{ color: 'var(--text-3)', textAlign: 'center' }}>
        Thank you for using Listo! 💚
      </p>
    </SubPage>
  )
}
