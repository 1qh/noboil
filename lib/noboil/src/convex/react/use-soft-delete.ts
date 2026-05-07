/* oxlint-disable promise/prefer-await-to-then */
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
/**
 * Wrap a `remove` + `restore` pair into a single action that fires the remove and shows
 * a sonner toast with an Undo button (configurable `undoMs`). Use for delete UIs where
 * you want Gmail-style "Undo" instead of a confirmation dialog.
 */
const useSoftDelete = <A extends { id: string }>(options: SoftDeleteOpts<A>) =>
  useSharedSoftDelete({ ...options, undoMs: options.undoMs ?? UNDO_MS })
export type { SoftDeleteOpts, ToastFn }
export { useSoftDelete }
