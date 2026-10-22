# Ta7dy-El-La3eeba: Weekly Football Rating App

> This document is the full brief for building the app. Read all of it before writing code. If anything is unclear, or two choices both seem reasonable, ask the owner before building. The owner is a hobbyist who wants the cheapest possible setup and is not an experienced developer.

---

## 0. Decisions already made (do not re-ask)

| Topic | Decision |
|---|---|
| App name | **Ta7dy-El-La3eeba** (spell it exactly like this, with the digit 7 and the digit 3) |
| Branding | Green and white, football (soccer) themed logo. See section 11. |
| Sign-in | **Google sign-in** |
| Language | **English only** (but names may contain Arabic letters, so use UTF-8 everywhere) |
| Season | **Yearly.** A new season starts automatically on 1 January. There is also an "All-time" tab. |
| Who can vote | **Only players who played in that match.** |
| How ratings work | **Mostly analytics (stats), with peer votes as a smaller part.** See section 6. |
| Vote scale | Whole numbers 1 to 10 (no half points; faster to tap) |
| Voting visibility | Hidden until voting closes, then everyone sees who voted what |
| Guests (non-app players) | Not in v1, but **the data model must make them easy to add later** (see section 8) |
| Distribution | Free web app (PWA). No App Store, no Play Store, no paid developer accounts. |
| Cost target | As close to free as possible |

---

## 1. What this is

A mobile-friendly app for a group of friends who play a football (soccer) match every week. Each match is recorded: who played, who scored, who assisted, and how the teams did. After the match the players who played vote on each other. The app turns all of that into a **performance rating for every player**, plus leaderboards, profiles and badges.

It is a private app for friends, not a public product. Everyone in a group can see everything, including who voted what.

### Goals
- Entering a match takes only a couple of minutes. Voting takes about 30 seconds per person.
- It works when the match is chaotic: teams change mid-match, goalkeepers rotate, and the number of players varies (usually 6 vs 6, sometimes 7).
- Ratings are driven mainly by **real match data**, not by popularity.
- It costs nothing, or almost nothing, to host and run.
- Friends install it from a website link, with no stores involved.
- New friends join with an invite code.

### Non-goals (for now)
- No public leagues, no strangers, no monetization.
- No live scoring or video, photos or chat.
- No fixed positions (everyone plays everywhere).

---

## 2. Key decision: build a PWA, not a native app

**Why:** Apple does not allow installing a normal iPhone app from a website unless you pay for an Apple Developer account ($99/year) and use the App Store or TestFlight. The owner wants free distribution through the browser for both iPhone and Android.

**Solution:** a Progressive Web App (PWA).
- One codebase for iPhone and Android.
- Friends open a link, then use "Add to Home Screen" (iPhone Safari: Share, then Add to Home Screen. Android Chrome: menu, then Install app). The app gets its own icon and opens full-screen like a native app.
- Hosting is free, and updates reach everyone as soon as you deploy.

**Known limitations to handle honestly in the UI:**
- On iPhone, push notifications only work once the app is added to the Home Screen (iOS 16.4 or newer). Include a short "How to install" screen.
- **Google sign-in inside an iPhone Home Screen app can be flaky** (the sign-in redirect sometimes does not return to the installed app). Test this on a real iPhone early, before building anything else. If it is a problem, add email magic link as a fallback sign-in and tell the owner.
- No App Store presence. That is fine for this use case.

**Optional later (Android only, free):** wrap the PWA as an APK (Capacitor or Bubblewrap/TWA). Not for the first version.

---

## 3. Recommended tech stack (cheap and simple)

Treat this as a recommendation. If you have a strong reason for a different choice, explain it and ask.

| Layer | Choice | Why |
|---|---|---|
| Frontend | React + TypeScript + Vite, Tailwind CSS | Fast, simple, great PWA support |
| PWA | `vite-plugin-pwa` (manifest, service worker, icons) | Installable on both platforms |
| Backend/DB | Supabase (Postgres, Auth, Row Level Security) | Free tier is plenty; SQL makes stats and leaderboards easy |
| Auth | Supabase Auth with the Google provider | Matches the owner's choice |
| Hosting | Vercel, Cloudflare Pages or Netlify (free tier) | One-click deploys from GitHub |
| Push notifications | Web Push (optional, phase 3) | Remind people to vote |

Notes:
- Free tiers can change. Check current limits before committing. Supabase's free tier may pause a project that sits unused for a while; a weekly game keeps it active, but mention this in the README.
- Use Row Level Security so users can only read and write data for groups they belong to.
- **Google sign-in setup (the owner must do this, so walk them through it step by step):** create a project in Google Cloud Console, configure the OAuth consent screen, create an OAuth client ID (Web), add the Supabase callback URL as an authorized redirect, then paste the client ID and secret into Supabase. Use only the basic scopes (email, profile) and publish the consent screen so friends are not limited to a "test users" list.

