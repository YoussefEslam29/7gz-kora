// Games during a night: scores, the next game (winner stays on), minutes on
// the pitch and in goal, and the goalkeeper and sub suggestions
// (Plans/Football-scenario.md section 2, Plans/Extras-and-backlog.md
// sections 3 and 4). Pure functions (tested in games.test.ts).
import { formatClock } from './format'
import type { CheckIn, Game, Goal, Stint, StintPlayer, Team } from './types'

export const TEAMS: Team[] = ['A', 'B', 'C']

/** A game's score: [team_one, team_two]. Disputed goals don't count. */
export function gameScore(
  game: Pick<Game, 'id' | 'team_one' | 'team_two'>,
  goals: Pick<Goal, 'game_id' | 'scoring_team' | 'disputed'>[],
): [number, number] {
  let one = 0
  let two = 0
  for (const g of goals) {
    if (g.game_id !== game.id || g.disputed) continue
    if (g.scoring_team === game.team_one) one++
    else if (g.scoring_team === game.team_two) two++
  }
  return [one, two]
}

/** Who won: more goals, or the penalty winner of a draw. null = a draw with no shootout. */
export function gameWinner(game: Pick<Game, 'team_one' | 'team_two' | 'penalty_winner'>, score: [number, number]): Team | null {
  if (score[0] > score[1]) return game.team_one
  if (score[1] > score[0]) return game.team_two
  return game.penalty_winner
}

/** The teams that have players on the board, in order (A, B, C). */
export function boardTeams(checkIns: Pick<CheckIn, 'team'>[]): Team[] {
  return TEAMS.filter((t) => checkIns.some((c) => c.team === t))
}

/**
 * The next game: the winner (or penalty winner) stays on and the waiting team
 * comes on. With two teams, the same two again. After a draw with no
 * shootout, the team that was already on (listed first) goes off. Only a
 * suggestion: the admin can change it.
 */
export function nextGameTeams(last: { game: Game; score: [number, number] } | null, teams: Team[]): [Team, Team] | null {
  if (teams.length < 2) return null
  const first: [Team, Team] = [teams[0], teams[1]]
  if (!last) return first
  const { game, score } = last
  const waiting = teams.find((t) => t !== game.team_one && t !== game.team_two)
  if (!waiting) {
    return teams.includes(game.team_one) && teams.includes(game.team_two) ? [game.team_one, game.team_two] : first
  }
  const stays = gameWinner(game, score) ?? game.team_two
  return teams.includes(stays) ? [stays, waiting] : first
}

/** Everyone who played in a game, with the team of their last period in it (for the goal grid). */
export function gameLineup(
  gameId: string,
  stints: Pick<Stint, 'id' | 'game_id' | 'ordinal'>[],
  lineups: StintPlayer[],
): StintPlayer[] {
  const latest = new Map<string, StintPlayer>()
  const periods = stints.filter((s) => s.game_id === gameId).sort((a, b) => b.ordinal - a.ordinal)
  for (const period of periods) {
    for (const sp of lineups) {
      if (sp.stint_id === period.id && !latest.has(sp.player_id)) latest.set(sp.player_id, sp)
    }
  }
  return [...latest.values()]
}

export interface Minutes {
  played: number
  inGoal: number
}

/** Minutes on the pitch and in goal, from the lineup periods. A period still going counts up to `now`. */
export function minutesTonight(
  stints: Pick<Stint, 'id' | 'started_at' | 'ended_at'>[],
  lineups: Pick<StintPlayer, 'stint_id' | 'player_id' | 'is_goalkeeper'>[],
  now: Date,
): Map<string, Minutes> {
  const length = new Map(
    stints.map((s) => [
      s.id,
      Math.max(0, (new Date(s.ended_at ?? now).getTime() - new Date(s.started_at).getTime()) / 60_000),
    ]),
  )
  const minutes = new Map<string, Minutes>()
  for (const sp of lineups) {
    const m = length.get(sp.stint_id) ?? 0
    const sofar = minutes.get(sp.player_id) ?? { played: 0, inGoal: 0 }
    minutes.set(sp.player_id, { played: sofar.played + m, inGoal: sofar.inGoal + (sp.is_goalkeeper ? m : 0) })
  }
  return minutes
}

/**
 * Who goes in goal for a team: players happy to play in goal first, then the
 * fewest minutes in goal tonight, then the fewest this season.
 */
export function suggestKeeper(
  playerIds: string[],
  by: { happy: Set<string>; tonight: Map<string, number>; season: Map<string, number>; name: (id: string) => string },
): string | null {
  const sorted = [...playerIds].sort(
    (a, b) =>
      Number(by.happy.has(b)) - Number(by.happy.has(a)) ||
      (by.tonight.get(a) ?? 0) - (by.tonight.get(b) ?? 0) ||
      (by.season.get(a) ?? 0) - (by.season.get(b) ?? 0) ||
      by.name(a).localeCompare(by.name(b)),
  )
  return sorted[0] ?? null
}

/** Fair playing time: the bench player with the fewest minutes in, for the player on the pitch with the most. */
export function suggestSub(
  onPitch: string[],
  bench: string[],
  played: Map<string, number>,
): { in: string; out: string } | null {
  if (onPitch.length === 0 || bench.length === 0) return null
  const mins = (id: string) => played.get(id) ?? 0
  const subIn = bench.reduce((best, id) => (mins(id) < mins(best) ? id : best))
  const subOut = onPitch.reduce((best, id) => (mins(id) > mins(best) ? id : best))
  return mins(subIn) < mins(subOut) ? { in: subIn, out: subOut } : null
}

/** The game clock: "07:42" of "10:00", and whether the set length is up. */
export function gameClock(startedAt: string, plannedMinutes: number, now: Date) {
  const seconds = Math.max(0, Math.floor((now.getTime() - new Date(startedAt).getTime()) / 1000))
  return {
    elapsed: formatClock(seconds),
    planned: formatClock(plannedMinutes * 60),
    overtime: seconds >= plannedMinutes * 60,
  }
}
