// Helpers for "Add to Home Screen".
import { useSyncExternalStore } from 'react'

export function isIos(): boolean {
  const ua = navigator.userAgent
  // iPads report themselves as Macs, but Macs have no touch screen.
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
}

/** True when opened from the Home Screen icon (not in a browser tab). */
export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

// Android Chrome fires `beforeinstallprompt` once, early. Keep it so an
// "Install app" button can show the real install dialog later.
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferredPrompt: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredPrompt = event as BeforeInstallPromptEvent
    listeners.forEach((notify) => notify())
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    listeners.forEach((notify) => notify())
  })
}

function subscribe(notify: () => void) {
  listeners.add(notify)
  return () => listeners.delete(notify)
}

/** Android only: whether the browser's install dialog is available, and a way to open it. */
export function useInstallPrompt() {
  const prompt = useSyncExternalStore(subscribe, () => deferredPrompt)
  return {
    canInstall: prompt !== null,
    install: async () => {
      if (!deferredPrompt) return
      await deferredPrompt.prompt()
      await deferredPrompt.userChoice
      deferredPrompt = null
      listeners.forEach((notify) => notify())
    },
  }
}
