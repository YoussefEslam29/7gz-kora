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
