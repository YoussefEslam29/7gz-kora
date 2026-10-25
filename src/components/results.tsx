// After the night: voting, then the final ratings with their breakdown.
import * as m from 'motion/react-m'
import { useState } from 'react'
import { Link } from 'react-router'
import * as api from '../lib/api'
import { errorMessage, isPast, timeLeft } from '../lib/format'
import { cascade, cascadeItem } from '../lib/motion'
import type { Match, MatchDetail, MatchRating } from '../lib/types'
import { useCurrentGroup } from '../state/group'
import { BreakdownTable } from './breakdown'
import { useConfirm, useToast, type Question } from './feedback'
import { ChevronIcon, StarIcon } from './icons'
import { Reveal } from './motion'
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
  const confirm = useConfirm()
  const toast = useToast()
  const iVoted = voteStatus.some((v) => v.player_id === myPlayerId && v.has_voted)

  async function act(name: string, action: () => Promise<unknown>, done: string, question?: Question) {
    if (question && !(await confirm(question))) return
    setBusy(name)
    setError(null)
    try {
      await action()
      toast(done)
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
          <Button variant="secondary" className="flex-1" busy={busy === 'extend'} onClick={() => void act('extend', () => api.extendVoting(match.id, 12), 'Voting extended by 12 hours')}>
            +12 hours
          </Button>
          <Button
            variant="secondary"
            className="flex-1"
            busy={busy === 'close'}
            onClick={() =>
              void act('close', () => api.closeVoting(match.id), 'Voting closed', {
                title: 'Close voting now?',
                message: 'Ratings become final and everyone sees the votes.',
                confirmLabel: 'Close voting',
              })
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
        <m.div
          className="h-full rounded-full bg-brand"
          initial={{ width: 0 }}
          animate={{ width: `${(done / Math.max(1, voteStatus.length)) * 100}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
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
      <section className="relative overflow-hidden rounded-card border-2 border-gold bg-paper p-4">
        {/* A gold shine sweeps across once. */}
        <m.span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-linear-to-r from-transparent via-gold/30 to-transparent"
          initial={{ x: '0%' }}
          animate={{ x: '400%' }}
          transition={{ duration: 1.1, delay: 0.4, ease: 'easeInOut' }}
        />
        <div className="relative flex items-center gap-3">
          <m.span
            className="shrink-0 text-gold"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.15 }}
          >
            <StarIcon size={36} />
          </m.span>
          <div className="min-w-0">
            <Heading>Man of the Match</Heading>
            {mvps.length === 0 ? (
              <p className="text-muted">No votes</p>
            ) : (
              <p className="font-display text-2xl">
                {mvps.map((mvp, i) => (
                  <span key={mvp.player_id}>
                    {i > 0 && ' & '}
                    <Name>{playerName(mvp.player_id)}</Name>
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
        <m.ul className="mt-2 divide-y divide-line" initial="initial" animate="animate" variants={cascade}>
          {ranked.map((r, i) => (
            <m.li key={r.player_id} variants={cascadeItem}>
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
                <RatingBadge value={r.rating} animated />
                <ChevronIcon size={18} className={`shrink-0 text-muted transition-transform ${open === r.player_id ? 'rotate-90' : ''}`} />
              </button>
              <Reveal open={open === r.player_id}>
                <Breakdown rating={r} detail={detail} />
              </Reveal>
            </m.li>
          ))}
        </m.ul>
      </Card>
    </>
  )
}

function Breakdown({ rating, detail }: { rating: MatchRating; detail: MatchDetail }) {
  const { playerName } = useCurrentGroup()
  const received = detail.votes.filter((v) => v.target_id === rating.player_id)
  const mvpFrom = detail.mvpVotes.filter((v) => v.target_id === rating.player_id)

  return (
    <div className="space-y-3 bg-ground/60 px-4 py-3 text-sm">
      <BreakdownTable rating={rating} />

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
