// End-to-end tests of the app actions (file 3) with Row Level Security on,
// acting as real signed-in users, the same way the app calls them.
import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDb, createUser, nightDetails, rpc, selectAs, setupGroup, startGame, startNight } from './helpers'

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

describe('groups and invite codes', () => {
  it('the creator becomes admin and the group gets a code and rating config', async () => {
    const { groupId, code, users } = await setupGroup(db)
    expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/)

    const members = await selectAs<{ role: string; user_id: string }>(
      db, users.admin, `select role, user_id from group_members where group_id = $1`, [groupId],
    )
    expect(members).toHaveLength(4)
    expect(members.find((m) => m.user_id === users.admin)!.role).toBe('admin')
    expect(members.filter((m) => m.role === 'member')).toHaveLength(3)

    const config = await selectAs(db, users.Omar, `select * from rating_config where group_id = $1`, [groupId])
    expect(config).toHaveLength(1)
  })

  it('accepts codes typed in lowercase without the dash, keeps Arabic names', async () => {
    const { groupId, code, users } = await setupGroup(db)
    const newbie = await createUser(db, 'Newbie')
    await rpc(db, newbie, 'join_group', { p_code: code.replace('-', '').toLowerCase(), p_display_name: '  Sam  ' })
    const names = await selectAs<{ display_name: string }>(
      db, users.admin, `select display_name from players where group_id = $1 order by display_name`, [groupId],
    )
    expect(names.map((n) => n.display_name)).toContain('Sam')
    expect(names.map((n) => n.display_name)).toContain('محمد')
  })

  it('rejects a wrong code, and a disabled code', async () => {
    const { groupId, code, users } = await setupGroup(db)
    const stranger = await createUser(db, 'Stranger')
    await expectError(rpc(db, stranger, 'join_group', { p_code: 'NOPE-NOPE', p_display_name: 'X' }), /not valid/)

    await rpc(db, users.admin, 'disable_invite_code', { p_group_id: groupId })
    await expectError(rpc(db, stranger, 'join_group', { p_code: code, p_display_name: 'X' }), /not valid/)
  })

  it('people outside the group cannot see it', async () => {
    const { groupId } = await setupGroup(db)
    const stranger = await createUser(db, 'Stranger')
    expect(await selectAs(db, stranger, `select * from groups where id = $1`, [groupId])).toHaveLength(0)
    expect(await selectAs(db, stranger, `select * from players where group_id = $1`, [groupId])).toHaveLength(0)
    expect(await rpc(db, stranger, 'get_leaderboard', { p_group_id: groupId, p_year: null })).toHaveLength(0)
    await expectError(rpc(db, stranger, 'close_due_matches', { p_group_id: groupId }), /not a member/)
  })

  it('only admins manage members, and the last admin cannot step down', async () => {
    const { groupId, users } = await setupGroup(db)
    await expectError(
      rpc(db, users.Omar, 'set_member_role', { p_group_id: groupId, p_user_id: users.Ziad, p_role: 'admin' }),
      /Only group admins/,
    )
    await expectError(
      rpc(db, users.admin, 'set_member_role', { p_group_id: groupId, p_user_id: users.admin, p_role: 'member' }),
      /at least one admin/,
    )
    await rpc(db, users.admin, 'set_member_role', { p_group_id: groupId, p_user_id: users.Omar, p_role: 'admin' })
    await rpc(db, users.admin, 'set_member_role', { p_group_id: groupId, p_user_id: users.admin, p_role: 'member' })
    await rpc(db, users.Omar, 'remove_member', { p_group_id: groupId, p_user_id: users.Ziad })
    const left = await selectAs(db, users.Omar, `select * from group_members where group_id = $1`, [groupId])
    expect(left).toHaveLength(3)
  })

  it('members cannot write to tables directly', async () => {
    const { groupId, users } = await setupGroup(db)
    await expectError(
      selectAs(db, users.Omar, `insert into matches (group_id) values ($1)`, [groupId]),
      /permission denied/,
    )
    await expectError(
      selectAs(db, users.Omar, `update group_members set role = 'admin' where group_id = $1`, [groupId]),
      /permission denied/,
    )
    await expectError(
      selectAs(db, users.Omar,
        `insert into games (match_id, ordinal, team_one, team_two, planned_minutes) values (gen_random_uuid(), 1, 'A', 'B', 10)`),
      /permission denied/,
    )
  })

  it('signed-out visitors can read nothing, including games', async () => {
    for (const table of ['matches', 'players', 'games']) {
      await db.exec('set role anon')
      try {
        await expectError(db.query(`select * from public.${table}`), /permission denied/)
      } finally {
        await db.exec('reset role')
      }
    }
  })
})