---

## 4. Users, groups and invite codes

- A **group** is one friend circle (for example "Thursday Football"). Most people will only ever have one.
- A **user** signs in with Google.
- Each group has a short **invite code** (for example `KICK-7Q3F`). New friends sign in with Google, enter the code and join.
- Roles:
  - **Admin/organizer:** creates matches, edits attendance and stats, fixes mistakes, regenerates or disables the invite code, removes members, promotes other admins.
  - **Member:** plays, votes, logs their own goals and assists.
- The person who creates the group becomes its first admin.

---

## 5. Match flow

1. **Create match** (admin): date, optional location, tick who played. Players can be added later because people join mid-match.
2. **Set lineups.** Assign each player to Team A or Team B and mark who is in goal. Teams change mid-match, so lineups are organized in **stints** (see 5.1).
3. **Log goals and assists** (see 5.2).
4. **Finish match** (admin): the final score is computed automatically from the goals logged. Voting opens for 24 hours.
5. **Voting window** (players who played only). The admin can close it early or extend it.
6. **Results revealed** when voting closes: every player's match rating (with the breakdown), Man of the Match, who voted what, and the updated season leaderboard.

### 5.1 Stints (how mid-match changes are handled)
A **stint** is a period of the match during which the lineups are fixed: who is on Team A, who is on Team B, and who is in goal on each side.
- Every match has at least one stint. Version 1 of the UI creates just one stint, so the admin sets teams once.
- Phase 2 adds a **"Lineup changed"** button that starts a new stint when someone switches teams, joins, leaves, or the goalkeeper changes. Goals are automatically attached to the stint that is currently active.
- Each stint has a **weight** (its share of the match). Default is an equal split between stints. The admin can optionally enter approximate minutes.
- **The data model must support stints from day one**, even though the v1 UI only uses one. That way phase 2 is just a UI addition.

### 5.2 Goals and assists
- Any player who played can log a goal ("I scored", with an optional assister, or tap the scorer and assister). The goal is attached to the active stint and to the scoring team.
- The assister (or the admin) **confirms** it. If nobody disputes it, it auto-confirms when the voting window closes.
- The admin can edit or delete any entry. Keep a simple audit log of edits.
- Because ratings depend on this data, **make logging very fast**: big buttons, a "who scored?" player grid, one tap for "assist: none".

---

## 6. The rating system (analytics first, votes second)

### 6.1 Overview
Each player gets one **match rating from 0 to 10** (shown with one decimal) per match:

```
match_rating = W_ANALYTICS x analytics_score + W_VOTES x peer_vote_average
```

Default weights: `W_ANALYTICS = 0.65`, `W_VOTES = 0.35`. Put all numbers in **one config file** (and later a per-group setting) so the owner can tune them without touching the logic.

If a player received **fewer than 2 votes** in a match, ignore the vote part and use the analytics score alone (mark it "stats only"). Never hide a rating just because votes are missing.

### 6.2 Analytics score (computed from logged data)
Start at a base of **5.0** for taking part, then add:

| Component | Default points | Cap |
|---|---|---|
| Goals | +1.0 per goal | +3.5 total |
| Assists | +0.7 per assist | +2.0 total |
| Team impact: net goals (goals for minus goals against) while on the pitch, summed across stints by weight | +0.25 per net goal | between -1.5 and +1.5 |
| Result: win +0.5, draw 0, loss -0.5, summed across stints by weight | as stated | |
| Goalkeeper: clean sheet during a stint of at least 25% of the match | +0.5 | +1.0 total |
| Saves (optional, only if the group chooses to log them) | +0.15 per save | +1.0 total |

Clamp the final analytics score between **1.0 and 10.0**.

Notes:
- Net goals already reflects defending and goalkeeping (a good defender or keeper keeps goals against low), which helps players who rarely score.
- Man of the Match is a separate honor and a badge. It is **not** added to the rating (the peer votes already carry that signal, and it would double count).
- Match-to-match fairness: a match with 14 goals produces bigger stats than one with 4. Phase 3 option: scale goal and assist points by the match's total goals.

### 6.3 Peer vote score
- Every player who played gives every **other** player who played a score from **1 to 10**, or taps **"Didn't see enough"** (excluded from the average).
- Votes cover the whole match and are not tied to a team, so someone on the losing side can still receive a 9.
- `peer_vote_average` is the mean of the scores received. No self-voting.
- Each voter also picks one **Man of the Match** (not themselves). Ties are shared.
- Optional fun votes (phase 3): best goal, worst miss, best save, fair play.

### 6.4 Worked examples (use these as unit tests)

