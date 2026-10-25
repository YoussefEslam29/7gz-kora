# Prompt for the next Claude Code session: continue the 7GZ-KORA upgrade

You're continuing an existing project: a football rating PWA for a group of friends in Egypt (React + Supabase), being upgraded and renamed **7GZ-KORA**. Everything to build is already decided and written down in `Plans/`. **Stages 1 to 3 are built.** Your job is stage 4 (then 5), one stage at a time, with tests, and with the owner's approval at each step.

The root `CLAUDE.md` loads automatically and holds the working rules. Follow it; this file adds what's specific to where the work stands now.

---

## 1. Working with the owner

- The owner is a hobbyist, not an experienced developer, and writes short informal English.
- **Ask every decision as a multiple-choice question** (the AskUserQuestion tool), with your recommended option first. Open-ended "tell me what to change" questions confuse them.
- **Never re-ask anything in a "Decisions already made" table.** Those are final. If something genuinely isn't covered, pick the simplest option, say what you chose, and flag it (each stage plan has a "Decisions this plan makes" list, and the README section 7 lists them for the owner).
- The owner sets up Supabase, Google sign-in and Vercel **themselves**. Don't walk them through it unless they ask. When they must do something (like running a new SQL file), explain it in plain language, one step at a time.
- Explain results plainly: what works, what was tested, and what's still open. Report failures honestly, with the output.

## 2. Read these first, in order, before writing any code

1. `Plans/README.md`: the index and the combined build order
2. `Plans/football-idea.md`, `Plans/Football-scenario.md`, `Plans/Punishments-and-loyalty.md`, `Plans/Extras-and-backlog.md` (it also lists the **rejected** ideas: never build those), `Plans/Install-first-access.md`, `Plans/Player-card-and-motion.md`
3. `Design/README.md` (open `Design/screens.html` too; tokens in `Design/tokens.css`)
4. `Plans/implementation/stage-2.md`: the most recent stage plan. Use it as the model for format and level of detail, and read its **"Decisions this plan makes"** and **"Changes made during the build"** sections. Skim `stage-1.md` the same way.
5. The root `README.md` (setup, behaviour, the choices list in section 7)

Then the code: `supabase/migrations/*.sql` (5 files), `supabase/seed.sql`, `tests/db/*`, `src/lib/*` (especially `api.ts`, `types.ts`, `games.ts`), `src/state/*`, `src/pages/*`, `src/components/*`.

## 3. Where things stand

