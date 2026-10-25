// Unit tests for the rating calculation (compute_match_ratings, now in
// supabase/migrations/20261025000100_games.sql): one rating per player per
// night, from all its games. The worked examples come from section 6.4 of
// Plans/football-idea.md and section 3 of Plans/Football-scenario.md.
import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDb, MatchBuilder } from './helpers'

let db: PGlite

beforeAll(async () => {
  db = await createDb()
})

afterAll(async () => {
  await db.close()
})

const SIX_A_SIDE = {
  A: ['Player A', 'A2', 'A3', 'A4', 'A5', 'Keeper A'],
  B: ['B1', 'B2', 'B3', 'B4', 'B5', 'Keeper B'],
  gk: ['Keeper A', 'Keeper B'],
}
const ALL = [...SIX_A_SIDE.A, ...SIX_A_SIDE.B]

describe('worked examples from the original brief (one game, section 6.4)', () => {
  it('Player A: 2 goals, 1 assist, win, +2 net goals, peers 7.6 -> 8.3', async () => {
    const m = await MatchBuilder.create(db, ALL)
    await m.match(SIX_A_SIDE)
    await m.goal('Player A', 'A2')
    await m.goal('Player A')
    await m.goal('A3', 'Player A')
    await m.goal('B1') // 3-1: team A won, +2 net goals
    for (const [voter, score] of [['A2', 8], ['A3', 8], ['B1', 7], ['B2', 7], ['B3', 8]] as const) {
      await m.vote(voter, 'Player A', score)
    }

    const r = (await m.compute()).get('Player A')!
    expect(r.goals).toBe(2)
    expect(r.assists).toBe(1)
    expect(r.analytics).toBeCloseTo(8.7, 10) // 5 + 2.0 + 0.7 + 0.5 + 0.5
    expect(r.vote_average).toBeCloseTo(7.6, 10)
    expect(r.stats_only).toBe(false)
    expect(r.final).toBeCloseTo(8.315, 10) // 0.65 x 8.7 + 0.35 x 7.6
    expect(r.rating).toBe(8.3)
    expect(r.breakdown).toMatchObject({
      base: 5, goals: 2, assists: 0.7, net_goals: 0.5, result: 0.5, clean_sheets: 0, saves: 0, minutes: 60,
    })
  })

  it('Player B: no goals, lost by 1, peers 8.0 -> 5.6', async () => {
    const m = await MatchBuilder.create(db, ALL)
    await m.match(SIX_A_SIDE)
    await m.goal('A2')
    await m.goal('A3')
    await m.goal('B2') // 2-1: team B lost, -1 net goal
    await m.vote('B2', 'B1', 8)
    await m.vote('A2', 'B1', 8)

    const r = (await m.compute()).get('B1')!
    expect(r.analytics).toBeCloseTo(4.25, 10) // 5 - 0.25 - 0.5
    expect(r.vote_average).toBeCloseTo(8.0, 10)
    expect(r.final).toBeCloseTo(5.5625, 10) // 0.65 x 4.25 + 0.35 x 8.0
    expect(r.rating).toBe(5.6)
  })
})

