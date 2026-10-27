// The map helper (Plans/Accounts-groups-and-chat.md section 7): Google's
// short share links (maps.app.goo.gl/…) hide the pitch's position, so the
// app asks this Vercel function to follow them to the full Google Maps
// address. It only ever fetches Google addresses, gives up after 5 redirects
// or 5 seconds, and stores nothing. The app then finds the position in the
// address (src/lib/maplink.ts). `npm run dev` runs it too (vite.config.ts).

const MAX_HOPS = 5
const TIME_LIMIT_MS = 5000
const SHORT_HOSTS = new Set(['maps.app.goo.gl', 'goo.gl'])

/** The addresses a short link may pass through: Google's own. */
export function isGoogleHost(host: string): boolean {
  return SHORT_HOSTS.has(host) || /^([a-z]+\.)?google\.[a-z]{2,3}(\.[a-z]{2})?$/.test(host)
}

/** Follows a short link's redirects to the full Google address. null when it isn't Google or goes nowhere. */
export async function expandMapLink(
  start: string,
  fetcher: typeof fetch = fetch,
  timeLimitMs = TIME_LIMIT_MS,
): Promise<string | null> {
  let url: URL
  try {
    url = new URL(start)
  } catch {
    return null
  }
  const signal = AbortSignal.timeout(timeLimitMs)
  for (let hop = 0; hop < MAX_HOPS; hop++) {
    if (url.protocol !== 'https:' || !isGoogleHost(url.hostname)) return null
    // Google's cookie page carries the real address in "continue".
    const next = url.hostname === 'consent.google.com' ? url.searchParams.get('continue') : null
    if (next) {
      try {
        url = new URL(next)
      } catch {
        return null
      }
      continue
    }
    if (!SHORT_HOSTS.has(url.hostname)) return url.toString()
    const response = await fetcher(url.toString(), { redirect: 'manual', signal })
    const location = response.headers.get('location')
    if (!location) return null
    url = new URL(location, url)
  }
  return null
}

export default {
  async fetch(request: Request): Promise<Response> {
    const link = new URL(request.url).searchParams.get('url') ?? ''
    try {
      const url = await expandMapLink(link)
      return Response.json({ url }, { status: url ? 200 : 422, headers: { 'cache-control': 'public, max-age=86400' } })
    } catch {
      return Response.json({ url: null }, { status: 504 })
    }
  },
}
