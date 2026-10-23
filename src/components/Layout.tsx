import { NavLink, Outlet } from 'react-router'
import { useGroup } from '../state/group'
import { HomeIcon, MatchesIcon, MoreIcon, PersonIcon, TableIcon } from './icons'
import { Name } from './ui'

/** Green striped header + content + bottom tabs (one-handed navigation). */
export default function Layout() {
  const { group, myPlayerId } = useGroup()

  const tabs = [
    { to: '/', label: 'Home', icon: HomeIcon, end: true },
    { to: '/matches', label: 'Matches', icon: MatchesIcon, end: false },
    { to: '/table', label: 'Table', icon: TableIcon, end: false },
    { to: `/players/${myPlayerId}`, label: 'Me', icon: PersonIcon, end: false },
    { to: '/settings', label: 'More', icon: MoreIcon, end: false },
  ]

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="pitch-stripes sticky top-0 z-20 pt-[env(safe-area-inset-top)] text-white shadow-sm">
        <div className="mx-auto flex h-14 max-w-xl items-center gap-3 px-4">
          <img src="/logo.svg" alt="" className="size-9" />
          <div className="min-w-0 leading-tight">
            <p className="font-display text-xl font-bold tracking-wide">Ta7dy-El-La3eeba</p>
            {group && (
              <p className="truncate text-xs text-white/85">
                <Name>{group.name}</Name>
              </p>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl flex-1 px-4 pt-4 pb-28">
        <Outlet />
      </main>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
      >
        <ul className="mx-auto grid h-16 max-w-xl grid-cols-5">
          {tabs.map(({ to, label, icon: Icon, end }) => (
            <li key={label}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex h-full flex-col items-center justify-center gap-0.5 text-xs font-medium ${
                    isActive ? 'text-pitch' : 'text-muted'
                  }`
                }
              >
                <Icon size={24} />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
