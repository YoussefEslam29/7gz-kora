# Stage 2: Games — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Many short games in a night: a team board (Team A, B, C and the bench), games with a timer, swaps ("Swap and continue" or "End game and swap"), penalties that only decide who stays on, admin-only goal logging, minutes played and in goal with goalkeeper and sub suggestions, and one rating per night from all its games, with the team-impact fix.

**Architecture:** A night is still a row in `matches`. A new migration file 5 (`supabase/migrations/20261025000100_games.sql`) adds a `games` table, gives lineup periods (`stints`) a game and real start/end times, puts the team board on `match_players.team`, moves the old nights over (one game each), rewrites `compute_match_ratings` (still the one place ratings are calculated) and adds the game actions. Files 1-4 already ran on the owner's live Supabase project, so **they are never edited**: everything is added in file 5. The app gets a pure, tested `src/lib/games.ts` (scores, next game, keeper and sub suggestions, minutes, the clock) and new screens: a live control room on the night page, the team board, a Swap screen and an admin-only goal screen.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Tailwind 4, react-router 8, supabase-js 2, Postgres (Supabase), PGlite for database tests, vitest 5. No new packages.

**Spec:** `Plans/README.md` (build order item 2), `Plans/Football-scenario.md` (sections 0, 2, 3, 6, 7, 10), `Plans/Extras-and-backlog.md` (sections 3, 4, 9), `Design/README.md` and the "Live night (admin)" screen in `Design/screens.html`. Rules from the root `CLAUDE.md`.

## Global Constraints

- **Files 1-4 in `supabase/migrations/` ran on the live project: never edit them.** Every database change goes in file 5, `supabase/migrations/20261025000100_games.sql`: `alter table`, `create or replace function`, `drop function` for functions whose arguments change, and moving the existing rows.
- **Stay on Supabase.** Every table has Row Level Security; all writes go through `SECURITY DEFINER` functions; access is granted explicitly. Supabase grants new tables and functions to `anon` and `authenticated` by default, so file 5 revokes them explicitly (the test stand-in gets the same default grants in Task 1, so a missing revoke fails a test).
- **Admins only** start and end games, change teams, check people in and log goals. Players dispute goals and vote.
- **One rating per player per night.** Team impact is the plain **sum** of goal difference while on the pitch (the Phase 1 weighting by stint is the bug this stage fixes). Result points are weighted by minutes played. A draw decided on penalties is still a draw, and shootout goals are never recorded.
- Ratings stay computed in **one place** (`compute_match_ratings`). Every number stays owner-tunable in `rating_config.points`; new key `clean_sheet_min_minutes` (default 8) replaces `clean_sheet_min_share`.
- **A night is still a row in `matches`.** Only the screens say "night". In the database a lineup period is still a `stint`.
- **Money doesn't change.** No new money features.
- **Text on the brand green `#00BF63` is always black.** White only in the logo lettering.
- **Names can be Arabic:** wrap every name in `<Name>` (a `<bdi dir="auto">`), keep them left-aligned in lists.
- Tap targets at least 48 px (40 px small buttons only inside lists); pitch-side actions (Goal, Start game) 64 px. The control room is one scrolling screen, used one-handed, with the current game's score kept in view at the top.
- Error messages from the database are written for humans; the app shows them as-is.
- Follow the existing code style: comment density, naming, small files.
- Don't touch the owner's own uncommitted changes (`package.json`, `package-lock.json`, `.env.example`, `.gitignore`) and keep them out of the stage commit.
- Checks that must pass at the end: `npx tsc -b`, `npm run lint`, `npm test`, `npm run build`.

## How this stage is run

- One commit at the end of the stage, after the owner chooses how (their usual: straight to `main`). Each task ends with a checkpoint (tests green) instead of a commit.
- Screen checks use a **temporary** local stand-in for Supabase in the session's scratch folder (Task 11), as in stage 1. The owner chose not to keep one in the project.
- The owner must run file 5 on their live project once. Task 10 puts that in the README; the hand-over (Task 11) tells them in plain words.

## Decisions this plan makes (not covered by the plan files; flag them to the owner)

1. **Goalkeepers are picked per game** (stored with each lineup period), not kept on the team board, because the app suggests a new keeper for every game.
2. **"End game and swap" starts the next game straight away**, between the same two teams with the new players.
3. **A draw with no penalty winner** while a team is waiting: the next-game suggestion sends off the team that was already on (listed first). It's only a suggestion.
4. **While a game is on, players on the pitch can only be moved with Swap.** The team board still changes the waiting team and the bench.
5. **Someone on the pitch must be swapped off before being marked as "left early"**; leaving puts them on the bench.
6. **Admins can add a forgotten goal to any earlier game of the night**, also after the night (ratings recalculate if voting has closed). Admin goals count as confirmed; players can still dispute them.
7. **The timer buzzes once** (vibration and a short beep where the phone allows) when the game reaches its set length, and turns red. It never ends the game.
8. **Penalties can only be entered for a draw.** The app asks only when another team is waiting.
9. **Old nights become one game each**, between Team A and Team B, lasting the whole booking; their lineup periods share that time by their old weights. Stored ratings are kept, and their minutes are filled in. Run file 5 when no night is in progress.
10. **"Fewest minutes in goal this season"** (for the keeper suggestion) counts nights whose voting has closed.
11. **Profiles show** the average minutes on the pitch per night and the total minutes in goal for the season.
12. **The demo group grows to 15 players** so a three-team night can be shown.
13. **The "Extra team from N players" setting** (`min_extra_team_size`) comes with the team suggester in stage 3, where it's used.
14. **Home and the Nights list show the number of games** ("9 games") instead of a single A–B score.

---

## File structure

**Database**

| File | Change |
|---|---|
| `supabase/migrations/20261025000100_games.sql` | **New.** The team board, `games`, lineup periods with times, Team C, old nights moved over, the per-night rating, game actions, admin-only goals, permissions. |
| `supabase/seed.sql` | Demo nights with several games each: three teams, penalties, a mid-game swap, an "end game and swap", late arrivals; 15 players. |
| `tests/db/helpers.ts` | Supabase's default grants in the stand-in; `createDb({ before })` and `runMigrations`; `MatchBuilder` rewritten for games and periods; `startGame`. |
| `tests/db/migrate.test.ts` | **New.** Old nights moved over correctly, as on the live project. |
| `tests/db/rating.test.ts` | Rewritten on games: the Phase 1 examples, the night worked examples 1-5 and the extra cases. |
| `tests/db/games.test.ts` | **New.** Team board, games, swaps, penalties, admin-only goals, keepers, security. |
| `tests/db/flow.test.ts`, `tests/db/nights.test.ts` | Use the team board and games instead of `save_lineup`; admins log goals. |
| `tests/db/seed.test.ts` | Checks the new demo data. |

**App: logic (pure, tested with vitest)**

| File | Responsibility |
|---|---|
| `src/lib/games.ts` + `games.test.ts` | `gameScore`, `gameWinner`, `boardTeams`, `nextGameTeams`, `gameLineup`, `minutesTonight`, `suggestKeeper`, `suggestSub`, `gameClock` |
| `src/lib/format.ts` + `format.test.ts` | + `formatClock`, `formatMinutes`; `scoreOf` removed |
| `src/lib/types.ts` | `Team` gains C; `Game`, `BoardEntry`; times on `Stint`; team on `CheckIn`; minutes on ratings and the table |
| `src/lib/api.ts` | Games, team board, swaps, Game over, goals per game, "happy in goal"; `saveLineup` removed |
| `src/lib/useNow.ts` | **New.** The current time, ticking (for the clock) |
| `src/lib/buzz.ts` | **New.** The timer's vibration and beep |

**App: screens**

| File | Responsibility |
|---|---|
| `src/components/match.tsx` | Scoreboard for any two teams, lineups and player grid with Team C, goals grouped by game |
| `src/components/games.tsx` | **New.** `GameClock`, `GameCard` (the live game and pitch-side buttons), `GamesList` |
| `src/components/nextgame.tsx` | **New.** `NextGameCard`: next teams, keepers, sub suggestion, Start game |
| `src/components/bench.tsx` | **New.** `WaitingAndBench`, `PlayingTime` |
| `src/pages/Teams.tsx` | The team board: Out / A / B / C for everyone checked in |
| `src/pages/Swap.tsx` | **New.** Swap players, sub in, change a keeper; continue or end the game |
| `src/pages/Recorder.tsx` | Admin-only goals for the live game or an earlier one |
| `src/pages/NightPage.tsx` | The control room (admins), the live view (others), games and playing time after the night |
| `src/App.tsx` | Route `nights/:id/swap` |
| Small edits | `results.tsx`, `Vote.tsx`, `Home.tsx`, `Nights.tsx`, `PlayerProfile.tsx`, `HowItWorks.tsx`, `ui.tsx` |

**Docs:** `README.md` (file 5, games, ratings, choices, tests).

---

## Part A — Database (file 5)

### Task 1: Games in the data model, and the old nights moved over

**Files:**
- Create: `supabase/migrations/20261025000100_games.sql`
- Modify: `tests/db/helpers.ts` (the `SUPABASE_STUB` constant and `createDb`, lines 11-39)
- Modify: `tests/db/flow.test.ts` (the test `'members cannot write to tables directly'`, lines 83-93)
- Test: `tests/db/migrate.test.ts`

**Interfaces:**
- Produces (SQL): table `games (id, match_id, ordinal, team_one, team_two, planned_minutes, started_at, ended_at, penalty_winner, created_at)` with FK `games_match_id_fkey`; `stints` + `game_id`, `started_at`, `ended_at` (still nullable until Task 4); `goals` + `game_id` (nullable until Task 4); `match_players.team` (`'A' | 'B' | 'C'` or null = bench); `players.happy_in_goal`; `match_ratings.minutes_played`, `minutes_in_goal`; Team C allowed in `stint_players.team` and `goals.scoring_team`.
- Produces (tests): `createDb(options?: { before?: string })` runs only the files whose names sort before `before`; `runMigrations(db, include: (file: string) => boolean)`.

- [ ] **Step 1: Give the test stand-in Supabase's default grants, and let tests run the migrations in two halves**

In `tests/db/helpers.ts`, add these three lines at the end of `SUPABASE_STUB` (just before the closing backtick), so a table or function that file 5 forgets to revoke shows up in the tests exactly as it would on Supabase:

```sql
  -- Like Supabase: new tables and functions are open to everyone unless revoked.
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
```

Replace `createDb` with:

```ts
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
```

Run: `npm test` → Expected: all tests still pass (files 1-4 revoke everything they create, so the default grants change nothing yet).

- [ ] **Step 2: Write the failing tests**

Create `tests/db/migrate.test.ts`:

```ts
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
```

In `tests/db/flow.test.ts`, at the end of the test `'members cannot write to tables directly'` (after the second `expectError`, before its closing `})`), add:

```ts
    await expectError(
      selectAs(db, users.Omar,
        `insert into games (match_id, ordinal, team_one, team_two, planned_minutes) values (gen_random_uuid(), 1, 'A', 'B', 10)`),
      /permission denied/,
    )
```

and add this test right after it:

```ts
  it('signed-out visitors can read nothing, including games', async () => {
    for (const table of ['matches', 'players', 'games']) {
      await db.exec('set role anon')
      try {
        await expectError(db.query(`select * from public.${table}`), /permission denied/)
      } finally {
        await db.exec('reset role')
      }
    }
  })
```

- [ ] **Step 3: Run them to see them fail**

Run: `npx vitest run tests/db/migrate.test.ts tests/db/flow.test.ts`
Expected: FAIL (`relation "games" does not exist`).

- [ ] **Step 4: Create file 5 with the tables and the data move**

Create `supabase/migrations/20261025000100_games.sql`:

