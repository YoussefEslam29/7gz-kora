import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { BackIcon, GloveIcon } from '../components/icons'
import { Avatar, Button, ErrorNote, Loading, Name, Notice, PageTitle, TeamTag } from '../components/ui'
import * as api from '../lib/api'
import { errorMessage } from '../lib/format'
import type { CheckIn, LineupEntry, Team } from '../lib/types'
import { useCurrentGroup } from '../state/group'

type Pick = { team: Team; gk: boolean }

/** Pick Team A / Team B and the goalkeepers from the players checked in (admins). */
export default function Teams() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { player, isAdmin } = useCurrentGroup()
  const [checkIns, setCheckIns] = useState<CheckIn[] | null>(null)
  const [picks, setPicks] = useState<Map<string, Pick>>(new Map())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .getMatch(id)
      .then((d) => {
        setCheckIns(d.checkIns)
        setPicks(new Map(d.lineup.map((p) => [p.player_id, { team: p.team, gk: p.is_goalkeeper }])))
      })
      .catch((e: unknown) => setError(errorMessage(e)))
  }, [id])

  if (!isAdmin) return <ErrorNote message="Only group admins can pick teams." />
  if (!checkIns) return error ? <ErrorNote message={error} /> : <Loading />

  const name = (playerId: string) => player(playerId)?.display_name ?? 'Unknown player'
  const here = [...checkIns].sort((a, b) => name(a.player_id).localeCompare(name(b.player_id)))
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
    setBusy(true)
    setError(null)
    const lineup: LineupEntry[] = [...picks.entries()].map(([player_id, p]) => ({
      player_id,
      team: p.team,
      is_goalkeeper: p.gk,
    }))
    try {
      await api.saveLineup(id, lineup)
      navigate(`/nights/${id}`)
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
    }
  }

  return (
    <div>
      <Link to={`/nights/${id}`} className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-muted">
        <BackIcon size={18} /> Night
      </Link>
      <PageTitle sub="Everyone checked in is listed. Players on neither team are on the bench.">Teams</PageTitle>

      {here.length < 2 ? (
        <Notice>Check at least 2 players in first, on the night page.</Notice>
      ) : (
        <>
          <div className="sticky top-[calc(env(safe-area-inset-top)+4rem)] z-10 -mx-4 mb-2 flex items-center justify-between gap-2 bg-ground/95 px-4 py-2 backdrop-blur">
            <span className="flex items-center gap-2 font-display text-lg">
              <TeamTag team="A" /> {count('A')}
              <TeamTag team="B" /> {count('B')}
            </span>
            <span className="flex items-center gap-1 text-xs text-muted">
              <GloveIcon size={16} /> = in goal
            </span>
          </div>

          <ul className="divide-y divide-line rounded-card border-[1.5px] border-line bg-paper">
            {here.map(({ player_id, left_at }) => {
              const pick = picks.get(player_id)
              const label = name(player_id)
              return (
                <li key={player_id} className="flex items-center gap-2 px-3 py-2">
                  <Avatar name={label} url={player(player_id)?.avatar_url} size={32} />
                  <div className="min-w-0 flex-1">
                    <Name className="block truncate font-medium">{label}</Name>
                    {left_at && <span className="block text-xs text-muted">Left early</span>}
                  </div>
                  <div className="seg" role="group" aria-label={`Team for ${label}`}>
                    <button type="button" aria-pressed={!pick} className={!pick ? 'sel-out' : ''} onClick={() => setTeam(player_id, null)}>
                      Out
                    </button>
                    <button type="button" aria-pressed={pick?.team === 'A'} className={pick?.team === 'A' ? 'sel-a' : ''} onClick={() => setTeam(player_id, 'A')}>
                      A
                    </button>
                    <button type="button" aria-pressed={pick?.team === 'B'} className={pick?.team === 'B' ? 'sel-b' : ''} onClick={() => setTeam(player_id, 'B')}>
                      B
                    </button>
                  </div>
                  <button
                    type="button"
                    disabled={!pick}
                    aria-pressed={pick?.gk ?? false}
                    aria-label={`${label} in goal`}
                    onClick={() => toggleGk(player_id)}
                    className={`press flex size-12 items-center justify-center rounded-xl border-2 ${
                      pick?.gk ? 'border-ink bg-ink text-paper' : 'border-line text-muted'
                    } disabled:opacity-30`}
                  >
                    <GloveIcon size={20} />
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}

      <ErrorNote message={error} />

      <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-10 mt-4">
        <Button size="lg" className="w-full" busy={busy} disabled={here.length < 2} onClick={() => void save()}>
          Save teams
        </Button>
      </div>
    </div>
  )
}
