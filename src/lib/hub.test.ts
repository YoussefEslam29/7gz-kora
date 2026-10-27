import { describe, expect, it } from 'vitest'
import { countdown, podiumOrder } from './hub'

describe('Home', () => {
  // Thursday 29 October, 20:00.
  const starts = new Date(2026, 9, 29, 20, 0).toISOString()

  it('counts down to the next night', () => {
    expect(countdown(starts, new Date(2026, 9, 27, 15, 30))).toBe('in 2 days 4 h')
    expect(countdown(starts, new Date(2026, 9, 28, 18, 0))).toBe('in 1 day 2 h')
    expect(countdown(starts, new Date(2026, 9, 29, 8, 0))).toBe('in 12 h 0 min')
    expect(countdown(starts, new Date(2026, 9, 29, 19, 15))).toBe('in 45 min')
    expect(countdown(starts, new Date(2026, 9, 29, 20, 5))).toBe('starting now')
  })

  it('puts first in the middle of the podium', () => {
    expect(podiumOrder(['Omar', 'Ziad', 'Karim'])).toEqual(['Ziad', 'Omar', 'Karim'])
    expect(podiumOrder(['Omar', 'Ziad'])).toEqual(['Ziad', 'Omar'])
    expect(podiumOrder(['Omar'])).toEqual(['Omar'])
    expect(podiumOrder([])).toEqual([])
  })
})
