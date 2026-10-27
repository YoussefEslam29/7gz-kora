// Accounts (file 8 section 1, supabase/migrations/20261026000100_accounts_groups_chat.sql):
// the player card lives on the account; each group's player keeps a copy the
// database writes; hidden stats never reach the copy. Acting as real
// signed-in users with RLS on.
import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { createDb, createUser, rpc, runMigrations, selectAs, setupGroup } from './helpers'

const FILE_8 = '20261026000100_accounts_groups_chat.sql'
const SKILLS = { skill_shooting: 8, skill_passing: 7, skill_dribbling: 8, skill_defending: 6, skill_fitness: 9 }
const NO_SKILLS = { skill_shooting: null, skill_passing: null, skill_dribbling: null, skill_defending: null, skill_fitness: null }
let db: PGlite

beforeAll(async () => {
  db = await createDb()
})

afterAll(async () => {
  await db.close()
})

type Account = Record<string, unknown> & { onboarded_at: string | null }

const myAccount = async (user: string) => (await rpc<Account>(db, user, 'my_account'))[0]

/** A whole account, as Edit my card sends it. */
function account(changes: Record<string, unknown> = {}) {
  return {
    display_name: 'Omar',
    shirt_number: 10,
    strong_foot: 'left',
    favourite_position: 'attack',
    motto: 'يلا بينا',
    ...SKILLS,
    happy_in_goal: false,
    show_stats: true,
    instapay_phone: null,
    ...changes,
  }
}

async function copy(viewer: string, playerId: string) {
  const [row] = await selectAs<Record<string, unknown>>(
    db, viewer,
    `select display_name, shirt_number, strong_foot, favourite_position, motto, skill_shooting, skill_fitness,
            happy_in_goal, show_stats, instapay_phone
     from players where id = $1`,
    [playerId],
  )
  return row
}

/** A second group with the same people in it, through the app's own functions. */
async function secondGroup(admin: string, members: string[]) {
  const [{ create_group: groupId }] = await rpc<{ create_group: string }>(db, admin, 'create_group', {
    p_name: 'Friday Football',
    p_display_name: 'Captain',
  })
  const [{ invite_code: code }] = await selectAs<{ invite_code: string }>(
    db, admin, `select invite_code from groups where id = $1`, [groupId],
  )
  for (const user of members) await rpc(db, user, 'join_group', { p_code: code, p_display_name: 'Omar' })
  const players = await selectAs<{ user_id: string; id: string }>(
    db, admin, `select user_id, id from players where group_id = $1`, [groupId],
  )
  return { groupId, pid: (user: string) => players.find((p) => p.user_id === user)!.id }
}

it('a new account is empty, shows its stats and is not signed up yet', async () => {
  const user = await createUser(db, 'Karim')
  const me = await myAccount(user)
  expect(me).toMatchObject({ display_name: 'Karim', shirt_number: null, show_stats: true, onboarded_at: null })
})

it('finishing the sign-up saves the answers, and every group shows the same card', async () => {
  const { users, pid } = await setupGroup(db)
  const friday = await secondGroup(users.admin, [users.Omar])
  await rpc(db, users.Omar, 'finish_sign_up', { p_account: account() })

  expect((await myAccount(users.Omar)).onboarded_at).not.toBeNull()
  const expected = {
    shirt_number: 10, strong_foot: 'left', favourite_position: 'attack', motto: 'يلا بينا',
    skill_shooting: 8, skill_fitness: 9, show_stats: true,
  }
  expect(await copy(users.Ziad, pid(users.Omar))).toMatchObject(expected)
  expect(await copy(users.admin, friday.pid(users.Omar))).toMatchObject(expected)
})

it('a change on the account shows in every group straight away', async () => {
  const { users, pid } = await setupGroup(db)
  const friday = await secondGroup(users.admin, [users.Omar])
  await rpc(db, users.Omar, 'save_my_account', { p_account: account() })
  await rpc(db, users.Omar, 'save_my_account', { p_account: account({ shirt_number: 7 }) })
  expect((await copy(users.Ziad, pid(users.Omar))).shirt_number).toBe(7)
  expect((await copy(users.admin, friday.pid(users.Omar))).shirt_number).toBe(7)
})

