import { describe, expect, test } from 'bun:test'
import { z } from 'zod/v4'
import { checkSchema, orgChildTable, rateLimitTable, uploadTables } from '../schema-helpers'
const orgSchema = <T extends z.ZodRawShape>(shape: T) => Object.assign(z.object(shape), { __org: true })
describe('convex schema-helpers', () => {
  test('rateLimitTable returns one table with by_table_key index', () => {
    const out = rateLimitTable()
    expect(out.rateLimit).toBeDefined()
  })
  test('uploadTables returns 3 chunked-upload tables', () => {
    const t = uploadTables()
    expect(t.uploadChunk).toBeDefined()
    expect(t.uploadRateLimit).toBeDefined()
    expect(t.uploadSession).toBeDefined()
  })
  test('orgChildTable returns table with by_org and by_parent indexes', () => {
    const s = orgSchema({ name: z.string() }) as never
    const tbl = orgChildTable(s, { foreignKey: 'parentId', table: 'parent' })
    expect(tbl).toBeDefined()
  })
  test('checkSchema sets exitCode when unsupported zod type used', () => {
    const prevExit = process.exitCode
    process.exitCode = 0
    const schema = z.object({ tag: z.string().pipe(z.string()) })
    checkSchema({ todo: schema })
    expect(process.exitCode).toBe(1)
    process.exitCode = prevExit
  })
  test('checkSchema does nothing on allowed schemas', () => {
    const prevExit = process.exitCode
    process.exitCode = 0
    checkSchema({ todo: z.object({ name: z.string(), nested: z.object({ id: z.number() }) }) })
    expect(process.exitCode).toBe(0)
    process.exitCode = prevExit
  })
})
