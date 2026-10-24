// "I'm in" / "Out" for a planned night, and who answered what.
import { useState } from 'react'
import { Link } from 'react-router'
import * as api from '../lib/api'
import { errorMessage, formatNightWhen, nightFacts } from '../lib/format'
import { rsvpSummary } from '../lib/night'
import type { Match, Rsvp } from '../lib/types'
import { useCurrentGroup } from '../state/group'
import { Button, Card, ErrorNote, Heading, Name, StatusChip } from './ui'

/**
 * The planned night with the I'm in / Out buttons. Home shows the night's
 * details too; the night page already has them in its header (showNight={false}).
 */
export function RsvpCard({
  match,
  rsvps,
  onChange,
  linkToNight = false,
  showNight = true,
}: {
  match: Match
  rsvps: Rsvp[]
  onChange: () => void
  linkToNight?: boolean
  showNight?: boolean
}) {
  const { myPlayerId, members } = useCurrentGroup()
  const [busy, setBusy] = useState<'in' | 'out' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const summary = rsvpSummary(rsvps, members.map((m) => m.player_id))
  const mine = rsvps.find((r) => r.player_id === myPlayerId)
  const coming = mine?.status === 'in' || mine?.status === 'waiting'

  async function answer(status: 'in' | 'out') {
    setBusy(status)
    setError(null)
    try {
      await api.setRsvp(match.id, status)
      onChange()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const title = (
    <h2 className="mt-1.5 font-display text-[22px] leading-tight" dir="auto">
      {match.location || 'Pitch to be confirmed'}
    </h2>
  )
  const others = [
    summary.waiting.length > 0 && `${summary.waiting.length} waiting`,
    `${summary.out.length} out`,
    `${summary.noReply.length} no reply`,
  ].filter(Boolean)

  return (
    <Card>
      {showNight ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="label">{formatNightWhen(match)}</span>
            <StatusChip status="draft" />
          </div>
          {linkToNight ? <Link to={`/nights/${match.id}`}>{title}</Link> : title}
          <p className="text-[13px] text-muted">{nightFacts(match)}</p>
        </>
      ) : (
        <Heading>Replies</Heading>
      )}
      <p className="mt-2 text-[13px]">
        <b>
          {summary.in.length}
          {match.player_cap ? ` of ${match.player_cap}` : ''} in
        </b>
        {others.map((text) => ` · ${text}`)}
      </p>
      <p role="status" className="mt-1 mb-3 text-sm font-semibold">
        {myAnswer(mine, summary.waiting.indexOf(myPlayerId) + 1)}
      </p>
      <div className="flex gap-2">
        <Button
          className="flex-1"
          variant={mine?.status === 'out' ? 'secondary' : 'primary'}
          aria-pressed={coming}
          busy={busy === 'in'}
          onClick={() => void answer('in')}
        >
          I'm in
        </Button>
        <Button
          className="flex-1"
          variant={mine?.status === 'out' ? 'dark' : 'secondary'}
          aria-pressed={mine?.status === 'out'}
          busy={busy === 'out'}
          onClick={() => void answer('out')}
        >
          Out
        </Button>
      </div>
      <ErrorNote message={error} />
    </Card>
  )
}

function myAnswer(mine: Rsvp | undefined, place: number): string {
  if (!mine) return 'Are you coming?'
  if (mine.status === 'out') return "You're out. Changed your mind? Tap I'm in."
  if (mine.status === 'waiting') return `The night is full: you're #${place} on the waiting list.`
  return mine.promoted_at ? "You're in! You moved up from the waiting list." : "You're in."
}

/** Who's in, who's waiting (in order), who's out and who hasn't answered. */
export function RsvpLists({ rsvps }: { rsvps: Rsvp[] }) {
  const { members, playerName } = useCurrentGroup()
  const s = rsvpSummary(rsvps, members.map((m) => m.player_id))
  const byName = (ids: string[]) => [...ids].sort((a, b) => playerName(a).localeCompare(playerName(b)))
  const lists: { label: string; ids: string[]; numbered?: boolean }[] = [
    { label: 'In', ids: byName(s.in) },
    { label: 'Waiting list', ids: s.waiting, numbered: true },
    { label: 'Out', ids: byName(s.out) },
    { label: 'No reply', ids: byName(s.noReply) },
  ]
  return (
    <Card>
      <div className="space-y-3">
        {lists
          .filter((list) => list.ids.length > 0)
          .map((list) => (
            <div key={list.label}>
              <Heading className="mb-1">
                {list.label} ({list.ids.length})
              </Heading>
              <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
                {list.ids.map((id, i) => (
                  <li key={id}>
                    {list.numbered && <span className="text-muted">{i + 1}. </span>}
                    <Name className="font-semibold">{playerName(id)}</Name>
                  </li>
                ))}
              </ul>
            </div>
          ))}
      </div>
    </Card>
  )
}
