// Tests for nights (supabase/migrations/20261024000100_nights.sql): planning,
// "I'm in" / "Out" and the waiting list, check-in, ending or cancelling a
// night, and the money split. Acting as real signed-in users with RLS on.
// The worked examples come from Plans/Football-scenario.md and
// Plans/Extras-and-backlog.md.
import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDb, createUser, nightDetails, rpc, selectAs, setupGroup, startNight } from './helpers'

let db: PGlite

beforeAll(async () => {
  db = await createDb()
})

afterAll(async () => {
  await db.close()
})

async function expectError(promise: Promise<unknown>, message: RegExp) {
  await expect(promise).rejects.toThrow(message)
}

async function planNight(admin: string, groupId: string, overrides: Record<string, unknown> = {}) {
  const [{ plan_night: id }] = await rpc<{ plan_night: string }>(db, admin, 'plan_night', {
    p_group_id: groupId,
    p_night: nightDetails(overrides),
  })
  return id
}

type NightRow = {
  status: string
  location: string
  cost: string
  players_per_side: number
  collector_player_id: string | null
  player_cap: number | null
  starts_at: Date
  cancel_reason: string | null
}

async function night(user: string, matchId: string): Promise<NightRow> {
  const [row] = await selectAs<NightRow>(db, user, `select * from matches where id = $1`, [matchId])
  return row
}

describe('planning a night', () => {
  it('admins plan a night that every member can see', async () => {
    const { groupId, users, pid } = await setupGroup(db)
    await expectError(planNight(users.Omar, groupId), /Only group admins/)

    const id = await planNight(users.admin, groupId, { collector_player_id: pid(users.Ziad) })
    const n = await night(users.Omar, id)
    expect(n.status).toBe('draft')
    expect(n.location).toBe('Club pitch 3')
    expect(Number(n.cost)).toBe(600)
    expect(n.players_per_side).toBe(6)
    expect(n.player_cap).toBe(18)
    expect(n.collector_player_id).toBe(pid(users.Ziad))
    expect(new Date(n.starts_at).toISOString()).toBe('2026-10-29T18:00:00.000Z')
  })

  it('checks the details with friendly messages', async () => {
    const { groupId, users } = await setupGroup(db)
    const other = await setupGroup(db)
    await expectError(planNight(users.admin, groupId, { players_per_side: 4 }), /between 5 and 11/)
    await expectError(planNight(users.admin, groupId, { cost: -1 }), /cost/)
    await expectError(planNight(users.admin, groupId, { player_cap: 1 }), /player limit/)
    await expectError(planNight(users.admin, groupId, { starts_at: null }), /date and start time/)
    await expectError(
      planNight(users.admin, groupId, { collector_player_id: other.pid(other.users.Omar) }),
      /collector must be a player in this group/,
    )
  })

  it('admins edit a night, including "no limit"', async () => {
    const { groupId, users } = await setupGroup(db)
    const id = await planNight(users.admin, groupId)
    await expectError(
      rpc(db, users.Omar, 'update_night', { p_match_id: id, p_night: nightDetails() }),
      /Only group admins/,
    )
    await rpc(db, users.admin, 'update_night', {
      p_match_id: id,
      p_night: nightDetails({ location: 'Pitch 5', cost: 700, player_cap: null }),
    })
    const n = await night(users.Omar, id)
    expect(n.location).toBe('Pitch 5')
    expect(Number(n.cost)).toBe(700)
    expect(n.player_cap).toBeNull()
  })
})

async function reply(user: string, matchId: string, status: 'in' | 'out') {
  const [{ set_rsvp }] = await rpc<{ set_rsvp: string }>(db, user, 'set_rsvp', { p_match_id: matchId, p_status: status })
  return set_rsvp
}

type Reply = { player_id: string; status: string; promoted_at: Date | null; spot_taken_by: string | null }

async function replies(user: string, matchId: string) {
  return selectAs<Reply>(db, user, `select * from rsvps where match_id = $1`, [matchId])
}

