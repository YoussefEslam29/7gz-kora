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