**Player A:** 2 goals, 1 assist, team won, +2 net goals, peers average 7.6, one stint
- Analytics: 5 + 2.0 + 0.7 + 0.5 (net goals) + 0.5 (win) = **8.7**
- Rating: 0.65 x 8.7 + 0.35 x 7.6 = 5.655 + 2.66 = 8.315 -> **8.3**

**Player B:** no goals or assists, team lost, -1 net goal, peers average 8.0
- Analytics: 5 - 0.25 - 0.5 = **4.25**
- Rating: 0.65 x 4.25 + 0.35 x 8.0 = 2.7625 + 2.8 = 5.5625 -> **5.6**

Player B shows the **known weakness** of a stats-heavy system: a hard worker in a losing team who does not score gets a modest rating even if friends rate them highly. That is why peer votes stay in at 35% and the weights are configurable. After a few weeks the owner may want to raise `W_VOTES`.

### 6.5 Handling the chaos

| Situation | How it is handled |
|---|---|
| Players switch teams mid-match | Stints. Team impact and results are computed per stint, weighted. |
| Player arrived late or left early | They are only in the stints they were present for. Voters can choose "Didn't see enough". |
| Goalkeeper rotates | Goalkeepers are tracked per stint. They are rated like everyone else, plus the clean-sheet bonus. |
| 12 or 14 players | Voting screen is one scrollable list with a quick 1-10 tap row per player. |
| Someone games the vote | No self-voting, votes are only 35% of the rating, and votes are visible to the group afterward. |

### 6.6 Season and leaderboard
- **Season rating** = average of a player's match ratings in the calendar year.
- A player appears on the main leaderboard after **3 matches** (configurable).
- The leaderboard can be sorted by: rating, goals, assists, goals+assists, MVP count, matches played, clean sheets.
- Also show **recent form** (average of the last 5 matches) and a **rating over time** graph on profiles.
- Show a **"How is my rating calculated?"** screen with the exact formula and weights, plus the **breakdown for each match** (base, goals, assists, net goals, result, peer votes), so friends trust the number.

### 6.7 Voting rules
- Only players who played can vote.
- Voting opens when the admin finishes the match and closes after 24 hours (admin can close early or extend).
- Votes are hidden until voting closes, then visible to the group (who voted what).
- Voters can edit their votes until the window closes.
- After closing, ratings are final. The admin can reopen in an emergency, which is logged and recalculates ratings.

### 6.8 Possible later improvements
- Per-voter normalization (adjust for voters who give everyone 9s or everyone 4s), as a toggle.
- Scale stats by total goals in the match.
- Weighted votes (for example by time on the pitch).
- Optional defensive stats logging (tackles or interceptions) if the group wants them.

---

## 7. Screens

1. **Sign in** (Google button)
2. **Join or create group** (enter invite code or create a new group)
3. **Home:** next/last match, voting reminder ("Vote now, closes in 6h"), top 3 of the season
4. **Create/Edit match** (admin): date, players, teams, goalkeepers
5. **Match recorder:** fast goal and assist logging; "Lineup changed" button (phase 2); live score
6. **Match page:** lineups, goals and assists, score, status (open / voting / closed)
7. **Vote screen:** list of players, tap 1 to 10 for each, "Didn't see enough", Man of the Match pick, submit
8. **Match results:** every player's rating with breakdown, MVP, who voted what
9. **Leaderboard:** season (yearly) and all-time tabs, sortable
10. **Player profile:** average rating, rating graph, goals/assists/clean sheets, MVP count, badges
11. **Group settings** (admin): invite code, members and roles, rating weights, voting window
12. **How it works / Install guide:** the rating formula, plus how to add the app to the Home Screen on iPhone and Android

Design guidance: mobile first, big tap targets, usable one-handed, dark mode friendly. Speed matters more than looks.

---

## 8. Data model (starting point)

Key idea: **stats attach to a `player`, not directly to a `user`.** A player is usually linked to a user account, but may have no account. That makes guests easy to add later without changing any stats tables.

```
users            id, email, display_name, avatar_url, created_at
groups           id, name, invite_code, created_by, created_at
players          id, group_id, user_id (nullable), display_name, is_guest (bool, default false)
group_members    group_id, user_id, player_id, role (admin|member), joined_at

matches          id, group_id, played_at, location, status (draft|playing|voting|closed),
                 voting_closes_at, created_by
match_players    match_id, player_id

stints           id, match_id, ordinal, weight (0-1, shares sum to 1)
stint_players    stint_id, player_id, team (A|B), is_goalkeeper (bool)

goals            id, match_id, stint_id, scoring_team (A|B), scorer_id (player),
                 assister_id (player, nullable), confirmed (bool), created_by
saves            id, match_id, stint_id, goalkeeper_id, created_by    -- optional feature

ratings_votes    id, match_id, voter_id (player), target_id (player),
                 score (1-10, nullable), didnt_see (bool), comment, created_at
                 -- unique (match_id, voter_id, target_id), voter != target,
                 -- both must be in match_players
mvp_votes        match_id, voter_id, target_id                  -- unique (match_id, voter_id)
extra_votes      match_id, voter_id, target_id, kind            -- best_goal | worst_miss | best_save | fair_play

rating_config    group_id, w_analytics, w_votes, points (jsonb), min_votes, min_matches_for_leaderboard
match_ratings    match_id, player_id, analytics_score, vote_average, vote_count, final_rating, breakdown (jsonb)
audit_log        id, group_id, actor_id, action, details (jsonb), created_at
```

