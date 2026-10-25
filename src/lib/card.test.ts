import { describe, expect, it } from 'vitest'
import { cleanCard, confidence, friendsScore, isCardFilled, selfRating, skillsState } from './card'
import type { CardFields, LeaderboardRow, Skills } from './types'

const skills = (values: (number | null)[]): Skills => ({
  skill_shooting: values[0],
  skill_passing: values[1],
  skill_dribbling: values[2],
  skill_defending: values[3],
  skill_fitness: values[4],
})

const emptyCard: CardFields = {
  ...skills([null, null, null, null, null]),
  shirt_number: null,
  strong_foot: null,
  favourite_position: null,
  motto: null,
}

describe('self-rating', () => {
  it('is the average of the five skills: 8, 7, 8, 6, 9 → 7.6', () => {
    expect(selfRating(skills([8, 7, 8, 6, 9]))).toBe(7.6)
  })

  it('is rounded to one decimal', () => {
    expect(selfRating(skills([7, 7, 7, 7, 8]))).toBe(7.2)
  })

  it('needs all five skills', () => {
    expect(selfRating(skills([null, null, null, null, null]))).toBeNull()
    expect(selfRating(skills([8, null, 8, 6, 9]))).toBeNull()
    expect(skillsState(skills([8, 7, 8, 6, 9]))).toBe('all')
    expect(skillsState(skills([8, null, 8, 6, 9]))).toBe('some')
    expect(skillsState(skills([null, null, null, null, null]))).toBe('none')
  })
})

describe('self vs friends', () => {
  it('self 7.6, friends 6.4: +1.2, confident', () => {
    expect(confidence(7.6, 6.4)).toEqual({ gap: 1.2, level: 'confident' })
  })

  it('self 6.0, friends 7.3: −1.3, modest', () => {
    expect(confidence(6, 7.3)).toEqual({ gap: -1.3, level: 'modest' })
  })

  it('self 7.0, friends 7.4: −0.4, spot on', () => {
    expect(confidence(7, 7.4)).toEqual({ gap: -0.4, level: 'spot_on' })
  })

  it('self 9.0, friends 6.4: +2.6, very confident', () => {
    expect(confidence(9, 6.4)).toEqual({ gap: 2.6, level: 'very_confident' })
  })

  it('the edges: −1.0 is modest, +1.0 confident, +2.0 very confident', () => {
    expect(confidence(5.4, 6.4).level).toBe('modest')
    expect(confidence(7.4, 6.4).level).toBe('confident')
    expect(confidence(8.4, 6.4).level).toBe('very_confident')
  })
})

/** A table row with `matches` rated nights; ranked from 3 nights, as by default. */
const row = (matches: number, avgVotes: number | null): LeaderboardRow => ({
  player_id: 'p',
  display_name: 'P',
  matches,
  avg_rating: 6.5,
  avg_rating_exact: 6.5,
  goals: 0,
  assists: 0,
  mvps: 0,
  clean_sheets: 0,
  avg_votes: avgVotes,
  qualified: matches >= 3,
  avg_minutes: 30,
  minutes_in_goal: 0,
})

describe("friends' score", () => {
  it("this season's, once there are 3 rated nights this season", () => {
    expect(friendsScore(row(3, 6.4), row(10, 7.1), 3)).toEqual({ kind: 'score', score: 6.4, season: true })
  })

  it('otherwise all-time, with the same rule', () => {
    expect(friendsScore(row(1, 8), row(5, 7.1), 3)).toEqual({ kind: 'score', score: 7.1, season: false })
    expect(friendsScore(undefined, row(5, 7.1), 3)).toEqual({ kind: 'score', score: 7.1, season: false })
  })

  it('otherwise how many more rated nights are needed', () => {
    expect(friendsScore(row(1, 8), row(1, 8), 3)).toEqual({ kind: 'wait', nightsToGo: 2 })
    expect(friendsScore(undefined, undefined, 3)).toEqual({ kind: 'wait', nightsToGo: 3 })
  })

  it('with no vote average (all "didn\'t see", or stats only): not enough votes yet', () => {
    expect(friendsScore(row(4, null), row(4, null), 3)).toEqual({ kind: 'no_votes' })
  })
})

describe('the card', () => {
  it('counts as filled in with the skills or any other field', () => {
    expect(isCardFilled(emptyCard)).toBe(false)
    expect(isCardFilled({ ...emptyCard, shirt_number: 10 })).toBe(true)
    expect(isCardFilled({ ...emptyCard, ...skills([8, 7, 8, 6, 9]) })).toBe(true)
  })

  it('saves the motto trimmed, and an empty one as none', () => {
    expect(cleanCard({ ...emptyCard, motto: '  Pass it to me ' }).motto).toBe('Pass it to me')
    expect(cleanCard({ ...emptyCard, motto: '   ' }).motto).toBeNull()
  })
})
