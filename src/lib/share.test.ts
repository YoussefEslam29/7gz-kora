import { describe, expect, it } from 'vitest'
import { toStartsAt } from './night'
import { cancelledNightText, plannedNightText } from './share'

describe('WhatsApp texts', () => {
  const night = {
    played_at: '2026-10-29',
    starts_at: toStartsAt('2026-10-29', '20:00'),
    location: 'Club pitch 3',
    players_per_side: 6,
    pitch_url: null as string | null,
  }

  it('a planned night', () => {
    expect(plannedNightText(night, 11)).toBe(
      "Thursday 29 Oct, 20:00 at Club pitch 3 · 6 a side · 11 in so far. Open 7GZ-KORA to say if you're in.",
    )
    expect(plannedNightText({ ...night, location: null }, 0)).toBe(
      "Thursday 29 Oct, 20:00 · 6 a side · 0 in so far. Open 7GZ-KORA to say if you're in.",
    )
  })

  it('a planned night with a pitch link adds it on its own line', () => {
    expect(plannedNightText({ ...night, pitch_url: 'https://maps.app.goo.gl/AbC123' }, 11)).toBe(
      "Thursday 29 Oct, 20:00 at Club pitch 3 · 6 a side · 11 in so far. Open 7GZ-KORA to say if you're in.\nPitch: https://maps.app.goo.gl/AbC123",
    )
  })

  it('a cancelled night says "Tonight" on the day itself', () => {
    const cancelled = { played_at: '2026-10-29', cancel_reason: 'rain' as const, cancel_note: null }
    expect(cancelledNightText(cancelled, new Date(2026, 9, 29, 17, 0))).toBe('Tonight is cancelled (rain).')
    expect(cancelledNightText(cancelled, new Date(2026, 9, 27, 9, 0))).toBe('Thursday 29 Oct is cancelled (rain).')
    expect(
      cancelledNightText({ ...cancelled, cancel_reason: 'other', cancel_note: 'Pitch double-booked' }, new Date(2026, 9, 29)),
    ).toBe('Tonight is cancelled (Pitch double-booked).')
  })
})
