/* eslint-disable @typescript-eslint/naming-convention */
import type { CustomBuilder } from 'convex-helpers/server/zod4'
import type {
  ActionBuilder,
  FunctionVisibility,
  GenericDataModel,
  MutationBuilder,
  PaginationOptions,
  paginationOptsValidator,
  QueryBuilder,
  RegisteredAction,
  RegisteredMutation,
  RegisteredQuery
} from 'convex/server'
import type { GenericId } from 'convex/values'
import type { z as _, ZodNullable, ZodNumber, ZodObject, ZodOptional, ZodRawShape } from 'zod/v4'
import type { BuiltinErrorCode } from '../../shared/error-messages'
import type {
  AuthorInfo,
  ComparisonOp,
  PaginatedResult,
  RateLimitConfig,
  RateLimitInput,
  SearchLike,
  StorageLike
} from '../../shared/server/types'
import type { OrgRole, Rec } from '../../shared/types'
import { ERROR_MESSAGES } from '../../shared/error-messages'
type Ab<V extends FunctionVisibility = 'public'> = CustomBuilder<
  'action',
  Record<string, never>,
  Rec,
  Record<string, never>,
  unknown,
  V,
  Rec
>
interface ActionCtxLike {
  runMutation: (ref: string, args: Rec) => Promise<unknown>
  runQuery: (ref: string, args: Rec) => Promise<unknown>
}
interface BaseBuilders {
  m: Mb
  pq?: Qb
  q: Qb
}
interface CacheBuilders<DM extends GenericDataModel = GenericDataModel> {
  action: ActionBuilder<DM, 'public'>
  cm: Mb
  cq: Qb
  internalMutation: MutationBuilder<DM, 'internal'>
  internalQuery: QueryBuilder<DM, 'internal'>
  mutation: MutationBuilder<DM, 'public'>
  query: QueryBuilder<DM, 'public'>
}
interface CacheCrudResult<S extends ZodRawShape> {
  all: RegisteredQuery<'public', Rec, DocBase<S>[]>
  checkRL?: RegisteredMutation<'internal', Rec, void>
  create: RegisteredMutation<'public', Rec, string>
  get: RegisteredQuery<'public', Rec, (DocBase<S> & { cacheHit: true; stale: boolean }) | null>
  getInternal: RegisteredQuery<'internal', Rec, DocBase<S> | null>
  invalidate: RegisteredMutation<'public', Rec, DocBase<S> | null>
  list: RegisteredQuery<'public', Rec, PaginatedResult<DocBase<S>>>
  load: RegisteredAction<'public', Rec, _.output<ZodObject<S>> & { cacheHit: boolean }>
  purge: RegisteredMutation<'public', Rec, number>
  read: RegisteredQuery<'public', Rec, DocBase<S> | null>
  refresh: RegisteredAction<'public', Rec, _.output<ZodObject<S>> & { cacheHit: boolean }>
  rm: RegisteredMutation<'public', Rec, DocBase<S> | null>
  set: RegisteredMutation<'internal', Rec, void>
  update: RegisteredMutation<'public', Rec, DocBase<S>>
}
/** Reduced ctx passed to `CacheHooks` callbacks — only `db` is available (no auth in cache layer). */
interface CacheHookCtx {
  db: DbLike
}
/** Lifecycle hooks for `makeCacheCrud`. `onFetch` runs on cache misses to transform fetched data before persisting. */
interface CacheHooks {
  afterCreate?: (ctx: CacheHookCtx, args: { data: Rec; id: string }) => Promise<void> | void
  afterDelete?: (ctx: CacheHookCtx, args: { doc: Rec; id: string }) => Promise<void> | void
  afterUpdate?: (ctx: CacheHookCtx, args: { id: string; patch: Rec; prev: Rec }) => Promise<void> | void
  beforeCreate?: (ctx: CacheHookCtx, args: { data: Rec }) => Promise<Rec> | Rec
  beforeDelete?: (ctx: CacheHookCtx, args: { doc: Rec; id: string }) => Promise<void> | void
  beforeUpdate?: (ctx: CacheHookCtx, args: { id: string; patch: Rec; prev: Rec }) => Promise<Rec> | Rec
  onFetch?: (data: Rec) => Promise<Rec> | Rec
}
/** Configuration for `makeCacheCrud`.
 *
 * - `key`: name of the schema field uniquely identifying a row (the cache key).
 * - `fetcher`: action that loads fresh data on cache miss; required to use `load`/`refresh`.
 * - `ttl`: milliseconds before a row is considered stale.
 * - `staleWhileRevalidate`: serve stale rows from `get` while a background refresh runs.
 * - `hooks`: lifecycle callbacks; see `CacheHooks`.
 *
 * @example
 * ```ts
 * makeCacheCrud({ builders, schema: schemas.movie, table: 'movie', options: {
 *   key: 'tmdbId',
 *   fetcher: async (_, id) => fetchMovieFromTmdb(Number(id)),
 *   ttl: 24 * 60 * 60 * 1000,
 *   staleWhileRevalidate: true
 * } })
 * ```
 */
