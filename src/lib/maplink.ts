// The pitch's Google Maps link (Plans/Accounts-groups-and-chat.md section 7):
// which links count, and where the pitch is on the map. Pure functions,
// tested in maplink.test.ts.

export interface MapPosition {
  lat: number
  lng: number
}

const GOOGLE_HOST = /^(www\.|maps\.)?google\.[a-z]{2,3}(\.[a-z]{2})?$/
const NUM = String.raw`(-?\d{1,3}(?:\.\d+)?)`
/** A place's pin: …!3d30.0450!4d31.2360 */
const PIN = new RegExp(String.raw`!3d${NUM}!4d${NUM}`)
/** The map's view: …/@30.0444,31.2357,17z */
const VIEW = new RegExp(`@${NUM},${NUM}`)
/** …/place/30.0444,31.2357 or …/search/30.0444,+31.2357 */
const PATH = new RegExp(String.raw`/(?:place|search)/${NUM},\+?${NUM}`)
/** q=30.0444,31.2357 */
const PAIR = new RegExp(String.raw`^\s*${NUM}\s*,\s*${NUM}\s*$`)

function parse(link: string): URL | null {
  try {
    const url = new URL(link.trim())
    return url.protocol === 'https:' ? url : null
  } catch {
    return null
  }
}

/** maps.app.goo.gl/…: Google's short share links. Only the helper (/api/map-link) can open them. */
export function isShortMapUrl(link: string): boolean {
  const url = parse(link)
  return !!url && (url.hostname === 'maps.app.goo.gl' || (url.hostname === 'goo.gl' && url.pathname.startsWith('/maps')))
}

export function isGoogleMapsUrl(link: string): boolean {
  const url = parse(link)
  if (!url) return false
  if (isShortMapUrl(link)) return true
  return GOOGLE_HOST.test(url.hostname) && (url.hostname.startsWith('maps.') || url.pathname.startsWith('/maps'))
}

function position(lat: string, lng: string): MapPosition | null {
  const p = { lat: Number(lat), lng: Number(lng) }
  return Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180 ? p : null
}

/** Where the pitch is, from a full Google Maps link: the place's pin, else q=, else the map's view. */
export function coordsFromMapUrl(link: string): MapPosition | null {
  const url = parse(link)
  if (!url || !isGoogleMapsUrl(link) || isShortMapUrl(link)) return null
  let text = url.href
  try {
    text = decodeURIComponent(text)
  } catch {
    // A broken % sequence: read the link as it is.
  }
  const pin = text.match(PIN)
  if (pin) return position(pin[1], pin[2])
  for (const key of ['q', 'query', 'll', 'center', 'destination']) {
    const pair = url.searchParams.get(key)?.match(PAIR)
    if (pair) return position(pair[1], pair[2])
  }
  const view = text.match(VIEW) ?? text.match(PATH)
  return view ? position(view[1], view[2]) : null
}

/** Google's map with a pin, for an iframe (no API key needed). */
export function mapEmbedUrl({ lat, lng }: MapPosition): string {
  return `https://maps.google.com/maps?q=${lat},${lng}&z=16&output=embed`
}
