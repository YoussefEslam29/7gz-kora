import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { BackIcon } from '../components/icons'
import { Avatar, Button, ErrorNote, Loading, Name, Notice, PageTitle, TeamTag } from '../components/ui'
import * as api from '../lib/api'
import { errorMessage, formatMinutes } from '../lib/format'
import { minutesTonight, TEAMS } from '../lib/games'
import type { MatchDetail, Team } from '../lib/types'
import { useNow } from '../lib/useNow'
import { useCurrentGroup } from '../state/group'

/**
 * The team board (admins): Team A, B or C, or the bench ("Out"), for everyone
 * checked in, with their minutes tonight. While a game is on, players on the
 * pitch are moved with Swap.
 */
export default function Teams() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { player, isAdmin } = useCurrentGroup()
  const [detail, setDetail] = useState<MatchDetail | null>(null)
  const [picks, setPicks] = useState<Map<string, Team | null>>(new Map())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const now = useNow(60_000)

  useEffect(() => {
    api
      .getMatch(id)
      .then((d) => {
        setDetail(d)
        setPicks(new Map(d.checkIns.map((c) => [c.player_id, c.team])))
      })
      .catch((e: unknown) => setError(errorMessage(e)))
  }, [id])

  if (!isAdmin) return <ErrorNote message="Only group admins can change the teams." />
  if (!detail) return error ? <ErrorNote message={error} /> : <Loading />

  const name = (playerId: string) => player(playerId)?.display_name ?? 'Unknown player'
  const here = [...detail.checkIns].sort((a, b) => name(a.player_id).localeCompare(name(b.player_id)))
  const onPitch = new Set(detail.lineup.map((p) => p.player_id))
  const minutes = minutesTonight(detail.stints, detail.stintPlayers, now)
  const count = (team: Team) => [...picks.values()].filter((t) => t === team).length

  async function save() {
    setBusy(true)
    setError(null)
    try {
      await api.setTeamBoard(id, here.map((c) => ({ player_id: c.player_id, team: picks.get(c.player_id) ?? null })))
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
      <PageTitle sub="Put everyone checked in on a team. Out = on the bench, as a sub.">Team board</PageTitle>

      {here.length < 2 ? (
        <Notice>Check at least 2 players in first, on the night page.</Notice>
      ) : (
        <>
          <div className="sticky top-[calc(env(safe-area-inset-top)+4rem)] z-10 -mx-4 mb-2 flex items-center gap-3 bg-ground/95 px-4 py-2 backdrop-blur">
            {TEAMS.map((t) => (
              <span key={t} className="flex items-center gap-1.5 font-display text-lg">
                <TeamTag team={t} /> {count(t)}
              </span>
            ))}
          </div>

          <ul className="divide-y divide-line rounded-card border-[1.5px] border-line bg-paper">
            {here.map(({ player_id, left_at }) => {
              const pick = picks.get(player_id) ?? null
              const label = name(player_id)
              const playing = onPitch.has(player_id)
              const locked = playing || left_at !== null
              const note = left_at
                ? 'Left early'
                : playing
                  ? 'On the pitch · use Swap'
                  : `${formatMinutes(minutes.get(player_id)?.played ?? 0)} tonight`
              return (
                <li key={player_id} className="flex items-center gap-2 px-3 py-2">
                  <Avatar name={label} url={player(player_id)?.avatar_url} size={32} />
                  <div className="min-w-0 flex-1">
                    <Name className="block truncate font-medium">{label}</Name>
                    <span className="block text-xs text-muted">{note}</span>
                  </div>
                  <div className="seg" role="group" aria-label={`Team for ${label}`}>
                    {[null, ...TEAMS].map((t) => (
                      <button
                        key={t ?? 'out'}
                        type="button"
                        disabled={locked}
                        aria-pressed={pick === t}
                        className={`disabled:opacity-40 ${pick === t ? (t ? `sel-${t.toLowerCase()}` : 'sel-out') : ''}`}
                        onClick={() => setPicks((prev) => new Map(prev).set(player_id, t))}
                      >
                        {t ?? 'Out'}
                      </button>
                    ))}
                  </div>
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
