import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { PublicGroupList } from '../components/groups'
import { ChevronIcon } from '../components/icons'
import { Cascade } from '../components/motion'
import { Avatar, Card, ErrorNote, Heading, Name, PageTitle } from '../components/ui'
import * as api from '../lib/api'
import { POSITIONS } from '../lib/card'
import { useLoad } from '../lib/useLoad'

/** Find (/find): search players by name, and the public groups (Plans/Accounts-groups-and-chat.md section 5). */
export default function Find() {
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  // Search once typing pauses.
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(query.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [query])
  const hits = useLoad(() => (search.length >= 2 ? api.searchAccounts(search) : Promise.resolve([])), [search])

  return (
    <Cascade className="space-y-4">
      <PageTitle sub="Players and public groups.">Find</PageTitle>
      <Card>
        <label className="block">
          <span className="text-sm font-medium">Search players</span>
          <input
            type="search"
            enterKeyHint="search"
            dir="auto"
            placeholder="A name, 2 letters or more"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="mt-1 h-12 w-full rounded-xl border-[1.5px] border-line bg-paper px-3 text-base"
          />
        </label>
        <ErrorNote message={hits.error} onRetry={hits.reload} />
        {search.length >= 2 && hits.data && hits.data.length === 0 && (
          <p className="mt-3 text-sm text-muted">Nobody by that name yet.</p>
        )}
        {search.length >= 2 && hits.data && hits.data.length > 0 && (
          <ul className="mt-2 divide-y divide-line">
            {hits.data.map((h) => {
              const position = POSITIONS.find((p) => p.value === h.favourite_position)?.label
              const facts = [h.shirt_number != null && `#${h.shirt_number}`, position].filter(Boolean).join(' · ')
              return (
                <li key={h.user_id}>
                  <Link to={`/u/${h.user_id}`} className="flex min-h-14 items-center gap-3 py-2">
                    <Avatar name={h.display_name} url={h.avatar_url} size={40} />
                    <span className="min-w-0 flex-1">
                      <Name className="block truncate font-bold">{h.display_name}</Name>
                      <span className="text-xs text-muted">{facts || 'Player'}</span>
                    </span>
                    <ChevronIcon size={18} className="text-muted" />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
      <Card>
        <Heading className="mb-1">Public groups</Heading>
        <PublicGroupList />
      </Card>
    </Cascade>
  )
}
