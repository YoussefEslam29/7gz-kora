import * as m from 'motion/react-m'
import { useEffect } from 'react'
import { BrowserRouter, Link, Route, Routes, useLocation } from 'react-router'
import Layout from './components/Layout'
import { Button, ErrorNote } from './components/ui'
import { allowBrowser, appMode } from './lib/access'
import { isStandalone } from './lib/pwa'
import { KEYS, writeLocal } from './lib/storage'
import { isConfigured } from './lib/supabase'
import Home from './pages/Home'
import ChangeHistory from './pages/ChangeHistory'
import EditCard from './pages/EditCard'
import HowItWorks from './pages/HowItWorks'
import InstallScreen from './pages/InstallScreen'
import JoinOrCreate from './pages/JoinOrCreate'
import Leaderboard from './pages/Leaderboard'
import NightPage from './pages/NightPage'
import Nights from './pages/Nights'
import PlanNight from './pages/PlanNight'
import PlayerProfile from './pages/PlayerProfile'
import Recorder from './pages/Recorder'
import Settings from './pages/Settings'
import SignIn from './pages/SignIn'
import Swap from './pages/Swap'
import Teams from './pages/Teams'
import Vote from './pages/Vote'
import Welcome from './pages/Welcome'
import { AuthProvider, useAuth } from './state/auth'
import { GroupProvider, useGroup } from './state/group'

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

/** Signed out: sign-in screen. Signed in: load their groups. */
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
    <GroupProvider key={user.id}>
      <GroupGate />
    </GroupProvider>
  )
}

/** No group yet: join or create one. Otherwise: the app. */
function GroupGate() {
  const { loading, error, group, refresh } = useGroup()
  const { signOut } = useAuth()

  if (loading && !error) return <Splash />
  if (!group) {
    if (error) {
      return (
        <div className="mx-auto max-w-sm px-6 pt-24 text-center">
          <ErrorNote message={error} />
          <Button className="w-full" onClick={() => window.location.reload()}>
            Try again
          </Button>
          <Button variant="ghost" className="mt-2 w-full" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      )
    }
    return <JoinOrCreate standalone />
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="nights" element={<Nights />} />
        <Route path="nights/new" element={<PlanNight />} />
        <Route path="nights/:id" element={<NightPage />} />
        <Route path="nights/:id/edit" element={<PlanNight />} />
        <Route path="nights/:id/teams" element={<Teams />} />
        <Route path="nights/:id/swap" element={<Swap />} />
        <Route path="nights/:id/record" element={<Recorder />} />
        <Route path="nights/:id/vote" element={<Vote />} />
        <Route path="table" element={<Leaderboard />} />
        <Route path="players/:id" element={<PlayerProfile />} />
        <Route path="players/:id/edit" element={<EditCard />} />
        <Route path="settings" element={<Settings />} />
        <Route path="settings/history" element={<ChangeHistory />} />
        <Route path="how-it-works" element={<HowItWorks />} />
        <Route path="join" element={<JoinOrCreate />} />
        <Route path="welcome" element={<Welcome />} />
        <Route path="*" element={<NotFound onRetry={() => void refresh()} />} />
      </Route>
    </Routes>
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
