// localStorage can be unavailable (private browsing, blocked storage), so
// every access is wrapped. Only used for small conveniences.

export function readLocal(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeLocal(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
  } catch {
    // Not important: the app works without it.
  }
}

export const KEYS = {
  currentGroup: 'kora.currentGroup',
  /** Invite code from a shared link, kept while the person installs and signs in. */
  pendingInvite: 'kora.pendingInvite',
}
