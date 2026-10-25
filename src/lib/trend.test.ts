import { describe, expect, it } from 'vitest'
import { bestNight, chartScale, recentForm } from './trend'

// The worked example in Plans/Player-card-and-motion.md section 3, oldest first.
const TEN = [6.1, 6.4, 5.9, 7.0, 6.6, 7.2, 7.5, 6.9, 7.8, 7.1]

describe('recent form', () => {
  it('is the last 5 nights and their average: 7.3, up from 6.4', () => {
    expect(recentForm(TEN)).toEqual({ last: [7.2, 7.5, 6.9, 7.8, 7.1], average: 7.3, trend: 'up' })
  })

  it('with only 4 nights: their average, and no arrow', () => {
    expect(recentForm([6.1, 6.4, 5.9, 7.1])).toEqual({ last: [6.1, 6.4, 5.9, 7.1], average: 6.4, trend: null })
  })

  it('6.5 against 6.6 before (−0.1) is level', () => {
    expect(recentForm([6.6, 6.6, 6.6, 6.6, 6.6, 6.5, 6.5, 6.5, 6.5, 6.5]).trend).toBe('level')
  })

  it('0.2 or more lower is down', () => {
    expect(recentForm([7, 7, 7, 7, 7, 6.8, 6.8, 6.8, 6.8, 6.8]).trend).toBe('down')
  })

  it('compares with the nights before, even fewer than 5', () => {
    expect(recentForm([5, 7, 7, 7, 7, 7]).trend).toBe('up')
  })

  it('no nights: nothing', () => {
    expect(recentForm([])).toEqual({ last: [], average: null, trend: null })
  })
})

describe('best night', () => {
  it('is the highest rating: 7.8', () => {
    expect(bestNight(TEN.map((rating, i) => ({ rating, i })))).toEqual({ rating: 7.8, i: 8 })
  })

  it('with a tie, the most recent', () => {
    expect(bestNight([{ rating: 8, i: 0 }, { rating: 8, i: 1 }])?.i).toBe(1)
  })

  it('none without nights', () => {
    expect(bestNight([])).toBeNull()
  })
})

describe('the graph', () => {
  it('spaces the nights evenly from left to right', () => {
    const s = chartScale([6, 7, 8])
    expect([s.x(0), s.x(1), s.x(2)]).toEqual([0, 0.5, 1])
  })

  it('runs from 10 at the top to 4 at the bottom', () => {
    const s = chartScale([6, 8])
    expect([s.min, s.max, s.y(10), s.y(7), s.y(4)]).toEqual([4, 10, 0, 0.5, 1])
  })

  it('goes lower for a rating under 4', () => {
    expect(chartScale([3.2, 7]).min).toBe(3)
  })

  it('puts a single night in the middle', () => {
    expect(chartScale([7]).x(0)).toBe(0.5)
  })
})
