# Prompt for the next Claude Code session: build the 7GZ-KORA upgrade

You're continuing an existing project: a football rating PWA for a group of friends in Egypt, being upgraded and renamed **7GZ-KORA**. Everything to build is already decided and written down. Your job is to implement it, stage by stage, with tests, and with the owner's approval at each step.

---

## 1. Working with the owner

- The owner is a hobbyist, not an experienced developer, and writes short informal English.
- **Ask every decision as a multiple-choice question** (the AskUserQuestion tool), with your recommended option first. Open-ended "tell me what to change" questions confuse them.
- **Never re-ask anything in a "Decisions already made" table.** Those are final. If something genuinely isn't covered, pick the simplest option, say what you chose, and flag it.
- The owner sets up Supabase (the project, running the migrations, Google sign-in) **themselves**. Don't walk them through it unless they ask. When they must do something, explain it in plain language, one step at a time.
- Explain results plainly: what works, what was tested, and what's still open. Report failures honestly, with the output.

## 2. Read these first, in order, before writing any code

1. `Plans/README.md`: the index and the combined build order
2. `Plans/football-idea.md`: the original brief (Phase 1, already built)
3. `Plans/Football-scenario.md`: match nights, games, rent split, team suggester, rename
4. `Plans/Punishments-and-loyalty.md`
5. `Plans/Extras-and-backlog.md`: also lists the **rejected** ideas. Never build those.
6. `Plans/Install-first-access.md`
7. `Design/README.md` (open `Design/screens.html` too; the tokens are in `Design/tokens.css`)
8. The root `README.md`: the current setup instructions

Then read the existing code: `supabase/migrations/*.sql` (3 files), `supabase/seed.sql`, `tests/db/*`, `src/lib/api.ts`, `src/state/*`, `src/pages/*` and `src/components/*`.

## 3. Where things stand

- **Phase 1 is built** (commit `6ce68a9`):
  - The app: React 19, TypeScript 6, Vite 8 with vite-plugin-pwa 2, Tailwind 4 and react-router 8.
  - The backend: Supabase via supabase-js 2. Every table has Row Level Security; all writes go through `SECURITY DEFINER` database functions; access is granted explicitly with GRANTs.
  - Ratings are computed in **one** Postgres function, `compute_match_ratings`.
  - 26 database tests run the real migrations in PGlite (`npm test`), with no Docker.
- **Plans and design are committed but not built:** `9306cbc`, `dcfd2a3` and `d3ce89d`.
- The app isn't connected to a real Supabase project yet (there's no `.env.local`). **Ask the owner whether the 3 existing migrations have been run on a real project.** If yes, only *add* new migration files. If not, you may restructure the existing ones.

## 4. Rules that are easy to get wrong

- **Stay on Supabase.** No MongoDB or any other backend.
- **Money:** share = total cost ÷ number of players checked in, rounded **up** to a whole pound. **No other money features**: no fines, deposits, extra costs, hourly prices or debt history.
- **Admins only** start and end games, change teams, check people in and log goals. Players dispute goals and vote. (Phase 1 lets any player log goals; this changes.)
- **One rating per player per night.** Team impact is the plain **sum** of goal difference while on the pitch. Phase 1 averages it by stint weight; that's a bug, and stage 2 fixes it. Result points are weighted by minutes played. A draw decided on penalties is still a draw.
- Ratings stay computed in **one place** (`compute_match_ratings`), including discipline deductions. Every number stays owner-tunable in `rating_config`.
- **A night is still a row in `matches`.** Only the screens say "night".
- **Text on the brand green `#00BF63` is always black.** White only in the logo lettering.
- **In a browser, the website shows only the Install screen.** Sign-in happens only inside the installed app. `VITE_ALLOW_BROWSER=true` is a development-only bypass and must never be set on Vercel.
- **Names can be Arabic:** use `dir="auto"` or `<bdi>`, and keep them left-aligned in lists.

## 5. How to work: the 5 stages in `Plans/README.md`, one at a time

