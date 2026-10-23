import { useCallback, useEffect, useRef, useState } from 'react'
import { errorMessage } from './format'

interface LoadState<T> {
  data: T | undefined
  error: string | null
  loading: boolean
  /** Fetch again (keeps showing the old data meanwhile). */
  reload: () => void
}

/**
 * Loads data when the screen opens, and again whenever `deps` change or the
 * app comes back to the foreground (so a phone left in a pocket shows fresh
 * scores when unlocked). Optionally polls every `pollMs` milliseconds.
 */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[], pollMs?: number): LoadState<T> {
  const [data, setData] = useState<T>()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const loadRef = useRef(load)
  loadRef.current = load

  const reload = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    let alive = true
    setLoading(true)
    loadRef.current().then(
      (result) => {
        if (!alive) return
        setData(result)
        setError(null)
        setLoading(false)
      },
      (e: unknown) => {
        if (!alive) return
        setError(errorMessage(e))
        setLoading(false)
      },
    )
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') reload()
    }
    document.addEventListener('visibilitychange', onVisible)
    const timer = pollMs ? window.setInterval(() => document.visibilityState === 'visible' && reload(), pollMs) : 0
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      if (timer) window.clearInterval(timer)
    }
  }, [reload, pollMs])

  return { data, error, loading, reload }
}
