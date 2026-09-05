/** biome-ignore-all lint/nursery/noUnsafeTypeAssertion: test fixtures construct and assert partial, invalid, or runtime-shaped values to exercise edge cases */
import { describe, expect, test } from 'bun:test'
import type { IdentityFake, Ts } from './_helpers'
import { makeInviteReducers, makeInviteToken } from '../org-invites'
import { captureReducers, ident, tsAtMs } from './_helpers'

interface InviteRow {
  createdAt: Ts
  email: string
  expiresAt: number
  id: number
  isAdmin: boolean
  orgId: number
  token: string
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
  const inviteRows: InviteRow[] = []
  let nextInviteId = 1
  const joinRows: { id: number; message: string | undefined; orgId: number; status: string; userId: unknown }[] = []
  const inviteTbl = {
    [Symbol.iterator]: () => inviteRows[Symbol.iterator](),
    id: {
      delete: (id: number) => {
        const idx = inviteRows.findIndex(r => r.id === id)
        if (idx === -1) return false
        inviteRows.splice(idx, 1)
        return true
      },
      find: (id: number) => inviteRows.find(r => r.id === id) ?? null
    },
    insert: (row: InviteRow) => {
      const next = { ...row, id: nextInviteId }
      nextInviteId += 1
      inviteRows.push(next)
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
  const joinTbl = {
    [Symbol.iterator]: () => joinRows[Symbol.iterator](),
    filterByOrgStatus: (orgId: number, status: string) => joinRows.filter(r => r.orgId === orgId && r.status === status),
    id: {
      update: (row: (typeof joinRows)[number]) => {
        const idx = joinRows.findIndex(r => r.id === row.id)
        if (idx !== -1) joinRows[idx] = row
        return row
      }
    }
  }
  makeInviteReducers({ reducer } as never, {
    builders: {
      email: {} as never,
      inviteId: {} as never,
      isAdmin: {} as never,
      orgId: {} as never,
      token: {} as never
    },
    orgInviteByTokenIndex: t => t,
    orgInvitePk: t => (t as unknown as { id: never }).id,
    orgInviteTable: () => inviteTbl as never,
    orgJoinRequestByOrgStatusIndex: t => t as never,
    orgJoinRequestPk: t => (t as unknown as { id: never }).id,
    orgJoinRequestTable: () => joinTbl as never,
    orgMemberTable: () => memberTbl as never,
    orgPk: t => (t as unknown as { id: never }).id,
    orgTable: () => orgTbl as never
  })
  return { inviteRows, joinRows, memberRows, orgRows, reducers }
}
describe('stdb makeInviteReducers', () => {
  test('makeInviteToken returns 32-char token', () => {
    const tok = makeInviteToken()
    expect(tok).toHaveLength(32)
  })
  test('org_send_invite inserts invite when called by admin', () => {
    const { inviteRows, reducers } = setup()
    const send = reducers.org_send_invite as (c: never, a: never) => void
    send(
      { db: {}, sender: ident('owner'), timestamp: tsAtMs(0) } as never,
      { email: 'a@b', isAdmin: false, orgId: 1 } as never
    )
    expect(inviteRows).toHaveLength(1)
    expect(inviteRows[0]?.email).toBe('a@b')
  })
  test('org_send_invite NOT_ORG_MEMBER for outsider', () => {
    const { reducers } = setup()
    const send = reducers.org_send_invite as (c: never, a: never) => void
    expect(() => {
      send(
        { db: {}, sender: ident('outsider'), timestamp: tsAtMs(0) } as never,
        { email: 'a@b', isAdmin: false, orgId: 1 } as never
      )
    }).toThrow(/NOT_ORG_MEMBER/u)
  })
  test('org_accept_invite adds member and deletes invite', () => {
    const { inviteRows, memberRows, reducers } = setup()
    const send = reducers.org_send_invite as (c: never, a: never) => void
    const accept = reducers.org_accept_invite as (c: never, a: never) => void
    send(
      { db: {}, sender: ident('owner'), timestamp: tsAtMs(0) } as never,
      { email: 'b@c', isAdmin: true, orgId: 1 } as never
    )
    const tok = inviteRows[0]?.token ?? ''
    accept({ db: {}, sender: ident('newbie'), timestamp: tsAtMs(1) } as never, { token: tok } as never)
    expect(inviteRows).toHaveLength(0)
    expect(memberRows.find(r => r.userId.__id === 'newbie')?.isAdmin).toBe(true)
  })
  test('org_accept_invite INVALID_INVITE for unknown token', () => {
    const { reducers } = setup()
    const accept = reducers.org_accept_invite as (c: never, a: never) => void
    expect(() => {
      accept({ db: {}, sender: ident('x'), timestamp: tsAtMs(0) } as never, { token: 'nope' } as never)
    }).toThrow(/INVALID_INVITE/u)
  })
  test('org_revoke_invite deletes invite when called by admin', () => {
    const { inviteRows, reducers } = setup()
    const send = reducers.org_send_invite as (c: never, a: never) => void
    const revoke = reducers.org_revoke_invite as (c: never, a: never) => void
    send(
      { db: {}, sender: ident('owner'), timestamp: tsAtMs(0) } as never,
      { email: 'r@x', isAdmin: false, orgId: 1 } as never
    )
    const inviteId = inviteRows[0]?.id ?? -1
    revoke({ db: {}, sender: ident('owner'), timestamp: tsAtMs(1) } as never, { inviteId } as never)
    expect(inviteRows).toHaveLength(0)
  })
})
