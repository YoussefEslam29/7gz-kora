import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { PlayerCard } from '../components/card'
import { GroupImage, useEnterGroup } from '../components/groups'
import { Cascade, CountUp } from '../components/motion'
import { Button, Card, ErrorNote, Heading, LinkButton, Loading, Name } from '../components/ui'
import * as api from '../lib/api'
import { errorMessage } from '../lib/format'
import type { AccountGroup } from '../lib/types'
import { useLoad } from '../lib/useLoad'
import { useAccount } from '../state/account'
import { useAuth } from '../state/auth'
import { useGroup } from '../state/group'

/**
 * An account page (/u/:id, and /me for yours), Instagram style
 * (Plans/Accounts-groups-and-chat.md section 5): the card, totals across all
 * groups, the skills if shown, and the groups you may see.
 */
export default function Account() {
  const { id } = useParams()
  const { user } = useAuth()
  const { account } = useAccount()
  const { group, myPlayerId, switchGroup } = useGroup()
  const navigate = useNavigate()
  const enter = useEnterGroup()
  const userId = id ?? user?.id ?? ''
  const isMe = userId === user?.id
  // Reloads after you edit your own card.
  const { data, error, loading, reload } = useLoad(() => api.getAccount(userId), [userId, account])
  const [busy, setBusy] = useState<string | null>(null)
  const [joinError, setJoinError] = useState<string | null>(null)

  if (loading && !data) return <Loading />
  if (!data) return <ErrorNote message={error} onRetry={reload} />

  async function join(g: AccountGroup) {
    setBusy(g.id)
    setJoinError(null)
    try {
      await api.joinPublicGroup(g.id, account?.display_name ?? '')
      await enter(g.id, g.name)
    } catch (e) {
      setJoinError(errorMessage(e))
      setBusy(null)
    }
  }

  /** Their full profile in a group you share (switching to it if needed). */
  function seeStats(g: AccountGroup) {
    if (g.id !== group?.id) switchGroup(g.id)
    navigate(`/players/${g.player_id}`)
  }

  const totals = [
    ['Nights', data.nights],
    ['Goals', data.goals],
    ['Man of the Match', data.mvps],
  ] as const

  return (
    <Cascade className="space-y-4">
      <PlayerCard player={data} isMe={isMe} role={isMe ? 'You' : undefined} />
      {isMe && (
        <div className="flex gap-2">
          <LinkButton to="/me/edit" className="flex-1">
            Edit my card
          </LinkButton>
          {group && myPlayerId && (
            <LinkButton to={`/players/${myPlayerId}`} variant="secondary" className="min-w-0 flex-1">
              <span className="truncate">
                My stats in <Name>{group.name}</Name>
              </span>
            </LinkButton>
          )}
        </div>
      )}

      <Card>
        <Heading>{isMe ? 'Your totals' : 'Totals'} · all groups</Heading>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          {totals.map(([label, value]) => (
            <div key={label}>
              <p className="tabular font-display text-3xl">
                <CountUp value={value} />
              </p>
              <p className="text-xs leading-tight text-muted">{label}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <Heading className="mb-1">Groups</Heading>
        <ErrorNote message={joinError} />
        {data.groups.length === 0 ? (
          <p className="text-sm text-muted">{isMe ? "You're not in a group yet." : 'No public groups.'}</p>
        ) : (
          <ul className="divide-y divide-line">
            {data.groups.map((g) => (
              <li key={g.id} className="py-2">
                <div className="flex items-center gap-3">
                  <GroupImage path={g.image_path} className="size-12 shrink-0 rounded-xl" />
                  <div className="min-w-0 flex-1">
                    <Name className="block truncate font-bold">{g.name}</Name>
                    <span className="text-xs text-muted">
                      {g.is_public ? 'Public' : 'Private'}
                      {g.i_am_in && !isMe && ' · you’re in it too'}
                    </span>
                  </div>
                  {!g.i_am_in && g.is_public && (
                    <Button size="sm" busy={busy === g.id} onClick={() => void join(g)}>
                      Join
                    </Button>
                  )}
                  {isMe && g.id === group?.id && <span className="text-sm text-muted">Current</span>}
                  {isMe && g.id !== group?.id && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        switchGroup(g.id)
                        navigate('/')
                      }}
                    >
                      Open
                    </Button>
                  )}
                </div>
                {!isMe && g.i_am_in && g.player_id && (
                  <button
                    type="button"
                    onClick={() => seeStats(g)}
                    className="mt-1 ml-15 min-h-10 text-left text-sm font-semibold text-brand-ink underline"
                  >
                    See their stats in <Name>{g.name}</Name>
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Cascade>
  )
}
