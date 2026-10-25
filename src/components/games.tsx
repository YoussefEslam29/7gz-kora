// The game in progress (score, clock and the pitch-side buttons) and the list
// of the night's games.
import { useEffect, useRef, useState } from 'react'
import * as api from '../lib/api'
import { buzz, unlockSound } from '../lib/buzz'
import { errorMessage, formatMinutes } from '../lib/format'
import { boardTeams, gameClock, gameScore, minutesTonight, suggestSub } from '../lib/games'
import type { Game, MatchDetail, Team } from '../lib/types'
import { useNow } from '../lib/useNow'
import { useCurrentGroup } from '../state/group'
import { BallIcon } from './icons'
import { Lineups, Scoreboard } from './match'
import { Button, Card, ErrorNote, Heading, LinkButton, StatusChip, TeamTag } from './ui'

/**
 * "07:42 of 10:00". At the set length it turns red and, for admins, buzzes
 * once. It never ends the game: an admin taps Game over.
 */
export function GameClock({ game, buzzer = false }: { game: Game; buzzer?: boolean }) {
  const now = useNow()
  const clock = gameClock(game.started_at, game.planned_minutes, now)
  // A game already over time when the page opens doesn't buzz again.
  const buzzed = useRef(clock.overtime)
  useEffect(() => {
    if (buzzer && clock.overtime && !buzzed.current) {
      buzzed.current = true
      buzz()
    }
  }, [buzzer, clock.overtime])
  return (
    <p role="timer" className={`tabular mt-1 text-center font-display text-[30px] leading-none ${clock.overtime ? 'text-danger' : ''}`}>
      {clock.elapsed}{' '}
      <span className="font-sans text-[13px] font-medium text-muted">{clock.overtime ? "time's up" : `of ${clock.planned}`}</span>
    </p>
  )
}

/**
 * The game in progress. The score and clock stay in view at the top while
 * the page scrolls. Admins get the pitch-side buttons: Goal, Swap, Sub in and
 * Game over (which asks about penalties after a draw when a team is waiting).
 * Everyone else sees who's on the pitch.
 */
export function GameCard({ detail, onChange }: { detail: MatchDetail; onChange: () => void }) {
  const { isAdmin } = useCurrentGroup()
  const now = useNow(30_000)
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const game = detail.runningGame
  if (!game) return null

  const teams: [Team, Team] = [game.team_one, game.team_two]
  const score = gameScore(game, detail.goals)
  const here = detail.checkIns.filter((c) => !c.left_at)
  const waiting = boardTeams(here).filter((t) => !teams.includes(t))
  const bench = here.filter((c) => c.team === null).map((c) => c.player_id)
  const minutes = minutesTonight(detail.stints, detail.stintPlayers, now)
  const sub = suggestSub(
    detail.lineup.map((p) => p.player_id),
    bench,
    new Map([...minutes].map(([id, m]) => [id, m.played])),
  )
  const base = `/nights/${detail.match.id}`

  async function end(penaltyWinner: Team | null) {
    setBusy(true)
    setError(null)
    try {
      await api.endGame(detail.match.id, penaltyWinner)
      setAsking(false)
      onChange()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  function gameOver() {
    // A draw with a team waiting: penalties decide who stays on.
    if (score[0] === score[1] && waiting.length > 0) setAsking(true)
    else if (window.confirm(`Game over at ${score[0]} – ${score[1]}?`)) void end(null)
  }

  return (
    <>
      <div className="sticky top-[calc(env(safe-area-inset-top)+4rem)] z-10 -mx-4 bg-ground/95 px-4 py-2 backdrop-blur">
        <Card strong>
          <div className="mb-2 flex items-center justify-between">
            <span className="label">Game {game.ordinal}</span>
            <StatusChip status="playing" />
          </div>
          <Scoreboard teams={teams} score={score} />
          <GameClock key={game.id} game={game} buzzer={isAdmin} />
        </Card>
      </div>
      <ErrorNote message={error} />
      {isAdmin ? (
        <div className="space-y-2" onPointerDown={unlockSound}>
          <LinkButton to={`${base}/record`} size="lg" className="w-full">
            <BallIcon size={26} /> Goal
          </LinkButton>
          <div className="flex gap-2">
            <LinkButton to={`${base}/swap`} variant="secondary" className="flex-1">
              Swap
            </LinkButton>
            {(bench.length > 0 || waiting.length > 0) && (
              <LinkButton to={sub ? `${base}/swap?in=${sub.in}&out=${sub.out}` : `${base}/swap`} variant="secondary" className="flex-1">
                Sub in
              </LinkButton>
            )}
          </div>
          {asking ? (
            <Card>
              <p className="font-semibold">
                It's a draw and Team {waiting.join(' and ')} is waiting. Who won on penalties?
              </p>
              <div className="mt-3 flex gap-2">
                {teams.map((t) => (
                  <Button key={t} variant="secondary" className="flex-1" busy={busy} onClick={() => void end(t)}>
                    <TeamTag team={t} />
                  </Button>
                ))}
              </div>
              <Button variant="ghost" className="mt-2 w-full" disabled={busy} onClick={() => void end(null)}>
                No penalties
              </Button>
            </Card>
          ) : (
            <Button variant="dark" className="w-full" busy={busy} onClick={gameOver}>
              Game over
            </Button>
          )}
        </div>
      ) : (
        <Card>
          <Heading className="mb-2">On the pitch</Heading>
          <Lineups lineup={detail.lineup} />
        </Card>
      )}
    </>
  )
}

/** Every game of the night, newest first: teams, score, penalties and length. */
export function GamesList({ detail }: { detail: MatchDetail }) {
  const now = useNow(30_000)
  const { games, goals } = detail
  if (games.length === 0) return null
  return (
    <Card>
      <Heading className="mb-1">Games ({games.length})</Heading>
      <ul className="divide-y divide-line">
        {[...games].reverse().map((g) => {
          const [one, two] = gameScore(g, goals)
          const minutes = (new Date(g.ended_at ?? now).getTime() - new Date(g.started_at).getTime()) / 60_000
          return (
            <li key={g.id} className="py-2">
              <div className="flex min-h-10 items-center gap-2">
                <span className="w-6 font-display text-muted">{g.ordinal}</span>
                <TeamTag team={g.team_one} />
                <span className="tabular font-display text-xl whitespace-nowrap">
                  {one} – {two}
                </span>
                <TeamTag team={g.team_two} />
                <span className="ml-auto text-xs text-muted">{g.ended_at ? formatMinutes(minutes) : 'Live'}</span>
              </div>
              {g.penalty_winner && <p className="pl-8 text-xs text-muted">Team {g.penalty_winner} won on penalties</p>}
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
