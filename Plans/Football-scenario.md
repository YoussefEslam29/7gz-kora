# 7GZ-KORA: Match-Night Upgrade

> This brief upgrades the app built from `football-idea.md` so it follows how our nights actually work. Read `football-idea.md` first: everything there still applies unless this file changes it. The decisions below were agreed with the owner on 2026-10-24. Don't re-ask them.

---

## 0. Decisions already made (do not re-ask)

| Topic | Decision |
|---|---|
| App name | **7GZ-KORA** (replaces Ta7dy-El-La3eeba everywhere: home screen name, header, sign-in, README) |
| Database | **Stay on Supabase.** No MongoDB. |
| Unit of the app | A **night**: one pitch booking (about 2 hours) holding many short games |
| Ratings | **One rating per player per night**, from all the night's games. One vote at the end of the night. |
| How a game ends | **Timed** (default 10 minutes, as a guide). The admin can end a game early or let it run long. |
| Draws with a team waiting | **Penalties decide who stays.** For ratings, the game is still a draw and shootout goals don't count. |
| 1–2 extra players | **Subs** who rotate in between games |
| 3 or more extra players | **A third team**, which plays the winner (winner stays on) |
| Mid-game swaps to balance teams | **The admin chooses each time:** "swap and continue" (the score carries on) or "end game and swap" |
| Who records | **Admins only** start and end games, change teams and log goals. Players dispute goals and vote. |
| Team picking | The app **suggests balanced teams** from ratings; the admin can tweak them. |
| Attendance | **Both:** an optional "I'm in" before the night, plus check-in at the pitch. Who checked in is what counts. |
| Rent split | **Equal split** among everyone who checked in: total cost ÷ number of players, **rounded up to a whole pound** (confirmed 2026-10-24). People who said "I'm in" but didn't come pay nothing. Don't add other money features. |
| Collecting money | A **collector** is picked per night. Everyone pays them their share; after the booking they pay the pitch owner. |
| Punishments and loyalty | Specified separately in **`Punishments-and-loyalty.md`** (lateness, absences, injuries, time-wasting, loyalty points and badges). Keep check-in times and RSVP changes timestamped so it can use them. |

---

## 1. The scenario (how a night really goes)

1. We rent a random pitch for 2 hours at a cost. Price and size change from pitch to pitch.
2. We meet up without knowing how many will come. Some arrive late, some leave early, but we play.
3. How many play on each side depends on the pitch (5, 6 or 7 a side).
4. If one team is much stronger, we swap players between the teams in the middle of a game.
5. If 3 or more people are left over, they form a third team that plays the winner. 1–2 extras rotate in as subs.
6. With only 2 teams, the night is fluid: sometimes short games, sometimes one team stays on for a long time when we're tired.
7. At the end, we split the rent equally. Everyone pays that night's collector, who pays the pitch owner.

---

## 2. A night, step by step

### Before the night (status `planned`)
- An admin taps **Plan a night**: date and start time, pitch (name or place), length (default 2 hours), total cost in EGP, players per side (5/6/7), the collector, and the default game length (10 minutes).
- Every field is pre-filled from the previous night, so planning usually takes one tap to confirm.
- Players tap **I'm in** or **Out**. The night page shows the count, for example "11 in · 2 out · 4 no reply". The admin can use it to pick the pitch size.

### At the pitch (status `playing`)
The admin taps **Start night**, then runs everything from one control screen:

1. **Check-in.** Tap a name to check them in; the arrival time is saved. Anyone in the group can be checked in, whether or not they said "I'm in". Tap again to mark someone as having left early.
2. **Suggest teams.** Splits everyone checked in into fair teams (see section 5). The admin can move people by tapping. Players not on a team are on the **bench** (subs).
3. **Start game.** Pick the two teams (the app pre-selects them) and the goalkeepers. A timer starts.
4. **During the game:**
   - **Goal:** the admin taps the scorer and then the assister (or "No assist"), using the same fast grid as now.
   - **Swap players:** pick who moves where, then choose **Swap and continue** (same game, score carries on, a new lineup period starts) or **End game and swap** (the game ends with the current score, and the next one starts 0–0 with the new teams).
   - **Sub in** from the bench works the same way.
