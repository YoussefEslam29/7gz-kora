# 7GZ-KORA: Install First, Then Sign In

> The app shows **nothing about itself on the public website**. People must install it and sign in before they see anything. Decisions agreed with the owner on 2026-10-24. Don't re-ask them. Build it in stage 1 (see `Plans/README.md`).

---

## 0. Decisions already made (do not re-ask)

| Topic | Decision |
|---|---|
| Opening the website in a browser | **Install screen only:** the logo, the name and how to install. No sign-in, no description, no features, no group data. |
| Where people sign in | **Only inside the installed app** |
| What the public can see | **Name and logo only.** No description anywhere, link previews (WhatsApp, etc.) show just the name and logo, and the site is hidden from search engines. |
| Privacy page (2026-10-25) | **One exception: `/privacy.html`**, a short privacy note. Google requires a privacy policy link before the sign-in can be published for everyone. It is hidden from search engines too. |
| How people "download" the app | **Install from the browser** (Add to Home Screen). No app stores, no APK. |

---

## 1. What people see

| Where | What's shown |
|---|---|
| **The website in a browser** (any address, including invite links) | The **Install screen**: logo, "7GZ-KORA", and the install steps for their device (section 2). Nothing else. |
| **Installed app, signed out** | The **Sign-in screen**: logo, "7GZ-KORA" and **Continue with Google** (plus the email-code option when it's turned on). No tagline, no feature text. |
| **Installed app, signed in** | The full app |

"Installed" means the app was opened from its home-screen or desktop icon: `display-mode: standalone`, or `navigator.standalone` on iPhone.

---

## 2. The Install screen, by device

It shows only the steps for the device being used.

| Device and browser | What it shows |
|---|---|
| iPhone or iPad, Safari | Tap **Share** → **Add to Home Screen** → **Add**, then open 7GZ-KORA from the home screen |
| iPhone inside another app (WhatsApp, Instagram, …) | "Open this page in **Safari** to install", plus a **Copy link** button |
| Android, Chrome | A big **Install app** button (the browser's own install prompt), plus the manual steps (menu **⋮** → **Install app**) as a fallback |
| Android, another browser | "Open this page in **Chrome** to install", plus **Copy link** |
| Computer, Chrome or Edge | An **Install app** button (or the install icon in the address bar) |
| Mac, Safari | **File** → **Add to Dock** |
| Any other browser (e.g. Firefox) | "Open this page in **Chrome** or **Edge** to install" |

The design follows `Design/README.md`: a honeycomb green screen, the white mark, the white "7GZ-KORA" lettering, black step text and a black Install button. See the Install screen in `Design/screens.html`.

---

## 3. Invite links and shared links

- An invite link (`/join?code=KICK-7Q3F`) opened in a browser shows the Install screen **plus the code**: "Your invite code: **KICK-7Q3F**. Enter it after you install and sign in", with a **Copy** button.
- The code can't be carried over automatically on iPhone, because Safari and the installed app don't share storage. People type it on the existing "Join with an invite code" screen.
- Other shared links (such as a night shared to WhatsApp, from `Extras-and-backlog.md`) also open the Install screen in a browser. Share messages should say "Open 7GZ-KORA to see the night" rather than relying on the link to open the app.

---

## 4. Hiding the app from the public

| Place | Change |
|---|---|
| Page title | "7GZ-KORA" only |
| `<meta name="description">` | Removed |
| Link previews (Open Graph) | `og:title` "7GZ-KORA", `og:image` the app icon, **no** `og:description` |
| Search engines | `<meta name="robots" content="noindex, nofollow">`, plus `public/robots.txt` with `Disallow: /` |
| Web app manifest | `name` and `short_name` "7GZ-KORA", no `description` |
| Sign-in screen | No tagline or feature text |
| `/install` and "How it works" | The install steps live on the Install screen. "How it works" (the rating rules) stays inside the signed-in app only. |
| `/privacy.html` | A static page in `public/` (Vercel serves real files before the catch-all rewrite). Google's Branding page links to it. |

The app's code is still downloaded by the browser, as with every website, but **no group data is ever sent without signing in**: the database's Row Level Security already guarantees that.

---

## 5. Risk: iPhone sign-in (must test first)

With sign-in only inside the installed app, the iPhone case from `football-idea.md` can't be avoided: **Google sign-in inside an installed iPhone app can fail to come back to the app.** There's no browser sign-in to fall back on.

- Before inviting anyone, do the real-phone test in the root `README.md` (section 3) on an iPhone and an Android phone.
- If Google fails on iPhone, turn on the **email-code sign-in** (root `README.md` section 4: a custom email sender in Supabase, then `VITE_ENABLE_EMAIL_CODE=true`). It works inside the installed app.

---

## 6. Development and testing

- `npm run dev`, the screenshot checks and automated browser tests run in a normal browser, so a development-only setting skips the Install screen: `VITE_ALLOW_BROWSER=true` in `.env.local`. **Never set it on Vercel.**
- The "show the Install screen or the app?" decision is a small pure function (installed? allowed in development?) with unit tests: browser → Install screen; installed → app; browser with the development setting → app.
- Test each row of section 2 on the real devices you have, at least iPhone Safari, iPhone WhatsApp link, and Android Chrome.
