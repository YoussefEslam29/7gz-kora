import { Link } from 'react-router'
import { ChevronIcon, PlusIcon, StarIcon } from '../components/icons'
import { Empty, ErrorNote, LinkButton, Loading, PageTitle, RatingBadge, StatusChip } from '../components/ui'
import * as api from '../lib/api'
import { formatDay, parseDay, scoreOf } from '../lib/format'
import type { MatchSummary } from '../lib/types'
import { useLoad } from '../lib/useLoad'
import { useCurrentGroup } from '../state/group'

export default function Matches() {
  const { group, isAdmin, myPlayerId } = useCurrentGroup()
  const { data, error, loading, reload } = useLoad(() => api.listMatches(group.id), [group.id])

  if (loading && !data) return <Loading />

  // Group by month: "October 2026"
  const months = new Map<string, MatchSummary[]>()
  for (const m of data ?? []) {
    const key = parseDay(m.played_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    months.set(key, [...(months.get(key) ?? []), m])
  }

  return (
    <div>
      <PageTitle>Matches</PageTitle>
      <ErrorNote message={error} onRetry={reload} />
      {isAdmin && (
        <LinkButton to="/matches/new" className="mb-4 w-full">
          <PlusIcon size={20} /> New match
        </LinkButton>
      )}
      {data?.length === 0 && (
        <Empty title="No matches yet">
          {isAdmin ? 'Add a match after your next game.' : 'Your admin adds each match after you play.'}
        </Empty>
      )}
      {[...months.entries()].map(([month, list]) => (
        <section key={month} className="mb-5">
          <h2 className="mb-2 font-display text-sm font-semibold tracking-wider text-muted uppercase">{month}</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
            {list.map((m) => {
              const score = scoreOf(m.goals)
              const mine = m.match_ratings.find((r) => r.player_id === myPlayerId)
              return (
                <li key={m.id}>
                  <Link to={`/matches/${m.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{formatDay(m.played_at)}</p>
                      <p className="flex items-center gap-2 text-sm text-muted">
                        <StatusChip status={m.status} />
                        {m.location && <span className="truncate">{m.location}</span>}
                      </p>
                    </div>
                    <span className="tabular font-display text-2xl font-bold">
                      <span className="text-team-a">{score.A}</span>
                      <span className="mx-1 text-muted">–</span>
                      <span className="text-team-b">{score.B}</span>
                    </span>
                    {mine && (
                      <span className="flex items-center gap-1">
                        {mine.is_mvp && <StarIcon size={16} className="text-gold" aria-label="Man of the Match" />}
                        <RatingBadge value={mine.rating} size="sm" />
                      </span>
                    )}
                    <ChevronIcon size={18} className="shrink-0 text-muted" />
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
