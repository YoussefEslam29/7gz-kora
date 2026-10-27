// The group chat's state (Plans/Accounts-groups-and-chat.md section 6): one
// live connection per open app, shared by the Chat tab, its dot and Home.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as api from '../lib/api'
import { hasUnread, mergeMessages } from '../lib/chat'
import { errorMessage } from '../lib/format'
import { KEYS, readLocal, writeLocal } from '../lib/storage'
import type { ChatMessage } from '../lib/types'
import { useAuth } from './auth'
import { useGroup } from './group'

/** How often to check for new messages while the live connection is down. */
const POLL_MS = 10_000

interface ChatState {
  /** Oldest first. */
  messages: ChatMessage[]
  loading: boolean
  error: string | null
  /** The live connection is up (otherwise it checks every 10 seconds). */
  live: boolean
  /** There may be older messages to load. */
  hasOlder: boolean
  /** Someone else wrote since you last had the chat open. */
  unread: boolean
  send: (body: string) => Promise<void>
  remove: (id: string) => Promise<void>
  loadOlder: () => Promise<void>
  /** The chat is on screen: everything in it counts as seen. */
  markRead: () => void
}

const none = async () => {}
const NO_CHAT: ChatState = {
  messages: [],
  loading: false,
  error: null,
  live: false,
  hasOlder: false,
  unread: false,
  send: none,
  remove: none,
  loadOlder: none,
  markRead: () => {},
}

const ChatContext = createContext<ChatState>(NO_CHAT)

/** A fresh chat for each group (none without a group). */
export function ChatProvider({ children }: { children: ReactNode }) {
  const { group } = useGroup()
  if (!group) return <ChatContext.Provider value={NO_CHAT}>{children}</ChatContext.Provider>
  return (
    <ChatSession key={group.id} groupId={group.id}>
      {children}
    </ChatSession>
  )
}

function ChatSession({ groupId, children }: { groupId: string; children: ReactNode }) {
  const { user } = useAuth()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [live, setLive] = useState(false)
  const [hasOlder, setHasOlder] = useState(false)
  const readKey = `${KEYS.chatLastRead}.${groupId}`
  const [lastRead, setLastRead] = useState(() => readLocal(readKey))
  const liveRef = useRef(false)

  const loadLatest = useCallback(async () => {
    const page = await api.getMessages(groupId, null)
    setMessages((list) => mergeMessages(list, page))
    setError(null)
    return page
  }, [groupId])

  // All state changes below happen after network calls or events.
  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect
    loadLatest()
      .then((page) => setHasOlder(page.length === api.CHAT_PAGE))
      .catch((e: unknown) => setError(errorMessage(e)))
      .finally(() => setLoading(false))
    const stop = api.watchMessages(
      groupId,
      (id) =>
        void api
          .getMessage(id)
          .then((m) => m && setMessages((list) => mergeMessages(list, [m])))
          .catch(() => undefined),
      (up) => {
        liveRef.current = up
        setLive(up)
      },
    )
    const timer = window.setInterval(() => {
      if (!liveRef.current && document.visibilityState === 'visible') void loadLatest().catch(() => undefined)
    }, POLL_MS)
    return () => {
      stop()
      window.clearInterval(timer)
    }
  }, [groupId, loadLatest])

  const newest = messages.at(-1)

  const markRead = useCallback(() => {
    if (!newest || newest.created_at === lastRead) return
    writeLocal(readKey, newest.created_at)
    setLastRead(newest.created_at)
  }, [newest, lastRead, readKey])

  // Re-reading the latest page shows your message even when the live connection is down.
  const send = useCallback(
    async (body: string) => {
      await api.sendMessage(groupId, body)
      await loadLatest()
    },
    [groupId, loadLatest],
  )

  const remove = useCallback(async (id: string) => {
    await api.deleteMessage(id)
    const fresh = await api.getMessage(id)
    if (fresh) setMessages((list) => mergeMessages(list, [fresh]))
  }, [])

  const loadOlder = useCallback(async () => {
    const oldest = messages[0]
    if (!oldest) return
    const page = await api.getMessages(groupId, oldest.created_at)
    setMessages((list) => mergeMessages(list, page))
    setHasOlder(page.length === api.CHAT_PAGE)
  }, [groupId, messages])

  const unread = hasUnread(newest, lastRead, user?.id)
  const value = useMemo<ChatState>(
    () => ({ messages, loading, error, live, hasOlder, unread, send, remove, loadOlder, markRead }),
    [messages, loading, error, live, hasOlder, unread, send, remove, loadOlder, markRead],
  )
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

// eslint-disable-next-line react/only-export-components
export const useChat = () => useContext(ChatContext)
