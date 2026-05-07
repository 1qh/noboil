/** biome-ignore-all lint/style/useNamingConvention: SDK exposes snake_case in places */
/** biome-ignore-all lint/correctness/useExhaustiveDependencies: queryKey is the stable hash of queries */
/* eslint-disable @eslint-react/hooks-extra/no-direct-set-state-in-use-effect, react-hooks/exhaustive-deps */
/* oxlint-disable react-hooks/exhaustive-deps */
'use client'
import { useEffect, useRef, useState } from 'react'
import { toSql } from 'spacetimedb'
import { useSpacetimeDB } from 'spacetimedb/react'
type AnyQuery = Parameters<typeof toSql>[0]
type QueryInput = AnyQuery | string
/**
 * Hook that reports when one or more SpacetimeDB subscriptions are fully hydrated
 * — the subscription handshake has been acknowledged AND the initial state batch
 * has been atomically inserted into the client cache.
 *
 * Why this exists: the public `useTable(...)` hook in `spacetimedb/react` returns
 * `[rows, isReady]`, but `isReady` flips through a `useSyncExternalStore` snapshot
 * that suffers from a known stale-closure bug (clockworklabs/SpacetimeDB#3359, #4559,
 * #4577, #4642). The `subscribe` callback captures an earlier `computeSnapshot` and
 * reports `[rows, false]` even after the cache is populated, until a fix shipping in
 * a release after SDK v2.2.0 lands. Layouts that gate render on `useTable.isReady`
 * may flake — most visibly when an "empty rows → redirect" branch fires before the
 * stale read catches up.
 *
 * This hook bypasses the bug by issuing its own `subscriptionBuilder().onApplied(...)`
 * registration. The SDK contract guarantees that when `onApplied` fires the entire
 * initial state has already been atomically inserted into the client cache, so the
 * gate it produces is deterministic regardless of which `useSyncExternalStore` snapshot
 * React happens to read.
 *
 * Subscriptions issued by this hook coexist safely with `useTable`'s subscriptions
 * for the same query — the server deduplicates and the client cache merges results,
 * so wiring this in alongside existing `useTable` reads incurs no extra bandwidth.
 *
 * @param queries One or more queries (table refs, builder expressions, or raw SQL strings).
 * @returns `true` once all listed subscriptions have been applied; resets to `false`
 *          while reconnecting or when the set of queries changes.
 */
const useStdbHydrated = (queries: QueryInput | readonly QueryInput[]): boolean => {
  const connectionState = useSpacetimeDB()
  const [hydrated, setHydrated] = useState(false)
  const list = Array.isArray(queries) ? queries : [queries]
  const sqls = list.map((q: QueryInput) => (typeof q === 'string' ? q : toSql(q)))
  const queryKey = sqls.join('||')
  const appliedRef = useRef(0)
  useEffect(() => {
    setHydrated(false)
    appliedRef.current = 0
    if (!connectionState.isActive) return
    const connection = connectionState.getConnection()
    if (!connection) return
    const total = sqls.length
    const onOne = () => {
      appliedRef.current += 1
      if (appliedRef.current >= total) setHydrated(true)
    }
    const handles: { unsubscribe: () => void }[] = sqls.map(sql =>
      connection.subscriptionBuilder().onApplied(onOne).subscribe(sql)
    )
    return () => {
      for (const h of handles)
        try {
          h.unsubscribe()
        } catch {
          // SDK throws if subscription is already inactive — ignore
        }
    }
  }, [queryKey, connectionState.isActive])
  return hydrated
}
export { useStdbHydrated }
