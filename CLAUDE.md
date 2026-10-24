# 7GZ-KORA: rules for every session

A football rating PWA for a group of friends in Egypt (React + Supabase), being upgraded from Phase 1 ("Ta7dy-El-La3eeba") to **7GZ-KORA**. Everything agreed is in `Plans/` (start with `Plans/README.md`); the look is in `Design/README.md`. Stage plans go in `Plans/implementation/`.

## Working with the owner

- The owner is a hobbyist, not an experienced developer, and writes short informal English.
- **Ask every decision as a multiple-choice question** (the AskUserQuestion tool), with your recommended option first. Open-ended "tell me what to change" questions confuse them.
- **Never re-ask anything in a "Decisions already made" table.** Those are final. If something genuinely isn't covered, pick the simplest option, say what you chose, and flag it.
- The owner sets up Supabase (the project, running the migrations, Google sign-in) **themselves**. Don't walk them through it unless they ask. When they must do something, explain it in plain language, one step at a time.
- Explain results plainly: what works, what was tested, and what's still open. Report failures honestly, with the output.

## Rules that are easy to get wrong

- **Stay on Supabase.** No MongoDB or any other backend.
- **Money:** share = total cost ÷ number of players checked in, rounded **up** to a whole pound. **No other money features**: no fines, deposits, extra costs, hourly prices or debt history.
- **Admins only** start and end games, change teams, check people in and log goals. Players dispute goals and vote. (Phase 1 lets any player log goals; this changes.)
- **One rating per player per night.** Team impact is the plain **sum** of goal difference while on the pitch. Phase 1 averages it by stint weight; that's a bug, and stage 2 fixes it. Result points are weighted by minutes played. A draw decided on penalties is still a draw.
- Ratings stay computed in **one place** (`compute_match_ratings`), including discipline deductions. Every number stays owner-tunable in `rating_config`.
- **A night is still a row in `matches`.** Only the screens say "night".
- **Text on the brand green `#00BF63` is always black.** White only in the logo lettering.
- **In a browser, the website shows only the Install screen.** Sign-in happens only inside the installed app. `VITE_ALLOW_BROWSER=true` is a development-only bypass and must never be set on Vercel.
- **Names can be Arabic:** use `dir="auto"` or `<bdi>`, and keep them left-aligned in lists.

## Environment

- Windows 11, Node 24, Git Bash and PowerShell.
- Versions are in `package.json`. Check current library docs (Context7) before using a library API you aren't sure of; several packages are newer than you may expect.
- Icons are generated with `npx pwa-assets-generator`. The new icon set is in `Design/icons/`.
- Checks before calling anything done: `npx tsc -b`, `npm run lint`, `npm test` and `npm run build`.
