import { useEffect, useState, type ReactNode } from 'react'
import { Button } from '../components/ui'
import { inviteCodeFromUrl } from '../lib/access'
import { installTarget, type InstallTarget } from '../lib/installTarget'
import { useInstallPrompt } from '../lib/pwa'
import { KEYS, writeLocal } from '../lib/storage'

/**
 * All the website shows in a browser (Plans/Install-first-access.md): the
 * logo, the name and how to install on this device, plus the invite code
 * when opened from an invite link. Nothing else about the app or any group.
 */
export default function InstallScreen() {
  const [target] = useState(() => installTarget(navigator.userAgent, navigator.maxTouchPoints))
  const [code] = useState(() => inviteCodeFromUrl(window.location.pathname, window.location.search))

  // Android shares storage between Chrome and the installed app, so the code
  // can be waiting there. On iPhone people type it after signing in.
  useEffect(() => {
    if (code) writeLocal(KEYS.pendingInvite, code)
  }, [code])

  return (
    <main className="honeycomb flex min-h-dvh flex-col items-center px-[18px] pt-[calc(env(safe-area-inset-top)+40px)] pb-[calc(env(safe-area-inset-bottom)+24px)] text-center">
      <img src="/logo.svg" alt="" className="h-[120px]" />
      {/* White lettering is allowed here only: it is the big logo lettering. */}
      <h1 className="mt-2 mb-[18px] font-display text-[38px] leading-none text-white">7GZ-KORA</h1>
      <div className="w-full max-w-sm space-y-2.5 text-left">
        <Steps target={target} />
        {code && <InviteCode code={code} />}
      </div>
    </main>
  )
}

const list = 'list-decimal space-y-1 pl-5 font-semibold leading-relaxed'

function Steps({ target }: { target: InstallTarget }) {
  const { canInstall, install } = useInstallPrompt()
  const installButton = canInstall && (
    <Button variant="black" className="mb-3 w-full" onClick={() => void install()}>
      Install app
    </Button>
  )

  switch (target) {
    case 'ios-safari':
      return (
        <StepsCard title="Install on iPhone">
          <ol className={list}>
            <li>
              Tap <b>Share</b> in Safari (the square with an arrow)
            </li>
            <li>
              Tap <b>Add to Home Screen</b>, then <b>Add</b>
            </li>
            <li>Open 7GZ-KORA from your home screen</li>
          </ol>
        </StepsCard>
      )
    case 'android-chrome':
      return (
        <StepsCard title="Install on Android">
          {installButton}
          <ol className={list}>
            <li>
              Tap the menu <b>⋮</b> (top right)
            </li>
            <li>
              Tap <b>Install app</b> (or <b>Add to Home screen</b>)
            </li>
            <li>Open 7GZ-KORA from your home screen</li>
          </ol>
        </StepsCard>
      )
    case 'desktop-chromium':
      return (
        <StepsCard title="Install on this computer">
          {installButton}
          <p className="font-semibold">Or click the install icon at the right of the address bar.</p>
        </StepsCard>
      )
    case 'mac-safari':
      return (
        <StepsCard title="Install on Mac">
          <ol className={list}>
            <li>
              In the menu bar, click <b>File</b> → <b>Add to Dock</b>
            </li>
            <li>Open 7GZ-KORA from the Dock</li>
          </ol>
        </StepsCard>
      )
    case 'ios-other':
      return <OpenElsewhere browser="Safari" />
    case 'android-other':
      return <OpenElsewhere browser="Chrome" />
    default:
      return <OpenElsewhere browser="Chrome or Edge" />
  }
}

function StepsCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-card border-2 border-[#0b0b0b] bg-paper p-3.5 text-ink">
      <h2 className="label mb-1.5">{title}</h2>
      {children}
    </section>
  )
}

/** In-app browsers and other browsers can't install: open the page in the right one. */
function OpenElsewhere({ browser }: { browser: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <StepsCard title="Install">
      <p className="font-semibold">
        Open this page in <b>{browser}</b> to install.
      </p>
      <Button
        variant="black"
        className="mt-3 w-full"
        onClick={() =>
          void navigator.clipboard
            .writeText(window.location.href)
            .then(() => setCopied(true))
            .catch(() => setCopied(false))
        }
      >
        {copied ? 'Link copied' : 'Copy link'}
      </Button>
    </StepsCard>
  )
}

function InviteCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <section className="rounded-card border-2 border-[#0b0b0b] bg-paper p-3.5 text-ink">
      <h2 className="label">Your invite code</h2>
      <div className="flex items-center justify-between gap-2">
        <span className="font-display text-2xl tracking-[0.06em]">{code}</span>
        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            void navigator.clipboard
              .writeText(code)
              .then(() => setCopied(true))
              .catch(() => setCopied(false))
          }
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <p className="text-sm text-muted">Enter it after you install and sign in.</p>
    </section>
  )
}
