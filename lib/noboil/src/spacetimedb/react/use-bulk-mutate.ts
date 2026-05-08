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
/** Final aggregated outcome of a bulk run — both successes and failures preserved. */
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
 * Run a SpacetimeDB reducer across many rows with chunking, progress, and toast feedback.
 * Splits input into `BULK_MAX`-sized chunks, fires sequentially, surfaces combined errors.
 */
const useBulkMutate = <A, R = void>(mutate: (args: A) => Promise<R>, options?: UseBulkMutateOptions) =>
  useSharedBulkMutate({
    bulkMax: BULK_MAX,
    defaultOnError,
    mutate,
    options,
    packageName: 'noboil/spacetimedb'
  })
export type { BulkMutateToast, BulkProgress, BulkResult, UseBulkMutateOptions }
export { collectSettled, resolveBulkError, useBulkMutate }
