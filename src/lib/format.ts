import type { CancelReason, Match, Team } from './types'

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

const pad = (n: number) => String(n).padStart(2, '0')

/** A Date as "2026-10-29" in local time. */
export function dayOf(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Today as "2026-10-23" in local time. */
export function todayIso(): string {
  return dayOf(new Date())
}

/** A time as "20:05" in local time. */
export function clockOf(value: string | Date): string {
  const d = new Date(value)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** "Thu 29 Oct · 20:00" (just the day when there's no start time). */
export function formatNightWhen(night: { played_at: string; starts_at: string | null }): string {
  return night.starts_at ? `${formatDay(night.played_at)} · ${clockOf(night.starts_at)}` : formatDay(night.played_at)
}

/** 120 -> "2 hours", 90 -> "1 hour 30 min", 45 -> "45 min" */
export function formatLength(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const hours = h === 0 ? '' : `${h} hour${h === 1 ? '' : 's'}`
  if (!m) return hours
  return hours ? `${hours} ${m} min` : `${m} min`
}

/** "6 a side · 2 hours · 600 EGP" */
export function nightFacts(night: Pick<Match, 'players_per_side' | 'duration_minutes' | 'cost' | 'currency'>): string {
  const parts = [`${night.players_per_side} a side`, formatLength(night.duration_minutes)]
  if (Number(night.cost) > 0) parts.push(`${Number(night.cost)} ${night.currency}`)
  return parts.join(' · ')
}

export const CANCEL_REASONS: Record<CancelReason, string> = {
  rain: 'Rain',
  not_enough_players: 'Not enough players',
  pitch_problem: 'Pitch problem',
  other: 'Other',
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

/** Colour band of a rating badge (Design/README.md section 3; classes in index.css). */
export function ratingTone(value: number | null | undefined): string {
  if (value == null) return 'bg-line text-muted'
  if (value >= 8) return 'r-top'
  if (value >= 7) return 'r-good'
  if (value >= 6) return 'r-ok'
  return 'r-low'
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