- **Phase 1** built (`6ce68a9`). **Stage 1** (rename, design, install-first access, nights, RSVP and waiting list, check-in, money card, cancelled nights, WhatsApp share of a planned night) built in `e40931d`. **Stage 2** (games, team board A/B/C/bench, timer, swaps, penalties, admin-only goals, minutes played and in goal, keeper and sub suggestions, one rating per night with the team-impact fix) built in `880fe2e`.
- After that the owner added a public `/privacy.html` (`650c347`, needed so Google sign-in can be published; it's the one public page besides the Install screen, recorded in `Plans/Install-first-access.md`) and the `@supabase/server` dependency (`4f5a994`).
- **Stage 3** (the team suggester: `src/lib/suggest.ts`, Suggest teams on the team board, the "Extra team from N players" setting in migration file 6, `20261025000200_team_suggester.sql`) built on 2026-10-25; see `Plans/implementation/stage-3.md`.
- **Stage 3b** (player cards and self-ratings, Self vs friends, the portfolio profile with rating history, Motion animation, rating settings in the app, change history; migration file 7, `20261025000300_player_card.sql`) built on 2026-10-25; see `Plans/implementation/stage-3b-player-card.md`.
- **174 tests** pass (`npm test`); `npx tsc -b`, `npm run lint` (0 warnings) and `npm run build` are clean.
- **A real Supabase project exists.** Files 1-5 have been run on it; the owner was asked to run files 6 and 7 before pushing stages 3 and 3b. At the start, ask whether they have (multiple choice).
- **Never edit an existing migration file.** Every database change goes in a **new** file (stage 4 = `20261026000100_<name>.sql` or the date you build it, sorting after file 7): `alter table`, `create or replace function`, `drop function` + `create` when arguments or return columns change, and moving existing rows.
- `main` is pushed to GitHub (`YoussefEslam29/7gz-kora`) up to `4f5a994`, which includes stage 2.
- **Vercel:** project `7gz-kora` (team `team_iW3kj4FDmRd2y0Hz8b2U9cMN`, project `prj_6ro39cfyOF4eqvAFjfl17yu0l4Q5`; the Vercel MCP tools work for deployments and build logs, not for listing env vars). The first production deploy **failed on purpose**: `VITE_ALLOW_BROWSER` was set in the project's environment variables, and `vite.config.ts` refuses to build with it. The owner was told to delete that variable and redeploy, then do README Step 7 (Supabase Site URL and Redirect URLs, Google Authorized JavaScript origins), Step 6e (Google Branding with the privacy link, then Publish) and the real-phone sign-in test (README section 3). At the start, check the latest deployment's state with the Vercel MCP and tell the owner in one line whether it's live; if it failed again, show them the error from the build log in plain words.

## 4. Rules that are easy to get wrong (on top of `CLAUDE.md`)

- **New tables:** Supabase grants new tables and functions to `anon`/`authenticated` by default. In the new file, `enable row level security`, add a select policy, `revoke all ... from anon, authenticated`, `grant select ... to authenticated`, and revoke/grant every new function explicitly (see the end of file 5). The test stand-in has the same default grants (`tests/db/helpers.ts`, `SUPABASE_STUB`), so a missing revoke fails a test: keep a "cannot write directly / anon sees nothing" test for every new table.
- **Moving existing data in a migration:** file 2's triggers (`stints_recompute`, `goals_recompute`, and the ones on `saves` and `stint_players`) recalculate a closed night whenever its rows change. Disable the relevant triggers around a data move, or stored ratings get recalculated (stage 2's `migrate.test.ts` caught exactly this).
- Ratings stay computed **only** in `compute_match_ratings` (now defined in file 5). Stage 4's discipline deduction goes **into** it (a `discipline` line in `breakdown`, capped), not beside it.
- Team strength for the suggester comes from ratings already stored (season rating, then all-time, then **6.0**): don't add a second rating calculation.
- **Money stays exactly as it is.** No fines, deposits, extra costs, hourly prices or debt history (and punishments never cost money).
- Admins only start/end games, change teams, check people in and log goals.
- **Animation:** use only `m` components (`motion/react-m`) inside the app's `LazyMotion strict`, animate `transform`/`opacity`, and respect reduce motion (`src/components/motion.tsx`). Confirmations use `useConfirm()`, never `window.confirm`; success messages use `useToast()`.
- **The self-rating never changes a night rating.** It's only a new player's starting strength in the suggester (kept 4.5-7.5) and the Self vs friends meter.

## 5. How to work: stages 3, 4, 5 from `Plans/README.md`, one at a time

**Stage 3: team suggester** (`Plans/Football-scenario.md` section 5, plus the Settings row "Extra team from N players" in section 7):
- A **pure TypeScript** function (players + ratings in, teams out), with the four unit tests from the plan file: 12 at 6 a side → 2 teams; 16 at 6 a side → 6 / 6 / 4; 13 at 6 a side → 6 / 6 + 1 sub; balanced output for a known set of ratings. Snake draft, then pair swaps while they reduce the gap between the strongest and weakest team averages. Goalkeepers are not chosen by the suggester.
- `groups.min_extra_team_size` (default 3) in a new migration, editable by admins in Settings. Stage 2 deliberately left it for this stage.
- A **Suggest teams** button on the team board (`src/pages/Teams.tsx`) that fills the Out/A/B/C picks for the admin to tweak before saving. Players on the pitch during a game stay locked.

**Stage 4: punishments and loyalty points** (`Plans/Punishments-and-loyalty.md`, all of it). **Stage 5: Team of the Night/Month, best duos, results share** (`Plans/Extras-and-backlog.md` sections 5-7).

**For each stage:**

