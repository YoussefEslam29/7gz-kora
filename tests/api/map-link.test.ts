// The map helper (api/map-link.ts) with a fake fetch: it follows Google's
// short links, Google addresses only, at most 5 redirects, within a time limit.
import { describe, expect, it, vi } from 'vitest'
import handler, { expandMapLink, isGoogleHost } from '../../api/map-link'

/** A fake fetch: each address in the chain redirects to the next. */
function redirects(chain: Record<string, string>) {
  return vi.fn(async (input: string | URL | Request) => {
    const location = chain[String(input)]
    return new Response(null, location ? { status: 302, headers: { location } } : { status: 200 })
  }) as unknown as typeof fetch
}

const FULL = 'https://www.google.com/maps/place/Club/@30.0444,31.2357,17z'

describe('the map helper', () => {
  it('follows a short link to the full Google Maps address', async () => {
    const fetcher = redirects({ 'https://maps.app.goo.gl/AbC123': FULL })
    expect(await expandMapLink('https://maps.app.goo.gl/AbC123', fetcher)).toBe(FULL)
  })

  it("passes Google's cookie page through to its 'continue' address", async () => {
    const consent = `https://consent.google.com/m?continue=${encodeURIComponent(FULL)}`
    const fetcher = redirects({ 'https://maps.app.goo.gl/AbC123': consent })
    expect(await expandMapLink('https://maps.app.goo.gl/AbC123', fetcher)).toBe(FULL)
  })

  it('refuses anything that is not Google, at the start or on the way', async () => {
    expect(await expandMapLink('https://example.com/x', redirects({}))).toBeNull()
    expect(await expandMapLink('http://maps.app.goo.gl/x', redirects({}))).toBeNull()
    const fetcher = redirects({ 'https://maps.app.goo.gl/evil': 'https://evil.example.com/' })
    expect(await expandMapLink('https://maps.app.goo.gl/evil', fetcher)).toBeNull()
  })

  it('gives up after 5 redirects', async () => {
    const fetcher = redirects({ 'https://maps.app.goo.gl/a': 'https://maps.app.goo.gl/b', 'https://maps.app.goo.gl/b': 'https://maps.app.goo.gl/a' })
    expect(await expandMapLink('https://maps.app.goo.gl/a', fetcher)).toBeNull()
    expect(fetcher).toHaveBeenCalledTimes(5)
  })

  it('gives up when Google takes too long', async () => {
    const slow = ((_input: unknown, init?: RequestInit) =>
      new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted'))))) as unknown as typeof fetch
    await expect(expandMapLink('https://maps.app.goo.gl/slow', slow, 10)).rejects.toThrow()
  })

  it('knows Google addresses', () => {
    for (const host of ['maps.app.goo.gl', 'goo.gl', 'www.google.com', 'maps.google.com', 'www.google.com.eg', 'consent.google.com']) {
      expect(isGoogleHost(host)).toBe(true)
    }
    for (const host of ['google.com.evil.com', 'evilgoogle.com', 'example.com']) expect(isGoogleHost(host)).toBe(false)
  })

  it('answers with the full address, or 422 when there is none', async () => {
    const ok = await handler.fetch(new Request(`https://x.test/api/map-link?url=${encodeURIComponent(FULL)}`))
    expect(ok.status).toBe(200)
    expect(await ok.json()).toEqual({ url: FULL })
    const bad = await handler.fetch(new Request('https://x.test/api/map-link?url=https%3A%2F%2Fexample.com'))
    expect(bad.status).toBe(422)
  })
})
