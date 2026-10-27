// Helpers for planning nights and showing replies. Pure functions (tested in night.test.ts).
import { clockOf, dayOf, parseDay } from './format'
import type { Match, NightDetails, NightForm, Rsvp } from './types'

/** "2026-10-29" + "20:00" in the phone's local time, as an ISO timestamp. */
export function toStartsAt(day: string, time: string): string {
  const [y, m, d] = day.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  return new Date(y, m - 1, d, hh, mm).toISOString()
}

/** The default player limit: three teams' worth (18 for 6 a side). */
export const capFor = (side: number) => side * 3

/** The form for editing an existing night. */
export function formFromNight(m: Match): NightForm {
  return {
    day: m.played_at,
    time: m.starts_at ? clockOf(m.starts_at) : '20:00',
    location: m.location ?? '',
    pitch_url: m.pitch_url ?? '',
    pitch_lat: m.pitch_lat,
    pitch_lng: m.pitch_lng,
    duration_minutes: m.duration_minutes,
    cost: Number(m.cost),
    players_per_side: m.players_per_side,
    collector_player_id: m.collector_player_id,
    game_minutes: m.game_minutes,
    player_cap: m.player_cap,
  }
}

/**
 * A new night, pre-filled from the last one so planning is usually one tap:
 * the same weekday (the next one from today, or after the last night when
 * that one is still ahead) and start time, and the same pitch and its map
 * link, length, cost, side size, collector, game length and player limit.
 */
export function nightDefaults(last: Match | null, myPlayerId: string, now: Date): NightForm {
  if (!last) {
    return {
      day: dayOf(now),
      time: '20:00',
      location: '',
      pitch_url: '',
      pitch_lat: null,
      pitch_lng: null,
      duration_minutes: 120,
      cost: 0,
      players_per_side: 6,
      collector_player_id: myPlayerId,
      game_minutes: 10,
      player_cap: capFor(6),
    }
  }
  const form = formFromNight(last)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const lastDay = parseDay(last.played_at)
  // Start looking from today, or from the day after the last night if it is still ahead.
  const date = lastDay >= today ? new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate() + 1) : today
  let ahead = (lastDay.getDay() - date.getDay() + 7) % 7
  // Today is the day, but the start time has passed: next week.
  if (ahead === 0 && date === today && clockOf(now) >= form.time) ahead = 7
  date.setDate(date.getDate() + ahead)
  return { ...form, day: dayOf(date), collector_player_id: form.collector_player_id ?? myPlayerId }
}

export function formToDetails(f: NightForm): NightDetails {
  return {
    played_at: f.day,
    starts_at: toStartsAt(f.day, f.time),
    location: f.location.trim(),
    // No link, no position.
    pitch_url: f.pitch_url.trim() || null,
    pitch_lat: f.pitch_url.trim() ? f.pitch_lat : null,
    pitch_lng: f.pitch_url.trim() ? f.pitch_lng : null,
    duration_minutes: f.duration_minutes,
    cost: f.cost,
    players_per_side: f.players_per_side,
    collector_player_id: f.collector_player_id,
    game_minutes: f.game_minutes,
    player_cap: f.player_cap,
  }
}

/** Changes the side size. The player limit follows, unless it was changed by hand. */
export function withSide(f: NightForm, side: number): NightForm {
  const follows = f.player_cap === capFor(f.players_per_side)
  return { ...f, players_per_side: side, player_cap: follows ? capFor(side) : f.player_cap }
}

export interface RsvpSummary {
  in: string[]
  /** In the order they joined the waiting list. */
  waiting: string[]
  out: string[]
  /** Members who haven't answered. */
  noReply: string[]
}

export function rsvpSummary(rsvps: Rsvp[], memberPlayerIds: string[]): RsvpSummary {
  const ids = (status: Rsvp['status']) => rsvps.filter((r) => r.status === status)
  const replied = new Set(rsvps.map((r) => r.player_id))
  return {
    in: ids('in').map((r) => r.player_id),
    waiting: ids('waiting')
      .sort((a, b) => (a.waiting_since ?? '').localeCompare(b.waiting_since ?? ''))
      .map((r) => r.player_id),
    out: ids('out').map((r) => r.player_id),
    noReply: memberPlayerIds.filter((id) => !replied.has(id)),
  }
}
