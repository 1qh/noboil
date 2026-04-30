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
    projects: {
      addEditor: unknown
      create: unknown
      editors: unknown
      list: unknown
      read: unknown
      rm: unknown
      update: unknown
    }
  }
}
const { api } = apiMod
interface ListResult {
  page: ProjectDoc[]
}
interface ProjectDoc {
  _id: string
  name: string
  orgId: string
  updatedAt: number
}
const seedOrgWithMember = async (
  root: ReturnType<typeof t>,
  isAdmin = true
): Promise<{ orgId: string; tt: ReturnType<typeof t>; userId: string }> => {
  const userId = (await root.run(async ctx => ctx.db.insert('users', { name: 'seed' }))) as string
  const tt = root.withIdentity({ subject: userId }) as ReturnType<typeof t>
  const orgId = (await tt.run(async ctx => {
    const oid = await ctx.db.insert('org', {
      name: `org-${userId.slice(-4)}`,
      slug: `org-${userId.slice(-4)}`,
      updatedAt: Date.now(),
      userId
    })
    await ctx.db.insert('orgMember', { isAdmin, orgId: oid, updatedAt: Date.now(), userId })
    return oid
  })) as string
  return { orgId, tt, userId }
}
const callMutate = async (tt: ReturnType<typeof t>, fn: unknown, args: Record<string, unknown> = {}): Promise<unknown> =>
  tt.mutation(fn as never, args)
const callQuery = async (tt: ReturnType<typeof t>, fn: unknown, args: Record<string, unknown> = {}): Promise<unknown> =>
  tt.query(fn as never, args)
const paginationOpts = { cursor: null, numItems: 50 }
describe('makeOrgCrud integration', () => {
  test('admin can create + list', async () => {
    const { orgId, tt } = await seedOrgWithMember(t())
    const id = (await callMutate(tt, api.projects.create, { name: 'P1', orgId })) as string
    expect(typeof id).toBe('string')
    const listed = (await callQuery(tt, api.projects.list, { orgId, paginationOpts })) as ListResult
    expect(listed.page).toHaveLength(1)
    expect(listed.page[0]?.name).toBe('P1')
  })
  test('list scopes by orgId', async () => {
    const root = t()
    const { orgId: o1, tt } = await seedOrgWithMember(root)
    await seedOrgWithMember(root)
    await callMutate(tt, api.projects.create, { name: 'in-o1', orgId: o1 })
    const o1List = (await callQuery(tt, api.projects.list, { orgId: o1, paginationOpts })) as ListResult
    expect(o1List.page).toHaveLength(1)
  })
  test('update + read', async () => {
    const { orgId, tt } = await seedOrgWithMember(t())
    const id = (await callMutate(tt, api.projects.create, { name: 'orig', orgId })) as string
    await callMutate(tt, api.projects.update, { id, name: 'renamed', orgId })
    const got = (await callQuery(tt, api.projects.read, { id, orgId })) as ProjectDoc
    expect(got.name).toBe('renamed')
  })
  test('addEditor + editors list', async () => {
    const { orgId, tt } = await seedOrgWithMember(t())
    const projectId = (await callMutate(tt, api.projects.create, { name: 'editable', orgId })) as string
    const otherUserId = (await tt.run(async ctx => {
      const u = await ctx.db.insert('users', { name: 'other' })
      await ctx.db.insert('orgMember', { isAdmin: false, orgId, updatedAt: Date.now(), userId: u })
      return u
    })) as string
    await callMutate(tt, api.projects.addEditor, { editorId: otherUserId, orgId, projectId })
    const list = (await callQuery(tt, api.projects.editors, { orgId, projectId })) as { userId: string }[]
    expect(list.some(e => e.userId === otherUserId)).toBe(true)
  })
  test('rm soft-deletes', async () => {
    const { orgId, tt } = await seedOrgWithMember(t())
    const id = (await callMutate(tt, api.projects.create, { name: 'x', orgId })) as string
    await callMutate(tt, api.projects.rm, { id, orgId })
    const after = (await callQuery(tt, api.projects.list, { orgId, paginationOpts })) as ListResult
    expect(after.page).toHaveLength(0)
  })
})
