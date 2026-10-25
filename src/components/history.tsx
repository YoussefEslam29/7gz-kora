// A player's rating history (Plans/Player-card-and-motion.md section 3): the
// graph, recent form and the best night, for this season or all-time. The
// graph is plain SVG (no chart library). The nights list on the profile is
// the table view of the same numbers.
import { useReducedMotion } from 'motion/react'
import * as m from 'motion/react-m'
import { useState, type KeyboardEvent, type PointerEvent } from 'react'
import { Link } from 'react-router'
import { formatDay } from '../lib/format'
import { bestNight, chartScale, FORM_NIGHTS, recentForm, type Trend } from '../lib/trend'
import { StarIcon } from './icons'
import { Card, Empty, Heading, RatingBadge } from './ui'

/** One finished night of the player. */
export interface RatedNight {
  match_id: string
  played_at: string
  rating: number
  is_mvp: boolean
}

const TREND: Record<Trend, { text: string; tone: string }> = {
  up: { text: '▲ Up', tone: 'text-brand-ink' },
  down: { text: '▼ Down', tone: 'text-danger' },
  level: { text: '▶ Steady', tone: 'text-muted' },
}

/** Nights oldest first. The tabs scope everything in the card. */
export function RatingHistory({ nights, year }: { nights: RatedNight[]; year: number }) {
  const season = nights.filter((n) => n.played_at.startsWith(String(year)))
  const [scope, setScope] = useState<'season' | 'all'>(season.length > 0 ? 'season' : 'all')
  const shown = scope === 'season' ? season : nights
  const form = recentForm(shown.map((n) => n.rating))
  const best = bestNight(shown)
  const mvps = shown.filter((n) => n.is_mvp).length

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-2">
        <Heading>Rating history</Heading>
        <div className="flex gap-1" role="tablist" aria-label="Rating history">
          {(['season', 'all'] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={scope === s}
              onClick={() => setScope(s)}
              className={`h-9 rounded-lg px-3 text-sm font-semibold ${scope === s ? 'bg-ink text-paper' : 'text-muted'}`}
            >
              {s === 'season' ? year : 'All-time'}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <Empty title="No rated nights yet">Ratings appear after a night's voting closes.</Empty>
      ) : (
        <>
          <RatingChart key={scope} nights={shown} />

          <div className="mt-4">
            <div className="flex items-baseline justify-between">
              <p className="label">Form · last {Math.min(FORM_NIGHTS, shown.length)}</p>
              <p className="text-sm">
                <span className="tabular font-display text-lg">{form.average?.toFixed(1)}</span>
                {form.trend && <span className={`ml-2 font-bold ${TREND[form.trend].tone}`}>{TREND[form.trend].text}</span>}
              </p>
            </div>
            <ol className="mt-1.5 flex gap-1.5">
              {shown.slice(-FORM_NIGHTS).map((n) => (
                <li key={n.match_id}>
                  <RatingBadge value={n.rating} size="sm" />
                </li>
              ))}
            </ol>
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
            {best && (
              <div className="rounded-xl bg-ground p-3">
                <dt className="text-muted">Best night</dt>
                <dd className="mt-1 flex items-center gap-2">
                  <RatingBadge value={best.rating} size="sm" />
                  <Link to={`/nights/${best.match_id}`} className="font-semibold underline">
                    {formatDay(best.played_at)}
                  </Link>
                </dd>
              </div>
            )}
            <div className="rounded-xl bg-ground p-3">
              <dt className="text-muted">Man of the Match</dt>
              <dd className="mt-1 flex items-center gap-1.5 font-display text-xl">
                <StarIcon size={18} className="text-gold" /> {mvps}
              </dd>
            </div>
          </dl>
        </>
      )}
    </Card>
  )
}

// The graph's drawing box (the SVG scales to the card's width).
const W = 320
const H = 140
const PAD = { left: 24, right: 12, top: 12, bottom: 12 }
/** The rating bands' edges (Design/README.md section 3), as faint lines. */
const BANDS = [6, 7, 8]

/**
 * The nights' ratings as a line, oldest on the left. Tap or slide across it
 * (or use the arrow keys) to pick a night: its date and rating badge show
 * above. The latest night is picked at first.
 */
function RatingChart({ nights }: { nights: RatedNight[] }) {
  const reduce = useReducedMotion()
  const [picked, setPicked] = useState(nights.length - 1)
  const ratings = nights.map((n) => n.rating)
  const scale = chartScale(ratings)
  const px = (i: number) => PAD.left + scale.x(i) * (W - PAD.left - PAD.right)
  const py = (rating: number) => PAD.top + scale.y(rating) * (H - PAD.top - PAD.bottom)
  const line = ratings.map((r, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)},${py(r).toFixed(1)}`).join(' ')
  const floor = py(scale.min).toFixed(1)
  const area = `${line} L${px(ratings.length - 1).toFixed(1)},${floor} L${px(0).toFixed(1)},${floor} Z`
  const night = nights[picked]

  // The pointer picks the nearest night, so nobody has to hit a dot.
  function pick(e: PointerEvent<HTMLDivElement>) {
    const box = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - box.left) / box.width) * W
    let nearest = 0
    for (let i = 1; i < nights.length; i++) if (Math.abs(px(i) - x) < Math.abs(px(nearest) - x)) nearest = i
    setPicked(nearest)
  }

  function keys(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'ArrowLeft') setPicked((p) => Math.max(0, p - 1))
    else if (e.key === 'ArrowRight') setPicked((p) => Math.min(nights.length - 1, p + 1))
    else return
    e.preventDefault()
  }

  return (
    <div>
      <div className="mb-1 flex min-h-8 items-center justify-between gap-2" aria-live="polite">
        <span className="text-sm text-muted">
          {formatDay(night.played_at)}
          {night.is_mvp && ' · Man of the Match'}
        </span>
        <RatingBadge value={night.rating} />
      </div>
      <div
        role="group"
        tabIndex={0}
        aria-label={`Rating graph of ${nights.length} night${nights.length === 1 ? '' : 's'}. Use the arrow keys to pick a night.`}
        className="touch-pan-y rounded-lg"
        onPointerDown={pick}
        onPointerMove={(e) => {
          if (e.pointerType === 'mouse' || e.buttons > 0) pick(e)
        }}
        onKeyDown={keys}
      >
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" aria-hidden>
          {BANDS.filter((b) => b > scale.min).map((b) => (
            <g key={b}>
              <line x1={PAD.left} x2={W - PAD.right} y1={py(b)} y2={py(b)} stroke="var(--line)" strokeWidth={1} />
              <text x={PAD.left - 6} y={py(b) + 3.5} textAnchor="end" className="fill-muted text-[10px]">
                {b}
              </text>
            </g>
          ))}
          <m.path
            d={area}
            fill="var(--brand-ink)"
            fillOpacity={0.1}
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.4 }}
          />
          <line x1={px(picked)} x2={px(picked)} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--muted)" strokeWidth={1} />
          <m.path
            d={line}
            fill="none"
            stroke="var(--brand-ink)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={reduce ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
          {ratings.map((r, i) => (
            <circle
              key={nights[i].match_id}
              cx={px(i)}
              cy={py(r)}
              r={i === picked ? 6 : 4}
              fill="var(--brand-ink)"
              stroke="var(--paper)"
              strokeWidth={2}
            />
          ))}
        </svg>
      </div>
    </div>
  )
}
