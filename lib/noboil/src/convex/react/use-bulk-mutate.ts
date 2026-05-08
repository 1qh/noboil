'use client'
import {
  collectSettled,
  resolveBulkError as resolveSharedBulkError,
  useBulkMutate as useSharedBulkMutate
} from '../../shared/react/use-bulk-mutate'
import { BULK_MAX } from '../constants'
import { defaultOnError } from './use-mutate'
/** Toast strings or message-builders shown during a bulk mutation. */
interface BulkMutateToast {
  error?: ((error: unknown) => string) | string
  loading?: ((progress: BulkProgress) => string) | string
  success?: ((count: number) => string) | string
}
/** Live progress payload emitted by `onProgress` during a bulk run. */
interface BulkProgress {
  failed: number
  pending: number
  succeeded: number
  total: number
}
/** Final aggregated outcome of a bulk run — successes + failures preserved for inspection. */
interface BulkResult<R> {
  errors: unknown[]
  results: R[]
  settled: PromiseSettledResult<R>[]
}
/** Options for `useBulkMutate`. Wraps a single mutation to apply over an array of args, with progress, batching, and toast. */
interface UseBulkMutateOptions {
  onError?: ((error: unknown) => void) | false
  onProgress?: (progress: BulkProgress) => void
  onSettled?: (result: BulkResult<unknown>) => void
  onSuccess?: (count: number) => void
  toast?: BulkMutateToast
}
const resolveBulkError = (opts?: UseBulkMutateOptions): ((error: unknown) => void) | undefined =>
  resolveSharedBulkError(opts, defaultOnError)
/**
 * Run a mutation across many rows with chunking, progress, and toast feedback.
 * Splits the input into `BULK_MAX`-sized chunks, fires them sequentially, surfaces
 * combined errors, and (by default) shows a sonner toast on each phase.
 * @returns Wrapped mutate fn + status object suitable for binding to a button.
 */
const useBulkMutate = <A, R = void>(mutate: (args: A) => Promise<R>, options?: UseBulkMutateOptions) =>
  useSharedBulkMutate({
    bulkMax: BULK_MAX,
    defaultOnError,
    mutate,
    options,
    packageName: 'noboil/convex'
  })
export type { BulkMutateToast, BulkProgress, BulkResult, UseBulkMutateOptions }
export { collectSettled, resolveBulkError, useBulkMutate }
