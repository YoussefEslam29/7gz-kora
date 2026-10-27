import { describe, expect, it } from 'vitest'
import { coordsFromMapUrl, isGoogleMapsUrl, isShortMapUrl, mapEmbedUrl } from './maplink'

describe('Google Maps links', () => {
  it("finds a place's pin before the map's view", () => {
    expect(
      coordsFromMapUrl(
        'https://www.google.com/maps/place/Club/@30.0444,31.2357,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d30.0450!4d31.2360',
      ),
    ).toEqual({ lat: 30.045, lng: 31.236 })
  })

  it('reads the map view, q= and query=', () => {
    expect(coordsFromMapUrl('https://www.google.com/maps/@30.0444,31.2357,15z')).toEqual({ lat: 30.0444, lng: 31.2357 })
    expect(coordsFromMapUrl('https://maps.google.com/?q=30.0444,31.2357')).toEqual({ lat: 30.0444, lng: 31.2357 })
    expect(coordsFromMapUrl('https://www.google.com/maps/search/?api=1&query=29.9792,31.1342')).toEqual({
      lat: 29.9792,
      lng: 31.1342,
    })
  })

  it('short share links are Google Maps links that need the helper', () => {
    expect(isShortMapUrl('https://maps.app.goo.gl/AbC123')).toBe(true)
    expect(isGoogleMapsUrl('https://maps.app.goo.gl/AbC123')).toBe(true)
    expect(coordsFromMapUrl('https://maps.app.goo.gl/AbC123')).toBeNull()
  })

  it('a place name without a position is a link only', () => {
    expect(isGoogleMapsUrl('https://www.google.com/maps/place/Club+Pitch')).toBe(true)
    expect(coordsFromMapUrl('https://www.google.com/maps/place/Club+Pitch')).toBeNull()
  })

  it('refuses other sites, plain http and impossible positions', () => {
    expect(isGoogleMapsUrl('https://example.com/@30.0444,31.2357')).toBe(false)
    expect(coordsFromMapUrl('https://example.com/@30.0444,31.2357')).toBeNull()
    expect(isGoogleMapsUrl('http://maps.google.com/?q=1,2')).toBe(false)
    expect(isGoogleMapsUrl('https://www.google.com/search?q=pitch')).toBe(false)
    expect(coordsFromMapUrl('https://www.google.com/maps/@95.1,31.2,15z')).toBeNull()
  })

  it('Google Egypt works too', () => {
    expect(coordsFromMapUrl('https://www.google.com.eg/maps/@30.1,31.2,15z')).toEqual({ lat: 30.1, lng: 31.2 })
  })

  it("embeds Google's map with a pin", () => {
    expect(mapEmbedUrl({ lat: 30.0444, lng: 31.2357 })).toBe('https://maps.google.com/maps?q=30.0444,31.2357&z=16&output=embed')
  })
})
