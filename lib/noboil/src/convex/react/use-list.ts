/** biome-ignore-all lint/nursery/noUnsafeTypeAssertion: narrows loosely-typed runtime/codegen values to the library's typed model at guarded facade boundaries */
'use client'
import type { PaginatedQueryArgs, PaginatedQueryReference } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { usePaginatedQuery } from 'convex/react'
import { useEffect, useMemo, useRef } from 'react'
import type { Rec } from '../../shared/types'
import type { PendingMutation } from './optimistic-store'
import { trackSubscription, untrackSubscription, updateSubscription, updateSubscriptionData } from './devtools'
import { usePendingMutations } from './optimistic-store'

type ListItems<F extends PaginatedQueryReference> = FunctionReturnType<F>['page']
/** Options for `useList`. `optimistic` overlays pending mutations; `pageSize` controls page increments. */
interface UseListOptions {
  optimistic?: boolean
  pageSize?: number
}
const classifyPending = (pending: PendingMutation[]) => {
  const deleteIds = new Set<string>()
  const updates = new Map<string, Rec>()
  const creates: Rec[] = []
  for (const p of pending)
    if (p.type === 'delete') deleteIds.add(p.id)
    else if (p.type === 'update') {
      const prev = updates.get(p.id)
      updates.set(p.id, prev ? { ...prev, ...p.args } : p.args)
    } else
      creates.push({
        ...p.args,
        __optimistic: true,
        _creationTime: p.timestamp,
        _id: p.tempId,
        updatedAt: p.timestamp
      })
  return { creates, deleteIds, updates }
}
/** biome-ignore lint/style/noProcessEnv: intentional env access */
const isDev = typeof process !== 'undefined' && process.env.NODE_ENV !== 'production'
const DEFAULT_PAGE_SIZE = 50
/** Applies pending optimistic creates, updates, and deletes to a list of items. */
const applyOptimistic = <T extends Rec>(items: T[], pending: PendingMutation[]): T[] => {
  if (pending.length === 0) return items
  const { creates, deleteIds, updates } = classifyPending(pending)
  let result = items
  if (deleteIds.size > 0) result = result.filter(i => !deleteIds.has((i as Rec)._id as string))
  if (updates.size > 0)
    result = result.map(i => {
      const patch = updates.get((i as Rec)._id as string)
      return patch ? { ...i, ...patch, _id: (i as Rec)._id } : i
    })
  if (creates.length > 0) result = [...(creates.toReversed() as T[]), ...result]
  return result
}
/**
 * Paginated list hook with optimistic update support and devtools integration.
 * @param query A paginated Convex query reference
 * @example
 * ```tsx
 * const { data, loadMore, isDone } = useList(api.blog.list, { where: { published: true } })
 * ```
 */
const useList = <F extends PaginatedQueryReference>(query: F, args?: PaginatedQueryArgs<F>, options?: UseListOptions) => {
  const queryArgs = (args ?? {}) as PaginatedQueryArgs<F>
  const pageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE
  const isOptimistic = options?.optimistic !== false
  const { loadMore, results, status } = usePaginatedQuery(query, queryArgs, { initialNumItems: pageSize })
  const pending = usePendingMutations()
  const subIdRef = useRef(0)
  const queryRef = useRef(query)
  const queryArgsRef = useRef(queryArgs)
  useEffect(() => {
    if (!isDev) return
    const q = queryRef.current
    const queryName = typeof q === 'string' ? q : ((q as { _name?: string })._name ?? 'unknown')
    subIdRef.current = trackSubscription(queryName, queryArgsRef.current)
    const id = subIdRef.current
    return () => untrackSubscription(id)
  }, [])
  useEffect(() => {
    if (!(isDev && subIdRef.current)) return
    let devStatus: 'loaded' | 'loading'
    if (status === 'LoadingFirstPage') devStatus = 'loading'
    else if (status === 'Exhausted' || status === 'CanLoadMore') devStatus = 'loaded'
    else devStatus = 'loading'
    updateSubscription(subIdRef.current, devStatus)
  }, [status])
  useEffect(() => {
    if (!(isDev && subIdRef.current)) return
    const preview = results.length > 0 ? JSON.stringify(results[0]).slice(0, 200) : ''
    updateSubscriptionData(subIdRef.current, results, preview)
  }, [results])
  const items = useMemo(
    () => (isOptimistic ? applyOptimistic(results as Rec[], pending) : results),
    [isOptimistic, pending, results]
  )
  return {
    data: items,
    hasMore: status === 'CanLoadMore' || status === 'LoadingMore',
    isDone: status === 'Exhausted',
    isLoading: status === 'LoadingFirstPage' || status === 'LoadingMore',
    loadMore: (n?: number) => loadMore(n ?? pageSize),
    status
  }
}
const useOwnRows = <T extends Rec>(
  rows: readonly T[],
  isOwn: ((row: T) => boolean) | null | undefined
): (T & { own: boolean })[] =>
  useMemo(() => {
    const out: (T & { own: boolean })[] = []
    for (const row of rows) out.push({ ...row, own: isOwn ? isOwn(row) : false })
    return out
  }, [rows, isOwn])
export type { ListItems, UseListOptions }
export { applyOptimistic, DEFAULT_PAGE_SIZE, useList, useOwnRows }