- Compute `match_ratings` in **one place** (a Postgres function, or a single well-tested TypeScript module) and store the result with its breakdown, recomputing when the voting window closes or data is edited.
- Season = the calendar year of `played_at`, so there is no `seasons` table to maintain in v1.
- Security: Row Level Security on every table, scoped by group membership. Voters can only write their own votes. Only admins can change matches, lineups and stats. A player can log goals only for matches they played in.

---

## 9. Badges (fun, phase 3)

- **MVP of the Month**
- **Golden Boot** (most goals in the year)
- **Playmaker** (most assists)
- **Wall** (most clean sheets as goalkeeper)
- **Most Consistent** (lowest variance in match ratings)
- **Most Improved**
- **Iron Man** (most matches attended)
- **Fan Favorite** (highest peer vote average)

---

## 10. Build phases

**Phase 1: MVP (get it into friends' hands)**
- Project setup, PWA install, hosting, Google sign-in (test on a real iPhone first)
- Groups, invite codes, roles
- Create match, attendance, teams A/B, goalkeeper tag (data model already supports stints; UI uses one stint)
- Fast goal and assist logging with confirmation
- Voting (1-10, "Didn't see enough", Man of the Match), 24-hour window, results with who voted what
- Rating calculation (analytics + votes, configurable weights) with the per-match breakdown
- Yearly leaderboard and basic profiles
- Install guide and "How is my rating calculated?" screen

**Phase 2: Mid-match changes and richer stats**
- "Lineup changed" button (multiple stints)
- Rating-over-time graphs, recent form, all-time tab
- Group settings screen for rating weights
- Admin tools: edit stats, reopen voting, audit log view

**Phase 3: Polish**
- Push notifications (voting reminders, "confirm this goal")
- Badges and extra fun votes
- Optional saves logging
- Per-voter normalization toggle, scaling by match goal total
- Guests (non-app players)
- Optional Android APK wrapper

---

## 11. Branding

- **Name:** Ta7dy-El-La3eeba. Home screen short name: **Ta7dy**.
- **Style:** green and white, clean and sporty.
- **Suggested palette (adjust if it looks better):** pitch green `#16A34A`, dark green `#0B5D2E`, white `#FFFFFF`, with a light grey for backgrounds. Check text contrast for readability.
- **Logo:** a simple football (soccer ball) in green and white, ideally inside a circle or shield. Create it as an SVG, then export the PWA icons: 192x192, 512x512, a maskable version, and an Apple touch icon (180x180). The logo must read clearly at small sizes.
- Set the PWA manifest `name`, `short_name`, `theme_color` (green) and `background_color` (white) to match.
- Do not copy any real club or league logo.

---

## 12. Cost

- Hosting (Vercel, Cloudflare Pages or Netlify): free tier
- Database and auth (Supabase) and Google sign-in: free tier
- Domain name: optional, around $10/year. A free `*.vercel.app` or similar address works fine.
- Apple/Google developer accounts: **not needed**

---

## 13. Remaining questions (ask the owner when you reach them)

1. After 3 to 4 real matches, do the ratings feel fair? Offer to adjust the weights and caps in section 6.2 and the 65/35 split.
2. Does the group want to log **saves** for goalkeepers, or is goals-conceded enough?
3. Does the owner want any team name or short group description shown in the app?

---

## 14. Instructions for Claude Code

- Start with **Phase 1 only**. Get it working end to end before adding anything.
- First task: a "hello world" PWA with Google sign-in, deployed and installed on a real iPhone and a real Android phone. Fix any sign-in problems before building features.
- Then set up Supabase (schema, Row Level Security, rating function), then build the screens.
- Explain any step the owner must do themselves (Google Cloud setup, creating the Supabase project, environment variables, connecting hosting) in plain language, one step at a time.
- Keep all rating numbers in one config. Write unit tests for the rating calculation using the worked examples in section 6.4, plus edge cases: a player with no votes, a goalkeeper with a clean sheet, a player present for only one of two stints, a match with no goals.
- Seed the database with 12 fake players and a couple of matches for testing.
- Keep the code simple and well commented. Write a README covering setup, environment variables, deployment, and how friends install the app on iPhone and Android.
- When a decision is not covered here, pick the simplest option, say what you chose, and flag it for the owner.
