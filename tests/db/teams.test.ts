// The "Extra team from N players" setting for the team suggester (file 6,
// supabase/migrations/20261025000200_team_suggester.sql).
import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { createDb, runMigrations, selectAs, setupGroup } from './helpers'

const FILE_6 = '20261025000200_team_suggester.sql'
let db: PGlite

beforeAll(async () => {
  db = await createDb()
})

afterAll(async () => {
  await db.close()
})

async function extraTeamSize(userId: string, groupId: string) {
  const [row] = await selectAs<{ min_extra_team_size: number }>(
    db, userId, `select min_extra_team_size from groups where id = $1`, [groupId],
  )
  return row.min_extra_team_size
}

it('a new group makes Team C from 3 players left over', async () => {
  const { groupId, users } = await setupGroup(db)
  expect(await extraTeamSize(users.Omar, groupId)).toBe(3)
})

it('admins change it; a member trying to changes nothing', async () => {
  const { groupId, users } = await setupGroup(db)
  await selectAs(db, users.admin, `update groups set min_extra_team_size = 4 where id = $1`, [groupId])
  expect(await extraTeamSize(users.Omar, groupId)).toBe(4)

  // Only admins may update a group (file 1), so a member's update matches no rows.
  await selectAs(db, users.Omar, `update groups set min_extra_team_size = 2 where id = $1`, [groupId])
  expect(await extraTeamSize(users.Omar, groupId)).toBe(4)
})

it('only 2 to 11 players', async () => {
  const { groupId, users } = await setupGroup(db)
  for (const size of [1, 12]) {
    await expect(
      selectAs(db, users.admin, `update groups set min_extra_team_size = $2 where id = $1`, [groupId, size]),
    ).rejects.toThrow(/groups_min_extra_team_size_check/)
  }
  expect(await extraTeamSize(users.admin, groupId)).toBe(3)
})

it('the invite code still changes only through its own actions', async () => {
  const { groupId, users } = await setupGroup(db)
  await expect(
    selectAs(db, users.admin, `update groups set invite_code = 'HACK-HACK' where id = $1`, [groupId]),
  ).rejects.toThrow(/permission denied/)
})

it('signed-out visitors cannot read groups', async () => {
  await db.exec('set role anon')
  try {
    await expect(db.query('select min_extra_team_size from public.groups')).rejects.toThrow(/permission denied/)
  } finally {
    await db.exec('reset role')
  }
})

it('groups from before this file get 3, as on the live project', async () => {
  const old = await createDb({ before: FILE_6 })
  try {
    await old.query(`insert into groups (name) values ('Old group')`)
    await runMigrations(old, (file) => file >= FILE_6)
    const { rows } = await old.query<{ min_extra_team_size: number }>(`select min_extra_team_size from groups`)
    expect(rows).toEqual([{ min_extra_team_size: 3 }])
  } finally {
    await old.close()
  }
})
