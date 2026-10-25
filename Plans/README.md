# Plans: start here

Everything agreed for the app lives in this folder. **Read every file before building anything.** Each file's "Decisions already made" table is final: don't re-ask those questions.

## Files, in reading order

| # | File | What it covers | Status |
|---|---|---|---|
| 1 | `football-idea.md` | The original brief: ratings, voting, groups, PWA, Supabase | Phase 1 **built** (commit `6ce68a9`, 2026-10-23) |
| 2 | `Football-scenario.md` | The match-night upgrade: nights, many short games, winner stays on, swaps, penalties, rent split, team suggester, rename to **7GZ-KORA** | Stages 1-3 **built** (`e40931d`, `880fe2e`, and the team suggester on 2026-10-25) |
| 3 | `Punishments-and-loyalty.md` | Punishments (late, absences, injuries, time-wasting), loyalty points, badges | Agreed 2026-10-24, not built (stage 4) |
| 4 | `Extras-and-backlog.md` | Cancelled nights, waiting list, goalkeeper rotation, playing time, WhatsApp sharing, Team of the Night, best duos, **plus the backlog and rejected ideas** | Sections 1-5 **built** in stages 1-2; Team of the Night/Month, best duos and the results share not built (stage 5) |
| 5 | `Install-first-access.md` | The website shows only an Install screen; sign-in only inside the installed app; the public sees just the name and logo | **Built** in stage 1 (`e40931d`); plus a public privacy page (`650c347`) |
| 6 | `Player-card-and-motion.md` | Player cards and self-ratings, Self vs friends, profiles as portfolios with rating history, animation (Motion), rating settings in the app, change history | **Built** as stage 3b (2026-10-25) |

**Design:** the app's look (colours, fonts, logo, icons, components, screen designs) is in **`Design/README.md`** at the project root. Open `Design/screens.html` in a browser to see it. It's applied in stage 1, together with the rename to 7GZ-KORA.

## Build order (all files together)

1. **Nights:** rename to 7GZ-KORA, apply the new design (`Design/README.md` section 9) and install-first access (`Install-first-access.md`), plan a night, RSVP, check-in, Money card, plus cancelled nights, the waiting list and sharing a planned night to WhatsApp
2. **Games:** games, timer, team board, swaps, penalties, admin-only recording, per-night ratings (with the team-impact fix), plus goalkeeper rotation and playing time
3. **Team suggester**
3b. **Player card, rating history and motion** (`Player-card-and-motion.md`)
4. **Punishments and loyalty points**
5. **Team of the Night/Month, best duos**, and sharing results to WhatsApp

Finish and test each stage before starting the next. Every plan file has worked examples to use as unit tests.

## Before building

- Check with the owner whether the setup in the root `README.md` is done: the Supabase project, Google sign-in, the Vercel deploy, and the real-iPhone sign-in test from `football-idea.md`.
- Start the build session with: *"Read Plans/NEXT-SESSION-PROMPT.md and follow it."* That file holds the full instructions for the build session.
