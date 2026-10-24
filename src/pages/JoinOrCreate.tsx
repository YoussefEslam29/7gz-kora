import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Button, Card, ErrorNote, PageTitle } from '../components/ui'
import * as api from '../lib/api'
import { errorMessage } from '../lib/format'
import { KEYS, readLocal, writeLocal } from '../lib/storage'
import { googleName } from '../lib/user'
import { useAuth } from '../state/auth'
import { useGroup } from '../state/group'

const input = 'mt-1 h-12 w-full rounded-xl border-[1.5px] border-line bg-paper px-3 text-base'

/** Join a group with an invite code, or start a new one. */
export default function JoinOrCreate({ standalone = false }: { standalone?: boolean }) {
  const { user, signOut } = useAuth()
  const { switchGroup, refresh, memberships } = useGroup()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [name, setName] = useState(() => googleName(user))
  // From an invite link (/join?code=...), or one remembered across sign-in.
  const [code, setCode] = useState(() => searchParams.get('code') ?? readLocal(KEYS.pendingInvite) ?? '')
  const [groupName, setGroupName] = useState('')
  const [busy, setBusy] = useState<'join' | 'create' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function done(groupId: string) {
    writeLocal(KEYS.pendingInvite, null)
    switchGroup(groupId)
    await refresh()
    navigate('/')
  }

  async function join(e: FormEvent) {
    e.preventDefault()
    setBusy('join')
    setError(null)
    try {
      await done(await api.joinGroup(code, name))
    } catch (err) {
      setError(errorMessage(err))
      setBusy(null)
    }
  }

  async function create(e: FormEvent) {
    e.preventDefault()
    setBusy('create')
    setError(null)
    try {
      await done(await api.createGroup(groupName, name))
    } catch (err) {
      setError(errorMessage(err))
      setBusy(null)
    }
  }

  return (
    <div className={standalone ? 'mx-auto max-w-xl px-4 pt-[calc(env(safe-area-inset-top)+2rem)] pb-10' : ''}>
      <PageTitle sub={memberships.length === 0 ? 'Join your friends, or start a group for them.' : undefined}>
        {memberships.length === 0 ? 'Welcome' : 'Join or create a group'}
      </PageTitle>

      <label className="mb-5 block">
        <span className="text-sm font-medium">Your name in the group</span>
        <input className={input} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
        <span className="mt-1 block text-xs text-muted">This is what your friends will see. Arabic is fine.</span>
      </label>

      <ErrorNote message={error} />

      <Card className="mb-4">
        <form onSubmit={join}>
          <h2 className="font-display text-xl">Join with an invite code</h2>
          <label className="mt-2 block">
            <span className="text-sm text-muted">Ask your group admin for the code, e.g. KICK-7Q3F</span>
            <input
              className={`${input} font-display text-2xl tracking-widest uppercase`}
              value={code}
              required
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
          <Button type="submit" className="mt-3 w-full" busy={busy === 'join'} disabled={!name.trim()}>
            Join group
          </Button>
        </form>
      </Card>

      <Card>
        <form onSubmit={create}>
          <h2 className="font-display text-xl">Start a new group</h2>
          <p className="text-sm text-muted">You'll be its admin and get a code to share.</p>
          <label className="mt-2 block">
            <span className="text-sm text-muted">Group name</span>
            <input
              className={input}
              value={groupName}
              required
              maxLength={60}
              placeholder="Thursday Football"
              onChange={(e) => setGroupName(e.target.value)}
            />
          </label>
          <Button type="submit" variant="secondary" className="mt-3 w-full" busy={busy === 'create'} disabled={!name.trim()}>
            Create group
          </Button>
        </form>
      </Card>

      {standalone && (
        <button type="button" onClick={() => void signOut()} className="mt-8 w-full text-sm text-muted underline">
          Sign out ({user?.email})
        </button>
      )}
    </div>
  )
}
