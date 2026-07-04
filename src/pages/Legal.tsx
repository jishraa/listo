import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'

function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  const navigate = useNavigate()
  return (
    <div className="app-container">
      <div className="header">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)} aria-label="Go back">
          <ChevronLeft size={20} />
        </button>
        <span className="header-title">{title}</span>
      </div>
      <div className="page page-padded" style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 14, lineHeight: 1.65, color: 'var(--text-2)' }}>
        {children}
      </div>
    </div>
  )
}

export function Terms() {
  return (
    <LegalPage title="Terms of Service">
      <p style={{ color: 'var(--text-3)', fontSize: 12 }}>Last updated: July 2026</p>
      <p>Welcome to Listo. By creating an account or using the app, you agree to these terms.</p>
      <p><strong style={{ color: 'var(--text)' }}>Your account.</strong> You're responsible for keeping your credentials secure and for activity under your account.</p>
      <p><strong style={{ color: 'var(--text)' }}>Your content.</strong> Lists and items you create belong to you. Sharing a list grants members access to its contents until you remove them or delete the list.</p>
      <p><strong style={{ color: 'var(--text)' }}>Acceptable use.</strong> Don't use Listo to store unlawful content or to disrupt the service.</p>
      <p><strong style={{ color: 'var(--text)' }}>Availability.</strong> Listo is provided as-is; we work hard to keep it reliable but can't guarantee uninterrupted service.</p>
      <p><strong style={{ color: 'var(--text)' }}>Changes.</strong> We may update these terms; continued use after changes means you accept them.</p>
    </LegalPage>
  )
}

export function Privacy() {
  return (
    <LegalPage title="Privacy Policy">
      <p style={{ color: 'var(--text-3)', fontSize: 12 }}>Last updated: July 2026</p>
      <p>Your privacy matters. This is what Listo collects and why.</p>
      <p><strong style={{ color: 'var(--text)' }}>What we store.</strong> Your email, display name, and the lists/items you create — nothing more. Passwords are hashed and never visible to us.</p>
      <p><strong style={{ color: 'var(--text)' }}>How it's used.</strong> Solely to provide the app: syncing your lists across devices and sharing them with people you invite.</p>
      <p><strong style={{ color: 'var(--text)' }}>What we don't do.</strong> We don't sell your data, show ads, or share your information with third parties.</p>
      <p><strong style={{ color: 'var(--text)' }}>Where it lives.</strong> Data is stored with Supabase over encrypted connections (HTTPS).</p>
      <p><strong style={{ color: 'var(--text)' }}>Deleting your data.</strong> Deleting a list removes its items permanently. Contact us to delete your account entirely.</p>
    </LegalPage>
  )
}
