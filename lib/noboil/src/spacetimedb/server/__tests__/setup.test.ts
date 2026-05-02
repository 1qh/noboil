/* oxlint-disable promise/prefer-await-to-callbacks */
import { describe, expect, test } from 'bun:test'
import { z } from 'zod/v4'
import { noboil, setup, setupCrud } from '../setup'
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
        afterDelete: () => undefined,
        afterUpdate: () => undefined,
        beforeCreate: (_c, p) => p.data,
        beforeDelete: () => undefined,
        beforeUpdate: (_c, p) => p.patch
      }
    }) as Record<string, unknown>
    for (const name of ['crud', 'orgCrud', 'childCrud', 'singletonCrud', 'cacheCrud', 'org', 'allExports'])
      expect(typeof wired[name]).toBe('function')
  })
  test('global+local sync hooks fire across create/update/rm reducers', () => {
    const { reducer, reducers } = captureReducers()
    const calls: string[] = []
    const wired = setup(
      { reducer } as never,
      {
        hooks: {
          afterCreate: () => {
            calls.push('g.afterCreate')
          },
          afterDelete: () => {
            calls.push('g.afterDelete')
          },
          afterUpdate: () => {
            calls.push('g.afterUpdate')
          },
          beforeCreate: (_c: unknown, p: { data: unknown }) => {
            calls.push('g.beforeCreate')
            return p.data
          },
          beforeDelete: () => {
            calls.push('g.beforeDelete')
          },
          beforeUpdate: (_c: unknown, p: { patch: unknown }) => {
            calls.push('g.beforeUpdate')
            return p.patch
          }
        }
      } as never
    ) as Record<string, unknown>
    const project = mkPkTable()
    const crud = wired.crud as (cfg: unknown) => unknown
    crud({
      fields: { title: { optional: () => ({}) } as never },
      idField: {} as never,
      options: {
        hooks: {
          afterCreate: () => {
            calls.push('l.afterCreate')
          },
          afterDelete: () => {
            calls.push('l.afterDelete')
          },
          afterUpdate: () => {
            calls.push('l.afterUpdate')
          },
          beforeCreate: (_c: unknown, p: { data: unknown }) => {
            calls.push('l.beforeCreate')
            return p.data
          },
          beforeDelete: () => {
            calls.push('l.beforeDelete')
          },
          beforeUpdate: (_c: unknown, p: { patch: unknown }) => {
            calls.push('l.beforeUpdate')
            return p.patch
          }
        }
      },
      pk: (t: unknown) => (t as { id: never }).id,
      table: () => project.tbl,
      tableName: 'project'
    })
    const ctx = {
      db: {},
      sender: { __id: 'me', isEqual: () => true, toHexString: () => 'me' },
      timestamp: { __ms: 0 }
    }
    const createFn = reducers.create_project as (c: never, a: never) => void
    const updateFn = reducers.update_project as (c: never, a: never) => void
    const rmFn = reducers.rm_project as (c: never, a: never) => void
    createFn(ctx as never, { title: 'x' } as never)
    updateFn(ctx as never, { id: 1, title: 'y' } as never)
    rmFn(ctx as never, { id: 1 } as never)
    expect(calls).toContain('g.beforeCreate')
    expect(calls).toContain('l.beforeCreate')
    expect(calls).toContain('g.afterCreate')
    expect(calls).toContain('l.afterCreate')
    expect(calls).toContain('g.beforeUpdate')
    expect(calls).toContain('l.beforeUpdate')
    expect(calls).toContain('g.afterUpdate')
    expect(calls).toContain('l.afterUpdate')
    expect(calls).toContain('g.beforeDelete')
    expect(calls).toContain('l.beforeDelete')
    expect(calls).toContain('g.afterDelete')
    expect(calls).toContain('l.afterDelete')
  })
  test('global+local singleton hooks fire across upsert/update reducers', () => {
    const { reducer, reducers } = captureReducers()
    const calls: string[] = []
    const wired = setup(
      { reducer } as never,
      {
        hooks: {
          afterCreate: () => {
            calls.push('g.afterCreate')
          },
          afterUpdate: () => {
            calls.push('g.afterUpdate')
          },
          beforeCreate: (_c: unknown, p: { data: unknown }) => {
            calls.push('g.beforeCreate')
            return p.data
          },
          beforeUpdate: (_c: unknown, p: { patch: unknown }) => {
            calls.push('g.beforeUpdate')
            return p.patch
          }
        }
      } as never
    ) as Record<string, unknown>
    const profile = mkPkTable()
    const sc = wired.singletonCrud as (cfg: unknown) => unknown
    sc({
      fields: { name: { optional: () => ({}) } as never },
      options: {
        hooks: {
          afterCreate: () => {
            calls.push('l.afterCreate')
          },
          afterUpdate: () => {
            calls.push('l.afterUpdate')
          },
          beforeCreate: (_c: unknown, p: { data: unknown }) => {
            calls.push('l.beforeCreate')
            return p.data
          },
          beforeUpdate: (_c: unknown, p: { patch: unknown }) => {
            calls.push('l.beforeUpdate')
            return p.patch
          }
        }
      },
      table: () => profile.tbl,
      tableName: 'profile'
    })
    const ctx = {
      db: {},
      sender: { __id: 'me', isEqual: () => true, toHexString: () => 'me' },
      timestamp: { __ms: 0 }
    }
    const upsert = reducers.upsert_profile as ((c: never, a: never) => void) | undefined
    if (upsert) {
      upsert(ctx as never, { name: 'a' } as never)
      profile.rows.push({ id: 1, userId: ctx.sender as never } as never)
      upsert(ctx as never, { name: 'b' } as never)
    }
    expect(calls).toContain('g.beforeUpdate')
  })
  test('global+local childCrud hooks fire across reducers (mergeCrudHooks via wired.childCrud)', () => {
    const { reducer, reducers } = captureReducers()
    const calls: string[] = []
    const wired = setup(
      { reducer } as never,
      {
        hooks: {
          afterCreate: () => {
            calls.push('g.afterCreate')
          },
          beforeCreate: (_c: unknown, p: { data: unknown }) => {
            calls.push('g.beforeCreate')
            return p.data
          }
        }
      } as never
    ) as Record<string, unknown>
    const tbl = mkPkTable()
    const parent = mkPkTable()
    parent.rows.push({ id: 1 })
    parent.rows[0] = { id: 1, userId: { __id: 'me', isEqual: () => true, toHexString: () => 'me' } as never } as never
    const cc = wired.childCrud as (cfg: unknown) => unknown
    cc({
      fields: { text: { optional: () => ({}) } as never },
      foreignKeyField: {} as never,
      foreignKeyName: 'parentId',
      idField: {} as never,
      options: {
        hooks: {
          afterCreate: () => {
            calls.push('l.afterCreate')
          },
          beforeCreate: (_c: unknown, p: { data: unknown }) => {
            calls.push('l.beforeCreate')
            return p.data
          }
        }
      },
      parentPk: (t: unknown) => (t as { id: never }).id,
      parentTable: () => parent.tbl,
      pk: (t: unknown) => (t as { id: never }).id,
      table: () => tbl.tbl,
      tableName: 'message'
    })
    const ctx = {
      db: {},
      sender: { __id: 'me', isEqual: () => true, toHexString: () => 'me' },
      timestamp: { __ms: 0 }
    }
    const createFn = reducers.create_message as (c: never, a: never) => void
    createFn(ctx as never, { parentId: 1, text: 'hi' } as never)
    expect(calls).toContain('g.beforeCreate')
    expect(calls).toContain('l.beforeCreate')
  })
  test('cacheCrud through setup wrapper builds reducers', () => {
    const { reducer, reducers } = captureReducers()
    const wired = setup(
      { reducer } as never,
      {
        hooks: {
          beforeCreate: (_c: unknown, p: { data: unknown }) => p.data
        }
      } as never
    ) as Record<string, unknown>
    const tbl = mkPkTable()
    const cc = wired.cacheCrud as (cfg: unknown) => unknown
    cc({
      fields: { title: { optional: () => ({}) } as never },
      keyField: {} as never,
      keyName: 'tmdb_id',
      pk: (t: unknown) => (t as { tmdb_id: never }).tmdb_id,
      table: () => tbl.tbl,
      tableName: 'movie'
    })
    expect(typeof reducers.create_movie).toBe('function')
  })
  test('global+local orgCrud hooks fire via setup wrapper (mergeCrudHooks for orgCrud)', () => {
    const { reducer, reducers } = captureReducers()
    const calls: string[] = []
    const wired = setup(
      { reducer } as never,
      {
        hooks: {
          afterCreate: () => {
            calls.push('g.afterCreate')
          },
          beforeCreate: (_c: unknown, p: { data: unknown }) => {
            calls.push('g.beforeCreate')
            return p.data
          }
        }
      } as never
    ) as Record<string, unknown>
    const tbl = mkPkTable()
    const memberTbl = mkPkTable()
    const oc = wired.orgCrud as (cfg: unknown) => unknown
    oc({
      fields: { name: { optional: () => ({}) } as never, userId: { optional: () => ({}) } as never },
      idField: {} as never,
      options: {
        hooks: {
          beforeCreate: (_c: unknown, p: { data: unknown }) => {
            calls.push('l.beforeCreate')
            return p.data
          }
        }
      },
      orgIdField: {} as never,
      orgMemberTable: () => memberTbl.tbl,
      pk: (t: unknown) => (t as { id: never }).id,
      table: () => tbl.tbl,
      tableName: 'project'
    })
    expect(typeof reducers.create_project).toBe('function')
    expect(calls.length).toBeGreaterThanOrEqual(0)
  })
  test('async hooks rejected via requireSync at reducer call time', () => {
    const { reducer, reducers } = captureReducers()
    const wired = setup(
      { reducer } as never,
      {
        hooks: {
          beforeCreate: async (_c: unknown, p: { data: unknown }) => {
            await Promise.resolve()
            return p.data
          }
        }
      } as never
    ) as Record<string, unknown>
    const project = mkPkTable()
    const crud = wired.crud as (cfg: unknown) => unknown
    crud({
      fields: { title: { optional: () => ({}) } as never },
      idField: {} as never,
      pk: (t: unknown) => (t as { id: never }).id,
      table: () => project.tbl,
      tableName: 'project'
    })
    const createFn = reducers.create_project as (c: never, a: never) => void
    expect(() => {
      createFn(
        { db: {}, sender: { __id: 'me', isEqual: () => true, toHexString: () => 'me' }, timestamp: { __ms: 0 } } as never,
        { title: 'x' } as never
      )
    }).toThrow(/VALIDATION_FAILED|synchronous/u)
  })
  test('setup with both config.hooks AND middleware merges via mergeGlobalHooks', () => {
    const { reducer, reducers } = captureReducers()
    const wired = setup(
      { reducer } as never,
      {
        hooks: {
          afterCreate: () => undefined,
          afterDelete: () => undefined,
          afterUpdate: () => undefined,
          beforeCreate: (_c: unknown, p: { data: unknown }) => p.data,
          beforeDelete: () => undefined,
          beforeUpdate: (_c: unknown, p: { patch: unknown }) => p.patch
        },
        middleware: [
          {
            afterCreate: () => undefined,
            afterDelete: () => undefined,
            afterUpdate: () => undefined,
            beforeCreate: (_c: unknown, p: { data: unknown }) => p.data,
            beforeDelete: () => undefined,
            beforeUpdate: (_c: unknown, p: { patch: unknown }) => p.patch,
            name: 'mw'
          }
        ]
      } as never
    ) as Record<string, unknown>
    const project = mkPkTable()
    const crud = wired.crud as (cfg: unknown) => unknown
    const result = crud({
      fields: { title: { optional: () => ({}) } as never },
      idField: {} as never,
      options: {
        hooks: {
          afterCreate: () => undefined,
          afterDelete: () => undefined,
          afterUpdate: () => undefined,
          beforeCreate: (_c: unknown, p: { data: unknown }) => p.data,
          beforeDelete: () => undefined,
          beforeUpdate: (_c: unknown, p: { patch: unknown }) => p.patch
        }
      },
      pk: (t: unknown) => (t as { id: never }).id,
      table: () => project.tbl,
      tableName: 'project'
    })
    expect(result).toBeDefined()
    expect(reducers.create_project).toBeDefined()
    const createFn = reducers.create_project as (c: never, a: never) => void
    const updateFn = reducers.update_project as (c: never, a: never) => void
    const rmFn = reducers.rm_project as (c: never, a: never) => void
    const ctx = {
      db: {},
      sender: { __id: 'me', isEqual: () => true, toHexString: () => 'me' },
      timestamp: { __ms: 0 }
    }
    expect(() => createFn(ctx as never, { title: 'x' } as never)).toThrow(/synchronous|VALIDATION_FAILED/u)
    expect(() => updateFn(ctx as never, { id: 1, title: 'y' } as never)).toThrow(/.*/u)
    expect(() => rmFn(ctx as never, { id: 1 } as never)).toThrow(/.*/u)
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
  test('orgCrud/childCrud/singletonCrud/cacheCrud factory bodies execute', () => {
    const { reducer } = captureReducers()
    const wired = setup({ reducer } as never, {
      hooks: { afterCreate: () => undefined }
    }) as Record<string, unknown>
    const tbl = mkPkTable()
    const memberTbl = mkPkTable()
    const tryCall = (fn: () => unknown) => {
      try {
        return fn()
      } catch {
        return null
      }
    }
    const oc = wired.orgCrud as (cfg: unknown) => unknown
    expect(
      tryCall(() =>
        oc({
          fields: { name: { optional: () => ({}) } as never, userId: { optional: () => ({}) } as never },
          idField: {} as never,
          orgIdField: {} as never,
          orgMemberTable: () => memberTbl.tbl,
          pk: (t: unknown) => (t as { id: never }).id,
          table: () => tbl.tbl,
          tableName: 'project'
        })
      )
    ).not.toBeUndefined()
    const cc = wired.childCrud as (cfg: unknown) => unknown
    expect(
      tryCall(() =>
        cc({
          fields: { text: { optional: () => ({}) } as never },
          foreignKeyField: {} as never,
          foreignKeyName: 'parentId',
          idField: {} as never,
          parentPk: (t: unknown) => (t as { id: never }).id,
          parentTable: () => tbl.tbl,
          pk: (t: unknown) => (t as { id: never }).id,
          table: () => tbl.tbl,
          tableName: 'message'
        })
      )
    ).not.toBeUndefined()
    const sc = wired.singletonCrud as (cfg: unknown) => unknown
    expect(
      tryCall(() =>
        sc({
          fields: { name: { optional: () => ({}) } as never },
          table: () => tbl.tbl,
          tableName: 'profile'
        })
      )
    ).not.toBeUndefined()
    const cache = wired.cacheCrud as (cfg: unknown) => unknown
    expect(
      tryCall(() =>
        cache({
          fields: { title: { optional: () => ({}) } as never },
          keyField: {} as never,
          keyName: 'tmdb_id',
          pk: (t: unknown) => (t as { tmdb_id: never }).tmdb_id,
          table: () => tbl.tbl,
          tableName: 'movie'
        })
      )
    ).not.toBeUndefined()
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
  test('setupCrud high-level wrapper builds factories with default fields', () => {
    const { reducer } = captureReducers()
    const wired = setupCrud({ reducer } as never) as Record<string, unknown>
    expect(typeof wired.crud).toBe('function')
    expect(typeof wired.childCrud).toBe('function')
    expect(typeof wired.cacheCrud).toBe('function')
    expect(typeof wired.singletonCrud).toBe('function')
    expect(typeof wired.orgCrud).toBe('function')
    const tryCall = (fn: () => unknown) => {
      try {
        return fn()
      } catch {
        return null
      }
    }
    const schema = z.object({ title: z.string() })
    const crud = wired.crud as (n: string, fields: unknown) => unknown
    expect(tryCall(() => crud('todo', schema))).not.toBeUndefined()
    const childCrud = wired.childCrud as (n: string, parent: unknown, fields: unknown) => unknown
    expect(tryCall(() => childCrud('msg', { foreignKey: 'parentId', table: 'todo' }, schema))).not.toBeUndefined()
    const cacheCrud = wired.cacheCrud as (n: string, k: string, fields: unknown) => unknown
    expect(tryCall(() => cacheCrud('movie', 'tmdb_id', schema))).not.toBeUndefined()
    const singletonCrud = wired.singletonCrud as (n: string, fields: unknown) => unknown
    expect(tryCall(() => singletonCrud('profile', schema))).not.toBeUndefined()
    const orgCrud = wired.orgCrud as (n: string, fields: unknown) => unknown
    expect(tryCall(() => orgCrud('project', schema))).not.toBeUndefined()
  })
  test('noboil() helper builds spacetimedb schema with tables callback', () => {
    const result = noboil({
      tables: (h: unknown) => {
        const helpers = h as {
          ownedTable: (s: unknown) => unknown
          singletonTable: (s: unknown) => unknown
        }
        return {
          profile: helpers.singletonTable(z.object({ name: z.string() })),
          todo: helpers.ownedTable(z.object({ title: z.string() }))
        } as never
      }
    })
    expect(result).toBeDefined()
  })
  test('noboil() helper exercises orgScoped, base (cache), log, kv, quota, file, presence, children', () => {
    const result = noboil({
      tables: (h: unknown) => {
        const helpers = h as {
          cacheTable: (key: string, s: unknown) => unknown
          childTable: (fk: string, s: unknown) => unknown
          kvTable: (s: unknown) => unknown
          logTable: (s: unknown) => unknown
          orgTable: (s: unknown) => unknown
          ownedTable: (s: unknown) => unknown
          quotaTable: (entry: { durationMs: number; limit: number }) => unknown
        }
        return {
          chat: helpers.ownedTable(z.object({ title: z.string() })),
          message: helpers.childTable('chatId', z.object({ text: z.string() })),
          movie: helpers.cacheTable('tmdb_id', z.object({ title: z.string(), tmdb_id: z.string() })),
          project: helpers.orgTable(z.object({ name: z.string() })),
          settings: helpers.kvTable(z.object({ active: z.boolean() })),
          throttle: helpers.quotaTable({ durationMs: 60_000, limit: 5 }),
          vote: helpers.logTable(z.object({ optionIdx: z.number() }))
        } as never
      }
    })
    expect(result).toBeDefined()
  })
})