interface CacheOptions<S extends ZodRawShape, K extends keyof _.output<ZodObject<S>> & string> {
  fetcher?: (c: ActionCtxLike, key: _.output<ZodObject<S>>[K]) => Promise<_.output<ZodObject<S>>>
  hooks?: CacheHooks
  key: K
  schema: ZodObject<S>
  staleWhileRevalidate?: boolean
  table: string
  ttl?: number
}
interface CanEditOpts {
  acl: boolean
  doc: {
    editors?: string[]
    userId: string
  }
  role: OrgRole
  userId: string
}
interface CascadeOption<T extends string = string> {
  foreignKey: string
  table: T
}
interface ChildConfig {
  foreignKey: string
  index?: string
  parent: string
  parentSchema?: ZodObject
  schema: ZodObject
}
interface ChildCrudResult<S extends ZodRawShape> {
  create: RegisteredMutation<'public', Rec, string | string[]>
  get: RegisteredQuery<'public', Rec, DocBase<S> | null>
  list: RegisteredQuery<'public', Rec, DocBase<S>[]>
  pub?: {
    get: RegisteredQuery<'public', Rec, DocBase<S> | null>
    list: RegisteredQuery<'public', Rec, DocBase<S>[]>
  }
  rm: RegisteredMutation<'public', Rec, DocBase<S> | number>
  update: RegisteredMutation<'public', Rec, DocBase<S> | DocBase<S>[] | null>
}
interface CrudBuilders extends BaseBuilders {
  cm: Mb
  cq: Qb
  pq: Qb
}
/** Lifecycle hooks for makeCrud / makeChildCrud / makeCacheCrud / makeOrgCrud / makeSingletonCrud.
 *
 * `beforeCreate` and `beforeUpdate` may transform the input — return a `Rec` to use that as the
 * persisted shape. `before*` may also throw `err(...)` to abort the mutation. `after*` runs in the
 * same transaction; throwing rolls back the write.
 *
 * @example
 * ```ts
 * makeCrud({ schema, table: 'todo', options: { hooks: {
 *   beforeCreate: (ctx, { data }) => ({ ...data, ownerId: ctx.userId }),
 *   afterDelete: async (ctx, { id }) => { await ctx.db.delete(id) }
 * } } })
 * ```
 */
interface CrudHooks {
  afterCreate?: (ctx: HookCtx, args: { data: Rec; id: string }) => Promise<void> | void
  afterDelete?: (ctx: HookCtx, args: { doc: Rec; id: string }) => Promise<void> | void
  afterUpdate?: (ctx: HookCtx, args: { id: string; patch: Rec; prev: Rec }) => Promise<void> | void
  beforeCreate?: (ctx: HookCtx, args: { data: Rec }) => Promise<Rec> | Rec
  beforeDelete?: (ctx: HookCtx, args: { doc: Rec; id: string }) => Promise<void> | void
  beforeUpdate?: (ctx: HookCtx, args: { id: string; patch: Rec; prev: Rec }) => Promise<Rec> | Rec
}
/** Configuration for `makeCrud`. All fields optional.
 *
 * - `auth.where`: extra filter applied to authenticated reads (e.g. only show non-archived).
 * - `cascade`: pass an array of `{ table, foreignKey }` (use `ownedCascade` helper) — children deleted with the parent. Set `false` to opt out.
 * - `hooks`: lifecycle callbacks; see `CrudHooks`.
 * - `pub`: opens a public-read API. `true` = all rows; `'fieldName'` = where `fieldName === true`; `{ where }` = custom predicate.
 * - `rateLimit`: per-user create/update/delete cap. Number = max/min, or `{ max, window }`.
 * - `search`: text-search index. `true` uses default `text` field + `search_field` index; pass a field name or `{ field, index }` to override.
 * - `softDelete`: when `true`, `rm` sets `deletedAt`; rows reappear via `restore`.
 *
 * @example
 * ```ts
 * makeCrud({ schema: schemas.todo, table: 'todo', options: {
 *   pub: 'isPublished',
 *   softDelete: true,
 *   rateLimit: { max: 30, window: 60_000 },
 *   search: 'title'
 * } })
 * ```
 */
