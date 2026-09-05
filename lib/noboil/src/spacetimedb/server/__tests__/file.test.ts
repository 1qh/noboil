/** biome-ignore-all lint/nursery/noUnsafeTypeAssertion: test fixtures construct and assert partial, invalid, or runtime-shaped values to exercise edge cases */
import { describe, expect, test } from 'bun:test'
import { makeFileUpload } from '../file'
import { captureReducers, tsAtMs } from './_helpers'

interface FileRow {
  contentType: string
  createdAt: { microsSinceUnixEpoch: bigint }
  data: Uint8Array
  filename: string
  id: number
  size: number
  uploadedAt: { microsSinceUnixEpoch: bigint }
  userId: { __id: string; isEqual: (o: unknown) => boolean; toHexString: () => string }
}
const ident = (label: string) =>
  ({
    __id: label,
    isEqual: (o: unknown) => (o as { __id?: string }).__id === label,
    toHexString: () => label
  }) as never
const anonSender = { toHexString: () => '0000000000' } as never
const mkTable = () => {
  const rows: FileRow[] = []
  let nextId = 1
  const tbl = {
    id: {
      delete: (id: number) => {
        const idx = rows.findIndex(r => r.id === id)
        if (idx === -1) return false
        rows.splice(idx, 1)
        return true
      },
      find: (id: number) => rows.find(r => r.id === id),
      update: (row: FileRow) => row
    },
    insert: (row: FileRow) => {
      const next = { ...row, id: nextId }
      nextId += 1
      rows.push(next)
      return next
    }
  }
  return { rows, tbl }
}
const setup = () => {
  const { reducer, reducers } = captureReducers()
  const { rows, tbl } = mkTable()
  makeFileUpload(
    { reducer },
    {
      fields: {
        contentType: {} as never,
        data: {} as never,
        filename: {} as never,
        size: {} as never
      },
      idField: {} as never,
      namespace: 'avatar',
      pk: t => (t as unknown as { id: never }).id,
      table: () => tbl as never
    }
  )
  return {
    del: reducers.delete_file_avatar as (c: never, a: never) => void,
    register: reducers.register_upload_avatar as (c: never, a: never) => void,
    rows
  }
}
describe('stdb makeFileUpload', () => {
  test('register inserts row for authed sender', () => {
    const { register, rows } = setup()
    register(
      { db: {}, sender: ident('aabbcc'), timestamp: tsAtMs(0) } as never,
      { contentType: 'image/png', data: new Uint8Array([1, 2]), filename: 'a.png', size: 2 } as never
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.filename).toBe('a.png')
  })
  test('register NOT_AUTHENTICATED for zero-id sender', () => {
    const { register } = setup()
    expect(() => {
      register(
        { db: {}, sender: anonSender, timestamp: tsAtMs(0) } as never,
        { contentType: 'image/png', data: new Uint8Array(), filename: 'x', size: 0 } as never
      )
    }).toThrow(/NOT_AUTHENTICATED/u)
  })
  test('register INVALID_FILE_TYPE rejects unknown mime', () => {
    const { register } = setup()
    expect(() => {
      register(
        { db: {}, sender: ident('aa'), timestamp: tsAtMs(0) } as never,
        { contentType: 'application/x-evil', data: new Uint8Array(), filename: 'x', size: 0 } as never
      )
    }).toThrow(/INVALID_FILE_TYPE/u)
  })
  test('register FILE_TOO_LARGE rejects oversize', () => {
    const { register } = setup()
    expect(() => {
      register(
        { db: {}, sender: ident('aa'), timestamp: tsAtMs(0) } as never,
        { contentType: 'image/png', data: new Uint8Array(), filename: 'x', size: 999_999_999 } as never
      )
    }).toThrow(/FILE_TOO_LARGE/u)
  })
  test('delete removes own file', () => {
    const { del, register, rows } = setup()
    const owner = ident('owner-a')
    register(
      { db: {}, sender: owner, timestamp: tsAtMs(0) } as never,
      { contentType: 'image/png', data: new Uint8Array(), filename: 'a', size: 0 } as never
    )
    del({ db: {}, sender: owner, timestamp: tsAtMs(1) } as never, { fileId: rows[0]?.id ?? -1 } as never)
    expect(rows).toHaveLength(0)
  })
  test('delete FORBIDDEN for non-owner', () => {
    const { del, register, rows } = setup()
    register(
      { db: {}, sender: ident('owner'), timestamp: tsAtMs(0) } as never,
      { contentType: 'image/png', data: new Uint8Array(), filename: 'a', size: 0 } as never
    )
    expect(() => {
      del({ db: {}, sender: ident('intruder'), timestamp: tsAtMs(1) } as never, { fileId: rows[0]?.id ?? -1 } as never)
    }).toThrow(/FORBIDDEN/u)
  })
  test('delete NOT_FOUND for unknown id', () => {
    const { del } = setup()
    expect(() => {
      del({ db: {}, sender: ident('owner'), timestamp: tsAtMs(0) } as never, { fileId: 999 } as never)
    }).toThrow(/NOT_FOUND/u)
  })
  test('delete NOT_AUTHENTICATED for zero sender', () => {
    const { del } = setup()
    expect(() => {
      del({ db: {}, sender: anonSender, timestamp: tsAtMs(0) } as never, { fileId: 1 } as never)
    }).toThrow(/NOT_AUTHENTICATED/u)
  })
})
