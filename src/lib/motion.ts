// Shared animation settings (Plans/Player-card-and-motion.md section 5).
// Only movement and fading animate, so phones stay smooth.
import type { Transition, Variants } from 'motion/react'

/** A quick spring for things that move into place (the tab bubble, a switch). */
export const spring: Transition = { type: 'spring', stiffness: 500, damping: 32 }

/** A screen opening: it fades in and rises a little. */
export const rise = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.2, ease: 'easeOut' },
} as const

/** A stack or list whose items slide in one after another (each item uses cascadeItem). */
export const cascade: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.05 } },
}

export const cascadeItem: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
}
