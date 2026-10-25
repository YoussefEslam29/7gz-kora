// Pieces shared by the night screens: the scoreboard, lineups, the player
// grid and the goal list.
import { useState } from 'react'
import * as api from '../lib/api'
import { errorMessage } from '../lib/format'
import { TEAMS } from '../lib/games'
import type { Goal, MatchDetail, StintPlayer, Team } from '../lib/types'
import { useAuth } from '../state/auth'
import { useGroup } from '../state/group'
import { CheckIcon, FlagIcon, GloveIcon } from './icons'
import { Button, ErrorNote, Name, TeamTag } from './ui'

/** Bib colours as Tailwind classes (spelled out so Tailwind keeps them). */
const BIB: Record<Team, string> = { A: 'bg-team-a', B: 'bg-team-b', C: 'bg-team-c' }

/** Team chips on top, the score below (Design/README.md, Scoreboard). */
export function Scoreboard({ teams, score }: { teams: [Team, Team]; score: [number, number] }) {
  return (
    <div aria-label={`Team ${teams[0]} ${score[0]}, Team ${teams[1]} ${score[1]}`}>
      <div className="flex items-center justify-between">
        <TeamTag team={teams[0]} />
        <TeamTag team={teams[1]} />
      </div>
      <p className="tabular mt-0.5 text-center font-display text-[64px] leading-none whitespace-nowrap">
        {score[0]} – {score[1]}
      </p>
    </div>
  )
}

