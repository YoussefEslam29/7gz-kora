import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { BreakdownTable } from '../components/breakdown'
import { PlayerCard } from '../components/card'
import { RatingHistory, type RatedNight } from '../components/history'
import { ChevronIcon, StarIcon } from '../components/icons'
import { Cascade, CountUp, Reveal } from '../components/motion'
import { SelfVsFriends } from '../components/selfvsfriends'
import { Card, ErrorNote, Heading, LinkButton, Loading, RatingBadge } from '../components/ui'
import * as api from '../lib/api'
import { accountCard } from '../lib/card'
import { formatDay, formatMinutes } from '../lib/format'
import type { LeaderboardRow } from '../lib/types'
import { useLoad } from '../lib/useLoad'
import { useAccount } from '../state/account'
import { useCurrentGroup } from '../state/group'

/**
 * A player's portfolio (Plans/Player-card-and-motion.md section 3): the card,
 * Self vs friends, the rating history, the stats, and the nights with their
 * breakdowns.
 */
export default function PlayerProfile() {
  const { id = '' } = useParams()
  const { group, player, myPlayerId, isAdmin, members, config } = useCurrentGroup()
  const { account } = useAccount()
  const [year] = useState(() => new Date().getFullYear())
  const p = player(id)

  const { data, error, loading, reload } = useLoad(async () => {
    const [history, season, allTime] = await Promise.all([
      api.getPlayerHistory(id),
      api.getLeaderboard(group.id, year),
      api.getLeaderboard(group.id, null),
    ])
    return {
      history,
      season: season.find((r) => r.player_id === id),
      allTime: allTime.find((r) => r.player_id === id),
    }
  }, [id, group.id, year])

  if (!p) return <ErrorNote message="Player not found." />
  const isMe = id === myPlayerId
  // Your own card comes from your account, so you see your skills even when they're hidden from others.
  const shown = isMe && account ? { ...p, ...accountCard(account), display_name: p.display_name } : p
  const isAdminPlayer = members.some((member) => member.player_id === id && member.role === 'admin')
  const role = [isMe ? 'You' : 'Player', isAdminPlayer && 'Admin', !p.user_id && 'no account'].filter(Boolean).join(' · ')
  // The badge in the card: this season's rating, else all-time, else "New" (nothing while loading).
  const rating = data?.season
    ? { value: data.season.avg_rating, label: `Season ${year}` }
    : data?.allTime
      ? { value: data.allTime.avg_rating, label: 'All-time' }
      : data
        ? null
        : undefined
  // Finished nights, oldest first, for the graph and the form (as on the table).
  const rated: RatedNight[] = (data?.history ?? [])
    .filter((h) => h.matches.status === 'closed')
    .map((h) => ({ match_id: h.match_id, played_at: h.matches.played_at, rating: Number(h.rating), is_mvp: h.is_mvp }))
    .reverse()

  return (
    <Cascade className="space-y-4">
      <PlayerCard player={shown} rating={rating} role={role} isMe={isMe} />
      <div className="flex flex-wrap gap-2">
        {isMe && (
          <LinkButton to="/me/edit" variant="secondary" className="flex-1">
            Edit my card
          </LinkButton>
        )}
        {(isMe || isAdmin) && (
          <LinkButton to={`/players/${id}/edit`} variant="ghost" className="flex-1">
            Change name
          </LinkButton>
        )}
        {p.user_id && !isMe && (
          <LinkButton to={`/u/${p.user_id}`} variant="secondary" className="flex-1">
            Their account
          </LinkButton>
        )}
      </div>

      {loading && !data ? (
        <Loading />
      ) : (
        <>
          <ErrorNote message={error} onRetry={reload} />
          <SelfVsFriends
            player={shown}
            season={data?.season}
            allTime={data?.allTime}
            minNights={config?.min_matches_for_leaderboard ?? 3}
            isMe={isMe}
          />
          <RatingHistory nights={rated} year={year} />
          <StatsCard title={`Season ${year}`} row={data?.season} />
          <StatsCard title="All-time" row={data?.allTime} />
          <NightList history={data?.history ?? []} />
        </>
      )}
    </Cascade>
  )
}

function StatsCard({ title, row }: { title: string; row: LeaderboardRow | undefined }) {
  const stats = [
    ['Played', row?.matches ?? 0],
    ['Goals', row?.goals ?? 0],
    ['Assists', row?.assists ?? 0],
    ['Clean sheets', row?.clean_sheets ?? 0],
    ['MOTM', row?.mvps ?? 0],
  ] as const
  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <Heading>{title}</Heading>
          <p className="text-sm text-muted">
            Average rating{row?.avg_votes != null && <> · peers give {Number(row.avg_votes).toFixed(1)}</>}
          </p>
        </div>
        <RatingBadge value={row?.avg_rating} size="lg" />
      </div>
      <dl className="mt-3 grid grid-cols-5 gap-1 text-center">
        {stats.map(([label, value]) => (
          <div key={label}>
            <dt className="text-[11px] leading-tight text-muted">{label}</dt>
            <dd className="tabular font-display text-2xl">
              <CountUp value={value} />
            </dd>
          </div>
        ))}
      </dl>
      {row && (
        <p className="mt-2 text-center text-sm text-muted">
          {formatMinutes(row.avg_minutes)} a night on average
          {row.minutes_in_goal > 0 && <> · {formatMinutes(row.minutes_in_goal)} in goal</>}
        </p>
      )}
    </Card>
  )
}

/** The player's rated nights, newest first. Tap one for its breakdown. */
function NightList({ history }: { history: api.HistoryRow[] }) {
  const [open, setOpen] = useState<string | null>(null)
  // With no nights, Rating history already shows the empty state.
  if (history.length === 0) return null
  return (
    <section>
      <Heading className="mb-2">Nights</Heading>
      <ul className="divide-y divide-line overflow-hidden rounded-card border-[1.5px] border-line bg-paper">
        {history.map((h) => (
          <li key={h.match_id}>
            <button
              type="button"
              aria-expanded={open === h.match_id}
              onClick={() => setOpen(open === h.match_id ? null : h.match_id)}
              className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{formatDay(h.matches.played_at)}</span>
                <span className="block text-xs text-muted">
                  {[
                    h.goals > 0 && `${h.goals} G`,
                    h.assists > 0 && `${h.assists} A`,
                    h.clean_sheets > 0 && 'clean sheet',
                    h.stats_only && 'stats only',
                  ]
                    .filter(Boolean)
                    .join(' · ') || '—'}
                </span>
              </span>
              {h.is_mvp && <StarIcon size={18} className="text-gold" aria-label="Man of the Match" />}
              <RatingBadge value={h.rating} />
              <ChevronIcon size={18} className={`shrink-0 text-muted transition-transform ${open === h.match_id ? 'rotate-90' : ''}`} />
            </button>
            <Reveal open={open === h.match_id}>
              <div className="space-y-3 bg-ground/60 px-4 py-3 text-sm">
                <BreakdownTable rating={h} />
                <Link to={`/nights/${h.match_id}`} className="flex items-center justify-between font-semibold text-brand-ink">
                  Open the night (votes and games) <ChevronIcon size={18} />
                </Link>
              </div>
            </Reveal>
          </li>
        ))}
      </ul>
    </section>
  )
}
