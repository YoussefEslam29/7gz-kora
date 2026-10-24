# 7GZ-KORA

A free app for our football nights. An admin plans each night, friends tap "I'm in" or "Out", and at the pitch everyone is checked in. The app records who scored and assisted, splits the pitch cost, and after the night everyone who played rates the others. It all turns into a **rating out of 10** for every player, plus a season table and player profiles.

It is a PWA (a website that installs like an app). In a browser the website shows only an **Install screen**; the app opens once it's on the home screen. No App Store, no Play Store, no developer accounts.

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

**Phase 1** (`Plans/football-idea.md`) and **stage 1 of the 7GZ-KORA upgrade** (`Plans/README.md`):

- The 7GZ-KORA look (`Design/README.md`), light and dark mode; Arabic names display correctly
- **Install first:** in a browser the website shows only the Install screen: the logo, the name, the steps for that phone, and the invite code when opened from an invite link. Sign-in happens inside the installed app. Search engines are kept out, and link previews show only the name and logo.
- Google sign-in (plus an optional email-code sign-in), groups, invite codes, admins and members
- **Nights:** an admin plans a night (date, time, pitch, length, cost, players per side, collector, player limit), pre-filled from the last one. Friends tap **I'm in** or **Out**. When the night is full, "I'm in" joins a waiting list, and the first person waiting moves up automatically when someone drops out. A planned night can be shared to WhatsApp.
- **At the pitch:** the admin starts the night and checks people in (anyone in the group; the arrival time is saved; tap again when someone leaves early), picks Team A and Team B from the people checked in, and goals are logged as before.
- **End night** opens voting. **Cancel night** (rain, not enough players, pitch problem, other) means nothing counts; a cancellation can be shared to WhatsApp.
- **Money card:** the cost is split equally among everyone checked in, rounded up to a whole pound ("You owe 47 EGP to Ahmed"). The collector or an admin ticks people off.
- Voting (1–10, "Didn't see", Man of the Match), ratings with a full breakdown, the season table and player profiles, as in Phase 1.

**Coming next** (`Plans/README.md`): games (many short games per night, a timer, Team C, swaps, penalties, admin-only goal recording, one rating per night across all games), the team suggester, punishments and loyalty points, Team of the Night and best duos.

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
2. Name it `7gz-kora`, choose a strong database password (save it somewhere) and pick the **region closest to you**.
3. Wait a minute or two for it to finish setting up.

### Step 3: Create the database tables

1. In your Supabase project, open **SQL Editor** (left menu), then **New query**.
2. Open `supabase/migrations/20261023000100_schema.sql` from this folder, copy all of it, paste it into the editor and click **Run**. You should see "Success".
3. Do the same with `20261023000200_rating.sql`, then `20261023000300_actions.sql`, then `20261024000100_nights.sql`. **Order matters.**
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

Open <http://localhost:5173>. In a normal browser you'll see the **Install screen**, because that's all the website shows (section 5). To use the app in your computer's browser while developing, add this line to `.env.local` and restart `npm run dev`:

    VITE_ALLOW_BROWSER=true

**Never add it to Vercel.** It would show the app to anyone with the link, so the build stops with an error if it's set there.

You should then see the sign-in screen. Google sign-in won't work until Step 6.

### Step 6: Set up Google sign-in

**6a. Get the callback address from Supabase.** In Supabase go to **Authentication → Sign In / Providers → Google**. Copy the **Callback URL** shown there (like `https://abcdefgh.supabase.co/auth/v1/callback`). Keep this tab open.

**6b. Create a Google Cloud project.** Go to <https://console.cloud.google.com>, sign in with your Google account, and create a new project called `7GZ-KORA` (project picker at the top → **New project**).

**6c. Set up the consent screen** (the "Sign in to 7GZ-KORA" page friends will see):

1. Open **Google Auth Platform** (search for it at the top) and click **Get started**.
2. App name: `7GZ-KORA`. User support email: your email.
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
4. Click **Deploy**. You get an address like `https://7gz-kora.vercel.app`.
5. Add that address in two places:
   - **Supabase → Authentication → URL Configuration**: set **Site URL** to `https://7gz-kora.vercel.app`, and add it under **Redirect URLs** (keep the localhost one for testing).
   - **Google Cloud → Clients → your client → Authorized JavaScript origins**: add `https://7gz-kora.vercel.app`.

