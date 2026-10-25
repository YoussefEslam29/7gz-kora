// Test helpers: runs the real migration SQL inside PGlite (Postgres compiled
// to WebAssembly), so `npm test` needs no Docker and no Supabase account.
import { PGlite } from '@electric-sql/pglite'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const migrationsDir = join(root, 'supabase', 'migrations')

// Minimal stand-ins for what a Supabase project already has.
const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  grant anon, authenticated, service_role to postgres;
  create schema auth;
  grant usage on schema auth to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    raw_user_meta_data jsonb not null default '{}'
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  -- Like Supabase: new tables and functions are open to everyone unless revoked.
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`

/**
 * A fresh database with the migrations applied. `before` stops at the first
 * file whose name sorts at or after it (to test moving old data over).
 */
export async function createDb(options: { before?: string } = {}): Promise<PGlite> {
  const db = new PGlite()
  await db.exec(SUPABASE_STUB)
  await runMigrations(db, (file) => !options.before || file < options.before)
  return db
}

/** Runs the migration files that `include` picks, in order. */
export async function runMigrations(db: PGlite, include: (file: string) => boolean) {
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql') && include(f)).sort()
  for (const file of files) {
    await db.exec(readFileSync(join(migrationsDir, file), 'utf8'))
  }
}

export async function runSqlFile(db: PGlite, relativePath: string) {
  await db.exec(readFileSync(join(root, relativePath), 'utf8'))
}

// ---------------------------------------------------------------------------
// Acting as a signed-in user (RLS applies, exactly like the real app)
// ---------------------------------------------------------------------------
export async function createUser(db: PGlite, name: string): Promise<string> {
  const email = `${name.toLowerCase().replace(/\s+/g, '.')}.${Math.random().toString(36).slice(2, 8)}@example.com`
  const res = await db.query<{ id: string }>(
    `insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`,
    [email, JSON.stringify({ full_name: name })],
  )
  return res.rows[0].id
}

async function asUser<T>(db: PGlite, userId: string, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set request.jwt.claim.sub = '${userId}'; set role authenticated;`)
  try {
    return await fn()
  } finally {
    await db.exec(`reset role; reset request.jwt.claim.sub;`)
  }
}

/** Calls a database function the way the app does (supabase.rpc). */
export async function rpc<T = Record<string, unknown>>(
  db: PGlite,
  userId: string,
  fn: string,
  args: Record<string, unknown> = {},
): Promise<T[]> {
  const keys = Object.keys(args)
  const params = keys.map((k) => {
    const v = args[k]
    return v !== null && typeof v === 'object' ? JSON.stringify(v) : v
  })
  const sql = `select * from public.${fn}(${keys.map((k, i) => `${k} => $${i + 1}`).join(', ')})`
  return asUser(db, userId, async () => (await db.query<T>(sql, params)).rows)
}

/** Runs a SELECT as a signed-in user. */
export async function selectAs<T = Record<string, unknown>>(
  db: PGlite,
  userId: string,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  return asUser(db, userId, async () => (await db.query<T>(sql, params)).rows)
}

// ---------------------------------------------------------------------------
// Direct fixtures for rating tests (as the database owner, bypassing RLS)
// ---------------------------------------------------------------------------
export type Team = 'A' | 'B' | 'C'
/** Who is on the pitch in a lineup period, by team, and who is in goal. */
export type Lineup = Partial<Record<Team, string[]>> & { gk?: string[] }

/**
 * Builds a night for rating tests: games, lineup periods lasting exact
 * minutes (on a clock starting at 20:00), goals, saves and votes.
 */
export class MatchBuilder {
  players = new Map<string, string>()
  /** Lineup period ids, in order. */
  periods: string[] = []
  groupId = ''
  matchId = ''
  private db: PGlite
  private clock = Date.parse('2026-10-29T18:00:00Z')
  private gameId = ''
  private teams = new Map<string, Map<string, Team>>()

  constructor(db: PGlite) {
    this.db = db
  }

  static async create(db: PGlite, names: string[]) {
    const b = new MatchBuilder(db)
    const g = await db.query<{ id: string }>(`insert into groups (name) values ('Test group') returning id`)
    b.groupId = g.rows[0].id
    await db.query(`insert into rating_config (group_id) values ($1)`, [b.groupId])
    for (const name of names) {
      const p = await db.query<{ id: string }>(
        `insert into players (group_id, display_name) values ($1, $2) returning id`,
        [b.groupId, name],
      )
      b.players.set(name, p.rows[0].id)
    }
    const m = await db.query<{ id: string }>(
      `insert into matches (group_id, status) values ($1, 'voting') returning id`,
      [b.groupId],
    )
    b.matchId = m.rows[0].id
    return b
  }

