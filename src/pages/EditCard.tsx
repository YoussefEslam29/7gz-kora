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
