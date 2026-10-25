import { describe, expect, it } from 'vitest'
import {
  NEW_PLAYER_STRENGTH,
  playerStrength,
  suggestTeams,
  teamAverages,
  teamSizes,
  type SuggestedTeams,
  type SuggestPlayer,
} from './suggest'
import type { Team } from './types'

/** Players checked in a minute apart in this order (P1 first), none on the pitch, no minutes yet. */
function arrivals(strengths: number[]): SuggestPlayer[] {
  return strengths.map((strength, i) => ({
    id: `P${i + 1}`,
    strength,
    minutes: 0,
    arrivedAt: new Date(Date.UTC(2026, 9, 29, 18, i)).toISOString(),
    locked: null,
  }))
}

const evenly = (count: number) => arrivals(Array.from({ length: count }, () => 6.5))
/** Head counts: [Team A, Team B, Team C, bench]. */
const sizes = (s: SuggestedTeams) => [s.A.length, s.B.length, s.C.length, s.bench.length]
const average = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length

/** The average strength of each team that has players. */
function averages(s: SuggestedTeams, players: SuggestPlayer[]) {
  const strength = new Map(players.map((p) => [p.id, p.strength]))
  return (['A', 'B', 'C'] as Team[])
    .filter((t) => s[t].length > 0)
    .map((t) => average(s[t].map((id) => strength.get(id)!)))
}

describe('how many teams', () => {
  it('12 players at 6 a side: two teams of 6', () => {
    expect(teamSizes(12, 6, 3)).toEqual({ A: 6, B: 6, C: 0 })
    expect(sizes(suggestTeams(evenly(12), 6, 3))).toEqual([6, 6, 0, 0])
  })

  it('16 at 6 a side: 6 / 6 / 4 (the 4 left over make Team C)', () => {
    expect(sizes(suggestTeams(evenly(16), 6, 3))).toEqual([6, 6, 4, 0])
  })

  it('13 at 6 a side: 6 / 6 and 1 sub, the last to arrive', () => {
    const s = suggestTeams(evenly(13), 6, 3)
    expect(sizes(s)).toEqual([6, 6, 0, 1])
    expect(s.bench).toEqual(['P13'])
  })

  it('fewer than two full teams: two teams as even as possible (9 at 6 a side: 5 and 4)', () => {
    expect(sizes(suggestTeams(evenly(9), 6, 3))).toEqual([5, 4, 0, 0])
  })

  it('"Extra team from N players": 15 at 6 a side is 6 / 6 / 3, or 6 / 6 and 3 subs when N is 4', () => {
    expect(sizes(suggestTeams(evenly(15), 6, 3))).toEqual([6, 6, 3, 0])
    expect(sizes(suggestTeams(evenly(15), 6, 4))).toEqual([6, 6, 0, 3])
  })

  it('three teams at most: 20 at 6 a side is 6 / 6 / 6 and 2 subs', () => {
    expect(sizes(suggestTeams(evenly(20), 6, 3))).toEqual([6, 6, 6, 2])
  })
})

describe('fair teams', () => {
  it('a known set of 12 ratings: both teams average 6.75', () => {
    // The snake draft alone gives A 39.5 and B 41.5 (6.58 v 6.92); one swap evens them at 40.5 each.
    const players = arrivals([8.5, 8.5, 8, 7, 7, 7, 6.5, 6, 6, 6, 5.5, 5])
    const s = suggestTeams(players, 6, 3)
    expect(sizes(s)).toEqual([6, 6, 0, 0])
    const [a, b] = averages(s, players)
    expect(a).toBeCloseTo(6.75)
    expect(b).toBeCloseTo(6.75)
  })

  it('16 ratings in three teams end up within 0.05 of each other', () => {
    // The snake draft alone leaves 0.375 between the strongest and the weakest team.
    const players = arrivals([8.6, 8.1, 7.7, 7.4, 7.3, 7.1, 6.9, 6.6, 6.2, 6, 6, 6, 5.7, 5.5, 5.2, 4.9])
    const s = suggestTeams(players, 6, 3)
    expect(sizes(s)).toEqual([6, 6, 4, 0])
    const avgs = averages(s, players)
    expect(Math.max(...avgs) - Math.min(...avgs)).toBeLessThan(0.05)
  })

  it('players on the pitch stay on their team; the stronger latecomer joins the weaker team', () => {
    const onPitch = (id: string, strength: number, locked: Team): SuggestPlayer => ({
      id, strength, minutes: 10, arrivedAt: '2026-10-29T18:00:00Z', locked,
    })
    const players = [
      ...['A1', 'A2', 'A3', 'A4', 'A5'].map((id) => onPitch(id, 7, 'A')),
      ...['B1', 'B2', 'B3', 'B4', 'B5'].map((id) => onPitch(id, 6, 'B')),
      { id: 'Strong', strength: 8, minutes: 0, arrivedAt: '2026-10-29T18:20:00Z', locked: null },
      { id: 'Weak', strength: 5, minutes: 0, arrivedAt: '2026-10-29T18:21:00Z', locked: null },
    ]
    const s = suggestTeams(players, 6, 3)
    expect(s.A).toEqual(['A1', 'A2', 'A3', 'A4', 'A5', 'Weak'])
    expect(s.B).toEqual(['Strong', 'B1', 'B2', 'B3', 'B4', 'B5'])
    expect(s.C).toEqual([])
    expect(s.bench).toEqual([])
  })
})

describe('who sits out', () => {
  it('whoever has played the most tonight, then the last to arrive', () => {
    // 14 at 6 a side: 2 subs. P3 has played 40 minutes; P7 and P12 30; everyone else 20.
    const minutes: Record<string, number> = { P3: 40, P7: 30, P12: 30 }
    const players = evenly(14).map((p) => ({ ...p, minutes: minutes[p.id] ?? 20 }))
    expect(suggestTeams(players, 6, 3).bench).toEqual(['P3', 'P12'])
  })
})

describe('strength', () => {
  it('the season rating, then the all-time rating, then 6.0 for someone new', () => {
    const season = new Map([['Omar', 7.4]])
    const allTime = new Map([['Omar', 6.9], ['Ziad', 6.2]])
    expect(playerStrength('Omar', season, allTime)).toBe(7.4)
    expect(playerStrength('Ziad', season, allTime)).toBe(6.2)
    expect(playerStrength('محمد', season, allTime)).toBe(NEW_PLAYER_STRENGTH)
    expect(NEW_PLAYER_STRENGTH).toBe(6)
  })

  it("each team's average on the board; an empty team has none", () => {
    const picks = new Map<string, Team | null>([['Omar', 'A'], ['Ziad', 'A'], ['Ali', 'B'], ['Seif', null]])
    const strength = (id: string) => ({ Omar: 8, Ziad: 6, Ali: 6.5, Seif: 9 })[id] ?? 6
    expect(teamAverages(picks, strength)).toEqual({ A: 7, B: 6.5, C: null })
  })
})
