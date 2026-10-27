# Stage 3c: Accounts, Groups and Chat — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The player card moves onto the account and is filled in once, from one-by-one sign-up questions; groups become optional; admins give groups a photo and a Public / Private switch; anyone signed in can find public groups and search players (Instagram-style account pages, a Squad page); every group gets a live text chat; nights get a Google Maps link with a map preview; the collector can add an InstaPay number; Home becomes a group hub; and the app loads each screen only when it's opened.

**Architecture:** One new migration, file 8 (`supabase/migrations/20261026000100_accounts_groups_chat.sql`). Files 1-7 already ran on the owner's live Supabase project and are **never edited**. The card's source is now `profiles`; each group's `players` row keeps a **copy**, written only by database triggers, so every screen that reads `players` (cards, Self vs friends, the team suggester, the goalkeeper suggestion) keeps working unchanged. New reads and writes go through `security definer` functions that check the caller. In the app: pure, tested helpers (`signup.ts`, `phone.ts`, `photo.ts`, `chat.ts`, `maplink.ts`, `hub.ts`), two new providers (`AccountProvider`, `ChatProvider`), new screens, and a tiny Vercel function (`api/map-link.ts`) that follows Google's short map links. Ratings stay calculated only in `compute_match_ratings`, which this stage doesn't touch.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Tailwind 4, react-router 8, supabase-js 2.118 (Realtime and Storage are part of it), Motion 14.1.0, Postgres (Supabase), PGlite for database tests, vitest 5, Vercel Functions (Node.js runtime, web-standard `fetch` export). **No new package.**

**Spec:** `Plans/Accounts-groups-and-chat.md` (all of it; its section 0 decisions are final). Also `Plans/Player-card-and-motion.md` (the card, still valid apart from where it lives), `Design/README.md` (colours, type, components, accessibility) and the root `CLAUDE.md`.

## Global Constraints

- **Files 1-7 in `supabase/migrations/` ran on the live project: never edit them.** Every database change goes in file 8, `supabase/migrations/20261026000100_accounts_groups_chat.sql`.
- **Stay on Supabase.** Every table keeps Row Level Security; access is granted explicitly. The only new direct write permission is `update (image_path, is_public)` on `groups` (admins, under the existing row rule). Everything else goes through functions.
- **The card lives on the account (`profiles`). Only its owner changes it.** `players` keeps a copy written by the database: with **Show my stats** off, the copy has **no skills**.
- **Show my stats** is on by default. Off hides the **five skills and the self-rating** (so also Self vs friends) from everyone else. Night ratings still show in the Table.
- **Public groups:** anyone signed in joins with one tap. Someone an admin removed needs an invite code. Private groups need the code, as today.
- **Chat:** text only, **1-500 characters** after trimming. Delete your own; admins delete any. A deleted message shows "Message deleted" (its text is gone).
- **InstaPay number:** an Egyptian mobile number, saved as 11 digits `^01[0125][0-9]{8}$`, shown as `010 1234 5678`. Visible to members of your groups, **never** in Find or on the account page. **Money doesn't change:** the share is still total ÷ players checked in, rounded up.
- **Pitch link:** Google Maps links only; the position is saved with the night (`pitch_lat`, `pitch_lng`, both or neither). The helper follows at most **5** redirects, Google addresses only, gives up after **5 seconds**, stores nothing.
- **Admins only** start and end games, change teams, check people in and log goals (unchanged).
- **Text on the brand green `#00BF63` is always black** (your chat bubbles included). White only in the logo lettering.
- **Names can be Arabic:** wrap every name, motto and chat message in `<Name>` or `dir="auto"`, keep names left-aligned in lists.
- **Motion:** only the `m` components (`import * as m from 'motion/react-m'`), animate only `transform` and `opacity`, respect "reduce motion" (as in stage 3b).
- Tap targets at least 48 px. Follow the existing code style: comment density, naming, small files.
- Checks that must pass at the end: `npx tsc -b`, `npm run lint` (0 warnings), `npm test`, `npm run build`.

## How this stage is run

- One commit at the end of the stage, after the owner chooses how (their usual: straight to `main`). Each task ends with a checkpoint (checks green) instead of a commit.
- Screen checks use a **temporary** local stand-in for Supabase in the session's scratch folder (Task 19), as in stages 1-3b. The stand-in has no Realtime and no Storage server, so there the chat uses its 10-second fallback and photo upload can't be clicked through; both are covered by database tests, and the owner tests them on the live app.
- The owner must run **file 8** on their live project once, **before** pushing (every push to `main` deploys to Vercel, and the new app calls the new functions as soon as it opens). Task 18 puts that in the README; the hand-over tells them in plain words.

## Decisions this plan makes (not covered by the spec; flag them to the owner)

