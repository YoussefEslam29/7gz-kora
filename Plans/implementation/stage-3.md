# Stage 3: Team Suggester — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One tap on the team board (**Suggest teams**) fills in fair teams from the ratings already stored: two full teams, Team C when enough players are left over, and subs on the bench. The admin changes anything before saving, and players on the pitch during a game stay where they are. Plus the group setting "Extra team from N players" (`min_extra_team_size`, default 3), which admins change under More.

**Architecture:** The suggester is a pure TypeScript module, `src/lib/suggest.ts` (players with their strengths in, teams out), tested with vitest. A player's strength is their season rating, then their all-time rating, then **6.0**, read from `get_leaderboard` (ratings already stored: no second rating calculation). The database gains only the setting, in a new migration file 6 (`supabase/migrations/20261025000200_team_suggester.sql`). Files 1-5 already ran on the owner's live Supabase project, so **they are never edited**. The team board screen (`src/pages/Teams.tsx`) gets the button and each team's average rating; Settings gets a "Team suggester" card; How it works gets one bullet.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Tailwind 4, react-router 8, supabase-js 2, Postgres (Supabase), PGlite for database tests, vitest 5. No new packages.

**Spec:** `Plans/README.md` (build order item 3), `Plans/Football-scenario.md` (section 5, the Settings row of section 7, section 6 `groups + min_extra_team_size`, section 10 "new players start at 6.0"), `Design/README.md`. Rules from the root `CLAUDE.md` and `Plans/NEXT-SESSION-PROMPT.md`.

## Global Constraints

