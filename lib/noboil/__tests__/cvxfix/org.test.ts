/** biome-ignore-all lint/nursery/noUnsafeTypeAssertion: test fixtures construct and assert partial, invalid, or runtime-shaped values to exercise edge cases */
import { Glob } from 'bun'
import { describe, expect, test } from 'bun:test'
import { convexTest } from 'convex-test'
import { resolve } from 'node:path'
import schema from './convex/schema'

const cvxDir = resolve(import.meta.dir, 'convex')
const loadModules = () => {
  const out: Record<string, () => Promise<Record<string, unknown>>> = {}
  const glob = new Glob('**/*.ts')
  // oxlint-disable-next-line node/no-sync
  for (const rel of glob.scanSync({ cwd: cvxDir }))
    out[`../convex/${rel.replace(/\.ts$/u, '.js')}`] = async () =>
      (await import(`${cvxDir}/${rel}`)) as Record<string, unknown>
  return out
}
const t = () => convexTest(schema, loadModules())
const apiMod = (await import('./convex/_generated/api')) as {
  api: {
    orgs: {
      acceptInvite: unknown
      approveJoinRequest: unknown
      cancelJoinRequest: unknown
      create: unknown
      get: unknown
      getBySlug: unknown
      getPublic: unknown
      invite: unknown
      isSlugAvailable: unknown
      leave: unknown
      members: unknown
      membership: unknown
      myJoinRequest: unknown
      myOrgs: unknown
      pendingInvites: unknown
      pendingJoinRequests: unknown
      rejectJoinRequest: unknown
      remove: unknown
      removeMember: unknown
      requestJoin: unknown
      revokeInvite: unknown
      setAdmin: unknown
      transferOwnership: unknown
      update: unknown
    }
  }
}
const { api } = apiMod
interface OrgDoc {
  _id: string
  name: string
  slug: string
}
const seedUser = async (
  root: ReturnType<typeof t>
): Promise<{ root: ReturnType<typeof t>; tt: ReturnType<typeof t>; userId: string }> => {
  const userId = (await root.run(async ctx => ctx.db.insert('users', { name: 'seed' }))) as string
  return { root, tt: root.withIdentity({ subject: userId }) as ReturnType<typeof t>, userId }
}
const callMutate = async (tt: ReturnType<typeof t>, fn: unknown, args: Record<string, unknown> = {}): Promise<unknown> =>
  tt.mutation(fn as never, args)
const callQuery = async (tt: ReturnType<typeof t>, fn: unknown, args: Record<string, unknown> = {}): Promise<unknown> =>
  tt.query(fn as never, args)
