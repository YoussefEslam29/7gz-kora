import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import * as api from '../lib/api'
import { errorMessage } from '../lib/format'
import { KEYS, readLocal, writeLocal } from '../lib/storage'
import type { Group, Member, Membership, Player, RatingConfig } from '../lib/types'
import { useAuth } from './auth'

interface GroupState {
  loading: boolean
  error: string | null
  memberships: Membership[]
  /** The group being viewed (null when the user has no group yet). */
  group: Group | null
  myPlayerId: string | null
  isAdmin: boolean
  players: Player[]
  members: Member[]
  config: RatingConfig | null
  playerName: (id: string | null | undefined) => string
  player: (id: string | null | undefined) => Player | undefined
  switchGroup: (groupId: string) => void
  /** Reload memberships and the current group's players/members/config. */
  refresh: () => Promise<void>
}

const GroupContext = createContext<GroupState | null>(null)

export function GroupProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [currentId, setCurrentId] = useState<string | null>(() => readLocal(KEYS.currentGroup))
  const [players, setPlayers] = useState<Player[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [config, setConfig] = useState<RatingConfig | null>(null)
  const [membershipsLoading, setMembershipsLoading] = useState(true)
  const [loadedGroupId, setLoadedGroupId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const membership = memberships.find((m) => m.group.id === currentId) ?? memberships[0] ?? null
  const groupId = membership?.group.id ?? null

  const loadMemberships = useCallback(async () => {
    if (!user) return
    setMemberships(await api.getMemberships(user.id))
  }, [user])

  const loadGroup = useCallback(async (id: string) => {
    // Close any match whose voting time is up, so results are ready.
    await api.closeDueMatches(id).catch(() => 0)
    const [p, m, c] = await Promise.all([api.getPlayers(id), api.getMembers(id), api.getRatingConfig(id)])
    setPlayers(p)
    setMembers(m)
    setConfig(c)
    setLoadedGroupId(id)
  }, [])

  // Both loaders only set state after their network calls resolve.
  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect
    loadMemberships()
      .catch((e: unknown) => setError(errorMessage(e)))
      .finally(() => setMembershipsLoading(false))
  }, [loadMemberships])

  useEffect(() => {
    if (!groupId) return
    // eslint-disable-next-line react/set-state-in-effect
    void loadGroup(groupId).catch((e: unknown) => setError(errorMessage(e)))
  }, [groupId, loadGroup])

  const refresh = useCallback(async () => {
    await loadMemberships()
    if (groupId) await loadGroup(groupId)
  }, [groupId, loadGroup, loadMemberships])

  const switchGroup = useCallback((id: string) => {
    writeLocal(KEYS.currentGroup, id)
    setCurrentId(id)
  }, [])

  // Ready once memberships are known and the current group's data has arrived.
  const loading = membershipsLoading || (groupId !== null && loadedGroupId !== groupId)

  const value = useMemo<GroupState>(() => {
    const byId = new Map(players.map((p) => [p.id, p]))
    return {
      loading,
      error,
      memberships,
      group: membership?.group ?? null,
      myPlayerId: membership?.player_id ?? null,
      isAdmin: membership?.role === 'admin',
      players,
      members,
      config,
      player: (id) => (id ? byId.get(id) : undefined),
      playerName: (id) => (id ? (byId.get(id)?.display_name ?? 'Unknown player') : ''),
      switchGroup,
      refresh,
    }
  }, [loading, error, memberships, membership, players, members, config, switchGroup, refresh])

  return <GroupContext.Provider value={value}>{children}</GroupContext.Provider>
}

// eslint-disable-next-line react/only-export-components
export function useGroup(): GroupState {
  const ctx = useContext(GroupContext)
  if (!ctx) throw new Error('useGroup must be used inside GroupProvider')
  return ctx
}

/** Like useGroup, but for screens that only render once a group exists. */
// eslint-disable-next-line react/only-export-components
export function useCurrentGroup() {
  const state = useGroup()
  if (!state.group || !state.myPlayerId) throw new Error('No group selected')
  return { ...state, group: state.group, myPlayerId: state.myPlayerId }
}