interface CrudOptions<S extends ZodRawShape> {
  auth?: { where?: WhereOf<S> }
  cascade?: CascadeOption[] | false
  hooks?: CrudHooks
  pub?: boolean | (keyof S & string) | { where?: WhereOf<S> }
  rateLimit?: RateLimitInput
  search?: (keyof S & string) | true | { field?: keyof S & string; index?: string }
  softDelete?: boolean
}
/** The read-side endpoints generated by `makeCrud` (`list`, `read`, optional `search`). */
interface CrudReadApi<S extends ZodRawShape, V extends FunctionVisibility = 'public'> {
  list: RegisteredQuery<V, { paginationOpts: PaginationOptions; where?: WhereOf<S> }, PaginatedResult<EnrichedDoc<S>>>
  read: RegisteredQuery<V, { id: string; own?: boolean; where?: WhereOf<S> }, EnrichedDoc<S> | null>
  search?: RegisteredQuery<V, { query: string; where?: WhereOf<S> }, EnrichedDoc<S>[]>
}
/** Endpoint bundle returned by `makeCrud`. Spread into a Convex module's exports.
 *
 * - `auth` / `pub` — read APIs (CrudReadApi). `pub` only generated when `options.pub` is set.
 * - `authIndexed` / `pubIndexed` — index-keyed read query for hot lookups.
 * - `create`, `update`, `rm`, `restore` — mutations. `restore` only when `softDelete: true`.
 *
 * @example
 * ```ts
 * // convex/todo.ts
 * import { makeCrud } from 'noboil/convex/server'
 * import { schemas } from './schema'
 * export const { auth, pub, authIndexed, create, update, rm } = makeCrud({
 *   builders, schema: schemas.todo, table: 'todo', options: { pub: true }
 * })
 * ```
 */
interface CrudResult<S extends ZodRawShape> {
  auth: CrudReadApi<S>
  authIndexed: RegisteredQuery<
    'public',
    { index: string; key: string; value: string; where?: WhereOf<S> },
    EnrichedDoc<S>[]
  >
  create: RegisteredMutation<'public', _.output<ZodObject<S>> & { items?: _.output<ZodObject<S>>[] }, string | string[]>
  pub: CrudReadApi<S>
  pubIndexed: RegisteredQuery<
    'public',
    { index: string; key: string; value: string; where?: WhereOf<S> },
    EnrichedDoc<S>[]
  >
  restore?: RegisteredMutation<'public', { id: string }, DocBase<S>>
  rm: RegisteredMutation<'public', { id?: string; ids?: string[] }, DocBase<S> | number>
  update: RegisteredMutation<
    'public',
    Partial<_.output<ZodObject<S>>> & {
      expectedUpdatedAt?: number
      id?: string
      items?: (Partial<_.output<ZodObject<S>>> & { expectedUpdatedAt?: number; id: string })[]
    },
    DocBase<S> | DocBase<S>[]
  >
}
interface DbCtx {
  db: DbLike
}
interface DbLike extends DbReadLike {
  delete: (id: string) => Promise<void>
  insert: (table: string, data: Rec) => Promise<string>
  patch: (id: string, data: Rec) => Promise<void>
  system: DbReadLike
}
interface DbReadLike {
  get: (id: string) => Promise<null | Rec>
  query: (table: string) => QueryLike
}
type DocBase<S extends ZodRawShape> = _.output<ZodObject<S>> & {
  _creationTime: number
  _id: string
  updatedAt: number
}
type EnrichedDoc<S extends ZodRawShape> = WithUrls<
  DocBase<S> & {
    author: AuthorInfo | null
    own: boolean | null
    userId: string
  }
