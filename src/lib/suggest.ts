// The team suggester (Plans/Football-scenario.md section 5): fair teams from
// the ratings already stored. Pure functions (tested in suggest.test.ts).
import { TEAMS } from './games'
import type { Team } from './types'

/** The strength of a player with no rating yet. */
export const NEW_PLAYER_STRENGTH = 6

/** A player's strength: their season rating, then their all-time rating, then 6.0 for someone new. */
export function playerStrength(playerId: string, season: Map<string, number>, allTime: Map<string, number>): number {
  return season.get(playerId) ?? allTime.get(playerId) ?? NEW_PLAYER_STRENGTH
}

/**
 * How many players each team gets. Fewer than two full teams: two teams as
 * even as possible. Otherwise two teams of `perSide`, and the players left
 * over make Team C (up to a full side) when there are at least `minExtraTeam`
 * of them. Everyone else is on the bench.
 */
export function teamSizes(count: number, perSide: number, minExtraTeam: number): Record<Team, number> {
  if (count < 2 * perSide) return { A: Math.ceil(count / 2), B: Math.floor(count / 2), C: 0 }
  const left = count - 2 * perSide
  return { A: perSide, B: perSide, C: left >= minExtraTeam ? Math.min(left, perSide) : 0 }
}

export interface SuggestPlayer {
  id: string
  /** From playerStrength. */
  strength: number
  /** Minutes on the pitch tonight: whoever has played the most sits out first. */
  minutes: number
  /** Check-in time: with equal minutes, the last to arrive sits out first. */
  arrivedAt: string
  /** On the pitch in the game now: stays on this team. */
  locked: Team | null
}

/** Each team strongest first, and the bench in the order they sit out. */
export type SuggestedTeams = Record<Team, string[]> & { bench: string[] }

type Board = Record<Team, SuggestPlayer[]>

const PAIRS: [Team, Team][] = [['A', 'B'], ['A', 'C'], ['B', 'C']]
const average = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length

/** The gap between the strongest and the weakest team average (teams with players only). */
function spread(board: Board): number {
  const averages = TEAMS.filter((t) => board[t].length > 0).map((t) => average(board[t].map((p) => p.strength)))
  return averages.length < 2 ? 0 : Math.max(...averages) - Math.min(...averages)
}

function swap(board: Board, x: Team, i: number, y: Team, j: number) {
  const p = board[x][i]
  board[x][i] = board[y][j]
  board[y][j] = p
}

/**
 * Fair teams: who sits out first, then a snake draft (best to A, next to B,
 * next to C, then back the other way), then pair swaps while they reduce the
 * gap between the strongest and weakest team averages. Players on the pitch
 * stay on their team and are never swapped. Goalkeepers are picked per game,
 * not here. Ties keep the order the players are given in.
 */
export function suggestTeams(players: SuggestPlayer[], perSide: number, minExtraTeam: number): SuggestedTeams {
  const sizes = teamSizes(players.length, perSide, minExtraTeam)
  const board: Board = { A: [], B: [], C: [] }
  for (const p of players) if (p.locked) board[p.locked].push(p)
  const open: Record<Team, number> = { A: 0, B: 0, C: 0 }
  for (const t of TEAMS) open[t] = Math.max(0, sizes[t] - board[t].length)

  // Who sits out: the most minutes tonight, then the last to arrive.
  const free = players.filter((p) => !p.locked)
  const seats = Math.min(free.length, open.A + open.B + open.C)
  const sitOut = [...free].sort((a, b) => b.minutes - a.minutes || b.arrivedAt.localeCompare(a.arrivedAt))
  const bench = sitOut.slice(0, free.length - seats)
  const draft = free.filter((p) => !bench.includes(p)).sort((a, b) => b.strength - a.strength)

  // Snake draft: A, B, C, then C, B, A, skipping full teams.
  let next = 0
  for (let round = 0; next < draft.length; round++) {
    for (const t of round % 2 === 0 ? TEAMS : [...TEAMS].reverse()) {
      if (open[t] > 0 && next < draft.length) {
        board[t].push(draft[next++])
        open[t]--
      }
    }
  }

  // Pair swaps: each round makes the swap that narrows the gap most, until none does.
  for (;;) {
    const now = spread(board)
    let best: { gap: number; x: Team; i: number; y: Team; j: number } | null = null
    for (const [x, y] of PAIRS) {
      for (let i = 0; i < board[x].length; i++) {
        for (let j = 0; j < board[y].length; j++) {
          if (board[x][i].locked || board[y][j].locked) continue
          swap(board, x, i, y, j)
          const gap = spread(board)
          swap(board, x, i, y, j)
          if (gap < (best?.gap ?? now) - 1e-9) best = { gap, x, i, y, j }
        }
      }
    }
    if (!best) break
    swap(board, best.x, best.i, best.y, best.j)
  }

  const ids = (list: SuggestPlayer[]) => [...list].sort((a, b) => b.strength - a.strength).map((p) => p.id)
  return { A: ids(board.A), B: ids(board.B), C: ids(board.C), bench: bench.map((p) => p.id) }
}

/** Each team's average strength on the board; null for an empty team. */
export function teamAverages(
  picks: Map<string, Team | null>,
  strength: (playerId: string) => number,
): Record<Team, number | null> {
  const result: Record<Team, number | null> = { A: null, B: null, C: null }
  for (const t of TEAMS) {
    const members = [...picks].filter(([, team]) => team === t).map(([playerId]) => strength(playerId))
    result[t] = members.length > 0 ? average(members) : null
  }
  return result
}
