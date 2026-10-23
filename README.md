# Ta7dy-El-La3eeba

A free web app for our weekly football match. Record who played, who scored and who assisted. Everyone who played rates the others, and the app turns it all into a **rating out of 10** for every player, plus a season table and player profiles.

It is a PWA (a website that installs like an app), so friends add it to their home screen straight from the browser. No App Store, no Play Store, no developer accounts.

**What it runs on (all free tiers):** React + TypeScript + Vite + Tailwind for the app, Supabase for the database and Google sign-in, Vercel for hosting.

---

## Contents

1. [What's built so far](#1-whats-built-so-far)
2. [Set it up, one step at a time](#2-set-it-up-one-step-at-a-time)
3. [Test sign-in on real phones first](#3-test-sign-in-on-real-phones-first)
4. [If Google sign-in fails on iPhone](#4-if-google-sign-in-fails-on-iphone)
5. [How friends install the app](#5-how-friends-install-the-app)
6. [How ratings work, and how to tune them](#6-how-ratings-work-and-how-to-tune-them)
7. [Choices I made for you](#7-choices-i-made-for-you-please-check)
8. [Demo data, tests and project layout](#8-demo-data-tests-and-project-layout)
9. [Costs and free-tier limits](#9-costs-and-free-tier-limits)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. What's built so far

This is **Phase 1** from `football-idea.md`:

- Google sign-in, groups, invite codes (`KICK-7Q3F` style, plus a shareable link), admin and member roles
- Create a match: tick who played, pick Team A or B, mark the goalkeepers. Late arrivals can be added later.
- Fast goal logging: tap the scorer, then the assister (or "No assist"). There's an "I scored" shortcut and Undo.
- Goal confirmation: the other player involved confirms. Anyone who played can dispute a goal; disputed goals don't count until an admin fixes them. Undisputed goals confirm themselves when voting closes.
- Voting: 1–10 for every other player (or "Didn't see"), plus a Man of the Match pick. Votes stay secret for 24 hours, then everyone sees who voted what.
- Ratings: stats plus peer votes, with a full breakdown for every player in every match
- A season table (calendar year) with an all-time tab, sortable by rating, goals, assists, G+A, Man of the Match awards, matches played and clean sheets
- Player profiles with season and all-time stats and match history
- A "How ratings work" screen and an install guide
- Light and dark mode; Arabic names display correctly

**Not built yet** (Phase 2 and 3 in the brief): the "Lineup changed" button for mid-match team switches (the database already supports it), rating graphs and recent form, editing rating weights inside the app, reopening voting, an audit-log screen (edits are already recorded), push notifications, badges, fun votes, logging saves, and guest players.

---

## 2. Set it up, one step at a time

You'll create two free accounts (Supabase and Vercel) and set up Google sign-in. It takes about an hour the first time. Do the steps in order.

### Step 1: Install the tools

1. Install **Node.js 22 LTS** (or newer) from <https://nodejs.org>.
2. Open a terminal in this folder and run:

   ```bash
   npm install
   ```

### Step 2: Create the Supabase project (database + sign-in)

1. Go to <https://supabase.com>, sign up (signing in with GitHub is easiest) and click **New project**.
2. Name it `ta7dy`, choose a strong database password (save it somewhere) and pick the **region closest to you**.
3. Wait a minute or two for it to finish setting up.

### Step 3: Create the database tables

1. In your Supabase project, open **SQL Editor** (left menu), then **New query**.
2. Open `supabase/migrations/20261023000100_schema.sql` from this folder, copy all of it, paste it into the editor and click **Run**. You should see "Success".
3. Do the same with `20261023000200_rating.sql`, then `20261023000300_actions.sql`. **Order matters.**
4. (Optional, for trying things out) Run `supabase/seed.sql` too. See [Demo data](#demo-data).

### Step 4: Connect the app to Supabase (environment variables)

1. In Supabase, click **Connect** (top of the project page) or go to **Project Settings → API Keys**. You need:
   - the **Project URL** (looks like `https://abcdefgh.supabase.co`)
   - the **publishable key** (starts with `sb_publishable_`). *Never* use the secret key in the app.
2. In this folder, copy `.env.example` to a new file called `.env.local` and paste both values in:

   ```
   VITE_SUPABASE_URL=https://abcdefgh.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```

   `.env.local` is never uploaded to GitHub. Both values are safe to have in the browser, because the database's security rules (Row Level Security) protect the data.

### Step 5: Run it on your computer

```bash
npm run dev
```

Open <http://localhost:5173>. You should see the sign-in screen. Google sign-in won't work until Step 6.

### Step 6: Set up Google sign-in

**6a. Get the callback address from Supabase.** In Supabase go to **Authentication → Sign In / Providers → Google**. Copy the **Callback URL** shown there (like `https://abcdefgh.supabase.co/auth/v1/callback`). Keep this tab open.

**6b. Create a Google Cloud project.** Go to <https://console.cloud.google.com>, sign in with your Google account, and create a new project called `Ta7dy` (project picker at the top → **New project**).

**6c. Set up the consent screen** (the "Sign in to Ta7dy" page friends will see):

1. Open **Google Auth Platform** (search for it at the top) and click **Get started**.
2. App name: `Ta7dy-El-La3eeba`. User support email: your email.
3. Audience: **External**.
4. Contact email: your email. Agree and click **Create**.
5. You don't need to add anything under **Data Access**. Supabase only asks for the basic details (name, email, profile photo), which need no review from Google.
6. Skip uploading a logo: a logo makes Google require a review that can take days.

**6d. Create the client ID:**

1. Go to **Clients → Create client** and choose **Web application**.
2. Under **Authorized JavaScript origins**, add `http://localhost:5173`. You'll add your Vercel address in Step 7.
3. Under **Authorized redirect URIs**, paste the Supabase **Callback URL** from 6a.
4. Click **Create** and copy the **Client ID** and **Client secret**.

**6e. Publish the app**, so friends aren't limited to a "test users" list: go to **Audience** and click **Publish app** → **Confirm**. With only the basic scopes, Google doesn't need to review it.

**6f. Turn on Google in Supabase:** back on the Supabase Google provider page, switch it **on**, paste the Client ID and Client secret, and click **Save**.

**6g. Tell Supabase where the app lives:** go to **Authentication → URL Configuration**:

- **Site URL:** `http://localhost:5173` for now. You'll change it in Step 7.
- **Redirect URLs:** add `http://localhost:5173`.

Now **Continue with Google** works on your computer. Sign in, create your group, and you're the admin.

### Step 7: Put it online (Vercel)

1. Upload this folder to GitHub. The repo is already linked to `github.com/YoussefEslam29/FOOTBALL-RATING-FRIENDS`, so commit and push.
2. Go to <https://vercel.com>, sign up with GitHub, click **Add New → Project** and import the repo. Vercel detects Vite automatically.
3. Before deploying, open **Environment Variables** and add the same two values from `.env.local` (`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`).
4. Click **Deploy**. You get an address like `https://ta7dy.vercel.app`.
5. Add that address in two places:
   - **Supabase → Authentication → URL Configuration**: set **Site URL** to `https://ta7dy.vercel.app`, and add it under **Redirect URLs** (keep the localhost one for testing).
   - **Google Cloud → Clients → your client → Authorized JavaScript origins**: add `https://ta7dy.vercel.app`.

From now on, every push to GitHub updates the app for everyone automatically.

> Netlify or Cloudflare Pages work too: build command `npm run build`, output folder `dist`, and the same two environment variables. The `public/_redirects` file already handles Netlify.

---

## 3. Test sign-in on real phones first

The brief says to do this before inviting anyone, because Google sign-in inside an **iPhone Home Screen app** is known to be unreliable. On a real iPhone and a real Android phone:

1. Open your Vercel address and install the app (see [section 5](#5-how-friends-install-the-app)).
2. Open it **from the home screen icon** (not the browser) and tap **Continue with Google**.
3. Check that you come back **inside the installed app**, signed in, and that the app stays signed in after closing and reopening it.

If it works on both phones, invite your friends. If the iPhone gets stuck in Safari or comes back signed out, follow section 4.

---

## 4. If Google sign-in fails on iPhone

The app has a backup sign-in: a **6-digit code sent by email** that people type into the app. That works inside the installed iPhone app, because nothing has to redirect back into it. It's **switched off** until you set it up, because Supabase's built-in email sender only emails the project's own team (and only 2 emails an hour), so friends would get an error.

1. **Connect an email sender in Supabase:** **Authentication → Emails → SMTP Settings**, then enable custom SMTP. A free option is your own Gmail account with an *App Password* (Google Account → Security → turn on 2-Step Verification → App passwords). The settings are host `smtp.gmail.com`, port `587`, username your Gmail address, password the app password. Brevo's free plan also works.
2. **Put the code in the email:** **Authentication → Emails → Templates → Magic Link**. Make sure the message includes `{{ .Token }}`, for example: `Your Ta7dy sign-in code is {{ .Token }}`.
3. **Turn on the button:** add `VITE_ENABLE_EMAIL_CODE=true` to `.env.local` and to Vercel's Environment Variables, then redeploy.

Installed iPhone apps then show the email-code option first; everyone else sees it under "Trouble with Google?". A friend who signs in by email with the same address as their Google account gets the same account.

---

## 5. How friends install the app

Send this to the group, together with the invite code from **More → Share invite**:

> **iPhone:** open the link in **Safari** → tap **Share** (square with an arrow) → **Add to Home Screen** → **Add**. Then open Ta7dy from your home screen and sign in there.
>
> **Android:** open the link in **Chrome** → tap the menu **⋮** → **Install app** (or **Add to Home screen**).
>
> Sign in with Google, choose **Join with an invite code** and enter the code.

The app also has this guide built in at `/install`, and shows an "Add to home screen" tip until it's installed.

---

## 6. How ratings work, and how to tune them

Each player gets one rating per match, from 0 to 10, shown with one decimal:

```
rating = 65% × stats score + 35% × average peer vote
```

**Stats score:** start at 5.0, then add +1.0 per goal (max +3.5), +0.7 per assist (max +2.0), +0.25 per goal of difference while you were on the pitch (between −1.5 and +1.5), +0.5 for a win or −0.5 for a loss, and +0.5 for a goalkeeper clean sheet (max +1.0). The total stays between 1.0 and 10.0.

**Peer votes:** the average of the 1–10 scores you received. "Didn't see" doesn't count. With fewer than 2 votes, the rating is the stats score alone ("stats only").

**Season rating** is the average of your match ratings in the calendar year. You join the table after 3 rated matches. Man of the Match is a separate honour and doesn't change ratings.

The calculation lives in **one place**: the database function `compute_match_ratings` in `supabase/migrations/20261023000200_rating.sql`. It runs when voting closes, and again automatically if an admin fixes a goal afterwards. Every match page shows each player's full breakdown.

### Tuning the numbers (no code needed)

After 3–4 real matches, check whether the ratings feel fair. To change them for your group, open Supabase → **Table Editor → `rating_config`** and edit your group's row:

| Column | Default | Meaning |
|---|---|---|
| `w_analytics` / `w_votes` | 0.65 / 0.35 | Stats vs votes. Must add up to 1. Raise `w_votes` if hard workers on losing teams get too little credit. |
| `min_votes` | 2 | Votes needed before votes count |
| `min_matches_for_leaderboard` | 3 | Matches needed to be ranked on the table |
| `voting_hours` | 24 | How long voting stays open |
| `points` | see below | All point values, as JSON |

`points` holds: `base` 5.0, `goal` 1.0, `goal_cap` 3.5, `assist` 0.7, `assist_cap` 2.0, `net_goal` 0.25, `net_goal_min` −1.5, `net_goal_max` 1.5, `win` 0.5, `draw` 0, `loss` −0.5, `clean_sheet` 0.5, `clean_sheet_cap` 1.0, `clean_sheet_min_share` 0.25, `save` 0.15, `save_cap` 1.0, `analytics_min` 1.0, `analytics_max` 10.0.

New values apply to matches whose voting closes from then on. Matches that are already finished keep their ratings. To change the defaults for *new* groups, edit `rating_points_defaults()` and the column defaults in the rating SQL file.

---

## 7. Choices I made for you (please check)

The brief said to pick the simplest option where it wasn't specific, and to flag it. Tell me if you want any of these changed:

1. **Ratings are calculated in the database**, not in the app, so nobody can fake a rating from their phone and nothing extra needs hosting.
2. **Voting closes on its own** the next time anyone opens the app after the 24 hours. No server timer is needed. Until someone opens it, the match just stays in "voting".
3. **Unconfirmed goals still count**; only *disputed* goals don't, until an admin confirms, edits or deletes them.
4. **Players can still log goals while voting is open**, to catch up on ones they forgot. After voting closes, only admins can change goals, and ratings recalculate automatically.
5. **New matches start "in progress" right away.** There are no scheduled/upcoming matches yet.
6. **Voting needs a choice for every player** (a score or "Didn't see") plus a Man of the Match pick before you can save. It's about 30 seconds, and it keeps averages fair.
7. **The table's 3-match rule applies to the Rating sort.** Goals, assists and the other stat sorts include everyone.
8. **The demo group's first joiner becomes its admin.** In general, a group with no admins gives admin to the next person who joins.
9. **The All-time tab is included now**, as section 0 of the brief asked.
10. **Own goals aren't supported yet.** For now, log the goal for the team it counted for and pick "No assist", or ask me to add an "own goal" option.
11. **The lineup is locked once voting closes.** Reopening voting is a Phase 2 admin tool.
12. **Teams are labelled A (green) and B (orange, like training bibs).**

---

## 8. Demo data, tests and project layout

### Demo data

`supabase/seed.sql` creates a group called **Demo FC** with 12 fake players (one with an Arabic name), 4 finished matches (one from last year) and one match with voting still open. Run it in the SQL Editor after the three migration files, then join in the app with the code **`DEMO-KICK`**. As the first person to join, you become its admin.

Ideally use a separate free Supabase project for testing. To remove the demo group later, run this in the SQL Editor:

```sql
delete from public.groups where name = 'Demo FC';
```

### Tests

```bash
npm test
```

This runs 26 tests against the **real database code**, using PGlite (Postgres running inside Node), so it needs no Supabase account or Docker:

- `tests/db/rating.test.ts`: the two worked examples from the brief (Player A 8.3, Player B 5.6), plus a player with no votes, a goalkeeper clean sheet, a player present for only one of two stints, a match with no goals, all the caps and limits, saves, disputed goals, Man of the Match ties, and custom weights
- `tests/db/flow.test.ts`: groups, invite codes, permissions, a full match from creation to results, secret votes, auto-closing, and admin fixes after closing
- `tests/db/seed.test.ts`: the demo data loads correctly

Other commands: `npm run build` (production build), `npm run lint`, `npm run icons` (rebuild the app icons after changing `public/logo.svg`).

### Project layout

```
supabase/migrations/   The database: tables + security (1), ratings (2), app actions (3)
supabase/seed.sql      Demo data
src/lib/api.ts         Every call the app makes to Supabase
src/pages/             One file per screen
src/components/        Shared pieces (buttons, scoreboard, player grid, goal list...)
src/state/             Who is signed in, and which group they're viewing
public/logo.svg        The logo; the icons are generated from it
tests/db/              Tests for the database code
```

---

## 9. Costs and free-tier limits

- **Hosting (Vercel Hobby), database and sign-in (Supabase Free), Google sign-in:** free.
- **Domain name:** optional, about $10 a year. The free `*.vercel.app` address works fine.
- **Apple/Google developer accounts:** not needed.

Things to know:

- **Supabase pauses free projects that go unused for about a week.** A weekly game normally keeps it active. If it does pause (after a holiday, say), open the Supabase dashboard and click **Restore**; no data is lost.
- Free-tier limits change from time to time. Check <https://supabase.com/pricing> and <https://vercel.com/pricing> if something stops working.
- iPhone push notifications (Phase 3) will only work for people who installed the app on their home screen (iOS 16.4 or newer).

---

## 10. Troubleshooting

| Problem | Fix |
|---|---|
| The app says "Almost there" | The two Supabase values are missing. Check `.env.local` (local) or Vercel's Environment Variables, then restart or redeploy. |
| Google says "redirect_uri_mismatch" | The Supabase Callback URL isn't in Google's **Authorized redirect URIs** (Step 6d). |
| After Google sign-in you land on the wrong address, or nothing happens | Check **Supabase → Authentication → URL Configuration**: the Site URL and Redirect URLs must include your exact app address. |
| Friends see "access blocked" or are told the app is in testing | Publish the consent screen (Step 6e). |
| "Email address not authorized" when asking for a code | Custom SMTP isn't set up yet (section 4, part 1). |
| "permission denied" or "function ... does not exist" errors | One of the three SQL files wasn't run, or was run out of order. Run them again in order on a fresh project. |
| A friend can't see the group | They need to join with the invite code (More → Invite code). |
