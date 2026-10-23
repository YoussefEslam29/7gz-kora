import { isAndroid, isStandalone, useInstallPrompt } from '../lib/pwa'
import { emailCodeEnabled } from '../lib/supabase'
import { CheckIcon } from './icons'
import { Button, Card, Heading } from './ui'

/** Step-by-step "Add to Home Screen" for iPhone and Android. */
export default function InstallGuide() {
  const { canInstall, install } = useInstallPrompt()
  const iphoneFirst = !isAndroid()

  if (isStandalone()) {
    return (
      <Card>
        <p className="flex items-center gap-2 font-semibold">
          <CheckIcon className="text-pitch" /> The app is installed on this phone.
        </p>
      </Card>
    )
  }

  const iphone = (
    <Card key="iphone">
      <Heading className="mb-2">iPhone</Heading>
      <ol className="list-decimal space-y-1.5 pl-5">
        <li>Open this page in <strong>Safari</strong>.</li>
        <li>
          Tap the <strong>Share</strong> button (the square with an arrow pointing up).
        </li>
        <li>
          Scroll down and tap <strong>Add to Home Screen</strong>, then <strong>Add</strong>.
        </li>
        <li>Open Ta7dy from your Home Screen and sign in there.</li>
      </ol>
      <p className="mt-3 text-sm text-muted">
        {emailCodeEnabled
          ? `If Google sign-in doesn't bring you back into the app, use "Sign in with an email code" instead.`
          : "If Google sign-in doesn't bring you back into the app, tell your group admin."}
      </p>
    </Card>
  )
  const android = (
    <Card key="android">
      <Heading className="mb-2">Android</Heading>
      {canInstall && (
        <Button className="mb-3 w-full" onClick={() => void install()}>
          Install app
        </Button>
      )}
      <ol className="list-decimal space-y-1.5 pl-5">
        <li>Open this page in <strong>Chrome</strong>.</li>
        <li>
          Tap the menu <strong>⋮</strong> (top right).
        </li>
        <li>
          Tap <strong>Install app</strong> (or <strong>Add to Home screen</strong>).
        </li>
      </ol>
    </Card>
  )

  return (
    <div className="space-y-4">
      <Heading>Install the app</Heading>
      <p className="text-sm">
        Ta7dy is a web app: no App Store or Play Store needed. Add it to your home screen and it opens full-screen like
        any other app, and updates itself.
      </p>
      {iphoneFirst ? [iphone, android] : [android, iphone]}
    </div>
  )
}
