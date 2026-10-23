import { useState } from 'react'
import { Link } from 'react-router'
import { PlusIcon, StarIcon } from '../components/icons'
import { Scoreboard } from '../components/match'
import { Card, Empty, ErrorNote, Heading, LinkButton, Loading, Name, RatingBadge } from '../components/ui'
import * as api from '../lib/api'
import { formatDay, scoreOf, timeLeft } from '../lib/format'
import { isStandalone } from '../lib/pwa'
import { KEYS, readLocal, writeLocal } from '../lib/storage'
import { useLoad } from '../lib/useLoad'
import { useCurrentGroup } from '../state/group'

export default function Home() {
  const { group, myPlayerId, isAdmin, playerName, config } = useCurrentGroup()
  const [year] = useState(() => new Date().getFullYear())

  const { data, error, loading, reload } = useLoad(async () => {
    const [matches, board] = await Promise.all([api.listMatches(group.id), api.getLeaderboard(group.id, year)])
    const votingIds = matches.filter((m) => m.status === 'voting').map((m) => m.id)
    const voted = await api.getVotedMatchIds(myPlayerId, votingIds)
    return { matches, board, voted }
  }, [group.id, myPlayerId, year])

  if (loading && !data) return <Loading />
  if (!data) return <ErrorNote message={error} onRetry={reload} />

  const { matches, board, voted } = data
  const voting = matches.filter((m) => m.status === 'voting')
  const live = matches.filter((m) => m.status === 'playing')
  const last = matches.find((m) => m.status === 'closed')
  const top3 = board.filter((r) => r.qualified).slice(0, 3)
  const minMatches = config?.min_matches_for_leaderboard ?? 3

  return (
    <div className="space-y-4">
      <ErrorNote message={error} onRetry={reload} />
      <InstallNudge />

      {voting.map((m) => {
        const played = m.match_players.some((p) => p.player_id === myPlayerId)
        const hasVoted = voted.has(m.id)
        return (
          <Card key={m.id} className={played && !hasVoted ? 'border-pitch bg-team-a-soft' : ''}>
            <Heading>Voting · {formatDay(m.played_at)}</Heading>
            {played && !hasVoted ? (
              <>
                <p className="mt-1 font-display text-2xl font-bold">Vote now, closes in {timeLeft(m.voting_closes_at)}</p>
                <LinkButton to={`/matches/${m.id}/vote`} className="mt-3 w-full">
                  Rate the players
                </LinkButton>
              </>
            ) : (
              <>
                <p className="mt-1">
                  {hasVoted ? 'You voted. ' : ''}Results in {timeLeft(m.voting_closes_at)}.
                </p>
                <div className="mt-3 flex gap-2">
                  {hasVoted && (
                    <LinkButton to={`/matches/${m.id}/vote`} variant="secondary" className="flex-1">
                      Change votes
                    </LinkButton>
                  )}
                  <LinkButton to={`/matches/${m.id}`} variant="secondary" className="flex-1">
                    Open match
                  </LinkButton>
                </div>
              </>
            )}
          </Card>
        )
      })}

      {live.map((m) => (
        <Card key={m.id}>
          <Heading>Match in progress · {formatDay(m.played_at)}</Heading>
          <div className="my-3">
            <Scoreboard score={scoreOf(m.goals)} />
          </div>
          <div className="flex gap-2">
            <LinkButton to={`/matches/${m.id}/record`} className="flex-1">
              Log a goal
            </LinkButton>
            <LinkButton to={`/matches/${m.id}`} variant="secondary" className="flex-1">
              Open match
            </LinkButton>
          </div>
        </Card>
      ))}

      {isAdmin && live.length === 0 && (
        <LinkButton to="/matches/new" className="w-full">
          <PlusIcon size={20} /> New match
        </LinkButton>
      )}

      {last && (
        <Link to={`/matches/${last.id}`} className="block">
          <Card>
            <Heading>Last match · {formatDay(last.played_at)}</Heading>
            <div className="my-3">
              <Scoreboard score={scoreOf(last.goals)} />
            </div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-1.5">
                <StarIcon size={18} className="shrink-0 text-gold" />
                <span className="truncate">
                  Man of the Match:{' '}
                  {last.match_ratings
                    .filter((r) => r.is_mvp)
                    .map((r, i) => (
                      <span key={r.player_id}>
                        {i > 0 && ' & '}
                        <Name className="font-semibold">{playerName(r.player_id)}</Name>
                      </span>
                    ))}
                  {!last.match_ratings.some((r) => r.is_mvp) && 'no votes'}
                </span>
              </span>
              {last.match_ratings.some((r) => r.player_id === myPlayerId) && (
                <span className="flex shrink-0 items-center gap-2">
                  You <RatingBadge value={last.match_ratings.find((r) => r.player_id === myPlayerId)?.rating} />
                </span>
              )}
            </div>
          </Card>
        </Link>
      )}

      <Card>
        <div className="mb-2 flex items-baseline justify-between">
          <Heading>Season {year} · top 3</Heading>
          <Link to="/table" className="text-sm font-semibold text-pitch">
            Full table
          </Link>
        </div>
        {top3.length === 0 ? (
          <p className="text-sm text-muted">
            The table starts once players have {minMatches} rated matches this season.
          </p>
        ) : (
          <ol className="space-y-2">
            {top3.map((row, i) => (
              <li key={row.player_id}>
                <Link to={`/players/${row.player_id}`} className="flex items-center gap-3">
                  <span className="w-5 font-display text-xl font-bold text-muted">{i + 1}</span>
                  <Name className="flex-1 truncate font-semibold">{row.display_name}</Name>
                  <span className="text-sm text-muted">{row.matches} played</span>
                  <RatingBadge value={row.avg_rating} />
                </Link>
              </li>
            ))}
          </ol>
        )}
      </Card>

      {matches.length === 0 && (
        <Empty title="No matches yet">
          {isAdmin ? 'Tap "New match" after your next game.' : 'Your admin adds each match after you play.'}
        </Empty>
      )}

      <p className="pt-2 text-center text-sm">
        <Link to="/how-it-works" className="font-semibold text-pitch underline">
          How is my rating calculated?
        </Link>
      </p>
    </div>
  )
}

function InstallNudge() {
  const [hidden, setHidden] = useState(() => isStandalone() || readLocal(KEYS.installDismissed) === '1')
  if (hidden) return null
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-pitch-deep p-3 text-white">
      <img src="/logo.svg" alt="" className="size-10" />
      <p className="flex-1 text-sm">
        Add Ta7dy to your home screen for one-tap access.{' '}
        <Link to="/install" className="font-semibold underline">
          Show me how
        </Link>
      </p>
      <button
        type="button"
        aria-label="Hide"
        onClick={() => {
          writeLocal(KEYS.installDismissed, '1')
          setHidden(true)
        }}
        className="size-10 shrink-0 rounded-full text-xl text-white/80"
      >
        ×
      </button>
    </div>
  )
}
