# 7GZ-KORA: Punishments and Loyalty Points

> An add-on to `Football-scenario.md` (match nights). It depends on that file's RSVP, check-in times, admin flags and per-night ratings, so it's built after stages 1 and 2 there. The decisions below were agreed with the owner on 2026-10-24. Don't re-ask them. Every number is a **suggested default** in one config, for the owner to tune.

---

## 0. Decisions already made (do not re-ask)

| Topic | Decision |
|---|---|
| What a punishment costs | **Loyalty points** (minus points) **and a rating deduction** on that night's rating |
| Who decides | **Automatic** for lateness and absences (from check-in times and RSVPs). **Admins flag** injuring someone and wasting time. |
| Regulars who miss a night | Punished **only if they didn't say "Out"**. Saying "Out" in advance is always fine. |
| What loyalty points give | A **Loyalty table** (next to the ratings table) and **badges** |
| Money fines | **No.** Rent stays an equal split. |

---

## 1. One points system

Every player has **loyalty points**. Good habits add points and punishments take them away, so a single number shows how reliable someone is. Points can go negative.

Every change is a line in the player's **points history** ("−3 · Late (25 min) · Thu 22 Oct"), so nobody wonders where a number came from. As with everything else in the app, the whole group can see it.

Points reset with the season on 1 January. The Loyalty table has **Season** and **All-time** tabs, like the ratings table.

---

## 2. Punishments

| # | What happened | How it's detected | Points | Rating deduction |
|---|---|---|---|---|
| 1 | **Late:** checked in more than 10 and up to 30 minutes after the night's start time | Automatic (check-in time) | −3 | −0.3 |
| 1 | **Very late:** more than 30 minutes after the start | Automatic | −5 | −0.5 |
| 2 | **Silent absence:** a *regular* who didn't come and didn't say "Out" | Automatic (RSVP + attendance) | −3 | none |
| 3 | **Injured someone (minor):** a reckless challenge that hurt someone | Admin flag | −5 | −0.5 |
| 3 | **Injured someone (serious):** someone had to stop playing | Admin flag | −10 | −1.0 |
| 4 | **Wasted time:** arguing, holding the ball, slow to restart, leaving the pitch without reason | Admin flag (each flag) | −3 | −0.3 |
| 5 | **No-show:** said "I'm in" and never checked in | Automatic | −5 | none |
| 5 | **Late cancel:** changed "I'm in" to "Out" less than 3 hours before the start | Automatic | −2 | none |

Rules:
- **A regular** is someone who came to at least **3 of the group's last 4 nights**.
- **"Running late" is honest, and honesty is free.** Before the start time, a player who said "I'm in" can tap **"I'm in, but I'll be late"**. Arriving late then costs nothing, but they don't get the on-time bonus.
- **Rating deductions** only apply to a night the player actually played. Absences (silent absence, no-show, late cancel) cost points only, because there's no rating to take from.
- A night's rating deductions add up but are **capped at −1.5**, and the rating never goes below 0. They show as their own line in the rating breakdown, such as "Discipline −0.3 (late)", so it's clear the rating dropped for behaviour, not for how the player played.
- **Accidents aren't punished.** Admins flag an injury only for a reckless challenge, not for a normal collision.
- Admin flags can be added during the night (from the control room) or until voting closes, with an optional note. Each is recorded in the audit log.

### Excusing
An admin can **excuse** any punishment, for example a traffic accident or a family emergency, with a short reason. The line stays in the history marked "Excused", and its points and rating deduction are removed. **An admin can't excuse their own punishment**; another admin has to. If the night's voting has already closed, ratings recalculate automatically.

---

## 3. Earning points

| What | Points |
|---|---|
| Played (checked in) | +3 |
| On time (checked in no later than 10 minutes after the start) | +1 |
| Kept your word (said "I'm in" and came) | +1 |
| Paid your rent share back within 24 hours (ticked by the collector) | +1 |
| Streak: every 4 nights in a row attended | +5 |

A perfect night is worth +6 (+3 played, +1 on time, +1 kept word, +1 paid on time).

---

## 4. Badges (per season)

| Badge | How to earn it |
|---|---|
| **Never Late** | At least 5 nights, never late |
| **Man of His Word** | At least 5 "I'm in"s, no no-shows or late cancels |
| **Fair Play** | At least 5 nights, no admin flags |
| **Iron Man** | Most nights attended (already in `football-idea.md`) |
| **Most Loyal** | Most loyalty points this season |

**Optional "Wall of Shame" badges**, for fun, **off by default** (a group setting): **Always Late** (most late arrivals) and **Ghost** (most no-shows).

