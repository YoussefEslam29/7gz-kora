import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { BackIcon, BallIcon } from '../components/icons'
import { GoalList, PlayerGrid, Scoreboard } from '../components/match'
import { Button, Card, ErrorNote, Heading, Loading, Name, Notice } from '../components/ui'
import * as api from '../lib/api'
import { errorMessage, scoreOf } from '../lib/format'
import { useLoad } from '../lib/useLoad'
import { useCurrentGroup } from '../state/group'

/** Fast goal logging: tap the scorer, then the assister (or "No assist"). */
export default function Recorder() {
  const { id = '' } = useParams()
  const { myPlayerId, isAdmin, playerName } = useCurrentGroup()
  // Refresh every 10s so several people can log goals at once.
  const { data, error, loading, reload } = useLoad(() => api.getMatch(id), [id], 10_000)
  const [scorer, setScorer] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [last, setLast] = useState<{ goalId: string; text: string } | null>(null)

  if (loading && !data) return <Loading />
  if (!data) return <ErrorNote message={error} onRetry={reload} />

  const { match, lineup, goals } = data
  const inLineup = lineup.some((p) => p.player_id === myPlayerId)
  const scorerTeam = lineup.find((p) => p.player_id === scorer)?.team
  const canLog = isAdmin || (inLineup && (match.status === 'playing' || match.status === 'voting'))

  async function save(assisterId: string | null) {
    if (!scorer || busy) return
    setBusy(true)
    setSaveError(null)
    try {
      const goalId = await api.logGoal(id, scorer, assisterId)
      const assist = assisterId ? ` (assist ${playerName(assisterId)})` : ''
      setLast({ goalId, text: `Goal for Team ${scorerTeam}: ${playerName(scorer)}${assist}` })
      setScorer(null)
      reload()
    } catch (e) {
      setSaveError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function undo() {
    if (!last) return
    setBusy(true)
    try {
      await api.deleteGoal(last.goalId)
      setLast(null)
      reload()
    } catch (e) {
      setSaveError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <Link to={`/matches/${id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-muted">
        <BackIcon size={18} /> Match
      </Link>

      <div className="sticky top-[calc(env(safe-area-inset-top)+3.5rem)] z-10 -mx-4 bg-ground/95 px-4 py-2 backdrop-blur">
        <Scoreboard score={scoreOf(goals)} />
      </div>

      {last && (
        <div className="flex items-center gap-3 rounded-2xl bg-pitch-deep p-3 text-white" role="status">
          <BallIcon size={22} className="shrink-0" />
          <p className="flex-1 text-sm font-medium">
            <Name>{last.text}</Name>
          </p>
          <button type="button" onClick={undo} disabled={busy} className="h-10 rounded-lg bg-white/15 px-3 text-sm font-semibold">
            Undo
          </button>
        </div>
      )}
      <ErrorNote message={saveError} />

      {!canLog ? (
        <Notice>
          {match.status === 'closed'
            ? 'Voting is closed, so goals are final. Ask an admin if something is wrong.'
            : 'Only players in this match can log goals.'}
        </Notice>
      ) : !scorer ? (
        <Card>
          <h1 className="mb-3 font-display text-2xl font-bold">Who scored?</h1>
          {inLineup && (
            <Button size="lg" className="mb-4 w-full" onClick={() => setScorer(myPlayerId)}>
              <BallIcon size={22} /> I scored
            </Button>
          )}
          <PlayerGrid lineup={lineup} onPick={setScorer} />
        </Card>
      ) : (
        <Card>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h1 className="font-display text-2xl font-bold">
              Assist for <Name>{playerName(scorer)}</Name>?
            </h1>
            <Button size="sm" variant="ghost" onClick={() => setScorer(null)}>
              Back
            </Button>
          </div>
          <Button size="lg" variant="secondary" className="mb-4 w-full" busy={busy} onClick={() => save(null)}>
            No assist
          </Button>
          {scorerTeam && <PlayerGrid lineup={lineup} only={scorerTeam} exclude={scorer} onPick={(a) => void save(a)} />}
        </Card>
      )}

      <Card>
        <Heading className="mb-1">Goals so far</Heading>
        <GoalList detail={data} onChange={reload} />
      </Card>
    </div>
  )
}
