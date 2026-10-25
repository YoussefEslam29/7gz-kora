// The GOAL! splash when an admin logs a goal in the game on now
// (Plans/Player-card-and-motion.md section 5). It closes by itself after
// about 1.2 seconds; a tap closes it early. Black text on the green; the
// flying balls are white line art, like the logo.
import { AnimatePresence } from 'motion/react'
import * as m from 'motion/react-m'
import { useEffect } from 'react'
import type { Team } from '../lib/types'
import { BallIcon } from './icons'
import { Name, TeamTag } from './ui'

export interface SplashGoal {
  /** The goal's id, so two goals in a row each get their splash. */
  id: string
  scorer: string
  team: Team
}

/** Where the balls fly to from the middle, in pixels. */
const BURST: [number, number][] = [
  [-120, -90],
  [0, -150],
  [120, -90],
  [150, 30],
  [90, 140],
  [-90, 140],
  [-150, 30],
]

export function GoalSplash({ goal, onDone }: { goal: SplashGoal | null; onDone: () => void }) {
  useEffect(() => {
    if (!goal) return
    navigator.vibrate?.(80)
    const timer = window.setTimeout(onDone, 1200)
    return () => window.clearTimeout(timer)
  }, [goal, onDone])

  return (
    <AnimatePresence>
      {goal && (
        <m.div
          key={goal.id}
          role="status"
          onClick={onDone}
          className="honeycomb fixed inset-0 z-50 flex flex-col items-center justify-center text-on-brand"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {BURST.map(([x, y]) => (
            <m.span
              key={`${x},${y}`}
              aria-hidden
              className="absolute text-[#ffffff]"
              initial={{ x: 0, y: 0, scale: 0.4, opacity: 1 }}
              animate={{ x, y, scale: 1, opacity: 0 }}
              transition={{ duration: 0.9, ease: 'easeOut' }}
            >
              <BallIcon size={30} />
            </m.span>
          ))}
          <m.p
            className="font-display text-[88px] leading-none"
            initial={{ scale: 0.4, rotate: -8 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 14 }}
          >
            GOAL!
          </m.p>
          <m.p
            className="mt-3 font-display text-[26px] leading-tight"
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15 }}
          >
            <Name>{goal.scorer}</Name>
          </m.p>
          <span className="mt-3">
            <TeamTag team={goal.team} />
          </span>
        </m.div>
      )}
    </AnimatePresence>
  )
}
