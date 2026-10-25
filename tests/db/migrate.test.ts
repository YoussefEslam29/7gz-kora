// Moving the old nights over to games (file 5,
// supabase/migrations/20261025000100_games.sql), as on the live project:
// files 1 to 4 run first, a night is stored the old way, then file 5 runs.
import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { createDb, runMigrations } from './helpers'

const GAMES_FILE = '20261025000100'

let db: PGlite
let group = ''
let closed = ''
let planned = ''
const players: string[] = []
let before: unknown[] = []

async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  return (await db.query<T>(sql, params)).rows[0]
}

beforeAll(async () => {
  db = await createDb({ before: GAMES_FILE })
  group = (await one<{ id: string }>(`insert into groups (name) values ('Old FC') returning id`)).id
  await db.query(`insert into rating_config (group_id) values ($1)`, [group])
  for (const name of ['Keeper', 'Omar', 'Ziad', 'Karim']) {
    const p = await one<{ id: string }>(
      `insert into players (group_id, display_name) values ($1, $2) returning id`, [group, name])
    players.push(p.id)
  }

  // A finished night from before games: two stints, the second three times as long.
  closed = (await one<{ id: string }>(
    `insert into matches (group_id, played_at, starts_at, duration_minutes, status, closed_at)
     values ($1, '2026-10-15', '2026-10-15T17:00:00Z', 120, 'closed', now()) returning id`, [group])).id
  for (const p of players) {
    await db.query(`insert into match_players (match_id, player_id) values ($1, $2)`, [closed, p])
  }
  // Stint 1: Keeper + Omar (A) v Ziad + Karim (B). Stint 2: Omar and Ziad swap.
  const teams = [['A', 'A', 'B', 'B'], ['A', 'B', 'A', 'B']]
  const stints: string[] = []
  for (const [i, weight] of [1, 3].entries()) {
    const s = await one<{ id: string }>(
      `insert into stints (match_id, ordinal, weight) values ($1, $2, $3) returning id`, [closed, i + 1, weight])
    stints.push(s.id)
    for (const [j, p] of players.entries()) {
      await db.query(
        `insert into stint_players (stint_id, match_id, player_id, team, is_goalkeeper) values ($1, $2, $3, $4, $5)`,
        [s.id, closed, p, teams[i][j], j === 0])
    }
  }
  await db.query(
    `insert into goals (match_id, stint_id, scoring_team, scorer_id, confirmed) values ($1, $2, 'A', $3, true)`,
    [closed, stints[0], players[1]])
  await db.query(`select compute_match_ratings($1)`, [closed])
  before = (await db.query(
    `select player_id, final_rating, breakdown, computed_at from match_ratings where match_id = $1 order by player_id`,
    [closed])).rows

  planned = (await one<{ id: string }>(`insert into matches (group_id, status) values ($1, 'draft') returning id`, [group])).id

  await runMigrations(db, (file) => file >= GAMES_FILE)
})

afterAll(async () => {
  await db.close()
})

const iso = (d: Date | string) => new Date(d).toISOString()

it('an old night becomes one game between Team A and Team B, lasting the whole booking', async () => {
  const games = (await db.query<{
    ordinal: number; team_one: string; team_two: string; planned_minutes: number
    started_at: Date; ended_at: Date; penalty_winner: string | null
  }>(`select * from games where match_id = $1`, [closed])).rows
  expect(games).toHaveLength(1)
  expect(games[0]).toMatchObject({ ordinal: 1, team_one: 'A', team_two: 'B', planned_minutes: 120, penalty_winner: null })
  expect(iso(games[0].started_at)).toBe('2026-10-15T17:00:00.000Z')
  expect(iso(games[0].ended_at)).toBe('2026-10-15T19:00:00.000Z')
  // A planned night has no lineups, so no games.
  expect((await db.query(`select * from games where match_id = $1`, [planned])).rows).toHaveLength(0)
})

it('its lineup periods share that time by their old weights, and the goals follow them', async () => {
  const [game] = (await db.query<{ id: string }>(`select id from games where match_id = $1`, [closed])).rows
  const periods = (await db.query<{ game_id: string; started_at: Date; ended_at: Date }>(
    `select game_id, started_at, ended_at from stints where match_id = $1 order by ordinal`, [closed])).rows
  expect(periods.map((p) => [iso(p.started_at), iso(p.ended_at)])).toEqual([
    ['2026-10-15T17:00:00.000Z', '2026-10-15T17:30:00.000Z'],
    ['2026-10-15T17:30:00.000Z', '2026-10-15T19:00:00.000Z'],
  ])
  expect(periods.every((p) => p.game_id === game.id)).toBe(true)
  const goals = (await db.query<{ game_id: string }>(`select game_id from goals where match_id = $1`, [closed])).rows
  expect(goals).toEqual([{ game_id: game.id }])
})

it('the team board shows the last lineup; stored ratings are kept and get their minutes', async () => {
  const board = (await db.query<{ player_id: string; team: string }>(
    `select player_id, team from match_players where match_id = $1`, [closed])).rows
  expect(players.map((p) => board.find((b) => b.player_id === p)!.team)).toEqual(['A', 'B', 'A', 'B'])

  const after = (await db.query(
    `select player_id, final_rating, breakdown, computed_at from match_ratings where match_id = $1 order by player_id`,
    [closed])).rows
  expect(after).toEqual(before)
  const minutes = (await db.query<{ player_id: string; minutes_played: string; minutes_in_goal: string }>(
    `select player_id, minutes_played, minutes_in_goal from match_ratings where match_id = $1`, [closed])).rows
  expect(minutes.every((m) => Number(m.minutes_played) === 120)).toBe(true)
  expect(Number(minutes.find((m) => m.player_id === players[0])!.minutes_in_goal)).toBe(120)
  expect(Number(minutes.find((m) => m.player_id === players[1])!.minutes_in_goal)).toBe(0)
})

it('rating settings drop clean_sheet_min_share', async () => {
  const cfg = await one<{ points: Record<string, number> }>(`select points from rating_config where group_id = $1`, [group])
  expect(cfg.points).not.toHaveProperty('clean_sheet_min_share')
})

it('afterwards every lineup period and goal belongs to a game, and the old weights are gone', async () => {
  const cols = (await db.query<{ table_name: string; column_name: string; is_nullable: string }>(
    `select table_name, column_name, is_nullable from information_schema.columns
     where table_schema = 'public' and table_name in ('stints', 'goals')
       and column_name in ('weight', 'game_id', 'started_at')`)).rows
  expect(cols.map((c) => `${c.table_name}.${c.column_name} ${c.is_nullable}`).sort()).toEqual([
    'goals.game_id NO',
    'stints.game_id NO',
    'stints.started_at NO',
  ])
})

it('an old night recalculates with the new rules', async () => {
  await db.query(`select compute_match_ratings($1)`, [closed])
  const rows = (await db.query<{ player_id: string; minutes_played: string; breakdown: { net_goal_diff: number } }>(
    `select player_id, minutes_played, breakdown from match_ratings where match_id = $1`, [closed])).rows
  expect(rows).toHaveLength(4)
  expect(rows.every((r) => Number(r.minutes_played) === 120)).toBe(true)
  // Omar scored for Team A in the first period, then played for Team B: +1.
  expect(rows.find((r) => r.player_id === players[1])!.breakdown.net_goal_diff).toBe(1)
})
