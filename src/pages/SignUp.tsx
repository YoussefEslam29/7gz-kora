import { AnimatePresence } from 'motion/react'
import * as m from 'motion/react-m'
import { useState, type ReactNode } from 'react'
import { PlayerCard } from '../components/card'
import { BackIcon } from '../components/icons'
import { Button, ErrorNote, ScoreButton, Toggle } from '../components/ui'
import * as api from '../lib/api'
import { accountCard, cleanCard, FEET, POSITIONS } from '../lib/card'
import { errorMessage } from '../lib/format'
import { isSkillStep, SIGN_UP_STEPS, skipStep, startDraft, type SignUpStep } from '../lib/signup'
import type { AccountInput } from '../lib/types'
import { googleName } from '../lib/user'
import { useAccount, useMyAccount } from '../state/account'
import { useAuth } from '../state/auth'

const QUESTIONS: Record<SignUpStep, string> = {
  name: 'What should we call you?',
  shirt: 'Your shirt number?',
  foot: 'Your strong foot?',
  position: 'Where do you like to play?',
  skill_shooting: 'How good is your shooting?',
  skill_passing: 'How good is your passing?',
  skill_dribbling: 'How good is your dribbling?',
  skill_defending: 'How good is your defending?',
  skill_fitness: 'How good is your fitness?',
  goal: 'Happy to play in goal?',
  motto: 'Your motto?',
  card: 'Your card',
}

const input = 'mt-6 h-14 w-full rounded-xl border-[1.5px] border-line bg-paper px-4 text-xl'

/** A big answer: green with black text once chosen. One tap answers and moves on. */
function Choice({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <m.button
      type="button"
      whileTap={{ scale: 0.97 }}
      aria-pressed={selected}
      onClick={onClick}
      className={`min-h-16 w-full rounded-2xl border-2 px-5 text-left font-display text-xl ${
        selected ? 'border-[#0b0b0b] bg-brand text-on-brand' : 'border-line bg-paper text-ink'
      }`}
    >
      {children}
    </m.button>
  )
}

/**
 * The sign-up questions (Plans/Accounts-groups-and-chat.md section 2): right
 * after the first sign-in, one per screen, each with Skip. Done saves
 * everything at once; leaving halfway keeps nothing.
 */
