import { useEffect, useState } from 'react'

/** The current time, updated every `ms` milliseconds (for the game clock and minutes). */
export function useNow(ms = 1000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), ms)
    return () => window.clearInterval(timer)
  }, [ms])
  return now
}
