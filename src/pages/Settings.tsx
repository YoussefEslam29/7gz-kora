import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useConfirm, type Question } from '../components/feedback'
import { RatingSettingsCard } from '../components/ratingsettings'
import { ChevronIcon } from '../components/icons'
import { Avatar, Button, Card, ErrorNote, Heading, LinkButton, Name, PageTitle } from '../components/ui'
import { Cascade } from '../components/motion'
import * as api from '../lib/api'
import { errorMessage } from '../lib/format'
import type { Member } from '../lib/types'
import { useAuth } from '../state/auth'
import { useCurrentGroup } from '../state/group'

/** "Extra team from N players": the choices offered (the database allows 2 to 11). */
const EXTRA_TEAM_SIZES = [2, 3, 4, 5, 6, 7]

export default function Settings() {
  const { user, signOut } = useAuth()
  const { group, isAdmin, members, player, memberships, switchGroup, refresh } = useCurrentGroup()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const confirm = useConfirm()

  async function act(name: string, action: () => Promise<unknown>, question?: Question) {
    if (question && !(await confirm(question))) return
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
    <Cascade className="space-y-4">
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

      <RatingSettingsCard />
      {isAdmin && (
        <Link
          to="/settings/history"
          className="flex min-h-14 items-center justify-between rounded-card border-[1.5px] border-line bg-paper px-4 font-semibold"
        >
          Change history <ChevronIcon size={18} />
        </Link>
      )}
      <TeamSuggesterCard />

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
              {
                title: 'Leave this group?',
                message: (
                  <>
                    Your stats stay in <Name>{group.name}</Name>. You can rejoin with the invite code.
                  </>
                ),
                confirmLabel: 'Leave group',
                danger: true,
              },
            )
          }
        >
          Leave this group
        </Button>
      </div>
    </Cascade>
  )
}

function InviteCard() {
  const { group, isAdmin, refresh } = useCurrentGroup()
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const confirm = useConfirm()
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

  async function run(action: () => Promise<unknown>, question: Question) {
    if (!(await confirm(question))) return
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
                code
                  ? { title: 'Make a new code?', message: 'The old one stops working.', confirmLabel: 'New code' }
                  : { title: 'Turn invites on?', message: 'You get a new code to share.', confirmLabel: 'Turn on' },
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
              onClick={() =>
                run(() => api.disableInviteCode(group.id), {
                  title: 'Turn off invites?',
                  message: 'The code stops working. Nobody new can join.',
                  confirmLabel: 'Turn off',
                  danger: true,
                })
              }
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
  act: (name: string, action: () => Promise<unknown>, question?: Question) => Promise<void>
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
                {
                  title: 'Remove this member?',
                  message: (
                    <>
                      <Name>{name}</Name> leaves the group. Their stats stay.
                    </>
                  ),
                  confirmLabel: 'Remove',
                  danger: true,
                },
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

/** "Extra team from N players" for the team suggester: everyone sees it, admins change it. */
function TeamSuggesterCard() {
  const { group, isAdmin, refresh } = useCurrentGroup()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const size = group.min_extra_team_size
  const sizes = [...new Set([...EXTRA_TEAM_SIZES, size])].sort((a, b) => a - b)

  async function choose(n: number) {
    setBusy(true)
    setError(null)
    try {
      await api.setMinExtraTeamSize(group.id, n)
      await refresh()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <Heading className="mb-2">Team suggester</Heading>
      <p className="text-sm">
        Extra team from <strong>{size} players</strong>: when at least {size} are left over after two full teams, they
        make Team C. Fewer wait on the bench as subs.
      </p>
      {isAdmin && (
        <div className="seg mt-3" role="group" aria-label="Extra team from">
          {sizes.map((n) => (
            <button
              key={n}
              type="button"
              disabled={busy}
              aria-pressed={size === n}
              className={size === n ? 'sel' : ''}
              onClick={() => void choose(n)}
            >
              {n}
            </button>
          ))}
        </div>
      )}
      <ErrorNote message={error} />
    </Card>
  )
}
