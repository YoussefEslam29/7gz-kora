# 7GZ-KORA: Player Card, Rating History and Motion

> Every player fills in a **player card** about themselves (shirt number, foot, position, motto and a self-rating on five skills). Their profile becomes a **portfolio**: the card, "Self vs friends", a rating history graph and recent form. The whole app gets **animation** with the Motion library (formerly Framer Motion), so it feels alive. Two pieces promised in `football-idea.md` but never built come with it: **rating settings in the app** and the **change history** for admins. Agreed with the owner on 2026-10-25. Don't re-ask the decisions below. Build it **after stage 3** (the team suggester) is committed.

---

## 0. Decisions already made (do not re-ask)

| Topic | Decision |
|---|---|
| Player card | Each player fills in a card: shirt number, strong foot, favourite position, a short motto and a self-rating. Yourself, or an admin, can edit it. Everyone in the group sees every card. |
| Self-rating | **Five skills, 1–10 each:** Shooting, Passing, Dribbling, Defending, Fitness. The **self-rating is their average**, shown with one decimal. |
| What the self-rating is used for | **1. Team suggester:** a player with no rated nights starts at their self-rating instead of 6.0, kept between **4.5 and 7.5**. **2. "Self vs friends"** on the profile. It **never changes a night rating**: ratings stay calculated only in `compute_match_ratings`. |
| Favourite position | For show only. Teams still have no fixed positions (`football-idea.md` section 1). |
| Portfolio | The profile shows the card, Self vs friends, a rating history graph (Season / All-time), recent form, stats, and the nights with their breakdown. |
| Animation | The **Motion** library (`motion` package, formerly Framer Motion), at the **"Lively"** level (section 5). It follows the phone's "reduce motion" setting. |
| Extras from the original plan | **Rating settings** can be changed in the app by admins. **Change history:** admins see who did what and when, from the audit log the database already keeps. |
| Money, ratings, permissions | Unchanged. The rules in `CLAUDE.md` all still apply. |

---

## 1. The player card

### What's on it

| Field | Choices | Notes |
|---|---|---|
| Shirt number | 1–99, or none | Numbers can repeat in a group |
| Strong foot | Right · Left · Both | |
| Favourite position | Goal · Defence · Midfield · Attack · Anywhere | For show only |
| Motto | Up to 60 characters | Arabic is fine (`dir="auto"`) |
| Skills | Shooting, Passing, Dribbling, Defending, Fitness: 1–10 each | **All five or none.** The self-rating is their average. |
| Happy to play in goal | On / off | Already exists (stage 2); moves onto this screen |
| Name | As now | The "Change name" form moves onto this screen |

Every field is optional. A card counts as **filled in** once it has the skills or any of number, foot, position or motto.

### The card itself (`PlayerCard`)
A sticker-style card in the 7GZ-KORA look:
- A **honeycomb green band** at the top (a green surface, so its text is **black**) with the big shirt number in Archivo Black and the rating badge: this season's rating, else all-time, else a "NEW" chip.
- The name (`<Name>`), photo, chips for position, foot and "Happy in goal", and the motto in quotes.
- The five skills as bars on a 1–10 scale, with the self-rating number ("Rates themselves **7.6**").
- No real club or league logos, no copied game-card designs.

### Editing (`/players/:id/edit`, "Edit my card")
One screen: a live preview of the card at the top, then the fields in the order of the table above. The skills use the same tap rows as the vote screen (1–10 in two rows of five). **Save** returns to the profile with a "Card saved" message. Opened by the player themselves, or by an admin from anyone's profile.

### Welcome after joining (`/welcome`)
After **Join group** or **Create group**, a short welcome instead of going straight to Home:
1. **Your shirt:** number, foot, position
2. **Rate yourself:** the five skills
3. **Your card:** the motto, and the finished card sliding in. **Done** saves everything at once.

Every step has **Skip**. Players who joined earlier, or skipped, see a **"Finish your player card"** box on Home until their card is filled in. **Not now** hides it on that phone.

---

## 2. How the self-rating is used

