import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useEnterGroup } from '../components/groups'
import { Cascade } from '../components/motion'
import { Button, Card, ErrorNote, Name, PageTitle } from '../components/ui'
import * as api from '../lib/api'
import { errorMessage } from '../lib/format'
import { KEYS, readLocal, writeLocal } from '../lib/storage'
import { useMyAccount } from '../state/account'

const input = 'mt-1 h-12 w-full rounded-xl border-[1.5px] border-line bg-paper px-3 text-base'

/** Join or create a group (/join). */
export default function JoinOrCreate() {
  return (
    <Cascade className="space-y-4">
      <PageTitle sub="Join your friends with their invite code, or start a group for them.">Join or create a group</PageTitle>
      <GroupForms />
      <p className="text-center text-sm">
        <Link to="/find" className="font-semibold text-brand-ink underline">
          Or find a public group
        </Link>
      </p>
    </Cascade>
  )
}

/**
 * "Join with an invite code" and "Start a new group", with your account name.
 * "Use a different name in this group" opens the name box.
 */
export function GroupForms() {
  const account = useMyAccount()
  const enter = useEnterGroup()
  const [searchParams] = useSearchParams()
  const [name, setName] = useState(account.display_name)
  const [changingName, setChangingName] = useState(false)
  // From an invite link (/join?code=...), or one remembered across sign-in.
  const [code, setCode] = useState(() => searchParams.get('code') ?? readLocal(KEYS.pendingInvite) ?? '')
  const [groupName, setGroupName] = useState('')
  const [busy, setBusy] = useState<'join' | 'create' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run(kind: 'join' | 'create', action: () => Promise<string>, e: FormEvent) {
    e.preventDefault()
    setBusy(kind)
    setError(null)
    try {
      const groupId = await action()
      writeLocal(KEYS.pendingInvite, null)
      await enter(groupId, kind === 'create' ? groupName.trim() : undefined)
    } catch (err) {
      setError(errorMessage(err))
      setBusy(null)
    }
  }

  return (
    <>
      {changingName ? (
        <label className="block">
          <span className="text-sm font-medium">Your name in the group</span>
          <input className={input} value={name} maxLength={40} dir="auto" onChange={(e) => setName(e.target.value)} />
          <span className="mt-1 block text-xs text-muted">This is what your friends will see. Arabic is fine.</span>
        </label>
      ) : (
        <p className="text-sm">
          You'll join as <Name className="font-bold">{name}</Name>.{' '}
          <button type="button" className="font-semibold text-brand-ink underline" onClick={() => setChangingName(true)}>
            Use a different name in this group
          </button>
        </p>
      )}

      <ErrorNote message={error} />

      <Card>
        <form onSubmit={(e) => void run('join', () => api.joinGroup(code, name), e)}>
          <h2 className="font-display text-xl">Got an invite code?</h2>
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
        <form onSubmit={(e) => void run('create', () => api.createGroup(groupName, name), e)}>
          <h2 className="font-display text-xl">Start a new group</h2>
          <p className="text-sm text-muted">You'll be its admin and get a code to share.</p>
          <label className="mt-2 block">
            <span className="text-sm text-muted">Group name</span>
            <input
              className={input}
              value={groupName}
              required
              maxLength={60}
              dir="auto"
              placeholder="Thursday Football"
              onChange={(e) => setGroupName(e.target.value)}
            />
          </label>
          <Button type="submit" variant="secondary" className="mt-3 w-full" busy={busy === 'create'} disabled={!name.trim()}>
            Create group
          </Button>
        </form>
      </Card>
    </>
  )
}
