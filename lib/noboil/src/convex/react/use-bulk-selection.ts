'use client'
import type { ToastFn } from './use-soft-delete'
import { useBulkSelection as useSharedBulkSelection } from '../../shared/react/use-bulk-selection'
import { UNDO_MS } from '../constants'
interface UseBulkSelectionOpts {
  items: { _id: string }[]
  onError?: (error: unknown) => void
  onSuccess?: (count: number) => void
  orgId: string
  restore?: (args: { id: string }) => Promise<unknown>
  rm?: (args: { id?: string; ids?: string[]; orgId: string }) => Promise<unknown>
  toast?: ToastFn
  undoLabel?: string
  undoMs?: number
}
/**
 * Track a Set of selected row IDs with toggle/clear/selectAll helpers, plus a
 * built-in undo banner (configurable `undoMs`) for last-bulk-action recovery.
 * Use to wire bulk-select UI on top of `useCrud` / `useList` results.
 * @returns Selection state object + action helpers.
 */
const useBulkSelection = (options: UseBulkSelectionOpts) =>
  useSharedBulkSelection({
    ...options,
    undoMs: options.undoMs ?? UNDO_MS
  })
export type { UseBulkSelectionOpts }
export { useBulkSelection }
