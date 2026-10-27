// Your account (Plans/Accounts-groups-and-chat.md section 1): the player
// card, Show my stats and the InstaPay number, the same in every group.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import * as api from '../lib/api'
import { errorMessage } from '../lib/format'
import type { Account } from '../lib/types'

interface AccountState {
  /** null while loading, or when it couldn't load (see error). */
  account: Account | null
  loading: boolean
  error: string | null
  /** Reload it (after saving, or once the sign-up is done). */
  refresh: () => Promise<void>
}

const AccountContext = createContext<AccountState | null>(null)

export function AccountProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setAccount(await api.getMyAccount())
    setError(null)
  }, [])

  // refresh only sets state after its network call resolves.
  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect
    refresh()
      .catch((e: unknown) => setError(errorMessage(e)))
      .finally(() => setLoading(false))
  }, [refresh])

  const value = useMemo<AccountState>(() => ({ account, loading, error, refresh }), [account, loading, error, refresh])
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
}

// eslint-disable-next-line react/only-export-components
export function useAccount(): AccountState {
  const ctx = useContext(AccountContext)
  if (!ctx) throw new Error('useAccount must be used inside AccountProvider')
  return ctx
}

/** For screens shown only after sign-up, when the account is always there. */
// eslint-disable-next-line react/only-export-components
export function useMyAccount(): Account {
  const { account } = useAccount()
  if (!account) throw new Error('No account loaded')
  return account
}
