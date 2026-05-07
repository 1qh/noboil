/** Sonner-compatible toast function. Callers may invoke with just `(message)` or with an action/duration. */
type ToastFn = (message: string, opts?: { action?: { label: string; onClick: () => void }; duration?: number }) => void
export type { ToastFn }
