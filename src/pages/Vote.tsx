import * as m from 'motion/react-m'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useToast } from '../components/feedback'
import { BackIcon, StarIcon } from '../components/icons'
import { Button, ErrorNote, Loading, Name, Notice, PageTitle, ScoreButton, TeamTag } from '../components/ui'
import * as api from '../lib/api'
import { errorMessage, isPast, timeLeft } from '../lib/format'
import type { MatchDetail } from '../lib/types'
import { useLoad } from '../lib/useLoad'
import { useCurrentGroup } from '../state/group'

export default function Vote() {
  const { id = '' } = useParams()
  const { myPlayerId } = useCurrentGroup()
  const { data, error, loading, reload } = useLoad(() => api.getMatch(id), [id])

  if (loading && !data) return <Loading />
  if (!data) return <ErrorNote message={error} onRetry={reload} />

  const back = (
    <Link to={`/nights/${id}`} className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-muted">
      <BackIcon size={18} /> Night
    </Link>
  )
  if (data.match.status !== 'voting' || isPast(data.match.voting_closes_at)) {
    return (
      <>
        {back}
        <Notice>Voting is not open for this night.</Notice>
      </>
    )
  }
  if (!data.playerIds.includes(myPlayerId)) {
    return (
      <>
        {back}
        <Notice>Only players checked in for this night can vote.</Notice>
      </>
    )
  }
  return (
    <>
      {back}
      <VoteForm detail={data} />
    </>
  )
}

type Choice = number | 'didnt_see'

function VoteForm({ detail }: { detail: MatchDetail }) {
  const navigate = useNavigate()
  const { myPlayerId, playerName } = useCurrentGroup()
  const { match, checkIns, playerIds, votes, mvpVotes } = detail

  // Before voting closes you only receive your own votes, so pre-fill them.
  const [choices, setChoices] = useState<Map<string, Choice>>(
    () => new Map(votes.filter((v) => v.voter_id === myPlayerId).map((v) => [v.target_id, v.didnt_see ? 'didnt_see' : v.score!])),
  )
  const [mvp, setMvp] = useState<string | null>(() => mvpVotes.find((v) => v.voter_id === myPlayerId)?.target_id ?? null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const toast = useToast()

  // The team each player ended the night on (the team board).
  const teamOf = (pid: string) => checkIns.find((c) => c.player_id === pid)?.team ?? undefined
  const myTeam = teamOf(myPlayerId)
  // Teammates first, then opponents, then anyone who left early.
  const targets = playerIds
    .filter((pid) => pid !== myPlayerId)
    .sort((a, b) => {
      const rank = (pid: string) => (teamOf(pid) === myTeam ? 0 : teamOf(pid) ? 1 : 2)
      return rank(a) - rank(b) || playerName(a).localeCompare(playerName(b))
    })
  const done = targets.filter((t) => choices.has(t)).length
  const complete = done === targets.length && mvp !== null

  function choose(target: string, choice: Choice) {
    setChoices((prev) => new Map(prev).set(target, choice))
  }

  async function save() {
    setBusy(true)
    setError(null)
    try {
      const list: api.VoteInput[] = [...choices.entries()].map(([target_id, c]) =>
        c === 'didnt_see' ? { target_id, didnt_see: true } : { target_id, score: c },
      )
      await api.submitVotes(match.id, list, mvp)
      toast('Votes saved')
      navigate(`/nights/${match.id}`)
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
    }
  }

  return (
    <div>
      <PageTitle sub={`Votes stay secret until voting closes in ${timeLeft(match.voting_closes_at)}. You can change them until then.`}>
        Rate the players
      </PageTitle>

      <ul className="space-y-3">
        {targets.map((pid) => {
          const choice = choices.get(pid)
          const team = teamOf(pid)
          return (
            <li key={pid} className="rounded-card border-[1.5px] border-line bg-paper p-3">
              <div className="mb-2 flex items-center gap-2">
                <Name className="min-w-0 flex-1 truncate text-lg font-semibold">{playerName(pid)}</Name>
                {team && <TeamTag team={team} />}
                <button
                  type="button"
                  aria-pressed={choice === 'didnt_see'}
                  onClick={() => choose(pid, 'didnt_see')}
                  className={`h-9 shrink-0 rounded-lg px-2.5 text-sm font-medium ${
                    choice === 'didnt_see' ? 'bg-ink text-paper' : 'border-[1.5px] border-line text-muted'
                  }`}
                >
                  Didn't see
                </button>
              </div>
              <div className="grid grid-cols-5 gap-1.5" role="group" aria-label={`Score for ${playerName(pid)}`}>
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <ScoreButton key={n} n={n} selected={choice === n} onClick={() => choose(pid, n)} />
                ))}
              </div>
            </li>
          )
        })}
      </ul>

      <section className="mt-6 rounded-card border border-gold/60 bg-paper p-3">
        <h2 className="mb-2 flex items-center gap-2 font-display text-xl">
          <StarIcon size={22} className="text-gold" /> Man of the Match
        </h2>
        <div className="flex flex-wrap gap-2">
          {targets.map((pid) => (
            <m.button
              key={pid}
              type="button"
              whileTap={{ scale: 0.94 }}
              aria-pressed={mvp === pid}
              onClick={() => setMvp(pid)}
              className={`min-h-11 rounded-full border px-4 font-semibold ${
                mvp === pid ? 'border-gold bg-gold text-[#1a1400]' : 'border-line bg-ground'
              }`}
            >
              <Name>{playerName(pid)}</Name>
            </m.button>
          ))}
        </div>
      </section>

      <ErrorNote message={error} />

      <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-10 mt-4 rounded-card border-[1.5px] border-line bg-paper/95 p-3 backdrop-blur">
        <div aria-hidden className="mb-2 h-1.5 overflow-hidden rounded-full bg-line">
          <m.div
            className="h-full rounded-full bg-brand"
            animate={{ width: `${(done / Math.max(1, targets.length)) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        <p className="mb-2 text-center text-sm text-muted">
          {done} of {targets.length} rated · {mvp ? 'Man of the Match picked' : 'pick a Man of the Match'}
        </p>
        <Button size="lg" className="w-full" disabled={!complete} busy={busy} onClick={save}>
          Save votes
        </Button>
      </div>
    </div>
  )
}
