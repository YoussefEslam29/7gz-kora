import { describe, expect, it } from 'vitest'
import { moneyTotals } from './money'
import type { Payer } from './types'

const payer = (n: number, paid: boolean, is_collector = false): Payer => ({
  player_id: `p${n}`,
  share: 47,
  paid_at: paid ? '2026-10-23T10:00:00Z' : null,
  is_collector,
})

describe('moneyTotals', () => {
  it('worked example: 600 EGP, 13 players at 47; the collector and 8 others have paid', () => {
    const payers = [
      payer(1, false, true),
      ...Array.from({ length: 8 }, (_, i) => payer(i + 2, true)),
      ...Array.from({ length: 4 }, (_, i) => payer(i + 10, false)),
    ]
    expect(moneyTotals(payers, 600)).toEqual({ share: 47, players: 13, total: 611, collected: 423, extra: 11, unpaid: 4 })
  })

  it('no payers: nothing to show', () => {
    expect(moneyTotals([], 600)).toEqual({ share: 0, players: 0, total: 0, collected: 0, extra: 0, unpaid: 0 })
  })
})