describe('"I\'m in" / "Out" and the waiting list', () => {
  it('members answer for themselves and can change their mind', async () => {
    const { groupId, users, pid } = await setupGroup(db)
    const id = await planNight(users.admin, groupId)
    expect(await reply(users.Omar, id, 'in')).toBe('in')
    expect(await reply(users.Ziad, id, 'out')).toBe('out')
    expect(await reply(users.Omar, id, 'out')).toBe('out')
    expect(await reply(users.Omar, id, 'in')).toBe('in')

    const rows = await replies(users['محمد'], id)
    expect(rows.find((r) => r.player_id === pid(users.Omar))!.status).toBe('in')
    expect(rows.find((r) => r.player_id === pid(users.Ziad))!.status).toBe('out')

    const stranger = await createUser(db, 'Stranger')
    await expectError(reply(stranger, id, 'in'), /not a member/)
    await expectError(rpc(db, users.Omar, 'set_rsvp', { p_match_id: id, p_status: 'maybe' }), /Reply "in" or "out"/)
  })

  it('a full night puts people on the waiting list, first come first served', async () => {
    const { groupId, users, pid } = await setupGroup(db, ['A', 'B', 'C', 'D', 'E'])
    const id = await planNight(users.admin, groupId, { player_cap: 3 })
    for (const name of ['A', 'B', 'C']) expect(await reply(users[name], id, 'in')).toBe('in')
    expect(await reply(users.D, id, 'in')).toBe('waiting')
    expect(await reply(users.E, id, 'in')).toBe('waiting')
    // Tapping "I'm in" again keeps your place.
    expect(await reply(users.D, id, 'in')).toBe('waiting')

    // B drops out: D, first on the list, moves up and took B's spot.
    await reply(users.B, id, 'out')
    let rows = await replies(users.A, id)
    const row = (name: string) => rows.find((r) => r.player_id === pid(users[name]))!
    expect(row('D').status).toBe('in')
    expect(row('D').promoted_at).not.toBeNull()
    expect(row('B').spot_taken_by).toBe(pid(users.D))
    expect(row('E').status).toBe('waiting')

    // E leaves the waiting list: nobody's spot is involved.
    await reply(users.E, id, 'out')
    // B changes their mind, but the night is full again: back of the list.
    expect(await reply(users.B, id, 'in')).toBe('waiting')

    // The admin raises the limit: B moves up.
    await rpc(db, users.admin, 'update_night', { p_match_id: id, p_night: nightDetails({ player_cap: 5 }) })
    rows = await replies(users.A, id)
    expect(row('B').status).toBe('in')
    expect(row('E').status).toBe('out')
    expect(row('E').spot_taken_by).toBeNull()
  })

  it('no limit means no waiting list', async () => {
    const { groupId, users } = await setupGroup(db, ['A', 'B', 'C'])
    const id = await planNight(users.admin, groupId, { player_cap: null })
    for (const name of ['A', 'B', 'C']) expect(await reply(users[name], id, 'in')).toBe('in')
  })
})

type CheckInRow = { arrived_at: Date; left_at: Date | null }