>
// oxlint-disable-next-line typescript/ban-types
type ErrorCode = BuiltinErrorCode | (string & {})
type FID = GenericId<'_storage'>
interface FilterLike {
  and: (a: unknown, b: unknown) => unknown
  eq: (a: unknown, b: unknown) => unknown
  field: (name: string) => unknown
  gt: (a: unknown, b: unknown) => unknown
  gte: (a: unknown, b: unknown) => unknown
  lt: (a: unknown, b: unknown) => unknown
  lte: (a: unknown, b: unknown) => unknown
  neq: (a: unknown, b: unknown) => unknown
  or: (a: unknown, b: unknown) => unknown
}
interface GlobalHookCtx {
  db: DbLike
  storage?: StorageLike
  table: string
  userId?: string
}
interface GlobalHooks {
  afterCreate?: (ctx: GlobalHookCtx, args: { data: Rec; id: string }) => Promise<void> | void
  afterDelete?: (ctx: GlobalHookCtx, args: { doc: Rec; id: string }) => Promise<void> | void
  afterUpdate?: (ctx: GlobalHookCtx, args: { id: string; patch: Rec; prev: Rec }) => Promise<void> | void
  beforeCreate?: (ctx: GlobalHookCtx, args: { data: Rec }) => Promise<Rec> | Rec
  beforeDelete?: (ctx: GlobalHookCtx, args: { doc: Rec; id: string }) => Promise<void> | void
  beforeUpdate?: (ctx: GlobalHookCtx, args: { id: string; patch: Rec; prev: Rec }) => Promise<Rec> | Rec
}
interface HookCtx {
  db: DbLike
  storage: StorageLike
  userId: string
}
interface IndexLike {
  eq: (field: string, value: unknown) => IndexLike
  gt: (field: string, value: unknown) => IndexLike
  gte: (field: string, value: unknown) => IndexLike
  lt: (field: string, value: unknown) => IndexLike
  lte: (field: string, value: unknown) => IndexLike
}
type Mb<V extends FunctionVisibility = 'public'> = CustomBuilder<
  'mutation',
  Record<string, never>,
  Rec,
  Record<string, never>,
  unknown,
  V,
  Rec
>
interface Middleware {
  afterCreate?: (ctx: MiddlewareCtx, args: { data: Rec; id: string }) => Promise<void> | void
  afterDelete?: (ctx: MiddlewareCtx, args: { doc: Rec; id: string }) => Promise<void> | void
  afterUpdate?: (ctx: MiddlewareCtx, args: { id: string; patch: Rec; prev: Rec }) => Promise<void> | void
  beforeCreate?: (ctx: MiddlewareCtx, args: { data: Rec }) => Promise<Rec> | Rec
  beforeDelete?: (ctx: MiddlewareCtx, args: { doc: Rec; id: string }) => Promise<void> | void
  beforeUpdate?: (ctx: MiddlewareCtx, args: { id: string; patch: Rec; prev: Rec }) => Promise<Rec> | Rec
  name: string
}
interface MiddlewareCtx extends GlobalHookCtx {
  operation: 'create' | 'delete' | 'update'
}
interface MutationCtxLike {
  auth: { getUserIdentity: () => Promise<unknown> }
  db: DbLike
  storage: StorageLike
}
interface MutCtx extends UserCtx {
  storage: StorageLike
}
type OrgCascadeTableConfig<DM extends GenericDataModel = GenericDataModel> =
  | (keyof DM & string)
  | { fileFields?: string[]; table: keyof DM & string }
/** Endpoint bundle returned by `makeOrgCrud`. Spread into a Convex module's exports.
 *
 * Includes per-row ACL helpers (`addEditor`, `removeEditor`, `setEditors`, `editors`) on top of standard CRUD.
 * Membership and role gating happen automatically; callers are denied with `NOT_ORG_MEMBER` /
 * `INSUFFICIENT_ORG_ROLE` if they lack access.
 *
 * @example
 * ```ts
 * // convex/project.ts
 * import { makeOrgCrud } from 'noboil/convex/server'
 * import { schemas } from './schema'
 * export const { create, list, read, update, rm, addEditor, removeEditor, editors } = makeOrgCrud({
 *   builders, schema: schemas.project, table: 'project', options: { acl: true, softDelete: true }
 * })
 * ```
 */
interface OrgCrudResult<S extends ZodRawShape> {
  addEditor: RegisteredMutation<'public', Rec, DocBase<S> | null>
  create: RegisteredMutation<'public', Rec, string | string[]>
  editors: RegisteredQuery<'public', Rec, { email: string; name: string; userId: string }[]>
  list: RegisteredQuery<'public', Rec, PaginatedResult<OrgEnrichedDoc<S>>>
  read: RegisteredQuery<'public', Rec, OrgEnrichedDoc<S>>
  removeEditor: RegisteredMutation<'public', Rec, DocBase<S> | null>
  restore?: RegisteredMutation<'public', Rec, DocBase<S>>
  rm: RegisteredMutation<'public', Rec, DocBase<S> | number>
  setEditors: RegisteredMutation<'public', Rec, DocBase<S> | null>
  update: RegisteredMutation<'public', Rec, DocBase<S> | DocBase<S>[] | null>
}
type OrgEnrichedDoc<S extends ZodRawShape> = WithUrls<
  DocBase<S> & {
    author: AuthorInfo | null
    orgId: string
    own: boolean | null
    userId: string
  }
