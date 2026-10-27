# 7GZ-KORA: Accounts, Groups and Chat (stage 3c)

> Your **player card belongs to your account**: you fill it in once, from a few one-by-one questions right after you first sign in, and every group shows it. **Groups become optional:** without one you can find public groups, search players and look at their accounts, Instagram style. Admins give their group a **photo** and make it **public or private**. Every group gets a **text chat**. Nights get a **Google Maps link with a map preview**, and the collector can add an **InstaPay number**. **Home** becomes a group hub, and the app loads faster. Agreed with the owner on 2026-10-26. Don't re-ask the decisions below. Build it **after stage 3b** and **before stage 4** (punishments).

---

## 0. Decisions already made (do not re-ask)

| Topic | Decision |
|---|---|
| Where the player card lives | **On the account**, filled in once. Every group the player is in shows the same card. This replaces choice 1 of `Player-card-and-motion.md` section 9 ("one card per group"). |
| Sign-up | Right after the first sign-in, **one question per screen**, each with Skip: name, shirt number, strong foot, position, the five skills one by one, "happy in goal", motto, then the finished card with **Show my stats**. |
| Groups | **Optional.** A signed-in player without a group can use the app: find and join groups, search players, edit their own card. |
| Joining after sign-up | **No welcome steps per group any more.** The card is already on the account. |
| Public groups | Shown in **Find**. **Anyone signed in joins with one tap**, no code. Private groups still need the invite code. |
| Group photo and visibility | **Admins** set the photo (uploaded from the phone) and the **Public / Private** switch. |
| Seeing each other | **Instagram style:** anyone signed in can search players by name and open their **account page**. Inside a group there's a **Squad** page of everyone's cards. |
| Show my stats | On by default. **Off hides the five skills and the self-rating** (so also Self vs friends) from everyone else. Name, photo, shirt number, position, foot and motto stay visible. Night ratings still show in the group's Table, because they come from real games. |
| Chat | **One text chat per group.** Text only. |
| Navigation | Bottom tabs **Home · Nights · Chat · Table · More**. **Your photo at the top right** opens your account. A dot on Chat means new messages. |
| Home | **Group hub** (section 8). |
| Pitch location | The admin pastes a **Google Maps link**. The night shows a **map preview** and **Open in Google Maps**. |
| InstaPay | The collector types their **phone number** so people can pay them by InstaPay. |
| Money, ratings, permissions | Unchanged. The share is still total ÷ players checked in, rounded up. The InstaPay number only says *where* to pay. It adds no money calculation. Every rule in `CLAUDE.md` still applies. |

---

## 1. The account and the player card

### What's on the account
Everything from the player card (`Player-card-and-motion.md` section 1) moves onto the account, plus three new things:

| Field | Notes |
|---|---|
| Name | The account name, used as your name when you join a group. You can still use a different name inside one group (More → "Your name in this group"). Admins can still rename you **in their group**. |
| Shirt number, strong foot, favourite position, motto, the five skills | As in stage 3b: all optional, skills all five or none |
| Happy to play in goal | Moves to the account |
| **Show my stats** | On by default (section 0) |
| **InstaPay number** | Optional, an Egyptian mobile number (section 7) |

**Only you change your card.** Admins can no longer edit someone else's card, because it's theirs in every group. They can still change a player's name in their own group.

### How groups show it
Each group's player keeps a **copy** of the card, refreshed automatically whenever the account changes. That copy is what the whole app already reads: the card on profiles, Self vs friends, the team suggester and "happy in goal" in the goalkeeper suggestion. So none of those screens change how they work.
- When **Show my stats** is off, the copy has **no skills**. Your group mates' phones never receive them.
- Players without an account (the Demo FC players, guests later) keep the card they already have on the player (the seed data sets it).

### Cards that already exist
When file 8 runs, each account takes the **most complete card** it has in any group (the most filled-in fields; if two are equal, the newer player). Every group then shows that card. "Happy in goal" is on if it was on in any group. Accounts that already have a card are marked as **signed up**, so they don't get the questions. Accounts without one get them the next time they open the app.