it('joining or creating a group starts the new player with the account card', async () => {
  const { users } = await setupGroup(db)
  await rpc(db, users.Omar, 'save_my_account', { p_account: account({ happy_in_goal: true }) })
  const friday = await secondGroup(users.admin, [users.Omar])
  expect(await copy(users.admin, friday.pid(users.Omar))).toMatchObject({ shirt_number: 10, happy_in_goal: true })
})

it('hidden stats: the copies have no skills, the account keeps them', async () => {
  const { users, pid } = await setupGroup(db)
  await rpc(db, users.Omar, 'save_my_account', { p_account: account({ show_stats: false }) })
  expect(await copy(users.Ziad, pid(users.Omar))).toMatchObject({
    shirt_number: 10, motto: 'يلا بينا', skill_shooting: null, skill_fitness: null, show_stats: false,
  })
  expect(await myAccount(users.Omar)).toMatchObject({ skill_shooting: 8, show_stats: false })

  // Turning them back on brings the skills back to the group.
  await rpc(db, users.Omar, 'save_my_account', { p_account: account() })
  expect((await copy(users.Ziad, pid(users.Omar))).skill_shooting).toBe(8)
})

it('a new name in one group leaves the account and the other groups alone', async () => {
  const { users, pid } = await setupGroup(db)
  const friday = await secondGroup(users.admin, [users.Omar])
  await selectAs(db, users.admin, `update players set display_name = 'Abu Omar' where id = $1`, [pid(users.Omar)])
  expect((await copy(users.Ziad, pid(users.Omar))).display_name).toBe('Abu Omar')
  expect((await copy(users.admin, friday.pid(users.Omar))).display_name).toBe('Omar')
  expect((await myAccount(users.Omar)).display_name).toBe('Omar')
})