>
type PaginationOptsShape = Record<keyof typeof paginationOptsValidator.fields, ZodNullable | ZodNumber | ZodOptional>
type Qb<V extends FunctionVisibility = 'public'> = CustomBuilder<
  'query',
  Record<string, never>,
  Rec,
  Record<string, never>,
  unknown,
  V,
  Rec
>
interface QueryCtxLike {
  auth: { getUserIdentity: () => Promise<unknown> }
  db: DbLike
  storage: StorageLike
}
interface QueryLike {
  collect: () => Promise<Rec[]>
  filter: (fn: (fb: FilterLike) => unknown) => QueryLike
  first: () => Promise<null | Rec>
  order: (dir: 'asc' | 'desc') => QueryLike
  paginate: (opts: Rec) => Promise<{ continueCursor: string; isDone: boolean; page: Rec[] }>
  take: (n: number) => Promise<Rec[]>
  unique: () => Promise<null | Rec>
  withIndex: (name: string, fn?: (ib: IndexLike) => unknown) => QueryLike
  withSearchIndex: (name: string, fn: (sb: SearchLike) => unknown) => QueryLike
}
interface ReadCtx {
  db: DbLike
  storage: StorageLike
  viewerId: null | string
  withAuthor: <T extends { userId: string }>(
    docs: T[]
  ) => Promise<
    (T & {
      author: null | Rec
      own: boolean | null
    })[]
  >
}
interface SetupConfig<DM extends GenericDataModel = GenericDataModel> {
  action: ActionBuilder<DM, 'public'>
  getAuthUserId: (ctx: never) => Promise<null | string>
  hooks?: GlobalHooks
  internalMutation: MutationBuilder<DM, 'internal'>
  internalQuery: QueryBuilder<DM, 'internal'>
  middleware?: Middleware[]
  mutation: MutationBuilder<DM, 'public'>
  orgCascadeTables?: OrgCascadeTableConfig<DM>[]
  orgSchema?: ZodObject
  query: QueryBuilder<DM, 'public'>
  strictFilter?: boolean
}
type UrlKey<K, V> =
  NonNullable<V> extends FID | FID[] | readonly FID[] ? `${K & string}Url${NonNullable<V> extends FID ? '' : 's'}` : never
type UrlVal<V> =
  NonNullable<V> extends FID | FID[] | readonly FID[]
    ? NonNullable<V> extends FID
      ? null | string
      : (null | string)[]
    : never
interface UserCtx extends DbCtx {
  user: Rec
}
type WhereFieldValue<V> = ComparisonOp<V> | V
type WhereGroupOf<S extends ZodRawShape> = {
  [K in keyof _.output<ZodObject<S>>]?: WhereFieldValue<_.output<ZodObject<S>>[K]>
} & {
  own?: boolean
}
type WhereOf<S extends ZodRawShape> = WhereGroupOf<S> & {
  or?: WhereGroupOf<S>[]
}
type WithUrls<D> = D & { [K in keyof D as UrlKey<K, D[K]>]: UrlVal<D[K]> }
declare const __brand: unique symbol
/** Validates a schema has the expected brand, returning the schema type on success or an error message type on failure. */
type AssertSchema<T, Expected extends keyof BrandLabelMap> =
  DetectBrand<T> extends Expected ? T : SchemaTypeError<Expected, DetectBrand<T> & keyof BrandLabelMap>
type BaseSchema<T extends ZodRawShape> = SchemaBrand<'base'> & ZodObject<T>
/** Readable brand name for error messages. */
interface BrandLabelMap {
  base: 'BaseSchema (from makeBase())'
  kv: 'KvSchema (from makeKv())'
  log: 'LogSchema (from makeLog())'
  org: 'OrgSchema (from makeOrgScoped())'
  orgDef: 'OrgDefSchema (from makeOrg())'
  owned: 'OwnedSchema (from makeOwned())'
  quota: 'QuotaSchema (from makeQuota())'
  singleton: 'SingletonSchema (from makeSingleton())'
  unbranded: 'plain ZodObject (not branded)'
}
/** Detects the brand key from a schema type, returning 'unbranded' for plain ZodObject. */
type DetectBrand<T> = T extends SchemaBrand<infer K> ? K : 'unbranded'
type KvDoc<S extends ZodRawShape> = DocBase<S> & { key: string; updatedAt: number }
interface KvEntry {
  keys?: readonly string[]
  schema: ZodObject
  writeRole?: ((ctx: unknown) => boolean | Promise<boolean>) | boolean
}
/** Endpoint bundle returned by `makeKv`. One row per `key` (string). Use for site config, feature flags, banner text.
 *
 * @example
 * ```ts
 * // convex/siteConfig.ts
 * import { makeKv } from 'noboil/convex/server'
 * import { schemas } from './schema'
 * export const { get, list, set, rm, restore } = makeKv({
 *   builders, schema: schemas.siteConfig.banner, table: 'siteConfig',
 *   keys: ['banner', 'maintenanceMode'] as const, softDelete: true
 * })
 * ```
 */
