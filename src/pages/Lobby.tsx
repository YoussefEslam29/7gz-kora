import * as m from 'motion/react-m'
import { Link } from 'react-router'
import { PlayerCard } from '../components/card'
import { PublicGroupList } from '../components/groups'
import { FinishCard } from '../components/hub'
import { Cascade } from '../components/motion'
import { Card, Heading, Name } from '../components/ui'
import { accountCard } from '../lib/card'
import { cascadeItem } from '../lib/motion'
import { useMyAccount } from '../state/account'
import { GroupForms } from './JoinOrCreate'

/** Home without a group (Plans/Accounts-groups-and-chat.md section 3): find your squad, or start one. */
export default function Lobby() {
  const account = useMyAccount()
  const firstName = account.display_name.trim().split(/\s+/)[0]
  return (
    <Cascade className="space-y-4">
      {/* A green surface, so its text is black. */}
      <m.section variants={cascadeItem} className="honeycomb rounded-card border-2 border-[#0b0b0b] p-5 text-on-brand">
        <h1 className="font-display text-[34px] leading-[1.05]">
          Welcome, <Name>{firstName}</Name>
        </h1>
        <p className="mt-1 font-semibold">Find your squad, or start one.</p>
      </m.section>

      <PlayerCard player={accountCard(account)} isMe preview />
      <FinishCard />

      <Card>
        <div className="mb-1 flex items-baseline justify-between">
          <Heading>Find your squad</Heading>
          <Link to="/find" className="text-sm font-semibold text-brand-ink">
            See all
          </Link>
        </div>
        <PublicGroupList limit={5} />
      </Card>

      <GroupForms />

      <p className="pt-2 text-center text-sm">
        <Link to="/how-it-works" className="font-semibold text-brand-ink underline">
          How do nights, money and ratings work?
        </Link>
      </p>
    </Cascade>
  )
}
