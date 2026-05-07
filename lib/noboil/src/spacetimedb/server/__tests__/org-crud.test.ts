import { describe, expect, test } from 'bun:test'
import type { IdentityFake, Ts } from './_helpers'
import { makeOrgCrud, orgCascade } from '../org-crud'
import { captureReducers, ident, tsAtMs } from './_helpers'
interface MemberRow {
  isAdmin: boolean
  orgId: number
  userId: IdentityFake
}
interface ProjectRow {
  createdAt: Ts
  deletedAt?: Ts
  editors?: IdentityFake[]
  id: number
  name?: string
  orgId: number
  updatedAt: Ts
  userId: IdentityFake
}
const mkProjectTable = () => {
  const rows: ProjectRow[] = []
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
      update: (row: ProjectRow) => {
        const idx = rows.findIndex(r => r.id === row.id)
        if (idx !== -1) rows[idx] = row
        return row
      }
    },
    insert: (row: ProjectRow) => {
      const next = { ...row, id: nextId }
      nextId += 1
      rows.push(next)
      return next
    }
  }
  return { rows, tbl }
}
const mkMemberTable = () => {
  const rows: MemberRow[] = []
  const tbl = { [Symbol.iterator]: () => rows[Symbol.iterator]() }
  return { rows, tbl }
}
const baseConfig = (project: ReturnType<typeof mkProjectTable>, member: ReturnType<typeof mkMemberTable>) => ({
  expectedUpdatedAtField: { optional: () => ({}) } as never,
  fields: {
    name: { optional: () => ({}) } as never,
    userId: { optional: () => ({}) } as never
  },
  idField: {} as never,
  orgIdField: {} as never,
  orgMemberTable: () => member.tbl as never,
  pk: (t: unknown) => (t as { id: never }).id,
  table: () => project.tbl as never,
  tableName: 'project'
})
describe('stdb makeOrgCrud', () => {
  test('create requires org membership; rejects NOT_ORG_MEMBER', () => {
    const { reducer, reducers } = captureReducers()
    const project = mkProjectTable()
    const member = mkMemberTable()
    makeOrgCrud({ reducer }, baseConfig(project, member))
    const create = reducers.create_project as (c: never, a: never) => void
    expect(() => {
      create({ db: {}, sender: ident('outsider'), timestamp: tsAtMs(0) } as never, { name: 'x', orgId: 1 } as never)
    }).toThrow(/NOT_ORG_MEMBER/u)
  })
  test('create succeeds for member; isOrgOwner fallback grants admin', () => {
    const { reducer, reducers } = captureReducers()
    const project = mkProjectTable()
    const member = mkMemberTable()
    makeOrgCrud(
      { reducer },
      { ...baseConfig(project, member), isOrgOwner: (db, oid, s) => Boolean(db) && oid === 7 && Boolean(s) }
    )
    const create = reducers.create_project as (c: never, a: never) => void
    create({ db: {}, sender: ident('owner'), timestamp: tsAtMs(0) } as never, { name: 'a', orgId: 7 } as never)
    expect(project.rows).toHaveLength(1)
    expect(project.rows[0]?.name).toBe('a')
  })
  test('update by member; FORBIDDEN for non-owner non-admin', () => {
    const { reducer, reducers } = captureReducers()
    const project = mkProjectTable()
    const member = mkMemberTable()
    member.rows.push({ isAdmin: false, orgId: 1, userId: ident('owner') })
    member.rows.push({ isAdmin: false, orgId: 1, userId: ident('peer') })
    makeOrgCrud({ reducer }, baseConfig(project, member))
    const create = reducers.create_project as (c: never, a: never) => void
    const update = reducers.update_project as (c: never, a: never) => void
    create({ db: {}, sender: ident('owner'), timestamp: tsAtMs(0) } as never, { name: 'orig', orgId: 1 } as never)
    expect(() => {
      update({ db: {}, sender: ident('peer'), timestamp: tsAtMs(1) } as never, { id: 1, name: 'hax' } as never)
    }).toThrow(/FORBIDDEN/u)
  })
  test('update CONFLICT when expectedUpdatedAt mismatches', () => {
    const { reducer, reducers } = captureReducers()
    const project = mkProjectTable()
    const member = mkMemberTable()
    member.rows.push({ isAdmin: true, orgId: 1, userId: ident('admin') })
    makeOrgCrud({ reducer }, baseConfig(project, member))
    const create = reducers.create_project as (c: never, a: never) => void
    const update = reducers.update_project as (c: never, a: never) => void
    create({ db: {}, sender: ident('admin'), timestamp: tsAtMs(0) } as never, { name: 'a', orgId: 1 } as never)
    expect(() => {
      update(
        { db: {}, sender: ident('admin'), timestamp: tsAtMs(10) } as never,
        { expectedUpdatedAt: tsAtMs(99), id: 1, name: 'b' } as never
      )
    }).toThrow(/CONFLICT/u)
  })
  test('rm soft-deletes when softDelete enabled', () => {
    const { reducer, reducers } = captureReducers()
    const project = mkProjectTable()
    const member = mkMemberTable()
    member.rows.push({ isAdmin: true, orgId: 1, userId: ident('admin') })
    makeOrgCrud({ reducer }, { ...baseConfig(project, member), options: { softDelete: true } })
    const create = reducers.create_project as (c: never, a: never) => void
    const rm = reducers.rm_project as (c: never, a: never) => void
    create({ db: {}, sender: ident('admin'), timestamp: tsAtMs(0) } as never, { name: 'a', orgId: 1 } as never)
    rm({ db: {}, sender: ident('admin'), timestamp: tsAtMs(5) } as never, { id: 1 } as never)
    expect(project.rows).toHaveLength(1)
    expect(project.rows[0]?.deletedAt).toBeDefined()
  })
  test('rm cascades children when cascade option set', () => {
    const { reducer, reducers } = captureReducers()
    const project = mkProjectTable()
    const member = mkMemberTable()
    member.rows.push({ isAdmin: true, orgId: 1, userId: ident('admin') })
    const taskRows: { id: number; projectId: number }[] = [
      { id: 10, projectId: 1 },
      { id: 11, projectId: 1 },
      { id: 12, projectId: 2 }
    ]
    const taskTbl = {
      [Symbol.iterator]: () => taskRows[Symbol.iterator](),
      id: {
        delete: (id: number) => {
          const idx = taskRows.findIndex(r => r.id === id)
          if (idx === -1) return false
          taskRows.splice(idx, 1)
          return true
        }
      }
    }
    const db = { task: taskTbl }
    makeOrgCrud(
      { reducer },
      {
        ...baseConfig(project, member),
        options: { cascade: { foreignKey: 'projectId', table: 'task' } },
        table: () => project.tbl as never
      }
    )
    const create = reducers.create_project as (c: never, a: never) => void
    const rm = reducers.rm_project as (c: never, a: never) => void
    create({ db, sender: ident('admin'), timestamp: tsAtMs(0) } as never, { name: 'a', orgId: 1 } as never)
    rm({ db, sender: ident('admin'), timestamp: tsAtMs(5) } as never, { id: 1 } as never)
    expect(project.rows).toHaveLength(0)
    expect(taskRows).toEqual([{ id: 12, projectId: 2 }])
  })
  test('hooks before/after fire on create + update', () => {
    const { reducer, reducers } = captureReducers()
    const project = mkProjectTable()
    const member = mkMemberTable()
    member.rows.push({ isAdmin: true, orgId: 1, userId: ident('admin') })
    const calls: string[] = []
    makeOrgCrud(
      { reducer },
      {
        ...baseConfig(project, member),
        options: {
          hooks: {
            afterCreate: () => {
              calls.push('afterCreate')
            },
            afterUpdate: () => {
              calls.push('afterUpdate')
            },
            beforeCreate: (_c, p) => {
              calls.push('beforeCreate')
              return p.data
            },
            beforeUpdate: (_c, p) => {
              calls.push('beforeUpdate')
              return p.patch
            }
          }
        }
      }
    )
    const create = reducers.create_project as (c: never, a: never) => void
    const update = reducers.update_project as (c: never, a: never) => void
    create({ db: {}, sender: ident('admin'), timestamp: tsAtMs(0) } as never, { name: 'a', orgId: 1 } as never)
    update({ db: {}, sender: ident('admin'), timestamp: tsAtMs(1) } as never, { id: 1, name: 'b' } as never)
    expect(calls).toEqual(['beforeCreate', 'afterCreate', 'beforeUpdate', 'afterUpdate'])
  })
  test('addEditor/removeEditor/setEditors flow when acl enabled', () => {
    const { reducer, reducers } = captureReducers()
    const project = mkProjectTable()
    const member = mkMemberTable()
    member.rows.push({ isAdmin: true, orgId: 1, userId: ident('admin') })
    makeOrgCrud({ reducer }, { ...baseConfig(project, member), options: { acl: true } })
    const create = reducers.create_project as (c: never, a: never) => void
    const add = reducers.add_editor_project as (c: never, a: never) => void
    const remove = reducers.remove_editor_project as (c: never, a: never) => void
    const setE = reducers.set_editors_project as (c: never, a: never) => void
    create({ db: {}, sender: ident('admin'), timestamp: tsAtMs(0) } as never, { name: 'a', orgId: 1 } as never)
    add({ db: {}, sender: ident('admin'), timestamp: tsAtMs(1) } as never, { editorId: ident('e1'), id: 1 } as never)
    add({ db: {}, sender: ident('admin'), timestamp: tsAtMs(2) } as never, { editorId: ident('e1'), id: 1 } as never)
    expect(project.rows[0]?.editors).toHaveLength(1)
    add({ db: {}, sender: ident('admin'), timestamp: tsAtMs(3) } as never, { editorId: ident('e2'), id: 1 } as never)
    remove({ db: {}, sender: ident('admin'), timestamp: tsAtMs(4) } as never, { editorId: ident('e1'), id: 1 } as never)
    expect(project.rows[0]?.editors).toHaveLength(1)
    setE(
      {
        db: {},
        sender: ident('admin'),
        timestamp: tsAtMs(5)
      } as never,
      { editorIds: [ident('z')], id: 1 } as never
    )
    expect(project.rows[0]?.editors?.[0]?.__id).toBe('z')
  })
  test('orgCascade builds {foreignKey, table}', () => {
    const fakeSchema = { __name: 'tasks' } as never
    expect(orgCascade(fakeSchema, { foreignKey: 'projectId' })).toEqual({
      foreignKey: 'projectId',
      table: 'tasks'
    })
  })
})