describe('night ratings: worked examples (Football-scenario.md section 3)', () => {
  const FIVE = {
    A: ['P', 'A2', 'A3', 'A4', 'Keeper A'],
    B: ['B1', 'B2', 'B3', 'B4', 'Keeper B'],
    C: ['C1', 'C2', 'C3', 'C4', 'Keeper C'],
  }
  const KEEPERS = ['Keeper A', 'Keeper B', 'Keeper C']

  /**
   * Example 1's night: winner stays on, three teams, 10-minute games.
   * Game 1: A 2-1 B. Game 2: A 0-0 C, C wins on penalties. Game 3: C 1-2 B.
   * `late` players join Team B for game 3 only.
   */
  async function winnerStaysNight(late: string[] = []) {
    const m = await MatchBuilder.create(db, [...FIVE.A, ...FIVE.B, ...FIVE.C, ...late])
    await m.game('A', 'B')
    await m.period(10, { A: FIVE.A, B: FIVE.B, gk: KEEPERS })
    await m.goal('P', 'A2')
    await m.goal('A2')
    await m.goal('B1')
    await m.game('A', 'C', 'C')
    await m.period(10, { A: FIVE.A, C: FIVE.C, gk: KEEPERS })
    await m.game('C', 'B')
    await m.period(10, { C: FIVE.C, B: [...FIVE.B, ...late], gk: KEEPERS })
    await m.goal('C1')
    await m.goal('B1')
    await m.goal('B2')
    return m
  }

  /** Four a side; S starts on Team A and T on Team B. */
  const S_ON_A = { A: ['S', 'A2', 'A3', 'Keeper A'], B: ['T', 'B2', 'B3', 'Keeper B'], gk: ['Keeper A', 'Keeper B'] }
  const S_ON_B = { A: ['T', 'A2', 'A3', 'Keeper A'], B: ['S', 'B2', 'B3', 'Keeper B'], gk: ['Keeper A', 'Keeper B'] }
  const S_AND_T = ['S', 'T', 'A2', 'A3', 'Keeper A', 'B2', 'B3', 'Keeper B']

  it('Example 1: P plays games 1 and 2, scores once, peers 7.0 -> 6.7', async () => {
    const m = await winnerStaysNight()
    for (const [voter, score] of [['A2', 6], ['B1', 7], ['C1', 8]] as const) await m.vote(voter, 'P', score)

    const p = (await m.compute()).get('P')!
    expect(p.goals).toBe(1)
    expect(p.breakdown).toMatchObject({ goals: 1, net_goal_diff: 1, net_goals: 0.25, result: 0.25, minutes: 20 })
    expect(p.analytics).toBeCloseTo(6.5, 10) // 5 + 1.0 + 0.25 + 0.25
    expect(p.vote_average).toBeCloseTo(7, 10)
    expect(p.final).toBeCloseTo(6.675, 10) // 0.65 x 6.5 + 0.35 x 7.0
    expect(p.rating).toBe(6.7)
    expect(p.minutes_played).toBeCloseTo(20, 10)
  })

  it('Example 2: swap and continue: goal difference added up, result weighted by minutes', async () => {
    const m = await MatchBuilder.create(db, S_AND_T)
    await m.game('A', 'B')
    await m.period(6, S_ON_A)
    await m.goal('A2')
    await m.goal('A3') // A 2-0 B after 6 minutes; S and T swap, the score carries on
    await m.period(4, S_ON_B)
    await m.goal('B2') // final A 2-1 B

    const r = await m.compute()
    expect(r.get('S')!.breakdown).toMatchObject({ net_goal_diff: 3, net_goals: 0.75, result: 0.1 })
    expect(r.get('S')!.analytics).toBeCloseTo(5.85, 10)
    expect(r.get('T')!.breakdown).toMatchObject({ net_goal_diff: -3, net_goals: -0.75, result: -0.1 })
    expect(r.get('T')!.analytics).toBeCloseTo(4.15, 10)
  })

  it('Example 3: a late arrival who plays only game 3 (a 2-1 win) -> 5.75', async () => {
    const m = await winnerStaysNight(['Late Lad'])
    const late = (await m.compute()).get('Late Lad')!
    expect(late.breakdown).toMatchObject({ net_goals: 0.25, result: 0.5, minutes: 10 })
    expect(late.analytics).toBeCloseTo(5.75, 10)
  })

  it('Example 4: a clean sheet is a whole game in goal with nothing conceded', async () => {
    const r = await (await winnerStaysNight()).compute()
    // Keeper A: conceded in game 1, clean in game 2 (0-0, 10 minutes).
    expect(r.get('Keeper A')!.clean_sheets).toBe(1)
    expect(r.get('Keeper A')!.breakdown.clean_sheets).toBe(0.5)
    expect(r.get('Keeper A')!.analytics).toBeCloseTo(6, 10) // 5 + 0.25 + 0.25 + 0.5
    expect(r.get('Keeper A')!.minutes_in_goal).toBeCloseTo(20, 10)
    // Keeper C: clean in game 2, conceded two in game 3.
    expect(r.get('Keeper C')!.clean_sheets).toBe(1)
    expect(r.get('Keeper B')!.clean_sheets).toBe(0)
    expect(r.get('A2')!.clean_sheets).toBe(0) // outfield players never get it
  })

  it('Example 5: winning on penalties is still a draw', async () => {
    const r = await (await winnerStaysNight()).compute()
    // C2: game 2 a draw (0), game 3 a loss (-0.5), 10 minutes each -> -0.25.
    // Counting the shootout as a win would give 0.
    expect(r.get('C2')!.breakdown.result).toBe(-0.25)
    expect(r.get('C2')!.analytics).toBeCloseTo(4.5, 10) // 5 - 0.25 (net -1) - 0.25
    expect(r.get('C1')!.analytics).toBeCloseTo(5.5, 10) // the same + 1 goal
  })

  it('"End game and swap" makes two games, each with its own result', async () => {
    const m = await MatchBuilder.create(db, S_AND_T)
    await m.game('A', 'B')
    await m.period(6, S_ON_A)
    await m.goal('A2')
    await m.goal('A3') // game 1 ends A 2-0 B
    await m.game('A', 'B')
    await m.period(4, S_ON_B)
    await m.goal('B2') // game 2: B 1-0 A

    const r = await m.compute()
    // S won both games: +3 goal difference -> +0.75, result +0.5.
    expect(r.get('S')!.analytics).toBeCloseTo(6.25, 10)
    expect(r.get('T')!.analytics).toBeCloseTo(3.75, 10)
  })

  it('a night with no goals: the base for everyone, keepers a clean sheet per game', async () => {
    const m = await MatchBuilder.create(db, ALL)
    for (let i = 0; i < 2; i++) {
      await m.game('A', 'B')
      await m.period(10, SIX_A_SIDE)
    }
    const r = await m.compute()
    expect(r.size).toBe(12)
    expect(r.get('A2')!.analytics).toBeCloseTo(5, 10)
    expect(r.get('Keeper A')!.clean_sheets).toBe(2)
    expect(r.get('Keeper A')!.analytics).toBeCloseTo(6, 10) // 5 + 2 x 0.5
  })

  it('checked in but never on the pitch: only the base and the votes', async () => {
    const m = await MatchBuilder.create(db, [...ALL, 'Sub'])
    await m.match(SIX_A_SIDE)
    await m.goal('A2')
    await m.checkIn('Sub')
    await m.vote('A2', 'Sub', 8)
    await m.vote('B2', 'Sub', 6)

    const sub = (await m.compute()).get('Sub')!
    expect(sub.breakdown).toMatchObject({ net_goals: 0, result: 0, minutes: 0 })
    expect(sub.analytics).toBeCloseTo(5, 10)
    expect(sub.final).toBeCloseTo(0.65 * 5 + 0.35 * 7, 10)
  })

  it('a goalkeeper swapped mid-game gets no clean sheet, nor does a game under 8 minutes', async () => {
    const m = await MatchBuilder.create(db, ALL)
    // Game 1, 0-0 over 10 minutes: at half-time A2 takes over in goal from Keeper A.
    await m.game('A', 'B')
    await m.period(5, SIX_A_SIDE)
    await m.period(5, { ...SIX_A_SIDE, gk: ['A2', 'Keeper B'] })
    let r = await m.compute()
    expect(r.get('Keeper A')!.clean_sheets).toBe(0)
    expect(r.get('A2')!.clean_sheets).toBe(0)
    expect(r.get('Keeper B')!.clean_sheets).toBe(1) // in goal for the whole game
    expect(r.get('Keeper A')!.minutes_in_goal).toBeCloseTo(5, 10)

    // Game 2, 0-0 but only 6 minutes: too short for a clean sheet ...
    await m.game('A', 'B')
    await m.period(6, SIX_A_SIDE)
    r = await m.compute()
    expect(r.get('Keeper A')!.clean_sheets).toBe(0)
    // ... unless the owner lowers clean_sheet_min_minutes.
    await m.setConfig(`points = points || '{"clean_sheet_min_minutes": 5}'`)
    r = await m.compute()
    expect(r.get('Keeper A')!.clean_sheets).toBe(1)
  })

  it('team impact is added up over lineup periods, not averaged (the Phase 1 bug)', async () => {
    const m = await MatchBuilder.create(db, [...ALL, 'Late Lad'])
    // One 60-minute game. First half: A leads 2-0. Second half: Late Lad replaces Player A; B scores once.
    await m.game('A', 'B')
    await m.period(30, SIX_A_SIDE)
    await m.goal('A2')
    await m.goal('A3')
    await m.period(30, { A: ['Late Lad', 'A2', 'A3', 'A4', 'A5', 'Keeper A'], B: SIX_A_SIDE.B, gk: SIX_A_SIDE.gk })
    await m.goal('B1')

    const r = await m.compute()
    // Player A: +2 while on the pitch -> +0.5 (Phase 1 halved it to +0.25); A won the game -> +0.5.
    expect(r.get('Player A')!.breakdown).toMatchObject({ net_goal_diff: 2, net_goals: 0.5, result: 0.5 })
    // Late Lad: -1 -> -0.25, but A still won the game -> +0.5.
    expect(r.get('Late Lad')!.analytics).toBeCloseTo(5.25, 10)
    // Keeper A: +2 - 1 = +1 -> +0.25, win +0.5, no clean sheet (conceded in the game).
    expect(r.get('Keeper A')!.analytics).toBeCloseTo(5.75, 10)
  })
})

