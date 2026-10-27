// The group chat (file 8 section 3): members only, 1-500 characters,
// deleting blanks a message, live through Supabase Realtime.
import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { createDb, createUser, rpc, selectAs, setupGroup } from './helpers'

let db: PGlite

beforeAll(async () => {
  db = await createDb()
})

afterAll(async () => {
  await db.close()
})

type Message = { id: string; player_id: string; body: string | null; deleted_at: string | null }

const send = async (user: string, groupId: string, body: string) =>
  (await rpc<{ send_message: string }>(db, user, 'send_message', { p_group_id: groupId, p_body: body }))[0].send_message

const read = (user: string, groupId: string) =>
  selectAs<Message>(db, user, `select id, player_id, body, deleted_at from group_messages where group_id = $1 order by created_at`, [groupId])

it('members write and read their group chat; spaces around a message are trimmed', async () => {
  const { groupId, users, pid } = await setupGroup(db)
  await send(users.Omar, groupId, '  يلا بينا  ')
  const messages = await read(users.Ziad, groupId)
  expect(messages).toEqual([expect.objectContaining({ player_id: pid(users.Omar), body: 'يلا بينا', deleted_at: null })])
})

it('refuses empty, all-space and too-long messages', async () => {
  const { groupId, users } = await setupGroup(db)
  await expect(send(users.Omar, groupId, '')).rejects.toThrow('Type a message first.')
  await expect(send(users.Omar, groupId, '   ')).rejects.toThrow('Type a message first.')
  await expect(send(users.Omar, groupId, 'a'.repeat(501))).rejects.toThrow('Messages can be up to 500 characters.')
  await send(users.Omar, groupId, 'a'.repeat(500))
})

it("outsiders can't read or write, and removed members stop reading; their messages stay", async () => {
  const { groupId, users } = await setupGroup(db)
  const stranger = await createUser(db, 'Stranger')
  await send(users.Omar, groupId, 'Who has the ball?')
  expect(await read(stranger, groupId)).toEqual([])
  await expect(send(stranger, groupId, 'hi')).rejects.toThrow('You are not a member of this group.')

  await rpc(db, users.admin, 'remove_member', { p_group_id: groupId, p_user_id: users.Omar })
  expect(await read(users.Omar, groupId)).toEqual([])
  expect((await read(users.Ziad, groupId)).map((m) => m.body)).toEqual(['Who has the ball?'])
})

it('you delete your own message; an admin can delete anyone’s; a member can’t', async () => {
  const { groupId, users } = await setupGroup(db)
  const mine = await send(users.Omar, groupId, 'Wrong chat, sorry')
  const ziads = await send(users.Ziad, groupId, 'Keep this')

  await expect(rpc(db, users.Omar, 'delete_message', { p_message_id: ziads })).rejects.toThrow('Only group admins can do this.')
  await rpc(db, users.Omar, 'delete_message', { p_message_id: mine })
  await rpc(db, users.admin, 'delete_message', { p_message_id: ziads })

  const messages = await read(users.Ziad, groupId)
  expect(messages.map((m) => [m.body, m.deleted_at !== null])).toEqual([[null, true], [null, true]])
  const log = await selectAs<{ action: string }>(db, users.admin, `select action from audit_log where group_id = $1 and action = 'message_deleted'`, [groupId])
  expect(log).toHaveLength(1) // only the admin's delete of someone else's
})

it('nobody writes messages directly, and signed-out visitors see nothing', async () => {
  const { groupId, users, pid } = await setupGroup(db)
  await expect(
    selectAs(db, users.Omar, `insert into group_messages (group_id, player_id, body) values ($1, $2, 'x')`, [groupId, pid(users.Omar)]),
  ).rejects.toThrow(/permission denied/)
  await db.exec('set role anon')
  try {
    await expect(db.query('select * from public.group_messages')).rejects.toThrow(/permission denied/)
  } finally {
    await db.exec('reset role')
  }
})

it('the chat is in the Realtime publication', async () => {
  const { rows } = await db.query(`select tablename from pg_publication_tables where pubname = 'supabase_realtime'`)
  expect(rows).toContainEqual({ tablename: 'group_messages' })
})