export default function SignUp() {
  const account = useMyAccount()
  const { refresh } = useAccount()
  const { user } = useAuth()
  const [index, setIndex] = useState(0)
  const [draft, setDraft] = useState<AccountInput>(() => startDraft(account, googleName(user)))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const step = SIGN_UP_STEPS[index]
  const total = SIGN_UP_STEPS.length

  const change = (changes: Partial<AccountInput>) => setDraft((d) => ({ ...d, ...changes }))
  const next = () => setIndex((i) => Math.min(i + 1, total - 1))
  /** Tapping an answer moves on by itself. */
  const answer = (changes: Partial<AccountInput>) => {
    change(changes)
    next()
  }

  function skip() {
    const skipped = skipStep(index, draft)
    setDraft(skipped.draft)
    setIndex(skipped.index)
  }

  async function done() {
    setBusy(true)
    setError(null)
    try {
      await api.finishSignUp(cleanCard({ ...draft, display_name: draft.display_name.trim() || account.display_name }))
      // Signed up: the app opens.
      await refresh()
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
    }
  }

  let body: ReactNode = null
  let hint: string | null = null
  // Typing questions need Next; the others move on when tapped (Next shows once answered, after Back).
  let answered = true
  if (step === 'name') {
    hint = 'This is what your friends will see. Arabic is fine.'
    answered = draft.display_name.trim() !== ''
    body = (
      <input
        className={input}
        aria-label="Your name"
        value={draft.display_name}
        maxLength={40}
        dir="auto"
        onChange={(e) => change({ display_name: e.target.value })}
      />
    )
  } else if (step === 'shirt') {
    body = (
      <input
        aria-label="Shirt number"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={2}
        placeholder="10"
        value={draft.shirt_number ?? ''}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').slice(0, 2)
          const n = Number(digits)
          change({ shirt_number: digits === '' || n === 0 ? null : n })
        }}
        className="tabular mt-6 block h-24 w-36 rounded-2xl border-2 border-line bg-paper text-center font-display text-6xl"
      />
    )
  } else if (step === 'foot') {
    answered = draft.strong_foot != null
    body = (
      <div className="mt-6 space-y-2">
        {FEET.map((f) => (
          <Choice key={f.value} selected={draft.strong_foot === f.value} onClick={() => answer({ strong_foot: f.value })}>
            {f.label}
          </Choice>
        ))}
      </div>
    )
  } else if (step === 'position') {
    hint = 'Just for show: teams have no fixed positions.'
    answered = draft.favourite_position != null
    body = (
      <div className="mt-6 space-y-2">
        {POSITIONS.map((p) => (
          <Choice
            key={p.value}
            selected={draft.favourite_position === p.value}
            onClick={() => answer({ favourite_position: p.value })}
          >
            {p.label}
          </Choice>
        ))}
      </div>
    )
  } else if (isSkillStep(step)) {
    hint = 'Be honest: it never changes your night ratings.'
    answered = draft[step] != null
    body = (
      <div className="mt-6 grid grid-cols-5 gap-2" role="group" aria-label={QUESTIONS[step]}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <ScoreButton key={n} n={n} selected={draft[step] === n} onClick={() => answer({ [step]: n })} />
        ))}
      </div>
    )
  } else if (step === 'goal') {
    hint = 'Players happy in goal are suggested first when a game needs a goalkeeper.'
    body = (
      <div className="mt-6 space-y-2">
        <Choice selected={draft.happy_in_goal} onClick={() => answer({ happy_in_goal: true })}>
          Yes
        </Choice>
        <Choice selected={!draft.happy_in_goal} onClick={() => answer({ happy_in_goal: false })}>
          No
        </Choice>
      </div>
    )
  } else if (step === 'motto') {
    hint = 'Up to 60 characters. Arabic is fine.'
    body = (
      <input
        className={input}
        aria-label="Motto"
        value={draft.motto ?? ''}
        maxLength={60}
        dir="auto"
        placeholder="Pass it to me"
        onChange={(e) => change({ motto: e.target.value })}
      />
    )
  } else {
    hint = 'You can change all of it later, from your account.'
    body = (
      <div className="mt-6 space-y-3">
        <PlayerCard player={accountCard({ ...account, ...draft })} isMe preview />
        <Toggle
          checked={draft.show_stats}
          onChange={(on) => change({ show_stats: on })}
          label="Show my stats"
          hint="Off: only you see your skills and self-rating."
        />
      </div>
    )
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-[calc(env(safe-area-inset-bottom)+16px)]">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Back"
          disabled={index === 0 || busy}
          onClick={() => setIndex(index - 1)}
          className="flex size-12 items-center justify-center rounded-full disabled:invisible"
        >
          <BackIcon size={22} />
        </button>
        <div aria-hidden className="h-2 flex-1 overflow-hidden rounded-full bg-line">
          <m.div
            className="h-full origin-left rounded-full bg-brand"
            initial={false}
            animate={{ scaleX: (index + 1) / total }}
            transition={{ duration: 0.3 }}
          />
        </div>
        <span className="tabular w-12 text-right text-sm font-semibold text-muted">
          {index + 1}/{total}
        </span>
      </div>
      <p className="sr-only" role="status">
        Question {index + 1} of {total}
      </p>

      <AnimatePresence mode="wait" initial={false}>
        <m.section
          key={step}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.2 }}
          className="mt-8"
        >
          {index === 0 && <p className="label mb-2">Welcome to 7GZ-KORA</p>}
          <h1 className="font-display text-[34px] leading-[1.05]">{QUESTIONS[step]}</h1>
          {hint && <p className="mt-2 text-muted">{hint}</p>}
          {body}
        </m.section>
      </AnimatePresence>

      <ErrorNote message={error} />
      <div className="mt-auto flex gap-2 pt-8">
        {step === 'card' ? (
          <Button size="lg" className="w-full" busy={busy} onClick={() => void done()}>
            Done
          </Button>
        ) : (
          <>
            <Button variant="ghost" className="flex-1" onClick={skip}>
              {isSkillStep(step) ? 'Skip the skills' : 'Skip'}
            </Button>
            {answered && (
              <Button className="flex-[2]" onClick={next}>
                Next
              </Button>
            )}
          </>
        )}
      </div>
    </main>
  )
}