describe('edge cases', () => {
  it('a player with no votes gets a "stats only" rating (never hidden)', async () => {
    const m = await MatchBuilder.create(db, ALL)
    await m.match(SIX_A_SIDE)
    await m.goal('A2')

    const r = (await m.compute()).get('A4')!
    expect(r.vote_count).toBe(0)
    expect(r.vote_average).toBeNull()
    expect(r.stats_only).toBe(true)
    expect(r.analytics).toBeCloseTo(5.75, 10) // 5 + 0.25 (net +1) + 0.5 (win)
    expect(r.final).toBeCloseTo(5.75, 10)
  })

  it('fewer than 2 votes also means "stats only"; "Didn\'t see enough" is not counted', async () => {
    const m = await MatchBuilder.create(db, ALL)
    await m.match(SIX_A_SIDE)
    await m.vote('A2', 'A3', 9)
    await m.vote('B1', 'A3', null) // didn't see enough
    await m.vote('B2', 'A3', null)

    const r = (await m.compute()).get('A3')!
    expect(r.vote_count).toBe(1)
    expect(r.vote_average).toBeCloseTo(9, 10)
    expect(r.stats_only).toBe(true)
    expect(r.final).toBeCloseTo(5, 10) // 0-0 draw, votes ignored
  })

  it('goalkeeper with a clean sheet gets +0.5', async () => {
    const m = await MatchBuilder.create(db, ALL)
    await m.match(SIX_A_SIDE)
    await m.goal('A2')
    await m.goal('A3') // 2-0

    const ratings = await m.compute()
    const keeperA = ratings.get('Keeper A')!
    expect(keeperA.clean_sheets).toBe(1)
    expect(keeperA.analytics).toBeCloseTo(6.5, 10) // 5 + 0.5 (net +2) + 0.5 (win) + 0.5 (clean sheet)
    expect(ratings.get('Keeper B')!.clean_sheets).toBe(0)
    expect(ratings.get('A4')!.clean_sheets).toBe(0)
  })

  it('a match with no goals: everyone gets the base, keepers get a clean sheet', async () => {
    const m = await MatchBuilder.create(db, ALL)
    await m.match(SIX_A_SIDE)

    const ratings = await m.compute()
    expect(ratings.size).toBe(12)
    expect(ratings.get('A2')!.analytics).toBeCloseTo(5, 10)
    expect(ratings.get('B3')!.analytics).toBeCloseTo(5, 10)
    expect(ratings.get('Keeper A')!.analytics).toBeCloseTo(5.5, 10)
    expect(ratings.get('Keeper B')!.analytics).toBeCloseTo(5.5, 10)
  })
})

