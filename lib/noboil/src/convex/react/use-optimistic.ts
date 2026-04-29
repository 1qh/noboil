'use client'
import type { FunctionReference, FunctionReturnType, OptionalRestArgs } from 'convex/server'
import { useMutation } from 'convex/react'
import { useOptimisticMutation as useOptimisticMutationBase } from '../../shared/react/use-optimistic'
type Args<T extends MutationFn> = OptionalRestArgs<T>[0]
type MutationFn = FunctionReference<'mutation'>
interface OptimisticOptions<T extends MutationFn, R = FunctionReturnType<T>> {
  mutation: T
  onOptimistic?: (args: Args<T>) => void
  onRollback?: (args: Args<T>, catchError: Error) => void
  onSettled?: (args: Args<T>, error: unknown, result?: R) => void
  onSuccess?: (result: R, args: Args<T>) => void
}
/**
 * Wrap a Convex mutation with sync feedback hooks (`onSuccess` / `onError` / `onSettled`)
 * and a stable `mutate` reference. Use for non-CRUD mutations or when you want a single
 * place to centralize toast / analytics side-effects. For optimistic local cache updates,
 * pass an `update` function via the underlying Convex `useMutation` instead.
 */
const useOptimisticMutation = <T extends MutationFn>({
  mutation,
  onOptimistic,
  onRollback,
  onSettled,
  onSuccess
}: OptimisticOptions<T>) => {
  const mutate = useMutation(mutation)
  return useOptimisticMutationBase<Args<T>>({
    mutate,
    onOptimistic,
    onRollback,
    onSettled,
    onSuccess
  })
}
export type { OptimisticOptions }
export { useOptimisticMutation }
