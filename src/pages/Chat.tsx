import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useConfirm } from '../components/feedback'
import { Avatar, Button, Empty, ErrorNote, Loading, Name, PageTitle } from '../components/ui'
import { chatRows, type ChatRow } from '../lib/chat'
import { clockOf, errorMessage } from '../lib/format'
import { useNow } from '../lib/useNow'
import { useChat } from '../state/chat'
import { useCurrentGroup } from '../state/group'

/**
 * The group chat (/chat, Plans/Accounts-groups-and-chat.md section 6): text
 * only, newest at the bottom. Tap your message (any message, for admins) to
 * delete it.
 */
export default function Chat() {
  const { messages, loading, error, live, hasOlder, send, remove, loadOlder, markRead } = useChat()
  const { group, myPlayerId, isAdmin, player, playerName } = useCurrentGroup()
  const confirm = useConfirm()
  const now = useNow(60_000)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState<'send' | 'older' | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [picked, setPicked] = useState<string | null>(null)
  const end = useRef<HTMLDivElement>(null)
  const newestId = messages.at(-1)?.id

  // A new message at the bottom: it counts as seen, and the screen scrolls to it.
  useEffect(() => {
    markRead()
    end.current?.scrollIntoView({ block: 'end' })
  }, [newestId, markRead])

  async function submit(e: FormEvent) {
    e.preventDefault()
    const body = text.trim()
    if (!body) return
    setBusy('send')
    setActionError(null)
    try {
      await send(body)
      setText('')
    } catch (err) {
      setActionError(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  async function older() {
    setBusy('older')
    try {
      await loadOlder()
    } catch (err) {
      setActionError(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  async function deleteMessage(id: string) {
    const yes = await confirm({
      title: 'Delete this message?',
      message: 'Everyone sees "Message deleted" instead.',
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!yes) return
    try {
      await remove(id)
      setPicked(null)
    } catch (err) {
      setActionError(errorMessage(err))
    }
  }

  if (loading && messages.length === 0) return <Loading />

  return (
    <div>
      <PageTitle sub={<Name>{group.name}</Name>}>Chat</PageTitle>
      <ErrorNote message={error} />
      {!live && <p className="mb-2 text-xs text-muted">Checking for new messages every 10 seconds.</p>}
      {hasOlder && (
        <Button variant="ghost" size="sm" className="mb-2 w-full" busy={busy === 'older'} onClick={() => void older()}>
          Show older
        </Button>
      )}

      {messages.length === 0 ? (
        <Empty title="No messages yet">Say hi to the group.</Empty>
      ) : (
        <ol aria-label="Messages" className="space-y-1 pb-4">
          {chatRows(messages, now).map((row) =>
            row.kind === 'day' ? (
              <li key={row.key} className="py-2 text-center">
                <span className="label">{row.label}</span>
              </li>
            ) : (
              <MessageRow
                key={row.key}
                row={row}
                mine={row.message.player_id === myPlayerId}
                canDelete={row.message.player_id === myPlayerId || isAdmin}
                name={playerName(row.message.player_id)}
                avatar={player(row.message.player_id)?.avatar_url ?? null}
                picked={picked === row.message.id}
                onPick={() => setPicked(picked === row.message.id ? null : row.message.id)}
                onDelete={() => void deleteMessage(row.message.id)}
              />
            ),
          )}
        </ol>
      )}
      <div ref={end} />

      <form
        onSubmit={submit}
        className="sticky bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-10 -mx-4 mt-2 border-t-[1.5px] border-line bg-ground px-4 py-2"
      >
        <ErrorNote message={actionError} />
        <div className="flex items-end gap-2">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Message</span>
            <textarea
              rows={1}
              maxLength={500}
              dir="auto"
              placeholder="Message the group"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="block max-h-32 min-h-12 w-full resize-none rounded-xl border-[1.5px] border-line bg-paper px-3 py-3 text-base"
            />
          </label>
          <Button type="submit" busy={busy === 'send'} disabled={!text.trim()}>
            Send
          </Button>
        </div>
        {text.length > 400 && <p className="tabular mt-1 text-right text-xs text-muted">{text.length}/500</p>}
      </form>
    </div>
  )
}

function MessageRow({
  row,
  mine,
  canDelete,
  name,
  avatar,
  picked,
  onPick,
  onDelete,
}: {
  row: Extract<ChatRow, { kind: 'message' }>
  mine: boolean
  canDelete: boolean
  name: string
  avatar: string | null
  picked: boolean
  onPick: () => void
  onDelete: () => void
}) {
  const { message, first, last } = row
  const deleted = message.body === null
  // Your messages are green with black text (text on the brand green is always black).
  const bubble = `rounded-2xl border-[1.5px] px-3 py-2 text-left ${
    mine ? 'border-[#0b0b0b] bg-brand text-on-brand' : 'border-line bg-paper text-ink'
  } ${deleted ? 'italic opacity-70' : ''}`
  const content = deleted ? (
    'Message deleted'
  ) : (
    <span dir="auto" className="block break-words whitespace-pre-wrap">
      {message.body}
    </span>
  )
  return (
    <li className={`flex gap-2 ${mine ? 'justify-end' : ''} ${first ? 'pt-2' : ''}`}>
      {!mine && <span className="w-8 shrink-0">{first && <Avatar name={name} url={avatar} size={32} />}</span>}
      <div className={`flex max-w-[78%] flex-col ${mine ? 'items-end' : 'items-start'}`}>
        {first && !mine && <Name className="mb-0.5 text-xs font-bold text-muted">{name}</Name>}
        {canDelete && !deleted ? (
          <button type="button" aria-expanded={picked} onClick={onPick} className={bubble}>
            {content}
          </button>
        ) : (
          <div className={bubble}>{content}</div>
        )}
        {last && <span className="mt-0.5 text-[11px] text-muted">{clockOf(message.created_at)}</span>}
        {picked && (
          <Button size="sm" variant="danger" className="mt-1" onClick={onDelete}>
            Delete
          </Button>
        )}
      </div>
    </li>
  )
}