describe('caps, limits and options', () => {
  it('caps goals at +3.5, net goals at +1.5, and the analytics score at 10', async () => {
    const m = await MatchBuilder.create(db, ALL)
    await m.match(SIX_A_SIDE)
    for (let i = 0; i < 5; i++) await m.goal('Player A', 'A2')
    for (let i = 0; i < 3; i++) await m.goal('A2', 'Player A')
    for (let i = 0; i < 2; i++) await m.goal('A3', 'Player A') // 10-0

    const r = (await m.compute()).get('Player A')!
    expect(r.breakdown.goals).toBe(3.5) // 5 x 1.0 capped
    expect(r.breakdown.assists).toBe(2) // 5 x 0.7 capped
    expect(r.breakdown.net_goals).toBe(1.5) // 10 x 0.25 capped
    expect(r.analytics).toBe(10) // 12.5 clamped
  })

  it('caps net goals at -1.5 and clamps the analytics score at 1.0', async () => {
    const m = await MatchBuilder.create(db, ALL)
    await m.match(SIX_A_SIDE)
    for (let i = 0; i < 10; i++) await m.goal('B1')

    const keeperA = (await m.compute()).get('Keeper A')!
    expect(keeperA.breakdown.net_goals).toBe(-1.5)
    expect(keeperA.analytics).toBeCloseTo(3, 10) // 5 - 1.5 - 0.5

    await m.setConfig(`points = points || '{"base": 1.0}'`)
    const again = (await m.compute()).get('Keeper A')!
    expect(again.analytics).toBe(1) // 1 - 1.5 - 0.5 = -1 -> clamped to 1.0
  })

  it('clean sheet bonus is capped at +1.0', async () => {
    const m = await MatchBuilder.create(db, ALL)
    for (let i = 0; i < 3; i++) {
      await m.game('A', 'B')
      await m.period(10, SIX_A_SIDE) // three 0-0 games
    }

    const keeperA = (await m.compute()).get('Keeper A')!
    expect(keeperA.clean_sheets).toBe(3)
    expect(keeperA.breakdown.clean_sheets).toBe(1)
  })

  it('counts saves when a group logs them (+0.15 each, capped at +1.0)', async () => {
    const m = await MatchBuilder.create(db, ALL)
    await m.match(SIX_A_SIDE)
    await m.goal('A2')
    for (let i = 0; i < 4; i++) await m.save('Keeper B')

    const keeperB = (await m.compute()).get('Keeper B')!
    expect(keeperB.saves).toBe(4)
    expect(keeperB.breakdown.saves).toBeCloseTo(0.6, 10)
  })

  it('disputed goals do not count', async () => {
    const m = await MatchBuilder.create(db, ALL)
    await m.match(SIX_A_SIDE)
    await m.goal('Player A', null, { disputed: true })

    const ratings = await m.compute()
    expect(ratings.get('Player A')!.goals).toBe(0)
    expect(ratings.get('Player A')!.analytics).toBeCloseTo(5, 10)
    expect(ratings.get('Keeper B')!.clean_sheets).toBe(1)
  })

  it('Man of the Match: ties are shared and it does not change the rating', async () => {
    const m = await MatchBuilder.create(db, ALL)
    await m.match(SIX_A_SIDE)
    await m.mvp('A2', 'Player A')
    await m.mvp('A3', 'B1')
    await m.mvp('A4', 'B2')
    await m.mvp('B3', 'Player A')
    await m.mvp('B4', 'B1')

    const ratings = await m.compute()
    expect(ratings.get('Player A')!.is_mvp).toBe(true)
    expect(ratings.get('B1')!.is_mvp).toBe(true)
    expect(ratings.get('B2')!.is_mvp).toBe(false)
    expect(ratings.get('Player A')!.final).toBeCloseTo(ratings.get('A2')!.final, 10)
  })

  it('uses the group\'s weights from rating_config', async () => {
    const m = await MatchBuilder.create(db, ALL)
    await m.match(SIX_A_SIDE)
    await m.vote('A2', 'A3', 9)
    await m.vote('A4', 'A3', 7)
    await m.setConfig(`w_analytics = 0.5, w_votes = 0.5`)

    const r = (await m.compute()).get('A3')!
    expect(r.final).toBeCloseTo(0.5 * 5 + 0.5 * 8, 10)
    expect(r.breakdown.w_votes).toBe(0.5)
  })

  it('recomputing gives the same result (safe to run any number of times)', async () => {
    const m = await MatchBuilder.create(db, ALL)
    await m.match(SIX_A_SIDE)
    await m.goal('A2', 'A3')
    const first = await m.compute()
    const second = await m.compute()
    expect(second.size).toBe(first.size)
    expect(second.get('A2')!.final).toBe(first.get('A2')!.final)
  })
})
