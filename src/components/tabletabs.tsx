// Table · Squad: the switch at the top of both screens.
import { Link } from 'react-router'

const TABS = [
  { key: 'table', label: 'Table', to: '/table' },
  { key: 'squad', label: 'Squad', to: '/table/squad' },
] as const

export function TableTabs({ active }: { active: 'table' | 'squad' }) {
  return (
    <nav aria-label="Table or squad" className="mb-3 inline-flex overflow-hidden rounded-xl border-2 border-ink">
      {TABS.map((t) => (
        <Link
          key={t.key}
          to={t.to}
          aria-current={active === t.key ? 'page' : undefined}
          className={`flex h-12 min-w-24 items-center justify-center px-4 font-display ${
            active === t.key ? 'bg-brand text-on-brand' : 'bg-paper text-muted'
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  )
}
