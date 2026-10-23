// Unit tests for the rating calculation (compute_match_ratings in
// supabase/migrations/20261023000200_rating.sql).
// The first two tests are the worked examples from section 6.4 of the brief.
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

describe('worked examples (section 6.4)', () => {
  it('Player A: 2 goals, 1 assist, win, +2 net goals, peers 7.6 -> 8.3', async () => {
    const m = await MatchBuilder.create(db, ALL)
    await m.stint(1, SIX_A_SIDE)
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
      base: 5, goals: 2, assists: 0.7, net_goals: 0.5, result: 0.5, clean_sheets: 0, saves: 0,
    })
  })

  it('Player B: no goals, lost by 1, peers 8.0 -> 5.6', async () => {
    const m = await MatchBuilder.create(db, ALL)
    await m.stint(1, { A: SIX_A_SIDE.A, B: [...SIX_A_SIDE.B.slice(0, 5), 'Keeper B'], gk: SIX_A_SIDE.gk })
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

describe('edge cases', () => {
  it('a player with no votes gets a "stats only" rating (never hidden)', async () => {
    const m = await MatchBuilder.create(db, ALL)
    await m.stint(1, SIX_A_SIDE)
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
    await m.stint(1, SIX_A_SIDE)
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
    await m.stint(1, SIX_A_SIDE)
    await m.goal('A2')
    await m.goal('A3') // 2-0

    const ratings = await m.compute()
    const keeperA = ratings.get('Keeper A')!
    expect(keeperA.clean_sheets).toBe(1)
    expect(keeperA.analytics).toBeCloseTo(6.5, 10) // 5 + 0.5 (net +2) + 0.5 (win) + 0.5 (clean sheet)
    expect(ratings.get('Keeper B')!.clean_sheets).toBe(0)
    expect(ratings.get('A4')!.clean_sheets).toBe(0) // outfield players never get it
  })

  it('a player present for only one of two stints is weighted by that stint', async () => {
    const m = await MatchBuilder.create(db, [...ALL, 'Late Lad'])
    // Stint 1 (half the match): Player A plays for A, and A wins it 2-0.
    await m.stint(1, SIX_A_SIDE)
    await m.goal('A2')
    await m.goal('A3')
    // Stint 2 (other half): Player A has left; Late Lad replaces them; B scores once.
    await m.stint(1, {
      A: ['Late Lad', 'A2', 'A3', 'A4', 'A5', 'Keeper A'],
      B: SIX_A_SIDE.B,
      gk: SIX_A_SIDE.gk,
    })
    await m.goal('B1')

    const ratings = await m.compute()
    const playerA = ratings.get('Player A')!
    // net: +2 x 0.5 = +1 -> +0.25 ; result: win in stint 1 only -> 0.5 x 0.5 = +0.25
    expect(playerA.analytics).toBeCloseTo(5.5, 10)

    const late = ratings.get('Late Lad')!
    // net: -1 x 0.5 -> -0.125 ; result: loss in stint 2 only -> -0.25
    expect(late.analytics).toBeCloseTo(4.625, 10)

    const keeperA = ratings.get('Keeper A')!
    // Played both: net (+2 - 1) x 0.5 = +0.5 -> +0.125 ; result 0.25 - 0.25 = 0 ;
    // clean sheet in stint 1 (50% of the match >= 25%) -> +0.5
    expect(keeperA.clean_sheets).toBe(1)
    expect(keeperA.analytics).toBeCloseTo(5.625, 10)
  })

  it('a match with no goals: everyone gets the base, keepers get a clean sheet', async () => {
    const m = await MatchBuilder.create(db, ALL)
    await m.stint(1, SIX_A_SIDE)

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
    await m.stint(1, SIX_A_SIDE)
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
    await m.stint(1, SIX_A_SIDE)
    for (let i = 0; i < 10; i++) await m.goal('B1')

    const keeperA = (await m.compute()).get('Keeper A')!
    expect(keeperA.breakdown.net_goals).toBe(-1.5)
    expect(keeperA.analytics).toBeCloseTo(3, 10) // 5 - 1.5 - 0.5

    await m.setConfig(`points = points || '{"base": 1.0}'`)
    const again = (await m.compute()).get('Keeper A')!
    expect(again.analytics).toBe(1) // 1 - 1.5 - 0.5 = -1 -> clamped to 1.0
  })

  it('no clean sheet for a stint shorter than 25% of the match', async () => {
    const m = await MatchBuilder.create(db, ALL)
    await m.stint(1, SIX_A_SIDE) // 20% of the match, keeper A keeps a clean sheet
    for (let i = 0; i < 4; i++) {
      await m.stint(1, { A: SIX_A_SIDE.A, B: SIX_A_SIDE.B, gk: ['Keeper B'] })
      await m.goal('B1')
    }

    expect((await m.compute()).get('Keeper A')!.clean_sheets).toBe(0)
  })

  it('clean sheet bonus is capped at +1.0', async () => {
    const m = await MatchBuilder.create(db, ALL)
    for (let i = 0; i < 3; i++) await m.stint(1, SIX_A_SIDE) // three thirds, no goals

    const keeperA = (await m.compute()).get('Keeper A')!
    expect(keeperA.clean_sheets).toBe(3)
    expect(keeperA.breakdown.clean_sheets).toBe(1)
  })

  it('counts saves when a group logs them (+0.15 each, capped at +1.0)', async () => {
    const m = await MatchBuilder.create(db, ALL)
    await m.stint(1, SIX_A_SIDE)
    await m.goal('A2')
    for (let i = 0; i < 4; i++) await m.save('Keeper B')

    const keeperB = (await m.compute()).get('Keeper B')!
    expect(keeperB.saves).toBe(4)
    expect(keeperB.breakdown.saves).toBeCloseTo(0.6, 10)
  })

  it('disputed goals do not count', async () => {
    const m = await MatchBuilder.create(db, ALL)
    await m.stint(1, SIX_A_SIDE)
    await m.goal('Player A', null, { disputed: true })

    const ratings = await m.compute()
    expect(ratings.get('Player A')!.goals).toBe(0)
    expect(ratings.get('Player A')!.analytics).toBeCloseTo(5, 10)
    expect(ratings.get('Keeper B')!.clean_sheets).toBe(1)
  })

  it('Man of the Match: ties are shared and it does not change the rating', async () => {
    const m = await MatchBuilder.create(db, ALL)
    await m.stint(1, SIX_A_SIDE)
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
    await m.stint(1, SIX_A_SIDE)
    await m.vote('A2', 'A3', 9)
    await m.vote('A4', 'A3', 7)
    await m.setConfig(`w_analytics = 0.5, w_votes = 0.5`)

    const r = (await m.compute()).get('A3')!
    expect(r.final).toBeCloseTo(0.5 * 5 + 0.5 * 8, 10)
    expect(r.breakdown.w_votes).toBe(0.5)
  })

  it('recomputing gives the same result (safe to run any number of times)', async () => {
    const m = await MatchBuilder.create(db, ALL)
    await m.stint(1, SIX_A_SIDE)
    await m.goal('A2', 'A3')
    const first = await m.compute()
    const second = await m.compute()
    expect(second.size).toBe(first.size)
    expect(second.get('A2')!.final).toBe(first.get('A2')!.final)
  })
})
