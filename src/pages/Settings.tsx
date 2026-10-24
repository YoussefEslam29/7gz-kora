import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { ChevronIcon } from '../components/icons'
import { Avatar, Button, Card, ErrorNote, Heading, LinkButton, Name, PageTitle } from '../components/ui'
import * as api from '../lib/api'
import { errorMessage } from '../lib/format'
import type { Member } from '../lib/types'
import { useAuth } from '../state/auth'
import { useCurrentGroup } from '../state/group'

export default function Settings() {
  const { user, signOut } = useAuth()
  const { group, isAdmin, members, player, memberships, switchGroup, config, refresh } = useCurrentGroup()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  async function act(name: string, action: () => Promise<unknown>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return
    setBusy(name)
    setError(null)
    try {
      await action()
      await refresh()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const sortedMembers = [...members].sort(
    (a, b) =>
      Number(b.role === 'admin') - Number(a.role === 'admin') ||
      (player(a.player_id)?.display_name ?? '').localeCompare(player(b.player_id)?.display_name ?? ''),
  )

  return (
    <div className="space-y-4">
      <PageTitle>More</PageTitle>
      <ErrorNote message={error} />

      <InviteCard />

      {isAdmin && <RenameGroup />}

      <Card>
        <Heading className="mb-2">Members ({members.length})</Heading>
        <ul className="divide-y divide-line">
          {sortedMembers.map((m) => (
            <MemberRow key={m.user_id} member={m} busy={busy} act={act} />
          ))}
        </ul>
      </Card>

      <Card>
        <Heading className="mb-2">Rating settings</Heading>
        {config && (
          <dl className="grid grid-cols-2 gap-y-1 text-sm">
            <dt className="text-muted">Stats / peer votes</dt>
            <dd className="text-right font-semibold">
              {Math.round(config.w_analytics * 100)}% / {Math.round(config.w_votes * 100)}%
            </dd>
            <dt className="text-muted">Votes needed to count</dt>
            <dd className="text-right font-semibold">{config.min_votes}</dd>
            <dt className="text-muted">Nights to join the table</dt>
            <dd className="text-right font-semibold">{config.min_matches_for_leaderboard}</dd>
            <dt className="text-muted">Voting window</dt>
            <dd className="text-right font-semibold">{config.voting_hours} hours</dd>
          </dl>
        )}
        <Link to="/how-it-works" className="mt-3 flex items-center justify-between font-semibold text-brand-ink">
          How ratings are calculated <ChevronIcon size={18} />
        </Link>
      </Card>

      <Card>
        <Heading className="mb-2">Your groups</Heading>
        <ul className="divide-y divide-line">
          {memberships.map((m) => (
            <li key={m.group.id} className="flex min-h-12 items-center justify-between gap-2 py-1">
              <Name className="truncate font-medium">{m.group.name}</Name>
              {m.group.id === group.id ? (
                <span className="text-sm text-muted">Current</span>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => switchGroup(m.group.id)}>
                  Switch
                </Button>
              )}
            </li>
          ))}
        </ul>
        <LinkButton to="/join" variant="secondary" className="mt-3 w-full">
          Join or create another group
        </LinkButton>
      </Card>

      <div className="space-y-2 pt-2">
        <p className="text-center text-sm text-muted">Signed in as {user?.email}</p>
        <Button variant="secondary" className="w-full" onClick={() => void signOut().then(() => navigate('/'))}>
          Sign out
        </Button>
        <Button
          variant="danger"
          className="w-full"
          busy={busy === 'leave'}
          onClick={() =>
            act(
              'leave',
              async () => {
                await api.removeMember(group.id, user!.id)
                navigate('/')
              },
              `Leave ${group.name}? Your stats stay in the group. You can rejoin with the invite code.`,
            )
          }
        >
          Leave this group
        </Button>
      </div>
    </div>
  )
}

function InviteCard() {
  const { group, isAdmin, refresh } = useCurrentGroup()
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const code = group.invite_code
  const link = code ? `${window.location.origin}/join?code=${code}` : ''

  async function share() {
    const text = `Join ${group.name} on 7GZ-KORA. Invite code: ${code}`
    try {
      if (navigator.share) {
        await navigator.share({ title: '7GZ-KORA', text, url: link })
      } else {
        await navigator.clipboard.writeText(`${text}\n${link}`)
        setCopied(true)
      }
    } catch {
      // The person closed the share sheet: nothing to do.
    }
  }

  async function run(action: () => Promise<unknown>, confirmText: string) {
    if (!window.confirm(confirmText)) return
    setBusy(true)
    setError(null)
    try {
      await action()
      await refresh()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <Heading>Invite code</Heading>
      {code ? (
        <>
          <p className="tabular my-2 text-center font-display text-5xl tracking-widest select-all">{code}</p>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={share}>
              Share invite
            </Button>
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() =>
                navigator.clipboard
                  .writeText(code)
                  .then(() => setCopied(true))
                  .catch(() => setError('Could not copy. Press and hold the code to copy it.'))
              }
            >
              {copied ? 'Copied' : 'Copy code'}
            </Button>
          </div>
        </>
      ) : (
        <p className="my-2 text-muted">Invites are turned off. Nobody new can join.</p>
      )}
      <ErrorNote message={error} />
      {isAdmin && (
        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            className="flex-1"
            busy={busy}
            onClick={() =>
              run(
                () => api.regenerateInviteCode(group.id),
                code ? 'Make a new code? The old one stops working.' : 'Turn invites on with a new code?',
              )
            }
          >
            {code ? 'New code' : 'Turn on invites'}
          </Button>
          {code && (
            <Button
              size="sm"
              variant="danger"
              className="flex-1"
              disabled={busy}
              onClick={() => run(() => api.disableInviteCode(group.id), 'Turn off invites? The code stops working.')}
            >
              Turn off invites
            </Button>
          )}
        </div>
      )}
    </Card>
  )
}

function RenameGroup() {
  const { group, refresh } = useCurrentGroup()
  const [name, setName] = useState(group.name)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.renameGroup(group.id, name)
      await refresh()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <form onSubmit={save}>
        <Heading className="mb-2">Group name</Heading>
        <div className="flex gap-2">
          <input
            value={name}
            required
            maxLength={60}
            dir="auto"
            onChange={(e) => setName(e.target.value)}
            className="h-12 min-w-0 flex-1 rounded-xl border-[1.5px] border-line bg-paper px-3 text-base"
          />
          <Button type="submit" variant="secondary" busy={busy} disabled={name.trim() === group.name || !name.trim()}>
            Save
          </Button>
        </div>
        <ErrorNote message={error} />
      </form>
    </Card>
  )
}

