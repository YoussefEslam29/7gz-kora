import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Button, ErrorNote, Loading, PageTitle } from '../components/ui'
import * as api from '../lib/api'
import { errorMessage, formatLength } from '../lib/format'
import { capFor, formFromNight, formToDetails, nightDefaults, withSide } from '../lib/night'
import type { NightForm } from '../lib/types'
import { useCurrentGroup } from '../state/group'

const input = 'mt-1 h-12 w-full rounded-xl border-[1.5px] border-line bg-paper px-3 text-base'
const LENGTHS = [60, 90, 120, 150, 180]
const SIDES = [5, 6, 7]

/** Plan a night (/nights/new), pre-filled from the last one, or edit one (/nights/:id/edit). Admins only. */
export default function PlanNight() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { group, players, isAdmin, myPlayerId } = useCurrentGroup()
  const [form, setForm] = useState<NightForm | null>(null)
  const [busy, setBusy] = useState<'save' | 'delete' | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = id
      ? api.getMatch(id).then((d) => formFromNight(d.match))
      : api.getLastNight(group.id).then((last) => nightDefaults(last, myPlayerId, new Date()))
    load.then(setForm).catch((e: unknown) => setError(errorMessage(e)))
  }, [id, group.id, myPlayerId])

  if (!isAdmin) return <ErrorNote message="Only group admins can plan nights." />
  if (!form) return error ? <ErrorNote message={error} /> : <Loading />

  const set = (patch: Partial<NightForm>) => setForm({ ...form, ...patch })
  const lengths = [...new Set([...LENGTHS, form.duration_minutes])].sort((a, b) => a - b)
  const sides = [...new Set([...SIDES, form.players_per_side])].sort((a, b) => a - b)

  async function save() {
    if (!form) return
    setBusy('save')
    setError(null)
    try {
      const details = formToDetails(form)
      if (id) {
        await api.updateNight(id, details)
        navigate(`/nights/${id}`)
      } else {
        navigate(`/nights/${await api.planNight(group.id, details)}`)
      }
    } catch (e) {
      setError(errorMessage(e))
      setBusy(null)
    }
  }

  async function remove() {
    if (!id || !window.confirm('Delete this night with its replies, goals, votes and ratings? This cannot be undone.')) return
    setBusy('delete')
    try {
      await api.deleteMatch(id)
      navigate('/nights')
    } catch (e) {
      setError(errorMessage(e))
      setBusy(null)
    }
  }

  return (
    <div>
      <PageTitle sub={id ? undefined : 'Filled in from your last night. Check it and tap Plan night.'}>
        {id ? 'Edit night' : 'Plan a night'}
      </PageTitle>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm font-medium">Date</span>
            <input type="date" required value={form.day} onChange={(e) => set({ day: e.target.value })} className={input} />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Start</span>
            <input type="time" required value={form.time} onChange={(e) => set({ time: e.target.value })} className={input} />
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-medium">Pitch</span>
          <input
            value={form.location}
            maxLength={80}
            dir="auto"
            placeholder="Club pitch 3"
            onChange={(e) => set({ location: e.target.value })}
            className={input}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm font-medium">Length</span>
            <select value={form.duration_minutes} onChange={(e) => set({ duration_minutes: Number(e.target.value) })} className={input}>
              {lengths.map((m) => (
                <option key={m} value={m}>
                  {formatLength(m)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium">Total cost (EGP)</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={form.cost}
              onChange={(e) => set({ cost: Number(e.target.value) })}
              className={input}
            />
          </label>
        </div>

        <div>
          <p className="text-sm font-medium">Players per side</p>
          <div className="seg mt-1" role="group" aria-label="Players per side">
            {sides.map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={form.players_per_side === n}
                className={form.players_per_side === n ? 'sel' : ''}
                onClick={() => setForm(withSide(form, n))}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="text-sm font-medium">Collector</span>
          <select
            value={form.collector_player_id ?? ''}
            onChange={(e) => set({ collector_player_id: e.target.value || null })}
            className={input}
          >
            <option value="">Not picked yet</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-muted">Everyone pays their share to this person, who pays the pitch.</span>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm font-medium">Game length (min)</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={120}
              value={form.game_minutes}
              onChange={(e) => set({ game_minutes: Number(e.target.value) })}
              className={input}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Player limit</span>
            <input
              type="number"
              inputMode="numeric"
              min={2}
              max={100}
              disabled={form.player_cap === null}
              placeholder="No limit"
              value={form.player_cap ?? ''}
              onChange={(e) => set({ player_cap: Number(e.target.value) })}
              className={`${input} disabled:opacity-50`}
            />
          </label>
        </div>
        <label className="flex min-h-12 items-center gap-3">
          <input
            type="checkbox"
            className="size-5 accent-[var(--brand)]"
            checked={form.player_cap === null}
            onChange={(e) => set({ player_cap: e.target.checked ? null : capFor(form.players_per_side) })}
          />
          <span>No player limit (no waiting list)</span>
        </label>
      </div>

      <ErrorNote message={error} />

      <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-10 mt-4">
        <Button size="lg" className="w-full" busy={busy === 'save'} onClick={() => void save()}>
          {id ? 'Save changes' : 'Plan night'}
        </Button>
      </div>

      {id && (
        <Button variant="danger" className="mt-6 w-full" busy={busy === 'delete'} onClick={() => void remove()}>
          Delete night
        </Button>
      )}
    </div>
  )
}
