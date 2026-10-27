// Groups (file 8 section 2): the photo and its storage rules, Public /
// Private, the Find list, one-tap joining and account pages.
import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { createDb, createUser, MatchBuilder, nightDetails, rpc, selectAs, setupGroup } from './helpers'

let db: PGlite

beforeAll(async () => {
  db = await createDb()
})

afterAll(async () => {
  await db.close()
})

async function makePublic(admin: string, groupId: string) {
  await selectAs(db, admin, `update groups set is_public = true where id = $1`, [groupId])
}

const listed = async (user: string) => rpc<Record<string, unknown>>(db, user, 'list_public_groups')

it('admins make a group public and give it a photo; a member trying to changes nothing', async () => {
  const { groupId, users } = await setupGroup(db)
  await selectAs(db, users.Omar, `update groups set is_public = true, image_path = $2 where id = $1`, [groupId, `${groupId}/a.jpg`])
  const read = async () =>
    (await selectAs<{ is_public: boolean; image_path: string | null }>(
      db, users.Omar, `select is_public, image_path from groups where id = $1`, [groupId],
    ))[0]
  expect(await read()).toEqual({ is_public: false, image_path: null })

  await selectAs(db, users.admin, `update groups set is_public = true, image_path = $2 where id = $1`, [groupId, `${groupId}/a.jpg`])
  expect(await read()).toEqual({ is_public: true, image_path: `${groupId}/a.jpg` })
})

it("the photo must sit in the group's own folder", async () => {
  const { groupId, users } = await setupGroup(db)
  for (const path of ['someone-else/a.jpg', `${groupId}/../a.jpg`, `${groupId}/a b.jpg`]) {
    await expect(
      selectAs(db, users.admin, `update groups set image_path = $2 where id = $1`, [groupId, path]),
    ).rejects.toThrow(/groups_image_path_check/)
  }
})

it("storage: only the group's admins add photos to its folder", async () => {
  const { groupId, users } = await setupGroup(db)
  const other = await setupGroup(db)
  const add = (user: string, name: string) =>
    selectAs(db, user, `insert into storage.objects (bucket_id, name) values ('group-images', $1)`, [name])

  await add(users.admin, `${groupId}/photo.jpg`)
  await expect(add(users.Omar, `${groupId}/member.jpg`)).rejects.toThrow(/row-level security/)
  await expect(add(other.users.admin, `${groupId}/other-admin.jpg`)).rejects.toThrow(/row-level security/)
  await expect(add(users.admin, 'no-folder.jpg')).rejects.toThrow(/row-level security/)

  const [bucket] = (await db.query<{ public: boolean; file_size_limit: string }>(
    `select public, file_size_limit::text from storage.buckets where id = 'group-images'`,
  )).rows
  expect(bucket).toEqual({ public: true, file_size_limit: '1048576' })
})

it('Find lists public groups only, with members and the next planned night', async () => {
  const { groupId, users } = await setupGroup(db)
  const hidden = await setupGroup(db)
  await makePublic(users.admin, groupId)
  await rpc(db, users.admin, 'plan_night', { p_group_id: groupId, p_night: nightDetails({ played_at: '2099-01-01', starts_at: '2099-01-01T18:00:00Z' }) })
  const stranger = await createUser(db, 'Stranger')

  const rows = await listed(stranger)
  const mine = rows.find((r) => r.id === groupId)
  expect(mine).toMatchObject({ name: 'Thursday Football', i_am_in: false, next_night_location: 'Club pitch 3' })
  // PGlite may hand back a bigint and a date as other JS types than PostgREST does.
  expect(Number(mine?.members)).toBe(4)
  expect(new Date(String(mine?.next_night_day)).getUTCFullYear()).toBe(2099)
  expect(rows.some((r) => r.id === hidden.groupId)).toBe(false)
  expect((await listed(users.Omar)).find((r) => r.id === groupId)?.i_am_in).toBe(true)
})

it('one tap joins a public group with the account name and card; a private group refuses', async () => {
  const { groupId, users } = await setupGroup(db)
  const closed = await setupGroup(db)
  await makePublic(users.admin, groupId)
  const karim = await createUser(db, 'Karim')
  await rpc(db, karim, 'save_my_account', { p_account: { display_name: 'Karim', shirt_number: 9 } })

  await rpc(db, karim, 'join_public_group', { p_group_id: groupId })
  const [player] = await selectAs<{ display_name: string; shirt_number: number }>(
    db, users.admin, `select display_name, shirt_number from players where group_id = $1 and user_id = $2`, [groupId, karim],
  )
  expect(player).toEqual({ display_name: 'Karim', shirt_number: 9 })

  await expect(rpc(db, karim, 'join_public_group', { p_group_id: closed.groupId })).rejects.toThrow(
    'This group is private. Ask for an invite code.',
  )
})

