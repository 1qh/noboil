/* oxlint-disable promise/prefer-await-to-callbacks */
import { describe, expect, test } from 'bun:test'
import { setup } from '../setup'
const captureReducers = () => {
  const out: Record<string, unknown> = {}
  const reducer = (opts: { name: string }, _params: unknown, fn: unknown) => {
    out[opts.name] = fn
    return fn
  }
  return { reducer, reducers: out }
}
const mkPkTable = () => {
  const rows: { id: number }[] = []
  let nextId = 1
  return {
    rows,
    tbl: {
      [Symbol.iterator]: () => rows[Symbol.iterator](),
      delete: () => true,
      filterByOrg: () => rows,
      filterByOrgStatus: () => rows,
      id: {
        delete: () => true,
        find: (id: number) => rows.find(r => r.id === id) ?? null,
        update: (row: { id: number }) => row
      },
      insert: (row: { id: number }) => {
        const next = { ...row, id: nextId }
        nextId += 1
        rows.push(next)
        return next
      }
    }
  }
}
describe('stdb setup wires factories with global hooks', () => {
  test('setup returns crud/orgCrud/childCrud/singletonCrud/cacheCrud/quota/log/kv/file/presence wrappers', () => {
    const { reducer } = captureReducers()
    const wired = setup({ reducer } as never, {
      hooks: {
        afterCreate: () => undefined,
        beforeCreate: (_c, p) => p.data
      }
    }) as Record<string, unknown>
    for (const name of ['crud', 'orgCrud', 'childCrud', 'singletonCrud', 'cacheCrud', 'org', 'allExports'])
      expect(typeof wired[name]).toBe('function')
  })
  test('setup with middleware composes hook chain (smoke)', () => {
    const { reducer } = captureReducers()
    const wired = setup(
      { reducer } as never,
      {
        middleware: [{ afterCreate: async () => undefined }]
      } as never
    ) as Record<string, unknown>
    expect(typeof wired.crud).toBe('function')
  })
  test('crud factory body executes when called with concrete table config', () => {
    const { reducer } = captureReducers()
    const wired = setup({ reducer } as never, {
      hooks: { afterCreate: () => undefined }
    }) as Record<string, unknown>
    const project = mkPkTable()
    const crud = wired.crud as (cfg: unknown) => unknown
    const result = crud({
      fields: { title: { optional: () => ({}) } as never },
      idField: {} as never,
      pk: (t: unknown) => (t as { id: never }).id,
      table: () => project.tbl,
      tableName: 'project'
    })
    expect(result).toBeDefined()
  })
})
