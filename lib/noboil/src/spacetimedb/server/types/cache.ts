import type { Timestamp } from 'spacetimedb'
import type { AlgebraicTypeType, ColumnBuilder, TypeBuilder } from 'spacetimedb/server'
import type { ReducerExportLike } from './common'

type CacheBuilder = ColumnBuilder<unknown, AlgebraicTypeType> | TypeBuilder<unknown, AlgebraicTypeType>
// eslint-disable-next-line sonarjs/redundant-type-aliases -- exported named public-API type asserting cache has no builder variants
type CacheBuilders = never
interface CacheConfig<
  DB,
  F extends CacheFieldBuilders,
  Row,
  Key,
  Tbl extends CacheTableLike<Row>,
  Pk extends CachePkLike<Row, Key>,
  T extends string = string
> {
  fields: F
  keyField: TypeBuilder<Key, AlgebraicTypeType>
  keyName: string
  options?: CacheOptions
  pk: (table: Tbl) => Pk
  table: (db: DB) => Tbl
  tableName: T
}
interface CacheConfigLoose {
  fields: CacheFieldBuilders
  keyField: TypeBuilder<unknown, AlgebraicTypeType>
  keyName: string
  options?: CacheOptions
  pk: (table: unknown) => unknown
  table: (db: unknown) => unknown
  tableName: string
}
type CacheCrudResult<T extends string = string> = CacheExports<T>
interface CacheExports<T extends string = string> {
  exports: Record<`create_${T}` | `invalidate_${T}` | `purge_${T}` | `rm_${T}` | `update_${T}`, ReducerExportLike>
}
type CacheFieldBuilders = Record<string, CacheBuilder>
type CacheFieldValues<F extends CacheFieldBuilders> = {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  [K in keyof F]: F[K] extends ColumnBuilder<infer T, infer _S, infer _M>
    ? T
    : F[K] extends TypeBuilder<infer T, infer _S> // eslint-disable-line @typescript-eslint/no-unused-vars
      ? T
      : never
}
interface CacheHookCtx {
  db: unknown
}
// eslint-disable-next-line sonarjs/redundant-type-aliases -- exported named public-API type asserting cache exposes no lifecycle hooks
type CacheHooks = never
interface CacheOptions {
  ttl?: number
}
interface CachePkLike<Row, Key> {
  delete: (key: Key) => boolean
  find: (key: Key) => null | Row
  update: (row: Row) => Row
}
interface CacheRowBase {
  cachedAt: Timestamp
  id: number
  invalidatedAt: null | Timestamp
  updatedAt: Timestamp
}
interface CacheTableLike<Row> extends Iterable<Row> {
  insert: (row: Row) => Row
}
export type {
  CacheBuilder,
  CacheBuilders,
  CacheConfig,
  CacheConfigLoose,
  CacheCrudResult,
  CacheExports,
  CacheFieldBuilders,
  CacheFieldValues,
  CacheHookCtx,
  CacheHooks,
  CacheOptions,
  CachePkLike,
  CacheRowBase,
  CacheTableLike
}
