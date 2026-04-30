import { describe, expect, test } from 'bun:test'
import { makeOrg } from '../org'
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
  name: string
  slug: string
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
const mkPkTable = <Row extends { id: number }>() => {
  const rows: Row[] = []
  let nextId = 1
  const filterByOrg = (orgId: unknown) => rows.filter(r => (r as unknown as { orgId: unknown }).orgId === orgId)
  return {
    rows,
    tbl: {
      [Symbol.iterator]: () => rows[Symbol.iterator](),
      delete: (row: Row) => {
        const idx = rows.findIndex(r => r.id === row.id)
        if (idx === -1) return false
        rows.splice(idx, 1)
        return true
      },
      filterByOrg,
      filterByOrgStatus: (orgId: unknown, status: string) =>
        rows.filter(
          r =>
            (r as unknown as { orgId: unknown }).orgId === orgId && (r as unknown as { status: string }).status === status
        ),
      id: {
        delete: (id: number) => {
          const idx = rows.findIndex(r => r.id === id)
          if (idx === -1) return false
          rows.splice(idx, 1)
          return true
        },
        find: (id: number) => rows.find(r => r.id === id) ?? null,
        update: (row: Row) => {
          const idx = rows.findIndex(r => r.id === row.id)
          if (idx !== -1) rows[idx] = row
          return row
        }
      },
      insert: (row: Row) => {
        const next = { ...row, id: nextId }
        nextId += 1
        rows.push(next)
        return next
      }
    }
  }
}
const mkConfig = (tables: {
  inviteT: ReturnType<typeof mkPkTable<OrgRow>>
  joinT: ReturnType<typeof mkPkTable<OrgRow>>
  memberT: ReturnType<typeof mkPkTable<MemberRow>>
  orgT: ReturnType<typeof mkPkTable<OrgRow>>
}) => ({
  builders: {
    email: { optional: () => ({}) } as never,
    inviteId: { optional: () => ({}) } as never,
    isAdmin: { optional: () => ({}) } as never,
    memberId: { optional: () => ({}) } as never,
    message: { optional: () => ({}) } as never,
    newOwnerId: { optional: () => ({}) } as never,
    orgId: { optional: () => ({}) } as never,
    requestId: { optional: () => ({}) } as never,
    token: { optional: () => ({}) } as never
  },
  fields: { name: { optional: () => ({}) } as never, slug: { optional: () => ({}) } as never },
  orgByUserIndex: (t: never) => t,
  orgInviteByOrgIndex: (t: never) => t,
  orgInviteByTokenIndex: (t: never) => t,
  orgInvitePk: (t: never) => (t as unknown as { id: never }).id,
  orgInviteTable: () => tables.inviteT.tbl as never,
  orgJoinRequestByOrgIndex: (t: never) => t,
  orgJoinRequestByOrgStatusIndex: (t: never) => t,
  orgJoinRequestPk: (t: never) => (t as unknown as { id: never }).id,
  orgJoinRequestTable: () => tables.joinT.tbl as never,
  orgMemberByOrgIndex: (t: never) => t,
  orgMemberByUserIndex: (t: never) => t,
  orgMemberPk: (t: never) => (t as unknown as { id: never }).id,
  orgMemberTable: () => tables.memberT.tbl as never,
  orgPk: (t: never) => (t as unknown as { id: never }).id,
  orgSlugIndex: (t: never) => t,
  orgTable: () => tables.orgT.tbl as never
})
const setup = () => {
  const { reducer, reducers } = captureReducers()
  const orgT = mkPkTable<OrgRow>()
  const memberT = mkPkTable<MemberRow>()
  const inviteT = mkPkTable<OrgRow>()
  const joinT = mkPkTable<OrgRow>()
  makeOrg({ reducer } as never, mkConfig({ inviteT, joinT, memberT, orgT }) as never)
  return { inviteT, joinT, memberT, orgT, reducers }
}
describe('stdb makeOrg lifecycle', () => {
  test('org_create inserts org + admin member for sender', () => {
    const { memberT, orgT, reducers } = setup()
    const create = reducers.org_create as (c: never, a: never) => void
    create({ db: {}, sender: ident('founder'), timestamp: tsAtMs(0) } as never, { name: 'Acme', slug: 'acme' } as never)
    expect(orgT.rows).toHaveLength(1)
    expect(orgT.rows[0]?.slug).toBe('acme')
    expect(memberT.rows).toHaveLength(1)
    expect(memberT.rows[0]?.isAdmin).toBe(true)
  })
  test('org_create rejects duplicate slug ORG_SLUG_TAKEN', () => {
    const { reducers } = setup()
    const create = reducers.org_create as (c: never, a: never) => void
    create({ db: {}, sender: ident('a'), timestamp: tsAtMs(0) } as never, { name: 'A', slug: 'same' } as never)
    expect(() => {
      create({ db: {}, sender: ident('b'), timestamp: tsAtMs(1) } as never, { name: 'B', slug: 'same' } as never)
    }).toThrow(/ORG_SLUG_TAKEN/u)
  })
  test('org_update changes name when called by owner', () => {
    const { orgT, reducers } = setup()
    const create = reducers.org_create as (c: never, a: never) => void
    const update = reducers.org_update as (c: never, a: never) => void
    const founder = ident('f')
    create({ db: {}, sender: founder, timestamp: tsAtMs(0) } as never, { name: 'A', slug: 's' } as never)
    update({ db: {}, sender: founder, timestamp: tsAtMs(1) } as never, { name: 'A2', orgId: 1 } as never)
    expect(orgT.rows[0]?.name).toBe('A2')
  })
  test('org_update FORBIDDEN for non-member', () => {
    const { reducers } = setup()
    const create = reducers.org_create as (c: never, a: never) => void
    const update = reducers.org_update as (c: never, a: never) => void
    create({ db: {}, sender: ident('owner'), timestamp: tsAtMs(0) } as never, { name: 'A', slug: 's' } as never)
    expect(() => {
      update({ db: {}, sender: ident('intruder'), timestamp: tsAtMs(1) } as never, { name: 'X', orgId: 1 } as never)
    }).toThrow(/NOT_ORG_MEMBER/u)
  })
  test('org_remove deletes org + memberships when called by owner', () => {
    const { memberT, orgT, reducers } = setup()
    const create = reducers.org_create as (c: never, a: never) => void
    const remove = reducers.org_remove as (c: never, a: never) => void
    const founder = ident('f')
    create({ db: {}, sender: founder, timestamp: tsAtMs(0) } as never, { name: 'A', slug: 's' } as never)
    remove({ db: {}, sender: founder, timestamp: tsAtMs(1) } as never, { orgId: 1 } as never)
    expect(orgT.rows).toHaveLength(0)
    expect(memberT.rows).toHaveLength(0)
  })
  test('org_remove FORBIDDEN for non-owner admin', () => {
    const { memberT, reducers } = setup()
    const create = reducers.org_create as (c: never, a: never) => void
    const remove = reducers.org_remove as (c: never, a: never) => void
    create({ db: {}, sender: ident('founder'), timestamp: tsAtMs(0) } as never, { name: 'A', slug: 's' } as never)
    memberT.rows.push({
      createdAt: tsAtMs(0),
      id: 99,
      isAdmin: true,
      orgId: 1,
      updatedAt: tsAtMs(0),
      userId: ident('admin')
    })
    expect(() => {
      remove({ db: {}, sender: ident('admin'), timestamp: tsAtMs(2) } as never, { orgId: 1 } as never)
    }).toThrow(/FORBIDDEN/u)
  })
  test('org_update NOT_FOUND for missing org', () => {
    const { reducers } = setup()
    const update = reducers.org_update as (c: never, a: never) => void
    expect(() => {
      update({ db: {}, sender: ident('x'), timestamp: tsAtMs(0) } as never, { name: 'N', orgId: 999 } as never)
    }).toThrow(/NOT_FOUND/u)
  })
})
