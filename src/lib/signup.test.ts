import { describe, expect, it } from 'vitest'
import { SIGN_UP_STEPS, skipStep, startDraft } from './signup'
import type { Account, AccountInput } from './types'

const draft: AccountInput = {
  display_name: 'Omar',
  shirt_number: 10,
  strong_foot: 'left',
  favourite_position: 'attack',
  motto: 'Hi',
  skill_shooting: 8,
  skill_passing: 7,
  skill_dribbling: null,
  skill_defending: null,
  skill_fitness: null,
  happy_in_goal: true,
  show_stats: true,
  instapay_phone: null,
}

const newAccount: Account = {
  id: 'u1', email: 'omar@example.com', display_name: '', avatar_url: null, created_at: '2026-10-26T10:00:00Z',
  shirt_number: null, strong_foot: null, favourite_position: null, motto: null,
  skill_shooting: null, skill_passing: null, skill_dribbling: null, skill_defending: null, skill_fitness: null,
  happy_in_goal: false, show_stats: true, instapay_phone: null, onboarded_at: null,
}

describe('the sign-up questions', () => {
  it('are 12, with the five skills one by one', () => {
    expect(SIGN_UP_STEPS).toEqual([
      'name', 'shirt', 'foot', 'position',
      'skill_shooting', 'skill_passing', 'skill_dribbling', 'skill_defending', 'skill_fitness',
      'goal', 'motto', 'card',
    ])
  })

  it('Skip clears the question and moves to the next', () => {
    expect(skipStep(1, draft)).toEqual({ index: 2, draft: { ...draft, shirt_number: null } })
    expect(skipStep(9, draft)).toEqual({ index: 10, draft: { ...draft, happy_in_goal: false } })
  })

  it('Skip on any skill skips all five and goes to "Happy in goal"', () => {
    const { index, draft: skipped } = skipStep(SIGN_UP_STEPS.indexOf('skill_passing'), draft)
    expect(SIGN_UP_STEPS[index]).toBe('goal')
    expect([skipped.skill_shooting, skipped.skill_passing, skipped.skill_fitness]).toEqual([null, null, null])
  })

  it('Skip on the name keeps the name', () => {
    expect(skipStep(0, draft)).toEqual({ index: 1, draft })
  })

  it('a new account starts with the Google name; a named one keeps its own', () => {
    expect(startDraft(newAccount, 'Omar Google').display_name).toBe('Omar Google')
    expect(startDraft({ ...newAccount, display_name: 'Omar' }, 'Omar Google').display_name).toBe('Omar')
    expect(startDraft(newAccount, 'x')).toMatchObject({ show_stats: true, happy_in_goal: false, shirt_number: null })
  })
})