  id(name: string): string {
    const id = this.players.get(name)
    if (!id) throw new Error(`Unknown player ${name}`)
    return id
  }

  /** Starts a new game between two teams. penaltyWinner: who won a shootout after a draw. */
  async game(teamOne: Team, teamTwo: Team, penaltyWinner: Team | null = null): Promise<string> {
    const at = new Date(this.clock).toISOString()
    const g = await this.db.query<{ id: string }>(
      `insert into games (match_id, ordinal, team_one, team_two, planned_minutes, started_at, ended_at, penalty_winner)
       values ($1, (select count(*) + 1 from games where match_id = $1), $2, $3, 10, $4, $4, $5) returning id`,
      [this.matchId, teamOne, teamTwo, at, penaltyWinner],
    )
    this.gameId = g.rows[0].id
    return this.gameId
  }

  /** A lineup period of the current game lasting `minutes`. The clock moves on. */
  async period(minutes: number, lineup: Lineup): Promise<string> {
    if (!this.gameId) throw new Error('Start a game first')
    const start = new Date(this.clock).toISOString()
    this.clock += minutes * 60_000
    const end = new Date(this.clock).toISOString()
    const s = await this.db.query<{ id: string }>(
      `insert into stints (match_id, game_id, ordinal, started_at, ended_at) values ($1, $2, $3, $4, $5) returning id`,
      [this.matchId, this.gameId, this.periods.length + 1, start, end],
    )
    await this.db.query(`update games set ended_at = $2 where id = $1`, [this.gameId, end])
    const periodId = s.rows[0].id
    this.periods.push(periodId)
    const teams = new Map<string, Team>()
    for (const team of ['A', 'B', 'C'] as const) {
      for (const name of lineup[team] ?? []) {
        teams.set(name, team)
        await this.checkIn(name)
        await this.db.query(
          `insert into stint_players (stint_id, match_id, player_id, team, is_goalkeeper) values ($1, $2, $3, $4, $5)`,
          [periodId, this.matchId, this.id(name), team, (lineup.gk ?? []).includes(name)],
        )
      }
    }
    this.teams.set(periodId, teams)
    return periodId
  }

  /** A Phase 1 style match: one game of A v B with one lineup period (60 minutes). */
  async match(lineup: Lineup, minutes = 60): Promise<string> {
    await this.game('A', 'B')
    return this.period(minutes, lineup)
  }

  /** Checked in for the night (a sub may never get on the pitch). */
  async checkIn(name: string) {
    await this.db.query(
      `insert into match_players (match_id, player_id) values ($1, $2) on conflict do nothing`,
      [this.matchId, this.id(name)],
    )
  }

  /** Logs a goal in the given lineup period (default: the last one). */
  async goal(scorer: string, assister: string | null = null, opts: { period?: string; disputed?: boolean } = {}) {
    const periodId = opts.period ?? this.periods[this.periods.length - 1]
    const team = this.teams.get(periodId)?.get(scorer)
    if (!team) throw new Error(`${scorer} is not in that lineup period`)
    await this.db.query(
      `insert into goals (match_id, game_id, stint_id, scoring_team, scorer_id, assister_id, disputed)
       values ($1, (select game_id from stints where id = $2), $2, $3, $4, $5, $6)`,
      [this.matchId, periodId, team, this.id(scorer), assister ? this.id(assister) : null, opts.disputed ?? false],
    )
  }

  async save(goalkeeper: string) {
    await this.db.query(
      `insert into saves (match_id, stint_id, goalkeeper_id) values ($1, $2, $3)`,
      [this.matchId, this.periods[this.periods.length - 1], this.id(goalkeeper)],
    )
  }

  /** score = null means "Didn't see enough". */
  async vote(voter: string, target: string, score: number | null) {
    await this.db.query(
      `insert into ratings_votes (match_id, voter_id, target_id, score, didnt_see) values ($1, $2, $3, $4, $5)`,
      [this.matchId, this.id(voter), this.id(target), score, score === null],
    )
  }

  async mvp(voter: string, target: string) {
    await this.db.query(
      `insert into mvp_votes (match_id, voter_id, target_id) values ($1, $2, $3)`,
      [this.matchId, this.id(voter), this.id(target)],
    )
  }

  async setConfig(sql: string) {
    await this.db.query(`update rating_config set ${sql} where group_id = $1`, [this.groupId])
  }

