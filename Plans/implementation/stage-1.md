# Stage 1: Nights — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Phase 1 app into **7GZ-KORA**: the new look, install-first access, and nights (plan a night, "I'm in" / "Out" with a waiting list, check-in at the pitch, end or cancel a night, the money card), plus sharing a planned or cancelled night to WhatsApp.

**Architecture:** A night stays a row in `matches` (status `draft` = planned, `playing`, `voting`, `closed`, plus the new `cancelled`). New database functions in a fourth migration file do all the writing and own the money rule (`night_payer_rows`), the same way `compute_match_ratings` owns ratings. The app gets pure TypeScript helpers (install decision, device detection, form defaults, share texts) tested with vitest, and new night screens built from small components. Stage 1 keeps Phase 1's single Team A / Team B lineup and goal logging inside a night; games, Team C and admin-only recording come in stage 2.

**Tech Stack:** React 19, TypeScript 6, Vite 8, vite-plugin-pwa 2, Tailwind 4, react-router 8, supabase-js 2, Postgres (Supabase), PGlite for database tests, vitest 5, `@fontsource/archivo` + `@fontsource/archivo-black` 5.3.

**Spec:** `Plans/README.md` (build order item 1), `Plans/Football-scenario.md` (sections 0, 2, 4, 6, 7), `Plans/Extras-and-backlog.md` (sections 1, 2, 5, 9), `Plans/Install-first-access.md` (all), `Design/README.md` (sections 2-9), `Design/screens.html`, `Design/tokens.css`. Rules from the root `CLAUDE.md`.

## Global Constraints

