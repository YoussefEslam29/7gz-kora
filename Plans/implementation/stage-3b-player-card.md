# Stage 3b: Player Card, Rating History and Motion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every player fills in a player card (shirt number, foot, favourite position, motto and a self-rating on five skills); the profile becomes a portfolio (the card, Self vs friends, a rating history graph, form, the nights with their breakdown); the whole app moves with the Motion library; admins change the rating settings in the app and see the change history; and the team suggester starts new players at their self-rating.

**Architecture:** The database gains only nine columns on `players`, in a new migration file 7 (`supabase/migrations/20261025000300_player_card.sql`); files 1-6 already ran on the owner's live Supabase project, so **they are never edited**. Everything else is app code: pure, tested helpers (`src/lib/card.ts`, `trend.ts`, `audit.ts`, and a small change in `suggest.ts`), shared animation pieces (`src/lib/motion.ts`, `src/components/motion.tsx`), pop-up sheets and messages (`src/components/feedback.tsx`), and new screens (Edit my card, Welcome, Change history). Ratings stay calculated only in `compute_match_ratings`, which this stage doesn't touch.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Tailwind 4, react-router 8, supabase-js 2, Postgres (Supabase), PGlite for database tests, vitest 5. **One new package: `motion` 14.1.0** (the new name of Framer Motion), imported from `motion/react` and `motion/react-m`.

**Spec:** `Plans/Player-card-and-motion.md` (all of it; its section 0 decisions are final), `Design/README.md` (colours, type, components, section 8 accessibility). Rules from the root `CLAUDE.md` and `Plans/NEXT-SESSION-PROMPT.md`.

## Global Constraints

- **Files 1-6 in `supabase/migrations/` ran on the live project: never edit them.** The one database change goes in file 7, `supabase/migrations/20261025000300_player_card.sql`.
- **Stay on Supabase.** Every table keeps Row Level Security; access is granted explicitly. The only new write permission is `update` on the nine card columns of `players`, under the existing row rule "rename yourself, or anyone if admin".
- **The self-rating never changes a night rating.** `compute_match_ratings` is not touched and doesn't read the card. Ratings stay calculated in one place.
- **Self-rating** = the average of the five skills (Shooting, Passing, Dribbling, Defending, Fitness, 1-10 each), one decimal. **All five or none.**
- **Team suggester strength:** season rating, then all-time rating, then **the self-rating kept between 4.5 and 7.5**, then **6.0**.
- **Self vs friends:** gap = self-rating − friends' score (the `avg_votes` of `get_leaderboard`: season once the player has the table's number of rated nights this season, else all-time with the same rule). **−1.0 or less: Modest · between: Spot on · +1.0 up to +2.0: Confident · +2.0 or more: Very confident.**
- **Form:** the last 5 rated nights and their average; the arrow compares with the average of the (up to 5) nights before: **up** at +0.2 or more, **down** at −0.2 or less, else level; no arrow with fewer than 6 nights.
- **Favourite position is for show only.** Teams still have no fixed positions.
- **Money doesn't change.** Admins only start and end games, change teams, check people in and log goals.
- **Motion:** `motion` pinned to exactly **14.1.0**. Use only the `m` components (`import * as m from 'motion/react-m'`) inside `LazyMotion strict`; a `motion.*` component is an error. Animate only `transform` and `opacity`, except the three that can't (the breakdown's height in `Reveal`, and the two progress bars' width). `MotionConfig reducedMotion="user"`; count-ups, bumps, the graph's line drawing and `Reveal` also check `useReducedMotion()`.
- **No chart library** and no other new package.
- **Text on the brand green `#00BF63` is always black.** White only in the logo lettering (and the white ball line art of the GOAL! splash, which is not text).
- **Names can be Arabic:** wrap every name (and the motto) in `<Name>` (a `<bdi dir="auto">`), keep them left-aligned in lists.
- Tap targets at least 48 px (the 1-10 tap rows stay 42 px tall, as on the vote screen; segmented pickers 46 px, as everywhere else).
- Follow the existing code style: comment density, naming, small files.
- Checks that must pass at the end: `npx tsc -b`, `npm run lint` (0 warnings), `npm test`, `npm run build`.

## How this stage is run

- One commit at the end of the stage, after the owner chooses how (their usual: straight to `main`). Each task ends with a checkpoint (checks green) instead of a commit.
- Screen checks use a **temporary** local stand-in for Supabase in the session's scratch folder (Task 14), as in stages 1-3.
- The owner must run file 7 on their live project once, **before** pushing (every push to `main` deploys to Vercel, and the new app reads the new columns). File 6 too, if they haven't yet. Task 13 puts that in the README; the hand-over (Task 14) tells them in plain words.

## Decisions this plan makes (not covered by the spec; flag them to the owner)

1. **It's called "stage 3b"** in `Plans/README.md`: built after the team suggester (stage 3) and before punishments (stage 4), whose numbers don't change.
2. **`motion` is pinned to 14.1.0**, the newest release that was at least two weeks old on 2026-10-25 (14.6.0 came out three days before). Motion 14 has no breaking changes from 13. Upgrade later on purpose, not by accident.
3. **The card's column for the position is `favourite_position`**, because `position` is also a Postgres word.
4. **The Welcome screen keeps the header and the tabs**, so anyone can leave it; it also has a **Not now** link. **Skip** on a step clears that step's fields and moves on.
5. **The card says "Rates themselves 7.6"** ("You rate yourself" on your own card), and shows the skill bars as soon as one skill is set, but the average only when all five are.
6. **The Rating history tabs scope everything in that card**: the graph, the form, the best night and the Man of the Match count. Only finished nights (voting closed) are in the graph, as on the table.
7. **The GOAL! splash shows for a goal in the game on now**, not for a forgotten goal added to an earlier game. Tapping it closes it early. Others watching the live night get a "Goal for Team A! 2 – 1" message instead.
8. **The Table's rows glide to their new places** when you change the sort.
9. **Confirmation sheets** focus **Cancel** first; the risky button is red ("Delete", "Remove", "Leave group", "Undo check-in", "Dispute", "Turn off").
10. **Messages ("toasts")** after: votes saved, card saved, teams saved, a check-in / "left" / "back" / undo, a night planned / saved / deleted / started / ended, voting extended / closed, a swap, rating settings saved, and every goal seen on the live view.
11. **Rating settings in the app:** the stats share is a slider from 50% to 90% in steps of 5%, "Nights to join the table" is − / + from 1 to 10, the votes needed are 0-5 and the voting window 6, 12, 24, 48 or 72 hours. A value set in Supabase outside these steps still shows, and is kept unless the admin changes it.
12. **Change history** pages by time (50 at a time). Each line links to its night, except a deleted night. An action the app doesn't know yet shows its database name, so nothing is hidden.
13. **The rating badge in the card's green band gets a black outline**, because a 7.0-7.9 badge is the same green as the band.
14. **The demo players get cards** (a mix of modest and very confident ones, and one Arabic motto); Hany's stays empty, so his profile shows the empty state.

---

## File structure

**Database**

| File | Change |
|---|---|
| `supabase/migrations/20261025000300_player_card.sql` | **New.** Nine card columns on `players`, their checks, and the update grant |
| `tests/db/card.test.ts` | **New.** The card: empty at first, your own, admins, ranges, all five or none, locked columns, signed-out visitors, players from before file 7. Rating settings: admins only, weights add up to 1. |
| `supabase/seed.sql` | Demo cards; the header says 7 files |
| `tests/db/seed.test.ts` | Everyone but Hany (and the new joiner) has a card |

**App: logic (pure, tested with vitest)**

| File | Responsibility |
|---|---|
| `src/lib/card.ts` + `card.test.ts` | **New.** `SKILLS`, `FEET`, `POSITIONS`, `skillsState`, `selfRating`, `isCardFilled`, `cleanCard`, `confidence`, `CONFIDENCE`, `friendsScore` |
| `src/lib/trend.ts` + `trend.test.ts` | **New.** `recentForm`, `bestNight`, `chartScale`, `TREND_STEP`, `FORM_NIGHTS` |
| `src/lib/audit.ts` + `audit.test.ts` | **New.** `describeAudit`: one audit-log line as a sentence |
| `src/lib/suggest.ts` + `suggest.test.ts` | `playerStrength` takes the self-ratings; `NEW_PLAYER_MIN`, `NEW_PLAYER_MAX` |
| `src/lib/motion.ts` | **New.** Shared animation settings: `spring`, `rise`, `cascade`, `cascadeItem` |
| `src/lib/motionFeatures.ts` | **New.** The animation features, loaded in the background |
| `src/lib/types.ts` | `Foot`, `Position`, `Skills`, `CardFields`; `Player` gains the card; `RatingSettings`, `AuditEntry` |
| `src/lib/api.ts` | Players read the card; `saveCard`, `updateRatingSettings`, `getAuditLog`; `renamePlayer` and `setHappyInGoal` go (Edit my card saves everything in one go) |
| `src/lib/storage.ts` | `KEYS.cardReminderHidden` |

**App: screens and pieces**

| File | Responsibility |
|---|---|
| `src/components/motion.tsx` | **New.** `MotionProvider`, `Cascade`, `Reveal`, `CountUp`, `Bump` |
| `src/components/feedback.tsx` | **New.** `FeedbackProvider`, `useConfirm` (the pop-up sheet), `useToast` |
| `src/components/card.tsx` | **New.** `PlayerCard` and its skill bars |
| `src/components/cardform.tsx` | **New.** The card's fields: `ShirtField`, `FootField`, `PositionField`, `SkillsField`, `MottoField` |
| `src/components/selfvsfriends.tsx` | **New.** `SelfVsFriends` |
| `src/components/history.tsx` | **New.** `RatingHistory`: tabs, the graph, form, best night |
| `src/components/breakdown.tsx` | **New.** `BreakdownTable`, moved out of `results.tsx` so the profile can use it |
| `src/components/ratingsettings.tsx` | **New.** `RatingSettingsCard`: read-only for members, an editor for admins |
| `src/components/goalsplash.tsx` | **New.** `GoalSplash` |
| `src/pages/EditCard.tsx` | **New.** Edit my card (`/players/:id/edit`) |
| `src/pages/Welcome.tsx` | **New.** The three welcome steps (`/welcome`) |
| `src/pages/ChangeHistory.tsx` | **New.** Change history (`/settings/history`), admins only |
| `src/pages/PlayerProfile.tsx` | The portfolio |
| `src/main.tsx`, `src/App.tsx`, `src/components/Layout.tsx`, `src/index.css`, `src/components/ui.tsx` | Providers, routes, the opening screen, screen transitions, the tab bubble, placeholders, `Card` sliding in, `RatingBadge` counting up, `Toggle`, `ScoreButton` |
| Pop-ups and messages | `checkin.tsx`, `games.tsx`, `match.tsx`, `results.tsx`, `NightPage.tsx`, `PlanNight.tsx`, `Settings.tsx`, `Swap.tsx`, `Teams.tsx`, `Vote.tsx` |
| Small edits | `Home.tsx` (Finish your card, sliding in), `JoinOrCreate.tsx` (to `/welcome`), `Recorder.tsx` (GOAL!), `Nights.tsx`, `Leaderboard.tsx`, `HowItWorks.tsx` |