- **Files 1-5 in `supabase/migrations/` ran on the live project: never edit them.** The one database change goes in file 6, `supabase/migrations/20261025000200_team_suggester.sql`.
- **Stay on Supabase.** Every table keeps Row Level Security; access is granted explicitly. A new column keeps its table's permissions; the only new write permission is `update (min_extra_team_size)` for admins, under the existing "admins rename their groups" row rule.
- **The suggester is a pure TypeScript function** (players + ratings in, teams out) with the four unit tests from the plan file: 12 at 6 a side → 2 teams; 16 at 6 a side → 6 / 6 / 4; 13 at 6 a side → 6 / 6 + 1 sub; balanced output for a known set of ratings.
- **Snake draft** (best to A, next to B, next to C, then back the other way), **then pair swaps while they reduce the gap between the strongest and weakest team averages.**
- **Strength:** season rating, then all-time rating, then **6.0** for brand-new players, from ratings already stored. **Don't add a second rating calculation.**
- **Goalkeepers are not chosen by the suggester** (they're picked per game, as in stage 2).
- **`groups.min_extra_team_size` (default 3)**, editable by admins in Settings ("Extra team from N players").
- **Players on the pitch during a game stay locked.** The suggester only fills the Out/A/B/C picks; the admin tweaks them and taps Save teams.
- **Admins only** change teams. **Money doesn't change.**
- **Text on the brand green `#00BF63` is always black.** White only in the logo lettering.
- **Names can be Arabic:** wrap every name in `<Name>` (a `<bdi dir="auto">`), keep them left-aligned in lists.
- Tap targets at least 48 px (the segmented pickers are 46 px, as everywhere else in the app).
- Follow the existing code style: comment density, naming, small files.
- Don't touch the owner's own uncommitted change (`.env.example`) and keep it out of the stage commit.
- Checks that must pass at the end: `npx tsc -b`, `npm run lint`, `npm test`, `npm run build`.

## How this stage is run

- One commit at the end of the stage, after the owner chooses how (their usual: straight to `main`). Each task ends with a checkpoint (tests green) instead of a commit.
- Screen checks use a **temporary** local stand-in for Supabase in the session's scratch folder (Task 6), as in stages 1 and 2.
- The owner must run file 6 on their live project once, **before** pushing (every push to `main` deploys to Vercel, and the new app reads the new column). Task 5 puts that in the README; the hand-over (Task 6) tells them in plain words.

## Decisions this plan makes (not covered by the plan files; flag them to the owner)

1. **Subs are chosen by playing time:** whoever has played the most minutes tonight sits out first, then whoever arrived last. At the start of a night (nobody has played yet), that's simply the last to arrive.
2. **Three teams at most** (A, B and C, the three bib colours). `Football-scenario.md` section 5 mentions "another team if still ≥ 3 are left over", but the team board and the bibs only have three teams, so anyone more is a sub (21 at 6 a side → 6 / 6 / 6 and 3 subs).
3. **During a game, Suggest teams keeps everyone on the pitch where they are.** They count toward their team's average; only the others are placed (for example, latecomers go to the team that needs them most, or to Team C).
4. **Between games, Suggest teams reshuffles everyone**, including a team that just won and would stay on. It only happens when the admin taps it.
5. **Ratings come from finished nights** (voting closed), and "this season" is the night's calendar year, the same as the table.
6. **"Extra team from N players" can be 2 to 11.** Settings offers 2 to 7 (one tap, saved straight away). Everyone sees the setting; only admins change it.
7. **The team board shows each team's average rating** under the head counts, so the admin can see the balance, also when changing teams by hand.
8. **Players with the same rating** are drafted in name order, so the same players always give the same suggestion.

---

## File structure

**Database**

| File | Change |
|---|---|
| `supabase/migrations/20261025000200_team_suggester.sql` | **New.** `groups.min_extra_team_size` (default 3, between 2 and 11); admins may update it. |
| `tests/db/teams.test.ts` | **New.** The setting: the default, admins only, the 2-11 range, the invite code still locked, signed-out visitors, groups from before file 6. |
| `supabase/seed.sql` | Header only: run after the **6** files; the suggester uses the demo nights' ratings. |

**App: logic (pure, tested with vitest)**

| File | Responsibility |
|---|---|
| `src/lib/suggest.ts` + `suggest.test.ts` | **New.** `playerStrength`, `teamSizes`, `suggestTeams`, `teamAverages`, `NEW_PLAYER_STRENGTH` |
| `src/lib/types.ts` | `Group.min_extra_team_size`; `RatingAverages` |
| `src/lib/api.ts` | Memberships read the setting; `getRatingAverages`; `setMinExtraTeamSize` |

**App: screens**

| File | Responsibility |
|---|---|
| `src/pages/Teams.tsx` | **Suggest teams**, the notice after it, each team's average rating |
| `src/pages/Settings.tsx` | The "Team suggester" card: "Extra team from N players" |
| `src/pages/HowItWorks.tsx` | One bullet about Suggest teams |

**Docs:** `README.md` (file 6, what's built, choices, tests, troubleshooting), `Plans/README.md` (status), `Plans/NEXT-SESSION-PROMPT.md` (where things stand, for stage 4).

---

## Part A — Database (file 6)

### Task 1: The "Extra team from N players" setting

**Files:**
- Create: `supabase/migrations/20261025000200_team_suggester.sql`
- Test: `tests/db/teams.test.ts`

**Interfaces:**
- Produces (SQL): column `groups.min_extra_team_size int not null default 3`, constraint `groups_min_extra_team_size_check` (`between 2 and 11`), `grant update (min_extra_team_size) on public.groups to authenticated`.

- [ ] **Step 1: Write the failing tests**

Create `tests/db/teams.test.ts`:

```ts
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
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/db/teams.test.ts`
Expected: FAIL: `column "min_extra_team_size" does not exist` (the last test fails the same way after `runMigrations` finds no file 6; the invite-code and signed-out tests already pass).

- [ ] **Step 3: Write file 6**

Create `supabase/migrations/20261025000200_team_suggester.sql`:

```sql
-- =============================================================================
-- 7GZ-KORA: the team suggester (file 6 of 6)
--
-- "Suggest teams" on the team board (Plans/Football-scenario.md section 5)
-- runs in the app (src/lib/suggest.ts), from ratings already stored. The
-- database only gains its one setting, "Extra team from N players"
-- (section 7): when at least this many players are left over after two full
-- teams, they make Team C; fewer wait on the bench as subs.
--
-- Files 1 to 5 already run on the live project, so this file only adds to
-- them. Run it once, in the SQL Editor. It can run at any time, even during
-- a night.
-- =============================================================================

alter table public.groups
  add column min_extra_team_size int not null default 3
    constraint groups_min_extra_team_size_check check (min_extra_team_size between 2 and 11);

-- Admins change it in Settings, straight on the table, under the same row
-- rule as renaming the group (file 1, "admins rename their groups"). A new
-- column keeps the table's permissions (file 3): members of the group can
-- read it, signed-out visitors can't.
grant update (min_extra_team_size) on public.groups to authenticated;
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/db/teams.test.ts` → Expected: 6 passed.
Run: `npm test` → Expected: everything passes (117 tests).

---

## Part B — App logic

### Task 2: The suggester

**Files:**
- Create: `src/lib/suggest.ts`
- Test: `src/lib/suggest.test.ts`

**Interfaces:**
- Consumes: `TEAMS: Team[]` (`['A', 'B', 'C']`) from `src/lib/games.ts`; `Team` from `src/lib/types.ts`.
- Produces:
  - `NEW_PLAYER_STRENGTH = 6`
  - `playerStrength(playerId: string, season: Map<string, number>, allTime: Map<string, number>): number`
  - `teamSizes(count: number, perSide: number, minExtraTeam: number): Record<Team, number>`
  - `interface SuggestPlayer { id: string; strength: number; minutes: number; arrivedAt: string; locked: Team | null }`
  - `type SuggestedTeams = Record<Team, string[]> & { bench: string[] }` (each team strongest first; the bench in the order they sit out)
  - `suggestTeams(players: SuggestPlayer[], perSide: number, minExtraTeam: number): SuggestedTeams`
  - `teamAverages(picks: Map<string, Team | null>, strength: (playerId: string) => number): Record<Team, number | null>`

The worked numbers in the tests were checked by hand and with a prototype:
- **12 ratings** 8.5, 8.5, 8, 7, 7, 7, 6.5, 6, 6, 6, 5.5, 5 at 6 a side. The snake draft (A, B, B, A, A, B, B, A, A, B, B, A) gives A 8.5 + 7 + 7 + 6 + 6 + 5 = 39.5 (6.58) and B 8.5 + 8 + 7 + 6.5 + 6 + 5.5 = 41.5 (6.92). Swapping one of A's 7s with B's 8 makes both 40.5: **6.75 each**.
- **16 ratings** in 6 / 6 / 4: the snake draft alone leaves 0.375 between the strongest and weakest team average; after the swaps it's 0.017.
- **Locked players:** five 7.0s on the pitch for A, five 6.0s for B, and two latecomers, 8.0 and 5.0, at 6 a side. The snake would put the 8.0 on A (gap 1.33); the swap sends the 8.0 to B and the 5.0 to A (6.67 v 6.33).

- [ ] **Step 1: Write the failing tests**

Create `src/lib/suggest.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  NEW_PLAYER_STRENGTH,
  playerStrength,
  suggestTeams,
  teamAverages,
  teamSizes,
  type SuggestedTeams,
  type SuggestPlayer,
} from './suggest'
import type { Team } from './types'

/** Players checked in a minute apart in this order (P1 first), none on the pitch, no minutes yet. */
function arrivals(strengths: number[]): SuggestPlayer[] {
  return strengths.map((strength, i) => ({
    id: `P${i + 1}`,
    strength,
    minutes: 0,
    arrivedAt: new Date(Date.UTC(2026, 9, 29, 18, i)).toISOString(),
    locked: null,
  }))
}

const evenly = (count: number) => arrivals(Array.from({ length: count }, () => 6.5))
/** Head counts: [Team A, Team B, Team C, bench]. */
const sizes = (s: SuggestedTeams) => [s.A.length, s.B.length, s.C.length, s.bench.length]
const average = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length

/** The average strength of each team that has players. */
function averages(s: SuggestedTeams, players: SuggestPlayer[]) {
  const strength = new Map(players.map((p) => [p.id, p.strength]))
  return (['A', 'B', 'C'] as Team[])
    .filter((t) => s[t].length > 0)
    .map((t) => average(s[t].map((id) => strength.get(id)!)))
}

describe('how many teams', () => {
  it('12 players at 6 a side: two teams of 6', () => {
    expect(teamSizes(12, 6, 3)).toEqual({ A: 6, B: 6, C: 0 })
    expect(sizes(suggestTeams(evenly(12), 6, 3))).toEqual([6, 6, 0, 0])
  })

  it('16 at 6 a side: 6 / 6 / 4 (the 4 left over make Team C)', () => {
    expect(sizes(suggestTeams(evenly(16), 6, 3))).toEqual([6, 6, 4, 0])
  })

  it('13 at 6 a side: 6 / 6 and 1 sub, the last to arrive', () => {
    const s = suggestTeams(evenly(13), 6, 3)
    expect(sizes(s)).toEqual([6, 6, 0, 1])
    expect(s.bench).toEqual(['P13'])
  })

  it('fewer than two full teams: two teams as even as possible (9 at 6 a side: 5 and 4)', () => {
    expect(sizes(suggestTeams(evenly(9), 6, 3))).toEqual([5, 4, 0, 0])
  })

  it('"Extra team from N players": 15 at 6 a side is 6 / 6 / 3, or 6 / 6 and 3 subs when N is 4', () => {
    expect(sizes(suggestTeams(evenly(15), 6, 3))).toEqual([6, 6, 3, 0])
    expect(sizes(suggestTeams(evenly(15), 6, 4))).toEqual([6, 6, 0, 3])
  })

  it('three teams at most: 20 at 6 a side is 6 / 6 / 6 and 2 subs', () => {
    expect(sizes(suggestTeams(evenly(20), 6, 3))).toEqual([6, 6, 6, 2])
  })
})

describe('fair teams', () => {
  it('a known set of 12 ratings: both teams average 6.75', () => {
    // The snake draft alone gives A 39.5 and B 41.5 (6.58 v 6.92); one swap evens them at 40.5 each.
    const players = arrivals([8.5, 8.5, 8, 7, 7, 7, 6.5, 6, 6, 6, 5.5, 5])
    const s = suggestTeams(players, 6, 3)
    expect(sizes(s)).toEqual([6, 6, 0, 0])
    const [a, b] = averages(s, players)
    expect(a).toBeCloseTo(6.75)
    expect(b).toBeCloseTo(6.75)
  })

  it('16 ratings in three teams end up within 0.05 of each other', () => {
    // The snake draft alone leaves 0.375 between the strongest and the weakest team.
    const players = arrivals([8.6, 8.1, 7.7, 7.4, 7.3, 7.1, 6.9, 6.6, 6.2, 6, 6, 6, 5.7, 5.5, 5.2, 4.9])
    const s = suggestTeams(players, 6, 3)
    expect(sizes(s)).toEqual([6, 6, 4, 0])
    const avgs = averages(s, players)
    expect(Math.max(...avgs) - Math.min(...avgs)).toBeLessThan(0.05)
  })

  it('players on the pitch stay on their team; the stronger latecomer joins the weaker team', () => {
    const onPitch = (id: string, strength: number, locked: Team): SuggestPlayer => ({
      id, strength, minutes: 10, arrivedAt: '2026-10-29T18:00:00Z', locked,
    })
    const players = [
      ...['A1', 'A2', 'A3', 'A4', 'A5'].map((id) => onPitch(id, 7, 'A')),
      ...['B1', 'B2', 'B3', 'B4', 'B5'].map((id) => onPitch(id, 6, 'B')),
      { id: 'Strong', strength: 8, minutes: 0, arrivedAt: '2026-10-29T18:20:00Z', locked: null },
      { id: 'Weak', strength: 5, minutes: 0, arrivedAt: '2026-10-29T18:21:00Z', locked: null },
    ]
    const s = suggestTeams(players, 6, 3)
    expect(s.A).toEqual(['A1', 'A2', 'A3', 'A4', 'A5', 'Weak'])
    expect(s.B).toEqual(['Strong', 'B1', 'B2', 'B3', 'B4', 'B5'])
    expect(s.C).toEqual([])
    expect(s.bench).toEqual([])
  })
})

describe('who sits out', () => {
  it('whoever has played the most tonight, then the last to arrive', () => {
    // 14 at 6 a side: 2 subs. P3 has played 40 minutes; P7 and P12 30; everyone else 20.
    const minutes: Record<string, number> = { P3: 40, P7: 30, P12: 30 }
    const players = evenly(14).map((p) => ({ ...p, minutes: minutes[p.id] ?? 20 }))
    expect(suggestTeams(players, 6, 3).bench).toEqual(['P3', 'P12'])
  })
})

describe('strength', () => {
  it('the season rating, then the all-time rating, then 6.0 for someone new', () => {
    const season = new Map([['Omar', 7.4]])
    const allTime = new Map([['Omar', 6.9], ['Ziad', 6.2]])
    expect(playerStrength('Omar', season, allTime)).toBe(7.4)
    expect(playerStrength('Ziad', season, allTime)).toBe(6.2)
    expect(playerStrength('محمد', season, allTime)).toBe(NEW_PLAYER_STRENGTH)
    expect(NEW_PLAYER_STRENGTH).toBe(6)
  })

  it("each team's average on the board; an empty team has none", () => {
    const picks = new Map<string, Team | null>([['Omar', 'A'], ['Ziad', 'A'], ['Ali', 'B'], ['Seif', null]])
    const strength = (id: string) => ({ Omar: 8, Ziad: 6, Ali: 6.5, Seif: 9 })[id] ?? 6
    expect(teamAverages(picks, strength)).toEqual({ A: 7, B: 6.5, C: null })
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/suggest.test.ts`
Expected: FAIL: `Failed to resolve import "./suggest"`.

- [ ] **Step 3: Write the suggester**

Create `src/lib/suggest.ts`:

```ts
// The team suggester (Plans/Football-scenario.md section 5): fair teams from
// the ratings already stored. Pure functions (tested in suggest.test.ts).
import { TEAMS } from './games'
import type { Team } from './types'

/** The strength of a player with no rating yet. */
export const NEW_PLAYER_STRENGTH = 6

/** A player's strength: their season rating, then their all-time rating, then 6.0 for someone new. */
export function playerStrength(playerId: string, season: Map<string, number>, allTime: Map<string, number>): number {
  return season.get(playerId) ?? allTime.get(playerId) ?? NEW_PLAYER_STRENGTH
}

/**
 * How many players each team gets. Fewer than two full teams: two teams as
 * even as possible. Otherwise two teams of `perSide`, and the players left
 * over make Team C (up to a full side) when there are at least `minExtraTeam`
 * of them. Everyone else is on the bench.
 */
export function teamSizes(count: number, perSide: number, minExtraTeam: number): Record<Team, number> {
  if (count < 2 * perSide) return { A: Math.ceil(count / 2), B: Math.floor(count / 2), C: 0 }
  const left = count - 2 * perSide
  return { A: perSide, B: perSide, C: left >= minExtraTeam ? Math.min(left, perSide) : 0 }
}

export interface SuggestPlayer {
  id: string
  /** From playerStrength. */
  strength: number
  /** Minutes on the pitch tonight: whoever has played the most sits out first. */
  minutes: number
  /** Check-in time: with equal minutes, the last to arrive sits out first. */
  arrivedAt: string
  /** On the pitch in the game now: stays on this team. */
  locked: Team | null
}

/** Each team strongest first, and the bench in the order they sit out. */
export type SuggestedTeams = Record<Team, string[]> & { bench: string[] }

type Board = Record<Team, SuggestPlayer[]>

const PAIRS: [Team, Team][] = [['A', 'B'], ['A', 'C'], ['B', 'C']]
const average = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length

/** The gap between the strongest and the weakest team average (teams with players only). */
function spread(board: Board): number {
  const averages = TEAMS.filter((t) => board[t].length > 0).map((t) => average(board[t].map((p) => p.strength)))
  return averages.length < 2 ? 0 : Math.max(...averages) - Math.min(...averages)
}

function swap(board: Board, x: Team, i: number, y: Team, j: number) {
  const p = board[x][i]
  board[x][i] = board[y][j]
  board[y][j] = p
}

/**
 * Fair teams: who sits out first, then a snake draft (best to A, next to B,
 * next to C, then back the other way), then pair swaps while they reduce the
 * gap between the strongest and weakest team averages. Players on the pitch
 * stay on their team and are never swapped. Goalkeepers are picked per game,
 * not here. Ties keep the order the players are given in.
 */
export function suggestTeams(players: SuggestPlayer[], perSide: number, minExtraTeam: number): SuggestedTeams {
  const sizes = teamSizes(players.length, perSide, minExtraTeam)
  const board: Board = { A: [], B: [], C: [] }
  for (const p of players) if (p.locked) board[p.locked].push(p)
  const open: Record<Team, number> = { A: 0, B: 0, C: 0 }
  for (const t of TEAMS) open[t] = Math.max(0, sizes[t] - board[t].length)

  // Who sits out: the most minutes tonight, then the last to arrive.
  const free = players.filter((p) => !p.locked)
  const seats = Math.min(free.length, open.A + open.B + open.C)
  const sitOut = [...free].sort((a, b) => b.minutes - a.minutes || b.arrivedAt.localeCompare(a.arrivedAt))
  const bench = sitOut.slice(0, free.length - seats)
  const draft = free.filter((p) => !bench.includes(p)).sort((a, b) => b.strength - a.strength)

  // Snake draft: A, B, C, then C, B, A, skipping full teams.
  let next = 0
  for (let round = 0; next < draft.length; round++) {
    for (const t of round % 2 === 0 ? TEAMS : [...TEAMS].reverse()) {
      if (open[t] > 0 && next < draft.length) {
        board[t].push(draft[next++])
        open[t]--
      }
    }
  }

  // Pair swaps: each round makes the swap that narrows the gap most, until none does.
  for (;;) {
    const now = spread(board)
    let best: { gap: number; x: Team; i: number; y: Team; j: number } | null = null
    for (const [x, y] of PAIRS) {
      for (let i = 0; i < board[x].length; i++) {
        for (let j = 0; j < board[y].length; j++) {
          if (board[x][i].locked || board[y][j].locked) continue
          swap(board, x, i, y, j)
          const gap = spread(board)
          swap(board, x, i, y, j)
          if (gap < (best?.gap ?? now) - 1e-9) best = { gap, x, i, y, j }
        }
      }
    }
    if (!best) break
    swap(board, best.x, best.i, best.y, best.j)
  }

  const ids = (list: SuggestPlayer[]) => [...list].sort((a, b) => b.strength - a.strength).map((p) => p.id)
  return { A: ids(board.A), B: ids(board.B), C: ids(board.C), bench: bench.map((p) => p.id) }
}

/** Each team's average strength on the board; null for an empty team. */
export function teamAverages(
  picks: Map<string, Team | null>,
  strength: (playerId: string) => number,
): Record<Team, number | null> {
  const result: Record<Team, number | null> = { A: null, B: null, C: null }
  for (const t of TEAMS) {
    const members = [...picks].filter(([, team]) => team === t).map(([playerId]) => strength(playerId))
    result[t] = members.length > 0 ? average(members) : null
  }
  return result
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/lib/suggest.test.ts` → Expected: 12 passed.
Run: `npx tsc -b && npm run lint` → Expected: no errors, 0 warnings.

---

## Part C — Screens

### Task 3: Suggest teams on the team board

**Files:**
- Modify: `src/lib/types.ts` (the `Group` interface, lines 11-15; add `RatingAverages` after `LeaderboardRow`)
- Modify: `src/lib/api.ts` (`getMemberships`, line 53; add `getRatingAverages` after `getLeaderboard`, line 290)
- Modify: `src/pages/Teams.tsx` (whole file)

**Interfaces:**
- Consumes: `playerStrength`, `suggestTeams`, `teamAverages` (Task 2); `minutesTonight`, `TEAMS` (`src/lib/games.ts`); `api.getLeaderboard(groupId, year | null): Promise<LeaderboardRow[]>`.
- Produces: `Group.min_extra_team_size: number`; `interface RatingAverages { season: Map<string, number>; allTime: Map<string, number> }`; `api.getRatingAverages(groupId: string, year: number): Promise<RatingAverages>`.

- [ ] **Step 1: The setting and the ratings in the types**

In `src/lib/types.ts`, replace the `Group` interface with:

```ts
export interface Group {
  id: string
  name: string
  invite_code: string | null
  /** "Extra team from N players": the team suggester makes Team C from this many left over. */
  min_extra_team_size: number
}
```

After the `LeaderboardRow` interface, add:

```ts
/** Each player's average night rating, this season and all-time (for the team suggester). */
export interface RatingAverages {
  season: Map<string, number>
  allTime: Map<string, number>
}
```

- [ ] **Step 2: Read them from Supabase**

In `src/lib/api.ts`:

1. In `getMemberships`, change `'role, player_id, groups(id, name, invite_code)'` to `'role, player_id, groups(id, name, invite_code, min_extra_team_size)'`.
2. Add `RatingAverages` to the type import list (alphabetical, after `RatingConfig`).
3. Right after `getLeaderboard`, add:

```ts
/** Ratings already stored, for the team suggester: each player's average this season and all-time. */
export async function getRatingAverages(groupId: string, year: number): Promise<RatingAverages> {
  const [season, allTime] = await Promise.all([getLeaderboard(groupId, year), getLeaderboard(groupId, null)])
  const byPlayer = (rows: LeaderboardRow[]) => new Map(rows.map((r) => [r.player_id, Number(r.avg_rating_exact)]))
  return { season: byPlayer(season), allTime: byPlayer(allTime) }
}
```

- [ ] **Step 3: The button, the notice and the averages**

Replace `src/pages/Teams.tsx` with:

```tsx
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { BackIcon } from '../components/icons'
import { Avatar, Button, ErrorNote, Loading, Name, Notice, PageTitle, TeamTag } from '../components/ui'
import * as api from '../lib/api'
import { errorMessage, formatMinutes } from '../lib/format'
import { minutesTonight, TEAMS } from '../lib/games'
import { playerStrength, suggestTeams, teamAverages } from '../lib/suggest'
import type { MatchDetail, RatingAverages, Team } from '../lib/types'
import { useNow } from '../lib/useNow'
import { useCurrentGroup } from '../state/group'

/**
 * The team board (admins): Team A, B or C, or the bench ("Out"), for everyone
 * checked in, with their minutes tonight. "Suggest teams" fills in fair teams
 * from the ratings, to change before saving. While a game is on, players on
 * the pitch are moved with Swap.
 */
export default function Teams() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { group, player, isAdmin } = useCurrentGroup()
  const [detail, setDetail] = useState<MatchDetail | null>(null)
  const [ratings, setRatings] = useState<RatingAverages | null>(null)
  const [picks, setPicks] = useState<Map<string, Team | null>>(new Map())
  const [suggested, setSuggested] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const now = useNow(60_000)

  useEffect(() => {
    api
      .getMatch(id)
      .then(async (d) => {
        // "This season" is the night's calendar year, as on the table.
        const averages = await api.getRatingAverages(d.match.group_id, Number(d.match.played_at.slice(0, 4)))
        setDetail(d)
        setRatings(averages)
        setPicks(new Map(d.checkIns.map((c) => [c.player_id, c.team])))
      })
      .catch((e: unknown) => setError(errorMessage(e)))
  }, [id])

  if (!isAdmin) return <ErrorNote message="Only group admins can change the teams." />
  if (!detail || !ratings) return error ? <ErrorNote message={error} /> : <Loading />

  const { season, allTime } = ratings
  const perSide = detail.match.players_per_side
  const name = (playerId: string) => player(playerId)?.display_name ?? 'Unknown player'
  const here = [...detail.checkIns].sort((a, b) => name(a.player_id).localeCompare(name(b.player_id)))
  // Players on the pitch, with their team: they keep it until the game ends.
  const pitchTeam = new Map(detail.lineup.map((p) => [p.player_id, p.team]))
  const minutes = minutesTonight(detail.stints, detail.stintPlayers, now)
  const strength = (playerId: string) => playerStrength(playerId, season, allTime)
  const count = (team: Team) => [...picks.values()].filter((t) => t === team).length
  const averages = teamAverages(picks, strength)
  const averageLine = TEAMS.flatMap((t) => {
    const avg = averages[t]
    return avg === null ? [] : [`${t} ${avg.toFixed(1)}`]
  }).join(' · ')

  function suggest() {
    const teams = suggestTeams(
      here
        .filter((c) => c.left_at === null)
        .map((c) => ({
          id: c.player_id,
          strength: strength(c.player_id),
          minutes: minutes.get(c.player_id)?.played ?? 0,
          arrivedAt: c.arrived_at,
          locked: pitchTeam.get(c.player_id) ?? null,
        })),
      perSide,
      group.min_extra_team_size,
    )
    const next = new Map<string, Team | null>(here.map((c) => [c.player_id, null]))
    for (const t of TEAMS) for (const playerId of teams[t]) next.set(playerId, t)
    setPicks(next)
    setSuggested(true)
  }

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
          <Button variant="secondary" className="w-full" onClick={suggest}>
            Suggest teams
          </Button>
          {suggested && (
            <Notice>
              Fair teams from the ratings
              {pitchTeam.size > 0 && ', with the players on the pitch kept where they are'}. Change anything you like,
              then tap Save teams.
            </Notice>
          )}

          <div className="sticky top-[calc(env(safe-area-inset-top)+4rem)] z-10 -mx-4 mt-2 mb-2 bg-ground/95 px-4 py-2 backdrop-blur">
            <div className="flex items-center gap-3">
              {TEAMS.map((t) => (
                <span key={t} className="flex items-center gap-1.5 font-display text-lg">
                  <TeamTag team={t} /> {count(t)}
                </span>
              ))}
            </div>
            {averageLine && <p className="tabular mt-1 text-xs text-muted">Average rating · {averageLine}</p>}
          </div>

          <ul className="divide-y divide-line rounded-card border-[1.5px] border-line bg-paper">
            {here.map(({ player_id, left_at }) => {
              const pick = picks.get(player_id) ?? null
              const label = name(player_id)
              const playing = pitchTeam.has(player_id)
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

(The `suggest` and `save` functions only use values that can't be null by then, so TypeScript is happy with them as function declarations.)

- [ ] **Step 4: Checks**

Run: `npx tsc -b && npm run lint && npm test` → Expected: no type errors, 0 lint warnings, all tests pass (129).

---

### Task 4: The setting in Settings, and How it works

**Files:**
- Modify: `src/lib/api.ts` (add `setMinExtraTeamSize` after `renameGroup`, line 80)
- Modify: `src/pages/Settings.tsx` (a constant at the top; the new card after "Rating settings", line 75; the new component at the end)
- Modify: `src/pages/HowItWorks.tsx` (the `HowItWorks` component and the "Games" card)

**Interfaces:**
- Consumes: `Group.min_extra_team_size` (Task 3); `useCurrentGroup().refresh()`.
- Produces: `api.setMinExtraTeamSize(groupId: string, size: number): Promise<void>`.

- [ ] **Step 1: Saving the setting**

In `src/lib/api.ts`, right after `renameGroup`, add:

```ts
/** "Extra team from N players" for the team suggester (admins). */
export async function setMinExtraTeamSize(groupId: string, size: number) {
  unwrap(await supabase.from('groups').update({ min_extra_team_size: size }).eq('id', groupId))
}
```

- [ ] **Step 2: The Settings card**

In `src/pages/Settings.tsx`:

1. Under the imports, add:

```ts
/** "Extra team from N players": the choices offered (the database allows 2 to 11). */
const EXTRA_TEAM_SIZES = [2, 3, 4, 5, 6, 7]
```

2. Right after the "Rating settings" `</Card>` (before the "Your groups" card), add `<TeamSuggesterCard />`.
3. At the end of the file, add:

```tsx
/** "Extra team from N players" for the team suggester: everyone sees it, admins change it. */
function TeamSuggesterCard() {
  const { group, isAdmin, refresh } = useCurrentGroup()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const size = group.min_extra_team_size
  const sizes = [...new Set([...EXTRA_TEAM_SIZES, size])].sort((a, b) => a - b)

  async function choose(n: number) {
    setBusy(true)
    setError(null)
    try {
      await api.setMinExtraTeamSize(group.id, n)
      await refresh()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <Heading className="mb-2">Team suggester</Heading>
      <p className="text-sm">
        Extra team from <strong>{size} players</strong>: when at least {size} are left over after two full teams, they
        make Team C. Fewer wait on the bench as subs.
      </p>
      {isAdmin && (
        <div className="seg mt-3" role="group" aria-label="Extra team from">
          {sizes.map((n) => (
            <button
              key={n}
              type="button"
              disabled={busy}
              aria-pressed={size === n}
              className={size === n ? 'sel' : ''}
              onClick={() => void choose(n)}
            >
              {n}
            </button>
          ))}
        </div>
      )}
      <ErrorNote message={error} />
    </Card>
  )
}
```

- [ ] **Step 3: How it works**

In `src/pages/HowItWorks.tsx`:

1. In `HowItWorks`, change `const { config } = useGroup()` to `const { config, group } = useGroup()` and `<NightsExplainer />` to `<NightsExplainer extraTeam={group?.min_extra_team_size ?? 3} />`.
2. Change `function NightsExplainer() {` to `function NightsExplainer({ extraTeam }: { extraTeam: number }) {`.
3. In the "Games" card, right after the bullet that starts `Teams wear bibs`, add:

```tsx
          <li>
            <strong>Suggest teams</strong> makes fair teams from everyone's ratings: this season's, then all-time, and
            6.0 for someone new. With {extraTeam} or more players left over after two full teams, they make a third team;
            fewer wait on the bench as subs, starting with whoever has played most. An admin can change anything before
            saving.
          </li>
```

- [ ] **Step 4: Checks**

Run: `npx tsc -b && npm run lint && npm test` → Expected: no type errors, 0 lint warnings, all tests pass.

---

## Part D — Docs, checks and hand-over

### Task 5: README, demo data notes and the plan index

**Files:**
- Modify: `README.md` (sections 1, 2 Step 3, 7, 8 and 10)
- Modify: `supabase/seed.sql` (header comment, lines 17-20)
- Modify: `Plans/README.md` (the status of row 2)
- Modify: `Plans/NEXT-SESSION-PROMPT.md` (sections 3 and 7)

- [ ] **Step 1: What's built**

In `README.md` section 1:

1. Change `**stages 1 and 2 of the 7GZ-KORA upgrade**` to `**stages 1 to 3 of the 7GZ-KORA upgrade**`.
2. After the bullet that starts `- **At the pitch:**`, add:

```markdown
- **Suggest teams:** one tap on the team board makes fair teams from everyone's ratings (this season's, then all-time, 6.0 for someone new): a snake draft, then swaps until the team averages are as close as they get. Two full teams, plus Team C when enough players are left over (3 by default: **More → Team suggester**); the rest are subs, starting with whoever has played most, then whoever arrived last. The admin changes anything before saving, and players on the pitch stay where they are.
```

3. Change the `**Coming next**` paragraph to:

```markdown
**Coming next** (`Plans/README.md`): punishments and loyalty points, Team of the Night and best duos.
```

- [ ] **Step 2: Setting up the database**

In section 2, Step 3:

1. Change item 3 to: `3. Do the same with \`20261023000200_rating.sql\`, then \`20261023000300_actions.sql\`, then \`20261024000100_nights.sql\`, then \`20261025000100_games.sql\`, then \`20261025000200_team_suggester.sql\`. **Order matters.**`
2. Replace the note that starts `> **Already ran the first four files?**` with:

```markdown
> **Already ran some of the files?** Run only the ones after them, in order, once each. `20261025000100_games.sql` must run when no night is in progress (each existing night becomes one game; their ratings stay as they are). `20261025000200_team_suggester.sql` can run at any time: it adds the "Extra team from N players" setting, 3 for every group. **Run them before you push the new version** (every push updates the app on Vercel, and the new app needs them).
```

- [ ] **Step 3: Choices made for you**

In section 7, replace item 31 with:

```markdown
31. **The team suggester runs in the app**, from ratings already stored: your season rating, then your all-time rating, then 6.0 if you're new. Only finished nights count, as on the table.
32. **Subs are whoever has played the most minutes tonight**, then whoever arrived last. At the start of a night, that's simply the last to arrive.
33. **Three teams at most** (A, B and C, the three bib colours). Anyone more is a sub.
34. **During a game, Suggest teams keeps the players on the pitch where they are** and only places the others. Between games it reshuffles everyone, so only tap it when you want new teams.
35. **"Extra team from N players"** is under **More → Team suggester**: 2 to 7 in the app (up to 11 in the database). Everyone can see it; admins change it.
36. **The team board shows each team's average rating**, also while you change teams by hand.
37. **Players with the same rating** are drafted in name order, so the same players always give the same suggestion.
```

- [ ] **Step 4: Demo data, tests, layout and troubleshooting**

In section 8:

1. In the demo data paragraph, change `Run it in the SQL Editor after the **five** migration files` to `Run it in the SQL Editor after the **six** migration files`.
2. In the Tests list: run `npm test`, change `This runs 111 tests.` to the number it prints, add this bullet after the `migrate.test.ts` bullet:

```markdown
- `tests/db/teams.test.ts`: the "Extra team from N players" setting: 3 by default, only admins change it, only 2 to 11, and groups from before it get 3
```

and change the `src/lib/*.test.ts` bullet's end from `and the game helpers (next game, minutes, goalkeeper and sub suggestions, the clock)` to `the game helpers (next game, minutes, goalkeeper and sub suggestions, the clock), and the team suggester (how many teams, fair teams for known ratings, who sits out, players on the pitch staying put)`.
3. In the project layout block, change the first line to `supabase/migrations/   The database: tables + security (1), ratings (2), app actions (3), nights (4), games + night ratings (5), team suggester setting (6)`.

In section 10 (Troubleshooting):

1. Change `One of the five SQL files wasn't run` to `One of the six SQL files wasn't run`.
2. Add this row after the `start_game` row:

```markdown
| "column groups_1.min_extra_team_size does not exist", or the app can't load your group | `20261025000200_team_suggester.sql` hasn't been run yet. Run it in the SQL Editor (section 2, Step 3). |
```

- [ ] **Step 5: The demo data header**

In `supabase/seed.sql`, replace these header lines:

```sql
-- Ali and Mahmoud are happy to play in goal.
--
-- Run it AFTER the 5 migration files, ideally in a separate test project.
```

with:

```sql
-- Ali and Mahmoud are happy to play in goal. "Suggest teams" uses these
-- nights' ratings; Demo FC makes Team C from 3 players left over (the default).
--
-- Run it AFTER the 6 migration files, ideally in a separate test project.
```

(No new demo rows: the finished nights already give the players ratings, and anyone who joins is new, at 6.0.)

- [ ] **Step 6: The plan index and the next-session prompt**

In `Plans/README.md`, in row 2 (`Football-scenario.md`), change the status `Stages 1-2 **built** (\`e40931d\`, \`880fe2e\`); team suggester (stage 3) not built` to `Stages 1-3 **built** (\`e40931d\`, \`880fe2e\`, and the team suggester on 2026-10-25)`.

In `Plans/NEXT-SESSION-PROMPT.md`:

1. In the first paragraph, change `**Stages 1 and 2 are built.** Your job is stage 3 (then 4 and 5)` to `**Stages 1 to 3 are built.** Your job is stage 4 (then 5)`.
2. In section 3, after the bullet that starts `- After that the owner added a public`, add: `- **Stage 3** (the team suggester: \`src/lib/suggest.ts\`, Suggest teams on the team board, the "Extra team from N players" setting in migration file 6, \`20261025000200_team_suggester.sql\`) built on 2026-10-25; see \`Plans/implementation/stage-3.md\`.`
3. In section 3, change `- **111 tests** pass` to `- **<the number npm test printed> tests** pass`, and change the bullet that starts `- **A real Supabase project exists, and all 5 migration files have been run on it**` to `- **A real Supabase project exists.** Files 1-5 have been run on it; the owner was asked to run file 6 before pushing stage 3. At the start, ask whether they have (multiple choice).`
4. In section 3, change `(stage 3 = \`20261026000100_<name>.sql\` or the date you build it)` to `(stage 4 = \`20261026000100_<name>.sql\` or the date you build it, sorting after file 6)`.
5. Replace section 7 with:

```markdown
## 7. Start now

1. Check the latest Vercel deployment (section 3) and report it in one line.
2. Ask (multiple choice) whether migration file 6 has been run on the live project.
3. Read everything in section 2, plus `Plans/implementation/stage-3.md`.
4. Write the stage 4 plan (punishments and loyalty points), summarise it in plain words, and ask for approval (multiple choice), offering to build it here, step by step, first.
```

Run: `npm test` once more and check the README test count matches.

---

### Task 6: Verify everything and hand over

**Files:**
- Temporary only, in the session's scratch folder (`$SCRATCH` below): `standin/` and `shots/`. Nothing here is added to the project.

- [ ] **Step 1: The four checks**

Run: `npx tsc -b && npm run lint && npm test && npm run build`
Expected: all pass. Note the number of tests for the report (and check the README says the same number).

- [ ] **Step 2: Rule greps**

```bash
grep -rnE "\b(text-white|bg-white)\b" src     # only SignIn and InstallScreen (logo lettering)
git diff --stat -- supabase/migrations/2026102300* supabase/migrations/20261024000100_nights.sql supabase/migrations/20261025000100_games.sql
```

Expected: the first lists only the two `<h1>`s; the second prints nothing (files 1-5 untouched).

- [ ] **Step 3: Start a temporary stand-in for Supabase**

The scripts `session.mjs`, `db.mjs`, `postgrest.conf`, `proxy.mjs` and `shots.mjs` are in `Plans/implementation/stage-2.md`, Task 11, Step 3. Copy them out of the plan with a small script (more reliable than retyping), from the project folder:

```bash
mkdir -p "$SCRATCH/standin" "$SCRATCH/shots/game" "$SCRATCH/tools"
cat > "$SCRATCH/tools/extract.mjs" <<'EOF'
// Copies the stand-in scripts out of stage-2.md Task 11 (the fenced block after each file name).
import { readFileSync, writeFileSync } from 'node:fs'
const [plan, out] = process.argv.slice(2)
const task = readFileSync(plan, 'utf8').split('### Task 11')[1]
for (const file of ['session.mjs', 'db.mjs', 'postgrest.conf', 'proxy.mjs', 'shots.mjs']) {
  const block = task.slice(task.indexOf('`' + file + '`')).match(/```[a-z]*\n([\s\S]*?)```/)[1]
  writeFileSync(`${out}/${file}`, block)
}
EOF
node "$SCRATCH/tools/extract.mjs" Plans/implementation/stage-2.md "$SCRATCH/standin"
cd "$SCRATCH/standin" && npm init -y && npm i @electric-sql/pglite@0.5 @electric-sql/pglite-socket playwright-core
curl -sLO https://github.com/PostgREST/postgrest/releases/download/v14.18/postgrest-v14.18-windows-x86-64.zip && unzip -o postgrest-*.zip
```

(If `pglite-socket`'s peer version doesn't match pglite 0.5, install the pglite version it asks for. On Windows, PostgREST 16 fails to start; use 14.18.)

Then write `$SCRATCH/standin/live.mjs` (new for this stage):

```js
// Starts the planned demo night with everyone checked in (the 15 demo
// players, Owner and Member: 17 at 6 a side), nothing on the team board.
// Prints the night's id. With "game": the first 12 by name go on Team A and
// Team B and game 1 starts, so Suggest teams has players on the pitch.
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

const players = await get('players?select=id,display_name&order=display_name')
if (process.argv[2] === 'game') {
  const [night] = await get('matches?status=eq.playing&select=id')
  const board = players.slice(0, 12).map((p, i) => ({ player_id: p.id, team: i < 6 ? 'A' : 'B' }))
  await rpc('set_team_board', { p_match_id: night.id, p_board: board })
  await rpc('start_game', { p_match_id: night.id, p_team_one: 'A', p_team_two: 'B', p_keeper_one: null, p_keeper_two: null })
  console.log('game 1 on', night.id)
} else {
  const [night] = await get('matches?status=eq.draft&select=id')
  await rpc('start_night', { p_match_id: night.id })
  for (const p of players) await rpc('check_in', { p_match_id: night.id, p_player_id: p.id })
  console.log('live night', night.id)
}
```

Start everything (each in the background). Port 5173 is often the owner's own `npm run dev`, so the stand-in app runs on **5180**; don't stop the owner's processes:

```bash
node "$SCRATCH/standin/db.mjs" "$PWD"
"$SCRATCH/standin/postgrest.exe" "$SCRATCH/standin/postgrest.conf"
node "$SCRATCH/standin/proxy.mjs"
VITE_SUPABASE_URL=http://localhost:54321 VITE_SUPABASE_PUBLISHABLE_KEY=stand-in VITE_ALLOW_BROWSER=true npx vite --port 5180 --strictPort
```

Then: `node "$SCRATCH/standin/live.mjs"` → prints the live night's id.

- [ ] **Step 4: Check every PostgREST embed (no `PGRST201`)**

```bash
cd "$SCRATCH/standin"
TOKEN=$(node -e "import('./session.mjs').then((m) => console.log(m.jwt()))")
for q in \
  "group_members?select=role,player_id,groups(id,name,invite_code,min_extra_team_size)" \
  "matches?select=*,games!games_match_id_fkey(*),goals(game_id,scoring_team,disputed),match_ratings(player_id,rating,is_mvp),match_players!match_players_match_id_fkey(player_id),rsvps(player_id,status,status_changed_at,waiting_since,promoted_at)" \
  "players?select=id,group_id,user_id,display_name,is_guest,happy_in_goal,profiles!players_user_id_fkey(avatar_url)" \
  "match_ratings?select=*,matches!inner(*)"; do
  curl -s -o /dev/null -w "%{http_code} $q\n" "http://localhost:54321/rest/v1/$q" -H "apikey: stand-in" -H "Authorization: Bearer $TOKEN"
done
for year in 2026 null; do
  curl -s -o /dev/null -w "%{http_code} rpc/get_leaderboard $year\n" -X POST "http://localhost:54321/rest/v1/rpc/get_leaderboard" \
    -H "apikey: stand-in" -H "Authorization: Bearer $TOKEN" -H "content-type: application/json" \
    -d "{\"p_group_id\": \"$(curl -s "http://localhost:54321/rest/v1/groups?select=id" -H "apikey: stand-in" -H "Authorization: Bearer $TOKEN" | node -pe 'JSON.parse(require("fs").readFileSync(0))[0].id')\", \"p_year\": $year}"
done
```

Expected: `200` on every line. On any other code, print the body; `PGRST201` means an ambiguous embed that needs a `!fkey_name` hint.

- [ ] **Step 5: Screens against the design**

```bash
cd "$SCRATCH/standin"
export MSYS_NO_PATHCONV=1
S="$SCRATCH/shots"; L=<live night id>
node shots.mjs http://localhost:5180 "$S" /nights/$L/teams /settings /how-it-works
CLICK="Suggest teams" node shots.mjs http://localhost:5180 "$S" /nights/$L/teams
AS=member node shots.mjs http://localhost:5180 "$S" /settings
CLICK="4" node shots.mjs http://localhost:5180 "$S" /settings
curl -s "http://localhost:54321/rest/v1/groups?select=min_extra_team_size" -H "apikey: stand-in" -H "Authorization: Bearer $TOKEN"   # [{"min_extra_team_size":4}]
CLICK="3" node shots.mjs http://localhost:5180 "$S/game" /settings                                                                # back to 3
node live.mjs game
CLICK="Suggest teams" node shots.mjs http://localhost:5180 "$S/game" /nights/$L/teams
```

Open each PNG and compare with the design (`Design/screens.html` in Edge at the same width, and `Design/README.md` sections 3-6):
- **Team board, before:** the white **Suggest teams** button (2 px ink border) under the title; the counts bar with Team A, B and C chips at 0; no average line yet.
- **Team board, after Suggest teams:** the notice "Fair teams from the ratings. Change anything you like, then tap Save teams."; counts **6 · 6 · 5** (17 at 6 a side, 5 left over ≥ 3); "Average rating · A x.x · B x.x · C x.x" with the three numbers close together; every row's picker set (bib colours, black text); Owner and Member (new, 6.0) placed like everyone else.
- **Team board during game 1:** the notice adds ", with the players on the pitch kept where they are"; the 12 on the pitch keep A and B, greyed out with "On the pitch · use Swap"; the other 5 on Team C.
- **Settings (admin):** a "Team suggester" card after Rating settings: "Extra team from **3 players**…", the 2-7 picker with 3 selected (green, black text). After `CLICK="4"`: 4 selected, the text says 4, and the database says 4.
- **Settings (member):** the same text, no picker.
- **How it works:** the "Suggest teams" bullet in the Games card, with "3 or more players left over".
- Every console line says `fits` (no sideways scrolling at 390 px); black text on every green surface; dark mode keeps the brand green, bib colours and rating bands; Arabic names (محمد) left-aligned.

Fix anything that doesn't match, then rerun Step 1. Stop the background processes when done.

- [ ] **Step 6: Report to the owner and ask about the commit**

Tell the owner in plain words:
- What was built (Suggest teams on the team board, team averages, the "Extra team from N players" setting) and how it was tested (the number of tests, the four checks, the screens checked, and anything that still looks off).
- The decisions this plan made (the list at the top of this file).
- **What they need to do, in order:** (1) run `supabase/migrations/20261025000200_team_suggester.sql` once in the Supabase SQL Editor (any time, even during a night); (2) only then push to GitHub, because every push updates the app on Vercel and the new app needs the new setting. Explain it in plain steps.
- What's still open: stage 4 (punishments and loyalty points), stage 5; the real-phone sign-in test and Google Publish (README section 3 and Step 6e), if not done yet.

Then ask with AskUserQuestion: "Commit stage 3 straight to main (Recommended)" — their usual — / "Commit on a new branch" / "Don't commit yet".

Commit only the stage's files, never the owner's own change:

```bash
git add supabase/migrations/20261025000200_team_suggester.sql supabase/seed.sql tests/db/teams.test.ts src README.md \
  Plans/implementation/stage-3.md Plans/README.md Plans/NEXT-SESSION-PROMPT.md
git status --short   # .env.example must still be unstaged
git commit -m "Build stage 3: team suggester and the extra-team setting"
```

(`Plans/README.md` and `Plans/NEXT-SESSION-PROMPT.md` also carry the hand-over edits from the end of stage 2, which were never committed; they belong with this commit. Say so in the question.)

End the commit message with the attribution line. Don't push unless asked. Add a "Changes made during the build" section to this file, and update the project-status memory (stage 3 built and committed; the owner must run file 6 before pushing).

---

## Spec coverage

| Requirement (spec) | Task |
|---|---|
| Who: everyone checked in and not marked as left, plus players per side (Football-scenario §5) | 3 |
| Fewer than 2n: two teams as even as possible (9 → 5 and 4) (§5) | 2 |
| Two teams of n; r ≥ `min_extra_team_size` left over make a third team (up to n); fewer are subs (§5) | 2 |
| "Another team if still ≥ 3 left over" | Decision 2: three teams at most (2) |
| `min_extra_team_size` group setting, default 3 (§5, §6) | 1 |
| Settings: "Extra team from N players", admins (§7; NEXT-SESSION-PROMPT §5) | 4 |
| Strength: season rating, then all-time, then 6.0; from stored ratings, no second calculation (§5, §10) | 2, 3 |
| Snake draft A, B, C, then back; pair swaps while they reduce the gap between the strongest and weakest averages (§5) | 2 |
| Goalkeepers not chosen by the suggester (§5) | 2 (not part of the output) |
| Pure TypeScript function with the four unit tests: 12 → 2 teams; 16 → 6/6/4; 13 → 6/6 + 1 sub; balanced output for known ratings (§5) | 2 |
| Suggest teams on the team board; the admin moves people before saving (§2.2, §7; NEXT-SESSION-PROMPT §5) | 3 |
| Players on the pitch during a game stay locked (NEXT-SESSION-PROMPT §5) | 2, 3 |
| New tables/columns: RLS, explicit grants, "cannot write directly / anon sees nothing" tests (NEXT-SESSION-PROMPT §4) | 1 |
| README, seed, How it works in sync; embeds; 390 px light/dark check; owner runs file 6 (NEXT-SESSION-PROMPT §5) | 4, 5, 6 |

Left for later stages on purpose: punishments, loyalty points and badges (stage 4); Team of the Night/Month, best duos and the results share (stage 5).
