// Home, the group hub (Plans/Accounts-groups-and-chat.md section 8). Pure
// functions, tested in hub.test.ts.

/** Until a night starts: "in 2 days 4 h", "in 12 h 0 min", "in 45 min", or "starting now". */
export function countdown(startsAt: string, now: Date): string {
  const minutes = Math.floor((Date.parse(startsAt) - now.getTime()) / 60_000)
  if (minutes <= 0) return 'starting now'
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  if (days > 0) return `in ${days} day${days === 1 ? '' : 's'} ${hours} h`
  if (hours > 0) return `in ${hours} h ${minutes % 60} min`
  return `in ${minutes} min`
}

/** The podium's order: second, first, third, so first stands in the middle. */
export function podiumOrder<T>(top: T[]): T[] {
  return [top[1], top[0], top[2]].filter((row): row is T => row !== undefined)
}
