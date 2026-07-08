import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound, Link2, Mail, Trash2, User } from 'lucide-react'
import { useAuthStore } from '../../store/useAuthStore'
import Sheet from '../../components/ui/Sheet'
import ConfirmSheet from '../../components/ui/ConfirmSheet'
import { SubPage, Section, Row } from './common'

export default function AccountPage() {
  const { user, displayName, setDisplayName, isGuest, changePassword, signIn, deleteAccount } = useAuthStore()
  const navigate = useNavigate()

  const [sheet, setSheet] = useState<'name' | 'password' | 'delete' | null>(null)
  const [nameInput, setNameInput] = useState(displayName)
  const [curPw, setCurPw]         = useState('')
  const [newPw, setNewPw]         = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwBusy, setPwBusy] = useState(false)
  const [pwMsg, setPwMsg]   = useState<{ ok: boolean; text: string } | null>(null)
  const [delBusy, setDelBusy] = useState(false)
  const [delError, setDelError] = useState('')

  // Password management only applies to accounts with an email/password
  // identity — for OAuth-only accounts the "current password" check can never
  // pass, so the row would be a dead end.
  const hasEmailIdentity = (user?.identities ?? []).some(i => i.provider === 'email')

  const openPasswordSheet = () => {
    setCurPw(''); setNewPw(''); setConfirmPw(''); setPwMsg(null); setSheet('password')
  }

  const connectedProviders = [...new Set(
    (user?.identities ?? []).map(i => i.provider === 'email' ? 'Email' : i.provider.charAt(0).toUpperCase() + i.provider.slice(1))
  )].join(', ')

  const saveName = () => {
    const n = nameInput.trim()
    if (n && n !== displayName) setDisplayName(n)
    setSheet(null)
  }

  const handleChangePassword = async () => {
    if (pwBusy) return
    setPwMsg(null)
    if (!curPw) { setPwMsg({ ok: false, text: 'Enter your current password.' }); return }
    if (newPw.length < 8) { setPwMsg({ ok: false, text: 'New password must be at least 8 characters.' }); return }
    if (newPw !== confirmPw) { setPwMsg({ ok: false, text: "New passwords don't match." }); return }
    if (newPw === curPw) { setPwMsg({ ok: false, text: 'New password must differ from the current one.' }); return }

    setPwBusy(true)
    // Re-verify the current password before changing it (updateUser alone
    // wouldn't require it).
    const email = user?.email
    const verifyErr = email ? await signIn(email, curPw) : 'no-email'
    if (verifyErr) { setPwBusy(false); setPwMsg({ ok: false, text: 'Current password is incorrect.' }); return }

    const err = await changePassword(newPw)
    setPwBusy(false)
    if (err) {
      setPwMsg({ ok: false, text: err.toLowerCase().includes('different') ? 'New password must differ from the old one.' : 'Could not update password. Try again.' })
    } else {
      setPwMsg({ ok: true, text: 'Password updated.' })
      setCurPw(''); setNewPw(''); setConfirmPw('')
      setTimeout(() => { setSheet(null); setPwMsg(null) }, 1200)
    }
  }

  return (
    <SubPage title="Account">
      <Section>
        <Row icon={<User size={17} />} label="Display Name" value={displayName || '—'}
          onPress={() => { setNameInput(displayName); setSheet('name') }} last={isGuest} />
        {!isGuest && (
          <Row icon={<Mail size={17} />} label="Email" value={user?.email ?? '—'}
            last={!hasEmailIdentity && !connectedProviders} />
        )}
        {!isGuest && hasEmailIdentity && (
          <Row icon={<KeyRound size={17} />} label="Password" value="Change"
            onPress={openPasswordSheet} last={!connectedProviders} />
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

      {/* Account deletion — self-serve (App Store 5.1.1(v)); confirmed below */}
      {!isGuest && (
        <button
          onClick={() => { setDelError(''); setSheet('delete') }}
          className="btn btn-full"
          style={{
            justifyContent: 'center', gap: 10,
            background: 'rgba(239,68,68,0.08)', border: '1.5px solid rgba(239,68,68,0.35)',
            color: '#ef4444', fontWeight: 700,
          }}
        >
          <Trash2 size={17} /> Delete Account
        </button>
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
          <div className="input-group">
            <label className="input-label" htmlFor="cur-pw">Current Password</label>
            <input
              id="cur-pw"
              className="input"
              type="password"
              placeholder="Current password"
              value={curPw}
              autoComplete="current-password"
              onChange={e => setCurPw(e.target.value)}
              autoFocus
            />
          </div>
          <div className="input-group">
            <label className="input-label" htmlFor="new-pw">New Password</label>
            <input
              id="new-pw"
              className="input"
              type="password"
              placeholder="Minimum 8 characters"
              value={newPw}
              autoComplete="new-password"
              onChange={e => setNewPw(e.target.value)}
            />
          </div>
          <div className="input-group">
            <label className="input-label" htmlFor="confirm-pw">Confirm New Password</label>
            <input
              id="confirm-pw"
              className="input"
              type="password"
              placeholder="Re-enter new password"
              value={confirmPw}
              autoComplete="new-password"
              onChange={e => setConfirmPw(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleChangePassword()}
            />
          </div>
          {pwMsg && (
            <p className="text-sm" role="alert" style={{ color: pwMsg.ok ? 'var(--accent)' : '#f87171', fontWeight: 600 }}>
              {pwMsg.text}
            </p>
          )}
          <button
            className="btn btn-primary btn-full"
            onClick={handleChangePassword}
            disabled={!curPw || newPw.length < 8 || !confirmPw || pwBusy}
          >
            {pwBusy ? <span className="spinner" /> : 'Update Password'}
          </button>
        </div>
      </Sheet>
      <ConfirmSheet
        open={sheet === 'delete'}
        onClose={() => setSheet(null)}
        title="Delete your account?"
        confirmLabel="Delete Account"
        busy={delBusy}
        error={delError || null}
        onConfirm={async () => {
          setDelBusy(true); setDelError('')
          const err = await deleteAccount()
          if (err) {
            setDelBusy(false)
            setDelError("Couldn't delete your account. Please try again.")
            return
          }
          navigate('/login', { replace: true })
        }}
      >
        This permanently deletes your account, every list you own, and your
        memberships in shared lists. This can't be undone.
      </ConfirmSheet>
    </SubPage>
  )
}
