import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'
import { Capacitor } from '@capacitor/core'
import { Browser } from '@capacitor/browser'
import { App } from '@capacitor/app'
import { supabase } from '../lib/supabase'
import { useListsStore } from './useListsStore'
import { useSyncStore } from './useSyncStore'
import { useCategoriesStore } from './useCategoriesStore'
import { useMemoryStore } from './useMemoryStore'

interface AuthState {
  session: Session | null
  user: User | null
  displayName: string
  isGuest: boolean
  loading: boolean
  init: () => Promise<void>
  signUp: (email: string, password: string, name: string) => Promise<{ error: string | null; needsConfirmation: boolean }>
  signIn: (email: string, password: string) => Promise<string | null>
  signInWithProvider: (provider: 'google' | 'apple', redirectTo?: string) => Promise<string | null>
  forgotPassword: (email: string) => Promise<string | null>
  changePassword: (newPassword: string) => Promise<string | null>
  signInAsGuest: (displayName: string) => Promise<string | null>
  signOut: () => Promise<void>
  setDisplayName: (name: string) => void
}

// Custom URL scheme the native apps register (iOS Info.plist / Android
// intent-filter). OAuth returns here as listo://auth/callback#access_token=…
const NATIVE_REDIRECT = 'listo://auth/callback'

let nativeDeepLinkBound = false

// On native, OAuth runs in an in-app browser and returns via the listo://
// deep link with the session tokens in the URL fragment (implicit flow — the
// web client stays on implicit so cross-device reset/confirm links keep
// working). Parse them out and hand them to setSession.
function bindNativeDeepLink() {
  if (nativeDeepLinkBound || !Capacitor.isNativePlatform()) return
  nativeDeepLinkBound = true
  App.addListener('appUrlOpen', async ({ url }) => {
    if (!url.startsWith(NATIVE_REDIRECT)) return
    // The in-app browser has served its purpose — dismiss it.
    await Browser.close().catch(() => { /* already closed */ })
    const fragment = url.split('#')[1]
    if (!fragment) return
    const params = new URLSearchParams(fragment)
    const access_token = params.get('access_token')
    const refresh_token = params.get('refresh_token')
    if (access_token && refresh_token) {
      // Populates the session; onAuthStateChange then updates the store.
      await supabase.auth.setSession({ access_token, refresh_token })
    }
  })
}

export const useAuthStore = create<AuthState>(set => ({
  session: null,
  user: null,
  displayName: '',
  isGuest: false,
  loading: true,

  init: async () => {
    bindNativeDeepLink()
    const { data: { session } } = await supabase.auth.getSession()
    const isGuest = session?.user?.is_anonymous ?? false
    const storedName = localStorage.getItem('listo-display-name') ?? ''
    set({
      session,
      user: session?.user ?? null,
      isGuest,
      displayName: isGuest ? storedName : (session?.user?.user_metadata?.name ?? ''),
      loading: false,
    })

    supabase.auth.onAuthStateChange((_event, session) => {
      const isGuest = session?.user?.is_anonymous ?? false
      const storedName = localStorage.getItem('listo-display-name') ?? ''
      set({
        session,
        user: session?.user ?? null,
        isGuest,
        displayName: isGuest ? storedName : (session?.user?.user_metadata?.name ?? ''),
      })
    })
  },

  signUp: async (email, password, name) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    })
    if (error) return { error: error.message, needsConfirmation: false }
    // With "Confirm email" enabled, Supabase returns a user but no session —
    // the account exists but can't sign in until the email link is clicked.
    return { error: null, needsConfirmation: !data.session }
  },

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error?.message ?? null
  },

  signInWithProvider: async (provider, redirectTo) => {
    // Native (iOS/Android): open the provider page in an in-app browser and
    // return through the listo:// deep link — a full-page web redirect can't
    // come back into the app. skipBrowserRedirect gives us the URL to open.
    if (Capacitor.isNativePlatform()) {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: NATIVE_REDIRECT, skipBrowserRedirect: true },
      })
      if (error) return error.message
      if (data?.url) await Browser.open({ url: data.url, presentationStyle: 'popover' })
      return null
    }
    // Web redirect flow: on success the browser leaves the page and returns to
    // redirectTo (default origin) with a session; only config errors surface
    // here. The invite flow passes /join/:code so the join resumes after auth.
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: redirectTo ?? window.location.origin },
    })
    return error?.message ?? null
  },

  forgotPassword: async (email) => {
    // Sends a recovery email; the link lands on /reset-password with a
    // recovery session, where changePassword() sets the new one.
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/reset-password',
    })
    return error?.message ?? null
  },

  changePassword: async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    return error?.message ?? null
  },

  signInAsGuest: async (displayName) => {
    const { error } = await supabase.auth.signInAnonymously()
    if (error) return error.message
    localStorage.setItem('listo-display-name', displayName)
    set({ displayName, isGuest: true })
    return null
  },

  signOut: async () => {
    localStorage.removeItem('listo-display-name')
    // Wipe the offline cache + queued writes so the next account never sees
    // (or replays) this one's data.
    useListsStore.setState({ lists: [], items: {}, members: {}, userId: '', displayName: '', initialized: false })
    useListsStore.persist.clearStorage()
    useSyncStore.getState().clear()
    useSyncStore.persist.clearStorage()
    // Custom categories and list-memory are per-user — reset so the next
    // account starts clean.
    useCategoriesStore.getState().reset()
    useMemoryStore.getState().reset()
    await supabase.auth.signOut()
    set({ session: null, user: null, displayName: '', isGuest: false })
  },

  setDisplayName: (name) => {
    localStorage.setItem('listo-display-name', name)
    set({ displayName: name })
  },
}))
