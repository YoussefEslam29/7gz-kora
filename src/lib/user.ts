import type { User } from '@supabase/supabase-js'

/** The name from the Google account, used to pre-fill "your name". */
export function googleName(user: User | null): string {
  const meta = user?.user_metadata ?? {}
  return (meta.full_name as string) || (meta.name as string) || (user?.email?.split('@')[0] ?? '')
}
