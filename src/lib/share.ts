// Ready-to-send messages for WhatsApp (or any app), Plans/Extras-and-backlog.md
// section 5. Links open the Install screen in a browser, so the messages say
// "Open 7GZ-KORA" instead of relying on the link.
import { clockOf, parseDay } from './format'
import type { Match } from './types'

/** "Thursday 29 Oct" */
function longDay(d: Date): string {
  const weekday = d.toLocaleDateString('en-GB', { weekday: 'long' })
  const month = d.toLocaleDateString('en-GB', { month: 'short' })
  return `${weekday} ${d.getDate()} ${month}`
}

/** "Thursday 29 Oct, 20:00 at Club pitch 3 · 6 a side · 11 in so far. Open 7GZ-KORA to say if you're in." */
export function plannedNightText(
  night: Pick<Match, 'played_at' | 'starts_at' | 'location' | 'players_per_side' | 'pitch_url'>,
  inCount: number,
): string {
  const day = longDay(parseDay(night.played_at))
  const when = night.starts_at ? `${day}, ${clockOf(night.starts_at)}` : day
  const where = night.location ? ` at ${night.location}` : ''
  const pitch = night.pitch_url ? `
Pitch: ${night.pitch_url}` : ''
  return `${when}${where} · ${night.players_per_side} a side · ${inCount} in so far. Open 7GZ-KORA to say if you're in.${pitch}`
}

const REASON_TEXT = { rain: 'rain', not_enough_players: 'not enough players', pitch_problem: 'pitch problem' }

/** "Tonight is cancelled (rain)." or "Thursday 29 Oct is cancelled (pitch problem)." */
export function cancelledNightText(
  night: Pick<Match, 'played_at' | 'cancel_reason' | 'cancel_note'>,
  now: Date,
): string {
  const day = parseDay(night.played_at)
  const when = day.toDateString() === now.toDateString() ? 'Tonight' : longDay(day)
  const reason = night.cancel_reason === 'other' ? night.cancel_note : night.cancel_reason && REASON_TEXT[night.cancel_reason]
  return `${when} is cancelled${reason ? ` (${reason})` : ''}.`
}

/** Opens the phone's share sheet (WhatsApp etc.), or copies the text when sharing isn't available. */
export async function shareText(text: string, url: string): Promise<'shared' | 'copied' | 'cancelled'> {
  if (navigator.share) {
    try {
      await navigator.share({ text, url })
      return 'shared'
    } catch {
      return 'cancelled' // the person closed the share sheet
    }
  }
  await navigator.clipboard.writeText(`${text}\n${url}`)
  return 'copied'
}
