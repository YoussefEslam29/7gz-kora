import { useState } from 'react'
import { useParams } from 'react-router'
import { PlayingTime, WaitingAndBench } from '../components/bench'
import { CancelledNotice, CancelNightForm } from '../components/cancel'
import { CheckInList, WhoIsHere } from '../components/checkin'
import { useConfirm, useToast, type Question } from '../components/feedback'
import { GameCard, GamesList } from '../components/games'
import { GoalList } from '../components/match'
import { MoneyCard } from '../components/money'
import { NextGameCard } from '../components/nextgame'
import { Results, VotingCard } from '../components/results'
import { RsvpCard, RsvpLists } from '../components/rsvp'
import { Button, Card, ErrorNote, Heading, LinkButton, Loading, ShareButton, StatusChip } from '../components/ui'
import { Cascade } from '../components/motion'
import * as api from '../lib/api'
import { errorMessage, formatNightWhen, nightFacts } from '../lib/format'
import { plannedNightText } from '../lib/share'
import type { LeaderboardRow, Payer } from '../lib/types'
import { useLoad } from '../lib/useLoad'
import { useCurrentGroup } from '../state/group'

/**
 * One page for a night in every state: planned, live, voting, final or
 * cancelled. While it's live, admins get the control room (the game card,
 * the next game, the bench, the team board and check-in) on one scrolling
 * screen; everyone else sees the score, the clock and who's on.
 */
