// Checks that supabase/seed.sql loads and produces usable demo data.
import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { createDb, createUser, rpc, runSqlFile, selectAs } from './helpers'

let db: PGlite
let owner = ''
let groupId = ''

beforeAll(async () => {
  db = await createDb()
  await runSqlFile(db, 'supabase/seed.sql')
  owner = await createUser(db, 'Owner')
  const [{ join_group }] = await rpc<{ join_group: string }>(db, owner, 'join_group', {
    p_code: 'demo-kick',
    p_display_name: 'Owner',
  })
  groupId = join_group
})

afterAll(async () => {
  await db.close()
})

it('creates 15 players and demo nights; the first joiner becomes admin', async () => {
  const [me] = await selectAs<{ role: string }>(
    db, owner, `select role from group_members where group_id = $1`, [groupId],
  )
  expect(me.role).toBe('admin')
  expect(await selectAs(db, owner, `select * from players where group_id = $1`, [groupId])).toHaveLength(16)

  const nights = await selectAs<{ id: string; status: string }>(
    db, owner, `select id, status from matches where group_id = $1`, [groupId],
  )
  const count = (status: string) => nights.filter((n) => n.status === status).length
  expect([count('closed'), count('voting'), count('draft'), count('cancelled')]).toEqual([4, 1, 1, 1])

  // The planned night has a 10-player limit: 10 in, 1 waiting, 1 out. The owner goes on the list.
  const planned = nights.find((n) => n.status === 'draft')!
  const replies = await selectAs<{ status: string }>(db, owner, `select status from rsvps where match_id = $1`, [planned.id])
  const said = (status: string) => replies.filter((r) => r.status === status).length
  expect([said('in'), said('waiting'), said('out')]).toEqual([10, 1, 1])
  const [{ set_rsvp }] = await rpc<{ set_rsvp: string }>(db, owner, 'set_rsvp', { p_match_id: planned.id, p_status: 'in' })
  expect(set_rsvp).toBe('waiting')

  // Yesterday's night: 600 / 12 = 50 each; Ahmed (collector) plus 3 have paid.
  const voting = nights.find((n) => n.status === 'voting')!
  const money = await rpc<{ share: number; paid_at: Date | null; is_collector: boolean }>(
    db, owner, 'night_money', { p_match_id: voting.id },
  )
  expect(money).toHaveLength(12)
  expect(money.every((r) => r.share === 50)).toBe(true)
  expect(money.filter((r) => r.is_collector || r.paid_at !== null)).toHaveLength(4)

  // Players 1-12 played all four finished nights; Khaled, Amr and Hany only last week's.
  const allTime = await rpc<{ qualified: boolean; matches: number; avg_minutes: number }>(db, owner, 'get_leaderboard', {
    p_group_id: groupId,
    p_year: null,
  })
  expect(allTime).toHaveLength(15)
  expect(allTime.filter((row) => row.matches === 4 && row.qualified)).toHaveLength(12)
  expect(allTime.filter((row) => row.matches === 1 && !row.qualified)).toHaveLength(3)
  expect(allTime.every((row) => row.avg_minutes > 0)).toBe(true)

  // Running the seed again does nothing.
  await runSqlFile(db, 'supabase/seed.sql')
  const groups = await db.query(`select * from groups where name = 'Demo FC'`)
  expect(groups.rows).toHaveLength(1)
})

it('last week: three teams, penalties, a mid-game swap and a late arrival', async () => {
  const [last] = await selectAs<{ id: string; starts_at: Date }>(db, owner,
    `select id, starts_at from matches where group_id = $1 and status = 'closed' order by played_at desc limit 1`, [groupId])
  const games = await selectAs<{ team_one: string; team_two: string; penalty_winner: string | null; periods: number }>(db, owner,
    `select g.team_one, g.team_two, g.penalty_winner, (select count(*)::int from stints s where s.game_id = g.id) as periods
     from games g where g.match_id = $1 order by g.ordinal`, [last.id])
  expect(games.map((g) => [g.team_one, g.team_two, g.penalty_winner, g.periods])).toEqual([
    ['A', 'B', null, 1],
    ['A', 'C', 'C', 1],
    ['C', 'B', null, 2],
    ['B', 'A', null, 1],
  ])

  const ratings = await selectAs<{ display_name: string; minutes_played: string; clean_sheets: number }>(db, owner,
    `select p.display_name, mr.minutes_played, mr.clean_sheets
     from match_ratings mr join players p on p.id = mr.player_id where mr.match_id = $1`, [last.id])
  expect(ratings).toHaveLength(15)
  const r = (name: string) => ratings.find((x) => x.display_name === name)!
  expect(Number(r('Tarek').minutes_played)).toBe(20) // arrived late: games 3 and 4 only
  expect(r('Ali').clean_sheets).toBe(2) // in goal for all of game 2 (0-0) and game 4 (1-0)

  const [tarek] = await selectAs<{ arrived_at: Date }>(db, owner,
    `select mp.arrived_at from match_players mp join players p on p.id = mp.player_id
     where mp.match_id = $1 and p.display_name = 'Tarek'`, [last.id])
  expect((new Date(tarek.arrived_at).getTime() - new Date(last.starts_at).getTime()) / 60_000).toBe(25)

  // The table counts Ali's minutes in goal.
  const board = await rpc<{ display_name: string; minutes_in_goal: number }>(db, owner, 'get_leaderboard', {
    p_group_id: groupId, p_year: null,
  })
  expect(board.find((row) => row.display_name === 'Ali')!.minutes_in_goal).toBeGreaterThanOrEqual(30)
})
