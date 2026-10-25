// After the night: voting, then the final ratings with their breakdown.
import { useState } from 'react'
import { Link } from 'react-router'
import * as api from '../lib/api'
import { errorMessage, formatMinutes, formatPoints, isPast, timeLeft } from '../lib/format'
import type { Match, MatchDetail, MatchRating } from '../lib/types'
import { useCurrentGroup } from '../state/group'
import { ChevronIcon, StarIcon } from './icons'
import { Button, Card, ErrorNote, Heading, LinkButton, Name, RatingBadge } from './ui'

type VoteStatus = { player_id: string; has_voted: boolean }

/** Voting is open: time left, who has voted, the vote button and the admin controls. */
export function VotingCard({
  match,
  voteStatus,
  iPlayed,
  onChange,
}: {
  match: Match
  voteStatus: VoteStatus[]
  iPlayed: boolean
  onChange: () => void
}) {
  const { myPlayerId, isAdmin } = useCurrentGroup()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const iVoted = voteStatus.some((v) => v.player_id === myPlayerId && v.has_voted)

  async function act(name: string, action: () => Promise<unknown>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return
    setBusy(name)
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
    <Card strong={iPlayed && !iVoted}>
      <Heading>Voting</Heading>
      <p className="mt-1 font-display text-2xl">
        {isPast(match.voting_closes_at) ? 'Closing now…' : `Closes in ${timeLeft(match.voting_closes_at)}`}
      </p>
      <VoteProgress voteStatus={voteStatus} />
      <ErrorNote message={error} />
      {iPlayed && (
        <LinkButton to={`/nights/${match.id}/vote`} variant={iVoted ? 'secondary' : 'primary'} className="mt-3 w-full">
          {iVoted ? 'Change my votes' : 'Rate the players'}
        </LinkButton>
      )}
      {isAdmin && (
        <div className="mt-2 flex gap-2">
          <Button variant="secondary" className="flex-1" busy={busy === 'extend'} onClick={() => void act('extend', () => api.extendVoting(match.id, 12))}>
            +12 hours
          </Button>
          <Button
            variant="secondary"
            className="flex-1"
            busy={busy === 'close'}
            onClick={() =>
              void act('close', () => api.closeVoting(match.id), 'Close voting now? Ratings become final and votes are revealed.')
            }
          >
            Close now
          </Button>
        </div>
      )}
      {isAdmin && (
        <Link to={`/nights/${match.id}/record`} className="mt-3 block text-center text-sm font-semibold text-brand-ink underline">
          Forgot a goal? Log it
        </Link>
      )}
    </Card>
  )
}

function VoteProgress({ voteStatus }: { voteStatus: VoteStatus[] }) {
  const { playerName } = useCurrentGroup()
  const waiting = voteStatus.filter((v) => !v.has_voted)
  const done = voteStatus.length - waiting.length
  return (
    <div className="mt-2">
      <div className="h-2 overflow-hidden rounded-full bg-line" aria-hidden>
        <div className="h-full rounded-full bg-brand" style={{ width: `${(done / Math.max(1, voteStatus.length)) * 100}%` }} />
      </div>
      <p className="mt-1 text-sm text-muted">
        {done} of {voteStatus.length} voted
        {waiting.length > 0 && waiting.length <= 6 && (
          <>
            {' · waiting for '}
            {waiting.map((w, i) => (
              <span key={w.player_id}>
                {i > 0 && ', '}
                <Name>{playerName(w.player_id)}</Name>
              </span>
            ))}
          </>
        )}
      </p>
    </div>
  )
}

