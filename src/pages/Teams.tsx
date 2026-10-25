import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useToast } from '../components/feedback'
import { BackIcon } from '../components/icons'
import { Avatar, Button, ErrorNote, Loading, Name, Notice, PageTitle, TeamTag } from '../components/ui'
import * as api from '../lib/api'
import { selfRating } from '../lib/card'
import { errorMessage, formatMinutes } from '../lib/format'
import { minutesTonight, TEAMS } from '../lib/games'
import { playerStrength, suggestTeams, teamAverages } from '../lib/suggest'
import type { MatchDetail, RatingAverages, Team } from '../lib/types'
import { useNow } from '../lib/useNow'
import { useCurrentGroup } from '../state/group'

/**
 * The team board (admins): Team A, B or C, or the bench ("Out"), for everyone
 * checked in, with their minutes tonight. "Suggest teams" fills in fair teams
 * from the ratings, to change before saving. While a game is on, players on
 * the pitch are moved with Swap.
 */
export default function Teams() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { group, player, players, isAdmin } = useCurrentGroup()
  const [detail, setDetail] = useState<MatchDetail | null>(null)
  const [ratings, setRatings] = useState<RatingAverages | null>(null)
  const [picks, setPicks] = useState<Map<string, Team | null>>(new Map())
  const [suggested, setSuggested] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const now = useNow(60_000)
  const toast = useToast()

  useEffect(() => {
    api
      .getMatch(id)
      .then(async (d) => {
        // "This season" is the night's calendar year, as on the table.
        const averages = await api.getRatingAverages(d.match.group_id, Number(d.match.played_at.slice(0, 4)))
        setDetail(d)
        setRatings(averages)
        setPicks(new Map(d.checkIns.map((c) => [c.player_id, c.team])))
      })
      .catch((e: unknown) => setError(errorMessage(e)))
  }, [id])

  if (!isAdmin) return <ErrorNote message="Only group admins can change the teams." />
  if (!detail || !ratings) return error ? <ErrorNote message={error} /> : <Loading />

  const { season, allTime } = ratings
  const perSide = detail.match.players_per_side
  const name = (playerId: string) => player(playerId)?.display_name ?? 'Unknown player'
  const here = [...detail.checkIns].sort((a, b) => name(a.player_id).localeCompare(name(b.player_id)))
  // Players on the pitch, with their team: they keep it until the game ends.
  const pitchTeam = new Map(detail.lineup.map((p) => [p.player_id, p.team]))
  const minutes = minutesTonight(detail.stints, detail.stintPlayers, now)
  // Someone new starts at their self-rating (their player card), else 6.0.
  const selfRatings = new Map(
    players.flatMap((p) => {
      const self = selfRating(p)
      return self === null ? [] : [[p.id, self] as const]
    }),
  )
  const strength = (playerId: string) => playerStrength(playerId, season, allTime, selfRatings)
  const count = (team: Team) => [...picks.values()].filter((t) => t === team).length
  const averages = teamAverages(picks, strength)
  const averageLine = TEAMS.flatMap((t) => {
    const avg = averages[t]
    return avg === null ? [] : [`${t} ${avg.toFixed(1)}`]
  }).join(' · ')

  function suggest() {
    const teams = suggestTeams(
      here
        .filter((c) => c.left_at === null)
        .map((c) => ({
          id: c.player_id,
          strength: strength(c.player_id),
          minutes: minutes.get(c.player_id)?.played ?? 0,
          arrivedAt: c.arrived_at,
          locked: pitchTeam.get(c.player_id) ?? null,
        })),
      perSide,
      group.min_extra_team_size,
    )
    const next = new Map<string, Team | null>(here.map((c) => [c.player_id, null]))
    for (const t of TEAMS) for (const playerId of teams[t]) next.set(playerId, t)
    setPicks(next)
    setSuggested(true)
  }

  async function save() {
    setBusy(true)
    setError(null)
    try {
      await api.setTeamBoard(id, here.map((c) => ({ player_id: c.player_id, team: picks.get(c.player_id) ?? null })))
      toast('Teams saved')
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
          <Button variant="secondary" className="w-full" onClick={suggest}>
            Suggest teams
          </Button>
          {suggested && (
            <Notice>
              Fair teams from the ratings
              {pitchTeam.size > 0 && ', with the players on the pitch kept where they are'}. Change anything you like,
              then tap Save teams.
            </Notice>
          )}

          <div className="sticky top-[calc(env(safe-area-inset-top)+4rem)] z-10 -mx-4 mt-2 mb-2 bg-ground/95 px-4 py-2 backdrop-blur">
            <div className="flex items-center gap-3">
              {TEAMS.map((t) => (
                <span key={t} className="flex items-center gap-1.5 font-display text-lg">
                  <TeamTag team={t} /> {count(t)}
                </span>
              ))}
            </div>
            {averageLine && <p className="tabular mt-1 text-xs text-muted">Average rating · {averageLine}</p>}
          </div>

          <ul className="divide-y divide-line rounded-card border-[1.5px] border-line bg-paper">
            {here.map(({ player_id, left_at }) => {
              const pick = picks.get(player_id) ?? null
              const label = name(player_id)
              const playing = pitchTeam.has(player_id)
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
