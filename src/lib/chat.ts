// The group chat (Plans/Accounts-groups-and-chat.md section 6). Pure
// functions, tested in chat.test.ts.
import { dayOf, formatDay } from './format'
import type { ChatMessage } from './types'

/** Messages by the same player this close together share one name and one time. */
export const CHAT_GAP_MINUTES = 5

const time = (iso: string) => Date.parse(iso)
const sameDay = (a: string, b: string) => dayOf(new Date(a)) === dayOf(new Date(b))

/** Adds new or changed messages (matched by id) and keeps them oldest first. */
export function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const byId = new Map(current.map((m) => [m.id, m]))
  for (const m of incoming) byId.set(m.id, m)
  return [...byId.values()].sort((a, b) => time(a.created_at) - time(b.created_at) || a.id.localeCompare(b.id))
}

/** The dot on the Chat tab: someone else wrote after the newest message you've seen. */
export function hasUnread(latest: ChatMessage | undefined, lastRead: string | null, myUserId: string | undefined): boolean {
  if (!latest || latest.user_id === myUserId) return false
  return lastRead === null || time(latest.created_at) > time(lastRead)
}

/** "Today", "Yesterday" or "Thu 22 Oct" */
export function dayLabel(iso: string, now: Date): string {
  const day = dayOf(new Date(iso))
  if (day === dayOf(now)) return 'Today'
  if (day === dayOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))) return 'Yesterday'
  return formatDay(day)
}

export type ChatRow =
  | { kind: 'day'; key: string; label: string }
  | {
      kind: 'message'
      key: string
      message: ChatMessage
      /** The start of a run: show the name and photo. */
      first: boolean
      /** The end of a run: show the time. */
      last: boolean
    }

/** One run: the same player, the same day, at most CHAT_GAP_MINUTES apart. */
function sameRun(a: ChatMessage | undefined, b: ChatMessage | undefined): boolean {
  return (
    !!a &&
    !!b &&
    a.player_id === b.player_id &&
    sameDay(a.created_at, b.created_at) &&
    Math.abs(time(b.created_at) - time(a.created_at)) <= CHAT_GAP_MINUTES * 60_000
  )
}

/** The chat as rows: a day line where the day changes, and messages grouped into runs. */
export function chatRows(messages: ChatMessage[], now: Date): ChatRow[] {
  const rows: ChatRow[] = []
  messages.forEach((m, i) => {
    const before = messages[i - 1]
    if (!before || !sameDay(before.created_at, m.created_at)) {
      rows.push({ kind: 'day', key: `day-${m.id}`, label: dayLabel(m.created_at, now) })
    }
    rows.push({ kind: 'message', key: m.id, message: m, first: !sameRun(before, m), last: !sameRun(m, messages[i + 1]) })
  })
  return rows
}