**Docs:** `README.md` (file 7, what's built, choices, tests, layout, troubleshooting), `Plans/README.md` (status and build order), `Plans/NEXT-SESSION-PROMPT.md` (where things stand).

---

## Part A — Motion basics

### Task 1: Motion, screen transitions, the tab bubble and the opening screen

**Files:**
- Modify: `package.json`, `package-lock.json` (via npm)
- Create: `src/lib/motionFeatures.ts`, `src/lib/motion.ts`, `src/components/motion.tsx`
- Modify: `src/main.tsx`, `src/components/Layout.tsx`, `src/App.tsx` (the `Splash` function)

**Interfaces:**
- Produces: `spring: Transition`, `rise` (props for an `m.div`), `cascade: Variants`, `cascadeItem: Variants` from `src/lib/motion.ts`; `MotionProvider`, `Cascade({ children, className? })`, `Reveal({ open, children })`, `CountUp({ value, decimals? })`, `Bump({ value, children })` from `src/components/motion.tsx`.

- [ ] **Step 1: Note the bundle size before**

Run: `npm run build`
Write down the size of the main `assets/index-*.js` file (raw and gzip) from the output, for the hand-over.

- [ ] **Step 2: Install Motion, pinned**

Run: `npm install motion@14.1.0 --save-exact`
Expected: `package.json` gains `"motion": "14.1.0"` under `dependencies` (no `^`).

- [ ] **Step 3: The features file**

Create `src/lib/motionFeatures.ts`:

```ts
// The animation features, loaded in the background by MotionProvider
// (src/components/motion.tsx) so they don't slow down the first screen.
// domMax includes layout animations (the tab bubble, the table re-sorting).
import { domMax } from 'motion/react'

export default domMax
```

- [ ] **Step 4: Shared animation settings**

Create `src/lib/motion.ts`:

```ts
// Shared animation settings (Plans/Player-card-and-motion.md section 5).
// Only movement and fading animate, so phones stay smooth.
import type { Transition, Variants } from 'motion/react'

/** A quick spring for things that move into place (the tab bubble, a switch). */
export const spring: Transition = { type: 'spring', stiffness: 500, damping: 32 }

/** A screen opening: it fades in and rises a little. */
export const rise = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.2, ease: 'easeOut' },
} as const

/** A stack or list whose items slide in one after another (each item uses cascadeItem). */
export const cascade: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.05 } },
}

export const cascadeItem: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
}
```

- [ ] **Step 5: The animation helpers**

Create `src/components/motion.tsx`:

```tsx
// Animation helpers (Plans/Player-card-and-motion.md section 5), with the
// Motion library (formerly Framer Motion). Screens use the small `m`
// components; MotionProvider loads their features in the background. With
// "reduce motion" on the phone, movement turns off and fades stay.
import { animate, AnimatePresence, LazyMotion, MotionConfig, useAnimate, useReducedMotion } from 'motion/react'
import * as m from 'motion/react-m'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cascade } from '../lib/motion'

// Starts loading as soon as the app opens.
const features = import('../lib/motionFeatures').then((module) => module.default)

export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={() => features} strict>
        {children}
      </LazyMotion>
    </MotionConfig>
  )
}

/** A stack of cards (or rows) that slide in one after another when the screen opens. */
export function Cascade({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <m.div className={className} initial="initial" animate="animate" variants={cascade}>
      {children}
    </m.div>
  )
}

/** Opens and closes its content smoothly (a breakdown under a row). */
export function Reveal({ open, children }: { open: boolean; children: ReactNode }) {
  const reduce = useReducedMotion()
  return (
    <AnimatePresence initial={false}>
      {open && (
        <m.div
          key="reveal"
          className="overflow-hidden"
          initial={reduce ? false : { height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
        >
          {children}
        </m.div>
      )}
    </AnimatePresence>
  )
}

/** A number that counts up from 0 when it first shows, and on to each new value. */
export function CountUp({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const reduce = useReducedMotion()
  const [shown, setShown] = useState(0)
  const from = useRef(0)
  useEffect(() => {
    if (reduce) return
    const controls = animate(from.current, value, {
      duration: 0.7,
      ease: 'easeOut',
      onUpdate: (n) => {
        from.current = n
        setShown(n)
      },
    })
    return () => controls.stop()
  }, [value, reduce])
  return <>{(reduce ? value : shown).toFixed(decimals)}</>
}

/** Bounces its content when `value` changes (not when it first shows): the live score. */
export function Bump({ value, children }: { value: unknown; children: ReactNode }) {
  const [scope, run] = useAnimate<HTMLSpanElement>()
  const reduce = useReducedMotion()
  const previous = useRef(value)
  useEffect(() => {
    if (Object.is(previous.current, value)) return
    previous.current = value
    if (!reduce) void run(scope.current, { scale: [1, 1.35, 1] }, { duration: 0.45, ease: 'easeOut' })
  }, [value, reduce, run, scope])
  return (
    <span ref={scope} className="inline-block">
      {children}
    </span>
  )
}
```

(`Bump` compares with the previous value instead of skipping the first run, so React's development double-run of effects doesn't bounce the score on opening.)

- [ ] **Step 6: Wrap the app**

In `src/main.tsx`, add the import after `import App from './App'`:

```tsx
import { MotionProvider } from './components/motion'
```

and replace the render with:

```tsx
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionProvider>
      <App />
    </MotionProvider>
  </StrictMode>,
)
```

- [ ] **Step 7: Screens slide in; the tab bubble glides**

Replace `src/components/Layout.tsx` with:

```tsx
import * as m from 'motion/react-m'
import { NavLink, Outlet, useLocation } from 'react-router'
import { rise, spring } from '../lib/motion'
import { useGroup } from '../state/group'
import { HomeIcon, MatchesIcon, MoreIcon, PersonIcon, TableIcon } from './icons'
import { Name } from './ui'

/** Honeycomb header + content + bottom tabs (one-handed navigation). */
export default function Layout() {
  const { group, myPlayerId } = useGroup()
  const { pathname } = useLocation()

  const tabs = [
    { to: '/', label: 'Home', icon: HomeIcon, end: true },
    { to: '/nights', label: 'Nights', icon: MatchesIcon, end: false },
    { to: '/table', label: 'Table', icon: TableIcon, end: false },
    { to: `/players/${myPlayerId}`, label: 'Me', icon: PersonIcon, end: false },
    { to: '/settings', label: 'More', icon: MoreIcon, end: false },
  ]

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="honeycomb sticky top-0 z-20 pt-[env(safe-area-inset-top)] text-on-brand">
        <div className="mx-auto flex h-16 max-w-xl items-center gap-2.5 px-4">
          <img src="/logo.svg" alt="" className="h-[46px] w-[30px] object-contain" />
          <div className="min-w-0 leading-none">
            <p className="font-display text-[22px] leading-none">7GZ-KORA</p>
            {group && (
              <p className="mt-1 truncate text-[11.5px] font-semibold opacity-75">
                <Name>{group.name}</Name>
              </p>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl flex-1 px-4 pt-4 pb-28">
        {/* Each screen slides in when you open it. */}
        <m.div key={pathname} {...rise}>
          <Outlet />
        </m.div>
      </main>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-20 border-t-[1.5px] border-line bg-paper pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="mx-auto grid h-16 max-w-xl grid-cols-5">
          {tabs.map(({ to, label, icon: Icon, end }) => (
            <li key={label}>
              <NavLink
                to={to}
                end={end}
                className="flex h-full flex-col items-center justify-center gap-0.5 text-[10.5px] font-bold text-muted aria-[current=page]:text-ink"
              >
                {({ isActive }) => (
                  <>
                    <span className="relative rounded-full px-3 py-[3px]">
                      {/* The green bubble glides to the tab you tap. */}
                      {isActive && (
                        <m.span layoutId="tab-bubble" transition={spring} className="absolute inset-0 rounded-full bg-brand" />
                      )}
                      <Icon size={22} className={`relative ${isActive ? 'text-on-brand' : ''}`} />
                    </span>
                    {label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
```

(A screen's `transform` ends as `none` once it has risen into place, so `position: fixed` pieces inside a screen, like the GOAL! splash in Task 9, work as normal.)

- [ ] **Step 8: The opening screen's logo bounces in**

In `src/App.tsx`, add `import * as m from 'motion/react-m'` at the top (before the `react` import), and replace `Splash` with:

```tsx
function Splash() {
  return (
    <div className="honeycomb flex min-h-dvh items-center justify-center">
      {/* The logo drops in and bounces like a ball. */}
      <m.img
        src="/logo.svg"
        alt="Loading 7GZ-KORA"
        className="h-28"
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', bounce: 0.6, duration: 0.9 }}
      />
    </div>
  )
}
```

- [ ] **Step 9: Checkpoint**

Run: `npx tsc -b && npm run lint && npm test && npm run build`
Expected: all pass. The build now shows a separate small chunk for `motionFeatures`. Note the new main bundle size next to the old one.

---

### Task 2: Pop-up sheets, messages and loading placeholders

**Files:**
- Create: `src/components/feedback.tsx`
- Modify: `src/main.tsx`, `src/components/ui.tsx` (`Loading`), `src/index.css`
- Modify (pop-ups and messages): `src/components/checkin.tsx`, `src/components/games.tsx`, `src/components/match.tsx`, `src/components/results.tsx`, `src/pages/NightPage.tsx`, `src/pages/PlanNight.tsx`, `src/pages/Settings.tsx`, `src/pages/Swap.tsx`, `src/pages/Teams.tsx`, `src/pages/Vote.tsx`

**Interfaces:**
- Produces: `interface Question { title: string; message?: ReactNode; confirmLabel: string; danger?: boolean }`; `useConfirm(): (question: Question) => Promise<boolean>`; `useToast(): (message: ReactNode) => void`; `FeedbackProvider`.

- [ ] **Step 1: The sheet and the messages**

Create `src/components/feedback.tsx`:

```tsx
// Pop-up sheets and short messages in the app's own style
// (Plans/Player-card-and-motion.md section 5). The sheet replaces the
// browser's window.confirm, which looks out of place in the installed app
// and on iPhone shows the website address as its title.
import { AnimatePresence } from 'motion/react'
import * as m from 'motion/react-m'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { Button } from './ui'

/** What a confirmation sheet asks. The yes button is red when `danger` is set. */
export interface Question {
  title: string
  message?: ReactNode
  /** The yes button, e.g. "Delete". */
  confirmLabel: string
  danger?: boolean
}

interface Feedback {
  /** Shows the sheet; true when the person taps the yes button. */
  confirm: (question: Question) => Promise<boolean>
  /** A short message above the tab bar for about 2.5 seconds ("Votes saved"). */
  toast: (message: ReactNode) => void
}

const FeedbackContext = createContext<Feedback | null>(null)

type Asking = Question & { resolve: (yes: boolean) => void }
type Toast = { id: number; message: ReactNode }

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [asking, setAsking] = useState<Asking | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)

  const confirm = useCallback(
    (question: Question) => new Promise<boolean>((resolve) => setAsking({ ...question, resolve })),
    [],
  )

  const toast = useCallback((message: ReactNode) => {
    const id = ++nextId.current
    // At most three at once: the oldest goes first.
    setToasts((list) => [...list.slice(-2), { id, message }])
    window.setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 2500)
  }, [])

  const answer = useCallback(
    (yes: boolean) => {
      asking?.resolve(yes)
      setAsking(null)
    },
    [asking],
  )

  const value = useMemo(() => ({ confirm, toast }), [confirm, toast])

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <AnimatePresence>{asking && <ConfirmSheet key="confirm" question={asking} onAnswer={answer} />}</AnimatePresence>
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-40 flex flex-col items-center gap-2 px-4">
        <AnimatePresence>
          {toasts.map((t) => (
            <m.p
              key={t.id}
              role="status"
              layout
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8 }}
              className="max-w-full rounded-full bg-ink px-4 py-2.5 text-center text-sm font-semibold text-paper shadow-[0_3px_0_#0b0b0b]"
            >
              {t.message}
            </m.p>
          ))}
        </AnimatePresence>
      </div>
    </FeedbackContext.Provider>
  )
}

/** The bottom sheet: a title, a message, Cancel and the yes button. */
function ConfirmSheet({ question, onAnswer }: { question: Question; onAnswer: (yes: boolean) => void }) {
  const sheet = useRef<HTMLDivElement>(null)

  // Escape closes the sheet; afterwards the focus goes back where it was.
  useEffect(() => {
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onAnswer(false)
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      before?.focus()
    }
  }, [onAnswer])

  // Tab stays inside the sheet.
  function trap(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'Tab') return
    const buttons = sheet.current?.querySelectorAll('button')
    if (!buttons || buttons.length === 0) return
    const first = buttons[0]
    const last = buttons[buttons.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <m.div
        aria-hidden
        className="absolute inset-0 bg-black/50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => onAnswer(false)}
      />
      <m.div
        ref={sheet}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        aria-describedby={question.message ? 'sheet-message' : undefined}
        onKeyDown={trap}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 420, damping: 36 }}
        className="relative w-full max-w-xl rounded-t-[22px] border-2 border-b-0 border-ink bg-paper px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+16px)]"
      >
        <span aria-hidden className="mx-auto mb-3 block h-1.5 w-10 rounded-full bg-line" />
        <h2 id="sheet-title" className="font-display text-[22px] leading-tight">
          {question.title}
        </h2>
        {question.message && (
          <p id="sheet-message" className="mt-1 text-muted">
            {question.message}
          </p>
        )}
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" className="flex-1" autoFocus onClick={() => onAnswer(false)}>
            Cancel
          </Button>
          <Button variant={question.danger ? 'danger' : 'primary'} className="flex-1" onClick={() => onAnswer(true)}>
            {question.confirmLabel}
          </Button>
        </div>
      </m.div>
    </div>
  )
}

function useFeedback(): Feedback {
  const ctx = useContext(FeedbackContext)
  if (!ctx) throw new Error('useFeedback must be used inside FeedbackProvider')
  return ctx
}

/** confirm({ title, message, confirmLabel, danger }): true when the person says yes. */
// eslint-disable-next-line react/only-export-components
export const useConfirm = () => useFeedback().confirm

/** toast("Votes saved"): a short message above the tab bar. */
// eslint-disable-next-line react/only-export-components
export const useToast = () => useFeedback().toast
```

- [ ] **Step 2: Wrap the app**

In `src/main.tsx`, add `import { FeedbackProvider } from './components/feedback'` before the `MotionProvider` import, and wrap `<App />`:

```tsx
    <MotionProvider>
      <FeedbackProvider>
        <App />
      </FeedbackProvider>
    </MotionProvider>
```

- [ ] **Step 3: Shimmering placeholders instead of the spinner**

In `src/components/ui.tsx`, replace `Loading` with:

```tsx
/** Shimmering placeholders shaped like a screen's cards, while it loads. */
export function Loading() {
  return (
    <div role="status" aria-label="Loading" className="space-y-4">
      <div className="skeleton h-24 rounded-card" />
      <div className="skeleton h-40 rounded-card" />
      <div className="skeleton h-28 rounded-card" />
    </div>
  )
}
```

In `src/index.css`, add after the `.press:active` block:

```css
/* Loading placeholders: a soft shine sweeping across. */
.skeleton {
  background: linear-gradient(100deg, var(--line) 30%, var(--paper) 50%, var(--line) 70%);
  background-size: 300% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
}

@keyframes shimmer {
  from { background-position: 100% 0; }
  to { background-position: 0 0; }
}
```

and inside the existing `@media (prefers-reduced-motion: reduce)` block, after the `.status.playing::before` rule:

```css
  .skeleton {
    animation: none;
  }
```

`Spinner` stays: buttons still use it while busy.

- [ ] **Step 4: Check-in: the sheet for Undo, messages for every tap**

In `src/components/checkin.tsx`:
- Add `import type { ReactNode } from 'react'` (merge with the existing `react` import: `import { useState, type ReactNode } from 'react'`) and `import { useConfirm, useToast } from './feedback'`.
- In `CheckInList`, after `const [error, setError] = useState<string | null>(null)`, add:

```tsx
  const confirm = useConfirm()
  const toast = useToast()
```

- Replace `run` and add `undo`:

```tsx
  async function run(playerId: string, action: () => Promise<unknown>, done: ReactNode) {
    setBusy(playerId)
    setError(null)
    try {
      await action()
      toast(done)
      onChange()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  async function undo(playerId: string, name: string) {
    const yes = await confirm({
      title: 'Undo this check-in?',
      message: (
        <>
          <Name>{name}</Name> comes off tonight's list. Only for a mistake.
        </>
      ),
      confirmLabel: 'Undo check-in',
      danger: true,
    })
    if (yes) await run(playerId, () => api.undoCheckIn(matchId, playerId), 'Check-in undone')
  }
```

- Replace the four buttons' `onClick`s:

```tsx
                  onClick={() => void undo(p.id, p.display_name)}
```
```tsx
                <Button size="sm" busy={busy === p.id} onClick={() => void run(p.id, () => api.checkIn(matchId, p.id), <><Name>{p.display_name}</Name> checked in</>)}>
                  Check in
                </Button>
```
```tsx
                <Button size="sm" variant="secondary" busy={busy === p.id} onClick={() => void run(p.id, () => api.checkIn(matchId, p.id), <><Name>{p.display_name}</Name> is back</>)}>
                  Back
                </Button>
```
```tsx
                <Button size="sm" variant="secondary" busy={busy === p.id} onClick={() => void run(p.id, () => api.checkOut(matchId, p.id), <><Name>{p.display_name}</Name> left</>)}>
                  Left
                </Button>
```

- [ ] **Step 5: Game over**

In `src/components/games.tsx`, add `import { useConfirm } from './feedback'`. In `GameCard`, after `const [error, setError] = useState<string | null>(null)` (before `const game = detail.runningGame`), add `const confirm = useConfirm()`. Replace `gameOver` with:

```tsx
  async function gameOver() {
    // A draw with a team waiting: penalties decide who stays on.
    if (score[0] === score[1] && waiting.length > 0) setAsking(true)
    else if (await confirm({ title: 'Game over?', message: `Final score ${score[0]} – ${score[1]}.`, confirmLabel: 'Game over' }))
      void end(null)
  }
```

and the Game over button's handler with `onClick={() => void gameOver()}`.

- [ ] **Step 6: Disputing and deleting a goal**

In `src/components/match.tsx`, add `import { useConfirm } from './feedback'`. In `GoalList`, after the `editing` state, add `const confirm = useConfirm()`, and after `run` add:

```tsx
  async function dispute(goalId: string) {
    const yes = await confirm({
      title: 'Dispute this goal?',
      message: "It won't count until an admin fixes it.",
      confirmLabel: 'Dispute',
      danger: true,
    })
    if (yes) await run(goalId, () => api.disputeGoal(goalId))
  }

  async function remove(goalId: string) {
    const yes = await confirm({ title: 'Delete this goal?', message: 'It stops counting.', confirmLabel: 'Delete', danger: true })
    if (yes) await run(goalId, () => api.deleteGoal(goalId))
  }
```

Replace the Dispute button's `onClick` with `onClick={() => void dispute(g.id)}` and the Delete button's with `onClick={() => void remove(g.id)}`.

- [ ] **Step 7: Voting: extend and close**

In `src/components/results.tsx`, add `import { useConfirm, useToast, type Question } from './feedback'`. In `VotingCard`, after the `error` state, add:

```tsx
  const confirm = useConfirm()
  const toast = useToast()
```

Replace `act` with:

```tsx
  async function act(name: string, action: () => Promise<unknown>, done: string, question?: Question) {
    if (question && !(await confirm(question))) return
    setBusy(name)
    setError(null)
    try {
      await action()
      toast(done)
      onChange()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }
```

and the two buttons' handlers with:

```tsx
onClick={() => void act('extend', () => api.extendVoting(match.id, 12), 'Voting extended by 12 hours')}
```
```tsx
            onClick={() =>
              void act('close', () => api.closeVoting(match.id), 'Voting closed', {
                title: 'Close voting now?',
                message: 'Ratings become final and everyone sees the votes.',
                confirmLabel: 'Close voting',
              })
            }
```

- [ ] **Step 8: Starting and ending a night**

In `src/pages/NightPage.tsx`, add `import { useConfirm, useToast, type Question } from '../components/feedback'`. After `const [actionError, setActionError] = useState<string | null>(null)`, add:

```tsx
  const confirm = useConfirm()
  const toast = useToast()
```

Replace `act` with:

```tsx
  async function act(name: string, action: () => Promise<unknown>, question: Question, done: string) {
    if (!(await confirm(question))) return
    setBusy(name)
    setActionError(null)
    try {
      await action()
      toast(done)
      changed()
    } catch (e) {
      setActionError(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }
```

The Start night button:

```tsx
                onClick={() =>
                  void act(
                    'start',
                    () => api.startNight(id),
                    { title: 'Start the night?', message: 'Replies close and check-in opens.', confirmLabel: 'Start night' },
                    'Night started',
                  )
                }
```

The End night button:

```tsx
                onClick={() =>
                  void act(
                    'end',
                    () => api.endNight(id),
                    {
                      title: 'End the night?',
                      message: 'A game still on ends now. Voting opens for everyone checked in, and the money card appears.',
                      confirmLabel: 'End night',
                    },
                    'Night ended. Voting is open.',
                  )
                }
```

- [ ] **Step 9: Planning, saving and deleting a night**

In `src/pages/PlanNight.tsx`, add `import { useConfirm, useToast } from '../components/feedback'`. After the `error` state, add:

```tsx
  const confirm = useConfirm()
  const toast = useToast()
```

In the save function, replace the `if (id) { ... } else { ... }` block with:

```tsx
      if (id) {
        await api.updateNight(id, details)
        toast('Night saved')
        navigate(`/nights/${id}`)
      } else {
        const newId = await api.planNight(group.id, details)
        toast('Night planned')
        navigate(`/nights/${newId}`)
      }
```

and replace `remove` with:

```tsx
  async function remove() {
    if (!id) return
    const yes = await confirm({
      title: 'Delete this night?',
      message: 'Its replies, goals, votes and ratings go too. This cannot be undone.',
      confirmLabel: 'Delete night',
      danger: true,
    })
    if (!yes) return
    setBusy('delete')
    try {
      await api.deleteMatch(id)
      toast('Night deleted')
      navigate('/nights')
    } catch (e) {
      setError(errorMessage(e))
      setBusy(null)
    }
  }
```

(If the Delete button calls `remove` as `onClick={remove}`, change it to `onClick={() => void remove()}`.)

- [ ] **Step 10: Settings: leaving, removing members, invite codes**

In `src/pages/Settings.tsx`, add `import { useConfirm, type Question } from '../components/feedback'`.

In `Settings`, add `const confirm = useConfirm()` after the `busy` state and replace `act`:

```tsx
  async function act(name: string, action: () => Promise<unknown>, question?: Question) {
    if (question && !(await confirm(question))) return
    setBusy(name)
    setError(null)
    try {
      await action()
      await refresh()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }
```

The Leave button's third argument becomes:

```tsx
              {
                title: 'Leave this group?',
                message: (
                  <>
                    Your stats stay in <Name>{group.name}</Name>. You can rejoin with the invite code.
                  </>
                ),
                confirmLabel: 'Leave group',
                danger: true,
              },
```

In `MemberRow`, the `act` prop's type becomes `(name: string, action: () => Promise<unknown>, question?: Question) => Promise<void>`, and Remove's third argument:

```tsx
                {
                  title: 'Remove this member?',
                  message: (
                    <>
                      <Name>{name}</Name> leaves the group. Their stats stay.
                    </>
                  ),
                  confirmLabel: 'Remove',
                  danger: true,
                },
```

In `InviteCard`, add `const confirm = useConfirm()` after the `error` state and replace `run`:

```tsx
  async function run(action: () => Promise<unknown>, question: Question) {
    if (!(await confirm(question))) return
    setBusy(true)
    setError(null)
    try {
      await action()
      await refresh()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }
```

with these questions:

```tsx
              run(
                () => api.regenerateInviteCode(group.id),
                code
                  ? { title: 'Make a new code?', message: 'The old one stops working.', confirmLabel: 'New code' }
                  : { title: 'Turn invites on?', message: 'You get a new code to share.', confirmLabel: 'Turn on' },
              )
```
```tsx
              onClick={() =>
                run(() => api.disableInviteCode(group.id), {
                  title: 'Turn off invites?',
                  message: 'The code stops working. Nobody new can join.',
                  confirmLabel: 'Turn off',
                  danger: true,
                })
              }
```

- [ ] **Step 11: End game and swap; teams and votes saved**

In `src/pages/Swap.tsx`, add `import { useConfirm, useToast } from '../components/feedback'`; after `const now = useNow(60_000)` add `const confirm = useConfirm()` and `const toast = useToast()`. In `save`, replace the first line with:

```tsx
    const ask = {
      title: 'End game and swap?',
      message: 'This game ends now and the next one starts at 0 – 0 with these teams.',
      confirmLabel: 'End and swap',
    }
    if (!cont && !(await confirm(ask))) return
```

and after `await api.swapPlayers(id, lineup, cont)` add `toast(cont ? 'Swapped. The game goes on.' : 'Next game started')`.

In `src/pages/Teams.tsx`, add `import { useToast } from '../components/feedback'`; after `const now = useNow(60_000)` add `const toast = useToast()`; after `await api.setTeamBoard(...)` add `toast('Teams saved')`.

In `src/pages/Vote.tsx`, add `import { useToast } from '../components/feedback'`; in `VoteForm`, after the `error` state add `const toast = useToast()`; after `await api.submitVotes(match.id, list, mvp)` add `toast('Votes saved')`.

- [ ] **Step 12: Checkpoint**

Run: `grep -rn "window.confirm" src`
Expected: nothing.

Run: `npx tsc -b && npm run lint && npm test && npm run build`
Expected: all pass.

---

## Part B — The player card

### Task 3: The card in the database (file 7) and the demo cards

**Files:**
- Create: `supabase/migrations/20261025000300_player_card.sql`
- Test: `tests/db/card.test.ts`
- Modify: `supabase/seed.sql` (the header, and after the `happy_in_goal` update), `tests/db/seed.test.ts`

**Interfaces:**
- Produces (SQL): `players.shirt_number` (1-99), `strong_foot` (`right | left | both`), `favourite_position` (`goal | defence | midfield | attack | anywhere`), `motto` (1-60 characters), `skill_shooting`, `skill_passing`, `skill_dribbling`, `skill_defending`, `skill_fitness` (1-10, all five or none). All nullable; `update` granted to `authenticated` on these nine columns.

- [ ] **Step 1: Write the failing tests**

Create `tests/db/card.test.ts`:

```ts
// The player card (file 7, supabase/migrations/20261025000300_player_card.sql)
// and the rating settings admins now change in the app (no database change).
import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { createDb, runMigrations, selectAs, setupGroup } from './helpers'

const FILE_7 = '20261025000300_player_card.sql'
const SKILLS = 'skill_shooting = 8, skill_passing = 7, skill_dribbling = 8, skill_defending = 6, skill_fitness = 9'
let db: PGlite

beforeAll(async () => {
  db = await createDb()
})

afterAll(async () => {
  await db.close()
})

type Card = {
  shirt_number: number | null
  strong_foot: string | null
  favourite_position: string | null
  motto: string | null
  skill_shooting: number | null
  skill_fitness: number | null
}

async function card(userId: string, playerId: string): Promise<Card> {
  const [row] = await selectAs<Card>(
    db, userId,
    `select shirt_number, strong_foot, favourite_position, motto, skill_shooting, skill_fitness from players where id = $1`,
    [playerId],
  )
  return row
}

const EMPTY: Card = {
  shirt_number: null, strong_foot: null, favourite_position: null, motto: null, skill_shooting: null, skill_fitness: null,
}

it('a new player has an empty card', async () => {
  const { users, pid } = await setupGroup(db)
  expect(await card(users.Omar, pid(users.Omar))).toEqual(EMPTY)
})

it('players fill in their own card, an Arabic motto included, and the group sees it', async () => {
  const { users, pid } = await setupGroup(db)
  await selectAs(
    db, users.Omar,
    `update players set shirt_number = 10, strong_foot = 'left', favourite_position = 'attack', motto = 'يلا بينا', ${SKILLS}
     where id = $1`,
    [pid(users.Omar)],
  )
  expect(await card(users.Ziad, pid(users.Omar))).toEqual({
    shirt_number: 10, strong_foot: 'left', favourite_position: 'attack', motto: 'يلا بينا', skill_shooting: 8, skill_fitness: 9,
  })
})

it("admins change anyone's card; a member changing someone else's changes nothing", async () => {
  const { users, pid } = await setupGroup(db)
  await selectAs(db, users.admin, `update players set shirt_number = 1 where id = $1`, [pid(users.Ziad)])
  expect((await card(users.Ziad, pid(users.Ziad))).shirt_number).toBe(1)

  // The row rule (file 1) only lets members update themselves, so this matches no rows.
  await selectAs(db, users.Omar, `update players set shirt_number = 99 where id = $1`, [pid(users.Ziad)])
  expect((await card(users.Ziad, pid(users.Ziad))).shirt_number).toBe(1)
})

it('numbers, feet, positions, mottos and skills stay in range', async () => {
  const { users, pid } = await setupGroup(db)
  const me = pid(users.Omar)
  const bad: [string, RegExp][] = [
    ['shirt_number = 0', /players_shirt_number_check/],
    ['shirt_number = 100', /players_shirt_number_check/],
    [`strong_foot = 'head'`, /players_strong_foot_check/],
    [`favourite_position = 'striker'`, /players_favourite_position_check/],
    [`motto = ''`, /players_motto_check/],
    [`motto = repeat('a', 61)`, /players_motto_check/],
    [SKILLS.replace('skill_shooting = 8', 'skill_shooting = 0'), /players_skill_shooting_check/],
    [SKILLS.replace('skill_fitness = 9', 'skill_fitness = 11'), /players_skill_fitness_check/],
  ]
  for (const [set, error] of bad) {
    await expect(selectAs(db, users.Omar, `update players set ${set} where id = $1`, [me])).rejects.toThrow(error)
  }
  expect(await card(users.Omar, me)).toEqual(EMPTY)
})

it('the skills are all five or none', async () => {
  const { users, pid } = await setupGroup(db)
  const me = pid(users.Omar)
  await expect(
    selectAs(db, users.Omar, `update players set skill_shooting = 8 where id = $1`, [me]),
  ).rejects.toThrow(/players_skills_all_or_none/)
  await selectAs(db, users.Omar, `update players set ${SKILLS} where id = $1`, [me])
  // Clearing all five is fine.
  await selectAs(
    db, users.Omar,
    `update players set skill_shooting = null, skill_passing = null, skill_dribbling = null, skill_defending = null,
     skill_fitness = null where id = $1`,
    [me],
  )
  expect((await card(users.Omar, me)).skill_shooting).toBeNull()
})

it('the rest of a player stays locked', async () => {
  const { users, pid } = await setupGroup(db)
  for (const set of ['user_id = null', 'group_id = gen_random_uuid()', 'is_guest = true']) {
    await expect(
      selectAs(db, users.Omar, `update players set ${set} where id = $1`, [pid(users.Omar)]),
    ).rejects.toThrow(/permission denied/)
  }
})

it('signed-out visitors cannot read cards', async () => {
  await db.exec('set role anon')
  try {
    await expect(db.query('select motto from public.players')).rejects.toThrow(/permission denied/)
  } finally {
    await db.exec('reset role')
  }
})

it('players from before this file get an empty card, as on the live project', async () => {
  const old = await createDb({ before: FILE_7 })
  try {
    const { rows } = await old.query<{ id: string }>(`insert into groups (name) values ('Old group') returning id`)
    await old.query(`insert into players (group_id, display_name) values ($1, 'Old player')`, [rows[0].id])
    await runMigrations(old, (file) => file >= FILE_7)
    const after = await old.query(`select shirt_number, strong_foot, favourite_position, motto, skill_shooting, skill_fitness from players`)
    expect(after.rows).toEqual([EMPTY])
  } finally {
    await old.close()
  }
})

// Rating settings (Plans/Player-card-and-motion.md section 4): already allowed by file 3.
type Settings = { w_analytics: string; w_votes: string; min_votes: number; min_matches_for_leaderboard: number; voting_hours: number }

async function settings(userId: string, groupId: string): Promise<Settings> {
  const [row] = await selectAs<Settings>(
    db, userId,
    `select w_analytics::text, w_votes::text, min_votes, min_matches_for_leaderboard, voting_hours
     from rating_config where group_id = $1`,
    [groupId],
  )
  return row
}

it('admins change the rating settings; a member trying to changes nothing', async () => {
  const { groupId, users } = await setupGroup(db)
  await selectAs(
    db, users.admin,
    `update rating_config set w_analytics = 0.6, w_votes = 0.4, min_votes = 3, min_matches_for_leaderboard = 4,
     voting_hours = 48 where group_id = $1`,
    [groupId],
  )
  expect(await settings(users.Omar, groupId)).toEqual({
    w_analytics: '0.6', w_votes: '0.4', min_votes: 3, min_matches_for_leaderboard: 4, voting_hours: 48,
  })

  await selectAs(db, users.Omar, `update rating_config set voting_hours = 6 where group_id = $1`, [groupId])
  expect((await settings(users.Omar, groupId)).voting_hours).toBe(48)
})

it('the two weights must still add up to 1', async () => {
  const { groupId, users } = await setupGroup(db)
  await expect(
    selectAs(db, users.admin, `update rating_config set w_analytics = 0.7 where group_id = $1`, [groupId]),
  ).rejects.toThrow(/check constraint/)
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/db/card.test.ts`
Expected: the card tests FAIL (`column "shirt_number" does not exist`, and `createDb({ before: FILE_7 })` runs every file); the two rating-settings tests PASS already.

- [ ] **Step 3: Write file 7**

Create `supabase/migrations/20261025000300_player_card.sql`:

```sql
-- =============================================================================
-- 7GZ-KORA: the player card (file 7 of 7)
--
-- Every player can fill in a card about themselves
-- (Plans/Player-card-and-motion.md): a shirt number, their strong foot, a
-- favourite position (for show only: teams have no fixed positions), a short
-- motto, and a self-rating from 1 to 10 on five skills. The app shows the
-- card on the profile, compares the self-rating with friends' votes, and uses
-- it as a new player's starting strength in the team suggester. It never
-- changes a night's rating: compute_match_ratings doesn't read it.
--
-- Files 1 to 6 already run on the live project, so this file only adds to
-- them. Run it once, in the SQL Editor. It can run at any time, even during
-- a night.
-- =============================================================================

alter table public.players
  add column shirt_number smallint
    constraint players_shirt_number_check check (shirt_number between 1 and 99),
  add column strong_foot text
    constraint players_strong_foot_check check (strong_foot in ('right', 'left', 'both')),
  add column favourite_position text
    constraint players_favourite_position_check
      check (favourite_position in ('goal', 'defence', 'midfield', 'attack', 'anywhere')),
  add column motto text
    constraint players_motto_check check (char_length(motto) between 1 and 60),
  add column skill_shooting smallint
    constraint players_skill_shooting_check check (skill_shooting between 1 and 10),
  add column skill_passing smallint
    constraint players_skill_passing_check check (skill_passing between 1 and 10),
  add column skill_dribbling smallint
    constraint players_skill_dribbling_check check (skill_dribbling between 1 and 10),
  add column skill_defending smallint
    constraint players_skill_defending_check check (skill_defending between 1 and 10),
  add column skill_fitness smallint
    constraint players_skill_fitness_check check (skill_fitness between 1 and 10),
  -- The self-rating is the average of all five, so it's all five or none.
  add constraint players_skills_all_or_none check (
    num_nulls(skill_shooting, skill_passing, skill_dribbling, skill_defending, skill_fitness) in (0, 5)
  );

-- Players change their own card and admins anyone's, under the same row rule
-- as the name (file 1, "rename yourself, or anyone if admin"). The new
-- columns keep the table's read permissions (file 3): the group can read
-- them, signed-out visitors can't. Nothing else about a player becomes
-- changeable.
grant update (shirt_number, strong_foot, favourite_position, motto,
              skill_shooting, skill_passing, skill_dribbling, skill_defending, skill_fitness)
  on public.players to authenticated;
```

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run tests/db/card.test.ts`
Expected: 10 PASS.

- [ ] **Step 5: Demo cards**

In `supabase/seed.sql`, change the header line `-- Run it AFTER the 6 migration files, ideally in a separate test project.` to `-- Run it AFTER the 7 migration files, ideally in a separate test project.`, and add to the header, after the line about Demo FC making Team C:

```sql
-- Most players have filled in their player card (Hany hasn't yet).
```

After `update public.players set happy_in_goal = true where id in (v_players[10], v_players[12]);` add:

```sql
  -- Player cards (Plans/Player-card-and-motion.md): numbers, feet, favourite
  -- positions, mottos and self-ratings (shooting, passing, dribbling,
  -- defending, fitness). Hany's (15) is still empty.
  update public.players p
  set shirt_number = c.shirt, strong_foot = c.foot, favourite_position = c.pos, motto = c.motto,
      skill_shooting = c.s[1], skill_passing = c.s[2], skill_dribbling = c.s[3],
      skill_defending = c.s[4], skill_fitness = c.s[5]
  from (values
    (1,  10,   'right', 'attack',   'Pass it to me',         array[8, 7, 8, 6, 9]),
    (2,  7,    'left',  'midfield', null,                    array[9, 9, 9, 8, 9]),
    (3,  4,    'right', 'defence',  'Pay up after the game', array[5, 6, 5, 8, 7]),
    (4,  9,    'right', 'attack',   null,                    array[8, 6, 7, 5, 7]),
    (5,  8,    'both',  'midfield', 'Run, then run more',    array[6, 7, 6, 7, 9]),
    (6,  11,   'left',  'attack',   null,                    array[7, 6, 8, 4, 6]),
    (7,  5,    'right', 'defence',  null,                    array[4, 5, 4, 7, 6]),
    (8,  17,   'right', 'anywhere', 'Sorry I''m late',       array[6, 6, 6, 6, 6]),
    (9,  14,   'right', 'midfield', 'يلا بينا',              array[7, 8, 7, 6, 7]),
    (10, 1,    'right', 'goal',     'Nothing gets past me',  array[3, 5, 3, 7, 6]),
    (11, 6,    'left',  'defence',  null,                    array[5, 6, 5, 7, 7]),
    (12, 23,   'both',  'goal',     null,                    array[4, 5, 4, 6, 6]),
    (13, 19,   'right', 'attack',   null,                    array[7, 6, 7, 5, 8]),
    (14, null, null,    'anywhere', null,                    array[6, 6, 6, 6, 6])
  ) as c(n, shirt, foot, pos, motto, s)
  where p.id = v_players[c.n];
```

In `tests/db/seed.test.ts`, add at the end:

```ts
it('gives every demo player but Hany a player card', async () => {
  const rows = await selectAs<{ display_name: string; skill_shooting: number | null }>(
    db, owner, `select display_name, skill_shooting from players where group_id = $1`, [groupId],
  )
  // Owner has just joined, so their card is empty too.
  expect(rows.filter((r) => r.skill_shooting === null).map((r) => r.display_name).sort()).toEqual(['Hany', 'Owner'])
})
```

- [ ] **Step 6: Checkpoint**

Run: `npm test`
Expected: all pass (the 10 new card tests and the new seed test included).

---

### Task 4: Card logic, types and API

**Files:**
- Create: `src/lib/card.ts`, `src/lib/card.test.ts`
- Modify: `src/lib/types.ts` (card types; `Player`), `src/lib/api.ts` (`getPlayers`, `saveCard`)

**Interfaces:**
- Consumes: the file 7 columns (Task 3).
- Produces (types): `Foot = 'right' | 'left' | 'both'`; `Position = 'goal' | 'defence' | 'midfield' | 'attack' | 'anywhere'`; `interface Skills { skill_shooting, skill_passing, skill_dribbling, skill_defending, skill_fitness: number | null }`; `interface CardFields extends Skills { shirt_number: number | null; strong_foot: Foot | null; favourite_position: Position | null; motto: string | null }`; `Player extends CardFields`.
- Produces (card.ts): `SKILLS: { key: keyof Skills; label: string }[]`; `FEET: { value: Foot; label: string; chip: string }[]`; `POSITIONS: { value: Position; label: string }[]`; `skillsState(skills: Skills): 'all' | 'none' | 'some'`; `selfRating(skills: Skills): number | null`; `isCardFilled(card: CardFields): boolean`; `cleanCard<T extends CardFields>(card: T): T`; `type Confidence = 'modest' | 'spot_on' | 'confident' | 'very_confident'`; `CONFIDENCE: Record<Confidence, { label: string; note: string }>`; `confidence(self: number, friends: number): { gap: number; level: Confidence }`; `type FriendsScore = { kind: 'score'; score: number; season: boolean } | { kind: 'wait'; nightsToGo: number } | { kind: 'no_votes' }`; `friendsScore(season?: LeaderboardRow, allTime?: LeaderboardRow, minNights: number): FriendsScore`.
- Produces (api.ts): `saveCard(playerId: string, card: CardFields & Pick<Player, 'display_name' | 'happy_in_goal'>): Promise<void>`.

- [ ] **Step 1: The types**

In `src/lib/types.ts`, add before `export interface Player`:

```ts
/** Strong foot, on the player card. */
export type Foot = 'right' | 'left' | 'both'
/** Favourite position, on the player card: for show only (teams have no fixed positions). */
export type Position = 'goal' | 'defence' | 'midfield' | 'attack' | 'anywhere'

/** The self-rating: 1-10 on each skill, all five or none (players_skills_all_or_none). */
export interface Skills {
  skill_shooting: number | null
  skill_passing: number | null
  skill_dribbling: number | null
  skill_defending: number | null
  skill_fitness: number | null
}

/** The player card (Plans/Player-card-and-motion.md section 1). Every field is optional. */
export interface CardFields extends Skills {
  shirt_number: number | null
  strong_foot: Foot | null
  favourite_position: Position | null
  motto: string | null
}
```

and change `export interface Player {` to `export interface Player extends CardFields {`.

- [ ] **Step 2: Write the failing tests**

Create `src/lib/card.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { cleanCard, confidence, friendsScore, isCardFilled, selfRating, skillsState } from './card'
import type { CardFields, LeaderboardRow, Skills } from './types'

const skills = (values: (number | null)[]): Skills => ({
  skill_shooting: values[0],
  skill_passing: values[1],
  skill_dribbling: values[2],
  skill_defending: values[3],
  skill_fitness: values[4],
})

const emptyCard: CardFields = {
  ...skills([null, null, null, null, null]),
  shirt_number: null,
  strong_foot: null,
  favourite_position: null,
  motto: null,
}

describe('self-rating', () => {
  it('is the average of the five skills: 8, 7, 8, 6, 9 → 7.6', () => {
    expect(selfRating(skills([8, 7, 8, 6, 9]))).toBe(7.6)
  })

  it('is rounded to one decimal', () => {
    expect(selfRating(skills([7, 7, 7, 7, 8]))).toBe(7.2)
  })

  it('needs all five skills', () => {
    expect(selfRating(skills([null, null, null, null, null]))).toBeNull()
    expect(selfRating(skills([8, null, 8, 6, 9]))).toBeNull()
    expect(skillsState(skills([8, 7, 8, 6, 9]))).toBe('all')
    expect(skillsState(skills([8, null, 8, 6, 9]))).toBe('some')
    expect(skillsState(skills([null, null, null, null, null]))).toBe('none')
  })
})

describe('self vs friends', () => {
  it('self 7.6, friends 6.4: +1.2, confident', () => {
    expect(confidence(7.6, 6.4)).toEqual({ gap: 1.2, level: 'confident' })
  })

  it('self 6.0, friends 7.3: −1.3, modest', () => {
    expect(confidence(6, 7.3)).toEqual({ gap: -1.3, level: 'modest' })
  })

  it('self 7.0, friends 7.4: −0.4, spot on', () => {
    expect(confidence(7, 7.4)).toEqual({ gap: -0.4, level: 'spot_on' })
  })

  it('self 9.0, friends 6.4: +2.6, very confident', () => {
    expect(confidence(9, 6.4)).toEqual({ gap: 2.6, level: 'very_confident' })
  })

  it('the edges: −1.0 is modest, +1.0 confident, +2.0 very confident', () => {
    expect(confidence(5.4, 6.4).level).toBe('modest')
    expect(confidence(7.4, 6.4).level).toBe('confident')
    expect(confidence(8.4, 6.4).level).toBe('very_confident')
  })
})

/** A table row with `matches` rated nights; ranked from 3 nights, as by default. */
const row = (matches: number, avgVotes: number | null): LeaderboardRow => ({
  player_id: 'p',
  display_name: 'P',
  matches,
  avg_rating: 6.5,
  avg_rating_exact: 6.5,
  goals: 0,
  assists: 0,
  mvps: 0,
  clean_sheets: 0,
  avg_votes: avgVotes,
  qualified: matches >= 3,
  avg_minutes: 30,
  minutes_in_goal: 0,
})

describe("friends' score", () => {
  it("this season's, once there are 3 rated nights this season", () => {
    expect(friendsScore(row(3, 6.4), row(10, 7.1), 3)).toEqual({ kind: 'score', score: 6.4, season: true })
  })

  it('otherwise all-time, with the same rule', () => {
    expect(friendsScore(row(1, 8), row(5, 7.1), 3)).toEqual({ kind: 'score', score: 7.1, season: false })
    expect(friendsScore(undefined, row(5, 7.1), 3)).toEqual({ kind: 'score', score: 7.1, season: false })
  })

  it('otherwise how many more rated nights are needed', () => {
    expect(friendsScore(row(1, 8), row(1, 8), 3)).toEqual({ kind: 'wait', nightsToGo: 2 })
    expect(friendsScore(undefined, undefined, 3)).toEqual({ kind: 'wait', nightsToGo: 3 })
  })

  it('with no vote average (all "didn\'t see", or stats only): not enough votes yet', () => {
    expect(friendsScore(row(4, null), row(4, null), 3)).toEqual({ kind: 'no_votes' })
  })
})

describe('the card', () => {
  it('counts as filled in with the skills or any other field', () => {
    expect(isCardFilled(emptyCard)).toBe(false)
    expect(isCardFilled({ ...emptyCard, shirt_number: 10 })).toBe(true)
    expect(isCardFilled({ ...emptyCard, ...skills([8, 7, 8, 6, 9]) })).toBe(true)
  })

  it('saves the motto trimmed, and an empty one as none', () => {
    expect(cleanCard({ ...emptyCard, motto: '  Pass it to me ' }).motto).toBe('Pass it to me')
    expect(cleanCard({ ...emptyCard, motto: '   ' }).motto).toBeNull()
  })
})
```

- [ ] **Step 3: Run them to see them fail**

Run: `npx vitest run src/lib/card.test.ts`
Expected: FAIL (`Failed to resolve import "./card"`).

- [ ] **Step 4: Write card.ts**

Create `src/lib/card.ts`:

```ts
// The player card (Plans/Player-card-and-motion.md): the self-rating from
// five skills, and how it compares with what friends give. Pure functions,
// tested in card.test.ts. Nothing here changes a night's rating.
import type { CardFields, Foot, LeaderboardRow, Position, Skills } from './types'

export const SKILLS: { key: keyof Skills; label: string }[] = [
  { key: 'skill_shooting', label: 'Shooting' },
  { key: 'skill_passing', label: 'Passing' },
  { key: 'skill_dribbling', label: 'Dribbling' },
  { key: 'skill_defending', label: 'Defending' },
  { key: 'skill_fitness', label: 'Fitness' },
]

/** label: in the picker. chip: on the card. */
export const FEET: { value: Foot; label: string; chip: string }[] = [
  { value: 'right', label: 'Right', chip: 'Right foot' },
  { value: 'left', label: 'Left', chip: 'Left foot' },
  { value: 'both', label: 'Both', chip: 'Both feet' },
]

export const POSITIONS: { value: Position; label: string }[] = [
  { value: 'goal', label: 'Goal' },
  { value: 'defence', label: 'Defence' },
  { value: 'midfield', label: 'Midfield' },
  { value: 'attack', label: 'Attack' },
  { value: 'anywhere', label: 'Anywhere' },
]

/** "all": a self-rating. "none": no self-rating. "some": can't be saved yet. */
export function skillsState(skills: Skills): 'all' | 'none' | 'some' {
  const set = SKILLS.filter((s) => skills[s.key] != null).length
  return set === SKILLS.length ? 'all' : set === 0 ? 'none' : 'some'
}

/** The average of the five skills, to one decimal; null unless all five are set. */
export function selfRating(skills: Skills): number | null {
  if (skillsState(skills) !== 'all') return null
  const total = SKILLS.reduce((sum, s) => sum + (skills[s.key] ?? 0), 0)
  return Math.round((total / SKILLS.length) * 10) / 10
}

/** A card counts as filled in once it has the skills or any other field. */
export function isCardFilled(card: CardFields): boolean {
  return (
    skillsState(card) !== 'none' ||
    card.shirt_number != null ||
    card.strong_foot != null ||
    card.favourite_position != null ||
    card.motto != null
  )
}

/** The card as it's saved: the motto trimmed, and an empty one as none. */
export function cleanCard<T extends CardFields>(card: T): T {
  const motto = card.motto?.trim() ?? ''
  return { ...card, motto: motto === '' ? null : motto }
}

export type Confidence = 'modest' | 'spot_on' | 'confident' | 'very_confident'

export const CONFIDENCE: Record<Confidence, { label: string; note: string }> = {
  modest: { label: 'Modest', note: "Friends' votes are higher than the self-rating." },
  spot_on: { label: 'Spot on', note: "The self-rating matches friends' votes." },
  confident: { label: 'Confident', note: "The self-rating is a bit above friends' votes." },
  very_confident: { label: 'Very confident', note: "The self-rating is well above friends' votes." },
}

/** The meter's edges: a gap of −1.0 or less is modest, +1.0 or more confident, +2.0 or more very confident. */
export const MODEST_GAP = -1
export const CONFIDENT_GAP = 1
export const VERY_CONFIDENT_GAP = 2

/** The self-rating minus friends' score, to one decimal, and what it means. */
export function confidence(self: number, friends: number): { gap: number; level: Confidence } {
  const gap = Math.round((self - friends) * 10) / 10
  const level: Confidence =
    gap <= MODEST_GAP
      ? 'modest'
      : gap >= VERY_CONFIDENT_GAP
        ? 'very_confident'
        : gap >= CONFIDENT_GAP
          ? 'confident'
          : 'spot_on'
  return { gap, level }
}

export type FriendsScore =
  | { kind: 'score'; score: number; season: boolean }
  | { kind: 'wait'; nightsToGo: number }
  | { kind: 'no_votes' }

/**
 * What friends give: the average of the night-by-night peer vote averages
 * (avg_votes on the table). This season's once the player is ranked this
 * season (enough rated nights), otherwise all-time with the same rule.
 */
export function friendsScore(
  season: LeaderboardRow | undefined,
  allTime: LeaderboardRow | undefined,
  minNights: number,
): FriendsScore {
  const row = season?.qualified ? season : allTime?.qualified ? allTime : undefined
  if (!row) return { kind: 'wait', nightsToGo: Math.max(1, minNights - (allTime?.matches ?? 0)) }
  if (row.avg_votes == null) return { kind: 'no_votes' }
  return { kind: 'score', score: Number(row.avg_votes), season: row === season }
}
```

- [ ] **Step 5: Run them to see them pass**

Run: `npx vitest run src/lib/card.test.ts`
Expected: 14 PASS.

- [ ] **Step 6: The API**

In `src/lib/api.ts`, add `CardFields` to the type imports, and replace `getPlayers` with:

```ts
/** Everything the app reads about a player, the player card included. */
const PLAYER_COLUMNS = [
  'id, group_id, user_id, display_name, is_guest, happy_in_goal',
  'shirt_number, strong_foot, favourite_position, motto',
  'skill_shooting, skill_passing, skill_dribbling, skill_defending, skill_fitness',
].join(', ')

export async function getPlayers(groupId: string): Promise<Player[]> {
  const rows = unwrap<(Omit<Player, 'avatar_url'> & { profiles: { avatar_url: string | null } | null })[]>(
    await supabase
      .from('players')
      .select(`${PLAYER_COLUMNS}, profiles!players_user_id_fkey(avatar_url)`)
      .eq('group_id', groupId)
      .order('display_name'),
  )
  return rows.map(({ profiles, ...p }) => ({ ...p, avatar_url: profiles?.avatar_url ?? null }))
}
```

Add after it:

```ts
/** The player card with the name and "happy in goal", in one go: yourself, or anyone if you're an admin. */
export async function saveCard(playerId: string, card: CardFields & Pick<Player, 'display_name' | 'happy_in_goal'>) {
  unwrap(await supabase.from('players').update(card).eq('id', playerId))
}
```

(`renamePlayer` and `setHappyInGoal` stay until Task 5 removes their last user.)

- [ ] **Step 7: Checkpoint**

Run: `npx tsc -b && npm run lint && npm test`
Expected: all pass.

---

### Task 5: The player card and Edit my card

**Files:**
- Create: `src/components/card.tsx`, `src/components/cardform.tsx`, `src/pages/EditCard.tsx`
- Modify: `src/components/ui.tsx` (`RatingBadge` takes `className`; new `Toggle` and `ScoreButton`), `src/App.tsx` (route), `src/pages/PlayerProfile.tsx` (the header becomes the card; the name form and the goal switch go), `src/lib/api.ts` (remove `renamePlayer`, `setHappyInGoal`)

**Interfaces:**
- Consumes: `SKILLS`, `FEET`, `POSITIONS`, `skillsState`, `selfRating`, `cleanCard` (Task 4); `saveCard` (Task 4); `spring` (Task 1); `useToast` (Task 2).
- Produces: `PlayerCard({ player: Player; rating?: { value: number; label: string } | null; role?: string; isMe?: boolean; preview?: boolean })`; `ShirtField`, `FootField`, `PositionField`, `MottoField` (`{ value, onChange }`) and `SkillsField({ skills, onChange })`, where `onChange: (changes: Partial<CardFields>) => void`; `Toggle({ checked, onChange, label, hint?, icon? })`; `ScoreButton({ n, selected, onClick })`; `RatingBadge({ value, size?, className? })`.

- [ ] **Step 1: Shared pieces in ui.tsx**

In `src/components/ui.tsx`, add the imports:

```tsx
import * as m from 'motion/react-m'
import { spring } from '../lib/motion'
```

Replace `RatingBadge` with:

```tsx
export function RatingBadge({
  value,
  size = 'md',
  className = '',
}: {
  value: number | null | undefined
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const sizes = {
    sm: 'h-6 min-w-9 text-base rounded-md',
    md: 'h-8 min-w-[46px] text-xl rounded-[10px]',
    lg: 'h-14 min-w-18 text-4xl rounded-xl',
  }
  return (
    <span
      className={`tabular inline-flex items-center justify-center px-1.5 font-display ${sizes[size]} ${ratingTone(value)} ${className}`}
    >
      {value == null ? '–' : Number(value).toFixed(1)}
    </span>
  )
}
```

Add at the end of the file:

```tsx
/** An on/off switch row, like "Happy to play in goal". The knob springs across. */
export function Toggle({
  checked,
  onChange,
  label,
  hint,
  icon,
}: {
  checked: boolean
  onChange: (on: boolean) => void
  label: string
  hint?: string
  icon?: ReactNode
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-14 w-full items-center gap-3 rounded-card border-[1.5px] border-line bg-paper px-4 py-2 text-left"
    >
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
      <span
        aria-hidden
        className={`flex h-7 w-12 shrink-0 rounded-full border-2 border-ink p-0.5 ${checked ? 'justify-end bg-brand' : 'justify-start bg-line'}`}
      >
        <m.span layout transition={spring} className={`block size-5 rounded-full ${checked ? 'bg-[#0b0b0b]' : 'bg-ink'}`} />
      </span>
    </button>
  )
}

/** One number of a 1-10 tap row (votes, skills): green with black text when chosen, and it pops. */
export function ScoreButton({ n, selected, onClick }: { n: number; selected: boolean; onClick: () => void }) {
  return (
    <m.button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      whileTap={{ scale: 0.9 }}
      animate={{ scale: selected ? [1, 1.15, 1] : 1 }}
      transition={{ duration: 0.25 }}
      className={`tabular h-[42px] rounded-[10px] border-[1.5px] font-display text-xl ${
        selected ? 'border-[#0b0b0b] bg-brand text-on-brand' : 'border-transparent bg-ground text-ink'
      }`}
    >
      {n}
    </m.button>
  )
}
```

- [ ] **Step 2: The card**

Create `src/components/card.tsx`:

```tsx
// The player card (Plans/Player-card-and-motion.md section 1): a sticker in
// the 7GZ-KORA look with the rating, the shirt number, the position, foot and
// motto, and the self-rated skills.
import * as m from 'motion/react-m'
import { FEET, POSITIONS, SKILLS, selfRating, skillsState } from '../lib/card'
import type { Player } from '../lib/types'
import { GloveIcon } from './icons'
import { Avatar, Heading, Name, RatingBadge } from './ui'

/**
 * rating: the badge in the green band (this season's, else all-time) with its
 * label; null shows "New"; undefined (while loading, or a preview) shows none.
 * preview: Edit my card and the Welcome steps (the name isn't the page's heading).
 */
export function PlayerCard({
  player,
  rating,
  role,
  isMe = false,
  preview = false,
}: {
  player: Player
  rating?: { value: number; label: string } | null
  /** A line under the name, like "You · Admin". */
  role?: string
  isMe?: boolean
  preview?: boolean
}) {
  const foot = FEET.find((f) => f.value === player.strong_foot)
  const position = POSITIONS.find((p) => p.value === player.favourite_position)
  const Title = preview ? 'h2' : 'h1'
  return (
    <m.article
      initial={{ opacity: 0, y: 16, rotate: -2 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      className="overflow-hidden rounded-card border-2 border-ink bg-paper"
    >
      {/* A green surface, so its text is black. */}
      <div className="honeycomb flex min-h-[88px] items-start justify-between gap-3 px-4 pt-4 pb-3 text-on-brand">
        <div>
          {rating === null && <span className="chip bg-[#ffffff]">New</span>}
          {rating && (
            <>
              <RatingBadge value={rating.value} size="lg" className="border-2 border-[#0b0b0b]" />
              <p className="mt-1 text-[11.5px] font-bold tracking-[0.12em] uppercase opacity-75">{rating.label}</p>
            </>
          )}
        </div>
        {player.shirt_number != null && (
          <p className="font-display text-[56px] leading-none" aria-label={`Shirt number ${player.shirt_number}`}>
            {player.shirt_number}
          </p>
        )}
      </div>

      <div className="p-4">
        <div className="flex items-center gap-3">
          <Avatar name={player.display_name} url={player.avatar_url} size={56} />
          <div className="min-w-0">
            <Title className="font-display text-[28px] leading-tight">
              <Name>{player.display_name}</Name>
            </Title>
            {role && <p className="text-sm text-muted">{role}</p>}
          </div>
        </div>

        {(position || foot || player.happy_in_goal) && (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {position && <li className="chip status">{position.label}</li>}
            {foot && <li className="chip status">{foot.chip}</li>}
            {player.happy_in_goal && (
              <li className="chip status">
                <GloveIcon size={14} /> Happy in goal
              </li>
            )}
          </ul>
        )}
        {player.motto && (
          <p className="mt-3 text-lg font-semibold">
            “<Name>{player.motto}</Name>”
          </p>
        )}
        <SkillBars player={player} isMe={isMe} />
      </div>
    </m.article>
  )
}

/** The skills as bars on a 1-10 scale; the self-rating (their average) once all five are set. */
function SkillBars({ player, isMe }: { player: Player; isMe: boolean }) {
  if (skillsState(player) === 'none') return null
  const self = selfRating(player)
  return (
    <div className="mt-4">
      <div className="flex items-baseline justify-between">
        <Heading>{isMe ? 'You rate yourself' : 'Rates themselves'}</Heading>
        {self != null && <span className="tabular font-display text-2xl">{self.toFixed(1)}</span>}
      </div>
      <ul className="mt-1.5 space-y-1.5">
        {SKILLS.map(({ key, label }) => {
          const value = player[key]
          return (
            <li key={key} className="flex items-center gap-2 text-sm">
              <span className="w-20 shrink-0 text-muted">{label}</span>
              <span aria-hidden className="h-2.5 flex-1 overflow-hidden rounded-full bg-line">
                <m.span
                  className="block h-full origin-left rounded-full bg-brand"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: (value ?? 0) / 10 }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                />
              </span>
              <span className="tabular w-6 text-right font-display">{value ?? '–'}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
```

- [ ] **Step 3: The card's fields**

Create `src/components/cardform.tsx`:

```tsx
// The fields of the player card, used by Edit my card and the Welcome steps.
// Tapping a chosen foot or position again clears it.
import * as m from 'motion/react-m'
import { FEET, POSITIONS, SKILLS } from '../lib/card'
import type { CardFields, Foot, Position, Skills } from '../lib/types'
import { ScoreButton } from './ui'

type Change = (changes: Partial<CardFields>) => void

/** Shirt number 1-99; empty (or 0) is none. */
export function ShirtField({ value, onChange }: { value: number | null; onChange: Change }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">Shirt number</span>
      <input
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={2}
        placeholder="None"
        value={value ?? ''}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').slice(0, 2)
          const n = Number(digits)
          onChange({ shirt_number: digits === '' || n === 0 ? null : n })
        }}
        className="tabular mt-1 block h-12 w-28 rounded-xl border-[1.5px] border-line bg-paper px-3 font-display text-2xl"
      />
    </label>
  )
}

export function FootField({ value, onChange }: { value: Foot | null; onChange: Change }) {
  return (
    <div>
      <p className="text-sm font-medium">Strong foot</p>
      <div className="seg mt-1" role="group" aria-label="Strong foot">
        {FEET.map((f) => (
          <button
            key={f.value}
            type="button"
            aria-pressed={value === f.value}
            className={`px-4 font-sans text-sm font-bold ${value === f.value ? 'sel' : ''}`}
            onClick={() => onChange({ strong_foot: value === f.value ? null : f.value })}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function PositionField({ value, onChange }: { value: Position | null; onChange: Change }) {
  return (
    <div>
      <p className="text-sm font-medium">
        Favourite position <span className="font-normal text-muted">(for show: teams have no fixed positions)</span>
      </p>
      <div className="mt-1 flex flex-wrap gap-2" role="group" aria-label="Favourite position">
        {POSITIONS.map((p) => (
          <m.button
            key={p.value}
            type="button"
            whileTap={{ scale: 0.94 }}
            aria-pressed={value === p.value}
            onClick={() => onChange({ favourite_position: value === p.value ? null : p.value })}
            className={`min-h-12 rounded-full border-2 px-4 font-semibold ${
              value === p.value ? 'border-[#0b0b0b] bg-brand text-on-brand' : 'border-line bg-paper text-ink'
            }`}
          >
            {p.label}
          </m.button>
        ))}
      </div>
    </div>
  )
}

export function MottoField({ value, onChange }: { value: string | null; onChange: Change }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">Motto</span>
      <input
        value={value ?? ''}
        maxLength={60}
        dir="auto"
        placeholder="Pass it to me"
        onChange={(e) => onChange({ motto: e.target.value })}
        className="mt-1 h-12 w-full rounded-xl border-[1.5px] border-line bg-paper px-3 text-base"
      />
      <span className="mt-1 block text-xs text-muted">Up to 60 characters. Arabic is fine.</span>
    </label>
  )
}

/** Rate yourself: 1-10 on each skill, in the same tap rows as the vote screen. */
export function SkillsField({ skills, onChange }: { skills: Skills; onChange: Change }) {
  return (
    <ul className="space-y-3">
      {SKILLS.map(({ key, label }) => (
        <li key={key}>
          <p className="mb-1.5 flex items-baseline justify-between font-semibold">
            {label} <span className="tabular font-display text-lg">{skills[key] ?? '–'}</span>
          </p>
          <div className="grid grid-cols-5 gap-1.5" role="group" aria-label={label}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <ScoreButton
                key={n}
                n={n}
                selected={skills[key] === n}
                onClick={() => onChange({ [key]: n } as Partial<Skills>)}
              />
            ))}
          </div>
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 4: Edit my card**

Create `src/pages/EditCard.tsx`:

```tsx
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { PlayerCard } from '../components/card'
import { FootField, MottoField, PositionField, ShirtField, SkillsField } from '../components/cardform'
import { useToast } from '../components/feedback'
import { BackIcon, GloveIcon } from '../components/icons'
import { Button, Card, ErrorNote, Heading, PageTitle, Toggle } from '../components/ui'
import * as api from '../lib/api'
import { cleanCard, SKILLS, skillsState } from '../lib/card'
import { errorMessage } from '../lib/format'
import type { CardFields, Player, Skills } from '../lib/types'
import { useCurrentGroup } from '../state/group'

const input = 'mt-1 h-12 w-full rounded-xl border-[1.5px] border-line bg-paper px-3 text-base'

/** Everything Edit my card changes, saved together. */
type Draft = CardFields & Pick<Player, 'display_name' | 'happy_in_goal'>

const NO_SKILLS = Object.fromEntries(SKILLS.map((s) => [s.key, null])) as unknown as Skills

/** Edit my card (/players/:id/edit): the player themselves, or an admin. */
export default function EditCard() {
  const { id = '' } = useParams()
  const { player, myPlayerId, isAdmin } = useCurrentGroup()
  const p = player(id)
  if (!p) return <ErrorNote message="Player not found." />
  if (id !== myPlayerId && !isAdmin) return <ErrorNote message="Only this player or an admin can change this card." />
  return <CardEditor key={id} player={p} isMe={id === myPlayerId} />
}

function CardEditor({ player, isMe }: { player: Player; isMe: boolean }) {
  const navigate = useNavigate()
  const toast = useToast()
  const { refresh } = useCurrentGroup()
  const [draft, setDraft] = useState<Draft>(() => ({
    display_name: player.display_name,
    happy_in_goal: player.happy_in_goal,
    shirt_number: player.shirt_number,
    strong_foot: player.strong_foot,
    favourite_position: player.favourite_position,
    motto: player.motto,
    skill_shooting: player.skill_shooting,
    skill_passing: player.skill_passing,
    skill_dribbling: player.skill_dribbling,
    skill_defending: player.skill_defending,
    skill_fitness: player.skill_fitness,
  }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const change = (changes: Partial<Draft>) => setDraft((d) => ({ ...d, ...changes }))
  const skills = skillsState(draft)
  const back = `/players/${player.id}`

  async function save() {
    setBusy(true)
    setError(null)
    try {
      await api.saveCard(player.id, cleanCard({ ...draft, display_name: draft.display_name.trim() }))
      await refresh()
      toast('Card saved')
      navigate(back)
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <Link to={back} className="inline-flex items-center gap-1 text-sm font-semibold text-muted">
        <BackIcon size={18} /> Profile
      </Link>
      <PageTitle sub="Everyone in the group sees your card.">{isMe ? 'Edit my card' : 'Edit card'}</PageTitle>
      <PlayerCard player={{ ...player, ...draft }} isMe={isMe} preview />

      <Card className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium">Name in the group</span>
          <input
            className={input}
            value={draft.display_name}
            maxLength={40}
            required
            dir="auto"
            onChange={(e) => change({ display_name: e.target.value })}
          />
        </label>
        <ShirtField value={draft.shirt_number} onChange={change} />
        <FootField value={draft.strong_foot} onChange={change} />
        <PositionField value={draft.favourite_position} onChange={change} />
        <MottoField value={draft.motto} onChange={change} />
      </Card>

      <Card>
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <Heading>Rate yourself</Heading>
          {skills !== 'none' && (
            <button type="button" className="text-sm font-semibold text-brand-ink underline" onClick={() => change(NO_SKILLS)}>
              Clear
            </button>
          )}
        </div>
        <p className="mb-3 text-sm text-muted">
          1 to 10 on each. It never changes your night ratings. Until you've played a rated night it's your starting point
          in Suggest teams, and it shows next to what your friends give you.
        </p>
        <SkillsField skills={draft} onChange={change} />
      </Card>

      <Toggle
        checked={draft.happy_in_goal}
        onChange={(on) => change({ happy_in_goal: on })}
        label="Happy to play in goal"
        hint="Suggested first when a game needs a goalkeeper."
        icon={<GloveIcon size={22} className="shrink-0" />}
      />

      <ErrorNote message={error} />
      <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-10">
        {skills === 'some' && (
          <p className="mb-2 rounded-xl border-[1.5px] border-line bg-paper p-2 text-center text-sm font-semibold">
            Rate all five skills, or clear them.
          </p>
        )}
        <Button
          size="lg"
          className="w-full"
          busy={busy}
          disabled={!draft.display_name.trim() || skills === 'some'}
          onClick={() => void save()}
        >
          Save card
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: The route**

In `src/App.tsx`, add `import EditCard from './pages/EditCard'` (in name order) and, after the `players/:id` route:

```tsx
        <Route path="players/:id/edit" element={<EditCard />} />
```

- [ ] **Step 6: The profile shows the card**

In `src/pages/PlayerProfile.tsx` (the full portfolio comes in Task 8):
- Replace the header block (the `<div className="flex items-center gap-4">` with the avatar and name) and the two lines after it (`RenameForm` and `HappyInGoal`) with:

```tsx
      <PlayerCard
        player={p}
        rating={
          data?.season
            ? { value: data.season.avg_rating, label: `Season ${year}` }
            : data?.allTime
              ? { value: data.allTime.avg_rating, label: 'All-time' }
              : data
                ? null
                : undefined
        }
        role={[isMe ? 'You' : 'Player', role === 'admin' && 'Admin', !p.user_id && 'no account'].filter(Boolean).join(' · ')}
        isMe={isMe}
      />
      {(isMe || isAdmin) && (
        <LinkButton to={`/players/${id}/edit`} variant="secondary" className="w-full">
          {isMe ? 'Edit my card' : 'Edit card'}
        </LinkButton>
      )}
```

- Delete the `RenameForm` and `HappyInGoal` functions, add `import { PlayerCard } from '../components/card'`, and tidy the imports (`LinkButton` added; `useState` stays for `year`; remove `FormEvent`, `GloveIcon`, `Avatar`, `Button`, `Name`, `errorMessage` if no longer used; `tsc` lists them).
- In `src/lib/api.ts`, delete `renamePlayer` and `setHappyInGoal` (Edit my card saves both with `saveCard`).

- [ ] **Step 7: Checkpoint**

Run: `npx tsc -b && npm run lint && npm test && npm run build`
Expected: all pass.

---

### Task 6: Welcome after joining, and the Home reminder

**Files:**
- Create: `src/pages/Welcome.tsx`
- Modify: `src/App.tsx` (route), `src/pages/JoinOrCreate.tsx` (`done` goes to `/welcome`), `src/pages/Home.tsx` (`FinishCard`), `src/lib/storage.ts` (`KEYS.cardReminderHidden`)

**Interfaces:**
- Consumes: `PlayerCard`, the card fields (Task 5); `cleanCard`, `isCardFilled`, `skillsState` (Task 4); `saveCard` (Task 4); `useToast` (Task 2).
- Produces: route `/welcome`; `KEYS.cardReminderHidden = 'kora.cardReminderHidden'` (stored per player as `${KEYS.cardReminderHidden}.${playerId}` = `'1'`).

- [ ] **Step 1: The welcome steps**

Create `src/pages/Welcome.tsx`:

```tsx
import { AnimatePresence } from 'motion/react'
import * as m from 'motion/react-m'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { PlayerCard } from '../components/card'
import { FootField, MottoField, PositionField, ShirtField, SkillsField } from '../components/cardform'
import { useToast } from '../components/feedback'
import { Button, Card, ErrorNote, Name, PageTitle } from '../components/ui'
import * as api from '../lib/api'
import { cleanCard, isCardFilled, skillsState } from '../lib/card'
import { errorMessage } from '../lib/format'
import type { CardFields, Player } from '../lib/types'
import { useCurrentGroup } from '../state/group'

const STEPS = ['Your shirt', 'Rate yourself', 'Your card'] as const

/** What Skip clears on each step. */
const SKIPPED: Partial<CardFields>[] = [
  { shirt_number: null, strong_foot: null, favourite_position: null },
  { skill_shooting: null, skill_passing: null, skill_dribbling: null, skill_defending: null, skill_fitness: null },
  { motto: null },
]

/**
 * After joining or creating a group: three quick steps to fill in your
 * player card. Skip clears a step and moves on; Done saves everything at
 * once; Not now leaves without saving.
 */
export default function Welcome() {
  const { player, myPlayerId } = useCurrentGroup()
  const me = player(myPlayerId)
  if (!me) return <ErrorNote message="Player not found." />
  return <WelcomeSteps me={me} />
}

function WelcomeSteps({ me }: { me: Player }) {
  const navigate = useNavigate()
  const toast = useToast()
  const { group, refresh } = useCurrentGroup()
  const [step, setStep] = useState(0)
  const [card, setCard] = useState<CardFields>(() => ({
    shirt_number: me.shirt_number,
    strong_foot: me.strong_foot,
    favourite_position: me.favourite_position,
    motto: me.motto,
    skill_shooting: me.skill_shooting,
    skill_passing: me.skill_passing,
    skill_dribbling: me.skill_dribbling,
    skill_defending: me.skill_defending,
    skill_fitness: me.skill_fitness,
  }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const change = (changes: Partial<CardFields>) => setCard((c) => ({ ...c, ...changes }))
  const last = step === STEPS.length - 1
  const someSkills = step === 1 && skillsState(card) === 'some'

  async function done(finished: CardFields) {
    const cleaned = cleanCard(finished)
    if (!isCardFilled(cleaned)) {
      navigate('/')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await api.saveCard(me.id, { ...cleaned, display_name: me.display_name, happy_in_goal: me.happy_in_goal })
      await refresh()
      toast('Card saved. Welcome!')
      navigate('/')
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
    }
  }

  function next(skip: boolean) {
    const updated = skip ? { ...card, ...SKIPPED[step] } : card
    setCard(updated)
    if (last) void done(updated)
    else setStep(step + 1)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="sr-only">
          Step {step + 1} of {STEPS.length}: {STEPS[step]}
        </p>
        <div aria-hidden className="flex gap-1.5">
          {STEPS.map((s, i) => (
            <span key={s} className={`h-2 w-8 rounded-full ${i <= step ? 'bg-brand' : 'bg-line'}`} />
          ))}
        </div>
        <Link to="/" className="text-sm font-semibold text-muted underline">
          Not now
        </Link>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <m.div
          key={step}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.2 }}
          className="space-y-4"
        >
          {step === 0 && (
            <>
              <PageTitle
                sub={
                  <>
                    Welcome to <Name>{group.name}</Name>! Tell your friends a bit about how you play.
                  </>
                }
              >
                Your shirt
              </PageTitle>
              <Card className="space-y-4">
                <ShirtField value={card.shirt_number} onChange={change} />
                <FootField value={card.strong_foot} onChange={change} />
                <PositionField value={card.favourite_position} onChange={change} />
              </Card>
            </>
          )}
          {step === 1 && (
            <>
              <PageTitle sub="1 to 10 on each skill. It never changes your night ratings.">Rate yourself</PageTitle>
              <Card>
                <SkillsField skills={card} onChange={change} />
              </Card>
            </>
          )}
          {step === 2 && (
            <>
              <PageTitle sub="Add a motto if you like. You can change all of it later, from your profile.">
                Your card
              </PageTitle>
              <PlayerCard player={{ ...me, ...card }} isMe preview />
              <Card>
                <MottoField value={card.motto} onChange={change} />
              </Card>
            </>
          )}
        </m.div>
      </AnimatePresence>

      <ErrorNote message={error} />
      {someSkills && <p className="text-center text-sm text-muted">Rate all five skills, or skip this step.</p>}
      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1" disabled={busy} onClick={() => next(true)}>
          Skip
        </Button>
        <Button className="flex-[2]" busy={busy} disabled={someSkills} onClick={() => next(false)}>
          {last ? 'Done' : 'Next'}
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: The route, and going there after joining**

In `src/App.tsx`, add `import Welcome from './pages/Welcome'` and, after the `join` route:

```tsx
        <Route path="welcome" element={<Welcome />} />
```

In `src/pages/JoinOrCreate.tsx`, in `done`, change `navigate('/')` to `navigate('/welcome')`.

- [ ] **Step 3: The Home reminder**

In `src/lib/storage.ts`, add to `KEYS`:

```ts
  /** "Not now" on Home's "Finish your player card", per player: `${key}.${playerId}` = '1'. */
  cardReminderHidden: 'kora.cardReminderHidden',
```

In `src/pages/Home.tsx`, add the imports `Button` (from `../components/ui`), `isCardFilled` (from `../lib/card`) and `KEYS, readLocal, writeLocal` (from `../lib/storage`). After the `voting.map(...)` block, add `<FinishCard />`, and add at the end of the file:

```tsx
/** Until the player card is filled in: a nudge to do it. "Not now" hides it on this phone. */
function FinishCard() {
  const { player, myPlayerId } = useCurrentGroup()
  const key = `${KEYS.cardReminderHidden}.${myPlayerId}`
  const [hidden, setHidden] = useState(() => readLocal(key) === '1')
  const me = player(myPlayerId)
  if (!me || hidden || isCardFilled(me)) return null
  return (
    <Card strong>
      <Heading>Your player card</Heading>
      <p className="mt-1 font-display text-[22px] leading-tight">Finish your player card</p>
      <p className="mt-1 text-sm text-muted">Your shirt number, strong foot, favourite position, and how you rate yourself.</p>
      <div className="mt-3 flex gap-2">
        <LinkButton to={`/players/${myPlayerId}/edit`} className="flex-1">
          Set up my card
        </LinkButton>
        <Button
          variant="ghost"
          onClick={() => {
            writeLocal(key, '1')
            setHidden(true)
          }}
        >
          Not now
        </Button>
      </div>
    </Card>
  )
}
```

- [ ] **Step 4: Checkpoint**

Run: `npx tsc -b && npm run lint && npm test && npm run build`
Expected: all pass.

---

## Part C — The portfolio

### Task 7: Form, best night and the graph's scale

**Files:**
- Create: `src/lib/trend.ts`, `src/lib/trend.test.ts`

**Interfaces:**
- Produces: `TREND_STEP = 0.2`; `FORM_NIGHTS = 5`; `type Trend = 'up' | 'down' | 'level'`; `recentForm(ratings: number[]): { last: number[]; average: number | null; trend: Trend | null }` (ratings oldest first); `bestNight<T extends { rating: number }>(nights: T[]): T | null`; `chartScale(ratings: number[]): { min: number; max: number; x: (i: number) => number; y: (rating: number) => number }` (fractions: 0 = left / top).

- [ ] **Step 1: Write the failing tests**

Create `src/lib/trend.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { bestNight, chartScale, recentForm } from './trend'

// The worked example in Plans/Player-card-and-motion.md section 3, oldest first.
const TEN = [6.1, 6.4, 5.9, 7.0, 6.6, 7.2, 7.5, 6.9, 7.8, 7.1]

describe('recent form', () => {
  it('is the last 5 nights and their average: 7.3, up from 6.4', () => {
    expect(recentForm(TEN)).toEqual({ last: [7.2, 7.5, 6.9, 7.8, 7.1], average: 7.3, trend: 'up' })
  })

  it('with only 4 nights: their average, and no arrow', () => {
    expect(recentForm([6.1, 6.4, 5.9, 7.1])).toEqual({ last: [6.1, 6.4, 5.9, 7.1], average: 6.4, trend: null })
  })

  it('6.5 against 6.6 before (−0.1) is level', () => {
    expect(recentForm([6.6, 6.6, 6.6, 6.6, 6.6, 6.5, 6.5, 6.5, 6.5, 6.5]).trend).toBe('level')
  })

  it('0.2 or more lower is down', () => {
    expect(recentForm([7, 7, 7, 7, 7, 6.8, 6.8, 6.8, 6.8, 6.8]).trend).toBe('down')
  })

  it('compares with the nights before, even fewer than 5', () => {
    expect(recentForm([5, 7, 7, 7, 7, 7]).trend).toBe('up')
  })

  it('no nights: nothing', () => {
    expect(recentForm([])).toEqual({ last: [], average: null, trend: null })
  })
})

describe('best night', () => {
  it('is the highest rating: 7.8', () => {
    expect(bestNight(TEN.map((rating, i) => ({ rating, i })))).toEqual({ rating: 7.8, i: 8 })
  })

  it('with a tie, the most recent', () => {
    expect(bestNight([{ rating: 8, i: 0 }, { rating: 8, i: 1 }])?.i).toBe(1)
  })

  it('none without nights', () => {
    expect(bestNight([])).toBeNull()
  })
})

describe('the graph', () => {
  it('spaces the nights evenly from left to right', () => {
    const s = chartScale([6, 7, 8])
    expect([s.x(0), s.x(1), s.x(2)]).toEqual([0, 0.5, 1])
  })

  it('runs from 10 at the top to 4 at the bottom', () => {
    const s = chartScale([6, 8])
    expect([s.min, s.max, s.y(10), s.y(7), s.y(4)]).toEqual([4, 10, 0, 0.5, 1])
  })

  it('goes lower for a rating under 4', () => {
    expect(chartScale([3.2, 7]).min).toBe(3)
  })

  it('puts a single night in the middle', () => {
    expect(chartScale([7]).x(0)).toBe(0.5)
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/trend.test.ts`
Expected: FAIL (`Failed to resolve import "./trend"`).

- [ ] **Step 3: Write trend.ts**

Create `src/lib/trend.ts`:

```ts
// A player's rating history (Plans/Player-card-and-motion.md section 3):
// recent form, the best night, and where the graph's points go. Pure
// functions, tested in trend.test.ts. Ratings come in oldest first.

/** How much the form has to move for an up or down arrow. */
export const TREND_STEP = 0.2
/** Nights in the form. */
export const FORM_NIGHTS = 5

export type Trend = 'up' | 'down' | 'level'

const average = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length
const oneDecimal = (n: number) => Math.round(n * 10) / 10

/**
 * The last 5 nights and their average. The trend compares that average with
 * the average of the (up to 5) nights before them; none with fewer than 6.
 */
export function recentForm(ratings: number[]): { last: number[]; average: number | null; trend: Trend | null } {
  const last = ratings.slice(-FORM_NIGHTS)
  if (last.length === 0) return { last, average: null, trend: null }
  const before = ratings.slice(-2 * FORM_NIGHTS, -FORM_NIGHTS)
  if (before.length === 0) return { last, average: oneDecimal(average(last)), trend: null }
  // Rounded so that floating-point noise can't tip a 0.2 change either way.
  const diff = Math.round((average(last) - average(before)) * 1000) / 1000
  const trend: Trend = diff >= TREND_STEP ? 'up' : diff <= -TREND_STEP ? 'down' : 'level'
  return { last, average: oneDecimal(average(last)), trend }
}

/** The highest-rated night; with a tie, the most recent. */
export function bestNight<T extends { rating: number }>(nights: T[]): T | null {
  let best: T | null = null
  for (const night of nights) if (!best || night.rating >= best.rating) best = night
  return best
}

/**
 * Where each night goes on the graph, as fractions of its width and height
 * (0 = left / top). Nights are spaced evenly. The scale runs from 10 at the
 * top down to 4, or lower if a rating is below 4.
 */
export function chartScale(ratings: number[]) {
  const min = Math.min(4, Math.floor(Math.min(...ratings)))
  const max = 10
  return {
    min,
    max,
    x: (i: number) => (ratings.length === 1 ? 0.5 : i / (ratings.length - 1)),
    y: (rating: number) => (max - rating) / (max - min),
  }
}
```

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run src/lib/trend.test.ts`
Expected: 13 PASS.

---

### Task 8: The profile: Self vs friends, rating history and the nights' breakdowns

**Files:**
- Create: `src/components/breakdown.tsx`, `src/components/selfvsfriends.tsx`, `src/components/history.tsx`
- Modify: `src/components/results.tsx` (`Breakdown` uses `BreakdownTable`), `src/pages/PlayerProfile.tsx` (replace)

**Interfaces:**
- Consumes: `PlayerCard` (Task 5); `selfRating`, `confidence`, `CONFIDENCE`, `friendsScore` (Task 4); `recentForm`, `bestNight`, `chartScale`, `Trend` (Task 7); `Cascade`, `CountUp`, `Reveal` (Task 1); `api.HistoryRow`, `api.getPlayerHistory`, `api.getLeaderboard`.
- Produces: `BreakdownTable({ rating: MatchRating })`; `SelfVsFriends({ player, season?, allTime?, minNights, isMe })`; `RatingHistory({ nights: RatedNight[]; year: number })` with `interface RatedNight { match_id: string; played_at: string; rating: number; is_mvp: boolean }` (oldest first).

- [ ] **Step 1: Move the breakdown table into its own file**

Create `src/components/breakdown.tsx`:

```tsx
// The breakdown of one night's rating, from what compute_match_ratings
// stored: on the night's results and on the player's profile.
import { formatMinutes, formatPoints } from '../lib/format'
import type { MatchRating } from '../lib/types'

export function BreakdownTable({ rating }: { rating: MatchRating }) {
  const b = rating.breakdown
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

  const rows: [string, number][] = [
    ['Base for playing', b.base],
    [`Goals (${rating.goals})`, b.goals],
    [`Assists (${rating.assists})`, b.assists],
    [`Team impact (goal difference on the pitch, added up: ${formatPoints(b.net_goal_diff)})`, b.net_goals],
    [b.minutes != null ? `Result (average over ${formatMinutes(b.minutes)} played)` : 'Result', b.result],
  ]
  if (b.clean_sheets) rows.push([`Clean sheets (${rating.clean_sheets})`, b.clean_sheets])
  if (b.saves) rows.push([`Saves (${rating.saves})`, b.saves])

  return (
    <>
      <table className="tabular w-full">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <td className="py-0.5 text-muted">{label}</td>
              <td className="py-0.5 text-right font-medium">{label.startsWith('Base') ? value.toFixed(1) : formatPoints(value)}</td>
            </tr>
          ))}
          <tr className="border-t border-line font-semibold">
            <td className="pt-1">Stats score</td>
            <td className="pt-1 text-right">{b.analytics}</td>
          </tr>
          <tr className="font-semibold">
            <td>Peer votes</td>
            <td className="text-right">
              {b.vote_average != null ? `${b.vote_average} avg of ${plural(b.vote_count, 'vote')}` : 'no votes'}
            </td>
          </tr>
        </tbody>
      </table>

      <p className="rounded-lg bg-paper p-2 font-medium">
        {b.stats_only ? (
          <>
            Fewer than {b.min_votes} votes, so the rating is the stats score alone: <strong>{rating.rating.toFixed(1)}</strong>
          </>
        ) : (
          <>
            {Math.round(b.w_analytics * 100)}% × {b.analytics} + {Math.round(b.w_votes * 100)}% × {b.vote_average} ={' '}
            <strong>{rating.rating.toFixed(1)}</strong>
          </>
        )}
      </p>
    </>
  )
}
```

In `src/components/results.tsx`, add `import { BreakdownTable } from './breakdown'`. In `Breakdown`, delete `const b = rating.breakdown`, `const plural = ...`, the `rows` array and its pushes, and replace the `<table>…</table>` and the formula `<p>…</p>` with `<BreakdownTable rating={rating} />` (the "Votes received" and "Man of the Match votes" parts stay). Remove `formatMinutes` and `formatPoints` from its `../lib/format` import if `tsc` says they're unused.

- [ ] **Step 2: Self vs friends**

Create `src/components/selfvsfriends.tsx`:

```tsx
// Self vs friends (Plans/Player-card-and-motion.md section 2): the
// self-rating next to what friends give in their votes. Just for fun: it
// changes nothing else.
import * as m from 'motion/react-m'
import { Link } from 'react-router'
import { CONFIDENCE, confidence, friendsScore, selfRating, type Confidence } from '../lib/card'
import { formatPoints } from '../lib/format'
import type { LeaderboardRow, Player } from '../lib/types'
import { Card, Heading } from './ui'

/** Black text on every colour; never colour alone (the chip says the word). */
const CHIP: Record<Confidence, string> = {
  modest: 'status',
  spot_on: 'bg-brand',
  confident: 'bg-[var(--rate-ok)]',
  very_confident: 'border-danger bg-paper text-danger',
}

export function SelfVsFriends({
  player,
  season,
  allTime,
  minNights,
  isMe,
}: {
  player: Player
  season: LeaderboardRow | undefined
  allTime: LeaderboardRow | undefined
  /** The table's "nights to join" setting. */
  minNights: number
  isMe: boolean
}) {
  const self = selfRating(player)
  const friends = friendsScore(season, allTime, minNights)
  const verdict = self != null && friends.kind === 'score' ? confidence(self, friends.score) : null

  return (
    <Card>
      <Heading className="mb-1">Self vs friends</Heading>
      {self == null ? (
        <p className="text-sm text-muted">
          {isMe ? (
            <>
              Rate yourself on{' '}
              <Link to={`/players/${player.id}/edit`} className="font-semibold text-brand-ink underline">
                your card
              </Link>{' '}
              to see how it compares with your friends' votes.
            </>
          ) : (
            'No self-rating yet.'
          )}
        </p>
      ) : (
        <>
          <Bar label={isMe ? 'You say' : 'Says'} value={self} tone="bg-ink" />
          {friends.kind === 'score' && (
            <Bar label={friends.season ? 'Friends give (this season)' : 'Friends give (all-time)'} value={friends.score} tone="bg-brand" />
          )}
          {friends.kind === 'wait' && (
            <p className="mt-3 text-sm text-muted">
              {isMe ? 'Play' : 'After'} {friends.nightsToGo} more rated night{friends.nightsToGo === 1 ? '' : 's'}
              {isMe ? ' to see what your friends think.' : ", friends' votes show here."}
            </p>
          )}
          {friends.kind === 'no_votes' && <p className="mt-3 text-sm text-muted">Not enough votes yet.</p>}
          {verdict && (
            <>
              <div className="mt-3 flex items-center gap-2">
                <span className={`chip ${CHIP[verdict.level]}`}>{CONFIDENCE[verdict.level].label}</span>
                <span className="tabular text-sm font-semibold">{formatPoints(verdict.gap)}</span>
              </div>
              <p className="mt-1 text-sm text-muted">{CONFIDENCE[verdict.level].note}</p>
            </>
          )}
        </>
      )}
    </Card>
  )
}

/** One bar on the 1-10 scale, with its number. */
function Bar({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="mt-2">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-muted">{label}</span>
        <span className="tabular font-display text-xl">{value.toFixed(1)}</span>
      </div>
      <div aria-hidden className="mt-1 h-3 overflow-hidden rounded-full bg-line">
        <m.div
          className={`h-full origin-left rounded-full ${tone}`}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: value / 10 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: The rating history**

Create `src/components/history.tsx`:

```tsx
// A player's rating history (Plans/Player-card-and-motion.md section 3): the
// graph, recent form and the best night, for this season or all-time. The
// graph is plain SVG (no chart library). The nights list on the profile is
// the table view of the same numbers.
import { useReducedMotion } from 'motion/react'
import * as m from 'motion/react-m'
import { useState, type KeyboardEvent, type PointerEvent } from 'react'
import { Link } from 'react-router'
import { formatDay } from '../lib/format'
import { bestNight, chartScale, FORM_NIGHTS, recentForm, type Trend } from '../lib/trend'
import { StarIcon } from './icons'
import { Card, Empty, Heading, RatingBadge } from './ui'

/** One finished night of the player. */
export interface RatedNight {
  match_id: string
  played_at: string
  rating: number
  is_mvp: boolean
}

const TREND: Record<Trend, { text: string; tone: string }> = {
  up: { text: '▲ Up', tone: 'text-brand-ink' },
  down: { text: '▼ Down', tone: 'text-danger' },
  level: { text: '▶ Steady', tone: 'text-muted' },
}

/** Nights oldest first. The tabs scope everything in the card. */
export function RatingHistory({ nights, year }: { nights: RatedNight[]; year: number }) {
  const season = nights.filter((n) => n.played_at.startsWith(String(year)))
  const [scope, setScope] = useState<'season' | 'all'>(season.length > 0 ? 'season' : 'all')
  const shown = scope === 'season' ? season : nights
  const form = recentForm(shown.map((n) => n.rating))
  const best = bestNight(shown)
  const mvps = shown.filter((n) => n.is_mvp).length

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-2">
        <Heading>Rating history</Heading>
        <div className="flex gap-1" role="tablist" aria-label="Rating history">
          {(['season', 'all'] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={scope === s}
              onClick={() => setScope(s)}
              className={`h-9 rounded-lg px-3 text-sm font-semibold ${scope === s ? 'bg-ink text-paper' : 'text-muted'}`}
            >
              {s === 'season' ? year : 'All-time'}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <Empty title="No rated nights yet">Ratings appear after a night's voting closes.</Empty>
      ) : (
        <>
          <RatingChart key={scope} nights={shown} />

          <div className="mt-4">
            <div className="flex items-baseline justify-between">
              <p className="label">Form · last {Math.min(FORM_NIGHTS, shown.length)}</p>
              <p className="text-sm">
                <span className="tabular font-display text-lg">{form.average?.toFixed(1)}</span>
                {form.trend && <span className={`ml-2 font-bold ${TREND[form.trend].tone}`}>{TREND[form.trend].text}</span>}
              </p>
            </div>
            <ol className="mt-1.5 flex gap-1.5">
              {shown.slice(-FORM_NIGHTS).map((n) => (
                <li key={n.match_id}>
                  <RatingBadge value={n.rating} size="sm" />
                </li>
              ))}
            </ol>
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
            {best && (
              <div className="rounded-xl bg-ground p-3">
                <dt className="text-muted">Best night</dt>
                <dd className="mt-1 flex items-center gap-2">
                  <RatingBadge value={best.rating} size="sm" />
                  <Link to={`/nights/${best.match_id}`} className="font-semibold underline">
                    {formatDay(best.played_at)}
                  </Link>
                </dd>
              </div>
            )}
            <div className="rounded-xl bg-ground p-3">
              <dt className="text-muted">Man of the Match</dt>
              <dd className="mt-1 flex items-center gap-1.5 font-display text-xl">
                <StarIcon size={18} className="text-gold" /> {mvps}
              </dd>
            </div>
          </dl>
        </>
      )}
    </Card>
  )
}

// The graph's drawing box (the SVG scales to the card's width).
const W = 320
const H = 140
const PAD = { left: 24, right: 12, top: 12, bottom: 12 }
/** The rating bands' edges (Design/README.md section 3), as faint lines. */
const BANDS = [6, 7, 8]

/**
 * The nights' ratings as a line, oldest on the left. Tap or slide across it
 * (or use the arrow keys) to pick a night: its date and rating badge show
 * above. The latest night is picked at first.
 */
function RatingChart({ nights }: { nights: RatedNight[] }) {
  const reduce = useReducedMotion()
  const [picked, setPicked] = useState(nights.length - 1)
  const ratings = nights.map((n) => n.rating)
  const scale = chartScale(ratings)
  const px = (i: number) => PAD.left + scale.x(i) * (W - PAD.left - PAD.right)
  const py = (rating: number) => PAD.top + scale.y(rating) * (H - PAD.top - PAD.bottom)
  const line = ratings.map((r, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)},${py(r).toFixed(1)}`).join(' ')
  const floor = py(scale.min).toFixed(1)
  const area = `${line} L${px(ratings.length - 1).toFixed(1)},${floor} L${px(0).toFixed(1)},${floor} Z`
  const night = nights[picked]

  // The pointer picks the nearest night, so nobody has to hit a dot.
  function pick(e: PointerEvent<HTMLDivElement>) {
    const box = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - box.left) / box.width) * W
    let nearest = 0
    for (let i = 1; i < nights.length; i++) if (Math.abs(px(i) - x) < Math.abs(px(nearest) - x)) nearest = i
    setPicked(nearest)
  }

  function keys(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'ArrowLeft') setPicked((p) => Math.max(0, p - 1))
    else if (e.key === 'ArrowRight') setPicked((p) => Math.min(nights.length - 1, p + 1))
    else return
    e.preventDefault()
  }

  return (
    <div>
      <div className="mb-1 flex min-h-8 items-center justify-between gap-2" aria-live="polite">
        <span className="text-sm text-muted">
          {formatDay(night.played_at)}
          {night.is_mvp && ' · Man of the Match'}
        </span>
        <RatingBadge value={night.rating} />
      </div>
      <div
        role="group"
        tabIndex={0}
        aria-label={`Rating graph of ${nights.length} night${nights.length === 1 ? '' : 's'}. Use the arrow keys to pick a night.`}
        className="touch-pan-y rounded-lg"
        onPointerDown={pick}
        onPointerMove={(e) => {
          if (e.pointerType === 'mouse' || e.buttons > 0) pick(e)
        }}
        onKeyDown={keys}
      >
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" aria-hidden>
          {BANDS.filter((b) => b > scale.min).map((b) => (
            <g key={b}>
              <line x1={PAD.left} x2={W - PAD.right} y1={py(b)} y2={py(b)} stroke="var(--line)" strokeWidth={1} />
              <text x={PAD.left - 6} y={py(b) + 3.5} textAnchor="end" className="fill-muted text-[10px]">
                {b}
              </text>
            </g>
          ))}
          <m.path
            d={area}
            fill="var(--brand-ink)"
            fillOpacity={0.1}
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.4 }}
          />
          <line x1={px(picked)} x2={px(picked)} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--muted)" strokeWidth={1} />
          <m.path
            d={line}
            fill="none"
            stroke="var(--brand-ink)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={reduce ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
          {ratings.map((r, i) => (
            <circle
              key={nights[i].match_id}
              cx={px(i)}
              cy={py(r)}
              r={i === picked ? 6 : 4}
              fill="var(--brand-ink)"
              stroke="var(--paper)"
              strokeWidth={2}
            />
          ))}
        </svg>
      </div>
    </div>
  )
}
```

(Chart specs from the dataviz guidance: one series, so no legend; a 2 px line with round joins, ≥ 8 px dots with a 2 px ring in the card colour, a 10% area wash, hairline gridlines, a crosshair that snaps to the nearest night, keyboard support, and the nights list below as the table view. Text uses text colours, never the line colour.)

- [ ] **Step 4: The portfolio**

Replace `src/pages/PlayerProfile.tsx` with:

```tsx
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { BreakdownTable } from '../components/breakdown'
import { PlayerCard } from '../components/card'
import { RatingHistory, type RatedNight } from '../components/history'
import { ChevronIcon, StarIcon } from '../components/icons'
import { Cascade, CountUp, Reveal } from '../components/motion'
import { SelfVsFriends } from '../components/selfvsfriends'
import { Card, ErrorNote, Heading, LinkButton, Loading, RatingBadge } from '../components/ui'
import * as api from '../lib/api'
import { formatDay, formatMinutes } from '../lib/format'
import type { LeaderboardRow } from '../lib/types'
import { useLoad } from '../lib/useLoad'
import { useCurrentGroup } from '../state/group'

/**
 * A player's portfolio (Plans/Player-card-and-motion.md section 3): the card,
 * Self vs friends, the rating history, the stats, and the nights with their
 * breakdowns.
 */
export default function PlayerProfile() {
  const { id = '' } = useParams()
  const { group, player, myPlayerId, isAdmin, members, config } = useCurrentGroup()
  const [year] = useState(() => new Date().getFullYear())
  const p = player(id)

  const { data, error, loading, reload } = useLoad(async () => {
    const [history, season, allTime] = await Promise.all([
      api.getPlayerHistory(id),
      api.getLeaderboard(group.id, year),
      api.getLeaderboard(group.id, null),
    ])
    return {
      history,
      season: season.find((r) => r.player_id === id),
      allTime: allTime.find((r) => r.player_id === id),
    }
  }, [id, group.id, year])

  if (!p) return <ErrorNote message="Player not found." />
  const isMe = id === myPlayerId
  const isAdminPlayer = members.some((member) => member.player_id === id && member.role === 'admin')
  const role = [isMe ? 'You' : 'Player', isAdminPlayer && 'Admin', !p.user_id && 'no account'].filter(Boolean).join(' · ')
  // The badge in the card: this season's rating, else all-time, else "New" (nothing while loading).
  const rating = data?.season
    ? { value: data.season.avg_rating, label: `Season ${year}` }
    : data?.allTime
      ? { value: data.allTime.avg_rating, label: 'All-time' }
      : data
        ? null
        : undefined
  // Finished nights, oldest first, for the graph and the form (as on the table).
  const rated: RatedNight[] = (data?.history ?? [])
    .filter((h) => h.matches.status === 'closed')
    .map((h) => ({ match_id: h.match_id, played_at: h.matches.played_at, rating: Number(h.rating), is_mvp: h.is_mvp }))
    .reverse()

  return (
    <Cascade className="space-y-4">
      <PlayerCard player={p} rating={rating} role={role} isMe={isMe} />
      {(isMe || isAdmin) && (
        <LinkButton to={`/players/${id}/edit`} variant="secondary" className="w-full">
          {isMe ? 'Edit my card' : 'Edit card'}
        </LinkButton>
      )}

      {loading && !data ? (
        <Loading />
      ) : (
        <>
          <ErrorNote message={error} onRetry={reload} />
          <SelfVsFriends
            player={p}
            season={data?.season}
            allTime={data?.allTime}
            minNights={config?.min_matches_for_leaderboard ?? 3}
            isMe={isMe}
          />
          <RatingHistory nights={rated} year={year} />
          <StatsCard title={`Season ${year}`} row={data?.season} />
          <StatsCard title="All-time" row={data?.allTime} />
          <NightList history={data?.history ?? []} />
        </>
      )}
    </Cascade>
  )
}

function StatsCard({ title, row }: { title: string; row: LeaderboardRow | undefined }) {
  const stats = [
    ['Played', row?.matches ?? 0],
    ['Goals', row?.goals ?? 0],
    ['Assists', row?.assists ?? 0],
    ['Clean sheets', row?.clean_sheets ?? 0],
    ['MOTM', row?.mvps ?? 0],
  ] as const
  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <Heading>{title}</Heading>
          <p className="text-sm text-muted">
            Average rating{row?.avg_votes != null && <> · peers give {Number(row.avg_votes).toFixed(1)}</>}
          </p>
        </div>
        <RatingBadge value={row?.avg_rating} size="lg" />
      </div>
      <dl className="mt-3 grid grid-cols-5 gap-1 text-center">
        {stats.map(([label, value]) => (
          <div key={label}>
            <dt className="text-[11px] leading-tight text-muted">{label}</dt>
            <dd className="tabular font-display text-2xl">
              <CountUp value={value} />
            </dd>
          </div>
        ))}
      </dl>
      {row && (
        <p className="mt-2 text-center text-sm text-muted">
          {formatMinutes(row.avg_minutes)} a night on average
          {row.minutes_in_goal > 0 && <> · {formatMinutes(row.minutes_in_goal)} in goal</>}
        </p>
      )}
    </Card>
  )
}

/** The player's rated nights, newest first. Tap one for its breakdown. */
function NightList({ history }: { history: api.HistoryRow[] }) {
  const [open, setOpen] = useState<string | null>(null)
  // With no nights, Rating history already shows the empty state.
  if (history.length === 0) return null
  return (
    <section>
      <Heading className="mb-2">Nights</Heading>
      <ul className="divide-y divide-line overflow-hidden rounded-card border-[1.5px] border-line bg-paper">
        {history.map((h) => (
          <li key={h.match_id}>
            <button
              type="button"
              aria-expanded={open === h.match_id}
              onClick={() => setOpen(open === h.match_id ? null : h.match_id)}
              className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{formatDay(h.matches.played_at)}</span>
                <span className="block text-xs text-muted">
                  {[
                    h.goals > 0 && `${h.goals} G`,
                    h.assists > 0 && `${h.assists} A`,
                    h.clean_sheets > 0 && 'clean sheet',
                    h.stats_only && 'stats only',
                  ]
                    .filter(Boolean)
                    .join(' · ') || '—'}
                </span>
              </span>
              {h.is_mvp && <StarIcon size={18} className="text-gold" aria-label="Man of the Match" />}
              <RatingBadge value={h.rating} />
              <ChevronIcon size={18} className={`shrink-0 text-muted transition-transform ${open === h.match_id ? 'rotate-90' : ''}`} />
            </button>
            <Reveal open={open === h.match_id}>
              <div className="space-y-3 bg-ground/60 px-4 py-3 text-sm">
                <BreakdownTable rating={h} />
                <Link to={`/nights/${h.match_id}`} className="flex items-center justify-between font-semibold text-brand-ink">
                  Open the night (votes and games) <ChevronIcon size={18} />
                </Link>
              </div>
            </Reveal>
          </li>
        ))}
      </ul>
    </section>
  )
}
```

- [ ] **Step 5: Checkpoint**

Run: `npx tsc -b && npm run lint && npm test && npm run build`
Expected: all pass.

---

## Part D — Celebrations

### Task 9: Count-ups, GOAL!, the Man of the Match star, vote pops and lists sliding in

**Files:**
- Create: `src/components/goalsplash.tsx`
- Modify: `src/components/ui.tsx` (`Card`, `RatingBadge`, `Empty`), `src/components/card.tsx` (the band's badge counts up), `src/components/match.tsx` (`Scoreboard`), `src/components/games.tsx` (`GoalToast`), `src/pages/Recorder.tsx`, `src/components/results.tsx`, `src/pages/Vote.tsx`, `src/pages/Home.tsx`, `src/pages/NightPage.tsx`, `src/pages/Settings.tsx`, `src/pages/HowItWorks.tsx`, `src/pages/Nights.tsx`, `src/pages/Leaderboard.tsx`

**Interfaces:**
- Consumes: `Cascade`, `CountUp`, `Bump`, `Reveal` (Task 1); `cascade`, `cascadeItem` (Task 1); `ScoreButton` (Task 5); `useToast` (Task 2).
- Produces: `RatingBadge({ value, size?, className?, animated? })`; `GoalSplash({ goal: SplashGoal | null; onDone: () => void })` with `interface SplashGoal { id: string; scorer: string; team: Team }`. `Card` slides in when it's inside a `Cascade` (and is unchanged anywhere else).

- [ ] **Step 1: Cards slide in; badges count up; the empty state bounces**

In `src/components/ui.tsx`, add `import { cascadeItem, spring } from '../lib/motion'` (replacing the `spring`-only import) and `import { CountUp } from './motion'`.

Replace `Card` with:

```tsx
/**
 * White card. `strong` gives important cards (money, live night) a bold ink
 * border. Inside a <Cascade> the cards slide in one after another.
 */
export function Card({ children, className = '', strong = false }: { children: ReactNode; className?: string; strong?: boolean }) {
  return (
    <m.section
      variants={cascadeItem}
      className={`rounded-card bg-paper p-4 ${strong ? 'border-2 border-ink' : 'border-[1.5px] border-line'} ${className}`}
    >
      {children}
    </m.section>
  )
}
```

In `RatingBadge`, add the prop `animated = false` (type `animated?: boolean`, "counts up from 0 when it first shows") and replace the content line with:

```tsx
      {value == null ? '–' : animated ? <CountUp value={Number(value)} decimals={1} /> : Number(value).toFixed(1)}
```

In `Empty`, replace the `<img …/>` with:

```tsx
      <m.img
        src="/mark-green.svg"
        alt=""
        className="mx-auto mb-2 h-24"
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', bounce: 0.5, duration: 0.6 }}
      />
```

In `src/components/card.tsx`, give the band's badge `animated`: `<RatingBadge value={rating.value} size="lg" animated className="border-2 border-[#0b0b0b]" />`.

- [ ] **Step 2: Screens whose cards slide in**

Replace the outer `<div className="space-y-4">` (and its closing `</div>`) with `<Cascade className="space-y-4">` … `</Cascade>` in the main return of `src/pages/Home.tsx`, `src/pages/NightPage.tsx`, `src/pages/Settings.tsx` and `src/pages/HowItWorks.tsx`, adding `import { Cascade } from '../components/motion'` to each. (`PlayerProfile.tsx` already uses it.) Live nights refresh every 10 seconds without sliding in again: only cards that appear for the first time slide in.

- [ ] **Step 3: Rows slide in; the table's rows glide when re-sorted**

In `src/pages/Nights.tsx`, add `import * as m from 'motion/react-m'` and `import { cascade, cascadeItem } from '../lib/motion'`. Change each month's list to `<m.ul initial="initial" animate="animate" variants={cascade} className="…same classes…">` and each row's `<li key={m.id}>` to `<m.li key={night.id} variants={cascadeItem}>`, renaming the map variable from `m` to `night` (it would hide the `m` import): `{list.map((night) => { … })}`, with every `m.` inside the row (`m.status`, `m.games`, `m.match_ratings`, `m.id`, `m.played_at`, `m.starts_at`, `m.cancel_reason`, `m.location`) becoming `night.`. Do the same rename in the `for (const m of data ?? [])` loop at the top (`for (const night of data ?? [])`).

In `src/pages/Leaderboard.tsx`, add the same two imports. In `Table`, change `<ol …>` to `<m.ol initial="initial" animate="animate" variants={cascade} className="…same classes…">` and each player row's `<li key={r.player_id}>` to `<m.li key={r.player_id} layout variants={cascadeItem}>` (the header row stays a plain `<li>`).

- [ ] **Step 4: The score bounces**

In `src/components/match.tsx`, add `import { Bump } from './motion'` and, in `Scoreboard`, replace `{score[0]} – {score[1]}` with:

```tsx
        <Bump value={score[0]}>{score[0]}</Bump> – <Bump value={score[1]}>{score[1]}</Bump>
```

- [ ] **Step 5: "Goal!" for everyone watching**

In `src/components/games.tsx`, add `useToast` to the feedback import (`import { useConfirm, useToast } from './feedback'`). Add before `GamesList`:

```tsx
/** For everyone watching the live night: a short "Goal!" message when the score goes up. */
function GoalToast({ teams, score }: { teams: [Team, Team]; score: [number, number] }) {
  const toast = useToast()
  const seen = useRef(score)
  useEffect(() => {
    const [one, two] = seen.current
    if (score[0] > one) toast(`Goal for Team ${teams[0]}! ${score[0]} – ${score[1]}`)
    else if (score[1] > two) toast(`Goal for Team ${teams[1]}! ${score[0]} – ${score[1]}`)
    seen.current = score
  }, [score, teams, toast])
  return null
}
```

and render it in `GameCard`, right after the opening `<>` of its return: `<GoalToast teams={teams} score={score} />`. (`GameCard` is keyed by the game, so a new game starts from its own 0 – 0.)

- [ ] **Step 6: The GOAL! splash**

Create `src/components/goalsplash.tsx`:

```tsx
// The GOAL! splash when an admin logs a goal in the game on now
// (Plans/Player-card-and-motion.md section 5). It closes by itself after
// about 1.2 seconds; a tap closes it early. Black text on the green; the
// flying balls are white line art, like the logo.
import { AnimatePresence } from 'motion/react'
import * as m from 'motion/react-m'
import { useEffect } from 'react'
import type { Team } from '../lib/types'
import { BallIcon } from './icons'
import { Name, TeamTag } from './ui'

export interface SplashGoal {
  /** The goal's id, so two goals in a row each get their splash. */
  id: string
  scorer: string
  team: Team
}

/** Where the balls fly to from the middle, in pixels. */
const BURST: [number, number][] = [
  [-120, -90],
  [0, -150],
  [120, -90],
  [150, 30],
  [90, 140],
  [-90, 140],
  [-150, 30],
]

export function GoalSplash({ goal, onDone }: { goal: SplashGoal | null; onDone: () => void }) {
  useEffect(() => {
    if (!goal) return
    navigator.vibrate?.(80)
    const timer = window.setTimeout(onDone, 1200)
    return () => window.clearTimeout(timer)
  }, [goal, onDone])

  return (
    <AnimatePresence>
      {goal && (
        <m.div
          key={goal.id}
          role="status"
          onClick={onDone}
          className="honeycomb fixed inset-0 z-50 flex flex-col items-center justify-center text-on-brand"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {BURST.map(([x, y]) => (
            <m.span
              key={`${x},${y}`}
              aria-hidden
              className="absolute text-[#ffffff]"
              initial={{ x: 0, y: 0, scale: 0.4, opacity: 1 }}
              animate={{ x, y, scale: 1, opacity: 0 }}
              transition={{ duration: 0.9, ease: 'easeOut' }}
            >
              <BallIcon size={30} />
            </m.span>
          ))}
          <m.p
            className="font-display text-[88px] leading-none"
            initial={{ scale: 0.4, rotate: -8 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 14 }}
          >
            GOAL!
          </m.p>
          <m.p
            className="mt-3 font-display text-[26px] leading-tight"
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15 }}
          >
            <Name>{goal.scorer}</Name>
          </m.p>
          <span className="mt-3">
            <TeamTag team={goal.team} />
          </span>
        </m.div>
      )}
    </AnimatePresence>
  )
}
```

In `src/pages/Recorder.tsx`:
- Add `import { GoalSplash, type SplashGoal } from '../components/goalsplash'` and add `useCallback` to the `react` import.
- After the `last` state, add:

```tsx
  const [splash, setSplash] = useState<SplashGoal | null>(null)
  const closeSplash = useCallback(() => setSplash(null), [])
```

- In `save`, after `setLast(...)`, add:

```tsx
      if (live && scorerTeam) setSplash({ id: goalId, scorer: playerName(scorer), team: scorerTeam })
```

- In the main return, right after `{back}`, add `<GoalSplash goal={splash} onDone={closeSplash} />`.

- [ ] **Step 7: Results: the star, the shine, the ratings**

In `src/components/results.tsx`, add `import * as m from 'motion/react-m'`, `import { cascade, cascadeItem } from '../lib/motion'` and `import { Reveal } from './motion'`. In the Man of the Match names, rename the map variable so it doesn't hide the `m` import: `{mvps.map((mvp, i) => (` with `mvp.player_id` inside.

Replace the Man of the Match `<section …>` opening and the `<StarIcon size={36} … />` with:

```tsx
      <section className="relative overflow-hidden rounded-card border-2 border-gold bg-paper p-4">
        {/* A gold shine sweeps across once. */}
        <m.span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-linear-to-r from-transparent via-gold/30 to-transparent"
          initial={{ x: '0%' }}
          animate={{ x: '400%' }}
          transition={{ duration: 1.1, delay: 0.4, ease: 'easeInOut' }}
        />
        <div className="relative flex items-center gap-3">
          <m.span
            className="shrink-0 text-gold"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.15 }}
          >
            <StarIcon size={36} />
          </m.span>
```

(the rest of the section stays; its existing `<div className="flex items-center gap-3">` is the one replaced by the `relative` one above).

In the Ratings card, change `<ul className="mt-2 divide-y divide-line">` to `<m.ul className="mt-2 divide-y divide-line" initial="initial" animate="animate" variants={cascade}>`, each `<li key={r.player_id}>` to `<m.li key={r.player_id} variants={cascadeItem}>`, the row's badge to `<RatingBadge value={r.rating} animated />`, and `{open === r.player_id && <Breakdown rating={r} detail={detail} />}` to:

```tsx
              <Reveal open={open === r.player_id}>
                <Breakdown rating={r} detail={detail} />
              </Reveal>
```

In `VoteProgress`, replace the inner progress `<div className="h-full rounded-full bg-brand" style={{ width: … }} />` with:

```tsx
        <m.div
          className="h-full rounded-full bg-brand"
          initial={{ width: 0 }}
          animate={{ width: `${(done / Math.max(1, voteStatus.length)) * 100}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
```

- [ ] **Step 8: The vote screen**

In `src/pages/Vote.tsx`, add `import * as m from 'motion/react-m'` and `ScoreButton` to the `../components/ui` import.
- Replace the 1-10 buttons (`{Array.from({ length: 10 }, … ).map((n) => ( <button … > ))}`) with:

```tsx
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <ScoreButton key={n} n={n} selected={choice === n} onClick={() => choose(pid, n)} />
                ))}
```

- Change the Man of the Match chips' `<button` to `<m.button whileTap={{ scale: 0.94 }}` (and `</button>` to `</m.button>`), and drop their `press` class.
- In the sticky footer, before the `{done} of {targets.length} rated…` line, add:

```tsx
        <div aria-hidden className="mb-2 h-1.5 overflow-hidden rounded-full bg-line">
          <m.div
            className="h-full rounded-full bg-brand"
            animate={{ width: `${(done / Math.max(1, targets.length)) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
```

- [ ] **Step 9: Checkpoint**

Run: `npx tsc -b && npm run lint && npm test && npm run build`
Expected: all pass.

---

## Part E — The two extras

### Task 10: Rating settings in the app

**Files:**
- Create: `src/components/ratingsettings.tsx`
- Modify: `src/lib/types.ts` (`RatingSettings`), `src/lib/api.ts` (`updateRatingSettings`), `src/pages/Settings.tsx` (the Rating settings card)

**Interfaces:**
- Consumes: `useToast` (Task 2). The database already allows it (file 3's `grant update (w_analytics, w_votes, min_votes, min_matches_for_leaderboard, voting_hours, points)` and the "admins edit rating config" rule), tested in Task 3.
- Produces: `type RatingSettings = Pick<RatingConfig, 'w_analytics' | 'w_votes' | 'min_votes' | 'min_matches_for_leaderboard' | 'voting_hours'>`; `updateRatingSettings(groupId: string, settings: RatingSettings): Promise<void>`; `RatingSettingsCard()`.

- [ ] **Step 1: Type and API**

In `src/lib/types.ts`, after `RatingConfig`:

```ts
/** The rating settings admins change in the app. The point values stay in Supabase's table editor. */
export type RatingSettings = Pick<RatingConfig, 'w_analytics' | 'w_votes' | 'min_votes' | 'min_matches_for_leaderboard' | 'voting_hours'>
```

In `src/lib/api.ts`, add `RatingSettings` to the type imports and, after `getRatingConfig`:

```ts
/** Admins: the four main rating settings. They count for nights whose voting closes from then on. */
export async function updateRatingSettings(groupId: string, settings: RatingSettings) {
  unwrap(await supabase.from('rating_config').update(settings).eq('group_id', groupId))
}
```

- [ ] **Step 2: The card**

Create `src/components/ratingsettings.tsx`:

```tsx
// The rating settings under More (Plans/Player-card-and-motion.md section 4):
// everyone sees them; admins change the four main ones. New values count for
// nights whose voting closes from then on; finished nights keep their ratings.
import { useState } from 'react'
import { Link } from 'react-router'
import * as api from '../lib/api'
import { errorMessage } from '../lib/format'
import type { RatingConfig, RatingSettings } from '../lib/types'
import { useCurrentGroup } from '../state/group'
import { useToast } from './feedback'
import { ChevronIcon } from './icons'
import { Button, Card, ErrorNote, Heading } from './ui'

const VOTES_NEEDED = [0, 1, 2, 3, 4, 5]
const VOTING_HOURS = [6, 12, 24, 48, 72]

export function RatingSettingsCard() {
  const { config, isAdmin } = useCurrentGroup()
  const [editing, setEditing] = useState(false)
  return (
    <Card>
      <div className="mb-2 flex items-center justify-between gap-2">
        <Heading>Rating settings</Heading>
        {isAdmin && config && !editing && (
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
            Edit
          </Button>
        )}
      </div>
      {config && (editing ? <SettingsForm config={config} onClose={() => setEditing(false)} /> : <SettingsList config={config} />)}
      <Link to="/how-it-works" className="mt-3 flex items-center justify-between font-semibold text-brand-ink">
        How ratings are calculated <ChevronIcon size={18} />
      </Link>
    </Card>
  )
}

function SettingsList({ config }: { config: RatingConfig }) {
  return (
    <dl className="grid grid-cols-2 gap-y-1 text-sm">
      <dt className="text-muted">Stats / peer votes</dt>
      <dd className="text-right font-semibold">
        {Math.round(config.w_analytics * 100)}% / {Math.round(config.w_votes * 100)}%
      </dd>
      <dt className="text-muted">Votes needed to count</dt>
      <dd className="text-right font-semibold">{config.min_votes}</dd>
      <dt className="text-muted">Nights to join the table</dt>
      <dd className="text-right font-semibold">{config.min_matches_for_leaderboard}</dd>
      <dt className="text-muted">Voting window</dt>
      <dd className="text-right font-semibold">{config.voting_hours} hours</dd>
    </dl>
  )
}

function SettingsForm({ config, onClose }: { config: RatingConfig; onClose: () => void }) {
  const { group, refresh } = useCurrentGroup()
  const toast = useToast()
  // The stats share in whole percent; a value set in Supabase off the 5% steps is kept until moved.
  const [stats, setStats] = useState(() => Math.round(Number(config.w_analytics) * 100))
  const [minVotes, setMinVotes] = useState(config.min_votes)
  const [minNights, setMinNights] = useState(config.min_matches_for_leaderboard)
  const [hours, setHours] = useState(config.voting_hours)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setBusy(true)
    setError(null)
    const settings: RatingSettings = {
      w_analytics: stats / 100,
      w_votes: (100 - stats) / 100,
      min_votes: minVotes,
      min_matches_for_leaderboard: minNights,
      voting_hours: hours,
    }
    try {
      await api.updateRatingSettings(group.id, settings)
      await refresh()
      toast('Rating settings saved')
      onClose()
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="flex items-baseline justify-between text-sm font-medium">
          Stats / peer votes
          <span className="tabular font-display text-lg">
            {stats}% / {100 - stats}%
          </span>
        </span>
        <input
          type="range"
          min={50}
          max={90}
          step={5}
          value={stats}
          onChange={(e) => setStats(Number(e.target.value))}
          className="mt-1 h-12 w-full accent-brand"
        />
      </label>
      <Choice label="Votes needed to count" options={VOTES_NEEDED} value={minVotes} onChange={setMinVotes} />
      <div>
        <p className="text-sm font-medium">Nights to join the table</p>
        <div className="mt-1 flex items-center gap-3">
          <Button variant="secondary" aria-label="Fewer nights" disabled={minNights <= 1} onClick={() => setMinNights(minNights - 1)}>
            −
          </Button>
          <span className="tabular w-8 text-center font-display text-2xl">{minNights}</span>
          <Button variant="secondary" aria-label="More nights" disabled={minNights >= 10} onClick={() => setMinNights(minNights + 1)}>
            +
          </Button>
        </div>
      </div>
      <Choice label="Voting window (hours)" options={VOTING_HOURS} value={hours} onChange={setHours} />
      <p className="text-sm text-muted">
        New values count for nights whose voting closes from now on. Finished nights keep their ratings.
      </p>
      <ErrorNote message={error} />
      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1" disabled={busy} onClick={onClose}>
          Cancel
        </Button>
        <Button className="flex-[2]" busy={busy} onClick={() => void save()}>
          Save
        </Button>
      </div>
    </div>
  )
}

/** A one-tap picker; the current value is offered even when it's not one of the usual choices. */
function Choice({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: number[]
  value: number
  onChange: (n: number) => void
}) {
  const list = [...new Set([...options, value])].sort((a, b) => a - b)
  return (
    <div>
      <p className="text-sm font-medium">{label}</p>
      <div className="seg mt-1" role="group" aria-label={label}>
        {list.map((n) => (
          <button key={n} type="button" aria-pressed={value === n} className={value === n ? 'sel' : ''} onClick={() => onChange(n)}>
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}
```

(A slider off the 5% steps, e.g. 62% set in Supabase, still shows 62% and saves as it is until the admin moves it; the browser snaps it to a step once moved.)

- [ ] **Step 3: Use it in Settings**

In `src/pages/Settings.tsx`, add `import { RatingSettingsCard } from '../components/ratingsettings'` and replace the whole `<Card>` that starts with `<Heading className="mb-2">Rating settings</Heading>` with `<RatingSettingsCard />`. Remove `config` from the `useCurrentGroup()` destructuring if it's no longer used.

- [ ] **Step 4: Checkpoint**

Run: `npx tsc -b && npm run lint && npm test`
Expected: all pass.

---

### Task 11: Change history

**Files:**
- Create: `src/lib/audit.ts`, `src/lib/audit.test.ts`, `src/pages/ChangeHistory.tsx`
- Modify: `src/lib/types.ts` (`AuditEntry`), `src/lib/api.ts` (`getAuditLog`, `AUDIT_PAGE`), `src/App.tsx` (route), `src/pages/Settings.tsx` (the link)

**Interfaces:**
- Consumes: the `audit_log` table (file 1; readable by group members) and what each action writes in `details` (files 3-5: `player_id`, `user_id`, `role`, `scorer_id`, `assister_id`, `goal.scorer_id`, `hours`, `reason`, `continue`, `penalty_winner`, `played_at`, `match_id`).
- Produces: `interface AuditEntry { id: string; actor_id: string | null; action: string; details: Record<string, unknown>; created_at: string }`; `getAuditLog(groupId: string, before: string | null): Promise<AuditEntry[]>`; `AUDIT_PAGE = 50`; `type AuditPart = string | { name: string }`; `interface AuditNames { player: (playerId: string) => string; user: (userId: string) => string }`; `describeAudit(entry: AuditEntry, names: AuditNames): AuditPart[]`; route `/settings/history`.

- [ ] **Step 1: Type and API**

In `src/lib/types.ts`, add at the end:

```ts
/** One line of the group's change history (audit_log). */
export interface AuditEntry {
  id: string
  /** The account that did it; null when it was the app itself. */
  actor_id: string | null
  action: string
  details: Record<string, unknown>
  created_at: string
}
```

In `src/lib/api.ts`, add `AuditEntry` to the type imports and, at the end:

```ts
// ---------------------------------------------------------------------------
// Change history (admins)
// ---------------------------------------------------------------------------
export const AUDIT_PAGE = 50

/** The group's change history, newest first, a page at a time (before = the oldest time already shown). */
export async function getAuditLog(groupId: string, before: string | null): Promise<AuditEntry[]> {
  let query = supabase.from('audit_log').select('id, actor_id, action, details, created_at').eq('group_id', groupId)
  if (before) query = query.lt('created_at', before)
  return unwrap(await query.order('created_at', { ascending: false }).limit(AUDIT_PAGE))
}
```

- [ ] **Step 2: Write the failing tests**

Create `src/lib/audit.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { describeAudit, type AuditPart } from './audit'
import type { AuditEntry } from './types'

const names = {
  player: (id: string) => ({ p1: 'Omar', p2: 'Ziad' })[id] ?? 'Unknown player',
  user: (id: string) => ({ u1: 'Captain', u2: 'Omar' })[id] ?? 'a former member',
}

const entry = (action: string, details: Record<string, unknown> = {}, actor = 'u1'): AuditEntry => ({
  id: 'a1',
  actor_id: actor,
  action,
  details,
  created_at: '2026-10-22T19:14:00Z',
})

/** The sentence as plain text, names in [brackets]. */
const text = (parts: AuditPart[]) => parts.map((p) => (typeof p === 'string' ? p : `[${p.name}]`)).join('')
const say = (e: AuditEntry) => text(describeAudit(e, names))

describe('change history lines', () => {
  it('name the players involved', () => {
    expect(say(entry('checked_in', { player_id: 'p1' }))).toBe('checked [Omar] in')
    expect(say(entry('checked_out', { player_id: 'p1' }))).toBe('marked [Omar] as left')
    expect(say(entry('payment_marked', { player_id: 'p2' }))).toBe('ticked off the payment of [Ziad]')
  })

  it('goals: changed, deleted, disputed', () => {
    expect(say(entry('goal_edited', { scorer_id: 'p1', assister_id: 'p2' }))).toBe('changed a goal to [Omar], assist [Ziad]')
    expect(say(entry('goal_edited', { scorer_id: 'p1', assister_id: null }))).toBe('changed a goal to [Omar], no assist')
    expect(say(entry('goal_deleted', { goal: { scorer_id: 'p2' } }))).toBe('deleted a goal by [Ziad]')
    expect(say(entry('goal_disputed'))).toBe('disputed a goal')
  })

  it('voting, games and nights', () => {
    expect(say(entry('voting_extended', { hours: 12 }))).toBe('extended voting by 12 hours')
    expect(say(entry('players_swapped', { continue: false }))).toBe('swapped players and started a new game')
    expect(say(entry('players_swapped', { continue: true }))).toBe('swapped players, and the game went on')
    expect(say(entry('game_ended', { penalty_winner: 'C' }))).toBe('ended a game (Team C won on penalties)')
    expect(say(entry('game_ended', { penalty_winner: null }))).toBe('ended a game')
    expect(say(entry('night_cancelled', { reason: 'rain', fee: 0 }))).toBe('cancelled a night (Rain)')
    expect(say(entry('match_deleted', { played_at: '2026-10-22' }))).toBe('deleted the night of Thu 22 Oct')
  })

  it('members: admins, leaving and being removed', () => {
    expect(say(entry('member_role_changed', { user_id: 'u2', role: 'admin' }))).toBe('made [Omar] an admin')
    expect(say(entry('member_role_changed', { user_id: 'u2', role: 'member' }))).toBe('removed [Omar] as an admin')
    expect(say(entry('member_removed', { user_id: 'u2' }, 'u2'))).toBe('left the group')
    expect(say(entry('member_removed', { user_id: 'u9' }))).toBe('removed [a former member] from the group')
  })

  it("an action the app doesn't know yet shows its name", () => {
    expect(say(entry('something_new'))).toBe('something new')
  })
})
```

- [ ] **Step 3: Run them to see them fail**

Run: `npx vitest run src/lib/audit.test.ts`
Expected: FAIL (`Failed to resolve import "./audit"`).

- [ ] **Step 4: Write audit.ts**

Create `src/lib/audit.ts`:

```ts
// The change history (Plans/Player-card-and-motion.md section 4): each line
// of the audit log as a plain sentence, after the name of who did it. Pure,
// tested in audit.test.ts. The details come from the database actions
// (supabase/migrations, files 3 to 5).
import { CANCEL_REASONS, formatDay } from './format'
import type { AuditEntry, CancelReason } from './types'

/** Plain text, or a name (shown in <Name>, because names can be Arabic). */
export type AuditPart = string | { name: string }

export interface AuditNames {
  /** A player's name from their id. */
  player: (playerId: string) => string
  /** The name of the player an account belongs to. */
  user: (userId: string) => string
}

const text = (value: unknown) => (typeof value === 'string' ? value : '')

/** What someone did: ["checked ", { name: "Omar" }, " in"]. */
export function describeAudit(entry: AuditEntry, names: AuditNames): AuditPart[] {
  const d = entry.details
  const player = (key: string): AuditPart => ({ name: names.player(text(d[key])) })
  const user = (key: string): AuditPart => ({ name: names.user(text(d[key])) })

  switch (entry.action) {
    case 'member_joined':
      return [d.role === 'admin' ? 'joined the group as an admin' : 'joined the group']
    case 'invite_code_regenerated':
      return ['made a new invite code']
    case 'invite_code_disabled':
      return ['turned off invites']
    case 'member_role_changed':
      return d.role === 'admin' ? ['made ', user('user_id'), ' an admin'] : ['removed ', user('user_id'), ' as an admin']
    case 'member_removed':
      return d.user_id === entry.actor_id ? ['left the group'] : ['removed ', user('user_id'), ' from the group']
    case 'lineup_changed':
      return ['changed a lineup']
    case 'match_deleted':
      return [`deleted the night of ${formatDay(text(d.played_at))}`]
    case 'goal_edited':
      return d.assister_id
        ? ['changed a goal to ', player('scorer_id'), ', assist ', player('assister_id')]
        : ['changed a goal to ', player('scorer_id'), ', no assist']
    case 'goal_deleted': {
      const goal = (d.goal ?? {}) as Record<string, unknown>
      return ['deleted a goal by ', { name: names.player(text(goal.scorer_id)) }]
    }
    case 'goal_disputed':
      return ['disputed a goal']
    case 'voting_extended':
      return [`extended voting by ${Number(d.hours)} hours`]
    case 'voting_closed':
      return ['closed voting']
    case 'night_planned':
      return ['planned a night']
    case 'night_changed':
      return ["changed a night's details"]
    case 'night_started':
      return ['started a night']
    case 'checked_in':
      return ['checked ', player('player_id'), ' in']
    case 'checked_out':
      return ['marked ', player('player_id'), ' as left']
    case 'check_in_undone':
      return ['undid the check-in of ', player('player_id')]
    case 'night_ended':
      return ['ended a night']
    case 'night_cancelled':
      return [`cancelled a night (${CANCEL_REASONS[d.reason as CancelReason] ?? 'no reason given'})`]
    case 'payment_marked':
      return ['ticked off the payment of ', player('player_id')]
    case 'payment_unmarked':
      return ['unticked the payment of ', player('player_id')]
    case 'team_board_changed':
      return ['changed the team board']
    case 'game_started':
      return ['started a game']
    case 'players_swapped':
      return [d.continue === false ? 'swapped players and started a new game' : 'swapped players, and the game went on']
    case 'game_ended':
      return [d.penalty_winner ? `ended a game (Team ${text(d.penalty_winner)} won on penalties)` : 'ended a game']
    default:
      return [entry.action.replaceAll('_', ' ')]
  }
}
```

- [ ] **Step 5: Run them to see them pass**

Run: `npx vitest run src/lib/audit.test.ts`
Expected: 5 PASS.

- [ ] **Step 6: The screen**

Create `src/pages/ChangeHistory.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { BackIcon, ChevronIcon } from '../components/icons'
import { Button, Empty, ErrorNote, Heading, Loading, Name, PageTitle } from '../components/ui'
import * as api from '../lib/api'
import { describeAudit, type AuditNames } from '../lib/audit'
import { clockOf, dayOf, errorMessage, formatDay } from '../lib/format'
import type { AuditEntry } from '../lib/types'
import { useCurrentGroup } from '../state/group'

/** Who changed what, and when (admins): the group's audit log, newest first, by day. */
export default function ChangeHistory() {
  const { group, isAdmin, players, playerName } = useCurrentGroup()
  const [entries, setEntries] = useState<AuditEntry[] | null>(null)
  const [more, setMore] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isAdmin) return
    api
      .getAuditLog(group.id, null)
      .then((rows) => {
        setEntries(rows)
        setMore(rows.length === api.AUDIT_PAGE)
      })
      .catch((e: unknown) => setError(errorMessage(e)))
  }, [group.id, isAdmin])

  if (!isAdmin) return <ErrorNote message="Only group admins can see the change history." />
  if (!entries) return error ? <ErrorNote message={error} /> : <Loading />

  // Former members keep their player row, so their names still show.
  const userName = (userId: string) => players.find((p) => p.user_id === userId)?.display_name
  const names: AuditNames = { player: playerName, user: (userId) => userName(userId) ?? 'a former member' }
  const actor = (e: AuditEntry) => (e.actor_id ? (userName(e.actor_id) ?? 'A former member') : 'The app')

  const days = new Map<string, AuditEntry[]>()
  for (const e of entries) {
    const day = dayOf(new Date(e.created_at))
    days.set(day, [...(days.get(day) ?? []), e])
  }

  async function loadMore() {
    if (!entries) return
    setBusy(true)
    setError(null)
    try {
      const rows = await api.getAuditLog(group.id, entries[entries.length - 1].created_at)
      setEntries([...entries, ...rows])
      setMore(rows.length === api.AUDIT_PAGE)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <Link to="/settings" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-muted">
        <BackIcon size={18} /> More
      </Link>
      <PageTitle sub="Who changed what, and when. Newest first.">Change history</PageTitle>
      <ErrorNote message={error} />

      {entries.length === 0 && <Empty title="Nothing yet">Changes show here as the group uses the app.</Empty>}
      {[...days].map(([day, list]) => (
        <section key={day} className="mb-5">
          <Heading className="mb-2">{formatDay(day)}</Heading>
          <ul className="divide-y divide-line overflow-hidden rounded-card border-[1.5px] border-line bg-paper">
            {list.map((e) => {
              // A deleted night can't be opened any more.
              const matchId = typeof e.details.match_id === 'string' && e.action !== 'match_deleted' ? e.details.match_id : null
              const line = (
                <>
                  <span className="tabular w-11 shrink-0 text-sm text-muted">{clockOf(e.created_at)}</span>
                  <p className="min-w-0 flex-1 text-sm">
                    <Name className="font-semibold">{actor(e)}</Name>{' '}
                    {describeAudit(e, names).map((part, i) =>
                      typeof part === 'string' ? (
                        <span key={i}>{part}</span>
                      ) : (
                        <Name key={i} className="font-semibold">
                          {part.name}
                        </Name>
                      ),
                    )}
                  </p>
                </>
              )
              return (
                <li key={e.id}>
                  {matchId ? (
                    <Link to={`/nights/${matchId}`} className="flex min-h-12 items-center gap-3 px-4 py-2">
                      {line}
                      <ChevronIcon size={16} className="shrink-0 text-muted" />
                    </Link>
                  ) : (
                    <div className="flex min-h-12 items-center gap-3 px-4 py-2">{line}</div>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      {more && (
        <Button variant="secondary" className="w-full" busy={busy} onClick={() => void loadMore()}>
          Show more
        </Button>
      )}
    </div>
  )
}
```

- [ ] **Step 7: The route and the link**

In `src/App.tsx`, add `import ChangeHistory from './pages/ChangeHistory'` and, after the `settings` route:

```tsx
        <Route path="settings/history" element={<ChangeHistory />} />
```

In `src/pages/Settings.tsx`, right after `<RatingSettingsCard />`, add:

```tsx
      {isAdmin && (
        <Link
          to="/settings/history"
          className="flex min-h-14 items-center justify-between rounded-card border-[1.5px] border-line bg-paper px-4 font-semibold"
        >
          Change history <ChevronIcon size={18} />
        </Link>
      )}
```

(`Link` and `ChevronIcon` are already imported in Settings.)

- [ ] **Step 8: Checkpoint**

Run: `npx tsc -b && npm run lint && npm test && npm run build`
Expected: all pass.

---

## Part F — The team suggester

### Task 12: New players start at their self-rating

**Files:**
- Modify: `src/lib/suggest.ts` (`playerStrength`), `src/lib/suggest.test.ts`, `src/pages/Teams.tsx`

**Interfaces:**
- Consumes: `selfRating` (Task 4); `players` from the group (with their cards).
- Produces: `NEW_PLAYER_MIN = 4.5`, `NEW_PLAYER_MAX = 7.5`; `playerStrength(playerId, season, allTime, selfRatings = new Map())`.

- [ ] **Step 1: Write the failing test**

In `src/lib/suggest.test.ts`, add `NEW_PLAYER_MAX` and `NEW_PLAYER_MIN` to the import from `./suggest`, and add inside `describe('strength', …)`:

```ts
  it('someone new starts at their self-rating, kept between 4.5 and 7.5 (Plans/Player-card-and-motion.md)', () => {
    const none = new Map<string, number>()
    const self = new Map([['New A', 9.2], ['New B', 3], ['New C', 6.8], ['Rated', 9]])
    expect(playerStrength('New A', none, none, self)).toBe(7.5)
    expect(playerStrength('New B', none, none, self)).toBe(4.5)
    expect(playerStrength('New C', none, none, self)).toBe(6.8)
    expect(playerStrength('New D', none, none, self)).toBe(NEW_PLAYER_STRENGTH)
    expect([NEW_PLAYER_MIN, NEW_PLAYER_MAX]).toEqual([4.5, 7.5])
  })

  it('a real rating always wins over the self-rating', () => {
    const self = new Map([['Rated', 9]])
    expect(playerStrength('Rated', new Map([['Rated', 7.1]]), new Map(), self)).toBe(7.1)
    expect(playerStrength('Rated', new Map(), new Map([['Rated', 6.3]]), self)).toBe(6.3)
  })
```

Run: `npx vitest run src/lib/suggest.test.ts`
Expected: FAIL (`NEW_PLAYER_MIN` is not exported; the self-rating is ignored).

- [ ] **Step 2: The strength**

In `src/lib/suggest.ts`, replace `NEW_PLAYER_STRENGTH` and `playerStrength` with:

```ts
/** The strength of a player with no rating and no self-rating yet. */
export const NEW_PLAYER_STRENGTH = 6
/** A new player's self-rating is kept between these (Plans/Player-card-and-motion.md section 2). */
export const NEW_PLAYER_MIN = 4.5
export const NEW_PLAYER_MAX = 7.5

/**
 * A player's strength: their season rating, then their all-time rating, then
 * (for someone new) their self-rating kept between 4.5 and 7.5, then 6.0.
 */
export function playerStrength(
  playerId: string,
  season: Map<string, number>,
  allTime: Map<string, number>,
  selfRatings: Map<string, number> = new Map(),
): number {
  const rated = season.get(playerId) ?? allTime.get(playerId)
  if (rated !== undefined) return rated
  const self = selfRatings.get(playerId)
  return self === undefined ? NEW_PLAYER_STRENGTH : Math.min(NEW_PLAYER_MAX, Math.max(NEW_PLAYER_MIN, self))
}
```

Update the file's header comment line "from the ratings already stored" to "from the ratings already stored (and, for someone new, their self-rating)".

Run: `npx vitest run src/lib/suggest.test.ts`
Expected: all PASS.

- [ ] **Step 3: The team board passes the self-ratings**

In `src/pages/Teams.tsx`, add `import { selfRating } from '../lib/card'`, add `players` to the `useCurrentGroup()` destructuring, and replace the `strength` line with:

```tsx
  // Someone new starts at their self-rating (their player card), else 6.0.
  const selfRatings = new Map(
    players.flatMap((p) => {
      const self = selfRating(p)
      return self === null ? [] : [[p.id, self] as const]
    }),
  )
  const strength = (playerId: string) => playerStrength(playerId, season, allTime, selfRatings)
```

- [ ] **Step 4: Checkpoint**

Run: `npx tsc -b && npm run lint && npm test`
Expected: all pass.

---

## Part G — Docs, checks and hand-over

### Task 13: How it works, README and the plan index

**Files:**
- Modify: `src/pages/HowItWorks.tsx`, `README.md`, `Plans/README.md`, `Plans/NEXT-SESSION-PROMPT.md`

- [ ] **Step 1: How it works**

In `src/pages/HowItWorks.tsx`, in the Suggest teams bullet, replace `this season's, then all-time, and 6.0 for someone new.` with `this season's, then all-time. Someone new starts at the self-rating on their player card (kept between 4.5 and 7.5), or 6.0.`

Add `<CardExplainer />` after `{config && <RatingExplainer config={config} />}`, and at the end of the file:

```tsx
function CardExplainer() {
  return (
    <Card>
      <Heading className="mb-2">Your player card</Heading>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        <li>
          Fill it in from your profile (<strong>Me → Edit my card</strong>): shirt number, strong foot, favourite position,
          a motto, and how you rate yourself from 1 to 10 on shooting, passing, dribbling, defending and fitness.
        </li>
        <li>
          Your self-rating is the average of the five. <strong>It never changes your night ratings.</strong>
        </li>
        <li>
          Until you've played a rated night, <strong>Suggest teams</strong> uses your self-rating (kept between 4.5 and
          7.5) instead of 6.0.
        </li>
        <li>
          <strong>Self vs friends</strong> on your profile puts your self-rating next to the average score your friends
          give you in their votes: Modest, Spot on, Confident or Very confident. It's just for fun.
        </li>
        <li>Your favourite position is for show: teams have no fixed positions.</li>
      </ul>
    </Card>
  )
}
```

- [ ] **Step 2: README**

In `README.md`:
- **Section 1:** change "**stages 1 to 3 of the 7GZ-KORA upgrade**" to "**stages 1 to 3b of the 7GZ-KORA upgrade**"; in the Suggest teams bullet, replace "(this season's, then all-time, 6.0 for someone new)" with "(this season's, then all-time; someone new starts at their self-rating, or 6.0)"; and add after the "Voting (1–10 …" bullet:

```markdown
- **Player cards:** everyone fills in a card (shirt number, strong foot, favourite position, a motto, and a 1–10 self-rating on shooting, passing, dribbling, defending and fitness), right after joining or later from **Me → Edit my card**. The self-rating never changes a night rating: it's a new player's starting point in Suggest teams, and **Self vs friends** shows it next to what friends give in their votes (Modest, Spot on, Confident or Very confident).
- **Profiles are portfolios:** the card, Self vs friends, a rating history graph (this season or all-time), the last 5 nights' form with an up or down arrow, the best night, the stats, and every night's breakdown.
- **Lively:** screens slide in, cards and lists follow one after another, numbers count up, a GOAL! splash when an admin logs a goal, the Man of the Match star spins in, and "Saved" messages after every action. Confirmations are the app's own pop-up sheets. With "reduce motion" on the phone, only fades remain.
- **Admins** change the rating settings under **More → Rating settings → Edit**, and see **More → Change history** (who changed what, and when).
```

- **Section 2, Step 3:** in item 3, append `, then `20261025000300_player_card.sql`` after `20261025000200_team_suggester.sql`; in the "Already ran some of the files?" note, add after the team suggester sentence: "`20261025000300_player_card.sql` can run at any time too: it adds the player card's columns, empty for everyone."
- **Section 7:** add after item 37:

```markdown
38. **Your player card belongs to the group**, like "Happy in goal": someone in two groups fills in two cards. Shirt numbers can repeat.
39. **The five skills are all or nothing**, so every self-rating is the average of the same five things. The card shows the bars as soon as one is set, and the average once all five are.
40. **The self-rating never changes a night rating.** It's only a new player's starting strength in Suggest teams (kept between 4.5 and 7.5) and the "You say" bar in Self vs friends.
41. **"Friends give"** is the average of the votes you received: this season's once you're on the table this season, otherwise all-time. The labels change at −1.0 (Modest), +1.0 (Confident) and +2.0 (Very confident).
42. **The rating history graph** shows finished nights in order, not by date, so a holiday leaves no gap. Its tabs (season or all-time) also change the form and highlights below it.
43. **The profile photo is still your Google photo.** Uploading photos would need extra storage and isn't planned.
44. **Welcome after joining** keeps the tabs, so you can leave any time. Skip clears that step. "Not now" on Home's reminder is remembered on that phone only.
45. **The GOAL! splash** shows for a goal in the game on now, not for a forgotten goal added later; tap it to close it. Everyone else watching gets a short "Goal for Team A!" message.
46. **Confirmations are the app's own pop-up sheets.** Cancel is picked first, and the risky button is red.
47. **Rating settings in the app** cover the four main settings: the stats share (50–90%, in steps of 5), votes needed (0–5), nights to join the table (1–10) and the voting window (6–72 hours). The point values stay in Supabase.
48. **Change history** is for admins, 50 lines at a time. Each line opens its night, unless the night was deleted.
49. **The animation library (Motion) is pinned to version 14.1.0**, released more than two weeks before this was built. It gets upgraded on purpose later, not by accident.
50. **The demo players have cards**, one with an Arabic motto. Hany's is empty, so you can see an empty card.
```
- **Section 8:** "after the **six** migration files" → "after the **seven** migration files"; add to the demo data paragraph: "Most players have filled in their player card (one Arabic motto, a few very confident self-ratings); Hany hasn't yet." Under Tests, update the count (the number from Task 14 Step 1), add a bullet `- `tests/db/card.test.ts`: the player card (empty at first, your own, admins only for others, the ranges, all five skills or none, nothing else changeable, players from before it) and the rating settings (admins only, the weights still add up to 1)`, and extend the `src/lib/*.test.ts` bullet with ", the player card (the self-rating, Self vs friends and its edges), the rating history (form, trend, best night, the graph's scale), the change history sentences, and new players' starting strength".
- **Project layout:** `games + night ratings (5), team suggester setting (6)` → `games + night ratings (5), team suggester setting (6), player card (7)`.
- **Section 10:** "One of the six SQL files" → "One of the seven SQL files", and add a row:

```markdown
| "column players.shirt_number does not exist", or the app can't load your group | `20261025000300_player_card.sql` hasn't been run yet. Run it in the SQL Editor (section 2, Step 3). |
```

- [ ] **Step 3: The plan index and the next-session prompt**

In `Plans/README.md`, add a row 6 to the files table:

```markdown
| 6 | `Player-card-and-motion.md` | Player cards and self-ratings, Self vs friends, profiles as portfolios with rating history, animation (Motion), rating settings in the app, change history | **Built** as stage 3b (2026-10-25) |
```

and in the build order, after item 3:

```markdown
3b. **Player card, rating history and motion** (`Player-card-and-motion.md`)
```

In `Plans/NEXT-SESSION-PROMPT.md`, section 3 ("Where things stand"): add a bullet "**Stage 3b** (player cards and self-ratings, Self vs friends, the portfolio profile with rating history, Motion animation, rating settings in the app, change history; migration file 7, `20261025000300_player_card.sql`) built on 2026-10-25; see `Plans/implementation/stage-3b-player-card.md`.", update the test count and "all 7 migration files", and in the reading list (section 2) add `Plans/Player-card-and-motion.md` after `Plans/Install-first-access.md`. Add to section 4: "**Animation:** use only `m` components (`motion/react-m`) inside the app's `LazyMotion strict`, animate `transform`/`opacity`, and respect reduce motion (`src/components/motion.tsx`). Confirmations use `useConfirm()`, never `window.confirm`; success messages use `useToast()`."

- [ ] **Step 4: Checkpoint**

Run: `npx tsc -b && npm run lint && npm test && npm run build`
Expected: all pass.

---

### Task 14: Verify everything and hand over

**Files:**
- Temporary only, in the session's scratch folder (`$SCRATCH` below): `standin/` and `shots/`. Nothing here is added to the project.

- [ ] **Step 1: The four checks and the bundle**

Run: `npx tsc -b && npm run lint && npm test && npm run build`
Expected: all pass. Note the number of tests (and check the README says the same), and the main bundle size next to Task 1's "before" number, plus the `motionFeatures` chunk.

- [ ] **Step 2: Rule greps**

```bash
grep -rn "window.confirm" src                                  # nothing
grep -rn "from 'motion/react'" src | grep -E "\bmotion\b[,} ]" # nothing: no `motion` component imported (only m)
grep -rnE "\b(text-white|bg-white)\b" src                      # only SignIn and InstallScreen (logo lettering)
git diff --stat -- supabase/migrations/2026102300* supabase/migrations/20261024000100_nights.sql \
  supabase/migrations/20261025000100_games.sql supabase/migrations/20261025000200_team_suggester.sql   # nothing
grep -rn "compute_match_ratings" supabase/migrations/20261025000300_player_card.sql                    # only the comment
```

- [ ] **Step 3: Start a temporary stand-in for Supabase**

Exactly as `Plans/implementation/stage-3.md` Task 6 Step 3: copy `session.mjs`, `db.mjs`, `postgrest.conf`, `proxy.mjs` and `shots.mjs` out of `Plans/implementation/stage-2.md` Task 11 with the `extract.mjs` script given there, install `@electric-sql/pglite@0.5 @electric-sql/pglite-socket playwright-core`, and download PostgREST 14.18. Then make two changes to the copied `shots.mjs`:
- In `browser.newContext({ … })`, add `reducedMotion: process.env.REDUCE ? 'reduce' : 'no-preference',` (for the "reduce motion" check).
- After the optional `CLICK` block, add an optional second click, for flows of two taps:

```js
    if (process.env.CLICK2) {
      await page.getByRole('button', { name: process.env.CLICK2 }).first().click()
      await page.waitForTimeout(process.env.WAIT ? Number(process.env.WAIT) : 500)
    }
```

and add `${process.env.CLICK2 ? '-click2' : ''}${process.env.REDUCE ? '-reduce' : ''}` to the screenshot name after the `-click` part.

Write `$SCRATCH/standin/live.mjs`:

```js
// Sets up what the screen checks need. No argument: starts the planned demo
// night with everyone checked in and game 1 on (the first 12 by name on
// Team A and Team B). "vote": checks Owner in to yesterday's night (voting
// is open), so Owner can vote. Prints the ids it used.
import { jwt } from './session.mjs'

const base = 'http://localhost:54321/rest/v1'
const headers = { apikey: 'stand-in', Authorization: `Bearer ${jwt()}`, 'content-type': 'application/json' }
const get = async (path) => (await fetch(`${base}/${path}`, { headers })).json()
async function rpc(fn, args) {
  const res = await fetch(`${base}/rpc/${fn}`, { method: 'POST', headers, body: JSON.stringify(args) })
  const text = await res.text()
  if (!res.ok) throw new Error(`${fn}: ${text}`)
  return text ? JSON.parse(text) : null
}

const players = await get('players?select=id,display_name&order=display_name')
if (process.argv[2] === 'vote') {
  const [night] = await get('matches?status=eq.voting&select=id')
  const owner = players.find((p) => p.display_name === 'Owner')
  await rpc('check_in', { p_match_id: night.id, p_player_id: owner.id })
  console.log('owner can vote on', night.id)
} else {
  const [night] = await get('matches?status=eq.draft&select=id')
  await rpc('start_night', { p_match_id: night.id })
  for (const p of players) await rpc('check_in', { p_match_id: night.id, p_player_id: p.id })
  const board = players.slice(0, 12).map((p, i) => ({ player_id: p.id, team: i < 6 ? 'A' : 'B' }))
  await rpc('set_team_board', { p_match_id: night.id, p_board: board })
  await rpc('start_game', { p_match_id: night.id, p_team_one: 'A', p_team_two: 'B', p_keeper_one: null, p_keeper_two: null })
  console.log('live night', night.id)
}
console.log(Object.fromEntries(players.map((p) => [p.display_name, p.id])))
```

Start everything (each in the background), as in stage 3: `db.mjs`, `postgrest.exe`, `proxy.mjs`, and Vite on a free port (5181 if 5173 and 5180 are taken; don't stop the owner's processes). Then run `node "$SCRATCH/standin/live.mjs"` and `node "$SCRATCH/standin/live.mjs" vote`, and keep the ids they print.

- [ ] **Step 4: Check every PostgREST read (no `PGRST201`, no missing column)**

```bash
cd "$SCRATCH/standin"
TOKEN=$(node -e "import('./session.mjs').then((m) => console.log(m.jwt()))")
for q in \
  "players?select=id,group_id,user_id,display_name,is_guest,happy_in_goal,shirt_number,strong_foot,favourite_position,motto,skill_shooting,skill_passing,skill_dribbling,skill_defending,skill_fitness,profiles!players_user_id_fkey(avatar_url)" \
  "audit_log?select=id,actor_id,action,details,created_at&order=created_at.desc&limit=50" \
  "group_members?select=role,player_id,groups(id,name,invite_code,min_extra_team_size)" \
  "match_ratings?select=*,matches!inner(*)" \
  "rating_config?select=*"; do
  curl -s -o /dev/null -w "%{http_code} $q\n" "http://localhost:54321/rest/v1/$q" -H "apikey: stand-in" -H "Authorization: Bearer $TOKEN"
done
```

Expected: `200` on every line. Then save a card through PostgREST the way the app does (a `PATCH` on `players?id=eq.<Owner's id>` with the nine fields plus `display_name` and `happy_in_goal`) and expect `204`.

- [ ] **Step 5: Screens against the design**

```bash
cd "$SCRATCH/standin"
export MSYS_NO_PATHCONV=1
S="$SCRATCH/shots"; APP=http://localhost:5181; L=<live night id>; V=<yesterday's night id>
node shots.mjs $APP "$S" / /welcome /players/<Owner> /players/<Owner>/edit /players/<Youssef> /players/<Omar> /players/<Hany> /table /settings /settings/history /how-it-works /nights /nights/<last week> /nights/$V/vote
CLICK="Edit" node shots.mjs $APP "$S" /settings                                   # the rating settings editor
CLICK="Leave this group" node shots.mjs $APP "$S" /settings                       # the pop-up sheet (don't confirm)
CLICK="Next" node shots.mjs $APP "$S" /welcome                                    # welcome step 2
CLICK="Edit" CLICK2="Save" node shots.mjs $APP "$S" /settings                     # "Rating settings saved"
CLICK="Mahmoud" CLICK2="No assist" WAIT=250 node shots.mjs $APP "$S" /nights/$L/record   # the GOAL! splash (Mahmoud is on the pitch in game 1)
AS=member node shots.mjs $APP "$S" /settings /settings/history /players/<Omar>    # no Edit, no Change history link; "only admins"
REDUCE=1 node shots.mjs $APP "$S" /players/<Youssef> /nights/<last week>           # reduce motion: everything still there
```

Open each PNG and compare with the design (`Design/screens.html` in Edge at the same width, and `Design/README.md` sections 3-6, 8):
- **Player card:** the honeycomb band with **black** text, the rating badge with a black outline (counted up to its number), the big shirt number; the name, the role line, the chips (position, foot, Happy in goal), the motto in quotes (the Arabic one reads right to left inside its quotes), the five bars and the self-rating; Hany's card has no chips, bars or number; Owner's says "New".
- **Self vs friends:** two bars on the same scale and a chip (Modest outline / Spot on green / Confident amber / Very confident red outline) with the gap; Owner: "Rate yourself on your card…"; Hany: "No self-rating yet".
- **Rating history:** the line, the band lines at 6/7/8 with their numbers, the latest night picked with its badge and date, the tabs; the form badges and the arrow word; Best night and Man of the Match.
- **Nights list on the profile:** tap a night (one more run with `CLICK="<that night's date>"`) shows the breakdown inside the list, with "Open the night".
- **Edit my card:** the live preview, the name, number, foot (segmented, black on green), position pills, motto, the five tap rows, Clear, the goal switch, the sticky Save card.
- **Welcome:** the three dots, Not now, step 1's fields, step 2's skills.
- **Home (Owner):** "Finish your player card" with Set up my card and Not now.
- **Settings:** the Rating settings card with Edit; the editor (slider, 0-5, − 3 +, 6-72); the pop-up sheet (title, message, Cancel focused, red Leave group); after Save, the "Rating settings saved" message above the tab bar; the Change history link (admin only).
- **Change history:** days as headings, times, bold names, sentences ("checked Owner in", "started a game", …), links to nights.
- **GOAL!:** full-screen honeycomb, "GOAL!" in black, Mahmoud's name, the team chip, white balls flying out.
- **Results (last week):** the gold star and the shine (in the PNG, after the animation: a gold-bordered card with the star), the ratings list, a breakdown opened.
- **Vote:** the 1-10 rows (42 px), the progress bar in the sticky footer.
- **Table:** rows in place (the sort-change glide is checked by hand in the browser).
- **Reduce motion:** the same screens look complete (cards, bars at full length, the graph's line drawn).
- Every console line says `fits` (no sideways scrolling at 390 px); black text on every green surface; dark mode keeps the brand green, bib colours and rating bands; Arabic names left-aligned.

Also check by hand in the browser at 390 px (Edge's device toolbar): a screen sliding in, the tab bubble gliding, cards cascading on Home, a count-up, the table re-sorting, the graph responding to a tap and to sliding a finger, the arrow keys on the graph, Escape and Tab in the sheet.

Fix anything that doesn't match, then rerun Step 1. Stop the background processes when done.

- [ ] **Step 6: Report to the owner and ask about the commit**

Tell the owner in plain words:
- What was built and how it was tested (the number of tests, the four checks, the screens checked, the bundle size before and after, and anything that still looks off).
- The decisions this plan made (the list at the top of this file).
- **What they need to do, in order:** (1) if not done yet, run `20261025000200_team_suggester.sql` (file 6) in the Supabase SQL Editor; (2) run `20261025000300_player_card.sql` (file 7), once, any time; (3) only then push to GitHub, because every push updates the app on Vercel and the new app needs both. Explain it in plain steps.
- What's still open: stage 4 (punishments and loyalty points) and stage 5; the real-phone sign-in test and Google Publish (README section 3 and Step 6e), if not done yet.

Then ask with AskUserQuestion: "Commit stage 3b straight to main (Recommended)" — their usual — / "Commit on a new branch" / "Don't commit yet".

Commit only this stage's files:

```bash
git add package.json package-lock.json supabase/migrations/20261025000300_player_card.sql supabase/seed.sql \
  tests/db/card.test.ts tests/db/seed.test.ts src README.md \
  Plans/Player-card-and-motion.md Plans/implementation/stage-3b-player-card.md Plans/README.md Plans/NEXT-SESSION-PROMPT.md
git status --short   # nothing else staged; any change of the owner's own stays unstaged
git commit -m "Build stage 3b: player cards, rating history and motion"
```

End the commit message with the attribution line. Don't push unless asked. Add a "Changes made during the build" section to this file, and update the project-status memory (stage 3b built and committed; the owner must run files 6 and 7 before pushing).

---

## Spec coverage

| Requirement (`Plans/Player-card-and-motion.md`) | Task |
|---|---|
| §0, §1 Card fields: number 1-99, foot, favourite position (show only), motto ≤ 60, five skills 1-10, all five or none | 3, 4, 5 |
| §1 Yourself or an admin edits; everyone in the group sees every card | 3 (permissions), 5 |
| §1 The card: honeycomb band, black text, rating or "New", number, name, chips, motto, bars and self-rating; no real club or game designs | 5, 9 |
| §1 Edit my card: live preview, the fields in order, the 1-10 tap rows, Save → "Card saved"; name and Happy in goal moved here | 5 |
| §1 Welcome after Join/Create: three steps, Skip on each, Done saves at once; Home "Finish your player card", Not now per phone | 6 |
| §2 Never changes a night rating; `compute_match_ratings` untouched | 3 (file 7 comment), 14 (grep) |
| §2 Suggester: season → all-time → self-rating kept 4.5-7.5 → 6.0; limits beside `NEW_PLAYER_STRENGTH` | 12 |
| §2 Self vs friends: `avg_votes`, season then all-time by the table's nights rule, "Play N more nights", the four labels and their edges, "Not enough votes yet" | 4, 8 |
| §2 Worked examples (self-rating, the meter, starting strength) as unit tests | 4, 12 |
| §3 Portfolio order: card, Self vs friends, rating history, form, highlights, stats, nights with inline breakdown | 8 |
| §3 Graph: Season / All-time, band lines, pick a night (badge with number), dots in the line colour, nights in order, one dot / empty state, no chart library | 7, 8 |
| §3 Form: last 5, average, arrow at ±0.2 against the (up to 5) before, none under 6 nights; worked examples as tests | 7 |
| §4 Rating settings: the four settings with their choices, admins only, apply from now on, no database change | 3 (tests), 10 |
| §4 Change history: newest first, 50 at a time, Show more, plain sentences with who and when, unknown actions shown, no database change | 11 |
| §5 Motion: `motion`, `LazyMotion` + `m` + `strict`, `domMax` loaded async, `reducedMotion="user"`, bundle size reported | 1, 14 |
| §5 Screens slide in; the tab bubble; lists and cards cascade (not on live refresh); count-ups; score bounce; GOAL! splash and the live "Goal!" message; Man of the Match star and shine; vote pops and progress; the switch springs; breakdowns open smoothly; the logo bounces; shimmering placeholders | 1, 2, 5, 8, 9 |
| §5 `useConfirm()` replaces all 10 `window.confirm` (focus, Escape, red risky button); `useToast()` messages | 2 |
| §5 Only `transform` and `opacity`; the button press and the Live dot stay | 1, 9 (and Global Constraints) |
| §6 File 7: the columns, checks and grant; the tests listed; demo cards | 3 |
| §7 Screens: Welcome, Edit my card, profile, Home, More (Edit, Change history), Change history, team board, How it works | 5, 6, 8, 10, 11, 12, 13 |
| §8 Build order | Parts A-G follow it |
| §9 Choices made for the owner | carried into README section 7 (13) |
| Docs in sync: README, seed, How it works, `Plans/README.md`, the next-session prompt; 390 px light/dark and reduce-motion checks; the owner runs file 7 | 3, 13, 14 |



---

## Changes made during the build

- **`CountUp` and `Bump` use the browser's own animation tools** (`requestAnimationFrame` and `element.animate`) instead of Motion's `animate` and `useAnimate`. With Motion's versions, its animation engine moved out of the background chunk into the first download (the main bundle went from 190 to 208 kB gzip in Task 9). With the browser's tools it stays in the background chunk. Same behaviour, same reduce-motion handling.
- **Tasks 10 and 11 were checked together:** between them, `ChevronIcon` in Settings is unused (Task 10 removes the card that used it; Task 11's Change history link uses it again).
- **Code copied out of this file** with a small node script, as in stage 3; no other code changes from the plan. Every new test failed first and passed once its code was added.
- **Tests:** 174 (129 + 10 card database tests + 1 seed test + 14 card + 13 trend + 5 change history + 2 suggester).
- **Bundle:** before, the main file was 598.7 kB (170.3 kB gzip). After, it's 683.3 kB (197.7 kB gzip), plus the animation features in their own chunk, 85.9 kB (28.5 kB gzip), loaded in the background and kept offline by the service worker.
- **Stand-in:** ports 5173, 5180 and 5181 were taken by other processes, so the stand-in app ran on **5182**; nothing else was stopped. `live.mjs` needed no "vote" mode: the stand-in's `db.mjs` already checks Owner in to yesterday's night.
- **Screens checked** (390 px, light and dark, all `fits`): Home with "Finish your player card"; Welcome (steps 1 and 2); Owner's empty card ("New", Self vs friends nudge, the empty rating history); Youssef (Spot on), Omar (Confident), محمد (Arabic name and motto, the grey 5.8 badge with its outline) and Hany (empty card); Edit my card; the Table; More with the rating settings editor (saving 48 hours read back from the database, the "Rating settings saved" message) and the Change history link; Change history ("checked محمد in", links to nights); the pop-up sheet (Cancel focused, Escape closes it, Tab stays inside); the GOAL! splash for Mahmoud; last week's results (star, shine, ratings) and the vote screen; a member's view (no Edit, no Change history, "Only this player or an admin can change this card"); and Youssef's profile and last week's results with reduce motion on (everything complete). The graph answered taps and the arrow keys; a night's breakdown opened in the list; every PostgREST read returned 200 and a card saved through PostgREST (204). No browser console errors.
