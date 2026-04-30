import { describe, expect, test } from 'bun:test'
import { makeMemberReducers } from '../org-members'
interface MemberRow {
  createdAt: { microsSinceUnixEpoch: bigint }
  id: number
  isAdmin: boolean
  orgId: number
  updatedAt: { microsSinceUnixEpoch: bigint }
  userId: { __id: string; isEqual: (o: unknown) => boolean }
}
interface OrgRow {
  createdAt: { microsSinceUnixEpoch: bigint }
  id: number
  updatedAt: { microsSinceUnixEpoch: bigint }
  userId: { __id: string; isEqual: (o: unknown) => boolean }
}
const ident = (label: string) =>
  ({ __id: label, isEqual: (o: unknown) => (o as { __id?: string }).__id === label }) as never
const tsAtMs = (ms: number) => ({ microsSinceUnixEpoch: BigInt(ms) * 1000n }) as never
const captureReducers = () => {
  const out: Record<string, unknown> = {}
  const reducer = (opts: { name: string }, _params: unknown, fn: unknown) => {
    out[opts.name] = fn
    return fn
  }
  return { reducer, reducers: out }
}
const mkOrgTable = () => {
  const rows: OrgRow[] = []
  return {
    rows,
    tbl: {
      [Symbol.iterator]: () => rows[Symbol.iterator](),
      id: {
        delete: (id: number) => {
          const idx = rows.findIndex(r => r.id === id)
          if (idx === -1) return false
          rows.splice(idx, 1)
          return true
        },
        find: (id: number) => rows.find(r => r.id === id) ?? null,
        update: (row: OrgRow) => {
          const idx = rows.findIndex(r => r.id === row.id)
          if (idx !== -1) rows[idx] = row
          return row
        }
      }
    }
  }
}
const mkMemberTable = () => {
  const rows: MemberRow[] = []
  let nextId = 100
  return {
    rows,
    tbl: {
      [Symbol.iterator]: () => rows[Symbol.iterator](),
      delete: (row: MemberRow) => {
        const idx = rows.findIndex(r => r.id === row.id)
        if (idx === -1) return false
        rows.splice(idx, 1)
        return true
      },
      id: {
        delete: (id: number) => {
          const idx = rows.findIndex(r => r.id === id)
          if (idx === -1) return false
          rows.splice(idx, 1)
          return true
        },
        find: (id: number) => rows.find(r => r.id === id) ?? null,
        update: (row: MemberRow) => {
          const idx = rows.findIndex(r => r.id === row.id)
          if (idx !== -1) rows[idx] = row
          return row
        }
      },
      insert: (row: MemberRow) => {
        const next = { ...row, id: nextId }
        nextId += 1
        rows.push(next)
        return next
      }
    }
  }
}
const setup = () => {
  const { reducer, reducers } = captureReducers()
  const org = mkOrgTable()
  const member = mkMemberTable()
  org.rows.push({ createdAt: tsAtMs(0), id: 1, updatedAt: tsAtMs(0), userId: ident('owner') })
  member.rows.push({
    createdAt: tsAtMs(0),
    id: 1,
    isAdmin: true,
    orgId: 1,
    updatedAt: tsAtMs(0),
    userId: ident('owner')
  })
  makeMemberReducers({ reducer } as never, {
    builders: {
      isAdmin: {} as never,
      memberId: {} as never,
      newOwnerId: {} as never,
      orgId: {} as never
    },
    orgMemberPk: t => (t as unknown as { id: never }).id,
    orgMemberTable: () => member.tbl as never,
    orgPk: t => (t as unknown as { id: never }).id,
    orgTable: () => org.tbl as never
  })
  return { member, org, reducers }
}
describe('stdb makeMemberReducers', () => {
  test('org_set_admin promotes a member when called by owner', () => {
    const { member, reducers } = setup()
    const m: MemberRow = {
      createdAt: tsAtMs(0),
      id: 50,
      isAdmin: false,
      orgId: 1,
      updatedAt: tsAtMs(0),
      userId: ident('alice')
    }
    member.rows.push(m)
    const setAdmin = reducers.org_set_admin as (c: never, a: never) => void
    setAdmin({ db: {}, sender: ident('owner'), timestamp: tsAtMs(1) } as never, { isAdmin: true, memberId: 50 } as never)
    expect(member.rows.find(r => r.id === 50)?.isAdmin).toBe(true)
  })
  test('org_set_admin CANNOT_MODIFY_OWNER when target is owner', () => {
    const { reducers } = setup()
    const setAdmin = reducers.org_set_admin as (c: never, a: never) => void
    expect(() => {
      setAdmin({ db: {}, sender: ident('owner'), timestamp: tsAtMs(1) } as never, { isAdmin: false, memberId: 1 } as never)
    }).toThrow(/CANNOT_MODIFY_OWNER/u)
  })
  test('org_remove_member as admin removes plain member', () => {
    const { member, reducers } = setup()
    member.rows.push({
      createdAt: tsAtMs(0),
      id: 60,
      isAdmin: true,
      orgId: 1,
      updatedAt: tsAtMs(0),
      userId: ident('admin')
    })
    member.rows.push({
      createdAt: tsAtMs(0),
      id: 61,
      isAdmin: false,
      orgId: 1,
      updatedAt: tsAtMs(0),
      userId: ident('plain')
    })
    const remove = reducers.org_remove_member as (c: never, a: never) => void
    remove({ db: {}, sender: ident('admin'), timestamp: tsAtMs(1) } as never, { memberId: 61 } as never)
    expect(member.rows.find(r => r.id === 61)).toBeUndefined()
  })
  test('org_remove_member CANNOT_MODIFY_ADMIN when admin removes admin', () => {
    const { member, reducers } = setup()
    member.rows.push({
      createdAt: tsAtMs(0),
      id: 60,
      isAdmin: true,
      orgId: 1,
      updatedAt: tsAtMs(0),
      userId: ident('admin1')
    })
    member.rows.push({
      createdAt: tsAtMs(0),
      id: 61,
      isAdmin: true,
      orgId: 1,
      updatedAt: tsAtMs(0),
      userId: ident('admin2')
    })
    const remove = reducers.org_remove_member as (c: never, a: never) => void
    expect(() => {
      remove({ db: {}, sender: ident('admin1'), timestamp: tsAtMs(1) } as never, { memberId: 61 } as never)
    }).toThrow(/CANNOT_MODIFY_ADMIN/u)
  })
  test('org_leave removes own membership; owner blocked with MUST_TRANSFER_OWNERSHIP', () => {
    const { member, reducers } = setup()
    member.rows.push({
      createdAt: tsAtMs(0),
      id: 70,
      isAdmin: false,
      orgId: 1,
      updatedAt: tsAtMs(0),
      userId: ident('me')
    })
    const leave = reducers.org_leave as (c: never, a: never) => void
    leave({ db: {}, sender: ident('me'), timestamp: tsAtMs(1) } as never, { orgId: 1 } as never)
    expect(member.rows.find(r => r.id === 70)).toBeUndefined()
    expect(() => {
      leave({ db: {}, sender: ident('owner'), timestamp: tsAtMs(2) } as never, { orgId: 1 } as never)
    }).toThrow(/MUST_TRANSFER_OWNERSHIP/u)
  })
  test('org_transfer_ownership requires admin target', () => {
    const { member, org, reducers } = setup()
    member.rows.push({
      createdAt: tsAtMs(0),
      id: 80,
      isAdmin: false,
      orgId: 1,
      updatedAt: tsAtMs(0),
      userId: ident('plain')
    })
    const transfer = reducers.org_transfer_ownership as (c: never, a: never) => void
    expect(() => {
      transfer(
        { db: {}, sender: ident('owner'), timestamp: tsAtMs(1) } as never,
        { newOwnerId: ident('plain'), orgId: 1 } as never
      )
    }).toThrow(/TARGET_MUST_BE_ADMIN/u)
    member.rows.push({
      createdAt: tsAtMs(0),
      id: 81,
      isAdmin: true,
      orgId: 1,
      updatedAt: tsAtMs(0),
      userId: ident('newOwner')
    })
    transfer(
      { db: {}, sender: ident('owner'), timestamp: tsAtMs(2) } as never,
      { newOwnerId: ident('newOwner'), orgId: 1 } as never
    )
    expect(org.rows[0]?.userId.__id).toBe('newOwner')
  })
})
