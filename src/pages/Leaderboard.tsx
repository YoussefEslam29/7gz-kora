import { useState } from 'react'
import * as m from 'motion/react-m'
import { Link } from 'react-router'
import { Empty, ErrorNote, Heading, Loading, Name, PageTitle, RatingBadge } from '../components/ui'
import * as api from '../lib/api'
import { cascade, cascadeItem } from '../lib/motion'
import type { LeaderboardRow } from '../lib/types'
import { useLoad } from '../lib/useLoad'
import { useCurrentGroup } from '../state/group'

const SORTS = [
  { key: 'rating', label: 'Rating', value: (r: LeaderboardRow) => r.avg_rating_exact },
  { key: 'goals', label: 'Goals', value: (r: LeaderboardRow) => r.goals },
  { key: 'assists', label: 'Assists', value: (r: LeaderboardRow) => r.assists },
  { key: 'ga', label: 'G + A', value: (r: LeaderboardRow) => r.goals + r.assists },
  { key: 'mvps', label: 'MOTM', value: (r: LeaderboardRow) => r.mvps },
  { key: 'matches', label: 'Played', value: (r: LeaderboardRow) => r.matches },
  { key: 'clean_sheets', label: 'Clean sheets', value: (r: LeaderboardRow) => r.clean_sheets },
] as const

type SortKey = (typeof SORTS)[number]['key']

export default function Leaderboard() {
  const { group, config, myPlayerId } = useCurrentGroup()
  const [thisYear] = useState(() => new Date().getFullYear())
  const [year, setYear] = useState<number | null>(thisYear)
  const [sortKey, setSortKey] = useState<SortKey>('rating')
  const years = useLoad(() => api.getSeasonYears(group.id), [group.id])
  const board = useLoad(() => api.getLeaderboard(group.id, year), [group.id, year])

  const sort = SORTS.find((s) => s.key === sortKey)!
  const minMatches = config?.min_matches_for_leaderboard ?? 3
  const rows = [...(board.data ?? [])].sort(
    (a, b) => sort.value(b) - sort.value(a) || b.avg_rating_exact - a.avg_rating_exact,
  )
  // The rating table only ranks players with enough matches; stat tables rank everyone.
  const ranked = sortKey === 'rating' ? rows.filter((r) => r.qualified) : rows
  const waiting = sortKey === 'rating' ? rows.filter((r) => !r.qualified) : []
  const yearTabs = [...new Set([thisYear, ...(years.data ?? [])])].sort((a, b) => b - a)

  return (
    <div>
      <PageTitle>Table</PageTitle>

      <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label="Season">
        {[...yearTabs, null].map((y) => (
          <button
            key={y ?? 'all'}
            type="button"
            role="tab"
            aria-selected={year === y}
            onClick={() => setYear(y)}
            className={`h-10 shrink-0 rounded-full px-4 font-display text-lg ${
              year === y ? 'border-2 border-[#0b0b0b] bg-brand text-on-brand' : 'border-[1.5px] border-line bg-paper text-muted'
            }`}
          >
            {y ?? 'All-time'}
          </button>
        ))}
      </div>

      <div className="-mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 pb-1" aria-label="Sort by">
        {SORTS.map((s) => (
          <button
            key={s.key}
            type="button"
            aria-pressed={sortKey === s.key}
            onClick={() => setSortKey(s.key)}
            className={`h-9 shrink-0 rounded-lg px-3 text-sm font-semibold ${
              sortKey === s.key ? 'bg-ink text-paper' : 'bg-paper text-muted'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <ErrorNote message={board.error} onRetry={board.reload} />
      {board.loading && !board.data ? (
        <Loading />
      ) : rows.length === 0 ? (
        <Empty title="No finished nights yet">Ratings appear here once a night's voting closes.</Empty>
      ) : (
        <>
          {ranked.length === 0 ? (
            <Empty title="Nobody has enough matches yet">
              Players join the table after {minMatches} rated nights{year ? ' this season' : ''}.
            </Empty>
          ) : (
            <Table rows={ranked} sortKey={sortKey} myPlayerId={myPlayerId} />
          )}
          {waiting.length > 0 && (
            <div className="mt-6">
              <Heading className="mb-2">Needs {minMatches} nights to be ranked</Heading>
              <Table rows={waiting} sortKey={sortKey} myPlayerId={myPlayerId} unranked />
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Table({
  rows,
  sortKey,
  myPlayerId,
  unranked = false,
}: {
  rows: LeaderboardRow[]
  sortKey: SortKey
  myPlayerId: string
  unranked?: boolean
}) {
  const sort = SORTS.find((s) => s.key === sortKey)!
  return (
    <m.ol initial="initial" animate="animate" variants={cascade} className="divide-y divide-line overflow-hidden rounded-card border-[1.5px] border-line bg-paper">
      <li className="flex items-center gap-3 px-4 py-2 text-xs font-semibold tracking-wide text-muted uppercase" aria-hidden>
        <span className="w-6">#</span>
        <span className="flex-1">Player</span>
        <span className="w-10 text-right">P</span>
        {sortKey !== 'rating' && sortKey !== 'matches' && <span className="w-12 text-right">{sort.label}</span>}
        <span className="w-11 text-center">Avg</span>
      </li>
      {rows.map((r, i) => (
        <m.li key={r.player_id} layout variants={cascadeItem}>
          <Link
            to={`/players/${r.player_id}`}
            className={`flex min-h-13 items-center gap-3 px-4 py-2 ${r.player_id === myPlayerId ? 'bg-brand/15' : ''}`}
          >
            <span className="tabular w-6 font-display text-lg text-muted">{unranked ? '–' : i + 1}</span>
            <Name className="flex-1 truncate font-semibold">{r.display_name}</Name>
            <span className="tabular w-10 text-right text-muted">{r.matches}</span>
            {sortKey !== 'rating' && sortKey !== 'matches' && (
              <span className="tabular w-12 text-right font-display text-xl">{sort.value(r)}</span>
            )}
            <span className="w-11 text-center">
              <RatingBadge value={r.avg_rating} size="sm" />
            </span>
          </Link>
        </m.li>
      ))}
    </m.ol>
  )
}
