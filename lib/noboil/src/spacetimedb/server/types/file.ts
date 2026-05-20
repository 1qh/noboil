import type { Identity, Timestamp } from 'spacetimedb'
import type { AlgebraicTypeType, ColumnBuilder, TypeBuilder } from 'spacetimedb/server'
import type { ReducerExportLike } from './common'

interface FileRowShape {
  contentType: string
  data: Uint8Array
  filename: string
  id: number
  size: number
  uploadedAt: Timestamp
  userId: Identity
}
type FileUploadBuilder = ColumnBuilder<unknown, AlgebraicTypeType> | TypeBuilder<unknown, AlgebraicTypeType>
interface FileUploadConfig<
  DB,
  Row extends { contentType: string; data: Uint8Array; filename: string; size: number; userId: Identity },
  Id,
  Tbl extends FileUploadTableLike<Row>,
  Pk extends FileUploadPkLike<Row, Id>,
  N extends string = string
> {
  allowedTypes?: Set<string>
  fields: FileUploadFields
  idField: TypeBuilder<Id, AlgebraicTypeType>
  maxFileSize?: number
  namespace: N
  pk: (table: Tbl) => Pk
  table: (db: DB) => Tbl
}
interface FileUploadConfigLoose {
  allowedTypes?: Set<string>
  fields: FileUploadFields
  idField: TypeBuilder<unknown, AlgebraicTypeType>
  maxFileSize?: number
  namespace: string
  pk: (table: unknown) => unknown
  table: (db: unknown) => unknown
}
/** Reducer-export bundle returned by `makeFileUpload` (stdb). Inline-storage file upload reducers.
 * Spread `.exports` into your spacetimedb module's exports.
 *
 * @example
 * ```ts
 * makeFileUpload(spacetimedb, {
 *   namespace: 'avatars',
 *   fields: { contentType: t.string(), data: t.array(t.u8()), filename: t.string(), size: t.u32() },
 *   idField: t.u32(),
 *   pk: tbl => tbl.id,
 *   table: db => db.file,
 *   maxFileSize: 5 * 1024 * 1024
 * })
 * ```
 */
interface FileUploadExports<N extends string = string> {
  exports: Record<`delete_file_${N}` | `register_upload_${N}`, ReducerExportLike>
}
interface FileUploadFields {
  contentType: FileUploadBuilder
  data: FileUploadBuilder
  filename: FileUploadBuilder
  size: FileUploadBuilder
}
interface FileUploadPkLike<Row, Id> {
  delete: (id: Id) => boolean
  find: (id: Id) => null | Row
}
interface FileUploadTableLike<Row> {
  insert: (row: Row) => Row
}
export type {
  FileRowShape,
  FileUploadBuilder,
  FileUploadConfig,
  FileUploadConfigLoose,
  FileUploadExports,
  FileUploadFields,
  FileUploadPkLike,
  FileUploadTableLike
}