interface KvFactoryResult<S extends ZodRawShape> {
  get: RegisteredQuery<'public', Rec, KvDoc<S> | null>
  list: RegisteredQuery<'public', Rec, KvDoc<S>[]>
  restore?: RegisteredMutation<'public', Rec, { restored: boolean }>
  rm: RegisteredMutation<'public', Rec, { deleted: boolean }>
  set: RegisteredMutation<'public', Rec, KvDoc<S>>
}
/** Schema branded for use with kv(). Used for string-keyed global state. */
type KvSchema<T extends ZodRawShape> = SchemaBrand<'kv'> & ZodObject<T>
type LogDoc<S extends ZodRawShape> = DocBase<S> & { idempotencyKey?: string; parent: string; seq: number }
/** Config for a log entry — schema + parent table reference. */
interface LogEntry {
  parent: string
  schema: ZodObject
}
/** Endpoint bundle returned by `makeLog`. Append-only log keyed by `parent` (e.g. messages per chat, votes per poll, events per session).
 *
 * Includes `append`, `listAfter` (pagination by `seq`), `purgeByParent` (mass delete), and optionally
 * `restoreByParent` (when `softDelete: true`). Pair with `logTable` schema.
 *
 * @example
 * ```ts
 * // convex/message.ts
 * export const { append, list, listAfter, purgeByParent } = makeLog({
 *   builders, schema: schemas.message, table: 'message',
 *   options: { rateLimit: 30, search: 'text' }
 * })
 * ```
 */
interface LogFactoryResult<S extends ZodRawShape> {
  append: RegisteredMutation<'public', Rec, { created: boolean; seq: number }>
  auth: {
    list: RegisteredQuery<'public', Rec, { continueCursor: string; isDone: boolean; page: LogDoc<S>[] }>
    read: RegisteredQuery<'public', Rec, LogDoc<S> | null>
    search?: RegisteredQuery<'public', Rec, LogDoc<S>[]>
  }
  authIndexed: RegisteredQuery<'public', Rec, LogDoc<S>[]>
  list: RegisteredQuery<'public', Rec, { continueCursor: string; isDone: boolean; page: LogDoc<S>[] }>
  listAfter: RegisteredQuery<'public', Rec, LogDoc<S>[]>
  pub?: {
    list: RegisteredQuery<'public', Rec, { continueCursor: string; isDone: boolean; page: LogDoc<S>[] }>
    read: RegisteredQuery<'public', Rec, LogDoc<S> | null>
    search?: RegisteredQuery<'public', Rec, LogDoc<S>[]>
  }
  pubIndexed?: RegisteredQuery<'public', Rec, LogDoc<S>[]>
  purgeByParent: RegisteredMutation<'public', Rec, { deleted: number }>
  read: RegisteredQuery<'public', Rec, LogDoc<S> | null>
  restoreByParent?: RegisteredMutation<'public', Rec, { restored: number }>
  rm: RegisteredMutation<'public', Rec, { deleted: boolean }>
  search?: RegisteredQuery<'public', Rec, LogDoc<S>[]>
  update: RegisteredMutation<'public', Rec, LogDoc<S>>
}
/** Schema branded for use with log(). Used for append-only event logs. */
type LogSchema<T extends ZodRawShape> = SchemaBrand<'log'> & ZodObject<T>
type OrgDefSchema<T extends ZodRawShape> = SchemaBrand<'orgDef'> & ZodObject<T>
type OrgSchema<T extends ZodRawShape> = SchemaBrand<'org'> & ZodObject<T>
/** Minimal user shape used across org operations, containing id, name, email, and image. */
interface OrgUserLike {
  [k: string]: unknown
  _id: GenericId<'users'>
  email?: string
  image?: string
  name?: string
}
type OwnedSchema<T extends ZodRawShape> = SchemaBrand<'owned'> & ZodObject<T>
interface QuotaEntry {
  durationMs: number
  limit: number
}
/** Endpoint bundle returned by `makeQuota`. Sliding-window rate limit keyed by owner.
 *
 * `consume` atomically checks + records (throws when over limit). `record` always succeeds (telemetry).
 * `check` is read-only.
 *
 * @example
 * ```ts
 * // convex/pollVoteQuota.ts
 * export const { check, consume, record } = makeQuota({
 *   builders, schema: schemas.pollVoteQuota, table: 'pollVoteQuota',
 *   options: { durationMs: 60_000, limit: 10 }
 * })
 * ```
 */
