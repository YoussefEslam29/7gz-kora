// A player's rating history (Plans/Player-card-and-motion.md section 3):
// recent form, the best night, and where the graph's points go. Pure
// functions, tested in trend.test.ts. Ratings come in oldest first.

/** How much the form has to move for an up or down arrow. */
export const TREND_STEP = 0.2
/** Nights in the form. */
export const FORM_NIGHTS = 5

export type Trend = 'up' | 'down' | 'level'

const average = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length
const oneDecimal = (n: number) => Math.round(n * 10) / 10

/**
 * The last 5 nights and their average. The trend compares that average with
 * the average of the (up to 5) nights before them; none with fewer than 6.
 */
export function recentForm(ratings: number[]): { last: number[]; average: number | null; trend: Trend | null } {
  const last = ratings.slice(-FORM_NIGHTS)
  if (last.length === 0) return { last, average: null, trend: null }
  const before = ratings.slice(-2 * FORM_NIGHTS, -FORM_NIGHTS)
  if (before.length === 0) return { last, average: oneDecimal(average(last)), trend: null }
  // Rounded so that floating-point noise can't tip a 0.2 change either way.
  const diff = Math.round((average(last) - average(before)) * 1000) / 1000
  const trend: Trend = diff >= TREND_STEP ? 'up' : diff <= -TREND_STEP ? 'down' : 'level'
  return { last, average: oneDecimal(average(last)), trend }
}

/** The highest-rated night; with a tie, the most recent. */
export function bestNight<T extends { rating: number }>(nights: T[]): T | null {
  let best: T | null = null
  for (const night of nights) if (!best || night.rating >= best.rating) best = night
  return best
}

/**
 * Where each night goes on the graph, as fractions of its width and height
 * (0 = left / top). Nights are spaced evenly. The scale runs from 10 at the
 * top down to 4, or lower if a rating is below 4.
 */
export function chartScale(ratings: number[]) {
  const min = Math.min(4, Math.floor(Math.min(...ratings)))
  const max = 10
  return {
    min,
    max,
    x: (i: number) => (ratings.length === 1 ? 0.5 : i / (ratings.length - 1)),
    y: (rating: number) => (max - rating) / (max - min),
  }
}
