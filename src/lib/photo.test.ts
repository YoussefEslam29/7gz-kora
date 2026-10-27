import { describe, expect, it } from 'vitest'
import { fitWithin } from './photo'

describe('shrinking a group photo', () => {
  it('keeps the longest side at 1280 px, keeping the shape', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1280, height: 960 })
    expect(fitWithin(1000, 3000)).toEqual({ width: 427, height: 1280 })
  })

  it('never makes a small photo bigger', () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 })
  })
})
