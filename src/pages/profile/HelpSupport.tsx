import { useNavigate } from 'react-router-dom'
import { FileText, Heart, Info, MessageCircle, ScrollText } from 'lucide-react'
import { SubPage, Section, Row } from './common'

// Help & Support hub — feedback + support up top, About & Legal below.
const FEEDBACK_EMAIL = 'grk766@gmail.com'
const APP_VERSION = '1.3.0'

export default function HelpSupportPage() {
  const navigate = useNavigate()
  const sendFeedback = () => {
    window.location.href = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent('Listo feedback')}`
  }

  return (
    <SubPage title="Help & Support">
      <Section>
        <Row
          icon={<MessageCircle size={17} />}
          label="Send Feedback"
          subtitle="Report a bug or suggest a feature"
          onPress={sendFeedback}
        />
        <Row
          icon={<Heart size={17} />}
          label="Support Listo"
          subtitle="Help keep Listo growing"
          onPress={() => navigate('/profile/support')}
          last
        />
      </Section>

      <Section title="About & Legal">
        <Row
          icon={<Info size={17} />}
          label="About"
          subtitle={`Listo · v${APP_VERSION}`}
          onPress={() => navigate('/profile/about')}
        />
        <Row icon={<FileText size={17} />} label="Privacy Policy" onPress={() => navigate('/privacy')} />
        <Row icon={<ScrollText size={17} />} label="Terms & Conditions" onPress={() => navigate('/terms')} last />
      </Section>
    </SubPage>
  )
}
