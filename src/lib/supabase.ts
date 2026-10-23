import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

/** False until the two values in .env.local (or the hosting settings) are filled in. */
export const isConfigured = Boolean(url && key)

/**
 * Fallback sign-in with a 6-digit email code, for when Google sign-in does not
 * return to the iPhone Home Screen app. Off until the owner sets up an email
 * sender in Supabase (README: "If Google sign-in fails on iPhone").
 */
export const emailCodeEnabled = import.meta.env.VITE_ENABLE_EMAIL_CODE === 'true'

export const supabase = createClient(url ?? 'http://localhost:54321', key ?? 'not-configured', {
  auth: {
    // PKCE: Google sends back a one-time code in the URL, which the client
    // swaps for a session automatically when the app loads.
    flowType: 'pkce',
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true,
  },
})
