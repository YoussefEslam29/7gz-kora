// Between games (admins): pick the next two teams and their goalkeepers, then
// start the game. It comes pre-filled: the winner stays on and the waiting
// team comes on; in goal, whoever is happy to play there, then whoever has
// had the fewest minutes in goal tonight, then this season.
import { useState } from 'react'
import * as api from '../lib/api'
import { unlockSound } from '../lib/buzz'
import { errorMessage, formatMinutes } from '../lib/format'
import { boardTeams, gameScore, minutesTonight, nextGameTeams, suggestKeeper, suggestSub } from '../lib/games'
import type { BoardEntry, MatchDetail, Team } from '../lib/types'
import { useNow } from '../lib/useNow'
import { useCurrentGroup } from '../state/group'
import { GloveIcon } from './icons'
import { Button, Card, ErrorNote, Heading, LinkButton, Name, Notice, TeamTag } from './ui'

export function NextGameCard({
  detail,
  seasonInGoal,
  onChange,
}: {
  detail: MatchDetail
  /** Minutes in goal this season, by player (from the table). */
  seasonInGoal: Map<string, number>
  onChange: () => void
}) {
  const { player, playerName } = useCurrentGroup()
  const [picked, setPicked] = useState<Team[] | null>(null)
  const [keepers, setKeepers] = useState<Partial<Record<Team, string | null>>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const now = useNow(60_000)

  const matchId = detail.match.id
  const here = detail.checkIns.filter((c) => !c.left_at)
  const teams = boardTeams(here)
  const last = detail.games.at(-1)
  const suggested = nextGameTeams(last ? { game: last, score: gameScore(last, detail.goals) } : null, teams)
  const chosen = (picked ?? suggested ?? []).filter((t) => teams.includes(t))
  const minutes = minutesTonight(detail.stints, detail.stintPlayers, now)
  const onTeam = (t: Team) => here.filter((c) => c.team === t).map((c) => c.player_id)
  const keeperFor = (t: Team) =>
    suggestKeeper(onTeam(t), {
      happy: new Set(here.filter((c) => player(c.player_id)?.happy_in_goal).map((c) => c.player_id)),
      tonight: new Map([...minutes].map(([id, m]) => [id, m.inGoal])),
      season: seasonInGoal,
      name: playerName,
    })
  const keeper = (t: Team) => (t in keepers ? (keepers[t] ?? null) : keeperFor(t))
  const bench = here.filter((c) => c.team === null).map((c) => c.player_id)
  const sub =
    chosen.length === 2
      ? suggestSub(chosen.flatMap(onTeam), bench, new Map([...minutes].map(([id, m]) => [id, m.played])))
      : null

  async function run(name: string, action: () => Promise<unknown>) {
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

  // Tapping a third team swaps out the one picked first.
  function toggleTeam(t: Team) {
    setPicked(chosen.includes(t) ? chosen.filter((x) => x !== t) : [...chosen, t].slice(-2))
  }

  // The suggested sub takes the other player's place on the team board.
  function applySub() {
    if (!sub) return
    const team = here.find((c) => c.player_id === sub.out)?.team ?? null
    const board: BoardEntry[] = here.map((c) => ({
      player_id: c.player_id,
      team: c.player_id === sub.in ? team : c.player_id === sub.out ? null : c.team,
    }))
    setKeepers({})
    void run('sub', () => api.setTeamBoard(matchId, board))
  }

  function start() {
    unlockSound()
    const [one, two] = chosen
    void run('start', () => api.startGame(matchId, one, two, keeper(one), keeper(two)))
  }

  if (teams.length < 2) {
    return (
      <Card strong>
        <Heading>Next game</Heading>
        <Notice>Put players on at least two teams first.</Notice>
        <LinkButton to={`/nights/${matchId}/teams`} className="w-full">
          Team board
        </LinkButton>
      </Card>
    )
  }

  return (
    <Card strong>
      <Heading>Next game · Game {(last?.ordinal ?? 0) + 1}</Heading>
      <div className="mt-2 flex gap-2" role="group" aria-label="Teams playing">
        {teams.map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={chosen.includes(t)}
            onClick={() => toggleTeam(t)}
            className={`press min-h-12 rounded-full px-1 ${chosen.includes(t) ? 'ring-2 ring-ink' : 'opacity-40'}`}
          >
            <TeamTag team={t} />
          </button>
        ))}
      </div>

      {chosen.length === 2 &&
        chosen.map((t) => (
          <div key={t} className="mt-3">
            <p className="label mb-1.5 flex items-center gap-1">
              <GloveIcon size={14} /> Team {t} in goal
            </p>
            <div className="flex flex-wrap gap-1.5">
              {onTeam(t).map((id) => {
                const selected = keeper(t) === id
                const inGoal = minutes.get(id)?.inGoal ?? 0
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setKeepers((k) => ({ ...k, [t]: selected ? null : id }))}
                    className={`press min-h-10 rounded-full border-[1.5px] px-3 text-sm font-semibold ${
                      selected ? 'border-ink bg-ink text-paper' : 'border-line bg-paper'
                    }`}
                  >
                    <Name>{playerName(id)}</Name>
                    {inGoal > 0 && <span className="ml-1 font-normal opacity-70">{formatMinutes(inGoal)}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        ))}

      {sub && (
        <div className="mt-3 flex items-center gap-2 rounded-[10px] bg-ground px-2.5 py-2 text-sm">
          <p className="min-w-0 flex-1">
            Suggested sub: <Name className="font-bold">{playerName(sub.in)}</Name> in for{' '}
            <Name className="font-bold">{playerName(sub.out)}</Name> ({formatMinutes(minutes.get(sub.out)?.played ?? 0)})
          </p>
          <Button size="sm" variant="secondary" busy={busy === 'sub'} onClick={applySub}>
            Do it
          </Button>
        </div>
      )}

      <ErrorNote message={error} />
      <Button size="lg" className="mt-3 w-full" disabled={chosen.length !== 2 || busy !== null} busy={busy === 'start'} onClick={start}>
        Start game
      </Button>
    </Card>
  )
}