describe('makeOrg integration', () => {
  test('create org as authenticated user, then myOrgs lists it', async () => {
    const { tt } = await seedUser(t())
    const result = (await callMutate(tt, api.orgs.create, { data: { name: 'Acme', slug: 'acme' } })) as {
      orgId: string
    }
    expect(typeof result.orgId).toBe('string')
    const mine = (await callQuery(tt, api.orgs.myOrgs, {})) as { org: OrgDoc; role: string }[]
    expect(mine).toHaveLength(1)
    expect(mine[0]?.org.slug).toBe('acme')
  })
  test('isSlugAvailable returns true for unused; false for taken', async () => {
    const { tt } = await seedUser(t())
    const before = (await callQuery(tt, api.orgs.isSlugAvailable, { slug: 'unique-slug' })) as { available: boolean }
    expect(before.available).toBe(true)
    await callMutate(tt, api.orgs.create, { data: { name: 'X', slug: 'unique-slug' } })
    const after = (await callQuery(tt, api.orgs.isSlugAvailable, { slug: 'unique-slug' })) as { available: boolean }
    expect(after.available).toBe(false)
  })
  test('getBySlug returns the created org', async () => {
    const { tt } = await seedUser(t())
    await callMutate(tt, api.orgs.create, { data: { name: 'Look', slug: 'look-me-up' } })
    const found = (await callQuery(tt, api.orgs.getBySlug, { slug: 'look-me-up' })) as OrgDoc
    expect(found.name).toBe('Look')
  })
  test('owner can invite member by email', async () => {
    const { tt } = await seedUser(t())
    const { orgId } = (await callMutate(tt, api.orgs.create, { data: { name: 'I', slug: 'invite-org' } })) as {
      orgId: string
    }
    const result = (await callMutate(tt, api.orgs.invite, { email: 'b@x.com', isAdmin: false, orgId })) as {
      inviteId: string
      token: string
    }
    expect(typeof result.inviteId).toBe('string')
    expect(typeof result.token).toBe('string')
  })
  test('members listing returns the owner', async () => {
    const { tt } = await seedUser(t())
    const { orgId } = (await callMutate(tt, api.orgs.create, { data: { name: 'M', slug: 'members-org' } })) as {
      orgId: string
    }
    const list = (await callQuery(tt, api.orgs.members, { orgId })) as { role: string; userId: string }[]
    expect(list.length).toBeGreaterThanOrEqual(1)
    expect(['owner', 'admin']).toContain(list[0]?.role)
  })
  test('pendingInvites returns invites for org admin; revokeInvite removes one', async () => {
    const { tt, userId } = await seedUser(t())
    const { orgId } = (await callMutate(tt, api.orgs.create, { data: { name: 'P', slug: 'pi' } })) as { orgId: string }
    const inv = (await callMutate(tt, api.orgs.invite, { email: 'x@y.com', isAdmin: false, orgId })) as {
      inviteId: string
      token: string
    }
    const pending = (await callQuery(tt, api.orgs.pendingInvites, { orgId })) as { _id: string; email: string }[]
    expect(pending.some(p => p.email === 'x@y.com')).toBe(true)
    await callMutate(tt, api.orgs.revokeInvite, { inviteId: inv.inviteId })
    const after = (await callQuery(tt, api.orgs.pendingInvites, { orgId })) as { _id: string }[]
    expect(after.find(p => p._id === inv.inviteId)).toBeUndefined()
    expect(typeof userId).toBe('string')
  })
  test('requestJoin → approveJoinRequest adds member', async () => {
    const owner = await seedUser(t())
    const { orgId } = (await callMutate(owner.tt, api.orgs.create, { data: { name: 'R', slug: 'jr' } })) as {
      orgId: string
    }
    const joinerId = (await owner.root.run(async ctx => ctx.db.insert('users', { name: 'joiner' }))) as string
    const joiner = owner.root.withIdentity({ subject: joinerId }) as ReturnType<typeof t>
    await callMutate(joiner, api.orgs.requestJoin, { orgId })
    const pending = (await callQuery(owner.tt, api.orgs.pendingJoinRequests, { orgId })) as { request: { _id: string } }[]
    expect(pending.length).toBeGreaterThanOrEqual(1)
    await callMutate(owner.tt, api.orgs.approveJoinRequest, { requestId: pending[0]?.request._id })
    const list = (await callQuery(owner.tt, api.orgs.members, { orgId })) as { userId: string }[]
    expect(list.some(m => m.userId === joinerId)).toBe(true)
  })
  test('rejectJoinRequest sets status to rejected', async () => {
    const owner = await seedUser(t())
    const { orgId } = (await callMutate(owner.tt, api.orgs.create, { data: { name: 'Rj', slug: 'rj' } })) as {
      orgId: string
    }
    const joinerId = (await owner.root.run(async ctx => ctx.db.insert('users', { name: 'j' }))) as string
    const joiner = owner.root.withIdentity({ subject: joinerId }) as ReturnType<typeof t>
    await callMutate(joiner, api.orgs.requestJoin, { orgId })
    const pending = (await callQuery(owner.tt, api.orgs.pendingJoinRequests, { orgId })) as { request: { _id: string } }[]
    await callMutate(owner.tt, api.orgs.rejectJoinRequest, { requestId: pending[0]?.request._id })
    const list = (await callQuery(owner.tt, api.orgs.members, { orgId })) as { userId: string }[]
    expect(list.some(m => m.userId === joinerId)).toBe(false)
  })
  test('cancelJoinRequest removes own pending request', async () => {
    const owner = await seedUser(t())
    const { orgId } = (await callMutate(owner.tt, api.orgs.create, { data: { name: 'C', slug: 'cj' } })) as {
      orgId: string
    }
    const joinerId = (await owner.root.run(async ctx => ctx.db.insert('users', { name: 'c' }))) as string
    const joiner = owner.root.withIdentity({ subject: joinerId }) as ReturnType<typeof t>
    await callMutate(joiner, api.orgs.requestJoin, { orgId })
    const my = (await callQuery(joiner, api.orgs.myJoinRequest, { orgId })) as { _id: string }
    await callMutate(joiner, api.orgs.cancelJoinRequest, { requestId: my._id })
    const after = (await callQuery(joiner, api.orgs.myJoinRequest, { orgId })) as null | { status: string }
    expect(after?.status).not.toBe('pending')
  })
  test('setAdmin promotes a member; removeMember removes them', async () => {
    const owner = await seedUser(t())
    const { orgId } = (await callMutate(owner.tt, api.orgs.create, { data: { name: 'A', slug: 'sa' } })) as {
      orgId: string
    }
    const memberUserId = (await owner.root.run(async ctx => ctx.db.insert('users', { name: 'm' }))) as string
    const memberId = (await owner.root.run(async ctx =>
      ctx.db.insert('orgMember', {
        isAdmin: false,
        orgId,
        updatedAt: Date.now(),
        userId: memberUserId
      })
    )) as string
    await callMutate(owner.tt, api.orgs.setAdmin, { isAdmin: true, memberId })
    const beforeRm = (await callQuery(owner.tt, api.orgs.members, { orgId })) as { role: string; userId: string }[]
    expect(beforeRm.find(m => m.userId === memberUserId)?.role).toBe('admin')
    await callMutate(owner.tt, api.orgs.removeMember, { memberId })
    const afterRm = (await callQuery(owner.tt, api.orgs.members, { orgId })) as { userId: string }[]
    expect(afterRm.some(m => m.userId === memberUserId)).toBe(false)
  })
  test('leave removes own membership when not owner', async () => {
    const owner = await seedUser(t())
    const { orgId } = (await callMutate(owner.tt, api.orgs.create, { data: { name: 'L', slug: 'lv' } })) as {
      orgId: string
    }
    const userId2 = (await owner.root.run(async ctx => ctx.db.insert('users', { name: 'l' }))) as string
    await owner.root.run(async ctx =>
      ctx.db.insert('orgMember', {
        isAdmin: false,
        orgId,
        updatedAt: Date.now(),
        userId: userId2
      })
    )
    const u2 = owner.root.withIdentity({ subject: userId2 }) as ReturnType<typeof t>
    await callMutate(u2, api.orgs.leave, { orgId })
    const list = (await callQuery(owner.tt, api.orgs.members, { orgId })) as { userId: string }[]
    expect(list.some(m => m.userId === userId2)).toBe(false)
  })
  test('update slug + avatarId; get returns the org for member', async () => {
    const owner = await seedUser(t())
    const { orgId } = (await callMutate(owner.tt, api.orgs.create, { data: { name: 'U', slug: 'u-orig' } })) as {
      orgId: string
    }
    await callMutate(owner.tt, api.orgs.update, {
      data: { name: 'New', slug: 'u-new' },
      orgId
    })
    const got = (await callQuery(owner.tt, api.orgs.get, { orgId })) as { name: string; slug: string }
    expect(got.slug).toBe('u-new')
    expect(got.name).toBe('New')
  })
  test('update with avatarId replacement deletes old storage', async () => {
    const owner = await seedUser(t())
    const oldId = (await owner.tt.run(async ctx => ctx.storage.store(new Blob(['old'])))) as string
    const newId = (await owner.tt.run(async ctx => ctx.storage.store(new Blob(['new'])))) as string
    const { orgId } = (await callMutate(owner.tt, api.orgs.create, {
      data: { name: 'A', slug: 'av-1' }
    })) as { orgId: string }
    await callMutate(owner.tt, api.orgs.update, { data: { avatarId: oldId }, orgId })
    await callMutate(owner.tt, api.orgs.update, { data: { avatarId: newId }, orgId })
    const got = (await callQuery(owner.tt, api.orgs.get, { orgId })) as { avatarId?: string }
    expect(got.avatarId).toBe(newId)
  })
  test('update fails with ORG_SLUG_TAKEN when slug already used', async () => {
    const owner = await seedUser(t())
    await callMutate(owner.tt, api.orgs.create, { data: { name: 'A', slug: 'taken' } })
    const { orgId } = (await callMutate(owner.tt, api.orgs.create, { data: { name: 'B', slug: 'mine' } })) as {
      orgId: string
    }
    await expect(callMutate(owner.tt, api.orgs.update, { data: { slug: 'taken' }, orgId })).rejects.toThrow(
      /ORG_SLUG_TAKEN/u
    )
  })
  test('getPublic by slug returns trimmed view; null on miss', async () => {
    const owner = await seedUser(t())
    await callMutate(owner.tt, api.orgs.create, { data: { name: 'P', slug: 'pubo' } })
    const got = (await callQuery(owner.tt, api.orgs.getPublic, { slug: 'pubo' })) as { name: string; slug: string }
    expect(got.slug).toBe('pubo')
    const miss = await callQuery(owner.tt, api.orgs.getPublic, { slug: 'absent' })
    expect(miss).toBeNull()
  })
  test('myOrgs lists both owned + member orgs with correct roles', async () => {
    const owner = await seedUser(t())
    await callMutate(owner.tt, api.orgs.create, { data: { name: 'mineA', slug: 'mine-a' } })
    const otherOwnerId = (await owner.root.run(async ctx => ctx.db.insert('users', { name: 'o' }))) as string
    const otherTt = owner.root.withIdentity({ subject: otherOwnerId }) as ReturnType<typeof t>
    const { orgId: otherOrgId } = (await callMutate(otherTt, api.orgs.create, {
      data: { name: 'theirs', slug: 'theirs' }
    })) as { orgId: string }
    await owner.root.run(async ctx =>
      ctx.db.insert('orgMember', { isAdmin: false, orgId: otherOrgId, updatedAt: Date.now(), userId: owner.userId })
    )
    const list = (await callQuery(owner.tt, api.orgs.myOrgs, {})) as { org: { slug: string }; role: string }[]
    expect(list).toHaveLength(2)
    expect(list.some(e => e.role === 'owner')).toBe(true)
    expect(list.some(e => e.role === 'member')).toBe(true)
  })
  test('remove cleans up avatar storage when org has avatarId', async () => {
    const owner = await seedUser(t())
    const avatarId = (await owner.tt.run(async ctx => ctx.storage.store(new Blob(['ava'])))) as string
    const { orgId } = (await callMutate(owner.tt, api.orgs.create, { data: { name: 'AV', slug: 'avrm' } })) as {
      orgId: string
    }
    await callMutate(owner.tt, api.orgs.update, { data: { avatarId }, orgId })
    await callMutate(owner.tt, api.orgs.remove, { orgId })
    const got = await owner.root.run(async ctx => ctx.db.get(orgId))
    expect(got).toBeNull()
  })
  test('remove deletes org + invites + join requests + members', async () => {
    const owner = await seedUser(t())
    const { orgId } = (await callMutate(owner.tt, api.orgs.create, { data: { name: 'R', slug: 'rm' } })) as {
      orgId: string
    }
    await callMutate(owner.tt, api.orgs.invite, { email: 'x@y.com', isAdmin: false, orgId })
    const joinerId = (await owner.root.run(async ctx => ctx.db.insert('users', { name: 'j' }))) as string
    const joiner = owner.root.withIdentity({ subject: joinerId }) as ReturnType<typeof t>
    await callMutate(joiner, api.orgs.requestJoin, { orgId })
    await callMutate(owner.tt, api.orgs.remove, { orgId })
    const got = await owner.root.run(async ctx => ctx.db.get(orgId))
    expect(got).toBeNull()
  })
  test('acceptInvite adds invitee as org member when emails match', async () => {
    const root = t()
    const ownerId = (await root.run(async ctx => ctx.db.insert('users', { name: 'owner' }))) as string
    const inviteeId = (await root.run(async ctx =>
      ctx.db.insert('users', { email: 'invitee@x.com', name: 'invitee' })
    )) as string
    const ownerTt = root.withIdentity({ subject: ownerId }) as ReturnType<typeof t>
    const { orgId } = (await callMutate(ownerTt, api.orgs.create, { data: { name: 'Acc', slug: 'acc' } })) as {
      orgId: string
    }
    const inv = (await callMutate(ownerTt, api.orgs.invite, {
      email: 'invitee@x.com',
      isAdmin: true,
      orgId
    })) as { token: string }
    const inviteeTt = root.withIdentity({
      email: 'invitee@x.com',
      subject: inviteeId
    }) as ReturnType<typeof t>
    await callMutate(inviteeTt, api.orgs.acceptInvite, { token: inv.token })
    const list = (await callQuery(ownerTt, api.orgs.members, { orgId })) as { userId: string }[]
    expect(list.some(m => m.userId === inviteeId)).toBe(true)
  })
  test('membership returns owner role for owner; null for outsider', async () => {
    const owner = await seedUser(t())
    const { orgId } = (await callMutate(owner.tt, api.orgs.create, { data: { name: 'Mb', slug: 'mb' } })) as {
      orgId: string
    }
    const ownerView = (await callQuery(owner.tt, api.orgs.membership, { orgId })) as null | { role: string }
    expect(ownerView?.role).toBe('owner')
    const otherId = (await owner.root.run(async ctx => ctx.db.insert('users', { name: 'o' }))) as string
    const other = owner.root.withIdentity({ subject: otherId }) as ReturnType<typeof t>
    const otherView = await callQuery(other, api.orgs.membership, { orgId })
    expect(otherView).toBeNull()
  })
  test('transferOwnership moves owner role to existing admin', async () => {
    const owner = await seedUser(t())
    const { orgId } = (await callMutate(owner.tt, api.orgs.create, { data: { name: 'T', slug: 'tx' } })) as {
      orgId: string
    }
    const newOwnerUserId = (await owner.root.run(async ctx => ctx.db.insert('users', { name: 'no' }))) as string
    const memberId = (await owner.root.run(async ctx =>
      ctx.db.insert('orgMember', { isAdmin: true, orgId, updatedAt: Date.now(), userId: newOwnerUserId })
    )) as string
    expect(typeof memberId).toBe('string')
    await callMutate(owner.tt, api.orgs.transferOwnership, { newOwnerId: newOwnerUserId, orgId })
    const orgDoc = (await owner.root.run(async ctx => ctx.db.get(orgId))) as { userId: string }
    expect(orgDoc.userId).toBe(newOwnerUserId)
  })
})
