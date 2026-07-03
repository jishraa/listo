# Authentication & Session Management

Version: 1.0 (adapted to the Supabase stack — see [Technology Stack](#technology-stack))

## Goal

Provide a secure, seamless, and persistent login experience where users rarely need to sign in again.

Users should feel like they are using apps such as WhatsApp, Google Keep, Google Photos, or Notion: once logged in, the session remains active until the user explicitly logs out or the account requires re-authentication.

---

## Authentication Methods

Support multiple login providers.

**Current:** Email + Password · Guest (Supabase anonymous sign-in)

**Recommended additions:**

- Google Sign In (`signInWithOAuth({ provider: 'google' })`)
- Apple Sign In (iOS — requires native flow via Capacitor plugin)
- Email + OTP (`signInWithOtp` — built into Supabase)

**Future:** Microsoft · Facebook · Passkeys

---

## Session Flow

```
Launch App
↓
Check Login Session
↓
Valid Session? ── NO → Navigate to Login
↓ YES
Refresh Token
↓
Load User Data
↓
Navigate to Home
```

`supabase-js` handles session restore and token refresh automatically on client creation; the app's `useAuthStore.init()` + `AuthGuard` implement the navigate-to-login branch.

---

## Login Flow

```
User Login
↓
Authentication Success
↓
Access Token + Refresh Token generated (Supabase)
↓
Stored by the client
↓
Navigate to Home
```

---

## Token Strategy

**Access token (JWT)** — API authentication. Lifetime ~1 hour (Supabase default; configurable in dashboard → Auth settings; the spec's target is 15–30 min). Automatically refreshed by `supabase-js`.

**Refresh token** — generates new access tokens. Long-lived, single-use with rotation (Supabase issues a new refresh token on each refresh). Users should never notice this process.

---

## Secure Storage

**Web / PWA (current):** `supabase-js` default — localStorage. The spec prefers HttpOnly cookies; that requires a server-rendered setup, so for this SPA the accepted trade-off is localStorage + strict XSS hygiene.

**Native (Capacitor) — planned:** provide a custom storage adapter to the Supabase client backed by:

- iOS — Keychain
- Android — Encrypted SharedPreferences

(e.g. `@capacitor/preferences` with encryption, or a dedicated secure-storage plugin.)

---

## App Launch Flow

```
Splash Screen
↓
Read Stored Session
↓
Access Token Expired? ── YES → Refresh Token
↓                              ↓ success      ↓ failed
Continue                       Continue       Login Screen
```

Target loading time: **< 500 ms**.

---

## Session Persistence

Users remain signed in until:

- Logout
- Refresh token expires or is revoked
- Password changes
- Account disabled
- Security risk detected

**Do not log users out due to inactivity.**

---

## Automatic Token Refresh

```
Every API Request
↓
Access Token Expired? ── YES → Refresh Token → Retry API
↓
Continue
```

Handled by `supabase-js` (`autoRefreshToken: true`, the default). No interruption to the user.

---

## Offline Support

Shopping often happens in locations with poor connectivity. Support offline access. **(Not yet implemented — the largest gap.)**

```
Open App
↓
No Internet
↓
Load Cached Lists
↓
Allow Editing
↓
Sync Automatically When Internet Returns
```

---

## Synchronization

When connection is restored:

```
Sync Local Changes → Download Server Updates → Resolve Conflicts → Refresh UI
```

Real-time synchronization for shared lists is **already live** via Supabase Realtime channels (`subscribeToList`): when Rajesh adds Milk, Anjana sees it immediately — no manual refresh.

---

## Logout Flow

```
Profile → Logout → supabase.auth.signOut() (revokes refresh token)
→ Delete Local Session → Navigate to Login
```

---

## Multi-Device Support

Login on multiple devices (Android, iPhone, tablet, web) — all synchronized. Supported by Supabase sessions out of the box.

---

## Device Management (planned)

Profile → Logged In Devices:

```
Pixel 9 · iPhone 16 · Chrome · MacBook
[ Sign Out Other Devices ]
```

Implement with `signOut({ scope: 'others' })`; session listing needs a lightweight `devices` table (or Supabase session APIs where available).

---

## Security

- Always HTTPS; encrypt all communication
- Every access token validated server-side (Supabase enforces JWT + RLS on every query)
- Refresh token rotation (Supabase default)
- Invalidate tokens on logout
- Server-side token revocation supported

---

## Biometric Authentication (Optional)

Support Face ID / Fingerprint / Touch ID **only for sensitive actions**:

- Changing password
- Viewing account settings
- Deleting account

Do not require biometrics for everyday shopping.

---

## Session Expiry

If the refresh token expires:

```
Session Expired
Please sign in again.
[ Login ]
```

Preserve unsynced local changes where possible.

---

## Error Handling

**No internet**

```
You're offline. Using local data.
Changes will sync automatically.
```

**Session expired**

```
Your session has expired. Please sign in again.
```

**Authentication failed**

```
Unable to verify your account. Try again.
```

---

## Technology Stack

> Adapted from the original spec, which recommended Firebase. Listo is built on **Supabase** (auth, Postgres + RLS, realtime, RPCs); migrating would mean rewriting the entire data layer for no capability gain. Supabase equivalents:

| Concern | Service |
|---|---|
| Authentication | Supabase Auth (email/password, anonymous guest, OAuth providers, OTP) |
| Database | Supabase Postgres + Row Level Security |
| Realtime sync | Supabase Realtime |
| Storage | Supabase Storage (when needed) |
| Notifications | TBD — e.g. FCM via a push service, or OneSignal |
| Analytics / Crash reporting | TBD — e.g. PostHog / Sentry |

Supabase provides: persistent login sessions, automatic token refresh, Google/Apple/email auth, anonymous login, secure authentication, multi-device support — with minimal backend code.

---

## UX Principles

The authentication experience should be invisible. Users should:

- Login once
- Stay logged in
- Access lists instantly
- Continue working offline
- Sync automatically
- Never lose changes

---

## Success Criteria

- ✅ One-time login
- ✅ Automatic session refresh
- ✅ Secure token storage
- ✅ Offline access
- ✅ Real-time synchronization
- ✅ Seamless multi-device support
- ✅ Fast app startup

The authentication system should prioritize both **security** and **convenience**, ensuring users spend their time managing lists — not managing logins.

---

## Implementation Status & Priorities

| Item | Status |
|---|---|
| Persistent session + auto refresh | ✅ live (supabase-js) |
| Email/password + guest login | ✅ live |
| Real-time shared-list sync | ✅ live |
| Multi-device login | ✅ live |
| Logout with revocation | ✅ live |
| Google Sign In | 1 — next |
| Apple Sign In (native) | 2 |
| Email OTP | 3 |
| Offline cache + queued sync | 4 — largest effort |
| Secure native token storage | 5 |
| Device management page | 6 |
| Biometrics for sensitive actions | 7 |