function MemberRow({
  member,
  busy,
  act,
}: {
  member: Member
  busy: string | null
  act: (name: string, action: () => Promise<unknown>, confirmText?: string) => Promise<void>
}) {
  const { group, isAdmin, player } = useCurrentGroup()
  const { user } = useAuth()
  const p = player(member.player_id)
  const name = p?.display_name ?? 'Unknown'
  const isMe = member.user_id === user?.id

  return (
    <li className="py-2">
      <div className="flex items-center gap-3">
        <Avatar name={name} url={p?.avatar_url} size={36} />
        <Link to={`/players/${member.player_id}`} className="min-w-0 flex-1">
          <Name className="block truncate font-medium">{name}</Name>
          <span className="text-xs text-muted">
            {member.role === 'admin' ? 'Admin' : 'Member'}
            {isMe && ' · you'}
          </span>
        </Link>
      </div>
      {isAdmin && !isMe && (
        <div className="mt-2 flex gap-2 pl-12">
          <Button
            size="sm"
            variant="secondary"
            busy={busy === `role-${member.user_id}`}
            onClick={() =>
              act(`role-${member.user_id}`, () =>
                api.setMemberRole(group.id, member.user_id, member.role === 'admin' ? 'member' : 'admin'),
              )
            }
          >
            {member.role === 'admin' ? 'Remove admin' : 'Make admin'}
          </Button>
          <Button
            size="sm"
            variant="danger"
            busy={busy === `remove-${member.user_id}`}
            onClick={() =>
              act(
                `remove-${member.user_id}`,
                () => api.removeMember(group.id, member.user_id),
                `Remove ${name} from the group? Their stats stay.`,
              )
            }
          >
            Remove
          </Button>
        </div>
      )}
    </li>
  )
}
