# 7GZ-KORA Design System

> The look of the app, based on the owner's logo (`logo/7gz-kora-logo-original.png`). **Open `screens.html` in a browser** to see everything below: the logo, colours, type, components and seven app screens in light and dark mode. Decisions agreed with the owner on 2026-10-24 are marked ✔ and aren't re-asked.

---

## Files

| File | What it is |
|---|---|
| `screens.html` | The visual guide: logo, colours, type, components, seven phone screens (Install, Sign-in, Home, Live night, Vote, Results, Table). It follows the device's light/dark setting. |
| `tokens.css` | Every colour, font, size and shape as CSS variables, plus the Tailwind v4 mapping. **The single source for the app.** |
| `logo/7gz-kora-logo-original.png` | The owner's Canva logo: the reference everything is based on |
| `logo/7gz-kora-logo.svg` | Full logo on green (like the original), as sharp vectors |
| `logo/7gz-kora-logo-transparent.svg` | Full logo without a background, cropped tight: for green or textured surfaces |
| `logo/7gz-kora-logo-on-light.svg` | Full logo for white backgrounds (green mark, black text) |
| `logo/7gz-kora-mark-white.svg` / `-green.svg` / `-black.svg` | The boot-on-ball drawing alone, in each colour, with real transparent cut-outs |
| `logo/7gz-kora-wordmark-black.svg` | "7GZ-KORA" lettering alone, black |
| `icons/app-icon.svg` + PNGs | Home-screen icon set (64, 192, 512, maskable 512, Apple 180, favicon) |
| `icons/pwa-assets.config.ts` | Rebuilds the PNGs: `npx pwa-assets-generator -c Design/icons/pwa-assets.config.ts` |

The vector files are a redraw of the Canva logo, made to match it. The lettering is converted to shapes, so it looks the same on every device.

---

## 1. The idea

Street-pitch football: **bold black type on bright pitch green, with white line art.** It should feel like a kit badge or a sticker, loud and confident, and stay readable in sunlight at the pitch. The one recurring texture is the **honeycomb from the ball**.

---

## 2. Logo

| Use | File |
|---|---|
| Install screen (all the website shows), sign-in and loading screen | Mark (white) + "7GZ-KORA" in white, large, on green. No tagline or description (see `Plans/Install-first-access.md`). |
| App header | Mark (white, small) + **black** wordmark on green |
| Home-screen icon ✔ | Boot on ball only, **no text** (text is unreadable at icon size) |
| Documents, shirts, printing on white | `7gz-kora-logo-on-light.svg` |

- ✔ **The tagline "ZNOOG-EL AAST" appears only in the logo files**, never inside the app.
- **Clear space:** keep empty space around the logo at least as wide as half the ball.
- **Minimum size:** the mark at least 24 px tall on screen; the full logo at least 120 px wide.
- **Don't** stretch it, recolour it (only white, black or brand green), add outlines or shadows, or put the white logo on a light background.
- White lettering is fine **in the logo**, where it's large. Anywhere else, text on green is black (section 3).

---

## 3. Colour

**The rule that matters most ✔: text on the brand green is always black.** White text on `#00BF63` is too faint to read (2.4:1, where 4.5:1 is needed), and worse in sunlight. Black on it reads at 8.6:1.

| Token | Hex | Use |
|---|---|---|
| `--brand` | `#00BF63` | The logo green: header, primary buttons, selected states, highlights. **Black text only.** |
| `--brand-ink` | `#00733A` | Green **text**, links and icons on white (6:1); the top rating badge |
| `--ink` | `#0B0B0B` | Text, bold borders, the sticker shadow on buttons |
| `--paper` | `#FFFFFF` | Cards and sheets |
| `--ground` | `#F2F6F3` | Page background |
| `--muted` | `#56625B` | Secondary text (about 6:1 on white) |
| `--line` | `#DDE5E0` | Hairlines and card borders |
| `--gold` | `#F5B700` | The Man of the Match star only |
| `--danger` | `#B42318` | Errors, disputes, Delete |

**Teams wear bib colours**, all with black text and a black outline:

| Team | Colour | Meaning |
|---|---|---|
| A | White `#FFFFFF` | No bibs |
| B | Orange `#FF7A1A` | Orange bibs |
| C | Blue `#3BA7FF` | Blue bibs (usually the waiting team) |

The brand green is **not** a team colour, so a team chip is never confused with a button.

**Rating badges**, using the colour bands football apps use: **8.0+** dark green `#00733A` with white text · **7.0–7.9** brand green with black text · **6.0–6.9** amber `#FFC21A` with black text · **under 6** grey `#CFD8D2` with black text.

---

## 4. Type

| Role | Font | Size / line height | Example |
|---|---|---|---|
| Score | Archivo Black | 64 / 1 | `2 – 1` |
| Page title | Archivo Black | 34 / 1.05 | Rate the players |
| Card title | Archivo Black | 22 / 1.15 | Club pitch 3 |
| Body | Archivo 400–700 | 16 / 1.5 | Votes stay secret until… |
| Small | Archivo 400 | 13 / 1.4 | 6 a side · 2 hours |
| Label | Archivo 700, UPPERCASE, letter-spacing 0.12em | 12 | THU 30 OCT · 20:00 |
| Button | Archivo 800, UPPERCASE, letter-spacing 0.05em | 15 (20 for big pitch-side buttons) | I'M IN |

