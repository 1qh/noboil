/** biome-ignore-all lint/performance/noAwaitInLoops: sequential delete-by-creation-time */
/* eslint-disable no-await-in-loop */
/* oxlint-disable no-await-in-loop, unicorn/prefer-ternary, max-params, unicorn/useAwait */
/* eslint-disable @typescript-eslint/max-params */
/** biome-ignore-all lint/suspicious/useAwait: handlers return thenable chains */
/** biome-ignore-all lint/complexity/useMaxParams: internal helper */
import { boolean, optional, string } from 'zod/v4'
import type { DbCtx, DbLike, HookCtx, Mb, MutCtx, Qb } from './types'
import { idx, typed } from './bridge'
import { dbInsert, hk } from './helpers'
const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000
const PRUNE_BATCH = 5000
const LIST_DEFAULT_LIMIT = 100
const LIST_MAX_LIMIT = 1000
/** Input row for `append` mutation. `actor` is typically `userId` or service name; `traceId` correlates events from one request. */
interface AuditAppendInput {
  action: string
  actor: string
  args?: string
  mode?: string
  ok: boolean
  traceId?: string
}
/** Endpoint bundle returned by `makeAudit`. Spread into a Convex module's exports.
 *
 * Append-only audit log with TTL-based pruning. Read APIs scope by actor or trace.
 *
 * @example
 * ```ts
 * // convex/audit.ts
 * export const { append, recent, listByActor, listByTrace, pruneStale } = makeAudit({
 *   builders, table: 'audit', options: { ttlMs: 30 * 24 * 60 * 60 * 1000 }
 * })
 * ```
 */
interface AuditExports {
  append: ReturnType<Mb>
  listByActor: ReturnType<Qb>
  listByTrace: ReturnType<Qb>
  pruneStale: ReturnType<Mb>
  recent: ReturnType<Qb>
}
/** Lifecycle hooks for `makeAudit`. `afterPrune` reports how many rows expired in the last sweep. */
interface AuditHooks {
  afterAppend?: (ctx: HookCtx, args: { row: AuditAppendInput }) => Promise<void> | void
  afterPrune?: (ctx: HookCtx, args: { deleted: number }) => Promise<void> | void
  beforeAppend?: (ctx: HookCtx, args: { row: AuditAppendInput }) => Promise<void> | void
}
/** Persisted audit row shape. */
interface AuditRow {
  _creationTime: number
  _id: string
  action: string
  actor: string
  args?: string
  mode?: string
  ok: boolean
  traceId?: string
}
const queryRecent = async (db: DbLike, table: string, limit: number): Promise<AuditRow[]> =>
  (await db.query(table).order('desc').take(limit)) as unknown as AuditRow[]
const queryByActor = async (db: DbLike, table: string, actor: string, limit: number): Promise<AuditRow[]> =>
  (await db
    .query(table)
    .withIndex(
      'by_actor',
      idx(o => o.eq('actor', actor))
    )
    .order('desc')
    .take(limit)) as unknown as AuditRow[]
const queryByTrace = async (db: DbLike, table: string, traceId: string, limit: number): Promise<AuditRow[]> =>
  (await db
    .query(table)
    .withIndex(
      'by_trace',
      idx(o => o.eq('traceId', traceId))
    )
    .order('asc')
    .take(limit)) as unknown as AuditRow[]
const clampLimit = (n: number | undefined): number => {
  if (n === undefined) return LIST_DEFAULT_LIMIT
  return Math.max(1, Math.min(LIST_MAX_LIMIT, Math.floor(n)))
}
/**
 * Build an append-only audit-log slice with `append`, `recent`, `listByActor`, `listByTrace`,
 * and `pruneStale` endpoints. Rows include `actor`, `action`, `target`, `traceId`, `meta`, `ts`.
 * Pair with `auditTable` in your schema. Use for compliance, debugging, and incident review.
 * Mutations are pure inserts — no row update, no soft-delete.
 * @returns Endpoint object: `{ append, recent, listByActor, listByTrace, pruneStale }`
 */
const makeAudit = ({
  builders: b,
  hooks,
  table,
  ttlMs = DEFAULT_TTL_MS
}: {
  builders: { m: Mb; q: Qb }
  hooks?: AuditHooks
  table: string
  ttlMs?: number
}): AuditExports => {
  const append = b.m({
    args: typed({
      action: string(),
      actor: string(),
      args: optional(string()),
      mode: optional(string()),
      ok: boolean(),
      traceId: optional(string())
    }),
    handler: typed(async (c: MutCtx, row: AuditAppendInput): Promise<void> => {
      if (hooks?.beforeAppend) await hooks.beforeAppend(hk(c), { row })
      await dbInsert(c.db, table, row as unknown as Record<string, unknown>)
      if (hooks?.afterAppend) await hooks.afterAppend(hk(c), { row })
    })
  })
  const recent = b.q({
    args: typed({ limit: optional(string()) }),
    handler: typed(async (c: DbCtx, args: { limit?: string }): Promise<AuditRow[]> => {
      const lim = clampLimit(args.limit ? Number(args.limit) : undefined)
      return queryRecent(c.db, table, lim)
    })
  })
  const listByActor = b.q({
    args: typed({ actor: string(), limit: optional(string()) }),
    handler: typed(async (c: DbCtx, args: { actor: string; limit?: string }): Promise<AuditRow[]> => {
      const lim = clampLimit(args.limit ? Number(args.limit) : undefined)
      return queryByActor(c.db, table, args.actor, lim)
    })
  })
  const listByTrace = b.q({
    args: typed({ limit: optional(string()), traceId: string() }),
    handler: typed(async (c: DbCtx, args: { limit?: string; traceId: string }): Promise<AuditRow[]> => {
      const lim = clampLimit(args.limit ? Number(args.limit) : undefined)
      return queryByTrace(c.db, table, args.traceId, lim)
    })
  })
  const pruneStale = b.m({
    args: typed({}),
    handler: typed(async (c: MutCtx): Promise<{ deleted: number }> => {
      const cutoff = Date.now() - ttlMs
      const old = (await c.db.query(table).order('asc').take(PRUNE_BATCH)) as unknown as AuditRow[]
      let deleted = 0
      for (const row of old) {
        if (row._creationTime >= cutoff) break
        await c.db.delete(row._id)
        deleted += 1
      }
      if (hooks?.afterPrune) await hooks.afterPrune(hk(c), { deleted })
      return { deleted }
    })
  })
  return typed({ append, listByActor, listByTrace, pruneStale, recent })
}
export type { AuditAppendInput, AuditExports, AuditHooks, AuditRow }
export { makeAudit }