5. **Game over.** The timer buzzes at the set length but never ends the game by itself; the admin taps **Game over**. If it's a draw and another team is waiting, the app asks **who won on penalties?**
6. **Next game.** The app suggests: the winner (or penalty winner) stays on, the loser goes off, and the waiting team comes on. With only 2 teams, it suggests the same teams again. The admin can change anything.
7. **End night** stops the clock. Voting opens (24 hours, same rules as now) and the money card appears.

Everyone else sees a live, read-only view: score, timer, who's on and who's on the bench.

### After the night (status `voting`, then `closed`)
- Voting is the same as today: everyone who checked in rates everyone else who checked in, 1–10 or "Didn't see", plus a Man of the Match.
- The **Money card** shows the total cost, each share, the collector, and who has paid back.
- When voting closes, ratings are calculated, the same as today.

---

## 3. Ratings: one per night

The formula and weights don't change:

```
night_rating = w_analytics x analytics_score + w_votes x peer_vote_average   (0.65 / 0.35)
```

The analytics score now adds up over the whole night. All numbers stay in `rating_config` (`points`).

| Component | Rule for a night | Default |
|---|---|---|
| Base | For playing | 5.0 |
| Goals | Total goals in the night | +1.0 each, max +3.5 |
| Assists | Total assists in the night | +0.7 each, max +2.0 |
| Team impact | **Goal difference while you were on the pitch, added up** over every lineup period you played | +0.25 per goal, between −1.5 and +1.5 |
| Result | **Average result over your minutes played:** for each period, your team's final result in that game (win +0.5, draw 0, loss −0.5), weighted by minutes on the pitch | between −0.5 and +0.5 |
| Clean sheet | In goal for a **whole game** (every period of it), the game lasted at least `clean_sheet_min_minutes`, and nothing conceded | +0.5 each, max +1.0 |
| Saves | Unchanged (optional feature) | +0.15 each, max +1.0 |

The total is still kept between 1.0 and 10.0. "Stats only" with fewer than 2 votes and Man of the Match both work as now.

New `points` keys: `clean_sheet_min_minutes` (default 8). `clean_sheet_min_share` is no longer used.

**Bug fix included in this upgrade.** The current code *averages* goal difference across lineup periods: it weights each period's goal difference by the period's share of the match. The brief's wording ("summed across stints by weight") led to that, and it means splitting a match into periods shrinks everyone's team impact. Team impact must be the plain sum of goal difference while on the pitch, as in the table above. Weighting by time applies to **result only**.

### Penalties
A draw decided on penalties is a **draw** for ratings (0 result points). Shootout goals aren't recorded as goals. The penalty winner only decides who stays on.

### Worked examples (use these as unit tests)

**Example 1: winner stays, three teams, 10-minute games.**
Game 1: A 2–1 B. Game 2: A 0–0 C, and C wins on penalties. Game 3: C 1–2 B.
Player P, on Team A, plays games 1 and 2 (20 minutes) and scores once in game 1. Peers average 7.0 (3 votes).
- Goals: +1.0
- Team impact: +1 (game 1) + 0 (game 2) = +1 → **+0.25**
- Result: (10 min × +0.5 + 10 min × 0) ÷ 20 min = **+0.25**
- Analytics: 5 + 1.0 + 0.25 + 0.25 = **6.5**
- Rating: 0.65 × 6.5 + 0.35 × 7.0 = 4.225 + 2.45 = 6.675 → **6.7**

