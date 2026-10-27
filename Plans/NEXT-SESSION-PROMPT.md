# Prompt for the next Claude Code session: check stage 3c live, then plan stage 4 of 7GZ-KORA

You're continuing an existing project: a football rating PWA for a group of friends in Egypt (React + Supabase), being upgraded as **7GZ-KORA**. Everything agreed is written down in `Plans/`. **Stages 1 to 3c are built.** Stage 3c (accounts, groups and chat) was built on 2026-10-27, but its new screens have **not been seen in a browser yet**. Your job: confirm stage 3c is live and working, check its screens, then plan **stage 4 (punishments and loyalty points)** with the owner.

The root `CLAUDE.md` loads automatically and holds the working rules. Follow it; this file adds what's specific to where the work stands now.

---

## 1. Working with the owner

- The owner is a hobbyist, not an experienced developer, and writes short informal English.
- **Ask every decision as a multiple-choice question** (the AskUserQuestion tool), with your recommended option first. Open-ended "tell me what to change" questions confuse them.
- **Never re-ask anything in a "Decisions already made" table.** Those are final. If something genuinely isn't covered, pick the simplest option, say what you chose, and flag it (the stage plan has a "Decisions this plan makes" list, and the README section 7 lists them for the owner).
- The owner sets up Supabase, Google sign-in and Vercel **themselves**. Don't walk them through it unless they ask. When they must do something (like running the new SQL file), explain it in plain language, one step at a time.
- Explain results plainly: what works, what was tested, and what's still open. Report failures honestly, with the output.

## 2. Read these first, in order

1. `Plans/README.md`: the index and the combined build order
2. `Plans/Accounts-groups-and-chat.md` and `Plans/implementation/stage-3c-accounts-groups-chat.md` (especially its "Decisions this plan makes" and **"Changes made during the build"** at the end)
3. `Plans/Punishments-and-loyalty.md`: stage 4's spec (its decisions table is final)
4. `Plans/Extras-and-backlog.md` (section 8 lists the **rejected** ideas: never build those), `Design/README.md`
5. The root `README.md` (setup, behaviour, the choices list in section 7)

## 3. Where things stand

- **Stages 1, 2, 3 and 3b** are built, pushed and live (commits `e40931d`, `880fe2e`, `6224f53`, `86cd624`); migration files 1-7 have run on the live Supabase project. **Don't ask about them again.**
- **Stage 3c** is built: migration **file 8** `supabase/migrations/20261026000100_accounts_groups_chat.sql`, the map helper `api/map-link.ts` (a Vercel function) and the new screens. **238 tests** pass; `npx tsc -b`, `npm run lint` (0 warnings) and `npm run build` are clean. The first download went from 683.3 kB (197.7 kB gzip) to 611.6 kB (183.0 kB gzip), short of the 350 kB goal because React and Supabase alone are about 450 kB.
- **The owner must run file 8 in the Supabase SQL Editor before pushing** (the new app calls its functions as soon as it opens). Ask (multiple choice) whether they have run it and pushed. If they pushed, check the latest Vercel deployment.
- **Not checked yet:** the stage 3c screens at 390 px, light and dark (Task 19 Step 4 of the stage plan lists them), the live chat on real Supabase Realtime, a group photo upload to real Storage, a real `maps.app.goo.gl` link through `/api/map-link`, and Google's map preview inside the installed iPhone app. Ask the owner what they saw on their phone, and fix anything that's off before stage 4.
- **Never edit an existing migration file.** Stage 4's database change will be file 9.
- **Vercel:** project `7gz-kora` (team `team_iW3kj4FDmRd2y0Hz8b2U9cMN`, project `prj_6ro39cfyOF4eqvAFjfl17yu0l4Q5`).
- **MCP servers in `.mcp.json`** (see `CLAUDE.md` "Tools"): **supabase** (read-only, the live project) didn't load in the stage 3c session; try it again before writing file 9. **playwright** opens `npm run dev`, which talks to the live project through `.env.local`.

## 4. Rules that are easy to get wrong (on top of `CLAUDE.md`)