describe('at the pitch: start and check-in', () => {
  it('only admins start a night, once; replies close', async () => {
    const { groupId, users } = await setupGroup(db)
    const id = await planNight(users.admin, groupId)
    await expectError(rpc(db, users.Omar, 'start_night', { p_match_id: id }), /Only group admins/)
    await rpc(db, users.admin, 'start_night', { p_match_id: id })
    expect((await night(users.Omar, id)).status).toBe('playing')
    await expectError(rpc(db, users.admin, 'start_night', { p_match_id: id }), /already started/)
    await expectError(reply(users.Omar, id, 'in'), /Replies are closed/)
  })

  it('admins check in anyone in the group, and mark who left early', async () => {
    const { groupId, users, pid } = await setupGroup(db)
    const id = await planNight(users.admin, groupId)
    await expectError(
      rpc(db, users.admin, 'check_in', { p_match_id: id, p_player_id: pid(users.Omar) }),
      /Start the night first/,
    )
    await rpc(db, users.admin, 'start_night', { p_match_id: id })
    await expectError(
      rpc(db, users.Omar, 'check_in', { p_match_id: id, p_player_id: pid(users.Omar) }),
      /Only group admins/,
    )

    // Ziad never replied but came: he can still be checked in.
    await rpc(db, users.admin, 'check_in', { p_match_id: id, p_player_id: pid(users.Ziad) })
    const ziad = async () =>
      (await selectAs<CheckInRow>(db, users.Omar,
        `select arrived_at, left_at from match_players where match_id = $1 and player_id = $2`,
        [id, pid(users.Ziad)]))[0]
    const arrived = (await ziad()).arrived_at
    expect(arrived).not.toBeNull()

    await rpc(db, users.admin, 'check_out', { p_match_id: id, p_player_id: pid(users.Ziad) })
    expect((await ziad()).left_at).not.toBeNull()
    // Back again: no longer marked as left, arrival time unchanged.
    await rpc(db, users.admin, 'check_in', { p_match_id: id, p_player_id: pid(users.Ziad) })
    expect((await ziad()).left_at).toBeNull()
    expect((await ziad()).arrived_at).toEqual(arrived)

    const other = await setupGroup(db)
    await expectError(
      rpc(db, users.admin, 'check_in', { p_match_id: id, p_player_id: other.pid(other.users.Omar) }),
      /not in this group/,
    )
    await expectError(
      rpc(db, users.admin, 'check_out', { p_match_id: id, p_player_id: pid(users.Omar) }),
      /not checked in/,
    )
  })

  it('a check-in made by mistake can be undone, unless they already scored', async () => {
    const { groupId, users, pid } = await setupGroup(db)
    const id = await startNight(db, users.admin, groupId, [pid(users.Omar), pid(users.Ziad), pid(users['محمد'])])
    await rpc(db, users.admin, 'save_lineup', {
      p_match_id: id,
      p_lineup: [{ player_id: pid(users.Omar), team: 'A' }, { player_id: pid(users.Ziad), team: 'B' }],
    })
    await rpc(db, users.admin, 'log_goal', { p_match_id: id, p_scorer_id: pid(users.Ziad), p_assister_id: null })
    await expectError(
      rpc(db, users.admin, 'undo_check_in', { p_match_id: id, p_player_id: pid(users.Ziad) }),
      /scored or assisted/,
    )
    await rpc(db, users.admin, 'undo_check_in', { p_match_id: id, p_player_id: pid(users['محمد']) })
    expect(await selectAs(db, users.Omar, `select player_id from match_players where match_id = $1`, [id])).toHaveLength(2)
  })

  it('teams are picked from the players checked in; the rest are on the bench', async () => {
    const { groupId, users, pid } = await setupGroup(db)
    const id = await planNight(users.admin, groupId)
    const lineup = [{ player_id: pid(users.Omar), team: 'A' }, { player_id: pid(users.Ziad), team: 'B' }]
    await expectError(rpc(db, users.admin, 'save_lineup', { p_match_id: id, p_lineup: lineup }), /Start the night first/)
    await expectError(
      rpc(db, users.admin, 'log_goal', { p_match_id: id, p_scorer_id: pid(users.Omar), p_assister_id: null }),
      /Start the night/,
    )
    await rpc(db, users.admin, 'start_night', { p_match_id: id })
    await rpc(db, users.admin, 'check_in', { p_match_id: id, p_player_id: pid(users.Omar) })
    await expectError(rpc(db, users.admin, 'save_lineup', { p_match_id: id, p_lineup: lineup }), /Check in Ziad first/)

    await rpc(db, users.admin, 'check_in', { p_match_id: id, p_player_id: pid(users.Ziad) })
    await rpc(db, users.admin, 'check_in', { p_match_id: id, p_player_id: pid(users['محمد']) })
    await rpc(db, users.admin, 'save_lineup', { p_match_id: id, p_lineup: lineup })
    // محمد is on the bench but still part of the night.
    expect(await selectAs(db, users.Omar, `select player_id from match_players where match_id = $1`, [id])).toHaveLength(3)
  })
})

