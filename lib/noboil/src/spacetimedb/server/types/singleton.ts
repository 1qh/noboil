import type { Identity, Timestamp } from 'spacetimedb'
import type { AlgebraicTypeType, ColumnBuilder, TypeBuilder } from 'spacetimedb/server'
import type { ReducerExportLike } from './common'
interface SingletonBuilder {
  optional: () => TypeBuilder<unknown, AlgebraicTypeType>
}
interface SingletonConfig<
  DB,
  F extends SingletonFieldBuilders,
  Row extends { updatedAt: Timestamp; userId: Identity },
  Tbl extends SingletonTableLike<Row>,
  T extends string = string
> {
  fields: F
  options?: SingletonOptions<DB, Row, Partial<SingletonFieldValues<F>>>
  table: (db: DB) => Tbl
  tableName: T
}
interface SingletonConfigLoose {
  fields: SingletonFieldBuilders
  options?: SingletonOptions
  table: (db: unknown) => unknown
  tableName: string
}
/** Reducer-export bundle returned by `makeSingletonCrud` (stdb). One row per sender (`get_<table>`, `upsert_<table>`).
 * Spread `.exports` into your spacetimedb module's exports.
 *
 * @example
 * ```ts
 * makeSingletonCrud(spacetimedb, {
 *   tableName: 'profile',
 *   fields: { bio: t.string().optional(), name: t.string().optional() },
 *   table: db => db.profile
 * })
 * ```
 */
interface SingletonExports<T extends string = string> {
  exports: Record<`get_${T}` | `upsert_${T}`, ReducerExportLike>
}
type SingletonFieldBuilders = Record<
  string,
  ColumnBuilder<unknown, AlgebraicTypeType> | TypeBuilder<unknown, AlgebraicTypeType>
>
type SingletonFieldValues<F extends SingletonFieldBuilders> = {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  [K in keyof F]: F[K] extends ColumnBuilder<infer T, infer _S, infer _M>
    ? T
    : F[K] extends TypeBuilder<infer T, infer _S> // eslint-disable-line @typescript-eslint/no-unused-vars
      ? T
      : never
}
interface SingletonHookCtx<DB = unknown> {
  db: DB
  sender: Identity
  timestamp: Timestamp
}
/** Lifecycle hooks for `makeSingletonCrud` (stdb). `beforeUpdate` may transform the patch; throwing aborts. */
interface SingletonHooks<DB = unknown, Row = Record<string, unknown>, UpdatePatch = Record<string, unknown>> {
  afterCreate?: (ctx: SingletonHookCtx<DB>, args: { data: UpdatePatch; row: Row }) => Promise<void> | void
  afterUpdate?: (ctx: SingletonHookCtx<DB>, args: { next: Row; patch: UpdatePatch; prev: Row }) => Promise<void> | void
  beforeCreate?: (ctx: SingletonHookCtx<DB>, args: { data: UpdatePatch }) => Promise<UpdatePatch> | UpdatePatch
  beforeRead?: (ctx: SingletonHookCtx<DB>, args: { row: Row }) => Promise<void> | void
  beforeUpdate?: (ctx: SingletonHookCtx<DB>, args: { patch: UpdatePatch; prev: Row }) => Promise<UpdatePatch> | UpdatePatch
}
interface SingletonOptions<DB = unknown, Row = Record<string, unknown>, UpdatePatch = Record<string, unknown>> {
  hooks?: SingletonHooks<DB, Row, UpdatePatch>
}
interface SingletonPkLike<Row> {
  update: (row: Row) => Row
}
interface SingletonTableLike<Row> extends Iterable<Row> {
  id: SingletonPkLike<Row>
  insert: (row: Row) => Row
}
export type {
  SingletonBuilder,
  SingletonConfig,
  SingletonConfigLoose,
  SingletonExports,
  SingletonFieldBuilders,
  SingletonFieldValues,
  SingletonHookCtx,
  SingletonHooks,
  SingletonOptions,
  SingletonTableLike
}
