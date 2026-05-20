import { describe, expect, test } from 'bun:test'
import type { IdentityFake, Ts } from './_helpers'
import { makeJoinReducers } from '../org-join'
import { captureReducers, ident, tsAtMs } from './_helpers'

interface JoinRow {
  createdAt: Ts
  id: number
  message: string | undefined
  orgId: number
  status: string
  updatedAt: Ts
  userId: IdentityFake
}
interface MemberRow {
  createdAt: Ts
  id: number
  isAdmin: boolean
  orgId: number
  updatedAt: Ts
  userId: IdentityFake
}
interface OrgRow {
  id: number
  userId: IdentityFake
}
const setup = () => {
  const { reducer, reducers } = captureReducers()
  const orgRows: OrgRow[] = [{ id: 1, userId: ident('owner') }]
  const memberRows: MemberRow[] = [
    {
      createdAt: tsAtMs(0),
      id: 1,
      isAdmin: true,
      orgId: 1,
      updatedAt: tsAtMs(0),
      userId: ident('owner')
    }
  ]
  const joinRows: JoinRow[] = []
  let nextJoinId = 1
  const joinTbl = {
    [Symbol.iterator]: () => joinRows[Symbol.iterator](),
    filterByOrgStatus: (orgId: number, status: string) => joinRows.filter(r => r.orgId === orgId && r.status === status),
    id: {
      delete: (id: number) => {
        const idx = joinRows.findIndex(r => r.id === id)
        if (idx === -1) return false
        joinRows.splice(idx, 1)
        return true
      },
      find: (id: number) => joinRows.find(r => r.id === id) ?? null,
      update: (row: JoinRow) => {
        const idx = joinRows.findIndex(r => r.id === row.id)
        if (idx !== -1) joinRows[idx] = row
        return row
      }
    },
    insert: (row: JoinRow) => {
      const next = { ...row, id: nextJoinId }
      nextJoinId += 1
      joinRows.push(next)
      return next
    }
  }
  const orgTbl = {
    [Symbol.iterator]: () => orgRows[Symbol.iterator](),
    id: { find: (id: number) => orgRows.find(r => r.id === id) ?? null }
  }
  const memberTbl = {
    [Symbol.iterator]: () => memberRows[Symbol.iterator](),
    insert: (row: MemberRow) => {
      memberRows.push(row)
      return row
    }
  }
  makeJoinReducers({ reducer } as never, {
    builders: {
      isAdmin: { optional: () => ({}) } as never,
      message: { optional: () => ({}) } as never,
      orgId: {} as never,
      requestId: {} as never
    },
    orgJoinRequestByOrgStatusIndex: t => t as never,
    orgJoinRequestPk: t => (t as unknown as { id: never }).id,
    orgJoinRequestTable: () => joinTbl as never,
    orgMemberTable: () => memberTbl as never,
    orgPk: t => (t as unknown as { id: never }).id,
    orgTable: () => orgTbl as never
  })
  return { joinRows, memberRows, orgRows, reducers }
}
describe('stdb makeJoinReducers', () => {
  test('org_request_join inserts pending row', () => {
    const { joinRows, reducers } = setup()
    const request = reducers.org_request_join as (c: never, a: never) => void
    request({ db: {}, sender: ident('u1'), timestamp: tsAtMs(0) } as never, { message: 'pls', orgId: 1 } as never)
    expect(joinRows).toHaveLength(1)
    expect(joinRows[0]?.status).toBe('pending')
  })
  test('org_request_join ALREADY_ORG_MEMBER for owner', () => {
    const { reducers } = setup()
    const request = reducers.org_request_join as (c: never, a: never) => void
    expect(() => {
      request({ db: {}, sender: ident('owner'), timestamp: tsAtMs(0) } as never, { orgId: 1 } as never)
    }).toThrow(/ALREADY_ORG_MEMBER/u)
  })
  test('org_request_join JOIN_REQUEST_EXISTS on duplicate', () => {
    const { reducers } = setup()
    const request = reducers.org_request_join as (c: never, a: never) => void
    request({ db: {}, sender: ident('u'), timestamp: tsAtMs(0) } as never, { orgId: 1 } as never)
    expect(() => {
      request({ db: {}, sender: ident('u'), timestamp: tsAtMs(1) } as never, { orgId: 1 } as never)
    }).toThrow(/JOIN_REQUEST_EXISTS/u)
  })
  test('org_approve_join transitions to approved + adds member', () => {
    const { joinRows, memberRows, reducers } = setup()
    const request = reducers.org_request_join as (c: never, a: never) => void
    const approve = reducers.org_approve_join as (c: never, a: never) => void
    request({ db: {}, sender: ident('joiner'), timestamp: tsAtMs(0) } as never, { orgId: 1 } as never)
    approve(
      { db: {}, sender: ident('owner'), timestamp: tsAtMs(1) } as never,
      { isAdmin: false, requestId: joinRows[0]?.id } as never
    )
    expect(joinRows[0]?.status).toBe('approved')
    expect(memberRows.find(m => m.userId.__id === 'joiner')).toBeDefined()
  })
  test('org_reject_join sets status to rejected', () => {
    const { joinRows, reducers } = setup()
    const request = reducers.org_request_join as (c: never, a: never) => void
    const reject = reducers.org_reject_join as (c: never, a: never) => void
    request({ db: {}, sender: ident('joiner'), timestamp: tsAtMs(0) } as never, { orgId: 1 } as never)
    reject({ db: {}, sender: ident('owner'), timestamp: tsAtMs(1) } as never, { requestId: joinRows[0]?.id } as never)
    expect(joinRows[0]?.status).toBe('rejected')
  })
  test('org_cancel_join deletes own pending request', () => {
    const { joinRows, reducers } = setup()
    const request = reducers.org_request_join as (c: never, a: never) => void
    const cancel = reducers.org_cancel_join as (c: never, a: never) => void
    request({ db: {}, sender: ident('me'), timestamp: tsAtMs(0) } as never, { orgId: 1 } as never)
    cancel({ db: {}, sender: ident('me'), timestamp: tsAtMs(1) } as never, { requestId: joinRows[0]?.id } as never)
    expect(joinRows).toHaveLength(0)
  })
  test('org_cancel_join FORBIDDEN for other user', () => {
    const { joinRows, reducers } = setup()
    const request = reducers.org_request_join as (c: never, a: never) => void
    const cancel = reducers.org_cancel_join as (c: never, a: never) => void
    request({ db: {}, sender: ident('me'), timestamp: tsAtMs(0) } as never, { orgId: 1 } as never)
    expect(() => {
      cancel({ db: {}, sender: ident('other'), timestamp: tsAtMs(1) } as never, { requestId: joinRows[0]?.id } as never)
    }).toThrow(/FORBIDDEN/u)
  })
})
