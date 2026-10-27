import * as m from 'motion/react-m'
import { Suspense } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { rise, spring } from '../lib/motion'
import { useAccount } from '../state/account'
import { useChat } from '../state/chat'
import { useGroup } from '../state/group'
import { ChatIcon, HomeIcon, MatchesIcon, MoreIcon, SearchIcon, TableIcon } from './icons'
import { Avatar, Loading, Name } from './ui'

const COLUMNS = { 3: 'grid-cols-3', 4: 'grid-cols-4', 5: 'grid-cols-5' } as const

/** Honeycomb header + content + bottom tabs (one-handed navigation). */
export default function Layout() {
  const { group } = useGroup()
  const { account } = useAccount()
  const { unread } = useChat()
  const { pathname } = useLocation()
  const dot = unread && pathname !== '/chat'

  // With a group: its nights and table. Without one: Find.
  const tabs = group
    ? [
        { to: '/', label: 'Home', icon: HomeIcon, end: true },
        { to: '/nights', label: 'Nights', icon: MatchesIcon, end: false },
        { to: '/chat', label: 'Chat', icon: ChatIcon, end: false },
        { to: '/table', label: 'Table', icon: TableIcon, end: false },
        { to: '/settings', label: 'More', icon: MoreIcon, end: false },
      ]
    : [
        { to: '/', label: 'Home', icon: HomeIcon, end: true },
        { to: '/find', label: 'Find', icon: SearchIcon, end: false },
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
          <div className="ml-auto flex shrink-0 items-center">
            <Link to="/find" aria-label="Find players and groups" className="flex size-12 items-center justify-center rounded-full">
              <SearchIcon size={24} />
            </Link>
            <Link to="/me" aria-label="My account" className="flex size-12 items-center justify-center">
              <span className="rounded-full border-2 border-[#0b0b0b]">
                <Avatar name={account?.display_name ?? ''} url={account?.avatar_url} size={32} />
              </span>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl flex-1 px-4 pt-4 pb-28">
        {/* Each screen slides in when you open it. */}
        <m.div key={pathname} {...rise}>
          {/* A screen still downloading shows the placeholders. */}
          <Suspense fallback={<Loading />}>
            <Outlet />
          </Suspense>
        </m.div>
      </main>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-20 border-t-[1.5px] border-line bg-paper pb-[env(safe-area-inset-bottom)]"
      >
        <ul className={`mx-auto grid h-16 max-w-xl ${COLUMNS[tabs.length as keyof typeof COLUMNS]}`}>
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
                      {label === 'Chat' && dot && (
                        <span aria-hidden className="absolute top-0 right-1.5 size-2.5 rounded-full border-2 border-paper bg-danger" />
                      )}
                    </span>
                    {label}
                    {label === 'Chat' && dot && <span className="sr-only">, new messages</span>}
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
