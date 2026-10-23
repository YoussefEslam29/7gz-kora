import { Link } from 'react-router'
import InstallGuide from '../components/InstallGuide'
import { Card, Heading, PageTitle } from '../components/ui'
import { formatPoints } from '../lib/format'
import type { RatingConfig } from '../lib/types'
import { useGroup } from '../state/group'

/** "How is my rating calculated?" plus the install guide. */
export default function HowItWorks() {
  const { config } = useGroup()
  return (
    <div className="space-y-4">
      <PageTitle sub="Mostly real match data, with your friends' votes as the smaller part.">
        How ratings work
      </PageTitle>
      {config && <RatingExplainer config={config} />}
      <div id="install">
        <InstallGuide />
      </div>
    </div>
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
      `Goalkeeper clean sheet (in goal for at least ${pct(p.clean_sheet_min_share ?? 0.25)} of the match)`,
      `${pts(p.clean_sheet)} (max ${pts(p.clean_sheet_cap)})`,
    ],
  ]

  return (
    <>
      <Card>
        <Heading>Your match rating</Heading>
        <p className="mt-2 rounded-xl bg-ground p-3 text-center font-display text-xl font-bold">
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
          The total stays between {(p.analytics_min ?? 1).toFixed(1)} and {(p.analytics_max ?? 10).toFixed(1)}. If teams
          change during a match, team impact and result are counted for the time you were on each side. Disputed goals
          don't count until an admin sorts them out.
        </p>
      </Card>

      <Card>
        <Heading className="mb-2">Peer votes</Heading>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>Everyone who played rates everyone else who played, 1 to 10. No voting for yourself.</li>
          <li>"Didn't see enough" is fine: it isn't counted in the average.</li>
          <li>Votes stay secret until voting closes ({config.voting_hours} hours after the match is finished). Then everyone sees who voted what.</li>
          <li>Man of the Match is a separate honour. It doesn't change anyone's rating.</li>
        </ul>
      </Card>

      <Card>
        <Heading className="mb-2">Season and table</Heading>
        <p className="text-sm">
          Your season rating is the average of your match ratings in the calendar year. A new season starts on 1 January.
          You join the table after {config.min_matches_for_leaderboard} rated matches.
        </p>
        <p className="mt-2 text-sm">
          <Link to="/matches" className="font-semibold text-pitch underline">
            Open any finished match
          </Link>{' '}
          and tap a player to see the exact breakdown of their rating.
        </p>
      </Card>
    </>
  )
}