### It never changes a night rating
If it did, everyone would give themselves a 10. Night ratings still come only from the games and the votes, in `compute_match_ratings`.

### Team suggester: the starting strength for new players
Stage 3 gives each player a strength: season rating, then all-time rating, then **6.0**. With this upgrade, that becomes:

1. Season rating
2. All-time rating
3. **Self-rating, kept between 4.5 and 7.5**
4. 6.0 (no rating and no self-rating)

The limits mean a newcomer who says "10" can't wreck the balance. After their first rated night, their real rating takes over. The limits sit in `src/lib/suggest.ts` beside `NEW_PLAYER_STRENGTH`.

### Self vs friends (the confidence meter)
It compares the self-rating with **what friends give them**: the average of their night-by-night peer vote averages (the `avg_votes` of `get_leaderboard`), on the same 1–10 scale. The final rating isn't used, because it mixes in the stats score.
- **Friends' score:** this season's, once the player has the table's number of rated nights this season (`min_matches_for_leaderboard`, default 3). Otherwise all-time, with the same rule. Otherwise the meter shows "Play N more nights to see what your friends think".
- **Gap** = self-rating − friends' score, rounded to one decimal:

| Gap | Label |
|---|---|
| −1.0 or less | **Modest** |
| between −1.0 and +1.0 | **Spot on** |
| +1.0 up to +2.0 | **Confident** |
| +2.0 or more | **Very confident** |

It's shown as two bars on the same scale ("Says 7.6 · Friends give 6.4"), with the label. It's for fun and changes nothing else.

### Worked examples (use these as unit tests)

**Self-rating:** skills 8, 7, 8, 6, 9 → 38 ÷ 5 = **7.6**. No skills → no self-rating.

**Self vs friends:**
- Self 7.6, friends 6.4 → gap +1.2 → **Confident**
- Self 6.0, friends 7.3 → gap −1.3 → **Modest**
- Self 7.0, friends 7.4 → gap −0.4 → **Spot on**
- Self 9.0, friends 6.4 → gap +2.6 → **Very confident**
- Exactly on the edges: −1.0 → **Modest**; +1.0 → **Confident**; +2.0 → **Very confident**
- Friends' votes all "didn't see" or stats only (no vote average) → "Not enough votes yet"

**Team suggester starting strength:**
- No rated nights, skills averaging 9.2 → **7.5**
- No rated nights, skills averaging 3.0 → **4.5**
- No rated nights, skills averaging 6.8 → **6.8**
- No rated nights, no skills → **6.0**
- Season rating 7.1 and a self-rating of 9.0 → **7.1** (the real rating wins)
- No season rating, all-time 6.3 → **6.3**

---

## 3. The portfolio (the profile page)

`/players/:id`, from top to bottom:

1. **Player card** (section 1), with **Edit my card** for the player or an admin
2. **Self vs friends** (section 2)
3. **Rating history:** a line graph of every rated night, oldest on the left, **Season / All-time** tabs. Dots are coloured by the rating bands (`Design/README.md` section 3) and always labelled with the number when tapped (never colour alone). The x-axis is the nights in order, not dates. One night shows a single dot. None shows the empty state. Drawn by hand in SVG: **no chart library**.
4. **Form:** the last 5 nights as rating badges (oldest to newest), their average, and an arrow against the average of the (up to 5) nights before them: **up** if at least 0.2 higher, **down** if at least 0.2 lower, otherwise level. No arrow with fewer than 6 nights, because there's nothing before to compare with.
5. **Highlights:** best night (rating and date, links to the night) and Man of the Match count
6. **Stats:** the Season and All-time cards as today
7. **Nights:** the list as today. Tapping a night opens its **breakdown right there** (base, goals, assists, team impact, result, clean sheets, stats score, peer votes and the formula), with an "Open night" link for the votes.

### Worked examples (unit tests)

