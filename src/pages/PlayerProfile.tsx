import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { ChevronIcon, StarIcon } from '../components/icons'
import { Avatar, Button, Card, Empty, ErrorNote, Heading, Loading, Name, RatingBadge } from '../components/ui'
import * as api from '../lib/api'
import { errorMessage, formatDay } from '../lib/format'
import type { LeaderboardRow } from '../lib/types'
import { useLoad } from '../lib/useLoad'
import { useCurrentGroup } from '../state/group'

export default function PlayerProfile() {
  const { id = '' } = useParams()
  const { group, player, myPlayerId, isAdmin, members } = useCurrentGroup()
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
  const role = members.find((m) => m.player_id === id)?.role

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Avatar name={p.display_name} url={p.avatar_url} size={64} />
        <div className="min-w-0">
          <h1 className="font-display text-3xl leading-tight">
            <Name>{p.display_name}</Name>
          </h1>
          <p className="text-sm text-muted">
            {isMe ? 'You' : 'Player'}
            {role === 'admin' && ' · Admin'}
            {!p.user_id && ' · no account'}
          </p>
        </div>
      </div>

      {(isMe || isAdmin) && <RenameForm key={id} playerId={id} current={p.display_name} />}

      {loading && !data ? (
        <Loading />
      ) : (
        <>
          <ErrorNote message={error} onRetry={reload} />
          <StatsCard title={`Season ${year}`} row={data?.season} />
          <StatsCard title="All-time" row={data?.allTime} />

          <section>
            <Heading className="mb-2">Nights</Heading>
            {data?.history.length === 0 ? (
              <Empty title="No rated nights yet">Ratings appear after a night's voting closes.</Empty>
            ) : (
              <ul className="divide-y divide-line overflow-hidden rounded-card border-[1.5px] border-line bg-paper">
                {data?.history.map((h) => (
                  <li key={h.match_id}>
                    <Link to={`/nights/${h.match_id}`} className="flex min-h-14 items-center gap-3 px-4 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{formatDay(h.matches.played_at)}</p>
                        <p className="text-xs text-muted">
                          {[
                            h.goals > 0 && `${h.goals} G`,
                            h.assists > 0 && `${h.assists} A`,
                            h.clean_sheets > 0 && 'clean sheet',
                            h.stats_only && 'stats only',
                          ]
                            .filter(Boolean)
                            .join(' · ') || '—'}
                        </p>
                      </div>
                      {h.is_mvp && <StarIcon size={18} className="text-gold" aria-label="Man of the Match" />}
                      <RatingBadge value={h.rating} />
                      <ChevronIcon size={18} className="text-muted" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
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
            Average rating{row?.avg_votes != null && <> · peers give {row.avg_votes.toFixed(1)}</>}
          </p>
        </div>
        <RatingBadge value={row?.avg_rating} size="lg" />
      </div>
      <dl className="mt-3 grid grid-cols-5 gap-1 text-center">
        {stats.map(([label, value]) => (
          <div key={label}>
            <dt className="text-[11px] leading-tight text-muted">{label}</dt>
            <dd className="tabular font-display text-2xl">{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}

function RenameForm({ playerId, current }: { playerId: string; current: string }) {
  const { refresh } = useCurrentGroup()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(current)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!editing) {
    return (
      <button type="button" onClick={() => setEditing(true)} className="text-sm font-semibold text-brand-ink underline">
        Change name
      </button>
    )
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.renamePlayer(playerId, name)
      await refresh()
      setEditing(false)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="flex gap-2">
      <input
        value={name}
        maxLength={40}
        required
        dir="auto"
        onChange={(e) => setName(e.target.value)}
        className="h-12 min-w-0 flex-1 rounded-xl border-[1.5px] border-line bg-paper px-3 text-base"
      />
      <Button type="submit" busy={busy} disabled={!name.trim()}>
        Save
      </Button>
      <ErrorNote message={error} />
    </form>
  )
}
