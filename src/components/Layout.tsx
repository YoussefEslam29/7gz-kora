import * as m from 'motion/react-m'
import { NavLink, Outlet, useLocation } from 'react-router'
import { rise, spring } from '../lib/motion'
import { useGroup } from '../state/group'
import { HomeIcon, MatchesIcon, MoreIcon, PersonIcon, TableIcon } from './icons'
import { Name } from './ui'

/** Honeycomb header + content + bottom tabs (one-handed navigation). */
export default function Layout() {
  const { group, myPlayerId } = useGroup()
  const { pathname } = useLocation()

  const tabs = [
    { to: '/', label: 'Home', icon: HomeIcon, end: true },
    { to: '/nights', label: 'Nights', icon: MatchesIcon, end: false },
    { to: '/table', label: 'Table', icon: TableIcon, end: false },
    { to: `/players/${myPlayerId}`, label: 'Me', icon: PersonIcon, end: false },
    { to: '/settings', label: 'More', icon: MoreIcon, end: false },
  ]

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="honeycomb sticky top-0 z-20 pt-[env(safe-area-inset-top)] text-on-brand">
        <div className="mx-auto flex h-16 max-w-xl items-center gap-2.5 px-4">
          <img src="/logo.svg" alt="" className="h-[46px] w-[30px] object-contain" />
          <div className="min-w-0 leading-none">
            <p className="font-display text-[22px] leading-none">7GZ-KORA</p>
            {group && (
              <p className="mt-1 truncate text-[11.5px] font-semibold opacity-75">
                <Name>{group.name}</Name>
              </p>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl flex-1 px-4 pt-4 pb-28">
        {/* Each screen slides in when you open it. */}
        <m.div key={pathname} {...rise}>
          <Outlet />
        </m.div>
      </main>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-20 border-t-[1.5px] border-line bg-paper pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="mx-auto grid h-16 max-w-xl grid-cols-5">
          {tabs.map(({ to, label, icon: Icon, end }) => (
            <li key={label}>
              <NavLink
                to={to}
                end={end}
                className="flex h-full flex-col items-center justify-center gap-0.5 text-[10.5px] font-bold text-muted aria-[current=page]:text-ink"
              >
                {({ isActive }) => (
                  <>
                    <span className="relative rounded-full px-3 py-[3px]">
                      {/* The green bubble glides to the tab you tap. */}
                      {isActive && (
                        <m.span layoutId="tab-bubble" transition={spring} className="absolute inset-0 rounded-full bg-brand" />
                      )}
                      <Icon size={22} className={`relative ${isActive ? 'text-on-brand' : ''}`} />
                    </span>
                    {label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