it('checks the skills, the InstaPay number and the name', async () => {
  const user = await createUser(db, 'Ziad')
  const save = (changes: Record<string, unknown>) =>
    rpc(db, user, 'save_my_account', { p_account: account(changes) })
  await expect(save({ ...NO_SKILLS, skill_shooting: 8 })).rejects.toThrow('Rate all five skills, or none.')
  await expect(save({ instapay_phone: '0101234567' })).rejects.toThrow(/InstaPay number doesn't look right/)
  await expect(save({ instapay_phone: '01312345678' })).rejects.toThrow(/InstaPay number doesn't look right/)
  await expect(save({ display_name: '   ' })).rejects.toThrow('Please enter a name.')
  await expect(save({ motto: 'a'.repeat(61) })).rejects.toThrow(/profiles_motto_check/)

  await save({ instapay_phone: '010 1234 5678', ...NO_SKILLS })
  expect(await myAccount(user)).toMatchObject({ instapay_phone: '01012345678', skill_shooting: null })
  await save({ instapay_phone: '' })
  expect((await myAccount(user)).instapay_phone).toBeNull()
})

it('the card on a player is written only by the database; the name in a group stays yours to change', async () => {
  const { users, pid } = await setupGroup(db)
  for (const set of ['shirt_number = 1', 'skill_shooting = null', `motto = 'x'`, 'happy_in_goal = true', 'show_stats = false',
                     `instapay_phone = '01012345678'`]) {
    await expect(
      selectAs(db, users.Omar, `update players set ${set} where id = $1`, [pid(users.Omar)]),
    ).rejects.toThrow(/permission denied/)
  }
  await selectAs(db, users.Omar, `update players set display_name = 'Omar K' where id = $1`, [pid(users.Omar)])
  expect((await copy(users.Ziad, pid(users.Omar))).display_name).toBe('Omar K')
})

it("group mates can't read the private account columns", async () => {
  const { users } = await setupGroup(db)
  for (const column of ['instapay_phone', 'skill_shooting', 'show_stats', 'onboarded_at']) {
    await expect(
      selectAs(db, users.Ziad, `select ${column} from profiles where id = $1`, [users.Omar]),
    ).rejects.toThrow(/permission denied/)
  }
  const [row] = await selectAs(db, users.Ziad, `select display_name, avatar_url from profiles where id = $1`, [users.Omar])
  expect(row).toMatchObject({ display_name: 'Omar' })
})

it('search finds accounts by 2 or more letters of the name, never an email or phone', async () => {
  const omar = await createUser(db, 'Omar Searchable')
  const viewer = await createUser(db, 'Viewer')
  await rpc(db, omar, 'save_my_account', { p_account: account({ display_name: 'Omar Searchable', instapay_phone: '01012345678' }) })

  const hits = await rpc<Record<string, unknown>>(db, viewer, 'search_accounts', { p_query: 'searchab' })
  expect(hits).toEqual([
    { user_id: omar, display_name: 'Omar Searchable', avatar_url: null, shirt_number: 10, favourite_position: 'attack' },
  ])
  expect(await rpc(db, viewer, 'search_accounts', { p_query: 's' })).toEqual([])
  expect(await rpc(db, viewer, 'search_accounts', { p_query: '%%' })).toEqual([])
})

it('signed-out visitors can call none of it', async () => {
  await db.exec('set role anon')
  try {
    for (const call of ['my_account()', `search_accounts('om')`, `save_my_account('{}')`, `finish_sign_up('{}')`]) {
      await expect(db.query(`select * from public.${call}`)).rejects.toThrow(/permission denied/)
    }
  } finally {
    await db.exec('reset role')
  }
})

it('cards from before file 8 move to the account: the most complete one wins', async () => {
  const old = await createDb({ before: FILE_8 })
  try {
    const admin = await createUser(old, 'Captain')
    const omar = await createUser(old, 'Omar')
    const ziad = await createUser(old, 'Ziad')
    const groups: string[] = []
    for (const name of ['Group A', 'Group B']) {
      const [{ create_group: id }] = await rpc<{ create_group: string }>(old, admin, 'create_group', {
        p_name: name, p_display_name: 'Captain',
      })
      const [{ invite_code: code }] = await selectAs<{ invite_code: string }>(
        old, admin, `select invite_code from groups where id = $1`, [id],
      )
      for (const user of [omar, ziad]) await rpc(old, user, 'join_group', { p_code: code, p_display_name: 'x' })
      groups.push(id)
    }
    // Omar: Group A has number, foot and the skills (7 fields); Group B only a motto, and "happy in goal".
    await old.query(
      `update players set shirt_number = 10, strong_foot = 'left', skill_shooting = 8, skill_passing = 7,
       skill_dribbling = 8, skill_defending = 6, skill_fitness = 9 where user_id = $1 and group_id = $2`,
      [omar, groups[0]],
    )
    await old.query(`update players set motto = 'Old motto', happy_in_goal = true where user_id = $1 and group_id = $2`, [
      omar, groups[1],
    ])

    await runMigrations(old, (file) => file >= FILE_8)

    const [account] = (await old.query<Record<string, unknown>>(
      `select shirt_number, strong_foot, motto, skill_shooting, happy_in_goal, onboarded_at is not null as signed_up
       from profiles where id = $1`, [omar],
    )).rows
    expect(account).toEqual({
      shirt_number: 10, strong_foot: 'left', motto: null, skill_shooting: 8, happy_in_goal: true, signed_up: true,
    })
    const copies = (await old.query(
      `select shirt_number, motto, happy_in_goal from players where user_id = $1 order by group_id = $2 desc`,
      [omar, groups[0]],
    )).rows
    expect(copies).toEqual([
      { shirt_number: 10, motto: null, happy_in_goal: true },
      { shirt_number: 10, motto: null, happy_in_goal: true },
    ])
    // Ziad had no card anywhere: he gets the sign-up questions.
    const [z] = (await old.query<{ onboarded_at: string | null }>(`select onboarded_at from profiles where id = $1`, [ziad])).rows
    expect(z.onboarded_at).toBeNull()
  } finally {
    await old.close()
  }
})
