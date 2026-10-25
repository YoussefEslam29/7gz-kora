import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { BackIcon, BallIcon } from '../components/icons'
import { GoalList, PlayerGrid, Scoreboard } from '../components/match'
import { Button, Card, ErrorNote, Heading, Loading, Name, Notice } from '../components/ui'
import * as api from '../lib/api'
import { errorMessage } from '../lib/format'
import { gameLineup, gameScore } from '../lib/games'
import { useLoad } from '../lib/useLoad'
import { useCurrentGroup } from '../state/group'

/**
 * Fast goal logging (admins): tap the scorer, then the assister (or "No
 * assist"). It goes to the game on now, or to an earlier game picked at the
 * top (?game=<id>) for a goal that was forgotten.
 */
export default function Recorder() {
  const { id = '' } = useParams()
  const { search } = useLocation()
  const { isAdmin, playerName } = useCurrentGroup()
  // Refresh every 10s so two admins can log goals at once.
  const { data, error, loading, reload } = useLoad(() => api.getMatch(id), [id], 10_000)
  const [gameId, setGameId] = useState<string | null>(() => new URLSearchParams(search).get('game'))
  const [scorer, setScorer] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [last, setLast] = useState<{ goalId: string; text: string } | null>(null)

  if (loading && !data) return <Loading />
  if (!data) return <ErrorNote message={error} onRetry={reload} />

  const back = (
    <Link to={`/nights/${id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-muted">
      <BackIcon size={18} /> Night
    </Link>
  )
  if (!isAdmin) {
    return (
      <div className="space-y-4">
        {back}
        <Notice>Only admins log goals. If a goal is wrong, dispute it on the night page.</Notice>
      </div>
    )
  }

  const game = data.games.find((g) => g.id === gameId) ?? data.runningGame ?? data.games.at(-1)
  if (!game) {
    return (
      <div className="space-y-4">
        {back}
        <Notice>No games yet. Start a game on the night page first.</Notice>
      </div>
    )
  }
  const live = game.id === data.runningGame?.id
  // On the pitch now, or (for an earlier game) everyone who played in it.
  const lineup = live ? data.lineup : gameLineup(game.id, data.stints, data.stintPlayers)
  const scorerTeam = lineup.find((p) => p.player_id === scorer)?.team

  async function save(assisterId: string | null) {
    if (!scorer || !game || busy) return
    setBusy(true)
    setSaveError(null)
    try {
      const goalId = await api.logGoal(id, scorer, assisterId, live ? null : game.id)
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
      {back}

      <div className="sticky top-[calc(env(safe-area-inset-top)+4rem)] z-10 -mx-4 bg-ground/95 px-4 py-2 backdrop-blur">
        <p className="label mb-1">
          Game {game.ordinal}
          {live ? ' · live' : ''}
        </p>
        <Scoreboard teams={[game.team_one, game.team_two]} score={gameScore(game, data.goals)} />
      </div>

      {data.games.length > 1 && (
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1" role="tablist" aria-label="Game">
          {data.games.map((g) => (
            <button
              key={g.id}
              type="button"
              role="tab"
              aria-selected={g.id === game.id}
              onClick={() => {
                setGameId(g.id)
                setScorer(null)
              }}
              className={`h-10 shrink-0 rounded-full px-4 text-sm font-semibold ${
                g.id === game.id ? 'bg-ink text-paper' : 'border-[1.5px] border-line bg-paper text-muted'
              }`}
            >
              Game {g.ordinal}
              {g.ended_at ? '' : ' · live'}
            </button>
          ))}
        </div>
      )}
      {!live && (
        <Notice>
          Game {game.ordinal} is over: this adds a goal that was forgotten.
          {data.match.status === 'closed' && ' Voting has closed, so the ratings will be recalculated.'}
        </Notice>
      )}

      {last && (
        <div className="flex items-center gap-3 rounded-card bg-ink p-3 text-paper" role="status">
          <BallIcon size={22} className="shrink-0" />
          <p className="flex-1 text-sm font-medium">
            <Name>{last.text}</Name>
          </p>
          <button type="button" onClick={undo} disabled={busy} className="h-10 rounded-lg border-2 border-current px-3 text-sm font-semibold">
            Undo
          </button>
        </div>
      )}
      <ErrorNote message={saveError} />

      {!scorer ? (
        <Card>
          <h1 className="mb-3 font-display text-2xl">Who scored?</h1>
          <PlayerGrid lineup={lineup} onPick={setScorer} />
        </Card>
      ) : (
        <Card>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h1 className="font-display text-2xl">
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
