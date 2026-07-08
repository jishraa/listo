import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type InstallPlatform = 'android' | 'ios' | null

export interface InstallPrompt {
  canShow: boolean
  platform: InstallPlatform
  install: () => Promise<void>
  dismiss: () => void
}

import { storageKeys } from '../lib/storage'

const DISMISSED_KEY = storageKeys.installDismissed

function isRunningStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as { standalone?: boolean }).standalone === true
  )
}

export function useInstallPrompt(): InstallPrompt {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [platform, setPlatform] = useState<InstallPlatform>(null)
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISSED_KEY) === '1'
  )

  useEffect(() => {
    if (isRunningStandalone()) return

    // iOS Safari detection
    const ua = navigator.userAgent
    const isIOS = /iphone|ipad|ipod/i.test(ua)
    const isSafariOnly = /safari/i.test(ua) && !/chrome|crios|chromium|fxios/i.test(ua)
    if (isIOS && isSafariOnly) {
      setPlatform('ios')
    }

    // Android / Chrome install event
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setPlatform('android')
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const canShow =
    !dismissed &&
    platform !== null &&
    (platform === 'ios' || deferredPrompt !== null)

  return {
    canShow,
    platform,
    install: async () => {
      if (!deferredPrompt) return
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setDeferredPrompt(null)
        setPlatform(null)
      }
    },
    dismiss: () => {
      localStorage.setItem(DISMISSED_KEY, '1')
      setDismissed(true)
    },
  }
}
