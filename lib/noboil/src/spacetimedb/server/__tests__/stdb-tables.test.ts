import { describe, expect, test } from 'bun:test'
import { z } from 'zod/v4'
import { makeSchema, zodToStdbFields } from '../stdb-tables'

const sc = makeSchema()
describe('stdb stdb-tables', () => {
  test('makeSchema returns table builders', () => {
    expect(typeof sc.cacheTable).toBe('function')
    expect(typeof sc.childTable).toBe('function')
    expect(typeof sc.fileTable).toBe('function')
    expect(typeof sc.kvTable).toBe('function')
    expect(typeof sc.logTable).toBe('function')
    expect(typeof sc.orgInviteTable).toBe('function')
    expect(typeof sc.orgJoinRequestTable).toBe('function')
    expect(typeof sc.orgMemberTable).toBe('function')
    expect(typeof sc.orgScopedTable).toBe('function')
    expect(typeof sc.ownedTable).toBe('function')
    expect(typeof sc.quotaTable).toBe('function')
    expect(typeof sc.singletonTable).toBe('function')
  })
  test('cacheTable accepts string key shorthand', () => {
    expect(sc.cacheTable('tmdb_id', { title: sc.t.string() })).toBeDefined()
  })
  test('childTable + fileTable + kvTable + logTable + quotaTable produce tables', () => {
    expect(sc.childTable('chatId', { text: sc.t.string() })).toBeDefined()
    expect(sc.fileTable()).toBeDefined()
    expect(sc.kvTable({ message: sc.t.string() })).toBeDefined()
    expect(sc.logTable({ optionIdx: sc.t.number() })).toBeDefined()
    expect(sc.quotaTable()).toBeDefined()
  })
  test('orgInviteTable + orgJoinRequestTable + orgMemberTable defined', () => {
    expect(sc.orgInviteTable()).toBeDefined()
    expect(sc.orgJoinRequestTable()).toBeDefined()
    expect(sc.orgMemberTable()).toBeDefined()
  })
  test('orgScopedTable + ownedTable + singletonTable', () => {
    expect(sc.orgScopedTable({ name: sc.t.string() })).toBeDefined()
    expect(sc.ownedTable({ title: sc.t.string() })).toBeDefined()
    expect(sc.singletonTable({ name: sc.t.string() })).toBeDefined()
  })
  test('zodToStdbFields converts zod shape to stdb fields', () => {
    const out = zodToStdbFields(z.object({ count: z.number(), name: z.string() }).shape, sc.t)
    expect(out.name).toBeDefined()
    expect(out.count).toBeDefined()
  })
  test('cacheTable accepts zod schema as fields (uses zodToStdbFields path)', () => {
    // oxlint-disable-next-line unicorn/max-nested-calls
    expect(sc.cacheTable('tmdb_id', z.object({ rating: z.number(), title: z.string() }) as never)).toBeDefined()
  })
})
