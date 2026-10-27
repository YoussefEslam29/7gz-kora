import { useState } from 'react'
import * as m from 'motion/react-m'
import { Link } from 'react-router'
import { TableTabs } from '../components/tabletabs'
import { Avatar, Name, PageTitle, RatingBadge } from '../components/ui'
import * as api from '../lib/api'
import { POSITIONS } from '../lib/card'
import { cascade, cascadeItem } from '../lib/motion'
import type { Player } from '../lib/types'
import { useLoad } from '../lib/useLoad'
import { useCurrentGroup } from '../state/group'

/**
 * The Squad (/table/squad, Plans/Accounts-groups-and-chat.md section 5):
 * everyone in the group as a mini card, sorted by name. Tap one for their
 * profile.
 */
export default function Squad() {
  const { group, players, members } = useCurrentGroup()
  const [year] = useState(() => new Date().getFullYear())
  const ratings = useLoad(() => api.getRatingAverages(group.id, year), [group.id, year])

  // Members, plus players without an account (the demo players, guests later).
  const memberIds = new Set(members.map((mb) => mb.player_id))
  const squad = players
    .filter((p) => memberIds.has(p.id) || !p.user_id)
    .sort((a, b) => a.display_name.localeCompare(b.display_name))
  const rating = (id: string) => ratings.data?.season.get(id) ?? ratings.data?.allTime.get(id)

  return (
    <div>
      <TableTabs active="squad" />
      <PageTitle sub={`${squad.length} players in ${group.name}`}>Squad</PageTitle>
      <m.ul className="grid grid-cols-2 gap-3" initial="initial" animate="animate" variants={cascade}>
        {squad.map((p) => (
          <m.li key={p.id} variants={cascadeItem}>
            <SquadCard player={p} rating={rating(p.id)} />
          </m.li>
        ))}
      </m.ul>
    </div>
  )
}

function SquadCard({ player, rating }: { player: Player; rating: number | undefined }) {
  const position = POSITIONS.find((p) => p.value === player.favourite_position)
  return (
    <Link to={`/players/${player.id}`} className="block overflow-hidden rounded-card border-2 border-ink bg-paper">
      {/* A green surface, so its text is black. */}
      <div className="honeycomb flex h-14 items-center justify-between px-3 text-on-brand">
        <span className="font-display text-3xl leading-none" aria-label={player.shirt_number ? `Shirt number ${player.shirt_number}` : undefined}>
          {player.shirt_number ?? ''}
        </span>
        {rating != null ? (
          <RatingBadge value={Math.round(rating * 10) / 10} size="sm" className="border-2 border-[#0b0b0b]" />
        ) : (
          <span className="chip bg-[#ffffff]">New</span>
        )}
      </div>
      <div className="flex flex-col items-center gap-1 p-3 text-center">
        <Avatar name={player.display_name} url={player.avatar_url} size={48} />
        <Name className="w-full truncate font-bold">{player.display_name}</Name>
        {position ? <span className="chip status">{position.label}</span> : <span className="h-6" />}
      </div>
    </Link>
  )
}