```sql
-- =============================================================================
-- 7GZ-KORA: games (file 5 of 5)
--
-- Many short games in a night (Plans/Football-scenario.md sections 2, 3 and
-- 6; Plans/Extras-and-backlog.md sections 3 and 4): the team board (Team A,
-- B, C and the bench), games with a timer, swaps, penalties, admin-only
-- goals, minutes played and in goal, and one rating per night from all its
-- games.
--
-- Files 1 to 4 already run on the live project, so this file only adds to
-- them: new tables and columns, replaced functions, and the old nights moved
-- over (each becomes one game). Run it once, in the SQL Editor, when no night
-- is in progress.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- The team board, games and lineup periods
-- -----------------------------------------------------------------------------

-- The team board: the team each checked-in player is on right now.
-- NULL = on the bench (a sub).
alter table public.match_players
  add column team text check (team in ('A', 'B', 'C'));

-- Suggested first when a game needs a goalkeeper (Extras section 3).
alter table public.players
  add column happy_in_goal boolean not null default false;

-- A game: two of the night's teams, a timer, and a score from its goals.
create table public.games (
  id              uuid primary key default gen_random_uuid(),
  match_id        uuid not null,
  ordinal         int not null,
  team_one        text not null check (team_one in ('A', 'B', 'C')),
  team_two        text not null check (team_two in ('A', 'B', 'C')),
  -- A guide for the timer (the night's game length): it buzzes, but only an
  -- admin ends the game.
  planned_minutes int not null check (planned_minutes between 1 and 600),
  started_at      timestamptz not null default now(),
  -- NULL while the game is on.
  ended_at        timestamptz,
  -- A draw with a team waiting: who won the shootout. It only decides who
  -- stays on; for ratings the game is still a draw.
  penalty_winner  text,
  created_at      timestamptz not null default now(),
  constraint games_match_id_fkey foreign key (match_id) references public.matches (id) on delete cascade,
  unique (match_id, ordinal),
  unique (id, match_id),
  check (team_one <> team_two),
  check (penalty_winner is null or penalty_winner in (team_one, team_two)),
  check (ended_at is null or ended_at >= started_at)
);

-- At most one game in progress per night.
create unique index games_one_running on public.games (match_id) where ended_at is null;

-- Lineup periods (stints) belong to a game and have real start and end
-- times: minutes come from the times. NULL ended_at = still on the pitch.
alter table public.stints
  add column game_id    uuid,
  add column started_at timestamptz,
  add column ended_at   timestamptz,
  add constraint stints_game_id_match_id_fkey
    foreign key (game_id, match_id) references public.games (id, match_id) on delete cascade,
  add constraint stints_id_game_id_key unique (id, game_id);

-- Team C plays too.
alter table public.stint_players drop constraint stint_players_team_check;
alter table public.stint_players add constraint stint_players_team_check check (team in ('A', 'B', 'C'));
alter table public.goals drop constraint goals_scoring_team_check;
alter table public.goals add constraint goals_scoring_team_check check (scoring_team in ('A', 'B', 'C'));

-- Each goal belongs to a game: the game of its lineup period.
alter table public.goals
  add column game_id uuid,
  add constraint goals_stint_id_game_id_fkey
    foreign key (stint_id, game_id) references public.stints (id, game_id) on delete cascade;

create index goals_game_idx on public.goals (game_id);

-- Minutes on the pitch and in goal, stored with each night's rating.
alter table public.match_ratings
  add column minutes_played  numeric not null default 0,
  add column minutes_in_goal numeric not null default 0;

-- Row Level Security and permissions for the new table. Supabase would
-- otherwise let anyone write to it directly.
alter table public.games enable row level security;
create policy "members read games" on public.games
  for select to authenticated using (public.is_group_member(public.match_group_id(match_id)));

revoke all on public.games from anon, authenticated;
grant select on public.games to authenticated;
grant all on public.games to service_role;
-- Players say for themselves whether they're happy in goal (admins can for
-- anyone), under the same row rule as renaming (file 1).
grant update (happy_in_goal) on public.players to authenticated;


-- -----------------------------------------------------------------------------
-- Moving the old nights over
-- -----------------------------------------------------------------------------

-- Each night that already has lineups becomes one game between Team A and
-- Team B, lasting the whole booking.
insert into public.games (match_id, ordinal, team_one, team_two, planned_minutes, started_at, ended_at)
select m.id, 1, 'A', 'B', m.duration_minutes,
       coalesce(m.starts_at, m.created_at),
       coalesce(m.starts_at, m.created_at) + make_interval(mins => m.duration_minutes)
from public.matches m
where exists (select 1 from public.stints s where s.match_id = m.id);

-- Its lineup periods share that time in order, by their old weights.
update public.stints s
set game_id    = p.game_id,
    started_at = p.game_start + p.game_length * (p.weight_before / p.weight_total)::float8,
    ended_at   = p.game_start + p.game_length * ((p.weight_before + s.weight) / p.weight_total)::float8
from (
  select s2.id,
         g.id as game_id,
         g.started_at as game_start,
         g.ended_at - g.started_at as game_length,
         coalesce(sum(s2.weight) over (partition by s2.match_id order by s2.ordinal
                                       rows between unbounded preceding and 1 preceding), 0) as weight_before,
         sum(s2.weight) over (partition by s2.match_id) as weight_total
  from public.stints s2
  join public.games g on g.match_id = s2.match_id
) p
where p.id = s.id;

update public.goals g
set game_id = s.game_id
from public.stints s
where s.id = g.stint_id;

-- The team board shows each player's team in the night's last lineup.
update public.match_players mp
set team = sp.team
from public.stint_players sp
join public.stints s on s.id = sp.stint_id
where sp.match_id = mp.match_id
  and sp.player_id = mp.player_id
  and s.ordinal = (select max(s2.ordinal) from public.stints s2 where s2.match_id = mp.match_id);

-- Ratings already stored stay as they are; only their minutes are filled in.
update public.match_ratings mr
set minutes_played  = m.played,
    minutes_in_goal = m.in_goal
from (
  select sp.match_id,
         sp.player_id,
         sum(extract(epoch from s.ended_at - s.started_at) / 60) as played,
         coalesce(sum(extract(epoch from s.ended_at - s.started_at) / 60) filter (where sp.is_goalkeeper), 0) as in_goal
  from public.stint_players sp
  join public.stints s on s.id = sp.stint_id
  group by sp.match_id, sp.player_id
) m
where mr.match_id = m.match_id and mr.player_id = m.player_id;

-- clean_sheet_min_share is replaced by clean_sheet_min_minutes (below).
update public.rating_config set points = points - 'clean_sheet_min_share';
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run tests/db/migrate.test.ts` → Expected: PASS (4 tests).
Run: `npm test` → Expected: every test file passes (the old actions still write stints without a game; that's allowed until Task 4).

---

### Task 2: One rating per night, from all its games

**Files:**
- Modify: `supabase/migrations/20261025000100_games.sql` (append a section)
- Modify: `tests/db/helpers.ts` (replace the "Direct fixtures for rating tests" section, lines 92-232)
- Modify: `tests/db/rating.test.ts` (rewrite)
- Modify: `tests/db/migrate.test.ts` (append one test)

**Interfaces:**
- Consumes: the Task 1 tables and columns.
- Produces (SQL): `rating_points_defaults()` with `clean_sheet_min_minutes` (8) instead of `clean_sheet_min_share`; `compute_match_ratings(uuid)` (same signature) also stores `minutes_played`, `minutes_in_goal` and adds `minutes` to `breakdown`. `breakdown.net_goal_diff` is now the summed goal difference.
- Produces (tests): `type Team = 'A' | 'B' | 'C'`; `type Lineup = Partial<Record<Team, string[]>> & { gk?: string[] }`; `MatchBuilder` with `game(teamOne, teamTwo, penaltyWinner?)`, `period(minutes, lineup)`, `match(lineup, minutes = 60)`, `checkIn(name)`, `goal(scorer, assister?, { period?, disputed? })`, `save`, `vote`, `mvp`, `setConfig`, `compute()`; `RatingRow` + `minutes_played`, `minutes_in_goal`.

- [ ] **Step 1: Rewrite the rating fixtures for games**

In `tests/db/helpers.ts`, replace everything from the line `// Direct fixtures for rating tests (as the database owner, bypassing RLS)` (and its dashed line above) down to the end of `export type RatingRow = { ... }` with:

```ts
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
```

- [ ] **Step 2: Write the failing tests**

Replace all of `tests/db/rating.test.ts` with:

```ts
// Unit tests for the rating calculation (compute_match_ratings, now in
// supabase/migrations/20261025000100_games.sql): one rating per player per
// night, from all its games. The worked examples come from section 6.4 of
// Plans/football-idea.md and section 3 of Plans/Football-scenario.md.
import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDb, MatchBuilder } from './helpers'

let db: PGlite

beforeAll(async () => {
  db = await createDb()
})

afterAll(async () => {
  await db.close()
})

const SIX_A_SIDE = {
  A: ['Player A', 'A2', 'A3', 'A4', 'A5', 'Keeper A'],
  B: ['B1', 'B2', 'B3', 'B4', 'B5', 'Keeper B'],
  gk: ['Keeper A', 'Keeper B'],
}
const ALL = [...SIX_A_SIDE.A, ...SIX_A_SIDE.B]

describe('worked examples from the original brief (one game, section 6.4)', () => {
  it('Player A: 2 goals, 1 assist, win, +2 net goals, peers 7.6 -> 8.3', async () => {
    const m = await MatchBuilder.create(db, ALL)
    await m.match(SIX_A_SIDE)
    await m.goal('Player A', 'A2')
    await m.goal('Player A')
    await m.goal('A3', 'Player A')
    await m.goal('B1') // 3-1: team A won, +2 net goals
    for (const [voter, score] of [['A2', 8], ['A3', 8], ['B1', 7], ['B2', 7], ['B3', 8]] as const) {
      await m.vote(voter, 'Player A', score)
    }

    const r = (await m.compute()).get('Player A')!
    expect(r.goals).toBe(2)
    expect(r.assists).toBe(1)
    expect(r.analytics).toBeCloseTo(8.7, 10) // 5 + 2.0 + 0.7 + 0.5 + 0.5
    expect(r.vote_average).toBeCloseTo(7.6, 10)
    expect(r.stats_only).toBe(false)
    expect(r.final).toBeCloseTo(8.315, 10) // 0.65 x 8.7 + 0.35 x 7.6
    expect(r.rating).toBe(8.3)
    expect(r.breakdown).toMatchObject({
      base: 5, goals: 2, assists: 0.7, net_goals: 0.5, result: 0.5, clean_sheets: 0, saves: 0, minutes: 60,
    })
  })

  it('Player B: no goals, lost by 1, peers 8.0 -> 5.6', async () => {
    const m = await MatchBuilder.create(db, ALL)
    await m.match(SIX_A_SIDE)
    await m.goal('A2')
    await m.goal('A3')
    await m.goal('B2') // 2-1: team B lost, -1 net goal
    await m.vote('B2', 'B1', 8)
    await m.vote('A2', 'B1', 8)

    const r = (await m.compute()).get('B1')!
    expect(r.analytics).toBeCloseTo(4.25, 10) // 5 - 0.25 - 0.5
    expect(r.vote_average).toBeCloseTo(8.0, 10)
    expect(r.final).toBeCloseTo(5.5625, 10) // 0.65 x 4.25 + 0.35 x 8.0
    expect(r.rating).toBe(5.6)
  })
})

describe('night ratings: worked examples (Football-scenario.md section 3)', () => {
  const FIVE = {
    A: ['P', 'A2', 'A3', 'A4', 'Keeper A'],
    B: ['B1', 'B2', 'B3', 'B4', 'Keeper B'],
    C: ['C1', 'C2', 'C3', 'C4', 'Keeper C'],
  }
  const KEEPERS = ['Keeper A', 'Keeper B', 'Keeper C']

  /**
   * Example 1's night: winner stays on, three teams, 10-minute games.
   * Game 1: A 2-1 B. Game 2: A 0-0 C, C wins on penalties. Game 3: C 1-2 B.
   * `late` players join Team B for game 3 only.
   */
  async function winnerStaysNight(late: string[] = []) {
    const m = await MatchBuilder.create(db, [...FIVE.A, ...FIVE.B, ...FIVE.C, ...late])
    await m.game('A', 'B')
    await m.period(10, { A: FIVE.A, B: FIVE.B, gk: KEEPERS })
    await m.goal('P', 'A2')
    await m.goal('A2')
    await m.goal('B1')
    await m.game('A', 'C', 'C')
    await m.period(10, { A: FIVE.A, C: FIVE.C, gk: KEEPERS })
    await m.game('C', 'B')
    await m.period(10, { C: FIVE.C, B: [...FIVE.B, ...late], gk: KEEPERS })
    await m.goal('C1')
    await m.goal('B1')
    await m.goal('B2')
    return m
  }

  /** Four a side; S starts on Team A and T on Team B. */
  const S_ON_A = { A: ['S', 'A2', 'A3', 'Keeper A'], B: ['T', 'B2', 'B3', 'Keeper B'], gk: ['Keeper A', 'Keeper B'] }
  const S_ON_B = { A: ['T', 'A2', 'A3', 'Keeper A'], B: ['S', 'B2', 'B3', 'Keeper B'], gk: ['Keeper A', 'Keeper B'] }
  const S_AND_T = ['S', 'T', 'A2', 'A3', 'Keeper A', 'B2', 'B3', 'Keeper B']

  it('Example 1: P plays games 1 and 2, scores once, peers 7.0 -> 6.7', async () => {
    const m = await winnerStaysNight()
    for (const [voter, score] of [['A2', 6], ['B1', 7], ['C1', 8]] as const) await m.vote(voter, 'P', score)

    const p = (await m.compute()).get('P')!
    expect(p.goals).toBe(1)
    expect(p.breakdown).toMatchObject({ goals: 1, net_goal_diff: 1, net_goals: 0.25, result: 0.25, minutes: 20 })
    expect(p.analytics).toBeCloseTo(6.5, 10) // 5 + 1.0 + 0.25 + 0.25
    expect(p.vote_average).toBeCloseTo(7, 10)
    expect(p.final).toBeCloseTo(6.675, 10) // 0.65 x 6.5 + 0.35 x 7.0
    expect(p.rating).toBe(6.7)
    expect(p.minutes_played).toBeCloseTo(20, 10)
  })

  it('Example 2: swap and continue: goal difference added up, result weighted by minutes', async () => {
    const m = await MatchBuilder.create(db, S_AND_T)
    await m.game('A', 'B')
    await m.period(6, S_ON_A)
    await m.goal('A2')
    await m.goal('A3') // A 2-0 B after 6 minutes; S and T swap, the score carries on
    await m.period(4, S_ON_B)
    await m.goal('B2') // final A 2-1 B

    const r = await m.compute()
    expect(r.get('S')!.breakdown).toMatchObject({ net_goal_diff: 3, net_goals: 0.75, result: 0.1 })
    expect(r.get('S')!.analytics).toBeCloseTo(5.85, 10)
    expect(r.get('T')!.breakdown).toMatchObject({ net_goal_diff: -3, net_goals: -0.75, result: -0.1 })
    expect(r.get('T')!.analytics).toBeCloseTo(4.15, 10)
  })

  it('Example 3: a late arrival who plays only game 3 (a 2-1 win) -> 5.75', async () => {
    const m = await winnerStaysNight(['Late Lad'])
    const late = (await m.compute()).get('Late Lad')!
    expect(late.breakdown).toMatchObject({ net_goals: 0.25, result: 0.5, minutes: 10 })
    expect(late.analytics).toBeCloseTo(5.75, 10)
  })

  it('Example 4: a clean sheet is a whole game in goal with nothing conceded', async () => {
    const r = await (await winnerStaysNight()).compute()
    // Keeper A: conceded in game 1, clean in game 2 (0-0, 10 minutes).
    expect(r.get('Keeper A')!.clean_sheets).toBe(1)
    expect(r.get('Keeper A')!.breakdown.clean_sheets).toBe(0.5)
    expect(r.get('Keeper A')!.analytics).toBeCloseTo(6, 10) // 5 + 0.25 + 0.25 + 0.5
    expect(r.get('Keeper A')!.minutes_in_goal).toBeCloseTo(20, 10)
    // Keeper C: clean in game 2, conceded two in game 3.
    expect(r.get('Keeper C')!.clean_sheets).toBe(1)
    expect(r.get('Keeper B')!.clean_sheets).toBe(0)
    expect(r.get('A2')!.clean_sheets).toBe(0) // outfield players never get it
  })

  it('Example 5: winning on penalties is still a draw', async () => {
    const r = await (await winnerStaysNight()).compute()
    // C2: game 2 a draw (0), game 3 a loss (-0.5), 10 minutes each -> -0.25.
    // Counting the shootout as a win would give 0.
    expect(r.get('C2')!.breakdown.result).toBe(-0.25)
    expect(r.get('C2')!.analytics).toBeCloseTo(4.5, 10) // 5 - 0.25 (net -1) - 0.25
    expect(r.get('C1')!.analytics).toBeCloseTo(5.5, 10) // the same + 1 goal
  })

  it('"End game and swap" makes two games, each with its own result', async () => {
    const m = await MatchBuilder.create(db, S_AND_T)
    await m.game('A', 'B')
    await m.period(6, S_ON_A)
    await m.goal('A2')
    await m.goal('A3') // game 1 ends A 2-0 B
    await m.game('A', 'B')
    await m.period(4, S_ON_B)
    await m.goal('B2') // game 2: B 1-0 A

    const r = await m.compute()
    // S won both games: +3 goal difference -> +0.75, result +0.5.
    expect(r.get('S')!.analytics).toBeCloseTo(6.25, 10)
    expect(r.get('T')!.analytics).toBeCloseTo(3.75, 10)
  })

  it('a night with no goals: the base for everyone, keepers a clean sheet per game', async () => {
    const m = await MatchBuilder.create(db, ALL)
    for (let i = 0; i < 2; i++) {
      await m.game('A', 'B')
      await m.period(10, SIX_A_SIDE)
    }
    const r = await m.compute()
    expect(r.size).toBe(12)
    expect(r.get('A2')!.analytics).toBeCloseTo(5, 10)
    expect(r.get('Keeper A')!.clean_sheets).toBe(2)
    expect(r.get('Keeper A')!.analytics).toBeCloseTo(6, 10) // 5 + 2 x 0.5
  })

  it('checked in but never on the pitch: only the base and the votes', async () => {
    const m = await MatchBuilder.create(db, [...ALL, 'Sub'])
    await m.match(SIX_A_SIDE)
    await m.goal('A2')
    await m.checkIn('Sub')
    await m.vote('A2', 'Sub', 8)
    await m.vote('B2', 'Sub', 6)

    const sub = (await m.compute()).get('Sub')!
    expect(sub.breakdown).toMatchObject({ net_goals: 0, result: 0, minutes: 0 })
    expect(sub.analytics).toBeCloseTo(5, 10)
    expect(sub.final).toBeCloseTo(0.65 * 5 + 0.35 * 7, 10)
  })

  it('a goalkeeper swapped mid-game gets no clean sheet, nor does a game under 8 minutes', async () => {
    const m = await MatchBuilder.create(db, ALL)
    // Game 1, 0-0 over 10 minutes: at half-time A2 takes over in goal from Keeper A.
    await m.game('A', 'B')
    await m.period(5, SIX_A_SIDE)
    await m.period(5, { ...SIX_A_SIDE, gk: ['A2', 'Keeper B'] })
    let r = await m.compute()
    expect(r.get('Keeper A')!.clean_sheets).toBe(0)
    expect(r.get('A2')!.clean_sheets).toBe(0)
    expect(r.get('Keeper B')!.clean_sheets).toBe(1) // in goal for the whole game
    expect(r.get('Keeper A')!.minutes_in_goal).toBeCloseTo(5, 10)

    // Game 2, 0-0 but only 6 minutes: too short for a clean sheet ...
    await m.game('A', 'B')
    await m.period(6, SIX_A_SIDE)
    r = await m.compute()
    expect(r.get('Keeper A')!.clean_sheets).toBe(0)
    // ... unless the owner lowers clean_sheet_min_minutes.
    await m.setConfig(`points = points || '{"clean_sheet_min_minutes": 5}'`)
    r = await m.compute()
    expect(r.get('Keeper A')!.clean_sheets).toBe(1)
  })

  it('team impact is added up over lineup periods, not averaged (the Phase 1 bug)', async () => {
    const m = await MatchBuilder.create(db, [...ALL, 'Late Lad'])
    // One 60-minute game. First half: A leads 2-0. Second half: Late Lad replaces Player A; B scores once.
    await m.game('A', 'B')
    await m.period(30, SIX_A_SIDE)
    await m.goal('A2')
    await m.goal('A3')
    await m.period(30, { A: ['Late Lad', 'A2', 'A3', 'A4', 'A5', 'Keeper A'], B: SIX_A_SIDE.B, gk: SIX_A_SIDE.gk })
    await m.goal('B1')

    const r = await m.compute()
    // Player A: +2 while on the pitch -> +0.5 (Phase 1 halved it to +0.25); A won the game -> +0.5.
    expect(r.get('Player A')!.breakdown).toMatchObject({ net_goal_diff: 2, net_goals: 0.5, result: 0.5 })
    // Late Lad: -1 -> -0.25, but A still won the game -> +0.5.
    expect(r.get('Late Lad')!.analytics).toBeCloseTo(5.25, 10)
    // Keeper A: +2 - 1 = +1 -> +0.25, win +0.5, no clean sheet (conceded in the game).
    expect(r.get('Keeper A')!.analytics).toBeCloseTo(5.75, 10)
  })
})

describe('edge cases', () => {
  it('a player with no votes gets a "stats only" rating (never hidden)', async () => {
    const m = await MatchBuilder.create(db, ALL)
    await m.match(SIX_A_SIDE)
    await m.goal('A2')

    const r = (await m.compute()).get('A4')!
    expect(r.vote_count).toBe(0)
    expect(r.vote_average).toBeNull()
    expect(r.stats_only).toBe(true)
    expect(r.analytics).toBeCloseTo(5.75, 10) // 5 + 0.25 (net +1) + 0.5 (win)
    expect(r.final).toBeCloseTo(5.75, 10)
  })

  it('fewer than 2 votes also means "stats only"; "Didn\'t see enough" is not counted', async () => {
    const m = await MatchBuilder.create(db, ALL)
    await m.match(SIX_A_SIDE)
    await m.vote('A2', 'A3', 9)
    await m.vote('B1', 'A3', null) // didn't see enough
    await m.vote('B2', 'A3', null)

    const r = (await m.compute()).get('A3')!
    expect(r.vote_count).toBe(1)
    expect(r.vote_average).toBeCloseTo(9, 10)
    expect(r.stats_only).toBe(true)
    expect(r.final).toBeCloseTo(5, 10) // 0-0 draw, votes ignored
  })

  it('goalkeeper with a clean sheet gets +0.5', async () => {
    const m = await MatchBuilder.create(db, ALL)
    await m.match(SIX_A_SIDE)
    await m.goal('A2')
    await m.goal('A3') // 2-0

    const ratings = await m.compute()
    const keeperA = ratings.get('Keeper A')!
    expect(keeperA.clean_sheets).toBe(1)
    expect(keeperA.analytics).toBeCloseTo(6.5, 10) // 5 + 0.5 (net +2) + 0.5 (win) + 0.5 (clean sheet)
    expect(ratings.get('Keeper B')!.clean_sheets).toBe(0)
    expect(ratings.get('A4')!.clean_sheets).toBe(0)
  })

  it('a match with no goals: everyone gets the base, keepers get a clean sheet', async () => {
    const m = await MatchBuilder.create(db, ALL)
    await m.match(SIX_A_SIDE)

    const ratings = await m.compute()
    expect(ratings.size).toBe(12)
    expect(ratings.get('A2')!.analytics).toBeCloseTo(5, 10)
    expect(ratings.get('B3')!.analytics).toBeCloseTo(5, 10)
    expect(ratings.get('Keeper A')!.analytics).toBeCloseTo(5.5, 10)
    expect(ratings.get('Keeper B')!.analytics).toBeCloseTo(5.5, 10)
  })
})

describe('caps, limits and options', () => {
  it('caps goals at +3.5, net goals at +1.5, and the analytics score at 10', async () => {
    const m = await MatchBuilder.create(db, ALL)
    await m.match(SIX_A_SIDE)
    for (let i = 0; i < 5; i++) await m.goal('Player A', 'A2')
    for (let i = 0; i < 3; i++) await m.goal('A2', 'Player A')
    for (let i = 0; i < 2; i++) await m.goal('A3', 'Player A') // 10-0

    const r = (await m.compute()).get('Player A')!
    expect(r.breakdown.goals).toBe(3.5) // 5 x 1.0 capped
    expect(r.breakdown.assists).toBe(2) // 5 x 0.7 capped
    expect(r.breakdown.net_goals).toBe(1.5) // 10 x 0.25 capped
    expect(r.analytics).toBe(10) // 12.5 clamped
  })

  it('caps net goals at -1.5 and clamps the analytics score at 1.0', async () => {
    const m = await MatchBuilder.create(db, ALL)
    await m.match(SIX_A_SIDE)
    for (let i = 0; i < 10; i++) await m.goal('B1')

    const keeperA = (await m.compute()).get('Keeper A')!
    expect(keeperA.breakdown.net_goals).toBe(-1.5)
    expect(keeperA.analytics).toBeCloseTo(3, 10) // 5 - 1.5 - 0.5

    await m.setConfig(`points = points || '{"base": 1.0}'`)
    const again = (await m.compute()).get('Keeper A')!
    expect(again.analytics).toBe(1) // 1 - 1.5 - 0.5 = -1 -> clamped to 1.0
  })

  it('clean sheet bonus is capped at +1.0', async () => {
    const m = await MatchBuilder.create(db, ALL)
    for (let i = 0; i < 3; i++) {
      await m.game('A', 'B')
      await m.period(10, SIX_A_SIDE) // three 0-0 games
    }

    const keeperA = (await m.compute()).get('Keeper A')!
    expect(keeperA.clean_sheets).toBe(3)
    expect(keeperA.breakdown.clean_sheets).toBe(1)
  })

  it('counts saves when a group logs them (+0.15 each, capped at +1.0)', async () => {
    const m = await MatchBuilder.create(db, ALL)
    await m.match(SIX_A_SIDE)
    await m.goal('A2')
    for (let i = 0; i < 4; i++) await m.save('Keeper B')

    const keeperB = (await m.compute()).get('Keeper B')!
    expect(keeperB.saves).toBe(4)
    expect(keeperB.breakdown.saves).toBeCloseTo(0.6, 10)
  })

  it('disputed goals do not count', async () => {
    const m = await MatchBuilder.create(db, ALL)
    await m.match(SIX_A_SIDE)
    await m.goal('Player A', null, { disputed: true })

    const ratings = await m.compute()
    expect(ratings.get('Player A')!.goals).toBe(0)
    expect(ratings.get('Player A')!.analytics).toBeCloseTo(5, 10)
    expect(ratings.get('Keeper B')!.clean_sheets).toBe(1)
  })

  it('Man of the Match: ties are shared and it does not change the rating', async () => {
    const m = await MatchBuilder.create(db, ALL)
    await m.match(SIX_A_SIDE)
    await m.mvp('A2', 'Player A')
    await m.mvp('A3', 'B1')
    await m.mvp('A4', 'B2')
    await m.mvp('B3', 'Player A')
    await m.mvp('B4', 'B1')

    const ratings = await m.compute()
    expect(ratings.get('Player A')!.is_mvp).toBe(true)
    expect(ratings.get('B1')!.is_mvp).toBe(true)
    expect(ratings.get('B2')!.is_mvp).toBe(false)
    expect(ratings.get('Player A')!.final).toBeCloseTo(ratings.get('A2')!.final, 10)
  })

  it('uses the group\'s weights from rating_config', async () => {
    const m = await MatchBuilder.create(db, ALL)
    await m.match(SIX_A_SIDE)
    await m.vote('A2', 'A3', 9)
    await m.vote('A4', 'A3', 7)
    await m.setConfig(`w_analytics = 0.5, w_votes = 0.5`)

    const r = (await m.compute()).get('A3')!
    expect(r.final).toBeCloseTo(0.5 * 5 + 0.5 * 8, 10)
    expect(r.breakdown.w_votes).toBe(0.5)
  })

  it('recomputing gives the same result (safe to run any number of times)', async () => {
    const m = await MatchBuilder.create(db, ALL)
    await m.match(SIX_A_SIDE)
    await m.goal('A2', 'A3')
    const first = await m.compute()
    const second = await m.compute()
    expect(second.size).toBe(first.size)
    expect(second.get('A2')!.final).toBe(first.get('A2')!.final)
  })
})
```

Append to `tests/db/migrate.test.ts` (it must stay the last test in that file, because it recalculates the stored ratings):

```ts
it('an old night recalculates with the new rules', async () => {
  await db.query(`select compute_match_ratings($1)`, [closed])
  const rows = (await db.query<{ player_id: string; minutes_played: string; breakdown: { net_goal_diff: number } }>(
    `select player_id, minutes_played, breakdown from match_ratings where match_id = $1`, [closed])).rows
  expect(rows).toHaveLength(4)
  expect(rows.every((r) => Number(r.minutes_played) === 120)).toBe(true)
  // Omar scored for Team A in the first period, then played for Team B: +1.
  expect(rows.find((r) => r.player_id === players[1])!.breakdown.net_goal_diff).toBe(1)
})
```

- [ ] **Step 3: Run them to see them fail**

Run: `npx vitest run tests/db/rating.test.ts`
Expected: FAIL. The new examples come out wrong (for example Example 2 gives `net_goal_diff` 1.5 instead of 3, because file 2 still averages over stints and ignores games), and `breakdown.minutes` is missing.

- [ ] **Step 4: Add the rating section to file 5**

Append to `supabase/migrations/20261025000100_games.sql`:

```sql


-- -----------------------------------------------------------------------------
-- Ratings: one per player per night, from all its games
-- (Plans/Football-scenario.md section 3). These replace the versions in file 2.
-- -----------------------------------------------------------------------------

-- DEFAULT POINTS. clean_sheet_min_minutes replaces clean_sheet_min_share: a
-- clean sheet needs a whole game in goal lasting at least this many minutes.
create or replace function public.rating_points_defaults()
returns jsonb
language sql immutable set search_path = ''
as $$
  select '{
    "base": 5.0,

    "goal": 1.0,
    "goal_cap": 3.5,

    "assist": 0.7,
    "assist_cap": 2.0,

    "net_goal": 0.25,
    "net_goal_min": -1.5,
    "net_goal_max": 1.5,

    "win": 0.5,
    "draw": 0.0,
    "loss": -0.5,

    "clean_sheet": 0.5,
    "clean_sheet_cap": 1.0,
    "clean_sheet_min_minutes": 8,

    "save": 0.15,
    "save_cap": 1.0,

    "analytics_min": 1.0,
    "analytics_max": 10.0
  }'::jsonb;
$$;

-- compute_match_ratings: THE rating calculation, still the one place.
-- For a night, over all its games:
--   * team impact = the plain SUM of goal difference while on the pitch, over
--     every lineup period played. (Phase 1 weighted it by stint: that was a bug.)
--   * result      = your team's final result in each game (win, draw or loss;
--     a draw decided on penalties is a draw), averaged over your minutes.
--   * clean sheet = in goal for the same team in every period of a game that
--     lasted at least clean_sheet_min_minutes, with nothing conceded in it.
-- Deletes and rewrites match_ratings for the night. Safe to run any number of
-- times; it always gives the same answer for the same data.
create or replace function public.compute_match_ratings(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  cfg public.rating_config%rowtype;
  pts jsonb;
  v_base           numeric;
  v_goal           numeric;
  v_goal_cap       numeric;
  v_assist         numeric;
  v_assist_cap     numeric;
  v_net_goal       numeric;
  v_net_min        numeric;
  v_net_max        numeric;
  v_win            numeric;
  v_draw           numeric;
  v_loss           numeric;
  v_cs             numeric;
  v_cs_cap         numeric;
  v_cs_min_minutes numeric;
  v_save           numeric;
  v_save_cap       numeric;
  v_min            numeric;
  v_max            numeric;
begin
  -- Lock the night so two recalculations of it cannot clash.
  perform 1 from public.matches m where m.id = p_match_id for update;

  -- Make sure the group has a config row, then load it.
  insert into public.rating_config (group_id)
  select m.group_id from public.matches m where m.id = p_match_id
  on conflict (group_id) do nothing;

  select rc.* into cfg
  from public.rating_config rc
  join public.matches m on m.group_id = rc.group_id
  where m.id = p_match_id;

  if not found then
    raise exception 'Match % not found', p_match_id;
  end if;

  pts              := public.rating_points_defaults() || coalesce(cfg.points, '{}'::jsonb);
  v_base           := (pts ->> 'base')::numeric;
  v_goal           := (pts ->> 'goal')::numeric;
  v_goal_cap       := (pts ->> 'goal_cap')::numeric;
  v_assist         := (pts ->> 'assist')::numeric;
  v_assist_cap     := (pts ->> 'assist_cap')::numeric;
  v_net_goal       := (pts ->> 'net_goal')::numeric;
  v_net_min        := (pts ->> 'net_goal_min')::numeric;
  v_net_max        := (pts ->> 'net_goal_max')::numeric;
  v_win            := (pts ->> 'win')::numeric;
  v_draw           := (pts ->> 'draw')::numeric;
  v_loss           := (pts ->> 'loss')::numeric;
  v_cs             := (pts ->> 'clean_sheet')::numeric;
  v_cs_cap         := (pts ->> 'clean_sheet_cap')::numeric;
  v_cs_min_minutes := (pts ->> 'clean_sheet_min_minutes')::numeric;
  v_save           := (pts ->> 'save')::numeric;
  v_save_cap       := (pts ->> 'save_cap')::numeric;
  v_min            := (pts ->> 'analytics_min')::numeric;
  v_max            := (pts ->> 'analytics_max')::numeric;

  delete from public.match_ratings where match_id = p_match_id;

  insert into public.match_ratings (
    match_id, player_id, analytics_score, vote_average, vote_count, stats_only,
    final_rating, goals, assists, clean_sheets, saves, mvp_votes, is_mvp,
    minutes_played, minutes_in_goal, breakdown
  )
  with
  -- Goals that count: everything except disputed goals.
  counted_goals as (
    select g.* from public.goals g
    where g.match_id = p_match_id and not g.disputed
  ),
  -- Each lineup period and its length in minutes (one still going counts up to now).
  periods as (
    select s.id as stint_id,
           s.game_id,
           greatest(extract(epoch from coalesce(s.ended_at, now()) - s.started_at) / 60, 0) as minutes
    from public.stints s
    where s.match_id = p_match_id
  ),
  -- Each game's final score and length. Shootout goals are never recorded.
  game_scores as (
    select g.id as game_id,
           g.team_one,
           g.team_two,
           (select count(*) from counted_goals cg where cg.game_id = g.id and cg.scoring_team = g.team_one) as goals_one,
           (select count(*) from counted_goals cg where cg.game_id = g.id and cg.scoring_team = g.team_two) as goals_two,
           (select coalesce(sum(p.minutes), 0) from periods p where p.game_id = g.id) as minutes,
           (select count(*) from periods p where p.game_id = g.id) as period_count
    from public.games g
    where g.match_id = p_match_id
  ),
  -- One row per player per period on the pitch: the goal difference in that
  -- period, and their team's final goal difference in that game.
  player_periods as (
    select sp.player_id,
           sp.team,
           sp.is_goalkeeper,
           p.game_id,
           p.minutes,
           (select count(*) filter (where cg.scoring_team = sp.team)
                   - count(*) filter (where cg.scoring_team <> sp.team)
              from counted_goals cg where cg.stint_id = p.stint_id) as net,
           case when sp.team = gs.team_one then gs.goals_one - gs.goals_two
                else gs.goals_two - gs.goals_one end as game_diff
    from public.stint_players sp
    join periods p on p.stint_id = sp.stint_id
    join game_scores gs on gs.game_id = p.game_id
  ),
  -- Team impact: the plain sum. Result: averaged over minutes on the pitch.
  team_impact as (
    select pp.player_id,
           sum(pp.net) as net_goals,
           sum(pp.minutes) as minutes_played,
           coalesce(sum(pp.minutes) filter (where pp.is_goalkeeper), 0) as minutes_in_goal,
           case when sum(pp.minutes) > 0
                then sum(pp.minutes * case when pp.game_diff > 0 then v_win
                                           when pp.game_diff < 0 then v_loss
                                           else v_draw end) / sum(pp.minutes)
                else 0
           end as result_points
    from player_periods pp
    group by pp.player_id
  ),
  -- Clean sheets: a whole game in goal for one team, long enough, nothing conceded.
  clean_sheets as (
    select k.player_id, count(*) as n
    from (
      select pp.player_id, pp.game_id, pp.team, count(*) as periods_in_goal
      from player_periods pp
      where pp.is_goalkeeper
      group by pp.player_id, pp.game_id, pp.team
    ) k
    join game_scores gs on gs.game_id = k.game_id
    where k.periods_in_goal = gs.period_count
      and gs.minutes >= v_cs_min_minutes
      and (case when k.team = gs.team_one then gs.goals_two else gs.goals_one end) = 0
    group by k.player_id
  ),
  -- Peer votes. "Didn't see enough" has no score, so it is not counted.
  votes as (
    select rv.target_id as player_id, avg(rv.score) as vote_average, count(*) as vote_count
    from public.ratings_votes rv
    where rv.match_id = p_match_id and rv.score is not null
    group by rv.target_id
  ),
  mvp as (
    select mv.target_id as player_id, count(*) as n
    from public.mvp_votes mv
    where mv.match_id = p_match_id
    group by mv.target_id
  ),
  -- Everyone checked in gets a rating, even if they never got on the pitch.
  stats as (
    select mp.player_id,
           (select count(*) from counted_goals g where g.scorer_id = mp.player_id) as goals,
           (select count(*) from counted_goals g where g.assister_id = mp.player_id) as assists,
           (select count(*) from public.saves sv
             where sv.match_id = p_match_id and sv.goalkeeper_id = mp.player_id) as saves,
           coalesce(t.net_goals, 0) as net_goals,
           coalesce(t.result_points, 0) as result_points,
           coalesce(t.minutes_played, 0) as minutes_played,
           coalesce(t.minutes_in_goal, 0) as minutes_in_goal,
           coalesce(cs.n, 0) as clean_sheets,
           v.vote_average,
           coalesce(v.vote_count, 0) as vote_count,
           coalesce(mv.n, 0) as mvp_votes
    from public.match_players mp
    left join team_impact t on t.player_id = mp.player_id
    left join clean_sheets cs on cs.player_id = mp.player_id
    left join votes v on v.player_id = mp.player_id
    left join mvp mv on mv.player_id = mp.player_id
    where mp.match_id = p_match_id
  ),
  -- Points for each component, with caps applied.
  points as (
    select s.*,
           least(s.goals * v_goal, v_goal_cap) as goal_pts,
           least(s.assists * v_assist, v_assist_cap) as assist_pts,
           greatest(v_net_min, least(v_net_max, s.net_goals * v_net_goal)) as net_pts,
           s.result_points as result_pts,
           least(s.clean_sheets * v_cs, v_cs_cap) as cs_pts,
           least(s.saves * v_save, v_save_cap) as save_pts
    from stats s
  ),
  scored as (
    select p.*,
           greatest(v_min, least(v_max,
             v_base + p.goal_pts + p.assist_pts + p.net_pts + p.result_pts + p.cs_pts + p.save_pts
           )) as analytics,
           p.vote_count < cfg.min_votes as stats_only
    from points p
  ),
  rated as (
    select s.*,
           case when s.stats_only then s.analytics
                else cfg.w_analytics * s.analytics + cfg.w_votes * s.vote_average
           end as final_rating,
           s.mvp_votes > 0 and s.mvp_votes = max(s.mvp_votes) over () as is_mvp
    from scored s
  )
  select p_match_id,
         f.player_id,
         f.analytics,
         f.vote_average,
         f.vote_count,
         f.stats_only,
         f.final_rating,
         f.goals,
         f.assists,
         f.clean_sheets,
         f.saves,
         f.mvp_votes,
         f.is_mvp,
         f.minutes_played,
         f.minutes_in_goal,
         jsonb_build_object(
           'base',          v_base,
           'goals',         round(f.goal_pts, 2),
           'assists',       round(f.assist_pts, 2),
           'net_goals',     round(f.net_pts, 2),
           'net_goal_diff', f.net_goals,
           'result',        round(f.result_pts, 2),
           'clean_sheets',  round(f.cs_pts, 2),
           'saves',         round(f.save_pts, 2),
           'minutes',       round(f.minutes_played, 1),
           'analytics',     round(f.analytics, 2),
           'vote_average',  round(f.vote_average, 2),
           'vote_count',    f.vote_count,
           'stats_only',    f.stats_only,
           'w_analytics',   cfg.w_analytics,
           'w_votes',       cfg.w_votes,
           'min_votes',     cfg.min_votes,
           'final',         round(f.final_rating, 3)
         )
  from rated f;
end;
$$;
```

(`create or replace` keeps the permissions from file 3, so no new grants are needed here.)

- [ ] **Step 5: Run the tests**

Run: `npx vitest run tests/db/rating.test.ts tests/db/migrate.test.ts` → Expected: PASS (rating: 24 tests; migrate: 5).
Run: `npm test` → Expected: all pass. (`flow.test.ts` still uses the old `save_lineup`, whose lineups have no game; their goals count for scorers but not for team impact. Its rating checks don't depend on that. Task 3 moves it onto games.)

---

### Task 3: Games at the pitch: team board, start, swaps, Game over, admin-only goals

**Files:**
- Modify: `supabase/migrations/20261025000100_games.sql` (append two sections)
- Modify: `tests/db/helpers.ts` (append `startGame`)
- Modify: `tests/db/flow.test.ts` (lines 5, 96-133, 236-238 and 249-297)
- Modify: `tests/db/nights.test.ts` (lines 8, 215-249)
- Test: `tests/db/games.test.ts`

**Interfaces:**
- Consumes: Task 1 tables; `load_match`, `require_admin`, `require_member`, `require_night_open`, `write_audit` (file 3).
- Produces (SQL, for the app):
  - `set_team_board(p_match_id uuid, p_board jsonb) returns void`. `p_board`: `[{"player_id": uuid, "team": "A" | "B" | "C" | null}]`; checked-in players left out go to the bench.
  - `start_game(p_match_id uuid, p_team_one text, p_team_two text, p_keeper_one uuid, p_keeper_two uuid) returns uuid` (the game id)
  - `swap_players(p_match_id uuid, p_lineup jsonb, p_continue boolean) returns uuid` (the game now on). `p_lineup`: `[{"player_id": uuid, "team": text, "is_goalkeeper": boolean}]`, the whole new pitch.
  - `end_game(p_match_id uuid, p_penalty_winner text default null) returns void`
  - `log_goal(p_match_id uuid, p_scorer_id uuid, p_assister_id uuid default null, p_game_id uuid default null) returns uuid`: admins only; `p_game_id` null = the game on now.
  - `get_leaderboard(p_group_id uuid, p_year int default null)` gains `avg_minutes int` and `minutes_in_goal int`.
  - Replaced: `check_out` (refuses someone on the pitch, puts them on the bench), `end_night` and `cancel_night` (stop a game that's on).
  - Removed: `save_lineup`, `apply_lineup`, the three-argument `log_goal`.
  - Internal: `running_game(uuid) returns games`, `require_night_playing(matches)`, `check_pitch_lineup(uuid, text[], jsonb)`, `start_period(uuid, uuid, jsonb) returns uuid`, `stop_game(uuid, text)`.
- Produces (tests): `startGame(db, admin, matchId, board: Record<playerId, Team | null>, teams = ['A', 'B'], keepers = [null, null]) => Promise<gameId>`.

- [ ] **Step 1: Add the `startGame` test helper**

Append to `tests/db/helpers.ts`:

```ts
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
```

- [ ] **Step 2: Write the failing tests**

Create `tests/db/games.test.ts`:

```ts
// Tests for games during a night (supabase/migrations/20261025000100_games.sql):
// the team board, starting and ending games, swaps, penalties and
// admin-only goals. Acting as real signed-in users with RLS on.
import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDb, nightDetails, rpc, selectAs, setupGroup, startGame, startNight, type Team } from './helpers'

let db: PGlite

beforeAll(async () => {
  db = await createDb()
})

afterAll(async () => {
  await db.close()
})

async function expectError(promise: Promise<unknown>, message: RegExp) {
  await expect(promise).rejects.toThrow(message)
}

const SIX = ['A1', 'A2', 'A3', 'B1', 'B2', 'B3']

/** A night in progress with A1-A3, B1-B3 and any extra players checked in. */
async function liveNight(extra: string[] = []) {
  const g = await setupGroup(db, [...SIX, ...extra])
  const p = (name: string) => g.pid(g.users[name])
  const id = await startNight(db, g.users.admin, g.groupId, [...SIX, ...extra].map(p))
  /** The usual board (A1-A3 on Team A, B1-B3 on Team B), with changes by name. */
  const board = (changes: Record<string, Team | null> = {}): Record<string, Team | null> => ({
    ...Object.fromEntries(SIX.map((name) => [p(name), name[0] as Team])),
    ...Object.fromEntries(Object.entries(changes).map(([name, team]) => [p(name), team])),
  })
  return { ...g, id, p, board }
}

type BoardRow = { player_id: string; team: string | null }
type GameRow = {
  id: string; ordinal: number; team_one: string; team_two: string
  planned_minutes: number; ended_at: Date | null; penalty_winner: string | null
}
type PeriodRow = { ordinal: number; game_id: string; ended_at: Date | null; player_id: string; team: string; is_goalkeeper: boolean }

const boardOf = (user: string, id: string) =>
  selectAs<BoardRow>(db, user, `select player_id, team from match_players where match_id = $1`, [id])
const gamesOf = (user: string, id: string) =>
  selectAs<GameRow>(db, user, `select * from games where match_id = $1 order by ordinal`, [id])
const periodsOf = (user: string, id: string) =>
  selectAs<PeriodRow>(db, user,
    `select s.ordinal, s.game_id, s.ended_at, sp.player_id, sp.team, sp.is_goalkeeper
     from stints s join stint_players sp on sp.stint_id = s.id
     where s.match_id = $1 order by s.ordinal, sp.player_id`, [id])
const goal = (user: string, id: string, scorer: string, assister: string | null = null, gameId: string | null = null) =>
  rpc<{ log_goal: string }>(db, user, 'log_goal', {
    p_match_id: id, p_scorer_id: scorer, p_assister_id: assister, p_game_id: gameId,
  })
const setBoard = (user: string, id: string, board: Record<string, string | null>) =>
  rpc(db, user, 'set_team_board', {
    p_match_id: id,
    p_board: Object.entries(board).map(([player_id, team]) => ({ player_id, team })),
  })
const swap = (user: string, id: string, lineup: [string, string, boolean?][], cont: boolean) =>
  rpc<{ swap_players: string }>(db, user, 'swap_players', {
    p_match_id: id,
    p_lineup: lineup.map(([player_id, team, gk]) => ({ player_id, team, is_goalkeeper: gk ?? false })),
    p_continue: cont,
  })

describe('the team board', () => {
  it('admins put checked-in players on Team A, B or C, or on the bench', async () => {
    const n = await liveNight(['C1', 'Sub'])
    await expectError(setBoard(n.users.A1, n.id, n.board()), /Only group admins/)
    await setBoard(n.users.admin, n.id, n.board({ C1: 'C' }))

    const rows = await boardOf(n.users.A1, n.id)
    const team = (name: string) => rows.find((r) => r.player_id === n.p(name))!.team
    expect(SIX.map(team)).toEqual(['A', 'A', 'A', 'B', 'B', 'B'])
    expect(team('C1')).toBe('C')
    expect(team('Sub')).toBeNull() // left off the list: on the bench

    await expectError(setBoard(n.users.admin, n.id, { [n.p('A1')]: 'D' }), /A, B or C/)
    await expectError(
      setBoard(n.users.admin, n.id, { [n.p('A1')]: 'A', [n.pid(n.users.admin)]: 'B' }),
      /Check in Captain first/,
    )
  })

  it('teams can only be set while the night is on', async () => {
    const { groupId, users, pid } = await setupGroup(db)
    const [{ plan_night: id }] = await rpc<{ plan_night: string }>(db, users.admin, 'plan_night', {
      p_group_id: groupId, p_night: nightDetails(),
    })
    await expectError(setBoard(users.admin, id, { [pid(users.Omar)]: 'A' }), /Start the night first/)
  })

  it('someone who left early goes to the bench until they are back', async () => {
    const n = await liveNight()
    await setBoard(n.users.admin, n.id, n.board())
    await rpc(db, n.users.admin, 'check_out', { p_match_id: n.id, p_player_id: n.p('A1') })
    expect((await boardOf(n.users.A1, n.id)).find((r) => r.player_id === n.p('A1'))!.team).toBeNull()
    await expectError(setBoard(n.users.admin, n.id, n.board()), /A1 left early/)

    await rpc(db, n.users.admin, 'check_in', { p_match_id: n.id, p_player_id: n.p('A1') })
    await setBoard(n.users.admin, n.id, n.board())
  })

  it('while a game is on, players on the pitch can only be moved with Swap', async () => {
    const n = await liveNight(['C1'])
    await startGame(db, n.users.admin, n.id, n.board({ C1: 'C' }))
    await expectError(setBoard(n.users.admin, n.id, n.board({ A1: 'B', C1: 'C' })), /only be moved with Swap: A1/)
    await expectError(
      rpc(db, n.users.admin, 'check_out', { p_match_id: n.id, p_player_id: n.p('A1') }),
      /Swap them off first/,
    )
    // The waiting team and the bench can still change.
    await setBoard(n.users.admin, n.id, n.board({ C1: null }))
  })
})

describe('games', () => {
  it('admins start a game between two teams from the board, with goalkeepers', async () => {
    const n = await liveNight()
    await setBoard(n.users.admin, n.id, n.board())
    const start = (by: string, one: string, two: string, k1: string | null = null, k2: string | null = null) =>
      rpc<{ start_game: string }>(db, by, 'start_game', {
        p_match_id: n.id, p_team_one: one, p_team_two: two, p_keeper_one: k1, p_keeper_two: k2,
      })
    await expectError(start(n.users.A1, 'A', 'B'), /Only group admins/)
    await expectError(start(n.users.admin, 'A', 'A'), /two different teams/)
    await expectError(start(n.users.admin, 'A', 'C'), /at least one player/)
    await expectError(start(n.users.admin, 'A', 'B', n.p('B1')), /goalkeeper for Team A/)

    const [{ start_game: gameId }] = await start(n.users.admin, 'A', 'B', n.p('A1'), n.p('B1'))
    const [game] = await gamesOf(n.users.B3, n.id)
    expect(game).toMatchObject({ id: gameId, ordinal: 1, team_one: 'A', team_two: 'B', planned_minutes: 10, ended_at: null })
    const periods = await periodsOf(n.users.B3, n.id)
    expect(periods).toHaveLength(6)
    expect(periods.filter((r) => r.is_goalkeeper).map((r) => r.player_id).sort()).toEqual([n.p('A1'), n.p('B1')].sort())
    expect(periods.every((r) => r.game_id === gameId && r.ended_at === null)).toBe(true)
    await expectError(start(n.users.admin, 'A', 'B'), /already on/)
  })

  it('only admins log goals, into the game that is on', async () => {
    const n = await liveNight(['Sub'])
    await expectError(goal(n.users.admin, n.id, n.p('A1')), /No game is on/)
    const gameId = await startGame(db, n.users.admin, n.id, n.board())
    await expectError(goal(n.users.A1, n.id, n.p('A1')), /Only group admins/)
    await expectError(goal(n.users.admin, n.id, n.p('A1'), n.p('B1')), /scorer's team/)
    await expectError(goal(n.users.admin, n.id, n.p('Sub')), /didn't play/)

    const [{ log_goal: goalId }] = await goal(n.users.admin, n.id, n.p('A1'), n.p('A2'))
    const [row] = await selectAs<{ game_id: string; scoring_team: string; confirmed: boolean }>(
      db, n.users.B1, `select game_id, scoring_team, confirmed from goals where id = $1`, [goalId])
    expect(row).toEqual({ game_id: gameId, scoring_team: 'A', confirmed: true })
    // Players can still dispute it.
    await rpc(db, n.users.B1, 'dispute_goal', { p_goal_id: goalId })
  })

  it('Game over: penalties only for a draw, and they add no goals', async () => {
    const n = await liveNight()
    const over = (by: string, winner: string | null) =>
      rpc(db, by, 'end_game', { p_match_id: n.id, p_penalty_winner: winner })
    await expectError(over(n.users.admin, null), /No game is on/)
    await startGame(db, n.users.admin, n.id, n.board())
    await goal(n.users.admin, n.id, n.p('A1'))
    await expectError(over(n.users.A1, null), /Only group admins/)
    await expectError(over(n.users.admin, 'A'), /only for a draw/)
    await expectError(over(n.users.admin, 'C'), /Team A or Team B/)
    await over(n.users.admin, null)

    const [{ start_game: second }] = await rpc<{ start_game: string }>(db, n.users.admin, 'start_game', {
      p_match_id: n.id, p_team_one: 'A', p_team_two: 'B', p_keeper_one: null, p_keeper_two: null,
    })
    await over(n.users.admin, 'B') // 0-0, and B won the shootout
    const games = await gamesOf(n.users.A1, n.id)
    expect(games.map((g) => [g.ordinal, g.penalty_winner, g.ended_at !== null])).toEqual([[1, null, true], [2, 'B', true]])
    expect(games[1].id).toBe(second)
    expect(await selectAs(db, n.users.A1, `select * from goals where game_id = $1`, [second])).toHaveLength(0)
    expect((await periodsOf(n.users.A1, n.id)).every((r) => r.ended_at !== null)).toBe(true)
  })

  it('swap and continue: the same game, the score carries on, a new lineup period starts', async () => {
    const n = await liveNight()
    const gameId = await startGame(db, n.users.admin, n.id, n.board(), ['A', 'B'], [n.p('A1'), n.p('B1')])
    await goal(n.users.admin, n.id, n.p('A2'))
    // A3 and B3 swap teams.
    const swapped: [string, string, boolean?][] = [
      [n.p('A1'), 'A', true], [n.p('A2'), 'A'], [n.p('B3'), 'A'],
      [n.p('B1'), 'B', true], [n.p('B2'), 'B'], [n.p('A3'), 'B'],
    ]
    await expectError(swap(n.users.A1, n.id, swapped, true), /Only group admins/)
    const [{ swap_players: same }] = await swap(n.users.admin, n.id, swapped, true)
    expect(same).toBe(gameId)

    const periods = await periodsOf(n.users.A1, n.id)
    expect([...new Set(periods.map((r) => r.ordinal))]).toEqual([1, 2])
    expect(periods.filter((r) => r.ordinal === 1).every((r) => r.ended_at !== null)).toBe(true)
    expect(periods.find((r) => r.ordinal === 2 && r.player_id === n.p('A3'))!.team).toBe('B')
    expect(periods.every((r) => r.game_id === gameId)).toBe(true)
    // The team board follows the pitch.
    const board = await boardOf(n.users.A1, n.id)
    expect(board.find((r) => r.player_id === n.p('B3'))!.team).toBe('A')
    expect(board.find((r) => r.player_id === n.p('A3'))!.team).toBe('B')
    // A goal now goes to the new period, in the same game.
    await goal(n.users.admin, n.id, n.p('A3'))
    const goals = await selectAs<{ scoring_team: string }>(
      db, n.users.A1, `select scoring_team from goals where game_id = $1 order by created_at`, [gameId])
    expect(goals.map((g) => g.scoring_team)).toEqual(['A', 'B'])

    await expectError(swap(n.users.admin, n.id, swapped, true), /Nothing changed/)
  })

  it('end game and swap: the game ends with its score and the next starts 0-0 with the new teams', async () => {
    const n = await liveNight()
    const first = await startGame(db, n.users.admin, n.id, n.board())
    await goal(n.users.admin, n.id, n.p('A1'))
    // A1 and B1 swap teams.
    const [{ swap_players: next }] = await swap(n.users.admin, n.id, [
      [n.p('A1'), 'B'], [n.p('A2'), 'A'], [n.p('A3'), 'A'], [n.p('B1'), 'A'], [n.p('B2'), 'B'], [n.p('B3'), 'B'],
    ], false)
    expect(next).not.toBe(first)
    const games = await gamesOf(n.users.A1, n.id)
    expect(games.map((g) => [g.ordinal, g.team_one, g.team_two, g.ended_at === null])).toEqual([
      [1, 'A', 'B', false],
      [2, 'A', 'B', true],
    ])
    expect(await selectAs(db, n.users.A1, `select * from goals where game_id = $1`, [next])).toHaveLength(0)
  })

  it('subs come on from the bench or the waiting team; players taken off go to the bench', async () => {
    const n = await liveNight(['Sub', 'C1'])
    await startGame(db, n.users.admin, n.id, n.board({ C1: 'C' }))
    const rest: [string, string][] = [[n.p('A1'), 'A'], [n.p('A3'), 'A'], [n.p('B1'), 'B'], [n.p('B2'), 'B'], [n.p('B3'), 'B']]
    // Sub comes on for A2.
    await swap(n.users.admin, n.id, [...rest, [n.p('Sub'), 'A']], true)
    let board = await boardOf(n.users.A1, n.id)
    const team = (name: string) => board.find((r) => r.player_id === n.p(name))!.team
    expect([team('Sub'), team('A2')]).toEqual(['A', null])
    // Team C isn't in this game, but C1 can come on for one of the two teams.
    await expectError(swap(n.users.admin, n.id, [...rest, [n.p('C1'), 'C']], true), /Team A or Team B/)
    await swap(n.users.admin, n.id, [...rest, [n.p('C1'), 'A']], true)
    board = await boardOf(n.users.A1, n.id)
    expect([team('C1'), team('Sub')]).toEqual(['A', null])
  })

  it('admins can add a goal forgotten in an earlier game, even after the night', async () => {
    const n = await liveNight(['Sub'])
    const first = await startGame(db, n.users.admin, n.id, n.board())
    await rpc(db, n.users.admin, 'end_game', { p_match_id: n.id, p_penalty_winner: null })
    await startGame(db, n.users.admin, n.id, n.board({ A3: null, Sub: 'A' }))
    await expectError(goal(n.users.admin, n.id, n.p('Sub'), null, first), /didn't play/)
    await goal(n.users.admin, n.id, n.p('A3'), n.p('A1'), first)
    await rpc(db, n.users.admin, 'end_night', { p_match_id: n.id })
    await goal(n.users.admin, n.id, n.p('B1'), null, first)
    const goals = await selectAs<{ scoring_team: string }>(
      db, n.users.A1, `select scoring_team from goals where game_id = $1 order by created_at`, [first])
    expect(goals.map((g) => g.scoring_team)).toEqual(['A', 'B'])

    const other = await liveNight()
    const elsewhere = await startGame(db, other.users.admin, other.id, other.board())
    await expectError(goal(n.users.admin, n.id, n.p('A1'), null, elsewhere), /not part of this night/)
  })

  it('End night and Cancel night stop the game that is on', async () => {
    const n = await liveNight()
    await startGame(db, n.users.admin, n.id, n.board())
    await rpc(db, n.users.admin, 'end_night', { p_match_id: n.id })
    expect((await gamesOf(n.users.A1, n.id))[0].ended_at).not.toBeNull()
    await expectError(setBoard(n.users.admin, n.id, n.board()), /teams and games are final/)

    const c = await liveNight()
    await startGame(db, c.users.admin, c.id, c.board())
    await rpc(db, c.users.admin, 'cancel_night', { p_match_id: c.id, p_reason: 'rain', p_note: null, p_fee: 0 })
    expect((await gamesOf(c.users.A1, c.id))[0].ended_at).not.toBeNull()
  })
})

describe('goalkeepers and security', () => {
  it('players say whether they are happy to play in goal; admins can set it for anyone', async () => {
    const { groupId, users, pid } = await setupGroup(db)
    const happy = async (id: string) =>
      (await selectAs<{ happy_in_goal: boolean }>(db, users.admin, `select happy_in_goal from players where id = $1`, [id]))[0]
        .happy_in_goal
    await selectAs(db, users.Omar, `update players set happy_in_goal = true where id = $1`, [pid(users.Omar)])
    expect(await happy(pid(users.Omar))).toBe(true)
    await selectAs(db, users.Omar, `update players set happy_in_goal = true where id = $1`, [pid(users.Ziad)])
    expect(await happy(pid(users.Ziad))).toBe(false) // not Omar's to change
    await selectAs(db, users.admin, `update players set happy_in_goal = true where id = $1`, [pid(users.Ziad)])
    expect(await happy(pid(users.Ziad))).toBe(true)
    await expectError(
      selectAs(db, users.Omar, `update players set group_id = $1 where id = $2`, [groupId, pid(users.Omar)]),
      /permission denied/,
    )
  })

  it('nobody writes games directly, outsiders see none, and helpers stay private', async () => {
    const n = await liveNight()
    await startGame(db, n.users.admin, n.id, n.board())
    await expectError(
      selectAs(db, n.users.admin, `update games set penalty_winner = 'A' where match_id = $1`, [n.id]),
      /permission denied/,
    )
    const stranger = await setupGroup(db)
    expect(await selectAs(db, stranger.users.admin, `select * from games where match_id = $1`, [n.id])).toHaveLength(0)
    await expectError(rpc(db, n.users.admin, 'stop_game', { p_match_id: n.id, p_penalty_winner: null }), /permission denied/)
  })
})
```

- [ ] **Step 3: Move the flow and night tests onto games**

In `tests/db/flow.test.ts`:

1. Change the import to `import { createDb, createUser, nightDetails, rpc, selectAs, setupGroup, startGame, startNight } from './helpers'`.
2. In `'runs end to end with secret votes revealed at the end'`, replace everything from `// Only admins plan and run nights.` down to and including `await rpc(db, omar, 'dispute_goal', { p_goal_id: goal3 })` with:

```ts
    // Only admins plan and run nights.
    await expectError(
      rpc(db, omar, 'plan_night', { p_group_id: groupId, p_night: nightDetails() }),
      /Only group admins/,
    )
    const matchId = await startNight(db, captain, groupId, [captain, omar, ziad, mo].map(pid))
    await startGame(
      db, captain, matchId,
      { [pid(captain)]: 'A', [pid(omar)]: 'A', [pid(ziad)]: 'B', [pid(mo)]: 'B' },
      ['A', 'B'], [pid(omar), pid(mo)],
    )

    // Only admins log goals. Omar scores, assisted by the captain.
    await expectError(
      rpc(db, omar, 'log_goal', { p_match_id: matchId, p_scorer_id: pid(omar), p_assister_id: null }),
      /Only group admins/,
    )
    const logGoal = (scorer: string, assister: string | null) =>
      rpc<{ log_goal: string }>(db, captain, 'log_goal', {
        p_match_id: matchId, p_scorer_id: pid(scorer), p_assister_id: assister && pid(assister),
      })
    await logGoal(omar, captain)

    // Cross-team assists are rejected.
    await expectError(logGoal(ziad, captain), /scorer's team/)
    // Ziad scores twice, one is disputed by Omar (so it will not count).
    await logGoal(ziad, null)
    const [{ log_goal: goal3 }] = await logGoal(ziad, mo)
    await rpc(db, omar, 'dispute_goal', { p_goal_id: goal3 })
```

3. In the same test, change the comment `// undisputed goals auto-confirm` to `// admins' goals count as confirmed; the disputed one doesn't`, and replace the last two `expectError` lines before `// Every edit left a trail.` (the `delete_goal` and `save_lineup` ones) with:

```ts
    // Members cannot delete goals; teams and games are final.
    await expectError(rpc(db, ziad, 'delete_goal', { p_goal_id: goal3 }), /Only an admin or the person/)
    await expectError(
      rpc(db, captain, 'set_team_board', { p_match_id: matchId, p_board: [] }),
      /teams and games are final/,
    )
```

4. Delete the test `'lineup edits: one goalkeeper per team, scorers stay, late arrivals check in first'` (the team board and lineup checks are now in `games.test.ts`), and replace the test `'the person who logged a goal can undo it while the night is on'` with:

```ts
  it('admins can undo a goal; members cannot delete goals', async () => {
    const { groupId, users, pid } = await setupGroup(db)
    const matchId = await startNight(db, users.admin, groupId, [pid(users.Omar), pid(users.Ziad)])
    await startGame(db, users.admin, matchId, { [pid(users.Omar)]: 'A', [pid(users.Ziad)]: 'B' })
    const [{ log_goal: goalId }] = await rpc<{ log_goal: string }>(db, users.admin, 'log_goal', {
      p_match_id: matchId, p_scorer_id: pid(users.Omar), p_assister_id: null,
    })
    await expectError(rpc(db, users.Omar, 'delete_goal', { p_goal_id: goalId }), /Only an admin or the person/)
    await rpc(db, users.admin, 'delete_goal', { p_goal_id: goalId })
    expect(await selectAs(db, users.Omar, `select * from goals where match_id = $1`, [matchId])).toHaveLength(0)
  })
```

In `tests/db/nights.test.ts`:

1. Change the import to `import { createDb, createUser, nightDetails, rpc, selectAs, setupGroup, startGame, startNight } from './helpers'`.
2. In `'a check-in made by mistake can be undone, unless they already scored'`, replace the `save_lineup` call (the four lines `await rpc(db, users.admin, 'save_lineup', { ... })`) with:

```ts
    await startGame(db, users.admin, id, { [pid(users.Omar)]: 'A', [pid(users.Ziad)]: 'B' })
```

3. Replace the whole test `'teams are picked from the players checked in; the rest are on the bench'` with:

```ts
  it('teams are picked from the players checked in; the rest are on the bench', async () => {
    const { groupId, users, pid } = await setupGroup(db)
    const id = await planNight(users.admin, groupId)
    const board = [{ player_id: pid(users.Omar), team: 'A' }, { player_id: pid(users.Ziad), team: 'B' }]
    await expectError(rpc(db, users.admin, 'set_team_board', { p_match_id: id, p_board: board }), /Start the night first/)
    await expectError(
      rpc(db, users.admin, 'log_goal', { p_match_id: id, p_scorer_id: pid(users.Omar), p_assister_id: null }),
      /Start the night/,
    )
    await rpc(db, users.admin, 'start_night', { p_match_id: id })
    await rpc(db, users.admin, 'check_in', { p_match_id: id, p_player_id: pid(users.Omar) })
    await expectError(rpc(db, users.admin, 'set_team_board', { p_match_id: id, p_board: board }), /Check in Ziad first/)

    await rpc(db, users.admin, 'check_in', { p_match_id: id, p_player_id: pid(users.Ziad) })
    await rpc(db, users.admin, 'check_in', { p_match_id: id, p_player_id: pid(users['محمد']) })
    await rpc(db, users.admin, 'set_team_board', { p_match_id: id, p_board: board })
    // محمد is on the bench but still part of the night.
    const rows = await selectAs<{ team: string | null }>(db, users.Omar, `select team from match_players where match_id = $1`, [id])
    expect(rows.map((r) => r.team).sort()).toEqual(['A', 'B', null])
  })
```

- [ ] **Step 4: Run them to see them fail**

Run: `npx vitest run tests/db/games.test.ts tests/db/flow.test.ts tests/db/nights.test.ts`
Expected: FAIL (`function public.set_team_board(...) does not exist`).

- [ ] **Step 5: Add the game actions to file 5**

Append to `supabase/migrations/20261025000100_games.sql`:

```sql


-- -----------------------------------------------------------------------------
-- Games at the pitch (admins): the team board, starting and ending games,
-- swaps and subs. Same style as file 3: each action checks who is calling,
-- then writes in one transaction.
-- -----------------------------------------------------------------------------

-- The game in progress (NULL if none).
create function public.running_game(p_match_id uuid)
returns public.games
language sql stable set search_path = ''
as $$
  select g.* from public.games g where g.match_id = p_match_id and g.ended_at is null;
$$;

-- Teams and games only change while the night is on.
create function public.require_night_playing(p_match public.matches)
returns void
language plpgsql stable set search_path = ''
as $$
begin
  case p_match.status
    when 'playing' then null;
    when 'draft' then raise exception 'Start the night first.';
    when 'cancelled' then raise exception 'This night was cancelled.';
    else raise exception 'The night has ended, so teams and games are final.';
  end case;
end;
$$;

-- Checks a lineup for the pitch:
--   [{"player_id": "...", "team": "A", "is_goalkeeper": true}, ...]
-- Both playing teams need a player, each team at most one goalkeeper, and
-- everyone must be checked in and still here.
create function public.check_pitch_lineup(p_match_id uuid, p_teams text[], p_lineup jsonb)
returns void
language plpgsql stable set search_path = ''
as $$
declare
  v_names text;
begin
  if jsonb_typeof(p_lineup) is distinct from 'array' then
    raise exception 'The lineup must be a list of players.';
  end if;
  if (select count(*) from jsonb_array_elements(p_lineup))
     <> (select count(distinct e ->> 'player_id') from jsonb_array_elements(p_lineup) e) then
    raise exception 'A player is listed twice.';
  end if;
  if exists (select 1 from jsonb_array_elements(p_lineup) e
             where coalesce(e ->> 'team', '') <> all (p_teams)) then
    raise exception 'Players on the pitch must be on Team % or Team %.', p_teams[1], p_teams[2];
  end if;
  if exists (select 1 from unnest(p_teams) t
             where not exists (select 1 from jsonb_array_elements(p_lineup) e where e ->> 'team' = t)) then
    raise exception 'Both teams need at least one player.';
  end if;
  if exists (select 1 from jsonb_array_elements(p_lineup) e
             where coalesce((e ->> 'is_goalkeeper')::boolean, false)
             group by e ->> 'team' having count(*) > 1) then
    raise exception 'Only one goalkeeper per team.';
  end if;

  select string_agg(coalesce(p.display_name, 'Unknown player'), ', ') into v_names
  from jsonb_array_elements(p_lineup) e
  left join public.players p on p.id = (e ->> 'player_id')::uuid
  left join public.match_players mp on mp.match_id = p_match_id and mp.player_id = (e ->> 'player_id')::uuid
  where mp.player_id is null or mp.left_at is not null;
  if v_names is not null then
    raise exception 'Check in % first (or tap Back if they left early).', v_names;
  end if;
end;
$$;

-- Starts a lineup period of a game with a lineup already checked.
create function public.start_period(p_match_id uuid, p_game_id uuid, p_lineup jsonb)
returns uuid
language plpgsql set search_path = ''
as $$
declare
  v_stint uuid;
begin
  insert into public.stints (match_id, game_id, ordinal, started_at)
  select p_match_id, p_game_id, coalesce(max(s.ordinal), 0) + 1, now()
  from public.stints s
  where s.match_id = p_match_id
  returning id into v_stint;

  insert into public.stint_players (stint_id, match_id, player_id, team, is_goalkeeper)
  select v_stint, p_match_id, (e ->> 'player_id')::uuid, e ->> 'team',
         coalesce((e ->> 'is_goalkeeper')::boolean, false)
  from jsonb_array_elements(p_lineup) e;
  return v_stint;
end;
$$;

-- Ends the game in progress and its lineup period (Game over, End night, Cancel night).
create function public.stop_game(p_match_id uuid, p_penalty_winner text)
returns void
language plpgsql set search_path = ''
as $$
begin
  update public.stints set ended_at = now() where match_id = p_match_id and ended_at is null;
  update public.games set ended_at = now(), penalty_winner = p_penalty_winner
  where match_id = p_match_id and ended_at is null;
end;
$$;

-- Sets the team board (admins): Team A, B or C for players checked in;
-- everyone else checked in is on the bench.
--   p_board: [{"player_id": "...", "team": "A"}, {"player_id": "...", "team": null}, ...]
-- While a game is on, players on the pitch keep their team: use Swap.
create function public.set_team_board(p_match_id uuid, p_board jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_match public.matches := public.load_match(p_match_id);
  v_board jsonb := coalesce(p_board, '[]'::jsonb);
  v_names text;
begin
  perform public.require_admin(v_match.group_id);
  perform public.require_night_playing(v_match);
  perform 1 from public.matches m where m.id = p_match_id for update;

  if jsonb_typeof(v_board) <> 'array' then
    raise exception 'The team board must be a list of players.';
  end if;
  if exists (select 1 from jsonb_array_elements(v_board) e
             where e ->> 'team' is not null and e ->> 'team' not in ('A', 'B', 'C')) then
    raise exception 'Teams are A, B or C (or the bench).';
  end if;
  if (select count(*) from jsonb_array_elements(v_board))
     <> (select count(distinct e ->> 'player_id') from jsonb_array_elements(v_board) e) then
    raise exception 'A player is listed twice.';
  end if;

  select string_agg(coalesce(p.display_name, 'Unknown player'), ', ') into v_names
  from jsonb_array_elements(v_board) e
  left join public.players p on p.id = (e ->> 'player_id')::uuid
  where not exists (select 1 from public.match_players mp
                    where mp.match_id = p_match_id and mp.player_id = (e ->> 'player_id')::uuid);
  if v_names is not null then
    raise exception 'Check in % first.', v_names;
  end if;

  select string_agg(p.display_name, ', ') into v_names
  from jsonb_array_elements(v_board) e
  join public.match_players mp on mp.match_id = p_match_id and mp.player_id = (e ->> 'player_id')::uuid
  join public.players p on p.id = mp.player_id
  where mp.left_at is not null and e ->> 'team' is not null;
  if v_names is not null then
    raise exception '% left early. Tap "Back" on the check-in list first.', v_names;
  end if;

  -- Players on the pitch keep their team until the game ends.
  select string_agg(p.display_name, ', ') into v_names
  from public.stint_players sp
  join public.stints s on s.id = sp.stint_id and s.ended_at is null
  join public.players p on p.id = sp.player_id
  where sp.match_id = p_match_id
    and sp.team is distinct from (select e ->> 'team' from jsonb_array_elements(v_board) e
                                  where (e ->> 'player_id')::uuid = sp.player_id);
  if v_names is not null then
    raise exception 'Players on the pitch can only be moved with Swap: %.', v_names;
  end if;

  update public.match_players mp
  set team = (select e ->> 'team' from jsonb_array_elements(v_board) e
              where (e ->> 'player_id')::uuid = mp.player_id)
  where mp.match_id = p_match_id;

  perform public.write_audit(v_match.group_id, 'team_board_changed',
    jsonb_build_object('match_id', p_match_id, 'board', v_board));
end;
$$;

-- Starts a game between two teams from the team board (admins). The timer
-- starts now, set to the night's game length. p_keeper_one and p_keeper_two
-- are the two teams' goalkeepers (or null). Returns the new game's id.
create function public.start_game(p_match_id uuid, p_team_one text, p_team_two text,
                                  p_keeper_one uuid, p_keeper_two uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_match  public.matches := public.load_match(p_match_id);
  v_game   uuid;
  v_lineup jsonb;
begin
  perform public.require_admin(v_match.group_id);
  perform public.require_night_playing(v_match);
  -- Lock the night so two admins can't start two games at once.
  perform 1 from public.matches m where m.id = p_match_id for update;

  if (public.running_game(p_match_id)).id is not null then
    raise exception 'A game is already on. Tap "Game over" first.';
  end if;
  if p_team_one is null or p_team_two is null or p_team_one = p_team_two
     or p_team_one not in ('A', 'B', 'C') or p_team_two not in ('A', 'B', 'C') then
    raise exception 'Pick two different teams.';
  end if;
  if p_keeper_one is not null and not exists (
       select 1 from public.match_players mp
       where mp.match_id = p_match_id and mp.player_id = p_keeper_one and mp.team = p_team_one) then
    raise exception 'The goalkeeper for Team % must be on Team %.', p_team_one, p_team_one;
  end if;
  if p_keeper_two is not null and not exists (
       select 1 from public.match_players mp
       where mp.match_id = p_match_id and mp.player_id = p_keeper_two and mp.team = p_team_two) then
    raise exception 'The goalkeeper for Team % must be on Team %.', p_team_two, p_team_two;
  end if;

  -- Everyone on the two teams goes on the pitch.
  select coalesce(jsonb_agg(jsonb_build_object(
           'player_id', mp.player_id,
           'team', mp.team,
           'is_goalkeeper', mp.player_id is not distinct from p_keeper_one
                            or mp.player_id is not distinct from p_keeper_two)), '[]'::jsonb)
  into v_lineup
  from public.match_players mp
  where mp.match_id = p_match_id and mp.team in (p_team_one, p_team_two) and mp.left_at is null;

  perform public.check_pitch_lineup(p_match_id, array[p_team_one, p_team_two], v_lineup);

  insert into public.games (match_id, ordinal, team_one, team_two, planned_minutes)
  select p_match_id, coalesce(max(g.ordinal), 0) + 1, p_team_one, p_team_two, v_match.game_minutes
  from public.games g
  where g.match_id = p_match_id
  returning id into v_game;

  perform public.start_period(p_match_id, v_game, v_lineup);
  perform public.write_audit(v_match.group_id, 'game_started',
    jsonb_build_object('match_id', p_match_id, 'game_id', v_game));
  return v_game;
end;
$$;

-- Changes who is on the pitch during a game (admins): a swap between the two
-- teams, a sub coming on (from the bench or the waiting team), or a new
-- goalkeeper. p_lineup is the whole new pitch, like start_game's; anyone
-- taken off goes to the bench.
--   p_continue = true:  "Swap and continue": the same game, the score carries
--                       on, and a new lineup period starts.
--   p_continue = false: "End game and swap": the game ends with its current
--                       score and the next one starts 0-0 with the new teams.
-- Returns the game being played now.
create function public.swap_players(p_match_id uuid, p_lineup jsonb, p_continue boolean)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_match public.matches := public.load_match(p_match_id);
  v_game  public.games;
begin
  perform public.require_admin(v_match.group_id);
  perform public.require_night_playing(v_match);
  perform 1 from public.matches m where m.id = p_match_id for update;

  v_game := public.running_game(p_match_id);
  if v_game.id is null then
    raise exception 'No game is on. Change the team board instead.';
  end if;
  perform public.check_pitch_lineup(p_match_id, array[v_game.team_one, v_game.team_two], p_lineup);

  -- The same players, teams and goalkeepers as now: nothing to do.
  if not exists (
    (select (e ->> 'player_id')::uuid, e ->> 'team', coalesce((e ->> 'is_goalkeeper')::boolean, false)
     from jsonb_array_elements(p_lineup) e)
    except
    (select sp.player_id, sp.team, sp.is_goalkeeper
     from public.stint_players sp join public.stints s on s.id = sp.stint_id
     where s.match_id = p_match_id and s.ended_at is null)
  ) and not exists (
    (select sp.player_id, sp.team, sp.is_goalkeeper
     from public.stint_players sp join public.stints s on s.id = sp.stint_id
     where s.match_id = p_match_id and s.ended_at is null)
    except
    (select (e ->> 'player_id')::uuid, e ->> 'team', coalesce((e ->> 'is_goalkeeper')::boolean, false)
     from jsonb_array_elements(p_lineup) e)
  ) then
    raise exception 'Nothing changed.';
  end if;

  -- The team board follows the pitch: players taken off go to the bench,
  -- and everyone on it takes their new team.
  update public.match_players mp
  set team = null
  where mp.match_id = p_match_id
    and mp.player_id in (select sp.player_id
                         from public.stint_players sp join public.stints s on s.id = sp.stint_id
                         where s.match_id = p_match_id and s.ended_at is null);
  update public.match_players mp
  set team = e ->> 'team'
  from jsonb_array_elements(p_lineup) e
  where mp.match_id = p_match_id and mp.player_id = (e ->> 'player_id')::uuid;

  if coalesce(p_continue, true) then
    update public.stints set ended_at = now() where match_id = p_match_id and ended_at is null;
  else
    perform public.stop_game(p_match_id, null);
    insert into public.games (match_id, ordinal, team_one, team_two, planned_minutes)
    values (p_match_id, v_game.ordinal + 1, v_game.team_one, v_game.team_two, v_game.planned_minutes)
    returning * into v_game;
  end if;
  perform public.start_period(p_match_id, v_game.id, p_lineup);

  perform public.write_audit(v_match.group_id, 'players_swapped', jsonb_build_object(
    'match_id', p_match_id, 'game_id', v_game.id, 'continue', coalesce(p_continue, true), 'lineup', p_lineup));
  return v_game.id;
end;
$$;

-- "Game over" (admins). If it's a draw, p_penalty_winner can say who won the
-- shootout: that only decides who stays on. For ratings the game is still a
-- draw, and shootout goals are never recorded.
create function public.end_game(p_match_id uuid, p_penalty_winner text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_match public.matches := public.load_match(p_match_id);
  v_game  public.games;
  v_one   int;
  v_two   int;
begin
  perform public.require_admin(v_match.group_id);
  perform public.require_night_playing(v_match);
  perform 1 from public.matches m where m.id = p_match_id for update;

  v_game := public.running_game(p_match_id);
  if v_game.id is null then
    raise exception 'No game is on.';
  end if;
  if p_penalty_winner is not null then
    if p_penalty_winner not in (v_game.team_one, v_game.team_two) then
      raise exception 'Pick Team % or Team %.', v_game.team_one, v_game.team_two;
    end if;
    select count(*) filter (where g.scoring_team = v_game.team_one),
           count(*) filter (where g.scoring_team = v_game.team_two)
    into v_one, v_two
    from public.goals g
    where g.game_id = v_game.id and not g.disputed;
    if v_one <> v_two then
      raise exception 'Penalties are only for a draw. It''s % – %.', v_one, v_two;
    end if;
  end if;

  perform public.stop_game(p_match_id, p_penalty_winner);
  perform public.write_audit(v_match.group_id, 'game_ended', jsonb_build_object(
    'match_id', p_match_id, 'game_id', v_game.id, 'penalty_winner', p_penalty_winner));
end;
$$;

-- Leaving early (admins): someone on the pitch must be swapped off first.
-- They go to the bench, and still count for the night (and the money).
create or replace function public.check_out(p_match_id uuid, p_player_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_match public.matches := public.load_match(p_match_id);
begin
  perform public.require_admin(v_match.group_id);
  perform public.require_night_open(v_match);
  if exists (select 1 from public.stint_players sp join public.stints s on s.id = sp.stint_id
             where s.match_id = p_match_id and s.ended_at is null and sp.player_id = p_player_id) then
    raise exception 'They''re on the pitch. Swap them off first.';
  end if;

  update public.match_players set left_at = coalesce(left_at, now()), team = null
  where match_id = p_match_id and player_id = p_player_id;
  if not found then
    raise exception 'That player is not checked in.';
  end if;

  perform public.write_audit(v_match.group_id, 'checked_out',
    jsonb_build_object('match_id', p_match_id, 'player_id', p_player_id));
end;
$$;

-- End night (admins) now also stops the clock: a game still on ends with its
-- current score. Voting opens for everyone checked in.
create or replace function public.end_night(p_match_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_match public.matches := public.load_match(p_match_id);
  v_hours int;
begin
  perform public.require_admin(v_match.group_id);
  if v_match.status <> 'playing' then
    raise exception 'Only a night in progress can be ended.';
  end if;
  if (select count(*) from public.match_players mp where mp.match_id = p_match_id) < 2 then
    raise exception 'Check in at least 2 players before ending the night.';
  end if;

  perform public.stop_game(p_match_id, null);

  select rc.voting_hours into v_hours from public.rating_config rc where rc.group_id = v_match.group_id;
  update public.matches
  set status = 'voting', voting_closes_at = now() + make_interval(hours => coalesce(v_hours, 24))
  where id = p_match_id;

  perform public.write_audit(v_match.group_id, 'night_ended', jsonb_build_object('match_id', p_match_id));
end;
$$;

-- Cancelling a night also stops a game that's on (nothing counts anyway).
create or replace function public.cancel_night(p_match_id uuid, p_reason text, p_note text, p_fee numeric)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_match public.matches := public.load_match(p_match_id);
  v_note  text := left(nullif(trim(p_note), ''), 200);
begin
  perform public.require_admin(v_match.group_id);
  if v_match.status not in ('draft', 'playing') then
    raise exception 'Only a planned night or one in progress can be cancelled.';
  end if;
  if p_reason is null or p_reason not in ('rain', 'not_enough_players', 'pitch_problem', 'other') then
    raise exception 'Pick a reason.';
  end if;
  if p_reason = 'other' and v_note is null then
    raise exception 'Add a short note for "other".';
  end if;
  if coalesce(p_fee, 0) < 0 then
    raise exception 'The fee can''t be negative.';
  end if;

  perform public.stop_game(p_match_id, null);
  update public.matches
  set status = 'cancelled', cancel_reason = p_reason, cancel_note = v_note,
      cancel_fee = coalesce(p_fee, 0), cancelled_at = now()
  where id = p_match_id;

  perform public.write_audit(v_match.group_id, 'night_cancelled',
    jsonb_build_object('match_id', p_match_id, 'reason', p_reason, 'fee', coalesce(p_fee, 0)));
end;
$$;


-- -----------------------------------------------------------------------------
-- Goals: admins only, into a game
-- -----------------------------------------------------------------------------

-- The Phase 1 lineup editor is replaced by the team board and games, and
-- log_goal gains a game, so the old versions go.
drop function public.save_lineup(uuid, jsonb);
drop function public.apply_lineup(uuid, jsonb);
drop function public.log_goal(uuid, uuid, uuid);

-- Admins log goals: the scorer, then the assister (or none). The goal goes to
-- the game in progress, or to p_game_id to add one that was forgotten (also
-- after the night: ratings recalculate if voting has closed). It belongs to
-- the scorer's latest lineup period in that game, and to their team in it.
-- Admins' goals count as confirmed; players can still dispute them.
create function public.log_goal(p_match_id uuid, p_scorer_id uuid, p_assister_id uuid default null,
                                p_game_id uuid default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_match       public.matches := public.load_match(p_match_id);
  v_game        uuid := p_game_id;
  v_stint       uuid;
  v_team        text;
  v_assist_team text;
  v_goal        uuid;
begin
  perform public.require_admin(v_match.group_id);
  if v_match.status = 'cancelled' then
    raise exception 'This night was cancelled.';
  elsif v_match.status = 'draft' then
    raise exception 'Start the night before logging goals.';
  end if;

  if v_game is null then
    v_game := (public.running_game(p_match_id)).id;
    if v_game is null then
      raise exception 'No game is on. Start a game first.';
    end if;
  elsif not exists (select 1 from public.games g where g.id = v_game and g.match_id = p_match_id) then
    raise exception 'That game is not part of this night.';
  end if;

  select sp.stint_id, sp.team into v_stint, v_team
  from public.stint_players sp
  join public.stints s on s.id = sp.stint_id
  where s.game_id = v_game and sp.player_id = p_scorer_id
  order by s.ordinal desc
  limit 1;
  if v_stint is null then
    raise exception 'The scorer didn''t play in this game.';
  end if;

  if p_assister_id is not null then
    if p_assister_id = p_scorer_id then
      raise exception 'A player cannot assist their own goal.';
    end if;
    select sp.team into v_assist_team from public.stint_players sp
    where sp.stint_id = v_stint and sp.player_id = p_assister_id;
    if v_assist_team is distinct from v_team then
      raise exception 'The assister must be on the scorer''s team.';
    end if;
  end if;

  insert into public.goals (match_id, game_id, stint_id, scoring_team, scorer_id, assister_id, confirmed, created_by)
  values (p_match_id, v_game, v_stint, v_team, p_scorer_id, p_assister_id, true, auth.uid())
  returning id into v_goal;
  return v_goal;
end;
$$;


-- -----------------------------------------------------------------------------
-- The table gains minutes: average minutes on the pitch per night, and all
-- minutes in goal (profiles; the goalkeeper suggestion). Its columns change,
-- so it is dropped and created again.
-- -----------------------------------------------------------------------------
drop function public.get_leaderboard(uuid, int);

create function public.get_leaderboard(p_group_id uuid, p_year int default null)
returns table (
  player_id        uuid,
  display_name     text,
  matches          int,
  avg_rating       numeric,
  avg_rating_exact numeric,
  goals            int,
  assists          int,
  mvps             int,
  clean_sheets     int,
  avg_votes        numeric,
  qualified        boolean,
  avg_minutes      int,
  minutes_in_goal  int
)
language sql stable security invoker set search_path = ''
as $$
  select p.id,
         p.display_name,
         count(*)::int,
         round(avg(mr.final_rating), 1),
         avg(mr.final_rating),
         sum(mr.goals)::int,
         sum(mr.assists)::int,
         (count(*) filter (where mr.is_mvp))::int,
         sum(mr.clean_sheets)::int,
         round(avg(mr.vote_average), 1),
         count(*) >= coalesce(
           (select rc.min_matches_for_leaderboard from public.rating_config rc where rc.group_id = p_group_id), 3),
         round(avg(mr.minutes_played))::int,
         round(sum(mr.minutes_in_goal))::int
  from public.match_ratings mr
  join public.matches m on m.id = mr.match_id
  join public.players p on p.id = mr.player_id
  where m.group_id = p_group_id
    and m.status = 'closed'
    and (p_year is null or extract(year from m.played_at) = p_year)
  group by p.id, p.display_name
  order by avg(mr.final_rating) desc;
$$;


-- =============================================================================
-- Permissions (the same rules as the end of files 3 and 4). Internal helpers
-- stay private; the app actions are for signed-in users. Functions replaced
-- with "create or replace" keep the permissions they had.
-- =============================================================================
revoke execute on function
  public.running_game(uuid),
  public.require_night_playing(public.matches),
  public.check_pitch_lineup(uuid, text[], jsonb),
  public.start_period(uuid, uuid, jsonb),
  public.stop_game(uuid, text),
  public.set_team_board(uuid, jsonb),
  public.start_game(uuid, text, text, uuid, uuid),
  public.swap_players(uuid, jsonb, boolean),
  public.end_game(uuid, text),
  public.log_goal(uuid, uuid, uuid, uuid),
  public.get_leaderboard(uuid, int)
from public, anon, authenticated;

grant execute on function
  public.set_team_board(uuid, jsonb),
  public.start_game(uuid, text, text, uuid, uuid),
  public.swap_players(uuid, jsonb, boolean),
  public.end_game(uuid, text),
  public.log_goal(uuid, uuid, uuid, uuid),
  public.get_leaderboard(uuid, int)
to authenticated;

grant execute on all functions in schema public to service_role;
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run tests/db/games.test.ts` → Expected: PASS (14 tests).
Run: `npm test` → Expected: all pass (`seed.test.ts` too: the old seed still writes stints without games, which is allowed until Task 4).

---

### Task 4: Demo nights with games, and the final clean-up

**Files:**
- Modify: `supabase/migrations/20261025000100_games.sql` (insert a section after "Moving the old nights over")
- Modify: `supabase/seed.sql` (rewrite)
- Modify: `tests/db/seed.test.ts` (rewrite)
- Modify: `tests/db/migrate.test.ts` (insert one test)

**Interfaces:**
- Consumes: everything from Tasks 1-3.
- Produces: `stints.game_id`, `stints.started_at` and `goals.game_id` become required; `stints.weight` is dropped. Demo FC: 15 players; nights as listed in the seed header.

- [ ] **Step 1: Write the failing tests**

Replace all of `tests/db/seed.test.ts` with:

```ts
// Checks that supabase/seed.sql loads and produces usable demo data.
import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { createDb, createUser, rpc, runSqlFile, selectAs } from './helpers'

let db: PGlite
let owner = ''
let groupId = ''

beforeAll(async () => {
  db = await createDb()
  await runSqlFile(db, 'supabase/seed.sql')
  owner = await createUser(db, 'Owner')
  const [{ join_group }] = await rpc<{ join_group: string }>(db, owner, 'join_group', {
    p_code: 'demo-kick',
    p_display_name: 'Owner',
  })
  groupId = join_group
})

afterAll(async () => {
  await db.close()
})

it('creates 15 players and demo nights; the first joiner becomes admin', async () => {
  const [me] = await selectAs<{ role: string }>(
    db, owner, `select role from group_members where group_id = $1`, [groupId],
  )
  expect(me.role).toBe('admin')
  expect(await selectAs(db, owner, `select * from players where group_id = $1`, [groupId])).toHaveLength(16)

  const nights = await selectAs<{ id: string; status: string }>(
    db, owner, `select id, status from matches where group_id = $1`, [groupId],
  )
  const count = (status: string) => nights.filter((n) => n.status === status).length
  expect([count('closed'), count('voting'), count('draft'), count('cancelled')]).toEqual([4, 1, 1, 1])

  // The planned night has a 10-player limit: 10 in, 1 waiting, 1 out. The owner goes on the list.
  const planned = nights.find((n) => n.status === 'draft')!
  const replies = await selectAs<{ status: string }>(db, owner, `select status from rsvps where match_id = $1`, [planned.id])
  const said = (status: string) => replies.filter((r) => r.status === status).length
  expect([said('in'), said('waiting'), said('out')]).toEqual([10, 1, 1])
  const [{ set_rsvp }] = await rpc<{ set_rsvp: string }>(db, owner, 'set_rsvp', { p_match_id: planned.id, p_status: 'in' })
  expect(set_rsvp).toBe('waiting')

  // Yesterday's night: 600 / 12 = 50 each; Ahmed (collector) plus 3 have paid.
  const voting = nights.find((n) => n.status === 'voting')!
  const money = await rpc<{ share: number; paid_at: Date | null; is_collector: boolean }>(
    db, owner, 'night_money', { p_match_id: voting.id },
  )
  expect(money).toHaveLength(12)
  expect(money.every((r) => r.share === 50)).toBe(true)
  expect(money.filter((r) => r.is_collector || r.paid_at !== null)).toHaveLength(4)

  // Players 1-12 played all four finished nights; Khaled, Amr and Hany only last week's.
  const allTime = await rpc<{ qualified: boolean; matches: number; avg_minutes: number }>(db, owner, 'get_leaderboard', {
    p_group_id: groupId,
    p_year: null,
  })
  expect(allTime).toHaveLength(15)
  expect(allTime.filter((row) => row.matches === 4 && row.qualified)).toHaveLength(12)
  expect(allTime.filter((row) => row.matches === 1 && !row.qualified)).toHaveLength(3)
  expect(allTime.every((row) => row.avg_minutes > 0)).toBe(true)

  // Running the seed again does nothing.
  await runSqlFile(db, 'supabase/seed.sql')
  const groups = await db.query(`select * from groups where name = 'Demo FC'`)
  expect(groups.rows).toHaveLength(1)
})

it('last week: three teams, penalties, a mid-game swap and a late arrival', async () => {
  const [last] = await selectAs<{ id: string; starts_at: Date }>(db, owner,
    `select id, starts_at from matches where group_id = $1 and status = 'closed' order by played_at desc limit 1`, [groupId])
  const games = await selectAs<{ team_one: string; team_two: string; penalty_winner: string | null; periods: number }>(db, owner,
    `select g.team_one, g.team_two, g.penalty_winner, (select count(*)::int from stints s where s.game_id = g.id) as periods
     from games g where g.match_id = $1 order by g.ordinal`, [last.id])
  expect(games.map((g) => [g.team_one, g.team_two, g.penalty_winner, g.periods])).toEqual([
    ['A', 'B', null, 1],
    ['A', 'C', 'C', 1],
    ['C', 'B', null, 2],
    ['B', 'A', null, 1],
  ])

  const ratings = await selectAs<{ display_name: string; minutes_played: string; clean_sheets: number }>(db, owner,
    `select p.display_name, mr.minutes_played, mr.clean_sheets
     from match_ratings mr join players p on p.id = mr.player_id where mr.match_id = $1`, [last.id])
  expect(ratings).toHaveLength(15)
  const r = (name: string) => ratings.find((x) => x.display_name === name)!
  expect(Number(r('Tarek').minutes_played)).toBe(20) // arrived late: games 3 and 4 only
  expect(r('Ali').clean_sheets).toBe(2) // in goal for all of game 2 (0-0) and game 4 (1-0)

  const [tarek] = await selectAs<{ arrived_at: Date }>(db, owner,
    `select mp.arrived_at from match_players mp join players p on p.id = mp.player_id
     where mp.match_id = $1 and p.display_name = 'Tarek'`, [last.id])
  expect((new Date(tarek.arrived_at).getTime() - new Date(last.starts_at).getTime()) / 60_000).toBe(25)

  // The table counts Ali's minutes in goal.
  const board = await rpc<{ display_name: string; minutes_in_goal: number }>(db, owner, 'get_leaderboard', {
    p_group_id: groupId, p_year: null,
  })
  expect(board.find((row) => row.display_name === 'Ali')!.minutes_in_goal).toBeGreaterThanOrEqual(30)
})
```

In `tests/db/migrate.test.ts`, insert this test just before `'an old night recalculates with the new rules'` (which stays last):

```ts
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
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/db/seed.test.ts tests/db/migrate.test.ts`
Expected: FAIL (12 players instead of 15, no games, and `stints.weight` still there).

- [ ] **Step 3: Make games required in file 5**

In `supabase/migrations/20261025000100_games.sql`, insert this section just before the dashed line above `-- Ratings: one per player per night, from all its games`:

```sql
-- Everything has moved over: from now on every lineup period belongs to a
-- game and has a start time, and every goal belongs to a game. The old
-- weights are gone: minutes come from the times.
alter table public.stints
  alter column game_id set not null,
  alter column started_at set not null,
  alter column started_at set default now(),
  drop column weight;
alter table public.goals
  alter column game_id set not null;


```

- [ ] **Step 4: Rewrite the demo data**

Replace all of `supabase/seed.sql` with:

```sql
-- =============================================================================
-- 7GZ-KORA: demo data for testing
--
-- Creates the group "Demo FC" with 15 fake players and these nights, each
-- with several 10-minute games:
--   * last season: one finished night (shows in the All-time tab only)
--   * three weeks and two weeks ago: finished, Team A v Team B
--     (two weeks ago Tarek arrived 25 minutes late)
--   * ten days ago: cancelled because of rain
--   * last week: finished, 15 players in three teams of 5, winner stays on:
--     a draw won on penalties, a mid-game swap and a late arrival;
--     4 people still owe for it
--   * yesterday: voting still open, with an "End game and swap"; 3 people
--     have paid back so far
--   * in 3 days: planned, with a 10-player limit: 10 in, 1 on the waiting
--     list and 1 out, so you can see the waiting list
-- Ahmed (player 3) collects the money every night: 600 EGP split equally.
-- Ali and Mahmoud are happy to play in goal.
--
-- Run it AFTER the 5 migration files, ideally in a separate test project.
-- To see it: sign in to the app, tap "Join a group" and enter  DEMO-KICK
-- The first real person to join becomes the group's admin.
--
-- To remove it later:   delete from public.groups where name = 'Demo FC';
-- =============================================================================

-- 20:00 in Cairo on the given day, plus some minutes. pg_temp = these helpers
-- disappear when this run ends.
create or replace function pg_temp.at_pitch(p_day date, p_minutes int default 0)
returns timestamptz
language sql stable as $$
  select ((p_day + time '20:00') at time zone 'Africa/Cairo') + make_interval(mins => p_minutes)
$$;

-- A night and who came (player numbers 1-15, positions in the players
-- array). Players in p_late arrived 25 minutes after the start.
create or replace function pg_temp.seed_night(
  p_group   uuid,
  p_players uuid[],
  p_played  date,
  p_side    int,
  p_here    int[],
  p_late    int[],
  p_status  text      -- 'closed' or 'voting'
) returns uuid
language plpgsql as $$
declare
  v_match uuid;
begin
  insert into public.matches (group_id, played_at, starts_at, location, cost, collector_player_id,
                              players_per_side, status, voting_closes_at, closed_at)
  values (
    p_group, p_played, pg_temp.at_pitch(p_played), 'Club pitch 3', 600, p_players[3], p_side,
    p_status,
    case when p_status = 'voting' then now() + interval '20 hours' else p_played + interval '1 day' end,
    case when p_status = 'closed' then p_played + interval '1 day' end
  )
  returning id into v_match;

  -- Checked in a few minutes before 20:00; late arrivals at 20:25.
  insert into public.match_players (match_id, player_id, arrived_at)
  select v_match, p_players[x], pg_temp.at_pitch(p_played, case when x = any (p_late) then 25 else -(x % 5) end)
  from unnest(p_here) x;
  return v_match;
end;
$$;

-- A game starting p_start minutes after 20:00. Its lineup periods are added
-- with seed_period. Returns the game's id.
create or replace function pg_temp.seed_game(
  p_match uuid, p_start int, p_team_one text, p_team_two text, p_penalty_winner text default null
) returns uuid
language plpgsql as $$
declare
  v_game uuid;
begin
  insert into public.games (match_id, ordinal, team_one, team_two, planned_minutes, started_at, ended_at, penalty_winner)
  select p_match, (select count(*) + 1 from public.games g where g.match_id = p_match), p_team_one, p_team_two, 10,
         m.starts_at + make_interval(mins => p_start), m.starts_at + make_interval(mins => p_start), p_penalty_winner
  from public.matches m
  where m.id = p_match
  returning id into v_game;
  return v_game;
end;
$$;

-- A lineup period of a game, starting where its last one ended. p_one and
-- p_two are the players of the game's first and second team, with their
-- goalkeepers; p_goals are pairs: scorer, assister (0 = no assist).
create or replace function pg_temp.seed_period(
  p_game    uuid,
  p_players uuid[],
  p_minutes int,
  p_one     int[],
  p_gk_one  int,
  p_two     int[],
  p_gk_two  int,
  p_goals   int[] default '{}'
) returns void
language plpgsql as $$
declare
  v_game  public.games;
  v_stint uuid;
  i       int := 1;
begin
  select * into v_game from public.games where id = p_game;

  insert into public.stints (match_id, game_id, ordinal, started_at, ended_at)
  select v_game.match_id, p_game, coalesce(max(s.ordinal), 0) + 1,
         v_game.ended_at, v_game.ended_at + make_interval(mins => p_minutes)
  from public.stints s
  where s.match_id = v_game.match_id
  returning id into v_stint;

  update public.games set ended_at = ended_at + make_interval(mins => p_minutes) where id = p_game;

  insert into public.stint_players (stint_id, match_id, player_id, team, is_goalkeeper)
  select v_stint, v_game.match_id, p_players[x], v_game.team_one, x = p_gk_one from unnest(p_one) x
  union all
  select v_stint, v_game.match_id, p_players[x], v_game.team_two, x = p_gk_two from unnest(p_two) x;

  while i < coalesce(array_length(p_goals, 1), 0) loop
    insert into public.goals (match_id, game_id, stint_id, scoring_team, scorer_id, assister_id, confirmed)
    values (
      v_game.match_id, p_game, v_stint,
      case when p_goals[i] = any (p_one) then v_game.team_one else v_game.team_two end,
      p_players[p_goals[i]],
      case when p_goals[i + 1] > 0 then p_players[p_goals[i + 1]] end,
      true
    );
    i := i + 2;
  end loop;
end;
$$;

-- A 10-minute game, Team A v Team B, with one lineup period.
create or replace function pg_temp.seed_ab_game(
  p_match uuid, p_players uuid[], p_start int,
  p_a int[], p_gk_a int, p_b int[], p_gk_b int, p_goals int[] default '{}'
) returns void
language plpgsql as $$
begin
  perform pg_temp.seed_period(pg_temp.seed_game(p_match, p_start, 'A', 'B'), p_players, 10,
                              p_a, p_gk_a, p_b, p_gk_b, p_goals);
end;
$$;

-- Finishes a night: the team board shows everyone's last team; votes
-- (everyone around 6-8, scorers a bit higher, a few "didn't see"), Man of the
-- Match, payments back to Ahmed the next day, and ratings for a closed night.
create or replace function pg_temp.seed_finish(
  p_match   uuid,
  p_players uuid[],
  p_voters  int[],    -- who has voted
  p_unpaid  int[]     -- who hasn't paid Ahmed back yet
) returns void
language plpgsql as $$
begin
  update public.match_players mp
  set team = (select sp.team from public.stint_players sp join public.stints s on s.id = sp.stint_id
              where sp.match_id = mp.match_id and sp.player_id = mp.player_id
              order by s.ordinal desc limit 1)
  where mp.match_id = p_match;

  insert into public.ratings_votes (match_id, voter_id, target_id, score, didnt_see)
  select p_match, voter.player_id, target.player_id,
         case when abs(hashtext(voter.player_id::text || target.player_id::text)) % 13 = 0 then null
              else least(10, greatest(1,
                     6 + (abs(hashtext(target.player_id::text || voter.player_id::text)) % 4) - 1
                       + (select count(*) from public.goals g
                          where g.match_id = p_match and g.scorer_id = target.player_id)::int))
         end,
         abs(hashtext(voter.player_id::text || target.player_id::text)) % 13 = 0
  from public.match_players voter
  join public.match_players target on target.match_id = voter.match_id and target.player_id <> voter.player_id
  where voter.match_id = p_match
    and voter.player_id = any (select p_players[x] from unnest(p_voters) x);

  -- Man of the Match: each voter picks the player they scored highest.
  insert into public.mvp_votes (match_id, voter_id, target_id)
  select distinct on (rv.voter_id) p_match, rv.voter_id, rv.target_id
  from public.ratings_votes rv
  where rv.match_id = p_match and rv.score is not null
  order by rv.voter_id, rv.score desc, rv.target_id;

  -- Everyone except the collector (player 3) and p_unpaid paid back the next day.
  insert into public.night_payments (match_id, player_id, paid_at)
  select p_match, mp.player_id, m.starts_at + interval '1 day'
  from public.match_players mp
  join public.matches m on m.id = mp.match_id
  where mp.match_id = p_match
    and mp.player_id <> p_players[3]
    and mp.player_id <> all (select p_players[x] from unnest(p_unpaid) x);

  if (select m.status from public.matches m where m.id = p_match) = 'closed' then
    perform public.compute_match_ratings(p_match);
  end if;
end;
$$;

do $$
declare
  v_group   uuid;
  v_players uuid[] := '{}';
  v_name    text;
  v_id      uuid;
  v_night   uuid;
  v_game    uuid;
  v_year    int := extract(year from current_date)::int;
  v_twelve  int[] := array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  v_all     int[] := array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
begin
  if exists (select 1 from public.groups where name = 'Demo FC') then
    raise notice 'Demo data is already loaded.';
    return;
  end if;

  insert into public.groups (name, invite_code) values ('Demo FC', 'DEMO-KICK') returning id into v_group;
  insert into public.rating_config (group_id) values (v_group);

  foreach v_name in array array[
    'Youssef', 'Omar', 'Ahmed', 'Karim', 'Mostafa', 'Ziad', 'Hassan', 'Tarek',
    'محمد', 'Ali', 'Seif', 'Mahmoud', 'Khaled', 'Amr', 'Hany'
  ] loop
    insert into public.players (group_id, display_name) values (v_group, v_name) returning id into v_id;
    v_players := v_players || v_id;
  end loop;
  update public.players set happy_in_goal = true where id in (v_players[10], v_players[12]);

  -- Last season (shows up in the All-time tab only): B wins two of three.
  v_night := pg_temp.seed_night(v_group, v_players, make_date(v_year - 1, 12, 18), 6, v_twelve, '{}', 'closed');
  perform pg_temp.seed_ab_game(v_night, v_players, 0,  array[1, 2, 3, 4, 5, 6], 5, array[7, 8, 9, 10, 11, 12], 9, array[7, 8]);
  perform pg_temp.seed_ab_game(v_night, v_players, 12, array[1, 2, 3, 4, 5, 6], 5, array[7, 8, 9, 10, 11, 12], 9, array[10, 0, 2, 0]);
  perform pg_temp.seed_ab_game(v_night, v_players, 24, array[1, 2, 3, 4, 5, 6], 5, array[7, 8, 9, 10, 11, 12], 9, array[8, 7]);
  perform pg_temp.seed_finish(v_night, v_players, v_twelve, '{}');

  -- Three weeks ago: four games; A wins two, B one, one draw.
  v_night := pg_temp.seed_night(v_group, v_players, current_date - 21, 6, v_twelve, '{}', 'closed');
  perform pg_temp.seed_ab_game(v_night, v_players, 0,  array[1, 2, 3, 4, 5, 6], 6, array[7, 8, 9, 10, 11, 12], 12, array[1, 2, 1, 0]);
  perform pg_temp.seed_ab_game(v_night, v_players, 12, array[1, 2, 3, 4, 5, 6], 6, array[7, 8, 9, 10, 11, 12], 12, array[3, 1, 7, 8]);
  perform pg_temp.seed_ab_game(v_night, v_players, 24, array[1, 2, 3, 4, 5, 6], 6, array[7, 8, 9, 10, 11, 12], 12, array[2, 4]);
  perform pg_temp.seed_ab_game(v_night, v_players, 36, array[1, 2, 3, 4, 5, 6], 6, array[7, 8, 9, 10, 11, 12], 12, array[8, 7]);
  perform pg_temp.seed_finish(v_night, v_players, v_twelve, '{}');

  -- Two weeks ago: Tarek (8) arrived 25 minutes late and played from game 3.
  v_night := pg_temp.seed_night(v_group, v_players, current_date - 14, 6, v_twelve, array[8], 'closed');
  perform pg_temp.seed_ab_game(v_night, v_players, 0,  array[1, 3, 5, 7, 9, 11], 11, array[2, 4, 6, 10, 12], 12, array[2, 4]);
  perform pg_temp.seed_ab_game(v_night, v_players, 12, array[1, 3, 5, 7, 9, 11], 11, array[2, 4, 6, 10, 12], 12, array[9, 1, 4, 0]);
  perform pg_temp.seed_ab_game(v_night, v_players, 26, array[1, 3, 5, 7, 9, 11], 11, array[2, 4, 6, 8, 10, 12], 12, array[6, 8]);
  perform pg_temp.seed_ab_game(v_night, v_players, 38, array[1, 3, 5, 7, 9, 11], 11, array[2, 4, 6, 8, 10, 12], 12, array[1, 3]);
  perform pg_temp.seed_finish(v_night, v_players, v_twelve, '{}');

  -- Ten days ago: cancelled three hours before because of rain. Nothing to pay.
  insert into public.matches (group_id, played_at, starts_at, location, cost, collector_player_id,
                              status, cancel_reason, cancelled_at)
  values (v_group, current_date - 10, pg_temp.at_pitch(current_date - 10), 'Club pitch 3', 600, v_players[3],
          'cancelled', 'rain', pg_temp.at_pitch(current_date - 10, -180));

  -- Last week: 15 players, three teams of 5, winner stays on. Tarek arrived
  -- 25 minutes late and joined Team C. 600 / 15 = 40 each; 4 still owe Ahmed.
  v_night := pg_temp.seed_night(v_group, v_players, current_date - 7, 5, v_all, array[8], 'closed');
  -- Game 1: A 2-1 B. A stays on, C comes on.
  perform pg_temp.seed_period(pg_temp.seed_game(v_night, 0, 'A', 'B'), v_players, 10,
    array[1, 2, 4, 5, 10], 10, array[3, 6, 7, 9, 11], 11, array[1, 2, 4, 0, 7, 9]);
  -- Game 2: A 0-0 C. C wins on penalties and stays on; B comes on.
  perform pg_temp.seed_period(pg_temp.seed_game(v_night, 12, 'A', 'C', 'C'), v_players, 10,
    array[1, 2, 4, 5, 10], 10, array[12, 13, 14, 15], 12);
  -- Game 3: C v B. C leads 1-0 after 6 minutes; Tarek (C) and Ziad (B) swap
  -- and the game carries on. B scores twice: C 1-2 B.
  v_game := pg_temp.seed_game(v_night, 26, 'C', 'B');
  perform pg_temp.seed_period(v_game, v_players, 6, array[8, 12, 13, 14, 15], 12, array[3, 6, 7, 9, 11], 11, array[13, 14]);
  perform pg_temp.seed_period(v_game, v_players, 4, array[6, 12, 13, 14, 15], 12, array[3, 7, 8, 9, 11], 11, array[3, 8, 9, 0]);
  -- Game 4: B 0-1 A.
  perform pg_temp.seed_period(pg_temp.seed_game(v_night, 40, 'B', 'A'), v_players, 10,
    array[3, 7, 8, 9, 11], 11, array[1, 2, 4, 5, 10], 10, array[5, 1]);
  perform pg_temp.seed_finish(v_night, v_players, v_all, array[7, 9, 11, 13]);

  -- Yesterday: voting still open. In game 2 the admin chose "End game and
  -- swap" after 6 minutes (Youssef and Omar swapped). 5 have voted, 3 paid back.
  v_night := pg_temp.seed_night(v_group, v_players, current_date - 1, 6, v_twelve, '{}', 'voting');
  perform pg_temp.seed_ab_game(v_night, v_players, 0, array[1, 3, 5, 7, 9, 11], 11, array[2, 4, 6, 8, 10, 12], 12, array[5, 1]);
  perform pg_temp.seed_period(pg_temp.seed_game(v_night, 12, 'A', 'B'), v_players, 6,
    array[1, 3, 5, 7, 9, 11], 11, array[2, 4, 6, 8, 10, 12], 12);
  perform pg_temp.seed_period(pg_temp.seed_game(v_night, 18, 'A', 'B'), v_players, 10,
    array[2, 3, 5, 7, 9, 11], 11, array[1, 4, 6, 8, 10, 12], 12, array[1, 4]);
  perform pg_temp.seed_finish(v_night, v_players, array[2, 3, 4, 5, 6], array[5, 6, 7, 8, 9, 10, 11, 12]);

  -- In 3 days: planned, limit 10. Players 1-10 are in, 11 is waiting, 12 is out.
  insert into public.matches (group_id, played_at, starts_at, location, cost, collector_player_id,
                              player_cap, status)
  values (v_group, current_date + 3, pg_temp.at_pitch(current_date + 3), 'Club pitch 3', 600, v_players[3],
          10, 'draft')
  returning id into v_night;

  insert into public.rsvps (match_id, player_id, status, status_changed_at, waiting_since)
  select v_night, v_players[x],
         case when x <= 10 then 'in' when x = 11 then 'waiting' else 'out' end,
         now() - make_interval(hours => 30 - x),
         case when x = 11 then now() - make_interval(hours => 30 - x) end
  from generate_series(1, 12) x;

  raise notice 'Demo FC created. Join it in the app with the code DEMO-KICK';
end;
$$;
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run tests/db/seed.test.ts tests/db/migrate.test.ts` → Expected: PASS (seed: 2; migrate: 6).
Run: `npm test` → Expected: all pass.

---

## Part B — App logic

### Task 5: Types, API calls and the game helpers

**Files:**
- Modify: `src/lib/types.ts` (rewrite)
- Modify: `src/lib/api.ts` (imports, `getPlayers`, `listMatches`, `getMatch`, the lineup and goal calls)
- Modify: `src/lib/format.ts` (imports, `scoreOf` out, two helpers in)
- Modify: `src/lib/format.test.ts` (import line, one `describe`)
- Modify: `src/components/ui.tsx:7` and `:173` (`Bib` → `Team`)
- Create: `src/lib/games.ts`, `src/lib/games.test.ts`, `src/lib/useNow.ts`, `src/lib/buzz.ts`

**Interfaces:**
- Consumes: the SQL actions from Task 3.
- Produces (types): `Team = 'A' | 'B' | 'C'`; `Game`; `Stint { id, game_id, ordinal, started_at, ended_at }`; `CheckIn.team`; `Goal.game_id`; `Player.happy_in_goal`; `MatchRating.minutes_played/minutes_in_goal`; `Breakdown.minutes?`; `LeaderboardRow.avg_minutes/minutes_in_goal`; `MatchSummary.games`; `MatchDetail { games, runningGame, stints, stintPlayers, lineup, ... }`; `BoardEntry { player_id, team: Team | null }`.
- Produces (api): `setTeamBoard(matchId, board: BoardEntry[])`, `startGame(matchId, teamOne, teamTwo, keeperOne, keeperTwo): Promise<string>`, `swapPlayers(matchId, lineup: LineupEntry[], cont: boolean): Promise<string>`, `endGame(matchId, penaltyWinner: Team | null)`, `logGoal(matchId, scorerId, assisterId, gameId = null)`, `setHappyInGoal(playerId, happy)`. `saveLineup` is removed.
- Produces (helpers): `TEAMS`, `gameScore`, `gameWinner`, `boardTeams`, `nextGameTeams`, `gameLineup`, `minutesTonight`, `Minutes`, `suggestKeeper`, `suggestSub`, `gameClock`; `formatClock(seconds)`, `formatMinutes(minutes)`; `useNow(ms = 1000): Date`; `unlockSound()`, `buzz()`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/games.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  boardTeams,
  gameClock,
  gameLineup,
  gameScore,
  gameWinner,
  minutesTonight,
  nextGameTeams,
  suggestKeeper,
  suggestSub,
} from './games'
import type { Game, Goal, StintPlayer, Team } from './types'

const game = (id: string, team_one: Team, team_two: Team, extra: Partial<Game> = {}): Game => ({
  id,
  match_id: 'm',
  ordinal: 1,
  team_one,
  team_two,
  planned_minutes: 10,
  started_at: '2026-10-29T18:00:00Z',
  ended_at: '2026-10-29T18:10:00Z',
  penalty_winner: null,
  ...extra,
})
const goal = (game_id: string, scoring_team: Team, disputed = false): Pick<Goal, 'game_id' | 'scoring_team' | 'disputed'> => ({
  game_id,
  scoring_team,
  disputed,
})
const ABC: Team[] = ['A', 'B', 'C']

describe('scores and winners', () => {
  it("counts each team's goals in the game; disputed goals don't count", () => {
    const g = game('g1', 'A', 'C')
    const goals = [goal('g1', 'A'), goal('g1', 'C'), goal('g1', 'A'), goal('g1', 'A', true), goal('g2', 'C')]
    expect(gameScore(g, goals)).toEqual([2, 1])
  })

  it('the winner has more goals; a draw is won only on penalties', () => {
    expect(gameWinner(game('g', 'A', 'B'), [2, 1])).toBe('A')
    expect(gameWinner(game('g', 'A', 'B'), [0, 1])).toBe('B')
    expect(gameWinner(game('g', 'A', 'C'), [0, 0])).toBeNull()
    expect(gameWinner(game('g', 'A', 'C', { penalty_winner: 'C' }), [0, 0])).toBe('C')
  })

  it("the board's teams are the ones with players, in order", () => {
    expect(boardTeams([{ team: 'C' }, { team: null }, { team: 'A' }, { team: 'A' }])).toEqual(['A', 'C'])
  })
})

describe('the next game (winner stays on)', () => {
  it('the first game is between the first two teams', () => {
    expect(nextGameTeams(null, ABC)).toEqual(['A', 'B'])
    expect(nextGameTeams(null, ['A'])).toBeNull()
  })

  it('three teams: the winner stays and the waiting team comes on (worked example 1)', () => {
    expect(nextGameTeams({ game: game('1', 'A', 'B'), score: [2, 1] }, ABC)).toEqual(['A', 'C'])
    // A 0-0 C and C wins on penalties: C stays, B comes on.
    expect(nextGameTeams({ game: game('2', 'A', 'C', { penalty_winner: 'C' }), score: [0, 0] }, ABC)).toEqual(['C', 'B'])
  })

  it('a draw without penalties: the team that was already on goes off', () => {
    expect(nextGameTeams({ game: game('3', 'C', 'B'), score: [1, 1] }, ABC)).toEqual(['B', 'A'])
  })

  it('two teams: the same two again', () => {
    expect(nextGameTeams({ game: game('1', 'A', 'B'), score: [0, 3] }, ['A', 'B'])).toEqual(['A', 'B'])
  })
})

describe('minutes', () => {
  const stints = [
    { id: 's1', game_id: 'g1', ordinal: 1, started_at: '2026-10-29T18:00:00Z', ended_at: '2026-10-29T18:06:00Z' },
    { id: 's2', game_id: 'g1', ordinal: 2, started_at: '2026-10-29T18:06:00Z', ended_at: '2026-10-29T18:10:00Z' },
    { id: 's3', game_id: 'g2', ordinal: 3, started_at: '2026-10-29T18:12:00Z', ended_at: null },
  ]
  const sp = (stint_id: string, player_id: string, team: Team, is_goalkeeper = false): StintPlayer => ({
    stint_id,
    player_id,
    team,
    is_goalkeeper,
  })
  const lineups = [
    sp('s1', 'S', 'A'), sp('s1', 'K', 'A', true), sp('s1', 'T', 'B'),
    sp('s2', 'S', 'B'), sp('s2', 'K', 'A', true), sp('s2', 'T', 'A'),
    sp('s3', 'K', 'A'), sp('s3', 'S', 'B', true),
  ]

  it('adds up minutes on the pitch and in goal; a period still going counts up to now', () => {
    const m = minutesTonight(stints, lineups, new Date('2026-10-29T18:17:00Z'))
    expect(m.get('S')).toEqual({ played: 15, inGoal: 5 })
    expect(m.get('K')).toEqual({ played: 15, inGoal: 10 })
    expect(m.get('T')).toEqual({ played: 10, inGoal: 0 })
    expect(m.get('nobody')).toBeUndefined()
  })

  it('who played in a game, with the team they finished it on (for the goal grid)', () => {
    const players = gameLineup('g1', stints, lineups)
    expect(players.map((p) => [p.player_id, p.team]).sort()).toEqual([['K', 'A'], ['S', 'B'], ['T', 'A']])
  })
})

describe('suggestions', () => {
  const name = (id: string) => id

  it('keeper: happy to play in goal first, then fewest minutes in goal tonight, then this season', () => {
    const tonight = new Map([['Ali', 10], ['Omar', 0], ['Ziad', 0]])
    const season = new Map([['Omar', 120], ['Ziad', 30]])
    expect(suggestKeeper(['Ali', 'Omar', 'Ziad'], { happy: new Set(), tonight, season, name })).toBe('Ziad')
    expect(suggestKeeper(['Ali', 'Omar', 'Ziad'], { happy: new Set(['Ali']), tonight, season, name })).toBe('Ali')
    expect(suggestKeeper([], { happy: new Set(), tonight, season, name })).toBeNull()
  })

  it('sub: the bench player with the fewest minutes in for the player on the pitch with the most', () => {
    const played = new Map([['Omar', 38], ['Karim', 20], ['Ziad', 12], ['Mostafa', 20]])
    expect(suggestSub(['Omar', 'Karim'], ['Ziad', 'Mostafa'], played)).toEqual({ in: 'Ziad', out: 'Omar' })
    expect(suggestSub(['Omar'], [], played)).toBeNull()
    // Nobody on the bench has played less: no suggestion.
    expect(suggestSub(['Ziad'], ['Omar'], played)).toBeNull()
  })
})

describe('the game clock', () => {
  it('counts up from the start; time is up at the set length', () => {
    const start = '2026-10-29T18:00:00Z'
    expect(gameClock(start, 10, new Date('2026-10-29T18:07:42Z'))).toEqual({ elapsed: '07:42', planned: '10:00', overtime: false })
    expect(gameClock(start, 10, new Date('2026-10-29T18:10:00Z')).overtime).toBe(true)
    expect(gameClock(start, 10, new Date('2026-10-29T17:59:58Z')).elapsed).toBe('00:00')
  })
})
```

In `src/lib/format.test.ts`, change the first `./format` import to `import { formatClock, formatLength, formatMinutes, formatNightWhen, nightFacts, ratingTone } from './format'` and append:

```ts
describe('game formatting', () => {
  it('formats the game clock and minutes', () => {
    expect(formatClock(462)).toBe('07:42')
    expect(formatClock(3725)).toBe('1:02:05')
    expect(formatClock(-3)).toBe('00:00')
    expect(formatMinutes(37.6)).toBe('38 min')
    expect(formatMinutes(0)).toBe('0 min')
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/games.test.ts src/lib/format.test.ts`
Expected: FAIL (`./games` doesn't exist; `formatClock` is not exported).

- [ ] **Step 3: Rewrite the types**

Replace all of `src/lib/types.ts` with:

```ts
// Shapes of the rows the app reads from Supabase (see supabase/migrations).

/** Teams wear bib colours: A white (no bibs), B orange, C blue. */
export type Team = 'A' | 'B' | 'C'
export type Role = 'admin' | 'member'
/** draft = a planned night. A night is a row in matches; only the screens say "night". */
export type MatchStatus = 'draft' | 'playing' | 'voting' | 'closed' | 'cancelled'
export type RsvpStatus = 'in' | 'waiting' | 'out'
export type CancelReason = 'rain' | 'not_enough_players' | 'pitch_problem' | 'other'

export interface Group {
  id: string
  name: string
  invite_code: string | null
}

export interface Membership {
  group: Group
  role: Role
  player_id: string
}

export interface Player {
  id: string
  group_id: string
  user_id: string | null
  display_name: string
  is_guest: boolean
  /** Suggested first when a game needs a goalkeeper. */
  happy_in_goal: boolean
  avatar_url: string | null
}

export interface Member {
  user_id: string
  player_id: string
  role: Role
  joined_at: string
}

/** Point values for the analytics score (rating_points_defaults in SQL). */
export interface RatingPoints {
  base: number
  goal: number
  goal_cap: number
  assist: number
  assist_cap: number
  net_goal: number
  net_goal_min: number
  net_goal_max: number
  win: number
  draw: number
  loss: number
  clean_sheet: number
  clean_sheet_cap: number
  /** A clean sheet needs a whole game in goal lasting at least this long. */
  clean_sheet_min_minutes: number
  save: number
  save_cap: number
  analytics_min: number
  analytics_max: number
}

export interface RatingConfig {
  group_id: string
  w_analytics: number
  w_votes: number
  min_votes: number
  min_matches_for_leaderboard: number
  voting_hours: number
  points: Partial<RatingPoints>
}

export interface Match {
  id: string
  group_id: string
  played_at: string
  starts_at: string | null
  location: string | null
  duration_minutes: number
  cost: number
  currency: string
  collector_player_id: string | null
  players_per_side: number
  game_minutes: number
  /** null = no limit (no waiting list). */
  player_cap: number | null
  status: MatchStatus
  voting_closes_at: string | null
  closed_at: string | null
  cancel_reason: CancelReason | null
  cancel_note: string | null
  cancel_fee: number
  cancelled_at: string | null
  created_at: string
}

/** One player's answer for a planned night. */
export interface Rsvp {
  player_id: string
  status: RsvpStatus
  status_changed_at: string
  /** Order on the waiting list. */
  waiting_since: string | null
  /** Set when they moved up from the waiting list ("You're in!"). */
  promoted_at: string | null
}

/** Checked in at the pitch. */
export interface CheckIn {
  player_id: string
  arrived_at: string
  left_at: string | null
  /** The team board: the team they're on now. null = on the bench. */
  team: Team | null
}

/** What plan_night / update_night take (see supabase/migrations/*_nights.sql). */
export interface NightDetails {
  played_at: string
  starts_at: string
  location: string
  duration_minutes: number
  cost: number
  players_per_side: number
  collector_player_id: string | null
  game_minutes: number
  player_cap: number | null
}

/** The Plan a night form: a local date and time instead of a timestamp. */
export interface NightForm {
  day: string
  time: string
  location: string
  duration_minutes: number
  cost: number
  players_per_side: number
  collector_player_id: string | null
  game_minutes: number
  player_cap: number | null
}

/** A row of a night's money card (night_money). */
export interface Payer {
  player_id: string
  /** Whole pounds: the cost ÷ the number of payers, rounded up. */
  share: number
  paid_at: string | null
  /** The collector counts as paid automatically. */
  is_collector: boolean
}

/** One unpaid share of the signed-in player (money_owed). */
export interface MoneyOwed {
  match_id: string
  played_at: string
  share: number
  currency: string
  collector_player_id: string | null
}

/** One short game of a night (see supabase/migrations/*_games.sql). */
export interface Game {
  id: string
  match_id: string
  ordinal: number
  team_one: Team
  team_two: Team
  /** The timer's guide: it buzzes, but an admin ends the game. */
  planned_minutes: number
  started_at: string
  /** null while the game is on. */
  ended_at: string | null
  /** A draw with a team waiting: who won the shootout. It only decides who stays on. */
  penalty_winner: Team | null
}

/** A lineup period of a game (a "stint" in the database). Minutes come from the times. */
export interface Stint {
  id: string
  game_id: string
  ordinal: number
  started_at: string
  /** null while it's still going. */
  ended_at: string | null
}

export interface StintPlayer {
  stint_id: string
  player_id: string
  team: Team
  is_goalkeeper: boolean
}

export interface Goal {
  id: string
  match_id: string
  game_id: string
  stint_id: string
  scoring_team: Team
  scorer_id: string
  assister_id: string | null
  confirmed: boolean
  disputed: boolean
  created_by: string | null
  created_at: string
}

export interface Vote {
  voter_id: string
  target_id: string
  score: number | null
  didnt_see: boolean
}

export interface MvpVote {
  voter_id: string
  target_id: string
}

/** Every component of a night's rating, as stored by compute_match_ratings. */
export interface Breakdown {
  base: number
  goals: number
  assists: number
  net_goals: number
  /** Goal difference while on the pitch, added up over the night. */
  net_goal_diff: number
  result: number
  clean_sheets: number
  saves: number
  /** Minutes on the pitch. Missing on nights rated before games existed. */
  minutes?: number
  analytics: number
  vote_average: number | null
  vote_count: number
  stats_only: boolean
  w_analytics: number
  w_votes: number
  min_votes: number
  final: number
}

export interface MatchRating {
  match_id: string
  player_id: string
  analytics_score: number
  vote_average: number | null
  vote_count: number
  stats_only: boolean
  final_rating: number
  /** Rounded to one decimal: what the app shows. */
  rating: number
  goals: number
  assists: number
  clean_sheets: number
  saves: number
  mvp_votes: number
  is_mvp: boolean
  minutes_played: number
  minutes_in_goal: number
  breakdown: Breakdown
}

export interface LeaderboardRow {
  player_id: string
  display_name: string
  matches: number
  avg_rating: number
  avg_rating_exact: number
  goals: number
  assists: number
  mvps: number
  clean_sheets: number
  avg_votes: number | null
  qualified: boolean
  /** Average minutes on the pitch per night. */
  avg_minutes: number
  /** All minutes in goal. */
  minutes_in_goal: number
}

/** A night in a list, with its games and enough to show their scores. */
export interface MatchSummary extends Match {
  games: Game[]
  goals: Pick<Goal, 'game_id' | 'scoring_team' | 'disputed'>[]
  match_ratings: { player_id: string; rating: number; is_mvp: boolean }[]
  match_players: { player_id: string }[]
  rsvps: Rsvp[]
}

/** Everything the night page needs. */
export interface MatchDetail {
  match: Match
  games: Game[]
  /** The game in progress, if any. */
  runningGame: Game | null
  stints: Stint[]
  /** Who was on the pitch in every lineup period. */
  stintPlayers: StintPlayer[]
  /** Who is on the pitch right now (empty between games). */
  lineup: StintPlayer[]
  /** Everyone checked in. */
  playerIds: string[]
  checkIns: CheckIn[]
  rsvps: Rsvp[]
  goals: Goal[]
  ratings: MatchRating[]
  votes: Vote[]
  mvpVotes: MvpVote[]
}

/** One player on the pitch, as swap_players takes it. */
export interface LineupEntry {
  player_id: string
  team: Team
  is_goalkeeper: boolean
}

/** One row of the team board, as set_team_board takes it. */
export interface BoardEntry {
  player_id: string
  /** null = on the bench. */
  team: Team | null
}
```

In `src/components/ui.tsx`, change line 7 to `import type { MatchStatus, Team } from '../lib/types'` and `TeamTag`'s signature to `export function TeamTag({ team }: { team: Team }) {`.

- [ ] **Step 4: Update the API calls**

In `src/lib/api.ts`:

1. In the `import type { ... } from './types'` list, add `BoardEntry,` (first), `Game,` (after `CheckIn,`) and `Team,` (after `StintPlayer,`).
2. In `getPlayers`, change the select string to `'id, group_id, user_id, display_name, is_guest, happy_in_goal, profiles!players_user_id_fkey(avatar_url)'`.
3. After `renamePlayer`, add:

```ts
/** "Happy to play in goal": yourself, or anyone if you're an admin. */
export async function setHappyInGoal(playerId: string, happy: boolean) {
  unwrap(await supabase.from('players').update({ happy_in_goal: happy }).eq('id', playerId))
}
```

4. In `listMatches`, change the select string to:

```ts
        '*, games!games_match_id_fkey(*), goals(game_id, scoring_team, disputed), match_ratings(player_id, rating, is_mvp), match_players!match_players_match_id_fkey(player_id), rsvps(player_id, status, status_changed_at, waiting_since, promoted_at)',
```

5. Replace `getMatch` with:

```ts
export async function getMatch(matchId: string): Promise<MatchDetail> {
  const [match, games, stints, stintPlayers, players, rsvps, goals, ratings, votes, mvpVotes] = await Promise.all([
    supabase.from('matches').select('*').eq('id', matchId).single(),
    supabase.from('games').select('*').eq('match_id', matchId).order('ordinal'),
    supabase.from('stints').select('id, game_id, ordinal, started_at, ended_at').eq('match_id', matchId).order('ordinal'),
    supabase.from('stint_players').select('stint_id, player_id, team, is_goalkeeper').eq('match_id', matchId),
    supabase.from('match_players').select('player_id, arrived_at, left_at, team').eq('match_id', matchId).order('arrived_at'),
    supabase.from('rsvps').select('player_id, status, status_changed_at, waiting_since, promoted_at').eq('match_id', matchId),
    supabase.from('goals').select('*').eq('match_id', matchId).order('created_at'),
    supabase.from('match_ratings').select('*').eq('match_id', matchId),
    supabase.from('ratings_votes').select('voter_id, target_id, score, didnt_see').eq('match_id', matchId),
    supabase.from('mvp_votes').select('voter_id, target_id').eq('match_id', matchId),
  ])
  const gameList = unwrap<Game[]>(games)
  const stintList = unwrap<Stint[]>(stints)
  const lineups = unwrap<StintPlayer[]>(stintPlayers)
  // The lineup period still going (only while a game is on).
  const current = stintList.find((s) => s.ended_at === null)
  const checkIns = unwrap<CheckIn[]>(players)
  return {
    match: unwrap<Match>(match),
    games: gameList,
    runningGame: gameList.find((g) => g.ended_at === null) ?? null,
    stints: stintList,
    stintPlayers: lineups,
    lineup: current ? lineups.filter((sp) => sp.stint_id === current.id) : [],
    playerIds: checkIns.map((c) => c.player_id),
    checkIns,
    rsvps: unwrap<Rsvp[]>(rsvps),
    goals: unwrap<Goal[]>(goals),
    ratings: unwrap<MatchRating[]>(ratings),
    votes: unwrap<Vote[]>(votes),
    mvpVotes: unwrap<MvpVote[]>(mvpVotes),
  }
}
```

6. Replace the two `saveLineup` lines with:

```ts
// ---------------------------------------------------------------------------
// Games at the pitch (admins)
// ---------------------------------------------------------------------------
export const setTeamBoard = (matchId: string, board: BoardEntry[]) =>
  rpc('set_team_board', { p_match_id: matchId, p_board: board })

/** Returns the new game's id. */
export const startGame = (matchId: string, teamOne: Team, teamTwo: Team, keeperOne: string | null, keeperTwo: string | null) =>
  rpc<string>('start_game', {
    p_match_id: matchId,
    p_team_one: teamOne,
    p_team_two: teamTwo,
    p_keeper_one: keeperOne,
    p_keeper_two: keeperTwo,
  })

/** The whole new pitch. cont = "Swap and continue"; otherwise "End game and swap". Returns the game now on. */
export const swapPlayers = (matchId: string, lineup: LineupEntry[], cont: boolean) =>
  rpc<string>('swap_players', { p_match_id: matchId, p_lineup: lineup, p_continue: cont })

/** "Game over". penaltyWinner: who won a shootout after a draw (or null). */
export const endGame = (matchId: string, penaltyWinner: Team | null) =>
  rpc('end_game', { p_match_id: matchId, p_penalty_winner: penaltyWinner })
```

7. Replace `logGoal` with:

```ts
/** Admins only. gameId = null: the game on now; otherwise an earlier game (a forgotten goal). */
export const logGoal = (matchId: string, scorerId: string, assisterId: string | null, gameId: string | null = null) =>
  rpc<string>('log_goal', { p_match_id: matchId, p_scorer_id: scorerId, p_assister_id: assisterId, p_game_id: gameId })
```

- [ ] **Step 5: The format helpers, game helpers, ticking clock and buzz**

In `src/lib/format.ts`: change the first line to `import type { CancelReason, Match } from './types'`, delete `scoreOf` (and its comment), and add after `formatLength`:

```ts
/** Seconds as a game clock: 462 -> "07:42", 3725 -> "1:02:05". */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const clock = `${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`
  return h > 0 ? `${h}:${clock}` : clock
}

/** 37.6 -> "38 min" */
export function formatMinutes(minutes: number): string {
  return `${Math.round(minutes)} min`
}
```

Create `src/lib/games.ts`:

```ts
// Games during a night: scores, the next game (winner stays on), minutes on
// the pitch and in goal, and the goalkeeper and sub suggestions
// (Plans/Football-scenario.md section 2, Plans/Extras-and-backlog.md
// sections 3 and 4). Pure functions (tested in games.test.ts).
import { formatClock } from './format'
import type { CheckIn, Game, Goal, Stint, StintPlayer, Team } from './types'

export const TEAMS: Team[] = ['A', 'B', 'C']

/** A game's score: [team_one, team_two]. Disputed goals don't count. */
export function gameScore(
  game: Pick<Game, 'id' | 'team_one' | 'team_two'>,
  goals: Pick<Goal, 'game_id' | 'scoring_team' | 'disputed'>[],
): [number, number] {
  let one = 0
  let two = 0
  for (const g of goals) {
    if (g.game_id !== game.id || g.disputed) continue
    if (g.scoring_team === game.team_one) one++
    else if (g.scoring_team === game.team_two) two++
  }
  return [one, two]
}

/** Who won: more goals, or the penalty winner of a draw. null = a draw with no shootout. */
export function gameWinner(game: Pick<Game, 'team_one' | 'team_two' | 'penalty_winner'>, score: [number, number]): Team | null {
  if (score[0] > score[1]) return game.team_one
  if (score[1] > score[0]) return game.team_two
  return game.penalty_winner
}

/** The teams that have players on the board, in order (A, B, C). */
export function boardTeams(checkIns: Pick<CheckIn, 'team'>[]): Team[] {
  return TEAMS.filter((t) => checkIns.some((c) => c.team === t))
}

/**
 * The next game: the winner (or penalty winner) stays on and the waiting team
 * comes on. With two teams, the same two again. After a draw with no
 * shootout, the team that was already on (listed first) goes off. Only a
 * suggestion: the admin can change it.
 */
export function nextGameTeams(last: { game: Game; score: [number, number] } | null, teams: Team[]): [Team, Team] | null {
  if (teams.length < 2) return null
  const first: [Team, Team] = [teams[0], teams[1]]
  if (!last) return first
  const { game, score } = last
  const waiting = teams.find((t) => t !== game.team_one && t !== game.team_two)
  if (!waiting) {
    return teams.includes(game.team_one) && teams.includes(game.team_two) ? [game.team_one, game.team_two] : first
  }
  const stays = gameWinner(game, score) ?? game.team_two
  return teams.includes(stays) ? [stays, waiting] : first
}

/** Everyone who played in a game, with the team of their last period in it (for the goal grid). */
export function gameLineup(
  gameId: string,
  stints: Pick<Stint, 'id' | 'game_id' | 'ordinal'>[],
  lineups: StintPlayer[],
): StintPlayer[] {
  const latest = new Map<string, StintPlayer>()
  const periods = stints.filter((s) => s.game_id === gameId).sort((a, b) => b.ordinal - a.ordinal)
  for (const period of periods) {
    for (const sp of lineups) {
      if (sp.stint_id === period.id && !latest.has(sp.player_id)) latest.set(sp.player_id, sp)
    }
  }
  return [...latest.values()]
}

export interface Minutes {
  played: number
  inGoal: number
}

/** Minutes on the pitch and in goal, from the lineup periods. A period still going counts up to `now`. */
export function minutesTonight(
  stints: Pick<Stint, 'id' | 'started_at' | 'ended_at'>[],
  lineups: Pick<StintPlayer, 'stint_id' | 'player_id' | 'is_goalkeeper'>[],
  now: Date,
): Map<string, Minutes> {
  const length = new Map(
    stints.map((s) => [
      s.id,
      Math.max(0, (new Date(s.ended_at ?? now).getTime() - new Date(s.started_at).getTime()) / 60_000),
    ]),
  )
  const minutes = new Map<string, Minutes>()
  for (const sp of lineups) {
    const m = length.get(sp.stint_id) ?? 0
    const sofar = minutes.get(sp.player_id) ?? { played: 0, inGoal: 0 }
    minutes.set(sp.player_id, { played: sofar.played + m, inGoal: sofar.inGoal + (sp.is_goalkeeper ? m : 0) })
  }
  return minutes
}

/**
 * Who goes in goal for a team: players happy to play in goal first, then the
 * fewest minutes in goal tonight, then the fewest this season.
 */
export function suggestKeeper(
  playerIds: string[],
  by: { happy: Set<string>; tonight: Map<string, number>; season: Map<string, number>; name: (id: string) => string },
): string | null {
  const sorted = [...playerIds].sort(
    (a, b) =>
      Number(by.happy.has(b)) - Number(by.happy.has(a)) ||
      (by.tonight.get(a) ?? 0) - (by.tonight.get(b) ?? 0) ||
      (by.season.get(a) ?? 0) - (by.season.get(b) ?? 0) ||
      by.name(a).localeCompare(by.name(b)),
  )
  return sorted[0] ?? null
}

/** Fair playing time: the bench player with the fewest minutes in, for the player on the pitch with the most. */
export function suggestSub(
  onPitch: string[],
  bench: string[],
  played: Map<string, number>,
): { in: string; out: string } | null {
  if (onPitch.length === 0 || bench.length === 0) return null
  const mins = (id: string) => played.get(id) ?? 0
  const subIn = bench.reduce((best, id) => (mins(id) < mins(best) ? id : best))
  const subOut = onPitch.reduce((best, id) => (mins(id) > mins(best) ? id : best))
  return mins(subIn) < mins(subOut) ? { in: subIn, out: subOut } : null
}

/** The game clock: "07:42" of "10:00", and whether the set length is up. */
export function gameClock(startedAt: string, plannedMinutes: number, now: Date) {
  const seconds = Math.max(0, Math.floor((now.getTime() - new Date(startedAt).getTime()) / 1000))
  return {
    elapsed: formatClock(seconds),
    planned: formatClock(plannedMinutes * 60),
    overtime: seconds >= plannedMinutes * 60,
  }
}
```

Create `src/lib/useNow.ts`:

```ts
import { useEffect, useState } from 'react'

/** The current time, updated every `ms` milliseconds (for the game clock and minutes). */
export function useNow(ms = 1000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), ms)
    return () => window.clearInterval(timer)
  }, [ms])
  return now
}
```

Create `src/lib/buzz.ts`:

```ts
// The game timer's buzz when the set length is up: a vibration (most Android
// phones) and two short beeps. Browsers only allow sound after a tap, so the
// pitch-side buttons call unlockSound() when an admin touches them.
let audio: AudioContext | null = null

export function unlockSound() {
  try {
    audio ??= new AudioContext()
    void audio.resume()
  } catch {
    audio = null
  }
}

export function buzz() {
  navigator.vibrate?.([300, 150, 300])
  if (!audio) return
  for (const at of [0, 0.4]) {
    const tone = audio.createOscillator()
    const volume = audio.createGain()
    tone.frequency.value = 880
    volume.gain.value = 0.2
    tone.connect(volume).connect(audio.destination)
    tone.start(audio.currentTime + at)
    tone.stop(audio.currentTime + at + 0.25)
  }
}
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run src/lib` → Expected: PASS.
Run: `npm test` → Expected: all pass. (`npx tsc -b` still fails here: the screens still use `scoreOf`, `saveLineup` and the old `Scoreboard`. Tasks 6-9 fix them.)

---

## Part C — Screens

Every screen follows `Design/README.md` and the "Live night (admin)" phone in `Design/screens.html`: game card with "Game 4" and the Live chip, team chips over a 64 px score, the clock "07:42 of 10:00" below; a 64 px green **Goal** button; **Swap** and **Sub in** side by side; a dark **Game over**; a "Waiting · Team C" card; a "Bench · minutes tonight" card with the suggested sub. Black text on every green surface; names in `<Name>`.

### Task 6: Shared game pieces

**Files:**
- Modify: `src/components/match.tsx` (rewrite)
- Create: `src/components/games.tsx`, `src/components/bench.tsx`, `src/components/nextgame.tsx`

**Interfaces:**
- Consumes: Task 5 (types, api, `src/lib/games.ts`, `useNow`, `buzz`).
- Produces: `Scoreboard({ teams: [Team, Team], score: [number, number] })`; `Lineups({ lineup })`; `PlayerGrid({ lineup, onPick, only?, exclude? })`; `GoalList({ detail, onChange })`; `GameClock({ game, buzzer? })`; `GameCard({ detail, onChange })` (renders only when `detail.runningGame` is set); `GamesList({ detail })`; `WaitingAndBench({ detail })`; `PlayingTime({ detail })`; `NextGameCard({ detail, seasonInGoal: Map<string, number>, onChange })`.

- [ ] **Step 1: Scoreboard, lineups, player grid and goals for any teams**

Replace all of `src/components/match.tsx` with:

```tsx
// Pieces shared by the night screens: the scoreboard, lineups, the player
// grid and the goal list.
import { useState } from 'react'
import * as api from '../lib/api'
import { errorMessage } from '../lib/format'
import { TEAMS } from '../lib/games'
import type { Goal, MatchDetail, StintPlayer, Team } from '../lib/types'
import { useAuth } from '../state/auth'
import { useGroup } from '../state/group'
import { CheckIcon, FlagIcon, GloveIcon } from './icons'
import { Button, ErrorNote, Name, TeamTag } from './ui'

/** Bib colours as Tailwind classes (spelled out so Tailwind keeps them). */
const BIB: Record<Team, string> = { A: 'bg-team-a', B: 'bg-team-b', C: 'bg-team-c' }

/** Team chips on top, the score below (Design/README.md, Scoreboard). */
export function Scoreboard({ teams, score }: { teams: [Team, Team]; score: [number, number] }) {
  return (
    <div aria-label={`Team ${teams[0]} ${score[0]}, Team ${teams[1]} ${score[1]}`}>
      <div className="flex items-center justify-between">
        <TeamTag team={teams[0]} />
        <TeamTag team={teams[1]} />
      </div>
      <p className="tabular mt-0.5 text-center font-display text-[64px] leading-none whitespace-nowrap">
        {score[0]} – {score[1]}
      </p>
    </div>
  )
}

/** One column per team in the lineup. */
export function Lineups({ lineup }: { lineup: StintPlayer[] }) {
  const { playerName } = useGroup()
  const teams = TEAMS.filter((t) => lineup.some((p) => p.team === t))
  return (
    <div className={`grid gap-3 ${teams.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
      {teams.map((team) => (
        <div key={team}>
          <div className="mb-1.5">
            <TeamTag team={team} />
          </div>
          <ul className="space-y-1">
            {lineup
              .filter((p) => p.team === team)
              .sort((a, b) => Number(b.is_goalkeeper) - Number(a.is_goalkeeper))
              .map((p) => (
                <li key={p.player_id} className="flex items-center gap-1.5 text-sm">
                  <Name className="truncate">{playerName(p.player_id)}</Name>
                  {p.is_goalkeeper && <GloveIcon size={16} className="shrink-0 text-muted" aria-label="Goalkeeper" />}
                </li>
              ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

/** Grid of big player buttons in their bib colours. Used to pick a scorer or assister. */
export function PlayerGrid({
  lineup,
  onPick,
  only,
  exclude,
}: {
  lineup: StintPlayer[]
  onPick: (playerId: string) => void
  only?: Team
  exclude?: string
}) {
  const { playerName } = useGroup()
  const teams = only ? [only] : TEAMS.filter((t) => lineup.some((p) => p.team === t))
  return (
    <div className="space-y-4">
      {teams.map((team) => (
        <div key={team}>
          <div className="mb-2">
            <TeamTag team={team} />
          </div>
          <div className="grid grid-cols-2 gap-2 min-[420px]:grid-cols-3">
            {lineup
              .filter((p) => p.team === team && p.player_id !== exclude)
              .map((p) => (
                <button
                  key={p.player_id}
                  type="button"
                  onClick={() => onPick(p.player_id)}
                  className={`press min-h-14 rounded-xl border-2 border-[#0b0b0b] px-2 py-2 text-left font-semibold text-[#0b0b0b] ${BIB[team]}`}
                >
                  <Name className="line-clamp-2">{playerName(p.player_id)}</Name>
                </button>
              ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/** The night's goals, game by game, with confirm / dispute / edit / delete where allowed. */
export function GoalList({ detail, onChange }: { detail: MatchDetail; onChange: () => void }) {
  const { user } = useAuth()
  const { playerName, myPlayerId, isAdmin } = useGroup()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Admin edit: which goal, and the new scorer once picked.
  const [editing, setEditing] = useState<{ goal: Goal; scorerId?: string } | null>(null)
  const { match, goals, games, playerIds, stintPlayers } = detail
  const open = match.status !== 'closed'
  const iPlayed = myPlayerId != null && playerIds.includes(myPlayerId)

  async function run(goalId: string, action: () => Promise<unknown>) {
    setBusy(goalId)
    setError(null)
    try {
      await action()
      onChange()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  if (goals.length === 0) return <p className="text-sm text-muted">No goals yet.</p>

  if (editing) {
    // Who was on the pitch when the goal went in.
    const period = stintPlayers.filter((sp) => sp.stint_id === editing.goal.stint_id)
    const goalId = editing.goal.id
    const scorerId = editing.scorerId
    const scorerTeam = period.find((p) => p.player_id === scorerId)?.team
    return (
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="font-semibold">{scorerId ? 'Who assisted?' : 'Who scored?'}</p>
          <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
            Cancel
          </Button>
        </div>
        <ErrorNote message={error} />
        {scorerId && scorerTeam ? (
          <>
            <Button
              className="mb-4 w-full"
              variant="secondary"
              busy={busy === goalId}
              onClick={() => run(goalId, () => api.editGoal(goalId, scorerId, null)).then(() => setEditing(null))}
            >
              No assist
            </Button>
            <PlayerGrid
              lineup={period}
              only={scorerTeam}
              exclude={scorerId}
              onPick={(assisterId) =>
                run(goalId, () => api.editGoal(goalId, scorerId, assisterId)).then(() => setEditing(null))
              }
            />
          </>
        ) : (
          <PlayerGrid lineup={period} onPick={(id) => setEditing({ ...editing, scorerId: id })} />
        )}
      </div>
    )
  }

  return (
    <>
      <ErrorNote message={error} />
      {games
        .filter((game) => goals.some((g) => g.game_id === game.id))
        .map((game) => (
          <div key={game.id} className="mt-3 first:mt-1">
            <p className="label">Game {game.ordinal}</p>
            <ul className="divide-y divide-line">
              {goals
                .filter((g) => g.game_id === game.id)
                .map((g) => {
                  const loggedByMe = g.created_by === user?.id
                  const involved = myPlayerId === g.scorer_id || myPlayerId === g.assister_id
                  const canConfirm = !g.confirmed && (isAdmin || (involved && !loggedByMe && !g.disputed))
                  const canDispute = open && !g.disputed && (isAdmin || iPlayed)
                  const canDelete = isAdmin || (open && loggedByMe)
                  return (
                    <li key={g.id} className={`py-3 ${g.disputed ? 'opacity-70' : ''}`}>
                      <div className="flex items-start gap-2">
                        <span
                          className={`chip team-${g.scoring_team.toLowerCase()} mt-0.5 shrink-0 px-2`}
                          aria-label={`Team ${g.scoring_team}`}
                        >
                          {g.scoring_team}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className={`font-semibold ${g.disputed ? 'line-through' : ''}`}>
                            <Name>{playerName(g.scorer_id)}</Name>
                          </p>
                          <p className="text-sm text-muted">
                            {g.assister_id ? (
                              <>
                                Assist: <Name>{playerName(g.assister_id)}</Name>
                              </>
                            ) : (
                              'No assist'
                            )}
                            {' · '}
                            {g.disputed ? (
                              <span className="font-semibold text-danger">Disputed: doesn't count until an admin fixes it</span>
                            ) : g.confirmed ? (
                              <span className="text-brand-ink">Confirmed</span>
                            ) : (
                              'Not confirmed yet'
                            )}
                          </p>
                        </div>
                      </div>
                      {(canConfirm || canDispute || canDelete || isAdmin) && (
                        <div className="mt-2 flex flex-wrap gap-2 pl-10">
                          {canConfirm && (
                            <Button size="sm" busy={busy === g.id} onClick={() => run(g.id, () => api.confirmGoal(g.id))}>
                              <CheckIcon size={16} /> Confirm
                            </Button>
                          )}
                          {canDispute && (
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={busy === g.id}
                              onClick={() => {
                                if (window.confirm('Dispute this goal? It will not count until an admin fixes it.'))
                                  void run(g.id, () => api.disputeGoal(g.id))
                              }}
                            >
                              <FlagIcon size={16} /> Dispute
                            </Button>
                          )}
                          {isAdmin && (
                            <Button size="sm" variant="secondary" disabled={busy === g.id} onClick={() => setEditing({ goal: g })}>
                              Edit
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              size="sm"
                              variant="danger"
                              disabled={busy === g.id}
                              onClick={() => {
                                if (window.confirm('Delete this goal?')) void run(g.id, () => api.deleteGoal(g.id))
                              }}
                            >
                              Delete
                            </Button>
                          )}
                        </div>
                      )}
                    </li>
                  )
                })}
            </ul>
          </div>
        ))}
    </>
  )
}
```

- [ ] **Step 2: The game card, its clock and the list of games**

Create `src/components/games.tsx`:

```tsx
// The game in progress (score, clock and the pitch-side buttons) and the list
// of the night's games.
import { useEffect, useRef, useState } from 'react'
import * as api from '../lib/api'
import { buzz, unlockSound } from '../lib/buzz'
import { errorMessage, formatMinutes } from '../lib/format'
import { boardTeams, gameClock, gameScore, minutesTonight, suggestSub } from '../lib/games'
import type { Game, MatchDetail, Team } from '../lib/types'
import { useNow } from '../lib/useNow'
import { useCurrentGroup } from '../state/group'
import { BallIcon } from './icons'
import { Lineups, Scoreboard } from './match'
import { Button, Card, ErrorNote, Heading, LinkButton, StatusChip, TeamTag } from './ui'

/**
 * "07:42 of 10:00". At the set length it turns red and, for admins, buzzes
 * once. It never ends the game: an admin taps Game over.
 */
export function GameClock({ game, buzzer = false }: { game: Game; buzzer?: boolean }) {
  const now = useNow()
  const clock = gameClock(game.started_at, game.planned_minutes, now)
  // A game already over time when the page opens doesn't buzz again.
  const buzzed = useRef(clock.overtime)
  useEffect(() => {
    if (buzzer && clock.overtime && !buzzed.current) {
      buzzed.current = true
      buzz()
    }
  }, [buzzer, clock.overtime])
  return (
    <p role="timer" className={`tabular mt-1 text-center font-display text-[30px] leading-none ${clock.overtime ? 'text-danger' : ''}`}>
      {clock.elapsed}{' '}
      <span className="font-sans text-[13px] font-medium text-muted">{clock.overtime ? "time's up" : `of ${clock.planned}`}</span>
    </p>
  )
}

/**
 * The game in progress. The score and clock stay in view at the top while
 * the page scrolls. Admins get the pitch-side buttons: Goal, Swap, Sub in and
 * Game over (which asks about penalties after a draw when a team is waiting).
 * Everyone else sees who's on the pitch.
 */
export function GameCard({ detail, onChange }: { detail: MatchDetail; onChange: () => void }) {
  const { isAdmin } = useCurrentGroup()
  const now = useNow(30_000)
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const game = detail.runningGame
  if (!game) return null

  const teams: [Team, Team] = [game.team_one, game.team_two]
  const score = gameScore(game, detail.goals)
  const here = detail.checkIns.filter((c) => !c.left_at)
  const waiting = boardTeams(here).filter((t) => !teams.includes(t))
  const bench = here.filter((c) => c.team === null).map((c) => c.player_id)
  const minutes = minutesTonight(detail.stints, detail.stintPlayers, now)
  const sub = suggestSub(
    detail.lineup.map((p) => p.player_id),
    bench,
    new Map([...minutes].map(([id, m]) => [id, m.played])),
  )
  const base = `/nights/${detail.match.id}`

  async function end(penaltyWinner: Team | null) {
    setBusy(true)
    setError(null)
    try {
      await api.endGame(detail.match.id, penaltyWinner)
      setAsking(false)
      onChange()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  function gameOver() {
    // A draw with a team waiting: penalties decide who stays on.
    if (score[0] === score[1] && waiting.length > 0) setAsking(true)
    else if (window.confirm(`Game over at ${score[0]} – ${score[1]}?`)) void end(null)
  }

  return (
    <>
      <div className="sticky top-[calc(env(safe-area-inset-top)+4rem)] z-10 -mx-4 bg-ground/95 px-4 py-2 backdrop-blur">
        <Card strong>
          <div className="mb-2 flex items-center justify-between">
            <span className="label">Game {game.ordinal}</span>
            <StatusChip status="playing" />
          </div>
          <Scoreboard teams={teams} score={score} />
          <GameClock key={game.id} game={game} buzzer={isAdmin} />
        </Card>
      </div>
      <ErrorNote message={error} />
      {isAdmin ? (
        <div className="space-y-2" onPointerDown={unlockSound}>
          <LinkButton to={`${base}/record`} size="lg" className="w-full">
            <BallIcon size={26} /> Goal
          </LinkButton>
          <div className="flex gap-2">
            <LinkButton to={`${base}/swap`} variant="secondary" className="flex-1">
              Swap
            </LinkButton>
            {(bench.length > 0 || waiting.length > 0) && (
              <LinkButton to={sub ? `${base}/swap?in=${sub.in}&out=${sub.out}` : `${base}/swap`} variant="secondary" className="flex-1">
                Sub in
              </LinkButton>
            )}
          </div>
          {asking ? (
            <Card>
              <p className="font-semibold">
                It's a draw and Team {waiting.join(' and ')} is waiting. Who won on penalties?
              </p>
              <div className="mt-3 flex gap-2">
                {teams.map((t) => (
                  <Button key={t} variant="secondary" className="flex-1" busy={busy} onClick={() => void end(t)}>
                    <TeamTag team={t} />
                  </Button>
                ))}
              </div>
              <Button variant="ghost" className="mt-2 w-full" disabled={busy} onClick={() => void end(null)}>
                No penalties
              </Button>
            </Card>
          ) : (
            <Button variant="dark" className="w-full" busy={busy} onClick={gameOver}>
              Game over
            </Button>
          )}
        </div>
      ) : (
        <Card>
          <Heading className="mb-2">On the pitch</Heading>
          <Lineups lineup={detail.lineup} />
        </Card>
      )}
    </>
  )
}

/** Every game of the night, newest first: teams, score, penalties and length. */
export function GamesList({ detail }: { detail: MatchDetail }) {
  const now = useNow(30_000)
  const { games, goals } = detail
  if (games.length === 0) return null
  return (
    <Card>
      <Heading className="mb-1">Games ({games.length})</Heading>
      <ul className="divide-y divide-line">
        {[...games].reverse().map((g) => {
          const [one, two] = gameScore(g, goals)
          const minutes = (new Date(g.ended_at ?? now).getTime() - new Date(g.started_at).getTime()) / 60_000
          return (
            <li key={g.id} className="py-2">
              <div className="flex min-h-10 items-center gap-2">
                <span className="w-6 font-display text-muted">{g.ordinal}</span>
                <TeamTag team={g.team_one} />
                <span className="tabular font-display text-xl whitespace-nowrap">
                  {one} – {two}
                </span>
                <TeamTag team={g.team_two} />
                <span className="ml-auto text-xs text-muted">{g.ended_at ? formatMinutes(minutes) : 'Live'}</span>
              </div>
              {g.penalty_winner && <p className="pl-8 text-xs text-muted">Team {g.penalty_winner} won on penalties</p>}
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
```

(The early `return null` comes after every hook, so the hook order never changes.)

- [ ] **Step 3: The waiting team, the bench and playing time**

Create `src/components/bench.tsx`:

```tsx
// Who isn't on the pitch right now (the waiting team and the bench, with
// minutes tonight), and everyone's playing time (Plans/Extras-and-backlog.md
// sections 3 and 4).
import { Link } from 'react-router'
import { formatMinutes } from '../lib/format'
import { boardTeams, minutesTonight, suggestSub } from '../lib/games'
import type { MatchDetail } from '../lib/types'
import { useNow } from '../lib/useNow'
import { useCurrentGroup } from '../state/group'
import { Card, Heading, Name, TeamTag } from './ui'

/** The teams not playing, and the bench with minutes tonight. During a game, admins see a suggested sub. */
export function WaitingAndBench({ detail }: { detail: MatchDetail }) {
  const { playerName, isAdmin } = useCurrentGroup()
  const now = useNow(30_000)
  const minutes = minutesTonight(detail.stints, detail.stintPlayers, now)
  const played = (id: string) => minutes.get(id)?.played ?? 0
  const game = detail.runningGame
  const playing = game ? [game.team_one, game.team_two] : []
  const here = detail.checkIns.filter((c) => !c.left_at)
  const others = boardTeams(here).filter((t) => !playing.includes(t))
  const bench = here.filter((c) => c.team === null).map((c) => c.player_id)
  const sub =
    game && isAdmin
      ? suggestSub(detail.lineup.map((p) => p.player_id), bench, new Map([...minutes].map(([id, m]) => [id, m.played])))
      : null

  if (others.length === 0 && bench.length === 0) return null
  return (
    <>
      {others.map((team) => (
        <Card key={team}>
          <div className="flex items-center justify-between">
            <Heading>{game ? 'Waiting' : 'Team'}</Heading>
            <TeamTag team={team} />
          </div>
          <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-sm">
            {here
              .filter((c) => c.team === team)
              .map((c) => (
                <li key={c.player_id}>
                  <Name className="font-semibold">{playerName(c.player_id)}</Name>
                </li>
              ))}
          </ul>
        </Card>
      ))}
      {bench.length > 0 && (
        <Card>
          <Heading>Bench · minutes tonight</Heading>
          <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-sm">
            {bench.map((id) => (
              <li key={id}>
                <Name className="font-bold">{playerName(id)}</Name> {formatMinutes(played(id))}
              </li>
            ))}
          </ul>
          {sub && (
            <Link
              to={`/nights/${detail.match.id}/swap?in=${sub.in}&out=${sub.out}`}
              className="mt-2.5 block rounded-[10px] bg-ground px-2.5 py-2 text-sm"
            >
              Suggested sub: <Name className="font-bold">{playerName(sub.in)}</Name> in for{' '}
              <Name className="font-bold">{playerName(sub.out)}</Name> ({formatMinutes(played(sub.out))}).{' '}
              <span className="font-semibold text-brand-ink underline">Sub in</span>
            </Link>
          )}
        </Card>
      )}
    </>
  )
}

/** Minutes on the pitch and in goal tonight, most first. */
export function PlayingTime({ detail }: { detail: MatchDetail }) {
  const { playerName } = useCurrentGroup()
  const now = useNow(30_000)
  if (detail.stints.length === 0) return null
  const minutes = minutesTonight(detail.stints, detail.stintPlayers, now)
  const rows = detail.checkIns
    .map((c) => ({ id: c.player_id, ...(minutes.get(c.player_id) ?? { played: 0, inGoal: 0 }) }))
    .sort((a, b) => b.played - a.played || playerName(a.id).localeCompare(playerName(b.id)))
  return (
    <Card>
      <Heading className="mb-1">Playing time</Heading>
      <table className="tabular w-full text-sm">
        <thead>
          <tr className="text-xs text-muted">
            <th className="py-1 text-left font-semibold">Player</th>
            <th className="py-1 text-right font-semibold">On the pitch</th>
            <th className="py-1 text-right font-semibold">In goal</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="py-1.5">
                <Name className="font-semibold">{playerName(r.id)}</Name>
              </td>
              <td className="py-1.5 text-right">{formatMinutes(r.played)}</td>
              <td className="py-1.5 text-right">{r.inGoal > 0 ? formatMinutes(r.inGoal) : '–'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}
```

- [ ] **Step 4: The next game (admins, between games)**

Create `src/components/nextgame.tsx`:

```tsx
// Between games (admins): pick the next two teams and their goalkeepers, then
// start the game. It comes pre-filled: the winner stays on and the waiting
// team comes on; in goal, whoever is happy to play there, then whoever has
// had the fewest minutes in goal tonight, then this season.
import { useState } from 'react'
import * as api from '../lib/api'
import { unlockSound } from '../lib/buzz'
import { errorMessage, formatMinutes } from '../lib/format'
import { boardTeams, gameScore, minutesTonight, nextGameTeams, suggestKeeper, suggestSub } from '../lib/games'
import type { BoardEntry, MatchDetail, Team } from '../lib/types'
import { useCurrentGroup } from '../state/group'
import { GloveIcon } from './icons'
import { Button, Card, ErrorNote, Heading, LinkButton, Name, Notice, TeamTag } from './ui'

export function NextGameCard({
  detail,
  seasonInGoal,
  onChange,
}: {
  detail: MatchDetail
  /** Minutes in goal this season, by player (from the table). */
  seasonInGoal: Map<string, number>
  onChange: () => void
}) {
  const { player, playerName } = useCurrentGroup()
  const [picked, setPicked] = useState<Team[] | null>(null)
  const [keepers, setKeepers] = useState<Partial<Record<Team, string | null>>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const matchId = detail.match.id
  const here = detail.checkIns.filter((c) => !c.left_at)
  const teams = boardTeams(here)
  const last = detail.games.at(-1)
  const suggested = nextGameTeams(last ? { game: last, score: gameScore(last, detail.goals) } : null, teams)
  const chosen = (picked ?? suggested ?? []).filter((t) => teams.includes(t))
  const minutes = minutesTonight(detail.stints, detail.stintPlayers, new Date())
  const onTeam = (t: Team) => here.filter((c) => c.team === t).map((c) => c.player_id)
  const keeperFor = (t: Team) =>
    suggestKeeper(onTeam(t), {
      happy: new Set(here.filter((c) => player(c.player_id)?.happy_in_goal).map((c) => c.player_id)),
      tonight: new Map([...minutes].map(([id, m]) => [id, m.inGoal])),
      season: seasonInGoal,
      name: playerName,
    })
  const keeper = (t: Team) => (t in keepers ? (keepers[t] ?? null) : keeperFor(t))
  const bench = here.filter((c) => c.team === null).map((c) => c.player_id)
  const sub =
    chosen.length === 2
      ? suggestSub(chosen.flatMap(onTeam), bench, new Map([...minutes].map(([id, m]) => [id, m.played])))
      : null

  async function run(name: string, action: () => Promise<unknown>) {
    setBusy(name)
    setError(null)
    try {
      await action()
      onChange()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  // Tapping a third team swaps out the one picked first.
  function toggleTeam(t: Team) {
    setPicked(chosen.includes(t) ? chosen.filter((x) => x !== t) : [...chosen, t].slice(-2))
  }

  // The suggested sub takes the other player's place on the team board.
  function applySub() {
    if (!sub) return
    const team = here.find((c) => c.player_id === sub.out)?.team ?? null
    const board: BoardEntry[] = here.map((c) => ({
      player_id: c.player_id,
      team: c.player_id === sub.in ? team : c.player_id === sub.out ? null : c.team,
    }))
    setKeepers({})
    void run('sub', () => api.setTeamBoard(matchId, board))
  }

  function start() {
    unlockSound()
    const [one, two] = chosen
    void run('start', () => api.startGame(matchId, one, two, keeper(one), keeper(two)))
  }

  if (teams.length < 2) {
    return (
      <Card strong>
        <Heading>Next game</Heading>
        <Notice>Put players on at least two teams first.</Notice>
        <LinkButton to={`/nights/${matchId}/teams`} className="w-full">
          Team board
        </LinkButton>
      </Card>
    )
  }

  return (
    <Card strong>
      <Heading>Next game · Game {(last?.ordinal ?? 0) + 1}</Heading>
      <div className="mt-2 flex gap-2" role="group" aria-label="Teams playing">
        {teams.map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={chosen.includes(t)}
            onClick={() => toggleTeam(t)}
            className={`press min-h-12 rounded-full px-1 ${chosen.includes(t) ? 'ring-2 ring-ink' : 'opacity-40'}`}
          >
            <TeamTag team={t} />
          </button>
        ))}
      </div>

      {chosen.length === 2 &&
        chosen.map((t) => (
          <div key={t} className="mt-3">
            <p className="label mb-1.5 flex items-center gap-1">
              <GloveIcon size={14} /> Team {t} in goal
            </p>
            <div className="flex flex-wrap gap-1.5">
              {onTeam(t).map((id) => {
                const selected = keeper(t) === id
                const inGoal = minutes.get(id)?.inGoal ?? 0
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setKeepers((k) => ({ ...k, [t]: selected ? null : id }))}
                    className={`press min-h-10 rounded-full border-[1.5px] px-3 text-sm font-semibold ${
                      selected ? 'border-ink bg-ink text-paper' : 'border-line bg-paper'
                    }`}
                  >
                    <Name>{playerName(id)}</Name>
                    {inGoal > 0 && <span className="ml-1 font-normal opacity-70">{formatMinutes(inGoal)}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        ))}

      {sub && (
        <div className="mt-3 flex items-center gap-2 rounded-[10px] bg-ground px-2.5 py-2 text-sm">
          <p className="min-w-0 flex-1">
            Suggested sub: <Name className="font-bold">{playerName(sub.in)}</Name> in for{' '}
            <Name className="font-bold">{playerName(sub.out)}</Name> ({formatMinutes(minutes.get(sub.out)?.played ?? 0)})
          </p>
          <Button size="sm" variant="secondary" busy={busy === 'sub'} onClick={applySub}>
            Do it
          </Button>
        </div>
      )}

      <ErrorNote message={error} />
      <Button size="lg" className="mt-3 w-full" disabled={chosen.length !== 2 || busy !== null} busy={busy === 'start'} onClick={start}>
        Start game
      </Button>
    </Card>
  )
}
```

- [ ] **Step 5: Check the pieces compile**

Run: `npx tsc -b 2>&1 | grep -E "src/components/(match|games|bench|nextgame)\.tsx"`
Expected: no lines (the remaining errors are in the screens, fixed in Tasks 7-9).

---

### Task 7: Team board, Swap and goal screens

**Files:**
- Modify: `src/pages/Teams.tsx` (rewrite)
- Create: `src/pages/Swap.tsx`
- Modify: `src/pages/Recorder.tsx` (rewrite)
- Modify: `src/App.tsx` (import and route)

**Interfaces:**
- Consumes: Task 5 api (`getMatch`, `setTeamBoard`, `swapPlayers`, `logGoal`, `deleteGoal`), helpers (`TEAMS`, `minutesTonight`, `gameLineup`, `gameScore`), Task 6 components.
- Produces: routes `/nights/:id/teams` (team board), `/nights/:id/swap` (optional `?in=<player>&out=<player>` pre-applies a sub), `/nights/:id/record` (optional `?game=<id>` picks an earlier game).

- [ ] **Step 1: The team board**

Replace all of `src/pages/Teams.tsx` with:

```tsx
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { BackIcon } from '../components/icons'
import { Avatar, Button, ErrorNote, Loading, Name, Notice, PageTitle, TeamTag } from '../components/ui'
import * as api from '../lib/api'
import { errorMessage, formatMinutes } from '../lib/format'
import { minutesTonight, TEAMS } from '../lib/games'
import type { MatchDetail, Team } from '../lib/types'
import { useCurrentGroup } from '../state/group'

/**
 * The team board (admins): Team A, B or C, or the bench ("Out"), for everyone
 * checked in, with their minutes tonight. While a game is on, players on the
 * pitch are moved with Swap.
 */
export default function Teams() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { player, isAdmin } = useCurrentGroup()
  const [detail, setDetail] = useState<MatchDetail | null>(null)
  const [picks, setPicks] = useState<Map<string, Team | null>>(new Map())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .getMatch(id)
      .then((d) => {
        setDetail(d)
        setPicks(new Map(d.checkIns.map((c) => [c.player_id, c.team])))
      })
      .catch((e: unknown) => setError(errorMessage(e)))
  }, [id])

  if (!isAdmin) return <ErrorNote message="Only group admins can change the teams." />
  if (!detail) return error ? <ErrorNote message={error} /> : <Loading />

  const name = (playerId: string) => player(playerId)?.display_name ?? 'Unknown player'
  const here = [...detail.checkIns].sort((a, b) => name(a.player_id).localeCompare(name(b.player_id)))
  const onPitch = new Set(detail.lineup.map((p) => p.player_id))
  const minutes = minutesTonight(detail.stints, detail.stintPlayers, new Date())
  const count = (team: Team) => [...picks.values()].filter((t) => t === team).length

  async function save() {
    setBusy(true)
    setError(null)
    try {
      await api.setTeamBoard(id, here.map((c) => ({ player_id: c.player_id, team: picks.get(c.player_id) ?? null })))
      navigate(`/nights/${id}`)
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
    }
  }

  return (
    <div>
      <Link to={`/nights/${id}`} className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-muted">
        <BackIcon size={18} /> Night
      </Link>
      <PageTitle sub="Put everyone checked in on a team. Out = on the bench, as a sub.">Team board</PageTitle>

      {here.length < 2 ? (
        <Notice>Check at least 2 players in first, on the night page.</Notice>
      ) : (
        <>
          <div className="sticky top-[calc(env(safe-area-inset-top)+4rem)] z-10 -mx-4 mb-2 flex items-center gap-3 bg-ground/95 px-4 py-2 backdrop-blur">
            {TEAMS.map((t) => (
              <span key={t} className="flex items-center gap-1.5 font-display text-lg">
                <TeamTag team={t} /> {count(t)}
              </span>
            ))}
          </div>

          <ul className="divide-y divide-line rounded-card border-[1.5px] border-line bg-paper">
            {here.map(({ player_id, left_at }) => {
              const pick = picks.get(player_id) ?? null
              const label = name(player_id)
              const playing = onPitch.has(player_id)
              const locked = playing || left_at !== null
              const note = left_at
                ? 'Left early'
                : playing
                  ? 'On the pitch · use Swap'
                  : `${formatMinutes(minutes.get(player_id)?.played ?? 0)} tonight`
              return (
                <li key={player_id} className="flex items-center gap-2 px-3 py-2">
                  <Avatar name={label} url={player(player_id)?.avatar_url} size={32} />
                  <div className="min-w-0 flex-1">
                    <Name className="block truncate font-medium">{label}</Name>
                    <span className="block text-xs text-muted">{note}</span>
                  </div>
                  <div className="seg" role="group" aria-label={`Team for ${label}`}>
                    {[null, ...TEAMS].map((t) => (
                      <button
                        key={t ?? 'out'}
                        type="button"
                        disabled={locked}
                        aria-pressed={pick === t}
                        className={`disabled:opacity-40 ${pick === t ? (t ? `sel-${t.toLowerCase()}` : 'sel-out') : ''}`}
                        onClick={() => setPicks((prev) => new Map(prev).set(player_id, t))}
                      >
                        {t ?? 'Out'}
                      </button>
                    ))}
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}

      <ErrorNote message={error} />

      <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-10 mt-4">
        <Button size="lg" className="w-full" busy={busy} disabled={here.length < 2} onClick={() => void save()}>
          Save teams
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: The Swap screen**

Create `src/pages/Swap.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { BackIcon, GloveIcon } from '../components/icons'
import { Avatar, Button, ErrorNote, Loading, Name, Notice, PageTitle, TeamTag } from '../components/ui'
import * as api from '../lib/api'
import { errorMessage, formatMinutes } from '../lib/format'
import { minutesTonight } from '../lib/games'
import type { LineupEntry, MatchDetail, Team } from '../lib/types'
import { useCurrentGroup } from '../state/group'

type Pick = { team: Team | null; gk: boolean }

/**
 * Change who's on the pitch during a game (admins): swap players between the
 * two teams, bring on a sub (from the bench or the waiting team) or change a
 * goalkeeper. Then "Swap and continue" (the same game, the score carries on)
 * or "End game and swap" (the next game starts 0-0 with the new teams).
 * ?in=<player>&out=<player> comes from a suggested sub and is pre-applied.
 */
export default function Swap() {
  const { id = '' } = useParams()
  const { search } = useLocation()
  const navigate = useNavigate()
  const { player, isAdmin } = useCurrentGroup()
  const [detail, setDetail] = useState<MatchDetail | null>(null)
  const [picks, setPicks] = useState<Map<string, Pick>>(new Map())
  const [busy, setBusy] = useState<'continue' | 'end' | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .getMatch(id)
      .then((d) => {
        const next = new Map<string, Pick>(d.lineup.map((p) => [p.player_id, { team: p.team, gk: p.is_goalkeeper }]))
        const params = new URLSearchParams(search)
        const subIn = params.get('in')
        const subOut = params.get('out')
        const out = subOut ? next.get(subOut) : undefined
        if (subIn && subOut && out) {
          next.set(subIn, out)
          next.set(subOut, { team: null, gk: false })
        }
        setDetail(d)
        setPicks(next)
      })
      .catch((e: unknown) => setError(errorMessage(e)))
  }, [id, search])

  const back = (
    <Link to={`/nights/${id}`} className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-muted">
      <BackIcon size={18} /> Night
    </Link>
  )
  if (!isAdmin) return <ErrorNote message="Only group admins can swap players." />
  if (!detail) return error ? <ErrorNote message={error} /> : <Loading />
  const game = detail.runningGame
  if (!game) {
    return (
      <>
        {back}
        <Notice>No game is on. Change the teams on the team board instead.</Notice>
      </>
    )
  }

  const teams: [Team, Team] = [game.team_one, game.team_two]
  const name = (playerId: string) => player(playerId)?.display_name ?? 'Unknown player'
  const minutes = minutesTonight(detail.stints, detail.stintPlayers, new Date())
  const played = (playerId: string) => minutes.get(playerId)?.played ?? 0
  const wasOn = new Map(detail.lineup.map((p) => [p.player_id, p.team]))
  // On the pitch first, then the waiting team and the bench, fewest minutes first.
  const rows = detail.checkIns
    .filter((c) => !c.left_at)
    .sort(
      (a, b) =>
        Number(wasOn.has(b.player_id)) - Number(wasOn.has(a.player_id)) ||
        played(a.player_id) - played(b.player_id) ||
        name(a.player_id).localeCompare(name(b.player_id)),
    )
  const count = (t: Team) => [...picks.values()].filter((p) => p.team === t).length

  function setTeam(playerId: string, team: Team | null) {
    setPicks((prev) => {
      const was = prev.get(playerId)
      return new Map(prev).set(playerId, { team, gk: team !== null && was?.team === team ? was.gk : false })
    })
  }

  // One goalkeeper per team: picking a new one replaces the old one.
  function toggleGk(playerId: string) {
    setPicks((prev) => {
      const me = prev.get(playerId)
      if (!me?.team) return prev
      const next = new Map(prev)
      for (const [pid, p] of next) if (p.team === me.team && p.gk) next.set(pid, { ...p, gk: false })
      next.set(playerId, { ...me, gk: !me.gk })
      return next
    })
  }

  async function save(cont: boolean) {
    if (!cont && !window.confirm('End this game now and start the next one, 0 – 0, with these teams?')) return
    setBusy(cont ? 'continue' : 'end')
    setError(null)
    const lineup: LineupEntry[] = []
    for (const [player_id, p] of picks) if (p.team) lineup.push({ player_id, team: p.team, is_goalkeeper: p.gk })
    try {
      await api.swapPlayers(id, lineup, cont)
      navigate(`/nights/${id}`)
    } catch (e) {
      setError(errorMessage(e))
      setBusy(null)
    }
  }

  return (
    <div>
      {back}
      <PageTitle sub={`Game ${game.ordinal}. Move players between the teams, bring on a sub or change a goalkeeper. Out = the bench.`}>
        Swap players
      </PageTitle>

      <div className="sticky top-[calc(env(safe-area-inset-top)+4rem)] z-10 -mx-4 mb-2 flex items-center justify-between gap-2 bg-ground/95 px-4 py-2 backdrop-blur">
        <span className="flex items-center gap-2 font-display text-lg">
          <TeamTag team={teams[0]} /> {count(teams[0])}
          <TeamTag team={teams[1]} /> {count(teams[1])}
        </span>
        <span className="flex items-center gap-1 text-xs text-muted">
          <GloveIcon size={16} /> = in goal
        </span>
      </div>

      <ul className="divide-y divide-line rounded-card border-[1.5px] border-line bg-paper">
        {rows.map(({ player_id, team: boardTeam }) => {
          const pick = picks.get(player_id)
          const label = name(player_id)
          const from = wasOn.get(player_id)
          const where = from ? `Team ${from}` : boardTeam ? `Team ${boardTeam} · waiting` : 'Bench'
          return (
            <li key={player_id} className="flex items-center gap-2 px-3 py-2">
              <Avatar name={label} url={player(player_id)?.avatar_url} size={32} />
              <div className="min-w-0 flex-1">
                <Name className="block truncate font-medium">{label}</Name>
                <span className="block text-xs text-muted">
                  {where} · {formatMinutes(played(player_id))}
                </span>
              </div>
              <div className="seg" role="group" aria-label={`Team for ${label}`}>
                <button type="button" aria-pressed={!pick?.team} className={!pick?.team ? 'sel-out' : ''} onClick={() => setTeam(player_id, null)}>
                  Out
                </button>
                {teams.map((t) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={pick?.team === t}
                    className={pick?.team === t ? `sel-${t.toLowerCase()}` : ''}
                    onClick={() => setTeam(player_id, t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <button
                type="button"
                disabled={!pick?.team}
                aria-pressed={pick?.gk ?? false}
                aria-label={`${label} in goal`}
                onClick={() => toggleGk(player_id)}
                className={`press flex size-12 items-center justify-center rounded-xl border-2 ${
                  pick?.gk ? 'border-ink bg-ink text-paper' : 'border-line text-muted'
                } disabled:opacity-30`}
              >
                <GloveIcon size={20} />
              </button>
            </li>
          )
        })}
      </ul>

      <ErrorNote message={error} />

      <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-10 mt-4 space-y-2">
        <Button size="lg" className="w-full" busy={busy === 'continue'} disabled={busy !== null} onClick={() => void save(true)}>
          Swap and continue
        </Button>
        <Button variant="secondary" className="w-full" busy={busy === 'end'} disabled={busy !== null} onClick={() => void save(false)}>
          End game and swap
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Goals: admins only, for the game on now or an earlier one**

Replace all of `src/pages/Recorder.tsx` with:

```tsx
import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { BackIcon, BallIcon } from '../components/icons'
import { GoalList, PlayerGrid, Scoreboard } from '../components/match'
import { Button, Card, ErrorNote, Heading, Loading, Name, Notice } from '../components/ui'
import * as api from '../lib/api'
import { errorMessage } from '../lib/format'
import { gameLineup, gameScore } from '../lib/games'
import { useLoad } from '../lib/useLoad'
import { useCurrentGroup } from '../state/group'

/**
 * Fast goal logging (admins): tap the scorer, then the assister (or "No
 * assist"). It goes to the game on now, or to an earlier game picked at the
 * top (?game=<id>) for a goal that was forgotten.
 */
export default function Recorder() {
  const { id = '' } = useParams()
  const { search } = useLocation()
  const { isAdmin, playerName } = useCurrentGroup()
  // Refresh every 10s so two admins can log goals at once.
  const { data, error, loading, reload } = useLoad(() => api.getMatch(id), [id], 10_000)
  const [gameId, setGameId] = useState<string | null>(() => new URLSearchParams(search).get('game'))
  const [scorer, setScorer] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [last, setLast] = useState<{ goalId: string; text: string } | null>(null)

  if (loading && !data) return <Loading />
  if (!data) return <ErrorNote message={error} onRetry={reload} />

  const back = (
    <Link to={`/nights/${id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-muted">
      <BackIcon size={18} /> Night
    </Link>
  )
  if (!isAdmin) {
    return (
      <div className="space-y-4">
        {back}
        <Notice>Only admins log goals. If a goal is wrong, dispute it on the night page.</Notice>
      </div>
    )
  }

  const game = data.games.find((g) => g.id === gameId) ?? data.runningGame ?? data.games.at(-1)
  if (!game) {
    return (
      <div className="space-y-4">
        {back}
        <Notice>No games yet. Start a game on the night page first.</Notice>
      </div>
    )
  }
  const live = game.id === data.runningGame?.id
  // On the pitch now, or (for an earlier game) everyone who played in it.
  const lineup = live ? data.lineup : gameLineup(game.id, data.stints, data.stintPlayers)
  const scorerTeam = lineup.find((p) => p.player_id === scorer)?.team

  async function save(assisterId: string | null) {
    if (!scorer || !game || busy) return
    setBusy(true)
    setSaveError(null)
    try {
      const goalId = await api.logGoal(id, scorer, assisterId, live ? null : game.id)
      const assist = assisterId ? ` (assist ${playerName(assisterId)})` : ''
      setLast({ goalId, text: `Goal for Team ${scorerTeam}: ${playerName(scorer)}${assist}` })
      setScorer(null)
      reload()
    } catch (e) {
      setSaveError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function undo() {
    if (!last) return
    setBusy(true)
    try {
      await api.deleteGoal(last.goalId)
      setLast(null)
      reload()
    } catch (e) {
      setSaveError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      {back}

      <div className="sticky top-[calc(env(safe-area-inset-top)+4rem)] z-10 -mx-4 bg-ground/95 px-4 py-2 backdrop-blur">
        <p className="label mb-1">
          Game {game.ordinal}
          {live ? ' · live' : ''}
        </p>
        <Scoreboard teams={[game.team_one, game.team_two]} score={gameScore(game, data.goals)} />
      </div>

      {data.games.length > 1 && (
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1" role="tablist" aria-label="Game">
          {data.games.map((g) => (
            <button
              key={g.id}
              type="button"
              role="tab"
              aria-selected={g.id === game.id}
              onClick={() => {
                setGameId(g.id)
                setScorer(null)
              }}
              className={`h-10 shrink-0 rounded-full px-4 text-sm font-semibold ${
                g.id === game.id ? 'bg-ink text-paper' : 'border-[1.5px] border-line bg-paper text-muted'
              }`}
            >
              Game {g.ordinal}
              {g.ended_at ? '' : ' · live'}
            </button>
          ))}
        </div>
      )}
      {!live && (
        <Notice>
          Game {game.ordinal} is over: this adds a goal that was forgotten.
          {data.match.status === 'closed' && ' Voting has closed, so the ratings will be recalculated.'}
        </Notice>
      )}

      {last && (
        <div className="flex items-center gap-3 rounded-card bg-ink p-3 text-paper" role="status">
          <BallIcon size={22} className="shrink-0" />
          <p className="flex-1 text-sm font-medium">
            <Name>{last.text}</Name>
          </p>
          <button type="button" onClick={undo} disabled={busy} className="h-10 rounded-lg border-2 border-current px-3 text-sm font-semibold">
            Undo
          </button>
        </div>
      )}
      <ErrorNote message={saveError} />

      {!scorer ? (
        <Card>
          <h1 className="mb-3 font-display text-2xl">Who scored?</h1>
          <PlayerGrid lineup={lineup} onPick={setScorer} />
        </Card>
      ) : (
        <Card>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h1 className="font-display text-2xl">
              Assist for <Name>{playerName(scorer)}</Name>?
            </h1>
            <Button size="sm" variant="ghost" onClick={() => setScorer(null)}>
              Back
            </Button>
          </div>
          <Button size="lg" variant="secondary" className="mb-4 w-full" busy={busy} onClick={() => save(null)}>
            No assist
          </Button>
          {scorerTeam && <PlayerGrid lineup={lineup} only={scorerTeam} exclude={scorer} onPick={(a) => void save(a)} />}
        </Card>
      )}

      <Card>
        <Heading className="mb-1">Goals so far</Heading>
        <GoalList detail={data} onChange={reload} />
      </Card>
    </div>
  )
}
```

- [ ] **Step 4: The Swap route**

In `src/App.tsx`, add `import Swap from './pages/Swap'` (after the `SignIn` import) and the route `<Route path="nights/:id/swap" element={<Swap />} />` after the `nights/:id/teams` route.

- [ ] **Step 5: Check these screens compile**

Run: `npx tsc -b 2>&1 | grep -E "src/(pages/(Teams|Swap|Recorder)|App)\.tsx"`
Expected: no lines.

---

### Task 8: The night page: control room, live view, and games after the night

**Files:**
- Modify: `src/pages/NightPage.tsx` (rewrite)
- Modify: `src/pages/Vote.tsx:53` and `:63` (team chips from the team board)
- Modify: `src/components/results.tsx` (imports, the "Forgot a goal?" link, `Breakdown` rows)

**Interfaces:**
- Consumes: Task 6 components; `api.getLeaderboard` (now with `minutes_in_goal`).
- Produces: the night page as described in `Plans/Football-scenario.md` section 7 (live admin, live others, voting/closed).

- [ ] **Step 1: Rewrite the night page**

Replace all of `src/pages/NightPage.tsx` with:

```tsx
import { useState } from 'react'
import { useParams } from 'react-router'
import { PlayingTime, WaitingAndBench } from '../components/bench'
import { CancelledNotice, CancelNightForm } from '../components/cancel'
import { CheckInList, WhoIsHere } from '../components/checkin'
import { GameCard, GamesList } from '../components/games'
import { GoalList } from '../components/match'
import { MoneyCard } from '../components/money'
import { NextGameCard } from '../components/nextgame'
import { Results, VotingCard } from '../components/results'
import { RsvpCard, RsvpLists } from '../components/rsvp'
import { Button, Card, ErrorNote, Heading, LinkButton, Loading, ShareButton, StatusChip } from '../components/ui'
import * as api from '../lib/api'
import { errorMessage, formatNightWhen, nightFacts } from '../lib/format'
import { plannedNightText } from '../lib/share'
import type { LeaderboardRow, Payer } from '../lib/types'
import { useLoad } from '../lib/useLoad'
import { useCurrentGroup } from '../state/group'

/**
 * One page for a night in every state: planned, live, voting, final or
 * cancelled. While it's live, admins get the control room (the game card,
 * the next game, the bench, the team board and check-in) on one scrolling
 * screen; everyone else sees the score, the clock and who's on.
 */
export default function NightPage() {
  const { id = '' } = useParams()
  const { group, myPlayerId, isAdmin, refresh } = useCurrentGroup()
  const [pollMs, setPollMs] = useState<number | undefined>(10_000)
  const [cancelling, setCancelling] = useState(false)
  const [fixingCheckIns, setFixingCheckIns] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const { data, error, loading, reload } = useLoad(
    async () => {
      const detail = await api.getMatch(id)
      const s = detail.match.status
      const [voteStatus, payers, season] = await Promise.all([
        s === 'voting' ? api.getVoteStatus(id) : Promise.resolve([]),
        s === 'voting' || s === 'closed' || s === 'cancelled' ? api.getNightMoney(id) : Promise.resolve<Payer[]>([]),
        // Minutes in goal this season, for the goalkeeper suggestion.
        s === 'playing' && isAdmin
          ? api.getLeaderboard(group.id, new Date().getFullYear())
          : Promise.resolve<LeaderboardRow[]>([]),
      ])
      // A live night refreshes every 10 seconds; a final one doesn't need to.
      setPollMs(s === 'playing' ? 10_000 : s === 'closed' || s === 'cancelled' ? undefined : 20_000)
      return { detail, voteStatus, payers, seasonInGoal: new Map(season.map((r) => [r.player_id, r.minutes_in_goal])) }
    },
    [id, isAdmin, group.id],
    pollMs,
  )

  if (loading && !data) return <Loading />
  if (!data) return <ErrorNote message={error} onRetry={reload} />

  const { detail, voteStatus, payers, seasonInGoal } = data
  const { match, playerIds } = detail
  const status = match.status
  const hasGames = status === 'playing' || status === 'voting' || status === 'closed'

  function changed() {
    reload()
    void refresh()
  }

  async function act(name: string, action: () => Promise<unknown>, confirmText: string) {
    if (!window.confirm(confirmText)) return
    setBusy(name)
    setActionError(null)
    try {
      await action()
      changed()
    } catch (e) {
      setActionError(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-4">
      <header>
        <div className="flex items-center justify-between gap-2">
          <p className="label">{formatNightWhen(match)}</p>
          <StatusChip status={status} />
        </div>
        <h1 className="mt-1.5 font-display text-[28px] leading-tight" dir="auto">
          {match.location || 'Pitch to be confirmed'}
        </h1>
        <p className="text-[13px] text-muted">{nightFacts(match)}</p>
      </header>

      <ErrorNote message={actionError ?? error} />

      {status === 'draft' && (
        <>
          <RsvpCard match={match} rsvps={detail.rsvps} onChange={reload} showNight={false} />
          <RsvpLists rsvps={detail.rsvps} />
          <ShareButton text={plannedNightText(match, detail.rsvps.filter((r) => r.status === 'in').length)} />
          {isAdmin && !cancelling && (
            <Card>
              <Heading className="mb-2">Admin</Heading>
              <Button
                size="lg"
                className="w-full"
                busy={busy === 'start'}
                onClick={() => void act('start', () => api.startNight(id), 'Start the night? Replies close and check-in opens.')}
              >
                Start night
              </Button>
              <LinkButton to={`/nights/${id}/edit`} variant="secondary" className="mt-2 w-full">
                Edit night
              </LinkButton>
              <Button variant="danger" className="mt-2 w-full" onClick={() => setCancelling(true)}>
                Cancel night
              </Button>
            </Card>
          )}
        </>
      )}

      {status === 'playing' && (
        <>
          {detail.runningGame ? (
            <GameCard key={detail.runningGame.id} detail={detail} onChange={reload} />
          ) : isAdmin ? (
            <NextGameCard key={detail.games.length} detail={detail} seasonInGoal={seasonInGoal} onChange={reload} />
          ) : (
            <Card strong>
              <Heading>Between games</Heading>
              <p className="mt-1 font-display text-[22px] leading-tight">Game {detail.games.length + 1} starts soon</p>
            </Card>
          )}
          <WaitingAndBench detail={detail} />
          {isAdmin && (
            <div className="flex gap-2">
              <LinkButton to={`/nights/${id}/teams`} variant="secondary" className="flex-1">
                Team board
              </LinkButton>
              <Button
                variant="dark"
                className="flex-1"
                busy={busy === 'end'}
                onClick={() =>
                  void act(
                    'end',
                    () => api.endNight(id),
                    'End the night? A game still on ends now. Voting opens for everyone checked in, and the money card appears.',
                  )
                }
              >
                End night
              </Button>
            </div>
          )}
        </>
      )}

      {status === 'cancelled' && <CancelledNotice match={match} />}
      {status === 'voting' && (
        <VotingCard match={match} voteStatus={voteStatus} iPlayed={playerIds.includes(myPlayerId)} onChange={changed} />
      )}
      {status === 'closed' && <Results detail={detail} />}
      <MoneyCard match={match} payers={payers} onChange={reload} />

      {hasGames && (
        <>
          <GamesList detail={detail} />
          <PlayingTime detail={detail} />
          <Card>
            <Heading className="mb-1">Goals</Heading>
            <GoalList detail={detail} onChange={reload} />
          </Card>
        </>
      )}

      {status === 'playing' && (isAdmin ? <CheckInList detail={detail} onChange={changed} /> : <WhoIsHere detail={detail} />)}

      {isAdmin &&
        status === 'voting' &&
        (fixingCheckIns ? (
          <CheckInList detail={detail} onChange={changed} />
        ) : (
          <Button variant="secondary" className="w-full" onClick={() => setFixingCheckIns(true)}>
            Fix check-ins
          </Button>
        ))}
      {isAdmin && status === 'playing' && !cancelling && (
        <Button variant="danger" className="w-full" onClick={() => setCancelling(true)}>
          Cancel night
        </Button>
      )}
      {cancelling && (
        <CancelNightForm
          match={match}
          onClose={() => setCancelling(false)}
          onDone={() => {
            setCancelling(false)
            changed()
          }}
        />
      )}
      {isAdmin && (status === 'voting' || status === 'closed' || status === 'cancelled') && (
        <LinkButton to={`/nights/${id}/edit`} variant="secondary" className="w-full">
          Edit night
        </LinkButton>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Vote: team chips from the team board**

In `src/pages/Vote.tsx`, change line 53 to `  const { match, checkIns, playerIds, votes, mvpVotes } = detail` and line 63 to:

```tsx
  // The team each player ended the night on (the team board).
  const teamOf = (pid: string) => checkIns.find((c) => c.player_id === pid)?.team ?? undefined
```

- [ ] **Step 3: Results: the per-night breakdown, and admin-only goal fixes**

In `src/components/results.tsx`:

1. Change the format import to `import { errorMessage, formatMinutes, formatPoints, isPast, timeLeft } from '../lib/format'`.
2. In `VotingCard`, change `{(iPlayed || isAdmin) && (` (just above the "Forgot a goal? Log it" link) to `{isAdmin && (`.
3. In `Breakdown`, replace the `rows` array with:

```tsx
  const rows: [string, number][] = [
    ['Base for playing', b.base],
    [`Goals (${rating.goals})`, b.goals],
    [`Assists (${rating.assists})`, b.assists],
    [`Team impact (goal difference on the pitch, added up: ${formatPoints(b.net_goal_diff)})`, b.net_goals],
    [b.minutes != null ? `Result (average over ${formatMinutes(b.minutes)} played)` : 'Result', b.result],
  ]
```

- [ ] **Step 4: Check the night screens compile**

Run: `npx tsc -b 2>&1 | grep -E "src/(pages/(NightPage|Vote)|components/results)\.tsx"`
Expected: no lines.

---

### Task 9: Home, the Nights list, profiles and How it works

**Files:**
- Modify: `src/pages/Home.tsx` (imports, the last-night card, `LiveNight`)
- Modify: `src/pages/Nights.tsx` (imports, the score on each row)
- Modify: `src/pages/PlayerProfile.tsx` (imports, "Happy to play in goal", minutes in `StatsCard`)
- Modify: `src/pages/HowItWorks.tsx` (a Games card; the rating rows)

**Interfaces:**
- Consumes: `MatchSummary.games`, `gameScore`, `LeaderboardRow.avg_minutes/minutes_in_goal`, `Player.happy_in_goal`, `api.setHappyInGoal`.

- [ ] **Step 1: Home**

In `src/pages/Home.tsx`:

1. Change `import { formatDay, scoreOf, timeLeft } from '../lib/format'` to `import { formatDay, timeLeft } from '../lib/format'` and add `import { gameScore } from '../lib/games'` below it.
2. In the "Last night" card, replace

```tsx
            <div className="my-3">
              <Scoreboard score={scoreOf(last.goals)} />
            </div>
```

with

```tsx
            <p className="my-2 font-display text-[22px] leading-tight">
              {last.games.length} game{last.games.length === 1 ? '' : 's'}
            </p>
```

3. Replace the whole `LiveNight` function with:

```tsx
/** Tonight: the game being played (score) or "between games". */
function LiveNight({ night }: { night: MatchSummary }) {
  const game = night.games.find((g) => g.ended_at === null)
  return (
    <Card strong>
      <div className="flex items-center justify-between gap-2">
        <span className="label">
          Tonight{night.location && <> · <Name>{night.location}</Name></>}
        </span>
        <StatusChip status="playing" />
      </div>
      <div className="my-3">
        {game ? (
          <>
            <p className="label mb-1">Game {game.ordinal}</p>
            <Scoreboard teams={[game.team_one, game.team_two]} score={gameScore(game, night.goals)} />
          </>
        ) : (
          <p className="font-display text-[22px] leading-tight">
            {night.games.length === 0 ? 'Getting ready' : `Between games · ${night.games.length} played`}
          </p>
        )}
      </div>
      <LinkButton to={`/nights/${night.id}`} className="w-full">
        Open night
      </LinkButton>
    </Card>
  )
}
```

- [ ] **Step 2: The Nights list**

In `src/pages/Nights.tsx`:

1. Change the format import to `import { CANCEL_REASONS, clockOf, formatDay, parseDay } from '../lib/format'`.
2. In the row, replace `const score = scoreOf(m.goals)` and `const showScore = ...` with `const showGames = m.status === 'playing' || m.status === 'voting' || m.status === 'closed'`, and replace the `{showScore && ( ... )}` block with:

```tsx
                    {showGames && (
                      <span className="text-sm whitespace-nowrap text-muted">
                        {m.games.length} game{m.games.length === 1 ? '' : 's'}
                      </span>
                    )}
```

- [ ] **Step 3: Profiles: "Happy to play in goal" and minutes**

In `src/pages/PlayerProfile.tsx`:

1. Change the icons import to `import { ChevronIcon, GloveIcon, StarIcon } from '../components/icons'` and the format import to `import { errorMessage, formatDay, formatMinutes } from '../lib/format'`.
2. After the line `{(isMe || isAdmin) && <RenameForm key={id} playerId={id} current={p.display_name} />}`, add:

```tsx
      <HappyInGoal playerId={id} happy={p.happy_in_goal} canChange={isMe || isAdmin} />
```

3. In `StatsCard`, after the closing `</dl>`, add:

```tsx
      {row && (
        <p className="mt-2 text-center text-sm text-muted">
          {formatMinutes(row.avg_minutes)} a night on average
          {row.minutes_in_goal > 0 && <> · {formatMinutes(row.minutes_in_goal)} in goal</>}
        </p>
      )}
```

4. Add at the end of the file:

```tsx
/** Players happy to play in goal are suggested first when a game needs a keeper. */
function HappyInGoal({ playerId, happy, canChange }: { playerId: string; happy: boolean; canChange: boolean }) {
  const { refresh } = useCurrentGroup()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!canChange) {
    return happy ? (
      <p className="flex items-center gap-1.5 text-sm">
        <GloveIcon size={18} /> Happy to play in goal
      </p>
    ) : null
  }

  async function toggle() {
    setBusy(true)
    setError(null)
    try {
      await api.setHappyInGoal(playerId, !happy)
      await refresh()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <button
        type="button"
        role="switch"
        aria-checked={happy}
        disabled={busy}
        onClick={() => void toggle()}
        className="flex min-h-14 w-full items-center gap-3 rounded-card border-[1.5px] border-line bg-paper px-4 py-2 text-left"
      >
        <GloveIcon size={22} className="shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Happy to play in goal</span>
          <span className="block text-xs text-muted">Suggested first when a game needs a goalkeeper.</span>
        </span>
        <span aria-hidden className={`h-7 w-12 shrink-0 rounded-full border-2 border-ink p-0.5 ${happy ? 'bg-brand' : 'bg-line'}`}>
          <span className={`block size-5 rounded-full ${happy ? 'translate-x-5 bg-[#0b0b0b]' : 'bg-ink'}`} />
        </span>
      </button>
      <ErrorNote message={error} />
    </div>
  )
}
```

- [ ] **Step 4: How it works**

In `src/pages/HowItWorks.tsx`:

1. Change the page subtitle to `sub="Nights, games, money and ratings, in plain words."`.
2. In `NightsExplainer`, add this card right after the "A night" card:

```tsx
      <Card>
        <Heading className="mb-2">Games</Heading>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>
            A night has many short games, usually 10 minutes each. The timer buzzes when time is up, but an admin ends each
            game with <strong>Game over</strong>.
          </li>
          <li>
            Teams wear bibs: A white, B orange, C blue. With three teams, the <strong>winner stays on</strong> and the
            waiting team comes on. With two, they play again.
          </li>
          <li>
            A draw with a team waiting: <strong>penalties</strong> decide who stays on. For ratings it's still a draw, and
            penalty goals don't count.
          </li>
          <li>
            To balance the teams an admin can <strong>swap players</strong>: "Swap and continue" keeps the score, "End game
            and swap" starts a new game at 0–0.
          </li>
          <li>
            The app suggests who goes in goal (players happy in goal first, then whoever has had the fewest minutes in goal)
            and which sub comes on (the one who has played least).
          </li>
          <li>
            Only admins record goals. If one is wrong, tap <strong>Dispute</strong>: it doesn't count until an admin fixes it.
          </li>
        </ul>
      </Card>
```

3. In `RatingExplainer`, replace the last three entries of `rows` (team impact, result and clean sheet) with:

```tsx
    [
      'Team impact: per goal of difference while you were on the pitch, added up over the night',
      `${pts(p.net_goal)} (between ${pts(p.net_goal_min)} and ${pts(p.net_goal_max)})`,
    ],
    [
      "Result: your team's result in each game you played, averaged over your minutes",
      `win ${pts(p.win)} · draw ${pts(p.draw)} · loss ${pts(p.loss)}`,
    ],
    [
      `Goalkeeper clean sheet (in goal for a whole game of at least ${p.clean_sheet_min_minutes ?? 8} minutes, nothing conceded)`,
      `${pts(p.clean_sheet)} (max ${pts(p.clean_sheet_cap)})`,
    ],
```

(`pct` is still used by the "Your rating for a night" card, so it stays.)

- [ ] **Step 5: All four checks**

Run: `npx tsc -b && npm run lint && npm test && npm run build`
Expected: all pass. If `tsc` reports leftovers, search for them: `grep -rnE "scoreOf|saveLineup|clean_sheet_min_share|\bBib\b" src` must print nothing.

---

## Part D — Docs, checks and hand-over

### Task 10: README

**Files:**
- Modify: `README.md` (sections 1, 2 Step 3, 6, 7, 8 and 10)

- [ ] **Step 1: What's built**

In section 1:

1. Change `**Phase 1** (\`Plans/football-idea.md\`) and **stage 1 of the 7GZ-KORA upgrade** (\`Plans/README.md\`):` to `**Phase 1** (\`Plans/football-idea.md\`) and **stages 1 and 2 of the 7GZ-KORA upgrade** (\`Plans/README.md\`):`.
2. Replace the bullet that starts `- **At the pitch:**` with:

```markdown
- **At the pitch:** the admin starts the night and checks people in (anyone in the group; the arrival time is saved; tap again when someone leaves early), then puts everyone on the **team board**: Team A, B or C (white, orange and blue bibs) or the bench.
- **Games:** many short games in a night, each with a timer (10 minutes by default) that buzzes but never ends the game. The app suggests the next game (the winner stays on, the waiting team comes on) and a goalkeeper for each team (whoever is happy in goal, then whoever has had the fewest minutes in goal). **Swap and continue** keeps the score; **End game and swap** starts a new game at 0–0. A draw with a team waiting asks who won on penalties, which is still a draw for ratings. The bench shows everyone's minutes and suggests who comes on next.
- **Only admins log goals**; players can dispute a goal. An admin can add a forgotten goal to any game of the night.
- **One rating per night** from all its games (see section 6).
```

3. Replace the `**Coming next**` paragraph with:

```markdown
**Coming next** (`Plans/README.md`): the team suggester, punishments and loyalty points, Team of the Night and best duos.
```

- [ ] **Step 2: Setting up the database**

In section 2, Step 3:

1. Change item 3 to: `3. Do the same with \`20261023000200_rating.sql\`, then \`20261023000300_actions.sql\`, then \`20261024000100_nights.sql\`, then \`20261025000100_games.sql\`. **Order matters.**`
2. After item 4 (the optional seed), add:

```markdown
> **Already ran the first four files?** Then run only `20261025000100_games.sql`, once, at a time when no night is in progress. Each of your existing nights becomes one game, and their ratings stay as they are. Do it before the new version of the app goes live on Vercel (or right when it does): the new app needs it.
```

- [ ] **Step 3: How ratings work**

In section 6:

1. Replace the paragraph that starts `**Stats score:**` with:

```markdown
**Stats score**, worked out over all the night's games: start at 5.0, then add +1.0 per goal (max +3.5) and +0.7 per assist (max +2.0). **Team impact:** +0.25 for each goal of difference while you were on the pitch, added up over the night (between −1.5 and +1.5). **Result:** your team's result in each game you played (+0.5 win, 0 draw, −0.5 loss), averaged over your minutes on the pitch. **Clean sheet:** +0.5 for each whole game in goal of at least 8 minutes without conceding (max +1.0). A draw decided on penalties is still a draw. The total stays between 1.0 and 10.0.
```

2. In the `**Season rating**` paragraph, change `the average of your match ratings` to `the average of your night ratings` and `after 3 rated matches` to `after 3 rated nights`.
3. Change `the database function \`compute_match_ratings\` in \`supabase/migrations/20261023000200_rating.sql\`.` to `the database function \`compute_match_ratings\`, now in \`supabase/migrations/20261025000100_games.sql\` (it replaced the first version in file 2).`
4. In the `points` holds line, change `` `clean_sheet_min_share` 0.25 `` to `` `clean_sheet_min_minutes` 8 ``.
5. Delete the line `Stage 2 changes how team impact and result are counted across the many games of a night (see \`Plans/Football-scenario.md\` section 3).`

- [ ] **Step 4: Choices made for you**

In section 7:

1. Replace item 4 (`**Players can still log goals while voting is open**...`) with: `4. **Only admins log goals** (since stage 2). Players dispute a wrong goal. An admin can add a forgotten goal to any game of the night, even after voting closes; the ratings then recalculate.`
2. Replace item 10 with: `10. **Teams and games are locked once the night ends.** An admin can still fix goals.`
3. Replace item 11 with: `11. **Teams wear bib colours:** A white, B orange, C blue.`
4. Append after item 19:

```markdown
20. **Goalkeepers are picked for each game**, not kept on the team board: the app suggests a new keeper every game.
21. **"End game and swap" starts the next game straight away**, between the same two teams with the new players.
22. **After a draw with no penalty winner** while a team is waiting, the suggested next game sends off the team that was already on.
23. **While a game is on, players on the pitch can only be moved with Swap.** The team board still changes the waiting team and the bench.
24. **Someone on the pitch must be swapped off before you tap "Left"**; leaving puts them on the bench.
25. **The timer buzzes once** (a vibration, and a beep where the phone allows) when the game reaches its length, and turns red. It never ends the game.
26. **Penalties can only be entered after a draw**, and the app asks only when another team is waiting.
27. **Nights from before games** became one game each, lasting the whole booking. Their stored ratings didn't change.
28. **"Fewest minutes in goal this season"** counts nights whose voting has closed.
29. **Profiles show** your average minutes on the pitch per night and your minutes in goal.
30. **Home and the Nights list show how many games** a night had, instead of one score.
31. **The "extra team from N players" setting** comes with the team suggester in stage 3, where it's used.
```

- [ ] **Step 5: Demo data, tests, layout and troubleshooting**

In section 8:

1. Replace the demo data paragraph (it starts `` `supabase/seed.sql` creates a group called **Demo FC** ``) with:

```markdown
`supabase/seed.sql` creates a group called **Demo FC** with 15 fake players (one with an Arabic name) and nights with several games each: 4 finished nights (one from last year; last week's has three teams, a draw won on penalties, a mid-game swap and a late arrival), a night cancelled for rain, yesterday's night with voting open (with an "End game and swap") and 3 people paid back, and a planned night in 3 days with a 10-player limit (10 in, 1 waiting, 1 out), so you can see the waiting list. Ahmed collects the money; Ali and Mahmoud are happy in goal. Run it in the SQL Editor after the **five** migration files, then join in the app with the code **`DEMO-KICK`**. As the first person to join, you become its admin.
```

2. In the Tests list: run `npm test`, change `This runs 69 tests.` to the number it prints, and replace the `rating.test.ts` bullet with these three bullets:

```markdown
- `tests/db/rating.test.ts`: the two worked examples from the brief (Player A 8.3, Player B 5.6), the five night examples from `Plans/Football-scenario.md` (winner stays on, swap and continue, a late arrival, clean sheets, penalties), "End game and swap", a night with no goals, a player who never got on the pitch, a goalkeeper swapped mid-game, the team-impact fix, and the caps, saves, disputed goals, Man of the Match ties and custom weights
- `tests/db/games.test.ts`: the team board, starting games with goalkeepers, admin-only goals, Game over and penalties, both kinds of swap, subs, adding a forgotten goal, and security
- `tests/db/migrate.test.ts`: nights from before games moving over, exactly as on the live project
```

and change the `src/lib/*.test.ts` bullet's end from `the WhatsApp texts and formatting` to `the WhatsApp texts, formatting, and the game helpers (next game, minutes, goalkeeper and sub suggestions, the clock)`.
3. In the project layout block, change the first line to `supabase/migrations/   The database: tables + security (1), ratings (2), app actions (3), nights (4), games + night ratings (5)`.

In section 10 (Troubleshooting):

1. Change `One of the four SQL files wasn't run` to `One of the five SQL files wasn't run`.
2. Add this row after it:

```markdown
| "function public.start_game ... does not exist", or the team board and Swap don't work | `20261025000100_games.sql` hasn't been run yet. Run it in the SQL Editor (section 2, Step 3). |
```

---

### Task 11: Verify everything and hand over

**Files:**
- Temporary only, in the session's scratch folder (`$SCRATCH` below): `standin/` and `shots/`. Nothing here is added to the project.

- [ ] **Step 1: The four checks**

Run: `npx tsc -b && npm run lint && npm test && npm run build`
Expected: all pass. Note the number of tests for the report (and check the README says the same number).

- [ ] **Step 2: Rule greps**

```bash
grep -rnE "\b(text-white|bg-white)\b" src                                   # only SignIn and InstallScreen (logo lettering)
grep -rnE "scoreOf|saveLineup|save_lineup|clean_sheet_min_share|\bBib\b" src tests supabase/seed.sql
git diff --stat -- supabase/migrations/2026102300* supabase/migrations/20261024000100_nights.sql
```

Expected: the first lists only the two `<h1>`s; the second prints nothing; the third prints nothing (files 1-4 untouched).

- [ ] **Step 3: Start a temporary stand-in for Supabase**

```bash
mkdir -p "$SCRATCH/standin" "$SCRATCH/shots" && cd "$SCRATCH/standin"
npm init -y && npm i @electric-sql/pglite@0.5 @electric-sql/pglite-socket playwright-core
gh release download v14.18 -R PostgREST/postgrest -p "*windows*" && unzip -o postgrest-*.zip
```

(If `pglite-socket`'s peer version doesn't match pglite 0.5, install the pglite version it asks for. On Windows, PostgREST 16 fails to start; use 14.18.)

`session.mjs`:

```js
// Signed-in sessions for the stand-in: HS256 tokens signed with PostgREST's secret.
import { createHmac } from 'node:crypto'

export const SECRET = 'local-stand-in-secret-at-least-32-characters'
export const OWNER = '11111111-1111-1111-1111-111111111111'
export const MEMBER = '22222222-2222-2222-2222-222222222222'
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')

export function user(id = OWNER) {
  const email = id === OWNER ? 'owner@example.com' : 'member@example.com'
  return {
    id, aud: 'authenticated', role: 'authenticated', email,
    user_metadata: { full_name: id === OWNER ? 'Owner' : 'Member' }, app_metadata: { provider: 'google' },
  }
}

export function jwt(id = OWNER) {
  const head = b64({ alg: 'HS256', typ: 'JWT' })
  const body = b64({ sub: id, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 30 * 86400 })
  return `${head}.${body}.${createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url')}`
}

export function session(id = OWNER) {
  const expires_in = 30 * 86400
  return {
    access_token: jwt(id), refresh_token: 'stand-in', token_type: 'bearer', expires_in,
    expires_at: Math.floor(Date.now() / 1000) + expires_in, user: user(id),
  }
}
```

`db.mjs` (argument: the project folder):

```js
// PGlite with the real migrations and seed, served like Postgres on 127.0.0.1:54329.
import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { MEMBER, OWNER } from './session.mjs'

const project = process.argv[2]
const db = await PGlite.create()
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create role authenticator login noinherit; grant anon, authenticated, service_role to authenticator;
  create schema auth; grant usage on schema auth, public to anon, authenticated, service_role;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb not null default '{}');
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claims', true)::json ->> 'sub', '')::uuid $$;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`)
const dir = join(project, 'supabase', 'migrations')
for (const f of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) await db.exec(readFileSync(join(dir, f), 'utf8'))
await db.exec(readFileSync(join(project, 'supabase', 'seed.sql'), 'utf8'))

// The owner joins Demo FC first (becoming admin) and is checked in to yesterday's
// night, so "You owe" shows. A second user joins as a member, for the live view.
await db.exec(`
  insert into auth.users (id, email, raw_user_meta_data) values
    ('${OWNER}', 'owner@example.com', '{"full_name":"Owner"}'),
    ('${MEMBER}', 'member@example.com', '{"full_name":"Member"}');
  set request.jwt.claims = '{"sub":"${OWNER}"}'; set role authenticated;
  select public.join_group('DEMO-KICK', 'Owner');
  select public.check_in(m.id, public.my_player_id(m.group_id)) from public.matches m where m.status = 'voting';
  reset role;
  set request.jwt.claims = '{"sub":"${MEMBER}"}'; set role authenticated;
  select public.join_group('DEMO-KICK', 'Member');
  reset role;
`)
const server = new PGLiteSocketServer({ db, port: 54329, host: '127.0.0.1' })
await server.start()
console.log('stand-in database on 127.0.0.1:54329')
```

`postgrest.conf`:

```
db-uri = "postgres://postgres@127.0.0.1:54329/postgres?sslmode=disable&gssencmode=disable"
db-schemas = "public"
db-anon-role = "anon"
db-pool = 1
db-channel-enabled = false
db-prepared-statements = false
jwt-secret = "local-stand-in-secret-at-least-32-characters"
server-port = 54330
```

`proxy.mjs`:

```js
// http://localhost:54321: /rest/v1/* goes to PostgREST, /auth/v1/* answers with the signed-in user.
import http from 'node:http'
import { session, user } from './session.mjs'

const cors = {
  'access-control-allow-origin': '*', 'access-control-allow-headers': '*',
  'access-control-allow-methods': '*', 'access-control-expose-headers': '*',
}
// The app stores whose session it is; the token's sub tells us which user to answer with.
const subOf = (req) => {
  const token = (req.headers.authorization ?? '').split(' ')[1] ?? ''
  try { return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).sub } catch { return undefined }
}
http.createServer((req, res) => {
  if (req.method === 'OPTIONS') return res.writeHead(204, cors).end()
  if (req.url.startsWith('/auth/v1/')) {
    res.writeHead(200, { ...cors, 'content-type': 'application/json' })
    const id = subOf(req)
    return res.end(JSON.stringify(req.url.startsWith('/auth/v1/user') ? user(id) : session(id)))
  }
  if (req.url.startsWith('/rest/v1/')) {
    const upstream = http.request(
      { host: '127.0.0.1', port: 54330, path: req.url.slice('/rest/v1'.length), method: req.method, headers: { ...req.headers, host: '127.0.0.1:54330' } },
      (up) => { res.writeHead(up.statusCode, { ...up.headers, ...cors }); up.pipe(res) },
    )
    upstream.on('error', () => { if (!res.headersSent) res.writeHead(502, cors); res.end() })
    return void req.pipe(upstream)
  }
  res.writeHead(404, cors).end()
}).listen(54321, () => console.log('stand-in API on http://localhost:54321'))
```

`live.mjs` (turns the demo's planned night into a live one, as the owner):

```js
// Starts the planned demo night: 14 checked in, A/B/C plus the bench, game 1
// (A 1-0 B) over, game 2 (A v C, 0-0) on. Prints the night's id.
import { jwt } from './session.mjs'

const base = 'http://localhost:54321/rest/v1'
const headers = { apikey: 'stand-in', Authorization: `Bearer ${jwt()}`, 'content-type': 'application/json' }
const get = async (path) => (await fetch(`${base}/${path}`, { headers })).json()
async function rpc(fn, args) {
  const res = await fetch(`${base}/rpc/${fn}`, { method: 'POST', headers, body: JSON.stringify(args) })
  const text = await res.text()
  if (!res.ok) throw new Error(`${fn}: ${text}`)
  return text ? JSON.parse(text) : null
}

const [night] = await get('matches?status=eq.draft&select=id')
const players = await get('players?select=id,display_name')
const id = Object.fromEntries(players.map((p) => [p.display_name, p.id]))
const here = ['Youssef', 'Omar', 'Ahmed', 'Karim', 'Mostafa', 'Ziad', 'Hassan', 'Tarek', 'محمد', 'Ali', 'Seif', 'Mahmoud', 'Khaled', 'Owner']
const teams = { A: here.slice(0, 5), B: here.slice(5, 10), C: here.slice(10, 13) } // Owner stays on the bench

await rpc('start_night', { p_match_id: night.id })
for (const name of here) await rpc('check_in', { p_match_id: night.id, p_player_id: id[name] })
await rpc('set_team_board', {
  p_match_id: night.id,
  p_board: Object.entries(teams).flatMap(([team, names]) => names.map((n) => ({ player_id: id[n], team }))),
})
await rpc('start_game', { p_match_id: night.id, p_team_one: 'A', p_team_two: 'B', p_keeper_one: id.Mostafa, p_keeper_two: id.Ali })
await rpc('log_goal', { p_match_id: night.id, p_scorer_id: id.Youssef, p_assister_id: id.Omar })
await rpc('end_game', { p_match_id: night.id, p_penalty_winner: null })
await rpc('start_game', { p_match_id: night.id, p_team_one: 'A', p_team_two: 'C', p_keeper_one: id.Mostafa, p_keeper_two: id.Mahmoud })
console.log('live night', night.id)
```

`shots.mjs` (arguments: base URL, output folder, then paths; optional env: `SIGNED_OUT=1`, `UA=...`, `AS=member`, `CLICK=<button text>`):

```js
// Screenshots at phone width (390 px), light and dark. Uses the installed Edge.
import { chromium } from 'playwright-core'
import { MEMBER, OWNER, session } from './session.mjs'

const [base, out, ...paths] = process.argv.slice(2)
const who = process.env.AS === 'member' ? MEMBER : OWNER
const browser = await chromium.launch({ channel: 'msedge' })
for (const colorScheme of ['light', 'dark']) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme,
    ...(process.env.UA ? { userAgent: process.env.UA, hasTouch: true, isMobile: true } : {}),
  })
  if (!process.env.SIGNED_OUT) {
    await context.addInitScript((s) => localStorage.setItem('sb-localhost-auth-token', JSON.stringify(s)), session(who))
  }
  const page = await context.newPage()
  for (const path of paths) {
    await page.goto(base + path)
    await page.waitForTimeout(1500)
    if (process.env.CLICK) {
      await page.getByRole('button', { name: process.env.CLICK }).first().click()
      await page.waitForTimeout(500)
    }
    const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    console.log(colorScheme, path, wide ? 'SCROLLS SIDEWAYS' : 'fits')
    const name = `${process.env.AS ?? 'admin'}${process.env.CLICK ? '-click' : ''}${path.replace(/[^a-z0-9]+/gi, '_')}`
    await page.screenshot({ path: `${out}/${colorScheme}-${name}.png`, fullPage: true })
  }
  await context.close()
}
await browser.close()
```

Start everything (each in the background), from the project folder for Vite:

```bash
node "$SCRATCH/standin/db.mjs" "$PWD"
"$SCRATCH/standin/postgrest.exe" "$SCRATCH/standin/postgrest.conf"
node "$SCRATCH/standin/proxy.mjs"
VITE_SUPABASE_URL=http://localhost:54321 VITE_SUPABASE_PUBLISHABLE_KEY=stand-in VITE_ALLOW_BROWSER=true npx vite --port 5173 --strictPort
```

Then: `node "$SCRATCH/standin/live.mjs"` → prints the live night's id.

- [ ] **Step 4: Check every PostgREST embed (no `PGRST201`)**

```bash
cd "$SCRATCH/standin"
TOKEN=$(node -e "import('./session.mjs').then((m) => console.log(m.jwt()))")
for q in \
  "matches?select=*,games!games_match_id_fkey(*),goals(game_id,scoring_team,disputed),match_ratings(player_id,rating,is_mvp),match_players!match_players_match_id_fkey(player_id),rsvps(player_id,status,status_changed_at,waiting_since,promoted_at)" \
  "players?select=id,group_id,user_id,display_name,is_guest,happy_in_goal,profiles!players_user_id_fkey(avatar_url)" \
  "group_members?select=role,player_id,groups(id,name,invite_code)" \
  "match_ratings?select=*,matches!inner(*)" \
  "games?select=*" \
  "stints?select=id,game_id,ordinal,started_at,ended_at" \
  "match_players?select=player_id,arrived_at,left_at,team"; do
  curl -s -o /dev/null -w "%{http_code} $q\n" "http://localhost:54321/rest/v1/$q" -H "apikey: stand-in" -H "Authorization: Bearer $TOKEN"
done
curl -s -o /dev/null -w "%{http_code} rpc/get_leaderboard\n" -X POST "http://localhost:54321/rest/v1/rpc/get_leaderboard" \
  -H "apikey: stand-in" -H "Authorization: Bearer $TOKEN" -H "content-type: application/json" -d '{"p_group_id": null}'
```

Expected: `200` on every line. On any other code, print the body; `PGRST201` means an ambiguous embed that needs a `!fkey_name` hint.

- [ ] **Step 5: Screens against the design**

Get the ids: `curl -s "http://localhost:54321/rest/v1/matches?select=id,status,played_at" -H "apikey: stand-in" -H "Authorization: Bearer $TOKEN"` (last week's night is the newest `closed` one) and Ali's player id from `players?select=id,display_name`. Then:

```bash
cd "$SCRATCH/standin"
export MSYS_NO_PATHCONV=1
S="$SCRATCH/shots"; L=<live night id>
node shots.mjs http://localhost:5173 "$S" /nights/$L /nights/$L/teams /nights/$L/swap /nights/$L/record "/nights/$L/swap?in=<Owner's id>&out=<Youssef's id>"
CLICK="Game over" node shots.mjs http://localhost:5173 "$S" /nights/$L           # the penalty question (0-0, Team B waiting)
AS=member node shots.mjs http://localhost:5173 "$S" /nights/$L /nights/$L/record  # the live view, and "only admins log goals"
node shots.mjs http://localhost:5173 "$S" / /nights /nights/<last week> /nights/<yesterday> /players/<Ali's id> /how-it-works /table
```

Open each PNG and compare with the "Live night (admin)" phone in `Design/screens.html` (open it in Edge at the same width):
- Control room: game card with "GAME 2", the Live chip, Team A and Team C chips over the 64 px score, the clock "mm:ss of 10:00" below; the score card stays at the top when scrolling (check the full-page PNG: it sits just under the header); the 64 px green **Goal** button with black text; **Swap** and **Sub in** side by side; the dark **Game over**; "Waiting · Team B"; "Bench · minutes tonight" with Owner and the suggested sub; Team board and End night; the games list; check-in.
- The penalty question after **Game over**: two team buttons in bib colours and "No penalties".
- Team board: Out / A / B / C segments with players on the pitch locked ("On the pitch · use Swap").
- Swap: Out / A / C segments, keeper gloves, the counts bar; with `?in=&out=` the sub is already applied.
- Goal screen: the player grid in bib colours (Team C blue), the game picker; as a member, the "Only admins log goals" notice.
- Member live view: score, clock and "On the pitch", no admin buttons.
- Last week's night: 4 games (one "Team C won on penalties"), playing time, goals grouped by game, ratings with the new breakdown lines.
- Home: the live night card shows Game 2's score; the Nights list shows "N games".
- Ali's profile: "Happy to play in goal" switch, minutes line.
- Every console line says `fits` (no sideways scrolling at 390 px); black text on every green surface; dark mode keeps the brand green, bib colours and rating bands; Arabic names (محمد) left-aligned.

Fix anything that doesn't match, then rerun Step 1. Stop the background processes when done.

- [ ] **Step 6: Report to the owner and ask about the commit**

Tell the owner in plain words:
- What was built (games, the team board, swaps, penalties, admin-only goals, minutes, keeper and sub suggestions, per-night ratings with the team-impact fix) and how it was tested (the number of tests, the four checks, the screens checked, and anything that still looks off).
- The decisions this plan made (the list at the top of this file).
- **What they need to do:** run `supabase/migrations/20261025000100_games.sql` once in the Supabase SQL Editor (when no night is in progress), before the new app goes live. Explain it in one or two plain steps.
- What's still open: stage 3 (team suggester); the real iPhone sign-in test.

Then ask with AskUserQuestion: "Commit stage 2 straight to main (Recommended)" — their usual — / "Commit on a new branch" / "Don't commit yet".

Commit only the stage's files, never the owner's own changes:

```bash
git add supabase/migrations/20261025000100_games.sql supabase/seed.sql tests/db src README.md Plans/implementation/stage-2.md
git status --short   # package.json, package-lock.json, .env.example and .gitignore must still be unstaged
git commit -m "Build stage 2: games, team board, swaps, penalties and per-night ratings"
```

End the commit message with the attribution line. Don't push unless asked. Update the project-status memory (stage 2 built and committed; the owner must run file 5).

---

## Spec coverage

| Requirement (spec) | Task |
|---|---|
| Games in a night, ordinal, two of A/B/C, timer guide, ended by an admin (Football-scenario §0, §2.3-2.5, §6) | 1, 3, 6, 8 |
| Team board A/B/C/bench on `match_players` (§6, §7) | 1, 3, 7 |
| Swap and continue (score carries on, new lineup period) / End game and swap (§2.4) | 3, 7 |
| Sub in from the bench (§2.4) | 3, 6, 7 |
| Game over; penalties only decide who stays; shootout goals not recorded (§0, §2.5, §3) | 3, 6 |
| Next game suggestion: winner stays, waiting team on, two teams play again (§2.6) | 5, 6 |
| End night stops the clock (§2.7) | 3 |
| Live read-only view for everyone else (§2) | 6, 8 |
| Admin-only goal logging; players dispute (§0, §6) | 3, 7 |
| One rating per night; team impact summed (bug fix); result weighted by minutes; clean sheet whole game ≥ `clean_sheet_min_minutes` (§3) | 2 |
| Worked examples 1-5 and the extra cases (§3) | 2 |
| Old nights become one game with one lineup period; stored ratings not recalculated (§6) | 1 |
| `stints` + game and times, weight dropped; `goals` + game; Team C allowed (§6) | 1, 4 |
| Control room: one screen, big buttons, game card in view (§7) | 6, 8 |
| Nights list: games played and your rating; Home live card (§7) | 9 |
| How it works updated (§7) | 9 |
| Goalkeeper rotation: minutes in goal, pre-selected keeper, "Happy to play in goal" (Extras §3) | 1, 5, 6, 9 |
| Fair playing time: minutes tonight, sub suggestion (Extras §4) | 5, 6, 7, 8 |
| Minutes shown on the night page and profiles (Extras §3-4) | 3, 6, 8, 9 |
| Seed: three teams, penalties, a mid-game swap, late arrivals, a part-paid money card (§6) | 4 |
| README, embeds, 390 px light/dark check, owner runs file 5 | 10, 11 |

Left for later stages on purpose: the team suggester and `min_extra_team_size` (stage 3); punishments, loyalty points and badges (stage 4); Team of the Night/Month, best duos and the results share (stage 5).


---

## Changes made during the build

- **Moving the old nights recalculated their ratings.** File 2's triggers (`stints_recompute`, `goals_recompute`) recalculate a closed night whenever its lineups or goals change, so filling in `stints.game_id` and `goals.game_id` re-ran the old formula on every finished night. `migrate.test.ts` caught it (`computed_at` changed). File 5 now switches those two triggers off while the rows move and back on straight after.
- **The clock during render.** The linter flags `new Date()` while a screen draws (`react(purity)`), so `NextGameCard`, the team board and Swap read the time from `useNow(60_000)` instead.
- **Swap's bottom buttons** got a frosted background (`bg-ground/95`, like the bar at the top), so the list doesn't show through between them.
- **Stand-in setup:** `gh` isn't installed, so PostgREST 14.18 came straight from its GitHub release (`postgrest-v14.18-windows-x86-64.zip`). Port 5173 was taken (the owner's own dev server), so the app ran on 5180.