- **New tables and functions:** Supabase grants them to `anon`/`authenticated` by default. In every new migration file: `enable row level security`, a select policy, `revoke all ... from anon, authenticated`, `grant select ... to authenticated`, and revoke/grant every new function explicitly. The test stand-in has the same default grants (`tests/db/helpers.ts`, `SUPABASE_STUB`), so a missing revoke fails a test.
- **The card lives on the account (`profiles`).** Each group's `players` row keeps a copy that only the database writes (triggers in file 8). With Show my stats off, the copy has **no skills**. The app must never write card columns on `players`.
- Ratings stay computed **only** in `compute_match_ratings`. **Money stays exactly as it is:** the InstaPay number only says where to pay.
- Admins only start/end games, change teams, check people in and log goals.
- **Text on the brand green is always black**, including your chat bubbles and the Squad cards' number band.
- **Animation:** only `m` components (`motion/react-m`) inside `LazyMotion strict`, animate `transform`/`opacity`, respect reduce motion. Confirmations use `useConfirm()`, success messages `useToast()`.

## 5. Lessons from earlier sessions

**Seeing the app without the real Supabase.** Use a **temporary** stand-in in the session's scratch folder (the owner declined a permanent one). The scripts are in `Plans/implementation/stage-2.md`, Task 11 (`session.mjs`, `db.mjs`, `postgrest.conf`, `proxy.mjs`, `live.mjs`, `shots.mjs`); stage 3b's Task 14 shows the later changes, and stage 3c's Task 19 says what file 8 needs (the storage stand-in, no publication).
- PGlite + `@electric-sql/pglite-socket` on `127.0.0.1:54329`, PostgREST **14.18** (v16 fails on Windows) with `db-prepared-statements = false`, `db-pool = 1`, `db-channel-enabled = false`, and `?sslmode=disable&gssencmode=disable` on the `db-uri`.
- `gh` isn't installed: download PostgREST with `curl` from `https://github.com/PostgREST/postgrest/releases/download/v14.18/postgrest-v14.18-windows-x86-64.zip`.
- Port 5173 is often taken by the owner's own `npm run dev`, and 5180/5181 were taken in later sessions: pick a free port (5182 worked last time). `VITE_ALLOW_BROWSER=true` plus the stand-in URL and key. Don't stop the owner's processes.
- Screenshots and clicks: `playwright-core` with the installed Edge (`channel: 'msedge'`). `shots.mjs` supports `AS=member`, `CLICK="<button text>"`, `CLICK2` and `REDUCE`. In Git Bash, set `MSYS_NO_PATHCONV=1` when passing `/` routes. Full-page screenshots draw the fixed bottom tab bar mid-page: that's expected.

**PostgREST embeds.** `matches` → `match_players` needs `match_players!match_players_match_id_fkey`, `matches` → `games` uses `games!games_match_id_fkey`, `players` → `profiles` uses `profiles!players_user_id_fkey`. File 8 adds `group_messages` with foreign keys to `players` and `profiles`: test every new embed (no `PGRST201`).

**Test helpers** (`tests/db/helpers.ts`): `createDb({ before })` + `runMigrations` (test a migration against data stored the old way); `rpc()` and `selectAs()` act as a signed-in user with RLS on; `setupGroup`, `nightDetails`, `startNight`, `startGame`; `MatchBuilder` for rating fixtures. Extend these rather than starting over.

**Motion bundle lesson (stage 3b):** Motion's `animate`/`useAnimate` pull its animation engine into the main bundle; `CountUp`/`Bump` use `requestAnimationFrame` / `element.animate` instead. Keep it that way.

**Shell:** Git Bash and PowerShell both work. For big plan-to-file copies, extracting the fenced code block from the plan file with a small node script is more reliable than retyping (backticks inside bash heredocs get mangled).

## 6. Start now

1. Check the latest Vercel deployment and tell the owner in one line whether it's live.
2. Ask (multiple choice) whether file 8 has been run and the new version pushed, and how the new screens looked on their phone.
3. Fix anything stage 3c needs, then plan stage 4 from `Plans/Punishments-and-loyalty.md` (a stage plan in `Plans/implementation/`, asked and approved by multiple choice, as for the earlier stages).
