import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { PlayerCard } from '../components/card'
import { FootField, MottoField, PositionField, ShirtField, SkillsField } from '../components/cardform'
import { useToast } from '../components/feedback'
import { BackIcon, GloveIcon } from '../components/icons'
import { Button, Card, ErrorNote, Heading, PageTitle, Toggle } from '../components/ui'
import * as api from '../lib/api'
import { accountCard, accountInput, cleanCard, NO_SKILLS, skillsState } from '../lib/card'
import { errorMessage } from '../lib/format'
import { checkPhone, formatPhone } from '../lib/phone'
import type { AccountInput } from '../lib/types'
import { useAccount, useMyAccount } from '../state/account'
import { useGroup } from '../state/group'

const input = 'mt-1 h-12 w-full rounded-xl border-[1.5px] border-line bg-paper px-3 text-base'

/**
 * Edit my card (/me/edit): the account's card, the same in every group
 * (Plans/Accounts-groups-and-chat.md section 1), plus Show my stats and the
 * InstaPay number. Only you change it.
 */
export default function EditAccount() {
  const account = useMyAccount()
  const { refresh: refreshAccount } = useAccount()
  const { refresh: refreshGroup } = useGroup()
  const navigate = useNavigate()
  const toast = useToast()
  const [draft, setDraft] = useState<AccountInput>(() => accountInput(account))
  const [phoneText, setPhoneText] = useState(() => (account.instapay_phone ? formatPhone(account.instapay_phone) : ''))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const change = (changes: Partial<AccountInput>) => setDraft((d) => ({ ...d, ...changes }))
  const skills = skillsState(draft)
  const phone = checkPhone(phoneText)

  async function save() {
    if (!phone.ok) return
    setBusy(true)
    setError(null)
    try {
      await api.saveMyAccount(cleanCard({ ...draft, display_name: draft.display_name.trim(), instapay_phone: phone.phone }))
      // Every group's copy changed too.
      await Promise.all([refreshAccount(), refreshGroup()])
      toast('Card saved')
      navigate('/me')
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <Link to="/me" className="inline-flex items-center gap-1 text-sm font-semibold text-muted">
        <BackIcon size={18} /> My account
      </Link>
      <PageTitle sub="Your card is the same in every group you're in.">Edit my card</PageTitle>
      <PlayerCard player={accountCard({ ...account, ...draft })} isMe preview />

      <Card className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium">Your name</span>
          <input
            className={input}
            value={draft.display_name}
            maxLength={40}
            required
            dir="auto"
            onChange={(e) => change({ display_name: e.target.value })}
          />
          <span className="mt-1 block text-xs text-muted">
            Used when you join a group. Your name inside a group can be changed there.
          </span>
        </label>
        <ShirtField value={draft.shirt_number} onChange={change} />
        <FootField value={draft.strong_foot} onChange={change} />
        <PositionField value={draft.favourite_position} onChange={change} />
        <MottoField value={draft.motto} onChange={change} />
      </Card>

      <Card>
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <Heading>Rate yourself</Heading>
          {skills !== 'none' && (
            <button type="button" className="text-sm font-semibold text-brand-ink underline" onClick={() => change(NO_SKILLS)}>
              Clear
            </button>
          )}
        </div>
        <p className="mb-3 text-sm text-muted">
          1 to 10 on each. It never changes your night ratings. Until you've played a rated night it's your starting point
          in Suggest teams, and it shows next to what your friends give you.
        </p>
        <SkillsField skills={draft} onChange={change} />
      </Card>

      <Toggle
        checked={draft.show_stats}
        onChange={(on) => change({ show_stats: on })}
        label="Show my stats"
        hint="Off: only you see your skills and self-rating. Your name, number, position, foot and motto still show."
      />
      <Toggle
        checked={draft.happy_in_goal}
        onChange={(on) => change({ happy_in_goal: on })}
        label="Happy to play in goal"
        hint="Suggested first when a game needs a goalkeeper."
        icon={<GloveIcon size={22} className="shrink-0" />}
      />

      <Card>
        <label className="block">
          <span className="text-sm font-medium">InstaPay number</span>
          <input
            className={`${input} tabular`}
            inputMode="tel"
            autoComplete="tel"
            placeholder="010 1234 5678"
            value={phoneText}
            onChange={(e) => setPhoneText(e.target.value)}
          />
          <span className={`mt-1 block text-xs ${phone.ok ? 'text-muted' : 'font-semibold text-danger'}`}>
            {phone.ok
              ? 'For when you collect the pitch money: people who owe you see it with a Copy button. Members of your groups can see it.'
              : 'Use an Egyptian mobile number, like 010 1234 5678.'}
          </span>
        </label>
      </Card>

      <ErrorNote message={error} />
      <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-10">
        {skills === 'some' && (
          <p className="mb-2 rounded-xl border-[1.5px] border-line bg-paper p-2 text-center text-sm font-semibold">
            Rate all five skills, or clear them.
          </p>
        )}
        <Button
          size="lg"
          className="w-full"
          busy={busy}
          disabled={!draft.display_name.trim() || skills === 'some' || !phone.ok}
          onClick={() => void save()}
        >
          Save card
        </Button>
      </div>
    </div>
  )
}
