/** biome-ignore-all lint/nursery/noUnsafeTypeAssertion: test fixtures construct and assert partial, invalid, or runtime-shaped values to exercise edge cases */
import type { GenericMutationCtx, GenericQueryCtx } from 'convex/server'
import { object, string } from 'zod/v4'
import { schema as nbSchema } from '../../../src/convex/schema'
import { noboil } from '../../../src/convex/server/noboil'
import { action, internalMutation, internalQuery, mutation, query } from './_generated/server'

const getAuthUserId = async (ctx: GenericMutationCtx<never> | GenericQueryCtx<never>): Promise<null | string> => {
  const id = await ctx.auth.getUserIdentity()
  return id ? id.subject : null
}
const s = nbSchema({
  owned: { tagItem: object({ label: string() }) }
})
const api = noboil({
  action,
  getAuthUserId,
  internalMutation,
  internalQuery,
  mutation,
  query,
  tables: ({ table }) => ({
    tagItem: table((s as { tagItem: unknown }).tagItem as never)
  })
})
const tag = api.tagItem as unknown as {
  auth: { list: unknown; read: unknown }
  create: unknown
  rm: unknown
  update: unknown
}
const { create } = tag
const { list } = tag.auth
const { read } = tag.auth
const { rm, update } = tag
export { create, list, read, rm, update }