it('removed by an admin: one tap is refused. Left on your own: it works, with your old player back', async () => {
  const { groupId, users, pid } = await setupGroup(db)
  await makePublic(users.admin, groupId)

  await rpc(db, users.admin, 'remove_member', { p_group_id: groupId, p_user_id: users.Omar })
  await expect(rpc(db, users.Omar, 'join_public_group', { p_group_id: groupId })).rejects.toThrow(
    'An admin removed you from this group. Ask them for an invite code.',
  )

  await rpc(db, users.Ziad, 'remove_member', { p_group_id: groupId, p_user_id: users.Ziad })
  await rpc(db, users.Ziad, 'join_public_group', { p_group_id: groupId, p_display_name: 'Ziad' })
  const [member] = await selectAs<{ player_id: string }>(
    db, users.admin, `select player_id from group_members where group_id = $1 and user_id = $2`, [groupId, users.Ziad],
  )
  expect(member.player_id).toBe(pid(users.Ziad))
})

it('an account page: card, totals across groups, public and shared groups; never email or phone', async () => {
  const { groupId, users } = await setupGroup(db)
  const open = await setupGroup(db, ['Omar2'])
  await makePublic(open.users.admin, open.groupId)
  await rpc(db, users.Omar, 'join_public_group', { p_group_id: open.groupId })
  await rpc(db, users.Omar, 'save_my_account', {
    p_account: { display_name: 'Omar', shirt_number: 10, skill_shooting: 8, skill_passing: 7, skill_dribbling: 8,
                 skill_defending: 6, skill_fitness: 9, instapay_phone: '01012345678' },
  })

  // One rated night in a third group, with one goal that counts and one disputed, and the MOTM award.
  const b = await MatchBuilder.create(db, ['Omar', 'Ziad'])
  await db.query(`update players set user_id = $1 where id = $2`, [users.Omar, b.id('Omar')])
  await b.match({ A: ['Omar'], B: ['Ziad'] })
  await b.goal('Omar')
  await b.goal('Omar', null, { disputed: true })
  await b.mvp('Ziad', 'Omar')
  await b.compute()
  await db.query(`update matches set status = 'closed' where id = $1`, [b.matchId])

  const stranger = await createUser(db, 'Stranger')
  const [{ get_account: page }] = await rpc<{ get_account: Record<string, unknown> }>(db, stranger, 'get_account', {
    p_user_id: users.Omar,
  })
  expect(page).toMatchObject({ display_name: 'Omar', shirt_number: 10, skill_shooting: 8, nights: 1, goals: 1, mvps: 1 })
  expect(page).not.toHaveProperty('email')
  expect(page).not.toHaveProperty('instapay_phone')
  // The stranger sees only the public group; a group mate sees Thursday Football too, with Omar's player.
  expect((page.groups as { id: string }[]).map((g) => g.id)).toEqual([open.groupId])
  const [{ get_account: seenByZiad }] = await rpc<{ get_account: { groups: Record<string, unknown>[] } }>(
    db, users.Ziad, 'get_account', { p_user_id: users.Omar },
  )
  expect(seenByZiad.groups.find((g) => g.id === groupId)).toMatchObject({ i_am_in: true, is_public: false })
  expect(seenByZiad.groups.find((g) => g.id === groupId)?.player_id).toBeTruthy()

  // Hidden stats: no skills for others; the owner still sees them.
  await rpc(db, users.Omar, 'save_my_account', {
    p_account: { display_name: 'Omar', skill_shooting: 8, skill_passing: 7, skill_dribbling: 8, skill_defending: 6,
                 skill_fitness: 9, show_stats: false },
  })
  const [{ get_account: hidden }] = await rpc<{ get_account: Record<string, unknown> }>(db, stranger, 'get_account', { p_user_id: users.Omar })
  expect(hidden).toMatchObject({ show_stats: false, skill_shooting: null, skill_fitness: null })
  const [{ get_account: own }] = await rpc<{ get_account: Record<string, unknown> }>(db, users.Omar, 'get_account', { p_user_id: users.Omar })
  expect(own).toMatchObject({ skill_shooting: 8 })
})

it('signed-out visitors can call none of it', async () => {
  await db.exec('set role anon')
  try {
    for (const call of ['list_public_groups()', `join_public_group(gen_random_uuid())`, `get_account(gen_random_uuid())`]) {
      await expect(db.query(`select * from public.${call}`)).rejects.toThrow(/permission denied/)
    }
  } finally {
    await db.exec('reset role')
  }
})