export default function NightPage() {
  const { id = '' } = useParams()
  const { group, myPlayerId, isAdmin, refresh } = useCurrentGroup()
  const [pollMs, setPollMs] = useState<number | undefined>(10_000)
  const [cancelling, setCancelling] = useState(false)
  const [fixingCheckIns, setFixingCheckIns] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const confirm = useConfirm()
  const toast = useToast()
  const { data, error, loading, reload } = useLoad(
    async () => {
      const detail = await api.getMatch(id)
      const s = detail.match.status
      const [voteStatus, payers, season] = await Promise.all([
        s === 'voting' ? api.getVoteStatus(id) : Promise.resolve([]),
        s === 'voting' || s === 'closed' || s === 'cancelled' ? api.getNightMoney(id) : Promise.resolve<Payer[]>([]),
        // Minutes in goal this season, for the goalkeeper suggestion.
        s === 'playing' && isAdmin
          ? api.getLeaderboard(group.id, new Date().getFullYear())
          : Promise.resolve<LeaderboardRow[]>([]),
      ])
      // A live night refreshes every 10 seconds; a final one doesn't need to.
      setPollMs(s === 'playing' ? 10_000 : s === 'closed' || s === 'cancelled' ? undefined : 20_000)
      return { detail, voteStatus, payers, seasonInGoal: new Map(season.map((r) => [r.player_id, r.minutes_in_goal])) }
    },
    [id, isAdmin, group.id],
    pollMs,
  )

  if (loading && !data) return <Loading />
  if (!data) return <ErrorNote message={error} onRetry={reload} />

  const { detail, voteStatus, payers, seasonInGoal } = data
  const { match, playerIds } = detail
  const status = match.status
  const hasGames = status === 'playing' || status === 'voting' || status === 'closed'

  function changed() {
    reload()
    void refresh()
  }

  async function act(name: string, action: () => Promise<unknown>, question: Question, done: string) {
    if (!(await confirm(question))) return
    setBusy(name)
    setActionError(null)
    try {
      await action()
      toast(done)
      changed()
    } catch (e) {
      setActionError(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Cascade className="space-y-4">
      <header>
        <div className="flex items-center justify-between gap-2">
          <p className="label">{formatNightWhen(match)}</p>
          <StatusChip status={status} />
        </div>
        <h1 className="mt-1.5 font-display text-[28px] leading-tight" dir="auto">
          {match.location || 'Pitch to be confirmed'}
        </h1>
        <p className="text-[13px] text-muted">{nightFacts(match)}</p>
      </header>

      <ErrorNote message={actionError ?? error} />

      {status === 'draft' && (
        <>
          <RsvpCard match={match} rsvps={detail.rsvps} onChange={reload} showNight={false} />
          <RsvpLists rsvps={detail.rsvps} />
          <ShareButton text={plannedNightText(match, detail.rsvps.filter((r) => r.status === 'in').length)} />
          {isAdmin && !cancelling && (
            <Card>
              <Heading className="mb-2">Admin</Heading>
              <Button
                size="lg"
                className="w-full"
                busy={busy === 'start'}
                onClick={() =>
                  void act(
                    'start',
                    () => api.startNight(id),
                    { title: 'Start the night?', message: 'Replies close and check-in opens.', confirmLabel: 'Start night' },
                    'Night started',
                  )
                }
              >
                Start night
              </Button>
              <LinkButton to={`/nights/${id}/edit`} variant="secondary" className="mt-2 w-full">
                Edit night
              </LinkButton>
              <Button variant="danger" className="mt-2 w-full" onClick={() => setCancelling(true)}>
                Cancel night
              </Button>
            </Card>
          )}
        </>
      )}

      {status === 'playing' && (
        <>
          {detail.runningGame ? (
            <GameCard key={detail.runningGame.id} detail={detail} onChange={reload} />
          ) : isAdmin ? (
            <NextGameCard key={detail.games.length} detail={detail} seasonInGoal={seasonInGoal} onChange={reload} />
          ) : (
            <Card strong>
              <Heading>Between games</Heading>
              <p className="mt-1 font-display text-[22px] leading-tight">Game {detail.games.length + 1} starts soon</p>
            </Card>
          )}
          <WaitingAndBench detail={detail} />
          {isAdmin && (
            <div className="flex gap-2">
              <LinkButton to={`/nights/${id}/teams`} variant="secondary" className="flex-1">
                Team board
              </LinkButton>
              <Button
                variant="dark"
                className="flex-1"
                busy={busy === 'end'}
                onClick={() =>
                  void act(
                    'end',
                    () => api.endNight(id),
                    {
                      title: 'End the night?',
                      message: 'A game still on ends now. Voting opens for everyone checked in, and the money card appears.',
                      confirmLabel: 'End night',
                    },
                    'Night ended. Voting is open.',
                  )
                }
              >
                End night
              </Button>
            </div>
          )}
        </>
      )}

      {status === 'cancelled' && <CancelledNotice match={match} />}
      {status === 'voting' && (
        <VotingCard match={match} voteStatus={voteStatus} iPlayed={playerIds.includes(myPlayerId)} onChange={changed} />
      )}
      {status === 'closed' && <Results detail={detail} />}
      <MoneyCard match={match} payers={payers} onChange={reload} />

      {hasGames && (
        <>
          <GamesList detail={detail} />
          <PlayingTime detail={detail} />
          <Card>
            <Heading className="mb-1">Goals</Heading>
            <GoalList detail={detail} onChange={reload} />
          </Card>
        </>
      )}

      {status === 'playing' && (isAdmin ? <CheckInList detail={detail} onChange={changed} /> : <WhoIsHere detail={detail} />)}

      {isAdmin &&
        status === 'voting' &&
        (fixingCheckIns ? (
          <CheckInList detail={detail} onChange={changed} />
        ) : (
          <Button variant="secondary" className="w-full" onClick={() => setFixingCheckIns(true)}>
            Fix check-ins
          </Button>
        ))}
      {isAdmin && status === 'playing' && !cancelling && (
        <Button variant="danger" className="w-full" onClick={() => setCancelling(true)}>
          Cancel night
        </Button>
      )}
      {cancelling && (
        <CancelNightForm
          match={match}
          onClose={() => setCancelling(false)}
          onDone={() => {
            setCancelling(false)
            changed()
          }}
        />
      )}
      {isAdmin && (status === 'voting' || status === 'closed' || status === 'cancelled') && (
        <LinkButton to={`/nights/${id}/edit`} variant="secondary" className="w-full">
          Edit night
        </LinkButton>
      )}
    </Cascade>
  )
}
