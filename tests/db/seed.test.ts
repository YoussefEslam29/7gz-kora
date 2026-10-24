// Checks that supabase/seed.sql loads and produces usable demo data.
import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { createDb, createUser, rpc, runSqlFile, selectAs } from './helpers'

let db: PGlite

beforeAll(async () => {
  db = await createDb()
  await runSqlFile(db, 'supabase/seed.sql')
})

afterAll(async () => {
  await db.close()
})

it('creates 12 players and demo nights; the first joiner becomes admin', async () => {
  const owner = await createUser(db, 'Owner')
  const [{ join_group: groupId }] = await rpc<{ join_group: string }>(db, owner, 'join_group', {
    p_code: 'demo-kick',
    p_display_name: 'Owner',
  })
  const [me] = await selectAs<{ role: string }>(
    db, owner, `select role from group_members where group_id = $1`, [groupId],
  )
  expect(me.role).toBe('admin')
  expect(await selectAs(db, owner, `select * from players where group_id = $1`, [groupId])).toHaveLength(13)

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

  const allTime = await rpc<{ qualified: boolean; matches: number }>(db, owner, 'get_leaderboard', {
    p_group_id: groupId,
    p_year: null,
  })
  expect(allTime).toHaveLength(12)
  expect(allTime.every((row) => row.matches === 4 && row.qualified)).toBe(true)

  // Running the seed again does nothing.
  await runSqlFile(db, 'supabase/seed.sql')
  const groups = await db.query(`select * from groups where name = 'Demo FC'`)
  expect(groups.rows).toHaveLength(1)
})