1. **It's called "stage 3c"** in `Plans/README.md`: after stage 3b, before punishments (stage 4).
2. **The Squad page is at `/table/squad`**, so the Table tab stays lit on it.
3. **The map helper only returns the full Google address;** the app finds the position in it (`coordsFromMapUrl`), so the position rules live in one tested place. It doesn't read Google's page content.
4. **One chat connection per open app** (`ChatProvider`), shared by the Chat tab, its dot and Home. A live event is only a signal: the app then reads that message through the normal API, so times and permissions are the same as everywhere else. After you send, the app re-reads the latest messages, so yours shows even when the live connection is down.
5. **Deleting a message blanks it** instead of removing the row, because Realtime can't say which group a removed row belonged to.
6. **To delete a message, tap it**, then **Delete** (with the confirmation sheet).
7. **The account name** changes only the account (and the name you join new groups with). Your name inside each group stays as it is, and can be changed there ("Your name in this group").
8. **Skip on the name question keeps the Google name.**
9. **Your own profile in a group shows your account's card,** skills included even when hidden, with "Hidden from everyone else" under them.
10. **What stays in the first download:** the Install screen, sign-in, the sign-up questions, Home (both kinds), Join or create, and the header and tabs. Every other screen loads when it's first opened.
11. **Copy on the InstaPay line copies the bare 11 digits** (what InstaPay's "send to mobile number" takes).
12. **The test database gets small stand-ins** for Supabase's storage tables and its Realtime publication (`tests/db/helpers.ts`), so the storage rules and the Realtime setting are tested too.
13. **`tests/db/card.test.ts` now runs files 1-7 only**: it tests file 7 as written. File 8 changes who writes the card, which `accounts.test.ts` tests. `games.test.ts`'s "happy in goal" test now goes through the account.
14. **The "most complete card" choice is tested in SQL only**, because the app never needs it.
15. **Search lists every account** (signed up or not), by account name, 20 at most.
16. **The account page's totals** count rated nights (voting closed), goals in them that aren't disputed, and Man of the Match awards.

---

## File structure

**Database**

| File | Change |
|---|---|
| `supabase/migrations/20261026000100_accounts_groups_chat.sql` | **New.** Section 1 accounts (columns, the copy, the data move, locks, `my_account`, `save_my_account`, `finish_sign_up`, `get_account`, `search_accounts`). Section 2 groups (photo, public, storage bucket and rules, `list_public_groups`, `join_public_group`). Section 3 chat (`group_messages`, Realtime, `send_message`, `delete_message`). Section 4 the pitch (`matches` columns, `write_night_details` replaced). |
| `tests/db/helpers.ts` | Stand-ins for `storage.*` and the `supabase_realtime` publication |
| `tests/db/accounts.test.ts` | **New.** Section 1 of file 8 |
| `tests/db/groups.test.ts` | **New.** Section 2 |
| `tests/db/chat.test.ts` | **New.** Section 3 |
| `tests/db/pitch.test.ts` | **New.** Section 4 |
| `tests/db/card.test.ts` | Runs files 1-7 only |
| `tests/db/games.test.ts` | "Happy in goal" through the account |
| `supabase/seed.sql`, `tests/db/seed.test.ts` | The planned night's pitch link, Ahmed's InstaPay number, demo chat messages |

**Map helper**

| File | Change |
|---|---|
| `api/map-link.ts` | **New.** The Vercel function: `isGoogleHost`, `expandMapLink`, the `fetch` handler |
| `tests/api/map-link.test.ts` | **New.** With a fake `fetch` |
| `vercel.json` | The app's rewrite leaves `/api/` alone |
| `vite.config.ts` | `/api/map-link` inside `npm run dev` too |
| `tsconfig.node.json`, `vitest.config.ts` | Include `api/` and `tests/api/` |

**App: logic (pure, tested with vitest next to them)**

| File | Responsibility |
|---|---|
| `src/lib/signup.ts` + test | **New.** `SIGN_UP_STEPS`, `isSkillStep`, `skipStep`, `startDraft` |
| `src/lib/phone.ts` + test | **New.** `checkPhone`, `formatPhone` |
| `src/lib/photo.ts` + test | **New.** `fitWithin`, `shrinkPhoto` |
| `src/lib/chat.ts` + test | **New.** `mergeMessages`, `hasUnread`, `chatRows`, `CHAT_GAP_MINUTES` |
| `src/lib/maplink.ts` + test | **New.** `isGoogleMapsUrl`, `isShortMapUrl`, `coordsFromMapUrl`, `mapEmbedUrl` |
| `src/lib/hub.ts` + test | **New.** `countdown`, `podiumOrder` |
| `src/lib/card.ts` | `accountCard` |
| `src/lib/night.ts` + test, `src/lib/share.ts` + test | The pitch link |
| `src/lib/types.ts` | `CardView`, `Account`, `AccountInput`, `AccountPage`, `AccountGroup`, `AccountHit`, `PublicGroup`, `ChatMessage`; `Group`, `Player`, `Match`, `NightDetails`, `NightForm` gain fields |
| `src/lib/api.ts` | Accounts, public groups, photos, chat, the map helper; `saveCard` becomes `renamePlayer` |
| `src/lib/storage.ts` | `KEYS.chatLastRead`; `cardReminderHidden` is per account |

**App: state, screens and pieces**

| File | Responsibility |
|---|---|
| `src/state/account.tsx` | **New.** `AccountProvider`, `useAccount`, `useMyAccount` |
| `src/state/chat.tsx` | **New.** `ChatProvider`, `useChat` |
| `src/pages/SignUp.tsx` | **New.** The sign-up questions |
| `src/pages/Lobby.tsx` | **New.** Home without a group |
| `src/pages/Find.tsx` | **New.** Search players, public groups |
| `src/pages/Account.tsx` | **New.** `/u/:id` and `/me` |
| `src/pages/EditAccount.tsx` | **New.** `/me/edit` (replaces `EditCard.tsx`) |
| `src/pages/ChangeName.tsx` | **New.** `/players/:id/edit`: the name in this group |
| `src/pages/Squad.tsx` | **New.** `/table/squad` |
| `src/pages/Chat.tsx` | **New.** `/chat` |
| `src/pages/EditCard.tsx`, `src/pages/Welcome.tsx` | **Deleted** |
| `src/components/groups.tsx` | **New.** `GroupImage`, `PublicGroupList`, `useEnterGroup` |
| `src/components/hub.tsx` | **New.** `GroupBanner`, `SeasonStrip`, `Podium`, `ChatPreview`, `FinishCard` |
| `src/components/pitchmap.tsx` | **New.** `PitchMap` |
| `src/components/tabletabs.tsx` | **New.** `TableTabs` |
| `src/components/icons.tsx` | `SearchIcon`, `ChatIcon`, `PinIcon` |
| `src/components/card.tsx` | Takes a `CardView`; "Stats hidden" |
| `src/components/money.tsx` | `InstaPayLine`, the collector's reminder |
| `src/components/rsvp.tsx` | A slot for extra lines (Home's countdown and map) |
| `src/components/selfvsfriends.tsx` | Links to `/me/edit`; hidden stats |
| `src/components/Layout.tsx` | Search and your photo in the header; tabs with and without a group; the chat dot; `Suspense` |
| `src/App.tsx` | Lazy screens; the account gate; routes with and without a group |
| `src/pages/Home.tsx` | The group hub |
| `src/pages/JoinOrCreate.tsx` | `GroupForms` with the account name |
| `src/pages/Settings.tsx` | With and without a group; the Group card (photo, name, Public) |
| `src/pages/PlayerProfile.tsx`, `PlanNight.tsx`, `NightPage.tsx`, `Leaderboard.tsx`, `HowItWorks.tsx` | Smaller changes (each task says) |

**Docs:** `README.md`, `Plans/README.md`, `Plans/NEXT-SESSION-PROMPT.md`, `CLAUDE.md`, `public/privacy.html`.

---

## Part A — Faster loading

### Task 1: Screens load when they're opened

**Files:**
- Modify: `src/App.tsx`, `src/components/Layout.tsx`

**Interfaces:**
- Produces: every page except `Home`, `JoinOrCreate`, `SignIn` and `InstallScreen` is a `lazy()` import; `Layout` wraps `<Outlet />` in `<Suspense fallback={<Loading />}>`.

- [ ] **Step 1: Note the size before**

Already measured at the start of this session (`npm run build` on `798ff67`): `dist/assets/index-*.js` **683.32 kB, 197.72 kB gzipped**; `motionFeatures-*.js` 85.86 kB. Keep these for the hand-over.

- [ ] **Step 2: Lazy imports in `src/App.tsx`**

Replace the page imports (keep `Home`, `JoinOrCreate`, `SignIn`, `InstallScreen` as they are) with:

```tsx
import { lazy } from 'react'

// Screens load when they're first opened (Plans/Accounts-groups-and-chat.md
// section 9). The installed app keeps them all for offline use.
const ChangeHistory = lazy(() => import('./pages/ChangeHistory'))
const EditCard = lazy(() => import('./pages/EditCard'))
const HowItWorks = lazy(() => import('./pages/HowItWorks'))
const Leaderboard = lazy(() => import('./pages/Leaderboard'))
const NightPage = lazy(() => import('./pages/NightPage'))
const Nights = lazy(() => import('./pages/Nights'))
const PlanNight = lazy(() => import('./pages/PlanNight'))
const PlayerProfile = lazy(() => import('./pages/PlayerProfile'))
const Recorder = lazy(() => import('./pages/Recorder'))
const Settings = lazy(() => import('./pages/Settings'))
const Swap = lazy(() => import('./pages/Swap'))
const Teams = lazy(() => import('./pages/Teams'))
const Vote = lazy(() => import('./pages/Vote'))
const Welcome = lazy(() => import('./pages/Welcome'))
```

(`lazy` joins the existing `import { useEffect } from 'react'` line. `EditCard` and `Welcome` go in Tasks 8 and 9.)

- [ ] **Step 3: `Suspense` in `src/components/Layout.tsx`**

```tsx
import { Suspense } from 'react'
import { Loading, Name } from './ui'
```

and around the outlet:

```tsx
        <m.div key={pathname} {...rise}>
          {/* A screen still downloading shows the placeholders. */}
          <Suspense fallback={<Loading />}>
            <Outlet />
          </Suspense>
        </m.div>
```

- [ ] **Step 4: Build and compare**

Run: `npx tsc -b && npm run lint && npm run build`
Expected: passes, the 500 kB warning is gone, `index-*.js` is much smaller than 683 kB, and there's one small chunk per screen. Note the new size. Run `npm test`: 174 pass.

---

## Part B — The database (file 8)

### Task 2: Accounts (file 8, section 1)

**Files:**
- Create: `supabase/migrations/20261026000100_accounts_groups_chat.sql` (header and section 1)
- Modify: `tests/db/helpers.ts` (the stand-ins, used from Task 3), `tests/db/card.test.ts`, `tests/db/games.test.ts`
- Test: `tests/db/accounts.test.ts`

**Interfaces:**
- Produces (SQL, callable by signed-in users):
  - `my_account() returns public.profiles`
  - `save_my_account(p_account jsonb) returns void`
  - `finish_sign_up(p_account jsonb) returns void`
  - `search_accounts(p_query text) returns table (user_id uuid, display_name text, avatar_url text, shirt_number smallint, favourite_position text)`
  - (`get_account` reads the group columns, so it's written in Task 3. It returns jsonb with keys `user_id, display_name, avatar_url, shirt_number, strong_foot, favourite_position, motto, skill_shooting, skill_passing, skill_dribbling, skill_defending, skill_fitness, happy_in_goal, show_stats, nights, goals, mvps, groups`; each group is `{id, name, image_path, is_public, i_am_in, player_id}`.)
  - `p_account` keys: `display_name, shirt_number, strong_foot, favourite_position, motto, skill_shooting, skill_passing, skill_dribbling, skill_defending, skill_fitness, happy_in_goal, show_stats, instapay_phone` (a key left out is cleared).
- Produces (columns): `profiles` + the card columns, `happy_in_goal`, `show_stats`, `instapay_phone`, `onboarded_at`; `players` + `show_stats`, `instapay_phone`.

- [ ] **Step 1: The test stand-ins in `tests/db/helpers.ts`**

At the end of `SUPABASE_STUB` (inside the template string), add:

```sql
  -- Supabase Storage's tables, just enough for file 8's group-photo rules.
  create schema storage;
  grant usage on schema storage to anon, authenticated, service_role;
  create table storage.buckets (
    id text primary key,
    name text not null,
    public boolean not null default false,
    file_size_limit bigint,
    allowed_mime_types text[]
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets (id),
    name text not null,
    unique (bucket_id, name)
  );
  alter table storage.objects enable row level security;
  grant select, insert, update, delete on storage.objects to authenticated;
  -- "group/photo.jpg" -> {group}: every folder of a file's path, as in Supabase.
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
  $$;
  grant execute on function storage.foldername(text) to anon, authenticated, service_role;
  -- Supabase Realtime sends changes of the tables in this publication.
  create publication supabase_realtime;
```

If PGlite refuses `create publication` (run `npm test -- tests/db/seed.test.ts` to see), drop that line, keep the `do $$ … $$` guard in file 8 (Task 4), and leave out the Realtime test in Task 4 Step 1. Say so in the hand-over.

- [ ] **Step 2: `tests/db/card.test.ts` tests file 7 as written**

File 8 moves the card to the account and locks the card columns on `players`. This file tests file 7 itself, so it stops before file 8. Change the top:

```ts
// The player card (file 7, supabase/migrations/20261025000300_player_card.sql)
// and the rating settings admins now change in the app (no database change).
// It runs files 1 to 7 only: file 8 moves the card onto the account
// (tests/db/accounts.test.ts).
```

```ts
const FILE_7 = '20261025000300_player_card.sql'
const FILE_8 = '20261026000100_accounts_groups_chat.sql'
```

```ts
beforeAll(async () => {
  db = await createDb({ before: FILE_8 })
})
```

and in the last card test (`players from before this file…`), run only file 7 after the old data:

```ts
    await runMigrations(old, (file) => file >= FILE_7 && file < FILE_8)
```

- [ ] **Step 3: `tests/db/games.test.ts`: "happy in goal" now comes from the account**

Replace the test `players say whether they are happy to play in goal; admins can set it for anyone` with:

```ts
  it('players say on their account whether they are happy in goal; nobody sets it on a player directly', async () => {
    const { groupId, users, pid } = await setupGroup(db)
    const happy = async (id: string) =>
      (await selectAs<{ happy_in_goal: boolean }>(db, users.admin, `select happy_in_goal from players where id = $1`, [id]))[0]
        .happy_in_goal
    await rpc(db, users.Omar, 'save_my_account', { p_account: { display_name: 'Omar', happy_in_goal: true } })
    expect(await happy(pid(users.Omar))).toBe(true)
    await expectError(
      selectAs(db, users.admin, `update players set happy_in_goal = true where id = $1`, [pid(users.Ziad)]),
      /permission denied/,
    )
    await expectError(
      selectAs(db, users.Omar, `update players set group_id = $1 where id = $2`, [groupId, pid(users.Omar)]),
      /permission denied/,
    )
  })
```

- [ ] **Step 4: Write the failing tests: `tests/db/accounts.test.ts`**

```ts
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
```

- [ ] **Step 5: Run them to see them fail**

Run: `npx vitest run tests/db/accounts.test.ts`
Expected: FAIL (`function public.my_account() does not exist`; the file isn't there yet).

- [ ] **Step 6: Write file 8's header and section 1**

Create `supabase/migrations/20261026000100_accounts_groups_chat.sql`:

```sql
-- =============================================================================
-- 7GZ-KORA: accounts, groups and chat (file 8 of 8)
--
-- Plans/Accounts-groups-and-chat.md:
--   1. The player card moves onto the account (profiles), filled in once.
--      Each group's player keeps a copy, written by the database whenever
--      the account changes, so everything that reads players keeps working.
--      With "Show my stats" off, the copy has no skills.
--   2. Groups get a photo (Supabase Storage) and a Public / Private switch.
--      Anyone signed in can find public groups and join with one tap, and
--      search players by name to open their account page.
--   3. Every group gets a text chat (live, through Supabase Realtime).
--   4. Nights get a Google Maps link and the pitch's map position.
--
-- Files 1 to 7 already run on the live project, so this file only adds to
-- them. Run it once, in the SQL Editor. It can run at any time, even during
-- a night. compute_match_ratings and the money functions are not touched.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. The account
-- -----------------------------------------------------------------------------

-- The card from file 7 (same rules), "happy in goal" from file 5, and three new things.
alter table public.profiles
  add column shirt_number smallint
    constraint profiles_shirt_number_check check (shirt_number between 1 and 99),
  add column strong_foot text
    constraint profiles_strong_foot_check check (strong_foot in ('right', 'left', 'both')),
  add column favourite_position text
    constraint profiles_favourite_position_check
      check (favourite_position in ('goal', 'defence', 'midfield', 'attack', 'anywhere')),
  add column motto text
    constraint profiles_motto_check check (char_length(motto) between 1 and 60),
  add column skill_shooting smallint
    constraint profiles_skill_shooting_check check (skill_shooting between 1 and 10),
  add column skill_passing smallint
    constraint profiles_skill_passing_check check (skill_passing between 1 and 10),
  add column skill_dribbling smallint
    constraint profiles_skill_dribbling_check check (skill_dribbling between 1 and 10),
  add column skill_defending smallint
    constraint profiles_skill_defending_check check (skill_defending between 1 and 10),
  add column skill_fitness smallint
    constraint profiles_skill_fitness_check check (skill_fitness between 1 and 10),
  add constraint profiles_skills_all_or_none check (
    num_nulls(skill_shooting, skill_passing, skill_dribbling, skill_defending, skill_fitness) in (0, 5)
  ),
  add column happy_in_goal boolean not null default false,
  -- Off: nobody else sees the five skills or the self-rating.
  add column show_stats boolean not null default true,
  -- Where people pay this player by InstaPay when they collect: an Egyptian mobile number.
  add column instapay_phone text
    constraint profiles_instapay_phone_check check (instapay_phone ~ '^01[0125][0-9]{8}$'),
  -- Set once the sign-up questions are done (even if every one was skipped).
  add column onboarded_at timestamptz;

-- The group copy carries the switch and the number too (the card columns are there since file 7).
alter table public.players
  add column show_stats boolean not null default true,
  add column instapay_phone text
    constraint players_instapay_phone_check check (instapay_phone ~ '^01[0125][0-9]{8}$');

-- Writes an account's card onto all its players (one per group). The skills
-- only when the account shows its stats, so a hidden self-rating never
-- reaches anyone else's phone.
create function public.copy_card_to_players(p_user_id uuid)
returns void
language sql security definer set search_path = ''
as $$
  update public.players p
  set shirt_number       = a.shirt_number,
      strong_foot        = a.strong_foot,
      favourite_position = a.favourite_position,
      motto              = a.motto,
      skill_shooting     = case when a.show_stats then a.skill_shooting end,
      skill_passing      = case when a.show_stats then a.skill_passing end,
      skill_dribbling    = case when a.show_stats then a.skill_dribbling end,
      skill_defending    = case when a.show_stats then a.skill_defending end,
      skill_fitness      = case when a.show_stats then a.skill_fitness end,
      happy_in_goal      = a.happy_in_goal,
      show_stats         = a.show_stats,
      instapay_phone     = a.instapay_phone
  from public.profiles a
  where a.id = p_user_id and p.user_id = a.id;
$$;

create function public.profiles_copy_card()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.copy_card_to_players(new.id);
  return null;
end;
$$;

create trigger profiles_copy_card
  after update of shirt_number, strong_foot, favourite_position, motto,
                  skill_shooting, skill_passing, skill_dribbling, skill_defending, skill_fitness,
                  happy_in_goal, show_stats, instapay_phone
  on public.profiles
  for each row execute function public.profiles_copy_card();

-- A new player (joining or creating a group) starts with the account's card.
create function public.players_take_card()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_account public.profiles;
begin
  if new.user_id is null then
    return new;
  end if;
  select * into v_account from public.profiles where id = new.user_id;
  if found then
    new.shirt_number       := v_account.shirt_number;
    new.strong_foot        := v_account.strong_foot;
    new.favourite_position := v_account.favourite_position;
    new.motto              := v_account.motto;
    new.skill_shooting     := case when v_account.show_stats then v_account.skill_shooting end;
    new.skill_passing      := case when v_account.show_stats then v_account.skill_passing end;
    new.skill_dribbling    := case when v_account.show_stats then v_account.skill_dribbling end;
    new.skill_defending    := case when v_account.show_stats then v_account.skill_defending end;
    new.skill_fitness      := case when v_account.show_stats then v_account.skill_fitness end;
    new.happy_in_goal      := v_account.happy_in_goal;
    new.show_stats         := v_account.show_stats;
    new.instapay_phone     := v_account.instapay_phone;
  end if;
  return new;
end;
$$;

create trigger players_take_card
  before insert on public.players
  for each row execute function public.players_take_card();

-- Cards that already exist: each account takes its most complete one (the
-- most filled-in fields; if two are equal, the newer player), "happy in
-- goal" if it was on in any group, and counts as signed up when it has a
-- card. The trigger above then copies it to every group.
update public.profiles a
set shirt_number       = best.shirt_number,
    strong_foot        = best.strong_foot,
    favourite_position = best.favourite_position,
    motto              = best.motto,
    skill_shooting     = best.skill_shooting,
    skill_passing      = best.skill_passing,
    skill_dribbling    = best.skill_dribbling,
    skill_defending    = best.skill_defending,
    skill_fitness      = best.skill_fitness,
    happy_in_goal      = best.any_goal,
    onboarded_at       = case when best.filled > 0 then now() end
from (
  select distinct on (p.user_id)
         p.user_id, p.shirt_number, p.strong_foot, p.favourite_position, p.motto,
         p.skill_shooting, p.skill_passing, p.skill_dribbling, p.skill_defending, p.skill_fitness,
         bool_or(p.happy_in_goal) over (partition by p.user_id) as any_goal,
         num_nonnulls(p.shirt_number, p.strong_foot, p.favourite_position, p.motto, p.skill_shooting,
                      p.skill_passing, p.skill_dribbling, p.skill_defending, p.skill_fitness) as filled
  from public.players p
  where p.user_id is not null
  order by p.user_id, filled desc, p.created_at desc
) best
where a.id = best.user_id;

-- Players change their card on their account only (save_my_account); the
-- copies are written by the database. Renaming yourself in a group stays
-- allowed (file 3). On profiles the new columns are private (read through
-- my_account and get_account); the old ones stay readable as before.
revoke update (shirt_number, strong_foot, favourite_position, motto,
               skill_shooting, skill_passing, skill_dribbling, skill_defending, skill_fitness,
               happy_in_goal)
  on public.players from authenticated;
revoke select on public.profiles from authenticated;
grant select (id, email, display_name, avatar_url, created_at) on public.profiles to authenticated;

-- Your own account, the private columns included.
create function public.my_account()
returns public.profiles
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_account public.profiles;
begin
  select * into v_account from public.profiles where id = public.require_user();
  return v_account;
end;
$$;

-- Saves your account: the name, the card, "happy in goal", Show my stats and
-- the InstaPay number, all at once (a field left out is cleared). The group
-- copies follow (profiles_copy_card). Your name inside each group stays.
-- p_account: {"display_name": "Omar", "shirt_number": 10, "strong_foot": "left",
--             "favourite_position": "attack", "motto": "Pass it to me",
--             "skill_shooting": 8, "skill_passing": 7, "skill_dribbling": 8,
--             "skill_defending": 6, "skill_fitness": 9, "happy_in_goal": false,
--             "show_stats": true, "instapay_phone": "01012345678"}
create function public.save_my_account(p_account jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_user  uuid := public.require_user();
  v       jsonb := coalesce(p_account, '{}'::jsonb);
  v_phone text := nullif(regexp_replace(coalesce(v ->> 'instapay_phone', ''), '\s', '', 'g'), '');
begin
  if v_phone is not null and v_phone !~ '^01[0125][0-9]{8}$' then
    raise exception 'That InstaPay number doesn''t look right. Use an Egyptian mobile number, like 010 1234 5678.';
  end if;
  if num_nulls(v ->> 'skill_shooting', v ->> 'skill_passing', v ->> 'skill_dribbling',
               v ->> 'skill_defending', v ->> 'skill_fitness') not in (0, 5) then
    raise exception 'Rate all five skills, or none.';
  end if;

  update public.profiles
  set display_name       = public.clean_name(v ->> 'display_name'),
      shirt_number       = (v ->> 'shirt_number')::smallint,
      strong_foot        = v ->> 'strong_foot',
      favourite_position = v ->> 'favourite_position',
      motto              = nullif(trim(v ->> 'motto'), ''),
      skill_shooting     = (v ->> 'skill_shooting')::smallint,
      skill_passing      = (v ->> 'skill_passing')::smallint,
      skill_dribbling    = (v ->> 'skill_dribbling')::smallint,
      skill_defending    = (v ->> 'skill_defending')::smallint,
      skill_fitness      = (v ->> 'skill_fitness')::smallint,
      happy_in_goal      = coalesce((v ->> 'happy_in_goal')::boolean, false),
      show_stats         = coalesce((v ->> 'show_stats')::boolean, true),
      instapay_phone     = v_phone
  where id = v_user;
end;
$$;

-- The end of the sign-up questions: saves the answers and marks you as signed up.
create function public.finish_sign_up(p_account jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.save_my_account(p_account);
  update public.profiles set onboarded_at = coalesce(onboarded_at, now()) where id = auth.uid();
end;
$$;

-- Find: accounts whose name contains the text (2 or more characters), at
-- most 20. Never an email or phone number.
create function public.search_accounts(p_query text)
returns table (user_id uuid, display_name text, avatar_url text, shirt_number smallint, favourite_position text)
language sql stable security definer set search_path = ''
as $$
  select a.id, a.display_name, a.avatar_url, a.shirt_number, a.favourite_position
  from public.profiles a
  where auth.uid() is not null
    and char_length(trim(coalesce(p_query, ''))) >= 2
    and a.display_name ilike
        '%' || replace(replace(replace(trim(p_query), '\', '\\'), '%', '\%'), '_', '\_') || '%'
  order by a.display_name
  limit 20;
$$;

revoke execute on function
  public.copy_card_to_players(uuid),
  public.profiles_copy_card(),
  public.players_take_card(),
  public.my_account(),
  public.save_my_account(jsonb),
  public.finish_sign_up(jsonb),
  public.search_accounts(text)
from public, anon, authenticated;

grant execute on function
  public.my_account(),
  public.save_my_account(jsonb),
  public.finish_sign_up(jsonb),
  public.search_accounts(text)
to authenticated;
```

- [ ] **Step 7: Run the tests**

Run: `npx vitest run tests/db/accounts.test.ts tests/db/card.test.ts tests/db/games.test.ts`
Expected: PASS. Then `npm test`: everything passes (the storage stand-in and the publication don't disturb other files). If the data-move test fails on `order by … filled desc`, replace `filled desc` there with the same `num_nonnulls(…)` expression.

---

### Task 3: Groups: photo, Public, Find and account pages (file 8, section 2)

**Files:**
- Modify: `supabase/migrations/20261026000100_accounts_groups_chat.sql` (append section 2)
- Test: `tests/db/groups.test.ts`

**Interfaces:**
- Produces (columns): `groups.image_path text null` (`'<group id>/<file>'`), `groups.is_public boolean default false`, admins may `update` both.
- Produces (storage): bucket `group-images` (public, 1 MB, JPEG/PNG/WebP); only the group's admins `select/insert/update/delete` objects in the folder named after the group id.
- Produces (SQL): `is_group_admin_folder(p_name text) returns boolean`; `get_account(p_user_id uuid) returns jsonb` (keys in Task 2's Interfaces); `list_public_groups() returns table (id uuid, name text, image_path text, members bigint, i_am_in boolean, next_night_day date, next_night_at timestamptz, next_night_location text)`; `join_public_group(p_group_id uuid, p_display_name text default null) returns uuid`.
- Errors (exact): `This group is private. Ask for an invite code.` · `An admin removed you from this group. Ask them for an invite code.` · `Player not found.`

- [ ] **Step 1: Write the failing tests: `tests/db/groups.test.ts`**

```ts
// Groups (file 8 section 2): the photo and its storage rules, Public /
// Private, the Find list, one-tap joining and account pages.
import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { createDb, createUser, MatchBuilder, nightDetails, rpc, selectAs, setupGroup } from './helpers'

let db: PGlite

beforeAll(async () => {
  db = await createDb()
})

afterAll(async () => {
  await db.close()
})

async function makePublic(admin: string, groupId: string) {
  await selectAs(db, admin, `update groups set is_public = true where id = $1`, [groupId])
}

const listed = async (user: string) => rpc<Record<string, unknown>>(db, user, 'list_public_groups')

it('admins make a group public and give it a photo; a member trying to changes nothing', async () => {
  const { groupId, users } = await setupGroup(db)
  await selectAs(db, users.Omar, `update groups set is_public = true, image_path = $2 where id = $1`, [groupId, `${groupId}/a.jpg`])
  const read = async () =>
    (await selectAs<{ is_public: boolean; image_path: string | null }>(
      db, users.Omar, `select is_public, image_path from groups where id = $1`, [groupId],
    ))[0]
  expect(await read()).toEqual({ is_public: false, image_path: null })

  await selectAs(db, users.admin, `update groups set is_public = true, image_path = $2 where id = $1`, [groupId, `${groupId}/a.jpg`])
  expect(await read()).toEqual({ is_public: true, image_path: `${groupId}/a.jpg` })
})

it("the photo must sit in the group's own folder", async () => {
  const { groupId, users } = await setupGroup(db)
  for (const path of ['someone-else/a.jpg', `${groupId}/../a.jpg`, `${groupId}/a b.jpg`]) {
    await expect(
      selectAs(db, users.admin, `update groups set image_path = $2 where id = $1`, [groupId, path]),
    ).rejects.toThrow(/groups_image_path_check/)
  }
})

it("storage: only the group's admins add photos to its folder", async () => {
  const { groupId, users } = await setupGroup(db)
  const other = await setupGroup(db)
  const add = (user: string, name: string) =>
    selectAs(db, user, `insert into storage.objects (bucket_id, name) values ('group-images', $1)`, [name])

  await add(users.admin, `${groupId}/photo.jpg`)
  await expect(add(users.Omar, `${groupId}/member.jpg`)).rejects.toThrow(/row-level security/)
  await expect(add(other.users.admin, `${groupId}/other-admin.jpg`)).rejects.toThrow(/row-level security/)
  await expect(add(users.admin, 'no-folder.jpg')).rejects.toThrow(/row-level security/)

  const [bucket] = (await db.query<{ public: boolean; file_size_limit: string }>(
    `select public, file_size_limit::text from storage.buckets where id = 'group-images'`,
  )).rows
  expect(bucket).toEqual({ public: true, file_size_limit: '1048576' })
})

it('Find lists public groups only, with members and the next planned night', async () => {
  const { groupId, users } = await setupGroup(db)
  const hidden = await setupGroup(db)
  await makePublic(users.admin, groupId)
  await rpc(db, users.admin, 'plan_night', { p_group_id: groupId, p_night: nightDetails({ played_at: '2099-01-01', starts_at: '2099-01-01T18:00:00Z' }) })
  const stranger = await createUser(db, 'Stranger')

  const rows = await listed(stranger)
  const mine = rows.find((r) => r.id === groupId)
  expect(mine).toMatchObject({ name: 'Thursday Football', i_am_in: false, next_night_location: 'Club pitch 3' })
  // PGlite may hand back a bigint and a date as other JS types than PostgREST does.
  expect(Number(mine?.members)).toBe(4)
  expect(new Date(String(mine?.next_night_day)).getUTCFullYear()).toBe(2099)
  expect(rows.some((r) => r.id === hidden.groupId)).toBe(false)
  expect((await listed(users.Omar)).find((r) => r.id === groupId)?.i_am_in).toBe(true)
})

it('one tap joins a public group with the account name and card; a private group refuses', async () => {
  const { groupId, users } = await setupGroup(db)
  const closed = await setupGroup(db)
  await makePublic(users.admin, groupId)
  const karim = await createUser(db, 'Karim')
  await rpc(db, karim, 'save_my_account', { p_account: { display_name: 'Karim', shirt_number: 9 } })

  await rpc(db, karim, 'join_public_group', { p_group_id: groupId })
  const [player] = await selectAs<{ display_name: string; shirt_number: number }>(
    db, users.admin, `select display_name, shirt_number from players where group_id = $1 and user_id = $2`, [groupId, karim],
  )
  expect(player).toEqual({ display_name: 'Karim', shirt_number: 9 })

  await expect(rpc(db, karim, 'join_public_group', { p_group_id: closed.groupId })).rejects.toThrow(
    'This group is private. Ask for an invite code.',
  )
})

it('removed by an admin: one tap is refused. Left on your own: it works, with your old player back', async () => {
  const { groupId, users, pid } = await setupGroup(db)
  await makePublic(users.admin, groupId)

  await rpc(db, users.admin, 'remove_member', { p_group_id: groupId, p_user_id: users.Omar })
  await expect(rpc(db, users.Omar, 'join_public_group', { p_group_id: groupId })).rejects.toThrow(
    'An admin removed you from this group. Ask them for an invite code.',
  )

  await rpc(db, users.Ziad, 'remove_member', { p_group_id: groupId, p_user_id: users.Ziad })
  await rpc(db, users.Ziad, 'join_public_group', { p_group_id: groupId, p_display_name: 'Ziad' })
  const [member] = await selectAs<{ player_id: string }>(
    db, users.admin, `select player_id from group_members where group_id = $1 and user_id = $2`, [groupId, users.Ziad],
  )
  expect(member.player_id).toBe(pid(users.Ziad))
})

it('an account page: card, totals across groups, public and shared groups; never email or phone', async () => {
  const { groupId, users } = await setupGroup(db)
  const open = await setupGroup(db, ['Omar2'])
  await makePublic(open.users.admin, open.groupId)
  await rpc(db, users.Omar, 'join_public_group', { p_group_id: open.groupId })
  await rpc(db, users.Omar, 'save_my_account', {
    p_account: { display_name: 'Omar', shirt_number: 10, skill_shooting: 8, skill_passing: 7, skill_dribbling: 8,
                 skill_defending: 6, skill_fitness: 9, instapay_phone: '01012345678' },
  })

  // One rated night in a third group, with one goal that counts and one disputed, and the MOTM award.
  const b = await MatchBuilder.create(db, ['Omar', 'Ziad'])
  await db.query(`update players set user_id = $1 where id = $2`, [users.Omar, b.id('Omar')])
  await b.match({ A: ['Omar'], B: ['Ziad'] })
  await b.goal('Omar')
  await b.goal('Omar', null, { disputed: true })
  await b.mvp('Ziad', 'Omar')
  await b.compute()
  await db.query(`update matches set status = 'closed' where id = $1`, [b.matchId])

  const stranger = await createUser(db, 'Stranger')
  const [{ get_account: page }] = await rpc<{ get_account: Record<string, unknown> }>(db, stranger, 'get_account', {
    p_user_id: users.Omar,
  })
  expect(page).toMatchObject({ display_name: 'Omar', shirt_number: 10, skill_shooting: 8, nights: 1, goals: 1, mvps: 1 })
  expect(page).not.toHaveProperty('email')
  expect(page).not.toHaveProperty('instapay_phone')
  // The stranger sees only the public group; a group mate sees Thursday Football too, with Omar's player.
  expect((page.groups as { id: string }[]).map((g) => g.id)).toEqual([open.groupId])
  const [{ get_account: seenByZiad }] = await rpc<{ get_account: { groups: Record<string, unknown>[] } }>(
    db, users.Ziad, 'get_account', { p_user_id: users.Omar },
  )
  expect(seenByZiad.groups.find((g) => g.id === groupId)).toMatchObject({ i_am_in: true, is_public: false })
  expect(seenByZiad.groups.find((g) => g.id === groupId)?.player_id).toBeTruthy()

  // Hidden stats: no skills for others; the owner still sees them.
  await rpc(db, users.Omar, 'save_my_account', {
    p_account: { display_name: 'Omar', skill_shooting: 8, skill_passing: 7, skill_dribbling: 8, skill_defending: 6,
                 skill_fitness: 9, show_stats: false },
  })
  const [{ get_account: hidden }] = await rpc<{ get_account: Record<string, unknown> }>(db, stranger, 'get_account', { p_user_id: users.Omar })
  expect(hidden).toMatchObject({ show_stats: false, skill_shooting: null, skill_fitness: null })
  const [{ get_account: own }] = await rpc<{ get_account: Record<string, unknown> }>(db, users.Omar, 'get_account', { p_user_id: users.Omar })
  expect(own).toMatchObject({ skill_shooting: 8 })
})

it('signed-out visitors can call none of it', async () => {
  await db.exec('set role anon')
  try {
    for (const call of ['list_public_groups()', `join_public_group(gen_random_uuid())`, `get_account(gen_random_uuid())`]) {
      await expect(db.query(`select * from public.${call}`)).rejects.toThrow(/permission denied/)
    }
  } finally {
    await db.exec('reset role')
  }
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/db/groups.test.ts`
Expected: FAIL (`column "is_public" does not exist`).

- [ ] **Step 3: Append section 2 to file 8**

```sql


-- -----------------------------------------------------------------------------
-- 2. Groups: photo, Public / Private, Find and account pages
-- -----------------------------------------------------------------------------
alter table public.groups
  -- The group photo, in its own folder of the "group-images" bucket.
  add column image_path text,
  -- Public: anyone signed in can find it in Find and join with one tap.
  add column is_public boolean not null default false,
  add constraint groups_image_path_check check (image_path ~ ('^' || id::text || '/[A-Za-z0-9._-]{1,100}$'));

-- Admins change both straight on the table, under "admins rename their groups" (file 1).
grant update (image_path, is_public) on public.groups to authenticated;

-- The bucket: anyone with a photo's address can see it (the Find list needs
-- that); only the group's admins add, replace or delete its photos.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('group-images', 'group-images', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- True when the file's folder is a group you're an admin of.
create function public.is_group_admin_folder(p_name text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.group_members gm
    where gm.group_id::text = (storage.foldername(p_name))[1]
      and gm.user_id = auth.uid() and gm.role = 'admin'
  );
$$;

create policy "group admins see their group's photo files" on storage.objects
  for select to authenticated
  using (bucket_id = 'group-images' and public.is_group_admin_folder(name));
create policy "group admins add group photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'group-images' and public.is_group_admin_folder(name));
create policy "group admins replace group photos" on storage.objects
  for update to authenticated
  using (bucket_id = 'group-images' and public.is_group_admin_folder(name))
  with check (bucket_id = 'group-images' and public.is_group_admin_folder(name));
create policy "group admins delete group photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'group-images' and public.is_group_admin_folder(name));

-- Someone's account page: the card (the skills only if they show their
-- stats, or it's you), totals across all their groups, and their groups you
-- may see: the public ones and the ones you share. Never email or phone.
create function public.get_account(p_user_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_me      uuid := public.require_user();
  v_account public.profiles;
  v_show    boolean;
begin
  select * into v_account from public.profiles where id = p_user_id;
  if not found then
    raise exception 'Player not found.';
  end if;
  v_show := v_account.show_stats or v_account.id = v_me;

  return jsonb_build_object(
    'user_id', v_account.id,
    'display_name', v_account.display_name,
    'avatar_url', v_account.avatar_url,
    'shirt_number', v_account.shirt_number,
    'strong_foot', v_account.strong_foot,
    'favourite_position', v_account.favourite_position,
    'motto', v_account.motto,
    'happy_in_goal', v_account.happy_in_goal,
    'show_stats', v_account.show_stats,
    'skill_shooting', case when v_show then v_account.skill_shooting end,
    'skill_passing', case when v_show then v_account.skill_passing end,
    'skill_dribbling', case when v_show then v_account.skill_dribbling end,
    'skill_defending', case when v_show then v_account.skill_defending end,
    'skill_fitness', case when v_show then v_account.skill_fitness end,
    -- Rated nights (voting closed), the goals in them that count, and Man of the Match awards.
    'nights', (select count(*) from public.match_players mp
               join public.players p on p.id = mp.player_id
               join public.matches m on m.id = mp.match_id
               where p.user_id = v_account.id and m.status = 'closed'),
    'goals', (select count(*) from public.goals g
              join public.players p on p.id = g.scorer_id
              join public.matches m on m.id = g.match_id
              where p.user_id = v_account.id and m.status = 'closed' and not g.disputed),
    'mvps', (select count(*) from public.match_ratings mr
             join public.players p on p.id = mr.player_id
             join public.matches m on m.id = mr.match_id
             where p.user_id = v_account.id and m.status = 'closed' and mr.is_mvp),
    'groups', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', g.id,
               'name', g.name,
               'image_path', g.image_path,
               'is_public', g.is_public,
               'i_am_in', public.is_group_member(g.id),
               'player_id', case when public.is_group_member(g.id) then gm.player_id end
             ) order by g.name)
      from public.group_members gm
      join public.groups g on g.id = gm.group_id
      where gm.user_id = v_account.id and (g.is_public or public.is_group_member(g.id))
    ), '[]'::jsonb)
  );
end;
$$;

-- Find: every public group, most members first, with the next planned night.
create function public.list_public_groups()
returns table (id uuid, name text, image_path text, members bigint, i_am_in boolean,
               next_night_day date, next_night_at timestamptz, next_night_location text)
language sql stable security definer set search_path = ''
as $$
  select g.id, g.name, g.image_path,
         (select count(*) from public.group_members gm where gm.group_id = g.id),
         public.is_group_member(g.id),
         n.played_at, n.starts_at, n.location
  from public.groups g
  left join lateral (
    select m.played_at, m.starts_at, m.location
    from public.matches m
    where m.group_id = g.id and m.status = 'draft' and m.played_at >= current_date
    order by m.played_at, m.starts_at
    limit 1
  ) n on true
  where g.is_public and auth.uid() is not null
  order by 4 desc, g.name;
$$;

-- One-tap join for public groups. Uses the account name unless another is
-- given. Someone an admin removed needs an invite code (join_group, file 3).
-- Rejoining keeps your old player and stats, as with a code.
create function public.join_public_group(p_group_id uuid, p_display_name text default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_user   uuid := public.require_user();
  v_player uuid;
  v_role   text;
begin
  if not exists (select 1 from public.groups g where g.id = p_group_id and g.is_public) then
    raise exception 'This group is private. Ask for an invite code.';
  end if;
  if exists (select 1 from public.group_members gm where gm.group_id = p_group_id and gm.user_id = v_user) then
    return p_group_id; -- already a member
  end if;
  -- The last time you left this group: was it an admin who removed you?
  if (select l.actor_id is distinct from v_user
      from public.audit_log l
      where l.group_id = p_group_id and l.action = 'member_removed' and l.details ->> 'user_id' = v_user::text
      order by l.created_at desc
      limit 1) then
    raise exception 'An admin removed you from this group. Ask them for an invite code.';
  end if;

  select p.id into v_player from public.players p where p.group_id = p_group_id and p.user_id = v_user;
  if v_player is null then
    insert into public.players (group_id, user_id, display_name)
    values (p_group_id, v_user, public.clean_name(coalesce(
      nullif(trim(p_display_name), ''),
      (select a.display_name from public.profiles a where a.id = v_user)
    )))
    returning id into v_player;
  end if;

  v_role := case
    when exists (select 1 from public.group_members gm where gm.group_id = p_group_id and gm.role = 'admin')
    then 'member' else 'admin'
  end;
  insert into public.group_members (group_id, user_id, player_id, role)
  values (p_group_id, v_user, v_player, v_role);

  insert into public.rating_config (group_id) values (p_group_id) on conflict do nothing;
  perform public.write_audit(p_group_id, 'member_joined',
    jsonb_build_object('player_id', v_player, 'role', v_role, 'public', true));
  return p_group_id;
end;
$$;

revoke execute on function
  public.is_group_admin_folder(text),
  public.get_account(uuid),
  public.list_public_groups(),
  public.join_public_group(uuid, text)
from public, anon, authenticated;

grant execute on function
  -- used inside the storage rules
  public.is_group_admin_folder(text),
  -- app actions
  public.get_account(uuid),
  public.list_public_groups(),
  public.join_public_group(uuid, text)
to authenticated;
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/db/groups.test.ts tests/db/accounts.test.ts`
Expected: PASS. (Remove-member writes `member_removed` with the actor, file 3, which the one-tap rule reads.)

---

### Task 4: Chat (file 8, section 3)

**Files:**
- Modify: `supabase/migrations/20261026000100_accounts_groups_chat.sql` (append section 3)
- Test: `tests/db/chat.test.ts`

**Interfaces:**
- Produces (table): `group_messages (id uuid, group_id uuid, player_id uuid, user_id uuid null, body text null, created_at timestamptz, deleted_at timestamptz null)`; members `select`; in the `supabase_realtime` publication.
- Produces (SQL): `send_message(p_group_id uuid, p_body text) returns uuid`; `delete_message(p_message_id uuid) returns void`.
- Errors (exact): `Type a message first.` · `Messages can be up to 500 characters.` · `Message not found.` · (file 3's) `You are not a member of this group.` · `Only group admins can do this.`

- [ ] **Step 1: Write the failing tests: `tests/db/chat.test.ts`**

```ts
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
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/db/chat.test.ts`
Expected: FAIL (`function public.send_message(...) does not exist`).

- [ ] **Step 3: Append section 3 to file 8**

```sql


-- -----------------------------------------------------------------------------
-- 3. The group chat
-- -----------------------------------------------------------------------------
create table public.group_messages (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups (id) on delete cascade,
  -- The author's player in this group (their name and photo there).
  player_id  uuid not null references public.players (id) on delete cascade,
  user_id    uuid references public.profiles (id) on delete set null,
  -- Text only, 1 to 500 characters. Deleting blanks it (deleted_at is set).
  body       text check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint group_messages_deleted_check check ((deleted_at is null) = (body is not null))
);

create index group_messages_group_idx on public.group_messages (group_id, created_at desc);

alter table public.group_messages enable row level security;
create policy "members read their group's chat" on public.group_messages
  for select to authenticated using (public.is_group_member(group_id));

-- Read by members (RLS above); written only through the functions below.
revoke all on public.group_messages from anon, authenticated;
grant select on public.group_messages to authenticated;
grant all on public.group_messages to service_role;

-- New and deleted messages reach open apps straight away (Supabase Realtime).
-- Every Supabase project has this publication; the check keeps other
-- databases (the tests' stand-in) working without it.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.group_messages;
  end if;
end;
$$;

create function public.send_message(p_group_id uuid, p_body text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_player uuid := public.require_member(p_group_id);
  v_body   text := regexp_replace(coalesce(p_body, ''), '^\s+|\s+$', '', 'g');
  v_id     uuid;
begin
  if v_body = '' then
    raise exception 'Type a message first.';
  end if;
  if char_length(v_body) > 500 then
    raise exception 'Messages can be up to 500 characters.';
  end if;
  insert into public.group_messages (group_id, player_id, user_id, body)
  values (p_group_id, v_player, auth.uid(), v_body)
  returning id into v_id;
  return v_id;
end;
$$;

-- Your own messages, or anyone's if you're an admin (that one goes in the
-- change history). The text is removed; "Message deleted" stays in its place.
create function public.delete_message(p_message_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_message public.group_messages;
  v_me      uuid;
begin
  select * into v_message from public.group_messages where id = p_message_id;
  if not found or not public.is_group_member(v_message.group_id) then
    raise exception 'Message not found.';
  end if;
  v_me := public.require_member(v_message.group_id);
  if v_message.player_id <> v_me then
    perform public.require_admin(v_message.group_id);
    perform public.write_audit(v_message.group_id, 'message_deleted',
      jsonb_build_object('player_id', v_message.player_id));
  end if;
  update public.group_messages set body = null, deleted_at = now()
  where id = p_message_id and deleted_at is null;
end;
$$;

revoke execute on function
  public.send_message(uuid, text),
  public.delete_message(uuid)
from public, anon, authenticated;

grant execute on function
  public.send_message(uuid, text),
  public.delete_message(uuid)
to authenticated;
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/db/chat.test.ts`
Expected: PASS.

---

### Task 5: The pitch link (file 8, section 4)

**Files:**
- Modify: `supabase/migrations/20261026000100_accounts_groups_chat.sql` (append section 4)
- Test: `tests/db/pitch.test.ts`

**Interfaces:**
- Produces (columns): `matches.pitch_url text null` (https, ≤ 500), `matches.pitch_lat double precision null`, `matches.pitch_lng double precision null` (both or neither, in range, only with a link).
- Produces: `plan_night` / `update_night` read `pitch_url`, `pitch_lat`, `pitch_lng` from `p_night` (through the replaced `write_night_details`). A position without a link is dropped.
- Errors (exact): `Paste a Google Maps link.` · `That map position is not valid.`

- [ ] **Step 1: Write the failing tests: `tests/db/pitch.test.ts`**

```ts
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
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/db/pitch.test.ts`
Expected: FAIL (`column "pitch_url" does not exist`).

- [ ] **Step 3: Append section 4 to file 8**

The new `write_night_details` is file 4's (`20261024000100_nights.sql`) with the pitch added: every existing check and column stays exactly as it was.

```sql


-- -----------------------------------------------------------------------------
-- 4. The pitch: a Google Maps link and its map position
-- -----------------------------------------------------------------------------
alter table public.matches
  add column pitch_url text
    constraint matches_pitch_url_check check (char_length(pitch_url) <= 500 and pitch_url ~ '^https://'),
  add column pitch_lat double precision
    constraint matches_pitch_lat_check check (pitch_lat between -90 and 90),
  add column pitch_lng double precision
    constraint matches_pitch_lng_check check (pitch_lng between -180 and 180),
  -- Both or neither, and only with a link.
  add constraint matches_pitch_position_check
    check ((pitch_lat is null) = (pitch_lng is null) and (pitch_lat is null or pitch_url is not null));

-- File 4's write_night_details, now also with the pitch link:
-- p_night also takes "pitch_url": "https://maps.app.goo.gl/...", "pitch_lat": 30.0444, "pitch_lng": 31.2357
-- (the app finds the position in the link; null when it can't).
create or replace function public.write_night_details(p_match_id uuid, p_group_id uuid, p_night jsonb)
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
  v_url       text := nullif(trim(v_night ->> 'pitch_url'), '');
  v_lat       double precision := (v_night ->> 'pitch_lat')::double precision;
  v_lng       double precision := (v_night ->> 'pitch_lng')::double precision;
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
  if v_url is not null and (char_length(v_url) > 500 or v_url !~ '^https://') then
    raise exception 'Paste a Google Maps link.';
  end if;
  -- No link, no position.
  if v_url is null then
    v_lat := null;
    v_lng := null;
  end if;
  if (v_lat is null) <> (v_lng is null) or v_lat not between -90 and 90 or v_lng not between -180 and 180 then
    raise exception 'That map position is not valid.';
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
      player_cap          = v_cap,
      pitch_url           = v_url,
      pitch_lat           = v_lat,
      pitch_lng           = v_lng
  where id = p_match_id;
end;
$$;

-- write_night_details stays internal ("create or replace" keeps its
-- permissions from file 4). The service role keeps everything.
grant execute on all functions in schema public to service_role;
```

- [ ] **Step 4: Run all database tests**

Run: `npx vitest run tests/db`
Expected: PASS (the nights tests send no pitch keys, so their nights have none).

- [ ] **Step 5: Check nothing else moved**

```bash
git diff --stat -- supabase/migrations/2026102300* supabase/migrations/20261024000100_nights.sql \
  supabase/migrations/20261025000100_games.sql supabase/migrations/20261025000200_team_suggester.sql \
  supabase/migrations/20261025000300_player_card.sql   # nothing
grep -n "compute_match_ratings\|night_money\|night_payer_rows" supabase/migrations/20261026000100_accounts_groups_chat.sql  # only the header comment
```

---

## Part C — Accounts in the app

### Task 6: Account types, API, helpers and the account provider

**Files:**
- Create: `src/lib/signup.ts`, `src/lib/signup.test.ts`, `src/lib/phone.ts`, `src/lib/phone.test.ts`, `src/state/account.tsx`
- Modify: `src/lib/types.ts`, `src/lib/api.ts`, `src/lib/card.ts`, `src/lib/storage.ts`

**Interfaces:**
- Produces (types): `CardView`, `Account`, `AccountInput`, `AccountPage`, `AccountGroup`, `AccountHit`; `Group` + `image_path`, `is_public`; `Player` + `show_stats`, `instapay_phone`.
- Produces (api): `getMyAccount(): Promise<Account>`, `saveMyAccount(a: AccountInput)`, `finishSignUp(a: AccountInput)`, `getAccount(userId): Promise<AccountPage>`, `searchAccounts(q): Promise<AccountHit[]>`.
- Produces (lib): `NO_SKILLS: Skills`, `accountCard(a): CardView`, `accountInput(a: Account): AccountInput` (card.ts); `SIGN_UP_STEPS`, `SignUpStep`, `isSkillStep`, `skipStep(index, draft) → { index, draft }`, `startDraft(account, googleName)` (signup.ts); `checkPhone(typed) → { ok: true; phone: string | null } | { ok: false }`, `formatPhone(phone)` (phone.ts).
- Produces (state): `AccountProvider`, `useAccount() → { account, loading, error, refresh }`, `useMyAccount(): Account`.

- [ ] **Step 1: Types (`src/lib/types.ts`)**

`Group` gains two fields:

```ts
export interface Group {
  id: string
  name: string
  invite_code: string | null
  /** "Extra team from N players": the team suggester makes Team C from this many left over. */
  min_extra_team_size: number
  /** The group photo in Supabase Storage (the "group-images" bucket), or null. */
  image_path: string | null
  /** Public: anyone signed in can find it in Find and join with one tap. */
  is_public: boolean
}
```

`Player` gains two fields, after `happy_in_goal`:

```ts
  /** Off: this copy has no skills (Plans/Accounts-groups-and-chat.md section 1). */
  show_stats: boolean
  /** Where to pay this player by InstaPay when they collect: 11 digits, or null. */
  instapay_phone: string | null
```

After `Player`, add:

```ts
/** What the player card shows: a group's player, an account, or someone's account page. */
export interface CardView extends CardFields {
  display_name: string
  avatar_url: string | null
  happy_in_goal: boolean
  show_stats: boolean
}

/** Your own account (my_account): the card lives here and is copied to every group. */
export interface Account extends CardFields {
  id: string
  email: string | null
  display_name: string
  avatar_url: string | null
  happy_in_goal: boolean
  show_stats: boolean
  instapay_phone: string | null
  /** Set once the sign-up questions are done. */
  onboarded_at: string | null
  created_at: string
}

/** What save_my_account and finish_sign_up take: the whole account at once. */
export type AccountInput = CardFields &
  Pick<Account, 'display_name' | 'happy_in_goal' | 'show_stats' | 'instapay_phone'>

/** One of the groups on an account page. */
export interface AccountGroup {
  id: string
  name: string
  image_path: string | null
  is_public: boolean
  /** You're in it too. */
  i_am_in: boolean
  /** Their player in this group, when you're in it too (their stats there). */
  player_id: string | null
}

/** Someone's account page (get_account). The skills are null when they hide their stats (unless it's you). */
export interface AccountPage extends CardFields {
  user_id: string
  display_name: string
  avatar_url: string | null
  happy_in_goal: boolean
  show_stats: boolean
  /** Across all their groups: rated nights, goals that count, Man of the Match awards. */
  nights: number
  goals: number
  mvps: number
  groups: AccountGroup[]
}

/** A search result in Find. */
export interface AccountHit {
  user_id: string
  display_name: string
  avatar_url: string | null
  shirt_number: number | null
  favourite_position: Position | null
}
```

- [ ] **Step 2: Card helpers (`src/lib/card.ts`)**

Add `Account`, `AccountInput`, `CardView` to the type import, and:

```ts
/** No self-rating: the five skills cleared. */
export const NO_SKILLS: Skills = {
  skill_shooting: null,
  skill_passing: null,
  skill_dribbling: null,
  skill_defending: null,
  skill_fitness: null,
}

/** An account in the shape the player card shows. */
export function accountCard(a: CardView): CardView {
  return {
    display_name: a.display_name,
    avatar_url: a.avatar_url,
    shirt_number: a.shirt_number,
    strong_foot: a.strong_foot,
    favourite_position: a.favourite_position,
    motto: a.motto,
    skill_shooting: a.skill_shooting,
    skill_passing: a.skill_passing,
    skill_dribbling: a.skill_dribbling,
    skill_defending: a.skill_defending,
    skill_fitness: a.skill_fitness,
    happy_in_goal: a.happy_in_goal,
    show_stats: a.show_stats,
  }
}

/** Everything Edit my card saves, starting from the account. */
export function accountInput(a: Account): AccountInput {
  const { avatar_url: _avatar, ...card } = accountCard(a)
  return { ...card, instapay_phone: a.instapay_phone }
}
```

(`Account` has every `CardView` field, so `accountCard(account)` type-checks. If `noUnusedLocals` complains about `_avatar`, build the object field by field instead.)

In `src/components/card.tsx`, the card now takes any `CardView` (a group's player, an account, an account page): import `CardView` instead of `Player`, and type `PlayerCard`'s `player` prop and `SkillBars`' `player` as `CardView`. Nothing else changes yet ("Stats hidden" comes in Task 8).

- [ ] **Step 3: Write the failing helper tests**

`src/lib/signup.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { SIGN_UP_STEPS, skipStep, startDraft } from './signup'
import type { Account, AccountInput } from './types'

const draft: AccountInput = {
  display_name: 'Omar',
  shirt_number: 10,
  strong_foot: 'left',
  favourite_position: 'attack',
  motto: 'Hi',
  skill_shooting: 8,
  skill_passing: 7,
  skill_dribbling: null,
  skill_defending: null,
  skill_fitness: null,
  happy_in_goal: true,
  show_stats: true,
  instapay_phone: null,
}

const newAccount: Account = {
  id: 'u1', email: 'omar@example.com', display_name: '', avatar_url: null, created_at: '2026-10-26T10:00:00Z',
  shirt_number: null, strong_foot: null, favourite_position: null, motto: null,
  skill_shooting: null, skill_passing: null, skill_dribbling: null, skill_defending: null, skill_fitness: null,
  happy_in_goal: false, show_stats: true, instapay_phone: null, onboarded_at: null,
}

describe('the sign-up questions', () => {
  it('are 12, with the five skills one by one', () => {
    expect(SIGN_UP_STEPS).toEqual([
      'name', 'shirt', 'foot', 'position',
      'skill_shooting', 'skill_passing', 'skill_dribbling', 'skill_defending', 'skill_fitness',
      'goal', 'motto', 'card',
    ])
  })

  it('Skip clears the question and moves to the next', () => {
    expect(skipStep(1, draft)).toEqual({ index: 2, draft: { ...draft, shirt_number: null } })
    expect(skipStep(9, draft)).toEqual({ index: 10, draft: { ...draft, happy_in_goal: false } })
  })

  it('Skip on any skill skips all five and goes to "Happy in goal"', () => {
    const { index, draft: skipped } = skipStep(SIGN_UP_STEPS.indexOf('skill_passing'), draft)
    expect(SIGN_UP_STEPS[index]).toBe('goal')
    expect([skipped.skill_shooting, skipped.skill_passing, skipped.skill_fitness]).toEqual([null, null, null])
  })

  it('Skip on the name keeps the name', () => {
    expect(skipStep(0, draft)).toEqual({ index: 1, draft })
  })

  it('a new account starts with the Google name; a named one keeps its own', () => {
    expect(startDraft(newAccount, 'Omar Google').display_name).toBe('Omar Google')
    expect(startDraft({ ...newAccount, display_name: 'Omar' }, 'Omar Google').display_name).toBe('Omar')
    expect(startDraft(newAccount, 'x')).toMatchObject({ show_stats: true, happy_in_goal: false, shirt_number: null })
  })
})
```

`src/lib/phone.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { checkPhone, formatPhone } from './phone'

describe('the InstaPay number', () => {
  it('saves every way of typing an Egyptian mobile number as 11 digits', () => {
    for (const typed of ['01012345678', '+20 10 1234 5678', '0020 1012345678', '010-1234-5678', ' 010 1234 5678 ']) {
      expect(checkPhone(typed)).toEqual({ ok: true, phone: '01012345678' })
    }
    expect(checkPhone('01112345678')).toEqual({ ok: true, phone: '01112345678' })
    expect(checkPhone('01512345678')).toEqual({ ok: true, phone: '01512345678' })
  })

  it('empty means no number', () => {
    expect(checkPhone('')).toEqual({ ok: true, phone: null })
    expect(checkPhone('   ')).toEqual({ ok: true, phone: null })
  })

  it('refuses numbers that are too short or have no mobile prefix', () => {
    expect(checkPhone('0101234567')).toEqual({ ok: false })
    expect(checkPhone('01312345678')).toEqual({ ok: false })
    expect(checkPhone('hello')).toEqual({ ok: false })
  })

  it('shows it in three groups', () => {
    expect(formatPhone('01012345678')).toBe('010 1234 5678')
  })
})
```

Run: `npx vitest run src/lib/signup.test.ts src/lib/phone.test.ts`
Expected: FAIL (the modules don't exist).

- [ ] **Step 4: Write the helpers**

`src/lib/signup.ts`:

```ts
// The sign-up questions (Plans/Accounts-groups-and-chat.md section 2): one
// per screen, each with Skip. Pure functions, tested in signup.test.ts.
import { accountInput, NO_SKILLS, SKILLS } from './card'
import type { Account, AccountInput, Skills } from './types'

export type SignUpStep = 'name' | 'shirt' | 'foot' | 'position' | keyof Skills | 'goal' | 'motto' | 'card'

export const SIGN_UP_STEPS: SignUpStep[] = [
  'name',
  'shirt',
  'foot',
  'position',
  ...SKILLS.map((s) => s.key),
  'goal',
  'motto',
  'card',
]

export const isSkillStep = (step: SignUpStep): step is keyof Skills => SKILLS.some((s) => s.key === step)

/** What Skip clears on each question. The name keeps the Google name; the card has no Skip. */
const SKIPPED: Partial<Record<SignUpStep, Partial<AccountInput>>> = {
  shirt: { shirt_number: null },
  foot: { strong_foot: null },
  position: { favourite_position: null },
  goal: { happy_in_goal: false },
  motto: { motto: null },
}

/**
 * Skip: clears the question and moves on. On a skill it skips all five
 * (they're all five or none) and goes to "Happy to play in goal?".
 */
export function skipStep(index: number, draft: AccountInput): { index: number; draft: AccountInput } {
  const step = SIGN_UP_STEPS[index]
  if (isSkillStep(step)) return { index: SIGN_UP_STEPS.indexOf('goal'), draft: { ...draft, ...NO_SKILLS } }
  return { index: Math.min(index + 1, SIGN_UP_STEPS.length - 1), draft: { ...draft, ...SKIPPED[step] } }
}

/** The answers start from the account (empty when it's new), named after the Google account. */
export function startDraft(account: Account, googleName: string): AccountInput {
  return { ...accountInput(account), display_name: account.display_name || googleName }
}
```

`src/lib/phone.ts`:

```ts
// The InstaPay number (Plans/Accounts-groups-and-chat.md section 7): an
// Egyptian mobile number, saved as 11 digits. Tested in phone.test.ts.
const MOBILE = /^01[0125]\d{8}$/

export type PhoneCheck = { ok: true; phone: string | null } | { ok: false }

/** "+20 10 1234 5678", "0020 1012345678" and "010-1234-5678" all become "01012345678". Empty is no number. */
export function checkPhone(typed: string): PhoneCheck {
  let digits = typed.replace(/[\s\-().]/g, '')
  if (digits === '') return { ok: true, phone: null }
  if (digits.startsWith('+20')) digits = `0${digits.slice(3)}`
  else if (digits.startsWith('0020')) digits = `0${digits.slice(4)}`
  return MOBILE.test(digits) ? { ok: true, phone: digits } : { ok: false }
}

/** "01012345678" -> "010 1234 5678" */
export function formatPhone(phone: string): string {
  return `${phone.slice(0, 3)} ${phone.slice(3, 7)} ${phone.slice(7)}`
}
```

Run: `npx vitest run src/lib/signup.test.ts src/lib/phone.test.ts`
Expected: PASS.

- [ ] **Step 5: API (`src/lib/api.ts`)**

Add `Account`, `AccountHit`, `AccountInput`, `AccountPage` to the type import. Read the new group columns:

```ts
/** Everything the app reads about a group. */
const GROUP_COLUMNS = 'id, name, invite_code, min_extra_team_size, image_path, is_public'
```

and in `getMemberships` use `` `role, player_id, groups(${GROUP_COLUMNS})` ``. Add `show_stats, instapay_phone` to the first line of `PLAYER_COLUMNS`:

```ts
  'id, group_id, user_id, display_name, is_guest, happy_in_goal, show_stats, instapay_phone',
```

After the Groups section, add:

```ts
// ---------------------------------------------------------------------------
// Your account (Plans/Accounts-groups-and-chat.md section 1)
// ---------------------------------------------------------------------------
export const getMyAccount = () => rpc<Account>('my_account')

/** Saves the whole account at once (a field left out is cleared). Every group's copy follows. */
export const saveMyAccount = (account: AccountInput) => rpc('save_my_account', { p_account: account })

/** The end of the sign-up questions. */
export const finishSignUp = (account: AccountInput) => rpc('finish_sign_up', { p_account: account })

/** Someone's account page: skills only if they show their stats (or it's you). */
export const getAccount = (userId: string) => rpc<AccountPage>('get_account', { p_user_id: userId })

/** Find: up to 20 accounts whose name contains the text (2 or more letters). */
export const searchAccounts = (query: string) => rpc<AccountHit[]>('search_accounts', { p_query: query })
```

(`saveCard` stays until Task 8 removes its last users.)

- [ ] **Step 6: Storage keys (`src/lib/storage.ts`)**

```ts
export const KEYS = {
  currentGroup: 'kora.currentGroup',
  /** Invite code from a shared link, kept while the person installs and signs in. */
  pendingInvite: 'kora.pendingInvite',
  /** "Not now" on "Finish your player card", per account: `${key}.${userId}` = '1'. */
  cardReminderHidden: 'kora.cardReminderHidden',
  /** The newest chat message seen, per group: `${key}.${groupId}` = its created_at. */
  chatLastRead: 'kora.chatLastRead',
}
```

- [ ] **Step 7: The account provider (`src/state/account.tsx`)**

```tsx
// Your account (Plans/Accounts-groups-and-chat.md section 1): the player
// card, Show my stats and the InstaPay number, the same in every group.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import * as api from '../lib/api'
import { errorMessage } from '../lib/format'
import type { Account } from '../lib/types'

interface AccountState {
  /** null while loading, or when it couldn't load (see error). */
  account: Account | null
  loading: boolean
  error: string | null
  /** Reload it (after saving, or once the sign-up is done). */
  refresh: () => Promise<void>
}

const AccountContext = createContext<AccountState | null>(null)

export function AccountProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setAccount(await api.getMyAccount())
    setError(null)
  }, [])

  // refresh only sets state after its network call resolves.
  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect
    refresh()
      .catch((e: unknown) => setError(errorMessage(e)))
      .finally(() => setLoading(false))
  }, [refresh])

  const value = useMemo<AccountState>(() => ({ account, loading, error, refresh }), [account, loading, error, refresh])
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
}

// eslint-disable-next-line react/only-export-components
export function useAccount(): AccountState {
  const ctx = useContext(AccountContext)
  if (!ctx) throw new Error('useAccount must be used inside AccountProvider')
  return ctx
}

/** For screens shown only after sign-up, when the account is always there. */
// eslint-disable-next-line react/only-export-components
export function useMyAccount(): Account {
  const { account } = useAccount()
  if (!account) throw new Error('No account loaded')
  return account
}
```

- [ ] **Step 8: Checkpoint**

Run: `npx tsc -b && npm run lint && npm test`
Expected: PASS. `tsc` may point at `Player` objects in tests or the seed stand-ins that now miss `show_stats` / `instapay_phone`: add `show_stats: true, instapay_phone: null` to each.

---

### Task 7: The sign-up questions and the account gate

**Files:**
- Create: `src/pages/SignUp.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `useAccount`, `useMyAccount`, `AccountProvider` (Task 6); `SIGN_UP_STEPS`, `isSkillStep`, `skipStep`, `startDraft`; `api.finishSignUp`; `accountCard`, `cleanCard`, `FEET`, `POSITIONS`; `PlayerCard` (takes a `CardView` since Task 6).
- Produces: `AccountGate` in `App.tsx`: account loading → Splash; error → `LoadError`; not signed up → `<SignUp />`; else the groups and the app.

- [ ] **Step 1: `src/pages/SignUp.tsx`**

```tsx
import { AnimatePresence } from 'motion/react'
import * as m from 'motion/react-m'
import { useState, type ReactNode } from 'react'
import { PlayerCard } from '../components/card'
import { BackIcon } from '../components/icons'
import { Button, ErrorNote, ScoreButton, Toggle } from '../components/ui'
import * as api from '../lib/api'
import { accountCard, cleanCard, FEET, POSITIONS } from '../lib/card'
import { errorMessage } from '../lib/format'
import { isSkillStep, SIGN_UP_STEPS, skipStep, startDraft, type SignUpStep } from '../lib/signup'
import type { AccountInput } from '../lib/types'
import { googleName } from '../lib/user'
import { useAccount, useMyAccount } from '../state/account'
import { useAuth } from '../state/auth'

const QUESTIONS: Record<SignUpStep, string> = {
  name: 'What should we call you?',
  shirt: 'Your shirt number?',
  foot: 'Your strong foot?',
  position: 'Where do you like to play?',
  skill_shooting: 'How good is your shooting?',
  skill_passing: 'How good is your passing?',
  skill_dribbling: 'How good is your dribbling?',
  skill_defending: 'How good is your defending?',
  skill_fitness: 'How good is your fitness?',
  goal: 'Happy to play in goal?',
  motto: 'Your motto?',
  card: 'Your card',
}

const input = 'mt-6 h-14 w-full rounded-xl border-[1.5px] border-line bg-paper px-4 text-xl'

/** A big answer: green with black text once chosen. One tap answers and moves on. */
function Choice({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <m.button
      type="button"
      whileTap={{ scale: 0.97 }}
      aria-pressed={selected}
      onClick={onClick}
      className={`min-h-16 w-full rounded-2xl border-2 px-5 text-left font-display text-xl ${
        selected ? 'border-[#0b0b0b] bg-brand text-on-brand' : 'border-line bg-paper text-ink'
      }`}
    >
      {children}
    </m.button>
  )
}

/**
 * The sign-up questions (Plans/Accounts-groups-and-chat.md section 2): right
 * after the first sign-in, one per screen, each with Skip. Done saves
 * everything at once; leaving halfway keeps nothing.
 */
export default function SignUp() {
  const account = useMyAccount()
  const { refresh } = useAccount()
  const { user } = useAuth()
  const [index, setIndex] = useState(0)
  const [draft, setDraft] = useState<AccountInput>(() => startDraft(account, googleName(user)))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const step = SIGN_UP_STEPS[index]
  const total = SIGN_UP_STEPS.length

  const change = (changes: Partial<AccountInput>) => setDraft((d) => ({ ...d, ...changes }))
  const next = () => setIndex((i) => Math.min(i + 1, total - 1))
  /** Tapping an answer moves on by itself. */
  const answer = (changes: Partial<AccountInput>) => {
    change(changes)
    next()
  }

  function skip() {
    const skipped = skipStep(index, draft)
    setDraft(skipped.draft)
    setIndex(skipped.index)
  }

  async function done() {
    setBusy(true)
    setError(null)
    try {
      await api.finishSignUp(cleanCard({ ...draft, display_name: draft.display_name.trim() || account.display_name }))
      // Signed up: the app opens.
      await refresh()
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
    }
  }

  let body: ReactNode = null
  let hint: string | null = null
  // Typing questions need Next; the others move on when tapped (Next shows once answered, after Back).
  let answered = true
  if (step === 'name') {
    hint = 'This is what your friends will see. Arabic is fine.'
    answered = draft.display_name.trim() !== ''
    body = (
      <input
        className={input}
        aria-label="Your name"
        value={draft.display_name}
        maxLength={40}
        dir="auto"
        onChange={(e) => change({ display_name: e.target.value })}
      />
    )
  } else if (step === 'shirt') {
    body = (
      <input
        aria-label="Shirt number"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={2}
        placeholder="10"
        value={draft.shirt_number ?? ''}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').slice(0, 2)
          const n = Number(digits)
          change({ shirt_number: digits === '' || n === 0 ? null : n })
        }}
        className="tabular mt-6 block h-24 w-36 rounded-2xl border-2 border-line bg-paper text-center font-display text-6xl"
      />
    )
  } else if (step === 'foot') {
    answered = draft.strong_foot != null
    body = (
      <div className="mt-6 space-y-2">
        {FEET.map((f) => (
          <Choice key={f.value} selected={draft.strong_foot === f.value} onClick={() => answer({ strong_foot: f.value })}>
            {f.label}
          </Choice>
        ))}
      </div>
    )
  } else if (step === 'position') {
    hint = 'Just for show: teams have no fixed positions.'
    answered = draft.favourite_position != null
    body = (
      <div className="mt-6 space-y-2">
        {POSITIONS.map((p) => (
          <Choice
            key={p.value}
            selected={draft.favourite_position === p.value}
            onClick={() => answer({ favourite_position: p.value })}
          >
            {p.label}
          </Choice>
        ))}
      </div>
    )
  } else if (isSkillStep(step)) {
    hint = 'Be honest: it never changes your night ratings.'
    answered = draft[step] != null
    body = (
      <div className="mt-6 grid grid-cols-5 gap-2" role="group" aria-label={QUESTIONS[step]}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <ScoreButton key={n} n={n} selected={draft[step] === n} onClick={() => answer({ [step]: n })} />
        ))}
      </div>
    )
  } else if (step === 'goal') {
    hint = 'Players happy in goal are suggested first when a game needs a goalkeeper.'
    body = (
      <div className="mt-6 space-y-2">
        <Choice selected={draft.happy_in_goal} onClick={() => answer({ happy_in_goal: true })}>
          Yes
        </Choice>
        <Choice selected={!draft.happy_in_goal} onClick={() => answer({ happy_in_goal: false })}>
          No
        </Choice>
      </div>
    )
  } else if (step === 'motto') {
    hint = 'Up to 60 characters. Arabic is fine.'
    body = (
      <input
        className={input}
        aria-label="Motto"
        value={draft.motto ?? ''}
        maxLength={60}
        dir="auto"
        placeholder="Pass it to me"
        onChange={(e) => change({ motto: e.target.value })}
      />
    )
  } else {
    hint = 'You can change all of it later, from your account.'
    body = (
      <div className="mt-6 space-y-3">
        <PlayerCard player={accountCard({ ...account, ...draft })} isMe preview />
        <Toggle
          checked={draft.show_stats}
          onChange={(on) => change({ show_stats: on })}
          label="Show my stats"
          hint="Off: only you see your skills and self-rating."
        />
      </div>
    )
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-[calc(env(safe-area-inset-bottom)+16px)]">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Back"
          disabled={index === 0 || busy}
          onClick={() => setIndex(index - 1)}
          className="flex size-12 items-center justify-center rounded-full disabled:invisible"
        >
          <BackIcon size={22} />
        </button>
        <div aria-hidden className="h-2 flex-1 overflow-hidden rounded-full bg-line">
          <m.div
            className="h-full origin-left rounded-full bg-brand"
            initial={false}
            animate={{ scaleX: (index + 1) / total }}
            transition={{ duration: 0.3 }}
          />
        </div>
        <span className="tabular w-12 text-right text-sm font-semibold text-muted">
          {index + 1}/{total}
        </span>
      </div>
      <p className="sr-only" role="status">
        Question {index + 1} of {total}
      </p>

      <AnimatePresence mode="wait" initial={false}>
        <m.section
          key={step}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.2 }}
          className="mt-8"
        >
          {index === 0 && <p className="label mb-2">Welcome to 7GZ-KORA</p>}
          <h1 className="font-display text-[34px] leading-[1.05]">{QUESTIONS[step]}</h1>
          {hint && <p className="mt-2 text-muted">{hint}</p>}
          {body}
        </m.section>
      </AnimatePresence>

      <ErrorNote message={error} />
      <div className="mt-auto flex gap-2 pt-8">
        {step === 'card' ? (
          <Button size="lg" className="w-full" busy={busy} onClick={() => void done()}>
            Done
          </Button>
        ) : (
          <>
            <Button variant="ghost" className="flex-1" onClick={skip}>
              {isSkillStep(step) ? 'Skip the skills' : 'Skip'}
            </Button>
            {answered && (
              <Button className="flex-[2]" onClick={next}>
                Next
              </Button>
            )}
          </>
        )}
      </div>
    </main>
  )
}
```

- [ ] **Step 2: The gate in `src/App.tsx`**

Import `SignUp` (eagerly: it's the first screen after sign-in) and the account state:

```tsx
import SignUp from './pages/SignUp'
import { AccountProvider, useAccount } from './state/account'
```

Replace `AuthGate`'s signed-in branch and add `AccountGate` and `LoadError`:

```tsx
  if (loading) return <Splash />
  if (!user) return <SignIn />
  return (
    <AccountProvider key={user.id}>
      <AccountGate />
    </AccountProvider>
  )
}

/** Signed in: the sign-up questions once, then the groups and the app. */
function AccountGate() {
  const { account, loading, error } = useAccount()
  if (loading) return <Splash />
  if (!account) return <LoadError message={error} />
  if (!account.onboarded_at) return <SignUp />
  return (
    <GroupProvider>
      <GroupGate />
    </GroupProvider>
  )
}

/** Couldn't load the account or the groups: try again, or sign out. */
function LoadError({ message }: { message: string | null }) {
  const { signOut } = useAuth()
  return (
    <div className="mx-auto max-w-sm px-6 pt-24 text-center">
      <ErrorNote message={message ?? 'Could not load your account. Check your connection.'} />
      <Button className="w-full" onClick={() => window.location.reload()}>
        Try again
      </Button>
      <Button variant="ghost" className="mt-2 w-full" onClick={() => void signOut()}>
        Sign out
      </Button>
    </div>
  )
}
```

and in `GroupGate`, replace the error block (`if (error) { return (<div …>…</div>) }`) with `if (error) return <LoadError message={error} />` (drop the now-unused `signOut` there).

- [ ] **Step 3: Checkpoint**

Run: `npx tsc -b && npm run lint && npm test`
Expected: PASS. (The screens are checked in Task 19.)

---

### Task 8: Edit my card on the account, Change name, "Stats hidden"

**Files:**
- Create: `src/pages/EditAccount.tsx`, `src/pages/ChangeName.tsx`, `src/components/hub.tsx` (with `FinishCard`; more in Task 17)
- Delete: `src/pages/EditCard.tsx`, `src/pages/Welcome.tsx`
- Modify: `src/components/card.tsx`, `src/components/selfvsfriends.tsx`, `src/pages/PlayerProfile.tsx`, `src/pages/Home.tsx`, `src/pages/JoinOrCreate.tsx`, `src/App.tsx`, `src/lib/api.ts`

**Interfaces:**
- Consumes: `useAccount`, `useMyAccount`, `accountCard`, `accountInput`, `NO_SKILLS`, `checkPhone`, `formatPhone`, `api.saveMyAccount`.
- Produces: `PlayerCard({ player: CardView, … })`; `api.renamePlayer(playerId, name)`; routes `/me/edit` (EditAccount) and `/players/:id/edit` (ChangeName); `FinishCard` in `src/components/hub.tsx`.

- [ ] **Step 1: The card says "Stats hidden" (`src/components/card.tsx`)**

Replace `<SkillBars player={player} isMe={isMe} />` with:

```tsx
        {player.show_stats || isMe ? (
          <SkillBars player={player} isMe={isMe} />
        ) : (
          <p className="mt-4 text-sm font-semibold text-muted">Stats hidden</p>
        )}
        {isMe && !player.show_stats && skillsState(player) !== 'none' && (
          <p className="mt-2 text-xs text-muted">Hidden from everyone else.</p>
        )}
```

and update the comment above `PlayerCard`: "preview: Edit my card and the sign-up (the name isn't the page's heading)."

- [ ] **Step 2: `src/pages/EditAccount.tsx`**

```tsx
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { PlayerCard } from '../components/card'
import { FootField, MottoField, PositionField, ShirtField, SkillsField } from '../components/cardform'
import { useToast } from '../components/feedback'
import { BackIcon, GloveIcon } from '../components/icons'
import { Button, Card, ErrorNote, Heading, PageTitle, Toggle } from '../components/ui'
import * as api from '../lib/api'
import { accountCard, accountInput, cleanCard, NO_SKILLS, skillsState } from '../lib/card'
import { errorMessage } from '../lib/format'
import { checkPhone, formatPhone } from '../lib/phone'
import type { AccountInput } from '../lib/types'
import { useAccount, useMyAccount } from '../state/account'
import { useGroup } from '../state/group'

const input = 'mt-1 h-12 w-full rounded-xl border-[1.5px] border-line bg-paper px-3 text-base'

/**
 * Edit my card (/me/edit): the account's card, the same in every group
 * (Plans/Accounts-groups-and-chat.md section 1), plus Show my stats and the
 * InstaPay number. Only you change it.
 */
export default function EditAccount() {
  const account = useMyAccount()
  const { refresh: refreshAccount } = useAccount()
  const { refresh: refreshGroup } = useGroup()
  const navigate = useNavigate()
  const toast = useToast()
  const [draft, setDraft] = useState<AccountInput>(() => accountInput(account))
  const [phoneText, setPhoneText] = useState(() => (account.instapay_phone ? formatPhone(account.instapay_phone) : ''))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const change = (changes: Partial<AccountInput>) => setDraft((d) => ({ ...d, ...changes }))
  const skills = skillsState(draft)
  const phone = checkPhone(phoneText)

  async function save() {
    if (!phone.ok) return
    setBusy(true)
    setError(null)
    try {
      await api.saveMyAccount(cleanCard({ ...draft, display_name: draft.display_name.trim(), instapay_phone: phone.phone }))
      // Every group's copy changed too.
      await Promise.all([refreshAccount(), refreshGroup()])
      toast('Card saved')
      navigate('/me')
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <Link to="/me" className="inline-flex items-center gap-1 text-sm font-semibold text-muted">
        <BackIcon size={18} /> My account
      </Link>
      <PageTitle sub="Your card is the same in every group you're in.">Edit my card</PageTitle>
      <PlayerCard player={accountCard({ ...account, ...draft })} isMe preview />

      <Card className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium">Your name</span>
          <input
            className={input}
            value={draft.display_name}
            maxLength={40}
            required
            dir="auto"
            onChange={(e) => change({ display_name: e.target.value })}
          />
          <span className="mt-1 block text-xs text-muted">
            Used when you join a group. Your name inside a group can be changed there.
          </span>
        </label>
        <ShirtField value={draft.shirt_number} onChange={change} />
        <FootField value={draft.strong_foot} onChange={change} />
        <PositionField value={draft.favourite_position} onChange={change} />
        <MottoField value={draft.motto} onChange={change} />
      </Card>

      <Card>
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <Heading>Rate yourself</Heading>
          {skills !== 'none' && (
            <button type="button" className="text-sm font-semibold text-brand-ink underline" onClick={() => change(NO_SKILLS)}>
              Clear
            </button>
          )}
        </div>
        <p className="mb-3 text-sm text-muted">
          1 to 10 on each. It never changes your night ratings. Until you've played a rated night it's your starting point
          in Suggest teams, and it shows next to what your friends give you.
        </p>
        <SkillsField skills={draft} onChange={change} />
      </Card>

      <Toggle
        checked={draft.show_stats}
        onChange={(on) => change({ show_stats: on })}
        label="Show my stats"
        hint="Off: only you see your skills and self-rating. Your name, number, position, foot and motto still show."
      />
      <Toggle
        checked={draft.happy_in_goal}
        onChange={(on) => change({ happy_in_goal: on })}
        label="Happy to play in goal"
        hint="Suggested first when a game needs a goalkeeper."
        icon={<GloveIcon size={22} className="shrink-0" />}
      />

      <Card>
        <label className="block">
          <span className="text-sm font-medium">InstaPay number</span>
          <input
            className={`${input} tabular`}
            inputMode="tel"
            autoComplete="tel"
            placeholder="010 1234 5678"
            value={phoneText}
            onChange={(e) => setPhoneText(e.target.value)}
          />
          <span className={`mt-1 block text-xs ${phone.ok ? 'text-muted' : 'font-semibold text-danger'}`}>
            {phone.ok
              ? 'For when you collect the pitch money: people who owe you see it with a Copy button. Members of your groups can see it.'
              : 'Use an Egyptian mobile number, like 010 1234 5678.'}
          </span>
        </label>
      </Card>

      <ErrorNote message={error} />
      <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-10">
        {skills === 'some' && (
          <p className="mb-2 rounded-xl border-[1.5px] border-line bg-paper p-2 text-center text-sm font-semibold">
            Rate all five skills, or clear them.
          </p>
        )}
        <Button
          size="lg"
          className="w-full"
          busy={busy}
          disabled={!draft.display_name.trim() || skills === 'some' || !phone.ok}
          onClick={() => void save()}
        >
          Save card
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: `src/pages/ChangeName.tsx`**

```tsx
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useToast } from '../components/feedback'
import { BackIcon } from '../components/icons'
import { Button, Card, ErrorNote, LinkButton, Name, PageTitle } from '../components/ui'
import * as api from '../lib/api'
import { errorMessage } from '../lib/format'
import { useCurrentGroup } from '../state/group'

const input = 'mt-1 h-12 w-full rounded-xl border-[1.5px] border-line bg-paper px-3 text-base'

/** A player's name in this group (/players/:id/edit): yourself, or anyone if you're an admin. */
export default function ChangeName() {
  const { id = '' } = useParams()
  const { group, player, myPlayerId, isAdmin, refresh } = useCurrentGroup()
  const navigate = useNavigate()
  const toast = useToast()
  const p = player(id)
  const [name, setName] = useState(p?.display_name ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isMe = id === myPlayerId

  if (!p) return <ErrorNote message="Player not found." />
  if (!isMe && !isAdmin) return <ErrorNote message="Only this player or an admin can change this name." />

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.renamePlayer(id, name)
      await refresh()
      toast('Name saved')
      navigate(`/players/${id}`)
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <Link to={`/players/${id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-muted">
        <BackIcon size={18} /> Profile
      </Link>
      <PageTitle sub={<>Only in <Name>{group.name}</Name>. Other groups keep theirs.</>}>
        {isMe ? 'Your name in this group' : 'Change name'}
      </PageTitle>
      <Card>
        <form onSubmit={save} className="space-y-3">
          <label className="block">
            <span className="text-sm font-medium">Name in the group</span>
            <input className={input} value={name} maxLength={40} required dir="auto" onChange={(e) => setName(e.target.value)} />
          </label>
          <ErrorNote message={error} />
          <Button type="submit" className="w-full" busy={busy} disabled={!name.trim() || name.trim() === p.display_name}>
            Save name
          </Button>
        </form>
      </Card>
      {isMe && (
        <LinkButton to="/me/edit" variant="secondary" className="w-full">
          Edit my card
        </LinkButton>
      )}
    </div>
  )
}
```

In `src/lib/api.ts`, replace `saveCard` with:

```ts
/** A player's name in this group: yourself, or anyone if you're an admin. */
export async function renamePlayer(playerId: string, name: string) {
  unwrap(await supabase.from('players').update({ display_name: name.trim() }).eq('id', playerId))
}
```

(and drop `CardFields` from the type import if it's now unused).

- [ ] **Step 4: `FinishCard` on the account (`src/components/hub.tsx`)**

```tsx
// Pieces of Home, the group hub (Plans/Accounts-groups-and-chat.md section 8).
import { useState } from 'react'
import { isCardFilled } from '../lib/card'
import { KEYS, readLocal, writeLocal } from '../lib/storage'
import { useMyAccount } from '../state/account'
import { Button, Card, Heading, LinkButton } from './ui'

/** Until your card is filled in: a nudge to do it. "Not now" hides it on this phone. */
export function FinishCard() {
  const account = useMyAccount()
  const key = `${KEYS.cardReminderHidden}.${account.id}`
  const [hidden, setHidden] = useState(() => readLocal(key) === '1')
  if (hidden || isCardFilled(account)) return null
  return (
    <Card strong>
      <Heading>Your player card</Heading>
      <p className="mt-1 font-display text-[22px] leading-tight">Finish your player card</p>
      <p className="mt-1 text-sm text-muted">Your shirt number, strong foot, favourite position, and how you rate yourself.</p>
      <div className="mt-3 flex gap-2">
        <LinkButton to="/me/edit" className="flex-1">
          Set up my card
        </LinkButton>
        <Button
          variant="ghost"
          onClick={() => {
            writeLocal(key, '1')
            setHidden(true)
          }}
        >
          Not now
        </Button>
      </div>
    </Card>
  )
}
```

In `src/pages/Home.tsx`, delete the local `FinishCard` function and import it: `import { FinishCard } from '../components/hub'`; drop the now-unused imports (`isCardFilled`, `KEYS`, `readLocal`, `writeLocal`, `Button` if unused).

- [ ] **Step 5: The profile shows your account card (`src/pages/PlayerProfile.tsx`)**

```tsx
import { accountCard } from '../lib/card'
import { useAccount } from '../state/account'
```

After `const p = player(id)` and the `if (!p)` guard (move the `useAccount()` call above the guard, with the other hooks):

```tsx
  const { account } = useAccount()
  …
  // Your own card comes from your account, so you see your skills even when they're hidden from others.
  const shown = isMe && account ? { ...p, ...accountCard(account), display_name: p.display_name } : p
```

Use `shown` for `<PlayerCard player={shown} …/>` and `<SelfVsFriends player={shown} …/>`. Replace the Edit button with:

```tsx
      <div className="flex flex-wrap gap-2">
        {isMe && (
          <LinkButton to="/me/edit" variant="secondary" className="flex-1">
            Edit my card
          </LinkButton>
        )}
        {(isMe || isAdmin) && (
          <LinkButton to={`/players/${id}/edit`} variant="ghost" className="flex-1">
            Change name
          </LinkButton>
        )}
        {p.user_id && !isMe && (
          <LinkButton to={`/u/${p.user_id}`} variant="secondary" className="flex-1">
            Their account
          </LinkButton>
        )}
      </div>
```

- [ ] **Step 6: Self vs friends (`src/components/selfvsfriends.tsx`)**

The link goes to `/me/edit`, and a hidden self-rating says so:

```tsx
              <Link to="/me/edit" className="font-semibold text-brand-ink underline">
                your card
              </Link>{' '}
```

```tsx
          ) : player.show_stats ? (
            'No self-rating yet.'
          ) : (
            'Keeps their self-rating private.'
          )}
```

- [ ] **Step 7: No more per-group welcome (`src/App.tsx`, `src/pages/JoinOrCreate.tsx`)**

Delete `src/pages/Welcome.tsx` and `src/pages/EditCard.tsx`. In `App.tsx` drop their lazy imports and the `welcome` route, add

```tsx
const ChangeName = lazy(() => import('./pages/ChangeName'))
const EditAccount = lazy(() => import('./pages/EditAccount'))
```

and the routes `<Route path="players/:id/edit" element={<ChangeName />} />` and `<Route path="me/edit" element={<EditAccount />} />`. In `JoinOrCreate.tsx`, `done()` becomes:

```tsx
  async function done(groupId: string) {
    writeLocal(KEYS.pendingInvite, null)
    switchGroup(groupId)
    await refresh()
    toast('Welcome to the group!')
    navigate('/')
  }
```

with `const toast = useToast()` (import from `../components/feedback`). Task 9 rewrites this screen fully.

- [ ] **Step 8: Checkpoint**

Run: `grep -rn "saveCard\|/welcome\|EditCard\|Welcome" src` → nothing. Then `npx tsc -b && npm run lint && npm test`
Expected: PASS.

---

## Part D — Groups

### Task 9: The app without a group

**Files:**
- Create: `src/pages/Lobby.tsx`, `src/components/groups.tsx`
- Modify: `src/App.tsx` (whole file below), `src/components/Layout.tsx` (whole file below), `src/pages/Settings.tsx`, `src/pages/JoinOrCreate.tsx` (whole file below), `src/components/icons.tsx`, `src/lib/api.ts`, `src/lib/types.ts`

**Interfaces:**
- Consumes: `useMyAccount`, `useAccount`, `accountCard`, `FinishCard`, `PlayerCard`.
- Produces (types): `PublicGroup { id, name, image_path, members, i_am_in, next_night_day, next_night_at, next_night_location }`.
- Produces (api): `groupImageUrl(path: string | null): string | null`, `listPublicGroups(): Promise<PublicGroup[]>`, `joinPublicGroup(groupId, displayName): Promise<string>`, `getGroupName(groupId): Promise<string>`.
- Produces (components): `GroupImage({ path, className })`, `PublicGroupList({ limit? })`, `useEnterGroup() → (groupId, name?, welcome = true) => Promise<void>` (groups.tsx); `GroupForms()` (JoinOrCreate.tsx); `SearchIcon`, `ChatIcon`, `PinIcon`.
- Produces (routes): `/` is `Home` with a group and `Lobby` without; group screens sit inside `RequireGroup` (back to `/` without a group); tabs **Home · Nights · Table · More** with a group (Chat joins in Task 13), **Home · Find · More** without; the header has Find and your photo (→ `/me`, which arrives in Task 11).

- [ ] **Step 1: Types and API**

In `src/lib/types.ts`, after `AccountHit`:

```ts
/** A public group in Find (list_public_groups). */
export interface PublicGroup {
  id: string
  name: string
  image_path: string | null
  members: number
  /** You're in it already ("Open" instead of "Join"). */
  i_am_in: boolean
  /** The next planned night, if any. */
  next_night_day: string | null
  next_night_at: string | null
  next_night_location: string | null
}
```

In `src/lib/api.ts` (add `PublicGroup` to the type import), after the account section:

```ts
// ---------------------------------------------------------------------------
// Public groups and group photos (Plans/Accounts-groups-and-chat.md sections 4-5)
// ---------------------------------------------------------------------------
const GROUP_IMAGES = 'group-images'

/** The photo's web address (the bucket is public), or null. */
export function groupImageUrl(path: string | null): string | null {
  return path ? supabase.storage.from(GROUP_IMAGES).getPublicUrl(path).data.publicUrl : null
}

export const listPublicGroups = () => rpc<PublicGroup[]>('list_public_groups')

/** One tap: joins a public group with this name (the account's, unless changed). */
export const joinPublicGroup = (groupId: string, displayName: string) =>
  rpc<string>('join_public_group', { p_group_id: groupId, p_display_name: displayName })

/** A group's name, once you're in it (for the welcome message). */
export async function getGroupName(groupId: string): Promise<string> {
  return unwrap<{ name: string }>(await supabase.from('groups').select('name').eq('id', groupId).single()).name
}
```

- [ ] **Step 2: Icons (`src/components/icons.tsx`)**

```tsx
export const SearchIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Icon>
)