/** One column per team in the lineup. */
export function Lineups({ lineup }: { lineup: StintPlayer[] }) {
  const { playerName } = useGroup()
  const teams = TEAMS.filter((t) => lineup.some((p) => p.team === t))
  return (
    <div className={`grid gap-3 ${teams.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
      {teams.map((team) => (
        <div key={team}>
          <div className="mb-1.5">
            <TeamTag team={team} />
          </div>
          <ul className="space-y-1">
            {lineup
              .filter((p) => p.team === team)
              .sort((a, b) => Number(b.is_goalkeeper) - Number(a.is_goalkeeper))
              .map((p) => (
                <li key={p.player_id} className="flex items-center gap-1.5 text-sm">
                  <Name className="truncate">{playerName(p.player_id)}</Name>
                  {p.is_goalkeeper && <GloveIcon size={16} className="shrink-0 text-muted" aria-label="Goalkeeper" />}
                </li>
              ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

/** Grid of big player buttons in their bib colours. Used to pick a scorer or assister. */
export function PlayerGrid({
  lineup,
  onPick,
  only,
  exclude,
}: {
  lineup: StintPlayer[]
  onPick: (playerId: string) => void
  only?: Team
  exclude?: string
}) {
  const { playerName } = useGroup()
  const teams = only ? [only] : TEAMS.filter((t) => lineup.some((p) => p.team === t))
  return (
    <div className="space-y-4">
      {teams.map((team) => (
        <div key={team}>
          <div className="mb-2">
            <TeamTag team={team} />
          </div>
          <div className="grid grid-cols-2 gap-2 min-[420px]:grid-cols-3">
            {lineup
              .filter((p) => p.team === team && p.player_id !== exclude)
              .map((p) => (
                <button
                  key={p.player_id}
                  type="button"
                  onClick={() => onPick(p.player_id)}
                  className={`press min-h-14 rounded-xl border-2 border-[#0b0b0b] px-2 py-2 text-left font-semibold text-[#0b0b0b] ${BIB[team]}`}
                >
                  <Name className="line-clamp-2">{playerName(p.player_id)}</Name>
                </button>
              ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/** The night's goals, game by game, with confirm / dispute / edit / delete where allowed. */
export function GoalList({ detail, onChange }: { detail: MatchDetail; onChange: () => void }) {
  const { user } = useAuth()
  const { playerName, myPlayerId, isAdmin } = useGroup()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Admin edit: which goal, and the new scorer once picked.
  const [editing, setEditing] = useState<{ goal: Goal; scorerId?: string } | null>(null)
  const { match, goals, games, playerIds, stintPlayers } = detail
  const open = match.status !== 'closed'
  const iPlayed = myPlayerId != null && playerIds.includes(myPlayerId)

  async function run(goalId: string, action: () => Promise<unknown>) {
    setBusy(goalId)
    setError(null)
    try {
      await action()
      onChange()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  if (goals.length === 0) return <p className="text-sm text-muted">No goals yet.</p>

  if (editing) {
    // Who was on the pitch when the goal went in.
    const period = stintPlayers.filter((sp) => sp.stint_id === editing.goal.stint_id)
    const goalId = editing.goal.id
    const scorerId = editing.scorerId
    const scorerTeam = period.find((p) => p.player_id === scorerId)?.team
    return (
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="font-semibold">{scorerId ? 'Who assisted?' : 'Who scored?'}</p>
          <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
            Cancel
          </Button>
        </div>
        <ErrorNote message={error} />
        {scorerId && scorerTeam ? (
          <>
            <Button
              className="mb-4 w-full"
              variant="secondary"
              busy={busy === goalId}
              onClick={() => run(goalId, () => api.editGoal(goalId, scorerId, null)).then(() => setEditing(null))}
            >
              No assist
            </Button>
            <PlayerGrid
              lineup={period}
              only={scorerTeam}
              exclude={scorerId}
              onPick={(assisterId) =>
                run(goalId, () => api.editGoal(goalId, scorerId, assisterId)).then(() => setEditing(null))
              }
            />
          </>
        ) : (
          <PlayerGrid lineup={period} onPick={(id) => setEditing({ ...editing, scorerId: id })} />
        )}
      </div>
    )
  }

  return (
    <>
      <ErrorNote message={error} />
      {games
        .filter((game) => goals.some((g) => g.game_id === game.id))
        .map((game) => (
          <div key={game.id} className="mt-3 first:mt-1">
            <p className="label">Game {game.ordinal}</p>
            <ul className="divide-y divide-line">
              {goals
                .filter((g) => g.game_id === game.id)
                .map((g) => {
                  const loggedByMe = g.created_by === user?.id
                  const involved = myPlayerId === g.scorer_id || myPlayerId === g.assister_id
                  const canConfirm = !g.confirmed && (isAdmin || (involved && !loggedByMe && !g.disputed))
                  const canDispute = open && !g.disputed && (isAdmin || iPlayed)
                  const canDelete = isAdmin || (open && loggedByMe)
                  return (
                    <li key={g.id} className={`py-3 ${g.disputed ? 'opacity-70' : ''}`}>
                      <div className="flex items-start gap-2">
                        <span
                          className={`chip team-${g.scoring_team.toLowerCase()} mt-0.5 shrink-0 px-2`}
                          aria-label={`Team ${g.scoring_team}`}
                        >
                          {g.scoring_team}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className={`font-semibold ${g.disputed ? 'line-through' : ''}`}>
                            <Name>{playerName(g.scorer_id)}</Name>
                          </p>
                          <p className="text-sm text-muted">
                            {g.assister_id ? (
                              <>
                                Assist: <Name>{playerName(g.assister_id)}</Name>
                              </>
                            ) : (
                              'No assist'
                            )}
                            {' · '}
                            {g.disputed ? (
                              <span className="font-semibold text-danger">Disputed: doesn't count until an admin fixes it</span>
                            ) : g.confirmed ? (
                              <span className="text-brand-ink">Confirmed</span>
                            ) : (
                              'Not confirmed yet'
                            )}
                          </p>
                        </div>
                      </div>
                      {(canConfirm || canDispute || canDelete || isAdmin) && (
                        <div className="mt-2 flex flex-wrap gap-2 pl-10">
                          {canConfirm && (
                            <Button size="sm" busy={busy === g.id} onClick={() => run(g.id, () => api.confirmGoal(g.id))}>
                              <CheckIcon size={16} /> Confirm
                            </Button>
                          )}
                          {canDispute && (
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={busy === g.id}
                              onClick={() => {
                                if (window.confirm('Dispute this goal? It will not count until an admin fixes it.'))
                                  void run(g.id, () => api.disputeGoal(g.id))
                              }}
                            >
                              <FlagIcon size={16} /> Dispute
                            </Button>
                          )}
                          {isAdmin && (
                            <Button size="sm" variant="secondary" disabled={busy === g.id} onClick={() => setEditing({ goal: g })}>
                              Edit
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              size="sm"
                              variant="danger"
                              disabled={busy === g.id}
                              onClick={() => {
                                if (window.confirm('Delete this goal?')) void run(g.id, () => api.deleteGoal(g.id))
                              }}
                            >
                              Delete
                            </Button>
                          )}
                        </div>
                      )}
                    </li>
                  )
                })}
            </ul>
          </div>
        ))}
    </>
  )
}
