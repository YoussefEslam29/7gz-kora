// Pop-up sheets and short messages in the app's own style
// (Plans/Player-card-and-motion.md section 5). The sheet replaces the
// browser's window.confirm, which looks out of place in the installed app
// and on iPhone shows the website address as its title.
import { AnimatePresence } from 'motion/react'
import * as m from 'motion/react-m'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { Button } from './ui'

/** What a confirmation sheet asks. The yes button is red when `danger` is set. */
export interface Question {
  title: string
  message?: ReactNode
  /** The yes button, e.g. "Delete". */
  confirmLabel: string
  danger?: boolean
}

interface Feedback {
  /** Shows the sheet; true when the person taps the yes button. */
  confirm: (question: Question) => Promise<boolean>
  /** A short message above the tab bar for about 2.5 seconds ("Votes saved"). */
  toast: (message: ReactNode) => void
}

const FeedbackContext = createContext<Feedback | null>(null)

type Asking = Question & { resolve: (yes: boolean) => void }
type Toast = { id: number; message: ReactNode }

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [asking, setAsking] = useState<Asking | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)

  const confirm = useCallback(
    (question: Question) => new Promise<boolean>((resolve) => setAsking({ ...question, resolve })),
    [],
  )

  const toast = useCallback((message: ReactNode) => {
    const id = ++nextId.current
    // At most three at once: the oldest goes first.
    setToasts((list) => [...list.slice(-2), { id, message }])
    window.setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 2500)
  }, [])

  const answer = useCallback(
    (yes: boolean) => {
      asking?.resolve(yes)
      setAsking(null)
    },
    [asking],
  )

  const value = useMemo(() => ({ confirm, toast }), [confirm, toast])

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <AnimatePresence>{asking && <ConfirmSheet key="confirm" question={asking} onAnswer={answer} />}</AnimatePresence>
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-40 flex flex-col items-center gap-2 px-4">
        <AnimatePresence>
          {toasts.map((t) => (
            <m.p
              key={t.id}
              role="status"
              layout
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8 }}
              className="max-w-full rounded-full bg-ink px-4 py-2.5 text-center text-sm font-semibold text-paper shadow-[0_3px_0_#0b0b0b]"
            >
              {t.message}
            </m.p>
          ))}
        </AnimatePresence>
      </div>
    </FeedbackContext.Provider>
  )
}

/** The bottom sheet: a title, a message, Cancel and the yes button. */
function ConfirmSheet({ question, onAnswer }: { question: Question; onAnswer: (yes: boolean) => void }) {
  const sheet = useRef<HTMLDivElement>(null)

  // Escape closes the sheet; afterwards the focus goes back where it was.
  useEffect(() => {
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onAnswer(false)
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      before?.focus()
    }
  }, [onAnswer])

  // Tab stays inside the sheet.
  function trap(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'Tab') return
    const buttons = sheet.current?.querySelectorAll('button')
    if (!buttons || buttons.length === 0) return
    const first = buttons[0]
    const last = buttons[buttons.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <m.div
        aria-hidden
        className="absolute inset-0 bg-black/50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => onAnswer(false)}
      />
      <m.div
        ref={sheet}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        aria-describedby={question.message ? 'sheet-message' : undefined}
        onKeyDown={trap}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 420, damping: 36 }}
        className="relative w-full max-w-xl rounded-t-[22px] border-2 border-b-0 border-ink bg-paper px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+16px)]"
      >
        <span aria-hidden className="mx-auto mb-3 block h-1.5 w-10 rounded-full bg-line" />
        <h2 id="sheet-title" className="font-display text-[22px] leading-tight">
          {question.title}
        </h2>
        {question.message && (
          <p id="sheet-message" className="mt-1 text-muted">
            {question.message}
          </p>
        )}
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" className="flex-1" autoFocus onClick={() => onAnswer(false)}>
            Cancel
          </Button>
          <Button variant={question.danger ? 'danger' : 'primary'} className="flex-1" onClick={() => onAnswer(true)}>
            {question.confirmLabel}
          </Button>
        </div>
      </m.div>
    </div>
  )
}

function useFeedback(): Feedback {
  const ctx = useContext(FeedbackContext)
  if (!ctx) throw new Error('useFeedback must be used inside FeedbackProvider')
  return ctx
}

/** confirm({ title, message, confirmLabel, danger }): true when the person says yes. */
// eslint-disable-next-line react/only-export-components
export const useConfirm = () => useFeedback().confirm

/** toast("Votes saved"): a short message above the tab bar. */
// eslint-disable-next-line react/only-export-components
export const useToast = () => useFeedback().toast