export const ChatIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1.1-4.4A8 8 0 1 1 21 12z" />
  </Icon>
)

export const PinIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" />
    <circle cx="12" cy="10" r="2.5" />
  </Icon>
)
```

- [ ] **Step 3: `src/components/groups.tsx`**

```tsx
// Groups you can find, join and open (Plans/Accounts-groups-and-chat.md sections 3-5).
import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router'
import * as api from '../lib/api'
import { errorMessage, formatNightWhen } from '../lib/format'
import type { PublicGroup } from '../lib/types'
import { useLoad } from '../lib/useLoad'
import { useMyAccount } from '../state/account'
import { useGroup } from '../state/group'
import { useToast } from './feedback'
import { Button, ErrorNote, Name } from './ui'

/** The group photo, or the honeycomb green with the logo when there's none. */
export function GroupImage({ path, className = '' }: { path: string | null; className?: string }) {
  const url = api.groupImageUrl(path)
  if (url) return <img src={url} alt="" loading="lazy" className={`bg-line object-cover ${className}`} />
  return (
    <div aria-hidden className={`honeycomb flex items-center justify-center ${className}`}>
      <img src="/logo.svg" alt="" className="h-3/5 max-h-20" />
    </div>
  )
}

/** Opens a group you're in: switches to it, reloads, goes Home, and (after joining) says welcome. */
// eslint-disable-next-line react/only-export-components
export function useEnterGroup() {
  const { switchGroup, refresh } = useGroup()
  const navigate = useNavigate()
  const toast = useToast()
  return useCallback(
    async (groupId: string, name?: string, welcome = true) => {
      const groupName = welcome ? (name ?? (await api.getGroupName(groupId))) : ''
      switchGroup(groupId)
      await refresh()
      navigate('/')
      if (welcome) {
        toast(
          <>
            Welcome to <Name>{groupName}</Name>
          </>,
        )
      }
    },
    [switchGroup, refresh, navigate, toast],
  )
}