describe('ending or cancelling a night', () => {
  it('End night opens voting for everyone checked in, not for "I\'m in" no-shows', async () => {
    const { groupId, users, pid } = await setupGroup(db)
    const id = await planNight(users.admin, groupId)
    await reply(users['محمد'], id, 'in')
    await rpc(db, users.admin, 'start_night', { p_match_id: id })
    await rpc(db, users.admin, 'check_in', { p_match_id: id, p_player_id: pid(users.Omar) })
    await expectError(rpc(db, users.admin, 'end_night', { p_match_id: id }), /at least 2 players/)
    await rpc(db, users.admin, 'check_in', { p_match_id: id, p_player_id: pid(users.Ziad) })
    await expectError(rpc(db, users.Omar, 'end_night', { p_match_id: id }), /Only group admins/)
    await rpc(db, users.admin, 'end_night', { p_match_id: id })

    expect((await night(users.Omar, id)).status).toBe('voting')
    const status = await rpc<{ player_id: string }>(db, users.Omar, 'vote_status', { p_match_id: id })
    expect(status.map((s) => s.player_id).sort()).toEqual([pid(users.Omar), pid(users.Ziad)].sort())
    await expectError(
      rpc(db, users['محمد'], 'submit_votes', {
        p_match_id: id, p_votes: [{ target_id: pid(users.Omar), score: 7 }], p_mvp_id: null,
      }),
      /Only players who played/,
    )
    await expectError(rpc(db, users.admin, 'end_night', { p_match_id: id }), /in progress/)
  })

  it('a cancelled night counts for nothing', async () => {
    const { groupId, users, pid } = await setupGroup(db)
    const id = await startNight(db, users.admin, groupId, [pid(users.Omar), pid(users.Ziad)])
    const cancel = (by: string, reason: string, note: string | null = null) =>
      rpc(db, by, 'cancel_night', { p_match_id: id, p_reason: reason, p_note: note, p_fee: 0 })
    await expectError(cancel(users.Omar, 'rain'), /Only group admins/)
    await expectError(cancel(users.admin, 'other', '  '), /note/)
    await cancel(users.admin, 'rain')

    const n = await night(users.Omar, id)
    expect(n.status).toBe('cancelled')
    expect(n.cancel_reason).toBe('rain')
    await expectError(rpc(db, users.admin, 'end_night', { p_match_id: id }), /in progress/)
    await expectError(
      rpc(db, users.Omar, 'submit_votes', { p_match_id: id, p_votes: [], p_mvp_id: null }),
      /Voting is closed/,
    )
    await expectError(
      rpc(db, users.admin, 'check_in', { p_match_id: id, p_player_id: pid(users['محمد']) }),
      /cancelled/,
    )
    await expectError(cancel(users.admin, 'rain'), /Only a planned night or one in progress/)
    expect(await rpc(db, users.Omar, 'get_leaderboard', { p_group_id: groupId, p_year: null })).toHaveLength(0)
    const [{ close_due_matches: closed }] = await rpc<{ close_due_matches: number }>(
      db, users.Omar, 'close_due_matches', { p_group_id: groupId },
    )
    expect(closed).toBe(0)
  })

  it('a planned night can be cancelled before it starts; replies close', async () => {
    const { groupId, users } = await setupGroup(db)
    const id = await planNight(users.admin, groupId)
    await rpc(db, users.admin, 'cancel_night', {
      p_match_id: id, p_reason: 'not_enough_players', p_note: null, p_fee: 0,
    })
    await expectError(reply(users.Omar, id, 'in'), /Replies are closed/)
    await expectError(rpc(db, users.admin, 'start_night', { p_match_id: id }), /cancelled/)
  })
})

