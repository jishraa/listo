import { useState } from 'react'
import { KeyRound, Link2, Mail, User } from 'lucide-react'
import { useAuthStore } from '../../store/useAuthStore'
import Sheet from '../../components/ui/Sheet'
import { SubPage, Section, Row } from './common'

export default function AccountPage() {
  const { user, displayName, setDisplayName, isGuest, changePassword } = useAuthStore()

  const [sheet, setSheet] = useState<'name' | 'password' | null>(null)
  const [nameInput, setNameInput] = useState(displayName)
  const [pw, setPw]         = useState('')
  const [pwBusy, setPwBusy] = useState(false)
  const [pwMsg, setPwMsg]   = useState<{ ok: boolean; text: string } | null>(null)

  const connectedProviders = [...new Set(
    (user?.identities ?? []).map(i => i.provider === 'email' ? 'Email' : i.provider.charAt(0).toUpperCase() + i.provider.slice(1))
  )].join(', ')

  const saveName = () => {
    const n = nameInput.trim()
    if (n && n !== displayName) setDisplayName(n)
    setSheet(null)
  }

  const handleChangePassword = async () => {
    if (pw.length < 8 || pwBusy) return
    setPwBusy(true)
    setPwMsg(null)
    const err = await changePassword(pw)
    setPwBusy(false)
    if (err) {
      setPwMsg({ ok: false, text: err.toLowerCase().includes('different') ? 'New password must differ from the old one.' : 'Could not update password. Try again.' })
    } else {
      setPwMsg({ ok: true, text: 'Password updated.' })
      setPw('')
      setTimeout(() => { setSheet(null); setPwMsg(null) }, 1200)
    }
  }

  return (
    <SubPage title="Account">
      <Section>
        <Row icon={<User size={17} />} label="Display Name" value={displayName || '—'}
          onPress={() => { setNameInput(displayName); setSheet('name') }} last={isGuest} />
        {!isGuest && <Row icon={<Mail size={17} />} label="Email" value={user?.email ?? '—'} />}
        {!isGuest && (
          <Row icon={<KeyRound size={17} />} label="Password" value="Change"
            onPress={() => { setPw(''); setPwMsg(null); setSheet('password') }} last={!connectedProviders} />
        )}
        {!isGuest && connectedProviders && (
          <Row icon={<Link2 size={17} />} label="Connected Accounts" value={connectedProviders} last />
        )}
      </Section>

      {isGuest && (
        <p className="text-sm text-muted" style={{ padding: '0 4px' }}>
          You're using a guest session — create an account from the Profile screen to manage email and password.
        </p>
      )}

      <Sheet open={sheet === 'name'} onClose={() => setSheet(null)} title="Display Name">
        <div className="sheet-body">
          <input
            className="input"
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') saveName() }}
            maxLength={50}
            autoFocus
          />
          <div className="flex gap-2">
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setSheet(null)}>Cancel</button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveName} disabled={!nameInput.trim()}>Save</button>
          </div>
        </div>
      </Sheet>

      <Sheet open={sheet === 'password'} onClose={() => setSheet(null)} title="Change Password">
        <div className="sheet-body">
          <p className="text-sm text-muted">Minimum 8 characters.</p>
          <input
            className="input"
            type="password"
            placeholder="New password"
            value={pw}
            autoComplete="new-password"
            onChange={e => setPw(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleChangePassword()}
            autoFocus
          />
          {pwMsg && (
            <p className="text-sm" style={{ color: pwMsg.ok ? 'var(--accent)' : '#f87171', fontWeight: 600 }}>
              {pwMsg.text}
            </p>
          )}
          <button className="btn btn-primary btn-full" onClick={handleChangePassword} disabled={pw.length < 8 || pwBusy}>
            {pwBusy ? <span className="spinner" /> : 'Update Password'}
          </button>
        </div>
      </Sheet>
    </SubPage>
  )
}