/** Public groups, most members first: Join (one tap), or Open if you're in already. */
export function PublicGroupList({ limit }: { limit?: number }) {
  const account = useMyAccount()
  const enter = useEnterGroup()
  const { data, error, loading, reload } = useLoad(() => api.listPublicGroups(), [])
  const [busy, setBusy] = useState<string | null>(null)
  const [joinError, setJoinError] = useState<string | null>(null)

  if (loading && !data) return <p className="text-sm text-muted">Looking for groups…</p>
  if (!data) return <ErrorNote message={error} onRetry={reload} />
  const groups = limit ? data.slice(0, limit) : data
  if (groups.length === 0) {
    return <p className="text-sm text-muted">No public groups yet. Start one, then switch it to Public in More.</p>
  }

  async function join(g: PublicGroup) {
    setBusy(g.id)
    setJoinError(null)
    try {
      if (!g.i_am_in) await api.joinPublicGroup(g.id, account.display_name)
      await enter(g.id, g.name, !g.i_am_in)
    } catch (e) {
      setJoinError(errorMessage(e))
      setBusy(null)
    }
  }

  return (
    <>
      <ErrorNote message={joinError} />
      <ul className="divide-y divide-line">
        {groups.map((g) => (
          <li key={g.id} className="flex items-center gap-3 py-2">
            <GroupImage path={g.image_path} className="size-14 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1">
              <Name className="block truncate font-bold">{g.name}</Name>
              <p className="truncate text-xs text-muted">
                {g.members} player{g.members === 1 ? '' : 's'}
                {g.next_night_day && (
                  <>
                    {' '}
                    · Next: {formatNightWhen({ played_at: g.next_night_day, starts_at: g.next_night_at })}
                    {g.next_night_location && (
                      <>
                        {' '}
                        · <Name>{g.next_night_location}</Name>
                      </>
                    )}
                  </>
                )}
              </p>
            </div>
            <Button size="sm" variant={g.i_am_in ? 'secondary' : 'primary'} busy={busy === g.id} onClick={() => void join(g)}>
              {g.i_am_in ? 'Open' : 'Join'}
            </Button>
          </li>
        ))}
      </ul>
    </>
  )
}
```

- [ ] **Step 4: `src/pages/JoinOrCreate.tsx` (the whole file)**

```tsx
import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useEnterGroup } from '../components/groups'
import { Cascade } from '../components/motion'
import { Button, Card, ErrorNote, Name, PageTitle } from '../components/ui'
import * as api from '../lib/api'
import { errorMessage } from '../lib/format'
import { KEYS, readLocal, writeLocal } from '../lib/storage'
import { useMyAccount } from '../state/account'

const input = 'mt-1 h-12 w-full rounded-xl border-[1.5px] border-line bg-paper px-3 text-base'

/** Join or create a group (/join). */
export default function JoinOrCreate() {
  return (
    <Cascade className="space-y-4">
      <PageTitle sub="Join your friends with their invite code, or start a group for them.">Join or create a group</PageTitle>
      <GroupForms />
      <p className="text-center text-sm">
        <Link to="/find" className="font-semibold text-brand-ink underline">
          Or find a public group
        </Link>
      </p>
    </Cascade>
  )
}

/**
 * "Join with an invite code" and "Start a new group", with your account name.
 * "Use a different name in this group" opens the name box.
 */
export function GroupForms() {
  const account = useMyAccount()
  const enter = useEnterGroup()
  const [searchParams] = useSearchParams()
  const [name, setName] = useState(account.display_name)
  const [changingName, setChangingName] = useState(false)
  // From an invite link (/join?code=...), or one remembered across sign-in.
  const [code, setCode] = useState(() => searchParams.get('code') ?? readLocal(KEYS.pendingInvite) ?? '')
  const [groupName, setGroupName] = useState('')
  const [busy, setBusy] = useState<'join' | 'create' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run(kind: 'join' | 'create', action: () => Promise<string>, e: FormEvent) {
    e.preventDefault()
    setBusy(kind)
    setError(null)
    try {
      const groupId = await action()
      writeLocal(KEYS.pendingInvite, null)
      await enter(groupId, kind === 'create' ? groupName.trim() : undefined)
    } catch (err) {
      setError(errorMessage(err))
      setBusy(null)
    }
  }

  return (
    <>
      {changingName ? (
        <label className="block">
          <span className="text-sm font-medium">Your name in the group</span>
          <input className={input} value={name} maxLength={40} dir="auto" onChange={(e) => setName(e.target.value)} />
          <span className="mt-1 block text-xs text-muted">This is what your friends will see. Arabic is fine.</span>
        </label>
      ) : (
        <p className="text-sm">
          You'll join as <Name className="font-bold">{name}</Name>.{' '}
          <button type="button" className="font-semibold text-brand-ink underline" onClick={() => setChangingName(true)}>
            Use a different name in this group
          </button>
        </p>
      )}

      <ErrorNote message={error} />

      <Card>
        <form onSubmit={(e) => void run('join', () => api.joinGroup(code, name), e)}>
          <h2 className="font-display text-xl">Got an invite code?</h2>
          <label className="mt-2 block">
            <span className="text-sm text-muted">Ask your group admin for the code, e.g. KICK-7Q3F</span>
            <input
              className={`${input} font-display text-2xl tracking-widest uppercase`}
              value={code}
              required
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
          <Button type="submit" className="mt-3 w-full" busy={busy === 'join'} disabled={!name.trim()}>
            Join group
          </Button>
        </form>
      </Card>

      <Card>
        <form onSubmit={(e) => void run('create', () => api.createGroup(groupName, name), e)}>
          <h2 className="font-display text-xl">Start a new group</h2>
          <p className="text-sm text-muted">You'll be its admin and get a code to share.</p>
          <label className="mt-2 block">
            <span className="text-sm text-muted">Group name</span>
            <input
              className={input}
              value={groupName}
              required
              maxLength={60}
              dir="auto"
              placeholder="Thursday Football"
              onChange={(e) => setGroupName(e.target.value)}
            />
          </label>
          <Button type="submit" variant="secondary" className="mt-3 w-full" busy={busy === 'create'} disabled={!name.trim()}>
            Create group
          </Button>
        </form>
      </Card>
    </>
  )
}
```

- [ ] **Step 5: `src/pages/Lobby.tsx`**

```tsx
import * as m from 'motion/react-m'
import { Link } from 'react-router'
import { PlayerCard } from '../components/card'
import { PublicGroupList } from '../components/groups'
import { FinishCard } from '../components/hub'
import { Cascade } from '../components/motion'
import { Card, Heading, Name } from '../components/ui'
import { accountCard } from '../lib/card'
import { cascadeItem } from '../lib/motion'
import { useMyAccount } from '../state/account'
import { GroupForms } from './JoinOrCreate'