Ratings, oldest to newest: 6.1, 6.4, 5.9, 7.0, 6.6, **7.2, 7.5, 6.9, 7.8, 7.1**.
- Form = the last 5: (7.2 + 7.5 + 6.9 + 7.8 + 7.1) ÷ 5 = **7.3**. The 5 before: (6.1 + 6.4 + 5.9 + 7.0 + 6.6) ÷ 5 = 6.4. Difference +0.9 → **up**.
- Best night = **7.8**.
- With only 4 nights: form is the average of those 4, and there's no arrow.
- Last 5 average 6.5 and the 5 before 6.6: difference −0.1 → **level**.

---

## 4. The two extras

### Rating settings in the app (admins)
Under **More → Rating settings**, admins get **Edit** for the four main settings:

| Setting | Choices |
|---|---|
| Stats / peer votes | 50/50 to 90/10, in steps of 5% |
| Votes needed to count | 0–5 |
| Nights to join the table | 1–10 |
| Voting window | 6, 12, 24, 48 or 72 hours |

New values apply to nights whose voting closes from then on. Finished nights keep their ratings, as today. The point values (goal, assist, caps…) stay in Supabase's table editor (README section 6). The database already allows this (file 3 grants and the "admins edit rating config" rule), so **no database change**.

### Change history (admins)
**More → Change history:** the group's audit log, newest first, 50 at a time with **Show more**. Each line is a plain sentence with who and when, for example "Ahmed edited a goal · Thu 22 Oct, 21:14" or "Omar extended voting by 12 hours". It covers every action the database records (planning, check-in, games, swaps, goals, payments, voting, members, invite codes). A line the app doesn't know yet still shows its action name. **No database change.** The log is already readable by the group.

---

## 5. Animation ("Lively")

**Library:** `motion` (the new name of Framer Motion), imported from `motion/react`. Use `LazyMotion` with the `m` component and `strict`, and load the features (`domMax`, needed for layout animations) **asynchronously**, so the first screen isn't slowed down. `MotionConfig reducedMotion="user"`: with "reduce motion" on, movement turns off and only fades remain (`Design/README.md` section 8). Check the build size before and after, and report it.

| Where | What moves |
|---|---|
| Every screen | Slides in (a fade plus a short rise, about 200 ms) when you open it |
| Bottom tabs | The green bubble glides to the tab you tap |
| Lists and cards | Slide in one after another when a screen opens. **Not** on the 10-second live refresh. |
| Ratings and stats | Count up from 0 on the profile and the results |
| Live score | The number bounces when it changes |
| Logging a goal (admin) | A **GOAL!** splash for about 1.2 seconds: Archivo Black on honeycomb green (**black text**), with the scorer's name and a short vibration. Others watching the live night see a small "Goal!" message when the score changes. |
| Results | The Man of the Match star spins in with a gold shine |
| Vote screen | The chosen number pops; the progress bar fills smoothly; a "Votes saved" message |
| Switches ("Happy in goal") | The knob springs across |
| Breakdowns | Open and close smoothly |
| Opening screen | The logo drops in and bounces like a ball |
| Loading | **Shimmering placeholders** shaped like the screen, instead of the spinner |

**Pop-ups and messages** (they come with the animation work):
- **`useConfirm()`**: a bottom sheet in the app's own style replaces all 10 `window.confirm` calls. The browser's plain pop-ups look out of place in the installed app, and on iPhone they show the website address as their title. It's a proper dialog: focus moves into it, Escape closes it, and the risky button stays red.
- **`useToast()`**: a short message that slides up above the tab bar for about 2.5 seconds ("Card saved", "Votes saved", "Omar checked in", "Teams saved"), read out by screen readers (`role="status"`).

**Rules:** animate only movement and fading (`transform`, `opacity`) so phones stay smooth. No animation blocks a tap: the button press stays as it is in CSS. Keep the existing button press and the pulsing Live dot.

---

## 6. Data model (Supabase)