describe('a full night: plan, check in, goals, voting, results', () => {
  it('runs end to end with secret votes revealed at the end', async () => {
    const { groupId, users, pid } = await setupGroup(db)
    const [captain, omar, ziad, mo] = [users.admin, users.Omar, users.Ziad, users['محمد']]

    // Only admins plan and run nights.
    await expectError(
      rpc(db, omar, 'plan_night', { p_group_id: groupId, p_night: nightDetails() }),
      /Only group admins/,
    )
    const matchId = await startNight(db, captain, groupId, [captain, omar, ziad, mo].map(pid))
    await startGame(
      db, captain, matchId,
      { [pid(captain)]: 'A', [pid(omar)]: 'A', [pid(ziad)]: 'B', [pid(mo)]: 'B' },
      ['A', 'B'], [pid(omar), pid(mo)],
    )

    // Only admins log goals. Omar scores, assisted by the captain.
    await expectError(
      rpc(db, omar, 'log_goal', { p_match_id: matchId, p_scorer_id: pid(omar), p_assister_id: null }),
      /Only group admins/,
    )
    const logGoal = (scorer: string, assister: string | null) =>
      rpc<{ log_goal: string }>(db, captain, 'log_goal', {
        p_match_id: matchId, p_scorer_id: pid(scorer), p_assister_id: assister && pid(assister),
      })
    await logGoal(omar, captain)

    // Cross-team assists are rejected.
    await expectError(logGoal(ziad, captain), /scorer's team/)
    // Ziad scores twice, one is disputed by Omar (so it will not count).
    await logGoal(ziad, null)
    const [{ log_goal: goal3 }] = await logGoal(ziad, mo)
    await rpc(db, omar, 'dispute_goal', { p_goal_id: goal3 })

    // Voting is not open yet; members cannot finish the match.
    await expectError(
      rpc(db, ziad, 'submit_votes', { p_match_id: matchId, p_votes: [], p_mvp_id: null }),
      /Voting is closed/,
    )
    await expectError(rpc(db, omar, 'end_night', { p_match_id: matchId }), /Only group admins/)
    await rpc(db, captain, 'end_night', { p_match_id: matchId })

    // Voting rules.
    await expectError(
      rpc(db, omar, 'submit_votes', { p_match_id: matchId, p_votes: [{ target_id: pid(omar), score: 10 }], p_mvp_id: null }),
      /yourself/,
    )
    await expectError(
      rpc(db, omar, 'submit_votes', { p_match_id: matchId, p_votes: [{ target_id: pid(ziad), score: 11 }], p_mvp_id: null }),
      /1 to 10/,
    )
    const outsider = await createUser(db, 'Bench')
    const [{ invite_code: code }] = await selectAs<{ invite_code: string }>(
      db, captain, `select invite_code from groups where id = $1`, [groupId],
    )
    await rpc(db, outsider, 'join_group', { p_code: code, p_display_name: 'Bench' })
    await expectError(
      rpc(db, outsider, 'submit_votes', { p_match_id: matchId, p_votes: [{ target_id: pid(ziad), score: 5 }], p_mvp_id: null }),
      /Only players who played/,
    )

    const everyoneElse = (me: string) =>
      [captain, omar, ziad, mo].filter((u) => u !== me).map((u) => ({ target_id: pid(u), score: 7 }))
    await rpc(db, captain, 'submit_votes', {
      p_match_id: matchId,
      p_votes: [{ target_id: pid(omar), score: 9 }, { target_id: pid(ziad), score: 6 }, { target_id: pid(mo), didnt_see: true }],
      p_mvp_id: pid(omar),
    })
    await rpc(db, ziad, 'submit_votes', { p_match_id: matchId, p_votes: everyoneElse(ziad), p_mvp_id: pid(omar) })
    // Votes can be changed until voting closes.
    await rpc(db, ziad, 'submit_votes', {
      p_match_id: matchId,
      p_votes: [{ target_id: pid(omar), score: 8 }],
      p_mvp_id: pid(captain),
    })

    // Votes are secret while voting is open: you only see your own.
    const seenByZiad = await selectAs(db, ziad, `select * from ratings_votes where match_id = $1`, [matchId])
    expect(seenByZiad).toHaveLength(3)
    expect(await selectAs(db, omar, `select * from ratings_votes where match_id = $1`, [matchId])).toHaveLength(0)
    expect(await selectAs(db, omar, `select * from mvp_votes where match_id = $1`, [matchId])).toHaveLength(0)

    // ...but everyone can see WHO has voted.
    const status = await rpc<{ player_id: string; has_voted: boolean }>(db, omar, 'vote_status', { p_match_id: matchId })
    expect(status.filter((s) => s.has_voted).map((s) => s.player_id).sort()).toEqual([pid(captain), pid(ziad)].sort())

    // Members cannot close early; once time is up, anyone's app closes it.
    await expectError(rpc(db, omar, 'close_voting', { p_match_id: matchId }), /Only an admin can close it early/)
    await db.query(`update matches set voting_closes_at = now() - interval '1 minute' where id = $1`, [matchId])
    await expectError(
      rpc(db, mo, 'submit_votes', { p_match_id: matchId, p_votes: everyoneElse(mo), p_mvp_id: null }),
      /Voting is closed/,
    )
    const [{ close_due_matches: closed }] = await rpc<{ close_due_matches: number }>(
      db, omar, 'close_due_matches', { p_group_id: groupId },
    )
    expect(closed).toBe(1)

    // Now everything is visible and ratings exist.
    expect(await selectAs(db, omar, `select * from ratings_votes where match_id = $1`, [matchId])).toHaveLength(6)
    const goals = await selectAs<{ confirmed: boolean; disputed: boolean }>(
      db, omar, `select confirmed, disputed from goals where match_id = $1`, [matchId],
    )
    expect(goals.filter((g) => g.confirmed)).toHaveLength(2) // admins' goals count as confirmed; the disputed one doesn't
    expect(goals.filter((g) => g.disputed)).toHaveLength(1)

    const ratings = await selectAs<{ player_id: string; rating: string; goals: number; is_mvp: boolean; stats_only: boolean }>(
      db, mo, `select player_id, rating, goals, is_mvp, stats_only from match_ratings where match_id = $1`, [matchId],
    )
    expect(ratings).toHaveLength(4)
    const r = (u: string) => ratings.find((x) => x.player_id === pid(u))!
    // 1-1 (disputed goal excluded). Omar: votes 9 and 8 -> 8.5; analytics 5 + 1 goal = 6.0
    // 0.65 x 6.0 + 0.35 x 8.5 = 6.875 -> 6.9
    expect(Number(r(omar).rating)).toBe(6.9)
    expect(r(ziad).goals).toBe(1)
    expect(r(mo).stats_only).toBe(true) // only "didn't see" from the captain, 7 from Ziad = 1 vote
    // MVP: captain picked Omar, Ziad picked the captain -> shared.
    expect(r(omar).is_mvp).toBe(true)
    expect(r(captain).is_mvp).toBe(true)

    // Leaderboard (season 2026) has everyone, none qualified yet (needs 3 matches).
    const board = await rpc<{ player_id: string; matches: number; qualified: boolean }>(
      db, ziad, 'get_leaderboard', { p_group_id: groupId, p_year: 2026 },
    )
    expect(board).toHaveLength(4)
    expect(board.every((b) => b.matches === 1 && !b.qualified)).toBe(true)
    expect(await rpc(db, ziad, 'get_leaderboard', { p_group_id: groupId, p_year: 2025 })).toHaveLength(0)

    // After closing, an admin fix recalculates ratings automatically.
    await rpc(db, captain, 'edit_goal', { p_goal_id: goal3, p_scorer_id: pid(ziad), p_assister_id: pid(mo) })
    const fixed = await selectAs<{ player_id: string; goals: number; assists: number }>(
      db, omar, `select player_id, goals, assists from match_ratings where match_id = $1`, [matchId],
    )
    expect(fixed.find((x) => x.player_id === pid(ziad))!.goals).toBe(2)
    expect(fixed.find((x) => x.player_id === pid(mo))!.assists).toBe(1)

    // Members cannot delete goals; teams and games are final.
    await expectError(rpc(db, ziad, 'delete_goal', { p_goal_id: goal3 }), /Only an admin or the person/)
    await expectError(
      rpc(db, captain, 'set_team_board', { p_match_id: matchId, p_board: [] }),
      /teams and games are final/,
    )

    // Every edit left a trail.
    const audit = await selectAs<{ action: string }>(
      db, omar, `select action from audit_log where group_id = $1`, [groupId],
    )
    expect(audit.map((a) => a.action)).toEqual(
      expect.arrayContaining(['night_planned', 'goal_disputed', 'night_ended', 'goal_edited']),
    )
  })

  it('admins can undo a goal; members cannot delete goals', async () => {
    const { groupId, users, pid } = await setupGroup(db)
    const matchId = await startNight(db, users.admin, groupId, [pid(users.Omar), pid(users.Ziad)])
    await startGame(db, users.admin, matchId, { [pid(users.Omar)]: 'A', [pid(users.Ziad)]: 'B' })
    const [{ log_goal: goalId }] = await rpc<{ log_goal: string }>(db, users.admin, 'log_goal', {
      p_match_id: matchId, p_scorer_id: pid(users.Omar), p_assister_id: null,
    })
    await expectError(rpc(db, users.Omar, 'delete_goal', { p_goal_id: goalId }), /Only an admin or the person/)
    await rpc(db, users.admin, 'delete_goal', { p_goal_id: goalId })
    expect(await selectAs(db, users.Omar, `select * from goals where match_id = $1`, [matchId])).toHaveLength(0)
  })
})
