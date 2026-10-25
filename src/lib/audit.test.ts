import { describe, expect, it } from 'vitest'
import { describeAudit, type AuditPart } from './audit'
import type { AuditEntry } from './types'

const names = {
  player: (id: string) => ({ p1: 'Omar', p2: 'Ziad' })[id] ?? 'Unknown player',
  user: (id: string) => ({ u1: 'Captain', u2: 'Omar' })[id] ?? 'a former member',
}

const entry = (action: string, details: Record<string, unknown> = {}, actor = 'u1'): AuditEntry => ({
  id: 'a1',
  actor_id: actor,
  action,
  details,
  created_at: '2026-10-22T19:14:00Z',
})

/** The sentence as plain text, names in [brackets]. */
const text = (parts: AuditPart[]) => parts.map((p) => (typeof p === 'string' ? p : `[${p.name}]`)).join('')
const say = (e: AuditEntry) => text(describeAudit(e, names))

describe('change history lines', () => {
  it('name the players involved', () => {
    expect(say(entry('checked_in', { player_id: 'p1' }))).toBe('checked [Omar] in')
    expect(say(entry('checked_out', { player_id: 'p1' }))).toBe('marked [Omar] as left')
    expect(say(entry('payment_marked', { player_id: 'p2' }))).toBe('ticked off the payment of [Ziad]')
  })

  it('goals: changed, deleted, disputed', () => {
    expect(say(entry('goal_edited', { scorer_id: 'p1', assister_id: 'p2' }))).toBe('changed a goal to [Omar], assist [Ziad]')
    expect(say(entry('goal_edited', { scorer_id: 'p1', assister_id: null }))).toBe('changed a goal to [Omar], no assist')
    expect(say(entry('goal_deleted', { goal: { scorer_id: 'p2' } }))).toBe('deleted a goal by [Ziad]')
    expect(say(entry('goal_disputed'))).toBe('disputed a goal')
  })

  it('voting, games and nights', () => {
    expect(say(entry('voting_extended', { hours: 12 }))).toBe('extended voting by 12 hours')
    expect(say(entry('players_swapped', { continue: false }))).toBe('swapped players and started a new game')
    expect(say(entry('players_swapped', { continue: true }))).toBe('swapped players, and the game went on')
    expect(say(entry('game_ended', { penalty_winner: 'C' }))).toBe('ended a game (Team C won on penalties)')
    expect(say(entry('game_ended', { penalty_winner: null }))).toBe('ended a game')
    expect(say(entry('night_cancelled', { reason: 'rain', fee: 0 }))).toBe('cancelled a night (Rain)')
    expect(say(entry('match_deleted', { played_at: '2026-10-22' }))).toBe('deleted the night of Thu 22 Oct')
  })

  it('members: admins, leaving and being removed', () => {
    expect(say(entry('member_role_changed', { user_id: 'u2', role: 'admin' }))).toBe('made [Omar] an admin')
    expect(say(entry('member_role_changed', { user_id: 'u2', role: 'member' }))).toBe('removed [Omar] as an admin')
    expect(say(entry('member_removed', { user_id: 'u2' }, 'u2'))).toBe('left the group')
    expect(say(entry('member_removed', { user_id: 'u9' }))).toBe('removed [a former member] from the group')
  })

  it("an action the app doesn't know yet shows its name", () => {
    expect(say(entry('something_new'))).toBe('something new')
  })
})