One new migration file (file 7, after stage 3's file 6). Files 1–6 are never edited.

```
players          + shirt_number     smallint null, 1-99
                 + strong_foot      text null: right | left | both
                 + position         text null: goal | defence | midfield | attack | anywhere
                 + motto            text null, up to 60 characters
                 + skill_shooting, skill_passing, skill_dribbling,
                   skill_defending, skill_fitness   smallint null, 1-10
                   -- all five set, or all five null
```

- **Permissions:** `grant update (shirt_number, strong_foot, position, motto, skill_*) on public.players to authenticated`, under the existing rule "rename yourself, or anyone if admin" (file 1). The new columns keep the table's read rules. Signed-out visitors see nothing, and nobody can change another player's `group_id` or `user_id`.
- **No new tables, no new functions,** and nothing touches `compute_match_ratings` or the money rules.
- **Tests (PGlite):** you can edit your own card; an admin can edit anyone's; a member can't edit someone else's; the ranges and "all five or none" are enforced; signed-out visitors see nothing; players from before file 7 get empty cards; the locked columns stay locked. For rating settings: an admin can change them, a member can't, and the weights must still add up to 1.
- **Seed data:** give most Demo FC players a card (a mix of Modest, Spot on and Very confident), and leave one empty, so the Home reminder shows.

---

## 7. Screens

| Screen | What changes |
|---|---|
| Welcome (`/welcome`) | **New.** Three steps after joining or creating a group |
| Edit my card (`/players/:id/edit`) | **New.** The card fields with a live preview; also the name and "Happy in goal" |
| Player profile (`/players/:id`) | The portfolio (section 3) |
| Home | "Finish your player card" box; animation |
| More | Rating settings: **Edit** (admins). **Change history** link (admins). |
| Change history (`/settings/history`) | **New.** Admins only |
| Team board | The suggester uses self-ratings for new players (section 2) |
| Every screen | Animation, placeholders, pop-up sheets and messages (section 5) |
| How it works | A "Your player card" section: what the self-rating does and doesn't do, and how Self vs friends works |

---

## 8. Build order

One stage, built and tested in this order:

1. **Motion basics:** install `motion`, the provider, screen transitions, the tab bubble, `useConfirm` (replacing all 10 pop-ups), `useToast`, placeholders, the opening screen
2. **Player card:** file 7 and its tests, types and API, `PlayerCard`, Edit my card, Welcome, the Home box
3. **Portfolio:** Self vs friends, the rating history graph, form, highlights, the inline breakdown
4. **Celebrations:** count-ups, the GOAL! splash, the Man of the Match star, vote pops, lists sliding in, breakdowns opening
5. **Extras:** rating settings in the app, change history
6. **Team suggester:** the self-rating as the starting strength (section 2)
7. **Docs:** README (what's built, file 7 setup, choices, test count), How it works, `supabase/seed.sql`, `Plans/README.md`

Pure TypeScript helpers, with vitest next to them: `selfRating`, `confidence`, `recentForm`, `bestNight`, the graph's points, and the suggester's starting strength. Every worked example in sections 2 and 3 becomes a test. Check every changed screen at 390 px, light and dark, plus once with "reduce motion" on.

---

## 9. Choices made for the owner (flag these)

1. **The card lives on the player** (one per group), like "Happy in goal". Someone in two groups fills in two cards.
2. **Shirt numbers can repeat** in a group.
3. **Skills are all five or none**, so every self-rating is an average of the same five things.
4. **Friends' score** is the average peer vote: season first, then all-time, once there are enough rated nights for the table.
5. **The meter's edges** are −1.0, +1.0 and +2.0, and **the suggester's limits** are 4.5 and 7.5. All four are constants in the app code, not in `rating_config`, because they aren't part of the rating.
6. **"Not now"** on the Home box is remembered on that phone only.
7. **The profile photo stays the Google photo.** Uploading photos would need Supabase Storage and isn't in any plan.
8. **The graph's x-axis is the nights in order**, not the calendar, so a holiday doesn't leave a gap.
9. **Rating settings in the app** cover the four main settings. The point values stay in Supabase.
10. **Change history is shown to admins** in the app (the database already lets group members read it).

---

## 10. Defaults to review with the owner after a few weeks

- Whether the meter labels feel right, or someone's "Very confident" causes trouble.
- Whether 4.5–7.5 is the right range for new players in the team suggester.
- Whether the animation is too much at the pitch (one-handed, in sunlight). The GOAL! splash can be shortened.
