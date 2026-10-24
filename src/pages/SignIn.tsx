import { useState, type FormEvent } from 'react'
import { Button, ErrorNote, Notice } from '../components/ui'
import { errorMessage } from '../lib/format'
import { isIos, isStandalone } from '../lib/pwa'
import { emailCodeEnabled, supabase } from '../lib/supabase'

export default function SignIn() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Google sign-in can fail to return to an iPhone Home Screen app, so
  // (when the email code option is turned on) installed iPhone users see it first.
  const [showEmail, setShowEmail] = useState(() => emailCodeEnabled && isIos() && isStandalone())

  async function signInWithGoogle() {
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      // Back to the app's home page (an invite code from a link is kept in storage).
      options: { redirectTo: window.location.origin },
    })
    // On success the browser leaves for Google, so we only get here on errors.
    if (error) {
      setError(error.message)
      setBusy(false)
    }
  }

  return (
    <main className="honeycomb flex min-h-dvh flex-col items-center justify-center px-6 pt-[env(safe-area-inset-top)] pb-[calc(env(safe-area-inset-bottom)+24px)] text-center">
      <img src="/logo.svg" alt="" className="h-[170px]" />
      {/* White lettering is allowed here only: it is the big logo lettering. */}
      <h1 className="mt-2.5 mb-9 font-display text-[44px] leading-none text-white">7GZ-KORA</h1>
      <div className="w-full max-w-sm">
        <Button variant="black" size="lg" className="w-full text-base" busy={busy} onClick={signInWithGoogle}>
          <GoogleMark /> Continue with Google
        </Button>
        <ErrorNote message={error} />

        {!emailCodeEnabled ? null : showEmail ? (
          <EmailCode />
        ) : (
          <button
            type="button"
            onClick={() => setShowEmail(true)}
            className="mt-6 min-h-12 w-full text-center text-sm font-semibold text-on-brand underline"
          >
            Trouble with Google? Sign in with an email code
          </button>
        )}
      </div>
    </main>
  )
}

/** Fallback: a 6-digit code sent by email, typed into the app (works inside the iPhone Home Screen app). */
function EmailCode() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function sendCode(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const { error } = await supabase.auth.signInWithOtp({ email: email.trim() })
      if (error) throw error
      setSent(true)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function verify(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' })
    if (error) {
      setError(error.message)
      setBusy(false)
    }
    // On success the app switches screens by itself.
  }

  return (
    <div className="mt-6 rounded-card border-2 border-[#0b0b0b] bg-paper p-4 text-left text-ink">
      <h2 className="label">Sign in with an email code</h2>
      {!sent ? (
        <form onSubmit={sendCode} className="mt-3 space-y-3">
          <label className="block">
            <span className="text-sm text-muted">Your email</span>
            <input
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 h-12 w-full rounded-xl border-[1.5px] border-line bg-paper px-3 text-base"
            />
          </label>
          <Button type="submit" variant="secondary" className="w-full" busy={busy}>
            Email me a code
          </Button>
        </form>
      ) : (
        <form onSubmit={verify} className="mt-3 space-y-3">
          <Notice>We sent a code to {email}. It can take a minute; check spam too.</Notice>
          <label className="block">
            <span className="text-sm text-muted">Code from the email</span>
            <input
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6,10}"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="tabular mt-1 h-14 w-full rounded-xl border-[1.5px] border-line bg-paper px-3 text-center font-display text-3xl tracking-[0.3em]"
            />
          </label>
          <Button type="submit" className="w-full" busy={busy}>
            Sign in
          </Button>
          <button type="button" onClick={() => setSent(false)} className="w-full text-sm text-muted underline">
            Use a different email
          </button>
        </form>
      )}
      <ErrorNote message={error} />
    </div>
  )
}

function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden className="rounded-full bg-white p-0.5">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 6.9-10.3 6.9-17.7z" />
      <path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.2 1.5-5 2.3-8.2 2.3-6.2 0-11.5-4.1-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
    </svg>
  )
}
