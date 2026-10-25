import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { BackIcon, ChevronIcon } from '../components/icons'
import { Button, Empty, ErrorNote, Heading, Loading, Name, PageTitle } from '../components/ui'
import * as api from '../lib/api'
import { describeAudit, type AuditNames } from '../lib/audit'
import { clockOf, dayOf, errorMessage, formatDay } from '../lib/format'
import type { AuditEntry } from '../lib/types'
import { useCurrentGroup } from '../state/group'

/** Who changed what, and when (admins): the group's audit log, newest first, by day. */
export default function ChangeHistory() {
  const { group, isAdmin, players, playerName } = useCurrentGroup()
  const [entries, setEntries] = useState<AuditEntry[] | null>(null)
  const [more, setMore] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isAdmin) return
    api
      .getAuditLog(group.id, null)
      .then((rows) => {
        setEntries(rows)
        setMore(rows.length === api.AUDIT_PAGE)
      })
      .catch((e: unknown) => setError(errorMessage(e)))
  }, [group.id, isAdmin])

  if (!isAdmin) return <ErrorNote message="Only group admins can see the change history." />
  if (!entries) return error ? <ErrorNote message={error} /> : <Loading />

  // Former members keep their player row, so their names still show.
  const userName = (userId: string) => players.find((p) => p.user_id === userId)?.display_name
  const names: AuditNames = { player: playerName, user: (userId) => userName(userId) ?? 'a former member' }
  const actor = (e: AuditEntry) => (e.actor_id ? (userName(e.actor_id) ?? 'A former member') : 'The app')

  const days = new Map<string, AuditEntry[]>()
  for (const e of entries) {
    const day = dayOf(new Date(e.created_at))
    days.set(day, [...(days.get(day) ?? []), e])
  }

  async function loadMore() {
    if (!entries) return
    setBusy(true)
    setError(null)
    try {
      const rows = await api.getAuditLog(group.id, entries[entries.length - 1].created_at)
      setEntries([...entries, ...rows])
      setMore(rows.length === api.AUDIT_PAGE)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <Link to="/settings" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-muted">
        <BackIcon size={18} /> More
      </Link>
      <PageTitle sub="Who changed what, and when. Newest first.">Change history</PageTitle>
      <ErrorNote message={error} />

      {entries.length === 0 && <Empty title="Nothing yet">Changes show here as the group uses the app.</Empty>}
      {[...days].map(([day, list]) => (
        <section key={day} className="mb-5">
          <Heading className="mb-2">{formatDay(day)}</Heading>
          <ul className="divide-y divide-line overflow-hidden rounded-card border-[1.5px] border-line bg-paper">
            {list.map((e) => {
              // A deleted night can't be opened any more.
              const matchId = typeof e.details.match_id === 'string' && e.action !== 'match_deleted' ? e.details.match_id : null
              const line = (
                <>
                  <span className="tabular w-11 shrink-0 text-sm text-muted">{clockOf(e.created_at)}</span>
                  <p className="min-w-0 flex-1 text-sm">
                    <Name className="font-semibold">{actor(e)}</Name>{' '}
                    {describeAudit(e, names).map((part, i) =>
                      typeof part === 'string' ? (
                        <span key={i}>{part}</span>
                      ) : (
                        <Name key={i} className="font-semibold">
                          {part.name}
                        </Name>
                      ),
                    )}
                  </p>
                </>
              )
              return (
                <li key={e.id}>
                  {matchId ? (
                    <Link to={`/nights/${matchId}`} className="flex min-h-12 items-center gap-3 px-4 py-2">
                      {line}
                      <ChevronIcon size={16} className="shrink-0 text-muted" />
                    </Link>
                  ) : (
                    <div className="flex min-h-12 items-center gap-3 px-4 py-2">{line}</div>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      {more && (
        <Button variant="secondary" className="w-full" busy={busy} onClick={() => void loadMore()}>
          Show more
        </Button>
      )}
    </div>
  )
}