1. **Plan:** write an implementation plan for that stage only (writing-plans skill), saved as `Plans/implementation/stage-N.md`, in the same format as `stage-2.md` (header, global constraints, decisions this plan makes, file structure, tasks with complete code and tests, verification, spec coverage). Summarise it in plain words and get the owner's approval with a multiple-choice question. Last time the owner chose to build **here, step by step** (inline, not with helper agents): offer that first.
2. **Tests first:** every worked example in the plan files becomes a test. SQL logic in `tests/db` (PGlite); pure TypeScript in vitest next to the code (`src/lib/*.test.ts`).
3. **Build it.** Follow the existing code style: comment density, naming, small files.
4. **Verify:**
   - `npx tsc -b`, `npm run lint`, `npm test` and `npm run build` must all pass.
   - Check every changed screen at 390 px wide, in light and dark mode, against `Design/screens.html`, using the temporary stand-in (section 6).
   - Check that every new PostgREST embed is unambiguous (no `PGRST201`).
5. **Keep everything in sync:** the root `README.md` (setup, behaviour, the choices list, test count), `supabase/seed.sql` (demo data for the new features) and the in-app "How it works" screen.
6. **Report and commit:** tell the owner what was built and tested, and anything they must do (for example: run the new SQL file in the Supabase SQL Editor). Ask (multiple choice) whether to commit straight to `main`, their usual choice. Stage only the stage's files. Don't push unless asked. Add a "Changes made during the build" section to the stage plan.

## 6. Lessons from earlier sessions

**Seeing the app without the real Supabase.** Use a **temporary** stand-in in the session's scratch folder (the owner declined a permanent one). All the scripts are in `Plans/implementation/stage-2.md`, Task 11 (`session.mjs`, `db.mjs`, `postgrest.conf`, `proxy.mjs`, `live.mjs`, `shots.mjs`). Copy them and adapt `live.mjs` to set up whatever the new screens need.
- PGlite + `@electric-sql/pglite-socket` on `127.0.0.1:54329`, PostgREST **14.18** (v16 fails on Windows) with `db-prepared-statements = false`, `db-pool = 1`, `db-channel-enabled = false`, and `?sslmode=disable&gssencmode=disable` on the `db-uri`.
- `gh` isn't installed: download PostgREST with `curl` from `https://github.com/PostgREST/postgrest/releases/download/v14.18/postgrest-v14.18-windows-x86-64.zip`.
- Port 5173 is often taken by the owner's own `npm run dev`: run the stand-in app on **5180** (or **5181**: in the stage 3 session 5180 was taken too) (`VITE_ALLOW_BROWSER=true` plus the stand-in URL and key). Don't stop the owner's processes.
- Screenshots and clicks: `playwright-core` with the installed Edge (`channel: 'msedge'`). `shots.mjs` supports `AS=member` (the non-admin view) and `CLICK="<button text>"`. In Git Bash, set `MSYS_NO_PATHCONV=1` when passing `/` routes. Full-page screenshots draw the fixed bottom tab bar mid-page: that's expected.

**PostgREST embeds.** `matches` → `match_players` needs `match_players!match_players_match_id_fkey`, and `matches` → `games` uses `games!games_match_id_fkey`. New foreign keys create new paths: name constraints explicitly and test every embed.

**Test helpers** (`tests/db/helpers.ts`): `createDb({ before })` + `runMigrations` (test a migration against data stored the old way, like `migrate.test.ts`); `rpc()` and `selectAs()` act as a signed-in user with RLS on; `setupGroup`, `nightDetails`, `startNight`, `startGame`; `MatchBuilder` builds rating fixtures with `game()`, `period(minutes, lineup)`, `match()`, `goal()`, `vote()`. Extend these rather than starting over.

**Shell:** Git Bash and PowerShell both work. For big plan-to-file copies, extracting the fenced code block from the plan file with a small node script is more reliable than retyping (backticks inside bash heredocs get mangled).

## 7. Start now

1. Check the latest Vercel deployment (section 3) and report it in one line.
2. Ask (multiple choice) whether migration file 6 has been run on the live project.
3. Read everything in section 2, plus `Plans/implementation/stage-3.md`.
4. Write the stage 4 plan (punishments and loyalty points), summarise it in plain words, and ask for approval (multiple choice), offering to build it here, step by step, first.
