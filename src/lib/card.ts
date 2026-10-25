// The player card (Plans/Player-card-and-motion.md): the self-rating from
// five skills, and how it compares with what friends give. Pure functions,
// tested in card.test.ts. Nothing here changes a night's rating.
import type { CardFields, Foot, LeaderboardRow, Position, Skills } from './types'

export const SKILLS: { key: keyof Skills; label: string }[] = [
  { key: 'skill_shooting', label: 'Shooting' },
  { key: 'skill_passing', label: 'Passing' },
  { key: 'skill_dribbling', label: 'Dribbling' },
  { key: 'skill_defending', label: 'Defending' },
  { key: 'skill_fitness', label: 'Fitness' },
]

/** label: in the picker. chip: on the card. */
export const FEET: { value: Foot; label: string; chip: string }[] = [
  { value: 'right', label: 'Right', chip: 'Right foot' },
  { value: 'left', label: 'Left', chip: 'Left foot' },
  { value: 'both', label: 'Both', chip: 'Both feet' },
]

export const POSITIONS: { value: Position; label: string }[] = [
  { value: 'goal', label: 'Goal' },
  { value: 'defence', label: 'Defence' },
  { value: 'midfield', label: 'Midfield' },
  { value: 'attack', label: 'Attack' },
  { value: 'anywhere', label: 'Anywhere' },
]

/** "all": a self-rating. "none": no self-rating. "some": can't be saved yet. */
export function skillsState(skills: Skills): 'all' | 'none' | 'some' {
  const set = SKILLS.filter((s) => skills[s.key] != null).length
  return set === SKILLS.length ? 'all' : set === 0 ? 'none' : 'some'
}

/** The average of the five skills, to one decimal; null unless all five are set. */
export function selfRating(skills: Skills): number | null {
  if (skillsState(skills) !== 'all') return null
  const total = SKILLS.reduce((sum, s) => sum + (skills[s.key] ?? 0), 0)
  return Math.round((total / SKILLS.length) * 10) / 10
}

/** A card counts as filled in once it has the skills or any other field. */
export function isCardFilled(card: CardFields): boolean {
  return (
    skillsState(card) !== 'none' ||
    card.shirt_number != null ||
    card.strong_foot != null ||
    card.favourite_position != null ||
    card.motto != null
  )
}

/** The card as it's saved: the motto trimmed, and an empty one as none. */
export function cleanCard<T extends CardFields>(card: T): T {
  const motto = card.motto?.trim() ?? ''
  return { ...card, motto: motto === '' ? null : motto }
}

export type Confidence = 'modest' | 'spot_on' | 'confident' | 'very_confident'

export const CONFIDENCE: Record<Confidence, { label: string; note: string }> = {
  modest: { label: 'Modest', note: "Friends' votes are higher than the self-rating." },
  spot_on: { label: 'Spot on', note: "The self-rating matches friends' votes." },
  confident: { label: 'Confident', note: "The self-rating is a bit above friends' votes." },
  very_confident: { label: 'Very confident', note: "The self-rating is well above friends' votes." },
}

/** The meter's edges: a gap of −1.0 or less is modest, +1.0 or more confident, +2.0 or more very confident. */
export const MODEST_GAP = -1
export const CONFIDENT_GAP = 1
export const VERY_CONFIDENT_GAP = 2

/** The self-rating minus friends' score, to one decimal, and what it means. */
export function confidence(self: number, friends: number): { gap: number; level: Confidence } {
  const gap = Math.round((self - friends) * 10) / 10
  const level: Confidence =
    gap <= MODEST_GAP
      ? 'modest'
      : gap >= VERY_CONFIDENT_GAP
        ? 'very_confident'
        : gap >= CONFIDENT_GAP
          ? 'confident'
          : 'spot_on'
  return { gap, level }
}

export type FriendsScore =
  | { kind: 'score'; score: number; season: boolean }
  | { kind: 'wait'; nightsToGo: number }
  | { kind: 'no_votes' }

/**
 * What friends give: the average of the night-by-night peer vote averages
 * (avg_votes on the table). This season's once the player is ranked this
 * season (enough rated nights), otherwise all-time with the same rule.
 */
export function friendsScore(
  season: LeaderboardRow | undefined,
  allTime: LeaderboardRow | undefined,
  minNights: number,
): FriendsScore {
  const row = season?.qualified ? season : allTime?.qualified ? allTime : undefined
  if (!row) return { kind: 'wait', nightsToGo: Math.max(1, minNights - (allTime?.matches ?? 0)) }
  if (row.avg_votes == null) return { kind: 'no_votes' }
  return { kind: 'score', score: Number(row.avg_votes), season: row === season }
}
