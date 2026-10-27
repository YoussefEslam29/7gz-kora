import { describe, expect, it } from 'vitest'
import { chatRows, dayLabel, hasUnread, mergeMessages } from './chat'
import type { ChatMessage } from './types'

/** A message at a local time on 26 October 2026 (or another day of the month). */
function msg(id: string, player: string, hour: number, minute: number, day = 26): ChatMessage {
  return {
    id,
    group_id: 'g',
    player_id: player,
    user_id: `u-${player}`,
    body: 'hi',
    created_at: new Date(2026, 9, day, hour, minute).toISOString(),
    deleted_at: null,
  }
}

const now = new Date(2026, 9, 26, 21, 0)

describe('the chat', () => {
  it('merges new and changed messages, oldest first, once each', () => {
    const a = msg('a', 'omar', 20, 0)
    const b = msg('b', 'ziad', 20, 5)
    expect(mergeMessages([b], [a]).map((m) => m.id)).toEqual(['a', 'b'])
    expect(mergeMessages([a, b], [{ ...a, body: null, deleted_at: 'now' }])[0].body).toBeNull()
    expect(mergeMessages([a, b], [a, b])).toHaveLength(2)
  })

  it('shows the dot when someone else wrote after the newest message you saw', () => {
    const fromZiad = msg('b', 'ziad', 20, 5)
    expect(hasUnread(undefined, null, 'u-omar')).toBe(false)
    expect(hasUnread(fromZiad, null, 'u-omar')).toBe(true)
    expect(hasUnread(fromZiad, msg('a', 'omar', 20, 0).created_at, 'u-omar')).toBe(true)
    expect(hasUnread(fromZiad, fromZiad.created_at, 'u-omar')).toBe(false)
    expect(hasUnread(msg('c', 'omar', 20, 9), null, 'u-omar')).toBe(false) // your own
  })

  it('a day line where the day changes; one name and one time per run of messages', () => {
    const rows = chatRows(
      [msg('y', 'ziad', 22, 0, 25), msg('1', 'omar', 20, 0), msg('2', 'omar', 20, 3), msg('3', 'ziad', 20, 4), msg('4', 'omar', 20, 20)],
      now,
    )
    expect(rows.map((r) => (r.kind === 'day' ? r.label : `${r.message.id}:${r.first ? 'F' : ''}${r.last ? 'L' : ''}`))).toEqual(
      ['Yesterday', 'y:FL', 'Today', '1:F', '2:L', '3:FL', '4:FL'],
    )
  })

  it('older days show the date', () => {
    expect(dayLabel(new Date(2026, 9, 22, 20, 0).toISOString(), now)).toBe('Thu 22 Oct')
  })
})
