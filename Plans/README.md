# Plans: start here

Everything agreed for the app lives in this folder. **Read every file before building anything.** Each file's "Decisions already made" table is final: don't re-ask those questions.

## Files, in reading order

| # | File | What it covers | Status |
|---|---|---|---|
| 1 | `football-idea.md` | The original brief: ratings, voting, groups, PWA, Supabase | Phase 1 **built** (commit `6ce68a9`, 2026-10-23) |
| 2 | `Football-scenario.md` | The match-night upgrade: nights, many short games, winner stays on, swaps, penalties, rent split, team suggester, rename to **7GZ-KORA** | Agreed 2026-10-24, not built |
| 3 | `Punishments-and-loyalty.md` | Punishments (late, absences, injuries, time-wasting), loyalty points, badges | Agreed 2026-10-24, not built |
| 4 | `Extras-and-backlog.md` | Cancelled nights, waiting list, goalkeeper rotation, playing time, WhatsApp sharing, Team of the Night, best duos, **plus the backlog and rejected ideas** | Agreed 2026-10-24, not built |

## Build order (all files together)

1. **Nights:** rename to 7GZ-KORA, plan a night, RSVP, check-in, Money card, plus cancelled nights, the waiting list and sharing a planned night to WhatsApp
2. **Games:** games, timer, team board, swaps, penalties, admin-only recording, per-night ratings (with the team-impact fix), plus goalkeeper rotation and playing time
3. **Team suggester**
4. **Punishments and loyalty points**
5. **Team of the Night/Month, best duos**, and sharing results to WhatsApp

Finish and test each stage before starting the next. Every plan file has worked examples to use as unit tests.

## Before building

- Check with the owner whether the setup in the root `README.md` is done: the Supabase project, Google sign-in, the Vercel deploy, and the real-iPhone sign-in test from `football-idea.md`.
- Start the build session with: *"Read Plans/README.md and every file in Plans/, then write the implementation plan for stage 1."*