interface QuotaFactoryResult {
  check: RegisteredQuery<'public', Rec, QuotaResult>
  consume: RegisteredMutation<'public', Rec, QuotaResult>
  record: RegisteredMutation<'public', Rec, QuotaResult>
}
/** Per-call quota outcome. `allowed=false` indicates the request was rejected; `retryAfter` is ms until next slot. */
interface QuotaResult {
  allowed: boolean
  remaining: number
  retryAfter?: number
}
/** Schema branded for use with quota(). Used for sliding-window rate limits. */
type QuotaSchema<T extends ZodRawShape> = SchemaBrand<'quota'> & ZodObject<T>
interface SchemaBrand<K extends string> {
  readonly [__brand]: K
  readonly __hint: SchemaHint<K>
}
type SchemaHint<K extends string> = K extends keyof SchemaHintMap ? SchemaHintMap[K] : string
interface SchemaHintMap {
  base: 'Created by makeBase() → use cacheCrud() + baseTable()'
  kv: 'Created by makeKv() → use kv() + kvTable()'
  log: 'Created by makeLog() → use log() + logTable()'
  org: 'Created by makeOrgScoped() → use orgCrud() + orgTable()'
  orgDef: 'Created by makeOrg() → pass to setup({ orgSchema })'
  owned: 'Created by makeOwned() → use crud() + ownedTable()'
  quota: 'Created by makeQuota() → use quota() + quotaTable()'
  singleton: 'Created by makeSingleton() → use singletonCrud() + singletonTable()'
}
/** Produces a descriptive compile-time error message when the wrong schema brand is passed. */
type SchemaTypeError<
  Expected extends keyof BrandLabelMap,
  Got extends keyof BrandLabelMap
