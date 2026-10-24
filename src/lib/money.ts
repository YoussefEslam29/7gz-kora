// Totals for a night's money card. The share itself (cost ÷ players, rounded
// up to a whole pound) is worked out in the database: night_payer_rows.
import type { Payer } from './types'

/** The collector counts as paid automatically. */
export const isPaid = (p: Payer) => p.is_collector || p.paid_at !== null

export interface MoneyTotals {
  share: number
  players: number
  /** What everyone pays together (share × players). */
  total: number
  collected: number
  /** Rounding up means the collector gets a little more than the pitch costs. */
  extra: number
  unpaid: number
}

export function moneyTotals(payers: Payer[], amount: number): MoneyTotals {
  const share = payers[0]?.share ?? 0
  const paid = payers.filter(isPaid).length
  const total = share * payers.length
  return {
    share,
    players: payers.length,
    total,
    collected: share * paid,
    extra: Math.max(0, total - amount),
    unpaid: payers.length - paid,
  }
}
