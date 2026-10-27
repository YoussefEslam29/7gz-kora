// The player card (file 7, supabase/migrations/20261025000300_player_card.sql)
// and the rating settings admins now change in the app (no database change).
// It runs files 1 to 7 only: file 8 moves the card onto the account
// (tests/db/accounts.test.ts).
import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { createDb, runMigrations, selectAs, setupGroup } from './helpers'

const FILE_7 = '20261025000300_player_card.sql'
const FILE_8 = '20261026000100_accounts_groups_chat.sql'
const SKILLS = 'skill_shooting = 8, skill_passing = 7, skill_dribbling = 8, skill_defending = 6, skill_fitness = 9'
let db: PGlite

beforeAll(async () => {
  db = await createDb({ before: FILE_8 })
})

afterAll(async () => {
  await db.close()
})

type Card = {
  shirt_number: number | null
  strong_foot: string | null
  favourite_position: string | null
  motto: string | null
  skill_shooting: number | null
  skill_fitness: number | null
}

async function card(userId: string, playerId: string): Promise<Card> {
  const [row] = await selectAs<Card>(
    db, userId,
    `select shirt_number, strong_foot, favourite_position, motto, skill_shooting, skill_fitness from players where id = $1`,
    [playerId],
  )
  return row
}

const EMPTY: Card = {
  shirt_number: null, strong_foot: null, favourite_position: null, motto: null, skill_shooting: null, skill_fitness: null,
}

it('a new player has an empty card', async () => {
  const { users, pid } = await setupGroup(db)
  expect(await card(users.Omar, pid(users.Omar))).toEqual(EMPTY)
})

it('players fill in their own card, an Arabic motto included, and the group sees it', async () => {
  const { users, pid } = await setupGroup(db)
  await selectAs(
    db, users.Omar,
    `update players set shirt_number = 10, strong_foot = 'left', favourite_position = 'attack', motto = 'يلا بينا', ${SKILLS}
     where id = $1`,
    [pid(users.Omar)],
  )
  expect(await card(users.Ziad, pid(users.Omar))).toEqual({
    shirt_number: 10, strong_foot: 'left', favourite_position: 'attack', motto: 'يلا بينا', skill_shooting: 8, skill_fitness: 9,
  })
})

it("admins change anyone's card; a member changing someone else's changes nothing", async () => {
  const { users, pid } = await setupGroup(db)
  await selectAs(db, users.admin, `update players set shirt_number = 1 where id = $1`, [pid(users.Ziad)])
  expect((await card(users.Ziad, pid(users.Ziad))).shirt_number).toBe(1)

  // The row rule (file 1) only lets members update themselves, so this matches no rows.
  await selectAs(db, users.Omar, `update players set shirt_number = 99 where id = $1`, [pid(users.Ziad)])
  expect((await card(users.Ziad, pid(users.Ziad))).shirt_number).toBe(1)
})

it('numbers, feet, positions, mottos and skills stay in range', async () => {
  const { users, pid } = await setupGroup(db)
  const me = pid(users.Omar)
  const bad: [string, RegExp][] = [
    ['shirt_number = 0', /players_shirt_number_check/],
    ['shirt_number = 100', /players_shirt_number_check/],
    [`strong_foot = 'head'`, /players_strong_foot_check/],
    [`favourite_position = 'striker'`, /players_favourite_position_check/],
    [`motto = ''`, /players_motto_check/],
    [`motto = repeat('a', 61)`, /players_motto_check/],
    [SKILLS.replace('skill_shooting = 8', 'skill_shooting = 0'), /players_skill_shooting_check/],
    [SKILLS.replace('skill_fitness = 9', 'skill_fitness = 11'), /players_skill_fitness_check/],
  ]
  for (const [set, error] of bad) {
    await expect(selectAs(db, users.Omar, `update players set ${set} where id = $1`, [me])).rejects.toThrow(error)
  }
  expect(await card(users.Omar, me)).toEqual(EMPTY)
})

it('the skills are all five or none', async () => {
  const { users, pid } = await setupGroup(db)
  const me = pid(users.Omar)
  await expect(
    selectAs(db, users.Omar, `update players set skill_shooting = 8 where id = $1`, [me]),
  ).rejects.toThrow(/players_skills_all_or_none/)
  await selectAs(db, users.Omar, `update players set ${SKILLS} where id = $1`, [me])
  // Clearing all five is fine.
  await selectAs(
    db, users.Omar,
    `update players set skill_shooting = null, skill_passing = null, skill_dribbling = null, skill_defending = null,
     skill_fitness = null where id = $1`,
    [me],
  )
  expect((await card(users.Omar, me)).skill_shooting).toBeNull()
})

it('the rest of a player stays locked', async () => {
  const { users, pid } = await setupGroup(db)
  for (const set of ['user_id = null', 'group_id = gen_random_uuid()', 'is_guest = true']) {
    await expect(
      selectAs(db, users.Omar, `update players set ${set} where id = $1`, [pid(users.Omar)]),
    ).rejects.toThrow(/permission denied/)
  }
})

it('signed-out visitors cannot read cards', async () => {
  await db.exec('set role anon')
  try {
    await expect(db.query('select motto from public.players')).rejects.toThrow(/permission denied/)
  } finally {
    await db.exec('reset role')
  }
})

it('players from before this file get an empty card, as on the live project', async () => {
  const old = await createDb({ before: FILE_7 })
  try {
    const { rows } = await old.query<{ id: string }>(`insert into groups (name) values ('Old group') returning id`)
    await old.query(`insert into players (group_id, display_name) values ($1, 'Old player')`, [rows[0].id])
    await runMigrations(old, (file) => file >= FILE_7 && file < FILE_8)
    const after = await old.query(`select shirt_number, strong_foot, favourite_position, motto, skill_shooting, skill_fitness from players`)
    expect(after.rows).toEqual([EMPTY])
  } finally {
    await old.close()
  }
})

// Rating settings (Plans/Player-card-and-motion.md section 4): already allowed by file 3.
type Settings = { w_analytics: string; w_votes: string; min_votes: number; min_matches_for_leaderboard: number; voting_hours: number }

async function settings(userId: string, groupId: string): Promise<Settings> {
  const [row] = await selectAs<Settings>(
    db, userId,
    `select w_analytics::text, w_votes::text, min_votes, min_matches_for_leaderboard, voting_hours
     from rating_config where group_id = $1`,
    [groupId],
  )
  return row
}

it('admins change the rating settings; a member trying to changes nothing', async () => {
  const { groupId, users } = await setupGroup(db)
  await selectAs(
    db, users.admin,
    `update rating_config set w_analytics = 0.6, w_votes = 0.4, min_votes = 3, min_matches_for_leaderboard = 4,
     voting_hours = 48 where group_id = $1`,
    [groupId],
  )
  expect(await settings(users.Omar, groupId)).toEqual({
    w_analytics: '0.6', w_votes: '0.4', min_votes: 3, min_matches_for_leaderboard: 4, voting_hours: 48,
  })

  await selectAs(db, users.Omar, `update rating_config set voting_hours = 6 where group_id = $1`, [groupId])
  expect((await settings(users.Omar, groupId)).voting_hours).toBe(48)
})

it('the two weights must still add up to 1', async () => {
  const { groupId, users } = await setupGroup(db)
  await expect(
    selectAs(db, users.admin, `update rating_config set w_analytics = 0.7 where group_id = $1`, [groupId]),
  ).rejects.toThrow(/check constraint/)
})