> = `Schema mismatch: expected ${BrandLabelMap[Expected]}, got ${BrandLabelMap[Got]}. ${Expected extends keyof SchemaHintMap ? SchemaHintMap[Expected] : ''}`
interface SingletonCrudResult<S extends ZodRawShape> {
  get: RegisteredQuery<'public', Rec, null | SingletonDoc<S>>
  upsert: RegisteredMutation<'public', Rec, SingletonDoc<S>>
}
type SingletonDoc<S extends ZodRawShape> = WithUrls<DocBase<S> & { userId: string }>
interface SingletonOptions {
  rateLimit?: RateLimitInput
}
type SingletonSchema<T extends ZodRawShape> = SchemaBrand<'singleton'> & ZodObject<T>
export type {
  /** Action builder type for public visibility. */
  Ab,
  /** Context object for action functions with query and mutation execution. */
  ActionCtxLike,
  /** Validates a schema has the expected brand, producing a descriptive error on mismatch. */
  AssertSchema,
  /** Author information containing user metadata like name, email, and image. */
  AuthorInfo,
  /** Base builders for query and mutation functions. */
  BaseBuilders,
  /** Schema branded as base type for cache CRUD operations. */
  BaseSchema,
  /** Readable brand labels for error messages. */
  BrandLabelMap,
  /** Built-in error codes only (no custom codes). */
  BuiltinErrorCode,
  /** Builders for cache CRUD operations. */
  CacheBuilders,
  /** Result type for cache CRUD factory with all generated endpoints. */
  CacheCrudResult,
  /** Context for cache hooks with database access. */
  CacheHookCtx,
  /** Lifecycle hooks for cache CRUD operations. */
  CacheHooks,
  /** Configuration options for cache CRUD factory. */
  CacheOptions,
  /** Options for checking if a user can edit a document with ACL. */
  CanEditOpts,
  /** Configuration for cascade delete on related tables. */
  CascadeOption,
  /** Configuration for child table relationships. */
  ChildConfig,
  /** Result type for child CRUD factory with all generated endpoints. */
  ChildCrudResult,
  /** Comparison operators for where clause filtering. */
  ComparisonOp,
  /** Builders for CRUD operations with pagination. */
  CrudBuilders,
  /** Lifecycle hooks for CRUD operations. */
  CrudHooks,
  /** Configuration options for CRUD factory. */
  CrudOptions,
  /** Read API for CRUD with list, read, and optional search endpoints. */
  CrudReadApi,
  /** Result type for CRUD factory with all generated endpoints. */
  CrudResult,
  /** Context with database access. */
  DbCtx,
  /** Database interface with read/write operations. */
  DbLike,
  /** Read-only database interface. */
  DbReadLike,
  /** Detects the brand key ('owned' | 'org' | 'base' | 'singleton' | 'unbranded') from a schema type. */
  DetectBrand,
  /** Base document type with id, creation time, and update timestamp. */
  DocBase,
  /** Document enriched with author info, ownership flag, and file URLs. */
  EnrichedDoc,
  /** Union type of all error codes (built-in + custom strings). */
  ErrorCode,
  /** File ID type for storage references. */
  FID,
  /** Filter builder interface for query construction. */
  FilterLike,
  /** Context for global hooks with database and storage access. */
  GlobalHookCtx,
  /** Global lifecycle hooks applied to all CRUD operations. */
  GlobalHooks,
  /** Context for CRUD hooks with database, storage, and user info. */
  HookCtx,
  /** Index builder interface for query optimization. */
  IndexLike,
  /** KV entry config for schema DSL. */
  KvEntry,
  /** Generated endpoints for kv factory. */
  KvFactoryResult,
  /** Schema branded as kv type for string-keyed state via kv(). */
  KvSchema,
  /** Log entry config for schema DSL. */
  LogEntry,
  /** Generated endpoints for log factory. */
  LogFactoryResult,
  /** Schema branded as append-only log for use with log(). */
  LogSchema,
  /** Mutation builder type for public visibility. */
  Mb,
  /** Middleware for intercepting CRUD operations. */
  Middleware,
  /** Context for middleware with operation type. */
  MiddlewareCtx,
  /** Context for mutation functions with auth and storage. */
  MutationCtxLike,
  /** Mutation context with user info and storage. */
  MutCtx,
  /** Configuration for org cascade delete tables. */
  OrgCascadeTableConfig,
  /** Result type for org CRUD factory with all generated endpoints. */
  OrgCrudResult,
  /** Schema branded as the org definition (passed to setup({ orgSchema })). */
  OrgDefSchema,
  /** Org-scoped document enriched with author info and org ID. */
  OrgEnrichedDoc,
  /** Organization role type: admin, member, or owner. */
  OrgRole,
  /** Schema branded as org type for org CRUD operations. */
  OrgSchema,
  /** Minimal user shape for org operations. */
  OrgUserLike,
  /** Schema branded as owned type for user-owned CRUD operations. */
  OwnedSchema,
  /** Paginated result with page data and cursor for next page. */
  PaginatedResult,
  /** Shape of pagination options validator. */
  PaginationOptsShape,
  /** Query builder type for public visibility. */
  Qb,
  /** Context for query functions with auth and storage. */
  QueryCtxLike,
  /** Query builder interface for database queries. */
  QueryLike,
  /** Quota entry config for schema DSL. */
  QuotaEntry,
  /** Generated endpoints for quota factory. */
  QuotaFactoryResult,
  /** Result shape returned by quota check/record/consume. */
  QuotaResult,
  /** Schema branded as quota type for sliding-window rate limits. */
  QuotaSchema,
  /** Configuration for sliding window rate limiting. */
  RateLimitConfig,
  RateLimitInput,
  /** Context for read operations with author enrichment. */
  ReadCtx,
  /** Generic record type for flexible data structures. */
  Rec,
  /** Schema brand marker for type safety. */
  SchemaBrand,
  /** Search builder interface for full-text search. */
  /** Produces a descriptive compile-time error message for schema brand mismatches. */
  SchemaTypeError,
  SearchLike,
  /** Configuration for setup function with builders and hooks. */
  SetupConfig,
  /** Result type for singleton CRUD factory. */
  SingletonCrudResult,
  /** Singleton document with user ID and file URLs. */
  SingletonDoc,
  /** Configuration options for singleton CRUD factory. */
  SingletonOptions,
  /** Schema branded as singleton type for per-user data. */
  SingletonSchema,
  /** Storage interface for file operations. */
  StorageLike,
  /** User context with database and user info. */
  UserCtx,
  /** Where clause group for filtering with optional OR. */
  WhereGroupOf,
  /** Where clause for filtering with comparison operators. */
  WhereOf,
  /** Document with file URL properties added. */
  WithUrls
}
/** Map of error codes to human-readable error messages. */
export { ERROR_MESSAGES }
