import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { GloveIcon } from '../components/icons'
import { Avatar, Button, ErrorNote, Loading, Name, Notice, PageTitle } from '../components/ui'
import * as api from '../lib/api'
import { errorMessage, todayIso } from '../lib/format'
import type { LineupEntry, MatchStatus, Team } from '../lib/types'
import { useCurrentGroup } from '../state/group'

type Pick = { team: Team; gk: boolean }

/** Create a match (/matches/new) or edit one (/matches/:id/edit). Admins only. */
export default function MatchEdit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { group, players, isAdmin } = useCurrentGroup()
  const [playedAt, setPlayedAt] = useState(todayIso())
  const [location, setLocation] = useState('')
  const [picks, setPicks] = useState<Map<string, Pick>>(new Map())
  const [status, setStatus] = useState<MatchStatus>('playing')
  const [loading, setLoading] = useState(Boolean(id))
  const [busy, setBusy] = useState<'save' | 'delete' | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    api
      .getMatch(id)
      .then((d) => {
        setPlayedAt(d.match.played_at)
        setLocation(d.match.location ?? '')
        setStatus(d.match.status)
        setPicks(new Map(d.lineup.map((p) => [p.player_id, { team: p.team, gk: p.is_goalkeeper }])))
      })
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false))
  }, [id])

  if (!isAdmin) return <ErrorNote message="Only group admins can create or edit matches." />
  if (loading) return <Loading />

  const lineupLocked = status === 'closed'
  const count = (team: Team) => [...picks.values()].filter((p) => p.team === team).length

  function setTeam(playerId: string, team: Team | null) {
    setPicks((prev) => {
      const next = new Map(prev)
      if (team === null) next.delete(playerId)
      else next.set(playerId, { team, gk: prev.get(playerId)?.team === team ? prev.get(playerId)!.gk : false })
      return next
    })
  }

  // One goalkeeper per team: picking a new one replaces the old one.
  function toggleGk(playerId: string) {
    setPicks((prev) => {
      const next = new Map(prev)
      const me = prev.get(playerId)
      if (!me) return prev
      for (const [pid, p] of next) if (p.team === me.team && p.gk) next.set(pid, { ...p, gk: false })
      next.set(playerId, { ...me, gk: !me.gk })
      return next
    })
  }

  async function save() {
    setBusy('save')
    setError(null)
    const lineup: LineupEntry[] = [...picks.entries()].map(([player_id, p]) => ({
      player_id,
      team: p.team,
      is_goalkeeper: p.gk,
    }))
    try {
      if (id) {
        await api.updateMatchDetails(id, playedAt, location)
        if (!lineupLocked) await api.saveLineup(id, lineup)
        navigate(`/matches/${id}`)
      } else {
        const newId = await api.createMatch(group.id, playedAt, location, lineup)
        navigate(`/matches/${newId}`)
      }
    } catch (e) {
      setError(errorMessage(e))
      setBusy(null)
    }
  }

  async function remove() {
    if (!id || !window.confirm('Delete this match, its goals, votes and ratings? This cannot be undone.')) return
    setBusy('delete')
    try {
      await api.deleteMatch(id)
      navigate('/matches')
    } catch (e) {
      setError(errorMessage(e))
      setBusy(null)
    }
  }

  return (
    <div>
      <PageTitle sub={id ? undefined : 'Tick who played and pick teams. You can add late arrivals later.'}>
        {id ? 'Edit match' : 'New match'}
      </PageTitle>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-sm font-medium">Date</span>
          <input
            type="date"
            value={playedAt}
            required
            onChange={(e) => setPlayedAt(e.target.value)}
            className="mt-1 h-12 w-full rounded-xl border border-line bg-card px-3 text-base"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Where (optional)</span>
          <input
            value={location}
            maxLength={80}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Pitch 3"
            className="mt-1 h-12 w-full rounded-xl border border-line bg-card px-3 text-base"
          />
        </label>
      </div>

      {lineupLocked ? (
        <Notice>Voting is closed, so the lineup is final. You can still fix the date and place.</Notice>
      ) : (
        <>
          <div className="sticky top-[calc(env(safe-area-inset-top)+3.5rem)] z-10 -mx-4 mb-2 flex items-center justify-between bg-ground/95 px-4 py-2 backdrop-blur">
            <span className="font-display text-lg font-bold">
              <span className="text-team-a">A {count('A')}</span>
              <span className="mx-2 text-muted">·</span>
              <span className="text-team-b">B {count('B')}</span>
            </span>
            <span className="flex items-center gap-1 text-xs text-muted">
              <GloveIcon size={16} /> = in goal
            </span>
          </div>

          <ul className="divide-y divide-line rounded-2xl border border-line bg-card">
            {players.map((p) => {
              const pick = picks.get(p.id)
              return (
                <li key={p.id} className="flex items-center gap-2 px-3 py-2">
                  <Avatar name={p.display_name} url={p.avatar_url} size={32} />
                  <Name className="min-w-0 flex-1 truncate font-medium">{p.display_name}</Name>
                  <div className="flex overflow-hidden rounded-lg border border-line" role="group" aria-label={`Team for ${p.display_name}`}>
                    <TeamButton label="Out" active={!pick} onClick={() => setTeam(p.id, null)} />
                    <TeamButton label="A" team="A" active={pick?.team === 'A'} onClick={() => setTeam(p.id, 'A')} />
                    <TeamButton label="B" team="B" active={pick?.team === 'B'} onClick={() => setTeam(p.id, 'B')} />
                  </div>
                  <button
                    type="button"
                    disabled={!pick}
                    aria-pressed={pick?.gk ?? false}
                    aria-label={`${p.display_name} in goal`}
                    onClick={() => toggleGk(p.id)}
                    className={`press flex size-11 items-center justify-center rounded-lg border ${
                      pick?.gk ? 'border-ink bg-ink text-card' : 'border-line text-muted'
                    } disabled:opacity-30`}
                  >
                    <GloveIcon size={20} />
                  </button>
                </li>
              )
            })}
          </ul>
          <p className="mt-2 text-sm text-muted">
            Missing someone? Share the invite code from More so they can join.
          </p>
        </>
      )}

      <ErrorNote message={error} />

      <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-10 mt-4">
        <Button size="lg" className="w-full" busy={busy === 'save'} onClick={save}>
          {id ? 'Save changes' : 'Create match'}
        </Button>
      </div>

      {id && (
        <Button variant="danger" className="mt-6 w-full" busy={busy === 'delete'} onClick={remove}>
          Delete match
        </Button>
      )}
    </div>
  )
}

function TeamButton({ label, team, active, onClick }: { label: string; team?: Team; active: boolean; onClick: () => void }) {
  const activeTone = team === 'A' ? 'bg-team-a text-card' : team === 'B' ? 'bg-team-b text-card' : 'bg-line text-ink'
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`h-11 w-11 font-display text-lg font-bold ${active ? activeTone : 'text-muted'}`}
    >
      {label}
    </button>
  )
}