/** Home without a group (Plans/Accounts-groups-and-chat.md section 3): find your squad, or start one. */
export default function Lobby() {
  const account = useMyAccount()
  const firstName = account.display_name.trim().split(/\s+/)[0]
  return (
    <Cascade className="space-y-4">
      {/* A green surface, so its text is black. */}
      <m.section variants={cascadeItem} className="honeycomb rounded-card border-2 border-[#0b0b0b] p-5 text-on-brand">
        <h1 className="font-display text-[34px] leading-[1.05]">
          Welcome, <Name>{firstName}</Name>
        </h1>
        <p className="mt-1 font-semibold">Find your squad, or start one.</p>
      </m.section>

      <PlayerCard player={accountCard(account)} isMe preview />
      <FinishCard />

      <Card>
        <div className="mb-1 flex items-baseline justify-between">
          <Heading>Find your squad</Heading>
          <Link to="/find" className="text-sm font-semibold text-brand-ink">
            See all
          </Link>
        </div>
        <PublicGroupList limit={5} />
      </Card>

      <GroupForms />

      <p className="pt-2 text-center text-sm">
        <Link to="/how-it-works" className="font-semibold text-brand-ink underline">
          How do nights, money and ratings work?
        </Link>
      </p>
    </Cascade>
  )
}
```

- [ ] **Step 6: `src/components/Layout.tsx` (the whole file)**

```tsx
import * as m from 'motion/react-m'
import { Suspense } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { rise, spring } from '../lib/motion'
import { useAccount } from '../state/account'
import { useGroup } from '../state/group'
import { HomeIcon, MatchesIcon, MoreIcon, SearchIcon, TableIcon } from './icons'
import { Avatar, Loading, Name } from './ui'

const COLUMNS = { 3: 'grid-cols-3', 4: 'grid-cols-4', 5: 'grid-cols-5' } as const

/** Honeycomb header + content + bottom tabs (one-handed navigation). */
export default function Layout() {
  const { group } = useGroup()
  const { account } = useAccount()
  const { pathname } = useLocation()

  // With a group: its nights and table. Without one: Find.
  const tabs = group
    ? [
        { to: '/', label: 'Home', icon: HomeIcon, end: true },
        { to: '/nights', label: 'Nights', icon: MatchesIcon, end: false },
        { to: '/table', label: 'Table', icon: TableIcon, end: false },
        { to: '/settings', label: 'More', icon: MoreIcon, end: false },
      ]
    : [
        { to: '/', label: 'Home', icon: HomeIcon, end: true },
        { to: '/find', label: 'Find', icon: SearchIcon, end: false },
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
          <div className="ml-auto flex shrink-0 items-center">
            <Link to="/find" aria-label="Find players and groups" className="flex size-12 items-center justify-center rounded-full">
              <SearchIcon size={24} />
            </Link>
            <Link to="/me" aria-label="My account" className="flex size-12 items-center justify-center">
              <span className="rounded-full border-2 border-[#0b0b0b]">
                <Avatar name={account?.display_name ?? ''} url={account?.avatar_url} size={32} />
              </span>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl flex-1 px-4 pt-4 pb-28">
        {/* Each screen slides in when you open it. */}
        <m.div key={pathname} {...rise}>
          {/* A screen still downloading shows the placeholders. */}
          <Suspense fallback={<Loading />}>
            <Outlet />
          </Suspense>
        </m.div>
      </main>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-20 border-t-[1.5px] border-line bg-paper pb-[env(safe-area-inset-bottom)]"
      >
        <ul className={`mx-auto grid h-16 max-w-xl ${COLUMNS[tabs.length as keyof typeof COLUMNS]}`}>
          {tabs.map(({ to, label, icon: Icon, end }) => (
            <li key={label}>
              <NavLink
                to={to}
                end={end}
                className="flex h-full flex-col items-center justify-center gap-0.5 text-[10.5px] font-bold text-muted aria-[current=page]:text-ink"
              >
                {({ isActive }) => (
                  <>
                    <span className="relative rounded-full px-3 py-[3px]">
                      {/* The green bubble glides to the tab you tap. */}
                      {isActive && (
                        <m.span layoutId="tab-bubble" transition={spring} className="absolute inset-0 rounded-full bg-brand" />
                      )}
                      <Icon size={22} className={`relative ${isActive ? 'text-on-brand' : ''}`} />
                    </span>
                    {label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
```

(The "Me" tab is gone: your photo in the header opens your account. Your stats in the group are one tap from there, Task 11.)

- [ ] **Step 7: `src/App.tsx` (the whole file)**

```tsx
import * as m from 'motion/react-m'
import { lazy, useEffect } from 'react'
import { BrowserRouter, Link, Navigate, Outlet, Route, Routes, useLocation } from 'react-router'
import Layout from './components/Layout'
import { Button, ErrorNote } from './components/ui'
import { allowBrowser, appMode } from './lib/access'
import { isStandalone } from './lib/pwa'
import { KEYS, writeLocal } from './lib/storage'
import { isConfigured } from './lib/supabase'
import Home from './pages/Home'
import InstallScreen from './pages/InstallScreen'
import JoinOrCreate from './pages/JoinOrCreate'
import Lobby from './pages/Lobby'
import SignIn from './pages/SignIn'
import SignUp from './pages/SignUp'
import { AccountProvider, useAccount } from './state/account'
import { AuthProvider, useAuth } from './state/auth'
import { GroupProvider, useGroup } from './state/group'

// Screens load when they're first opened (Plans/Accounts-groups-and-chat.md
// section 9). The installed app keeps them all for offline use.
const ChangeHistory = lazy(() => import('./pages/ChangeHistory'))
const ChangeName = lazy(() => import('./pages/ChangeName'))
const EditAccount = lazy(() => import('./pages/EditAccount'))
const HowItWorks = lazy(() => import('./pages/HowItWorks'))
const Leaderboard = lazy(() => import('./pages/Leaderboard'))
const NightPage = lazy(() => import('./pages/NightPage'))
const Nights = lazy(() => import('./pages/Nights'))
const PlanNight = lazy(() => import('./pages/PlanNight'))
const PlayerProfile = lazy(() => import('./pages/PlayerProfile'))
const Recorder = lazy(() => import('./pages/Recorder'))
const Settings = lazy(() => import('./pages/Settings'))
const Swap = lazy(() => import('./pages/Swap'))
const Teams = lazy(() => import('./pages/Teams'))
const Vote = lazy(() => import('./pages/Vote'))

export default function App() {
  // In a browser the website shows only the Install screen (Plans/Install-first-access.md).
  if (appMode({ standalone: isStandalone(), allowBrowser }) === 'install') return <InstallScreen />
  if (!isConfigured) return <SetupNeeded />
  return (
    <BrowserRouter>
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </BrowserRouter>
  )
}

/** Signed out: sign-in screen. Signed in: your account. */
function AuthGate() {
  const { user, loading } = useAuth()
  const location = useLocation()

  // Keep the code from an invite link (/join?code=...) while the person signs in.
  useEffect(() => {
    const code = new URLSearchParams(location.search).get('code')
    if (location.pathname === '/join' && code) writeLocal(KEYS.pendingInvite, code)
  }, [location])

  if (loading) return <Splash />
  if (!user) return <SignIn />
  return (
    <AccountProvider key={user.id}>
      <AccountGate />
    </AccountProvider>
  )
}

/** Signed in: the sign-up questions once, then the groups and the app. */
function AccountGate() {
  const { account, loading, error } = useAccount()
  if (loading) return <Splash />
  if (!account) return <LoadError message={error} />
  if (!account.onboarded_at) return <SignUp />
  return (
    <GroupProvider>
      <GroupGate />
    </GroupProvider>
  )
}

/** The app, with or without a group (Plans/Accounts-groups-and-chat.md section 3). */
function GroupGate() {
  const { loading, error, group, refresh } = useGroup()

  if (loading && !error) return <Splash />
  if (!group && error) return <LoadError message={error} />

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={group ? <Home /> : <Lobby />} />
        <Route path="me/edit" element={<EditAccount />} />
        <Route path="join" element={<JoinOrCreate />} />
        <Route path="settings" element={<Settings />} />
        <Route path="how-it-works" element={<HowItWorks />} />
        <Route element={<RequireGroup />}>
          <Route path="nights" element={<Nights />} />
          <Route path="nights/new" element={<PlanNight />} />
          <Route path="nights/:id" element={<NightPage />} />
          <Route path="nights/:id/edit" element={<PlanNight />} />
          <Route path="nights/:id/teams" element={<Teams />} />
          <Route path="nights/:id/swap" element={<Swap />} />
          <Route path="nights/:id/record" element={<Recorder />} />
          <Route path="nights/:id/vote" element={<Vote />} />
          <Route path="table" element={<Leaderboard />} />
          <Route path="players/:id" element={<PlayerProfile />} />
          <Route path="players/:id/edit" element={<ChangeName />} />
          <Route path="settings/history" element={<ChangeHistory />} />
        </Route>
        <Route path="*" element={<NotFound onRetry={() => void refresh()} />} />
      </Route>
    </Routes>
  )
}

/** Group screens: back to Home when you're not in a group. */
function RequireGroup() {
  const { group } = useGroup()
  return group ? <Outlet /> : <Navigate to="/" replace />
}

/** Couldn't load the account or the groups: try again, or sign out. */
function LoadError({ message }: { message: string | null }) {
  const { signOut } = useAuth()
  return (
    <div className="mx-auto max-w-sm px-6 pt-24 text-center">
      <ErrorNote message={message ?? 'Could not load your account. Check your connection.'} />
      <Button className="w-full" onClick={() => window.location.reload()}>
        Try again
      </Button>
      <Button variant="ghost" className="mt-2 w-full" onClick={() => void signOut()}>
        Sign out
      </Button>
    </div>
  )
}
```

followed by the existing `Splash`, `NotFound` and `SetupNeeded` functions, unchanged.

- [ ] **Step 8: `src/pages/Settings.tsx` works with and without a group**

Replace the default export with the version below, and turn the body of the old one into `GroupSettings`. `InviteCard`, `RenameGroup`, `MemberRow` and `TeamSuggesterCard` stay exactly as they are. Imports: add `type ReactNode` and `useGroup`; `useNavigate`, `LinkButton`, `useAuth` stay.

```tsx
export default function Settings() {
  const { group } = useGroup()
  return (
    <Cascade className="space-y-4">
      <PageTitle>More</PageTitle>
      {group && <GroupSettings />}
      <YourGroups />
      <RowLink to="/find">Find players and groups</RowLink>
      <RowLink to="/how-it-works">How it works</RowLink>
      <AccountActions />
    </Cascade>
  )
}

/** A full-width row that opens another screen. */
function RowLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="flex min-h-14 items-center justify-between rounded-card border-[1.5px] border-line bg-paper px-4 font-semibold"
    >
      {children} <ChevronIcon size={18} />
    </Link>
  )
}

/** Everything about the group you're in. */
function GroupSettings() {
  const { isAdmin, members, player, myPlayerId, refresh } = useCurrentGroup()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const confirm = useConfirm()

  async function act(name: string, action: () => Promise<unknown>, question?: Question) {
    if (question && !(await confirm(question))) return
    setBusy(name)
    setError(null)
    try {
      await action()
      await refresh()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const sortedMembers = [...members].sort(
    (a, b) =>
      Number(b.role === 'admin') - Number(a.role === 'admin') ||
      (player(a.player_id)?.display_name ?? '').localeCompare(player(b.player_id)?.display_name ?? ''),
  )

  return (
    <>
      <ErrorNote message={error} />
      <InviteCard />
      {isAdmin && <RenameGroup />}
      <RowLink to={`/players/${myPlayerId}/edit`}>Your name in this group</RowLink>
      <Card>
        <Heading className="mb-2">Members ({members.length})</Heading>
        <ul className="divide-y divide-line">
          {sortedMembers.map((m) => (
            <MemberRow key={m.user_id} member={m} busy={busy} act={act} />
          ))}
        </ul>
      </Card>
      <RatingSettingsCard />
      {isAdmin && <RowLink to="/settings/history">Change history</RowLink>}
      <TeamSuggesterCard />
    </>
  )
}

function YourGroups() {
  const { group, memberships, switchGroup } = useGroup()
  return (
    <Card>
      <Heading className="mb-2">Your groups</Heading>
      {memberships.length === 0 ? (
        <p className="text-sm text-muted">You're not in a group yet.</p>
      ) : (
        <ul className="divide-y divide-line">
          {memberships.map((m) => (
            <li key={m.group.id} className="flex min-h-12 items-center justify-between gap-2 py-1">
              <Name className="truncate font-medium">{m.group.name}</Name>
              {m.group.id === group?.id ? (
                <span className="text-sm text-muted">Current</span>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => switchGroup(m.group.id)}>
                  Switch
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <LinkButton to="/join" variant="secondary" className="mt-3 w-full">
        {memberships.length === 0 ? 'Join or create a group' : 'Join or create another group'}
      </LinkButton>
    </Card>
  )
}

function AccountActions() {
  const { user, signOut } = useAuth()
  const { group } = useGroup()
  const navigate = useNavigate()
  return (
    <div className="space-y-2 pt-2">
      <p className="text-center text-sm text-muted">Signed in as {user?.email}</p>
      <Button variant="secondary" className="w-full" onClick={() => void signOut().then(() => navigate('/'))}>
        Sign out
      </Button>
      {group && <LeaveGroup />}
    </div>
  )
}

function LeaveGroup() {
  const { group, refresh } = useCurrentGroup()
  const { user } = useAuth()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function leave() {
    const yes = await confirm({
      title: 'Leave this group?',
      message: (
        <>
          Your stats stay in <Name>{group.name}</Name>. You can rejoin with the invite code.
        </>
      ),
      confirmLabel: 'Leave group',
      danger: true,
    })
    if (!yes) return
    setBusy(true)
    setError(null)
    try {
      await api.removeMember(group.id, user!.id)
      await refresh()
      navigate('/')
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
    }
  }

  return (
    <>
      <ErrorNote message={error} />
      <Button variant="danger" className="w-full" busy={busy} onClick={() => void leave()}>
        Leave this group
      </Button>
    </>
  )
}
```

- [ ] **Step 9: Checkpoint**

Run: `npx tsc -b && npm run lint && npm test && npm run build`
Expected: PASS. (`/me` and `/find` are filled in by Task 11; until then the header links show "Offside!".)

---

### Task 10: Group photo and the Public switch (admins)

**Files:**
- Create: `src/lib/photo.ts`, `src/lib/photo.test.ts`
- Modify: `src/lib/api.ts`, `src/pages/Settings.tsx` (`RenameGroup` becomes `GroupCard`)

**Interfaces:**
- Produces: `PHOTO_MAX = 1280`, `fitWithin(width, height, max?) → { width, height }`, `shrinkPhoto(file: File): Promise<Blob>` (photo.ts); `api.setGroupPublic(groupId, isPublic)`, `api.setGroupPhoto(groupId, photo: Blob, oldPath): Promise<string>`, `api.removeGroupPhoto(groupId, path)`.

- [ ] **Step 1: Write the failing test: `src/lib/photo.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { fitWithin } from './photo'

describe('shrinking a group photo', () => {
  it('keeps the longest side at 1280 px, keeping the shape', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1280, height: 960 })
    expect(fitWithin(1000, 3000)).toEqual({ width: 427, height: 1280 })
  })

  it('never makes a small photo bigger', () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 })
  })
})
```

Run: `npx vitest run src/lib/photo.test.ts` → FAIL (no module).

- [ ] **Step 2: `src/lib/photo.ts`**

```ts
// Group photos are shrunk on the phone before uploading
// (Plans/Accounts-groups-and-chat.md section 4): quicker on mobile data, and
// well under the bucket's 1 MB limit.

/** The longest side of an uploaded photo, in pixels. */
export const PHOTO_MAX = 1280

/** The size a photo is shrunk to: the longest side at most `max`, never enlarged. */
export function fitWithin(width: number, height: number, max = PHOTO_MAX): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height))
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

/** Shrinks a photo and turns it into a JPEG (the phone turns iPhone photos into something it can read). */
export async function shrinkPhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const { width, height } = fitWithin(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not read that photo. Try another one.'))),
      'image/jpeg',
      0.85,
    ),
  )
}
```

Run: `npx vitest run src/lib/photo.test.ts` → PASS.

- [ ] **Step 3: API (`src/lib/api.ts`, in the public-groups section)**

```ts
/** Admins: Public (anyone signed in finds it and joins with one tap) or Private. */
export async function setGroupPublic(groupId: string, isPublic: boolean) {
  unwrap(await supabase.from('groups').update({ is_public: isPublic }).eq('id', groupId))
}

/** Admins: uploads a new group photo (already shrunk), points the group at it, and removes the old one. */
export async function setGroupPhoto(groupId: string, photo: Blob, oldPath: string | null): Promise<string> {
  const path = `${groupId}/${crypto.randomUUID()}.jpg`
  const bucket = supabase.storage.from(GROUP_IMAGES)
  unwrap(await bucket.upload(path, photo, { contentType: 'image/jpeg' }))
  unwrap(await supabase.from('groups').update({ image_path: path }).eq('id', groupId))
  // A leftover old file only takes space, so a failure to remove it is ignored.
  if (oldPath) await bucket.remove([oldPath])
  return path
}

/** Admins: back to the honeycomb with the logo. */
export async function removeGroupPhoto(groupId: string, path: string) {
  unwrap(await supabase.from('groups').update({ image_path: null }).eq('id', groupId))
  await supabase.storage.from(GROUP_IMAGES).remove([path])
}
```

- [ ] **Step 4: The Group card in More (`src/pages/Settings.tsx`)**

Replace `RenameGroup` with `GroupCard` (and `{isAdmin && <RenameGroup />}` with `{isAdmin && <GroupCard />}`). Imports: add `useRef`, `useToast`, `Toggle`, `GroupImage` from `../components/groups` and `shrinkPhoto` from `../lib/photo`.

```tsx
/** Admins: the group's photo, name and Public / Private switch (Plans/Accounts-groups-and-chat.md section 4). */
function GroupCard() {
  const { group, refresh } = useCurrentGroup()
  const toast = useToast()
  const confirm = useConfirm()
  const [name, setName] = useState(group.name)
  const [busy, setBusy] = useState<'name' | 'photo' | 'public' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  async function run(kind: 'name' | 'photo' | 'public', action: () => Promise<unknown>, done: string) {
    setBusy(kind)
    setError(null)
    try {
      await action()
      await refresh()
      toast(done)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  async function pick(file: File | undefined) {
    if (!file) return
    await run('photo', async () => api.setGroupPhoto(group.id, await shrinkPhoto(file), group.image_path), 'Photo saved')
  }

  async function removePhoto() {
    const path = group.image_path
    if (!path) return
    const yes = await confirm({ title: 'Remove the group photo?', confirmLabel: 'Remove', danger: true })
    if (yes) await run('photo', () => api.removeGroupPhoto(group.id, path), 'Photo removed')
  }

  return (
    <Card className="space-y-4">
      <Heading>Group</Heading>
      <div>
        <GroupImage path={group.image_path} className="h-36 w-full rounded-xl" />
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            void pick(e.target.files?.[0])
            e.target.value = ''
          }}
        />
        <div className="mt-2 flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            className="flex-1"
            busy={busy === 'photo'}
            onClick={() => fileInput.current?.click()}
          >
            {group.image_path ? 'Change photo' : 'Add a photo'}
          </Button>
          {group.image_path && (
            <Button size="sm" variant="danger" disabled={busy !== null} onClick={() => void removePhoto()}>
              Remove
            </Button>
          )}
        </div>
        <p className="mt-1 text-xs text-muted">
          Anyone with the photo's web address can see it. Don't use one you wouldn't show strangers.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void run('name', () => api.renameGroup(group.id, name), 'Name saved')
        }}
      >
        <span className="text-sm font-medium">Group name</span>
        <div className="mt-1 flex gap-2">
          <input
            value={name}
            required
            maxLength={60}
            dir="auto"
            aria-label="Group name"
            onChange={(e) => setName(e.target.value)}
            className="h-12 min-w-0 flex-1 rounded-xl border-[1.5px] border-line bg-paper px-3 text-base"
          />
          <Button
            type="submit"
            variant="secondary"
            busy={busy === 'name'}
            disabled={name.trim() === group.name || !name.trim()}
          >
            Save
          </Button>
        </div>
      </form>

      <Toggle
        checked={group.is_public}
        onChange={(on) => {
          if (busy === null) void run('public', () => api.setGroupPublic(group.id, on), on ? 'The group is public' : 'The group is private')
        }}
        label="Public group"
        hint="Anyone signed in can find it in Find and join with one tap. Off: only people with the invite code."
      />
      <ErrorNote message={error} />
    </Card>
  )
}
```

- [ ] **Step 5: Checkpoint**

Run: `npx tsc -b && npm run lint && npm test`
Expected: PASS.

---

### Task 11: Find and account pages

**Files:**
- Create: `src/pages/Find.tsx`, `src/pages/Account.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `api.searchAccounts`, `api.getAccount`, `api.joinPublicGroup`, `PublicGroupList`, `GroupImage`, `useEnterGroup`, `PlayerCard`, `CountUp`.
- Produces: routes `/find`, `/u/:id`, `/me` (outside `RequireGroup`).

- [ ] **Step 1: `src/pages/Find.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { PublicGroupList } from '../components/groups'
import { ChevronIcon } from '../components/icons'
import { Cascade } from '../components/motion'
import { Avatar, Card, ErrorNote, Heading, Name, PageTitle } from '../components/ui'
import * as api from '../lib/api'
import { POSITIONS } from '../lib/card'
import { useLoad } from '../lib/useLoad'

/** Find (/find): search players by name, and the public groups (Plans/Accounts-groups-and-chat.md section 5). */
export default function Find() {
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  // Search once typing pauses.
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(query.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [query])
  const hits = useLoad(() => (search.length >= 2 ? api.searchAccounts(search) : Promise.resolve([])), [search])

  return (
    <Cascade className="space-y-4">
      <PageTitle sub="Players and public groups.">Find</PageTitle>
      <Card>
        <label className="block">
          <span className="text-sm font-medium">Search players</span>
          <input
            type="search"
            enterKeyHint="search"
            dir="auto"
            placeholder="A name, 2 letters or more"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="mt-1 h-12 w-full rounded-xl border-[1.5px] border-line bg-paper px-3 text-base"
          />
        </label>
        <ErrorNote message={hits.error} onRetry={hits.reload} />
        {search.length >= 2 && hits.data && hits.data.length === 0 && (
          <p className="mt-3 text-sm text-muted">Nobody by that name yet.</p>
        )}
        {search.length >= 2 && hits.data && hits.data.length > 0 && (
          <ul className="mt-2 divide-y divide-line">
            {hits.data.map((h) => {
              const position = POSITIONS.find((p) => p.value === h.favourite_position)?.label
              const facts = [h.shirt_number != null && `#${h.shirt_number}`, position].filter(Boolean).join(' · ')
              return (
                <li key={h.user_id}>
                  <Link to={`/u/${h.user_id}`} className="flex min-h-14 items-center gap-3 py-2">
                    <Avatar name={h.display_name} url={h.avatar_url} size={40} />
                    <span className="min-w-0 flex-1">
                      <Name className="block truncate font-bold">{h.display_name}</Name>
                      <span className="text-xs text-muted">{facts || 'Player'}</span>
                    </span>
                    <ChevronIcon size={18} className="text-muted" />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
      <Card>
        <Heading className="mb-1">Public groups</Heading>
        <PublicGroupList />
      </Card>
    </Cascade>
  )
}
```

- [ ] **Step 2: `src/pages/Account.tsx`**

```tsx
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { PlayerCard } from '../components/card'
import { GroupImage, useEnterGroup } from '../components/groups'
import { Cascade, CountUp } from '../components/motion'
import { Button, Card, ErrorNote, Heading, LinkButton, Loading, Name } from '../components/ui'
import * as api from '../lib/api'
import { errorMessage } from '../lib/format'
import type { AccountGroup } from '../lib/types'
import { useLoad } from '../lib/useLoad'
import { useAccount } from '../state/account'
import { useAuth } from '../state/auth'
import { useGroup } from '../state/group'

/**
 * An account page (/u/:id, and /me for yours), Instagram style
 * (Plans/Accounts-groups-and-chat.md section 5): the card, totals across all
 * groups, the skills if shown, and the groups you may see.
 */
