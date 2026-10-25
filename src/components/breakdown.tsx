// The breakdown of one night's rating, from what compute_match_ratings
// stored: on the night's results and on the player's profile.
import { formatMinutes, formatPoints } from '../lib/format'
import type { MatchRating } from '../lib/types'

export function BreakdownTable({ rating }: { rating: MatchRating }) {
  const b = rating.breakdown
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

  const rows: [string, number][] = [
    ['Base for playing', b.base],
    [`Goals (${rating.goals})`, b.goals],
    [`Assists (${rating.assists})`, b.assists],
    [`Team impact (goal difference on the pitch, added up: ${formatPoints(b.net_goal_diff)})`, b.net_goals],
    [b.minutes != null ? `Result (average over ${formatMinutes(b.minutes)} played)` : 'Result', b.result],
  ]
  if (b.clean_sheets) rows.push([`Clean sheets (${rating.clean_sheets})`, b.clean_sheets])
  if (b.saves) rows.push([`Saves (${rating.saves})`, b.saves])

  return (
    <>
      <table className="tabular w-full">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <td className="py-0.5 text-muted">{label}</td>
              <td className="py-0.5 text-right font-medium">{label.startsWith('Base') ? value.toFixed(1) : formatPoints(value)}</td>
            </tr>
          ))}
          <tr className="border-t border-line font-semibold">
            <td className="pt-1">Stats score</td>
            <td className="pt-1 text-right">{b.analytics}</td>
          </tr>
          <tr className="font-semibold">
            <td>Peer votes</td>
            <td className="text-right">
              {b.vote_average != null ? `${b.vote_average} avg of ${plural(b.vote_count, 'vote')}` : 'no votes'}
            </td>
          </tr>
        </tbody>
      </table>

      <p className="rounded-lg bg-paper p-2 font-medium">
        {b.stats_only ? (
          <>
            Fewer than {b.min_votes} votes, so the rating is the stats score alone: <strong>{rating.rating.toFixed(1)}</strong>
          </>
        ) : (
          <>
            {Math.round(b.w_analytics * 100)}% × {b.analytics} + {Math.round(b.w_votes * 100)}% × {b.vote_average} ={' '}
            <strong>{rating.rating.toFixed(1)}</strong>
          </>
        )}
      </p>
    </>
  )
}
