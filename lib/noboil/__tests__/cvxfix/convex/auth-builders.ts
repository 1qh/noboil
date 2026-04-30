import type { GenericMutationCtx, GenericQueryCtx } from 'convex/server'
import { customCtx } from 'convex-helpers/server/customFunctions'
import { zCustomMutation, zCustomQuery } from 'convex-helpers/server/zod4'
import type { Mb, Qb } from '../../../src/convex/server/types'
import { setup } from '../../../src/convex/server/setup'
import { action, internalMutation, internalQuery, mutation, query } from './_generated/server'
const getAuthUserId = async (ctx: GenericMutationCtx<never> | GenericQueryCtx<never>): Promise<null | string> => {
  const id = await ctx.auth.getUserIdentity()
  return id ? id.subject : null
}
const wired = setup({
  action,
  getAuthUserId,
  internalMutation,
  internalQuery,
  mutation,
  query
})
const cm = zCustomMutation(
  mutation,
  customCtx(() => ({}))
) as unknown as Mb
const cq = zCustomQuery(
  query,
  customCtx(() => ({}))
) as unknown as Qb
const m = wired.m as unknown as Mb
const q = wired.q as unknown as Qb
const pq = wired.pq as unknown as Qb
export { cm, cq, m, pq, q }
