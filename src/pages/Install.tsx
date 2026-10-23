import { Link } from 'react-router'
import { BackIcon } from '../components/icons'
import { useAuth } from '../state/auth'
import InstallGuide from '../components/InstallGuide'

/** Install guide that also works before signing in (/install). */
export default function Install() {
  const { user } = useAuth()
  return (
    <div className="mx-auto max-w-xl px-4 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-28">
      <Link to="/" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted">
        <BackIcon size={18} /> {user ? 'Home' : 'Sign in'}
      </Link>
      <div className="mb-4 flex items-center gap-3">
        <img src="/logo.svg" alt="" className="size-14" />
        <h1 className="font-display text-3xl font-bold">Ta7dy-El-La3eeba</h1>
      </div>
      <InstallGuide />
    </div>
  )
}
