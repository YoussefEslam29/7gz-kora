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
`

export async function createDb(): Promise<PGlite> {
  const db = new PGlite()
  await db.exec(SUPABASE_STUB)
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()
  for (const file of files) {
    await db.exec(readFileSync(join(migrationsDir, file), 'utf8'))
  }
  return db
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
export type Lineup = { A: string[]; B: string[]; gk?: string[] }

export class MatchBuilder {
  players = new Map<string, string>()
  stints: string[] = []
  groupId = ''
  matchId = ''
  private lineups = new Map<string, Map<string, 'A' | 'B'>>()
  private db: PGlite

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

  async stint(weight: number, lineup: Lineup): Promise<string> {
    const s = await this.db.query<{ id: string }>(
      `insert into stints (match_id, ordinal, weight) values ($1, $2, $3) returning id`,
      [this.matchId, this.stints.length + 1, weight],
    )
    const stintId = s.rows[0].id
    this.stints.push(stintId)
    const teams = new Map<string, 'A' | 'B'>()
    for (const team of ['A', 'B'] as const) {
      for (const name of lineup[team]) {
        teams.set(name, team)
        await this.db.query(
          `insert into match_players (match_id, player_id) values ($1, $2) on conflict do nothing`,
          [this.matchId, this.id(name)],
        )
        await this.db.query(
          `insert into stint_players (stint_id, match_id, player_id, team, is_goalkeeper) values ($1, $2, $3, $4, $5)`,
          [stintId, this.matchId, this.id(name), team, (lineup.gk ?? []).includes(name)],
        )
      }
    }
    this.lineups.set(stintId, teams)
    return stintId
  }

  /** Logs a goal in the given stint (default: the last one). */
  async goal(scorer: string, assister: string | null = null, opts: { stint?: string; disputed?: boolean } = {}) {
    const stintId = opts.stint ?? this.stints[this.stints.length - 1]
    const team = this.lineups.get(stintId)?.get(scorer)
    if (!team) throw new Error(`${scorer} is not in that stint`)
    await this.db.query(
      `insert into goals (match_id, stint_id, scoring_team, scorer_id, assister_id, disputed)
       values ($1, $2, $3, $4, $5, $6)`,
      [this.matchId, stintId, team, this.id(scorer), assister ? this.id(assister) : null, opts.disputed ?? false],
    )
  }

  async save(goalkeeper: string) {
    await this.db.query(
      `insert into saves (match_id, stint_id, goalkeeper_id) values ($1, $2, $3)`,
      [this.matchId, this.stints[this.stints.length - 1], this.id(goalkeeper)],
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
              goals, assists, clean_sheets, saves, mvp_votes, is_mvp, breakdown
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
  breakdown: Record<string, number | boolean | null>
}
