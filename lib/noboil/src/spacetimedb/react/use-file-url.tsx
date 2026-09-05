/** biome-ignore-all lint/nursery/noUnsafeTypeAssertion: narrows loosely-typed runtime/codegen values to the library's typed model at guarded facade boundaries */
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
const toBytes = (data: unknown): null | Uint8Array => {
  if (data instanceof Uint8Array) return data
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer as ArrayBuffer, data.byteOffset, data.byteLength)
  if (Array.isArray(data)) return Uint8Array.from(data as number[])
  if (typeof data === 'object' && data !== null && 'length' in data) return Uint8Array.from(data as ArrayLike<number>)
  return null
}
/** Resolve a `locator` (filename or id) to a blob URL for an inline-stored file row, with cache. Pass-through for http/data URLs. */
const resolveFileUrl = (files: readonly FileRow[], locator: null | string | undefined): null | string => {
  if (!locator) return null
  if (
    locator.startsWith('http://') ||
    locator.startsWith('https://') ||
    locator.startsWith('blob:') ||
    locator.startsWith('data:')
  )
    return locator
  const cached = cache.get(locator)
  if (cached) return cached
  const match = files.find(f => locator.includes(f.filename) || String(f.id) === locator)
  if (!match) return null
  const bytes = toBytes(match.data)
  if (!bytes) return null
  const url = fileBlobUrl(bytes, match.contentType)
  cache.set(locator, url)
  return url
}
/** Memoized hook variant of `resolveFileUrl`. Use when you have the `files` array in hand. */
const useFileUrl = (files: readonly FileRow[], locator: null | string | undefined): null | string =>
  useMemo(() => resolveFileUrl(files, locator), [files, locator])
const FileContext = createContext<readonly FileRow[]>([])
FileContext.displayName = 'FileContext'
/** Provide a list of `FileRow`s to descendants via context — pair with `useFiles` / `useResolveFileUrl`. */
const FileProvider = ({ children, files }: { children: ReactNode; files: readonly FileRow[] }) => (
  <FileContext value={files}>{children}</FileContext>
)
/** Read the closest `FileProvider`'s file list. Returns `[]` if no provider is mounted. */
const useFiles = (): readonly FileRow[] => use(FileContext)
/** Resolve a `locator` to a blob URL using the current `FileProvider` context — convenience over `useFileUrl`. */
const useResolveFileUrl = (locator: null | string | undefined): null | string => {
  const files = useFiles()
  return useMemo(() => resolveFileUrl(files, locator), [files, locator])
}
export type { FileRow }
export { FileProvider, resolveFileUrl, useFiles, useFileUrl, useResolveFileUrl }