### Hidden stats and the team suggester
The team board shows each player's strength, so a hidden self-rating would show up there. When stats are hidden, the suggester treats a player with no rated nights as **6.0**. After their first rated night, their real rating takes over, as for everyone else.

### Worked examples (unit tests)
- Omar has a card in Group A (number 10, left foot, skills 8, 7, 8, 6, 9 → 7 fields) and in Group B (motto only → 1 field). After file 8, his account has the Group A card, both groups show it, and he isn't asked the questions.
- Ziad has no card anywhere. After file 8 his account is empty and he gets the questions when he next opens the app.
- Omar turns **Show my stats** off. His group mates see number 10, left foot, Attack and his motto, plus "Stats hidden" where the skills were. They see no self-rating and no Self vs friends. With no rated nights the suggester uses **6.0**. With a season rating of 7.1 it uses **7.1**.
- Omar changes his shirt number to 7 on his account: Group A and Group B both show 7 straight away.
- An admin of Group A changes Omar's name there to "Abu Omar": Group B still shows "Omar".

---

## 2. Sign-up: one question per screen

Shown once, right after the first sign-in (and before anything else, so the invite code from an invite link waits until it's done). A progress bar at the top, a big question, big answer buttons. Tapping an answer moves on by itself. **Back** goes to the previous question, **Skip** leaves it empty and moves on.

| # | Question | Answer |
|---|---|---|
| 1 | What should we call you? | Text, filled in with the Google name. Arabic is fine. |
| 2 | Your shirt number? | 1–99, or "No number" |
| 3 | Your strong foot? | Right · Left · Both |
| 4 | Where do you like to play? | Goal · Defence · Midfield · Attack · Anywhere |
| 5–9 | How good is your **Shooting**? (then Passing, Dribbling, Defending, Fitness) | 1–10, two rows of five. Under the question: "Be honest: it never changes your night ratings." |
| 10 | Happy to play in goal? | Yes · No |
| 11 | Your motto? | Up to 60 characters, optional |
| 12 | Your card | The finished card slides in, with **Show my stats** (on) and **Done** |

- **Skip on a skill** skips **all five skills** (they're all five or none) and jumps to question 10. On the card screen this reads "Skip the skills".
- **Done** saves everything at once and marks the account as signed up, even if every question was skipped. Leaving the app halfway means the questions start again next time, keeping nothing.
- Afterwards: an invite code from an invite link opens Join with the code filled in. Otherwise you go to Home.
- Later changes: your account page → **Edit my card** (`/me/edit`), one screen with everything above plus the InstaPay number.

---

## 3. Groups are optional

### Home without a group
1. A green welcome band: "Welcome, Youssef" (**black text** on green) and your mini card, with **Finish your card** if it's empty.
2. **Find your squad:** up to 5 public groups (photo, name, members, the next planned night) with **Join**, and **See all** (→ Find).
3. **Got an invite code?** The code box and **Join**.
4. **Start a group:** the group name and **Create**.

Tabs without a group: **Home · Find · More**. The header has the search icon and your photo, as always.

### Joining and creating
- **Join with a code**, **join a public group** and **create a group** all use your account name. You don't have to type it every time. A small "Use a different name in this group" opens the name box.
- After joining: straight to that group's Home, with a "Welcome to Thursday Football" message. No welcome steps.
- Leaving your last group takes you back to Home without a group.

---

## 4. Group photo and Public / Private (admins)

Under **More → Group** (where Rename is today):
- **Group photo:** pick a photo on the phone. The app shrinks it (longest side 1280 px, JPEG) before uploading, so it's quick on mobile data. **Change** and **Remove** are there too. Without a photo the group shows the honeycomb green with the logo.
- **Public group** switch, with the note: "Anyone signed in can find this group and join with one tap. Private: only people with the invite code." Off for new groups and for existing ones.
- The invite code keeps working for public groups too.

**Who sees the photo:** anyone who has its web address. The Find list needs that. Don't use a photo you wouldn't show strangers.

**Someone an admin removed** can't come back to a public group with one tap. They see "Ask the admin for an invite code." Someone who **left** on their own can rejoin with one tap.

### Worked examples (unit tests)
- Thursday Football is public: it's in Find, and Karim joins with one tap.
- The admin switches it to private: it leaves Find, and joining by tap is refused ("This group is private. Ask for an invite code.").
- Karim was removed by an admin: one-tap join is refused. Karim left by himself: one-tap join works and he gets his old player back (his stats too).
- A member (not admin) can't change the photo or the switch. Admins of another group can't upload a photo into this group's folder.

---

## 5. Find, account pages and the Squad

### Find (`/find`, the search icon in the header)
- **Search players:** type 2 or more letters of a name. Up to 20 results: photo, name, shirt number, position. Never an email or phone number.
- **Public groups:** every public group, most members first: photo, name, member count, the next planned night (date and pitch name), and **Join**, or **Open** if you're already in it.

### Account page (`/u/:id`, and `/me` for yourself)
Like an Instagram profile:
1. **Top:** the photo, name, the big shirt number and chips for position, foot and "Happy in goal", with the motto as the bio. **Edit my card** if it's you.
2. **Totals across all their groups:** Nights · Goals · Man of the Match. Only rated nights and goals that count are included.
3. **Skills and self-rating** (the bars from the card), only if **Show my stats** is on, or it's you. Otherwise "Stats hidden".
4. **Groups:** their **public** groups, plus any group you're both in. Each has **Join** / **Open**, and for groups you share, "See their stats in Thursday Football" (their full profile there: rating history, form, nights).

On `/me`, the groups list shows **all** your groups, and the top has **My stats in <current group>** (the profile the old "Me" tab opened).

### Squad (`/squad`, from Table → Squad and from the faces on Home)
Every player in the group as a mini card, two per row: photo, name, shirt number on the green band (**black text**), position chip, and the season rating badge (else all-time, else "NEW"). Sorted by name. Tapping one opens their profile in the group.

The Table screen gets a switch at the top: **Table · Squad**.

---

## 6. Group chat

- **One chat per group**, the **Chat** tab. Text only, **1 to 500 characters**. Spaces at the start and end are trimmed, and a message of only spaces isn't sent.
- **Live:** new messages appear straight away (Supabase Realtime). If the live connection drops, the screen checks every 10 seconds, like the live night.
- **Looks:** your messages on the right as **green bubbles with black text**; others on the left with their photo and name (`<Name>`, `dir="auto"`, so Arabic reads properly). The day ("Today", "Thu 22 Oct") between days, and the time under each group of messages. The newest at the bottom, the box and **Send** above the tab bar. The last 50 messages load first, and **Show older** loads 50 more.
- **Delete:** your own messages, and admins can delete any. A deleted message shows "Message deleted" (its text is gone from the database).
- **New messages dot:** the Chat tab shows a dot when someone else wrote since you last opened the chat. This is remembered on the phone.
- **Home** shows the last 3 messages and **Open chat**.
- **No push notifications** (the app has none yet).
- Only group members can read or write. Removed members can't read the chat any more. Their old messages stay, with their name.

### Worked examples (unit tests)
- "  يلا بينا  " is saved as "يلا بينا".
- "   " and an empty message are refused. 501 characters are refused ("Messages can be up to 500 characters.").
- A member deletes their own message: it shows "Message deleted". A member can't delete someone else's. An admin can.
- Someone outside the group can't read or send.

---

## 7. Pitch map and InstaPay

### Pitch link and map
- **Plan a night** gets a **Google Maps link** box under the pitch name. On the phone: Google Maps → the pitch → Share → Copy link, then paste. The next night is filled in with the same link, like the other details.
- The app finds the pitch's **map position** in the link. Google's short share links (`maps.app.goo.gl/…`) don't contain it, so a small helper on Vercel (`/api/map-link`) follows the short link to the full Google Maps address. It only follows Google addresses and stores nothing. The position is saved with the night, so opening the night later needs no helper.
- The **map preview** shows on the night page, on Home's next-night card and in the planning form (to check it). It's Google's map with a pin, about 160 px tall. Tapping it opens **Google Maps** at the pitch.
- If the app can't find a position in the link, the link is still saved. The night then shows **Open in Google Maps** without the preview.
- Only Google Maps links are accepted ("Paste a Google Maps link").
- The WhatsApp share of a planned night adds "Pitch: <link>".

### Worked examples (unit tests)
| Link | Position |
|---|---|
| `https://www.google.com/maps/place/Club/@30.0444,31.2357,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d30.0450!4d31.2360` | **30.0450, 31.2360** (the pin wins over the view) |
| `https://www.google.com/maps/@30.0444,31.2357,15z` | **30.0444, 31.2357** |
| `https://maps.google.com/?q=30.0444,31.2357` | **30.0444, 31.2357** |
| `https://www.google.com/maps/search/?api=1&query=29.9792,31.1342` | **29.9792, 31.1342** |
| `https://maps.app.goo.gl/AbC123` | ask the helper |
| `https://www.google.com/maps/place/Club+Pitch` | none: link only |
| `https://example.com/@30.0444,31.2357` | refused: not a Google Maps link |
| `https://www.google.com/maps/@95.1,31.2,15z` | none: 95 is not a latitude |

The helper follows at most 5 redirects, refuses any step that isn't a Google address, and gives up after 5 seconds.

### InstaPay number
- On your account (`/me/edit`): **InstaPay number**, an Egyptian mobile number. "+20 10 1234 5678", "010-1234-5678" and "01012345678" are all saved as `01012345678` and shown as **010 1234 5678**.
- **On the Money card and Home's "You owe"**, when the collector has a number: "Pay by InstaPay: **010 1234 5678**" with **Copy**.
- **The collector** without a number sees "Add your InstaPay number so people can pay you" (→ Edit my card).
- **Who sees it:** members of your groups (it's on your group copy). Never in Find, never on your account page.

| Typed | Result |
|---|---|
| `01012345678` | saved, shown 010 1234 5678 |
| `+20 10 1234 5678` | 01012345678 |
| `0020 1012345678` | 01012345678 |
| `0101234567` (10 digits) | refused |
| `01312345678` | refused (013 isn't an Egyptian mobile prefix: 010, 011, 012, 015) |
| (empty) | no number |

---

## 8. Home: the group hub

From top to bottom (each part only when it has something to show):

1. **Group banner:** the group photo (or honeycomb green with the logo), then the name (Archivo Black), a Public / Private chip, and a row of member faces ("+9") → Squad.
2. **Live night** (as today), or the **next night:** the day and time, a countdown, the pitch name, the map preview, "11 in · 7 spots left", and the I'm in / Out buttons (the existing RSVP card).
3. **You owe** (as today) plus the InstaPay line.
4. **Voting now** (as today).
5. **Finish your card** (as today, now about the account).
6. **You this season:** your rating badge, nights, goals and Man of the Match, counting up. Before your first rated night: "Play your first night to see your stats".
7. **Last night** (as today).
8. **Top 3 podium:** second, first, third side by side, with photos, names and rating badges, and first in the middle and raised. "Full table" below. Before anyone qualifies: the current message.
9. **Chat:** the last 3 messages and **Open chat**. With no messages: "Say hi to the group".
10. The **How it works** link.

### Countdown (worked examples, unit tests)
Next night Thu 29 Oct, 20:00:
- Tue 27 Oct, 15:30 → **in 2 days 4 h**
- Thu 29 Oct, 08:00 → **in 12 h 0 min**
- Thu 29 Oct, 19:15 → **in 45 min**
- Thu 29 Oct, 20:05 and not started yet → **starting now**

### Podium order (unit test)
Top 3 ratings 7.9 (Omar), 7.4 (Ziad), 7.1 (Karim) → shown **Ziad · Omar · Karim**, with Omar raised. With only 2 players: Ziad · Omar. With 1: Omar alone.

---

## 9. Faster loading

Today the app is one 680 kB JavaScript file (198 kB zipped), downloaded before the first screen. Each screen will load **when it's first opened** (`React.lazy`), with the shimmering placeholder while it arrives. The sign-in screen, Home and the tab bar stay in the first download. The goal is a first download **under 350 kB** (about half). Report the sizes before and after. Once installed, the app keeps every screen for offline use, as today.

---

## 10. Data model (Supabase)

**One new migration file: file 8** `20261026000100_accounts_groups_chat.sql`. Files 1–7 are never edited. It can run at any time, even during a night.

```
profiles      + shirt_number, strong_foot, favourite_position, motto,
                skill_shooting … skill_fitness, happy_in_goal      (same rules as file 7)
              + show_stats       boolean, default true
              + instapay_phone   text null, ^01[0125][0-9]{8}$
              + onboarded_at     timestamptz null (signed up)
              The new columns are NOT readable directly. They're read
              through my_account() and get_account().

players       + show_stats, instapay_phone   (the group copy, section 1)
              Players can no longer change the card columns directly. The copy is
              written only by the database, when the account changes or the player
              joins a group.

groups        + image_path   text null, '<group id>/<file name>'
              + is_public    boolean, default false
              Admins change both directly (like the name).

matches       + pitch_url    text null, https, up to 500 characters
              + pitch_lat, pitch_lng   both or neither, in range

group_messages (new)
              id, group_id, player_id, user_id, body (1-500, null once deleted),
              created_at, deleted_at
              Members read their group's messages. Writes go through functions only.
              Added to Supabase Realtime.

storage       bucket "group-images": public to read, 1 MB limit, JPEG/PNG/WebP.
              Only admins of the group can add, replace or delete files in
              the group's folder.
```

**Functions** (all check who's calling):

| Function | Does |
|---|---|
| `my_account()` | Your whole account, the private columns included |
| `save_my_account(account)` | Checks and saves your card, name, Show my stats and InstaPay number; the group copies follow |
| `finish_sign_up(account)` | The same, and marks you as signed up |
| `get_account(user_id)` | Someone's account page: card (skills only if shown), totals across groups, their public groups and the groups you share. Never email or phone. |
| `search_accounts(query)` | Up to 20 accounts whose name contains the text (2+ characters) |
| `list_public_groups()` | Public groups: name, photo, members, next planned night, whether you're in |
| `join_public_group(group_id, name)` | One-tap join (section 4 rules), with a "member_joined" line in the change history |
| `send_message(group_id, body)` / `delete_message(id)` | Section 6 rules. Deleting writes a "message_deleted" line in the change history when an admin deletes someone else's. |
| `write_night_details` | Replaced (`create or replace`) to also save the pitch link and position |

**Untouched:** `compute_match_ratings`, the money functions (`night_payer_rows`, `night_money`, `money_owed`, `mark_paid`), voting, games.

**Tests (PGlite)** cover:
- every worked example in sections 1, 4, 6 and 7
- the card move from old data
- the copy following the account, and new players getting the account's card
- the locked card columns on players
- group mates unable to read the private account columns
- hidden skills never reaching the copy
- the public-group rules
- chat permissions and limits
- the pitch fields through `plan_night` / `update_night`
- the storage folder rules (with a small stand-in for Supabase's storage tables)
- signed-out visitors seeing nothing

---

## 11. Screens

| Screen | What changes |
|---|---|
| Sign-up questions | **New** (section 2) |
| Home | Group hub (section 8). Without a group: section 3. |
| Header | The search icon and your photo at the top right |
| Bottom tabs | Home · Nights · Chat · Table · More (Home · Find · More without a group) |
| Chat (`/chat`) | **New** (section 6) |
| Find (`/find`) | **New** (section 5) |
| Account page (`/u/:id`, `/me`) | **New** (section 5) |
| Edit my card (`/me/edit`) | Moves from `/players/:id/edit`, now edits the account: card, name, Show my stats, InstaPay number |
| Change name (`/players/:id/edit`) | Now just the name in this group: yourself, or anyone if admin |
| Squad (`/squad`) | **New** (section 5). Table gets the Table · Squad switch. |
| Player profile (`/players/:id`) | "Stats hidden" when the player hides them; **Edit my card** goes to `/me/edit` |
| Plan a night | The Google Maps link and its preview |
| Night page | The map preview, or "Open in Google Maps" |
| Money card, You owe | The InstaPay line and Copy; the collector's reminder |
| More | Group photo, Public switch, "Your name in this group"; a Find link |
| Join or create | Uses the account name; goes straight to the group's Home |
| Welcome (`/welcome`) | **Removed** (its job moves to the sign-up questions) |
| How it works | New parts: your account and Show my stats, public groups, chat, the pitch map, InstaPay |
| `/privacy.html` | Adds the chat messages, the InstaPay number, group photos, and that any signed-in user can find your name, photo and card |

Every changed screen is checked at 390 px, light and dark, with Arabic names, and once with "reduce motion" on.

---

## 12. Build order

One stage, built and tested in this order. One commit at the end, or one per part if the owner wants.

1. **Faster loading** (section 9), first, so the size can be compared at the end
2. **Accounts:** file 8's account part and its tests, `my_account` in the app, the sign-up questions, Edit my card on the account, the "Stats hidden" card, the suggester rule
3. **Groups optional:** routes and tabs without a group, Home without a group, joining with the account name, Welcome removed
4. **Groups:** photo (storage) and the Public switch, Find, account pages, Squad
5. **Chat:** the table, functions, Realtime, the Chat tab and its dot
6. **Pitch and InstaPay:** the pitch fields, `/api/map-link` (plus the same helper inside `npm run dev`), the map preview, the InstaPay number on the Money card
7. **Home:** the group hub
8. **Docs:** README (what's built, file 8 setup, the test count), How it works, the privacy page, `supabase/seed.sql` (Demo FC stays private; a few demo chat messages; a pitch link on the planned night), `Plans/README.md`, `CLAUDE.md` if a rule changed

Pure TypeScript helpers with vitest next to them:
- `coordsFromMapUrl`, `isGoogleMapsUrl`
- `normalizePhone`, `formatPhone`
- `countdown`, `podiumOrder`
- the sign-up step logic (Skip on a skill)
- the photo size maths
- the unread-dot rule
- the account's "most complete card" choice (mirrors the SQL)

The `/api/map-link` helper gets tests with a fake `fetch`: the redirect chain, the Google-only rule, the 5-hop limit and the time limit.

---

## 13. Choices made for the owner (flag these)

1. **Admins can't edit other people's cards any more**, only their name in the admin's group.
2. **Hidden stats are hidden for real**, so the team suggester uses 6.0 for a hidden-stats newcomer.
3. **Removed members need an invite code** to come back to a public group.
4. **The InstaPay number is visible to members of your groups**, never in Find or on your account page.
5. **Account totals add up all groups** (nights, goals, Man of the Match), as numbers only.
6. **The group photo is public to anyone with its address.**
7. **The map helper lives on Vercel** (`/api/map-link`): it only reads Google's short links and stores nothing. All data stays on Supabase.
8. **No push notifications** for chat. The tab dot shows new messages.
9. **Leaving the sign-up questions halfway keeps nothing.** They start again next time.
10. **"Happy in goal" is on** after the move if it was on in any group.
11. **The map preview is Google's embed** (no API key needed). If Google ever stops it, the night falls back to the "Open in Google Maps" button.

---

## 14. Defaults to review with the owner after a few weeks

- Whether people want **push notifications** for chat (that needs a bigger setup).
- Whether **one-tap join** brings unwanted people into public groups. "Ask to join" is the alternative.
- Whether the chat needs more: photos, replies or reactions. **Text only for now.**
- Whether a **home pitch** saved on the group would beat copying the link from the last night.