**Example 2: swap and continue.**
A 10-minute game, A against B. After 6 minutes it's A 2–0 B, and the admin swaps S (A → B) with T (B → A), choosing "Swap and continue". B then scores once. Final: A 2–1 B.
- S: goal difference +2 (with A) + 1 (with B) = +3 → +0.75. Result: (6 × +0.5 + 4 × −0.5) ÷ 10 = +0.1. Analytics **5.85**.
- T: goal difference −2 (with B) − 1 (with A) = −3 → −0.75. Result: (6 × −0.5 + 4 × +0.5) ÷ 10 = −0.1. Analytics **4.15**.

**Example 3: late arrival.** Plays only Game 3 above (10 minutes, on B, 2–1 win), no goals.
- Team impact +1 → +0.25. Result +0.5 (won all their minutes). Analytics **5.75**.

**Example 4: clean sheet.** The goalkeeper in goal for all of Game 2 (A 0–0 C, 10 minutes) gets **+0.5**. A keeper swapped out halfway through a game gets nothing for that game. So does a keeper in a game shorter than 8 minutes.

**Example 5: penalties don't change the result.** In Game 2, Team C's players get 0 result points, not +0.5, even though they won the shootout.

Also test: a night with no goals; a player checked in who never got on the pitch (only base + votes); "End game and swap" (two separate games); a goalkeeper swapped mid-game.

---

## 4. Money

- The night has a **total cost** (EGP) and a **collector** (any player in the group).
- **Share** = total cost ÷ number of people checked in, **rounded up to a whole pound**. The Money card shows any extra this creates ("collector receives 11 EGP more than the pitch costs") so it's transparent.
- The collector counts in the split and is marked as paid automatically.
- The **collector or an admin** ticks each person as paid. Players can't mark themselves.
- Each player sees: "You owe **47 EGP** to **Ahmed**" until they're ticked off. The collector sees "Collected 423 of 611 EGP".
- People who said "I'm in" but never checked in are **not** charged.
- If someone is checked in after the shares have been shown, the shares recalculate automatically; payments already ticked stay ticked.

**Worked example (unit test):** cost 600 EGP, 13 checked in → 600 ÷ 13 = 46.15 → **47 EGP** each, 611 collected, **11 EGP** extra.

---

## 5. Team suggester

**Who:** everyone checked in and not marked as left, plus the "players per side" (n) for the night.

**How many teams:**
- Fewer than 2n players: two teams as even as possible (9 → 5 and 4).
- Otherwise two teams of n. The leftover r = players − 2n: if r ≥ 3, they form a third team (up to n players; another team if still ≥ 3 are left over). Fewer than 3 left over go on the bench as subs.
- The "3" is a group setting, `min_extra_team_size` (default 3).

**Balance:** each player's strength is their season rating. If they have none, use their all-time rating, then **6.0** for brand-new players. Teams are filled snake-draft style (best to A, next to B, next to C, then back the other way). Then the suggester swaps pairs while that reduces the gap between the strongest and weakest team averages. Goalkeepers are chosen per game, not by the suggester.

The suggester is a **pure TypeScript function** (players + ratings in, teams out) with unit tests: 12 players at 6 a side → 2 teams; 16 at 6 a side → 6 / 6 / 4; 13 at 6 a side → 6 / 6 + 1 sub; balanced output for a known set of ratings.

---

## 6. Data model changes (Supabase)

In the database, a night is still a row in **`matches`** (the screens say "night"). That keeps all of today's voting, rating and security code working.

```
matches          + starts_at (timestamptz), duration_minutes (default 120), players_per_side (5-11),
                 + cost (numeric), currency (default 'EGP'), collector_player_id (player),
                 + game_minutes (default 10)
                 status: draft = "planned", playing = "night in progress", voting, closed

rsvps            NEW  match_id, player_id, status (in|out), updated_at       -- unique (match_id, player_id)

match_players    = checked in. + arrived_at, left_at (nullable),
                 + team ('A'|'B'|'C'|null = bench), is_goalkeeper   -- the CURRENT team board
                 + paid_at (nullable), paid_marked_by

games            NEW  id, match_id, ordinal, team_one, team_two ('A'|'B'|'C'),
                 started_at, ended_at, planned_minutes, penalty_winner (nullable, one of the two teams)

stints           = lineup periods. + game_id, started_at, ended_at
                 (minutes come from the timestamps; the old `weight` column is dropped)

stint_players    team check widened to 'A'|'B'|'C'
goals            + game_id; scoring_team widened to 'A'|'B'|'C'
groups           + min_extra_team_size (default 3)
rating_config    points: + clean_sheet_min_minutes (default 8), - clean_sheet_min_share
```

