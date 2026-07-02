import { create } from 'zustand'

export type ThemePref = 'light' | 'dark' | 'system'

const KEY = 'listo-theme'

function load(): ThemePref {
  const v = localStorage.getItem(KEY)
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'system'
}

export function effectiveTheme(pref: ThemePref): 'light' | 'dark' {
  if (pref === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return pref
}

export function applyTheme(pref: ThemePref) {
  const theme = effectiveTheme(pref)
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light')
  } else {
    document.documentElement.removeAttribute('data-theme')
  }
}

interface ThemeStore {
  pref: ThemePref
  setPref: (p: ThemePref) => void
}

export const useThemeStore = create<ThemeStore>((set) => ({
  pref: load(),
  setPref: (pref) => {
    localStorage.setItem(KEY, pref)
    applyTheme(pref)
    set({ pref })
  },
}))
