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
  signUp: (email: string, password: string, name: string) => Promise<string | null>
  signIn: (email: string, password: string) => Promise<string | null>
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
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    })
    return error?.message ?? null
  },

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
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
