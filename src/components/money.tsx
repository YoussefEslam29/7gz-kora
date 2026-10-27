// The money card: everyone pays the night's collector an equal share,
// rounded up to a whole pound. The share is worked out in the database
// (night_money); this card only shows it and lets the collector tick people off.
import { useState } from 'react'
import { Link } from 'react-router'
import * as api from '../lib/api'
import { errorMessage } from '../lib/format'
import { isPaid, moneyTotals } from '../lib/money'
import { formatPhone } from '../lib/phone'
import type { Match, Payer } from '../lib/types'
import { useCurrentGroup } from '../state/group'
import { Button, Card, ErrorNote, Heading, Name } from './ui'

/** "Pay by InstaPay: 010 1234 5678" with Copy, when the collector added a number. Copy gives the bare 11 digits. */
export function InstaPayLine({ collectorId }: { collectorId: string | null }) {
  const { player } = useCurrentGroup()
  const [copied, setCopied] = useState(false)
  const phone = player(collectorId)?.instapay_phone
  if (!phone) return null
  return (
    <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-ground px-3 py-2">
      <p className="text-sm">
        Pay by InstaPay: <span className="tabular font-display text-lg whitespace-nowrap">{formatPhone(phone)}</span>
      </p>
      <Button
        size="sm"
        variant="secondary"
        onClick={() =>
          void navigator.clipboard
            .writeText(phone)
            .then(() => setCopied(true))
            .catch(() => undefined)
        }
      >
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  )
}

export function MoneyCard({ match, payers, onChange }: { match: Match; payers: Payer[]; onChange: () => void }) {
  const { myPlayerId, isAdmin, playerName, player } = useCurrentGroup()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  if (payers.length === 0) return null

  const amount = Number(match.status === 'cancelled' ? match.cancel_fee : match.cost)
  const t = moneyTotals(payers, amount)
  const cur = match.currency
  const mine = payers.find((p) => p.player_id === myPlayerId)
  const iCollect = match.collector_player_id === myPlayerId
  const canTick = isAdmin || iCollect
  const collector = match.collector_player_id ? playerName(match.collector_player_id) : null
  const sorted = [...payers].sort(
    (a, b) => Number(isPaid(a)) - Number(isPaid(b)) || playerName(a.player_id).localeCompare(playerName(b.player_id)),
  )

  async function tick(p: Payer) {
    setBusy(p.player_id)
    setError(null)
    try {
      await (p.paid_at ? api.unmarkPaid(match.id, p.player_id) : api.markPaid(match.id, p.player_id))
      onChange()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card strong>
      {iCollect ? (
        <>
          <Heading>Collected</Heading>
          <p className="money">
            {t.collected} of {t.total} {cur}
          </p>
          {t.extra > 0 && (
            <p className="text-sm">
              You get {t.extra} {cur} more than the pitch costs.
            </p>
          )}
          {!player(myPlayerId)?.instapay_phone && (
            <p className="mt-2 text-sm font-semibold">
              Add your InstaPay number so people can pay you.{' '}
              <Link to="/me/edit" className="text-brand-ink underline">
                Add it
              </Link>
            </p>
          )}
        </>
      ) : mine && !isPaid(mine) ? (
        <>
          <Heading>You owe</Heading>
          <p className="money">
            {t.share} {cur}
          </p>
          <p className="text-sm">
            to <Name className="font-bold">{collector ?? 'the collector'}</Name> · {amount} ÷ {t.players} players
          </p>
          <InstaPayLine collectorId={match.collector_player_id} />
        </>
      ) : mine ? (
        <>
          <Heading>You paid</Heading>
          <p className="money">
            {t.share} {cur}
          </p>
          {collector && (
            <p className="text-sm">
              to <Name className="font-bold">{collector}</Name>
            </p>
          )}
        </>
      ) : (
        <>
          <Heading>
            Money{collector && <> · collector <Name>{collector}</Name></>}
          </Heading>
          <p className="money">
            {t.collected} / {t.total} {cur}
          </p>
        </>
      )}

      <p className="mt-2 text-sm text-muted">
        {t.players} players pay {t.share} {cur} each ({amount} ÷ {t.players}, rounded up).
        {t.extra > 0 && ` The collector gets ${t.extra} ${cur} extra.`}
      </p>
      {!collector && (
        <p className="mt-2 text-sm font-semibold">
          No collector picked yet.{' '}
          {isAdmin && (
            <Link to={`/nights/${match.id}/edit`} className="text-brand-ink underline">
              Pick one
            </Link>
          )}
        </p>
      )}
      <ErrorNote message={error} />

      <ul className="mt-3 divide-y divide-line">
        {sorted.map((p) => (
          <li key={p.player_id} className="flex min-h-12 items-center gap-2 py-1">
            <Name className="min-w-0 flex-1 truncate font-semibold">{playerName(p.player_id)}</Name>
            {p.is_collector ? (
              <span className="text-xs font-semibold text-muted">Collector</span>
            ) : isPaid(p) ? (
              <span className="chip status closed">Paid</span>
            ) : (
              <span className="chip status voting">Unpaid</span>
            )}
            {canTick && !p.is_collector && p.player_id !== myPlayerId && (
              <Button
                size="sm"
                variant={p.paid_at ? 'ghost' : 'secondary'}
                busy={busy === p.player_id}
                onClick={() => void tick(p)}
              >
                {p.paid_at ? 'Undo' : 'Paid'}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </Card>
  )
}