describe('money: the rent split', () => {
  type Payer = { player_id: string; share: number; paid_at: Date | null; is_collector: boolean }
  const money = (user: string, id: string) => rpc<Payer>(db, user, 'night_money', { p_match_id: id })
  const ELEVEN = Array.from({ length: 11 }, (_, i) => `P${i + 2}`) // P2 ... P12

  /** The worked example: 13 players checked in (the admin, Ahmed the collector, P2-P12), 600 EGP. */
  async function bigNight(extra: string[] = []) {
    const g = await setupGroup(db, ['Ahmed', ...ELEVEN, ...extra])
    const thirteen = [g.users.admin, g.users.Ahmed, ...ELEVEN.map((n) => g.users[n])]
    const id = await startNight(db, g.users.admin, g.groupId, thirteen.map(g.pid),
      nightDetails({ collector_player_id: g.pid(g.users.Ahmed) }))
    return { ...g, id }
  }

  it('worked example: 600 EGP and 13 players -> 47 EGP each; the collector counts as paid', async () => {
    const { users, id, pid } = await bigNight()
    expect(await money(users.P2, id)).toHaveLength(0) // no money card while the night is on
    await rpc(db, users.admin, 'end_night', { p_match_id: id })

    const rows = await money(users.P2, id)
    expect(rows).toHaveLength(13)
    expect(rows.every((r) => r.share === 47)).toBe(true) // 600 / 13 = 46.15 -> 47 (611 collected, 11 extra)
    expect(rows.filter((r) => r.is_collector).map((r) => r.player_id)).toEqual([pid(users.Ahmed)])
  })

  it('the collector or an admin ticks payments; nobody ticks their own', async () => {
    const { users, id, pid } = await bigNight()
    await rpc(db, users.admin, 'end_night', { p_match_id: id })
    const mark = (by: string, who: string) => rpc(db, by, 'mark_paid', { p_match_id: id, p_player_id: pid(who) })

    await expectError(mark(users.P2, users.P3), /Only the collector or an admin/)
    await expectError(mark(users.P2, users.P2), /your own share/)
    await expectError(mark(users.admin, users.admin), /your own share/)
    await expectError(mark(users.admin, users.Ahmed), /collector counts as paid/)
    for (const name of ['P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8']) await mark(users.Ahmed, users[name])
    await mark(users.admin, users.P9)

    const paid = (await money(users.P2, id)).filter((r) => r.is_collector || r.paid_at !== null)
    expect(paid).toHaveLength(9) // 9 x 47 = 423 of 611 collected

    await rpc(db, users.Ahmed, 'unmark_paid', { p_match_id: id, p_player_id: pid(users.P9) })
    expect((await money(users.P2, id)).filter((r) => r.paid_at !== null)).toHaveLength(7)
  })

  it('"I\'m in" but never came pays nothing; a late check-in recalculates, ticks stay', async () => {
    const g = await setupGroup(db, ['Ahmed', ...ELEVEN, 'NoShow', 'Late'])
    const id = await planNight(g.users.admin, g.groupId, { collector_player_id: g.pid(g.users.Ahmed) })
    await reply(g.users.NoShow, id, 'in')
    await rpc(db, g.users.admin, 'start_night', { p_match_id: id })
    for (const user of [g.users.admin, g.users.Ahmed, ...ELEVEN.map((n) => g.users[n])]) {
      await rpc(db, g.users.admin, 'check_in', { p_match_id: id, p_player_id: g.pid(user) })
    }
    await rpc(db, g.users.admin, 'end_night', { p_match_id: id })
    await rpc(db, g.users.Ahmed, 'mark_paid', { p_match_id: id, p_player_id: g.pid(g.users.P2) })

    let rows = await money(g.users.P2, id)
    expect(rows).toHaveLength(13)
    expect(rows.some((r) => r.player_id === g.pid(g.users.NoShow))).toBe(false)
    await expectError(
      rpc(db, g.users.admin, 'mark_paid', { p_match_id: id, p_player_id: g.pid(g.users.NoShow) }),
      /nothing to pay/,
    )

    // Someone forgotten is checked in while voting is open: 600 / 14 = 42.86 -> 43.
    await rpc(db, g.users.admin, 'check_in', { p_match_id: id, p_player_id: g.pid(g.users.Late) })
    rows = await money(g.users.P2, id)
    expect(rows).toHaveLength(14)
    expect(rows.every((r) => r.share === 43)).toBe(true)
    expect(rows.find((r) => r.player_id === g.pid(g.users.P2))!.paid_at).not.toBeNull()
  })

  it('a cancelled night: a fee is split among those checked in, or those who said "I\'m in"', async () => {
    const { groupId, users, pid } = await setupGroup(db, ['A', 'B', 'C', 'D', 'E'])

    // Called off before anyone arrived: 300 EGP among the 4 who said "I'm in".
    const early = await planNight(users.admin, groupId)
    for (const name of ['A', 'B', 'C', 'D']) await reply(users[name], early, 'in')
    await reply(users.E, early, 'out')
    await rpc(db, users.admin, 'cancel_night', { p_match_id: early, p_reason: 'rain', p_note: null, p_fee: 300 })
    const rows = await money(users.A, early)
    expect(rows).toHaveLength(4)
    expect(rows.every((r) => r.share === 75)).toBe(true)

    // Called off at the pitch: 100 EGP among the 3 checked in -> 33.33 -> 34 each.
    const late = await startNight(db, users.admin, groupId, [pid(users.A), pid(users.B), pid(users.C)])
    await rpc(db, users.admin, 'cancel_night', { p_match_id: late, p_reason: 'pitch_problem', p_note: null, p_fee: 100 })
    expect((await money(users.A, late)).map((r) => r.share)).toEqual([34, 34, 34])

    // Nothing charged: no money card.
    const free = await startNight(db, users.admin, groupId, [pid(users.A), pid(users.B)])
    await rpc(db, users.admin, 'cancel_night', { p_match_id: free, p_reason: 'rain', p_note: null, p_fee: 0 })
    expect(await money(users.A, free)).toHaveLength(0)
  })

  it('"You owe" lists your unpaid shares', async () => {
    const { users, id, pid, groupId } = await bigNight()
    await rpc(db, users.admin, 'end_night', { p_match_id: id })
    type Owed = { match_id: string; share: number; currency: string; collector_player_id: string }
    const owed = (user: string) => rpc<Owed>(db, user, 'money_owed', { p_group_id: groupId })

    expect(await owed(users.P2)).toEqual([
      expect.objectContaining({ match_id: id, share: 47, currency: 'EGP', collector_player_id: pid(users.Ahmed) }),
    ])
    expect(await owed(users.Ahmed)).toHaveLength(0) // the collector owes nothing
    await rpc(db, users.Ahmed, 'mark_paid', { p_match_id: id, p_player_id: pid(users.P2) })
    expect(await owed(users.P2)).toHaveLength(0)
  })
})
