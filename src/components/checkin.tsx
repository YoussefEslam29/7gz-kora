// Check-in at the pitch. Who is checked in is who plays, votes and pays.
import { useState } from 'react'
import * as api from '../lib/api'
import { clockOf, errorMessage } from '../lib/format'
import type { MatchDetail, RsvpStatus } from '../lib/types'
import { useCurrentGroup } from '../state/group'
import { Avatar, Button, Card, ErrorNote, Heading, Name } from './ui'

const REPLY_NOTE: Record<RsvpStatus, string> = { in: "Said I'm in", waiting: 'On the waiting list', out: 'Said out' }

/** Admins: tap to check someone in, tap again when they leave early. Anyone in the group can be checked in. */
export function CheckInList({ detail, onChange }: { detail: MatchDetail; onChange: () => void }) {
  const { players } = useCurrentGroup()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const matchId = detail.match.id
  const here = new Map(detail.checkIns.map((c) => [c.player_id, c]))
  const said = new Map(detail.rsvps.map((r) => [r.player_id, r.status]))
  // Checked in first, then "I'm in", then the waiting list, then everyone else.
  const rank = (id: string) => (here.has(id) ? 0 : said.get(id) === 'in' ? 1 : said.get(id) === 'waiting' ? 2 : 3)
  const sorted = [...players].sort((a, b) => rank(a.id) - rank(b.id) || a.display_name.localeCompare(b.display_name))

  async function run(playerId: string, action: () => Promise<unknown>) {
    setBusy(playerId)
    setError(null)
    try {
      await action()
      onChange()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card>
      <Heading className="mb-1">Check-in · {here.size} here</Heading>
      <ErrorNote message={error} />
      <ul className="divide-y divide-line">
        {sorted.map((p) => {
          const c = here.get(p.id)
          const reply = said.get(p.id)
          const note = c
            ? c.left_at
              ? `${clockOf(c.arrived_at)} – ${clockOf(c.left_at)} · left early`
              : `Here since ${clockOf(c.arrived_at)}`
            : reply
              ? REPLY_NOTE[reply]
              : ''
          return (
            <li key={p.id} className="flex min-h-14 items-center gap-2 py-1.5">
              <Avatar name={p.display_name} url={p.avatar_url} size={32} />
              <div className="min-w-0 flex-1">
                <Name className="block truncate font-semibold">{p.display_name}</Name>
                {note && <span className="block text-xs text-muted">{note}</span>}
              </div>
              {c && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy === p.id}
                  onClick={() => {
                    if (window.confirm(`Undo ${p.display_name}'s check-in? Only for a mistake.`))
                      void run(p.id, () => api.undoCheckIn(matchId, p.id))
                  }}
                >
                  Undo
                </Button>
              )}
              {!c ? (
                <Button size="sm" busy={busy === p.id} onClick={() => void run(p.id, () => api.checkIn(matchId, p.id))}>
                  Check in
                </Button>
              ) : c.left_at ? (
                <Button size="sm" variant="secondary" busy={busy === p.id} onClick={() => void run(p.id, () => api.checkIn(matchId, p.id))}>
                  Back
                </Button>
              ) : (
                <Button size="sm" variant="secondary" busy={busy === p.id} onClick={() => void run(p.id, () => api.checkOut(matchId, p.id))}>
                  Left
                </Button>
              )}
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

/** Everyone else: who's here tonight, in order of arrival. */
export function WhoIsHere({ detail }: { detail: MatchDetail }) {
  const { playerName } = useCurrentGroup()
  const list = [...detail.checkIns].sort((a, b) => a.arrived_at.localeCompare(b.arrived_at))
  return (
    <Card>
      <Heading className="mb-1">Here tonight ({list.length})</Heading>
      {list.length === 0 ? (
        <p className="text-sm text-muted">Nobody is checked in yet.</p>
      ) : (
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
          {list.map((c) => (
            <li key={c.player_id} className={c.left_at ? 'text-muted' : ''}>
              <Name className="font-semibold">{playerName(c.player_id)}</Name>{' '}
              <span className="text-muted">
                {clockOf(c.arrived_at)}
                {c.left_at && ' (left)'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
