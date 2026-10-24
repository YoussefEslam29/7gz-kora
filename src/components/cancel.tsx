// Cancelling a night: nothing counts. Only a fee the pitch still charges is split.
import { useState } from 'react'
import * as api from '../lib/api'
import { CANCEL_REASONS, errorMessage } from '../lib/format'
import { cancelledNightText } from '../lib/share'
import type { CancelReason, Match } from '../lib/types'
import { Button, Card, ErrorNote, Heading, ShareButton } from './ui'

const input = 'mt-1 h-12 w-full rounded-xl border-[1.5px] border-line bg-paper px-3 text-base'

export function CancelNightForm({ match, onDone, onClose }: { match: Match; onDone: () => void; onClose: () => void }) {
  const [reason, setReason] = useState<CancelReason | null>(null)
  const [note, setNote] = useState('')
  const [fee, setFee] = useState('0')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function cancel() {
    if (!reason) return
    setBusy(true)
    setError(null)
    try {
      await api.cancelNight(match.id, reason, note, Number(fee) || 0)
      onDone()
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
    }
  }

  return (
    <Card strong>
      <Heading className="mb-2">Cancel this night</Heading>
      <p className="text-sm">
        Nothing counts for a cancelled night: no votes and no ratings. If games were played and you just stopped early,
        use End night instead.
      </p>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Reason">
        {(Object.keys(CANCEL_REASONS) as CancelReason[]).map((r) => (
          <Button key={r} size="sm" variant={reason === r ? 'primary' : 'secondary'} aria-pressed={reason === r} onClick={() => setReason(r)}>
            {CANCEL_REASONS[r]}
          </Button>
        ))}
      </div>
      <label className="mt-3 block">
        <span className="text-sm font-medium">Note{reason === 'other' ? '' : ' (optional)'}</span>
        <input className={input} value={note} maxLength={200} dir="auto" onChange={(e) => setNote(e.target.value)} />
      </label>
      <label className="mt-3 block">
        <span className="text-sm font-medium">Still charged by the pitch ({match.currency})</span>
        <input className={input} type="number" inputMode="numeric" min={0} value={fee} onChange={(e) => setFee(e.target.value)} />
        <span className="mt-1 block text-xs text-muted">Usually 0. A lost deposit or fee is split equally, like the rent.</span>
      </label>
      <ErrorNote message={error} />
      <div className="mt-3 flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={onClose}>
          Keep night
        </Button>
        <Button variant="danger" className="flex-1" busy={busy} disabled={!reason} onClick={() => void cancel()}>
          Cancel night
        </Button>
      </div>
    </Card>
  )
}

/** Shown on a cancelled night, with the message to share. */
export function CancelledNotice({ match }: { match: Match }) {
  const [now] = useState(() => new Date())
  return (
    <Card>
      <Heading>Cancelled{match.cancel_reason && ` · ${CANCEL_REASONS[match.cancel_reason]}`}</Heading>
      {match.cancel_note && (
        <p dir="auto" className="mt-1 font-semibold">
          {match.cancel_note}
        </p>
      )}
      <p className="mt-1 text-sm text-muted">Nothing counts for this night: no votes and no ratings.</p>
      <ShareButton className="mt-3" text={cancelledNightText(match, now)} />
    </Card>
  )
}
