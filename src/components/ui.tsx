// Small building blocks used on every screen.
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router'
import { initials, ratingTone } from '../lib/format'
import type { Team } from '../lib/types'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const variants: Record<Variant, string> = {
  primary: 'bg-primary text-white shadow-sm disabled:opacity-50',
  secondary: 'bg-card text-ink border border-line disabled:opacity-50',
  ghost: 'text-ink hover:bg-line/50 disabled:opacity-50',
  danger: 'bg-card text-danger border border-line disabled:opacity-50',
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  busy = false,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg'; busy?: boolean }) {
  const sizes = { sm: 'h-9 px-3 text-sm', md: 'h-12 px-4 text-base', lg: 'h-14 px-5 text-lg' }
  return (
    <button
      type="button"
      disabled={busy || props.disabled}
      className={`press inline-flex items-center justify-center gap-2 rounded-xl font-semibold ${sizes[size]} ${variants[variant]} ${className}`}
      {...props}
    >
      {busy ? <Spinner small /> : children}
    </button>
  )
}

export function LinkButton({
  to,
  variant = 'primary',
  className = '',
  children,
}: {
  to: string
  variant?: Variant
  className?: string
  children: ReactNode
}) {
  return (
    <Link
      to={to}
      className={`press inline-flex h-12 items-center justify-center gap-2 rounded-xl px-4 text-base font-semibold ${variants[variant]} ${className}`}
    >
      {children}
    </Link>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-line bg-card p-4 ${className}`}>{children}</section>
}

/** Condensed uppercase heading, like a scoreboard label. */
export function Heading({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <h2 className={`font-display text-sm font-semibold tracking-wider text-muted uppercase ${className}`}>
      {children}
    </h2>
  )
}

export function PageTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-4">
      <h1 className="font-display text-3xl leading-tight font-bold">{children}</h1>
      {sub && <p className="mt-0.5 text-muted">{sub}</p>}
    </div>
  )
}

export function Spinner({ small = false }: { small?: boolean }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${small ? 'size-5' : 'size-8'}`}
    />
  )
}

export function Loading() {
  return (
    <div className="flex justify-center py-16 text-pitch">
      <Spinner />
    </div>
  )
}

export function ErrorNote({ message, onRetry }: { message: string | null | undefined; onRetry?: () => void }) {
  if (!message) return null
  return (
    <div role="alert" className="my-3 rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
      {message}
      {onRetry && (
        <button type="button" onClick={onRetry} className="ml-2 font-semibold underline">
          Try again
        </button>
      )}
    </div>
  )
}

export function Notice({ children }: { children: ReactNode }) {
  return <div className="my-3 rounded-xl bg-team-a-soft p-3 text-sm text-ink">{children}</div>
}

/**
 * Names may be Arabic: <bdi> keeps them displaying correctly inside English
 * text, and text-left keeps them lined up with the other names in a list.
 */
export function Name({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <bdi dir="auto" className={`text-left ${className}`}>
      {children}
    </bdi>
  )
}

export function RatingBadge({ value, size = 'md' }: { value: number | null | undefined; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: 'h-6 min-w-9 text-base rounded-md',
    md: 'h-8 min-w-11 text-xl rounded-lg',
    lg: 'h-14 min-w-18 text-4xl rounded-xl',
  }
  return (
    <span
      className={`tabular inline-flex items-center justify-center px-1.5 font-display font-bold ${sizes[size]} ${ratingTone(value)}`}
    >
      {value == null ? '–' : Number(value).toFixed(1)}
    </span>
  )
}

export function Avatar({ name, url, size = 36 }: { name: string; url?: string | null; size?: number }) {
  if (url) {
    return (
      <img
        src={url}
        alt=""
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        className="shrink-0 rounded-full bg-line object-cover"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-team-a-soft font-display font-bold text-team-a uppercase"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {initials(name)}
    </span>
  )
}

export function TeamTag({ team }: { team: Team }) {
  return (
    <span
      className={`inline-flex h-6 items-center rounded-md px-2 font-display text-sm font-bold tracking-wide ${
        team === 'A' ? 'bg-team-a-soft text-team-a' : 'bg-team-b-soft text-team-b'
      }`}
    >
      TEAM {team}
    </span>
  )
}

export function StatusChip({ status }: { status: 'draft' | 'playing' | 'voting' | 'closed' }) {
  const label = { draft: 'Planned', playing: 'Playing', voting: 'Voting open', closed: 'Final' }[status]
  const tone = {
    draft: 'bg-line text-muted',
    playing: 'bg-team-b-soft text-team-b',
    voting: 'bg-gold/20 text-ink',
    closed: 'bg-team-a-soft text-team-a',
  }[status]
  return (
    <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold ${tone}`}>{label}</span>
  )
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line p-6 text-center">
      <p className="font-semibold">{title}</p>
      {children && <div className="mt-2 text-sm text-muted">{children}</div>}
    </div>
  )
}
