import { describe, expect, test } from 'bun:test'
import { z } from 'zod/v4'
import {
  baseTable,
  checkSchema,
  childTable,
  kvTable,
  logTable,
  orgChildTable,
  orgTable,
  orgTables,
  ownedTable,
  quotaTable,
  rateLimitTable,
  singletonTable,
  uploadTables
} from '../schema-helpers'

interface Td {
  fields: Record<string, string>
  indexes: { fields: string[]; name: string }[]
  kind: string
}
const td = (t: unknown) => t as Td
describe('stdb schema-helpers', () => {
  test('baseTable adds updatedAt only', () => {
    // oxlint-disable-next-line unicorn/max-nested-calls
    const t = td(baseTable(z.object({ name: z.string() }) as never))
    expect(t.fields.updatedAt).toBeDefined()
    expect(t.kind).toBe('base')
  })
  test('ownedTable adds userId + by_user index', () => {
    // oxlint-disable-next-line unicorn/max-nested-calls
    const t = td(ownedTable(z.object({ title: z.string() }) as never))
    expect(t.fields.userId).toBe('identity')
    expect(t.indexes.find(i => i.name === 'by_user')).toBeDefined()
  })
  test('singletonTable like ownedTable', () => {
    // oxlint-disable-next-line unicorn/max-nested-calls
    const t = td(singletonTable(z.object({ name: z.string() }) as never))
    expect(t.kind).toBe('singleton')
  })
  test('orgTable adds orgId + indexes', () => {
    // oxlint-disable-next-line unicorn/max-nested-calls
    const t = td(orgTable(z.object({ name: z.string() }) as never))
    expect(t.fields.orgId).toBe('u32')
    expect(t.indexes.map(i => i.name).toSorted((a, b) => a.localeCompare(b))).toEqual(['by_org', 'by_org_user'])
  })
  test('orgChildTable indexes by parent foreignKey', () => {
    // oxlint-disable-next-line unicorn/max-nested-calls
    const t = td(orgChildTable(z.object({ msg: z.string() }) as never, { foreignKey: 'parentId', table: 'parent' }))
    expect(t.indexes.find(i => i.name === 'by_parent')?.fields).toEqual(['parentId'])
  })
  test('childTable uses index field', () => {
    // oxlint-disable-next-line unicorn/max-nested-calls
    const t = td(childTable(z.object({ text: z.string() }) as never, 'chatId'))
    expect(t.indexes.find(i => i.name === 'by_chatId')?.fields).toEqual(['chatId'])
  })
  test('childTable accepts custom index name', () => {
    // oxlint-disable-next-line unicorn/max-nested-calls
    const t = td(childTable(z.object({ text: z.string() }) as never, 'chatId', 'by_msg_chat'))
    expect(t.indexes.find(i => i.name === 'by_msg_chat')).toBeDefined()
  })
  test('logTable has parent + seq indexes', () => {
    // oxlint-disable-next-line unicorn/max-nested-calls
    const t = td(logTable({ parent: 'p', schema: z.object({ x: z.string() }) }))
    const names = t.indexes.map(i => i.name)
    expect(names).toContain('by_parent')
    expect(names).toContain('by_parent_seq')
  })
  test('kvTable has by_key index', () => {
    // oxlint-disable-next-line unicorn/max-nested-calls
    const t = td(kvTable({ schema: z.object({ message: z.string() }) }))
    expect(t.indexes.find(i => i.name === 'by_key')).toBeDefined()
  })
  test('quotaTable indexes by_owner', () => {
    const t = td(quotaTable())
    expect(t.indexes.find(i => i.name === 'by_owner')).toBeDefined()
  })
  test('orgTables returns org/orgInvite/orgJoinRequest/orgMember', () => {
    const t = orgTables()
    expect(t.org).toBeDefined()
    expect(t.orgInvite).toBeDefined()
    expect(t.orgJoinRequest).toBeDefined()
    expect(t.orgMember).toBeDefined()
  })
  test('rateLimitTable + uploadTables shapes', () => {
    expect(rateLimitTable().rateLimit).toBeDefined()
    const u = uploadTables()
    expect(u.uploadChunk).toBeDefined()
    expect(u.uploadSession).toBeDefined()
  })
  test('checkSchema flags unsupported zod types', () => {
    const prev = process.exitCode
    process.exitCode = 0
    // oxlint-disable-next-line unicorn/max-nested-calls
    checkSchema({ todo: z.object({ tag: z.string().pipe(z.string()) }) })
    expect(process.exitCode).toBe(1)
    process.exitCode = prev
  })
})
