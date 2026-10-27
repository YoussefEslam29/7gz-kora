// Pieces of Home, the group hub (Plans/Accounts-groups-and-chat.md section 8).
import * as m from 'motion/react-m'
import { useState } from 'react'
import { Link } from 'react-router'
import { isCardFilled } from '../lib/card'
import { podiumOrder } from '../lib/hub'
import { cascadeItem } from '../lib/motion'
import { KEYS, readLocal, writeLocal } from '../lib/storage'
import type { LeaderboardRow } from '../lib/types'
import { useMyAccount } from '../state/account'
import { useChat } from '../state/chat'
import { useCurrentGroup } from '../state/group'
import { GroupImage } from './groups'
import { ChevronIcon } from './icons'
import { CountUp } from './motion'
import { Avatar, Button, Card, Heading, LinkButton, Name, RatingBadge } from './ui'

/** Until your card is filled in: a nudge to do it. "Not now" hides it on this phone. */
export function FinishCard() {
  const account = useMyAccount()
  const key = `${KEYS.cardReminderHidden}.${account.id}`
  const [hidden, setHidden] = useState(() => readLocal(key) === '1')
  if (hidden || isCardFilled(account)) return null
  return (
    <Card strong>
      <Heading>Your player card</Heading>
      <p className="mt-1 font-display text-[22px] leading-tight">Finish your player card</p>
      <p className="mt-1 text-sm text-muted">Your shirt number, strong foot, favourite position, and how you rate yourself.</p>
      <div className="mt-3 flex gap-2">
        <LinkButton to="/me/edit" className="flex-1">
          Set up my card
        </LinkButton>
        <Button
          variant="ghost"
          onClick={() => {
            writeLocal(key, '1')
            setHidden(true)
          }}
        >
          Not now
        </Button>
      </div>
    </Card>
  )
}

/** The group's photo, name, Public / Private, and a row of faces that opens the Squad. */
export function GroupBanner() {
  const { group, members, player } = useCurrentGroup()
  const faces = members.slice(0, 6)
  const more = members.length - faces.length
  return (
    <m.section variants={cascadeItem} className="overflow-hidden rounded-card border-2 border-ink bg-paper">
      <GroupImage path={group.image_path} className="h-32 w-full" />
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h1 className="min-w-0 font-display text-[28px] leading-tight">
            <Name>{group.name}</Name>
          </h1>
          <span className="chip status mt-1 shrink-0">{group.is_public ? 'Public' : 'Private'}</span>
        </div>
        <Link to="/table/squad" className="mt-2 flex min-h-12 items-center gap-3" aria-label="See the squad">
          <span className="flex -space-x-2">
            {faces.map((mb) => {
              const p = player(mb.player_id)
              return (
                <span key={mb.user_id} className="rounded-full ring-2 ring-paper">
                  <Avatar name={p?.display_name ?? ''} url={p?.avatar_url} size={32} />
                </span>
              )
            })}
          </span>
          <span className="text-sm font-semibold">
            {more > 0 && `+${more} · `}
            {members.length} player{members.length === 1 ? '' : 's'}
          </span>
          <ChevronIcon size={18} className="ml-auto text-muted" />
        </Link>
      </div>
    </m.section>
  )
}

/** Your season: rating, nights, goals and Man of the Match, counting up. */
export function SeasonStrip({ row, year }: { row: LeaderboardRow | undefined; year: number }) {
  const stats = row
    ? ([
        ['Nights', row.matches],
        ['Goals', row.goals],
        ['MOTM', row.mvps],
      ] as const)
    : []
  return (
    <Card>
      <Heading>You this season · {year}</Heading>
      {!row ? (
        <p className="mt-1 text-sm text-muted">Play your first night to see your stats.</p>
      ) : (
        <div className="mt-2 grid grid-cols-4 items-end gap-2 text-center">
          <div>
            <RatingBadge value={row.avg_rating} animated />
            <p className="mt-1 text-[11px] text-muted">Rating</p>
          </div>
          {stats.map(([label, value]) => (
            <div key={label}>
              <p className="tabular font-display text-2xl leading-none">
                <CountUp value={value} />
              </p>
              <p className="mt-1 text-[11px] text-muted">{label}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

/** This season's top 3: second, first (raised, in the middle), third. */
export function Podium({ rows, year, minNights }: { rows: LeaderboardRow[]; year: number; minNights: number }) {
  const { player } = useCurrentGroup()
  return (
    <Card>
      <div className="mb-2 flex items-baseline justify-between">
        <Heading>Season {year} · top 3</Heading>
        <Link to="/table" className="text-sm font-semibold text-brand-ink">
          Full table
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">The table starts once players have {minNights} rated nights this season.</p>
      ) : (
        <ol className="flex items-end justify-center gap-2">
          {podiumOrder(rows).map((row) => {
            const place = rows.indexOf(row) + 1
            return (
              <li key={row.player_id} className="w-1/3 min-w-0">
                <Link to={`/players/${row.player_id}`} className="flex flex-col items-center gap-1 text-center">
                  <Avatar name={row.display_name} url={player(row.player_id)?.avatar_url} size={place === 1 ? 64 : 48} />
                  <Name className="w-full truncate text-sm font-bold">{row.display_name}</Name>
                  <RatingBadge value={row.avg_rating} />
                  {/* The step: first is the green one, with black text. */}
                  <span
                    className={`mt-1 flex w-full items-center justify-center rounded-t-xl border-2 border-ink font-display text-2xl ${
                      place === 1 ? 'h-16 bg-brand text-on-brand' : 'h-10 bg-ground'
                    }`}
                  >
                    {place}
                  </span>
                </Link>
              </li>
            )
          })}
        </ol>
      )}
    </Card>
  )
}

/** The last 3 messages and Open chat. */
export function ChatPreview() {
  const { messages } = useChat()
  const { playerName } = useCurrentGroup()
  const last = messages.filter((msg) => msg.body !== null).slice(-3)
  return (
    <Card>
      <Heading className="mb-1">Chat</Heading>
      {last.length === 0 ? (
        <p className="text-sm text-muted">Say hi to the group.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {last.map((msg) => (
            <li key={msg.id} className="line-clamp-2">
              <Name className="font-bold">{playerName(msg.player_id)}</Name>:{' '}
              <span dir="auto">{msg.body}</span>
            </li>
          ))}
        </ul>
      )}
      <LinkButton to="/chat" variant="secondary" className="mt-3 w-full">
        Open chat
      </LinkButton>
    </Card>
  )
}
