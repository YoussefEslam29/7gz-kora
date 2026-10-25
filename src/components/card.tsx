// The player card (Plans/Player-card-and-motion.md section 1): a sticker in
// the 7GZ-KORA look with the rating, the shirt number, the position, foot and
// motto, and the self-rated skills.
import * as m from 'motion/react-m'
import { FEET, POSITIONS, SKILLS, selfRating, skillsState } from '../lib/card'
import type { Player } from '../lib/types'
import { GloveIcon } from './icons'
import { Avatar, Heading, Name, RatingBadge } from './ui'

/**
 * rating: the badge in the green band (this season's, else all-time) with its
 * label; null shows "New"; undefined (while loading, or a preview) shows none.
 * preview: Edit my card and the Welcome steps (the name isn't the page's heading).
 */
export function PlayerCard({
  player,
  rating,
  role,
  isMe = false,
  preview = false,
}: {
  player: Player
  rating?: { value: number; label: string } | null
  /** A line under the name, like "You · Admin". */
  role?: string
  isMe?: boolean
  preview?: boolean
}) {
  const foot = FEET.find((f) => f.value === player.strong_foot)
  const position = POSITIONS.find((p) => p.value === player.favourite_position)
  const Title = preview ? 'h2' : 'h1'
  return (
    <m.article
      initial={{ opacity: 0, y: 16, rotate: -2 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      className="overflow-hidden rounded-card border-2 border-ink bg-paper"
    >
      {/* A green surface, so its text is black. */}
      <div className="honeycomb flex min-h-[88px] items-start justify-between gap-3 px-4 pt-4 pb-3 text-on-brand">
        <div>
          {rating === null && <span className="chip bg-[#ffffff]">New</span>}
          {rating && (
            <>
              <RatingBadge value={rating.value} size="lg" animated className="border-2 border-[#0b0b0b]" />
              <p className="mt-1 text-[11.5px] font-bold tracking-[0.12em] uppercase opacity-75">{rating.label}</p>
            </>
          )}
        </div>
        {player.shirt_number != null && (
          <p className="font-display text-[56px] leading-none" aria-label={`Shirt number ${player.shirt_number}`}>
            {player.shirt_number}
          </p>
        )}
      </div>

      <div className="p-4">
        <div className="flex items-center gap-3">
          <Avatar name={player.display_name} url={player.avatar_url} size={56} />
          <div className="min-w-0">
            <Title className="font-display text-[28px] leading-tight">
              <Name>{player.display_name}</Name>
            </Title>
            {role && <p className="text-sm text-muted">{role}</p>}
          </div>
        </div>

        {(position || foot || player.happy_in_goal) && (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {position && <li className="chip status">{position.label}</li>}
            {foot && <li className="chip status">{foot.chip}</li>}
            {player.happy_in_goal && (
              <li className="chip status">
                <GloveIcon size={14} /> Happy in goal
              </li>
            )}
          </ul>
        )}
        {player.motto && (
          <p className="mt-3 text-lg font-semibold">
            “<Name>{player.motto}</Name>”
          </p>
        )}
        <SkillBars player={player} isMe={isMe} />
      </div>
    </m.article>
  )
}

/** The skills as bars on a 1-10 scale; the self-rating (their average) once all five are set. */
function SkillBars({ player, isMe }: { player: Player; isMe: boolean }) {
  if (skillsState(player) === 'none') return null
  const self = selfRating(player)
  return (
    <div className="mt-4">
      <div className="flex items-baseline justify-between">
        <Heading>{isMe ? 'You rate yourself' : 'Rates themselves'}</Heading>
        {self != null && <span className="tabular font-display text-2xl">{self.toFixed(1)}</span>}
      </div>
      <ul className="mt-1.5 space-y-1.5">
        {SKILLS.map(({ key, label }) => {
          const value = player[key]
          return (
            <li key={key} className="flex items-center gap-2 text-sm">
              <span className="w-20 shrink-0 text-muted">{label}</span>
              <span aria-hidden className="h-2.5 flex-1 overflow-hidden rounded-full bg-line">
                <m.span
                  className="block h-full origin-left rounded-full bg-brand"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: (value ?? 0) / 10 }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                />
              </span>
              <span className="tabular w-6 text-right font-display">{value ?? '–'}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
