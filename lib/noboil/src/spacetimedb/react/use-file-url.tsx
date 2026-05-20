'use client'
import type { ReactNode } from 'react'
import { createContext, use, useMemo } from 'react'
import { fileBlobUrl } from './provider'

interface FileRow {
  contentType: string
  data: unknown
  filename: string
  id: number
}
const cache = new Map<string, string>()
const toBytes = (data: unknown): ArrayLike<number> | null | Uint8Array => {
  if (data instanceof Uint8Array) return data
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer as ArrayBuffer, data.byteOffset, data.byteLength)
  if (Array.isArray(data)) return data as number[]
  if (typeof data === 'object' && data !== null && 'length' in data) return data as ArrayLike<number>
  return null
}
/** Resolve a `ref` (filename or id) to a blob URL for an inline-stored file row, with cache. Pass-through for http/data URLs. */
const resolveFileUrl = (files: readonly FileRow[], ref: null | string | undefined): null | string => {
  if (!ref) return null
  if (ref.startsWith('http://') || ref.startsWith('https://') || ref.startsWith('blob:') || ref.startsWith('data:'))
    return ref
  const cached = cache.get(ref)
  if (cached) return cached
  const match = files.find(f => ref.includes(f.filename) || String(f.id) === ref)
  if (!match) return null
  const bytes = toBytes(match.data)
  if (!bytes) return null
  const url = fileBlobUrl(bytes, match.contentType)
  cache.set(ref, url)
  return url
}
/** Memoized hook variant of `resolveFileUrl`. Use when you have the `files` array in hand. */
const useFileUrl = (files: readonly FileRow[], ref: null | string | undefined): null | string =>
  useMemo(() => resolveFileUrl(files, ref), [files, ref])
const FileContext = createContext<readonly FileRow[]>([])
/** Provide a list of `FileRow`s to descendants via context — pair with `useFiles` / `useResolveFileUrl`. */
const FileProvider = ({ children, files }: { children: ReactNode; files: readonly FileRow[] }) => (
  <FileContext value={files}>{children}</FileContext>
)
/** Read the closest `FileProvider`'s file list. Returns `[]` if no provider is mounted. */
const useFiles = (): readonly FileRow[] => use(FileContext)
/** Resolve a `ref` to a blob URL using the current `FileProvider` context — convenience over `useFileUrl`. */
const useResolveFileUrl = (ref: null | string | undefined): null | string => {
  const files = useFiles()
  return useMemo(() => resolveFileUrl(files, ref), [files, ref])
}
export type { FileRow }
export { FileProvider, resolveFileUrl, useFiles, useFileUrl, useResolveFileUrl }
