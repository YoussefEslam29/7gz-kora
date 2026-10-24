// Small building blocks used on every screen. The look follows
// Design/README.md; the CSS classes (btn, chip, label...) live in index.css.
import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router'
import { initials, ratingTone } from '../lib/format'
import { shareText } from '../lib/share'
import type { Bib, MatchStatus } from '../lib/types'

type Variant = 'primary' | 'secondary' | 'black' | 'dark' | 'danger' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

const sizes: Record<Size, string> = { sm: 'btn-sm', md: '', lg: 'btn-big' }

/**
 * Primary: green with black text, one per screen area. Black: the action on
 * green surfaces. Dark: ink (black, or white in dark mode). Ghost: a quiet text action.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  busy = false,
  disabled,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; busy?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      disabled={busy || disabled}
      className={`btn btn-${variant} ${sizes[size]} ${className}`}
    >
      {busy ? <Spinner small /> : children}
    </button>
  )
}

export function LinkButton({
  to,
  variant = 'primary',
  size = 'md',
  className = '',
  children,
}: {
  to: string
  variant?: Variant
  size?: Size
  className?: string
  children: ReactNode
}) {
  return (
    <Link to={to} className={`btn btn-${variant} ${sizes[size]} ${className}`}>
      {children}
    </Link>
  )
}

/** White card. `strong` gives important cards (money, live night) a bold ink border. */
export function Card({ children, className = '', strong = false }: { children: ReactNode; className?: string; strong?: boolean }) {
  return (
    <section
      className={`rounded-card bg-paper p-4 ${strong ? 'border-2 border-ink' : 'border-[1.5px] border-line'} ${className}`}
    >
      {children}
    </section>
  )
}

/** UPPERCASE label, like "THU 29 OCT · 20:00". */
export function Heading({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <h2 className={`label ${className}`}>{children}</h2>
}

export function PageTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-4">
      <h1 className="font-display text-[34px] leading-[1.05]">{children}</h1>
      {sub && <p className="mt-1 text-muted">{sub}</p>}
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
    <div className="flex justify-center py-16 text-brand-ink">
      <Spinner />
    </div>
  )
}

export function ErrorNote({ message, onRetry }: { message: string | null | undefined; onRetry?: () => void }) {
  if (!message) return null
  return (
    <div role="alert" className="my-3 rounded-xl border-[1.5px] border-danger bg-paper p-3 text-sm font-semibold text-danger">
      {message}
      {onRetry && (
        <button type="button" onClick={onRetry} className="ml-2 underline">
          Try again
        </button>
      )}
    </div>
  )
}

export function Notice({ children }: { children: ReactNode }) {
  return <div className="my-3 rounded-xl bg-brand/15 p-3 text-sm text-ink">{children}</div>
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
    md: 'h-8 min-w-[46px] text-xl rounded-[10px]',
    lg: 'h-14 min-w-18 text-4xl rounded-xl',
  }
  return (
    <span
      className={`tabular inline-flex items-center justify-center px-1.5 font-display ${sizes[size]} ${ratingTone(value)}`}
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
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-brand font-display text-on-brand uppercase"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {initials(name)}
    </span>
  )
}

/** A team in its bib colour (A white, B orange, C blue). Always says "Team X", never colour alone. */
export function TeamTag({ team }: { team: Bib }) {
  return <span className={`chip team-${team.toLowerCase()}`}>Team {team}</span>
}

export function StatusChip({ status }: { status: MatchStatus }) {
  const label = { draft: 'Planned', playing: 'Live', voting: 'Voting', closed: 'Final', cancelled: 'Cancelled' }[status]
  return <span className={`chip status ${status}`}>{label}</span>
}

/** Empty state: the green mark, a one-line title and the next action. */
export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-card border-[1.5px] border-dashed border-line p-6 text-center">
      <img src="/mark-green.svg" alt="" className="mx-auto mb-2 h-24" />
      <p className="font-display text-lg">{title}</p>
      {children && <div className="mt-2 text-sm text-muted">{children}</div>}
    </div>
  )
}

/** Opens the share sheet (WhatsApp etc.) with a ready message, or copies it. */
export function ShareButton({ text, className = '' }: { text: string; className?: string }) {
  const [note, setNote] = useState<string | null>(null)

  async function share() {
    try {
      const result = await shareText(text, window.location.origin)
      setNote(result === 'copied' ? 'Copied. Paste it in WhatsApp.' : null)
    } catch {
      setNote('Could not share. Try again.')
    }
  }

  return (
    <div className={className}>
      <Button variant="secondary" className="w-full" onClick={() => void share()}>
        Share to WhatsApp
      </Button>
      {note && (
        <p role="status" className="mt-1 text-center text-sm text-muted">
          {note}
        </p>
      )}
    </div>
  )
}
