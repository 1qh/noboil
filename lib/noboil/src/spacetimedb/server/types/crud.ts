import type { Identity, Timestamp } from 'spacetimedb'
import type { AlgebraicTypeType, ColumnBuilder, TypeBuilder } from 'spacetimedb/server'
import type { RateLimitConfig, ReducerExportLike } from './common'
interface CascadeOption {
  foreignKey: string
  table: string
}
type CrudBuilder = ColumnBuilder<unknown, AlgebraicTypeType> | TypeBuilder<unknown, AlgebraicTypeType>
type CrudBuilders = never
/** Configuration for `makeCrud` (stdb).
 *
 * - `tableName`: prefix used to name the generated reducers (`create_<tableName>`, `update_<tableName>`, `rm_<tableName>`).
 * - `fields`: per-column type builders (one per writable column).
 * - `idField`: type builder for the row primary key.
 * - `expectedUpdatedAtField`: builder for the optimistic-lock guard (optional).
 * - `pk`: returns the row's pk-index accessor (for `find`/`update`/`delete`).
 * - `table`: returns the iterable table from the connection's `db`.
 * - `options`: hooks, rate limit, cascade, softDelete.
 *
 * @example
 * ```ts
 * makeCrud(spacetimedb, {
 *   tableName: 'todo',
 *   fields: { done: t.boolean(), title: t.string() },
 *   idField: t.u32(),
 *   pk: tbl => tbl.id,
 *   table: db => db.todo,
 *   options: { rateLimit: { max: 30, window: 60_000 }, softDelete: true }
 * })
 * ```
 */
interface CrudConfig<
  DB,
  F extends CrudFieldBuilders,
  Row extends Record<string, unknown> & { updatedAt: Timestamp; userId: Identity },
  Id,
  Tbl extends CrudTableLike<Row>,
  Pk extends CrudPkLike<Row, Id>,
  T extends string = string
> {
  expectedUpdatedAtField?: TypeBuilder<Timestamp, AlgebraicTypeType>
  fields: F
  idField: TypeBuilder<Id, AlgebraicTypeType>
  options?: CrudOptions<DB, Row, CrudFieldValues<F>, Partial<CrudFieldValues<F>>>
  pk: (table: Tbl) => Pk
  table: (db: DB) => Tbl
  tableName: T
}
interface CrudConfigLoose {
  expectedUpdatedAtField?: TypeBuilder<unknown, AlgebraicTypeType>
  fields: CrudFieldBuilders
  idField: TypeBuilder<unknown, AlgebraicTypeType>
  options?: CrudOptions
  pk: (table: unknown) => unknown
  table: (db: unknown) => unknown
  tableName: string
}
/** Reducer-export bundle returned by `makeCrud` (stdb). Keys are literal reducer names (`create_<T>`, `update_<T>`, `rm_<T>`)
 * derived from `tableName`. Spread `.exports` into your spacetimedb module's exports.
 */
interface CrudExports<T extends string = string> {
  exports: Record<`create_${T}` | `rm_${T}` | `update_${T}`, ReducerExportLike>
}
type CrudFieldBuilders = Record<string, CrudBuilder>
type CrudFieldValues<F extends CrudFieldBuilders> = {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  [K in keyof F]: F[K] extends ColumnBuilder<infer T, infer _S, infer _M>
    ? T
    : F[K] extends TypeBuilder<infer T, infer _S> // eslint-disable-line @typescript-eslint/no-unused-vars
      ? T
      : never
}
/** Lifecycle hooks for `makeCrud` (stdb). `before*` may return a transformed payload; throwing aborts the reducer. */
interface CrudHooks<
  DB = unknown,
  Row extends Record<string, unknown> = Record<string, unknown>,
  CreateArgs extends Record<string, unknown> = Record<string, unknown>,
  UpdatePatch extends Record<string, unknown> = Record<string, unknown>
> {
  afterCreate?: (ctx: HookCtx<DB>, args: { data: CreateArgs; row: Row }) => Promise<void> | void
  afterDelete?: (ctx: HookCtx<DB>, args: { row: Row }) => Promise<void> | void
  afterUpdate?: (ctx: HookCtx<DB>, args: { next: Row; patch: UpdatePatch; prev: Row }) => Promise<void> | void
  beforeCreate?: (ctx: HookCtx<DB>, args: { data: CreateArgs }) => CreateArgs | Promise<CreateArgs>
  beforeDelete?: (ctx: HookCtx<DB>, args: { row: Row }) => Promise<void> | void
  beforeUpdate?: (ctx: HookCtx<DB>, args: { patch: UpdatePatch; prev: Row }) => Promise<UpdatePatch> | UpdatePatch
}
type CrudMakeFn = <
  DB,
  F extends CrudFieldBuilders,
  Row extends Record<string, unknown> & { updatedAt: Timestamp; userId: Identity },
  Id,
  Tbl extends CrudTableLike<Row>,
  Pk extends CrudPkLike<Row, Id>
>(
  spacetimedb: {
    reducer: (
      opts: { name: string },
      params: CrudFieldBuilders,
      fn: (ctx: HookCtx<DB>, args: Record<string, unknown>) => void
    ) => ReducerExportLike
  },
  config: CrudConfig<DB, F, Row, Id, Tbl, Pk>
) => CrudExports
/** Options for `makeCrud` (stdb).
 *
 * - `cascade`: child tables to delete-on-parent-delete (use `ownedCascade` helper).
 * - `hooks`: see `CrudHooks`.
 * - `rateLimit`: per-sender cap; `{ max, window }` ms.
 * - `softDelete`: when true, `rm` sets `deletedAt` instead of deleting; rows reappear via separate restore reducer.
 */
interface CrudOptions<
  DB = unknown,
  Row extends Record<string, unknown> = Record<string, unknown>,
  CreateArgs extends Record<string, unknown> = Record<string, unknown>,
  UpdatePatch extends Record<string, unknown> = Record<string, unknown>
> {
  cascade?: CascadeOption[]
  hooks?: CrudHooks<DB, Row, CreateArgs, UpdatePatch>
  rateLimit?: RateLimitConfig
  softDelete?: boolean
}
interface CrudPkLike<Row, Id> {
  delete: (id: Id) => boolean
  find: (id: Id) => null | Row
  update: (row: Row) => Row
}
type CrudReadApi = never
type CrudResult = CrudExports
interface CrudTableLike<Row> {
  delete: (row: Row) => boolean
  insert: (row: Row) => Row
}
interface DbCtx {
  db: unknown
}
interface HookCtx<DB = unknown> {
  db: DB
  sender: Identity
  timestamp: Timestamp
}
export type {
  CascadeOption,
  CrudBuilders,
  CrudConfig,
  CrudConfigLoose,
  CrudExports,
  CrudFieldBuilders,
  CrudFieldValues,
  CrudHooks,
  CrudMakeFn,
  CrudOptions,
  CrudPkLike,
  CrudReadApi,
  CrudResult,
  CrudTableLike,
  DbCtx,
  HookCtx
}