**Stage 0 (ask first):** offer two helpers. Build them if the owner says yes.
- A root `CLAUDE.md` holding sections 1, 4 and 7 of this prompt, so every later session loads them automatically.
- A persistent local stand-in for Supabase (section 6), so the owner can see the app any time without a real project.

**For each stage:**

1. **Plan:** write an implementation plan for that stage only (use the writing-plans skill). Save it as `Plans/implementation/stage-N.md`, summarise it, and get the owner's approval with a multiple-choice question.
2. **Tests first:** every worked example in the plan files becomes a test. SQL logic goes in `tests/db` (PGlite). Pure TypeScript, such as the team suggester and the install-screen decision, goes in vitest.
3. **Build it.** Follow the existing code style: comment density, naming, small files.
4. **Verify:**
   - `npx tsc -b`, `npm run lint`, `npm test` and `npm run build` must all pass.
   - Check every changed screen at 390 px wide, in light and dark mode, against `Design/screens.html`.
   - Check that every new PostgREST embed is unambiguous (section 6).
5. **Keep everything in sync:** the root `README.md` (setup and behaviour), `supabase/seed.sql` (demo data for the new features) and the in-app "How it works" screen.
6. **Report and commit:** tell the owner what was built and tested. Ask (multiple choice) whether to commit the stage straight to `main`, which is their usual choice. Don't push unless asked.

**Stage 1** also includes the rename to 7GZ-KORA, applying the design (`Design/README.md` section 9), and install-first access.

## 6. Lessons from the previous session

**Seeing the app without a real Supabase.** The previous session checked the UI against a local stand-in that lived in a temporary folder, which is now gone. To rebuild it:
- **Database:** PGlite plus `@electric-sql/pglite-socket`, serving the migrations and the seed on `127.0.0.1:54329`.
  - Create stub roles `anon`, `authenticated`, `service_role` and `authenticator`.
  - Create an `auth` schema with an `auth.users` table and an `auth.uid()` that reads `request.jwt.claims` → `sub`.
- **API server:** PostgREST.
  - On Windows, **v16.x fails to start** (`0xC0000139`); **v14.18 works**.
  - `db-uri` must end in `?sslmode=disable&gssencmode=disable`, because pglite-socket doesn't answer SSL requests.
  - Also set `db-pool = 1` and `db-channel-enabled = false`.
- **Proxy:** a small one maps `/rest/v1/*` to PostgREST and stubs `/auth/v1/*`.
- **Signing in:** put a session in localStorage under the key `sb-localhost-auth-token`. Use an HS256 JWT (`role: authenticated`) signed with PostgREST's `jwt-secret`.
- **Screenshots and clicking:** use `playwright-core` with the installed Edge (`channel: 'msedge'`). In Git Bash, set `MSYS_NO_PATHCONV=1` when passing `/` routes as arguments.
- **Install screen:** with install-first access, set `VITE_ALLOW_BROWSER=true` for the stand-in.

**PostgREST gotcha:** embedding `match_players` from `matches` is ambiguous, because the vote tables' composite foreign keys create a second path. Use `match_players!match_players_match_id_fkey`. New tables (games, rsvps, loyalty_events, …) will create more paths, so test every embed for error `PGRST201`.

**Test setup:** `tests/db/helpers.ts` loads the real migrations into PGlite, with stand-ins for Supabase's roles and `auth` schema. `rpc()` and `selectAs()` act as a signed-in user with RLS on. `MatchBuilder` builds rating fixtures directly. Extend these rather than starting over.

## 7. Environment

- Windows 11, Node 24, Git Bash and PowerShell.
- Versions are in `package.json`. Check current library docs (Context7) before using a library API you aren't sure of; several packages are newer than you may expect.
- Icons are generated with `npx pwa-assets-generator`. The new icon set is in `Design/icons/`.

## 8. Start now

Read everything in section 2. Then ask the owner one multiple-choice batch:
1. Is Supabase set up, and have the 3 existing migrations been run on it?
2. Do they want the stage 0 helpers?
3. Shall we start stage 1?

Then write the stage 1 plan.
