import { useState } from 'react'
import { useParams } from 'react-router'
import { CancelledNotice, CancelNightForm } from '../components/cancel'
import { CheckInList, WhoIsHere } from '../components/checkin'
import { BallIcon } from '../components/icons'
import { GoalList, Lineups, Scoreboard } from '../components/match'
import { MoneyCard } from '../components/money'
import { Results, VotingCard } from '../components/results'
import { RsvpCard, RsvpLists } from '../components/rsvp'
import { Button, Card, ErrorNote, Heading, LinkButton, Loading, ShareButton, StatusChip } from '../components/ui'
import * as api from '../lib/api'
import { errorMessage, formatNightWhen, nightFacts, scoreOf } from '../lib/format'
import { plannedNightText } from '../lib/share'
import type { Payer } from '../lib/types'
import { useLoad } from '../lib/useLoad'
import { useCurrentGroup } from '../state/group'

/** One page for a night in every state: planned, live, voting, final or cancelled. */
export default function NightPage() {
  const { id = '' } = useParams()
  const { myPlayerId, isAdmin, refresh } = useCurrentGroup()
  const [pollMs, setPollMs] = useState<number | undefined>(20_000)
  const [cancelling, setCancelling] = useState(false)
  const [fixingCheckIns, setFixingCheckIns] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const { data, error, loading, reload } = useLoad(
    async () => {
      const detail = await api.getMatch(id)
      const s = detail.match.status
      const [voteStatus, payers] = await Promise.all([
        s === 'voting' ? api.getVoteStatus(id) : Promise.resolve([]),
        s === 'voting' || s === 'closed' || s === 'cancelled' ? api.getNightMoney(id) : Promise.resolve<Payer[]>([]),
      ])
      // Keep refreshing until the night is final.
      setPollMs(s === 'closed' || s === 'cancelled' ? undefined : 20_000)
      return { detail, voteStatus, payers }
    },
    [id],
    pollMs,
  )

  if (loading && !data) return <Loading />
  if (!data) return <ErrorNote message={error} onRetry={reload} />

  const { detail, voteStatus, payers } = data
  const { match, lineup, goals, playerIds } = detail
  const status = match.status
  const inLineup = lineup.some((p) => p.player_id === myPlayerId)
  const hasGames = status === 'playing' || status === 'voting' || status === 'closed'

  function changed() {
    reload()
    void refresh()
  }

  async function act(name: string, action: () => Promise<unknown>, confirmText: string) {
    if (!window.confirm(confirmText)) return
    setBusy(name)
    setActionError(null)
    try {
      await action()
      changed()
    } catch (e) {
      setActionError(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-4">
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
                onClick={() => void act('start', () => api.startNight(id), 'Start the night? Replies close and check-in opens.')}
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
          <Card strong>
            <Scoreboard score={scoreOf(goals)} />
          </Card>
          {(isAdmin || inLineup) && (
            <LinkButton to={`/nights/${id}/record`} size="lg" className="w-full">
              <BallIcon size={26} /> Goal
            </LinkButton>
          )}
          {isAdmin && (
            <div className="flex gap-2">
              <LinkButton to={`/nights/${id}/teams`} variant="secondary" className="flex-1">
                Teams
              </LinkButton>
              <Button
                variant="dark"
                className="flex-1"
                busy={busy === 'end'}
                onClick={() =>
                  void act('end', () => api.endNight(id), 'End the night? Voting opens for everyone checked in, and the money card appears.')
                }
              >
                End night
              </Button>
            </div>
          )}
          {isAdmin ? <CheckInList detail={detail} onChange={changed} /> : <WhoIsHere detail={detail} />}
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
          {status !== 'playing' && (
            <Card>
              <Heading className="mb-2">Score</Heading>
              <Scoreboard score={scoreOf(goals)} />
            </Card>
          )}
          <Card>
            <Heading className="mb-2">Teams</Heading>
            {lineup.length > 0 ? <Lineups lineup={lineup} /> : <p className="text-sm text-muted">No teams picked yet.</p>}
          </Card>
          <Card>
            <Heading className="mb-1">Goals</Heading>
            <GoalList detail={detail} onChange={reload} />
          </Card>
        </>
      )}

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
    </div>
  )
}
