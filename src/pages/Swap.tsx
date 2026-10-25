import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { useConfirm, useToast } from '../components/feedback'
import { BackIcon, GloveIcon } from '../components/icons'
import { Avatar, Button, ErrorNote, Loading, Name, Notice, PageTitle, TeamTag } from '../components/ui'
import * as api from '../lib/api'
import { errorMessage, formatMinutes } from '../lib/format'
import { minutesTonight } from '../lib/games'
import type { LineupEntry, MatchDetail, Team } from '../lib/types'
import { useNow } from '../lib/useNow'
import { useCurrentGroup } from '../state/group'

type Pick = { team: Team | null; gk: boolean }

/**
 * Change who's on the pitch during a game (admins): swap players between the
 * two teams, bring on a sub (from the bench or the waiting team) or change a
 * goalkeeper. Then "Swap and continue" (the same game, the score carries on)
 * or "End game and swap" (the next game starts 0-0 with the new teams).
 * ?in=<player>&out=<player> comes from a suggested sub and is pre-applied.
 */
export default function Swap() {
  const { id = '' } = useParams()
  const { search } = useLocation()
  const navigate = useNavigate()
  const { player, isAdmin } = useCurrentGroup()
  const [detail, setDetail] = useState<MatchDetail | null>(null)
  const [picks, setPicks] = useState<Map<string, Pick>>(new Map())
  const [busy, setBusy] = useState<'continue' | 'end' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const now = useNow(60_000)
  const confirm = useConfirm()
  const toast = useToast()

  useEffect(() => {
    api
      .getMatch(id)
      .then((d) => {
        const next = new Map<string, Pick>(d.lineup.map((p) => [p.player_id, { team: p.team, gk: p.is_goalkeeper }]))
        const params = new URLSearchParams(search)
        const subIn = params.get('in')
        const subOut = params.get('out')
        const out = subOut ? next.get(subOut) : undefined
        if (subIn && subOut && out) {
          next.set(subIn, out)
          next.set(subOut, { team: null, gk: false })
        }
        setDetail(d)
        setPicks(next)
      })
      .catch((e: unknown) => setError(errorMessage(e)))
  }, [id, search])

  const back = (
    <Link to={`/nights/${id}`} className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-muted">
      <BackIcon size={18} /> Night
    </Link>
  )
  if (!isAdmin) return <ErrorNote message="Only group admins can swap players." />
  if (!detail) return error ? <ErrorNote message={error} /> : <Loading />
  const game = detail.runningGame
  if (!game) {
    return (
      <>
        {back}
        <Notice>No game is on. Change the teams on the team board instead.</Notice>
      </>
    )
  }

  const teams: [Team, Team] = [game.team_one, game.team_two]
  const name = (playerId: string) => player(playerId)?.display_name ?? 'Unknown player'
  const minutes = minutesTonight(detail.stints, detail.stintPlayers, now)
  const played = (playerId: string) => minutes.get(playerId)?.played ?? 0
  const wasOn = new Map(detail.lineup.map((p) => [p.player_id, p.team]))
  // On the pitch first, then the waiting team and the bench, fewest minutes first.
  const rows = detail.checkIns
    .filter((c) => !c.left_at)
    .sort(
      (a, b) =>
        Number(wasOn.has(b.player_id)) - Number(wasOn.has(a.player_id)) ||
        played(a.player_id) - played(b.player_id) ||
        name(a.player_id).localeCompare(name(b.player_id)),
    )
  const count = (t: Team) => [...picks.values()].filter((p) => p.team === t).length

  function setTeam(playerId: string, team: Team | null) {
    setPicks((prev) => {
      const was = prev.get(playerId)
      return new Map(prev).set(playerId, { team, gk: team !== null && was?.team === team ? was.gk : false })
    })
  }

  // One goalkeeper per team: picking a new one replaces the old one.
  function toggleGk(playerId: string) {
    setPicks((prev) => {
      const me = prev.get(playerId)
      if (!me?.team) return prev
      const next = new Map(prev)
      for (const [pid, p] of next) if (p.team === me.team && p.gk) next.set(pid, { ...p, gk: false })
      next.set(playerId, { ...me, gk: !me.gk })
      return next
    })
  }

  async function save(cont: boolean) {
    const ask = {
      title: 'End game and swap?',
      message: 'This game ends now and the next one starts at 0 – 0 with these teams.',
      confirmLabel: 'End and swap',
    }
    if (!cont && !(await confirm(ask))) return
    setBusy(cont ? 'continue' : 'end')
    setError(null)
    const lineup: LineupEntry[] = []
    for (const [player_id, p] of picks) if (p.team) lineup.push({ player_id, team: p.team, is_goalkeeper: p.gk })
    try {
      await api.swapPlayers(id, lineup, cont)
      toast(cont ? 'Swapped. The game goes on.' : 'Next game started')
      navigate(`/nights/${id}`)
    } catch (e) {
      setError(errorMessage(e))
      setBusy(null)
    }
  }

  return (
    <div>
      {back}
      <PageTitle sub={`Game ${game.ordinal}. Move players between the teams, bring on a sub or change a goalkeeper. Out = the bench.`}>
        Swap players
      </PageTitle>

      <div className="sticky top-[calc(env(safe-area-inset-top)+4rem)] z-10 -mx-4 mb-2 flex items-center justify-between gap-2 bg-ground/95 px-4 py-2 backdrop-blur">
        <span className="flex items-center gap-2 font-display text-lg">
          <TeamTag team={teams[0]} /> {count(teams[0])}
          <TeamTag team={teams[1]} /> {count(teams[1])}
        </span>
        <span className="flex items-center gap-1 text-xs text-muted">
          <GloveIcon size={16} /> = in goal
        </span>
      </div>

      <ul className="divide-y divide-line rounded-card border-[1.5px] border-line bg-paper">
        {rows.map(({ player_id, team: boardTeam }) => {
          const pick = picks.get(player_id)
          const label = name(player_id)
          const from = wasOn.get(player_id)
          const where = from ? `Team ${from}` : boardTeam ? `Team ${boardTeam} · waiting` : 'Bench'
          return (
            <li key={player_id} className="flex items-center gap-2 px-3 py-2">
              <Avatar name={label} url={player(player_id)?.avatar_url} size={32} />
              <div className="min-w-0 flex-1">
                <Name className="block truncate font-medium">{label}</Name>
                <span className="block text-xs text-muted">
                  {where} · {formatMinutes(played(player_id))}
                </span>
              </div>
              <div className="seg" role="group" aria-label={`Team for ${label}`}>
                <button type="button" aria-pressed={!pick?.team} className={!pick?.team ? 'sel-out' : ''} onClick={() => setTeam(player_id, null)}>
                  Out
                </button>
                {teams.map((t) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={pick?.team === t}
                    className={pick?.team === t ? `sel-${t.toLowerCase()}` : ''}
                    onClick={() => setTeam(player_id, t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <button
                type="button"
                disabled={!pick?.team}
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

      <ErrorNote message={error} />

      <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-10 -mx-4 mt-4 space-y-2 bg-ground/95 px-4 py-2 backdrop-blur">
        <Button size="lg" className="w-full" busy={busy === 'continue'} disabled={busy !== null} onClick={() => void save(true)}>
          Swap and continue
        </Button>
        <Button variant="secondary" className="w-full" busy={busy === 'end'} disabled={busy !== null} onClick={() => void save(false)}>
          End game and swap
        </Button>
      </div>
    </div>
  )
}