/** Final ratings, Man of the Match and who voted what. */
export function Results({ detail }: { detail: MatchDetail }) {
  const { playerName, myPlayerId } = useCurrentGroup()
  const [open, setOpen] = useState<string | null>(myPlayerId)
  const ranked = [...detail.ratings].sort((a, b) => b.final_rating - a.final_rating)
  const mvps = ranked.filter((r) => r.is_mvp)

  return (
    <>
      <section className="rounded-card border-2 border-gold bg-paper p-4">
        <div className="flex items-center gap-3">
          <StarIcon size={36} className="shrink-0 text-gold" />
          <div className="min-w-0">
            <Heading>Man of the Match</Heading>
            {mvps.length === 0 ? (
              <p className="text-muted">No votes</p>
            ) : (
              <p className="font-display text-2xl">
                {mvps.map((m, i) => (
                  <span key={m.player_id}>
                    {i > 0 && ' & '}
                    <Name>{playerName(m.player_id)}</Name>
                  </span>
                ))}
                <span className="ml-2 font-sans text-base font-semibold text-muted">
                  {mvps[0].mvp_votes} vote{mvps[0].mvp_votes === 1 ? '' : 's'}
                </span>
              </p>
            )}
          </div>
        </div>
      </section>

      <Card className="p-0">
        <div className="flex items-baseline justify-between px-4 pt-4">
          <Heading>Ratings</Heading>
          <span className="text-xs text-muted">Tap a player for the breakdown</span>
        </div>
        <ul className="mt-2 divide-y divide-line">
          {ranked.map((r, i) => (
            <li key={r.player_id}>
              <button
                type="button"
                aria-expanded={open === r.player_id}
                onClick={() => setOpen(open === r.player_id ? null : r.player_id)}
                className={`flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left ${r.player_id === myPlayerId ? 'bg-brand/15' : ''}`}
              >
                <span className="w-5 font-display text-lg text-muted">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 font-semibold">
                    <Name className="truncate">{playerName(r.player_id)}</Name>
                    {r.is_mvp && <StarIcon size={16} className="shrink-0 text-gold" aria-label="Man of the Match" />}
                  </span>
                  <span className="block text-xs text-muted">
                    {[
                      r.goals > 0 && `${r.goals} goal${r.goals > 1 ? 's' : ''}`,
                      r.assists > 0 && `${r.assists} assist${r.assists > 1 ? 's' : ''}`,
                      r.clean_sheets > 0 && 'clean sheet',
                      r.stats_only && 'stats only',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                <RatingBadge value={r.rating} />
                <ChevronIcon size={18} className={`shrink-0 text-muted transition-transform ${open === r.player_id ? 'rotate-90' : ''}`} />
              </button>
              {open === r.player_id && <Breakdown rating={r} detail={detail} />}
            </li>
          ))}
        </ul>
      </Card>
    </>
  )
}

function Breakdown({ rating, detail }: { rating: MatchRating; detail: MatchDetail }) {
  const { playerName } = useCurrentGroup()
  const b = rating.breakdown
  const received = detail.votes.filter((v) => v.target_id === rating.player_id)
  const mvpFrom = detail.mvpVotes.filter((v) => v.target_id === rating.player_id)
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

  const rows: [string, number][] = [
    ['Base for playing', b.base],
    [`Goals (${rating.goals})`, b.goals],
    [`Assists (${rating.assists})`, b.assists],
    [`Team impact (goal difference on the pitch, added up: ${formatPoints(b.net_goal_diff)})`, b.net_goals],
    [b.minutes != null ? `Result (average over ${formatMinutes(b.minutes)} played)` : 'Result', b.result],
  ]
  if (b.clean_sheets) rows.push([`Clean sheets (${rating.clean_sheets})`, b.clean_sheets])
  if (b.saves) rows.push([`Saves (${rating.saves})`, b.saves])

  return (
    <div className="space-y-3 bg-ground/60 px-4 py-3 text-sm">
      <table className="tabular w-full">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <td className="py-0.5 text-muted">{label}</td>
              <td className="py-0.5 text-right font-medium">{label.startsWith('Base') ? value.toFixed(1) : formatPoints(value)}</td>
            </tr>
          ))}
          <tr className="border-t border-line font-semibold">
            <td className="pt-1">Stats score</td>
            <td className="pt-1 text-right">{b.analytics}</td>
          </tr>
          <tr className="font-semibold">
            <td>Peer votes</td>
            <td className="text-right">
              {b.vote_average != null ? `${b.vote_average} avg of ${plural(b.vote_count, 'vote')}` : 'no votes'}
            </td>
          </tr>
        </tbody>
      </table>

      <p className="rounded-lg bg-paper p-2 font-medium">
        {b.stats_only ? (
          <>
            Fewer than {b.min_votes} votes, so the rating is the stats score alone: <strong>{rating.rating.toFixed(1)}</strong>
          </>
        ) : (
          <>
            {Math.round(b.w_analytics * 100)}% × {b.analytics} + {Math.round(b.w_votes * 100)}% × {b.vote_average} ={' '}
            <strong>{rating.rating.toFixed(1)}</strong>
          </>
        )}
      </p>

      <div>
        <p className="font-semibold">Votes received</p>
        {received.length === 0 ? (
          <p className="text-muted">None</p>
        ) : (
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {received
              .sort((x, y) => (y.score ?? 0) - (x.score ?? 0))
              .map((v) => (
                <li key={v.voter_id} className="rounded-md bg-paper px-2 py-1">
                  <Name>{playerName(v.voter_id)}</Name>{' '}
                  <strong className="tabular">{v.didnt_see ? "didn't see" : v.score}</strong>
                </li>
              ))}
          </ul>
        )}
      </div>
      {mvpFrom.length > 0 && (
        <p>
          <span className="font-semibold">Man of the Match votes from </span>
          {mvpFrom.map((v, i) => (
            <span key={v.voter_id}>
              {i > 0 && ', '}
              <Name>{playerName(v.voter_id)}</Name>
            </span>
          ))}
        </p>
      )}
    </div>
  )
}
