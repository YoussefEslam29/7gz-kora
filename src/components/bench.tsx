// Who isn't on the pitch right now (the waiting team and the bench, with
// minutes tonight), and everyone's playing time (Plans/Extras-and-backlog.md
// sections 3 and 4).
import { Link } from 'react-router'
import { formatMinutes } from '../lib/format'
import { boardTeams, minutesTonight, suggestSub } from '../lib/games'
import type { MatchDetail } from '../lib/types'
import { useNow } from '../lib/useNow'
import { useCurrentGroup } from '../state/group'
import { Card, Heading, Name, TeamTag } from './ui'

/** The teams not playing, and the bench with minutes tonight. During a game, admins see a suggested sub. */
export function WaitingAndBench({ detail }: { detail: MatchDetail }) {
  const { playerName, isAdmin } = useCurrentGroup()
  const now = useNow(30_000)
  const minutes = minutesTonight(detail.stints, detail.stintPlayers, now)
  const played = (id: string) => minutes.get(id)?.played ?? 0
  const game = detail.runningGame
  const playing = game ? [game.team_one, game.team_two] : []
  const here = detail.checkIns.filter((c) => !c.left_at)
  const others = boardTeams(here).filter((t) => !playing.includes(t))
  const bench = here.filter((c) => c.team === null).map((c) => c.player_id)
  const sub =
    game && isAdmin
      ? suggestSub(detail.lineup.map((p) => p.player_id), bench, new Map([...minutes].map(([id, m]) => [id, m.played])))
      : null

  if (others.length === 0 && bench.length === 0) return null
  return (
    <>
      {others.map((team) => (
        <Card key={team}>
          <div className="flex items-center justify-between">
            <Heading>{game ? 'Waiting' : 'Team'}</Heading>
            <TeamTag team={team} />
          </div>
          <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-sm">
            {here
              .filter((c) => c.team === team)
              .map((c) => (
                <li key={c.player_id}>
                  <Name className="font-semibold">{playerName(c.player_id)}</Name>
                </li>
              ))}
          </ul>
        </Card>
      ))}
      {bench.length > 0 && (
        <Card>
          <Heading>Bench · minutes tonight</Heading>
          <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-sm">
            {bench.map((id) => (
              <li key={id}>
                <Name className="font-bold">{playerName(id)}</Name> {formatMinutes(played(id))}
              </li>
            ))}
          </ul>
          {sub && (
            <Link
              to={`/nights/${detail.match.id}/swap?in=${sub.in}&out=${sub.out}`}
              className="mt-2.5 block rounded-[10px] bg-ground px-2.5 py-2 text-sm"
            >
              Suggested sub: <Name className="font-bold">{playerName(sub.in)}</Name> in for{' '}
              <Name className="font-bold">{playerName(sub.out)}</Name> ({formatMinutes(played(sub.out))}).{' '}
              <span className="font-semibold text-brand-ink underline">Sub in</span>
            </Link>
          )}
        </Card>
      )}
    </>
  )
}

/** Minutes on the pitch and in goal tonight, most first. */
export function PlayingTime({ detail }: { detail: MatchDetail }) {
  const { playerName } = useCurrentGroup()
  const now = useNow(30_000)
  if (detail.stints.length === 0) return null
  const minutes = minutesTonight(detail.stints, detail.stintPlayers, now)
  const rows = detail.checkIns
    .map((c) => ({ id: c.player_id, ...(minutes.get(c.player_id) ?? { played: 0, inGoal: 0 }) }))
    .sort((a, b) => b.played - a.played || playerName(a.id).localeCompare(playerName(b.id)))
  return (
    <Card>
      <Heading className="mb-1">Playing time</Heading>
      <table className="tabular w-full text-sm">
        <thead>
          <tr className="text-xs text-muted">
            <th className="py-1 text-left font-semibold">Player</th>
            <th className="py-1 text-right font-semibold">On the pitch</th>
            <th className="py-1 text-right font-semibold">In goal</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="py-1.5">
                <Name className="font-semibold">{playerName(r.id)}</Name>
              </td>
              <td className="py-1.5 text-right">{formatMinutes(r.played)}</td>
              <td className="py-1.5 text-right">{r.inGoal > 0 ? formatMinutes(r.inGoal) : '–'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}
