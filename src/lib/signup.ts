// The sign-up questions (Plans/Accounts-groups-and-chat.md section 2): one
// per screen, each with Skip. Pure functions, tested in signup.test.ts.
import { accountInput, NO_SKILLS, SKILLS } from './card'
import type { Account, AccountInput, Skills } from './types'

export type SignUpStep = 'name' | 'shirt' | 'foot' | 'position' | keyof Skills | 'goal' | 'motto' | 'card'

export const SIGN_UP_STEPS: SignUpStep[] = [
  'name',
  'shirt',
  'foot',
  'position',
  ...SKILLS.map((s) => s.key),
  'goal',
  'motto',
  'card',
]

export const isSkillStep = (step: SignUpStep): step is keyof Skills => SKILLS.some((s) => s.key === step)

/** What Skip clears on each question. The name keeps the Google name; the card has no Skip. */
const SKIPPED: Partial<Record<SignUpStep, Partial<AccountInput>>> = {
  shirt: { shirt_number: null },
  foot: { strong_foot: null },
  position: { favourite_position: null },
  goal: { happy_in_goal: false },
  motto: { motto: null },
}

/**
 * Skip: clears the question and moves on. On a skill it skips all five
 * (they're all five or none) and goes to "Happy to play in goal?".
 */
export function skipStep(index: number, draft: AccountInput): { index: number; draft: AccountInput } {
  const step = SIGN_UP_STEPS[index]
  if (isSkillStep(step)) return { index: SIGN_UP_STEPS.indexOf('goal'), draft: { ...draft, ...NO_SKILLS } }
  return { index: Math.min(index + 1, SIGN_UP_STEPS.length - 1), draft: { ...draft, ...SKIPPED[step] } }
}

/** The answers start from the account (empty when it's new), named after the Google account. */
export function startDraft(account: Account, googleName: string): AccountInput {
  return { ...accountInput(account), display_name: account.display_name || googleName }
}
