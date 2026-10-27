// The pitch link and map position (file 8 section 4), through plan_night and
// update_night as the Plan a night form sends them.
import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { createDb, nightDetails, rpc, selectAs, setupGroup } from './helpers'

let db: PGlite

beforeAll(async () => {
  db = await createDb()
})

afterAll(async () => {
  await db.close()
})

const LINK = 'https://www.google.com/maps/@30.0444,31.2357,15z'

async function pitch(user: string, matchId: string) {
  const [row] = await selectAs<Record<string, unknown>>(
    db, user, `select pitch_url, pitch_lat, pitch_lng from matches where id = $1`, [matchId],
  )
  return row
}

async function plan(admin: string, groupId: string, overrides: Record<string, unknown>) {
  const [{ plan_night: id }] = await rpc<{ plan_night: string }>(db, admin, 'plan_night', {
    p_group_id: groupId,
    p_night: nightDetails(overrides),
  })
  return id
}

it('a night keeps its Google Maps link and position; editing changes them', async () => {
  const { groupId, users } = await setupGroup(db)
  const id = await plan(users.admin, groupId, { pitch_url: LINK, pitch_lat: 30.0444, pitch_lng: 31.2357 })
  expect(await pitch(users.Omar, id)).toEqual({ pitch_url: LINK, pitch_lat: 30.0444, pitch_lng: 31.2357 })

  await rpc(db, users.admin, 'update_night', {
    p_match_id: id,
    p_night: nightDetails({ pitch_url: 'https://maps.app.goo.gl/AbC123', pitch_lat: null, pitch_lng: null }),
  })
  expect(await pitch(users.Omar, id)).toEqual({ pitch_url: 'https://maps.app.goo.gl/AbC123', pitch_lat: null, pitch_lng: null })
})

it('a night without a link has none (older app versions send no link)', async () => {
  const { groupId, users } = await setupGroup(db)
  const id = await plan(users.admin, groupId, {})
  expect(await pitch(users.Omar, id)).toEqual({ pitch_url: null, pitch_lat: null, pitch_lng: null })
})

it('refuses links that are not https and positions that are not real', async () => {
  const { groupId, users } = await setupGroup(db)
  await expect(plan(users.admin, groupId, { pitch_url: 'http://maps.google.com/?q=1,2' })).rejects.toThrow('Paste a Google Maps link.')
  await expect(plan(users.admin, groupId, { pitch_url: LINK, pitch_lat: 95.1, pitch_lng: 31.2 })).rejects.toThrow(
    'That map position is not valid.',
  )
  await expect(plan(users.admin, groupId, { pitch_url: LINK, pitch_lat: 30.04, pitch_lng: null })).rejects.toThrow(
    'That map position is not valid.',
  )
})

it('a position without a link is dropped', async () => {
  const { groupId, users } = await setupGroup(db)
  const id = await plan(users.admin, groupId, { pitch_url: '', pitch_lat: 30.04, pitch_lng: 31.23 })
  expect(await pitch(users.Omar, id)).toEqual({ pitch_url: null, pitch_lat: null, pitch_lng: null })
})
