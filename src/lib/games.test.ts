import { describe, expect, it } from 'vitest'
import {
  boardTeams,
  gameClock,
  gameLineup,
  gameScore,
  gameWinner,
  minutesTonight,
  nextGameTeams,
  suggestKeeper,
  suggestSub,
} from './games'
import type { Game, Goal, StintPlayer, Team } from './types'

const game = (id: string, team_one: Team, team_two: Team, extra: Partial<Game> = {}): Game => ({
  id,
  match_id: 'm',
  ordinal: 1,
  team_one,
  team_two,
  planned_minutes: 10,
  started_at: '2026-10-29T18:00:00Z',
  ended_at: '2026-10-29T18:10:00Z',
  penalty_winner: null,
  ...extra,
})
const goal = (game_id: string, scoring_team: Team, disputed = false): Pick<Goal, 'game_id' | 'scoring_team' | 'disputed'> => ({
  game_id,
  scoring_team,
  disputed,
})
const ABC: Team[] = ['A', 'B', 'C']

describe('scores and winners', () => {
  it("counts each team's goals in the game; disputed goals don't count", () => {
    const g = game('g1', 'A', 'C')
    const goals = [goal('g1', 'A'), goal('g1', 'C'), goal('g1', 'A'), goal('g1', 'A', true), goal('g2', 'C')]
    expect(gameScore(g, goals)).toEqual([2, 1])
  })

  it('the winner has more goals; a draw is won only on penalties', () => {
    expect(gameWinner(game('g', 'A', 'B'), [2, 1])).toBe('A')
    expect(gameWinner(game('g', 'A', 'B'), [0, 1])).toBe('B')
    expect(gameWinner(game('g', 'A', 'C'), [0, 0])).toBeNull()
    expect(gameWinner(game('g', 'A', 'C', { penalty_winner: 'C' }), [0, 0])).toBe('C')
  })

  it("the board's teams are the ones with players, in order", () => {
    expect(boardTeams([{ team: 'C' }, { team: null }, { team: 'A' }, { team: 'A' }])).toEqual(['A', 'C'])
  })
})

describe('the next game (winner stays on)', () => {
  it('the first game is between the first two teams', () => {
    expect(nextGameTeams(null, ABC)).toEqual(['A', 'B'])
    expect(nextGameTeams(null, ['A'])).toBeNull()
  })

  it('three teams: the winner stays and the waiting team comes on (worked example 1)', () => {
    expect(nextGameTeams({ game: game('1', 'A', 'B'), score: [2, 1] }, ABC)).toEqual(['A', 'C'])
    // A 0-0 C and C wins on penalties: C stays, B comes on.
    expect(nextGameTeams({ game: game('2', 'A', 'C', { penalty_winner: 'C' }), score: [0, 0] }, ABC)).toEqual(['C', 'B'])
  })

  it('a draw without penalties: the team that was already on goes off', () => {
    expect(nextGameTeams({ game: game('3', 'C', 'B'), score: [1, 1] }, ABC)).toEqual(['B', 'A'])
  })

  it('two teams: the same two again', () => {
    expect(nextGameTeams({ game: game('1', 'A', 'B'), score: [0, 3] }, ['A', 'B'])).toEqual(['A', 'B'])
  })
})

describe('minutes', () => {
  const stints = [
    { id: 's1', game_id: 'g1', ordinal: 1, started_at: '2026-10-29T18:00:00Z', ended_at: '2026-10-29T18:06:00Z' },
    { id: 's2', game_id: 'g1', ordinal: 2, started_at: '2026-10-29T18:06:00Z', ended_at: '2026-10-29T18:10:00Z' },
    { id: 's3', game_id: 'g2', ordinal: 3, started_at: '2026-10-29T18:12:00Z', ended_at: null },
  ]
  const sp = (stint_id: string, player_id: string, team: Team, is_goalkeeper = false): StintPlayer => ({
    stint_id,
    player_id,
    team,
    is_goalkeeper,
  })
  const lineups = [
    sp('s1', 'S', 'A'), sp('s1', 'K', 'A', true), sp('s1', 'T', 'B'),
    sp('s2', 'S', 'B'), sp('s2', 'K', 'A', true), sp('s2', 'T', 'A'),
    sp('s3', 'K', 'A'), sp('s3', 'S', 'B', true),
  ]

  it('adds up minutes on the pitch and in goal; a period still going counts up to now', () => {
    const m = minutesTonight(stints, lineups, new Date('2026-10-29T18:17:00Z'))
    expect(m.get('S')).toEqual({ played: 15, inGoal: 5 })
    expect(m.get('K')).toEqual({ played: 15, inGoal: 10 })
    expect(m.get('T')).toEqual({ played: 10, inGoal: 0 })
    expect(m.get('nobody')).toBeUndefined()
  })

  it('who played in a game, with the team they finished it on (for the goal grid)', () => {
    const players = gameLineup('g1', stints, lineups)
    expect(players.map((p) => [p.player_id, p.team]).sort()).toEqual([['K', 'A'], ['S', 'B'], ['T', 'A']])
  })
})

describe('suggestions', () => {
  const name = (id: string) => id

  it('keeper: happy to play in goal first, then fewest minutes in goal tonight, then this season', () => {
    const tonight = new Map([['Ali', 10], ['Omar', 0], ['Ziad', 0]])
    const season = new Map([['Omar', 120], ['Ziad', 30]])
    expect(suggestKeeper(['Ali', 'Omar', 'Ziad'], { happy: new Set(), tonight, season, name })).toBe('Ziad')
    expect(suggestKeeper(['Ali', 'Omar', 'Ziad'], { happy: new Set(['Ali']), tonight, season, name })).toBe('Ali')
    expect(suggestKeeper([], { happy: new Set(), tonight, season, name })).toBeNull()
  })

  it('sub: the bench player with the fewest minutes in for the player on the pitch with the most', () => {
    const played = new Map([['Omar', 38], ['Karim', 20], ['Ziad', 12], ['Mostafa', 20]])
    expect(suggestSub(['Omar', 'Karim'], ['Ziad', 'Mostafa'], played)).toEqual({ in: 'Ziad', out: 'Omar' })
    expect(suggestSub(['Omar'], [], played)).toBeNull()
    // Nobody on the bench has played less: no suggestion.
    expect(suggestSub(['Ziad'], ['Omar'], played)).toBeNull()
  })
})

describe('the game clock', () => {
  it('counts up from the start; time is up at the set length', () => {
    const start = '2026-10-29T18:00:00Z'
    expect(gameClock(start, 10, new Date('2026-10-29T18:07:42Z'))).toEqual({ elapsed: '07:42', planned: '10:00', overtime: false })
    expect(gameClock(start, 10, new Date('2026-10-29T18:10:00Z')).overtime).toBe(true)
    expect(gameClock(start, 10, new Date('2026-10-29T17:59:58Z')).elapsed).toBe('00:00')
  })
})