From now on, every push to GitHub updates the app for everyone automatically. Link previews (WhatsApp etc.) use your Vercel production address for the logo automatically.

> Netlify or Cloudflare Pages work too: build command `npm run build`, output folder `dist`, and the same two environment variables. The `public/_redirects` file already handles Netlify.

---

## 3. Test sign-in on real phones first

The brief says to do this before inviting anyone, because Google sign-in inside an **iPhone Home Screen app** is known to be unreliable. On a real iPhone and a real Android phone:

1. Open your Vercel address and install the app (see [section 5](#5-how-friends-install-the-app)).
2. Open it **from the home screen icon** (not the browser) and tap **Continue with Google**. Remember: the website in the browser only shows the Install screen. Signing in always happens in the installed app.
3. Check that you come back **inside the installed app**, signed in, and that the app stays signed in after closing and reopening it.

If it works on both phones, invite your friends. If the iPhone gets stuck in Safari or comes back signed out, follow section 4.

---

## 4. If Google sign-in fails on iPhone

The app has a backup sign-in: a **6-digit code sent by email** that people type into the app. That works inside the installed iPhone app, because nothing has to redirect back into it. It's **switched off** until you set it up, because Supabase's built-in email sender only emails the project's own team (and only 2 emails an hour), so friends would get an error.

1. **Connect an email sender in Supabase:** **Authentication → Emails → SMTP Settings**, then enable custom SMTP. A free option is your own Gmail account with an *App Password* (Google Account → Security → turn on 2-Step Verification → App passwords). The settings are host `smtp.gmail.com`, port `587`, username your Gmail address, password the app password. Brevo's free plan also works.
2. **Put the code in the email:** **Authentication → Emails → Templates → Magic Link**. Make sure the message includes `{{ .Token }}`, for example: `Your 7GZ-KORA sign-in code is {{ .Token }}`.
3. **Turn on the button:** add `VITE_ENABLE_EMAIL_CODE=true` to `.env.local` and to Vercel's Environment Variables, then redeploy.

Installed iPhone apps then show the email-code option first; everyone else sees it under "Trouble with Google?". A friend who signs in by email with the same address as their Google account gets the same account.

---

## 5. How friends install the app

Send the group your invite link from **More → Share invite**. Opening it in a browser shows the **Install screen** with the steps for their phone and the invite code:

> **iPhone:** open the link in **Safari** (inside WhatsApp or Instagram, first choose **Open in Safari**) → tap **Share** → **Add to Home Screen** → **Add**. Then open 7GZ-KORA from the home screen and sign in there.
>
> **Android:** open the link in **Chrome** → tap **Install app** (or the menu **⋮** → **Install app**).
>
> Sign in with Google, choose **Join with an invite code** and type the code from the Install screen.

On iPhone the code can't be carried into the installed app automatically, so people type it once. On Android it's usually filled in already.

---

## 6. How ratings work, and how to tune them

Each player gets one rating per night, from 0 to 10, shown with one decimal:

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

Stage 2 changes how team impact and result are counted across the many games of a night (see `Plans/Football-scenario.md` section 3).

---

## 7. Choices I made for you (please check)

The brief said to pick the simplest option where it wasn't specific, and to flag it. Tell me if you want any of these changed:

1. **Ratings are calculated in the database**, not in the app, so nobody can fake a rating from their phone and nothing extra needs hosting.
2. **Voting closes on its own** the next time anyone opens the app after the 24 hours. No server timer is needed. Until someone opens it, the match just stays in "voting".
3. **Unconfirmed goals still count**; only *disputed* goals don't, until an admin confirms, edits or deletes them.
4. **Players can still log goals while voting is open**, to catch up on ones they forgot. After voting closes, only admins can change goals, and ratings recalculate automatically.
5. **Voting needs a choice for every player** (a score or "Didn't see") plus a Man of the Match pick before you can save. It's about 30 seconds, and it keeps averages fair.
6. **The table's 3-night rule applies to the Rating sort.** Goals, assists and the other stat sorts include everyone.
7. **The demo group's first joiner becomes its admin.** In general, a group with no admins gives admin to the next person who joins.
8. **The All-time tab is included now**, as section 0 of the brief asked.
9. **Own goals aren't supported yet.** For now, log the goal for the team it counted for and pick "No assist", or ask me to add an "own goal" option.
10. **The lineup is locked once voting closes.** Reopening voting is a later admin tool.
11. **Teams wear bib colours:** A white, B orange, C blue (Team C arrives with games in stage 2).
12. **Paid ticks are kept in their own small table** (`night_payments`), because on a night cancelled before anyone arrived, the people who pay never got checked in.
13. **The share is worked out in the database** (`night_payer_rows`), like ratings, so every phone shows the same number.
14. **Replies close when the night starts.** Check-in stays open while voting is open, to add someone who was forgotten; the shares then recalculate and ticks stay.
15. **Nobody ticks off their own payment**, admins included. The collector counts as paid automatically.
16. **The player limit** starts at 3 × players per side (18 for 6 a side) and follows the side size unless you change it. "No player limit" switches the waiting list off.
17. **A cancelled night can't be un-cancelled**: plan a new one. The reason "Other" needs a short note.
18. **Link-preview bots** (WhatsApp, Facebook, Telegram, X) may read the site so shared links show the name and logo; search engines are kept out.
19. **"No reply"** counts group members with an account (the people who can answer).

---

## 8. Demo data, tests and project layout

### Demo data

`supabase/seed.sql` creates a group called **Demo FC** with 12 fake players (one with an Arabic name), 4 finished nights (one from last year), a night cancelled for rain, yesterday's night with voting open and 3 people paid back, and a planned night in 3 days with a 10-player limit (10 in, 1 waiting, 1 out), so you can see the waiting list. Ahmed collects the money. Run it in the SQL Editor after the **four** migration files, then join in the app with the code **`DEMO-KICK`**. As the first person to join, you become its admin.

Ideally use a separate free Supabase project for testing. To remove the demo group later, run this in the SQL Editor:

```sql
delete from public.groups where name = 'Demo FC';
```

### Tests

```bash
npm test
```

This runs 69 tests. Most run against the **real database code**, using PGlite (Postgres running inside Node), so they need no Supabase account or Docker:

- `tests/db/rating.test.ts`: the two worked examples from the brief (Player A 8.3, Player B 5.6), plus a player with no votes, a goalkeeper clean sheet, a player present for only one of two stints, a match with no goals, all the caps and limits, saves, disputed goals, Man of the Match ties, and custom weights
- `tests/db/nights.test.ts`: planning a night, "I'm in" / "Out" and the waiting list, check-in, ending and cancelling a night, and the money split, including the worked example 600 EGP ÷ 13 players → 47 EGP each
- `tests/db/flow.test.ts`: groups, invite codes, permissions, a full night from planning to results, secret votes, auto-closing, and admin fixes after closing
- `tests/db/seed.test.ts`: the demo data loads correctly
- `src/lib/*.test.ts`: the Install-screen decision and device detection, the Plan-a-night defaults, money totals, the WhatsApp texts and formatting

Other commands: `npm run build` (production build), `npm run lint`, `npm run icons` (rebuild the app icons after changing `public/app-icon.svg`).

### Project layout

```
supabase/migrations/   The database: tables + security (1), ratings (2), app actions (3), nights (4)
supabase/seed.sql      Demo data
src/lib/               Every call the app makes to Supabase (api.ts), plus small tested helpers
src/pages/             One file per screen
src/components/        Shared pieces (buttons, scoreboard, money card, check-in list...)
src/state/             Who is signed in, and which group they're viewing
public/                Icons (from app-icon.svg), logo.svg (the white mark), robots.txt
tests/db/              Tests for the database code
Design/                The look: tokens, logo files, screens.html
Plans/                 Everything agreed, and the stage plans in Plans/implementation/
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
| "permission denied" or "function ... does not exist" errors | One of the four SQL files wasn't run, or was run out of order. Run them again in order on a fresh project. |
| A friend can't see the group | They need to join with the invite code (More → Invite code). |
| The website only shows the Install screen | That's on purpose: sign in from the installed app. For development on a computer, add `VITE_ALLOW_BROWSER=true` to `.env.local`. |
| The Vercel build fails with "VITE_ALLOW_BROWSER must never be set on Vercel" | Remove that variable from the project's Environment Variables and redeploy. |
| "Replies are closed" | The night has started or was cancelled. Replies are only for planned nights. |