- App name: **7GZ-KORA** everywhere (home screen name, header, sign-in, README). The tagline "ZNOOG-EL AAST" appears only in logo files, never in the app.
- **Stay on Supabase.** Every table has Row Level Security; all writes go through `SECURITY DEFINER` functions; access is granted explicitly. Supabase grants new tables and functions to `anon`/`authenticated` by default, so every new table goes in file 1 (covered by file 3's revoke) and every new function is revoked/granted explicitly.
- **Money:** share = total cost ÷ number of players checked in, rounded **up** to a whole pound. The collector counts in the split and is paid automatically. People who said "I'm in" but never checked in pay nothing. **No other money features** (no fines, deposits, extra costs, hourly prices, debt history).
- **A night is still a row in `matches`.** Only the screens say "night".
- Ratings are unchanged in this stage and stay computed only in `compute_match_ratings`.
- **Text on the brand green `#00BF63` is always black.** White only in the large logo lettering (Install and Sign-in screens).
- **In a browser, the website shows only the Install screen.** Sign-in happens only inside the installed app. `VITE_ALLOW_BROWSER=true` is a development-only bypass and must never be set on Vercel.
- The public sees the name and logo only: no `<meta name="description">`, no manifest `description`, no `og:description`, `noindex, nofollow`, `robots.txt` hides the site from search engines.
- **Names can be Arabic:** wrap every name in `<Name>` (a `<bdi dir="auto">`) and keep them left-aligned in lists.
- Tap targets at least 48 px (small buttons 40 px only inside lists); pitch-side actions 64 px.
- Follow the existing code style: comment density, naming, small files. Error messages from the database are written for humans; the app shows them as-is.
- Checks that must pass at the end: `npx tsc -b`, `npm run lint`, `npm test`, `npm run build`.

## How this stage is run

- Nothing has been run on a real Supabase project yet, so the migration files may be edited in place. **Once the owner runs them on a real project, later stages must only add new files.**
- Commits: one commit at the end of the stage, after the owner chooses how (their usual: straight to `main`). Each task ends with a checkpoint (tests green) instead of a commit.
- Screen checks use a **temporary** local stand-in for Supabase in the session's scratch folder (Task 16). The owner chose not to keep one in the project.

## Decisions this plan makes (not covered by the plan files; flag them to the owner)

1. Paid ticks live in a small `night_payments` table instead of on `match_players`, because on a night cancelled before anyone arrived the people who pay (those who said "I'm in") were never checked in.
2. The share is worked out in the database (`night_payer_rows`), like ratings. The app only adds up totals.
3. Replies ("I'm in" / "Out") close when the night starts. Check-in is allowed while the night is on **and** while voting is open (to fix a forgotten player); the shares then recalculate.
4. Nobody can tick off their own payment, admins included. The collector is paid automatically.
5. The player limit defaults to 3 × players per side and follows the side size unless changed by hand. "No limit" is a tick box.
6. A cancelled night can't be un-cancelled (plan a new one). The "Other" reason needs a short note.
7. In stage 1 the team picker on the Teams screen is Out / A / B. Team C and the A/B/C team board come with games in stage 2; the `TeamTag` component already supports C.
8. `robots.txt` blocks search engines but lets link-preview bots (WhatsApp, Facebook, Telegram, X) read the page; otherwise shared links would show no name or logo.
9. `og:image` uses the production address automatically on Vercel (`VERCEL_PROJECT_PRODUCTION_URL`). The build stops with an error if `VITE_ALLOW_BROWSER=true` is set on Vercel.
10. The demo planned night has a 10-player limit, so the waiting list is visible.
11. "No reply" counts group members with an account (the people who can answer).

---

## File structure

**Database**

| File | Change |
|---|---|
| `supabase/migrations/20261023000100_schema.sql` | `matches` gains the night columns and the `cancelled` status; `match_players` gains `arrived_at`, `left_at`; new tables `rsvps`, `night_payments` with RLS. Header says "file 1 of 4". |
| `supabase/migrations/20261023000200_rating.sql` | Header only ("file 2 of 4", 7GZ-KORA). |
| `supabase/migrations/20261023000300_actions.sql` | New helper `require_night_open`; `apply_lineup` / `save_lineup` pick teams from checked-in players; `log_goal` refuses planned/cancelled nights; `create_match`, `update_match_details`, `finish_match` removed; grants updated. |
| `supabase/migrations/20261024000100_nights.sql` | **New.** All night actions: plan/edit, replies and waiting list, start, check-in, end, cancel, money, payments. |
| `supabase/seed.sql` | Demo nights with costs, collectors, check-in times, payments, a cancelled night and a planned night with a waiting list. |
| `tests/db/helpers.ts` | `setupGroup`, `nightDetails`, `startNight` shared by the tests. |
| `tests/db/nights.test.ts` | **New.** Every night rule and worked example. |
| `tests/db/flow.test.ts` | Uses nights instead of `create_match` / `finish_match`. |
| `tests/db/seed.test.ts` | Checks the new demo data. |

**App: logic (pure, tested with vitest)**

| File | Responsibility |
|---|---|
| `src/lib/access.ts` + `.test.ts` | `appMode()` (Install screen or app) and `inviteCodeFromUrl()` |
| `src/lib/installTarget.ts` + `.test.ts` | Which install steps to show for a user agent |
| `src/lib/night.ts` + `.test.ts` | Plan-a-night form defaults, form ↔ details, `withSide`, `rsvpSummary` |
| `src/lib/money.ts` + `.test.ts` | `moneyTotals`, `isPaid` |
| `src/lib/share.ts` + `.test.ts` | WhatsApp texts for a planned and a cancelled night, `shareText` |
| `src/lib/format.ts` + `format.test.ts` | + `dayOf`, `clockOf`, `formatNightWhen`, `formatLength`, `nightFacts`, `CANCEL_REASONS`; `ratingTone` returns the new bands |
| `src/lib/types.ts` | Night fields, `Rsvp`, `CheckIn`, `NightDetails`, `NightForm`, `Payer`, `MoneyOwed`, `Bib` |
| `src/lib/api.ts` | Night, reply, check-in, money calls; old match calls removed |

**App: look and screens**

| File | Responsibility |
|---|---|
| `src/index.css` | Design tokens, fonts, Tailwind mapping, component classes (`btn`, `chip`, `seg`, rating bands…) |
| `src/components/ui.tsx` | Restyled building blocks + `ShareButton` |
| `src/components/match.tsx` | Scoreboard with chips on top, bib-coloured player grid |
| `src/components/Layout.tsx` | Honeycomb header, new tabs (Nights) |
| `src/components/rsvp.tsx` | **New.** `RsvpCard`, `RsvpLists` |
| `src/components/checkin.tsx` | **New.** `CheckInList` (admins), `WhoIsHere` |
| `src/components/money.tsx` | **New.** `MoneyCard` |
| `src/components/cancel.tsx` | **New.** `CancelNightForm`, `CancelledNotice` |
| `src/components/results.tsx` | **New (moved from MatchPage).** `VotingCard`, `Results`, `Breakdown`, `VoteProgress` |
| `src/pages/InstallScreen.tsx` | **New.** All the website shows in a browser |
| `src/pages/PlanNight.tsx` | **New.** Plan or edit a night |
| `src/pages/Teams.tsx` | **Renamed from MatchEdit.tsx**, lineup only, checked-in players only |
| `src/pages/NightPage.tsx` | **Renamed from MatchPage.tsx**, one page for every night status |
| `src/pages/Nights.tsx` | **Renamed from Matches.tsx** |
| `src/pages/Home.tsx` | Planned night with I'm in / Out, live night, You owe, voting, top 3 |
| `src/App.tsx` | Install gate, `/nights/...` routes, restyled splash |
| Deleted | `src/pages/Install.tsx`, `src/components/InstallGuide.tsx` |
| Small edits | `SignIn`, `JoinOrCreate`, `Recorder`, `Vote`, `Leaderboard`, `PlayerProfile`, `Settings`, `HowItWorks`, `storage.ts`, `pwa.ts` |

**Brand, PWA and docs**

| File | Change |
|---|---|
| `package.json` | name `7gz-kora`; Archivo fonts in, Barlow out |
| `public/` | New icons, `app-icon.svg`, `logo.svg` (white mark), `mark-green.svg`, `robots.txt` |
| `pwa-assets.config.ts` | Builds the icons from `public/app-icon.svg`, no padding |
| `vite.config.ts` | Manifest renamed, no description, `#00BF63`; `__SITE_URL__` for `og:image`; refuses `VITE_ALLOW_BROWSER` on Vercel |
| `index.html` | Title, robots, Open Graph, theme colour |
| `.env.example` | Documents `VITE_ALLOW_BROWSER` |
| `README.md` | Rename, 4 SQL files, install-first, nights, money, choices, tests |

---

## Part A — Database

### Task 1: Night columns, new tables, plan and edit a night

**Files:**
- Modify: `supabase/migrations/20261023000100_schema.sql` (header lines 1-18; `matches` table lines 96-124; RLS section lines 310-379)
- Modify: `supabase/migrations/20261023000200_rating.sql:1-2` and `supabase/migrations/20261023000300_actions.sql:1-2` (headers)
- Create: `supabase/migrations/20261024000100_nights.sql`
- Modify: `tests/db/helpers.ts` (append), `tests/db/flow.test.ts:17-41` (use the shared `setupGroup`)
- Test: `tests/db/nights.test.ts`

**Interfaces:**
- Produces (SQL): `plan_night(p_group_id uuid, p_night jsonb) returns uuid`, `update_night(p_match_id uuid, p_night jsonb) returns void`. `p_night` keys: `played_at` (date text), `starts_at` (ISO timestamp), `location`, `duration_minutes`, `cost`, `players_per_side`, `collector_player_id` (uuid or null), `game_minutes`, `player_cap` (int or null = no limit).
- Produces (tests): `setupGroup(db, names?)` → `{ groupId, code, users: Record<string, string>, pid(userId) }`; `nightDetails(overrides?)`; `startNight(db, admin, groupId, playerIds, details?)` → night id.

- [ ] **Step 1: Move `setupGroup` into the helpers and add the night helpers**

Append to `tests/db/helpers.ts`:

```ts
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
```

In `tests/db/flow.test.ts`, delete the local `setupGroup` function (lines 17-37), change the import to `import { createDb, createUser, rpc, selectAs, setupGroup } from './helpers'`, and replace every `await setupGroup()` with `await setupGroup(db)`.

- [ ] **Step 2: Write the failing tests**

Create `tests/db/nights.test.ts`:

```ts
// Tests for nights (supabase/migrations/20261024000100_nights.sql): planning,
// "I'm in" / "Out" and the waiting list, check-in, ending or cancelling a
// night, and the money split. Acting as real signed-in users with RLS on.
// The worked examples come from Plans/Football-scenario.md and
// Plans/Extras-and-backlog.md.
import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDb, createUser, nightDetails, rpc, selectAs, setupGroup, startNight } from './helpers'

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

async function planNight(admin: string, groupId: string, overrides: Record<string, unknown> = {}) {
  const [{ plan_night: id }] = await rpc<{ plan_night: string }>(db, admin, 'plan_night', {
    p_group_id: groupId,
    p_night: nightDetails(overrides),
  })
  return id
}

type NightRow = {
  status: string
  location: string
  cost: string
  players_per_side: number
  collector_player_id: string | null
  player_cap: number | null
  starts_at: Date
  cancel_reason: string | null
}

async function night(user: string, matchId: string): Promise<NightRow> {
  const [row] = await selectAs<NightRow>(db, user, `select * from matches where id = $1`, [matchId])
  return row
}

describe('planning a night', () => {
  it('admins plan a night that every member can see', async () => {
    const { groupId, users, pid } = await setupGroup(db)
    await expectError(planNight(users.Omar, groupId), /Only group admins/)

    const id = await planNight(users.admin, groupId, { collector_player_id: pid(users.Ziad) })
    const n = await night(users.Omar, id)
    expect(n.status).toBe('draft')
    expect(n.location).toBe('Club pitch 3')
    expect(Number(n.cost)).toBe(600)
    expect(n.players_per_side).toBe(6)
    expect(n.player_cap).toBe(18)
    expect(n.collector_player_id).toBe(pid(users.Ziad))
    expect(new Date(n.starts_at).toISOString()).toBe('2026-10-29T18:00:00.000Z')
  })

  it('checks the details with friendly messages', async () => {
    const { groupId, users } = await setupGroup(db)
    const other = await setupGroup(db)
    await expectError(planNight(users.admin, groupId, { players_per_side: 4 }), /between 5 and 11/)
    await expectError(planNight(users.admin, groupId, { cost: -1 }), /cost/)
    await expectError(planNight(users.admin, groupId, { player_cap: 1 }), /player limit/)
    await expectError(planNight(users.admin, groupId, { starts_at: null }), /date and start time/)
    await expectError(
      planNight(users.admin, groupId, { collector_player_id: other.pid(other.users.Omar) }),
      /collector must be a player in this group/,
    )
  })

  it('admins edit a night, including "no limit"', async () => {
    const { groupId, users } = await setupGroup(db)
    const id = await planNight(users.admin, groupId)
    await expectError(
      rpc(db, users.Omar, 'update_night', { p_match_id: id, p_night: nightDetails() }),
      /Only group admins/,
    )
    await rpc(db, users.admin, 'update_night', {
      p_match_id: id,
      p_night: nightDetails({ location: 'Pitch 5', cost: 700, player_cap: null }),
    })
    const n = await night(users.Omar, id)
    expect(n.location).toBe('Pitch 5')
    expect(Number(n.cost)).toBe(700)
    expect(n.player_cap).toBeNull()
  })
})
```

- [ ] **Step 3: Run the tests to see them fail**

Run: `npx vitest run tests/db/nights.test.ts`
Expected: FAIL with `function public.plan_night(...) does not exist`.

- [ ] **Step 4: Change the schema (file 1)**

In `supabase/migrations/20261023000100_schema.sql`, replace lines 1-5 of the header with:

```sql
-- =============================================================================
-- 7GZ-KORA: database schema (file 1 of 4)
--
-- Tables, helper functions and Row Level Security (RLS).
-- Run the files in supabase/migrations in order (1 to 4) in the Supabase
```

Replace the section from `-- Matches, attendance and stints (lineups)` down to the end of `create table public.match_players (...)` (lines 96-124) with:

```sql
-- -----------------------------------------------------------------------------
-- Nights, check-in and stints (lineups)
-- -----------------------------------------------------------------------------
-- A night is one pitch booking (about 2 hours). Only the screens say "night";
-- in the database a night is a row in matches.
create table public.matches (
  id                  uuid primary key default gen_random_uuid(),
  group_id            uuid not null references public.groups (id) on delete cascade,
  -- The night's date. The season is the calendar year of this date.
  played_at           date not null default current_date,
  -- Planned start time (check-in times are compared with it later, for lateness).
  starts_at           timestamptz,
  -- The pitch: a name or a place.
  location            text check (char_length(location) <= 80),
  duration_minutes    int not null default 120 check (duration_minutes between 15 and 600),
  -- Total pitch cost, split equally among everyone checked in (file 4: night_payer_rows).
  cost                numeric not null default 0 check (cost between 0 and 100000),
  currency            text not null default 'EGP',
  -- Everyone pays their share to this player, who pays the pitch owner.
  collector_player_id uuid references public.players (id) on delete set null,
  players_per_side    int not null default 6 check (players_per_side between 5 and 11),
  -- Default game length in minutes (a guide for the timer in stage 2).
  game_minutes        int not null default 10 check (game_minutes between 1 and 120),
  -- "I'm in" beyond this many puts people on the waiting list. NULL = no limit.
  player_cap          int check (player_cap between 2 and 100),
  -- draft:     planned; players reply "I'm in" or "Out"
  -- playing:   the night is on: check-in, teams, goals
  -- voting:    the night is over, players are voting
  -- closed:    voting over, ratings are final
  -- cancelled: called off; nothing counts (no votes, no ratings)
  status              text not null default 'draft'
                      check (status in ('draft', 'playing', 'voting', 'closed', 'cancelled')),
  voting_closes_at    timestamptz,
  closed_at           timestamptz,
  cancel_reason       text check (cancel_reason in ('rain', 'not_enough_players', 'pitch_problem', 'other')),
  cancel_note         text check (char_length(cancel_note) <= 200),
  -- What the pitch still charges for a cancelled night (a lost deposit or fee).
  cancel_fee          numeric not null default 0 check (cancel_fee >= 0),
  cancelled_at        timestamptz,
  created_by          uuid references public.profiles (id) on delete set null,
  created_at          timestamptz not null default now()
);

create index matches_group_idx on public.matches (group_id, played_at desc);

-- Who was checked in at the pitch: they play, vote and pay. Votes and goals
-- can only reference players listed here.
create table public.match_players (
  match_id   uuid not null references public.matches (id) on delete cascade,
  player_id  uuid not null references public.players (id) on delete cascade,
  arrived_at timestamptz not null default now(),
  -- Set when someone leaves early. They still count for the night (and the money).
  left_at    timestamptz,
  primary key (match_id, player_id)
);
```

Insert this section just before `-- Audit log: a simple record of edits` (keep its dashed line above it):

```sql
-- -----------------------------------------------------------------------------
-- Replies ("I'm in" / "Out") and rent payments
-- -----------------------------------------------------------------------------
-- One reply per player per planned night. Who actually came is match_players.
create table public.rsvps (
  match_id          uuid not null references public.matches (id) on delete cascade,
  player_id         uuid not null references public.players (id) on delete cascade,
  -- in: coming · waiting: on the waiting list (the night was full) · out: not coming
  status            text not null check (status in ('in', 'waiting', 'out')),
  -- When the status last changed (for "late cancel" in the punishments stage).
  status_changed_at timestamptz not null default now(),
  -- Place on the waiting list: when they tapped "I'm in" on a full night.
  waiting_since     timestamptz,
  -- When they moved up from the waiting list ("You're in!").
  promoted_at       timestamptz,
  -- On an "out": the waiting-list player who took this spot, if anyone did.
  spot_taken_by     uuid,
  primary key (match_id, player_id)
);

-- A tick per player who has paid their share back to the night's collector.
create table public.night_payments (
  match_id  uuid not null references public.matches (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  paid_at   timestamptz not null default now(),
  -- Who ticked it (the collector or an admin).
  marked_by uuid references public.profiles (id) on delete set null,
  primary key (match_id, player_id)
);
```

In the Row Level Security section, add after `alter table public.match_players enable row level security;`:

```sql
alter table public.rsvps          enable row level security;
alter table public.night_payments enable row level security;
```

and after the policy `"members read saves"`:

```sql
create policy "members read replies" on public.rsvps
  for select to authenticated using (public.is_group_member(public.match_group_id(match_id)));
create policy "members read payments" on public.night_payments
  for select to authenticated using (public.is_group_member(public.match_group_id(match_id)));
```

Change line 2 of `20261023000200_rating.sql` to `-- 7GZ-KORA: rating system (file 2 of 4)` and line 2 of `20261023000300_actions.sql` to `-- 7GZ-KORA: app actions (file 3 of 4)`.

- [ ] **Step 5: Create file 4 with planning and editing**

Create `supabase/migrations/20261024000100_nights.sql`:

```sql
-- =============================================================================
-- 7GZ-KORA: nights (file 4 of 4)
--
-- Planning a night, "I'm in" / "Out" with a waiting list, check-in at the
-- pitch, ending or cancelling a night, and the rent split
-- (Plans/Football-scenario.md sections 2 and 4, Plans/Extras-and-backlog.md
-- sections 1 and 2).
--
-- A night is still a row in matches. Statuses: draft (planned), playing,
-- voting, closed, cancelled. Same style as file 3: the app calls these
-- functions, which check permissions and write in one transaction.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Planning
-- -----------------------------------------------------------------------------

-- Checks and writes a night's details (used by plan_night and update_night).
-- p_night: {"played_at": "2026-10-29", "starts_at": "2026-10-29T18:00:00Z",
--           "location": "Club pitch 3", "duration_minutes": 120, "cost": 600,
--           "players_per_side": 6, "collector_player_id": "...",
--           "game_minutes": 10, "player_cap": 18}     (player_cap null = no limit)
create function public.write_night_details(p_match_id uuid, p_group_id uuid, p_night jsonb)
returns void
language plpgsql set search_path = ''
as $$
declare
  v_night     jsonb := coalesce(p_night, '{}'::jsonb);
  v_collector uuid := nullif(v_night ->> 'collector_player_id', '')::uuid;
  v_cost      numeric := coalesce((v_night ->> 'cost')::numeric, 0);
  v_side      int := coalesce((v_night ->> 'players_per_side')::int, 6);
  v_length    int := coalesce((v_night ->> 'duration_minutes')::int, 120);
  v_game      int := coalesce((v_night ->> 'game_minutes')::int, 10);
  v_cap       int := (v_night ->> 'player_cap')::int;
begin
  if (v_night ->> 'played_at') is null or (v_night ->> 'starts_at') is null then
    raise exception 'Pick a date and start time.';
  end if;
  if v_cost < 0 or v_cost > 100000 then
    raise exception 'The cost must be between 0 and 100000.';
  end if;
  if v_side not between 5 and 11 then
    raise exception 'Players per side must be between 5 and 11.';
  end if;
  if v_length not between 15 and 600 then
    raise exception 'The booking must last between 15 minutes and 10 hours.';
  end if;
  if v_game not between 1 and 120 then
    raise exception 'A game must last between 1 and 120 minutes.';
  end if;
  if v_cap is not null and v_cap not between 2 and 100 then
    raise exception 'The player limit must be between 2 and 100 (or no limit).';
  end if;
  if v_collector is not null
     and not exists (select 1 from public.players p where p.id = v_collector and p.group_id = p_group_id) then
    raise exception 'The collector must be a player in this group.';
  end if;

  update public.matches
  set played_at           = (v_night ->> 'played_at')::date,
      starts_at           = (v_night ->> 'starts_at')::timestamptz,
      location            = left(nullif(trim(v_night ->> 'location'), ''), 80),
      duration_minutes    = v_length,
      cost                = v_cost,
      players_per_side    = v_side,
      collector_player_id = v_collector,
      game_minutes        = v_game,
      player_cap          = v_cap
  where id = p_match_id;
end;
$$;

-- Plans a night (admins). Everyone can then reply "I'm in" or "Out".
create function public.plan_night(p_group_id uuid, p_night jsonb)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_match uuid;
begin
  perform public.require_admin(p_group_id);

  insert into public.matches (group_id, status, created_by)
  values (p_group_id, 'draft', auth.uid())
  returning id into v_match;

  perform public.write_night_details(v_match, p_group_id, p_night);
  perform public.write_audit(p_group_id, 'night_planned', jsonb_build_object('match_id', v_match));
  return v_match;
end;
$$;

-- Edits a night's details (admins). Works in any status, so a cost or
-- collector can still be fixed after the night.
create function public.update_night(p_match_id uuid, p_night jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_match public.matches := public.load_match(p_match_id);
begin
  perform public.require_admin(v_match.group_id);
  perform 1 from public.matches m where m.id = p_match_id for update;

  perform public.write_night_details(p_match_id, v_match.group_id, p_night);
  perform public.write_audit(v_match.group_id, 'night_changed',
    jsonb_build_object('match_id', p_match_id, 'night', p_night));
end;
$$;


-- =============================================================================
-- Permissions (same rules as the end of file 3). Internal helpers stay
-- private; the app actions are for signed-in users.
-- =============================================================================
revoke execute on function
  public.write_night_details(uuid, uuid, jsonb),
  public.plan_night(uuid, jsonb),
  public.update_night(uuid, jsonb)
from public, anon, authenticated;

grant execute on function
  public.plan_night(uuid, jsonb),
  public.update_night(uuid, jsonb)
to authenticated;

grant execute on all functions in schema public to service_role;
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run tests/db/nights.test.ts` → Expected: PASS (3 tests).
Run: `npm test` → Expected: all test files pass (26 old tests + 3 new).

---

### Task 2: "I'm in" / "Out" and the waiting list

**Files:**
- Modify: `supabase/migrations/20261024000100_nights.sql` (add a section before Permissions; `update_night` gains one call; permission lists)
- Test: `tests/db/nights.test.ts` (append a `describe`)

**Interfaces:**
- Consumes: `plan_night`, `update_night` (Task 1).
- Produces (SQL): `set_rsvp(p_match_id uuid, p_status text) returns text` (`'in' | 'waiting' | 'out'`); internal `night_has_space(uuid) returns boolean`, `promote_waiting(uuid) returns uuid` (the first player moved up, or null).

- [ ] **Step 1: Write the failing tests**

Append to `tests/db/nights.test.ts`:

```ts
async function reply(user: string, matchId: string, status: 'in' | 'out') {
  const [{ set_rsvp }] = await rpc<{ set_rsvp: string }>(db, user, 'set_rsvp', { p_match_id: matchId, p_status: status })
  return set_rsvp
}

type Reply = { player_id: string; status: string; promoted_at: Date | null; spot_taken_by: string | null }

async function replies(user: string, matchId: string) {
  return selectAs<Reply>(db, user, `select * from rsvps where match_id = $1`, [matchId])
}

describe('"I\'m in" / "Out" and the waiting list', () => {
  it('members answer for themselves and can change their mind', async () => {
    const { groupId, users, pid } = await setupGroup(db)
    const id = await planNight(users.admin, groupId)
    expect(await reply(users.Omar, id, 'in')).toBe('in')
    expect(await reply(users.Ziad, id, 'out')).toBe('out')
    expect(await reply(users.Omar, id, 'out')).toBe('out')
    expect(await reply(users.Omar, id, 'in')).toBe('in')

    const rows = await replies(users['محمد'], id)
    expect(rows.find((r) => r.player_id === pid(users.Omar))!.status).toBe('in')
    expect(rows.find((r) => r.player_id === pid(users.Ziad))!.status).toBe('out')

    const stranger = await createUser(db, 'Stranger')
    await expectError(reply(stranger, id, 'in'), /not a member/)
    await expectError(rpc(db, users.Omar, 'set_rsvp', { p_match_id: id, p_status: 'maybe' }), /Reply "in" or "out"/)
  })

  it('a full night puts people on the waiting list, first come first served', async () => {
    const { groupId, users, pid } = await setupGroup(db, ['A', 'B', 'C', 'D', 'E'])
    const id = await planNight(users.admin, groupId, { player_cap: 3 })
    for (const name of ['A', 'B', 'C']) expect(await reply(users[name], id, 'in')).toBe('in')
    expect(await reply(users.D, id, 'in')).toBe('waiting')
    expect(await reply(users.E, id, 'in')).toBe('waiting')
    // Tapping "I'm in" again keeps your place.
    expect(await reply(users.D, id, 'in')).toBe('waiting')

    // B drops out: D, first on the list, moves up and took B's spot.
    await reply(users.B, id, 'out')
    let rows = await replies(users.A, id)
    const row = (name: string) => rows.find((r) => r.player_id === pid(users[name]))!
    expect(row('D').status).toBe('in')
    expect(row('D').promoted_at).not.toBeNull()
    expect(row('B').spot_taken_by).toBe(pid(users.D))
    expect(row('E').status).toBe('waiting')

    // E leaves the waiting list: nobody's spot is involved.
    await reply(users.E, id, 'out')
    // B changes their mind, but the night is full again: back of the list.
    expect(await reply(users.B, id, 'in')).toBe('waiting')

    // The admin raises the limit: B moves up.
    await rpc(db, users.admin, 'update_night', { p_match_id: id, p_night: nightDetails({ player_cap: 5 }) })
    rows = await replies(users.A, id)
    expect(row('B').status).toBe('in')
    expect(row('E').status).toBe('out')
    expect(row('E').spot_taken_by).toBeNull()
  })

  it('no limit means no waiting list', async () => {
    const { groupId, users } = await setupGroup(db, ['A', 'B', 'C'])
    const id = await planNight(users.admin, groupId, { player_cap: null })
    for (const name of ['A', 'B', 'C']) expect(await reply(users[name], id, 'in')).toBe('in')
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/db/nights.test.ts -t "waiting list"` → Expected: FAIL (`set_rsvp` does not exist).

- [ ] **Step 3: Add the replies section to file 4**

Insert before the `-- Permissions` block:

```sql
-- -----------------------------------------------------------------------------
-- Replies: "I'm in" / "Out", with a waiting list when the night is full
-- -----------------------------------------------------------------------------

-- True while fewer people are "in" than the night's player limit.
create function public.night_has_space(p_match_id uuid)
returns boolean
language sql stable set search_path = ''
as $$
  select m.player_cap is null
         or (select count(*) from public.rsvps r where r.match_id = m.id and r.status = 'in') < m.player_cap
  from public.matches m
  where m.id = p_match_id;
$$;

-- Moves people up from the waiting list, in the order they joined it, while
-- there is space. Returns the first player moved up (or null).
create function public.promote_waiting(p_match_id uuid)
returns uuid
language plpgsql set search_path = ''
as $$
declare
  v_first uuid;
  v_next  uuid;
begin
  loop
    exit when not public.night_has_space(p_match_id);

    select r.player_id into v_next
    from public.rsvps r
    where r.match_id = p_match_id and r.status = 'waiting'
    order by r.waiting_since, r.player_id
    limit 1;
    exit when v_next is null;

    update public.rsvps
    set status = 'in', status_changed_at = now(), promoted_at = now(), waiting_since = null
    where match_id = p_match_id and player_id = v_next;

    v_first := coalesce(v_first, v_next);
    v_next := null;
  end loop;
  return v_first;
end;
$$;

-- "I'm in" / "Out" for the calling player, while the night is planned.
-- On a full night "I'm in" joins the waiting list. When someone who was in
-- says "Out", the first person on the waiting list moves up automatically.
-- Returns the caller's new status: in, waiting or out.
create function public.set_rsvp(p_match_id uuid, p_status text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_match public.matches;
  v_me    uuid;
  v_old   text;
  v_new   text;
begin
  -- Lock the night so two people taking the last spot at once can't both get it.
  select * into v_match from public.matches m where m.id = p_match_id for update;
  if not found then
    raise exception 'Night not found.';
  end if;
  v_me := public.require_member(v_match.group_id);

  if p_status is null or p_status not in ('in', 'out') then
    raise exception 'Reply "in" or "out".';
  end if;
  if v_match.status <> 'draft' then
    raise exception 'Replies are closed: this night has started, finished or been cancelled.';
  end if;

  select r.status into v_old from public.rsvps r
  where r.match_id = p_match_id and r.player_id = v_me;

  -- Tapping the same answer again changes nothing (and keeps your place).
  if (p_status = 'in' and v_old in ('in', 'waiting')) or (p_status = 'out' and v_old = 'out') then
    return v_old;
  end if;

  v_new := case
    when p_status = 'out' then 'out'
    when public.night_has_space(p_match_id) then 'in'
    else 'waiting'
  end;

  insert into public.rsvps (match_id, player_id, status, status_changed_at, waiting_since)
  values (p_match_id, v_me, v_new, now(), case when v_new = 'waiting' then now() end)
  on conflict (match_id, player_id) do update
  set status = excluded.status,
      status_changed_at = excluded.status_changed_at,
      waiting_since = excluded.waiting_since,
      promoted_at = null,
      spot_taken_by = null;

  -- A spot opened up: the first person on the waiting list takes it.
  if v_old = 'in' then
    update public.rsvps
    set spot_taken_by = public.promote_waiting(p_match_id)
    where match_id = p_match_id and player_id = v_me;
  end if;

  return v_new;
end;
$$;
```

In `update_night`, add after `perform public.write_night_details(...)`:

```sql
  -- A higher player limit lets people on the waiting list move up.
  if v_match.status = 'draft' then
    perform public.promote_waiting(p_match_id);
  end if;
```

In the Permissions block, add to the `revoke` list: `public.night_has_space(uuid),`, `public.promote_waiting(uuid),`, `public.set_rsvp(uuid, text),` and to the `grant ... to authenticated` list: `public.set_rsvp(uuid, text)`.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/db/nights.test.ts` → Expected: PASS (6 tests).

---

### Task 3: Start a night, check-in, and teams/goals during a night

**Files:**
- Modify: `supabase/migrations/20261023000300_actions.sql` (`load_match` message line 74; new helper after `normalize_invite_code`; `apply_lineup` lines 300-386; `create_match` lines 388-406 deleted; `save_lineup` lines 408-424; `update_match_details` lines 426-441 deleted; `log_goal` lines 464-484; grants lines 947-949)
- Modify: `supabase/migrations/20261024000100_nights.sql` (new section; permission lists)
- Modify: `tests/db/flow.test.ts` (night creation instead of `create_match`)
- Test: `tests/db/nights.test.ts` (append)

**Interfaces:**
- Consumes: `plan_night`, `set_rsvp`.
- Produces (SQL): `start_night(uuid)`, `check_in(p_match_id uuid, p_player_id uuid)`, `check_out(uuid, uuid)`, `undo_check_in(uuid, uuid)`; `require_night_open(public.matches)` (internal, file 3); `apply_lineup(p_match_id uuid, p_lineup jsonb)` (was 3 arguments); `save_lineup(uuid, jsonb)` unchanged signature.

- [ ] **Step 1: Write the failing tests**

Append to `tests/db/nights.test.ts`:

```ts
type CheckInRow = { arrived_at: Date; left_at: Date | null }

describe('at the pitch: start and check-in', () => {
  it('only admins start a night, once; replies close', async () => {
    const { groupId, users } = await setupGroup(db)
    const id = await planNight(users.admin, groupId)
    await expectError(rpc(db, users.Omar, 'start_night', { p_match_id: id }), /Only group admins/)
    await rpc(db, users.admin, 'start_night', { p_match_id: id })
    expect((await night(users.Omar, id)).status).toBe('playing')
    await expectError(rpc(db, users.admin, 'start_night', { p_match_id: id }), /already started/)
    await expectError(reply(users.Omar, id, 'in'), /Replies are closed/)
  })

  it('admins check in anyone in the group, and mark who left early', async () => {
    const { groupId, users, pid } = await setupGroup(db)
    const id = await planNight(users.admin, groupId)
    await expectError(
      rpc(db, users.admin, 'check_in', { p_match_id: id, p_player_id: pid(users.Omar) }),
      /Start the night first/,
    )
    await rpc(db, users.admin, 'start_night', { p_match_id: id })
    await expectError(
      rpc(db, users.Omar, 'check_in', { p_match_id: id, p_player_id: pid(users.Omar) }),
      /Only group admins/,
    )

    // Ziad never replied but came: he can still be checked in.
    await rpc(db, users.admin, 'check_in', { p_match_id: id, p_player_id: pid(users.Ziad) })
    const ziad = async () =>
      (await selectAs<CheckInRow>(db, users.Omar,
        `select arrived_at, left_at from match_players where match_id = $1 and player_id = $2`,
        [id, pid(users.Ziad)]))[0]
    const arrived = (await ziad()).arrived_at
    expect(arrived).not.toBeNull()

    await rpc(db, users.admin, 'check_out', { p_match_id: id, p_player_id: pid(users.Ziad) })
    expect((await ziad()).left_at).not.toBeNull()
    // Back again: no longer marked as left, arrival time unchanged.
    await rpc(db, users.admin, 'check_in', { p_match_id: id, p_player_id: pid(users.Ziad) })
    expect((await ziad()).left_at).toBeNull()
    expect((await ziad()).arrived_at).toEqual(arrived)

    const other = await setupGroup(db)
    await expectError(
      rpc(db, users.admin, 'check_in', { p_match_id: id, p_player_id: other.pid(other.users.Omar) }),
      /not in this group/,
    )
    await expectError(
      rpc(db, users.admin, 'check_out', { p_match_id: id, p_player_id: pid(users.Omar) }),
      /not checked in/,
    )
  })

  it('a check-in made by mistake can be undone, unless they already scored', async () => {
    const { groupId, users, pid } = await setupGroup(db)
    const id = await startNight(db, users.admin, groupId, [pid(users.Omar), pid(users.Ziad), pid(users['محمد'])])
    await rpc(db, users.admin, 'save_lineup', {
      p_match_id: id,
      p_lineup: [{ player_id: pid(users.Omar), team: 'A' }, { player_id: pid(users.Ziad), team: 'B' }],
    })
    await rpc(db, users.admin, 'log_goal', { p_match_id: id, p_scorer_id: pid(users.Ziad), p_assister_id: null })
    await expectError(
      rpc(db, users.admin, 'undo_check_in', { p_match_id: id, p_player_id: pid(users.Ziad) }),
      /scored or assisted/,
    )
    await rpc(db, users.admin, 'undo_check_in', { p_match_id: id, p_player_id: pid(users['محمد']) })
    expect(await selectAs(db, users.Omar, `select player_id from match_players where match_id = $1`, [id])).toHaveLength(2)
  })

  it('teams are picked from the players checked in; the rest are on the bench', async () => {
    const { groupId, users, pid } = await setupGroup(db)
    const id = await planNight(users.admin, groupId)
    const lineup = [{ player_id: pid(users.Omar), team: 'A' }, { player_id: pid(users.Ziad), team: 'B' }]
    await expectError(rpc(db, users.admin, 'save_lineup', { p_match_id: id, p_lineup: lineup }), /Start the night first/)
    await expectError(
      rpc(db, users.admin, 'log_goal', { p_match_id: id, p_scorer_id: pid(users.Omar), p_assister_id: null }),
      /Start the night/,
    )
    await rpc(db, users.admin, 'start_night', { p_match_id: id })
    await rpc(db, users.admin, 'check_in', { p_match_id: id, p_player_id: pid(users.Omar) })
    await expectError(rpc(db, users.admin, 'save_lineup', { p_match_id: id, p_lineup: lineup }), /Check in Ziad first/)

    await rpc(db, users.admin, 'check_in', { p_match_id: id, p_player_id: pid(users.Ziad) })
    await rpc(db, users.admin, 'check_in', { p_match_id: id, p_player_id: pid(users['محمد']) })
    await rpc(db, users.admin, 'save_lineup', { p_match_id: id, p_lineup: lineup })
    // محمد is on the bench but still part of the night.
    expect(await selectAs(db, users.Omar, `select player_id from match_players where match_id = $1`, [id])).toHaveLength(3)
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/db/nights.test.ts -t "at the pitch"` → Expected: FAIL (`start_night` does not exist).

- [ ] **Step 3: Change file 3**

In `load_match`, change `raise exception 'Match not found.';` to `raise exception 'Night not found.';`.

Add after `normalize_invite_code` (end of the internal helpers section):

```sql
-- Check-in and teams are allowed while the night is on, and while voting is
-- open (to fix a mistake). Raises a friendly error otherwise.
create function public.require_night_open(p_match public.matches)
returns void
language plpgsql stable set search_path = ''
as $$
begin
  case p_match.status
    when 'draft' then raise exception 'Start the night first.';
    when 'cancelled' then raise exception 'This night was cancelled.';
    when 'closed' then raise exception 'Voting is closed, so this night is final.';
    else null;
  end case;
end;
$$;
```

Replace the section heading `-- Matches and lineups` with `-- Lineups (teams during a night)` and replace `apply_lineup` with:

```sql
-- Writes the lineup of the current (latest) stint. Everyone in it must be
-- checked in; checked-in players left out of it are on the bench.
-- p_lineup: [{"player_id": "...", "team": "A", "is_goalkeeper": false}, ...]
create function public.apply_lineup(p_match_id uuid, p_lineup jsonb)
returns void
language plpgsql set search_path = ''
as $$
declare
  v_lineup jsonb := coalesce(p_lineup, '[]'::jsonb);
  v_ids    uuid[];
  v_stint  uuid;
  v_names  text;
begin
  if jsonb_typeof(v_lineup) <> 'array' then
    raise exception 'The lineup must be a list of players.';
  end if;

  select coalesce(array_agg((e ->> 'player_id')::uuid), '{}') into v_ids
  from jsonb_array_elements(v_lineup) e;

  if cardinality(v_ids) < 2 then
    raise exception 'Pick at least 2 players.';
  end if;
  if cardinality(v_ids) <> (select count(distinct x) from unnest(v_ids) x) then
    raise exception 'A player is listed twice.';
  end if;
  if exists (select 1 from jsonb_array_elements(v_lineup) e
             where coalesce(e ->> 'team', '') not in ('A', 'B')) then
    raise exception 'Every player needs a team (A or B).';
  end if;
  if exists (select 1 from jsonb_array_elements(v_lineup) e
             where coalesce((e ->> 'is_goalkeeper')::boolean, false)
             group by e ->> 'team' having count(*) > 1) then
    raise exception 'Only one goalkeeper per team.';
  end if;

  -- Only checked-in players can be on a team.
  select string_agg(coalesce(p.display_name, 'Unknown player'), ', ') into v_names
  from unnest(v_ids) x
  left join public.players p on p.id = x
  where not exists (select 1 from public.match_players mp where mp.match_id = p_match_id and mp.player_id = x);

  if v_names is not null then
    raise exception 'Check in % first.', v_names;
  end if;

  select s.id into v_stint from public.stints s
  where s.match_id = p_match_id order by s.ordinal desc limit 1;

  if v_stint is null then
    insert into public.stints (match_id, ordinal, weight) values (p_match_id, 1, 1)
    returning id into v_stint;
  end if;

  -- Players moved to the bench must not have goals or assists tonight.
  select string_agg(p.display_name, ', ') into v_names
  from public.match_players mp
  join public.players p on p.id = mp.player_id
  where mp.match_id = p_match_id
    and mp.player_id <> all (v_ids)
    and not exists (select 1 from public.stint_players sp
                    where sp.match_id = p_match_id and sp.player_id = mp.player_id and sp.stint_id <> v_stint)
    and exists (select 1 from public.goals g
                where g.match_id = p_match_id and (g.scorer_id = mp.player_id or g.assister_id = mp.player_id));

  if v_names is not null then
    raise exception '% scored or assisted tonight. Delete or change those goals first.', v_names;
  end if;

  delete from public.stint_players where stint_id = v_stint;

  insert into public.stint_players (stint_id, match_id, player_id, team, is_goalkeeper)
  select v_stint, p_match_id, (e ->> 'player_id')::uuid, e ->> 'team',
         coalesce((e ->> 'is_goalkeeper')::boolean, false)
  from jsonb_array_elements(v_lineup) e;

  -- If a scorer's team was corrected, their goals follow them.
  update public.goals g
  set scoring_team = sp.team
  from public.stint_players sp
  where g.stint_id = v_stint and sp.stint_id = v_stint
    and sp.player_id = g.scorer_id and g.scoring_team <> sp.team;
end;
$$;
```

Delete the functions `create_match` and `update_match_details`. Replace `save_lineup` with:

```sql
create function public.save_lineup(p_match_id uuid, p_lineup jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_match public.matches := public.load_match(p_match_id);
begin
  perform public.require_admin(v_match.group_id);
  perform public.require_night_open(v_match);

  perform public.apply_lineup(p_match_id, p_lineup);
  perform public.write_audit(v_match.group_id, 'lineup_changed',
    jsonb_build_object('match_id', p_match_id, 'lineup', p_lineup));
end;
$$;
```

In `log_goal`, change the comment to `-- Any player in the night's lineup (or an admin) can log a goal. Stage 2 makes this admin-only.` and add right after `begin`:

```sql
  if v_match.status = 'cancelled' then
    raise exception 'This night was cancelled.';
  elsif v_match.status = 'draft' then
    raise exception 'Start the night before logging goals.';
  end if;
```

In the grants list at the end of file 3, delete the lines `public.create_match(uuid, date, text, jsonb),` and `public.update_match_details(uuid, date, text),`.

- [ ] **Step 4: Add start and check-in to file 4**

Insert before the `-- Permissions` block:

```sql
-- -----------------------------------------------------------------------------
-- At the pitch: start the night and check people in
-- -----------------------------------------------------------------------------

-- Starts a planned night (admins): replies close and check-in opens.
create function public.start_night(p_match_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_match public.matches := public.load_match(p_match_id);
begin
  perform public.require_admin(v_match.group_id);
  if v_match.status = 'cancelled' then
    raise exception 'This night was cancelled.';
  elsif v_match.status <> 'draft' then
    raise exception 'This night has already started.';
  end if;

  update public.matches set status = 'playing' where id = p_match_id;
  perform public.write_audit(v_match.group_id, 'night_started', jsonb_build_object('match_id', p_match_id));
end;
$$;

-- Checks a player in (admins); the arrival time is saved. Anyone in the
-- group can be checked in, whether or not they said "I'm in". Checking in
-- someone who left early marks them as back (their arrival time stays).
create function public.check_in(p_match_id uuid, p_player_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_match public.matches := public.load_match(p_match_id);
begin
  perform public.require_admin(v_match.group_id);
  perform public.require_night_open(v_match);
  if not exists (select 1 from public.players p where p.id = p_player_id and p.group_id = v_match.group_id) then
    raise exception 'That player is not in this group.';
  end if;

  insert into public.match_players (match_id, player_id, arrived_at)
  values (p_match_id, p_player_id, now())
  on conflict (match_id, player_id) do update set left_at = null;

  perform public.write_audit(v_match.group_id, 'checked_in',
    jsonb_build_object('match_id', p_match_id, 'player_id', p_player_id));
end;
$$;

-- Marks a player as having left early (admins). They still count for the night.
create function public.check_out(p_match_id uuid, p_player_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_match public.matches := public.load_match(p_match_id);
begin
  perform public.require_admin(v_match.group_id);
  perform public.require_night_open(v_match);

  update public.match_players set left_at = coalesce(left_at, now())
  where match_id = p_match_id and player_id = p_player_id;
  if not found then
    raise exception 'That player is not checked in.';
  end if;

  perform public.write_audit(v_match.group_id, 'checked_out',
    jsonb_build_object('match_id', p_match_id, 'player_id', p_player_id));
end;
$$;

-- Removes a check-in made by mistake (admins). Their place in the teams,
-- their votes and their payment tick go too.
create function public.undo_check_in(p_match_id uuid, p_player_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_match public.matches := public.load_match(p_match_id);
begin
  perform public.require_admin(v_match.group_id);
  perform public.require_night_open(v_match);
  if exists (select 1 from public.goals g
             where g.match_id = p_match_id and (g.scorer_id = p_player_id or g.assister_id = p_player_id))
     or exists (select 1 from public.saves s where s.match_id = p_match_id and s.goalkeeper_id = p_player_id) then
    raise exception 'They scored or assisted tonight (or have saves logged). Delete those first.';
  end if;

  delete from public.night_payments where match_id = p_match_id and player_id = p_player_id;
  delete from public.match_players where match_id = p_match_id and player_id = p_player_id;
  if not found then
    raise exception 'That player is not checked in.';
  end if;

  perform public.write_audit(v_match.group_id, 'check_in_undone',
    jsonb_build_object('match_id', p_match_id, 'player_id', p_player_id));
end;
$$;
```

Add to the file 4 `revoke` and `grant ... to authenticated` lists: `public.start_night(uuid)`, `public.check_in(uuid, uuid)`, `public.check_out(uuid, uuid)`, `public.undo_check_in(uuid, uuid)`.

- [ ] **Step 5: Move the flow tests onto nights**

In `tests/db/flow.test.ts`, import `nightDetails` and `startNight` from `./helpers`, then:

1. In "runs end to end", replace the block from `await expectError(` (the `create_match` by Omar) through the `const [{ create_match: matchId }] = ...` statement with:

```ts
    await expectError(
      rpc(db, omar, 'plan_night', { p_group_id: groupId, p_night: nightDetails() }),
      /Only group admins/,
    )
    const matchId = await startNight(db, captain, groupId, [captain, omar, ziad, mo].map(pid))
    await rpc(db, captain, 'save_lineup', { p_match_id: matchId, p_lineup: lineup })
```

2. Near the end of the same test, change `/lineup is final/` to `/night is final/`, and in the audit expectation replace `'match_created'` with `'night_planned'`.

3. Replace the whole test `'lineup edits: one goalkeeper per team, scorers cannot be dropped'` with:

```ts
  it('lineup edits: one goalkeeper per team, scorers stay, late arrivals check in first', async () => {
    const { groupId, users, pid } = await setupGroup(db)
    const matchId = await startNight(db, users.admin, groupId, [pid(users.admin), pid(users.Omar), pid(users.Ziad)])
    const lineup = [
      { player_id: pid(users.admin), team: 'A', is_goalkeeper: true },
      { player_id: pid(users.Omar), team: 'A', is_goalkeeper: true },
      { player_id: pid(users.Ziad), team: 'B', is_goalkeeper: false },
    ]
    await expectError(
      rpc(db, users.admin, 'save_lineup', { p_match_id: matchId, p_lineup: lineup }),
      /one goalkeeper per team/,
    )
    lineup[1].is_goalkeeper = false
    await rpc(db, users.admin, 'save_lineup', { p_match_id: matchId, p_lineup: lineup })
    await rpc(db, users.Ziad, 'log_goal', { p_match_id: matchId, p_scorer_id: pid(users.Ziad), p_assister_id: null })
    await expectError(
      rpc(db, users.admin, 'save_lineup', { p_match_id: matchId, p_lineup: lineup.slice(0, 2) }),
      /Ziad scored or assisted/,
    )

    // A late arrival is checked in, then joins team B.
    const late = [...lineup, { player_id: pid(users['محمد']), team: 'B', is_goalkeeper: false }]
    await expectError(
      rpc(db, users.admin, 'save_lineup', { p_match_id: matchId, p_lineup: late }),
      /Check in محمد first/,
    )
    await rpc(db, users.admin, 'check_in', { p_match_id: matchId, p_player_id: pid(users['محمد']) })
    await rpc(db, users.admin, 'save_lineup', { p_match_id: matchId, p_lineup: late })
    const players = await selectAs(db, users.Omar, `select * from match_players where match_id = $1`, [matchId])
    expect(players).toHaveLength(4)
  })
```

4. In `'the person who logged a goal can undo it while the match is open'`, replace the `create_match` call with:

```ts
    const matchId = await startNight(db, users.admin, groupId, [pid(users.Omar), pid(users.Ziad)])
    await rpc(db, users.admin, 'save_lineup', {
      p_match_id: matchId,
      p_lineup: [
        { player_id: pid(users.Omar), team: 'A' },
        { player_id: pid(users.Ziad), team: 'B' },
      ],
    })
```

- [ ] **Step 6: Run the tests**

Run: `npm test` → Expected: all pass (`flow.test.ts` still calls `finish_match`, which is only removed in Task 4).

---

### Task 4: End a night, cancel a night

**Files:**
- Modify: `supabase/migrations/20261023000300_actions.sql` (delete `finish_match` lines 663-688 and its grant; `submit_votes` message)
- Modify: `supabase/migrations/20261024000100_nights.sql` (new section; permission lists)
- Modify: `tests/db/flow.test.ts` (`finish_match` → `end_night`)
- Test: `tests/db/nights.test.ts` (append)

**Interfaces:**
- Produces (SQL): `end_night(p_match_id uuid)`, `cancel_night(p_match_id uuid, p_reason text, p_note text, p_fee numeric)`. Reasons: `rain`, `not_enough_players`, `pitch_problem`, `other` (needs a note).

- [ ] **Step 1: Write the failing tests**

Append to `tests/db/nights.test.ts`:

```ts
describe('ending or cancelling a night', () => {
  it('End night opens voting for everyone checked in, not for "I\'m in" no-shows', async () => {
    const { groupId, users, pid } = await setupGroup(db)
    const id = await planNight(users.admin, groupId)
    await reply(users['محمد'], id, 'in')
    await rpc(db, users.admin, 'start_night', { p_match_id: id })
    await rpc(db, users.admin, 'check_in', { p_match_id: id, p_player_id: pid(users.Omar) })
    await expectError(rpc(db, users.admin, 'end_night', { p_match_id: id }), /at least 2 players/)
    await rpc(db, users.admin, 'check_in', { p_match_id: id, p_player_id: pid(users.Ziad) })
    await expectError(rpc(db, users.Omar, 'end_night', { p_match_id: id }), /Only group admins/)
    await rpc(db, users.admin, 'end_night', { p_match_id: id })

    expect((await night(users.Omar, id)).status).toBe('voting')
    const status = await rpc<{ player_id: string }>(db, users.Omar, 'vote_status', { p_match_id: id })
    expect(status.map((s) => s.player_id).sort()).toEqual([pid(users.Omar), pid(users.Ziad)].sort())
    await expectError(
      rpc(db, users['محمد'], 'submit_votes', {
        p_match_id: id, p_votes: [{ target_id: pid(users.Omar), score: 7 }], p_mvp_id: null,
      }),
      /Only players who played/,
    )
    await expectError(rpc(db, users.admin, 'end_night', { p_match_id: id }), /in progress/)
  })

  it('a cancelled night counts for nothing', async () => {
    const { groupId, users, pid } = await setupGroup(db)
    const id = await startNight(db, users.admin, groupId, [pid(users.Omar), pid(users.Ziad)])
    const cancel = (by: string, reason: string, note: string | null = null) =>
      rpc(db, by, 'cancel_night', { p_match_id: id, p_reason: reason, p_note: note, p_fee: 0 })
    await expectError(cancel(users.Omar, 'rain'), /Only group admins/)
    await expectError(cancel(users.admin, 'other', '  '), /note/)
    await cancel(users.admin, 'rain')

    const n = await night(users.Omar, id)
    expect(n.status).toBe('cancelled')
    expect(n.cancel_reason).toBe('rain')
    await expectError(rpc(db, users.admin, 'end_night', { p_match_id: id }), /in progress/)
    await expectError(
      rpc(db, users.Omar, 'submit_votes', { p_match_id: id, p_votes: [], p_mvp_id: null }),
      /Voting is closed/,
    )
    await expectError(
      rpc(db, users.admin, 'check_in', { p_match_id: id, p_player_id: pid(users['محمد']) }),
      /cancelled/,
    )
    await expectError(cancel(users.admin, 'rain'), /Only a planned night or one in progress/)
    expect(await rpc(db, users.Omar, 'get_leaderboard', { p_group_id: groupId, p_year: null })).toHaveLength(0)
    const [{ close_due_matches: closed }] = await rpc<{ close_due_matches: number }>(
      db, users.Omar, 'close_due_matches', { p_group_id: groupId },
    )
    expect(closed).toBe(0)
  })

  it('a planned night can be cancelled before it starts; replies close', async () => {
    const { groupId, users } = await setupGroup(db)
    const id = await planNight(users.admin, groupId)
    await rpc(db, users.admin, 'cancel_night', {
      p_match_id: id, p_reason: 'not_enough_players', p_note: null, p_fee: 0,
    })
    await expectError(reply(users.Omar, id, 'in'), /Replies are closed/)
    await expectError(rpc(db, users.admin, 'start_night', { p_match_id: id }), /cancelled/)
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/db/nights.test.ts -t "ending or cancelling"` → Expected: FAIL (`end_night` does not exist).

- [ ] **Step 3: Implement**

In file 3: delete the function `finish_match` (and its comment); delete `public.finish_match(uuid),` from the grants list; in `submit_votes` change `'Voting is closed for this match.'` to `'Voting is closed for this night.'`. Change the section heading `-- Finishing a match and the voting window` to `-- The voting window (a night is ended with end_night in file 4)`.

In file 4, insert before the `-- Permissions` block:

```sql
-- -----------------------------------------------------------------------------
-- Ending or cancelling a night
-- -----------------------------------------------------------------------------

-- Ends the night (admins): voting opens for everyone checked in, and the
-- money card appears.
create function public.end_night(p_match_id uuid)
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

  select rc.voting_hours into v_hours from public.rating_config rc where rc.group_id = v_match.group_id;

  update public.matches
  set status = 'voting', voting_closes_at = now() + make_interval(hours => coalesce(v_hours, 24))
  where id = p_match_id;

  perform public.write_audit(v_match.group_id, 'night_ended', jsonb_build_object('match_id', p_match_id));
end;
$$;

-- Calls off a planned night or one in progress (admins). Nothing counts: no
-- votes and no ratings. p_fee is what the pitch still charges (0 if nothing);
-- it is split like the rent (see night_payer_rows).
create function public.cancel_night(p_match_id uuid, p_reason text, p_note text, p_fee numeric)
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

  update public.matches
  set status = 'cancelled', cancel_reason = p_reason, cancel_note = v_note,
      cancel_fee = coalesce(p_fee, 0), cancelled_at = now()
  where id = p_match_id;

  perform public.write_audit(v_match.group_id, 'night_cancelled',
    jsonb_build_object('match_id', p_match_id, 'reason', p_reason, 'fee', coalesce(p_fee, 0)));
end;
$$;
```

Add to the file 4 `revoke` and `grant ... to authenticated` lists: `public.end_night(uuid)`, `public.cancel_night(uuid, text, text, numeric)`.

In `tests/db/flow.test.ts`: replace both `'finish_match'` calls with `'end_night'`, and in the audit expectation replace `'match_finished'` with `'night_ended'`.

- [ ] **Step 4: Run the tests**

Run: `npm test` → Expected: all pass.

---

### Task 5: Money: the rent split and payments

**Files:**
- Modify: `supabase/migrations/20261024000100_nights.sql` (new section; final permission block)
- Test: `tests/db/nights.test.ts` (append)

**Interfaces:**
- Produces (SQL): `night_money(p_match_id uuid) returns table (player_id uuid, share int, paid_at timestamptz, is_collector boolean)` — one row per payer; empty until the night has ended (or is cancelled with a fee), or when the amount is 0. `money_owed(p_group_id uuid) returns table (match_id uuid, played_at date, share int, currency text, collector_player_id uuid)` — the caller's unpaid shares. `mark_paid(p_match_id uuid, p_player_id uuid)`, `unmark_paid(uuid, uuid)`. Internal: `night_payer_rows(uuid)` (same columns as `night_money`), `require_payment_keeper(public.matches, uuid, uuid)`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/db/nights.test.ts`:

```ts
describe('money: the rent split', () => {
  type Payer = { player_id: string; share: number; paid_at: Date | null; is_collector: boolean }
  const money = (user: string, id: string) => rpc<Payer>(db, user, 'night_money', { p_match_id: id })
  const ELEVEN = Array.from({ length: 11 }, (_, i) => `P${i + 2}`) // P2 ... P12

  /** The worked example: 13 players checked in (the admin, Ahmed the collector, P2-P12), 600 EGP. */
  async function bigNight(extra: string[] = []) {
    const g = await setupGroup(db, ['Ahmed', ...ELEVEN, ...extra])
    const thirteen = [g.users.admin, g.users.Ahmed, ...ELEVEN.map((n) => g.users[n])]
    const id = await startNight(db, g.users.admin, g.groupId, thirteen.map(g.pid),
      nightDetails({ collector_player_id: g.pid(g.users.Ahmed) }))
    return { ...g, id }
  }

  it('worked example: 600 EGP and 13 players -> 47 EGP each; the collector counts as paid', async () => {
    const { users, id, pid } = await bigNight()
    expect(await money(users.P2, id)).toHaveLength(0) // no money card while the night is on
    await rpc(db, users.admin, 'end_night', { p_match_id: id })

    const rows = await money(users.P2, id)
    expect(rows).toHaveLength(13)
    expect(rows.every((r) => r.share === 47)).toBe(true) // 600 / 13 = 46.15 -> 47 (611 collected, 11 extra)
    expect(rows.filter((r) => r.is_collector).map((r) => r.player_id)).toEqual([pid(users.Ahmed)])
  })

  it('the collector or an admin ticks payments; nobody ticks their own', async () => {
    const { users, id, pid } = await bigNight()
    await rpc(db, users.admin, 'end_night', { p_match_id: id })
    const mark = (by: string, who: string) => rpc(db, by, 'mark_paid', { p_match_id: id, p_player_id: pid(who) })

    await expectError(mark(users.P2, users.P3), /Only the collector or an admin/)
    await expectError(mark(users.P2, users.P2), /your own share/)
    await expectError(mark(users.admin, users.admin), /your own share/)
    await expectError(mark(users.admin, users.Ahmed), /collector counts as paid/)
    for (const name of ['P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8']) await mark(users.Ahmed, users[name])
    await mark(users.admin, users.P9)

    const paid = (await money(users.P2, id)).filter((r) => r.is_collector || r.paid_at !== null)
    expect(paid).toHaveLength(9) // 9 x 47 = 423 of 611 collected

    await rpc(db, users.Ahmed, 'unmark_paid', { p_match_id: id, p_player_id: pid(users.P9) })
    expect((await money(users.P2, id)).filter((r) => r.paid_at !== null)).toHaveLength(7)
  })

  it('"I\'m in" but never came pays nothing; a late check-in recalculates, ticks stay', async () => {
    const g = await setupGroup(db, ['Ahmed', ...ELEVEN, 'NoShow', 'Late'])
    const id = await planNight(g.users.admin, g.groupId, { collector_player_id: g.pid(g.users.Ahmed) })
    await reply(g.users.NoShow, id, 'in')
    await rpc(db, g.users.admin, 'start_night', { p_match_id: id })
    for (const user of [g.users.admin, g.users.Ahmed, ...ELEVEN.map((n) => g.users[n])]) {
      await rpc(db, g.users.admin, 'check_in', { p_match_id: id, p_player_id: g.pid(user) })
    }
    await rpc(db, g.users.admin, 'end_night', { p_match_id: id })
    await rpc(db, g.users.Ahmed, 'mark_paid', { p_match_id: id, p_player_id: g.pid(g.users.P2) })

    let rows = await money(g.users.P2, id)
    expect(rows).toHaveLength(13)
    expect(rows.some((r) => r.player_id === g.pid(g.users.NoShow))).toBe(false)
    await expectError(
      rpc(db, g.users.admin, 'mark_paid', { p_match_id: id, p_player_id: g.pid(g.users.NoShow) }),
      /nothing to pay/,
    )

    // Someone forgotten is checked in while voting is open: 600 / 14 = 42.86 -> 43.
    await rpc(db, g.users.admin, 'check_in', { p_match_id: id, p_player_id: g.pid(g.users.Late) })
    rows = await money(g.users.P2, id)
    expect(rows).toHaveLength(14)
    expect(rows.every((r) => r.share === 43)).toBe(true)
    expect(rows.find((r) => r.player_id === g.pid(g.users.P2))!.paid_at).not.toBeNull()
  })

  it('a cancelled night: a fee is split among those checked in, or those who said "I\'m in"', async () => {
    const { groupId, users, pid } = await setupGroup(db, ['A', 'B', 'C', 'D', 'E'])

    // Called off before anyone arrived: 300 EGP among the 4 who said "I'm in".
    const early = await planNight(users.admin, groupId)
    for (const name of ['A', 'B', 'C', 'D']) await reply(users[name], early, 'in')
    await reply(users.E, early, 'out')
    await rpc(db, users.admin, 'cancel_night', { p_match_id: early, p_reason: 'rain', p_note: null, p_fee: 300 })
    const rows = await money(users.A, early)
    expect(rows).toHaveLength(4)
    expect(rows.every((r) => r.share === 75)).toBe(true)

    // Called off at the pitch: 100 EGP among the 3 checked in -> 33.33 -> 34 each.
    const late = await startNight(db, users.admin, groupId, [pid(users.A), pid(users.B), pid(users.C)])
    await rpc(db, users.admin, 'cancel_night', { p_match_id: late, p_reason: 'pitch_problem', p_note: null, p_fee: 100 })
    expect((await money(users.A, late)).map((r) => r.share)).toEqual([34, 34, 34])

    // Nothing charged: no money card.
    const free = await startNight(db, users.admin, groupId, [pid(users.A), pid(users.B)])
    await rpc(db, users.admin, 'cancel_night', { p_match_id: free, p_reason: 'rain', p_note: null, p_fee: 0 })
    expect(await money(users.A, free)).toHaveLength(0)
  })

  it('"You owe" lists your unpaid shares', async () => {
    const { users, id, pid, groupId } = await bigNight()
    await rpc(db, users.admin, 'end_night', { p_match_id: id })
    type Owed = { match_id: string; share: number; currency: string; collector_player_id: string }
    const owed = (user: string) => rpc<Owed>(db, user, 'money_owed', { p_group_id: groupId })

    expect(await owed(users.P2)).toEqual([
      expect.objectContaining({ match_id: id, share: 47, currency: 'EGP', collector_player_id: pid(users.Ahmed) }),
    ])
    expect(await owed(users.Ahmed)).toHaveLength(0) // the collector owes nothing
    await rpc(db, users.Ahmed, 'mark_paid', { p_match_id: id, p_player_id: pid(users.P2) })
    expect(await owed(users.P2)).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/db/nights.test.ts -t "money"` → Expected: FAIL (`night_money` does not exist).

- [ ] **Step 3: Implement**

In file 4, insert before the `-- Permissions` block:

```sql
-- -----------------------------------------------------------------------------
-- Money: THE rent split (Plans/Football-scenario.md section 4)
--
--   share = amount ÷ number of payers, rounded UP to a whole pound
--
-- The amount is the night's cost (or, for a cancelled night, what the pitch
-- still charges). The payers are everyone checked in. A night cancelled
-- before anyone was checked in splits its fee among those who said "I'm in".
-- The collector is one of the payers and counts as paid automatically.
-- -----------------------------------------------------------------------------
create function public.night_payer_rows(p_match_id uuid)
returns table (player_id uuid, share int, paid_at timestamptz, is_collector boolean)
language sql stable set search_path = ''
as $$
  with night as (
    select m.collector_player_id,
           m.status,
           case when m.status = 'cancelled' then m.cancel_fee else m.cost end as amount
    from public.matches m
    where m.id = p_match_id and m.status in ('voting', 'closed', 'cancelled')
  ),
  checked_in as (
    select mp.player_id from public.match_players mp where mp.match_id = p_match_id
  ),
  payers as (
    select c.player_id from checked_in c
    union all
    select r.player_id
    from public.rsvps r, night n
    where r.match_id = p_match_id and r.status = 'in'
      and n.status = 'cancelled'
      and not exists (select 1 from checked_in)
  )
  select p.player_id,
         ceil(n.amount / count(*) over ())::int,
         np.paid_at,
         p.player_id is not distinct from n.collector_player_id
  from payers p
  cross join night n
  left join public.night_payments np on np.match_id = p_match_id and np.player_id = p.player_id
  where n.amount > 0;
$$;

-- The money card of one night (members).
create function public.night_money(p_match_id uuid)
returns table (player_id uuid, share int, paid_at timestamptz, is_collector boolean)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_match public.matches := public.load_match(p_match_id);
begin
  perform public.require_member(v_match.group_id);
  return query select * from public.night_payer_rows(p_match_id);
end;
$$;

-- "You owe 47 EGP to Ahmed": the caller's unpaid shares in the group.
create function public.money_owed(p_group_id uuid)
returns table (match_id uuid, played_at date, share int, currency text, collector_player_id uuid)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_me uuid := public.require_member(p_group_id);
begin
  return query
    select m.id, m.played_at, pr.share, m.currency, m.collector_player_id
    from public.matches m
    cross join lateral public.night_payer_rows(m.id) pr
    where m.group_id = p_group_id
      and m.status in ('voting', 'closed', 'cancelled')
      and pr.player_id = v_me
      and pr.paid_at is null
      and not pr.is_collector
    order by m.played_at;
end;
$$;

-- Only the night's collector or an admin ticks payments, and never their own.
create function public.require_payment_keeper(p_match public.matches, p_me uuid, p_player_id uuid)
returns void
language plpgsql stable set search_path = ''
as $$
begin
  if p_player_id = p_me then
    raise exception 'You can''t tick off your own share. Ask the collector.';
  end if;
  if p_me is distinct from p_match.collector_player_id and not public.is_group_admin(p_match.group_id) then
    raise exception 'Only the collector or an admin can tick off payments.';
  end if;
end;
$$;

-- Ticks a player's share as paid back to the collector.
create function public.mark_paid(p_match_id uuid, p_player_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_match public.matches := public.load_match(p_match_id);
  v_me    uuid := public.require_member(v_match.group_id);
  v_payer record;
begin
  perform public.require_payment_keeper(v_match, v_me, p_player_id);

  select * into v_payer from public.night_payer_rows(p_match_id) r where r.player_id = p_player_id;
  if not found then
    raise exception 'That player has nothing to pay for this night.';
  end if;
  if v_payer.is_collector then
    raise exception 'The collector counts as paid automatically.';
  end if;

  insert into public.night_payments (match_id, player_id, marked_by)
  values (p_match_id, p_player_id, auth.uid())
  on conflict (match_id, player_id) do nothing;

  perform public.write_audit(v_match.group_id, 'payment_marked',
    jsonb_build_object('match_id', p_match_id, 'player_id', p_player_id));
end;
$$;

-- Removes a tick made by mistake.
create function public.unmark_paid(p_match_id uuid, p_player_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_match public.matches := public.load_match(p_match_id);
  v_me    uuid := public.require_member(v_match.group_id);
begin
  perform public.require_payment_keeper(v_match, v_me, p_player_id);
  delete from public.night_payments where match_id = p_match_id and player_id = p_player_id;
  perform public.write_audit(v_match.group_id, 'payment_unmarked',
    jsonb_build_object('match_id', p_match_id, 'player_id', p_player_id));
end;
$$;
```

Replace the whole Permissions block of file 4 with the final version:

```sql
-- =============================================================================
-- Permissions (same rules as the end of file 3). Internal helpers stay
-- private; the app actions are for signed-in users.
-- =============================================================================
revoke execute on function
  public.write_night_details(uuid, uuid, jsonb),
  public.night_has_space(uuid),
  public.promote_waiting(uuid),
  public.night_payer_rows(uuid),
  public.require_payment_keeper(public.matches, uuid, uuid),
  public.plan_night(uuid, jsonb),
  public.update_night(uuid, jsonb),
  public.set_rsvp(uuid, text),
  public.start_night(uuid),
  public.check_in(uuid, uuid),
  public.check_out(uuid, uuid),
  public.undo_check_in(uuid, uuid),
  public.end_night(uuid),
  public.cancel_night(uuid, text, text, numeric),
  public.night_money(uuid),
  public.money_owed(uuid),
  public.mark_paid(uuid, uuid),
  public.unmark_paid(uuid, uuid)
from public, anon, authenticated;

grant execute on function
  public.plan_night(uuid, jsonb),
  public.update_night(uuid, jsonb),
  public.set_rsvp(uuid, text),
  public.start_night(uuid),
  public.check_in(uuid, uuid),
  public.check_out(uuid, uuid),
  public.undo_check_in(uuid, uuid),
  public.end_night(uuid),
  public.cancel_night(uuid, text, text, numeric),
  public.night_money(uuid),
  public.money_owed(uuid),
  public.mark_paid(uuid, uuid),
  public.unmark_paid(uuid, uuid)
to authenticated;

grant execute on all functions in schema public to service_role;
```

- [ ] **Step 4: Run the tests**

Run: `npm test` → Expected: all pass.

---

### Task 6: Demo data

**Files:**
- Modify (rewrite): `supabase/seed.sql`
- Modify (rewrite the test): `tests/db/seed.test.ts`

**Interfaces:**
- Consumes: everything above. The demo group keeps the code `DEMO-KICK`; player 3 (Ahmed) is the collector.

- [ ] **Step 1: Write the failing test**

Replace the `it(...)` in `tests/db/seed.test.ts` with:

```ts
it('creates 12 players and demo nights; the first joiner becomes admin', async () => {
  const owner = await createUser(db, 'Owner')
  const [{ join_group: groupId }] = await rpc<{ join_group: string }>(db, owner, 'join_group', {
    p_code: 'demo-kick',
    p_display_name: 'Owner',
  })
  const [me] = await selectAs<{ role: string }>(
    db, owner, `select role from group_members where group_id = $1`, [groupId],
  )
  expect(me.role).toBe('admin')
  expect(await selectAs(db, owner, `select * from players where group_id = $1`, [groupId])).toHaveLength(13)

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

  const allTime = await rpc<{ qualified: boolean; matches: number }>(db, owner, 'get_leaderboard', {
    p_group_id: groupId,
    p_year: null,
  })
  expect(allTime).toHaveLength(12)
  expect(allTime.every((row) => row.matches === 4 && row.qualified)).toBe(true)

  // Running the seed again does nothing.
  await runSqlFile(db, 'supabase/seed.sql')
  const groups = await db.query(`select * from groups where name = 'Demo FC'`)
  expect(groups.rows).toHaveLength(1)
})
```

Run: `npx vitest run tests/db/seed.test.ts` → Expected: FAIL (the old seed has no planned or cancelled night).

- [ ] **Step 2: Rewrite the seed**

Replace `supabase/seed.sql` with:

```sql
-- =============================================================================
-- 7GZ-KORA: demo data for testing
--
-- Creates the group "Demo FC" with 12 fake players and these nights:
--   * last season: one finished night (shows in the All-time tab only)
--   * three finished nights this season; 4 people still owe for last week's
--   * ten days ago: cancelled because of rain
--   * yesterday: voting still open; 3 people have paid back so far
--   * in 3 days: planned, with a 10-player limit: 10 in, 1 on the waiting
--     list and 1 out, so you can see the waiting list
-- Ahmed (player 3) collects the money every night: 600 EGP ÷ 12 = 50 each.
--
-- Run it AFTER the 4 migration files, ideally in a separate test project.
-- To see it: sign in to the app, tap "Join a group" and enter  DEMO-KICK
-- The first real person to join becomes the group's admin.
--
-- To remove it later:   delete from public.groups where name = 'Demo FC';
-- =============================================================================

-- 20:00 in Cairo on the given day (18:00 UTC in winter). pg_temp = these
-- helpers disappear when this run ends.
create or replace function pg_temp.night_start(p_day date)
returns timestamptz
language sql immutable as $$
  select (p_day + time '18:00') at time zone 'UTC'
$$;

-- Builds one finished (or voting) night. Player numbers (1-12) refer to
-- positions in the players array.
create or replace function pg_temp.seed_night(
  p_group    uuid,
  p_players  uuid[],
  p_played   date,
  p_team_a   int[],
  p_team_b   int[],
  p_gk_a     int,
  p_gk_b     int,
  p_goals    int[],    -- pairs: scorer, assister (0 = no assist)
  p_status   text,     -- 'closed' or 'voting'
  p_voters   int[],    -- who has voted
  p_unpaid   int[]     -- who hasn't paid Ahmed back yet
) returns uuid
language plpgsql as $$
declare
  v_match uuid;
  v_stint uuid;
  v_n     int;
  v_team  text;
  i       int;
begin
  insert into public.matches (group_id, played_at, starts_at, location, cost, collector_player_id,
                              status, voting_closes_at, closed_at)
  values (
    p_group, p_played, pg_temp.night_start(p_played), 'Club pitch 3', 600, p_players[3],
    p_status,
    case when p_status = 'voting' then now() + interval '20 hours' else p_played + interval '1 day' end,
    case when p_status = 'closed' then p_played + interval '1 day' end
  )
  returning id into v_match;

  insert into public.stints (match_id, ordinal, weight) values (v_match, 1, 1) returning id into v_stint;

  foreach v_n in array p_team_a || p_team_b loop
    -- Checked in around 20:00; player 8 is always late.
    insert into public.match_players (match_id, player_id, arrived_at)
    values (v_match, p_players[v_n],
            pg_temp.night_start(p_played) + make_interval(mins => case when v_n = 8 then 25 else v_n - 8 end));
    insert into public.stint_players (stint_id, match_id, player_id, team, is_goalkeeper)
    values (
      v_stint, v_match, p_players[v_n],
      case when v_n = any (p_team_a) then 'A' else 'B' end,
      v_n in (p_gk_a, p_gk_b)
    );
  end loop;

  i := 1;
  while i < coalesce(array_length(p_goals, 1), 0) loop
    v_team := case when p_goals[i] = any (p_team_a) then 'A' else 'B' end;
    insert into public.goals (match_id, stint_id, scoring_team, scorer_id, assister_id, confirmed)
    values (
      v_match, v_stint, v_team, p_players[p_goals[i]],
      case when p_goals[i + 1] > 0 then p_players[p_goals[i + 1]] end,
      true
    );
    i := i + 2;
  end loop;

  -- Votes: everyone around 6-8, scorers a bit higher, a few "didn't see".
  insert into public.ratings_votes (match_id, voter_id, target_id, score, didnt_see)
  select v_match, voter.player_id, target.player_id,
         case when abs(hashtext(voter.player_id::text || target.player_id::text)) % 13 = 0 then null
              else least(10, greatest(1,
                     6 + (abs(hashtext(target.player_id::text || voter.player_id::text)) % 4) - 1
                       + (select count(*) from public.goals g
                          where g.match_id = v_match and g.scorer_id = target.player_id)::int))
         end,
         abs(hashtext(voter.player_id::text || target.player_id::text)) % 13 = 0
  from public.match_players voter
  join public.match_players target on target.match_id = voter.match_id and target.player_id <> voter.player_id
  where voter.match_id = v_match
    and voter.player_id = any (select p_players[x] from unnest(p_voters) x);

  -- Man of the Match: each voter picks the player they scored highest.
  insert into public.mvp_votes (match_id, voter_id, target_id)
  select distinct on (rv.voter_id) v_match, rv.voter_id, rv.target_id
  from public.ratings_votes rv
  where rv.match_id = v_match and rv.score is not null
  order by rv.voter_id, rv.score desc, rv.target_id;

  -- Everyone except the collector (player 3) and p_unpaid paid back the next day.
  insert into public.night_payments (match_id, player_id, paid_at)
  select v_match, p_players[x], pg_temp.night_start(p_played) + interval '1 day'
  from unnest(p_team_a || p_team_b) x
  where x <> 3 and x <> all (p_unpaid);

  if p_status = 'closed' then
    perform public.compute_match_ratings(v_match);
  end if;
  return v_match;
end;
$$;

do $$
declare
  v_group   uuid;
  v_players uuid[] := '{}';
  v_name    text;
  v_id      uuid;
  v_night   uuid;
  v_year    int := extract(year from current_date)::int;
  v_all     int[] := array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
begin
  if exists (select 1 from public.groups where name = 'Demo FC') then
    raise notice 'Demo data is already loaded.';
    return;
  end if;

  insert into public.groups (name, invite_code) values ('Demo FC', 'DEMO-KICK') returning id into v_group;
  insert into public.rating_config (group_id) values (v_group);

  foreach v_name in array array[
    'Youssef', 'Omar', 'Ahmed', 'Karim', 'Mostafa', 'Ziad',
    'Hassan', 'Tarek', 'محمد', 'Ali', 'Seif', 'Mahmoud'
  ] loop
    insert into public.players (group_id, display_name) values (v_group, v_name) returning id into v_id;
    v_players := v_players || v_id;
  end loop;

  -- Last season (shows up in the All-time tab only): B wins 2-1.
  perform pg_temp.seed_night(v_group, v_players, make_date(v_year - 1, 12, 18),
    array[1, 2, 3, 4, 5, 6], array[7, 8, 9, 10, 11, 12], 5, 9,
    array[7, 9, 10, 0, 2, 0], 'closed', v_all, '{}');

  -- Three weeks ago: A wins 4-1.
  perform pg_temp.seed_night(v_group, v_players, current_date - 21,
    array[1, 2, 3, 4, 5, 6], array[7, 8, 9, 10, 11, 12], 6, 12,
    array[1, 2, 1, 0, 3, 1, 7, 8, 2, 4], 'closed', v_all, '{}');

  -- Two weeks ago: B wins 3-2.
  perform pg_temp.seed_night(v_group, v_players, current_date - 14,
    array[1, 3, 5, 7, 9, 11], array[2, 4, 6, 8, 10, 12], 11, 12,
    array[2, 4, 4, 0, 9, 1, 6, 2, 1, 3], 'closed', v_all, '{}');

  -- Ten days ago: cancelled three hours before because of rain. Nothing to pay.
  insert into public.matches (group_id, played_at, starts_at, location, cost, collector_player_id,
                              status, cancel_reason, cancelled_at)
  values (v_group, current_date - 10, pg_temp.night_start(current_date - 10), 'Club pitch 3', 600, v_players[3],
          'cancelled', 'rain', pg_temp.night_start(current_date - 10) - interval '3 hours');

  -- Last week: A wins 3-0 (clean sheet for player 10 in goal). 4 people still owe Ahmed.
  perform pg_temp.seed_night(v_group, v_players, current_date - 7,
    array[1, 2, 4, 5, 8, 10], array[3, 6, 7, 9, 11, 12], 10, 11,
    array[1, 2, 8, 0, 4, 1], 'closed', v_all, array[7, 9, 11, 12]);

  -- Yesterday: voting still open, 5 players have voted, 3 have paid back.
  perform pg_temp.seed_night(v_group, v_players, current_date - 1,
    array[1, 3, 5, 7, 9, 11], array[2, 4, 6, 8, 10, 12], 11, 12,
    array[5, 1, 8, 2, 3, 0], 'voting', array[2, 3, 4, 5, 6], array[5, 6, 7, 8, 9, 10, 11, 12]);

  -- In 3 days: planned, limit 10. Players 1-10 are in, 11 is waiting, 12 is out.
  insert into public.matches (group_id, played_at, starts_at, location, cost, collector_player_id,
                              player_cap, status)
  values (v_group, current_date + 3, pg_temp.night_start(current_date + 3), 'Club pitch 3', 600, v_players[3],
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

- [ ] **Step 3: Run the tests**

Run: `npm test` → Expected: all pass.

**Checkpoint A:** the database part of stage 1 is complete and fully tested.

---

## Part B — Brand and design

### Task 7: Rename, fonts, design tokens, icons, manifest and HTML

**Files:**
- Modify: `package.json`, `package-lock.json` (via npm), `src/index.css` (rewrite), `vite.config.ts` (rewrite), `index.html` (rewrite), `pwa-assets.config.ts` (rewrite), `.env.example`, `src/lib/storage.ts`, `src/pages/Settings.tsx:140-143`
- Create: `public/robots.txt`, `public/app-icon.svg`, `public/mark-green.svg`; replace `public/logo.svg` and the PNG/ICO icons

**Interfaces:**
- Produces: Tailwind classes `bg-brand`, `text-brand-ink`, `text-on-brand`, `bg-paper`, `text-paper`, `text-ink`, `bg-ground`, `text-muted`, `border-line`, `text-gold`, `text-danger`, `bg-team-a/b/c`, `rounded-card`, `rounded-button`, `font-display` (Archivo Black), `font-sans` (Archivo); CSS classes `honeycomb`, `btn` + `btn-primary|secondary|black|dark|danger|ghost` + `btn-sm|btn-big`, `chip` + `team-a|b|c`, `status` + `draft|playing|voting|closed|cancelled`, `label`, `money`, `r-top|r-good|r-ok|r-low`, `seg` (children `sel`, `sel-out`, `sel-a|b|c`), `tabular`, `press`. Public files `/logo.svg` (white mark), `/mark-green.svg`, `/app-icon.svg`.

- [ ] **Step 1: Swap the fonts and rename the package**

```bash
npm uninstall @fontsource/barlow-condensed
npm install @fontsource/archivo@^5.3.0 @fontsource/archivo-black@^5.3.0
ls node_modules/@fontsource/archivo/latin-400.css node_modules/@fontsource/archivo/latin-800.css node_modules/@fontsource/archivo-black/latin-400.css
```

Expected: the three files are listed. In `package.json` change `"name": "ta7dy-el-la3eeba"` to `"name": "7gz-kora"`.

- [ ] **Step 2: Copy the icons and logos, point the icon generator at the new icon**

```bash
cp Design/icons/*.png Design/icons/favicon.ico Design/icons/app-icon.svg public/
cp Design/logo/7gz-kora-mark-white.svg public/logo.svg
cp Design/logo/7gz-kora-mark-green.svg public/mark-green.svg
```

Replace `pwa-assets.config.ts` with:

```ts
// Generates the app icons from public/app-icon.svg (the boot-on-ball on
// green, no text). Run `npm run icons` after changing it. Output (in public/):
// favicon.ico, pwa-64x64.png, pwa-192x192.png, pwa-512x512.png,
// maskable-icon-512x512.png and apple-touch-icon-180x180.png.
// app-icon.svg is already a full green square with the mark inside the safe
// zone, so no extra padding or background is added.
import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

export default defineConfig({
  headLinkOptions: {
    preset: '2023',
  },
  preset: {
    ...minimal2023Preset,
    transparent: { ...minimal2023Preset.transparent, padding: 0 },
    maskable: { ...minimal2023Preset.maskable, padding: 0 },
    apple: { ...minimal2023Preset.apple, padding: 0 },
  },
  images: ['public/app-icon.svg'],
})
```

Run: `npm run icons` → Expected: it writes the six icon files into `public/` without errors.

- [ ] **Step 3: Replace `src/index.css`**

```css
@import "tailwindcss";
@import "@fontsource/archivo/latin-400.css";
@import "@fontsource/archivo/latin-500.css";
@import "@fontsource/archivo/latin-700.css";
@import "@fontsource/archivo/latin-800.css";
@import "@fontsource/archivo-black/latin-400.css";

/*
  7GZ-KORA design tokens, copied from Design/tokens.css (the single source;
  Design/README.md explains each one). Text on --brand is always black
  (--on-brand), never white, except the big logo lettering.
*/
:root {
  color-scheme: light dark;

  --brand: #00bf63;
  --brand-ink: #00733a;
  --on-brand: #0b0b0b;
  --ink: #0b0b0b;
  --paper: #ffffff;
  --ground: #f2f6f3;
  --muted: #56625b;
  --line: #dde5e0;
  --gold: #f5b700;
  --danger: #b42318;

  --team-a: #ffffff;
  --team-b: #ff7a1a;
  --team-c: #3ba7ff;

  --rate-top: #00733a;
  --rate-top-text: #ffffff;
  --rate-good: #00bf63;
  --rate-good-text: #0b0b0b;
  --rate-ok: #ffc21a;
  --rate-ok-text: #0b0b0b;
  --rate-low: #cfd8d2;
  --rate-low-text: #0b0b0b;

  --font-display: "Archivo Black", "Archivo", system-ui, sans-serif;
  --font-body: "Archivo", system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans Arabic", sans-serif;
  --text-body: 16px;
  --text-small: 13px;
  --text-label: 12px;

  --tap: 48px;
  --radius-card: 18px;
  --radius-button: 14px;
  --radius-chip: 999px;
  --border-bold: 2px;
}

@media (prefers-color-scheme: dark) {
  :root {
    --brand-ink: #39e48c;
    --ink: #f2f5f3;
    --paper: #141b17;
    --ground: #0a0f0c;
    --muted: #9aa8a0;
    --line: #26302a;
    --danger: #ff6b5e;
    --rate-low: #3a4640;
    --rate-low-text: #f2f5f3;
    /* --brand, --on-brand and the team colours stay the same in dark mode */
  }
}

/* The tokens as Tailwind classes: bg-brand, text-ink, rounded-card, ... */
@theme inline {
  --font-display: var(--font-display);
  --font-sans: var(--font-body);
  --color-brand: var(--brand);
  --color-brand-ink: var(--brand-ink);
  --color-on-brand: var(--on-brand);
  --color-ink: var(--ink);
  --color-paper: var(--paper);
  --color-ground: var(--ground);
  --color-muted: var(--muted);
  --color-line: var(--line);
  --color-gold: var(--gold);
  --color-danger: var(--danger);
  --color-team-a: var(--team-a);
  --color-team-b: var(--team-b);
  --color-team-c: var(--team-c);
  --radius-card: var(--radius-card);
  --radius-button: var(--radius-button);
}

html,
body {
  background: var(--ground);
  color: var(--ink);
  -webkit-tap-highlight-color: transparent;
  /* Archivo Black has a single weight: never fake a bolder one. */
  font-synthesis: none;
}

body {
  font-family: var(--font-body);
  font-size: var(--text-body);
  line-height: 1.5;
  min-height: 100dvh;
}

/* Honeycomb texture from the ball, for green surfaces only (header, sign-in, install). */
.honeycomb {
  background-color: var(--brand);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='97' viewBox='0 0 56 97'%3E%3Cpath d='M28 0l28 16v32L28 64 0 48V16zM28 64v33M0 16L-28 0M56 16l28-16' fill='none' stroke='%23ffffff' stroke-opacity='.12' stroke-width='2'/%3E%3C/svg%3E");
  background-size: 56px 97px;
}

/* Numbers that line up in tables and scoreboards. */
.tabular {
  font-variant-numeric: tabular-nums;
}

/* Small tap feedback for things that aren't buttons (player tiles). */
.press {
  transition: transform 80ms ease-out;
}
.press:active {
  transform: scale(0.97);
}

@layer components {
  /* Buttons. Primary (green, black text, sticker shadow): one per screen area. */
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: var(--tap);
    padding: 0 18px;
    border-radius: var(--radius-button);
    border: var(--border-bold) solid var(--ink);
    font: 800 15px/1.1 var(--font-body);
    letter-spacing: 0.05em;
    text-transform: uppercase;
    cursor: pointer;
    transition: transform 80ms ease-out, box-shadow 80ms ease-out;
  }
  .btn:active:not(:disabled) {
    transform: translateY(3px);
    box-shadow: none;
  }
  .btn:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .btn-primary { background: var(--brand); color: var(--on-brand); border-color: #0b0b0b; box-shadow: 0 3px 0 #0b0b0b; }
  .btn-secondary { background: var(--paper); color: var(--ink); }
  /* Black in light mode, white in dark mode (e.g. "End night"). */
  .btn-dark { background: var(--ink); color: var(--paper); }
  /* Always black: the action on green surfaces (e.g. "Continue with Google"). */
  .btn-black { background: #0b0b0b; color: #ffffff; border-color: #0b0b0b; }
  .btn-danger { background: var(--paper); color: var(--danger); border-color: var(--danger); }
  /* Low-key text action (Back, Cancel, Undo). */
  .btn-ghost { background: transparent; color: var(--ink); border-color: transparent; text-transform: none; letter-spacing: 0; font-weight: 700; }
  .btn-sm { min-height: 40px; padding: 0 12px; font-size: 12px; border-radius: 12px; }
  .btn-big { min-height: 64px; font-size: 20px; border-radius: 16px; }

  /* Chips: teams wear their bib colours; status chips for nights. Black text on every colour. */
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 26px;
    padding: 0 10px;
    border-radius: var(--radius-chip);
    border: var(--border-bold) solid #0b0b0b;
    color: #0b0b0b;
    font: 800 11.5px/1 var(--font-body);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    white-space: nowrap;
  }
  .team-a { background: var(--team-a); }
  .team-b { background: var(--team-b); }
  .team-c { background: var(--team-c); }
  .status { background: transparent; border-color: var(--ink); color: var(--ink); }
  .status.playing { background: var(--brand); border-color: #0b0b0b; color: #0b0b0b; }
  .status.playing::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: #0b0b0b; animation: pulse 1.2s infinite; }
  .status.voting { background: var(--rate-ok); border-color: #0b0b0b; color: #0b0b0b; }
  .status.closed { background: var(--ink); border-color: var(--ink); color: var(--paper); }
  .status.cancelled { border-color: var(--line); color: var(--muted); }

  /* UPPERCASE labels and card headings: "THU 29 OCT · 20:00". */
  .label {
    font-weight: 700;
    font-size: var(--text-label);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
  }

  /* Money amounts: "47 EGP". */
  .money {
    font-family: var(--font-display);
    font-size: 28px;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }

  /* Rating badge colour bands: 8.0+, 7.0-7.9, 6.0-6.9, under 6. */
  .r-top { background: var(--rate-top); color: var(--rate-top-text); }
  .r-good { background: var(--rate-good); color: var(--rate-good-text); }
  .r-ok { background: var(--rate-ok); color: var(--rate-ok-text); }
  .r-low { background: var(--rate-low); color: var(--rate-low-text); }

  /* Segmented picker: Out / A / B, and 5 / 6 / 7 a side. */
  .seg { display: inline-flex; border: var(--border-bold) solid var(--ink); border-radius: 12px; overflow: hidden; }
  .seg > button {
    min-width: 46px;
    height: 46px;
    padding: 0 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font: 16px var(--font-display);
    color: var(--muted);
    background: var(--paper);
  }
  .seg > button + button { border-left: 1.5px solid var(--line); }
  .seg > .sel { background: var(--brand); color: #0b0b0b; }
  .seg > .sel-out { background: var(--line); color: var(--ink); }
  .seg > .sel-a { background: var(--team-a); color: #0b0b0b; box-shadow: inset 0 0 0 3px #0b0b0b; }
  .seg > .sel-b { background: var(--team-b); color: #0b0b0b; }
  .seg > .sel-c { background: var(--team-c); color: #0b0b0b; }
}

@keyframes pulse {
  50% { opacity: 0.25; }
}

@media (prefers-reduced-motion: reduce) {
  .btn,
  .btn:active:not(:disabled),
  .press,
  .press:active {
    transition: none;
    transform: none;
  }
  .status.playing::before {
    animation: none;
  }
}

:focus-visible {
  outline: 2px solid var(--ink);
  outline-offset: 3px;
}
```

- [ ] **Step 4: Replace `vite.config.ts`**

```ts
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// The Install screen is all the public website may show, so the development
// bypass must never reach the live site (Plans/Install-first-access.md).
if (process.env.VERCEL && process.env.VITE_ALLOW_BROWSER === 'true') {
  throw new Error('VITE_ALLOW_BROWSER must never be set on Vercel. Remove it from the project settings.')
}

// Link previews (WhatsApp etc.) need the icon's full address. On Vercel that
// is the production domain; locally a relative path is fine.
const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : ''

function siteUrlInHtml(): Plugin {
  return {
    name: 'site-url-in-html',
    transformIndexHtml: (html) => html.replaceAll('__SITE_URL__', siteUrl),
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    siteUrlInHtml(),
    VitePWA({
      // New versions install themselves; friends get updates on next open.
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'app-icon.svg', 'logo.svg', 'mark-green.svg'],
      // Name and icon only: no description (the public sees nothing else).
      manifest: {
        id: '/',
        name: '7GZ-KORA',
        short_name: '7GZ-KORA',
        lang: 'en',
        theme_color: '#00BF63',
        background_color: '#00BF63',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell only. Data always comes fresh from Supabase.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
        navigateFallback: '/index.html',
      },
    }),
  ],
})
```

- [ ] **Step 5: Replace `index.html`, add `robots.txt`, document the bypass**

`index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>7GZ-KORA</title>
    <!-- The public sees the name and logo only: no description, hidden from search engines. -->
    <meta name="robots" content="noindex, nofollow" />
    <meta property="og:title" content="7GZ-KORA" />
    <meta property="og:type" content="website" />
    <meta property="og:image" content="__SITE_URL__/pwa-512x512.png" />
    <link rel="icon" href="/favicon.ico" sizes="48x48" />
    <link rel="icon" href="/app-icon.svg" sizes="any" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="/apple-touch-icon-180x180.png" />
    <meta name="theme-color" content="#00BF63" />
    <!-- iPhone: full-screen when opened from the Home Screen -->
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="7GZ-KORA" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`public/robots.txt`:

```
# 7GZ-KORA is private: hidden from search engines. Link-preview bots may read
# the page, so shared links show the name and logo (Plans/Install-first-access.md).
User-agent: facebookexternalhit
User-agent: WhatsApp
User-agent: TelegramBot
User-agent: Twitterbot
Allow: /

User-agent: *
Disallow: /
```

Append to `.env.example`:

```
# Development only. Lets a normal browser open the app instead of the
# Install screen (for `npm run dev` and screenshot checks).
# NEVER set this on Vercel: the build refuses to run if you do.
# VITE_ALLOW_BROWSER=true
```

- [ ] **Step 6: Rename the stored keys and the invite text**

In `src/lib/storage.ts` replace the `KEYS` object with:

```ts
export const KEYS = {
  currentGroup: 'kora.currentGroup',
  /** Invite code from a shared link, kept while the person installs and signs in. */
  pendingInvite: 'kora.pendingInvite',
  installDismissed: 'kora.installDismissed',
}
```

(`installDismissed` is removed in Task 9 together with the install nudge.)

In `src/pages/Settings.tsx`, `share()`: change the text to `` `Join ${group.name} on 7GZ-KORA. Invite code: ${code}` `` and the share title to `'7GZ-KORA'`.

- [ ] **Step 7: Check**

Run: `npx tsc -b && npm run build`
Expected: both succeed (the old screens look unstyled until Task 8; that's expected).

Run: `node -e "const m=JSON.parse(require('fs').readFileSync('dist/manifest.webmanifest','utf8')); if (m.name!=='7GZ-KORA' || 'description' in m || m.theme_color!=='#00BF63') process.exit(1); console.log('manifest ok')"`
Expected: `manifest ok`.

Run: `grep -c 'name="description"' dist/index.html; grep -o 'og:image" content="[^"]*"' dist/index.html`
Expected: `0`, then `og:image" content="/pwa-512x512.png"`.

---

### Task 8: Restyle the shared components and the remaining screens

**Files:**
- Modify (rewrite): `src/components/ui.tsx`, `src/components/Layout.tsx`
- Modify: `src/components/match.tsx` (`Scoreboard`, `Lineups`, `PlayerGrid`, two lines of `GoalList`), `src/lib/format.ts` (`ratingTone`), `src/lib/types.ts` (add `Bib`), `src/App.tsx` (`Splash`, `NotFound`, `SetupNeeded`), `src/pages/SignIn.tsx`
- Sweep: `src/pages/JoinOrCreate.tsx`, `Recorder.tsx`, `Vote.tsx`, `Leaderboard.tsx`, `PlayerProfile.tsx`, `Settings.tsx`, `HowItWorks.tsx`
- Not touched here (rewritten in Part D): `Home.tsx`, `Matches.tsx`, `MatchPage.tsx`, `MatchEdit.tsx`

**Interfaces:**
- Produces (`ui.tsx`): `Button({ variant?: 'primary'|'secondary'|'black'|'dark'|'danger'|'ghost', size?: 'sm'|'md'|'lg', busy?, ...buttonProps })`, `LinkButton({ to, variant?, size?, className?, children })`, `Card({ children, className?, strong?: boolean })`, `Heading`, `PageTitle`, `Spinner`, `Loading`, `ErrorNote`, `Notice`, `Name`, `RatingBadge`, `Avatar`, `TeamTag({ team: Bib })`, `StatusChip({ status: MatchStatus })`, `Empty`. Types: `Bib = Team | 'C'`.

- [ ] **Step 1: Rewrite `src/components/ui.tsx`**

```tsx
// Small building blocks used on every screen. The look follows
// Design/README.md; the CSS classes (btn, chip, label...) live in index.css.
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router'
import { initials, ratingTone } from '../lib/format'
import type { Bib, MatchStatus } from '../lib/types'

type Variant = 'primary' | 'secondary' | 'black' | 'dark' | 'danger' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

const sizes: Record<Size, string> = { sm: 'btn-sm', md: '', lg: 'btn-big' }

/**
 * Primary: green with black text, one per screen area. Black: the action on
 * green surfaces. Dark: ink (black, or white in dark mode). Ghost: a quiet text action.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  busy = false,
  disabled,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; busy?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      disabled={busy || disabled}
      className={`btn btn-${variant} ${sizes[size]} ${className}`}
    >
      {busy ? <Spinner small /> : children}
    </button>
  )
}

export function LinkButton({
  to,
  variant = 'primary',
  size = 'md',
  className = '',
  children,
}: {
  to: string
  variant?: Variant
  size?: Size
  className?: string
  children: ReactNode
}) {
  return (
    <Link to={to} className={`btn btn-${variant} ${sizes[size]} ${className}`}>
      {children}
    </Link>
  )
}

/** White card. `strong` gives important cards (money, live night) a bold ink border. */
export function Card({ children, className = '', strong = false }: { children: ReactNode; className?: string; strong?: boolean }) {
  return (
    <section
      className={`rounded-card bg-paper p-4 ${strong ? 'border-2 border-ink' : 'border-[1.5px] border-line'} ${className}`}
    >
      {children}
    </section>
  )
}

/** UPPERCASE label, like "THU 29 OCT · 20:00". */
export function Heading({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <h2 className={`label ${className}`}>{children}</h2>
}

export function PageTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-4">
      <h1 className="font-display text-[34px] leading-[1.05]">{children}</h1>
      {sub && <p className="mt-1 text-muted">{sub}</p>}
    </div>
  )
}

export function Spinner({ small = false }: { small?: boolean }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${small ? 'size-5' : 'size-8'}`}
    />
  )
}

export function Loading() {
  return (
    <div className="flex justify-center py-16 text-brand-ink">
      <Spinner />
    </div>
  )
}

export function ErrorNote({ message, onRetry }: { message: string | null | undefined; onRetry?: () => void }) {
  if (!message) return null
  return (
    <div role="alert" className="my-3 rounded-xl border-[1.5px] border-danger bg-paper p-3 text-sm font-semibold text-danger">
      {message}
      {onRetry && (
        <button type="button" onClick={onRetry} className="ml-2 underline">
          Try again
        </button>
      )}
    </div>
  )
}

export function Notice({ children }: { children: ReactNode }) {
  return <div className="my-3 rounded-xl bg-brand/15 p-3 text-sm text-ink">{children}</div>
}

/**
 * Names may be Arabic: <bdi> keeps them displaying correctly inside English
 * text, and text-left keeps them lined up with the other names in a list.
 */
export function Name({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <bdi dir="auto" className={`text-left ${className}`}>
      {children}
    </bdi>
  )
}

export function RatingBadge({ value, size = 'md' }: { value: number | null | undefined; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: 'h-6 min-w-9 text-base rounded-md',
    md: 'h-8 min-w-[46px] text-xl rounded-[10px]',
    lg: 'h-14 min-w-18 text-4xl rounded-xl',
  }
  return (
    <span
      className={`tabular inline-flex items-center justify-center px-1.5 font-display ${sizes[size]} ${ratingTone(value)}`}
    >
      {value == null ? '–' : Number(value).toFixed(1)}
    </span>
  )
}

export function Avatar({ name, url, size = 36 }: { name: string; url?: string | null; size?: number }) {
  if (url) {
    return (
      <img
        src={url}
        alt=""
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        className="shrink-0 rounded-full bg-line object-cover"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-brand font-display text-on-brand uppercase"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {initials(name)}
    </span>
  )
}

/** A team in its bib colour (A white, B orange, C blue). Always says "Team X", never colour alone. */
export function TeamTag({ team }: { team: Bib }) {
  return <span className={`chip team-${team.toLowerCase()}`}>Team {team}</span>
}

export function StatusChip({ status }: { status: MatchStatus }) {
  const label = { draft: 'Planned', playing: 'Live', voting: 'Voting', closed: 'Final', cancelled: 'Cancelled' }[status]
  return <span className={`chip status ${status}`}>{label}</span>
}

/** Empty state: the green mark, a one-line title and the next action. */
export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-card border-[1.5px] border-dashed border-line p-6 text-center">
      <img src="/mark-green.svg" alt="" className="mx-auto mb-2 h-24" />
      <p className="font-display text-lg">{title}</p>
      {children && <div className="mt-2 text-sm text-muted">{children}</div>}
    </div>
  )
}
```

In `src/lib/types.ts`, add after `export type Team = 'A' | 'B'`:

```ts
/** Bib colours. Team C (blue) plays once games arrive in stage 2. */
export type Bib = Team | 'C'
```

In `src/lib/format.ts`, replace `ratingTone` with:

```ts
/** Colour band of a rating badge (Design/README.md section 3; classes in index.css). */
export function ratingTone(value: number | null | undefined): string {
  if (value == null) return 'bg-line text-muted'
  if (value >= 8) return 'r-top'
  if (value >= 7) return 'r-good'
  if (value >= 6) return 'r-ok'
  return 'r-low'
}
```

- [ ] **Step 2: Rewrite `src/components/Layout.tsx`**

```tsx
import { NavLink, Outlet } from 'react-router'
import { useGroup } from '../state/group'
import { HomeIcon, MatchesIcon, MoreIcon, PersonIcon, TableIcon } from './icons'
import { Name } from './ui'

/** Honeycomb header + content + bottom tabs (one-handed navigation). */
export default function Layout() {
  const { group, myPlayerId } = useGroup()

  const tabs = [
    { to: '/', label: 'Home', icon: HomeIcon, end: true },
    { to: '/nights', label: 'Nights', icon: MatchesIcon, end: false },
    { to: '/table', label: 'Table', icon: TableIcon, end: false },
    { to: `/players/${myPlayerId}`, label: 'Me', icon: PersonIcon, end: false },
    { to: '/settings', label: 'More', icon: MoreIcon, end: false },
  ]

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="honeycomb sticky top-0 z-20 pt-[env(safe-area-inset-top)] text-on-brand">
        <div className="mx-auto flex h-16 max-w-xl items-center gap-2.5 px-4">
          <img src="/logo.svg" alt="" className="h-[46px] w-[30px] object-contain" />
          <div className="min-w-0 leading-none">
            <p className="font-display text-[22px] leading-none">7GZ-KORA</p>
            {group && (
              <p className="mt-1 truncate text-[11.5px] font-semibold opacity-75">
                <Name>{group.name}</Name>
              </p>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl flex-1 px-4 pt-4 pb-28">
        <Outlet />
      </main>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-20 border-t-[1.5px] border-line bg-paper pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="mx-auto grid h-16 max-w-xl grid-cols-5">
          {tabs.map(({ to, label, icon: Icon, end }) => (
            <li key={label}>
              <NavLink to={to} end={end} className="group flex h-full flex-col items-center justify-center gap-0.5 text-[10.5px] font-bold text-muted aria-[current=page]:text-ink">
                <span className="rounded-full px-3 py-[3px] group-aria-[current=page]:bg-brand group-aria-[current=page]:text-on-brand">
                  <Icon size={22} />
                </span>
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
```

(NavLink sets `aria-current="page"` on the active tab, so the green pill follows it.)

- [ ] **Step 3: Restyle the match pieces (`src/components/match.tsx`)**

Change the import line `import { Button, ErrorNote, Name } from './ui'` to `import { Button, ErrorNote, Name, TeamTag } from './ui'`. Replace `Scoreboard`, `Lineups` and `PlayerGrid` with:

```tsx
/** Team chips on top, the score below (Design/README.md, Scoreboard). */
export function Scoreboard({ score }: { score: Record<Team, number> }) {
  return (
    <div aria-label={`Team A ${score.A}, Team B ${score.B}`}>
      <div className="flex items-center justify-between">
        <TeamTag team="A" />
        <TeamTag team="B" />
      </div>
      <p className="tabular mt-0.5 text-center font-display text-[64px] leading-none whitespace-nowrap">
        {score.A} – {score.B}
      </p>
    </div>
  )
}

/** Two columns with each team's players. */
export function Lineups({ lineup }: { lineup: StintPlayer[] }) {
  const { playerName } = useGroup()
  return (
    <div className="grid grid-cols-2 gap-3">
      {(['A', 'B'] as const).map((team) => (
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
  const teams = only ? [only] : (['A', 'B'] as const)
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
                  className={`press min-h-14 rounded-xl border-2 border-[#0b0b0b] px-2 py-2 text-left font-semibold text-[#0b0b0b] ${
                    team === 'A' ? 'bg-team-a' : 'bg-team-b'
                  }`}
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
```

In `GoalList`, replace

```tsx
                <BallIcon size={20} className={`mt-0.5 shrink-0 ${g.scoring_team === 'A' ? 'text-team-a' : 'text-team-b'}`} />
```

with

```tsx
                <span className={`chip team-${g.scoring_team.toLowerCase()} mt-0.5 shrink-0 px-2`} aria-label={`Team ${g.scoring_team}`}>
                  {g.scoring_team}
                </span>
```

remove `BallIcon` from that file's icon import, change `<span className="text-team-a">Confirmed</span>` to `<span className="text-brand-ink">Confirmed</span>`, and change the action row's `pl-7` to `pl-10`.

- [ ] **Step 4: Sign-in, splash, not found and setup screens**

In `src/pages/SignIn.tsx`, replace the `return (...)` of `SignIn` with:

```tsx
  return (
    <main className="honeycomb flex min-h-dvh flex-col items-center justify-center px-6 pt-[env(safe-area-inset-top)] pb-[calc(env(safe-area-inset-bottom)+24px)] text-center">
      <img src="/logo.svg" alt="" className="h-[170px]" />
      {/* White lettering is allowed here only: it is the big logo lettering. */}
      <h1 className="mt-2.5 mb-9 font-display text-[44px] leading-none text-white">7GZ-KORA</h1>
      <div className="w-full max-w-sm">
        <Button variant="black" size="lg" className="w-full text-base" busy={busy} onClick={signInWithGoogle}>
          <GoogleMark /> Continue with Google
        </Button>
        <ErrorNote message={error} />

        {!emailCodeEnabled ? null : showEmail ? (
          <EmailCode />
        ) : (
          <button
            type="button"
            onClick={() => setShowEmail(true)}
            className="mt-6 min-h-12 w-full text-center text-sm font-semibold text-on-brand underline"
          >
            Trouble with Google? Sign in with an email code
          </button>
        )}
      </div>
    </main>
  )
```

Remove the now-unused `Link` import. In `EmailCode`, change the outer `<div className="mt-8 border-t border-line pt-6">` to `<div className="mt-6 rounded-card border-2 border-[#0b0b0b] bg-paper p-4 text-left text-ink">`, both inputs' `border border-line bg-card` to `border-[1.5px] border-line bg-paper`, the code input's `font-display text-3xl` stays, and `<h2 className="font-semibold">` to `<h2 className="label">`.

In `src/App.tsx`, replace `Splash`, `NotFound` and the first two lines of `SetupNeeded`'s JSX:

```tsx
function Splash() {
  return (
    <div className="honeycomb flex min-h-dvh items-center justify-center">
      <img src="/logo.svg" alt="Loading 7GZ-KORA" className="h-28 animate-pulse motion-reduce:animate-none" />
    </div>
  )
}

function NotFound({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="py-16 text-center">
      <p className="font-display text-3xl">Offside!</p>
      <p className="mt-1 text-muted">This page doesn't exist.</p>
      <Link to="/" onClick={onRetry} className="mt-4 inline-block font-semibold text-brand-ink underline">
        Back to home
      </Link>
    </div>
  )
}
```

and in `SetupNeeded`: `<img src="/mark-green.svg" alt="" className="mb-4 h-16" />` and `<h1 className="font-display text-3xl">Almost there</h1>`.

- [ ] **Step 5: Sweep the screens that stay**

```bash
FILES="src/pages/JoinOrCreate.tsx src/pages/Recorder.tsx src/pages/Vote.tsx src/pages/Leaderboard.tsx src/pages/PlayerProfile.tsx src/pages/Settings.tsx src/pages/HowItWorks.tsx"
sed -i -E \
  -e 's/\bbg-card\/95\b/bg-paper\/95/g' -e 's/\bbg-card\b/bg-paper/g' -e 's/\btext-card\b/text-paper/g' \
  -e 's/\btext-pitch\b/text-brand-ink/g' \
  -e 's/\bbg-team-a-soft\/60\b/bg-brand\/15/g' \
  -e 's/\bbg-primary text-white\b/bg-brand text-on-brand/g' \
  -e 's/\brounded-2xl\b/rounded-card/g' \
  -e 's/\bborder border-line\b/border-[1.5px] border-line/g' \
  -e 's/(font-display[^"`]*) font-bold/\1/g' \
  $FILES
```

Then these hand edits:

- `Recorder.tsx`: the "last goal" banner `className="flex items-center gap-3 rounded-card bg-pitch-deep p-3 text-white"` → `className="flex items-center gap-3 rounded-card bg-ink p-3 text-paper"`; its Undo button `bg-white/15` → `border-2 border-current`.
- `Vote.tsx`: the score grid `grid grid-cols-5 gap-1.5 min-[400px]:grid-cols-10` → `grid grid-cols-5 gap-1.5` (two rows of five); score buttons `h-11 rounded-lg` → `h-[42px] rounded-[10px] border-[1.5px]`, selected `bg-brand text-on-brand` → `border-[#0b0b0b] bg-brand text-on-brand`, unselected `bg-ground text-ink` → `border-transparent bg-ground text-ink`.
- `Leaderboard.tsx`: selected year tab `bg-brand text-on-brand` → `border-2 border-[#0b0b0b] bg-brand text-on-brand`.

- [ ] **Step 6: Check**

Run: `npx tsc -b && npm run lint && npm test && npm run build`
Expected: all pass.

Run: `grep -nE "\b(text-white|bg-white)\b" src -r`
Expected: only `SignIn.tsx` (the logo lettering). Anything else on green must be black.

---

## Part C — Install-first access

### Task 9: The Install screen and the gate

**Files:**
- Create: `src/lib/access.ts`, `src/lib/access.test.ts`, `src/lib/installTarget.ts`, `src/lib/installTarget.test.ts`, `src/pages/InstallScreen.tsx`
- Modify: `src/App.tsx` (gate; drop the `/install` route), `src/pages/Home.tsx` (drop `InstallNudge`), `src/pages/Settings.tsx` (drop the "Install the app" card), `src/pages/HowItWorks.tsx` (drop `InstallGuide`), `src/lib/storage.ts` (drop `installDismissed`), `src/lib/pwa.ts` (drop `isAndroid`)
- Delete: `src/pages/Install.tsx`, `src/components/InstallGuide.tsx`

**Interfaces:**
- Produces: `appMode({ standalone: boolean; allowBrowser: boolean }): 'install' | 'app'`, `allowBrowser: boolean`, `inviteCodeFromUrl(pathname: string, search: string): string | null`, `installTarget(userAgent: string, maxTouchPoints: number): InstallTarget` where `InstallTarget = 'ios-safari' | 'ios-other' | 'android-chrome' | 'android-other' | 'desktop-chromium' | 'mac-safari' | 'other'`.

- [ ] **Step 1: Write the failing tests**

`src/lib/access.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { appMode, inviteCodeFromUrl } from './access'

describe('appMode: Install screen or the app?', () => {
  it('a browser sees only the Install screen', () => {
    expect(appMode({ standalone: false, allowBrowser: false })).toBe('install')
  })
  it('the installed app runs the app', () => {
    expect(appMode({ standalone: true, allowBrowser: false })).toBe('app')
  })
  it('the development setting lets a browser run the app', () => {
    expect(appMode({ standalone: false, allowBrowser: true })).toBe('app')
  })
})

describe('inviteCodeFromUrl', () => {
  it('reads and cleans the code of an invite link', () => {
    expect(inviteCodeFromUrl('/join', '?code=kick-7q3f')).toBe('KICK-7Q3F')
    expect(inviteCodeFromUrl('/join', '?code=<b>KICK</b>')).toBe('BKICKB')
  })
  it('ignores other pages and empty codes', () => {
    expect(inviteCodeFromUrl('/', '?code=KICK-7Q3F')).toBeNull()
    expect(inviteCodeFromUrl('/join', '')).toBeNull()
  })
})
```

`src/lib/installTarget.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { installTarget } from './installTarget'

const UA = {
  iphoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
  iphoneInstagram:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22F76 Instagram 380.0.0.0.0',
  iphoneChrome:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/138.0.7204.0 Mobile/15E148 Safari/604.1',
  macSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
  androidChrome:
    'Mozilla/5.0 (Linux; Android 14; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36',
  androidInApp:
    'Mozilla/5.0 (Linux; Android 14; SM-S911B Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/138.0.0.0 Mobile Safari/537.36',
  androidSamsung:
    'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/125.0.0.0 Mobile Safari/537.36',
  windowsChrome:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
  windowsEdge:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0',
  firefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0',
}

describe('installTarget: which steps the Install screen shows', () => {
  it('iPhone: Safari installs; any other app or browser must open Safari first', () => {
    expect(installTarget(UA.iphoneSafari, 5)).toBe('ios-safari')
    expect(installTarget(UA.iphoneInstagram, 5)).toBe('ios-other')
    expect(installTarget(UA.iphoneChrome, 5)).toBe('ios-other')
  })
  it('an iPad asking for the desktop site is still an iPad; a Mac is a Mac', () => {
    expect(installTarget(UA.macSafari, 5)).toBe('ios-safari')
    expect(installTarget(UA.macSafari, 0)).toBe('mac-safari')
  })
  it('Android: Chrome installs; in-app and other browsers must open Chrome first', () => {
    expect(installTarget(UA.androidChrome, 5)).toBe('android-chrome')
    expect(installTarget(UA.androidInApp, 5)).toBe('android-other')
    expect(installTarget(UA.androidSamsung, 5)).toBe('android-other')
  })
  it('computers: Chrome and Edge install; anything else is told to use them', () => {
    expect(installTarget(UA.windowsChrome, 0)).toBe('desktop-chromium')
    expect(installTarget(UA.windowsEdge, 0)).toBe('desktop-chromium')
    expect(installTarget(UA.firefox, 0)).toBe('other')
  })
})
```

Run: `npx vitest run src/lib` → Expected: FAIL (modules not found).

- [ ] **Step 2: Implement the two modules**

`src/lib/access.ts`:

```ts
// Install-first access (Plans/Install-first-access.md): in a browser the
// website shows only the Install screen; the app runs once it is installed.

export type AppMode = 'install' | 'app'

/** Development-only bypass: VITE_ALLOW_BROWSER=true in .env.local. Never on Vercel. */
export const allowBrowser = import.meta.env.VITE_ALLOW_BROWSER === 'true'

export function appMode({ standalone, allowBrowser }: { standalone: boolean; allowBrowser: boolean }): AppMode {
  return standalone || allowBrowser ? 'app' : 'install'
}

/** The code of an invite link (/join?code=KICK-7Q3F), cleaned up, or null. */
export function inviteCodeFromUrl(pathname: string, search: string): string | null {
  if (pathname !== '/join') return null
  const code = (new URLSearchParams(search).get('code') ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, 12)
  return code || null
}
```

`src/lib/installTarget.ts`:

```ts
// Which install steps the Install screen shows (Plans/Install-first-access.md section 2).

export type InstallTarget =
  | 'ios-safari' // iPhone or iPad in Safari: Share → Add to Home Screen
  | 'ios-other' // iPhone inside another app or browser: open in Safari first
  | 'android-chrome' // Android Chrome: Install app
  | 'android-other' // Android in-app or other browser: open in Chrome first
  | 'desktop-chromium' // Computer, Chrome or Edge: Install app
  | 'mac-safari' // Mac Safari: File → Add to Dock
  | 'other' // Anything else (e.g. Firefox): open in Chrome or Edge

export function installTarget(userAgent: string, maxTouchPoints: number): InstallTarget {
  const ua = userAgent
  // iPads asking for the desktop site report themselves as Macs, but Macs have no touch screen.
  const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1)
  const safari = /Version\/[\d.]+.*Safari\//.test(ua)

  if (ios) {
    return safari && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua) ? 'ios-safari' : 'ios-other'
  }
  if (/Android/i.test(ua)) {
    // In-app browsers (WhatsApp, Instagram, Facebook...) mark themselves with "wv".
    const otherBrowser = /; wv\)|SamsungBrowser|Firefox|EdgA|OPR|YaBrowser|UCBrowser|MiuiBrowser|FBAN|FBAV|Instagram/
    return /Chrome\/[\d.]+/.test(ua) && !otherBrowser.test(ua) ? 'android-chrome' : 'android-other'
  }
  if (/Chrome\/[\d.]+/.test(ua) && !/OPR\/|YaBrowser/.test(ua)) return 'desktop-chromium'
  if (/Macintosh/.test(ua) && safari) return 'mac-safari'
  return 'other'
}
```

Run: `npx vitest run src/lib` → Expected: PASS (9 tests).

- [ ] **Step 3: Build the Install screen**

Create `src/pages/InstallScreen.tsx`:

```tsx
import { useEffect, useState, type ReactNode } from 'react'
import { Button } from '../components/ui'
import { inviteCodeFromUrl } from '../lib/access'
import { installTarget, type InstallTarget } from '../lib/installTarget'
import { useInstallPrompt } from '../lib/pwa'
import { KEYS, writeLocal } from '../lib/storage'

/**
 * All the website shows in a browser (Plans/Install-first-access.md): the
 * logo, the name and how to install on this device, plus the invite code
 * when opened from an invite link. Nothing else about the app or any group.
 */
export default function InstallScreen() {
  const [target] = useState(() => installTarget(navigator.userAgent, navigator.maxTouchPoints))
  const [code] = useState(() => inviteCodeFromUrl(window.location.pathname, window.location.search))

  // Android shares storage between Chrome and the installed app, so the code
  // can be waiting there. On iPhone people type it after signing in.
  useEffect(() => {
    if (code) writeLocal(KEYS.pendingInvite, code)
  }, [code])

  return (
    <main className="honeycomb flex min-h-dvh flex-col items-center px-[18px] pt-[calc(env(safe-area-inset-top)+40px)] pb-[calc(env(safe-area-inset-bottom)+24px)] text-center">
      <img src="/logo.svg" alt="" className="h-[120px]" />
      {/* White lettering is allowed here only: it is the big logo lettering. */}
      <h1 className="mt-2 mb-[18px] font-display text-[38px] leading-none text-white">7GZ-KORA</h1>
      <div className="w-full max-w-sm space-y-2.5 text-left">
        <Steps target={target} />
        {code && <InviteCode code={code} />}
      </div>
    </main>
  )
}

const list = 'list-decimal space-y-1 pl-5 font-semibold leading-relaxed'

function Steps({ target }: { target: InstallTarget }) {
  const { canInstall, install } = useInstallPrompt()
  const installButton = canInstall && (
    <Button variant="black" className="mb-3 w-full" onClick={() => void install()}>
      Install app
    </Button>
  )

  switch (target) {
    case 'ios-safari':
      return (
        <StepsCard title="Install on iPhone">
          <ol className={list}>
            <li>
              Tap <b>Share</b> in Safari (the square with an arrow)
            </li>
            <li>
              Tap <b>Add to Home Screen</b>, then <b>Add</b>
            </li>
            <li>Open 7GZ-KORA from your home screen</li>
          </ol>
        </StepsCard>
      )
    case 'android-chrome':
      return (
        <StepsCard title="Install on Android">
          {installButton}
          <ol className={list}>
            <li>
              Tap the menu <b>⋮</b> (top right)
            </li>
            <li>
              Tap <b>Install app</b> (or <b>Add to Home screen</b>)
            </li>
            <li>Open 7GZ-KORA from your home screen</li>
          </ol>
        </StepsCard>
      )
    case 'desktop-chromium':
      return (
        <StepsCard title="Install on this computer">
          {installButton}
          <p className="font-semibold">Or click the install icon at the right of the address bar.</p>
        </StepsCard>
      )
    case 'mac-safari':
      return (
        <StepsCard title="Install on Mac">
          <ol className={list}>
            <li>
              In the menu bar, click <b>File</b> → <b>Add to Dock</b>
            </li>
            <li>Open 7GZ-KORA from the Dock</li>
          </ol>
        </StepsCard>
      )
    case 'ios-other':
      return <OpenElsewhere browser="Safari" />
    case 'android-other':
      return <OpenElsewhere browser="Chrome" />
    default:
      return <OpenElsewhere browser="Chrome or Edge" />
  }
}

function StepsCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-card border-2 border-[#0b0b0b] bg-paper p-3.5 text-ink">
      <h2 className="label mb-1.5">{title}</h2>
      {children}
    </section>
  )
}

/** In-app browsers and other browsers can't install: open the page in the right one. */
function OpenElsewhere({ browser }: { browser: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <StepsCard title="Install">
      <p className="font-semibold">
        Open this page in <b>{browser}</b> to install.
      </p>
      <Button
        variant="black"
        className="mt-3 w-full"
        onClick={() =>
          void navigator.clipboard
            .writeText(window.location.href)
            .then(() => setCopied(true))
            .catch(() => setCopied(false))
        }
      >
        {copied ? 'Link copied' : 'Copy link'}
      </Button>
    </StepsCard>
  )
}

function InviteCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <section className="rounded-card border-2 border-[#0b0b0b] bg-paper p-3.5 text-ink">
      <h2 className="label">Your invite code</h2>
      <div className="flex items-center justify-between gap-2">
        <span className="font-display text-2xl tracking-[0.06em]">{code}</span>
        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            void navigator.clipboard
              .writeText(code)
              .then(() => setCopied(true))
              .catch(() => setCopied(false))
          }
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <p className="text-sm text-muted">Enter it after you install and sign in.</p>
    </section>
  )
}
```

- [ ] **Step 4: Put the gate in front of everything and remove the old install bits**

In `src/App.tsx`: import `InstallScreen` from `./pages/InstallScreen`, `{ allowBrowser, appMode }` from `./lib/access` and `{ isStandalone }` from `./lib/pwa`; remove the `Install` import; make `App` start with:

```tsx
export default function App() {
  // In a browser the website shows only the Install screen (Plans/Install-first-access.md).
  if (appMode({ standalone: isStandalone(), allowBrowser }) === 'install') return <InstallScreen />
  if (!isConfigured) return <SetupNeeded />
```

and delete the line `if (location.pathname === '/install') return <Install />` from `AuthGate`.

Then:

```bash
git rm src/pages/Install.tsx src/components/InstallGuide.tsx
```

- `src/pages/Home.tsx`: delete the `InstallNudge` function and `<InstallNudge />`, and the now-unused imports (`isStandalone`, `KEYS`, `readLocal`, `writeLocal`).
- `src/pages/Settings.tsx`: delete the card containing `Install the app on your phone`.
- `src/pages/HowItWorks.tsx`: delete the `InstallGuide` import and the `<div id="install">…</div>` block; change the doc comment to `/** "How is my rating calculated?" */`.
- `src/pages/SignIn.tsx` no longer links to `/install` (done in Task 8).
- `src/lib/storage.ts`: delete `installDismissed`.
- `src/lib/pwa.ts`: delete `isAndroid` (the Install screen uses `installTarget`).

- [ ] **Step 5: Check**

Run: `npx tsc -b && npm run lint && npm test && npm run build` → Expected: all pass.
Run: `grep -rniE "ta7dy|la3eeba" src index.html vite.config.ts package.json public` → Expected: no output.

---

## Part D — Night logic and screens

### Task 10: Types, API and night helpers

**Files:**
- Modify: `src/lib/types.ts`, `src/lib/api.ts`, `src/lib/format.ts`
- Create: `src/lib/night.ts`, `src/lib/money.ts`, `src/lib/share.ts`
- Test: `src/lib/night.test.ts`, `src/lib/money.test.ts`, `src/lib/share.test.ts`, `src/lib/format.test.ts`

**Interfaces:**
- Consumes: the SQL functions from Part A.
- Produces (types): `MatchStatus` + `'cancelled'`; `RsvpStatus = 'in' | 'waiting' | 'out'`; `CancelReason`; `Match` + night fields; `Rsvp { player_id, status, status_changed_at, waiting_since, promoted_at }`; `CheckIn { player_id, arrived_at, left_at }`; `NightDetails`; `NightForm { day, time, location, duration_minutes, cost, players_per_side, collector_player_id, game_minutes, player_cap }`; `Payer { player_id, share, paid_at, is_collector }`; `MoneyOwed { match_id, played_at, share, currency, collector_player_id }`; `MatchSummary.rsvps: Rsvp[]`; `MatchDetail.checkIns: CheckIn[]`, `MatchDetail.rsvps: Rsvp[]`.
- Produces (API): `getLastNight(groupId): Promise<Match | null>`, `planNight(groupId, NightDetails): Promise<string>`, `updateNight(matchId, NightDetails)`, `setRsvp(matchId, 'in' | 'out'): Promise<RsvpStatus>`, `startNight(matchId)`, `checkIn(matchId, playerId)`, `checkOut(matchId, playerId)`, `undoCheckIn(matchId, playerId)`, `endNight(matchId)`, `cancelNight(matchId, CancelReason, note: string, fee: number)`, `getNightMoney(matchId): Promise<Payer[]>`, `getMoneyOwed(groupId): Promise<MoneyOwed[]>`, `markPaid(matchId, playerId)`, `unmarkPaid(matchId, playerId)`.
- Produces (helpers): `format.ts`: `dayOf(date)`, `clockOf(isoOrDate)`, `formatNightWhen({ played_at, starts_at })`, `formatLength(minutes)`, `nightFacts(night)`, `CANCEL_REASONS`; `night.ts`: `toStartsAt(day, time)`, `capFor(side)`, `formFromNight(match)`, `nightDefaults(last, myPlayerId, now)`, `formToDetails(form)`, `withSide(form, side)`, `rsvpSummary(rsvps, memberPlayerIds)`; `money.ts`: `isPaid(payer)`, `moneyTotals(payers, amount)`; `share.ts`: `plannedNightText(night, inCount)`, `cancelledNightText(night, now)`, `shareText(text, url)`.

- [ ] **Step 1: Write the failing tests**

`src/lib/format.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { formatLength, formatNightWhen, nightFacts, ratingTone } from './format'
import { toStartsAt } from './night'

describe('night formatting', () => {
  it('formatLength', () => {
    expect([120, 60, 90, 45].map(formatLength)).toEqual(['2 hours', '1 hour', '1 hour 30 min', '45 min'])
  })
  it('nightFacts: side size, length and cost (when there is one)', () => {
    expect(nightFacts({ players_per_side: 6, duration_minutes: 120, cost: 600, currency: 'EGP' })).toBe(
      '6 a side · 2 hours · 600 EGP',
    )
    expect(nightFacts({ players_per_side: 5, duration_minutes: 90, cost: 0, currency: 'EGP' })).toBe(
      '5 a side · 1 hour 30 min',
    )
  })
  it('formatNightWhen', () => {
    expect(formatNightWhen({ played_at: '2026-10-29', starts_at: toStartsAt('2026-10-29', '20:00') })).toBe(
      'Thu 29 Oct · 20:00',
    )
    expect(formatNightWhen({ played_at: '2026-10-29', starts_at: null })).toBe('Thu 29 Oct')
  })
  it('rating badge colour bands', () => {
    expect([8.4, 7.6, 6.5, 5.8].map(ratingTone)).toEqual(['r-top', 'r-good', 'r-ok', 'r-low'])
  })
})
```

`src/lib/night.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { clockOf } from './format'
import { formToDetails, nightDefaults, rsvpSummary, toStartsAt, withSide } from './night'
import type { Match, Rsvp } from './types'

// Thursday 22 October 2026, 20:00.
const lastNight: Match = {
  id: 'm1',
  group_id: 'g1',
  played_at: '2026-10-22',
  starts_at: toStartsAt('2026-10-22', '20:00'),
  location: 'Club pitch 3',
  duration_minutes: 120,
  cost: 600,
  currency: 'EGP',
  collector_player_id: 'ahmed',
  players_per_side: 6,
  game_minutes: 10,
  player_cap: 18,
  status: 'closed',
  voting_closes_at: null,
  closed_at: null,
  cancel_reason: null,
  cancel_note: null,
  cancel_fee: 0,
  cancelled_at: null,
  created_at: '2026-10-20T10:00:00Z',
}

describe('nightDefaults: "Plan a night" is pre-filled from the last night', () => {
  it('with no previous night: today at 20:00, 6 a side, limit 18, I collect', () => {
    expect(nightDefaults(null, 'me', new Date(2026, 9, 24, 15, 0))).toEqual({
      day: '2026-10-24',
      time: '20:00',
      location: '',
      duration_minutes: 120,
      cost: 0,
      players_per_side: 6,
      collector_player_id: 'me',
      game_minutes: 10,
      player_cap: 18,
    })
  })

  it('copies the last night onto the next same weekday', () => {
    // Today is Saturday 24 October: the next Thursday is the 29th.
    expect(nightDefaults(lastNight, 'me', new Date(2026, 9, 24, 15, 0))).toEqual({
      day: '2026-10-29',
      time: '20:00',
      location: 'Club pitch 3',
      duration_minutes: 120,
      cost: 600,
      players_per_side: 6,
      collector_player_id: 'ahmed',
      game_minutes: 10,
      player_cap: 18,
    })
  })

  it('on the day itself: today if the start is still ahead, otherwise next week', () => {
    expect(nightDefaults(lastNight, 'me', new Date(2026, 9, 29, 15, 0)).day).toBe('2026-10-29')
    expect(nightDefaults(lastNight, 'me', new Date(2026, 9, 29, 21, 0)).day).toBe('2026-11-05')
  })

  it('I collect when the last night had no collector', () => {
    const form = nightDefaults({ ...lastNight, collector_player_id: null }, 'me', new Date(2026, 9, 24))
    expect(form.collector_player_id).toBe('me')
  })
})

describe('the Plan a night form', () => {
  it('turns the local date and time into what the database expects', () => {
    const details = formToDetails(nightDefaults(lastNight, 'me', new Date(2026, 9, 24, 15, 0)))
    expect(details.played_at).toBe('2026-10-29')
    expect(details.starts_at).toBe(toStartsAt('2026-10-29', '20:00'))
    expect(clockOf(details.starts_at)).toBe('20:00')
    expect(details.player_cap).toBe(18)
  })

  it('the player limit follows the side size unless it was changed by hand', () => {
    const form = nightDefaults(null, 'me', new Date(2026, 9, 24))
    expect(withSide(form, 7).player_cap).toBe(21)
    expect(withSide({ ...form, player_cap: 20 }, 7).player_cap).toBe(20)
    expect(withSide({ ...form, player_cap: null }, 7).player_cap).toBeNull()
  })
})

describe('rsvpSummary', () => {
  const reply = (player_id: string, status: Rsvp['status'], waiting_since: string | null = null): Rsvp => ({
    player_id,
    status,
    status_changed_at: '2026-10-24T10:00:00Z',
    waiting_since,
    promoted_at: null,
  })

  it('splits the answers, keeps the waiting list in order and finds who has not replied', () => {
    const s = rsvpSummary(
      [
        reply('a', 'in'),
        reply('b', 'out'),
        reply('c', 'waiting', '2026-10-24T12:00:00Z'),
        reply('d', 'waiting', '2026-10-24T11:00:00Z'),
      ],
      ['a', 'b', 'c', 'd', 'e', 'f'],
    )
    expect(s).toEqual({ in: ['a'], waiting: ['d', 'c'], out: ['b'], noReply: ['e', 'f'] })
  })
})
```

`src/lib/money.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { moneyTotals } from './money'
import type { Payer } from './types'

const payer = (n: number, paid: boolean, is_collector = false): Payer => ({
  player_id: `p${n}`,
  share: 47,
  paid_at: paid ? '2026-10-23T10:00:00Z' : null,
  is_collector,
})

describe('moneyTotals', () => {
  it('worked example: 600 EGP, 13 players at 47; the collector and 8 others have paid', () => {
    const payers = [
      payer(1, false, true),
      ...Array.from({ length: 8 }, (_, i) => payer(i + 2, true)),
      ...Array.from({ length: 4 }, (_, i) => payer(i + 10, false)),
    ]
    expect(moneyTotals(payers, 600)).toEqual({ share: 47, players: 13, total: 611, collected: 423, extra: 11, unpaid: 4 })
  })

  it('no payers: nothing to show', () => {
    expect(moneyTotals([], 600)).toEqual({ share: 0, players: 0, total: 0, collected: 0, extra: 0, unpaid: 0 })
  })
})
```

`src/lib/share.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { toStartsAt } from './night'
import { cancelledNightText, plannedNightText } from './share'

describe('WhatsApp texts', () => {
  const night = {
    played_at: '2026-10-29',
    starts_at: toStartsAt('2026-10-29', '20:00'),
    location: 'Club pitch 3',
    players_per_side: 6,
  }

  it('a planned night', () => {
    expect(plannedNightText(night, 11)).toBe(
      "Thursday 29 Oct, 20:00 at Club pitch 3 · 6 a side · 11 in so far. Open 7GZ-KORA to say if you're in.",
    )
    expect(plannedNightText({ ...night, location: null }, 0)).toBe(
      "Thursday 29 Oct, 20:00 · 6 a side · 0 in so far. Open 7GZ-KORA to say if you're in.",
    )
  })

  it('a cancelled night says "Tonight" on the day itself', () => {
    const cancelled = { played_at: '2026-10-29', cancel_reason: 'rain' as const, cancel_note: null }
    expect(cancelledNightText(cancelled, new Date(2026, 9, 29, 17, 0))).toBe('Tonight is cancelled (rain).')
    expect(cancelledNightText(cancelled, new Date(2026, 9, 27, 9, 0))).toBe('Thursday 29 Oct is cancelled (rain).')
    expect(
      cancelledNightText({ ...cancelled, cancel_reason: 'other', cancel_note: 'Pitch double-booked' }, new Date(2026, 9, 29)),
    ).toBe('Tonight is cancelled (Pitch double-booked).')
  })
})
```

Run: `npx vitest run src/lib` → Expected: FAIL (missing modules and exports).

- [ ] **Step 2: Update the types**

In `src/lib/types.ts`:

Replace `export type MatchStatus = 'draft' | 'playing' | 'voting' | 'closed'` with:

```ts
/** draft = a planned night. A night is a row in matches; only the screens say "night". */
export type MatchStatus = 'draft' | 'playing' | 'voting' | 'closed' | 'cancelled'
export type RsvpStatus = 'in' | 'waiting' | 'out'
export type CancelReason = 'rain' | 'not_enough_players' | 'pitch_problem' | 'other'
```

Replace the `Match` interface with:

```ts
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
```

In `MatchSummary` add `rsvps: Rsvp[]`. In `MatchDetail` change the `playerIds` comment to `/** Everyone checked in. */` and add:

```ts
  checkIns: CheckIn[]
  rsvps: Rsvp[]
```

- [ ] **Step 3: Formatting helpers**

In `src/lib/format.ts`, change the first line to `import type { CancelReason, Match, Team } from './types'`, replace `todayIso` with the first two functions below, and append the rest:

```ts
const pad = (n: number) => String(n).padStart(2, '0')

/** A Date as "2026-10-29" in local time. */
export function dayOf(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Today as "2026-10-23" in local time. */
export function todayIso(): string {
  return dayOf(new Date())
}

/** A time as "20:05" in local time. */
export function clockOf(value: string | Date): string {
  const d = new Date(value)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** "Thu 29 Oct · 20:00" (just the day when there's no start time). */
export function formatNightWhen(night: { played_at: string; starts_at: string | null }): string {
  return night.starts_at ? `${formatDay(night.played_at)} · ${clockOf(night.starts_at)}` : formatDay(night.played_at)
}

/** 120 -> "2 hours", 90 -> "1 hour 30 min", 45 -> "45 min" */
export function formatLength(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const hours = h === 0 ? '' : `${h} hour${h === 1 ? '' : 's'}`
  if (!m) return hours
  return hours ? `${hours} ${m} min` : `${m} min`
}

/** "6 a side · 2 hours · 600 EGP" */
export function nightFacts(night: Pick<Match, 'players_per_side' | 'duration_minutes' | 'cost' | 'currency'>): string {
  const parts = [`${night.players_per_side} a side`, formatLength(night.duration_minutes)]
  if (Number(night.cost) > 0) parts.push(`${Number(night.cost)} ${night.currency}`)
  return parts.join(' · ')
}

export const CANCEL_REASONS: Record<CancelReason, string> = {
  rain: 'Rain',
  not_enough_players: 'Not enough players',
  pitch_problem: 'Pitch problem',
  other: 'Other',
}
```

- [ ] **Step 4: `night.ts`, `money.ts`, `share.ts`**

`src/lib/night.ts`:

```ts
// Helpers for planning nights and showing replies. Pure functions (tested in night.test.ts).
import { clockOf, dayOf, parseDay } from './format'
import type { Match, NightDetails, NightForm, Rsvp } from './types'

/** "2026-10-29" + "20:00" in the phone's local time, as an ISO timestamp. */
export function toStartsAt(day: string, time: string): string {
  const [y, m, d] = day.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  return new Date(y, m - 1, d, hh, mm).toISOString()
}

/** The default player limit: three teams' worth (18 for 6 a side). */
export const capFor = (side: number) => side * 3

/** The form for editing an existing night. */
export function formFromNight(m: Match): NightForm {
  return {
    day: m.played_at,
    time: m.starts_at ? clockOf(m.starts_at) : '20:00',
    location: m.location ?? '',
    duration_minutes: m.duration_minutes,
    cost: Number(m.cost),
    players_per_side: m.players_per_side,
    collector_player_id: m.collector_player_id,
    game_minutes: m.game_minutes,
    player_cap: m.player_cap,
  }
}

/**
 * A new night, pre-filled from the last one so planning is usually one tap:
 * the same weekday (the next one from today) and start time, and the same
 * pitch, length, cost, side size, collector, game length and player limit.
 */
export function nightDefaults(last: Match | null, myPlayerId: string, now: Date): NightForm {
  if (!last) {
    return {
      day: dayOf(now),
      time: '20:00',
      location: '',
      duration_minutes: 120,
      cost: 0,
      players_per_side: 6,
      collector_player_id: myPlayerId,
      game_minutes: 10,
      player_cap: capFor(6),
    }
  }
  const form = formFromNight(last)
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let ahead = (parseDay(last.played_at).getDay() - date.getDay() + 7) % 7
  // Today is the day, but the start time has passed: next week.
  if (ahead === 0 && clockOf(now) >= form.time) ahead = 7
  date.setDate(date.getDate() + ahead)
  return { ...form, day: dayOf(date), collector_player_id: form.collector_player_id ?? myPlayerId }
}

export function formToDetails(f: NightForm): NightDetails {
  return {
    played_at: f.day,
    starts_at: toStartsAt(f.day, f.time),
    location: f.location.trim(),
    duration_minutes: f.duration_minutes,
    cost: f.cost,
    players_per_side: f.players_per_side,
    collector_player_id: f.collector_player_id,
    game_minutes: f.game_minutes,
    player_cap: f.player_cap,
  }
}

/** Changes the side size. The player limit follows, unless it was changed by hand. */
export function withSide(f: NightForm, side: number): NightForm {
  const follows = f.player_cap === capFor(f.players_per_side)
  return { ...f, players_per_side: side, player_cap: follows ? capFor(side) : f.player_cap }
}

export interface RsvpSummary {
  in: string[]
  /** In the order they joined the waiting list. */
  waiting: string[]
  out: string[]
  /** Members who haven't answered. */
  noReply: string[]
}

export function rsvpSummary(rsvps: Rsvp[], memberPlayerIds: string[]): RsvpSummary {
  const ids = (status: Rsvp['status']) => rsvps.filter((r) => r.status === status)
  const replied = new Set(rsvps.map((r) => r.player_id))
  return {
    in: ids('in').map((r) => r.player_id),
    waiting: ids('waiting')
      .sort((a, b) => (a.waiting_since ?? '').localeCompare(b.waiting_since ?? ''))
      .map((r) => r.player_id),
    out: ids('out').map((r) => r.player_id),
    noReply: memberPlayerIds.filter((id) => !replied.has(id)),
  }
}
```

`src/lib/money.ts`:

```ts
// Totals for a night's money card. The share itself (cost ÷ players, rounded
// up to a whole pound) is worked out in the database: night_payer_rows.
import type { Payer } from './types'

/** The collector counts as paid automatically. */
export const isPaid = (p: Payer) => p.is_collector || p.paid_at !== null

export interface MoneyTotals {
  share: number
  players: number
  /** What everyone pays together (share × players). */
  total: number
  collected: number
  /** Rounding up means the collector gets a little more than the pitch costs. */
  extra: number
  unpaid: number
}

export function moneyTotals(payers: Payer[], amount: number): MoneyTotals {
  const share = payers[0]?.share ?? 0
  const paid = payers.filter(isPaid).length
  const total = share * payers.length
  return {
    share,
    players: payers.length,
    total,
    collected: share * paid,
    extra: Math.max(0, total - amount),
    unpaid: payers.length - paid,
  }
}
```

`src/lib/share.ts`:

```ts
// Ready-to-send messages for WhatsApp (or any app), Plans/Extras-and-backlog.md
// section 5. Links open the Install screen in a browser, so the messages say
// "Open 7GZ-KORA" instead of relying on the link.
import { clockOf, parseDay } from './format'
import type { Match } from './types'

/** "Thursday 29 Oct" */
function longDay(d: Date): string {
  const weekday = d.toLocaleDateString('en-GB', { weekday: 'long' })
  const month = d.toLocaleDateString('en-GB', { month: 'short' })
  return `${weekday} ${d.getDate()} ${month}`
}

/** "Thursday 29 Oct, 20:00 at Club pitch 3 · 6 a side · 11 in so far. Open 7GZ-KORA to say if you're in." */
export function plannedNightText(
  night: Pick<Match, 'played_at' | 'starts_at' | 'location' | 'players_per_side'>,
  inCount: number,
): string {
  const day = longDay(parseDay(night.played_at))
  const when = night.starts_at ? `${day}, ${clockOf(night.starts_at)}` : day
  const where = night.location ? ` at ${night.location}` : ''
  return `${when}${where} · ${night.players_per_side} a side · ${inCount} in so far. Open 7GZ-KORA to say if you're in.`
}

const REASON_TEXT = { rain: 'rain', not_enough_players: 'not enough players', pitch_problem: 'pitch problem' }

/** "Tonight is cancelled (rain)." or "Thursday 29 Oct is cancelled (pitch problem)." */
export function cancelledNightText(
  night: Pick<Match, 'played_at' | 'cancel_reason' | 'cancel_note'>,
  now: Date,
): string {
  const day = parseDay(night.played_at)
  const when = day.toDateString() === now.toDateString() ? 'Tonight' : longDay(day)
  const reason = night.cancel_reason === 'other' ? night.cancel_note : night.cancel_reason && REASON_TEXT[night.cancel_reason]
  return `${when} is cancelled${reason ? ` (${reason})` : ''}.`
}

/** Opens the phone's share sheet (WhatsApp etc.), or copies the text when sharing isn't available. */
export async function shareText(text: string, url: string): Promise<'shared' | 'copied' | 'cancelled'> {
  if (navigator.share) {
    try {
      await navigator.share({ text, url })
      return 'shared'
    } catch {
      return 'cancelled' // the person closed the share sheet
    }
  }
  await navigator.clipboard.writeText(`${text}\n${url}`)
  return 'copied'
}
```

- [ ] **Step 5: The API**

In `src/lib/api.ts`, add to the type import: `CancelReason, MoneyOwed, NightDetails, Payer, Rsvp, RsvpStatus, CheckIn`. Rename the section heading `// Matches` to `// Nights (rows of the matches table)`. Change `listMatches`'s select to:

```ts
      .select(
        '*, goals(scoring_team, disputed), match_ratings(player_id, rating, is_mvp), match_players!match_players_match_id_fkey(player_id), rsvps(player_id, status, status_changed_at, waiting_since, promoted_at)',
      )
```

In `getMatch`, change the `players` query to `supabase.from('match_players').select('player_id, arrived_at, left_at').eq('match_id', matchId).order('arrived_at')`, add an `rsvps` query `supabase.from('rsvps').select('player_id, status, status_changed_at, waiting_since, promoted_at').eq('match_id', matchId)` to the `Promise.all` (destructure it as `rsvps`), and build the result with:

```ts
  const checkIns = unwrap<CheckIn[]>(players)
  return {
    match: unwrap<Match>(match),
    stints: stintList,
    lineup: unwrap<StintPlayer[]>(stintPlayers).filter((sp) => sp.stint_id === current?.id),
    playerIds: checkIns.map((c) => c.player_id),
    checkIns,
    rsvps: unwrap<Rsvp[]>(rsvps),
    goals: unwrap<Goal[]>(goals),
    ratings: unwrap<MatchRating[]>(ratings),
    votes: unwrap<Vote[]>(votes),
    mvpVotes: unwrap<MvpVote[]>(mvpVotes),
  }
```

Add after `getMatch`:

```ts
/** The most recent night (any status), to pre-fill "Plan a night". */
export async function getLastNight(groupId: string): Promise<Match | null> {
  return unwrap(
    await supabase
      .from('matches')
      .select('*')
      .eq('group_id', groupId)
      .order('played_at', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  )
}

export const planNight = (groupId: string, night: NightDetails) =>
  rpc<string>('plan_night', { p_group_id: groupId, p_night: night })

export const updateNight = (matchId: string, night: NightDetails) =>
  rpc('update_night', { p_match_id: matchId, p_night: night })

/** "I'm in" or "Out". Returns your new status: in, waiting (the night is full) or out. */
export const setRsvp = (matchId: string, status: 'in' | 'out') =>
  rpc<RsvpStatus>('set_rsvp', { p_match_id: matchId, p_status: status })

export const startNight = (matchId: string) => rpc('start_night', { p_match_id: matchId })
export const checkIn = (matchId: string, playerId: string) =>
  rpc('check_in', { p_match_id: matchId, p_player_id: playerId })
export const checkOut = (matchId: string, playerId: string) =>
  rpc('check_out', { p_match_id: matchId, p_player_id: playerId })
export const undoCheckIn = (matchId: string, playerId: string) =>
  rpc('undo_check_in', { p_match_id: matchId, p_player_id: playerId })
export const endNight = (matchId: string) => rpc('end_night', { p_match_id: matchId })
export const cancelNight = (matchId: string, reason: CancelReason, note: string, fee: number) =>
  rpc('cancel_night', { p_match_id: matchId, p_reason: reason, p_note: note, p_fee: fee })

// ---------------------------------------------------------------------------
// Money (the rule lives in the database: night_payer_rows)
// ---------------------------------------------------------------------------
export const getNightMoney = (matchId: string) => rpc<Payer[]>('night_money', { p_match_id: matchId })
export const getMoneyOwed = (groupId: string) => rpc<MoneyOwed[]>('money_owed', { p_group_id: groupId })
export const markPaid = (matchId: string, playerId: string) =>
  rpc('mark_paid', { p_match_id: matchId, p_player_id: playerId })
export const unmarkPaid = (matchId: string, playerId: string) =>
  rpc('unmark_paid', { p_match_id: matchId, p_player_id: playerId })
```

(`createMatch`, `updateMatchDetails` and `finishMatch` stay until the screens that use them are replaced in Tasks 12-13.)

- [ ] **Step 6: Check**

Run: `npx vitest run src/lib` → Expected: PASS.
Run: `npx tsc -b && npm run lint && npm test` → Expected: all pass.

---

### Task 11: Night components (replies, check-in, money, cancel, share)

**Files:**
- Modify: `src/components/ui.tsx` (add `ShareButton`)
- Create: `src/components/rsvp.tsx`, `src/components/checkin.tsx`, `src/components/money.tsx`, `src/components/cancel.tsx`

**Interfaces:**
- Consumes: API and helpers from Task 10; `useCurrentGroup()` (`myPlayerId`, `members`, `players`, `isAdmin`, `playerName`, `player`).
- Produces: `ShareButton({ text, className? })`; `RsvpCard({ match, rsvps, onChange, linkToNight? })`; `RsvpLists({ rsvps })`; `CheckInList({ detail, onChange })`; `WhoIsHere({ detail })`; `MoneyCard({ match, payers, onChange })` (renders nothing when `payers` is empty); `CancelNightForm({ match, onDone, onClose })`; `CancelledNotice({ match })`.

These are screen pieces: they are checked by `tsc`, lint and the screen checks in Task 16. The rules behind them are already tested (Part A and Task 10).

- [ ] **Step 1: `ShareButton` in `src/components/ui.tsx`**

Change the React import to `import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react'`, add `import { shareText } from '../lib/share'`, and append:

```tsx
/** Opens the share sheet (WhatsApp etc.) with a ready message, or copies it. */
export function ShareButton({ text, className = '' }: { text: string; className?: string }) {
  const [note, setNote] = useState<string | null>(null)

  async function share() {
    try {
      const result = await shareText(text, window.location.origin)
      setNote(result === 'copied' ? 'Copied. Paste it in WhatsApp.' : null)
    } catch {
      setNote('Could not share. Try again.')
    }
  }

  return (
    <div className={className}>
      <Button variant="secondary" className="w-full" onClick={() => void share()}>
        Share to WhatsApp
      </Button>
      {note && (
        <p role="status" className="mt-1 text-center text-sm text-muted">
          {note}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: `src/components/rsvp.tsx`**

```tsx
// "I'm in" / "Out" for a planned night, and who answered what.
import { useState } from 'react'
import { Link } from 'react-router'
import * as api from '../lib/api'
import { errorMessage, formatNightWhen, nightFacts } from '../lib/format'
import { rsvpSummary } from '../lib/night'
import type { Match, Rsvp } from '../lib/types'
import { useCurrentGroup } from '../state/group'
import { Button, Card, ErrorNote, Heading, Name, StatusChip } from './ui'

/** The planned night with the I'm in / Out buttons (Home and the night page). */
export function RsvpCard({
  match,
  rsvps,
  onChange,
  linkToNight = false,
}: {
  match: Match
  rsvps: Rsvp[]
  onChange: () => void
  linkToNight?: boolean
}) {
  const { myPlayerId, members } = useCurrentGroup()
  const [busy, setBusy] = useState<'in' | 'out' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const summary = rsvpSummary(rsvps, members.map((m) => m.player_id))
  const mine = rsvps.find((r) => r.player_id === myPlayerId)
  const coming = mine?.status === 'in' || mine?.status === 'waiting'

  async function answer(status: 'in' | 'out') {
    setBusy(status)
    setError(null)
    try {
      await api.setRsvp(match.id, status)
      onChange()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const title = (
    <h2 className="mt-1.5 font-display text-[22px] leading-tight" dir="auto">
      {match.location || 'Pitch to be confirmed'}
    </h2>
  )
  const others = [
    summary.waiting.length > 0 && `${summary.waiting.length} waiting`,
    `${summary.out.length} out`,
    `${summary.noReply.length} no reply`,
  ].filter(Boolean)

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <span className="label">{formatNightWhen(match)}</span>
        <StatusChip status="draft" />
      </div>
      {linkToNight ? <Link to={`/nights/${match.id}`}>{title}</Link> : title}
      <p className="text-[13px] text-muted">{nightFacts(match)}</p>
      <p className="mt-2 text-[13px]">
        <b>
          {summary.in.length}
          {match.player_cap ? ` of ${match.player_cap}` : ''} in
        </b>
        {others.map((text) => ` · ${text}`)}
      </p>
      <p role="status" className="mt-1 mb-3 text-sm font-semibold">
        {myAnswer(mine, summary.waiting.indexOf(myPlayerId) + 1)}
      </p>
      <div className="flex gap-2">
        <Button
          className="flex-1"
          variant={mine?.status === 'out' ? 'secondary' : 'primary'}
          aria-pressed={coming}
          busy={busy === 'in'}
          onClick={() => void answer('in')}
        >
          I'm in
        </Button>
        <Button
          className="flex-1"
          variant={mine?.status === 'out' ? 'dark' : 'secondary'}
          aria-pressed={mine?.status === 'out'}
          busy={busy === 'out'}
          onClick={() => void answer('out')}
        >
          Out
        </Button>
      </div>
      <ErrorNote message={error} />
    </Card>
  )
}

function myAnswer(mine: Rsvp | undefined, place: number): string {
  if (!mine) return 'Are you coming?'
  if (mine.status === 'out') return "You're out. Changed your mind? Tap I'm in."
  if (mine.status === 'waiting') return `The night is full: you're #${place} on the waiting list.`
  return mine.promoted_at ? "You're in! You moved up from the waiting list." : "You're in."
}

/** Who's in, who's waiting (in order), who's out and who hasn't answered. */
export function RsvpLists({ rsvps }: { rsvps: Rsvp[] }) {
  const { members, playerName } = useCurrentGroup()
  const s = rsvpSummary(rsvps, members.map((m) => m.player_id))
  const byName = (ids: string[]) => [...ids].sort((a, b) => playerName(a).localeCompare(playerName(b)))
  const lists: { label: string; ids: string[]; numbered?: boolean }[] = [
    { label: 'In', ids: byName(s.in) },
    { label: 'Waiting list', ids: s.waiting, numbered: true },
    { label: 'Out', ids: byName(s.out) },
    { label: 'No reply', ids: byName(s.noReply) },
  ]
  return (
    <Card>
      <div className="space-y-3">
        {lists
          .filter((list) => list.ids.length > 0)
          .map((list) => (
            <div key={list.label}>
              <Heading className="mb-1">
                {list.label} ({list.ids.length})
              </Heading>
              <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
                {list.ids.map((id, i) => (
                  <li key={id}>
                    {list.numbered && <span className="text-muted">{i + 1}. </span>}
                    <Name className="font-semibold">{playerName(id)}</Name>
                  </li>
                ))}
              </ul>
            </div>
          ))}
      </div>
    </Card>
  )
}
```

- [ ] **Step 3: `src/components/checkin.tsx`**

```tsx
// Check-in at the pitch. Who is checked in is who plays, votes and pays.
import { useState } from 'react'
import * as api from '../lib/api'
import { clockOf, errorMessage } from '../lib/format'
import type { MatchDetail, RsvpStatus } from '../lib/types'
import { useCurrentGroup } from '../state/group'
import { Avatar, Button, Card, ErrorNote, Heading, Name } from './ui'

const REPLY_NOTE: Record<RsvpStatus, string> = { in: "Said I'm in", waiting: 'On the waiting list', out: 'Said out' }

/** Admins: tap to check someone in, tap again when they leave early. Anyone in the group can be checked in. */
export function CheckInList({ detail, onChange }: { detail: MatchDetail; onChange: () => void }) {
  const { players } = useCurrentGroup()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const matchId = detail.match.id
  const here = new Map(detail.checkIns.map((c) => [c.player_id, c]))
  const said = new Map(detail.rsvps.map((r) => [r.player_id, r.status]))
  // Checked in first, then "I'm in", then the waiting list, then everyone else.
  const rank = (id: string) => (here.has(id) ? 0 : said.get(id) === 'in' ? 1 : said.get(id) === 'waiting' ? 2 : 3)
  const sorted = [...players].sort((a, b) => rank(a.id) - rank(b.id) || a.display_name.localeCompare(b.display_name))

  async function run(playerId: string, action: () => Promise<unknown>) {
    setBusy(playerId)
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

  return (
    <Card>
      <Heading className="mb-1">Check-in · {here.size} here</Heading>
      <ErrorNote message={error} />
      <ul className="divide-y divide-line">
        {sorted.map((p) => {
          const c = here.get(p.id)
          const reply = said.get(p.id)
          const note = c
            ? c.left_at
              ? `${clockOf(c.arrived_at)} – ${clockOf(c.left_at)} · left early`
              : `Here since ${clockOf(c.arrived_at)}`
            : reply
              ? REPLY_NOTE[reply]
              : ''
          return (
            <li key={p.id} className="flex min-h-14 items-center gap-2 py-1.5">
              <Avatar name={p.display_name} url={p.avatar_url} size={32} />
              <div className="min-w-0 flex-1">
                <Name className="block truncate font-semibold">{p.display_name}</Name>
                {note && <span className="block text-xs text-muted">{note}</span>}
              </div>
              {c && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy === p.id}
                  onClick={() => {
                    if (window.confirm(`Undo ${p.display_name}'s check-in? Only for a mistake.`))
                      void run(p.id, () => api.undoCheckIn(matchId, p.id))
                  }}
                >
                  Undo
                </Button>
              )}
              {!c ? (
                <Button size="sm" busy={busy === p.id} onClick={() => void run(p.id, () => api.checkIn(matchId, p.id))}>
                  Check in
                </Button>
              ) : c.left_at ? (
                <Button size="sm" variant="secondary" busy={busy === p.id} onClick={() => void run(p.id, () => api.checkIn(matchId, p.id))}>
                  Back
                </Button>
              ) : (
                <Button size="sm" variant="secondary" busy={busy === p.id} onClick={() => void run(p.id, () => api.checkOut(matchId, p.id))}>
                  Left
                </Button>
              )}
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

/** Everyone else: who's here tonight, in order of arrival. */
export function WhoIsHere({ detail }: { detail: MatchDetail }) {
  const { playerName } = useCurrentGroup()
  const list = [...detail.checkIns].sort((a, b) => a.arrived_at.localeCompare(b.arrived_at))
  return (
    <Card>
      <Heading className="mb-1">Here tonight ({list.length})</Heading>
      {list.length === 0 ? (
        <p className="text-sm text-muted">Nobody is checked in yet.</p>
      ) : (
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
          {list.map((c) => (
            <li key={c.player_id} className={c.left_at ? 'text-muted' : ''}>
              <Name className="font-semibold">{playerName(c.player_id)}</Name>{' '}
              <span className="text-muted">
                {clockOf(c.arrived_at)}
                {c.left_at && ' (left)'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
```

- [ ] **Step 4: `src/components/money.tsx`**

```tsx
// The money card: everyone pays the night's collector an equal share,
// rounded up to a whole pound. The share is worked out in the database
// (night_money); this card only shows it and lets the collector tick people off.
import { useState } from 'react'
import { Link } from 'react-router'
import * as api from '../lib/api'
import { errorMessage } from '../lib/format'
import { isPaid, moneyTotals } from '../lib/money'
import type { Match, Payer } from '../lib/types'
import { useCurrentGroup } from '../state/group'
import { Button, Card, ErrorNote, Heading, Name } from './ui'

export function MoneyCard({ match, payers, onChange }: { match: Match; payers: Payer[]; onChange: () => void }) {
  const { myPlayerId, isAdmin, playerName } = useCurrentGroup()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  if (payers.length === 0) return null

  const amount = Number(match.status === 'cancelled' ? match.cancel_fee : match.cost)
  const t = moneyTotals(payers, amount)
  const cur = match.currency
  const mine = payers.find((p) => p.player_id === myPlayerId)
  const iCollect = match.collector_player_id === myPlayerId
  const canTick = isAdmin || iCollect
  const collector = match.collector_player_id ? playerName(match.collector_player_id) : null
  const sorted = [...payers].sort(
    (a, b) => Number(isPaid(a)) - Number(isPaid(b)) || playerName(a.player_id).localeCompare(playerName(b.player_id)),
  )

  async function tick(p: Payer) {
    setBusy(p.player_id)
    setError(null)
    try {
      await (p.paid_at ? api.unmarkPaid(match.id, p.player_id) : api.markPaid(match.id, p.player_id))
      onChange()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card strong>
      {iCollect ? (
        <>
          <Heading>Collected</Heading>
          <p className="money">
            {t.collected} of {t.total} {cur}
          </p>
          {t.extra > 0 && (
            <p className="text-sm">
              You get {t.extra} {cur} more than the pitch costs.
            </p>
          )}
        </>
      ) : mine && !isPaid(mine) ? (
        <>
          <Heading>You owe</Heading>
          <p className="money">
            {t.share} {cur}
          </p>
          <p className="text-sm">
            to <Name className="font-bold">{collector ?? 'the collector'}</Name> · {amount} ÷ {t.players} players
          </p>
        </>
      ) : mine ? (
        <>
          <Heading>You paid</Heading>
          <p className="money">
            {t.share} {cur}
          </p>
          {collector && (
            <p className="text-sm">
              to <Name className="font-bold">{collector}</Name>
            </p>
          )}
        </>
      ) : (
        <>
          <Heading>
            Money{collector && <> · collector <Name>{collector}</Name></>}
          </Heading>
          <p className="money">
            {t.collected} / {t.total} {cur}
          </p>
        </>
      )}

      <p className="mt-2 text-sm text-muted">
        {t.players} players pay {t.share} {cur} each ({amount} ÷ {t.players}, rounded up).
        {t.extra > 0 && ` The collector gets ${t.extra} ${cur} extra.`}
      </p>
      {!collector && (
        <p className="mt-2 text-sm font-semibold">
          No collector picked yet.{' '}
          {isAdmin && (
            <Link to={`/nights/${match.id}/edit`} className="text-brand-ink underline">
              Pick one
            </Link>
          )}
        </p>
      )}
      <ErrorNote message={error} />

      <ul className="mt-3 divide-y divide-line">
        {sorted.map((p) => (
          <li key={p.player_id} className="flex min-h-12 items-center gap-2 py-1">
            <Name className="min-w-0 flex-1 truncate font-semibold">{playerName(p.player_id)}</Name>
            {p.is_collector ? (
              <span className="text-xs font-semibold text-muted">Collector</span>
            ) : isPaid(p) ? (
              <span className="chip status closed">Paid</span>
            ) : (
              <span className="chip status voting">Unpaid</span>
            )}
            {canTick && !p.is_collector && p.player_id !== myPlayerId && (
              <Button
                size="sm"
                variant={p.paid_at ? 'ghost' : 'secondary'}
                busy={busy === p.player_id}
                onClick={() => void tick(p)}
              >
                {p.paid_at ? 'Undo' : 'Paid'}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </Card>
  )
}
```

- [ ] **Step 5: `src/components/cancel.tsx`**

```tsx
// Cancelling a night: nothing counts. Only a fee the pitch still charges is split.
import { useState } from 'react'
import * as api from '../lib/api'
import { CANCEL_REASONS, errorMessage } from '../lib/format'
import { cancelledNightText } from '../lib/share'
import type { CancelReason, Match } from '../lib/types'
import { Button, Card, ErrorNote, Heading, ShareButton } from './ui'

const input = 'mt-1 h-12 w-full rounded-xl border-[1.5px] border-line bg-paper px-3 text-base'

export function CancelNightForm({ match, onDone, onClose }: { match: Match; onDone: () => void; onClose: () => void }) {
  const [reason, setReason] = useState<CancelReason | null>(null)
  const [note, setNote] = useState('')
  const [fee, setFee] = useState('0')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function cancel() {
    if (!reason) return
    setBusy(true)
    setError(null)
    try {
      await api.cancelNight(match.id, reason, note, Number(fee) || 0)
      onDone()
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
    }
  }

  return (
    <Card strong>
      <Heading className="mb-2">Cancel this night</Heading>
      <p className="text-sm">
        Nothing counts for a cancelled night: no votes and no ratings. If games were played and you just stopped early,
        use End night instead.
      </p>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Reason">
        {(Object.keys(CANCEL_REASONS) as CancelReason[]).map((r) => (
          <Button key={r} size="sm" variant={reason === r ? 'primary' : 'secondary'} aria-pressed={reason === r} onClick={() => setReason(r)}>
            {CANCEL_REASONS[r]}
          </Button>
        ))}
      </div>
      <label className="mt-3 block">
        <span className="text-sm font-medium">Note{reason === 'other' ? '' : ' (optional)'}</span>
        <input className={input} value={note} maxLength={200} dir="auto" onChange={(e) => setNote(e.target.value)} />
      </label>
      <label className="mt-3 block">
        <span className="text-sm font-medium">Still charged by the pitch ({match.currency})</span>
        <input className={input} type="number" inputMode="numeric" min={0} value={fee} onChange={(e) => setFee(e.target.value)} />
        <span className="mt-1 block text-xs text-muted">Usually 0. A lost deposit or fee is split equally, like the rent.</span>
      </label>
      <ErrorNote message={error} />
      <div className="mt-3 flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={onClose}>
          Keep night
        </Button>
        <Button variant="danger" className="flex-1" busy={busy} disabled={!reason} onClick={() => void cancel()}>
          Cancel night
        </Button>
      </div>
    </Card>
  )
}

/** Shown on a cancelled night, with the message to share. */
export function CancelledNotice({ match }: { match: Match }) {
  return (
    <Card>
      <Heading>Cancelled{match.cancel_reason && ` · ${CANCEL_REASONS[match.cancel_reason]}`}</Heading>
      {match.cancel_note && (
        <p dir="auto" className="mt-1 font-semibold">
          {match.cancel_note}
        </p>
      )}
      <p className="mt-1 text-sm text-muted">Nothing counts for this night: no votes and no ratings.</p>
      <ShareButton className="mt-3" text={cancelledNightText(match, new Date())} />
    </Card>
  )
}
```

- [ ] **Step 6: Check**

Run: `npx tsc -b && npm run lint` → Expected: both pass.

---

### Task 12: Plan a night and Teams screens

**Files:**
- Create: `src/pages/PlanNight.tsx`
- Rename + rewrite: `git mv src/pages/MatchEdit.tsx src/pages/Teams.tsx`
- Modify: `src/App.tsx` (routes), `src/lib/api.ts` (remove `createMatch`, `updateMatchDetails`)

**Interfaces:**
- Consumes: `getMatch`, `getLastNight`, `planNight`, `updateNight`, `deleteMatch`, `saveLineup`; `nightDefaults`, `formFromNight`, `formToDetails`, `withSide`, `capFor`, `formatLength`.
- Produces: routes `/nights/new`, `/nights/:id/edit` (PlanNight), `/nights/:id/teams` (Teams).

- [ ] **Step 1: `src/pages/PlanNight.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Button, ErrorNote, Loading, PageTitle } from '../components/ui'
import * as api from '../lib/api'
import { errorMessage, formatLength } from '../lib/format'
import { capFor, formFromNight, formToDetails, nightDefaults, withSide } from '../lib/night'
import type { NightForm } from '../lib/types'
import { useCurrentGroup } from '../state/group'

const input = 'mt-1 h-12 w-full rounded-xl border-[1.5px] border-line bg-paper px-3 text-base'
const LENGTHS = [60, 90, 120, 150, 180]
const SIDES = [5, 6, 7]

/** Plan a night (/nights/new), pre-filled from the last one, or edit one (/nights/:id/edit). Admins only. */
export default function PlanNight() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { group, players, isAdmin, myPlayerId } = useCurrentGroup()
  const [form, setForm] = useState<NightForm | null>(null)
  const [busy, setBusy] = useState<'save' | 'delete' | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = id
      ? api.getMatch(id).then((d) => formFromNight(d.match))
      : api.getLastNight(group.id).then((last) => nightDefaults(last, myPlayerId, new Date()))
    load.then(setForm).catch((e: unknown) => setError(errorMessage(e)))
  }, [id, group.id, myPlayerId])

  if (!isAdmin) return <ErrorNote message="Only group admins can plan nights." />
  if (!form) return error ? <ErrorNote message={error} /> : <Loading />

  const set = (patch: Partial<NightForm>) => setForm({ ...form, ...patch })
  const lengths = [...new Set([...LENGTHS, form.duration_minutes])].sort((a, b) => a - b)
  const sides = [...new Set([...SIDES, form.players_per_side])].sort((a, b) => a - b)

  async function save() {
    if (!form) return
    setBusy('save')
    setError(null)
    try {
      const details = formToDetails(form)
      if (id) {
        await api.updateNight(id, details)
        navigate(`/nights/${id}`)
      } else {
        navigate(`/nights/${await api.planNight(group.id, details)}`)
      }
    } catch (e) {
      setError(errorMessage(e))
      setBusy(null)
    }
  }

  async function remove() {
    if (!id || !window.confirm('Delete this night with its replies, goals, votes and ratings? This cannot be undone.')) return
    setBusy('delete')
    try {
      await api.deleteMatch(id)
      navigate('/nights')
    } catch (e) {
      setError(errorMessage(e))
      setBusy(null)
    }
  }

  return (
    <div>
      <PageTitle sub={id ? undefined : 'Filled in from your last night. Check it and tap Plan night.'}>
        {id ? 'Edit night' : 'Plan a night'}
      </PageTitle>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm font-medium">Date</span>
            <input type="date" required value={form.day} onChange={(e) => set({ day: e.target.value })} className={input} />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Start</span>
            <input type="time" required value={form.time} onChange={(e) => set({ time: e.target.value })} className={input} />
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-medium">Pitch</span>
          <input
            value={form.location}
            maxLength={80}
            dir="auto"
            placeholder="Club pitch 3"
            onChange={(e) => set({ location: e.target.value })}
            className={input}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm font-medium">Length</span>
            <select value={form.duration_minutes} onChange={(e) => set({ duration_minutes: Number(e.target.value) })} className={input}>
              {lengths.map((m) => (
                <option key={m} value={m}>
                  {formatLength(m)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium">Total cost (EGP)</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={form.cost}
              onChange={(e) => set({ cost: Number(e.target.value) })}
              className={input}
            />
          </label>
        </div>

        <div>
          <p className="text-sm font-medium">Players per side</p>
          <div className="seg mt-1" role="group" aria-label="Players per side">
            {sides.map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={form.players_per_side === n}
                className={form.players_per_side === n ? 'sel' : ''}
                onClick={() => setForm(withSide(form, n))}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="text-sm font-medium">Collector</span>
          <select
            value={form.collector_player_id ?? ''}
            onChange={(e) => set({ collector_player_id: e.target.value || null })}
            className={input}
          >
            <option value="">Not picked yet</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-muted">Everyone pays their share to this person, who pays the pitch.</span>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm font-medium">Game length (min)</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={120}
              value={form.game_minutes}
              onChange={(e) => set({ game_minutes: Number(e.target.value) })}
              className={input}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Player limit</span>
            <input
              type="number"
              inputMode="numeric"
              min={2}
              max={100}
              disabled={form.player_cap === null}
              placeholder="No limit"
              value={form.player_cap ?? ''}
              onChange={(e) => set({ player_cap: Number(e.target.value) })}
              className={`${input} disabled:opacity-50`}
            />
          </label>
        </div>
        <label className="flex min-h-12 items-center gap-3">
          <input
            type="checkbox"
            className="size-5 accent-[var(--brand)]"
            checked={form.player_cap === null}
            onChange={(e) => set({ player_cap: e.target.checked ? null : capFor(form.players_per_side) })}
          />
          <span>No player limit (no waiting list)</span>
        </label>
      </div>

      <ErrorNote message={error} />

      <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-10 mt-4">
        <Button size="lg" className="w-full" busy={busy === 'save'} onClick={() => void save()}>
          {id ? 'Save changes' : 'Plan night'}
        </Button>
      </div>

      {id && (
        <Button variant="danger" className="mt-6 w-full" busy={busy === 'delete'} onClick={() => void remove()}>
          Delete night
        </Button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: `src/pages/Teams.tsx` (renamed from MatchEdit)**

```bash
git mv src/pages/MatchEdit.tsx src/pages/Teams.tsx
```

Replace its content with:

```tsx
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { BackIcon, GloveIcon } from '../components/icons'
import { Avatar, Button, ErrorNote, Loading, Name, Notice, PageTitle, TeamTag } from '../components/ui'
import * as api from '../lib/api'
import { errorMessage } from '../lib/format'
import type { CheckIn, LineupEntry, Team } from '../lib/types'
import { useCurrentGroup } from '../state/group'

type Pick = { team: Team; gk: boolean }

/** Pick Team A / Team B and the goalkeepers from the players checked in (admins). */
export default function Teams() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { player, isAdmin } = useCurrentGroup()
  const [checkIns, setCheckIns] = useState<CheckIn[] | null>(null)
  const [picks, setPicks] = useState<Map<string, Pick>>(new Map())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .getMatch(id)
      .then((d) => {
        setCheckIns(d.checkIns)
        setPicks(new Map(d.lineup.map((p) => [p.player_id, { team: p.team, gk: p.is_goalkeeper }])))
      })
      .catch((e: unknown) => setError(errorMessage(e)))
  }, [id])

  if (!isAdmin) return <ErrorNote message="Only group admins can pick teams." />
  if (!checkIns) return error ? <ErrorNote message={error} /> : <Loading />

  const name = (playerId: string) => player(playerId)?.display_name ?? 'Unknown player'
  const here = [...checkIns].sort((a, b) => name(a.player_id).localeCompare(name(b.player_id)))
  const count = (team: Team) => [...picks.values()].filter((p) => p.team === team).length

  function setTeam(playerId: string, team: Team | null) {
    setPicks((prev) => {
      const next = new Map(prev)
      if (team === null) next.delete(playerId)
      else next.set(playerId, { team, gk: prev.get(playerId)?.team === team ? prev.get(playerId)!.gk : false })
      return next
    })
  }

  // One goalkeeper per team: picking a new one replaces the old one.
  function toggleGk(playerId: string) {
    setPicks((prev) => {
      const next = new Map(prev)
      const me = prev.get(playerId)
      if (!me) return prev
      for (const [pid, p] of next) if (p.team === me.team && p.gk) next.set(pid, { ...p, gk: false })
      next.set(playerId, { ...me, gk: !me.gk })
      return next
    })
  }

  async function save() {
    setBusy(true)
    setError(null)
    const lineup: LineupEntry[] = [...picks.entries()].map(([player_id, p]) => ({
      player_id,
      team: p.team,
      is_goalkeeper: p.gk,
    }))
    try {
      await api.saveLineup(id, lineup)
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
      <PageTitle sub="Everyone checked in is listed. Players on neither team are on the bench.">Teams</PageTitle>

      {here.length < 2 ? (
        <Notice>Check at least 2 players in first, on the night page.</Notice>
      ) : (
        <>
          <div className="sticky top-[calc(env(safe-area-inset-top)+4rem)] z-10 -mx-4 mb-2 flex items-center justify-between gap-2 bg-ground/95 px-4 py-2 backdrop-blur">
            <span className="flex items-center gap-2 font-display text-lg">
              <TeamTag team="A" /> {count('A')}
              <TeamTag team="B" /> {count('B')}
            </span>
            <span className="flex items-center gap-1 text-xs text-muted">
              <GloveIcon size={16} /> = in goal
            </span>
          </div>

          <ul className="divide-y divide-line rounded-card border-[1.5px] border-line bg-paper">
            {here.map(({ player_id, left_at }) => {
              const pick = picks.get(player_id)
              const label = name(player_id)
              return (
                <li key={player_id} className="flex items-center gap-2 px-3 py-2">
                  <Avatar name={label} url={player(player_id)?.avatar_url} size={32} />
                  <div className="min-w-0 flex-1">
                    <Name className="block truncate font-medium">{label}</Name>
                    {left_at && <span className="block text-xs text-muted">Left early</span>}
                  </div>
                  <div className="seg" role="group" aria-label={`Team for ${label}`}>
                    <button type="button" aria-pressed={!pick} className={!pick ? 'sel-out' : ''} onClick={() => setTeam(player_id, null)}>
                      Out
                    </button>
                    <button type="button" aria-pressed={pick?.team === 'A'} className={pick?.team === 'A' ? 'sel-a' : ''} onClick={() => setTeam(player_id, 'A')}>
                      A
                    </button>
                    <button type="button" aria-pressed={pick?.team === 'B'} className={pick?.team === 'B' ? 'sel-b' : ''} onClick={() => setTeam(player_id, 'B')}>
                      B
                    </button>
                  </div>
                  <button
                    type="button"
                    disabled={!pick}
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

- [ ] **Step 3: Routes and API clean-up**

In `src/App.tsx`: replace the `MatchEdit` import with `import PlanNight from './pages/PlanNight'` and `import Teams from './pages/Teams'`; replace the routes `matches/new` and `matches/:id/edit` with:

```tsx
        <Route path="nights/new" element={<PlanNight />} />
        <Route path="nights/:id/edit" element={<PlanNight />} />
        <Route path="nights/:id/teams" element={<Teams />} />
```

In `src/lib/api.ts`, delete `createMatch` and `updateMatchDetails` (and `LineupEntry` stays imported for `saveLineup`).

- [ ] **Step 4: Check**

Run: `npx tsc -b && npm run lint && npm test` → Expected: all pass.

---

### Task 13: The night page

**Files:**
- Create: `src/components/results.tsx` (`VotingCard` new; `VoteProgress`, `Results`, `Breakdown` moved from MatchPage)
- Rename + rewrite: `git mv src/pages/MatchPage.tsx src/pages/NightPage.tsx`
- Modify: `src/App.tsx` (route), `src/lib/api.ts` (remove `finishMatch`)

**Interfaces:**
- Consumes: everything from Tasks 10-12.
- Produces: route `/nights/:id`; `VotingCard({ match, voteStatus, iPlayed, onChange })`, `Results({ detail })`.

- [ ] **Step 1: `src/components/results.tsx`**

```tsx
// After the night: voting, then the final ratings with their breakdown.
import { useState } from 'react'
import { Link } from 'react-router'
import * as api from '../lib/api'
import { errorMessage, formatPoints, isPast, timeLeft } from '../lib/format'
import type { Match, MatchDetail, MatchRating } from '../lib/types'
import { useCurrentGroup } from '../state/group'
import { ChevronIcon, StarIcon } from './icons'
import { Button, Card, ErrorNote, Heading, LinkButton, Name, RatingBadge } from './ui'

type VoteStatus = { player_id: string; has_voted: boolean }

/** Voting is open: time left, who has voted, the vote button and the admin controls. */
export function VotingCard({
  match,
  voteStatus,
  iPlayed,
  onChange,
}: {
  match: Match
  voteStatus: VoteStatus[]
  iPlayed: boolean
  onChange: () => void
}) {
  const { myPlayerId, isAdmin } = useCurrentGroup()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const iVoted = voteStatus.some((v) => v.player_id === myPlayerId && v.has_voted)

  async function act(name: string, action: () => Promise<unknown>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return
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

  return (
    <Card strong={iPlayed && !iVoted}>
      <Heading>Voting</Heading>
      <p className="mt-1 font-display text-2xl">
        {isPast(match.voting_closes_at) ? 'Closing now…' : `Closes in ${timeLeft(match.voting_closes_at)}`}
      </p>
      <VoteProgress voteStatus={voteStatus} />
      <ErrorNote message={error} />
      {iPlayed && (
        <LinkButton to={`/nights/${match.id}/vote`} variant={iVoted ? 'secondary' : 'primary'} className="mt-3 w-full">
          {iVoted ? 'Change my votes' : 'Rate the players'}
        </LinkButton>
      )}
      {isAdmin && (
        <div className="mt-2 flex gap-2">
          <Button variant="secondary" className="flex-1" busy={busy === 'extend'} onClick={() => void act('extend', () => api.extendVoting(match.id, 12))}>
            +12 hours
          </Button>
          <Button
            variant="secondary"
            className="flex-1"
            busy={busy === 'close'}
            onClick={() =>
              void act('close', () => api.closeVoting(match.id), 'Close voting now? Ratings become final and votes are revealed.')
            }
          >
            Close now
          </Button>
        </div>
      )}
      {(iPlayed || isAdmin) && (
        <Link to={`/nights/${match.id}/record`} className="mt-3 block text-center text-sm font-semibold text-brand-ink underline">
          Forgot a goal? Log it
        </Link>
      )}
    </Card>
  )
}
```

Then move `VoteProgress`, `Results` and `Breakdown` from `MatchPage.tsx` into this file unchanged except:

- `export` `Results` (the other two stay private);
- in `VoteProgress`, the bar fill `bg-pitch` → `bg-brand`;
- in `Results`, the Man of the Match card `<Card className="border-gold/60">…</Card>` → `<section className="rounded-card border-2 border-gold bg-paper p-4">…</section>`, and its name line `font-display text-2xl font-bold` → `font-display text-2xl`;
- the ratings card `<Card className="p-0">` stays; the highlighted row `bg-team-a-soft/60` → `bg-brand/15`; the rank `font-display text-lg font-bold text-muted` → `font-display text-lg text-muted`;
- in `Breakdown`, `bg-card` → `bg-paper` (two places).

- [ ] **Step 2: `src/pages/NightPage.tsx`**

```bash
git mv src/pages/MatchPage.tsx src/pages/NightPage.tsx
```

Replace its content with:

```tsx
import { useState } from 'react'
import { useParams } from 'react-router'
import { CancelledNotice, CancelNightForm } from '../components/cancel'
import { CheckInList, WhoIsHere } from '../components/checkin'
import { BallIcon } from '../components/icons'
import { GoalList, Lineups, Scoreboard } from '../components/match'
import { MoneyCard } from '../components/money'
import { Results, VotingCard } from '../components/results'
import { RsvpCard, RsvpLists } from '../components/rsvp'
import { Button, Card, ErrorNote, Heading, LinkButton, Loading, ShareButton, StatusChip } from '../components/ui'
import * as api from '../lib/api'
import { errorMessage, formatNightWhen, nightFacts, scoreOf } from '../lib/format'
import { plannedNightText } from '../lib/share'
import type { Payer } from '../lib/types'
import { useLoad } from '../lib/useLoad'
import { useCurrentGroup } from '../state/group'

/** One page for a night in every state: planned, live, voting, final or cancelled. */
export default function NightPage() {
  const { id = '' } = useParams()
  const { myPlayerId, isAdmin, refresh } = useCurrentGroup()
  const [pollMs, setPollMs] = useState<number | undefined>(20_000)
  const [cancelling, setCancelling] = useState(false)
  const [fixingCheckIns, setFixingCheckIns] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const { data, error, loading, reload } = useLoad(
    async () => {
      const detail = await api.getMatch(id)
      const s = detail.match.status
      const [voteStatus, payers] = await Promise.all([
        s === 'voting' ? api.getVoteStatus(id) : Promise.resolve([]),
        s === 'voting' || s === 'closed' || s === 'cancelled' ? api.getNightMoney(id) : Promise.resolve<Payer[]>([]),
      ])
      // Keep refreshing until the night is final.
      setPollMs(s === 'closed' || s === 'cancelled' ? undefined : 20_000)
      return { detail, voteStatus, payers }
    },
    [id],
    pollMs,
  )

  if (loading && !data) return <Loading />
  if (!data) return <ErrorNote message={error} onRetry={reload} />

  const { detail, voteStatus, payers } = data
  const { match, lineup, goals, playerIds } = detail
  const status = match.status
  const inLineup = lineup.some((p) => p.player_id === myPlayerId)
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
          <RsvpCard match={match} rsvps={detail.rsvps} onChange={reload} />
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
              <div className="mt-2 flex gap-2">
                <LinkButton to={`/nights/${id}/edit`} variant="secondary" className="flex-1">
                  Edit
                </LinkButton>
                <Button variant="danger" className="flex-1" onClick={() => setCancelling(true)}>
                  Cancel night
                </Button>
              </div>
            </Card>
          )}
        </>
      )}

      {status === 'playing' && (
        <>
          <Card strong>
            <Scoreboard score={scoreOf(goals)} />
          </Card>
          {(isAdmin || inLineup) && (
            <LinkButton to={`/nights/${id}/record`} size="lg" className="w-full">
              <BallIcon size={26} /> Goal
            </LinkButton>
          )}
          {isAdmin && (
            <div className="flex gap-2">
              <LinkButton to={`/nights/${id}/teams`} variant="secondary" className="flex-1">
                Teams
              </LinkButton>
              <Button
                variant="dark"
                className="flex-1"
                busy={busy === 'end'}
                onClick={() =>
                  void act('end', () => api.endNight(id), 'End the night? Voting opens for everyone checked in, and the money card appears.')
                }
              >
                End night
              </Button>
            </div>
          )}
          {isAdmin ? <CheckInList detail={detail} onChange={changed} /> : <WhoIsHere detail={detail} />}
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
          {status !== 'playing' && (
            <Card>
              <Heading className="mb-2">Score</Heading>
              <Scoreboard score={scoreOf(goals)} />
            </Card>
          )}
          <Card>
            <Heading className="mb-2">Teams</Heading>
            {lineup.length > 0 ? <Lineups lineup={lineup} /> : <p className="text-sm text-muted">No teams picked yet.</p>}
          </Card>
          <Card>
            <Heading className="mb-1">Goals</Heading>
            <GoalList detail={detail} onChange={reload} />
          </Card>
        </>
      )}

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

- [ ] **Step 3: Route and API clean-up**

In `src/App.tsx`: replace `import MatchPage from './pages/MatchPage'` with `import NightPage from './pages/NightPage'` and the route `matches/:id` with `<Route path="nights/:id" element={<NightPage />} />`. In `src/lib/api.ts` delete `finishMatch`.

- [ ] **Step 4: Check**

Run: `npx tsc -b && npm run lint && npm test` → Expected: all pass.

---

### Task 14: Home, the Nights list, routes and wording everywhere

**Files:**
- Modify (rewrite): `src/pages/Home.tsx`, `src/pages/HowItWorks.tsx`
- Rename + rewrite: `git mv src/pages/Matches.tsx src/pages/Nights.tsx`
- Modify: `src/App.tsx` (last routes), `src/pages/Recorder.tsx`, `src/pages/Vote.tsx`, `src/pages/Leaderboard.tsx`, `src/pages/PlayerProfile.tsx`, `src/pages/Settings.tsx`

**Interfaces:**
- Consumes: `listMatches` (with `rsvps`), `getMoneyOwed`, `getLeaderboard`, `getVotedMatchIds`; `RsvpCard`.
- Produces: routes `/nights`, `/nights/:id/record`, `/nights/:id/vote`. No `/matches` paths remain.

- [ ] **Step 1: Rewrite `src/pages/Home.tsx`**

```tsx
import { useState } from 'react'
import { Link } from 'react-router'
import { PlusIcon, StarIcon } from '../components/icons'
import { Scoreboard } from '../components/match'
import { RsvpCard } from '../components/rsvp'
import { Card, Empty, ErrorNote, Heading, LinkButton, Loading, Name, RatingBadge, StatusChip } from '../components/ui'
import * as api from '../lib/api'
import { formatDay, scoreOf, timeLeft } from '../lib/format'
import type { MatchSummary, MoneyOwed } from '../lib/types'
import { useLoad } from '../lib/useLoad'
import { useCurrentGroup } from '../state/group'

export default function Home() {
  const { group, myPlayerId, isAdmin, playerName, config } = useCurrentGroup()
  const [year] = useState(() => new Date().getFullYear())

  const { data, error, loading, reload } = useLoad(async () => {
    const [nights, board, owed] = await Promise.all([
      api.listMatches(group.id),
      api.getLeaderboard(group.id, year),
      api.getMoneyOwed(group.id),
    ])
    const votingIds = nights.filter((m) => m.status === 'voting').map((m) => m.id)
    const voted = await api.getVotedMatchIds(myPlayerId, votingIds)
    return { nights, board, owed, voted }
  }, [group.id, myPlayerId, year])

  if (loading && !data) return <Loading />
  if (!data) return <ErrorNote message={error} onRetry={reload} />

  const { nights, board, owed, voted } = data
  const live = nights.filter((m) => m.status === 'playing')
  // The list is newest first, so the soonest planned night is the last one.
  const next = nights.filter((m) => m.status === 'draft').at(-1)
  const voting = nights.filter((m) => m.status === 'voting')
  const last = nights.find((m) => m.status === 'closed')
  const top3 = board.filter((r) => r.qualified).slice(0, 3)
  const minNights = config?.min_matches_for_leaderboard ?? 3
  const mine = last?.match_ratings.find((r) => r.player_id === myPlayerId)

  return (
    <div className="space-y-4">
      <ErrorNote message={error} onRetry={reload} />

      {live.map((m) => (
        <LiveNight key={m.id} night={m} />
      ))}
      {next && <RsvpCard match={next} rsvps={next.rsvps} onChange={reload} linkToNight />}
      {owed.map((o) => (
        <YouOwe key={o.match_id} owed={o} />
      ))}
      {voting.map((m) => (
        <VotingNow
          key={m.id}
          night={m}
          played={m.match_players.some((p) => p.player_id === myPlayerId)}
          voted={voted.has(m.id)}
        />
      ))}

      {isAdmin && !next && live.length === 0 && (
        <LinkButton to="/nights/new" className="w-full">
          <PlusIcon size={20} /> Plan a night
        </LinkButton>
      )}

      {last && (
        <Link to={`/nights/${last.id}`} className="block">
          <Card>
            <Heading>Last night · {formatDay(last.played_at)}</Heading>
            <div className="my-3">
              <Scoreboard score={scoreOf(last.goals)} />
            </div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-1.5">
                <StarIcon size={18} className="shrink-0 text-gold" />
                <span className="truncate">
                  Man of the Match:{' '}
                  {last.match_ratings
                    .filter((r) => r.is_mvp)
                    .map((r, i) => (
                      <span key={r.player_id}>
                        {i > 0 && ' & '}
                        <Name className="font-semibold">{playerName(r.player_id)}</Name>
                      </span>
                    ))}
                  {!last.match_ratings.some((r) => r.is_mvp) && 'no votes'}
                </span>
              </span>
              {mine && (
                <span className="flex shrink-0 items-center gap-2">
                  You <RatingBadge value={mine.rating} />
                </span>
              )}
            </div>
          </Card>
        </Link>
      )}

      <Card>
        <div className="mb-1 flex items-baseline justify-between">
          <Heading>Season {year} · top 3</Heading>
          <Link to="/table" className="text-sm font-semibold text-brand-ink">
            Full table
          </Link>
        </div>
        {top3.length === 0 ? (
          <p className="text-sm text-muted">The table starts once players have {minNights} rated nights this season.</p>
        ) : (
          <ol className="divide-y-[1.5px] divide-line">
            {top3.map((row, i) => (
              <li key={row.player_id}>
                <Link to={`/players/${row.player_id}`} className="flex min-h-12 items-center gap-3 py-2">
                  <span className="w-5 font-display text-lg text-muted">{i + 1}</span>
                  <Name className="flex-1 truncate font-bold">{row.display_name}</Name>
                  <RatingBadge value={row.avg_rating} />
                </Link>
              </li>
            ))}
          </ol>
        )}
      </Card>

      {nights.length === 0 && (
        <Empty title="No nights yet">
          {isAdmin ? 'Tap "Plan a night" to set up the next one.' : 'Your admin plans each night here.'}
        </Empty>
      )}

      <p className="pt-2 text-center text-sm">
        <Link to="/how-it-works" className="font-semibold text-brand-ink underline">
          How do nights, money and ratings work?
        </Link>
      </p>
    </div>
  )
}

function LiveNight({ night }: { night: MatchSummary }) {
  return (
    <Card strong>
      <div className="flex items-center justify-between gap-2">
        <span className="label">
          Tonight{night.location && <> · <Name>{night.location}</Name></>}
        </span>
        <StatusChip status="playing" />
      </div>
      <div className="my-3">
        <Scoreboard score={scoreOf(night.goals)} />
      </div>
      <LinkButton to={`/nights/${night.id}`} className="w-full">
        Open night
      </LinkButton>
    </Card>
  )
}

function YouOwe({ owed }: { owed: MoneyOwed }) {
  const { playerName } = useCurrentGroup()
  return (
    <Link to={`/nights/${owed.match_id}`} className="block">
      <Card strong>
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="label">You owe</p>
            <p className="money">
              {owed.share} {owed.currency}
            </p>
            <p className="text-sm">
              to{' '}
              <Name className="font-bold">
                {owed.collector_player_id ? playerName(owed.collector_player_id) : 'the collector'}
              </Name>{' '}
              for {formatDay(owed.played_at)}
            </p>
          </div>
          <span className="chip status voting">Unpaid</span>
        </div>
      </Card>
    </Link>
  )
}

function VotingNow({ night, played, voted }: { night: MatchSummary; played: boolean; voted: boolean }) {
  if (played && !voted) {
    return (
      <Link
        to={`/nights/${night.id}/vote`}
        className="block rounded-card border-2 border-[#0b0b0b] bg-brand p-4 text-on-brand"
      >
        <p className="label text-on-brand">Voting · {formatDay(night.played_at)}</p>
        <p className="font-display text-[22px] leading-tight">Vote now, closes in {timeLeft(night.voting_closes_at)}</p>
      </Link>
    )
  }
  return (
    <Card>
      <Heading>Voting · {formatDay(night.played_at)}</Heading>
      <p className="mt-1">
        {voted ? 'You voted. ' : ''}Results in {timeLeft(night.voting_closes_at)}.
      </p>
      <div className="mt-3 flex gap-2">
        {voted && (
          <LinkButton to={`/nights/${night.id}/vote`} variant="secondary" className="flex-1">
            Change votes
          </LinkButton>
        )}
        <LinkButton to={`/nights/${night.id}`} variant="secondary" className="flex-1">
          Open night
        </LinkButton>
      </div>
    </Card>
  )
}
```

- [ ] **Step 2: The Nights list**

```bash
git mv src/pages/Matches.tsx src/pages/Nights.tsx
```

Replace its content with:

```tsx
import { Link } from 'react-router'
import { ChevronIcon, PlusIcon, StarIcon } from '../components/icons'
import { Empty, ErrorNote, LinkButton, Loading, Name, PageTitle, RatingBadge, StatusChip } from '../components/ui'
import * as api from '../lib/api'
import { CANCEL_REASONS, clockOf, formatDay, parseDay, scoreOf } from '../lib/format'
import type { MatchSummary } from '../lib/types'
import { useLoad } from '../lib/useLoad'
import { useCurrentGroup } from '../state/group'

export default function Nights() {
  const { group, isAdmin, myPlayerId } = useCurrentGroup()
  const { data, error, loading, reload } = useLoad(() => api.listMatches(group.id), [group.id])

  if (loading && !data) return <Loading />

  // Grouped by month: "October 2026"
  const months = new Map<string, MatchSummary[]>()
  for (const m of data ?? []) {
    const key = parseDay(m.played_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    months.set(key, [...(months.get(key) ?? []), m])
  }

  return (
    <div>
      <PageTitle>Nights</PageTitle>
      <ErrorNote message={error} onRetry={reload} />
      {isAdmin && (
        <LinkButton to="/nights/new" className="mb-4 w-full">
          <PlusIcon size={20} /> Plan a night
        </LinkButton>
      )}
      {data?.length === 0 && (
        <Empty title="No nights yet">
          {isAdmin ? 'Plan the next night with the button above.' : 'Your admin plans each night here.'}
        </Empty>
      )}
      {[...months.entries()].map(([month, list]) => (
        <section key={month} className="mb-5">
          <h2 className="label mb-2">{month}</h2>
          <ul className="divide-y-[1.5px] divide-line overflow-hidden rounded-card border-[1.5px] border-line bg-paper">
            {list.map((m) => {
              const score = scoreOf(m.goals)
              const showScore = m.status === 'playing' || m.status === 'voting' || m.status === 'closed'
              const mine = m.match_ratings.find((r) => r.player_id === myPlayerId)
              return (
                <li key={m.id}>
                  <Link to={`/nights/${m.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold">
                        {formatDay(m.played_at)}
                        {m.starts_at && ` · ${clockOf(m.starts_at)}`}
                      </p>
                      <p className="flex items-center gap-2 text-sm text-muted">
                        <StatusChip status={m.status} />
                        <span className="truncate">
                          {m.status === 'cancelled' && m.cancel_reason ? (
                            CANCEL_REASONS[m.cancel_reason]
                          ) : (
                            <Name>{m.location ?? ''}</Name>
                          )}
                        </span>
                      </p>
                    </div>
                    {showScore && (
                      <span className="tabular font-display text-2xl whitespace-nowrap">
                        {score.A} – {score.B}
                      </span>
                    )}
                    {mine && (
                      <span className="flex items-center gap-1">
                        {mine.is_mvp && <StarIcon size={16} className="text-gold" aria-label="Man of the Match" />}
                        <RatingBadge value={mine.rating} size="sm" />
                      </span>
                    )}
                    <ChevronIcon size={18} className="shrink-0 text-muted" />
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Last routes**

In `src/App.tsx`, replace `import Matches from './pages/Matches'` with `import Nights from './pages/Nights'`, and replace the remaining `matches…` routes so the route list reads:

```tsx
        <Route index element={<Home />} />
        <Route path="nights" element={<Nights />} />
        <Route path="nights/new" element={<PlanNight />} />
        <Route path="nights/:id" element={<NightPage />} />
        <Route path="nights/:id/edit" element={<PlanNight />} />
        <Route path="nights/:id/teams" element={<Teams />} />
        <Route path="nights/:id/record" element={<Recorder />} />
        <Route path="nights/:id/vote" element={<Vote />} />
        <Route path="table" element={<Leaderboard />} />
        <Route path="players/:id" element={<PlayerProfile />} />
        <Route path="settings" element={<Settings />} />
        <Route path="how-it-works" element={<HowItWorks />} />
        <Route path="join" element={<JoinOrCreate />} />
        <Route path="*" element={<NotFound onRetry={() => void refresh()} />} />
```

- [ ] **Step 4: Paths and wording on the other screens**

- `Recorder.tsx`: `` `/matches/${id}` `` → `` `/nights/${id}` ``; back label `Match` → `Night`; the notice `'Only players in this match can log goals.'` → `"Only players on tonight's teams can log goals."`; the sticky scoreboard offset `top-[calc(env(safe-area-inset-top)+3.5rem)]` → `top-[calc(env(safe-area-inset-top)+4rem)]`.
- `Vote.tsx`: both `` `/matches/${…}` `` → `` `/nights/${…}` ``; back label `Match` → `Night`; `'Voting is not open for this match.'` → `'Voting is not open for this night.'`; `'Only players who played in this match can vote.'` → `'Only players checked in for this night can vote.'`.
- `Leaderboard.tsx`: `"No finished matches yet"` → `"No finished nights yet"`; `"Ratings appear here once a match's voting closes."` → `"Ratings appear here once a night's voting closes."`; `{minMatches} rated matches` → `{minMatches} rated nights`; `Needs {minMatches} matches to be ranked` → `Needs {minMatches} nights to be ranked`.
- `PlayerProfile.tsx`: `` `/matches/${h.match_id}` `` → `` `/nights/${h.match_id}` ``; heading `Matches` → `Nights`; `"No rated matches yet"` → `"No rated nights yet"`; `"Ratings appear after a match's voting closes."` → `"Ratings appear after a night's voting closes."`.
- `Settings.tsx`: `Matches to join the table` → `Nights to join the table`.

- [ ] **Step 5: Rewrite `src/pages/HowItWorks.tsx`**

```tsx
import { Link } from 'react-router'
import { Card, Heading, PageTitle } from '../components/ui'
import { formatPoints } from '../lib/format'
import type { RatingConfig } from '../lib/types'
import { useGroup } from '../state/group'

/** How nights, money and ratings work. Only inside the signed-in app. */
export default function HowItWorks() {
  const { config } = useGroup()
  return (
    <div className="space-y-4">
      <PageTitle sub="Nights, money and ratings, in plain words.">How it works</PageTitle>
      <NightsExplainer />
      {config && <RatingExplainer config={config} />}
    </div>
  )
}

function NightsExplainer() {
  return (
    <>
      <Card>
        <Heading className="mb-2">A night</Heading>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>An admin plans each night: the date, the pitch, the cost, players per side and who collects the money.</li>
          <li>
            Tap <strong>I'm in</strong> or <strong>Out</strong> before the night. When the night is full, "I'm in" puts
            you on the waiting list, first come first served. If someone drops out, the first person waiting moves up
            automatically.
          </li>
          <li>
            At the pitch an admin checks everyone in. <strong>Who is checked in is what counts</strong>: they play, vote
            and pay.
          </li>
          <li>
            When the admin taps <strong>End night</strong>, voting opens and the money card appears.
          </li>
        </ul>
      </Card>

      <Card>
        <Heading className="mb-2">Money</Heading>
        <p className="text-sm">
          The pitch cost is split equally among everyone checked in, rounded up to a whole pound. For example, 600 EGP ÷
          13 players = 46.15, so everyone pays <strong>47 EGP</strong> and the collector ends up with 11 EGP extra.
        </p>
        <p className="mt-2 text-sm">
          Pay your share to the night's collector. They (or an admin) tick you off, and they pay the pitch. Saying "I'm
          in" and not coming costs nothing.
        </p>
      </Card>

      <Card>
        <Heading className="mb-2">Cancelled nights</Heading>
        <p className="text-sm">
          A cancelled night counts for nothing: no votes and no ratings. If the pitch still charges something, that
          amount is split the same way.
        </p>
      </Card>
    </>
  )
}

function RatingExplainer({ config }: { config: RatingConfig }) {
  const p = config.points
  const pct = (n: number) => `${Math.round(n * 100)}%`
  const pts = (n: number | undefined) => (n == null ? 'default' : formatPoints(n))

  const rows: [string, string][] = [
    ['Start (for playing)', (p.base ?? 5).toFixed(1)],
    ['Each goal', `${pts(p.goal)} (max ${pts(p.goal_cap)})`],
    ['Each assist', `${pts(p.assist)} (max ${pts(p.assist_cap)})`],
    [
      'Team impact: per goal of difference while you were on the pitch',
      `${pts(p.net_goal)} (between ${pts(p.net_goal_min)} and ${pts(p.net_goal_max)})`,
    ],
    ['Result', `win ${pts(p.win)} · draw ${pts(p.draw)} · loss ${pts(p.loss)}`],
    [
      `Goalkeeper clean sheet (in goal for at least ${pct(p.clean_sheet_min_share ?? 0.25)} of the night)`,
      `${pts(p.clean_sheet)} (max ${pts(p.clean_sheet_cap)})`,
    ],
  ]

  return (
    <>
      <Card>
        <Heading>Your rating for a night</Heading>
        <p className="mt-2 rounded-xl bg-ground p-3 text-center font-display text-xl">
          {pct(config.w_analytics)} stats score + {pct(config.w_votes)} peer votes
        </p>
        <p className="mt-2 text-sm text-muted">
          Shown from 0 to 10 with one decimal. With fewer than {config.min_votes} votes, the rating is the stats score
          alone ("stats only"), so you always get a rating.
        </p>
      </Card>

      <Card>
        <Heading className="mb-2">Stats score</Heading>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-line">
            {rows.map(([label, value]) => (
              <tr key={label}>
                <td className="py-2 pr-3">{label}</td>
                <td className="tabular py-2 text-right font-semibold whitespace-nowrap">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-sm text-muted">
          The total stays between {(p.analytics_min ?? 1).toFixed(1)} and {(p.analytics_max ?? 10).toFixed(1)}. Disputed
          goals don't count until an admin sorts them out.
        </p>
      </Card>

      <Card>
        <Heading className="mb-2">Peer votes</Heading>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>Everyone checked in rates everyone else who was checked in, 1 to 10. No voting for yourself.</li>
          <li>"Didn't see enough" is fine: it isn't counted in the average.</li>
          <li>
            Votes stay secret until voting closes ({config.voting_hours} hours after the night ends). Then everyone sees
            who voted what.
          </li>
          <li>Man of the Match is a separate honour. It doesn't change anyone's rating.</li>
        </ul>
      </Card>

      <Card>
        <Heading className="mb-2">Season and table</Heading>
        <p className="text-sm">
          Your season rating is the average of your night ratings in the calendar year. A new season starts on 1 January.
          You join the table after {config.min_matches_for_leaderboard} rated nights.
        </p>
        <p className="mt-2 text-sm">
          <Link to="/nights" className="font-semibold text-brand-ink underline">
            Open any finished night
          </Link>{' '}
          and tap a player to see the exact breakdown of their rating.
        </p>
      </Card>
    </>
  )
}
```

- [ ] **Step 6: Check**

Run: `npx tsc -b && npm run lint && npm test && npm run build` → Expected: all pass.
Run: `grep -rnE "[\`'\"]/matches" src` → Expected: no output.
Run: `grep -rnE "\b(bg-card|text-card|text-pitch|bg-pitch|pitch-deep|pitch-stripes|team-a-soft|team-b-soft|bg-primary|text-team-a|text-team-b)\b" src` → Expected: no output.

---

## Part E — Docs, checks and hand-over

### Task 15: README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Rename and update the sections**

Replace every "Ta7dy-El-La3eeba" / "Ta7dy" with "7GZ-KORA" (project names in steps 2 and 6b: `7gz-kora`; example address `https://7gz-kora.vercel.app`; the email template `Your 7GZ-KORA sign-in code is {{ .Token }}`). Then replace these parts with the text below.

**Title and intro** (lines 1-7):

```markdown
# 7GZ-KORA

A free app for our football nights. An admin plans each night, friends tap "I'm in" or "Out", and at the pitch everyone is checked in. The app records who scored and assisted, splits the pitch cost, and after the night everyone who played rates the others. It all turns into a **rating out of 10** for every player, plus a season table and player profiles.

It is a PWA (a website that installs like an app). In a browser the website shows only an **Install screen**; the app opens once it's on the home screen. No App Store, no Play Store, no developer accounts.

**What it runs on (all free tiers):** React + TypeScript + Vite + Tailwind for the app, Supabase for the database and Google sign-in, Vercel for hosting.
```

**Section 1** (whole section):

```markdown
## 1. What's built so far

**Phase 1** (`Plans/football-idea.md`) and **stage 1 of the 7GZ-KORA upgrade** (`Plans/README.md`):

- The 7GZ-KORA look (`Design/README.md`), light and dark mode; Arabic names display correctly
- **Install first:** in a browser the website shows only the Install screen: the logo, the name, the steps for that phone, and the invite code when opened from an invite link. Sign-in happens inside the installed app. Search engines are kept out, and link previews show only the name and logo.
- Google sign-in (plus an optional email-code sign-in), groups, invite codes, admins and members
- **Nights:** an admin plans a night (date, time, pitch, length, cost, players per side, collector, player limit), pre-filled from the last one. Friends tap **I'm in** or **Out**. When the night is full, "I'm in" joins a waiting list, and the first person waiting moves up automatically when someone drops out. A planned night can be shared to WhatsApp.
- **At the pitch:** the admin starts the night and checks people in (anyone in the group; the arrival time is saved; tap again when someone leaves early), picks Team A and Team B from the people checked in, and goals are logged as before.
- **End night** opens voting. **Cancel night** (rain, not enough players, pitch problem, other) means nothing counts; a cancellation can be shared to WhatsApp.
- **Money card:** the cost is split equally among everyone checked in, rounded up to a whole pound ("You owe 47 EGP to Ahmed"). The collector or an admin ticks people off.
- Voting (1–10, "Didn't see", Man of the Match), ratings with a full breakdown, the season table and player profiles, as in Phase 1.

**Coming next** (`Plans/README.md`): games (many short games per night, a timer, Team C, swaps, penalties, admin-only goal recording, one rating per night across all games), the team suggester, punishments and loyalty points, Team of the Night and best duos.
```

**Step 3** (create the tables), item 3:

```markdown
3. Do the same with `20261023000200_rating.sql`, then `20261023000300_actions.sql`, then `20261024000100_nights.sql`. **Order matters.**
```

**Step 5** (run it on your computer), after "Open <http://localhost:5173>.":

```markdown
In a normal browser you'll see the **Install screen**, because that's all the website shows (section 5). To use the app in your computer's browser while developing, add this line to `.env.local` and restart `npm run dev`:

    VITE_ALLOW_BROWSER=true

**Never add it to Vercel.** It would show the app to anyone with the link, so the build stops with an error if it's set there.
```

**Step 7** (Vercel), add at the end:

```markdown
Link previews (WhatsApp etc.) use your Vercel production address for the logo automatically.
```

**Section 3**, add after step 2:

```markdown
Remember: the website in the browser only shows the Install screen. Signing in always happens in the installed app.
```

**Section 5** (whole section):

```markdown
## 5. How friends install the app

Send the group your invite link from **More → Share invite**. Opening it in a browser shows the **Install screen** with the steps for their phone and the invite code:

> **iPhone:** open the link in **Safari** (inside WhatsApp or Instagram, first choose **Open in Safari**) → tap **Share** → **Add to Home Screen** → **Add**. Then open 7GZ-KORA from the home screen and sign in there.
>
> **Android:** open the link in **Chrome** → tap **Install app** (or the menu **⋮** → **Install app**).
>
> Sign in with Google, choose **Join with an invite code** and type the code from the Install screen.

On iPhone the code can't be carried into the installed app automatically, so people type it once. On Android it's usually filled in already.
```

**Section 6**, first sentence: `Each player gets one rating per match` → `Each player gets one rating per night`. Add at the end of the section: `Stage 2 changes how team impact and result are counted across many games in a night (see Plans/Football-scenario.md section 3).`

**Section 7** (choices): delete choice 5 ("New matches start in progress") and choice 12, renumber, and add:

```markdown
12. **Teams wear bib colours:** A white, B orange, C blue (Team C arrives with games in stage 2).
13. **Paid ticks are kept in their own small table** (`night_payments`), because on a night cancelled before anyone arrived, the people who pay never got checked in.
14. **The share is worked out in the database** (`night_payer_rows`), like ratings, so every phone shows the same number.
15. **Replies close when the night starts.** Check-in stays open while voting is open, to add someone who was forgotten; the shares then recalculate and ticks stay.
16. **Nobody ticks off their own payment**, admins included. The collector counts as paid automatically.
17. **The player limit** starts at 3 × players per side (18 for 6 a side) and follows the side size unless you change it. "No player limit" switches the waiting list off.
18. **A cancelled night can't be un-cancelled**: plan a new one. The reason "Other" needs a short note.
19. **Link-preview bots** (WhatsApp, Facebook, Telegram, X) may read the site so shared links show the name and logo; search engines are kept out.
20. **"No reply"** counts group members with an account (the people who can answer).
```

**Section 8** (demo data and tests):

- Demo data paragraph: `supabase/seed.sql` creates **Demo FC** with 12 fake players (one with an Arabic name), 4 finished nights (one from last year), a night cancelled for rain, yesterday's night with voting open and 3 people paid back, and a planned night in 3 days with a 10-player limit (10 in, 1 waiting, 1 out), so you can see the waiting list. Ahmed collects the money. Run it after the **four** migration files.
- Tests: replace the count and the list with the real number from `npm test`, and list `tests/db/nights.test.ts` (planning, replies and the waiting list, check-in, ending and cancelling, the money worked example 600 ÷ 13 → 47) and `src/lib/*.test.ts` (the install decision and device detection, Plan-a-night defaults, money totals, WhatsApp texts, formatting).
- Project layout: `supabase/migrations/` "tables + security (1), ratings (2), app actions (3), nights (4)"; add `src/lib/` "API calls and small tested helpers"; `public/` "icons, `logo.svg` (white mark), `robots.txt`"; `npm run icons` now rebuilds the icons from `public/app-icon.svg`.

**Section 10** (troubleshooting): change "One of the three SQL files" to "One of the four SQL files" and add rows:

```markdown
| The website only shows the Install screen | That's on purpose: sign in from the installed app. For development on a computer, add `VITE_ALLOW_BROWSER=true` to `.env.local`. |
| The Vercel build fails with "VITE_ALLOW_BROWSER must never be set on Vercel" | Remove that variable from the project's Environment Variables and redeploy. |
| "Replies are closed" | The night has started or was cancelled. Replies are only for planned nights. |
```

- [ ] **Step 2: Check**

Run: `grep -niE "ta7dy|la3eeba|three SQL|3 migration" README.md` → Expected: no output.

---

### Task 16: Verify everything and hand over

**Files:**
- Temporary only, in the session's scratch folder (`$SCRATCH` below): `standin/` (database, API, proxy, screenshot scripts) and `shots/`. Nothing here is added to the project.

- [ ] **Step 1: The four checks**

Run: `npx tsc -b && npm run lint && npm test && npm run build`
Expected: all pass. Note the number of tests for the README and the report.

- [ ] **Step 2: Rule greps**

```bash
grep -rnE "\b(text-white|bg-white)\b" src            # only SignIn and InstallScreen (logo lettering)
grep -rniE "ta7dy|la3eeba|pitch-stripes|barlow" src index.html vite.config.ts package.json public README.md
grep -rnE "[\`'\"]/matches" src
grep -c 'name="description"' dist/index.html          # 0
```

Expected: the first lists only the two `<h1>`s; the others print nothing (the last prints 0).

- [ ] **Step 3: Start a temporary stand-in for Supabase**

```bash
mkdir -p "$SCRATCH/standin" "$SCRATCH/shots" && cd "$SCRATCH/standin"
npm init -y && npm i @electric-sql/pglite@0.5 @electric-sql/pglite-socket playwright-core
gh release download v14.18 -R PostgREST/postgrest -p "*windows*" && unzip -o postgrest-*.zip
```

(If `pglite-socket`'s peer version doesn't match pglite 0.5, install the pglite version it asks for.)

`session.mjs`:

```js
// A signed-in session for the stand-in: an HS256 token signed with PostgREST's secret.
import { createHmac } from 'node:crypto'

export const SECRET = 'local-stand-in-secret-at-least-32-characters'
export const OWNER = '11111111-1111-1111-1111-111111111111'
export const user = {
  id: OWNER, aud: 'authenticated', role: 'authenticated', email: 'owner@example.com',
  user_metadata: { full_name: 'Owner' }, app_metadata: { provider: 'google' },
}
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')

export function jwt() {
  const head = b64({ alg: 'HS256', typ: 'JWT' })
  const body = b64({ sub: OWNER, role: 'authenticated', aud: 'authenticated', email: user.email, exp: Math.floor(Date.now() / 1000) + 30 * 86400 })
  return `${head}.${body}.${createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url')}`
}

export function session() {
  const expires_in = 30 * 86400
  return { access_token: jwt(), refresh_token: 'stand-in', token_type: 'bearer', expires_in, expires_at: Math.floor(Date.now() / 1000) + expires_in, user }
}
```

`db.mjs` (argument: the project folder):

```js
// PGlite with the real migrations and seed, served like Postgres on 127.0.0.1:54329.
import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { OWNER } from './session.mjs'

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
`)
const dir = join(project, 'supabase', 'migrations')
for (const f of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) await db.exec(readFileSync(join(dir, f), 'utf8'))
await db.exec(readFileSync(join(project, 'supabase', 'seed.sql'), 'utf8'))

// The owner joins Demo FC (becoming admin) and is checked in to yesterday's night, so "You owe 47 EGP" shows.
await db.exec(`insert into auth.users (id, email, raw_user_meta_data) values ('${OWNER}', 'owner@example.com', '{"full_name":"Owner"}')`)
await db.exec(`
  set request.jwt.claims = '{"sub":"${OWNER}"}'; set role authenticated;
  select public.join_group('DEMO-KICK', 'Owner');
  select public.check_in(m.id, public.my_player_id(m.group_id)) from public.matches m where m.status = 'voting';
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
jwt-secret = "local-stand-in-secret-at-least-32-characters"
server-port = 54330
```

`proxy.mjs`:

```js
// http://localhost:54321 → /rest/v1/* goes to PostgREST, /auth/v1/* answers with the signed-in owner.
import http from 'node:http'
import { session, user } from './session.mjs'

const cors = {
  'access-control-allow-origin': '*', 'access-control-allow-headers': '*',
  'access-control-allow-methods': '*', 'access-control-expose-headers': '*',
}
http.createServer((req, res) => {
  if (req.method === 'OPTIONS') return res.writeHead(204, cors).end()
  if (req.url.startsWith('/auth/v1/')) {
    res.writeHead(200, { ...cors, 'content-type': 'application/json' })
    return res.end(JSON.stringify(req.url.startsWith('/auth/v1/user') ? user : session()))
  }
  if (req.url.startsWith('/rest/v1/')) {
    const upstream = http.request(
      { host: '127.0.0.1', port: 54330, path: req.url.slice('/rest/v1'.length), method: req.method, headers: { ...req.headers, host: '127.0.0.1:54330' } },
      (up) => { res.writeHead(up.statusCode, { ...up.headers, ...cors }); up.pipe(res) },
    )
    return void req.pipe(upstream)
  }
  res.writeHead(404, cors).end()
}).listen(54321, () => console.log('stand-in API on http://localhost:54321'))
```

`shots.mjs` (arguments: base URL, output folder, then paths; env `SIGNED_OUT=1` and `UA=...` optional):

```js
// Screenshots at phone width (390 px), light and dark. Uses the installed Edge.
import { chromium } from 'playwright-core'
import { session } from './session.mjs'

const [base, out, ...paths] = process.argv.slice(2)
const browser = await chromium.launch({ channel: 'msedge' })
for (const colorScheme of ['light', 'dark']) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme,
    ...(process.env.UA ? { userAgent: process.env.UA, hasTouch: true, isMobile: true } : {}),
  })
  if (!process.env.SIGNED_OUT) {
    await context.addInitScript((s) => localStorage.setItem('sb-localhost-auth-token', JSON.stringify(s)), session())
  }
  const page = await context.newPage()
  for (const path of paths) {
    await page.goto(base + path)
    await page.waitForTimeout(1500)
    const font = await page.evaluate(() => getComputedStyle(document.querySelector('h1') ?? document.body).fontFamily)
    console.log(colorScheme, path, 'h1 font:', font)
    await page.screenshot({ path: `${out}/${colorScheme}${path.replace(/[^a-z0-9]+/gi, '_')}.png`, fullPage: true })
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
VITE_SUPABASE_URL=http://localhost:54321 VITE_SUPABASE_PUBLISHABLE_KEY=stand-in npx vite --port 5174 --strictPort
```

(Port 5173 runs the app with the development bypass; 5174 behaves like the real website and shows the Install screen.)

- [ ] **Step 4: Check every new PostgREST embed (no `PGRST201`)**

```bash
TOKEN=$(cd "$SCRATCH/standin" && node -e "import('./session.mjs').then((m) => console.log(m.jwt()))")
for q in \
  "matches?select=*,goals(scoring_team,disputed),match_ratings(player_id,rating,is_mvp),match_players!match_players_match_id_fkey(player_id),rsvps(player_id,status,status_changed_at,waiting_since,promoted_at)" \
  "players?select=id,profiles!players_user_id_fkey(avatar_url)" \
  "group_members?select=role,player_id,groups(id,name,invite_code)" \
  "match_ratings?select=*,matches!inner(*)"; do
  curl -s -o /dev/null -w "%{http_code} $q\n" "http://localhost:54321/rest/v1/$q" -H "apikey: stand-in" -H "Authorization: Bearer $TOKEN"
done
```

Expected: `200` for every line. On any other code, print the body; `PGRST201` means an ambiguous embed that needs a `!fkey_name` hint.

- [ ] **Step 5: Screenshots against the design**

Get the night ids: `curl -s "http://localhost:54321/rest/v1/matches?select=id,status" -H "apikey: stand-in" -H "Authorization: Bearer $TOKEN"`. Then:

```bash
cd "$SCRATCH/standin"
export MSYS_NO_PATHCONV=1
IPHONE="Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1"
UA="$IPHONE" SIGNED_OUT=1 node shots.mjs http://localhost:5174 "$SCRATCH/shots" /join?code=DEMO-KICK          # Install screen
SIGNED_OUT=1 node shots.mjs http://localhost:5173 "$SCRATCH/shots" /                                          # Sign-in
node shots.mjs http://localhost:5173 "$SCRATCH/shots" / /nights /nights/new /nights/<draft> /nights/<voting> /nights/<cancelled> /nights/<closed> /table /settings /how-it-works
```

Then start the planned night and check a few people in through the API (`POST /rest/v1/rpc/start_night`, `rpc/check_in`, `rpc/save_lineup` with the same headers) and shoot `/nights/<draft>` (now live) and `/nights/<draft>/teams`.

Open each PNG and compare with `Design/screens.html` (open it in Edge at the same width): honeycomb header with white mark and black "7GZ-KORA"; black text on every green surface; team chips in bib colours; status chips; rating badge bands; money card; dark mode keeps the brand green, team colours and rating bands. The console lines must show `"Archivo Black"` for headings. Check at 390 px: no horizontal scrolling, Arabic names (محمد) left-aligned. Fix anything that doesn't match, then rerun Step 1.

Stop the background processes when done.

- [ ] **Step 6: Report to the owner and ask about the commit**

Tell the owner in plain words: what was built, how it was tested (number of tests, the four checks, the screens checked and anything that still looks off), the decisions this plan made (the list at the top of this file), and what's still open (stage 2; the real iPhone sign-in test once Supabase is set up). Then ask with AskUserQuestion:

- "Commit stage 1 straight to main (Recommended)" — their usual choice
- "Commit on a new branch"
- "Don't commit yet"

Commit with a message like `Build stage 1: 7GZ-KORA look, install-first access and nights` ending with the attribution line. Don't push unless asked. Update the project-status memory (stage 1 built and committed).

---

## Spec coverage

| Requirement (spec) | Task |
|---|---|
| Rename to 7GZ-KORA everywhere (Football-scenario §0) | 7, 8, 9, 15 |
| Design applied: fonts, tokens, components, header, sign-in, icons, manifest, HTML (Design §9) | 7, 8 |
| Install screen only in a browser; sign-in only when installed; per-device steps; invite code with Copy (Install-first §1-3) | 9 |
| Name and logo only: no description, Open Graph, noindex, robots.txt, no tagline (Install-first §4) | 7, 8 |
| `VITE_ALLOW_BROWSER` dev bypass + pure, tested decision function (Install-first §6) | 7, 9 |
| Plan a night with all fields, pre-filled from the last night (Football-scenario §2) | 1, 10, 12 |
| I'm in / Out with counts "11 in · 2 out · 4 no reply" (§2) | 2, 11 |
| Waiting list: cap (3 × side, or no limit), order, automatic move-up, "You're in!" (Extras §2) | 2, 10, 11, 12 |
| RSVP changes timestamped for punishments (§0); spot taken by a waiting player recorded (Extras §2) | 1, 2 |
| Start night, check-in with arrival time, left early, anyone in the group (§2) | 3, 11 |
| End night opens voting for those checked in (§2) | 4, 13 |
| Money: equal split rounded up, collector paid automatically, collector or admin ticks, no self-tick, "You owe X to Y", "Collected 423 of 611", extra shown, no-shows not charged, late check-in recalculates (§4) | 5, 10, 11, 14 |
| Cancelled nights: reasons, nothing counts, fee split among checked in or "I'm in" (Extras §1) | 4, 5, 11, 13 |
| Share a planned and a cancelled night to WhatsApp (Extras §5) | 10, 11, 13 |
| Screens: Nights tab, Home, Plan a night, night page planned/live/voting/closed/cancelled (§7) | 12, 13, 14 |
| Worked examples as tests (600 ÷ 13 → 47, 611, 11) | 5, 10 |
| Seed with the new features; README; How it works | 6, 14, 15 |
| Embeds unambiguous; 390 px light/dark check | 16 |

Left for later stages on purpose: games, timer, Team C on the board, swaps, penalties, admin-only goal logging and the per-night rating fix (stage 2); "I'm in, but I'll be late" and every punishment (stage 4); the results share (stage 5).

---

## Changes made during the build (found in the Task 16 screen checks)

- **Plan a night skipped an already-planned date.** When the last night is still ahead (already planned), the form now suggests the same weekday *after* it, not the same day again. New test in `src/lib/night.test.ts`.
- **The night page repeated the night's details** inside the reply card. `RsvpCard` has a `showNight` option; the night page turns it off and the card is headed "Replies".
- **"Cancel night" wrapped onto two lines** at 390 px. The admin card now stacks Start night, Edit night and Cancel night at full width.
- **Demo times showed 21:00.** The seed now writes 20:00 in `Africa/Cairo` time instead of assuming winter time.
- **Stand-in setup:** PostgREST needs `db-prepared-statements = false` with pglite-socket (one shared session), and the proxy answers 502 instead of crashing when PostgREST is down.