- **Archivo Black** is the closest free match to the logo lettering. **Archivo** is its everyday sibling.
- Numbers (scores, timers, ratings, money) use tabular figures so they don't jump around.
- **Arabic names** fall back to the phone's Arabic font automatically. Keep them left-aligned in lists, and use `dir="auto"` (or `<bdi>`) around every name.
- Install in the app: `@fontsource/archivo-black` and `@fontsource/archivo` (weights 400, 500, 700, 800). This replaces Barlow Condensed.

---

## 5. Space and shape

- Spacing steps: 4 · 8 · 12 · **16** (page gutter) · 24 · 32.
- **Tap targets at least 48 px tall.** Pitch-side actions (Goal, I'm in) are 64 px.
- Corners: cards 18 px, buttons 14 px, chips fully rounded.
- **Bold 2 px black borders** on buttons, chips and the team picker. This is the same weight as the logo's line art.
- **Sticker shadow:** primary buttons have a solid `0 3px 0` black shadow that disappears when pressed (the button moves down 3 px), so every tap feels physical.
- **Honeycomb texture** (`.honeycomb` in `tokens.css`): only on green surfaces, meaning the app header and the sign-in screen. Never behind text on white.

---

## 6. Components

Each one is shown working in `screens.html`. Copy the CSS from there.

| Component | Spec |
|---|---|
| **App header** | Honeycomb green bar; white mark (30 px) + black "7GZ-KORA" (Archivo Black 22) + group name below (black, 75% opacity) |
| **Bottom tabs** | White bar: Home, Nights, Table, Me, More. The active tab's icon sits in a green pill with a black icon. |
| **Primary button** | Green, black text, 2 px black border, sticker shadow. One per screen area. |
| **Secondary button** | White (paper), ink text, 2 px ink border |
| **Black button** | Always black: the action on green surfaces (e.g. "Continue with Google") |
| **Dark button** | Ink background: black in light mode, white in dark mode (e.g. "Game over") |
| **Danger button** | White, red text and border |
| **Team chip** | Pill, team colour, black border, UPPERCASE "TEAM A" |
| **Status chip** | Planned (outline) · Live (green, pulsing dot) · Voting (amber) · Final (ink) · Cancelled (outline, muted) |
| **Rating badge** | Rounded square, Archivo Black, colour band from section 3 |
| **Scoreboard** | Team chips on top, score in Archivo Black 64, timer below ("07:42 of 10:00") |
| **Team picker** | Out / A / B / C segments, 46 × 42 px each, one tap |
| **Vote row** | 1–10 as two rows of five (42 px tall); the selected number is green with a black border; "Didn't see" chip in the card header |
| **Card** | White, 1.5 px line border, 18 px corners, 14–16 px padding. Important cards (money, live game) get a 2 px ink border. |
| **Money card** | Label "YOU OWE", amount in Archivo Black 28, "to Ahmed · 600 ÷ 13 players" |
| **Empty state** | The green mark at 96 px, a one-line title, and the next action |
| **Install screen** | Honeycomb green, white mark and lettering, a white card with the steps for the device, a black Install button where the browser supports one, and the invite code (with Copy) when opened from an invite link. Nothing else about the app. |

---

## 7. Dark mode

Follows the phone's setting. The page goes near-black (`#0A0F0C`), cards `#141B17`, text and bold borders turn light (`#F2F5F3`), and green text becomes `#39E48C`. **The brand green, black-on-green text, team colours and rating bands stay the same**, so the app looks like itself in both modes.

---

## 8. Accessibility checklist

- Text on green is black, never white (except the large logo lettering).
- Normal text contrast is at least 4.5:1, which every token pair in section 3 meets.
- Tap targets are 48 px or more; the app is usable one-handed.
- A visible focus ring: 2 px ink outline.
- Respect "reduce motion": no button press movement and no pulsing Live dot.
- Never use colour alone: team chips always say "TEAM A/B/C", and rating badges show the number.

---

## 9. Applying this to the app (for the build session)

Apply it in **stage 1** of `Plans/README.md`, together with the rename to 7GZ-KORA:

1. **Fonts:** install `@fontsource/archivo-black` and `@fontsource/archivo`, and remove `@fontsource/barlow-condensed`.
2. **Tokens:** replace the colour and font tokens in `src/index.css` with `Design/tokens.css` (the `:root` blocks, the `.honeycomb` class and the `@theme inline` mapping in its last comment). Drop the old pitch-stripes and Barlow tokens.
3. **Components** in `src/components/ui.tsx` and `match.tsx`:
   - Button variants: primary, secondary, black, dark, danger
   - `RatingBadge`: the new colour bands
   - `TeamTag`: A/B/C bib colours
   - `StatusChip`: add Cancelled
   - Scoreboard: chips on top
   - The team picker gains C
4. **Header and sign-in:** use the honeycomb, the white mark and the black wordmark as in `screens.html`. The tagline doesn't appear.
5. **Icons:** copy `Design/icons/*.png`, `favicon.ico` and `app-icon.svg` to `public/`. Point the root `pwa-assets.config.ts` at `public/app-icon.svg` with no padding (as in `Design/icons/pwa-assets.config.ts`). Replace `public/logo.svg` with `logo/7gz-kora-mark-white.svg`.
6. **Manifest and HTML:** `name` and `short_name` become "7GZ-KORA", `theme_color` and `background_color` become `#00BF63`, the `<title>` and `apple-mobile-web-app-title` become "7GZ-KORA", and `<meta name="theme-color">` becomes `#00BF63` in both modes.
7. **Check:** compare the running app with `screens.html` in light and dark mode at phone width (390 px). Black-on-green text everywhere, nothing white on green except the logo.
