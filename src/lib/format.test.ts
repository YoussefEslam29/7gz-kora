import { describe, expect, it } from 'vitest'
import { formatLength, formatNightWhen, nightFacts, ratingTone } from './format'
import { toStartsAt } from './night'

describe('night formatting', () => {
  it('formatLength', () => {
    expect([120, 60, 90, 45].map(formatLength)).toEqual(['2 hours', '1 hour', '1 hour 30 min', '45 min'])
  })
  it('nightFacts: side size, length and cost (when there is one)', () => {
    expect(nightFacts({ players_per_side: 6, duration_minutes: 120, cost: 600, currency: 'EGP' })).toBe(
      '6 a side · 2 hours · 600 EGP',
    )
    expect(nightFacts({ players_per_side: 5, duration_minutes: 90, cost: 0, currency: 'EGP' })).toBe(
      '5 a side · 1 hour 30 min',
    )
  })
  it('formatNightWhen', () => {
    expect(formatNightWhen({ played_at: '2026-10-29', starts_at: toStartsAt('2026-10-29', '20:00') })).toBe(
      'Thu 29 Oct · 20:00',
    )
    expect(formatNightWhen({ played_at: '2026-10-29', starts_at: null })).toBe('Thu 29 Oct')
  })
  it('rating badge colour bands', () => {
    expect([8.4, 7.6, 6.5, 5.8].map(ratingTone)).toEqual(['r-top', 'r-good', 'r-ok', 'r-low'])
  })
})
