import { Glob } from 'bun'
import { describe, expect, test } from 'bun:test'
import { convexTest } from 'convex-test'
import { resolve } from 'node:path'
import schema from './convex/schema'
const cvxDir = resolve(import.meta.dir, 'convex')
const loadModules = () => {
  const out: Record<string, () => Promise<Record<string, unknown>>> = {}
  const glob = new Glob('**/*.ts')
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
      create: unknown
      get: unknown
      getBySlug: unknown
      invite: unknown
      isSlugAvailable: unknown
      members: unknown
      myOrgs: unknown
      remove: unknown
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
const seedUser = async (root: ReturnType<typeof t>): Promise<{ tt: ReturnType<typeof t>; userId: string }> => {
  const userId = (await root.run(async ctx => ctx.db.insert('users', { name: 'seed' }))) as string
  return { tt: root.withIdentity({ subject: userId }) as ReturnType<typeof t>, userId }
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
})
