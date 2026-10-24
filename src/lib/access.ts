// Install-first access (Plans/Install-first-access.md): in a browser the
// website shows only the Install screen; the app runs once it is installed.

export type AppMode = 'install' | 'app'

/** Development-only bypass: VITE_ALLOW_BROWSER=true in .env.local. Never on Vercel. */
export const allowBrowser = import.meta.env.VITE_ALLOW_BROWSER === 'true'

export function appMode({ standalone, allowBrowser }: { standalone: boolean; allowBrowser: boolean }): AppMode {
  return standalone || allowBrowser ? 'app' : 'install'
}

/** The code of an invite link (/join?code=KICK-7Q3F), cleaned up, or null. */
export function inviteCodeFromUrl(pathname: string, search: string): string | null {
  if (pathname !== '/join') return null
  const code = (new URLSearchParams(search).get('code') ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, 12)
  return code || null
}
