import * as m from 'motion/react-m'
import { Link } from 'react-router'
import { ChevronIcon, PlusIcon, StarIcon } from '../components/icons'
import { Empty, ErrorNote, LinkButton, Loading, Name, PageTitle, RatingBadge, StatusChip } from '../components/ui'
import * as api from '../lib/api'
import { CANCEL_REASONS, clockOf, formatDay, parseDay } from '../lib/format'
import { cascade, cascadeItem } from '../lib/motion'
import type { MatchSummary } from '../lib/types'
import { useLoad } from '../lib/useLoad'
import { useCurrentGroup } from '../state/group'

export default function Nights() {
  const { group, isAdmin, myPlayerId } = useCurrentGroup()
  const { data, error, loading, reload } = useLoad(() => api.listMatches(group.id), [group.id])

  if (loading && !data) return <Loading />

  // Grouped by month: "October 2026"
  const months = new Map<string, MatchSummary[]>()
  for (const night of data ?? []) {
    const key = parseDay(night.played_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    months.set(key, [...(months.get(key) ?? []), night])
  }

  return (
    <div>
      <PageTitle>Nights</PageTitle>
      <ErrorNote message={error} onRetry={reload} />
      {isAdmin && (
        <LinkButton to="/nights/new" className="mb-4 w-full">
          <PlusIcon size={20} /> Plan a night
        </LinkButton>
      )}
      {data?.length === 0 && (
        <Empty title="No nights yet">
          {isAdmin ? 'Plan the next night with the button above.' : 'Your admin plans each night here.'}
        </Empty>
      )}
      {[...months.entries()].map(([month, list]) => (
        <section key={month} className="mb-5">
          <h2 className="label mb-2">{month}</h2>
          <m.ul
            initial="initial"
            animate="animate"
            variants={cascade}
            className="divide-y-[1.5px] divide-line overflow-hidden rounded-card border-[1.5px] border-line bg-paper"
          >
            {list.map((night) => {
              const showGames = night.status === 'playing' || night.status === 'voting' || night.status === 'closed'
              const mine = night.match_ratings.find((r) => r.player_id === myPlayerId)
              return (
                <m.li key={night.id} variants={cascadeItem}>
                  <Link to={`/nights/${night.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold">
                        {formatDay(night.played_at)}
                        {night.starts_at && ` · ${clockOf(night.starts_at)}`}
                      </p>
                      <p className="flex items-center gap-2 text-sm text-muted">
                        <StatusChip status={night.status} />
                        <span className="truncate">
                          {night.status === 'cancelled' && night.cancel_reason ? (
                            CANCEL_REASONS[night.cancel_reason]
                          ) : (
                            <Name>{night.location ?? ''}</Name>
                          )}
                        </span>
                      </p>
                    </div>
                    {showGames && (
                      <span className="text-sm whitespace-nowrap text-muted">
                        {night.games.length} game{night.games.length === 1 ? '' : 's'}
                      </span>
                    )}
                    {mine && (
                      <span className="flex items-center gap-1">
                        {mine.is_mvp && <StarIcon size={16} className="text-gold" aria-label="Man of the Match" />}
                        <RatingBadge value={mine.rating} size="sm" />
                      </span>
                    )}
                    <ChevronIcon size={18} className="shrink-0 text-muted" />
                  </Link>
                </m.li>
              )
            })}
          </m.ul>
        </section>
      ))}
    </div>
  )
}
