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

it('creates 12 players, 4 rated matches and 1 open vote; first joiner becomes admin', async () => {
  const owner = await createUser(db, 'Owner')
  const [{ join_group: groupId }] = await rpc<{ join_group: string }>(db, owner, 'join_group', {
    p_code: 'demo-kick',
    p_display_name: 'Owner',
  })
  const [me] = await selectAs<{ role: string }>(
    db, owner, `select role from group_members where group_id = $1`, [groupId],
  )
  expect(me.role).toBe('admin')

  const players = await selectAs(db, owner, `select * from players where group_id = $1`, [groupId])
  expect(players).toHaveLength(13) // 12 demo players + the owner

  const matches = await selectAs<{ status: string }>(
    db, owner, `select status from matches where group_id = $1`, [groupId],
  )
  expect(matches.filter((m) => m.status === 'closed')).toHaveLength(4)
  expect(matches.filter((m) => m.status === 'voting')).toHaveLength(1)

  // All-time (the season split depends on today's date, so not checked here).
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
