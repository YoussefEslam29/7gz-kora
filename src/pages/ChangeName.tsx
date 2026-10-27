import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useToast } from '../components/feedback'
import { BackIcon } from '../components/icons'
import { Button, Card, ErrorNote, LinkButton, Name, PageTitle } from '../components/ui'
import * as api from '../lib/api'
import { errorMessage } from '../lib/format'
import { useCurrentGroup } from '../state/group'

const input = 'mt-1 h-12 w-full rounded-xl border-[1.5px] border-line bg-paper px-3 text-base'

/** A player's name in this group (/players/:id/edit): yourself, or anyone if you're an admin. */
export default function ChangeName() {
  const { id = '' } = useParams()
  const { group, player, myPlayerId, isAdmin, refresh } = useCurrentGroup()
  const navigate = useNavigate()
  const toast = useToast()
  const p = player(id)
  const [name, setName] = useState(p?.display_name ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isMe = id === myPlayerId

  if (!p) return <ErrorNote message="Player not found." />
  if (!isMe && !isAdmin) return <ErrorNote message="Only this player or an admin can change this name." />

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.renamePlayer(id, name)
      await refresh()
      toast('Name saved')
      navigate(`/players/${id}`)
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <Link to={`/players/${id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-muted">
        <BackIcon size={18} /> Profile
      </Link>
      <PageTitle sub={<>Only in <Name>{group.name}</Name>. Other groups keep theirs.</>}>
        {isMe ? 'Your name in this group' : 'Change name'}
      </PageTitle>
      <Card>
        <form onSubmit={save} className="space-y-3">
          <label className="block">
            <span className="text-sm font-medium">Name in the group</span>
            <input className={input} value={name} maxLength={40} required dir="auto" onChange={(e) => setName(e.target.value)} />
          </label>
          <ErrorNote message={error} />
          <Button type="submit" className="w-full" busy={busy} disabled={!name.trim() || name.trim() === p.display_name}>
            Save name
          </Button>
        </form>
      </Card>
      {isMe && (
        <LinkButton to="/me/edit" variant="secondary" className="w-full">
          Edit my card
        </LinkButton>
      )}
    </div>
  )
}
