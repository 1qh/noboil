import type { ZodObject } from 'zod/v4'
import type { FieldType } from './types'
/** Metadata for a single schema field captured from source. */
interface FieldInfo {
  name: string
  optional: boolean
  type: string
}
/** Options for declaring a file/files schema field. */
interface FileOpts {
  accept?: string
  maxSize?: number
}
/** Diagnostic issue raised by check/doctor. */
interface Issue {
  file?: string
  level: 'error' | 'warn'
  message: string
}
/** Schema-definition entry for a kv table. */
interface KvEntryInput {
  keys?: readonly string[]
  schema: ZodObject
  writeRole?: ((ctx: unknown) => boolean | Promise<boolean>) | boolean
}
/** Schema-definition entry for a log table. */
interface LogEntryInput {
  parent: string
  schema: ZodObject
}
/** Result of parsing a `name:type` (or enum) field-spec string from CLI add. */
interface ParsedField {
  name: string
  optional: boolean
  type: FieldType | { enum: string[] }
}
/** Schema-definition entry for a quota table. */
interface QuotaEntryInput {
  durationMs: number
  limit: number
}
export type { FieldInfo, FileOpts, Issue, KvEntryInput, LogEntryInput, ParsedField, QuotaEntryInput }
