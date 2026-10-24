# 7GZ-KORA: Extra Features and Backlog

> More features for the match-night upgrade, agreed with the owner on 2026-10-24. Read `Football-scenario.md` first: this file builds on its nights, games, lineup periods and check-in. Section 8 lists what was **not** chosen (backlog) and what was **rejected**, so later sessions don't suggest them again. Every number is a suggested default the owner can change.

---

## 0. Decisions already made (do not re-ask)

| Topic | Decision |
|---|---|
| Cancelled nights | **Yes:** cancel with no ratings and no punishments |
| Full pitch | **Yes:** a cap on "I'm in" and a waiting list |
| Goalkeeper rotation | **Yes:** track minutes in goal and suggest who goes in next |
| Fair playing time | **Yes:** track minutes played and suggest who subs in next |
| Share to WhatsApp | **Yes** |
| Team of the Night | **Yes** (plus Team of the Month) |
| Best duos | **Yes:** partnerships and rivalries |
| Money | **No changes.** Each player's cost = total cost ÷ number of players, exactly as in `Football-scenario.md` section 4. No extra costs, deposits, debt history or hourly pricing. |

---

## 1. Cancelled nights

- An admin can **Cancel night** while it's planned or in progress, and picks a reason: rain, not enough players, pitch problem, or other (with a note).
- A cancelled night has **no votes, no ratings, no punishments and no loyalty points**, for anyone. That includes "I'm in" players who didn't come, and late arrivals.
- If games were already played and you just stopped early, use **End night** instead, so what was played still counts. Cancel means nothing counts.
- **Money:** a cancelled night costs nothing by default. If the pitch still charges something (a lost deposit or cancellation fee), the admin enters that amount. It's split with the same formula (amount ÷ number of players) among the people checked in, or among those who said "I'm in" if nobody had checked in yet.
- New night status: `cancelled`. Cancelled nights stay in the Nights list, marked "Cancelled · Rain".

---

## 2. Full pitch and waiting list

- Each night has a **player cap**, which defaults to 3 × players per side (18 for 6 a side). The admin can change it or set "no limit".
- When the night is full, "I'm in" puts you on the **waiting list** in the order people tapped: "You're #2 on the waiting list".
- When someone changes to "Out", the first person on the waiting list **moves up automatically**. They see "You're in!" next time they open the app (there are no push notifications yet).
- **Punishment rules** (`Punishments-and-loyalty.md`):
  - Waiting-list players who don't come are **not** no-shows, because they were never "in".
  - A **late cancel isn't punished if a waiting-list player takes the spot**. The spot was filled, so nobody was let down.
- The cap applies to RSVPs only. An admin can still check in anyone who turns up.

---

## 3. Goalkeeper rotation

- The app tracks **minutes in goal** for each player, per night and per season, from the lineup periods where they were marked as goalkeeper.
- When an admin starts a game, the app **pre-selects a goalkeeper for each team**: the player on that team with the fewest minutes in goal tonight, then the fewest this season. The admin can change it with one tap.
- A player can turn on **"Happy to play in goal"** on their profile. Those players are suggested first.
- Shown: minutes in goal on the night page and on profiles.

---

## 4. Fair playing time

- The app tracks **minutes played** for everyone checked in, live, from the lineup periods.
- The team board shows each player's minutes tonight, so the admin can see who has hardly played.
- **Sub suggestion:** when there are subs on the bench, at **Next game** (or when the admin taps Sub in), the app suggests swapping the player with the **most minutes** for the bench player with the **fewest**. The admin can accept it or pick someone else.
- A waiting third team is not "the bench": they play the next game, so they aren't counted as subs.
- Shown: minutes played per player on the night page, and average minutes per night on profiles.

---

## 5. Share to WhatsApp

The app makes ready-to-send text and opens the phone's share sheet (WhatsApp, or anything else). If sharing isn't available, it copies the text.

| When | What gets shared |
|---|---|
| Night planned | "Thursday 20:00 at Pitch 3 · 6 a side · 11 in so far. Open 7GZ-KORA to say if you're in." (Links open the Install screen in a browser: see `Install-first-access.md`.) |
| Night cancelled | "Tonight is cancelled (rain)." |
| After voting closes | Games played and results, Man of the Match, the top 3 ratings, Team of the Night, and "47 EGP each to Ahmed" |

Text only for now. A picture card is in the backlog.

---

## 6. Team of the Night (and of the Month)

- **Team of the Night**, shown on the night's results once voting closes. The goalkeeper is the best-rated player among those with the most minutes in goal that night. The rest are the next highest-rated players, up to players per side in total. There are no fixed positions, as in `football-idea.md`.
- **Team of the Month**, chosen the same way from average night ratings across the month's nights (at least 2 nights played). It's shown on Home at the start of the next month and on the Table tab.
- Both are shareable (section 5).

---

## 7. Best duos

Worked out from the games and lineup periods, with no new data to enter:

- **Best partner:** for each pair of players, the games they played together on the same team and how many they won. A profile shows "Best partner: Omar, won 8 of 10 together" (at least 5 games together).
- **Toughest rival:** the opponent you lose to most (at least 5 games against).
- **Goal combos:** scorer and assister pairs, such as "Karim → Ziad: 6 goals".
- A **Duos** tab on the Table screen lists the group's best partnerships this season.

A game "played together" means both were on the pitch for the same team at the end of the game, so a mid-game swap counts for the team you finished with.

---

## 8. Backlog and rejected ideas

**Backlog** (not chosen on 2026-10-24; can be revisited):

| Idea | Note |
|---|---|
| Per-night "recorder" role | **Risk:** only admins can record, so if no admin comes nothing can be recorded. Workaround that works today: promote someone to admin in Settings before the night. |
| Guest players (no account) | Already out of scope in `Football-scenario.md`. The data model allows them later. |
| Leaving early as a punishment | Not chosen. Leaving early is recorded (check-out) but not punished. |
| King of the pitch (win streaks, most wins) | Fun stats for later |
| Duties rota (ball, bibs, water) | Could give loyalty points later |
| Picture card for WhatsApp shares | Section 5 shares text only |

**Rejected** (don't suggest again):

| Idea | Why |
|---|---|
| Money extras: extra costs, deposits, debt history, hourly price | The owner wants the money to stay simple: total cost ÷ number of players. |
| Priority for spots based on loyalty | Loyalty points give only the Loyalty table and badges. The waiting list is first come, first served. |
| Money fines as punishments | Punishments are points and a rating deduction only. |
| Switching to MongoDB | Staying on Supabase. |

---

## 9. Where each feature fits in the build

| Feature | Build with |
|---|---|
| Cancelled nights, waiting list, WhatsApp share of a planned night | `Football-scenario.md` stage 1 (Nights) |
| Goalkeeper rotation, fair playing time | Stage 2 (Games), because they need lineup periods and timestamps |
| Team of the Night/Month, best duos, results share | After stage 2, because they need per-night ratings and games |

**Unit tests:** cancelled nights produce no ratings, punishments or points; the waiting list moves up in order; a late cancel filled from the waiting list isn't punished; goalkeeper and sub suggestions pick the fewest minutes; Team of the Night picks the right players; best-partner counts come from a known set of games.
