'use client'
import type { FunctionReference, FunctionReturnType } from 'convex/server'
import { useMutation, useQuery } from 'convex/react'
interface ConvexSingletonRefs {
  get: FunctionReference<'query'>
  upsert: FunctionReference<'mutation'>
}
type SingletonDoc<R extends ConvexSingletonRefs> = FunctionReturnType<R['get']>
interface SingletonHookResult<T> {
  data: null | T | undefined
  upsert: (payload: T) => Promise<void>
}
/**
 * Bind a `makeSingletonCrud` slice (one row per user — profile, prefs, etc.).
 * Returns `{ data, isLoading, upsert, remove, restore }`. Auto-creates on first upsert.
 */
const useSingleton = <R extends ConvexSingletonRefs>(refs: R): SingletonHookResult<SingletonDoc<R>> => {
  const data = useQuery(refs.get, {}) as SingletonDoc<R> | undefined
  const upsertMut = useMutation(refs.upsert)
  return {
    data,
    upsert: async (payload: SingletonDoc<R>) => {
      await upsertMut(payload)
    }
  }
}
export type { ConvexSingletonRefs, SingletonHookResult }
export { useSingleton }
