// Self vs friends (Plans/Player-card-and-motion.md section 2): the
// self-rating next to what friends give in their votes. Just for fun: it
// changes nothing else.
import * as m from 'motion/react-m'
import { Link } from 'react-router'
import { CONFIDENCE, confidence, friendsScore, selfRating, type Confidence } from '../lib/card'
import { formatPoints } from '../lib/format'
import type { LeaderboardRow, Player } from '../lib/types'
import { Card, Heading } from './ui'

/** Black text on every colour; never colour alone (the chip says the word). */
const CHIP: Record<Confidence, string> = {
  modest: 'status',
  spot_on: 'bg-brand',
  confident: 'bg-[var(--rate-ok)]',
  very_confident: 'border-danger bg-paper text-danger',
}

export function SelfVsFriends({
  player,
  season,
  allTime,
  minNights,
  isMe,
}: {
  player: Player
  season: LeaderboardRow | undefined
  allTime: LeaderboardRow | undefined
  /** The table's "nights to join" setting. */
  minNights: number
  isMe: boolean
}) {
  const self = selfRating(player)
  const friends = friendsScore(season, allTime, minNights)
  const verdict = self != null && friends.kind === 'score' ? confidence(self, friends.score) : null

  return (
    <Card>
      <Heading className="mb-1">Self vs friends</Heading>
      {self == null ? (
        <p className="text-sm text-muted">
          {isMe ? (
            <>
              Rate yourself on{' '}
              <Link to={`/players/${player.id}/edit`} className="font-semibold text-brand-ink underline">
                your card
              </Link>{' '}
              to see how it compares with your friends' votes.
            </>
          ) : (
            'No self-rating yet.'
          )}
        </p>
      ) : (
        <>
          <Bar label={isMe ? 'You say' : 'Says'} value={self} tone="bg-ink" />
          {friends.kind === 'score' && (
            <Bar label={friends.season ? 'Friends give (this season)' : 'Friends give (all-time)'} value={friends.score} tone="bg-brand" />
          )}
          {friends.kind === 'wait' && (
            <p className="mt-3 text-sm text-muted">
              {isMe ? 'Play' : 'After'} {friends.nightsToGo} more rated night{friends.nightsToGo === 1 ? '' : 's'}
              {isMe ? ' to see what your friends think.' : ", friends' votes show here."}
            </p>
          )}
          {friends.kind === 'no_votes' && <p className="mt-3 text-sm text-muted">Not enough votes yet.</p>}
          {verdict && (
            <>
              <div className="mt-3 flex items-center gap-2">
                <span className={`chip ${CHIP[verdict.level]}`}>{CONFIDENCE[verdict.level].label}</span>
                <span className="tabular text-sm font-semibold">{formatPoints(verdict.gap)}</span>
              </div>
              <p className="mt-1 text-sm text-muted">{CONFIDENCE[verdict.level].note}</p>
            </>
          )}
        </>
      )}
    </Card>
  )
}

/** One bar on the 1-10 scale, with its number. */
function Bar({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="mt-2">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-muted">{label}</span>
        <span className="tabular font-display text-xl">{value.toFixed(1)}</span>
      </div>
      <div aria-hidden className="mt-1 h-3 overflow-hidden rounded-full bg-line">
        <m.div
          className={`h-full origin-left rounded-full ${tone}`}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: value / 10 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}
