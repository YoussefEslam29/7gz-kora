import { useState } from 'react'
import { Link } from 'react-router'
import { ChatPreview, FinishCard, GroupBanner, Podium, SeasonStrip } from '../components/hub'
import { PlusIcon, StarIcon } from '../components/icons'
import { Scoreboard } from '../components/match'
import { InstaPayLine } from '../components/money'
import { Cascade } from '../components/motion'
import { PitchMap } from '../components/pitchmap'
import { RsvpCard } from '../components/rsvp'
import { Card, Empty, ErrorNote, Heading, LinkButton, Loading, Name, RatingBadge, StatusChip } from '../components/ui'
import * as api from '../lib/api'
import { formatDay, timeLeft } from '../lib/format'
import { gameScore } from '../lib/games'
import { countdown } from '../lib/hub'
import type { MatchSummary, MoneyOwed } from '../lib/types'
import { useLoad } from '../lib/useLoad'
import { useNow } from '../lib/useNow'
import { useCurrentGroup } from '../state/group'

/** Home, the group hub (Plans/Accounts-groups-and-chat.md section 8). */
export default function Home() {
  const { group, myPlayerId, isAdmin, playerName, config } = useCurrentGroup()
  const [year] = useState(() => new Date().getFullYear())

  const { data, error, loading, reload } = useLoad(async () => {
    const [nights, board, owed] = await Promise.all([
      api.listMatches(group.id),
      api.getLeaderboard(group.id, year),
      api.getMoneyOwed(group.id),
    ])
    const votingIds = nights.filter((m) => m.status === 'voting').map((m) => m.id)
    const voted = await api.getVotedMatchIds(myPlayerId, votingIds)
    return { nights, board, owed, voted }
  }, [group.id, myPlayerId, year])

  if (loading && !data) return <Loading />
  if (!data) return <ErrorNote message={error} onRetry={reload} />

  const { nights, board, owed, voted } = data
  const live = nights.filter((m) => m.status === 'playing')
  // The list is newest first, so the soonest planned night is the last one.
  const next = nights.filter((m) => m.status === 'draft').at(-1)
  const voting = nights.filter((m) => m.status === 'voting')
  const last = nights.find((m) => m.status === 'closed')
  const top3 = board.filter((r) => r.qualified).slice(0, 3)
  const minNights = config?.min_matches_for_leaderboard ?? 3
  const mine = last?.match_ratings.find((r) => r.player_id === myPlayerId)
  const myRow = board.find((r) => r.player_id === myPlayerId)

  return (
    <Cascade className="space-y-4">
      <GroupBanner />
      <ErrorNote message={error} onRetry={reload} />

      {live.map((m) => (
        <LiveNight key={m.id} night={m} />
      ))}
      {next && (
        <RsvpCard match={next} rsvps={next.rsvps} onChange={reload} linkToNight>
          <NextNightExtras night={next} />
        </RsvpCard>
      )}
      {owed.map((o) => (
        <YouOwe key={o.match_id} owed={o} />
      ))}
      {voting.map((m) => (
        <VotingNow
          key={m.id}
          night={m}
          played={m.match_players.some((p) => p.player_id === myPlayerId)}
          voted={voted.has(m.id)}
        />
      ))}
      <FinishCard />

      {isAdmin && !next && live.length === 0 && (
        <LinkButton to="/nights/new" className="w-full">
          <PlusIcon size={20} /> Plan a night
        </LinkButton>
      )}

      <SeasonStrip row={myRow} year={year} />

      {last && (
        <Link to={`/nights/${last.id}`} className="block">
          <Card>
            <Heading>Last night · {formatDay(last.played_at)}</Heading>
            <p className="my-2 font-display text-[22px] leading-tight">
              {last.games.length} game{last.games.length === 1 ? '' : 's'}
            </p>
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
              {mine && (
                <span className="flex shrink-0 items-center gap-2">
                  You <RatingBadge value={mine.rating} />
                </span>
              )}
            </div>
          </Card>
        </Link>
      )}

      <Podium rows={top3} year={year} minNights={minNights} />
      <ChatPreview />

      {nights.length === 0 && (
        <Empty title="No nights yet">
          {isAdmin ? 'Tap "Plan a night" to set up the next one.' : 'Your admin plans each night here.'}
        </Empty>
      )}

      <p className="pt-2 text-center text-sm">
        <Link to="/how-it-works" className="font-semibold text-brand-ink underline">
          How do nights, money and ratings work?
        </Link>
      </p>
    </Cascade>
  )
}

