/* eslint-disable @typescript-eslint/naming-convention */
import type { Identity, Timestamp } from 'spacetimedb'
import type { AlgebraicTypeType, ColumnBuilder, ReducerExport, TypeBuilder } from 'spacetimedb/server'
import type { z as _, ZodNullable, ZodNumber, ZodObject, ZodOptional, ZodRawShape } from 'zod/v4'
import type { BuiltinErrorCode } from '../../../shared/error-messages'
import type {
  AuthorInfo,
  ComparisonOp,
  PaginatedResult,
  RateLimitConfig,
  RateLimitInput,
  SearchLike,
  StorageLike
} from '../../../shared/server/types'
import type { OrgRole, Rec } from '../../../shared/types'
import { ERROR_MESSAGES } from '../../../shared/error-messages'
type Ab<V extends Visibility = 'public'> = <A = Rec, R = unknown, C = Rec>(
  ...args: unknown[]
) => C & RegisteredAction<V, A, R>
interface ActionCtxLike extends ReducerCtx<DbLike> {
  runMutation: (ref: string, args: Rec) => Promise<unknown>
  runQuery: (ref: string, args: Rec) => Promise<unknown>
}
interface BaseBuilders {
  m: Mb
  pq?: Qb
  q: Qb
}
interface DbCtx {
  db: DbLike
}
interface DbLike extends DbReadLike {
  delete: (id: number | string) => Promise<void>
  insert: (table: string, data: Rec) => Promise<number | string>
  patch: (id: number | string, data: Rec) => Promise<void>
  system?: DbReadLike
}
interface DbReadLike {
  get: (id: number | string) => Promise<null | Rec>
  query: (table: string) => QueryLike
}
type DocBase<S extends ZodRawShape> = _.output<ZodObject<S>> & {
  _creationTime: number
  _id: number | string
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
type FID = string
type FieldBuilders = Record<string, ColumnBuilder<unknown, AlgebraicTypeType> | TypeBuilder<unknown, AlgebraicTypeType>>
interface FilterLike {
  and: (a: unknown, b: unknown) => unknown
  eq: (a: unknown, b: unknown) => unknown
  field: (name: string) => unknown
  gt: (a: unknown, b: unknown) => unknown
  gte: (a: unknown, b: unknown) => unknown
  lt: (a: unknown, b: unknown) => unknown
  lte: (a: unknown, b: unknown) => unknown
  or: (a: unknown, b: unknown) => unknown
}
interface GlobalHookCtx {
  db: unknown
  sender: Identity
  table: string
  timestamp: Timestamp
}
interface GlobalHooks {
  afterCreate?: (ctx: GlobalHookCtx, args: { data: Rec; row: Rec }) => Promise<void> | void
  afterDelete?: (ctx: GlobalHookCtx, args: { row: Rec }) => Promise<void> | void
  afterUpdate?: (ctx: GlobalHookCtx, args: { next: Rec; patch: Rec; prev: Rec }) => Promise<void> | void
  beforeCreate?: (ctx: GlobalHookCtx, args: { data: Rec }) => Promise<Rec> | Rec
  beforeDelete?: (ctx: GlobalHookCtx, args: { row: Rec }) => Promise<void> | void
  beforeUpdate?: (ctx: GlobalHookCtx, args: { patch: Rec; prev: Rec }) => Promise<Rec> | Rec
}
interface HookCtx extends ReducerCtx<DbLike> {
  storage?: StorageLike
  userId: string
}
interface IdentityLike {
  equals?: (other: IdentityLike) => boolean
  toHexString?: () => string
  toString: () => string
}
interface IndexLike {
  eq: (field: string, value: unknown) => IndexLike
}
type Mb<V extends Visibility = 'public'> = <A = Rec, R = unknown, C = Rec>(
  ...args: unknown[]
) => C & RegisteredMutation<V, A, R>
interface Middleware {
  afterCreate?: (ctx: MiddlewareCtx, args: { data: Rec; row: Rec }) => Promise<void> | void
  afterDelete?: (ctx: MiddlewareCtx, args: { row: Rec }) => Promise<void> | void
  afterUpdate?: (ctx: MiddlewareCtx, args: { next: Rec; patch: Rec; prev: Rec }) => Promise<void> | void
  beforeCreate?: (ctx: MiddlewareCtx, args: { data: Rec }) => Promise<Rec> | Rec
  beforeDelete?: (ctx: MiddlewareCtx, args: { row: Rec }) => Promise<void> | void
  beforeUpdate?: (ctx: MiddlewareCtx, args: { patch: Rec; prev: Rec }) => Promise<Rec> | Rec
  name: string
}
interface MiddlewareCtx extends GlobalHookCtx {
  operation: 'create' | 'delete' | 'update'
}
interface MutationCtxLike extends ReducerCtx<DbLike> {
  auth?: { getUserIdentity: () => Promise<unknown> }
  storage?: StorageLike
}
interface MutCtx extends UserCtx {
  storage?: StorageLike
}
interface OptionalBuilder {
  optional: () => ColumnBuilder<unknown, AlgebraicTypeType> | TypeBuilder<unknown, AlgebraicTypeType>
}
type OrgEnrichedDoc<S extends ZodRawShape> = WithUrls<
  DocBase<S> & {
    author: AuthorInfo | null
    orgId: number | string
    own: boolean | null
    userId: string
  }
>
interface OrgUserLike {
  [k: string]: unknown
  _id: number
  email?: string
  image?: string
  name?: string
}
interface OwnedRow extends Record<string, unknown> {
  updatedAt: Timestamp
  userId: Identity
}
type PaginationOptsShape = Record<
  'cursor' | 'endCursor' | 'id' | 'maximumBytesRead' | 'maximumRowsRead' | 'numItems',
  ZodNullable | ZodNumber | ZodOptional
>
interface PkLike<Row, Id> {
  delete: (id: Id) => boolean
  find: (id: Id) => null | Row
  update: (row: Row) => Row
}
type Qb<V extends Visibility = 'public'> = <A = Rec, R = unknown, C = Rec>(
  ...args: unknown[]
) => C & RegisteredQuery<V, A, R>
interface QueryCtxLike extends ReducerCtx<DbLike> {
  auth?: { getUserIdentity: () => Promise<unknown> }
  storage?: StorageLike
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
  storage?: StorageLike
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
interface ReducerCtx<DB = unknown> {
  db: DB
  sender?: IdentityLike
  timestamp?: number
}
type ReducerExportLike = ReducerExport<never, never>
interface RegisteredAction<V extends Visibility, A, R> {
  __args: A
  __kind: 'action'
  __return: R
  __visibility: V
}
interface RegisteredMutation<V extends Visibility, A, R> {
  __args: A
  __kind: 'mutation'
  __return: R
  __visibility: V
}
interface RegisteredQuery<V extends Visibility, A, R> {
  __args: A
  __kind: 'query'
  __return: R
  __visibility: V
}
interface SetupConfig<DM = unknown> {
  action: Ab
  getAuthUserId: (ctx: never) => Promise<null | string>
  hooks?: GlobalHooks
  internalMutation: Mb<'internal'>
  internalQuery: Qb<'internal'>
  middleware?: Middleware[]
  mutation: Mb
  orgCascadeTables?: ((keyof DM & string) | { fileFields?: string[]; table: keyof DM & string })[]
  orgSchema?: ZodObject
  query: Qb
  strictFilter?: boolean
}
interface TableLike<Row> {
  insert: (row: Row) => Row
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
type Visibility = 'internal' | 'public'
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
type AssertSchema<T, Expected extends keyof BrandLabelMap> =
  DetectBrand<T> extends Expected ? T : SchemaTypeError<Expected, DetectBrand<T> & keyof BrandLabelMap>
type BaseSchema<T extends ZodRawShape> = SchemaBrand<'base'> &
  SchemaPhantoms<_.output<ZodObject<T>>, DocBase<T>, Partial<_.output<ZodObject<T>>>> &
  ZodObject<T>
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
type DetectBrand<T> = T extends SchemaBrand<infer K> ? K : 'unbranded'
type InferCreate<S> = S extends ZodObject<infer T> ? _.output<ZodObject<T>> : never
type InferReducerArgs<R> = R extends { __args: infer A } ? A : never
type InferReducerInputs<T> = {
  [K in keyof T]: InferReducerArgs<T[K]>
}
type InferReducerOutputs<T> = {
  [K in keyof T]: InferReducerReturn<T[K]>
}
type InferReducerReturn<R> = R extends { __return: infer O } ? O : never
type InferRow<S> =
  S extends OwnedSchema<infer T>
    ? DocBase<T> & { userId: string }
    : S extends OrgDefSchema<infer T>
      ? DocBase<T> & { userId: string }
      : S extends OrgSchema<infer T>
        ? DocBase<T> & { orgId: number | string; userId: string }
        : S extends BaseSchema<infer T>
          ? DocBase<T>
          : S extends SingletonSchema<infer T>
            ? _.output<ZodObject<T>> & { updatedAt: number; userId: string }
            : S extends ZodObject<infer T>
              ? _.output<ZodObject<T>>
              : never
type InferRows<T extends Record<string, unknown>> = {
  [K in keyof T]: InferRow<T[K]>
}
type InferUpdate<S> = S extends ZodObject<infer T> ? Partial<_.output<ZodObject<T>>> : never
type KvSchema<T extends ZodRawShape> = SchemaBrand<'kv'> &
  SchemaPhantoms<_.output<ZodObject<T>>, DocBase<T> & { key: string }, Partial<_.output<ZodObject<T>>>> &
  ZodObject<T>
type LogSchema<T extends ZodRawShape> = SchemaBrand<'log'> &
  SchemaPhantoms<_.output<ZodObject<T>>, DocBase<T> & { parent: string; seq: number }, Partial<_.output<ZodObject<T>>>> &
  ZodObject<T>
type OrgDefSchema<T extends ZodRawShape> = SchemaBrand<'orgDef'> &
  SchemaPhantoms<_.output<ZodObject<T>>, DocBase<T> & { userId: string }, Partial<_.output<ZodObject<T>>>> &
  ZodObject<T>
type OrgSchema<T extends ZodRawShape> = SchemaBrand<'org'> &
  SchemaPhantoms<
    _.output<ZodObject<T>>,
    DocBase<T> & { orgId: number | string; userId: string },
    Partial<_.output<ZodObject<T>>>
  > &
  ZodObject<T>
type OwnedSchema<T extends ZodRawShape> = SchemaBrand<'owned'> &
  SchemaPhantoms<_.output<ZodObject<T>>, DocBase<T> & { userId: string }, Partial<_.output<ZodObject<T>>>> &
  ZodObject<T>
interface QuotaSchema {
  readonly [__brand]: 'quota'
  readonly __hint: SchemaHint<'quota'>
  readonly durationMs: number
  readonly limit: number
}
interface Register {
  _?: never
}
type RegisteredDefaultError = Register extends { defaultError: infer E } ? E : Error
type RegisteredMeta = Register extends { meta: infer M } ? M : Record<string, unknown>
interface SchemaBrand<K extends string> {
  readonly [__brand]: K
  readonly __hint: SchemaHint<K>
}
type SchemaHint<K extends string> = K extends keyof SchemaHintMap ? SchemaHintMap[K] : string
interface SchemaHintMap {
  base: 'Created by makeBase() → use table()'
  kv: 'Created by makeKv() → use kv()'
  log: 'Created by makeLog() → use log()'
  org: 'Created by makeOrgScoped() → use table()'
  orgDef: 'Created by makeOrg() → use table()'
  owned: 'Created by makeOwned() → use table()'
  quota: 'Created by makeQuota() → use quota()'
  singleton: 'Created by makeSingleton() → use table()'
}
interface SchemaPhantoms<C, R, U> {
  readonly $inferCreate: C
  readonly $inferRow: R
  readonly $inferUpdate: U
  readonly '~types': {
    readonly create: C
    readonly row: R
    readonly update: U
  }
}
type SchemaTypeError<
  Expected extends keyof BrandLabelMap,
  Got extends keyof BrandLabelMap
> = `Schema mismatch: expected ${BrandLabelMap[Expected]}, got ${BrandLabelMap[Got]}. ${Expected extends keyof SchemaHintMap ? SchemaHintMap[Expected] : ''}`
type SingletonSchema<T extends ZodRawShape> = SchemaBrand<'singleton'> &
  SchemaPhantoms<
    _.output<ZodObject<T>>,
    _.output<ZodObject<T>> & { updatedAt: number; userId: string },
    Partial<_.output<ZodObject<T>>>
  > &
  ZodObject<T>
export type {
  Ab,
  ActionCtxLike,
  AssertSchema,
  AuthorInfo,
  BaseBuilders,
  BaseSchema,
  BrandLabelMap,
  BuiltinErrorCode,
  ComparisonOp,
  DbCtx,
  DbLike,
  DbReadLike,
  DetectBrand,
  DocBase,
  EnrichedDoc,
  ErrorCode,
  FID,
  FieldBuilders,
  FilterLike,
  GlobalHookCtx,
  GlobalHooks,
  HookCtx,
  IdentityLike,
  IndexLike,
  InferCreate,
  InferReducerArgs,
  InferReducerInputs,
  InferReducerOutputs,
  InferReducerReturn,
  InferRow,
  InferRows,
  InferUpdate,
  KvSchema,
  LogSchema,
  Mb,
  Middleware,
  MiddlewareCtx,
  MutationCtxLike,
  MutCtx,
  OptionalBuilder,
  OrgDefSchema,
  OrgEnrichedDoc,
  OrgRole,
  OrgSchema,
  OrgUserLike,
  OwnedRow,
  OwnedSchema,
  PaginatedResult,
  PaginationOptsShape,
  PkLike,
  Qb,
  QueryCtxLike,
  QueryLike,
  QuotaSchema,
  RateLimitConfig,
  RateLimitInput,
  ReadCtx,
  Rec,
  ReducerCtx,
  ReducerExportLike,
  Register,
  RegisteredAction,
  RegisteredDefaultError,
  RegisteredMeta,
  RegisteredMutation,
  RegisteredQuery,
  SchemaBrand,
  SchemaHintMap,
  SchemaPhantoms,
  SchemaTypeError,
  SearchLike,
  SetupConfig,
  SingletonSchema,
  StorageLike,
  TableLike,
  UserCtx,
  Visibility,
  WhereGroupOf,
  WhereOf,
  WithUrls
}
export { ERROR_MESSAGES }
