import { Link } from 'react-router'
import { Card, Heading, PageTitle } from '../components/ui'
import { formatPoints } from '../lib/format'
import type { RatingConfig } from '../lib/types'
import { useGroup } from '../state/group'

/** How nights, money and ratings work. Only inside the signed-in app. */
export default function HowItWorks() {
  const { config } = useGroup()
  return (
    <div className="space-y-4">
      <PageTitle sub="Nights, money and ratings, in plain words.">How it works</PageTitle>
      <NightsExplainer />
      {config && <RatingExplainer config={config} />}
    </div>
  )
}

function NightsExplainer() {
  return (
    <>
      <Card>
        <Heading className="mb-2">A night</Heading>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>An admin plans each night: the date, the pitch, the cost, players per side and who collects the money.</li>
          <li>
            Tap <strong>I'm in</strong> or <strong>Out</strong> before the night. When the night is full, "I'm in" puts
            you on the waiting list, first come first served. If someone drops out, the first person waiting moves up
            automatically.
          </li>
          <li>
            At the pitch an admin checks everyone in. <strong>Who is checked in is what counts</strong>: they play, vote
            and pay.
          </li>
          <li>
            When the admin taps <strong>End night</strong>, voting opens and the money card appears.
          </li>
        </ul>
      </Card>

      <Card>
        <Heading className="mb-2">Money</Heading>
        <p className="text-sm">
          The pitch cost is split equally among everyone checked in, rounded up to a whole pound. For example, 600 EGP ÷
          13 players = 46.15, so everyone pays <strong>47 EGP</strong> and the collector ends up with 11 EGP extra.
        </p>
        <p className="mt-2 text-sm">
          Pay your share to the night's collector. They (or an admin) tick you off, and they pay the pitch. Saying "I'm
          in" and not coming costs nothing.
        </p>
      </Card>

      <Card>
        <Heading className="mb-2">Cancelled nights</Heading>
        <p className="text-sm">
          A cancelled night counts for nothing: no votes and no ratings. If the pitch still charges something, that
          amount is split the same way.
        </p>
      </Card>
    </>
  )
}

function RatingExplainer({ config }: { config: RatingConfig }) {
  const p = config.points
  const pct = (n: number) => `${Math.round(n * 100)}%`
  const pts = (n: number | undefined) => (n == null ? 'default' : formatPoints(n))

  const rows: [string, string][] = [
    ['Start (for playing)', (p.base ?? 5).toFixed(1)],
    ['Each goal', `${pts(p.goal)} (max ${pts(p.goal_cap)})`],
    ['Each assist', `${pts(p.assist)} (max ${pts(p.assist_cap)})`],
    [
      'Team impact: per goal of difference while you were on the pitch',
      `${pts(p.net_goal)} (between ${pts(p.net_goal_min)} and ${pts(p.net_goal_max)})`,
    ],
    ['Result', `win ${pts(p.win)} · draw ${pts(p.draw)} · loss ${pts(p.loss)}`],
    [
      `Goalkeeper clean sheet (in goal for at least ${pct(p.clean_sheet_min_share ?? 0.25)} of the night)`,
      `${pts(p.clean_sheet)} (max ${pts(p.clean_sheet_cap)})`,
    ],
  ]

  return (
    <>
      <Card>
        <Heading>Your rating for a night</Heading>
        <p className="mt-2 rounded-xl bg-ground p-3 text-center font-display text-xl">
          {pct(config.w_analytics)} stats score + {pct(config.w_votes)} peer votes
        </p>
        <p className="mt-2 text-sm text-muted">
          Shown from 0 to 10 with one decimal. With fewer than {config.min_votes} votes, the rating is the stats score
          alone ("stats only"), so you always get a rating.
        </p>
      </Card>

      <Card>
        <Heading className="mb-2">Stats score</Heading>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-line">
            {rows.map(([label, value]) => (
              <tr key={label}>
                <td className="py-2 pr-3">{label}</td>
                <td className="tabular py-2 text-right font-semibold whitespace-nowrap">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-sm text-muted">
          The total stays between {(p.analytics_min ?? 1).toFixed(1)} and {(p.analytics_max ?? 10).toFixed(1)}. Disputed
          goals don't count until an admin sorts them out.
        </p>
      </Card>

      <Card>
        <Heading className="mb-2">Peer votes</Heading>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>Everyone checked in rates everyone else who was checked in, 1 to 10. No voting for yourself.</li>
          <li>"Didn't see enough" is fine: it isn't counted in the average.</li>
          <li>
            Votes stay secret until voting closes ({config.voting_hours} hours after the night ends). Then everyone sees
            who voted what.
          </li>
          <li>Man of the Match is a separate honour. It doesn't change anyone's rating.</li>
        </ul>
      </Card>

      <Card>
        <Heading className="mb-2">Season and table</Heading>
        <p className="text-sm">
          Your season rating is the average of your night ratings in the calendar year. A new season starts on 1 January.
          You join the table after {config.min_matches_for_leaderboard} rated nights.
        </p>
        <p className="mt-2 text-sm">
          <Link to="/nights" className="font-semibold text-brand-ink underline">
            Open any finished night
          </Link>{' '}
          and tap a player to see the exact breakdown of their rating.
        </p>
      </Card>
    </>
  )
}
