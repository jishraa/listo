import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthState {
  session: Session | null
  user: User | null
  displayName: string
  isGuest: boolean
  loading: boolean
  init: () => Promise<void>
  signUp: (email: string, password: string, name: string) => Promise<{ error: string | null; needsConfirmation: boolean }>
  signIn: (email: string, password: string) => Promise<string | null>
  signInWithProvider: (provider: 'google' | 'apple') => Promise<string | null>
  forgotPassword: (email: string) => Promise<string | null>
  changePassword: (newPassword: string) => Promise<string | null>
  signInAsGuest: (displayName: string) => Promise<string | null>
  signOut: () => Promise<void>
  setDisplayName: (name: string) => void
}

export const useAuthStore = create<AuthState>(set => ({
  session: null,
  user: null,
  displayName: '',
  isGuest: false,
  loading: true,

  init: async () => {
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

  signInWithProvider: async (provider) => {
    // Redirect flow: on success the browser leaves the page and returns to
    // origin with a session; only config errors surface here.
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
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
    await supabase.auth.signOut()
    set({ session: null, user: null, displayName: '', isGuest: false })
  },

  setDisplayName: (name) => {
    localStorage.setItem('listo-display-name', name)
    set({ displayName: name })
  },
}))