- **New actions** (database functions, the same style as today): `plan_night`, `set_rsvp`, `start_night`, `check_in` / `check_out`, `set_team_board`, `start_game`, `swap_players(continue boolean)`, `end_game(penalty_winner)`, `end_night`, `mark_paid` / `unmark_paid`. Existing actions are adjusted to fit.
- **Permissions:** game, goal, team and check-in actions are **admin only** (`log_goal` included; it is open to players today). `mark_paid` is allowed for the night's collector or an admin. `set_rsvp` is for players themselves.
- **Rating function:** `compute_match_ratings` is rewritten for section 3 and stays the one place ratings are calculated.
- **Existing data:** each existing match becomes a night with one game and one lineup period. Ratings that are already stored are not recalculated.
- **Seed data:** replace the demo matches with demo nights: three teams, penalties, a mid-game swap, late arrivals and a part-paid money card.

---

## 7. Screens

| Screen | What changes |
|---|---|
| Bottom tab "Matches" | Becomes **Nights**: list of nights with date, pitch, games played, your rating |
| Home | Next planned night with I'm in / Out; live night card; "You owe X EGP"; voting reminder; top 3 |
| Plan a night (admin) | New. The fields from section 2, pre-filled from last night |
| Night page: planned | RSVP buttons and counts; admin: Edit, Start night |
| Night page: live (admin) | Control room: check-in list, team board (A/B/C/bench) with Suggest teams, current game card (timer, score, Goal, Swap, Game over), next-game suggestion |
| Night page: live (others) | Read-only: score, timer, teams, bench, games so far |
| Night page: voting / closed | As today (ratings, breakdown, who voted what), plus the list of games and the Money card |
| How it works | Updated for night ratings, penalties and money |
| Settings | + "Extra team from N players" (`min_extra_team_size`) |

The control room is used one-handed at the pitch: big buttons, everything on one scrolling screen, and the current game card stays visible at the top.

---

## 8. Build stages

Each stage is usable on its own. Finish and test one before starting the next.

1. **Nights:** rename to 7GZ-KORA, plan a night, RSVP, check-in/out, the Money card with payments.
2. **Games:** games, timer, team board, swaps (both kinds), penalties, next-game suggestion, admin-only recording, and the new per-night rating with the worked examples as tests (including the team-impact fix).
3. **Team suggester**, with its unit tests.
4. **Punishments and loyalty points:** see `Punishments-and-loyalty.md`. It needs stages 1 and 2.
5. **Extras:** see `Extras-and-backlog.md`. Some of them are built inside stages 1 and 2 (its section 9 says which); Team of the Night/Month and best duos come last.

The full combined order is in `Plans/README.md`.

---

## 9. Out of scope (for now)

- Working offline at the pitch: recording needs mobile data. Revisit if signal at pitches is a problem.
- Paying through the app (InstaPay, Vodafone Cash). It only tracks who has paid.
- Guest players without accounts. The data model already allows them; still planned for later.
- Push notifications, badges and fun votes (phase 3 of `football-idea.md`).

---

## 10. Defaults to review with the owner after a few nights

- Default game length (10 minutes) and the clean-sheet minimum (8 minutes).
- Team impact capped at ±1.5 per night. Long nights may hit the cap often, so check whether the cap should rise.
- Result is averaged over minutes played, so someone who plays one game and wins gets the full +0.5, the same as someone who wins every game. Team impact is what rewards playing (and winning) more.
- New players start at 6.0 in the team suggester.
- Shares are rounded up to a whole pound (the collector keeps the extra).