  /** Runs the rating calculation and returns the results by player name. */
  async compute() {
    await this.db.query(`select compute_match_ratings($1)`, [this.matchId])
    const res = await this.db.query<RatingRow>(
      `select player_id, analytics_score::float8 as analytics, vote_average::float8 as vote_average,
              vote_count, stats_only, final_rating::float8 as final, rating::float8 as rating,
              goals, assists, clean_sheets, saves, mvp_votes, is_mvp,
              minutes_played::float8 as minutes_played, minutes_in_goal::float8 as minutes_in_goal, breakdown
       from match_ratings where match_id = $1`,
      [this.matchId],
    )
    const byName = new Map<string, RatingRow>()
    for (const row of res.rows) {
      const name = [...this.players.entries()].find(([, id]) => id === row.player_id)?.[0]
      if (name) byName.set(name, row)
    }
    return byName
  }
}

export type RatingRow = {
  player_id: string
  analytics: number
  vote_average: number | null
  vote_count: number
  stats_only: boolean
  final: number
  rating: number
  goals: number
  assists: number
  clean_sheets: number
  saves: number
  mvp_votes: number
  is_mvp: boolean
  minutes_played: number
  minutes_in_goal: number
  breakdown: Record<string, number | boolean | null>
}

// ---------------------------------------------------------------------------
// Groups and nights, created through the app actions (as real users)
// ---------------------------------------------------------------------------

/** A group with an admin ("Captain") and members, each with their player id. */
export async function setupGroup(db: PGlite, names: string[] = ['Omar', 'Ziad', 'محمد']) {
  const admin = await createUser(db, 'Captain')
  const [{ create_group: groupId }] = await rpc<{ create_group: string }>(db, admin, 'create_group', {
    p_name: 'Thursday Football',
    p_display_name: 'Captain',
  })
  const [{ invite_code: code }] = await selectAs<{ invite_code: string }>(
    db, admin, `select invite_code from groups where id = $1`, [groupId],
  )
  const users: Record<string, string> = { admin }
  for (const name of names) {
    users[name] = await createUser(db, name)
    await rpc(db, users[name], 'join_group', { p_code: code, p_display_name: name })
  }
  const players = await selectAs<{ user_id: string; id: string }>(
    db, admin, `select user_id, id from players where group_id = $1`, [groupId],
  )
  const pid = (user: string) => players.find((p) => p.user_id === user)!.id
  return { groupId, code, users, pid }
}

/** Night details as the "Plan a night" form sends them. */
export function nightDetails(overrides: Record<string, unknown> = {}) {
  return {
    played_at: '2026-10-29',
    starts_at: '2026-10-29T18:00:00Z', // 20:00 in Cairo
    location: 'Club pitch 3',
    duration_minutes: 120,
    cost: 600,
    players_per_side: 6,
    collector_player_id: null,
    game_minutes: 10,
    player_cap: 18,
    ...overrides,
  }
}

/** Plans a night, starts it and checks the given players in. Returns the night's id. */
export async function startNight(
  db: PGlite,
  admin: string,
  groupId: string,
  playerIds: string[],
  details: Record<string, unknown> = nightDetails(),
): Promise<string> {
  const [{ plan_night: matchId }] = await rpc<{ plan_night: string }>(db, admin, 'plan_night', {
    p_group_id: groupId,
    p_night: details,
  })
  await rpc(db, admin, 'start_night', { p_match_id: matchId })
  for (const playerId of playerIds) {
    await rpc(db, admin, 'check_in', { p_match_id: matchId, p_player_id: playerId })
  }
  return matchId
}

/**
 * Puts players on the team board ({ player id: team, or null for the bench })
 * and starts a game between two teams. Returns the game's id.
 */
export async function startGame(
  db: PGlite,
  admin: string,
  matchId: string,
  board: Record<string, Team | null>,
  teams: [Team, Team] = ['A', 'B'],
  keepers: [string | null, string | null] = [null, null],
): Promise<string> {
  await rpc(db, admin, 'set_team_board', {
    p_match_id: matchId,
    p_board: Object.entries(board).map(([player_id, team]) => ({ player_id, team })),
  })
  const [{ start_game: gameId }] = await rpc<{ start_game: string }>(db, admin, 'start_game', {
    p_match_id: matchId,
    p_team_one: teams[0],
    p_team_two: teams[1],
    p_keeper_one: keepers[0],
    p_keeper_two: keepers[1],
  })
  return gameId
}
