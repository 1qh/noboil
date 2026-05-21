'use client'
import type { ToastFn } from '../../shared/react/toast'
import { useSoftDelete as useSharedSoftDelete } from '../../shared/react/use-soft-delete'
import { UNDO_MS } from '../constants'

interface SoftDeleteOpts<A extends { id: string }> {
  label?: string
  onError?: (error: unknown) => void
  onRestore?: () => void
  restore: (args: A) => Promise<unknown>
  rm: (args: A) => Promise<unknown>
  toast: ToastFn
  undoMs?: number
}
/** Wrap remove + restore reducers into a single action that fires remove and shows a sonner Undo banner. */
const useSoftDelete = <A extends { id: string }>(options: SoftDeleteOpts<A>) =>
  useSharedSoftDelete({ ...options, undoMs: options.undoMs ?? UNDO_MS })
export type { SoftDeleteOpts, ToastFn }
export { useSoftDelete }
