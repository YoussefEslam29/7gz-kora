import { describe, expect, it } from 'vitest'
import { clockOf } from './format'
import { formToDetails, nightDefaults, rsvpSummary, toStartsAt, withSide } from './night'
import type { Match, Rsvp } from './types'

// Thursday 22 October 2026, 20:00.
const lastNight: Match = {
  id: 'm1',
  group_id: 'g1',
  played_at: '2026-10-22',
  starts_at: toStartsAt('2026-10-22', '20:00'),
  location: 'Club pitch 3',
  duration_minutes: 120,
  cost: 600,
  currency: 'EGP',
  collector_player_id: 'ahmed',
  players_per_side: 6,
  game_minutes: 10,
  player_cap: 18,
  status: 'closed',
  voting_closes_at: null,
  closed_at: null,
  cancel_reason: null,
  cancel_note: null,
  cancel_fee: 0,
  cancelled_at: null,
  created_at: '2026-10-20T10:00:00Z',
}

describe('nightDefaults: "Plan a night" is pre-filled from the last night', () => {
  it('with no previous night: today at 20:00, 6 a side, limit 18, I collect', () => {
    expect(nightDefaults(null, 'me', new Date(2026, 9, 24, 15, 0))).toEqual({
      day: '2026-10-24',
      time: '20:00',
      location: '',
      duration_minutes: 120,
      cost: 0,
      players_per_side: 6,
      collector_player_id: 'me',
      game_minutes: 10,
      player_cap: 18,
    })
  })

  it('copies the last night onto the next same weekday', () => {
    // Today is Saturday 24 October: the next Thursday is the 29th.
    expect(nightDefaults(lastNight, 'me', new Date(2026, 9, 24, 15, 0))).toEqual({
      day: '2026-10-29',
      time: '20:00',
      location: 'Club pitch 3',
      duration_minutes: 120,
      cost: 600,
      players_per_side: 6,
      collector_player_id: 'ahmed',
      game_minutes: 10,
      player_cap: 18,
    })
  })

  it('on the day itself: today if the start is still ahead, otherwise next week', () => {
    expect(nightDefaults(lastNight, 'me', new Date(2026, 9, 29, 15, 0)).day).toBe('2026-10-29')
    expect(nightDefaults(lastNight, 'me', new Date(2026, 9, 29, 21, 0)).day).toBe('2026-11-05')
  })

  it('when the last night is still ahead (already planned), suggests the week after it', () => {
    const planned = { ...lastNight, played_at: '2026-10-27', starts_at: toStartsAt('2026-10-27', '20:00'), status: 'draft' as const }
    // Today is Saturday 24 October; Tuesday 27 is already planned, so the next one is Tuesday 3 November.
    expect(nightDefaults(planned, 'me', new Date(2026, 9, 24, 15, 0)).day).toBe('2026-11-03')
  })

  it('I collect when the last night had no collector', () => {
    const form = nightDefaults({ ...lastNight, collector_player_id: null }, 'me', new Date(2026, 9, 24))
    expect(form.collector_player_id).toBe('me')
  })
})

describe('the Plan a night form', () => {
  it('turns the local date and time into what the database expects', () => {
    const details = formToDetails(nightDefaults(lastNight, 'me', new Date(2026, 9, 24, 15, 0)))
    expect(details.played_at).toBe('2026-10-29')
    expect(details.starts_at).toBe(toStartsAt('2026-10-29', '20:00'))
    expect(clockOf(details.starts_at)).toBe('20:00')
    expect(details.player_cap).toBe(18)
  })

  it('the player limit follows the side size unless it was changed by hand', () => {
    const form = nightDefaults(null, 'me', new Date(2026, 9, 24))
    expect(withSide(form, 7).player_cap).toBe(21)
    expect(withSide({ ...form, player_cap: 20 }, 7).player_cap).toBe(20)
    expect(withSide({ ...form, player_cap: null }, 7).player_cap).toBeNull()
  })
})

describe('rsvpSummary', () => {
  const reply = (player_id: string, status: Rsvp['status'], waiting_since: string | null = null): Rsvp => ({
    player_id,
    status,
    status_changed_at: '2026-10-24T10:00:00Z',
    waiting_since,
    promoted_at: null,
  })

  it('splits the answers, keeps the waiting list in order and finds who has not replied', () => {
    const s = rsvpSummary(
      [
        reply('a', 'in'),
        reply('b', 'out'),
        reply('c', 'waiting', '2026-10-24T12:00:00Z'),
        reply('d', 'waiting', '2026-10-24T11:00:00Z'),
      ],
      ['a', 'b', 'c', 'd', 'e', 'f'],
    )
    expect(s).toEqual({ in: ['a'], waiting: ['d', 'c'], out: ['b'], noReply: ['e', 'f'] })
  })
})