/** On the next night's card: the countdown and the pitch map. */
function NextNightExtras({ night }: { night: MatchSummary }) {
  const now = useNow(30_000)
  return (
    <>
      {night.starts_at && <p className="mt-1 text-sm font-bold">{countdown(night.starts_at, now)}</p>}
      {night.pitch_url && (
        <div className="mt-3">
          <PitchMap url={night.pitch_url} lat={night.pitch_lat} lng={night.pitch_lng} />
        </div>
      )}
    </>
  )
}

/** Tonight: the game being played (score) or "between games". */
function LiveNight({ night }: { night: MatchSummary }) {
  const game = night.games.find((g) => g.ended_at === null)
  return (
    <Card strong>
      <div className="flex items-center justify-between gap-2">
        <span className="label">
          Tonight{night.location && <> · <Name>{night.location}</Name></>}
        </span>
        <StatusChip status="playing" />
      </div>
      <div className="my-3">
        {game ? (
          <>
            <p className="label mb-1">Game {game.ordinal}</p>
            <Scoreboard teams={[game.team_one, game.team_two]} score={gameScore(game, night.goals)} />
          </>
        ) : (
          <p className="font-display text-[22px] leading-tight">
            {night.games.length === 0 ? 'Getting ready' : `Between games · ${night.games.length} played`}
          </p>
        )}
      </div>
      <LinkButton to={`/nights/${night.id}`} className="w-full">
        Open night
      </LinkButton>
    </Card>
  )
}

function YouOwe({ owed }: { owed: MoneyOwed }) {
  const { playerName } = useCurrentGroup()
  return (
    <Card strong>
      <Link to={`/nights/${owed.match_id}`} className="flex items-center justify-between gap-2">
        <div>
          <p className="label">You owe</p>
          <p className="money">
            {owed.share} {owed.currency}
          </p>
          <p className="text-sm">
            to{' '}
            <Name className="font-bold">
              {owed.collector_player_id ? playerName(owed.collector_player_id) : 'the collector'}
            </Name>{' '}
            for {formatDay(owed.played_at)}
          </p>
        </div>
        <span className="chip status voting">Unpaid</span>
      </Link>
      <InstaPayLine collectorId={owed.collector_player_id} />
    </Card>
  )
}

function VotingNow({ night, played, voted }: { night: MatchSummary; played: boolean; voted: boolean }) {
  if (played && !voted) {
    return (
      <Link
        to={`/nights/${night.id}/vote`}
        className="block rounded-card border-2 border-[#0b0b0b] bg-brand p-4 text-on-brand"
      >
        <p className="label text-on-brand">Voting · {formatDay(night.played_at)}</p>
        <p className="font-display text-[22px] leading-tight">Vote now, closes in {timeLeft(night.voting_closes_at)}</p>
      </Link>
    )
  }
  return (
    <Card>
      <Heading>Voting · {formatDay(night.played_at)}</Heading>
      <p className="mt-1">
        {voted ? 'You voted. ' : ''}Results in {timeLeft(night.voting_closes_at)}.
      </p>
      <div className="mt-3 flex gap-2">
        {voted && (
          <LinkButton to={`/nights/${night.id}/vote`} variant="secondary" className="flex-1">
            Change votes
          </LinkButton>
        )}
        <LinkButton to={`/nights/${night.id}`} variant="secondary" className="flex-1">
          Open night
        </LinkButton>
      </div>
    </Card>
  )
}
