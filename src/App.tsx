import * as m from 'motion/react-m'
import { lazy, useEffect } from 'react'
import { BrowserRouter, Link, Navigate, Outlet, Route, Routes, useLocation } from 'react-router'
import Layout from './components/Layout'
import { Button, ErrorNote } from './components/ui'
import { allowBrowser, appMode } from './lib/access'
import { isStandalone } from './lib/pwa'
import { KEYS, writeLocal } from './lib/storage'
import { isConfigured } from './lib/supabase'
import Home from './pages/Home'
import InstallScreen from './pages/InstallScreen'
import JoinOrCreate from './pages/JoinOrCreate'
import Lobby from './pages/Lobby'
import SignIn from './pages/SignIn'
import SignUp from './pages/SignUp'
import { AccountProvider, useAccount } from './state/account'
import { AuthProvider, useAuth } from './state/auth'
import { ChatProvider } from './state/chat'
import { GroupProvider, useGroup } from './state/group'

// Screens load when they're first opened (Plans/Accounts-groups-and-chat.md
// section 9). The installed app keeps them all for offline use.
const Account = lazy(() => import('./pages/Account'))
const ChangeHistory = lazy(() => import('./pages/ChangeHistory'))
const ChangeName = lazy(() => import('./pages/ChangeName'))
const Chat = lazy(() => import('./pages/Chat'))
const EditAccount = lazy(() => import('./pages/EditAccount'))
const Find = lazy(() => import('./pages/Find'))
const HowItWorks = lazy(() => import('./pages/HowItWorks'))
const Leaderboard = lazy(() => import('./pages/Leaderboard'))
const NightPage = lazy(() => import('./pages/NightPage'))
const Nights = lazy(() => import('./pages/Nights'))
const PlanNight = lazy(() => import('./pages/PlanNight'))
const PlayerProfile = lazy(() => import('./pages/PlayerProfile'))
const Recorder = lazy(() => import('./pages/Recorder'))
const Settings = lazy(() => import('./pages/Settings'))
const Squad = lazy(() => import('./pages/Squad'))
const Swap = lazy(() => import('./pages/Swap'))
const Teams = lazy(() => import('./pages/Teams'))
const Vote = lazy(() => import('./pages/Vote'))

export default function App() {
  // In a browser the website shows only the Install screen (Plans/Install-first-access.md).
  if (appMode({ standalone: isStandalone(), allowBrowser }) === 'install') return <InstallScreen />
  if (!isConfigured) return <SetupNeeded />
  return (
    <BrowserRouter>
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </BrowserRouter>
  )
}

/** Signed out: sign-in screen. Signed in: your account. */
function AuthGate() {
  const { user, loading } = useAuth()
  const location = useLocation()

  // Keep the code from an invite link (/join?code=...) while the person signs in.
  useEffect(() => {
    const code = new URLSearchParams(location.search).get('code')
    if (location.pathname === '/join' && code) writeLocal(KEYS.pendingInvite, code)
  }, [location])

  if (loading) return <Splash />
  if (!user) return <SignIn />
  return (
    <AccountProvider key={user.id}>
      <AccountGate />
    </AccountProvider>
  )
}

/** Signed in: the sign-up questions once, then the groups and the app. */
function AccountGate() {
  const { account, loading, error } = useAccount()
  if (loading) return <Splash />
  if (!account) return <LoadError message={error} />
  if (!account.onboarded_at) return <SignUp />
  return (
    <GroupProvider>
      <GroupGate />
    </GroupProvider>
  )
}

/** The app, with or without a group (Plans/Accounts-groups-and-chat.md section 3). */
function GroupGate() {
  const { loading, error, group, refresh } = useGroup()

  if (loading && !error) return <Splash />
  if (!group && error) return <LoadError message={error} />

  return (
    <ChatProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={group ? <Home /> : <Lobby />} />
          <Route path="find" element={<Find />} />
          <Route path="me" element={<Account />} />
          <Route path="me/edit" element={<EditAccount />} />
          <Route path="u/:id" element={<Account />} />
          <Route path="join" element={<JoinOrCreate />} />
          <Route path="settings" element={<Settings />} />
          <Route path="how-it-works" element={<HowItWorks />} />
          <Route element={<RequireGroup />}>
            <Route path="nights" element={<Nights />} />
            <Route path="nights/new" element={<PlanNight />} />
            <Route path="nights/:id" element={<NightPage />} />
            <Route path="nights/:id/edit" element={<PlanNight />} />
            <Route path="nights/:id/teams" element={<Teams />} />
            <Route path="nights/:id/swap" element={<Swap />} />
            <Route path="nights/:id/record" element={<Recorder />} />
            <Route path="nights/:id/vote" element={<Vote />} />
            <Route path="chat" element={<Chat />} />
            <Route path="table" element={<Leaderboard />} />
            <Route path="table/squad" element={<Squad />} />
            <Route path="players/:id" element={<PlayerProfile />} />
            <Route path="players/:id/edit" element={<ChangeName />} />
            <Route path="settings/history" element={<ChangeHistory />} />
          </Route>
          <Route path="*" element={<NotFound onRetry={() => void refresh()} />} />
        </Route>
      </Routes>
    </ChatProvider>
  )
}

/** Group screens: back to Home when you're not in a group. */
function RequireGroup() {
  const { group } = useGroup()
  return group ? <Outlet /> : <Navigate to="/" replace />
}

/** Couldn't load the account or the groups: try again, or sign out. */
function LoadError({ message }: { message: string | null }) {
  const { signOut } = useAuth()
  return (
    <div className="mx-auto max-w-sm px-6 pt-24 text-center">
      <ErrorNote message={message ?? 'Could not load your account. Check your connection.'} />
      <Button className="w-full" onClick={() => window.location.reload()}>
        Try again
      </Button>
      <Button variant="ghost" className="mt-2 w-full" onClick={() => void signOut()}>
        Sign out
      </Button>
    </div>
  )
}

function Splash() {
  return (
    <div className="honeycomb flex min-h-dvh items-center justify-center">
      {/* The logo drops in and bounces like a ball. */}
      <m.img
        src="/logo.svg"
        alt="Loading 7GZ-KORA"
        className="h-28"
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', bounce: 0.6, duration: 0.9 }}
      />
    </div>
  )
}

function NotFound({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="py-16 text-center">
      <p className="font-display text-3xl">Offside!</p>
      <p className="mt-1 text-muted">This page doesn't exist.</p>
      <Link to="/" onClick={onRetry} className="mt-4 inline-block font-semibold text-brand-ink underline">
        Back to home
      </Link>
    </div>
  )
}

/** Shown until the Supabase keys are set (see README, "Environment variables"). */
function SetupNeeded() {
  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <img src="/mark-green.svg" alt="" className="mb-4 h-16" />
      <h1 className="font-display text-3xl">Almost there</h1>
      <p className="mt-2">The app is running, but it isn't connected to Supabase yet.</p>
      <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm">
        <li>
          Copy <code>.env.example</code> to <code>.env.local</code>.
        </li>
        <li>
          Fill in <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> from your Supabase
          project (Project Settings → API Keys).
        </li>
        <li>Restart <code>npm run dev</code>. On Vercel, add the same two values under Settings → Environment Variables and redeploy.</li>
      </ol>
    </div>
  )
}
