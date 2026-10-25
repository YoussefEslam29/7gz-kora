// Animation helpers (Plans/Player-card-and-motion.md section 5), with the
// Motion library (formerly Framer Motion). Screens use the small `m`
// components; MotionProvider loads their features in the background. With
// "reduce motion" on the phone, movement turns off and fades stay.
import { AnimatePresence, LazyMotion, MotionConfig, useReducedMotion } from 'motion/react'
import * as m from 'motion/react-m'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cascade } from '../lib/motion'

// Starts loading as soon as the app opens.
const features = import('../lib/motionFeatures').then((module) => module.default)

export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={() => features} strict>
        {children}
      </LazyMotion>
    </MotionConfig>
  )
}

/** A stack of cards (or rows) that slide in one after another when the screen opens. */
export function Cascade({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <m.div className={className} initial="initial" animate="animate" variants={cascade}>
      {children}
    </m.div>
  )
}

/** Opens and closes its content smoothly (a breakdown under a row). */
export function Reveal({ open, children }: { open: boolean; children: ReactNode }) {
  const reduce = useReducedMotion()
  return (
    <AnimatePresence initial={false}>
      {open && (
        <m.div
          key="reveal"
          className="overflow-hidden"
          initial={reduce ? false : { height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
        >
          {children}
        </m.div>
      )}
    </AnimatePresence>
  )
}

// CountUp and Bump use the browser's own animation tools (requestAnimationFrame
// and element.animate) rather than Motion's, so Motion's animation engine stays
// in the background chunk instead of the first download.

/** A number that counts up from 0 when it first shows, and on to each new value. */
export function CountUp({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const reduce = useReducedMotion()
  const [shown, setShown] = useState(0)
  const from = useRef(0)
  useEffect(() => {
    if (reduce) return
    const begin = from.current
    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 700)
      // Ease out: fast at first, slowing down into the final number.
      const n = begin + (value - begin) * (1 - (1 - t) ** 3)
      from.current = n
      setShown(n)
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, reduce])
  return <>{(reduce ? value : shown).toFixed(decimals)}</>
}

/** Bounces its content when `value` changes (not when it first shows): the live score. */
export function Bump({ value, children }: { value: unknown; children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null)
  const reduce = useReducedMotion()
  const previous = useRef(value)
  useEffect(() => {
    if (Object.is(previous.current, value)) return
    previous.current = value
    if (!reduce) {
      ref.current?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.35)' }, { transform: 'scale(1)' }], {
        duration: 450,
        easing: 'ease-out',
      })
    }
  }, [value, reduce])
  return (
    <span ref={ref} className="inline-block">
      {children}
    </span>
  )
}
