import type { Team } from './types'

/** 8.3 -> "8.3". Ratings come from the database already rounded. */
export function formatRating(value: number | null | undefined): string {
  return value == null ? '–' : Number(value).toFixed(1)
}

/** Points in a breakdown: +0.5, −0.25, 0 */
export function formatPoints(value: number): string {
  const rounded = Math.round(value * 100) / 100
  if (rounded === 0) return '0'
  const text = String(Math.abs(rounded))
  return rounded > 0 ? `+${text}` : `−${text}`
}

/** A date-only string ("2026-10-22") as a local date, without timezone shifts. */
export function parseDay(day: string): Date {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** "Thu 22 Oct" */
export function formatDay(day: string): string {
  return parseDay(day).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

/** "Thursday 22 October 2026" */
export function formatDayLong(day: string): string {
  return parseDay(day).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

/** Today as "2026-10-23" in local time. */
export function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** "6h 12m", "35m", or "less than a minute" until the given time. */
export function timeLeft(iso: string | null): string {
  if (!iso) return ''
  const minutes = Math.floor((new Date(iso).getTime() - Date.now()) / 60_000)
  if (minutes < 1) return 'less than a minute'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export function isPast(iso: string | null): boolean {
  return iso != null && new Date(iso).getTime() <= Date.now()
}

/** Score from goals. Disputed goals do not count. */
export function scoreOf(goals: { scoring_team: Team; disputed: boolean }[]): Record<Team, number> {
  const score = { A: 0, B: 0 }
  for (const g of goals) if (!g.disputed) score[g.scoring_team]++
  return score
}

/** Colour of a rating badge, like the football apps everyone knows. */
export function ratingTone(value: number | null | undefined): string {
  if (value == null) return 'bg-line text-muted'
  if (value >= 8) return 'bg-pitch-deep text-white'
  if (value >= 7) return 'bg-[#15803d] text-white'
  if (value >= 6) return 'bg-[#b45309] text-white'
  return 'bg-[#64748b] text-white'
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'Something went wrong. Check your connection and try again.'
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return (parts[0]?.[0] ?? '?') + (parts.length > 1 ? parts[parts.length - 1][0] : '')
}
