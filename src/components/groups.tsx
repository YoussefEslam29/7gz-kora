// Groups you can find, join and open (Plans/Accounts-groups-and-chat.md sections 3-5).
import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router'
import * as api from '../lib/api'
import { errorMessage, formatNightWhen } from '../lib/format'
import type { PublicGroup } from '../lib/types'
import { useLoad } from '../lib/useLoad'
import { useMyAccount } from '../state/account'
import { useGroup } from '../state/group'
import { useToast } from './feedback'
import { Button, ErrorNote, Name } from './ui'

/** The group photo, or the honeycomb green with the logo when there's none. */
export function GroupImage({ path, className = '' }: { path: string | null; className?: string }) {
  const url = api.groupImageUrl(path)
  if (url) return <img src={url} alt="" loading="lazy" className={`bg-line object-cover ${className}`} />
  return (
    <div aria-hidden className={`honeycomb flex items-center justify-center ${className}`}>
      <img src="/logo.svg" alt="" className="h-3/5 max-h-20" />
    </div>
  )
}

/** Opens a group you're in: switches to it, reloads, goes Home, and (after joining) says welcome. */
// eslint-disable-next-line react/only-export-components
export function useEnterGroup() {
  const { switchGroup, refresh } = useGroup()
  const navigate = useNavigate()
  const toast = useToast()
  return useCallback(
    async (groupId: string, name?: string, welcome = true) => {
      const groupName = welcome ? (name ?? (await api.getGroupName(groupId))) : ''
      switchGroup(groupId)
      await refresh()
      navigate('/')
      if (welcome) {
        toast(
          <>
            Welcome to <Name>{groupName}</Name>
          </>,
        )
      }
    },
    [switchGroup, refresh, navigate, toast],
  )
}

/** Public groups, most members first: Join (one tap), or Open if you're in already. */
export function PublicGroupList({ limit }: { limit?: number }) {
  const account = useMyAccount()
  const enter = useEnterGroup()
  const { data, error, loading, reload } = useLoad(() => api.listPublicGroups(), [])
  const [busy, setBusy] = useState<string | null>(null)
  const [joinError, setJoinError] = useState<string | null>(null)

  if (loading && !data) return <p className="text-sm text-muted">Looking for groups…</p>
  if (!data) return <ErrorNote message={error} onRetry={reload} />
  const groups = limit ? data.slice(0, limit) : data
  if (groups.length === 0) {
    return <p className="text-sm text-muted">No public groups yet. Start one, then switch it to Public in More.</p>
  }

  async function join(g: PublicGroup) {
    setBusy(g.id)
    setJoinError(null)
    try {
      if (!g.i_am_in) await api.joinPublicGroup(g.id, account.display_name)
      await enter(g.id, g.name, !g.i_am_in)
    } catch (e) {
      setJoinError(errorMessage(e))
      setBusy(null)
    }
  }

  return (
    <>
      <ErrorNote message={joinError} />
      <ul className="divide-y divide-line">
        {groups.map((g) => (
          <li key={g.id} className="flex items-center gap-3 py-2">
            <GroupImage path={g.image_path} className="size-14 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1">
              <Name className="block truncate font-bold">{g.name}</Name>
              <p className="truncate text-xs text-muted">
                {g.members} player{g.members === 1 ? '' : 's'}
                {g.next_night_day && (
                  <>
                    {' '}
                    · Next: {formatNightWhen({ played_at: g.next_night_day, starts_at: g.next_night_at })}
                    {g.next_night_location && (
                      <>
                        {' '}
                        · <Name>{g.next_night_location}</Name>
                      </>
                    )}
                  </>
                )}
              </p>
            </div>
            <Button size="sm" variant={g.i_am_in ? 'secondary' : 'primary'} busy={busy === g.id} onClick={() => void join(g)}>
              {g.i_am_in ? 'Open' : 'Join'}
            </Button>
          </li>
        ))}
      </ul>
    </>
  )
}