---

## 5. Worked examples (use these as unit tests)

The night starts at 20:00; all values are the defaults above.

**A. Lateness.** Ahmed checks in at 20:25: Late, **−3 points**, and his night rating of 6.8 becomes **6.5**. Omar checks in at 20:45: Very late, **−5**, −0.5. Karim tapped "I'm in, but I'll be late" at 19:30 and arrives at 20:40: **no punishment**, and no on-time bonus.

**B. Absences.** Mahmoud said "I'm in" and never came: No-show, **−5**. Ziad changed to "Out" at 14:00: **nothing**. Tarek changed to "Out" at 19:15 (45 minutes before): Late cancel, **−2**. Ali came to 4 of the last 4 nights, never replied and didn't come: Silent absence, **−3**. Seif came to 1 of the last 4, never replied and didn't come: **nothing** (not a regular).

**C. Admin flags and the cap.** Hassan is flagged twice for wasting time and once for a serious injury: points −3 −3 −10 = **−16**. Rating deductions 0.3 + 0.3 + 1.0 = 1.6, **capped at −1.5**.

**D. Earning.** Mostafa said "I'm in", arrived on time, played and paid back the next morning: **+6**. It's his 4th night in a row: **+5** more.

**E. Excusing.** An admin excuses Ahmed's lateness (traffic accident). His history shows "Late, excused", **+3 points come back**, and his night rating returns to **6.8**.

Also test: an admin trying to excuse their own punishment is refused; a regular who said "Out" gets nothing; points recalculate if an admin fixes someone's check-in time.

---

## 6. Data model (Supabase)

```
loyalty_events   NEW  id, group_id, match_id (nullable), player_id,
                 kind (late | very_late | silent_absence | no_show | late_cancel |
                       injury_minor | injury_serious | time_wasting |
                       played | on_time | kept_word | paid_on_time | streak),
                 points, rating_deduction (default 0),
                 source (auto | admin), note, created_by, created_at,
                 excused (bool), excused_by, excused_reason

rsvps            + running_late (bool), status_changed_at   -- for "late cancel" timing

rating_config    + loyalty (jsonb): the points and deductions in sections 2-3, late_grace_minutes 10,
                   very_late_minutes 30, regular_nights 3, regular_window 4, cancel_notice_hours 3,
                   discipline_rating_cap 1.5, shame_badges false
```

- **Automatic events** are generated when the admin taps **End night**. They're recalculated if check-in times or RSVPs for that night are corrected, and excusals are kept. Admin flags are inserted straight away.
- **Points** = the sum of a player's events that aren't excused (per season, or all-time).
- **Rating:** `compute_match_ratings` subtracts that night's non-excused `rating_deduction`s (capped), and adds a `discipline` line to the breakdown.
- **Permissions:** admins add flags and excuse others' punishments; automatic events are only written by database functions; everyone in the group can read everything.

---

## 7. Screens

| Screen | What's added |
|---|---|
| Night control room (admin) | A **Flag** button on each player: Wasted time / Injured someone (minor or serious), with an optional note |
| Night page (after End night) | A **Discipline** section: late arrivals, absences and flags, with Excuse for admins |
| RSVP | "I'm in", **"I'm in, but I'll be late"**, "Out" |
| Table tab | Tabs **Ratings · Loyalty**. The Loyalty table shows points, nights, on-time % and punishments, for the season or all-time. |
| Player profile | Loyalty points, badges, and the full points history |
| Rating breakdown | A "Discipline" line when there's a deduction |
| Settings (admin) | The point values, thresholds and the Wall of Shame switch |
| How it works | The rules from sections 2–4, in plain words |

---

## 8. Build order

Build after `Football-scenario.md` stages 1 (nights, RSVP, check-in) and 2 (games and per-night ratings). It can go before or after the team suggester.

1. Automatic punishments and points (late, absences, earning), the points history and the Loyalty table.
2. Admin flags, excusing, and the rating deduction.
3. Badges (and the optional Wall of Shame).

---

## 9. Defaults to review with the owner after a few nights

- Whether the point values feel fair: is −3 for 10 minutes late too harsh, and is −10 for a serious injury enough?
- The rating deduction is what you chose. It means a player's rating partly reflects behaviour, not just play. It's capped at −1.5 a night and shown as its own line. Check after a few weeks whether it distorts the ratings table.
- The 10-minute grace period, the 3-hour cancellation notice and "regular = 3 of the last 4 nights".
- Whether to turn on the Wall of Shame badges.