export default function Account() {
  const { id } = useParams()
  const { user } = useAuth()
  const { account } = useAccount()
  const { group, myPlayerId, switchGroup } = useGroup()
  const navigate = useNavigate()
  const enter = useEnterGroup()
  const userId = id ?? user?.id ?? ''
  const isMe = userId === user?.id
  // Reloads after you edit your own card.
  const { data, error, loading, reload } = useLoad(() => api.getAccount(userId), [userId, account])
  const [busy, setBusy] = useState<string | null>(null)
  const [joinError, setJoinError] = useState<string | null>(null)

  if (loading && !data) return <Loading />
  if (!data) return <ErrorNote message={error} onRetry={reload} />

  async function join(g: AccountGroup) {
    setBusy(g.id)
    setJoinError(null)
    try {
      await api.joinPublicGroup(g.id, account?.display_name ?? '')
      await enter(g.id, g.name)
    } catch (e) {
      setJoinError(errorMessage(e))
      setBusy(null)
    }
  }

  /** Their full profile in a group you share (switching to it if needed). */
  function seeStats(g: AccountGroup) {
    if (g.id !== group?.id) switchGroup(g.id)
    navigate(`/players/${g.player_id}`)
  }

  const totals = [
    ['Nights', data.nights],
    ['Goals', data.goals],
    ['Man of the Match', data.mvps],
  ] as const

  return (
    <Cascade className="space-y-4">
      <PlayerCard player={data} isMe={isMe} role={isMe ? 'You' : undefined} />
      {isMe && (
        <div className="flex gap-2">
          <LinkButton to="/me/edit" className="flex-1">
            Edit my card
          </LinkButton>
          {group && myPlayerId && (
            <LinkButton to={`/players/${myPlayerId}`} variant="secondary" className="min-w-0 flex-1">
              <span className="truncate">
                My stats in <Name>{group.name}</Name>
              </span>
            </LinkButton>
          )}
        </div>
      )}

      <Card>
        <Heading>{isMe ? 'Your totals' : 'Totals'} · all groups</Heading>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          {totals.map(([label, value]) => (
            <div key={label}>
              <p className="tabular font-display text-3xl">
                <CountUp value={value} />
              </p>
              <p className="text-xs leading-tight text-muted">{label}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <Heading className="mb-1">Groups</Heading>
        <ErrorNote message={joinError} />
        {data.groups.length === 0 ? (
          <p className="text-sm text-muted">{isMe ? "You're not in a group yet." : 'No public groups.'}</p>
        ) : (
          <ul className="divide-y divide-line">
            {data.groups.map((g) => (
              <li key={g.id} className="py-2">
                <div className="flex items-center gap-3">
                  <GroupImage path={g.image_path} className="size-12 shrink-0 rounded-xl" />
                  <div className="min-w-0 flex-1">
                    <Name className="block truncate font-bold">{g.name}</Name>
                    <span className="text-xs text-muted">
                      {g.is_public ? 'Public' : 'Private'}
                      {g.i_am_in && !isMe && ' · you’re in it too'}
                    </span>
                  </div>
                  {!g.i_am_in && g.is_public && (
                    <Button size="sm" busy={busy === g.id} onClick={() => void join(g)}>
                      Join
                    </Button>
                  )}
                  {isMe && g.id === group?.id && <span className="text-sm text-muted">Current</span>}
                  {isMe && g.id !== group?.id && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        switchGroup(g.id)
                        navigate('/')
                      }}
                    >
                      Open
                    </Button>
                  )}
                </div>
                {!isMe && g.i_am_in && g.player_id && (
                  <button
                    type="button"
                    onClick={() => seeStats(g)}
                    className="mt-1 ml-15 min-h-10 text-left text-sm font-semibold text-brand-ink underline"
                  >
                    See their stats in <Name>{g.name}</Name>
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Cascade>
  )
}
```

- [ ] **Step 3: Routes (`src/App.tsx`)**

```tsx
const Account = lazy(() => import('./pages/Account'))
const Find = lazy(() => import('./pages/Find'))
```

and, next to `me/edit` (outside `RequireGroup`):

```tsx
        <Route path="find" element={<Find />} />
        <Route path="me" element={<Account />} />
        <Route path="u/:id" element={<Account />} />
```

- [ ] **Step 4: Checkpoint**

Run: `npx tsc -b && npm run lint && npm test`
Expected: PASS.

---

### Task 12: The Squad page

**Files:**
- Create: `src/pages/Squad.tsx`, `src/components/tabletabs.tsx`
- Modify: `src/pages/Leaderboard.tsx`, `src/App.tsx`

**Interfaces:**
- Produces: `TableTabs({ active: 'table' | 'squad' })`; route `/table/squad` inside `RequireGroup`.

- [ ] **Step 1: `src/components/tabletabs.tsx`**

```tsx
// Table · Squad: the switch at the top of both screens.
import { Link } from 'react-router'

const TABS = [
  { key: 'table', label: 'Table', to: '/table' },
  { key: 'squad', label: 'Squad', to: '/table/squad' },
] as const

export function TableTabs({ active }: { active: 'table' | 'squad' }) {
  return (
    <nav aria-label="Table or squad" className="mb-3 inline-flex overflow-hidden rounded-xl border-2 border-ink">
      {TABS.map((t) => (
        <Link
          key={t.key}
          to={t.to}
          aria-current={active === t.key ? 'page' : undefined}
          className={`flex h-12 min-w-24 items-center justify-center px-4 font-display ${
            active === t.key ? 'bg-brand text-on-brand' : 'bg-paper text-muted'
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  )
}
```

In `src/pages/Leaderboard.tsx`, import it and put `<TableTabs active="table" />` right above `<PageTitle>Table</PageTitle>`.

- [ ] **Step 2: `src/pages/Squad.tsx`**

```tsx
import { useState } from 'react'
import * as m from 'motion/react-m'
import { Link } from 'react-router'
import { TableTabs } from '../components/tabletabs'
import { Avatar, Name, PageTitle, RatingBadge } from '../components/ui'
import * as api from '../lib/api'
import { POSITIONS } from '../lib/card'
import { cascade, cascadeItem } from '../lib/motion'
import type { Player } from '../lib/types'
import { useLoad } from '../lib/useLoad'
import { useCurrentGroup } from '../state/group'

/**
 * The Squad (/table/squad, Plans/Accounts-groups-and-chat.md section 5):
 * everyone in the group as a mini card, sorted by name. Tap one for their
 * profile.
 */
export default function Squad() {
  const { group, players, members } = useCurrentGroup()
  const [year] = useState(() => new Date().getFullYear())
  const ratings = useLoad(() => api.getRatingAverages(group.id, year), [group.id, year])

  // Members, plus players without an account (the demo players, guests later).
  const memberIds = new Set(members.map((mb) => mb.player_id))
  const squad = players
    .filter((p) => memberIds.has(p.id) || !p.user_id)
    .sort((a, b) => a.display_name.localeCompare(b.display_name))
  const rating = (id: string) => ratings.data?.season.get(id) ?? ratings.data?.allTime.get(id)

  return (
    <div>
      <TableTabs active="squad" />
      <PageTitle sub={`${squad.length} players in ${group.name}`}>Squad</PageTitle>
      <m.ul className="grid grid-cols-2 gap-3" initial="initial" animate="animate" variants={cascade}>
        {squad.map((p) => (
          <m.li key={p.id} variants={cascadeItem}>
            <SquadCard player={p} rating={rating(p.id)} />
          </m.li>
        ))}
      </m.ul>
    </div>
  )
}

function SquadCard({ player, rating }: { player: Player; rating: number | undefined }) {
  const position = POSITIONS.find((p) => p.value === player.favourite_position)
  return (
    <Link to={`/players/${player.id}`} className="block overflow-hidden rounded-card border-2 border-ink bg-paper">
      {/* A green surface, so its text is black. */}
      <div className="honeycomb flex h-14 items-center justify-between px-3 text-on-brand">
        <span className="font-display text-3xl leading-none" aria-label={player.shirt_number ? `Shirt number ${player.shirt_number}` : undefined}>
          {player.shirt_number ?? ''}
        </span>
        {rating != null ? (
          <RatingBadge value={Math.round(rating * 10) / 10} size="sm" className="border-2 border-[#0b0b0b]" />
        ) : (
          <span className="chip bg-[#ffffff]">New</span>
        )}
      </div>
      <div className="flex flex-col items-center gap-1 p-3 text-center">
        <Avatar name={player.display_name} url={player.avatar_url} size={48} />
        <Name className="w-full truncate font-bold">{player.display_name}</Name>
        {position ? <span className="chip status">{position.label}</span> : <span className="h-6" />}
      </div>
    </Link>
  )
}
```

(`getRatingAverages` already gives each player's season and all-time averages, exactly what the team suggester uses.)

- [ ] **Step 3: Route (`src/App.tsx`)**

```tsx
const Squad = lazy(() => import('./pages/Squad'))
```

inside `RequireGroup`, after `table`: `<Route path="table/squad" element={<Squad />} />`.

- [ ] **Step 4: Checkpoint**

Run: `npx tsc -b && npm run lint && npm test`
Expected: PASS.

---

## Part E — Chat

### Task 13: The group chat

**Files:**
- Create: `src/lib/chat.ts`, `src/lib/chat.test.ts`, `src/state/chat.tsx`, `src/pages/Chat.tsx`
- Modify: `src/lib/types.ts`, `src/lib/api.ts`, `src/components/Layout.tsx`, `src/App.tsx`

**Interfaces:**
- Produces (types): `ChatMessage { id, group_id, player_id, user_id, body: string | null, created_at, deleted_at }`.
- Produces (lib): `CHAT_GAP_MINUTES = 5`, `mergeMessages(current, incoming)`, `hasUnread(latest, lastRead, myUserId)`, `dayLabel(iso, now)`, `chatRows(messages, now): ChatRow[]`.
- Produces (api): `CHAT_PAGE = 50`, `getMessages(groupId, before)`, `getMessage(id)`, `sendMessage(groupId, body)`, `deleteMessage(id)`, `watchMessages(groupId, onChange(id), onLive(live)) → stop()`.
- Produces (state): `ChatProvider`, `useChat() → { messages, loading, error, live, hasOlder, unread, send, remove, loadOlder, markRead }`.
- Produces (UI): route `/chat`; the Chat tab with its dot (tabs **Home · Nights · Chat · Table · More**).

- [ ] **Step 1: The type (`src/lib/types.ts`)**

```ts
/** One chat message (group_messages). A deleted one has no body. */
export interface ChatMessage {
  id: string
  group_id: string
  /** The author's player in this group (their name and photo there). */
  player_id: string
  user_id: string | null
  body: string | null
  created_at: string
  deleted_at: string | null
}
```

- [ ] **Step 2: Write the failing test: `src/lib/chat.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { chatRows, dayLabel, hasUnread, mergeMessages } from './chat'
import type { ChatMessage } from './types'

/** A message at a local time on 26 October 2026 (or another day of the month). */
function msg(id: string, player: string, hour: number, minute: number, day = 26): ChatMessage {
  return {
    id,
    group_id: 'g',
    player_id: player,
    user_id: `u-${player}`,
    body: 'hi',
    created_at: new Date(2026, 9, day, hour, minute).toISOString(),
    deleted_at: null,
  }
}

const now = new Date(2026, 9, 26, 21, 0)

describe('the chat', () => {
  it('merges new and changed messages, oldest first, once each', () => {
    const a = msg('a', 'omar', 20, 0)
    const b = msg('b', 'ziad', 20, 5)
    expect(mergeMessages([b], [a]).map((m) => m.id)).toEqual(['a', 'b'])
    expect(mergeMessages([a, b], [{ ...a, body: null, deleted_at: 'now' }])[0].body).toBeNull()
    expect(mergeMessages([a, b], [a, b])).toHaveLength(2)
  })

  it('shows the dot when someone else wrote after the newest message you saw', () => {
    const fromZiad = msg('b', 'ziad', 20, 5)
    expect(hasUnread(undefined, null, 'u-omar')).toBe(false)
    expect(hasUnread(fromZiad, null, 'u-omar')).toBe(true)
    expect(hasUnread(fromZiad, msg('a', 'omar', 20, 0).created_at, 'u-omar')).toBe(true)
    expect(hasUnread(fromZiad, fromZiad.created_at, 'u-omar')).toBe(false)
    expect(hasUnread(msg('c', 'omar', 20, 9), null, 'u-omar')).toBe(false) // your own
  })

  it('a day line where the day changes; one name and one time per run of messages', () => {
    const rows = chatRows(
      [msg('y', 'ziad', 22, 0, 25), msg('1', 'omar', 20, 0), msg('2', 'omar', 20, 3), msg('3', 'ziad', 20, 4), msg('4', 'omar', 20, 20)],
      now,
    )
    expect(rows.map((r) => (r.kind === 'day' ? r.label : `${r.message.id}:${r.first ? 'F' : ''}${r.last ? 'L' : ''}`))).toEqual(
      ['Yesterday', 'y:FL', 'Today', '1:F', '2:L', '3:FL', '4:FL'],
    )
  })

  it('older days show the date', () => {
    expect(dayLabel(new Date(2026, 9, 22, 20, 0).toISOString(), now)).toBe('Thu 22 Oct')
  })
})
```

Run: `npx vitest run src/lib/chat.test.ts` → FAIL (no module).

- [ ] **Step 3: `src/lib/chat.ts`**

```ts
// The group chat (Plans/Accounts-groups-and-chat.md section 6). Pure
// functions, tested in chat.test.ts.
import { dayOf, formatDay } from './format'
import type { ChatMessage } from './types'

/** Messages by the same player this close together share one name and one time. */
export const CHAT_GAP_MINUTES = 5

const time = (iso: string) => Date.parse(iso)
const sameDay = (a: string, b: string) => dayOf(new Date(a)) === dayOf(new Date(b))

/** Adds new or changed messages (matched by id) and keeps them oldest first. */
export function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const byId = new Map(current.map((m) => [m.id, m]))
  for (const m of incoming) byId.set(m.id, m)
  return [...byId.values()].sort((a, b) => time(a.created_at) - time(b.created_at) || a.id.localeCompare(b.id))
}

/** The dot on the Chat tab: someone else wrote after the newest message you've seen. */
export function hasUnread(latest: ChatMessage | undefined, lastRead: string | null, myUserId: string | undefined): boolean {
  if (!latest || latest.user_id === myUserId) return false
  return lastRead === null || time(latest.created_at) > time(lastRead)
}

/** "Today", "Yesterday" or "Thu 22 Oct" */
export function dayLabel(iso: string, now: Date): string {
  const day = dayOf(new Date(iso))
  if (day === dayOf(now)) return 'Today'
  if (day === dayOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))) return 'Yesterday'
  return formatDay(day)
}

export type ChatRow =
  | { kind: 'day'; key: string; label: string }
  | {
      kind: 'message'
      key: string
      message: ChatMessage
      /** The start of a run: show the name and photo. */
      first: boolean
      /** The end of a run: show the time. */
      last: boolean
    }

/** One run: the same player, the same day, at most CHAT_GAP_MINUTES apart. */
function sameRun(a: ChatMessage | undefined, b: ChatMessage | undefined): boolean {
  return (
    !!a &&
    !!b &&
    a.player_id === b.player_id &&
    sameDay(a.created_at, b.created_at) &&
    Math.abs(time(b.created_at) - time(a.created_at)) <= CHAT_GAP_MINUTES * 60_000
  )
}

/** The chat as rows: a day line where the day changes, and messages grouped into runs. */
export function chatRows(messages: ChatMessage[], now: Date): ChatRow[] {
  const rows: ChatRow[] = []
  messages.forEach((m, i) => {
    const before = messages[i - 1]
    if (!before || !sameDay(before.created_at, m.created_at)) {
      rows.push({ kind: 'day', key: `day-${m.id}`, label: dayLabel(m.created_at, now) })
    }
    rows.push({ kind: 'message', key: m.id, message: m, first: !sameRun(before, m), last: !sameRun(m, messages[i + 1]) })
  })
  return rows
}
```

Run: `npx vitest run src/lib/chat.test.ts` → PASS.

- [ ] **Step 4: API (`src/lib/api.ts`)**

Add `ChatMessage` to the type import, and:

```ts
// ---------------------------------------------------------------------------
// The group chat (Plans/Accounts-groups-and-chat.md section 6)
// ---------------------------------------------------------------------------
export const CHAT_PAGE = 50

/** A page of the chat, newest first: the latest, or the ones before a time. */
export async function getMessages(groupId: string, before: string | null): Promise<ChatMessage[]> {
  let query = supabase.from('group_messages').select('*').eq('group_id', groupId)
  if (before) query = query.lt('created_at', before)
  return unwrap(await query.order('created_at', { ascending: false }).limit(CHAT_PAGE))
}

export async function getMessage(id: string): Promise<ChatMessage | null> {
  return unwrap(await supabase.from('group_messages').select('*').eq('id', id).maybeSingle())
}

export const sendMessage = (groupId: string, body: string) =>
  rpc<string>('send_message', { p_group_id: groupId, p_body: body })

export const deleteMessage = (id: string) => rpc('delete_message', { p_message_id: id })

/**
 * Calls onChange with a message's id whenever one is sent or deleted in the
 * group (Supabase Realtime), and onLive with whether the connection is up.
 * The event is only a signal: the app reads the message itself, through the
 * normal API. Returns a function that stops listening.
 */
export function watchMessages(groupId: string, onChange: (id: string) => void, onLive: (live: boolean) => void) {
  const filter = `group_id=eq.${groupId}`
  const changed = (payload: { new: { id?: string } }) => {
    if (payload.new.id) onChange(payload.new.id)
  }
  const channel = supabase
    .channel(`chat:${groupId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages', filter }, changed)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'group_messages', filter }, changed)
    .subscribe((status) => onLive(status === 'SUBSCRIBED'))
  return () => {
    void supabase.removeChannel(channel)
  }
}
```

- [ ] **Step 5: `src/state/chat.tsx`**

```tsx
// The group chat's state (Plans/Accounts-groups-and-chat.md section 6): one
// live connection per open app, shared by the Chat tab, its dot and Home.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as api from '../lib/api'
import { hasUnread, mergeMessages } from '../lib/chat'
import { errorMessage } from '../lib/format'
import { KEYS, readLocal, writeLocal } from '../lib/storage'
import type { ChatMessage } from '../lib/types'
import { useAuth } from './auth'
import { useGroup } from './group'

/** How often to check for new messages while the live connection is down. */
const POLL_MS = 10_000

interface ChatState {
  /** Oldest first. */
  messages: ChatMessage[]
  loading: boolean
  error: string | null
  /** The live connection is up (otherwise it checks every 10 seconds). */
  live: boolean
  /** There may be older messages to load. */
  hasOlder: boolean
  /** Someone else wrote since you last had the chat open. */
  unread: boolean
  send: (body: string) => Promise<void>
  remove: (id: string) => Promise<void>
  loadOlder: () => Promise<void>
  /** The chat is on screen: everything in it counts as seen. */
  markRead: () => void
}

const none = async () => {}
const NO_CHAT: ChatState = {
  messages: [],
  loading: false,
  error: null,
  live: false,
  hasOlder: false,
  unread: false,
  send: none,
  remove: none,
  loadOlder: none,
  markRead: () => {},
}

const ChatContext = createContext<ChatState>(NO_CHAT)

/** A fresh chat for each group (none without a group). */
export function ChatProvider({ children }: { children: ReactNode }) {
  const { group } = useGroup()
  if (!group) return <ChatContext.Provider value={NO_CHAT}>{children}</ChatContext.Provider>
  return (
    <ChatSession key={group.id} groupId={group.id}>
      {children}
    </ChatSession>
  )
}

function ChatSession({ groupId, children }: { groupId: string; children: ReactNode }) {
  const { user } = useAuth()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [live, setLive] = useState(false)
  const [hasOlder, setHasOlder] = useState(false)
  const readKey = `${KEYS.chatLastRead}.${groupId}`
  const [lastRead, setLastRead] = useState(() => readLocal(readKey))
  const liveRef = useRef(false)

  const loadLatest = useCallback(async () => {
    const page = await api.getMessages(groupId, null)
    setMessages((list) => mergeMessages(list, page))
    setError(null)
    return page
  }, [groupId])

  // All state changes below happen after network calls or events.
  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect
    loadLatest()
      .then((page) => setHasOlder(page.length === api.CHAT_PAGE))
      .catch((e: unknown) => setError(errorMessage(e)))
      .finally(() => setLoading(false))
    const stop = api.watchMessages(
      groupId,
      (id) =>
        void api
          .getMessage(id)
          .then((m) => m && setMessages((list) => mergeMessages(list, [m])))
          .catch(() => undefined),
      (up) => {
        liveRef.current = up
        setLive(up)
      },
    )
    const timer = window.setInterval(() => {
      if (!liveRef.current && document.visibilityState === 'visible') void loadLatest().catch(() => undefined)
    }, POLL_MS)
    return () => {
      stop()
      window.clearInterval(timer)
    }
  }, [groupId, loadLatest])

  const newest = messages.at(-1)

  const markRead = useCallback(() => {
    if (!newest || newest.created_at === lastRead) return
    writeLocal(readKey, newest.created_at)
    setLastRead(newest.created_at)
  }, [newest, lastRead, readKey])

  // Re-reading the latest page shows your message even when the live connection is down.
  const send = useCallback(
    async (body: string) => {
      await api.sendMessage(groupId, body)
      await loadLatest()
    },
    [groupId, loadLatest],
  )

  const remove = useCallback(async (id: string) => {
    await api.deleteMessage(id)
    const fresh = await api.getMessage(id)
    if (fresh) setMessages((list) => mergeMessages(list, [fresh]))
  }, [])

  const loadOlder = useCallback(async () => {
    const oldest = messages[0]
    if (!oldest) return
    const page = await api.getMessages(groupId, oldest.created_at)
    setMessages((list) => mergeMessages(list, page))
    setHasOlder(page.length === api.CHAT_PAGE)
  }, [groupId, messages])

  const unread = hasUnread(newest, lastRead, user?.id)
  const value = useMemo<ChatState>(
    () => ({ messages, loading, error, live, hasOlder, unread, send, remove, loadOlder, markRead }),
    [messages, loading, error, live, hasOlder, unread, send, remove, loadOlder, markRead],
  )
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

// eslint-disable-next-line react/only-export-components
export const useChat = () => useContext(ChatContext)
```

- [ ] **Step 6: `src/pages/Chat.tsx`**

```tsx
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useConfirm } from '../components/feedback'
import { Avatar, Button, Empty, ErrorNote, Loading, Name, PageTitle } from '../components/ui'
import { chatRows, type ChatRow } from '../lib/chat'
import { clockOf, errorMessage } from '../lib/format'
import { useNow } from '../lib/useNow'
import { useChat } from '../state/chat'
import { useCurrentGroup } from '../state/group'

/**
 * The group chat (/chat, Plans/Accounts-groups-and-chat.md section 6): text
 * only, newest at the bottom. Tap your message (any message, for admins) to
 * delete it.
 */
export default function Chat() {
  const { messages, loading, error, live, hasOlder, send, remove, loadOlder, markRead } = useChat()
  const { group, myPlayerId, isAdmin, player, playerName } = useCurrentGroup()
  const confirm = useConfirm()
  const now = useNow(60_000)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState<'send' | 'older' | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [picked, setPicked] = useState<string | null>(null)
  const end = useRef<HTMLDivElement>(null)
  const newestId = messages.at(-1)?.id

  // A new message at the bottom: it counts as seen, and the screen scrolls to it.
  useEffect(() => {
    markRead()
    end.current?.scrollIntoView({ block: 'end' })
  }, [newestId, markRead])

  async function submit(e: FormEvent) {
    e.preventDefault()
    const body = text.trim()
    if (!body) return
    setBusy('send')
    setActionError(null)
    try {
      await send(body)
      setText('')
    } catch (err) {
      setActionError(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  async function older() {
    setBusy('older')
    try {
      await loadOlder()
    } catch (err) {
      setActionError(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  async function deleteMessage(id: string) {
    const yes = await confirm({
      title: 'Delete this message?',
      message: 'Everyone sees "Message deleted" instead.',
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!yes) return
    try {
      await remove(id)
      setPicked(null)
    } catch (err) {
      setActionError(errorMessage(err))
    }
  }

  if (loading && messages.length === 0) return <Loading />

  return (
    <div>
      <PageTitle sub={<Name>{group.name}</Name>}>Chat</PageTitle>
      <ErrorNote message={error} />
      {!live && <p className="mb-2 text-xs text-muted">Checking for new messages every 10 seconds.</p>}
      {hasOlder && (
        <Button variant="ghost" size="sm" className="mb-2 w-full" busy={busy === 'older'} onClick={() => void older()}>
          Show older
        </Button>
      )}

      {messages.length === 0 ? (
        <Empty title="No messages yet">Say hi to the group.</Empty>
      ) : (
        <ol aria-label="Messages" className="space-y-1 pb-4">
          {chatRows(messages, now).map((row) =>
            row.kind === 'day' ? (
              <li key={row.key} className="py-2 text-center">
                <span className="label">{row.label}</span>
              </li>
            ) : (
              <MessageRow
                key={row.key}
                row={row}
                mine={row.message.player_id === myPlayerId}
                canDelete={row.message.player_id === myPlayerId || isAdmin}
                name={playerName(row.message.player_id)}
                avatar={player(row.message.player_id)?.avatar_url ?? null}
                picked={picked === row.message.id}
                onPick={() => setPicked(picked === row.message.id ? null : row.message.id)}
                onDelete={() => void deleteMessage(row.message.id)}
              />
            ),
          )}
        </ol>
      )}
      <div ref={end} />

      <form
        onSubmit={submit}
        className="sticky bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-10 -mx-4 mt-2 border-t-[1.5px] border-line bg-ground px-4 py-2"
      >
        <ErrorNote message={actionError} />
        <div className="flex items-end gap-2">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Message</span>
            <textarea
              rows={1}
              maxLength={500}
              dir="auto"
              placeholder="Message the group"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="block max-h-32 min-h-12 w-full resize-none rounded-xl border-[1.5px] border-line bg-paper px-3 py-3 text-base"
            />
          </label>
          <Button type="submit" busy={busy === 'send'} disabled={!text.trim()}>
            Send
          </Button>
        </div>
        {text.length > 400 && <p className="tabular mt-1 text-right text-xs text-muted">{text.length}/500</p>}
      </form>
    </div>
  )
}

function MessageRow({
  row,
  mine,
  canDelete,
  name,
  avatar,
  picked,
  onPick,
  onDelete,
}: {
  row: Extract<ChatRow, { kind: 'message' }>
  mine: boolean
  canDelete: boolean
  name: string
  avatar: string | null
  picked: boolean
  onPick: () => void
  onDelete: () => void
}) {
  const { message, first, last } = row
  const deleted = message.body === null
  // Your messages are green with black text (text on the brand green is always black).
  const bubble = `rounded-2xl border-[1.5px] px-3 py-2 text-left ${
    mine ? 'border-[#0b0b0b] bg-brand text-on-brand' : 'border-line bg-paper text-ink'
  } ${deleted ? 'italic opacity-70' : ''}`
  const content = deleted ? (
    'Message deleted'
  ) : (
    <span dir="auto" className="block break-words whitespace-pre-wrap">
      {message.body}
    </span>
  )
  return (
    <li className={`flex gap-2 ${mine ? 'justify-end' : ''} ${first ? 'pt-2' : ''}`}>
      {!mine && <span className="w-8 shrink-0">{first && <Avatar name={name} url={avatar} size={32} />}</span>}
      <div className={`flex max-w-[78%] flex-col ${mine ? 'items-end' : 'items-start'}`}>
        {first && !mine && <Name className="mb-0.5 text-xs font-bold text-muted">{name}</Name>}
        {canDelete && !deleted ? (
          <button type="button" aria-expanded={picked} onClick={onPick} className={bubble}>
            {content}
          </button>
        ) : (
          <div className={bubble}>{content}</div>
        )}
        {last && <span className="mt-0.5 text-[11px] text-muted">{clockOf(message.created_at)}</span>}
        {picked && (
          <Button size="sm" variant="danger" className="mt-1" onClick={onDelete}>
            Delete
          </Button>
        )}
      </div>
    </li>
  )
}
```

- [ ] **Step 7: The Chat tab and its dot (`src/components/Layout.tsx`)**

```tsx
import { useChat } from '../state/chat'
import { ChatIcon, HomeIcon, MatchesIcon, MoreIcon, SearchIcon, TableIcon } from './icons'
```

In `Layout`, add `const { unread } = useChat()` and `const dot = unread && pathname !== '/chat'`, and the Chat tab between Nights and Table:

```tsx
        { to: '/chat', label: 'Chat', icon: ChatIcon, end: false },
```

Inside the tab's bubble `<span className="relative …">`, after the icon:

```tsx
                      {label === 'Chat' && dot && (
                        <span aria-hidden className="absolute top-0 right-1.5 size-2.5 rounded-full border-2 border-paper bg-danger" />
                      )}
```

and after `{label}`: `{label === 'Chat' && dot && <span className="sr-only">, new messages</span>}`.

- [ ] **Step 8: Route and provider (`src/App.tsx`)**

```tsx
import { ChatProvider } from './state/chat'
const Chat = lazy(() => import('./pages/Chat'))
```

In `GroupGate`, wrap `<Routes>…</Routes>` in `<ChatProvider>…</ChatProvider>`, and add `<Route path="chat" element={<Chat />} />` inside `RequireGroup`.

- [ ] **Step 9: Checkpoint**

Run: `npx tsc -b && npm run lint && npm test`
Expected: PASS. If `tsc` complains about the `postgres_changes` callback's type, type `changed`'s parameter as `RealtimePostgresChangesPayload<{ id: string }>` (from `@supabase/supabase-js`) and read `'id' in payload.new ? payload.new.id : undefined`.

---

## Part F — The pitch and InstaPay

### Task 14: Google Maps links and the map helper

**Files:**
- Create: `src/lib/maplink.ts`, `src/lib/maplink.test.ts`, `api/map-link.ts`, `tests/api/map-link.test.ts`
- Modify: `vercel.json`, `vite.config.ts`, `tsconfig.node.json`

**Interfaces:**
- Produces (lib): `MapPosition { lat, lng }`, `isGoogleMapsUrl(url)`, `isShortMapUrl(url)`, `coordsFromMapUrl(url): MapPosition | null`, `mapEmbedUrl(position)`.
- Produces (function): `GET /api/map-link?url=<link>` → `200 { url: "<full Google Maps address>" }`, `422 { url: null }` (not a Google link, or nowhere to go), `504 { url: null }` (too slow). Exports `isGoogleHost(host)`, `expandMapLink(start, fetcher?, timeLimitMs?)`, `default { fetch }`.

- [ ] **Step 1: Write the failing tests**

`src/lib/maplink.test.ts` (the spec's table, section 7):

```ts
import { describe, expect, it } from 'vitest'
import { coordsFromMapUrl, isGoogleMapsUrl, isShortMapUrl, mapEmbedUrl } from './maplink'

describe('Google Maps links', () => {
  it("finds a place's pin before the map's view", () => {
    expect(
      coordsFromMapUrl(
        'https://www.google.com/maps/place/Club/@30.0444,31.2357,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d30.0450!4d31.2360',
      ),
    ).toEqual({ lat: 30.045, lng: 31.236 })
  })

  it('reads the map view, q= and query=', () => {
    expect(coordsFromMapUrl('https://www.google.com/maps/@30.0444,31.2357,15z')).toEqual({ lat: 30.0444, lng: 31.2357 })
    expect(coordsFromMapUrl('https://maps.google.com/?q=30.0444,31.2357')).toEqual({ lat: 30.0444, lng: 31.2357 })
    expect(coordsFromMapUrl('https://www.google.com/maps/search/?api=1&query=29.9792,31.1342')).toEqual({
      lat: 29.9792,
      lng: 31.1342,
    })
  })

  it('short share links are Google Maps links that need the helper', () => {
    expect(isShortMapUrl('https://maps.app.goo.gl/AbC123')).toBe(true)
    expect(isGoogleMapsUrl('https://maps.app.goo.gl/AbC123')).toBe(true)
    expect(coordsFromMapUrl('https://maps.app.goo.gl/AbC123')).toBeNull()
  })

  it('a place name without a position is a link only', () => {
    expect(isGoogleMapsUrl('https://www.google.com/maps/place/Club+Pitch')).toBe(true)
    expect(coordsFromMapUrl('https://www.google.com/maps/place/Club+Pitch')).toBeNull()
  })

  it('refuses other sites, plain http and impossible positions', () => {
    expect(isGoogleMapsUrl('https://example.com/@30.0444,31.2357')).toBe(false)
    expect(coordsFromMapUrl('https://example.com/@30.0444,31.2357')).toBeNull()
    expect(isGoogleMapsUrl('http://maps.google.com/?q=1,2')).toBe(false)
    expect(isGoogleMapsUrl('https://www.google.com/search?q=pitch')).toBe(false)
    expect(coordsFromMapUrl('https://www.google.com/maps/@95.1,31.2,15z')).toBeNull()
  })

  it('Google Egypt works too', () => {
    expect(coordsFromMapUrl('https://www.google.com.eg/maps/@30.1,31.2,15z')).toEqual({ lat: 30.1, lng: 31.2 })
  })

  it("embeds Google's map with a pin", () => {
    expect(mapEmbedUrl({ lat: 30.0444, lng: 31.2357 })).toBe('https://maps.google.com/maps?q=30.0444,31.2357&z=16&output=embed')
  })
})
```

`tests/api/map-link.test.ts`:

```ts
// The map helper (api/map-link.ts) with a fake fetch: it follows Google's
// short links, Google addresses only, at most 5 redirects, within a time limit.
import { describe, expect, it, vi } from 'vitest'
import handler, { expandMapLink, isGoogleHost } from '../../api/map-link'

/** A fake fetch: each address in the chain redirects to the next. */
function redirects(chain: Record<string, string>) {
  return vi.fn(async (input: string | URL | Request) => {
    const location = chain[String(input)]
    return new Response(null, location ? { status: 302, headers: { location } } : { status: 200 })
  }) as unknown as typeof fetch
}

const FULL = 'https://www.google.com/maps/place/Club/@30.0444,31.2357,17z'

describe('the map helper', () => {
  it('follows a short link to the full Google Maps address', async () => {
    const fetcher = redirects({ 'https://maps.app.goo.gl/AbC123': FULL })
    expect(await expandMapLink('https://maps.app.goo.gl/AbC123', fetcher)).toBe(FULL)
  })

  it("passes Google's cookie page through to its 'continue' address", async () => {
    const consent = `https://consent.google.com/m?continue=${encodeURIComponent(FULL)}`
    const fetcher = redirects({ 'https://maps.app.goo.gl/AbC123': consent })
    expect(await expandMapLink('https://maps.app.goo.gl/AbC123', fetcher)).toBe(FULL)
  })

  it('refuses anything that is not Google, at the start or on the way', async () => {
    expect(await expandMapLink('https://example.com/x', redirects({}))).toBeNull()
    expect(await expandMapLink('http://maps.app.goo.gl/x', redirects({}))).toBeNull()
    const fetcher = redirects({ 'https://maps.app.goo.gl/evil': 'https://evil.example.com/' })
    expect(await expandMapLink('https://maps.app.goo.gl/evil', fetcher)).toBeNull()
  })

  it('gives up after 5 redirects', async () => {
    const fetcher = redirects({ 'https://maps.app.goo.gl/a': 'https://maps.app.goo.gl/b', 'https://maps.app.goo.gl/b': 'https://maps.app.goo.gl/a' })
    expect(await expandMapLink('https://maps.app.goo.gl/a', fetcher)).toBeNull()
    expect(fetcher).toHaveBeenCalledTimes(5)
  })

  it('gives up when Google takes too long', async () => {
    const slow = ((_input: unknown, init?: RequestInit) =>
      new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted'))))) as unknown as typeof fetch
    await expect(expandMapLink('https://maps.app.goo.gl/slow', slow, 10)).rejects.toThrow()
  })

  it('knows Google addresses', () => {
    for (const host of ['maps.app.goo.gl', 'goo.gl', 'www.google.com', 'maps.google.com', 'www.google.com.eg', 'consent.google.com']) {
      expect(isGoogleHost(host)).toBe(true)
    }
    for (const host of ['google.com.evil.com', 'evilgoogle.com', 'example.com']) expect(isGoogleHost(host)).toBe(false)
  })

  it('answers with the full address, or 422 when there is none', async () => {
    const ok = await handler.fetch(new Request(`https://x.test/api/map-link?url=${encodeURIComponent(FULL)}`))
    expect(ok.status).toBe(200)
    expect(await ok.json()).toEqual({ url: FULL })
    const bad = await handler.fetch(new Request('https://x.test/api/map-link?url=https%3A%2F%2Fexample.com'))
    expect(bad.status).toBe(422)
  })
})
```

Run: `npx vitest run src/lib/maplink.test.ts tests/api/map-link.test.ts` → FAIL (no modules).

- [ ] **Step 2: `src/lib/maplink.ts`**

```ts
// The pitch's Google Maps link (Plans/Accounts-groups-and-chat.md section 7):
// which links count, and where the pitch is on the map. Pure functions,
// tested in maplink.test.ts.

export interface MapPosition {
  lat: number
  lng: number
}

const GOOGLE_HOST = /^(www\.|maps\.)?google\.[a-z]{2,3}(\.[a-z]{2})?$/
const NUM = String.raw`(-?\d{1,3}(?:\.\d+)?)`
/** A place's pin: …!3d30.0450!4d31.2360 */
const PIN = new RegExp(String.raw`!3d${NUM}!4d${NUM}`)
/** The map's view: …/@30.0444,31.2357,17z */
const VIEW = new RegExp(`@${NUM},${NUM}`)
/** …/place/30.0444,31.2357 or …/search/30.0444,+31.2357 */
const PATH = new RegExp(String.raw`/(?:place|search)/${NUM},\+?${NUM}`)
/** q=30.0444,31.2357 */
const PAIR = new RegExp(String.raw`^\s*${NUM}\s*,\s*${NUM}\s*$`)

function parse(link: string): URL | null {
  try {
    const url = new URL(link.trim())
    return url.protocol === 'https:' ? url : null
  } catch {
    return null
  }
}

/** maps.app.goo.gl/…: Google's short share links. Only the helper (/api/map-link) can open them. */
export function isShortMapUrl(link: string): boolean {
  const url = parse(link)
  return !!url && (url.hostname === 'maps.app.goo.gl' || (url.hostname === 'goo.gl' && url.pathname.startsWith('/maps')))
}

export function isGoogleMapsUrl(link: string): boolean {
  const url = parse(link)
  if (!url) return false
  if (isShortMapUrl(link)) return true
  return GOOGLE_HOST.test(url.hostname) && (url.hostname.startsWith('maps.') || url.pathname.startsWith('/maps'))
}

function position(lat: string, lng: string): MapPosition | null {
  const p = { lat: Number(lat), lng: Number(lng) }
  return Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180 ? p : null
}

/** Where the pitch is, from a full Google Maps link: the place's pin, else q=, else the map's view. */
export function coordsFromMapUrl(link: string): MapPosition | null {
  const url = parse(link)
  if (!url || !isGoogleMapsUrl(link) || isShortMapUrl(link)) return null
  let text = url.href
  try {
    text = decodeURIComponent(text)
  } catch {
    // A broken % sequence: read the link as it is.
  }
  const pin = text.match(PIN)
  if (pin) return position(pin[1], pin[2])
  for (const key of ['q', 'query', 'll', 'center', 'destination']) {
    const pair = url.searchParams.get(key)?.match(PAIR)
    if (pair) return position(pair[1], pair[2])
  }
  const view = text.match(VIEW) ?? text.match(PATH)
  return view ? position(view[1], view[2]) : null
}

/** Google's map with a pin, for an iframe (no API key needed). */
export function mapEmbedUrl({ lat, lng }: MapPosition): string {
  return `https://maps.google.com/maps?q=${lat},${lng}&z=16&output=embed`
}
```

- [ ] **Step 3: `api/map-link.ts`**

```ts
// The map helper (Plans/Accounts-groups-and-chat.md section 7): Google's
// short share links (maps.app.goo.gl/…) hide the pitch's position, so the
// app asks this Vercel function to follow them to the full Google Maps
// address. It only ever fetches Google addresses, gives up after 5 redirects
// or 5 seconds, and stores nothing. The app then finds the position in the
// address (src/lib/maplink.ts). `npm run dev` runs it too (vite.config.ts).

const MAX_HOPS = 5
const TIME_LIMIT_MS = 5000
const SHORT_HOSTS = new Set(['maps.app.goo.gl', 'goo.gl'])

/** The addresses a short link may pass through: Google's own. */
export function isGoogleHost(host: string): boolean {
  return SHORT_HOSTS.has(host) || /^([a-z]+\.)?google\.[a-z]{2,3}(\.[a-z]{2})?$/.test(host)
}

/** Follows a short link's redirects to the full Google address. null when it isn't Google or goes nowhere. */
export async function expandMapLink(
  start: string,
  fetcher: typeof fetch = fetch,
  timeLimitMs = TIME_LIMIT_MS,
): Promise<string | null> {
  let url: URL
  try {
    url = new URL(start)
  } catch {
    return null
  }
  const signal = AbortSignal.timeout(timeLimitMs)
  for (let hop = 0; hop < MAX_HOPS; hop++) {
    if (url.protocol !== 'https:' || !isGoogleHost(url.hostname)) return null
    // Google's cookie page carries the real address in "continue".
    const next = url.hostname === 'consent.google.com' ? url.searchParams.get('continue') : null
    if (next) {
      try {
        url = new URL(next)
      } catch {
        return null
      }
      continue
    }
    if (!SHORT_HOSTS.has(url.hostname)) return url.toString()
    const response = await fetcher(url.toString(), { redirect: 'manual', signal })
    const location = response.headers.get('location')
    if (!location) return null
    url = new URL(location, url)
  }
  return null
}

export default {
  async fetch(request: Request): Promise<Response> {
    const link = new URL(request.url).searchParams.get('url') ?? ''
    try {
      const url = await expandMapLink(link)
      return Response.json({ url }, { status: url ? 200 : 422, headers: { 'cache-control': 'public, max-age=86400' } })
    } catch {
      return Response.json({ url: null }, { status: 504 })
    }
  },
}
```

(A full Google link passed in comes straight back, without any fetch.)

Run: `npx vitest run src/lib/maplink.test.ts tests/api/map-link.test.ts` → PASS.

- [ ] **Step 4: Vercel, Vite and TypeScript settings**

`vercel.json`: the app's rewrite leaves the function alone.

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "rewrites": [{ "source": "/((?!api/).*)", "destination": "/index.html" }]
}
```

`tsconfig.node.json`: `"include": ["vite.config.ts", "vitest.config.ts", "pwa-assets.config.ts", "api"]`.

`vite.config.ts`: add the plugin and put `mapLinkInDev()` in `plugins` after `siteUrlInHtml()`:

```ts
/** /api/map-link inside `npm run dev` too (on Vercel it's the function in api/map-link.ts). */
function mapLinkInDev(): Plugin {
  return {
    name: 'map-link-in-dev',
    configureServer(server) {
      server.middlewares.use('/api/map-link', (req, res) => {
        void (async () => {
          const { default: helper } = (await server.ssrLoadModule('/api/map-link.ts')) as {
            default: { fetch: (request: Request) => Promise<Response> }
          }
          const response = await helper.fetch(new Request(new URL(req.url ?? '/', 'http://localhost')))
          res.statusCode = response.status
          res.setHeader('content-type', 'application/json')
          res.end(await response.text())
        })()
      })
    },
  }
}
```

- [ ] **Step 5: Checkpoint**

Run: `npx tsc -b && npm run lint && npm test && npm run build`
Expected: PASS, and `dist/` has no `api/` (Vercel builds the function from the repo itself).

---

### Task 15: The pitch link on nights

**Files:**
- Create: `src/components/pitchmap.tsx`
- Modify: `src/lib/types.ts`, `src/lib/night.ts`, `src/lib/night.test.ts`, `src/lib/share.ts`, `src/lib/share.test.ts`, `src/lib/api.ts`, `src/pages/PlanNight.tsx`, `src/pages/NightPage.tsx`

**Interfaces:**
- Consumes: `isGoogleMapsUrl`, `isShortMapUrl`, `coordsFromMapUrl`, `mapEmbedUrl`; `/api/map-link`.
- Produces: `Match` + `pitch_url: string | null`, `pitch_lat: number | null`, `pitch_lng: number | null`; `NightDetails` the same; `NightForm` + `pitch_url: string`, `pitch_lat`, `pitch_lng`; `api.resolveMapLink(url): Promise<string | null>`; `PitchMap({ url, lat, lng })`.

- [ ] **Step 1: Types (`src/lib/types.ts`)**

In `Match`, after `location`:

```ts
  /** The pitch's Google Maps link, and its position on the map (both or neither). */
  pitch_url: string | null
  pitch_lat: number | null
  pitch_lng: number | null
```

In `NightDetails`, after `location`: the same three fields. In `NightForm`, after `location`:

```ts
  /** The Google Maps link as typed ('' for none), and the position found in it. */
  pitch_url: string
  pitch_lat: number | null
  pitch_lng: number | null
```

- [ ] **Step 2: Tests first (`src/lib/night.test.ts`, `src/lib/share.test.ts`)**

In `night.test.ts`, give `lastNight` a link:

```ts
  pitch_url: 'https://maps.google.com/?q=30.0444,31.2357',
  pitch_lat: 30.0444,
  pitch_lng: 31.2357,
```

add `pitch_url: '', pitch_lat: null, pitch_lng: null` to the "no previous night" expected form, `pitch_url: 'https://maps.google.com/?q=30.0444,31.2357', pitch_lat: 30.0444, pitch_lng: 31.2357` to every expected form copied from `lastNight`, and a new test:

```ts
describe('formToDetails: the pitch link', () => {
  it('sends the link with its position, and nothing for an empty link', () => {
    const form = nightDefaults(lastNight, 'me', new Date(2026, 9, 24, 15, 0))
    expect(formToDetails(form)).toMatchObject({
      pitch_url: 'https://maps.google.com/?q=30.0444,31.2357',
      pitch_lat: 30.0444,
      pitch_lng: 31.2357,
    })
    expect(formToDetails({ ...form, pitch_url: '  ' })).toMatchObject({ pitch_url: null, pitch_lat: null, pitch_lng: null })
  })
})
```

In `share.test.ts`, add `pitch_url: null as string | null` to `night`, and:

```ts
  it('a planned night with a pitch link adds it on its own line', () => {
    expect(plannedNightText({ ...night, pitch_url: 'https://maps.app.goo.gl/AbC123' }, 11)).toBe(
      "Thursday 29 Oct, 20:00 at Club pitch 3 · 6 a side · 11 in so far. Open 7GZ-KORA to say if you're in.\nPitch: https://maps.app.goo.gl/AbC123",
    )
  })
```

Run: `npx vitest run src/lib/night.test.ts src/lib/share.test.ts` → FAIL.

- [ ] **Step 3: `src/lib/night.ts` and `src/lib/share.ts`**

`formFromNight` gains `pitch_url: m.pitch_url ?? '', pitch_lat: m.pitch_lat, pitch_lng: m.pitch_lng,`; the no-last-night defaults gain `pitch_url: '', pitch_lat: null, pitch_lng: null,`; update `nightDefaults`' comment ("…and the same pitch and its map link, length, …"). `formToDetails` gains:

```ts
    // No link, no position.
    pitch_url: f.pitch_url.trim() || null,
    pitch_lat: f.pitch_url.trim() ? f.pitch_lat : null,
    pitch_lng: f.pitch_url.trim() ? f.pitch_lng : null,
```

`plannedNightText` takes `'pitch_url'` too and ends with the link:

```ts
export function plannedNightText(
  night: Pick<Match, 'played_at' | 'starts_at' | 'location' | 'players_per_side' | 'pitch_url'>,
  inCount: number,
): string {
  const day = longDay(parseDay(night.played_at))
  const when = night.starts_at ? `${day}, ${clockOf(night.starts_at)}` : day
  const where = night.location ? ` at ${night.location}` : ''
  const pitch = night.pitch_url ? `\nPitch: ${night.pitch_url}` : ''
  return `${when}${where} · ${night.players_per_side} a side · ${inCount} in so far. Open 7GZ-KORA to say if you're in.${pitch}`
}
```

Run: `npx vitest run src/lib` → PASS. (Other `Match` fixtures that `tsc` flags get `pitch_url: null, pitch_lat: null, pitch_lng: null`.)

- [ ] **Step 4: API and the map piece**

`src/lib/api.ts`, in the Nights section:

```ts
/** Follows a Google Maps short link (maps.app.goo.gl/…) to the full address, through /api/map-link. */
export async function resolveMapLink(url: string): Promise<string | null> {
  const res = await fetch(`/api/map-link?url=${encodeURIComponent(url)}`)
  if (!res.ok) return null
  return ((await res.json()) as { url: string | null }).url
}
```

`src/components/pitchmap.tsx`:

```tsx
// The pitch on a map (Plans/Accounts-groups-and-chat.md section 7): Google's
// map with a pin, which opens Google Maps when tapped. Without a position,
// just the "Open in Google Maps" button.
import { mapEmbedUrl } from '../lib/maplink'
import { PinIcon } from './icons'

export function PitchMap({ url, lat, lng }: { url: string | null; lat: number | null; lng: number | null }) {
  if (!url) return null
  if (lat == null || lng == null) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
        <PinIcon size={18} /> Open in Google Maps
      </a>
    )
  }
  return (
    <div className="relative h-40 overflow-hidden rounded-xl border-[1.5px] border-line bg-line">
      {/* The map works as a picture here: a tap goes to the link on top of it. */}
      <iframe
        title="Map of the pitch"
        src={mapEmbedUrl({ lat, lng })}
        loading="lazy"
        tabIndex={-1}
        aria-hidden
        referrerPolicy="no-referrer-when-downgrade"
        className="pointer-events-none size-full border-0"
      />
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Open the pitch in Google Maps"
        className="absolute inset-0 flex items-end justify-end p-2"
      >
        <span className="chip bg-paper">
          <PinIcon size={14} /> Open in Google Maps
        </span>
      </a>
    </div>
  )
}
```

- [ ] **Step 5: Plan a night (`src/pages/PlanNight.tsx`)**

Imports: `type Dispatch, type SetStateAction` from react; `PitchMap`; `coordsFromMapUrl, isGoogleMapsUrl, isShortMapUrl` from `../lib/maplink`. Add `const [finding, setFinding] = useState(false)` next to the other state (above the early returns). In `save()`, first:

```ts
    if (form.pitch_url.trim() && !isGoogleMapsUrl(form.pitch_url)) {
      setError('Paste a Google Maps link.')
      return
    }
```

Right after the "Pitch" `<label>`, add `<PitchLinkField form={form} setForm={setForm} onFinding={setFinding} />`; give the save button `disabled={finding}`. At the end of the file:

```tsx
/** The pitch's Google Maps link, and the map preview once its position is found. */
function PitchLinkField({
  form,
  setForm,
  onFinding,
}: {
  form: NightForm
  setForm: Dispatch<SetStateAction<NightForm | null>>
  onFinding: (finding: boolean) => void
}) {
  const [note, setNote] = useState<string | null>(null)
  const link = form.pitch_url.trim()
  const needsPosition = link !== '' && form.pitch_lat == null

  // Once a pasted or typed link settles, find the pitch's position in it.
  useEffect(() => {
    if (!needsPosition) return
    let alive = true
    const timer = window.setTimeout(async () => {
      if (!isGoogleMapsUrl(link)) {
        setNote('Paste a Google Maps link.')
        return
      }
      onFinding(true)
      setNote('Finding the pitch…')
      const full = isShortMapUrl(link) ? await api.resolveMapLink(link).catch(() => null) : link
      const position = full ? coordsFromMapUrl(full) : null
      if (!alive) return
      onFinding(false)
      setNote(position ? null : "The link is saved, but there's no map preview for it.")
      if (position) {
        setForm((f) => (f && f.pitch_url.trim() === link ? { ...f, pitch_lat: position.lat, pitch_lng: position.lng } : f))
      }
    }, 600)
    return () => {
      alive = false
      window.clearTimeout(timer)
      onFinding(false)
    }
  }, [link, needsPosition, setForm, onFinding])

  const shown = link === '' ? null : form.pitch_lat != null ? 'Pitch found on the map.' : note
  return (
    <div className="space-y-2">
      <label className="block">
        <span className="text-sm font-medium">Google Maps link</span>
        <input
          type="url"
          inputMode="url"
          placeholder="https://maps.app.goo.gl/…"
          value={form.pitch_url}
          onChange={(e) => {
            const value = e.target.value
            setForm((f) => f && { ...f, pitch_url: value, pitch_lat: null, pitch_lng: null })
          }}
          className={input}
        />
        <span className="mt-1 block text-xs text-muted">In Google Maps: the pitch → Share → Copy link, then paste it here.</span>
      </label>
      {shown && (
        <p role="status" className="text-sm font-semibold">
          {shown}
        </p>
      )}
      <PitchMap url={link || null} lat={form.pitch_lat} lng={form.pitch_lng} />
    </div>
  )
}
```

(`PitchMap` without a position shows the "Open in Google Maps" button, which lets the admin check the link.)

- [ ] **Step 6: The night page (`src/pages/NightPage.tsx`)**

Import `PitchMap`, and after `<p className="text-[13px] text-muted">{nightFacts(match)}</p>` in the header:

```tsx
        {match.pitch_url && (
          <div className="mt-3">
            <PitchMap url={match.pitch_url} lat={match.pitch_lat} lng={match.pitch_lng} />
          </div>
        )}
```

- [ ] **Step 7: Checkpoint**

Run: `npx tsc -b && npm run lint && npm test`
Expected: PASS.

---

### Task 16: The InstaPay number on the Money card

**Files:**
- Modify: `src/components/money.tsx`

**Interfaces:**
- Consumes: `Player.instapay_phone` (the group copy), `formatPhone`.
- Produces: `InstaPayLine({ collectorId: string | null })`, exported from `money.tsx` (Home uses it in Task 17).

- [ ] **Step 1: `InstaPayLine` and the collector's reminder**

Add to `src/components/money.tsx` (imports: `formatPhone` from `../lib/phone`):

```tsx
/** "Pay by InstaPay: 010 1234 5678" with Copy, when the collector added a number. Copy gives the bare 11 digits. */
export function InstaPayLine({ collectorId }: { collectorId: string | null }) {
  const { player } = useCurrentGroup()
  const [copied, setCopied] = useState(false)
  const phone = player(collectorId)?.instapay_phone
  if (!phone) return null
  return (
    <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-ground px-3 py-2">
      <p className="text-sm">
        Pay by InstaPay: <span className="tabular font-display text-lg whitespace-nowrap">{formatPhone(phone)}</span>
      </p>
      <Button
        size="sm"
        variant="secondary"
        onClick={() =>
          void navigator.clipboard
            .writeText(phone)
            .then(() => setCopied(true))
            .catch(() => undefined)
        }
      >
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  )
}
```

In `MoneyCard`, take `player` from `useCurrentGroup()` too, and:
- in the "You owe" branch, after the `to <Name>…` line: `<InstaPayLine collectorId={match.collector_player_id} />`
- in the `iCollect` branch, after the "Collected" lines:

```tsx
          {!player(myPlayerId)?.instapay_phone && (
            <p className="mt-2 text-sm font-semibold">
              Add your InstaPay number so people can pay you.{' '}
              <Link to="/me/edit" className="text-brand-ink underline">
                Add it
              </Link>
            </p>
          )}
```

- [ ] **Step 2: Checkpoint**

Run: `npx tsc -b && npm run lint && npm test`
Expected: PASS. Money itself is untouched: `git diff src/components/money.tsx` shows only the InstaPay additions, and `src/lib/money.ts` and the money SQL are unchanged.

---

## Part G — Home

### Task 17: Home, the group hub

**Files:**
- Create: `src/lib/hub.ts`, `src/lib/hub.test.ts`
- Modify: `src/components/hub.tsx` (add four pieces), `src/components/rsvp.tsx`, `src/pages/Home.tsx` (whole file below)

**Interfaces:**
- Produces: `countdown(startsAt, now)`, `podiumOrder(top)` (hub.ts); `GroupBanner()`, `SeasonStrip({ row, year })`, `Podium({ rows, year, minNights })`, `ChatPreview()` (hub.tsx); `RsvpCard` takes `children` (shown under the night's facts).

- [ ] **Step 1: Write the failing test: `src/lib/hub.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { countdown, podiumOrder } from './hub'

describe('Home', () => {
  // Thursday 29 October, 20:00.
  const starts = new Date(2026, 9, 29, 20, 0).toISOString()

  it('counts down to the next night', () => {
    expect(countdown(starts, new Date(2026, 9, 27, 15, 30))).toBe('in 2 days 4 h')
    expect(countdown(starts, new Date(2026, 9, 28, 18, 0))).toBe('in 1 day 2 h')
    expect(countdown(starts, new Date(2026, 9, 29, 8, 0))).toBe('in 12 h 0 min')
    expect(countdown(starts, new Date(2026, 9, 29, 19, 15))).toBe('in 45 min')
    expect(countdown(starts, new Date(2026, 9, 29, 20, 5))).toBe('starting now')
  })

  it('puts first in the middle of the podium', () => {
    expect(podiumOrder(['Omar', 'Ziad', 'Karim'])).toEqual(['Ziad', 'Omar', 'Karim'])
    expect(podiumOrder(['Omar', 'Ziad'])).toEqual(['Ziad', 'Omar'])
    expect(podiumOrder(['Omar'])).toEqual(['Omar'])
    expect(podiumOrder([])).toEqual([])
  })
})
```

Run: `npx vitest run src/lib/hub.test.ts` → FAIL.

- [ ] **Step 2: `src/lib/hub.ts`**

```ts
// Home, the group hub (Plans/Accounts-groups-and-chat.md section 8). Pure
// functions, tested in hub.test.ts.

/** Until a night starts: "in 2 days 4 h", "in 12 h 0 min", "in 45 min", or "starting now". */
export function countdown(startsAt: string, now: Date): string {
  const minutes = Math.floor((Date.parse(startsAt) - now.getTime()) / 60_000)
  if (minutes <= 0) return 'starting now'
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  if (days > 0) return `in ${days} day${days === 1 ? '' : 's'} ${hours} h`
  if (hours > 0) return `in ${hours} h ${minutes % 60} min`
  return `in ${minutes} min`
}

/** The podium's order: second, first, third, so first stands in the middle. */
export function podiumOrder<T>(top: T[]): T[] {
  return [top[1], top[0], top[2]].filter((row): row is T => row !== undefined)
}
```

Run: `npx vitest run src/lib/hub.test.ts` → PASS.

- [ ] **Step 3: The hub's pieces (`src/components/hub.tsx`)**

Extend the imports and add:

```tsx
import * as m from 'motion/react-m'
import { useState } from 'react'
import { Link } from 'react-router'
import { isCardFilled } from '../lib/card'
import { podiumOrder } from '../lib/hub'
import { cascadeItem } from '../lib/motion'
import { KEYS, readLocal, writeLocal } from '../lib/storage'
import type { LeaderboardRow } from '../lib/types'
import { useMyAccount } from '../state/account'
import { useChat } from '../state/chat'
import { useCurrentGroup } from '../state/group'
import { GroupImage } from './groups'
import { ChevronIcon } from './icons'
import { CountUp } from './motion'
import { Avatar, Button, Card, Heading, LinkButton, Name, RatingBadge } from './ui'

/** The group's photo, name, Public / Private, and a row of faces that opens the Squad. */
export function GroupBanner() {
  const { group, members, player } = useCurrentGroup()
  const faces = members.slice(0, 6)
  const more = members.length - faces.length
  return (
    <m.section variants={cascadeItem} className="overflow-hidden rounded-card border-2 border-ink bg-paper">
      <GroupImage path={group.image_path} className="h-32 w-full" />
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h1 className="min-w-0 font-display text-[28px] leading-tight">
            <Name>{group.name}</Name>
          </h1>
          <span className="chip status mt-1 shrink-0">{group.is_public ? 'Public' : 'Private'}</span>
        </div>
        <Link to="/table/squad" className="mt-2 flex min-h-12 items-center gap-3" aria-label="See the squad">
          <span className="flex -space-x-2">
            {faces.map((mb) => {
              const p = player(mb.player_id)
              return (
                <span key={mb.user_id} className="rounded-full ring-2 ring-paper">
                  <Avatar name={p?.display_name ?? ''} url={p?.avatar_url} size={32} />
                </span>
              )
            })}
          </span>
          <span className="text-sm font-semibold">
            {more > 0 && `+${more} · `}
            {members.length} player{members.length === 1 ? '' : 's'}
          </span>
          <ChevronIcon size={18} className="ml-auto text-muted" />
        </Link>
      </div>
    </m.section>
  )
}

/** Your season: rating, nights, goals and Man of the Match, counting up. */
export function SeasonStrip({ row, year }: { row: LeaderboardRow | undefined; year: number }) {
  const stats = row
    ? ([
        ['Nights', row.matches],
        ['Goals', row.goals],
        ['MOTM', row.mvps],
      ] as const)
    : []
  return (
    <Card>
      <Heading>You this season · {year}</Heading>
      {!row ? (
        <p className="mt-1 text-sm text-muted">Play your first night to see your stats.</p>
      ) : (
        <div className="mt-2 grid grid-cols-4 items-end gap-2 text-center">
          <div>
            <RatingBadge value={row.avg_rating} animated />
            <p className="mt-1 text-[11px] text-muted">Rating</p>
          </div>
          {stats.map(([label, value]) => (
            <div key={label}>
              <p className="tabular font-display text-2xl leading-none">
                <CountUp value={value} />
              </p>
              <p className="mt-1 text-[11px] text-muted">{label}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

/** This season's top 3: second, first (raised, in the middle), third. */
export function Podium({ rows, year, minNights }: { rows: LeaderboardRow[]; year: number; minNights: number }) {
  const { player } = useCurrentGroup()
  return (
    <Card>
      <div className="mb-2 flex items-baseline justify-between">
        <Heading>Season {year} · top 3</Heading>
        <Link to="/table" className="text-sm font-semibold text-brand-ink">
          Full table
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">The table starts once players have {minNights} rated nights this season.</p>
      ) : (
        <ol className="flex items-end justify-center gap-2">
          {podiumOrder(rows).map((row) => {
            const place = rows.indexOf(row) + 1
            return (
              <li key={row.player_id} className="w-1/3 min-w-0">
                <Link to={`/players/${row.player_id}`} className="flex flex-col items-center gap-1 text-center">
                  <Avatar name={row.display_name} url={player(row.player_id)?.avatar_url} size={place === 1 ? 64 : 48} />
                  <Name className="w-full truncate text-sm font-bold">{row.display_name}</Name>
                  <RatingBadge value={row.avg_rating} />
                  {/* The step: first is the green one, with black text. */}
                  <span
                    className={`mt-1 flex w-full items-center justify-center rounded-t-xl border-2 border-ink font-display text-2xl ${
                      place === 1 ? 'h-16 bg-brand text-on-brand' : 'h-10 bg-ground'
                    }`}
                  >
                    {place}
                  </span>
                </Link>
              </li>
            )
          })}
        </ol>
      )}
    </Card>
  )
}

/** The last 3 messages and Open chat. */
export function ChatPreview() {
  const { messages } = useChat()
  const { playerName } = useCurrentGroup()
  const last = messages.filter((msg) => msg.body !== null).slice(-3)
  return (
    <Card>
      <Heading className="mb-1">Chat</Heading>
      {last.length === 0 ? (
        <p className="text-sm text-muted">Say hi to the group.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {last.map((msg) => (
            <li key={msg.id} className="line-clamp-2">
              <Name className="font-bold">{playerName(msg.player_id)}</Name>:{' '}
              <span dir="auto">{msg.body}</span>
            </li>
          ))}
        </ul>
      )}
      <LinkButton to="/chat" variant="secondary" className="mt-3 w-full">
        Open chat
      </LinkButton>
    </Card>
  )
}
```

- [ ] **Step 4: Room for Home's extras on the RSVP card (`src/components/rsvp.tsx`)**

`RsvpCard` takes `children?: ReactNode` (import `type ReactNode`), documented "Shown under the night's facts (Home: the countdown and the map).", and renders `{children}` right after `<p className="text-[13px] text-muted">{nightFacts(match)}</p>` inside the `showNight` branch.

- [ ] **Step 5: `src/pages/Home.tsx` (the whole file)**

```tsx
import { useState } from 'react'
import { Link } from 'react-router'
import { ChatPreview, FinishCard, GroupBanner, Podium, SeasonStrip } from '../components/hub'
import { PlusIcon, StarIcon } from '../components/icons'
import { Scoreboard } from '../components/match'
import { InstaPayLine } from '../components/money'
import { Cascade } from '../components/motion'
import { PitchMap } from '../components/pitchmap'
import { RsvpCard } from '../components/rsvp'
import { Card, Empty, ErrorNote, Heading, LinkButton, Loading, Name, RatingBadge, StatusChip } from '../components/ui'
import * as api from '../lib/api'
import { formatDay, timeLeft } from '../lib/format'
import { gameScore } from '../lib/games'
import { countdown } from '../lib/hub'
import type { MatchSummary, MoneyOwed } from '../lib/types'
import { useLoad } from '../lib/useLoad'
import { useNow } from '../lib/useNow'
import { useCurrentGroup } from '../state/group'

/** Home, the group hub (Plans/Accounts-groups-and-chat.md section 8). */
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
  const myRow = board.find((r) => r.player_id === myPlayerId)

  return (
    <Cascade className="space-y-4">
      <GroupBanner />
      <ErrorNote message={error} onRetry={reload} />

      {live.map((m) => (
        <LiveNight key={m.id} night={m} />
      ))}
      {next && (
        <RsvpCard match={next} rsvps={next.rsvps} onChange={reload} linkToNight>
          <NextNightExtras night={next} />
        </RsvpCard>
      )}
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
      <FinishCard />

      {isAdmin && !next && live.length === 0 && (
        <LinkButton to="/nights/new" className="w-full">
          <PlusIcon size={20} /> Plan a night
        </LinkButton>
      )}

      <SeasonStrip row={myRow} year={year} />

      {last && (
        <Link to={`/nights/${last.id}`} className="block">
          <Card>
            <Heading>Last night · {formatDay(last.played_at)}</Heading>
            <p className="my-2 font-display text-[22px] leading-tight">
              {last.games.length} game{last.games.length === 1 ? '' : 's'}
            </p>
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

      <Podium rows={top3} year={year} minNights={minNights} />
      <ChatPreview />

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
    </Cascade>
  )
}

/** On the next night's card: the countdown and the pitch map. */
function NextNightExtras({ night }: { night: MatchSummary }) {
  const now = useNow(30_000)
  return (
    <>
      {night.starts_at && <p className="mt-1 text-sm font-bold">{countdown(night.starts_at, now)}</p>}
      {night.pitch_url && (
        <div className="mt-3">
          <PitchMap url={night.pitch_url} lat={night.pitch_lat} lng={night.pitch_lng} />
        </div>
      )}
    </>
  )
}
```

followed by the existing `LiveNight` and `VotingNow` functions (unchanged) and this `YouOwe` (the Copy button can't sit inside a link, so only the top part links to the night):

```tsx
function YouOwe({ owed }: { owed: MoneyOwed }) {
  const { playerName } = useCurrentGroup()
  return (
    <Card strong>
      <Link to={`/nights/${owed.match_id}`} className="flex items-center justify-between gap-2">
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
      </Link>
      <InstaPayLine collectorId={owed.collector_player_id} />
    </Card>
  )
}
```

(`timeLeft` and `StatusChip` stay imported for `VotingNow` and `LiveNight`.)

- [ ] **Step 6: Checkpoint**

Run: `npx tsc -b && npm run lint && npm test && npm run build`
Expected: PASS.

---

## Part H — Docs, demo data and the hand-over

### Task 18: Docs and demo data

**Files:**
- Modify: `supabase/seed.sql`, `tests/db/seed.test.ts`, `src/pages/HowItWorks.tsx`, `public/privacy.html`, `README.md`, `Plans/README.md`, `Plans/NEXT-SESSION-PROMPT.md`, `CLAUDE.md`

- [ ] **Step 1: Demo data (`supabase/seed.sql`)**

The header says 8 files. After the player cards:

```sql
  -- Ahmed collects the pitch money and takes InstaPay (Plans/Accounts-groups-and-chat.md section 7).
  -- The demo players have no accounts, so their group copy is set directly.
  update public.players set instapay_phone = '01012345678' where id = v_players[3];
```

The planned night (`In 3 days`) gets a map link: add `pitch_url, pitch_lat, pitch_lng` to its column list and `'https://maps.google.com/?q=30.0444,31.2357', 30.0444, 31.2357` to its values. Before the final `raise notice`:

```sql
  -- A few chat messages (Plans/Accounts-groups-and-chat.md section 6).
  insert into public.group_messages (group_id, player_id, body, created_at)
  values (v_group, v_players[3], 'Pitch is booked for Thursday. 600 EGP, pay me after.', now() - interval '26 hours'),
         (v_group, v_players[2], 'Who has the ball?', now() - interval '25 hours'),
         (v_group, v_players[1], 'Me. Bibs too.', now() - interval '24 hours 50 minutes'),
         (v_group, v_players[9], 'يلا بينا', now() - interval '3 hours'),
         (v_group, v_players[8], 'Might be 10 minutes late, sorry', now() - interval '2 hours');
```

`tests/db/seed.test.ts`, a new test (using the file's existing database and `one` / query helpers):

```ts
it('gives the planned night a map link, Ahmed an InstaPay number and the chat five messages', async () => {
  const night = (await db.query<{ pitch_url: string; pitch_lat: number }>(
    `select m.pitch_url, m.pitch_lat from matches m join groups g on g.id = m.group_id
     where g.name = 'Demo FC' and m.status = 'draft'`,
  )).rows[0]
  expect(night).toEqual({ pitch_url: 'https://maps.google.com/?q=30.0444,31.2357', pitch_lat: 30.0444 })
  const ahmed = (await db.query<{ instapay_phone: string }>(`select instapay_phone from players where display_name = 'Ahmed'`)).rows[0]
  expect(ahmed.instapay_phone).toBe('01012345678')
  const chat = (await db.query(`select body from group_messages order by created_at`)).rows
  expect(chat).toHaveLength(5)
})
```

Run: `npx vitest run tests/db/seed.test.ts` → PASS.

- [ ] **Step 2: How it works (`src/pages/HowItWorks.tsx`)**

`CardExplainer`'s first item becomes: "Fill it in once, on your account (**your photo, top right → Edit my card**): shirt number, strong foot, favourite position, a motto, and how you rate yourself from 1 to 10 on shooting, passing, dribbling, defending and fitness. **Every group you're in shows the same card.**" Add an item: "**Show my stats** off hides your five skills and your self-rating from everyone else. Your night ratings still show in the Table, because they come from real games. With stats hidden, Suggest teams starts you at 6.0 until your first rated night." After `<CardExplainer />`, add `<GroupsExplainer />`:

```tsx
function GroupsExplainer() {
  return (
    <Card>
      <Heading className="mb-2">Groups, chat and the pitch</Heading>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        <li>
          You don't need a group to use the app. <strong>Find</strong> (the search icon at the top) shows the{' '}
          <strong>public groups</strong>: join one with a single tap. A <strong>private</strong> group needs its invite
          code. Admins choose Public or Private, and the group photo, in <strong>More</strong>.
        </li>
        <li>
          In Find you can also search players by name and open their account: their card, their totals across all their
          groups, and their public groups. Nobody sees your email or your phone number there.
        </li>
        <li>
          Every group has a <strong>chat</strong>, text only. Delete your own messages by tapping them; admins can delete
          any. A dot on the Chat tab means someone wrote since you last looked.
        </li>
        <li>
          Admins paste the pitch's <strong>Google Maps link</strong> when they plan a night: the night shows a small map,
          and tapping it opens Google Maps.
        </li>
        <li>
          The collector can add an <strong>InstaPay number</strong> on their account. Whoever owes them sees it on the
          money card, with a Copy button. The share is the same as always: the cost ÷ the players checked in, rounded up.
        </li>
      </ul>
    </Card>
  )
}
```

- [ ] **Step 3: The privacy page (`public/privacy.html`)**

"Last updated 26 October 2026". The intro: "7GZ-KORA is an app for friends who play football together." Under "What we keep", add:
- "Your player card: shirt number, strong foot, position, motto, the five skills you rate yourself on, and whether you show those skills to others."
- "If you add one: your InstaPay number, so people can pay you their share of the pitch."
- "Chat messages you write in your groups (a deleted message's text is removed)."
- "Group photos that admins upload."

"Who can see it" becomes: "Members of your groups see what happens in those groups, the chat included, and your InstaPay number if you added one. **Anyone signed in to 7GZ-KORA can find you by name** and see your photo, your card (your skills only if you show them) and your totals; they never see your email or phone number. A group photo can be seen by anyone who has its web address. Votes stay secret until voting closes; then the group sees who voted what. Nothing is sold, and nothing is used for ads." "Where it is kept": "…stored with Supabase (database, sign-in and group photos)…".

- [ ] **Step 4: README, plans and CLAUDE.md**

- `README.md` section 1 ("What's built so far"): a stage 3c line: accounts with one card each and the sign-up questions; groups optional; group photo and Public / Private; Find with player search and account pages; Squad; live chat; pitch link with a map; InstaPay number; the group hub; screens load when opened (with the before/after sizes from Task 1).
- Step 3 ("Create the database tables"): file 8 `20261026000100_accounts_groups_chat.sql`, run once in the SQL Editor **before pushing**. It also creates the `group-images` storage bucket and switches the chat on for Realtime, so there's nothing to click in Storage or Realtime.
- Section 7 (choices): the spec's section 13 choices (1-11) and this plan's decisions 2-16, one line each.
- Section 8: the new test files and the test count; the new files in the project layout.
- Section 10 (troubleshooting): "Could not find the function public.my_account" → run file 8. "Chat says it checks every 10 seconds" → in Supabase, Database → Publications → `supabase_realtime` must include `group_messages` (file 8 adds it). "A group photo won't upload" → Storage must have the `group-images` bucket (file 8 makes it); photos over 1 MB after shrinking are refused. "No map preview" → the link has no position; paste the link from Google Maps' Share button.
- `Plans/README.md`: a row 7 for `Accounts-groups-and-chat.md` ("**Built** as stage 3c", with the date it's built), and "3c. **Accounts, groups and chat** (`Accounts-groups-and-chat.md`)" in the build order.
- `Plans/NEXT-SESSION-PROMPT.md`: where things stand (stage 3c built; the owner runs file 8; next is stage 4).
- `CLAUDE.md`, under "Rules that are easy to get wrong", two lines:
  - "**The player card lives on the account** (`profiles`). Each group's `players` row keeps a copy that only database triggers write; the app never writes card columns on `players`. With Show my stats off, the copy has no skills."
  - "**Groups are optional.** Screens that need one sit inside `RequireGroup` (`src/App.tsx`)."

- [ ] **Step 5: Checkpoint**

Run: `npx tsc -b && npm run lint && npm test && npm run build`
Expected: PASS.

---

### Task 19: Verify everything and hand over

**Files:**
- Temporary only, in the session's scratch folder (`$SCRATCH` below): `standin/` and `shots/`. Nothing here is added to the project.

- [ ] **Step 1: The four checks and the bundle**

Run: `npx tsc -b && npm run lint && npm test && npm run build`
Expected: all pass. Note the test count (the README must say the same) and the first-download size next to Task 1's "before" (683.32 kB / 197.72 kB gzipped).

- [ ] **Step 2: Rule greps**

```bash
git diff --stat -- supabase/migrations/2026102300* supabase/migrations/20261024000100_nights.sql \
  supabase/migrations/20261025000100_games.sql supabase/migrations/20261025000200_team_suggester.sql \
  supabase/migrations/20261025000300_player_card.sql            # nothing
grep -rn "update.*from('players')" src/lib/api.ts              # only renamePlayer (display_name)
grep -rnE "\b(text-white|bg-white)\b" src                      # only SignIn and InstallScreen
grep -rn "window.confirm" src                                  # nothing
git diff -- src/lib/money.ts                                   # nothing
```

- [ ] **Step 3: The stand-in**

As in `Plans/implementation/stage-3b-player-card.md` Task 14 Step 3 (the same `session.mjs`, `db.mjs`, `postgrest.conf`, `proxy.mjs`, `shots.mjs`, PostgREST 14.18, a free port such as 5182). `db.mjs` runs every migration, so file 8 needs the same storage stand-in as the tests: before the migrations, run the storage part of `tests/db/helpers.ts`' `SUPABASE_STUB` (schema `storage`, its two tables, `storage.foldername`), but **not** the publication (the stand-in has no Realtime, which shows the chat's 10-second fallback). The stand-in's `/storage/v1/*` isn't served, so group photos show the honeycomb.

Owner starts **not signed up**: screenshot the sign-up first. Then, to reach the app, call `finish_sign_up` for Owner through the REST stand-in (`{ "display_name": "Owner", "shirt_number": 7, "strong_foot": "right", "favourite_position": "midfield", "skill_shooting": 7, "skill_passing": 8, "skill_dribbling": 6, "skill_defending": 6, "skill_fitness": 8, "show_stats": true }`), make Demo FC public (`update groups set is_public = true where name = 'Demo FC'`), and have Member hide their stats (`save_my_account` with `show_stats: false`). For "no group", have Member leave Demo FC (`remove_member` with their own id).

- [ ] **Step 4: Screens, 390 px, light and dark (Arabic names in the seed)**

- Sign-up: question 1 (name filled in), a skill question (two rows of five, "Skip the skills"), the card step (the card, Show my stats, **Done**). Black text on every green answer.
- Lobby (Member, no group): the green welcome band with black text, the card, Find your squad (Demo FC with **Join**), the code form, Start a group; tabs Home · Find · More.
- Home (Owner): the banner (honeycomb + logo, "Public", faces "+N · N players"), the next night with the countdown, the map with "Open in Google Maps", I'm in / Out; You owe with "Pay by InstaPay: 010 1234 5678 · Copy" (after the stand-in's `vote` step checks Owner in to yesterday's night); You this season counting up; Last night; the podium (first raised in the middle on the green step); Chat with the 3 latest demo messages.
- Chat: day lines, runs grouped, the Arabic message right-to-left inside its bubble, your message green with black text after sending one, "Checking for new messages every 10 seconds", the box above the tab bar; tap your message → Delete → the sheet → "Message deleted".
- Find: search "om" → Omar; public groups list. Account page `/u/<Member>`: "Stats hidden", totals, groups. `/me`: Edit my card and "My stats in Demo FC".
- Squad: two per row, numbers on the green band (black), NEW chips. Table with the Table · Squad switch.
- More: the Group card (photo area, name, Public switch on), Your name in this group, Find, How it works.
- Plan a night: paste `https://www.google.com/maps/@30.0444,31.2357,15z` → "Pitch found on the map." and the preview; paste `https://maps.app.goo.gl/AbC123` → "Finding the pitch…" then the no-preview note (the helper can't reach a made-up link), Save still works.
- Night page: the map under the header.
- Edit my card: Show my stats, InstaPay number ("0101234567" shows the red note and Save is off).
- Once with "reduce motion" on: the sign-up and Home.

- [ ] **Step 5: Hand over**

Tell the owner, in plain words:
1. **Run file 8** (`supabase/migrations/20261026000100_accounts_groups_chat.sql`) once in the Supabase SQL Editor **before pushing**. It sets up the storage bucket and the live chat by itself.
2. What was tested (the checks, the test count, the screens above on the stand-in) and what wasn't: the live chat on real Supabase Realtime, uploading a group photo to real Storage, a real `maps.app.goo.gl` link through the Vercel helper, and Google's map preview inside the installed iPhone app. Ask them to try those four on their phone after deploying.
3. The first-download size before and after.
4. The flagged choices (spec section 13 and this plan's decisions).
5. How they want it committed (their usual: straight to `main`).


---

## Changes made during the build

- **Faster loading fell short of the 350 kB goal.** The first download went from 683.3 kB (197.7 kB gzip) to **611.6 kB (183.0 kB gzip)**. Measured with source maps, React DOM (about 200 kB) and the Supabase library (about 250 kB: sign-in, database, storage, realtime) make up most of it, and the first screen needs both; lazy loading can't remove them, and the plan allows no new packages. The app's own code in the first download is about 100 kB (sign-in, the sign-up questions, both Homes, Join or create, the header and tabs, as decision 10 says).
- **The live Supabase project couldn't be checked first:** the read-only Supabase MCP server didn't load in this session. File 8 relies on what every Supabase project has (`storage.buckets`, `storage.objects`, `storage.foldername`, the `supabase_realtime` publication); Supabase's docs (Context7) confirm buckets and storage policies are created this way in SQL. File 7's card columns were checked in the migration file itself.
- **PGlite accepted `create publication`**, so the Realtime test stays. `filled desc` in the data move and the `postgres_changes` callback type worked as written.
- **Vercel's docs confirm** that `api/map-link.ts` with `export default { fetch }` runs as a function with no settings.
- **The first demo chat message** says "Pitch is booked. 600 EGP, pay me after." (no weekday), because the demo's planned night is always "in 3 days", not always a Thursday.
- **Code copied out of this file** with a small node script. Three copy slips (a line number one past a code fence, and `getMembers` matching `getMemberships`) garbled `storage.ts`, `api.ts` and `vite.config.ts` for a moment; each was restored from git and redone, and the final diffs were read through. Every new test failed first and passed once its code was added.
- **Checkpoints:** every task ran `npx tsc -b` and `npm run lint`; the tests ran at every task except Tasks 11 and 16 (screen changes only), whose tests ran with the next task.
- **Tests:** 238 (174 + 12 accounts + 8 groups + 6 chat + 4 pitch + 1 seed database tests; 5 sign-up + 4 phone + 2 photo + 4 chat + 7 map links + 7 map helper + 2 hub + 1 night + 1 share).
- **Rule checks (Task 19 Step 2):** files 1-7 untouched; the app's only write to `players` is the name; white text only in the logo lettering on SignIn and InstallScreen; `window.confirm` only in a comment; `src/lib/money.ts` and the money SQL untouched. Lint: 0 warnings, 0 errors.
- **Not done in this session:** the screen checks on a temporary stand-in (Task 19 Steps 3-4). The new screens haven't been seen in a browser yet: check them at 390 px, light and dark, once file 8 is on the live project (or at the start of the next session).
